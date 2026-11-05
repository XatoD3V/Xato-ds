const config = require('../config');
const commands = require('./commands');
const style = require('./style');
const { unwrap, num, sameUser, isAdminIn, cooldown } = require('./util');
const { levelFor, ensureUser } = require('./db');
const { responseText } = require('./buttons');
const menuState = require('./menu-state');
const { frame } = require('./deco');

const LINK_RE = /(https?:\/\/|www\.|chat\.whatsapp\.com\/)\S+/i;
const isLid = (j) => /@lid$/.test(j || '');
const lidMap = new Map(); // lid -> numero de telefono
const metaCache = new Map();
const noticeAt = new Map();

function getText(message) {
  const c = unwrap(message);
  if (!c) return '';
  return (
    c.conversation ||
    (c.extendedTextMessage && c.extendedTextMessage.text) ||
    (c.imageMessage && c.imageMessage.caption) ||
    (c.videoMessage && c.videoMessage.caption) ||
    responseText(c) ||
    ''
  );
}

async function groupMeta(sock, jid) {
  const c = metaCache.get(jid);
  if (c && Date.now() - c.t < 30000) return c.meta;
  const meta = await sock.groupMetadata(jid);
  metaCache.set(jid, { t: Date.now(), meta });
  return meta;
}

// WhatsApp usa IDs "@lid" en muchos grupos. Se busca el numero real para que el registro
// sea el mismo en privado y en grupos.
async function resolveSender(sock, jid, isGroup, rawSender, alts) {
  if (!isLid(rawSender)) return rawSender;
  const pn = alts.find((a) => !isLid(a));
  if (pn) { lidMap.set(num(rawSender), num(pn)); return `${num(pn)}@s.whatsapp.net`; }
  if (lidMap.has(num(rawSender))) return `${lidMap.get(num(rawSender))}@s.whatsapp.net`;
  if (isGroup) {
    const meta = await groupMeta(sock, jid).catch(() => null);
    const p = meta && meta.participants.find((x) => sameUser(x.id, rawSender) || sameUser(x.lid, rawSender));
    const phone = p && (p.phoneNumber || (!isLid(p.id) ? p.id : null));
    if (phone) { lidMap.set(num(rawSender), num(phone)); return `${num(phone)}@s.whatsapp.net`; }
  }
  return rawSender;
}

function findUser(store, ids) {
  for (const id of ids) {
    const u = store.user(id) || store.findByNum(num(id));
    if (u) return u;
  }
  return null;
}

