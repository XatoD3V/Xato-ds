// !sebot: cualquier usuario registrado puede vincular su propio WhatsApp y convertirse en bot (SeBot).
// El bot genera el codigo de vinculacion fijo o un QR. Cuenta dentro de los 15 cupos (3 servidores x 5).
const config = require('../../config');
const { num, cooldown } = require('../util');

const GATEWAY = () => `http://127.0.0.1:${config.panelPort}`;
const pending = new Set();
const box = (title, rows) => `╭━━〔 ${title} 〕━━⬣\n${rows.map((r) => `┃ ${r}`).join('\n')}\n╰━━━━━━━━━━━━━━━━⬣`;

async function gateway(path, opts = {}) {
  const r = await fetch(`${GATEWAY()}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_KEY || '', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(40000),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

// Sigue la vinculacion y avisa en el mismo chat (no bloquea el comando).
async function follow(getSock, jid, { number, ticket, mode }) {
  const deadline = Date.now() + 3.5 * 60 * 1000;
  let lastQr = null, qrSent = 1;
  const say = (content) => getSock().sendMessage(jid, content).catch(() => {});
  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const r = await gateway(`/api/session/${number}?ticket=${ticket}`).catch(() => null);
      if (!r) continue;
      if (r.status === 404 || r.status === 403) break;
      const s = r.data;
      if (s.status === 'conectado') {
        await say({ text: box('✅ *VINCULADO*', [
          '🤖 ¡Ahora eres un bot de *' + config.botName + '*!',
          `📱 *Numero:* +${number}`,
          `👑 *Desarrollador:* ${config.developer}`,
        ]) + `\n\nDesde tu WhatsApp puedes escribir *${config.prefix}menu* en cualquier chat para usar tu bot.\n` +
          `Otras personas deben registrarse con *${config.prefix}reg nombre.edad* en el chat con tu bot.\n` +
          `_Para desvincularte: WhatsApp > Dispositivos vinculados > cerrar sesion._` });
        return;
      }
      if (mode === 'qr' && s.qr && s.qr !== lastQr && qrSent < 4) {
        if (lastQr !== null) {
          qrSent++;
          await say({ image: Buffer.from(s.qr.split(',')[1], 'base64'), caption: '🔄 *QR actualizado* (el anterior vencio). Escanealo desde otro dispositivo.' });
        }
        lastQr = s.qr;
      }
      if (lastQr === null && s.qr) lastQr = s.qr;
    }
    await say({ text: `⏳ La vinculacion de +${number} expiro y el cupo fue liberado.\nUsa *${config.prefix}sebot* para intentarlo de nuevo.` });
  } finally { pending.delete(num(number)); }
}

module.exports = [
  {
    name: 'sebot', aliases: ['serbot', 'subbot', 'jadibot'], cat: 'General', desc: 'Conviertete en bot (!sebot [codigo|qr] [numero])',
    async run({ sock, m, jid, args, sender, senderIds, isGroup, reply, prefix, getSock }) {
      // La vinculacion se hace SOLO por privado (un QR a la vista de un grupo permitiria robar la sesion)
      if (isGroup) {
        return reply(`🔒 Por seguridad, *${prefix}sebot* solo funciona en privado.\nEscribeme aqui: https://wa.me/${num(sock.user.id)}?text=${encodeURIComponent(`${prefix}sebot`)}`);
      }

      const mode = args.some((a) => /^qr$/i.test(a)) ? 'qr' : 'code';
      const typed = args.map((a) => a.replace(/\D/g, '')).find((d) => d.length >= 8 && d.length <= 15);
      const pn = senderIds.find((i) => !String(i).endsWith('@lid'));
      const own = pn ? num(pn) : null;
      const number = typed || own;
      if (!number) {
        return reply(`📝 Escribe tu numero con codigo de pais:\n*${prefix}sebot codigo 51999999999*\n*${prefix}sebot qr 51999999999*`);
      }
      if (pending.has(number)) return reply('⏳ Ya hay una vinculacion en curso para ese numero. Espera a que termine o expire (3 minutos).');
      const wait = cooldown(`sebot:${num(sender)}`, 2 * 60 * 1000);
      if (wait) return reply(`⏳ Espera ${wait}s antes de pedir otra vinculacion.`);

      await reply('🔧 Preparando tu vinculacion, un momento...');
      let r;
      try {
        r = await gateway('/internal/sebot', { method: 'POST', body: JSON.stringify({ number, mode }) });
      } catch { return reply('❌ No pude contactar al sistema de vinculacion. Intenta de nuevo.'); }
      if (!r.ok) return reply(`❌ ${r.data.error || 'No se pudo iniciar la vinculacion.'}`);

      const d = r.data;
      pending.add(number);
      const head = box('🤖 *SEBOT*', [`📱 *Numero:* +${number}`, `🔐 *Metodo:* ${mode === 'code' ? 'codigo de vinculacion' : 'codigo QR'}`, `🖥️ *Servidor:* ${String(d.server).padStart(2, '0')}`]);

      if (mode === 'code') {
        await sock.sendMessage(jid, { text:
          `${head}\n\n🔑 *Tu codigo:*\n\n*${d.code}*\n\n` +
          `1️⃣ Abre WhatsApp en el telefono de *+${number}*\n` +
          `2️⃣ *Ajustes > Dispositivos vinculados > Vincular dispositivo*\n` +
          `3️⃣ Toca *Vincular con el numero de telefono*\n` +
          `4️⃣ Escribe el codigo *${d.code}*\n\n_Valido por unos minutos._` }, { quoted: m });
      } else {
        await sock.sendMessage(jid, { image: Buffer.from(String(d.qr).split(',')[1], 'base64'), caption:
          `${head}\n\n📷 *Escanea este QR* desde el telefono de *+${number}*:\n` +
          `*Ajustes > Dispositivos vinculados > Vincular dispositivo*\n\n` +
          `⚠️ Debes escanearlo desde *otro dispositivo* (o muestra esta imagen en otra pantalla). Si solo tienes un telefono usa *${prefix}sebot codigo*.\n_Caduca en pocos segundos; si vence, te enviare uno nuevo._` }, { quoted: m });
      }
      follow(getSock, jid, { number, ticket: d.ticket, mode }).catch((e) => { pending.delete(number); console.error('[sebot]', e.message); });
    },
  },
];
