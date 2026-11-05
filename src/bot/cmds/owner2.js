// Control del bot (solo dueño), adaptado del HuTao.
const { getMedia, num } = require('../util');
const CAT = 'Owner';

module.exports = [
  {
    name: 'join', selfOk: true, aliases: ['unirse'], cat: CAT, owner: true, desc: 'El bot entra a un grupo (!join enlace)',
    async run({ sock, args, reply, prefix }) {
      const code = (args.join(' ').match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/) || [])[1];
      if (!code) return reply(`Uso: ${prefix}join https://chat.whatsapp.com/xxxxx`);
      try { await sock.groupAcceptInvite(code); await reply('✅ Me uni al grupo.'); } catch { await reply('❌ No pude unirme (enlace invalido o expirado).'); }
    },
  },
  {
    name: 'leave', selfOk: true, aliases: ['salir'], cat: CAT, owner: true, group: true, desc: 'El bot sale del grupo actual',
    async run({ sock, jid, reply }) { await reply('👋 Hasta luego, salgo del grupo.'); await sock.groupLeave(jid); },
  },
  {
    name: 'setname', selfOk: true, aliases: ['setbotname'], cat: CAT, owner: true, desc: 'Cambia el nombre del bot (!setname texto)',
    async run({ sock, args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t || t.length > 25) return reply(`Uso: ${prefix}setname Nombre (max 25 caracteres)`);
      await sock.updateProfileName(t); await reply(`✅ Nombre actualizado: *${t}*`);
    },
  },
  {
    name: 'setstatus', selfOk: true, aliases: ['setbio'], cat: CAT, owner: true, desc: 'Cambia el estado/bio del bot',
    async run({ sock, args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t || t.length > 139) return reply(`Uso: ${prefix}setstatus texto (max 139 caracteres)`);
      await sock.updateProfileStatus(t); await reply('✅ Estado actualizado.');
    },
  },
  {
    name: 'setpfp', selfOk: true, aliases: ['setbotfoto'], cat: CAT, owner: true, desc: 'Cambia la foto del bot (responde a una imagen)',
    async run({ sock, m, reply, prefix }) {
      const buf = await getMedia(sock, m, ['imageMessage']);
      if (!buf) return reply(`Responde a una imagen con ${prefix}setpfp`);
      await sock.updateProfilePicture(`${num(sock.user.id)}@s.whatsapp.net`, buf); await reply('✅ Foto actualizada.');
    },
  },
  {
    name: 'restart', aliases: ['reiniciar'], cat: CAT, owner: true, desc: 'Reinicia este servidor del bot',
    async run({ reply }) {
      await reply('♻️ Reiniciando este servidor... las sesiones se reconectan solas en unos segundos.');
      setTimeout(() => process.exit(0), 1000);
    },
  },
];
