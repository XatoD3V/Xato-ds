// Utilidades compartidas por los comandos.
function unwrap(message) {
  if (!message) return null;
  return (
    (message.ephemeralMessage && message.ephemeralMessage.message) ||
    (message.viewOnceMessage && message.viewOnceMessage.message) ||
    message
  );
}

async function fetchWithTimeout(url, { timeout = 15000, headers = {} } = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (XatoDs)', ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}
const getJson = async (url, opts) => (await fetchWithTimeout(url, opts)).json();
const getBuffer = async (url, opts) => {
  const r = await fetchWithTimeout(url, opts);
  return { buffer: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
};

// Descarga el medio del propio mensaje o del mensaje al que se responde.
// kinds: ['imageMessage', 'stickerMessage', ...]
async function getMedia(sock, m, kinds) {
  const { downloadMediaMessage } = await require('./baileys').load();
  const pino = require('pino');
  const content = unwrap(m.message);
  if (!content) return null;

  let holder = null;
  for (const k of kinds) {
    if (content[k]) { holder = { key: m.key, message: { [k]: content[k] } }; break; }
  }
  if (!holder) {
    const ctxHolder = content.extendedTextMessage || content.imageMessage || content.videoMessage || {};
    const ctx = ctxHolder.contextInfo;
    const quoted = ctx && unwrap(ctx.quotedMessage);
    if (quoted) {
      for (const k of kinds) {
        if (quoted[k]) {
          holder = {
            key: { remoteJid: m.key.remoteJid, id: ctx.stanzaId, participant: ctx.participant },
            message: { [k]: quoted[k] },
          };
          break;
        }
      }
    }
  }
  if (!holder) return null;
  return downloadMediaMessage(holder, 'buffer', {}, {
    logger: pino({ level: 'silent' }),
    reuploadRequest: sock.updateMediaMessage,
  });
}

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const fmtNum = (n) => String(Math.round(n * 1e8) / 1e8);

// Foto de perfil de WhatsApp (prueba cada ID); devuelve null si es privada o no tiene.
async function getProfilePicture(sock, ids) {
  for (const id of [].concat(ids).filter(Boolean)) {
    try {
      const url = await sock.profilePictureUrl(id, 'image');
      if (url) return (await getBuffer(url, { timeout: 15000 })).buffer;
    } catch { /* privada, sin foto o ID no valido */ }
  }
  return null;
}

const getText = async (url, opts) => (await fetchWithTimeout(url, opts)).text();

// ---- identidad y permisos ----
const num = (jid = '') => String(jid).split('@')[0].split(':')[0];
const sameUser = (a, b) => Boolean(a && b && num(a) === num(b));

function getContext(m) {
  const c = unwrap(m.message) || {};
  const h = c.extendedTextMessage || c.imageMessage || c.videoMessage || c.documentMessage || c.audioMessage || c.stickerMessage || {};
  return h.contextInfo || {};
}

function getQuotedText(m) {
  const q = unwrap(getContext(m).quotedMessage);
  if (!q) return '';
  return q.conversation || (q.extendedTextMessage && q.extendedTextMessage.text) || (q.imageMessage && q.imageMessage.caption) || '';
}

// Usuarios objetivo: menciones, mensaje respondido o numeros escritos.
function getTargets(m, args = []) {
  const ctx = getContext(m);
  const map = new Map();
  for (const j of ctx.mentionedJid || []) map.set(num(j), j);
  if (!map.size && ctx.participant) map.set(num(ctx.participant), ctx.participant);
  for (const a of args) {
    const d = a.replace(/\D/g, '');
    if (d.length >= 8 && d.length <= 15 && !map.has(d)) map.set(d, d + '@s.whatsapp.net');
  }
  return [...map.values()];
}

function isAdminIn(meta, ids) {
  return Boolean(meta) && meta.participants.some((p) =>
    p.admin && ids.filter(Boolean).some((id) => [p.id, p.lid, p.phoneNumber].some((x) => x && sameUser(x, id))));
}

const cds = new Map();
function cooldown(key, ms) {
  const now = Date.now();
  const t = cds.get(key) || 0;
  if (now < t) return Math.ceil((t - now) / 1000);
  cds.set(key, now + ms);
  return 0;
}
// Cooldown guardado en el usuario. Devuelve los ms que faltan, o 0 y activa el cooldown.
function takeCooldown(user, key, ms) {
  user.cd = user.cd || {};
  const left = (user.cd[key] || 0) - Date.now();
  if (left > 0) return left;
  user.cd[key] = Date.now() + ms;
  return 0;
}

// Sube un archivo a uguu.se (alojamiento temporal anonimo, ~3 horas) y devuelve la URL.
async function uploadTemp(buffer, filename = 'archivo.bin') {
  const form = new FormData();
  form.append('files[]', new Blob([buffer]), filename);
  const r = await fetch('https://uguu.se/upload.php', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const url = j && j.files && j.files[0] && j.files[0].url;
  if (!url) throw new Error('subida invalida');
  return url;
}

// Convierte un GIF a MP4 con ffmpeg (para enviarlo como GIF animado). Devuelve null si no hay ffmpeg.
async function gifToMp4(gifUrl) {
  const { spawn, spawnSync } = require('child_process');
  const fs = require('fs'), os = require('os'), path = require('path');
  if (spawnSync('ffmpeg', ['-version'], { timeout: 5000 }).status !== 0) return null;
  const { buffer } = await getBuffer(gifUrl, { timeout: 30000 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xgif-'));
  const inp = path.join(dir, 'in.gif'), out = path.join(dir, 'out.mp4');
  try {
    fs.writeFileSync(inp, buffer);
    await new Promise((res, rej) => {
      const p = spawn('ffmpeg', ['-y', '-i', inp, '-movflags', 'faststart', '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', out], { stdio: 'ignore' });
      const t = setTimeout(() => p.kill('SIGKILL'), 30000);
      p.on('close', (c) => { clearTimeout(t); c === 0 ? res() : rej(new Error('ffmpeg')); });
      p.on('error', rej);
    });
    return fs.readFileSync(out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmtTime = (ms) => {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h && `${h}h`, m && `${m}m`, !h && `${sec}s`].filter(Boolean).join(' ');
};

module.exports = {
  unwrap, getJson, getText, getBuffer, getMedia, getProfilePicture, norm, fmtNum,
  num, sameUser, getContext, getQuotedText, getTargets, isAdminIn, cooldown, pick, rand, fmtTime, takeCooldown, uploadTemp, gifToMp4,
};
