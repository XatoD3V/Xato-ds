const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const pino = require('pino');
const baileys = require('./baileys');
const { handleMessage } = require('./handler');
const { onParticipants } = require('./group-events');
const { Store } = require('./db');
const reminders = require('./reminders');
const config = require('../config');
const { skinContent } = require('./deco');


const fmtCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;
const QR_WINDOW_MS = 3 * 60 * 1000; // tiempo para escanear antes de liberar el cupo

const httpError = (status, message) => Object.assign(new Error(message), { status });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache sencilla con limite (para mensajes enviados y metadatos de grupos)
class Cache {
  constructor(max = 2000) { this.max = max; this.m = new Map(); }
  get(k) { return this.m.get(k); }
  set(k, v) { this.m.delete(k); this.m.set(k, v); if (this.m.size > this.max) this.m.delete(this.m.keys().next().value); }
  del(k) { this.m.delete(k); }
  flushAll() { this.m.clear(); }
}

class SessionManager {
  constructor({ serverId, dir, max }) {
    this.serverId = serverId;
    this.dir = dir;
    this.max = max;
    this.live = new Map();
    this.logger = pino({ level: 'silent' });
    fs.mkdirSync(dir, { recursive: true });
    this.store = new Store(path.join(dir, 'db.json'));
  }

  // Cada carpeta dentro de /data/serverN es un registro (cupo ocupado).
  numbers() {
    return fs.readdirSync(this.dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  }
  used() { return this.numbers().length; }
  has(number) { return this.numbers().includes(number); }

  snapshot() {
    return this.numbers().map((number) => {
      const e = this.live.get(number);
      return { number, status: e ? e.status : 'inactivo', since: e ? e.createdAt : null, mode: e ? e.mode : null, sub: Boolean(this.store.data.bots[number] && this.store.data.bots[number].sub) };
    });
  }

  status(number) {
    if (!this.has(number)) return null;
    const e = this.live.get(number);
    return { number, status: e ? e.status : 'inactivo', mode: e ? e.mode : null, qr: e ? e.qr : null, code: e && e.code ? fmtCode(e.code) : null };
  }

  // opts.mode: 'qr' (por defecto) o 'code' (codigo de vinculacion fijo). opts.sub: sesion creada con !sebot.
  async register(raw, opts = {}) {
    const number = String(raw || '').replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(number)) throw httpError(400, 'Numero invalido. Usa el formato internacional sin +.');
    if (this.has(number)) throw httpError(409, 'Este numero ya esta registrado.');
    if (this.used() >= this.max) throw httpError(409, `Servidor ${this.serverId} lleno (${this.max}/${this.max}).`);
    const mode = ['code', 'qr', 'both'].includes(opts.mode) ? opts.mode : 'both';

    fs.mkdirSync(path.join(this.dir, number), { recursive: true }); // reserva el cupo
    if (opts.sub) { this.store.bot(number).sub = true; this.store.save(); }
    const entry = {
      number, mode, status: mode === 'code' ? 'esperando_codigo' : 'esperando_qr', qr: null, code: null, codeError: false,
      createdAt: Date.now(), everConnected: false, removed: false, sock: null,
    };
    this.live.set(number, entry);
    await this.start(entry);

    const ready = () => (mode === 'code' ? entry.code : mode === 'qr' ? entry.qr : entry.qr && (entry.code || entry.codeError));
    for (let i = 0; i < 100 && !ready() && entry.status !== 'conectado' && entry.status !== 'error'; i++) await sleep(250);
    if (entry.status === 'error') { await this.remove(number); throw httpError(502, 'No se pudo generar el codigo de vinculacion. Intenta de nuevo.'); }
    return { server: this.serverId, number, mode, status: entry.status, qr: entry.qr, code: entry.code ? fmtCode(entry.code) : null };
  }

