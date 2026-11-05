// Textos decorados (negritas, cursivas y emojis) del menu, bienvenida y registro.
const config = require('../config');
const { fancy } = require('./deco');

const CAT = {
  General: '⚙️', Registro: '📝', Perfil: '🪪', Economia: '🪙', Rpg: '⚔️', Casino: '🎰', Gacha: '🎴', Anime: '🌸', Juegos: '🎮', Diversion: '🎲', Grupos: '👥',
  Utilidades: '🛠️', Matematicas: '🧮', Finanzas: '💱', Mundo: '🌎', Informacion: '📰',
  Multimedia: '🎨', Descargas: '📥', Herramientas: '🧰', Estudio: '📚', Owner: '👑',
};
const ORDER = Object.keys(CAT);
const catEmoji = (c) => CAT[c] || '✨';

function categories(commands) {
  commands = commands.filter((c) => !c.hidden);
  const found = [...new Set(commands.map((c) => c.cat || 'General'))];
  return [...ORDER.filter((c) => found.includes(c)), ...found.filter((c) => !ORDER.includes(c))];
}

const clean = (desc = '') => desc.replace(/\s*\(.*\)\s*$/, '').trim();

function uptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function menuHeader({ name, total, users }) {
  return (
    `╭━━━〔 🤖 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
    `┃ 👑 *Desarrollador:* ${config.developer}\n` +
    `┃ 🌐 *Plataforma:* ${config.brand}\n` +
    `┃ 👤 *Usuario:* ${name}\n` +
    `┃ 📊 *Comandos:* ${total}\n` +
    `┃ 👥 *Registrados:* ${users}\n` +
    `┃ ⚡ *Prefijo:* ${config.prefix}\n` +
    `┃ ⏱️ *Activo:* ${uptime(process.uptime())}\n` +
    `╰━━━━━━━━━━━━━━━━━━⬣\n` +
    `_Escribe_ *${config.prefix}comando* _para usarlo_`
  );
}

// Devuelve el menu dividido en bloques para que sea legible en WhatsApp.
function menuBlocks(commands, prefix) {
  const blocks = categories(commands).map((cat) => {
    const lines = commands.filter((c) => (c.cat || 'General') === cat)
      .map((c) => `│ ➤ *${prefix}${c.name}* _${clean(c.desc)}_`).join('\n');
    return `╭─「 ${catEmoji(cat)} *${cat.toUpperCase()}* 」\n${lines}\n╰──────────────⬣`;
  });
  const out = [];
  let cur = '';
  for (const b of blocks) {
    if ((cur + '\n\n' + b).length > 3200 && cur) { out.push(cur); cur = b; } else cur = cur ? `${cur}\n\n${b}` : b;
  }
  if (cur) out.push(cur);
  out[out.length - 1] += `\n\n👑 *Desarrollador:* ${config.developer}\n🌐 ${config.brand}`;
  return out;
}

const CAT_NAMES = { Economia: 'Economia y banco', Rpg: 'RPG', Informacion: 'Informacion', Multimedia: 'Multimedia' };
const catKey = (c) => c.toLowerCase();

// El menu se agrupa en 7 secciones (WhatsApp limita las listas a 10 filas).
const GROUPS = [
  { key: 'general', emoji: '⚙️', title: 'General y cuenta', cats: ['General', 'Registro', 'Perfil'] },
  { key: 'economia', emoji: '🪙', title: 'Economia y juegos', cats: ['Economia', 'Rpg', 'Casino', 'Juegos', 'Diversion'] },
  { key: 'anime', emoji: '🎴', title: 'Gacha y anime', cats: ['Gacha', 'Anime'] },
  { key: 'grupos', emoji: '👥', title: 'Grupos y admin', cats: ['Grupos', 'Owner'] },
  { key: 'herramientas', emoji: '🛠️', title: 'Herramientas', cats: ['Utilidades', 'Herramientas', 'Estudio'] },
  { key: 'calculo', emoji: '🧮', title: 'Calculo y finanzas', cats: ['Matematicas', 'Finanzas'] },
  { key: 'informacion', emoji: '🌎', title: 'Informacion y mundo', cats: ['Mundo', 'Informacion'] },
  { key: 'multimedia', emoji: '🎨', title: 'Multimedia/Descargas', cats: ['Multimedia', 'Descargas'] },
];

function menuGroups(commands) {
  const vis = commands.filter((c) => !c.hidden);
  const groups = GROUPS.map((g) => ({ ...g, n: vis.filter((c) => g.cats.includes(c.cat || 'General')).length })).filter((g) => g.n);
  const assigned = new Set(GROUPS.flatMap((g) => g.cats));
  const rest = vis.filter((c) => !assigned.has(c.cat || 'General'));
  if (rest.length) groups.push({ key: 'otros', emoji: '✨', title: 'Otros', cats: [...new Set(rest.map((c) => c.cat || 'General'))], n: rest.length });
  return groups;
}

// Mensaje principal del menu (un solo mensaje; cabe en el limite de 1024 caracteres de los botones)
function menuMain({ name, commands, prefix, users }) {
  const vis = commands.filter((c) => !c.hidden);
  const lines = menuGroups(vis).map((g, i) => `❯ *${i + 1}.* ${g.emoji} ${g.title} ✦ ${g.n}`).join('\n');
  return (
    `┏━━━━『 ✦ ${fancy(config.botName.toUpperCase())} ✦ 』━━━━⬣\n` +
    `┃ ❖ ${fancy('Creador')} ➜ ${config.developer}\n` +
    `┃ ❖ ${fancy('Plataforma')} ➜ ${config.brand}\n` +
    `┃ ❖ ${fancy('Usuario')} ➜ ${name}\n` +
    `┃ ❖ ${fancy('Comandos')} ➜ ${vis.length}  ✦  ${fancy('Registrados')} ➜ ${users}\n` +
    `┃ ❖ ${fancy('Prefijo')} ➜ ${prefix}  ✦  ${fancy('Activo')} ➜ ${uptime(process.uptime())}\n` +
    `┗━━━━━━━━━━━━━━━━━━⬣\n\n` +
    `✦━━━━ ${fancy('MENU')} ━━━━✦\n_Toca el boton o escribe el numero (ej: 2)_\n\n${lines}\n\n` +
    `⌬ ${fancy('Todo')} ➜ *${prefix}menu todo*`
  );
}

// Una seccion del menu (agrupa varias categorias en un solo mensaje)
function menuGroup(group, commands, prefix) {
  const vis = commands.filter((c) => !c.hidden);
  const parts = group.cats.filter((cat) => vis.some((c) => (c.cat || 'General') === cat)).map((cat) => {
    const rows = vis.filter((c) => (c.cat || 'General') === cat).map((c) => `┃ ❯ *${prefix}${c.name}* ✦ _${clean(c.desc)}_`).join('\n');
    return `┏━━『 ❖ ${catEmoji(cat)} ${(CAT_NAMES[cat] || cat).toUpperCase()} ❖ 』━━⬣\n${rows}\n┗━━━━━━━━━━━━━━━━⬣`;
  });
  return `✦━━『 ${group.emoji} ${fancy(group.title.toUpperCase())} 』━━✦\n\n${parts.join('\n\n')}\n\n↩️ _Escribe otro numero (1-${menuGroups(vis).length}) o_ *${prefix}menu* _para volver._\n⌬ _${config.developer}_`;
}

// Todos los comandos en un solo mensaje de texto
function menuAll(commands, prefix) {
  const vis = commands.filter((c) => !c.hidden);
  const body = menuGroups(vis).map((g) => menuGroup(g, vis, prefix).replace(/\n\n↩️[\s\S]*$/, '')).join('\n\n');
  return `${body}\n\n⌬ ${fancy('Creador')} ➜ ${config.developer}\n✦ ${config.brand}`;
}

// Acepta numero, clave de seccion o nombre de cualquier categoria (ej: rpg, anime, economia)
function resolveCategory(commands, q) {
  const groups = menuGroups(commands);
  const t = String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/^\d{1,2}$/.test(t)) return groups[Number(t) - 1] || null;
  return groups.find((g) => g.key === t || g.cats.some((c) => c.toLowerCase() === t)) ||
    (t.length > 2 ? groups.find((g) => g.title.toLowerCase().startsWith(t)) : null) || null;
}

function welcome({ id, subject, count, commands }) {
  const groups = menuGroups(commands.filter((c) => !c.hidden)).map((g) => `${g.emoji} ${g.title}`).join('\n❯ ');
  return (
    `┏━━━『 ✦ ${fancy('BIENVENIDO/A')} ✦ 』━━━⬣\n` +
    `┃ 🎉 Hola @${id.split('@')[0]}\n` +
    `┃ ❖ ${fancy('Grupo')} ➜ ${subject}\n` +
    `┃ ❖ ${fancy('Miembros')} ➜ ${count}\n` +
    `┃ ❖ ${fancy('Bot')} ➜ ${config.botName}\n` +
    `┃ ❖ ${fancy('Creador')} ➜ ${config.developer}\n` +
    `┗━━━━━━━━━━━━━━━━⬣\n\n` +
    `✦ ${fancy('REGISTRATE')}\n❯ ${config.prefix}reg *nombre.edad*  _(ej: ${config.prefix}reg Juan.20)_\n\n` +
    `✦ ${fancy('MENU')} ➜ *${config.prefix}menu*\n❯ ${groups}\n\n` +
    `_Respeta las reglas y disfruta del grupo._`
  );
}

function goodbye({ id, subject }) {
  return (
    `┏━━『 ✦ ${fancy('HASTA LUEGO')} ✦ 』━━⬣\n` +
    `┃ 😢 @${id.split('@')[0]} salio de *${subject}*\n` +
    `┃ ⌬ ${config.botName} ✦ ${config.developer}\n` +
    `┗━━━━━━━━━━━━━━━━⬣`
  );
}

function regSuccess(u) {
  return (
    `┏━━『 ✅ ${fancy('REGISTRO EXITOSO')} ✅ 』━━⬣\n` +
    `┃ ❖ ${fancy('Nombre')} ➜ ${u.name}\n` +
    `┃ ❖ ${fancy('Edad')} ➜ ${u.age} años\n` +
    `┃ ❖ ${fancy('ID')} ➜ ${u.serial}\n` +
    `┃ ❖ ${fancy('Fecha')} ➜ ${new Date(u.regAt).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}\n` +
    `┃ ❖ ${fancy('Bono')} ➜ ${u.coins} monedas 🪙\n` +
    `┗━━━━━━━━━━━━━━━━━━⬣\n\n` +
    `🎉 ¡Bienvenido/a a *${config.botName}*!\nYa puedes usar todos los comandos.\n` +
    `❯ Escribe *${config.prefix}menu* para verlos.\n\n` +
    `⌬ _Creador: ${config.developer}_`
  );
}

function notRegistered() {
  return (
    `┏━━『 🔒 ${fancy('ACCESO RESTRINGIDO')} 🔒 』━━⬣\n` +
    `┃ 👋 Hola, soy *${config.botName}*\n` +
    `┃ ❖ ${fancy('Creador')} ➜ ${config.developer}\n` +
    `┗━━━━━━━━━━━━━━━━⬣\n\n` +
    `✦ ${fancy('REGISTRATE PRIMERO')}\n❯ ${config.prefix}reg *nombre.edad*\n❯ _Ejemplo:_ ${config.prefix}reg Juan.20\n\n` +
    `_Despues podras usar todos los comandos._`
  );
}

module.exports = { menuHeader, menuBlocks, menuMain, menuGroup, menuGroups, menuAll, resolveCategory, catKey, CAT_NAMES, welcome, goodbye, regSuccess, notRegistered, catEmoji, categories, uptime };
