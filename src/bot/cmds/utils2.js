// Utilidades adaptadas del HuTao: foto de perfil, subir archivos, meta de stickers, sugerencias y herramientas con API.
const config = require('../../config');
const { getMedia, getTargets, getProfilePicture, uploadTemp, cooldown, num } = require('../util');
const CAT = 'Utilidades';

module.exports = [
  {
    name: 'foto', aliases: ['getpic', 'pfp'], cat: CAT, desc: 'Foto de perfil de alguien (!foto @user)',
    async run({ sock, m, jid, args, sender, senderIds, reply }) {
      const t = getTargets(m, args)[0];
      const photo = await getProfilePicture(sock, t ? [t, `${num(t)}@s.whatsapp.net`] : senderIds);
      if (!photo) return reply('❌ No pude obtener la foto: no tiene o la mantiene privada.');
      await sock.sendMessage(jid, { image: photo, caption: `🖼️ Foto de perfil de @${num(t || sender)}`, mentions: [t || sender] }, { quoted: m });
    },
  },
  {
    name: 'tourl', aliases: ['subir'], cat: CAT, desc: 'Sube un archivo y da su enlace temporal (responde)',
    async run({ sock, m, reply, prefix }) {
      const buf = await getMedia(sock, m, ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']);
      if (!buf) return reply(`Responde a una imagen, video, audio o archivo con ${prefix}tourl`);
      try {
        const url = await uploadTemp(buf, 'archivo');
        await reply(`🔗 *Enlace temporal* (dura unas horas):\n${url}\n\n_Cualquiera con el enlace puede verlo._`);
      } catch { await reply('❌ No pude subir el archivo ahora.'); }
    },
  },
  {
    name: 'setmeta', cat: CAT, desc: 'Nombre de tus stickers (!setmeta Pack | Autor)',
    async run({ user, args, store, reply, prefix }) {
      const [pack, author] = args.join(' ').split('|').map((x) => x.trim());
      if (!pack) return reply(`Uso: ${prefix}setmeta Mi Pack | Mi Nombre`);
      user.stickerPack = pack.slice(0, 40); user.stickerAuthor = (author || user.name).slice(0, 40); store.save();
      await reply(`✅ Tus stickers saldran como:\n📦 *${user.stickerPack}*\n✍️ *${user.stickerAuthor}*`);
    },
  },
  {
    name: 'delmeta', cat: CAT, desc: 'Restablece el nombre de tus stickers',
    async run({ user, store, reply }) {
      delete user.stickerPack; delete user.stickerAuthor; store.save();
      await reply('🗑️ Meta de stickers restablecida.');
    },
  },
  {
    name: 'suggest', aliases: ['sugerencia', 'reporte'], cat: CAT, desc: 'Envia una sugerencia al dueño (!suggest texto)',
    async run({ sock, args, sender, user, reply, prefix }) {
      const t = args.join(' ').trim();
      if (t.length < 10) return reply(`Uso: ${prefix}suggest escribe tu sugerencia (minimo 10 caracteres)`);
      if (cooldown(`sug:${sender}`, 60000)) return reply('⏳ Espera un minuto antes de enviar otra sugerencia.');
      const owners = [...new Set([...config.owners, num(sock.user && sock.user.id)])].filter(Boolean);
      for (const o of owners) await sock.sendMessage(`${o}@s.whatsapp.net`, { text: `📨 *SUGERENCIA*\n👤 ${user.name} (${num(sender)})\n\n${t.slice(0, 1000)}` }).catch(() => {});
      await reply('✅ Gracias, tu mensaje fue enviado al desarrollador.');
    },
  },
];