  async start(entry) {
    const B = await baileys.load();
    const { state, saveCreds } = await B.useMultiFileAuthState(path.join(this.dir, entry.number));
    let version;
    try { ({ version } = await B.fetchLatestBaileysVersion()); } catch { /* usa la version por defecto */ }

    // Caches persistentes durante las reconexiones de esta sesion
    entry.msgCache = entry.msgCache || new Cache(3000);
    entry.groupCache = entry.groupCache || new Cache(500);
    const retryCache = entry.retryCache || (entry.retryCache = new Cache(5000));
    const FULL = B.proto && B.proto.HistorySync && B.proto.HistorySync.HistorySyncType
      ? B.proto.HistorySync.HistorySyncType.FULL : 0;

    const sock = B.makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: B.makeCacheableSignalKeyStore ? B.makeCacheableSignalKeyStore(state.keys, this.logger) : state.keys,
      },
      logger: this.logger,
      browser: B.Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      // Permite el sync necesario para grupos y LID, pero no baja el historial completo
      shouldSyncHistoryMessage: ({ syncType }) => syncType !== FULL,
      msgRetryCounterCache: retryCache,
      cachedGroupMetadata: async (jid) => entry.groupCache.get(jid),
      getMessage: async (key) => {
        const hit = entry.msgCache.get(`${key.remoteJid}:${key.id}`);
        return hit ? hit.message : undefined;
      },
    });
    entry.sock = sock;

    // Guarda lo que el bot envia (reintentos de grupos) y cachea metadatos de grupo
    const send = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, ...rest) => {
      const res = await send(jid, skinContent(content), ...rest);
      if (res && res.key && res.message) entry.msgCache.set(`${res.key.remoteJid}:${res.key.id}`, res);
      return res;
    };
    const gm = sock.groupMetadata.bind(sock);
    sock.groupMetadata = async (jid) => {
      const meta = await gm(jid);
      entry.groupCache.set(jid, meta);
      return meta;
    };
    sock.ev.on('groups.update', (list) => { for (const g of list || []) if (g.id) entry.groupCache.del(g.id); });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      if (entry.removed || entry.sock !== sock) return;
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        // QR (modos qr y both)
        if (entry.mode !== 'code') {
          entry.qr = await QRCode.toDataURL(qr, { margin: 1, width: 360 });
          entry.status = 'esperando_qr';
        }
        // Codigo de vinculacion fijo (modos code y both): se pide una vez, con el socket ya listo
        if (entry.mode !== 'qr' && !sock.__pairRequested && !(sock.authState && sock.authState.creds && sock.authState.creds.registered)) {
          sock.__pairRequested = true;
          try {
            await sock.requestPairingCode(entry.number, config.pairingCode);
            entry.code = config.pairingCode;
            if (entry.mode === 'code') entry.status = 'esperando_codigo';
          } catch (e) {
            console.error(`[server ${this.serverId}] codigo de vinculacion fallo:`, e.message);
            if (entry.mode === 'code') entry.status = 'error'; else entry.codeError = true;
          }
        }
      }
      if (connection === 'open') {
        entry.status = 'conectado';
        entry.qr = null;
        entry.code = null;
        entry.everConnected = true;
        console.log(`[server ${this.serverId}] ${entry.number} conectado`);
        reminders.restore(() => entry.sock, this.store, entry.number);
      }
      if (connection === 'close') {
        const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
          ? lastDisconnect.error.output.statusCode : undefined;

        if (code === B.DisconnectReason.loggedOut) {
          console.log(`[server ${this.serverId}] ${entry.number} cerro sesion desde el telefono`);
          return this.remove(entry.number);
        }
        if (!entry.everConnected && Date.now() - entry.createdAt > QR_WINDOW_MS) {
          console.log(`[server ${this.serverId}] ${entry.number} QR expirado, cupo liberado`);
          return this.remove(entry.number);
        }
        entry.status = 'reconectando';
        setTimeout(() => {
          if (!entry.removed) this.start(entry).catch((e) => console.error('reconexion fallida:', e.message));
        }, 3000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const m of messages) {
        if (m.key && m.message && m.key.id) entry.msgCache.set(`${m.key.remoteJid}:${m.key.id}`, m);
        if (process.env.DEBUG) console.log(`[server ${this.serverId}] upsert(${type}) ${m.key && m.key.remoteJid} fromMe=${m.key && m.key.fromMe}`);
      }
      if (type !== 'notify') return;
      for (const m of messages) {
        handleMessage(sock, m, {
          serverId: this.serverId, store: this.store, botNumber: entry.number, getSock: () => entry.sock,
        }).catch((e) => console.error('error de comando:', e.stack || e.message));
      }
    });

    sock.ev.on('group-participants.update', (ev) => {
      entry.groupCache.del(ev.id);
      onParticipants(sock, ev, this.store).catch((e) => console.error('error de bienvenida:', e.message));
    });
  }

  async remove(number) {
    const e = this.live.get(number);
    if (e) {
      e.removed = true;
      try { await e.sock.logout(); } catch { /* puede no estar conectado */ }
      try { e.sock.end(undefined); } catch { /* ignorar */ }
      this.live.delete(number);
    }
    fs.rmSync(path.join(this.dir, number), { recursive: true, force: true });
  }

  // Al reiniciar, reconecta las sesiones vinculadas y limpia las que nunca se escanearon.
  async restoreAll() {
    for (const number of this.numbers()) {
      const credsFile = path.join(this.dir, number, 'creds.json');
      let linked = false;
      try { linked = Boolean(JSON.parse(fs.readFileSync(credsFile, 'utf8')).me); } catch { /* sin creds */ }
      if (!linked) {
        fs.rmSync(path.join(this.dir, number), { recursive: true, force: true });
        continue;
      }
      const entry = {
        number, status: 'reconectando', qr: null,
        createdAt: Date.now(), everConnected: true, removed: false, sock: null,
      };
      this.live.set(number, entry);
      await this.start(entry);
    }
  }
}

module.exports = { SessionManager };
