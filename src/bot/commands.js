// Para agregar un comando nuevo, anade un objeto a un archivo de src/bot/cmds/ (o aqui):
// { name, aliases, cat, desc, [noReg, group, admin, botAdmin, owner], async run(ctx) {} }
// ctx: sock, m, jid, args, text, user, store, sender, isGroup, isOwner, isAdmin, meta, reply, prefix, commands
const fs = require('fs');
const path = require('path');
const config = require('../config');
const style = require('./style');
const { pick } = require('./util');
const { sendButtons, quick, list } = require('./buttons');
const menuState = require('./menu-state');

const IMG = path.join(config.assetsDir, 'menu.jpg');
const AUDIO = path.join(config.assetsDir, 'menu.mp3');

const FRASES = [
  'La constancia vence al talento cuando el talento no es constante.',
  'Lo que hoy cuesta, manana se agradece.',
  'Quien siembra paciencia cosecha resultados.',
  'No esperes el momento perfecto: crealo.',
  'Un paso pequeno cada dia supera un salto que nunca se da.',
  'El orden en lo pequeno construye lo grande.',
];
const BOLA = [
  'Si, sin duda.', 'Todo apunta a que si.', 'Es probable.', 'Pregunta de nuevo mas tarde.',
  'No lo tengo claro.', 'Mejor no contar con ello.', 'Mi respuesta es no.', 'Muy dudoso.',
];

// Lista del menu: 7 secciones (y, en el estilo "list", los accesos rapidos en la misma lista; maximo 10 filas)
function menuList(all, prefix, withAccess) {
  const rows = style.menuGroups(all).map((g) => ({ header: '', title: `${g.emoji} ${g.title}`, description: `${g.n} comandos`, id: `${prefix}menu ${g.key}` }));
  if (withAccess) {
    rows.unshift(
      { header: '', title: '👤 Mi perfil', description: 'Tu perfil, nivel y monedas', id: `${prefix}perfil` },
      { header: '', title: '📋 Ver todo', description: 'Todos los comandos', id: `${prefix}menu todo` },
    );
  }
  return list('📂 Ver menu', [{ title: 'Menu del bot', rows }]);
}

