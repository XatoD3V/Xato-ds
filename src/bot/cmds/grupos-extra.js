// Administracion de grupos adaptada del HuTao.
const { getMedia, getTargets, isAdminIn, num } = require('../util');
const CAT = 'Grupos';
const onoff = (v) => (v ? 'activado ✅' : 'desactivado ❌');

module.exports = [
  {
    name: 'hidetag', aliases: ['notificar', 'n'], cat: CAT, admin: true, desc: 'Menciona a todos sin mostrar la lista',
    async run({ sock, jid, m, args, meta }) {
      const ids = meta.participants.map((p) => p.id);
      await sock.sendMessage(jid, { text: args.join(' ') || '📢', mentions: ids }, { quoted: m });
    },
  },
  {
    name: 'setwelcome', cat: CAT, admin: true, desc: 'Bienvenida personalizada (!setwelcome texto)',
    async run({ args, jid, store, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t) return reply(`Uso: ${prefix}setwelcome Hola {user}, bienvenido a {group}\nVariables: {user} {group} {count}\nPara volver al mensaje por defecto: ${prefix}setwelcome reset`);
      const g = store.group(jid);
      if (t.toLowerCase() === 'reset') { delete g.welcomeText; store.save(); return reply('✅ Bienvenida restablecida al mensaje por defecto.'); }
      if (t.length > 600) return reply('❌ Maximo 600 caracteres.');
      g.welcomeText = t; store.save();
      await reply('✅ Bienvenida personalizada guardada.');
    },
  },
  {
    name: 'setbye', cat: CAT, admin: true, desc: 'Despedida personalizada (!setbye texto)',
    async run({ args, jid, store, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t) return reply(`Uso: ${prefix}setbye Adios {user}, te vamos a extrañar\nVariables: {user} {group} {count}\nPara volver al mensaje por defecto: ${prefix}setbye reset`);
      const g = store.group(jid);
      if (t.toLowerCase() === 'reset') { delete g.byeText; store.save(); return reply('✅ Despedida restablecida al mensaje por defecto.'); }
      if (t.length > 600) return reply('❌ Maximo 600 caracteres.');
      g.byeText = t; store.save();
      await reply('✅ Despedida personalizada guardada.');
    },
  },
  {
    name: 'setgp', aliases: ['setgrupo'], cat: CAT, admin: true, botAdmin: true, desc: 'Cambia el nombre del grupo',
    async run({ sock, jid, args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t || t.length > 100) return reply(`Uso: ${prefix}setgp nuevo nombre (max 100 caracteres)`);
      await sock.groupUpdateSubject(jid, t);
      await reply(`✅ Nombre cambiado a *${t}*`);
    },
  },
  {
    name: 'setgpdesc', cat: CAT, admin: true, botAdmin: true, desc: 'Cambia la descripcion del grupo',
    async run({ sock, jid, args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t || t.length > 500) return reply(`Uso: ${prefix}setgpdesc texto (max 500 caracteres)`);
      await sock.groupUpdateDescription(jid, t);
      await reply('✅ Descripcion actualizada.');
    },
  },
  {
    name: 'setgpbanner', aliases: ['setgpicon'], cat: CAT, admin: true, botAdmin: true, desc: 'Cambia la foto del grupo (responde a una imagen)',
    async run({ sock, m, jid, reply, prefix }) {
      const buf = await getMedia(sock, m, ['imageMessage']);
      if (!buf) return reply(`Responde a una imagen con ${prefix}setgpbanner`);
      await sock.updateProfilePicture(jid, buf);
      await reply('✅ Foto del grupo actualizada.');
    },
  },
  {
    name: 'setwarnlimit', cat: CAT, admin: true, desc: 'Limite de advertencias (!setwarnlimit 3)',
    async run({ args, jid, store, reply, prefix }) {
      const n = parseInt(args[0], 10);
      if (!Number.isFinite(n) || n < 1 || n > 10) return reply(`Uso: ${prefix}setwarnlimit 3  (entre 1 y 10)`);
      store.group(jid).warnLimit = n; store.save();
      await reply(`✅ Ahora se expulsa al llegar a *${n}* advertencias.`);
    },
  },
  {
    name: 'warns', aliases: ['advertencias'], cat: CAT, group: true, desc: 'Lista de advertencias del grupo',
    async run({ jid, store, reply }) {
      const g = store.group(jid);
      const rows = Object.entries(g.warns).filter(([, n]) => n > 0).map(([k, n]) => `⚠️ @${k}: ${n}/${g.warnLimit}`);
      await reply(rows.length ? `⚠️ *ADVERTENCIAS*\n\n${rows.join('\n')}` : '✅ Nadie tiene advertencias en este grupo.');
    },
  },
  {
    name: 'bot', cat: CAT, admin: true, desc: 'Enciende o apaga el bot en el grupo (!bot on|off)',
    async run({ args, jid, store, reply }) {
      const v = (args[0] || '').toLowerCase();
      const g = store.group(jid);
      if (!['on', 'off'].includes(v)) return reply(`🤖 El bot esta *${g.botOff ? 'apagado' : 'encendido'}* en este grupo.\nUso: !bot on | !bot off`);
      g.botOff = v === 'off'; store.save();
      await reply(`🤖 Bot *${g.botOff ? 'apagado' : 'encendido'}* en este grupo.`);
    },
  },
  {
    name: 'options', aliases: ['ajustes', 'config'], cat: CAT, group: true, desc: 'Configuracion del grupo',
    async run({ jid, store, reply, prefix }) {
      const g = store.group(jid);
      await reply(
        `╭━━〔 ⚙️ *AJUSTES DEL GRUPO* 〕━━⬣\n┃ 🔗 *Antilink:* ${onoff(g.antilink)}\n┃ 👋 *Bienvenida:* ${onoff(g.welcome)}${g.welcomeText ? ' (personalizada)' : ''}\n` +
        `┃ 😢 *Despedida:* ${onoff(g.bye)}${g.byeText ? ' (personalizada)' : ''}\n┃ ⚠️ *Limite de advertencias:* ${g.warnLimit}\n┃ 🤖 *Bot:* ${g.botOff ? 'apagado ❌' : 'encendido ✅'}\n` +
        `╰━━━━━━━━━━━━━━⬣\n_Cambia con ${prefix}antilink, ${prefix}bienvenida, ${prefix}setwarnlimit, ${prefix}bot_`
      );
    },
  },
];
