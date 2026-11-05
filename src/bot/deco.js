// Decoracion con simbolos Unicode (estilo "tabla de caracteres"): marcos, vinetas y letras especiales.
const config = require('../config');

const S = { star: '✦', dia: '❖', hex: '⌬', dot: '◈', arrow: '➜', bullet: '❯', ok: '✔', line: '━' };

// Letras matematicas en negrita sans-serif: ASCII -> 𝗔𝗕𝗖 𝗮𝗯𝗰 𝟭𝟮𝟯
const fancy = (t) => String(t).replace(/[A-Za-z0-9]/g, (c) => {
  const k = c.charCodeAt(0);
  if (k >= 65 && k <= 90) return String.fromCodePoint(0x1D5D4 + k - 65);
  if (k >= 97 && k <= 122) return String.fromCodePoint(0x1D5EE + k - 97);
  return String.fromCodePoint(0x1D7EC + k - 48);
});

// Marco de titulo
const box = (title, rows) => `┏━━『 ✦ ${title} ✦ 』━━⬣\n${rows.filter((r) => r !== null && r !== undefined && r !== false).map((r) => (r === '' ? '┃' : `┃ ${r}`)).join('\n')}\n┗━━━━━━━━━━━━━━━━⬣`;

// Convierte los marcos "antiguos" (╭━━〔 .. 〕━━⬣, ╭─「 .. 」, │ ➤) al estilo nuevo. Es idempotente.
function skin(t) {
  if (typeof t !== 'string' || !t) return t;
  return t
    .replace(/^╭━+〔 (.+?) 〕━+⬣$/gm, (_, x) => `┏━━『 ✦ ${x} ✦ 』━━⬣`)
    .replace(/^╭─「 (.+?) 」$/gm, (_, x) => `┏━━『 ❖ ${x} ❖ 』━━⬣`)
    .replace(/^╰[━─]+⬣$/gm, '┗━━━━━━━━━━━━━━━━⬣')
    .replace(/^│ ➤ /gm, '┃ ❯ ')
    .replace(/^│ /gm, '┃ ')
    .replace(/^│$/gm, '┃');
}

// Marco para respuestas de texto simple. Si el texto ya esta decorado o es muy largo, no se toca.
function frame(t) {
  if (typeof t !== 'string' || !t || /^[╭┏╔]/.test(t.trimStart()) || t.length > 3000) return t;
  const body = t.split('\n').map((l) => (l ? `┃ ${l}` : '┃')).join('\n');
  return `┏━━『 ❖ *${config.botName}* ❖ 』━━⬣\n${body}\n┗━━━ ⌬ _${config.developer}_ ⬣`;
}

// Aplica skin a un contenido de mensaje (texto o pie de foto)
function skinContent(c) {
  if (!c || typeof c !== 'object') return c;
  const out = { ...c };
  if (typeof out.text === 'string') out.text = skin(out.text);
  if (typeof out.caption === 'string') out.caption = skin(out.caption);
  return out;
}

module.exports = { S, fancy, box, skin, frame, skinContent };