const commands = [
  {
    name: 'menu', aliases: ['help', 'ayuda', 'allmenu'], cat: 'General', desc: 'Menu del bot (!menu [numero|nombre|todo])',
    async run({ sock, m, jid, args, commands: all, prefix, user, store, sender }) {
      const q = (args[0] || '').toLowerCase();
      menuState.set(jid, sender);

      // Todos los comandos en un solo mensaje de texto
      if (q === 'todo' || q === 'all') return sock.sendMessage(jid, { text: style.menuAll(all, prefix) }, { quoted: m });

      // Una seccion (texto: supera el limite de 1024 caracteres de los botones)
      if (q) {
        const group = style.resolveCategory(all, q);
        if (!group) return sock.sendMessage(jid, { text: `❌ No existe la seccion *${q}*. Escribe *${prefix}menu* para ver la lista.` }, { quoted: m });
        return sock.sendMessage(jid, { text: style.menuGroup(group, all, prefix) }, { quoted: m });
      }

      // Menu principal: un solo mensaje con imagen, secciones numeradas y botones
      const text = style.menuMain({ name: user ? user.name : 'Invitado', commands: all, prefix, users: store.users().length });
      const image = fs.existsSync(IMG) ? fs.readFileSync(IMG) : null;
      const mode = String(process.env.BUTTONS_STYLE || 'mixed').toLowerCase();
      const buttons = mode === 'list'
        ? [menuList(all, prefix, true)]
        : [menuList(all, prefix, false), quick('👤 Mi perfil', `${prefix}perfil`), quick('🎁 Diario', `${prefix}diario`), quick('📋 Ver todo', `${prefix}menu todo`)];
      const ok = await sendButtons(sock, jid, { text, footer: `${config.brand} · ${config.developer}`, image, buttons, quoted: m });
      if (!ok) {
        if (image) await sock.sendMessage(jid, { image, caption: text }, { quoted: m });
        else await sock.sendMessage(jid, { text }, { quoted: m });
      }
      if (fs.existsSync(AUDIO)) {
        await sock.sendMessage(jid, { audio: fs.readFileSync(AUDIO), mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
      }
    },
  },
  {
    name: 'ping', cat: 'General', desc: 'Latencia del bot',
    async run({ m, reply }) {
      const ms = Math.max(0, Date.now() - Number(m.messageTimestamp) * 1000);
      await reply(`🏓 *Pong!*\n⚡ Latencia: *${ms} ms*`);
    },
  },
  {
    name: 'info', cat: 'General', desc: 'Informacion del bot',
    async run({ reply, serverId }) {
      const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
      await reply(
        `╭━━〔 🤖 *${config.botName.toUpperCase()}* 〕━━⬣\n` +
        `┃ 👑 *Desarrollador:* ${config.developer}\n` +
        `┃ 🌐 *Plataforma:* ${config.brand}\n` +
        `┃ 🖥️ *Servidor:* ${String(serverId).padStart(2, '0')}\n` +
        `┃ ⏱️ *Activo:* ${style.uptime(process.uptime())}\n` +
        `┃ 💾 *Memoria:* ${mem} MB\n` +
        `┃ 🟢 *Node:* ${process.version}\n` +
        `╰━━━━━━━━━━━━━━━━⬣`
      );
    },
  },
  {
    name: 'servidor', aliases: ['server'], cat: 'General', desc: 'Servidor que te atiende',
    async run({ reply, serverId }) {
      await reply(`🖥️ Tu sesion corre en el *Servidor ${String(serverId).padStart(2, '0')}* de ${config.brand}.\n📦 Cupos por servidor: *${config.maxPerServer}*`);
    },
  },
  {
    name: 'id', cat: 'General', desc: 'ID de este chat',
    async run({ jid, reply }) { await reply(`🆔 ${jid}`, { raw: true }); },
  },
  {
    name: 'calc', aliases: ['calcular'], cat: 'Utilidades', desc: 'Calculadora (!calc 2*(3+4))',
    async run({ args, reply, prefix }) {
      const expr = args.join(' ').replace(/,/g, '.').replace(/\^/g, '**');
      if (!expr) return reply(`Uso: ${prefix}calc 2*(3+4)`);
      if (expr.length > 100 || !/^[\d+\-*/%().\s]+$/.test(expr)) return reply('Expresion no valida. Solo numeros y + - * / % ( ) ^');
      try {
        const r = Function(`"use strict"; return (${expr})`)();
        if (!Number.isFinite(r)) throw new Error('inf');
        await reply(`🧮 ${args.join(' ')} = *${Math.round(r * 1e8) / 1e8}*`);
      } catch { await reply('No pude resolver esa operacion.'); }
    },
  },
  {
    name: 'say', aliases: ['decir'], cat: 'Utilidades', desc: 'El bot repite tu texto',
    async run({ args, reply, prefix }) {
      if (!args.length) return reply(`Uso: ${prefix}say hola`);
      await reply(args.join(' ').slice(0, 1000), { raw: true });
    },
  },
  {
    name: 'dado', cat: 'Diversion', desc: 'Lanza un dado (!dado 20)',
    async run({ args, reply }) {
      const n = Math.min(Math.max(parseInt(args[0], 10) || 6, 2), 1000);
      await reply(`🎲 Dado de ${n} caras: *${1 + Math.floor(Math.random() * n)}*`);
    },
  },
  {
    name: 'moneda', cat: 'Diversion', desc: 'Cara o sello',
    async run({ reply }) { await reply(`🪙 *${pick(['Cara', 'Sello'])}*`); },
  },
  {
    name: 'elegir', cat: 'Diversion', desc: 'Elige entre opciones (!elegir a, b, c)',
    async run({ args, reply, prefix }) {
      const opts = args.join(' ').split(/[,|]/).map((s) => s.trim()).filter(Boolean);
      if (opts.length < 2) return reply(`Uso: ${prefix}elegir pizza, tacos, sushi`);
      await reply(`🤔 Elijo: *${pick(opts)}*`);
    },
  },
  {
    name: 'bola', aliases: ['8ball'], cat: 'Diversion', desc: 'Bola 8 (!bola pregunta)',
    async run({ args, reply, prefix }) {
      if (!args.length) return reply(`Uso: ${prefix}bola voy a aprobar?`);
      await reply(`🎱 ${pick(BOLA)}`);
    },
  },
  {
    name: 'frase', cat: 'Diversion', desc: 'Frase motivacional',
    async run({ reply }) { await reply(`💬 _${pick(FRASES)}_`); },
  },
];

module.exports = [
  ...commands,
  ...require('./cmds/registro'),
  ...require('./cmds/economia'),
  ...require('./cmds/rpg'),
  ...require('./cmds/perfil'),
  ...require('./cmds/gacha'),
  ...require('./cmds/juegos'),
  ...require('./cmds/grupos'),
  ...require('./cmds/grupos-extra'),
  ...require('./cmds/anime'),
  ...require('./cmds/math'),
  ...require('./cmds/finanzas'),
  ...require('./cmds/mundo'),
  ...require('./cmds/info'),
  ...require('./cmds/multimedia'),
  ...require('./cmds/descargas'),
  ...require('./cmds/herramientas'),
  ...require('./cmds/textools'),
  ...require('./cmds/extras'),
  ...require('./cmds/estudio'),
  ...require('./cmds/owner'),
  ...require('./cmds/owner2'),
  ...require('./cmds/botones'),
  ...require('./cmds/sebot'),
  ...require('./cmds/utils2'),
];