async function handleMessage(sock, m, extra = {}) {
  const { serverId, store, getSock, botNumber } = extra;
  if (!m.message || !m.key.remoteJid || m.key.remoteJid === 'status@broadcast') return;

  const jid = m.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');
  const fromMe = Boolean(m.key.fromMe);
  const meId = `${num(sock.user && sock.user.id)}@s.whatsapp.net`;
  const rawSender = fromMe ? meId : isGroup ? m.key.participant : jid;
  if (!rawSender) return;
  const alts = [m.key.participantAlt, m.key.remoteJidAlt].filter(Boolean);
  const sender = await resolveSender(sock, jid, isGroup, rawSender, alts);
  const senderIds = [...new Set([sender, rawSender, ...alts])];
  const botIds = [sock.user && sock.user.id, sock.user && sock.user.lid];
  // En un SeBot (bot de otro usuario) su propia cuenta NO es dueño global: solo puede usar comandos marcados selfOk.
  const isSub = Boolean(store.data.bots[botNumber] && store.data.bots[botNumber].sub);
  const isOwner = (fromMe && !isSub) || senderIds.some((id) => config.owners.includes(num(id)));
  const isSelf = fromMe && isSub;
  let text = getText(m.message).trim();
  // Las respuestas simples se enmarcan con simbolos; { raw: true } las deja tal cual
  const reply = (t, o = {}) => sock.sendMessage(jid, { text: o.raw ? t : frame(t) }, { quoted: m });

  /* ---- reglas automaticas de grupo: antilink ---- */
  if (isGroup && !fromMe && text && store.group(jid).antilink && LINK_RE.test(text)) {
    const meta = await groupMeta(sock, jid).catch(() => null);
    if (meta && !isAdminIn(meta, senderIds) && isAdminIn(meta, botIds)) {
      await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
      const g = store.group(jid);
      const k = num(sender);
      g.warns[k] = (g.warns[k] || 0) + 1;
      store.save();
      if (g.warns[k] >= g.warnLimit) {
        g.warns[k] = 0;
        await sock.sendMessage(jid, { text: `🚫 @${k} fue expulsado por enviar enlaces (${g.warnLimit}/${g.warnLimit} advertencias).`, mentions: [sender] });
        await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
      } else {
        await sock.sendMessage(jid, { text: `⚠️ @${k}, los enlaces no estan permitidos.\n*Advertencia ${g.warns[k]}/${g.warnLimit}*`, mentions: [sender] });
      }
      return;
    }
  }

  /* ---- experiencia por actividad (usuarios registrados) ---- */
  const user = findUser(store, senderIds);
  if (user) { ensureUser(user); user.lastSeen = Date.now(); }
  // Despues de !menu, escribir solo el numero de una categoria abre esa categoria (sin botones)
  if (user && /^\d{1,2}$/.test(text) && menuState.has(jid, sender)) text = `${config.prefix}menu ${text}`;
  if (user && text && !cooldown(`xp:${sender}`, 30000)) {
    user.xp += 5 + Math.floor(Math.random() * 6);
    user.level = levelFor(user.xp);
    store.save();
  }

  /* ---- comandos ---- */
  if (process.env.DEBUG) console.log(`[server ${serverId}] msg ${isGroup ? 'grupo' : 'privado'} de ${num(sender)}: ${text.slice(0, 60)}`);
  if (!text.startsWith(config.prefix)) return;
  const [raw, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
  const name = (raw || '').toLowerCase();
  const cmd = commands.find((c) => c.name === name || (c.aliases || []).includes(name));
  if (!cmd) return;
  console.log(`[server ${serverId}] ${config.prefix}${name} de ${num(sender)} (${isGroup ? 'grupo' : 'privado'})`);

  if (store.bot(botNumber).mode === 'privado' && !isOwner) return;
  if (isGroup && store.group(jid).botOff && cmd.name !== 'bot' && !isOwner) return;

  // Comandos de dueño: el dueño principal (o la cuenta de un SeBot en los comandos selfOk)
  const ownerAllowed = isOwner || (cmd.selfOk && isSelf);
  if (cmd.owner && !ownerAllowed) return reply('👑 Solo el dueño del bot puede usar este comando.');

  // Registro obligatorio
  if (!user && !cmd.noReg && !(cmd.owner && ownerAllowed)) {
    if (Date.now() - (noticeAt.get(sender) || 0) > 20000) {
      noticeAt.set(sender, Date.now());
      await sock.sendMessage(jid, { text: style.notRegistered() }, { quoted: m });
    }
    return;
  }

  // Permisos
  let meta = null, isAdmin = false, isBotAdmin = false;
  if (cmd.group || cmd.admin || cmd.botAdmin) {
    if (!isGroup) return reply('👥 Este comando solo funciona en grupos.');
    meta = await groupMeta(sock, jid);
    isAdmin = isOwner || isSelf || isAdminIn(meta, senderIds);
    isBotAdmin = isAdminIn(meta, botIds);
    if (cmd.admin && !isAdmin) return reply('🛡️ Solo los administradores del grupo pueden usar este comando.');
    if (cmd.botAdmin && !isBotAdmin) return reply('🤖 Necesito ser administrador del grupo para hacerlo.');
  }

  const ctx = {
    sock, m, jid, args, text, commands, store, user, sender, senderIds, isGroup, isOwner,
    isAdmin, isBotAdmin, meta, serverId, botNumber, getSock: getSock || (() => sock),
    prefix: config.prefix, config, reply,
  };
  try {
    await cmd.run(ctx);
  } catch (e) {
    console.error(`[cmd ${name}]`, e.message);
    await reply('❌ Ocurrio un error al ejecutar el comando. Intenta de nuevo.').catch(() => {});
  }
}

module.exports = { handleMessage, sameUser };
