// Herramientas locales (no usan internet): tipografias, simbolos, color, fechas, hash, codigos y dados.
const crypto = require('crypto');
const { rand, norm, fmtNum } = require('../util');
const { fancy } = require('../deco');

const CAT = 'Herramientas';

/* ---------- tipografias Unicode ---------- */
const shift = (up, low, dig) => (t) => String(t).replace(/[A-Za-z0-9]/g, (c) => {
  const k = c.charCodeAt(0);
  if (k >= 65 && k <= 90) return up == null ? c : String.fromCodePoint(up + k - 65);
  if (k >= 97 && k <= 122) return low == null ? c : String.fromCodePoint(low + k - 97);
  return dig == null ? c : String.fromCodePoint(dig + k - 48);
});
const SMALLCAPS = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
const STYLES = [
  ['Negrita', fancy],
  ['Cursiva', shift(0x1D608, 0x1D622, null)],
  ['Negrita cursiva', shift(0x1D63C, 0x1D656, null)],
  ['Maquina de escribir', shift(0x1D670, 0x1D68A, 0x1D7F6)],
  ['Gotica negrita', shift(0x1D56C, 0x1D586, null)],
  ['Caligrafia', shift(0x1D4D0, 0x1D4EA, null)],
  ['Burbuja', (t) => String(t).replace(/[A-Za-z0-9]/g, (c) => { const k = c.charCodeAt(0); if (k >= 65 && k <= 90) return String.fromCodePoint(0x24B6 + k - 65); if (k >= 97 && k <= 122) return String.fromCodePoint(0x24D0 + k - 97); return k === 48 ? '⓪' : String.fromCodePoint(0x2460 + k - 49); })],
  ['Ancho completo', (t) => String(t).replace(/[!-~]/g, (c) => String.fromCodePoint(c.charCodeAt(0) + 0xFEE0))],
  ['Versalitas', (t) => String(t).replace(/[a-z]/gi, (c) => SMALLCAPS[c.toLowerCase()] || c)],
];

const PALETTES = [
  ['Flechas', '➜ ➤ ➔ ➠ ➳ ⇒ ⟹ ❯ ❱ » › ↠ ⇨ ➥ ↪'],
  ['Estrellas', '★ ☆ ✦ ✧ ✪ ✯ ✰ ✶ ✷ ✹ ✺ ⭑ ✴ ❂'],
  ['Adornos', '❖ ◈ ⌬ ❂ ✿ ❀ ✾ ❁ ⚘ ꕤ ✤ ❃ ❋ ✽'],
  ['Marcos', '┏ ┓ ┗ ┛ ┃ ━ ┣ ┫ ╭ ╮ ╰ ╯ │ ─ ╔ ╗ ╚ ╝ ║ ═'],
  ['Corazones', '❤ ♡ ❥ ❣ ♥ ❦ ❧ ☙'],
  ['Musica', '♪ ♫ ♬ ♩ ♭ ♯'],
  ['Marcas', '✔ ✘ ✓ ✗ ☑ ☒ ✅ ❌ ⚠'],
  ['Matematicas', '∞ √ ∑ π ≈ ≠ ± × ÷ ∆ ∫ ≤ ≥'],
  ['Varios', '☯ ☮ ♛ ♚ ⚔ ⚡ ☄ ☀ ☾ ♻ ⚙ ✂ ✉ ☎'],
];

/* ---------- morse ---------- */
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

/* ---------- zodiaco ---------- */
const SIGNS = [['♑ Capricornio', 'Tierra', 12, 22], ['♒ Acuario', 'Aire', 1, 20], ['♓ Piscis', 'Agua', 2, 19], ['♈ Aries', 'Fuego', 3, 21], ['♉ Tauro', 'Tierra', 4, 20], ['♊ Geminis', 'Aire', 5, 21], ['♋ Cancer', 'Agua', 6, 21], ['♌ Leo', 'Fuego', 7, 23], ['♍ Virgo', 'Tierra', 8, 23], ['♎ Libra', 'Aire', 9, 23], ['♏ Escorpio', 'Agua', 10, 23], ['♐ Sagitario', 'Fuego', 11, 22]];
function zodiac(d, m) {
  let i = 0;
  for (let k = 0; k < SIGNS.length; k++) { const [, , sm, sd] = SIGNS[k]; if (m > sm || (m === sm && d >= sd)) i = k; }
  if (m === 12 && d >= 22) i = 0; else if (m === 1 && d < 20) i = 0;
  return SIGNS[i];
}
function parseDate(t) {
  const x = String(t || '').match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?$/);
  if (!x) return null;
  const d = Number(x[1]), mo = Number(x[2]), y = x[3] ? Number(x[3]) : null;
  const dt = new Date(Date.UTC(y || 2000, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? { d, mo, y } : null;
}
const limaToday = () => { const n = new Date(Date.now() - 5 * 3600000); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };

module.exports = [
  {
    name: 'fuente', aliases: ['letras', 'font'], cat: CAT, desc: 'Texto con letras especiales (!fuente hola)',
    async run({ args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t) return reply(`Uso: ${prefix}fuente Xato Ds`);
      if (t.length > 60) return reply('Maximo 60 caracteres.');
      await reply(`🔠 *LETRAS ESPECIALES*\n\n${STYLES.map(([n, f]) => `❖ _${n}_\n${f(t)}`).join('\n\n')}`, { raw: true });
    },
  },
  {
    name: 'simbolos', aliases: ['caracteres', 'tabla'], cat: CAT, desc: 'Tabla de simbolos para decorar',
    async run({ reply }) {
      await reply(`✦ *TABLA DE SIMBOLOS* ✦\n_Copia y pega los que quieras_\n\n${PALETTES.map(([n, s]) => `❖ *${n}*\n${s}`).join('\n\n')}`, { raw: true });
    },
  },
  {
    name: 'color', aliases: ['hex'], cat: CAT, desc: 'Muestra un color (!color #ff5733)',
    async run({ sock, m, jid, args, reply, prefix }) {
      let h = (args[0] || '').replace('#', '').toLowerCase();
      if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
      if (!/^[0-9a-f]{6}$/.test(h)) return reply(`Uso: ${prefix}color #ff5733`);
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2;
      const dlt = mx - mn;
      const s = dlt === 0 ? 0 : dlt / (1 - Math.abs(2 * l - 1));
      let hue = 0;
      if (dlt) { if (mx === r / 255) hue = ((g - b) / 255 / dlt) % 6; else if (mx === g / 255) hue = (b - r) / 255 / dlt + 2; else hue = (r - g) / 255 / dlt + 4; hue = Math.round(hue * 60); if (hue < 0) hue += 360; }
      const text = `🎨 *Color #${h.toUpperCase()}*\n❖ RGB ➜ ${r}, ${g}, ${b}\n❖ HSL ➜ ${hue}°, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
      try {
        const png = await require('sharp')({ create: { width: 400, height: 400, channels: 3, background: { r, g, b } } }).png().toBuffer();
        await sock.sendMessage(jid, { image: png, caption: text }, { quoted: m });
      } catch { await reply(text); }
    },
  },
  {
    name: 'edad', cat: CAT, desc: 'Tu edad exacta (!edad 25/12/2000)',
    async run({ args, user, reply, prefix }) {
      const d = parseDate(args[0]) || (user.birth && parseDate(user.birth.split('-').reverse().join('/')));
      if (!d || !d.y) return reply(`Uso: ${prefix}edad 25/12/2000`);
      const born = Date.UTC(d.y, d.mo - 1, d.d), today = limaToday();
      if (born > today) return reply('Esa fecha esta en el futuro.');
      const t = new Date(today), b = new Date(born);
      let years = t.getUTCFullYear() - b.getUTCFullYear(), months = t.getUTCMonth() - b.getUTCMonth(), days = t.getUTCDate() - b.getUTCDate();
      if (days < 0) { months--; days += new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)).getUTCDate(); }
      if (months < 0) { years--; months += 12; }
      let next = Date.UTC(t.getUTCFullYear(), d.mo - 1, d.d); if (next < today) next = Date.UTC(t.getUTCFullYear() + 1, d.mo - 1, d.d);
      await reply(`🎂 *EDAD*\n❖ ${years} años, ${months} meses y ${days} dias\n❖ Dias vividos ➜ ${fmtNum(Math.round((today - born) / 86400000))}\n❖ Proximo cumpleaños en ➜ ${Math.round((next - today) / 86400000)} dias\n❖ Signo ➜ ${zodiac(d.d, d.mo)[0]}`);
    },
  },
  {
    name: 'zodiaco', aliases: ['signo'], cat: CAT, desc: 'Tu signo zodiacal (!zodiaco 25/12)',
    async run({ args, user, reply, prefix }) {
      const d = parseDate(args[0]) || (user.birth && parseDate(user.birth.split('-').reverse().join('/')));
      if (!d) return reply(`Uso: ${prefix}zodiaco 25/12`);
      const [name, el] = zodiac(d.d, d.mo);
      await reply(`🔮 *SIGNO ZODIACAL*\n❖ ${name}\n❖ Elemento ➜ ${el}`);
    },
  },
  {
    name: 'dias', aliases: ['cuentaatras'], cat: CAT, desc: 'Dias que faltan o pasaron (!dias 25/12/2026)',
    async run({ args, reply, prefix }) {
      const d = parseDate(args[0]);
      if (!d) return reply(`Uso: ${prefix}dias 25/12/2026  (sin año usa el proximo)`);
      const today = limaToday();
      let target = Date.UTC(d.y || new Date(today).getUTCFullYear(), d.mo - 1, d.d);
      if (!d.y && target < today) target = Date.UTC(new Date(today).getUTCFullYear() + 1, d.mo - 1, d.d);
      const n = Math.round((target - today) / 86400000);
      await reply(n === 0 ? '📅 ¡Es hoy!' : n > 0 ? `📅 Faltan *${fmtNum(n)}* dias (${Math.floor(n / 7)} semanas)` : `📅 Pasaron *${fmtNum(-n)}* dias`);
    },
  },
  {
    name: 'hash', cat: CAT, desc: 'Calcula un hash (!hash sha256 texto)',
    async run({ args, reply, prefix }) {
      const algo = ['md5', 'sha1', 'sha256', 'sha512'].includes((args[0] || '').toLowerCase()) ? args.shift().toLowerCase() : 'sha256';
      const t = args.join(' ');
      if (!t) return reply(`Uso: ${prefix}hash sha256 texto  (md5, sha1, sha256, sha512)`);
      await reply(`🔐 *${algo.toUpperCase()}*\n${crypto.createHash(algo).update(t).digest('hex')}`, { raw: true });
    },
  },
  {
    name: 'b64', aliases: ['base64'], cat: CAT, desc: 'Base64 (!b64 codificar|decodificar texto)',
    async run({ args, reply, prefix }) {
      const mode = (args.shift() || '').toLowerCase();
      const t = args.join(' ');
      if (!t || !/^(cod|enc|dec)/.test(mode)) return reply(`Uso: ${prefix}b64 codificar hola\n${prefix}b64 decodificar aG9sYQ==`);
      try { await reply(`🔤 ${/^dec/.test(mode) ? Buffer.from(t, 'base64').toString('utf8') : Buffer.from(t, 'utf8').toString('base64')}`, { raw: true }); } catch { await reply('❌ Texto invalido.'); }
    },
  },
  {
    name: 'morse', cat: CAT, desc: 'Texto a morse y viceversa (!morse sos)',
    async run({ args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t) return reply(`Uso: ${prefix}morse hola mundo  |  ${prefix}morse .... --- .-.. .-`);
      if (/^[.\-\s/]+$/.test(t)) return reply(`📡 ${t.split(/\s*\/\s*|\s{3,}/).map((w) => w.trim().split(/\s+/).map((c) => UNMORSE[c] || '?').join('')).join(' ')}`, { raw: true });
      await reply(`📡 ${norm(t).split(/\s+/).map((w) => [...w].map((c) => MORSE[c] || '').filter(Boolean).join(' ')).join('  /  ')}`, { raw: true });
    },
  },
  {
    name: 'binario', aliases: ['binary'], cat: CAT, desc: 'Texto a binario y viceversa (!binario hola)',
    async run({ args, reply, prefix }) {
      const t = args.join(' ').trim();
      if (!t) return reply(`Uso: ${prefix}binario hola`);
      if (/^[01\s]+$/.test(t) && t.replace(/\s/g, '').length % 8 === 0) {
        const bytes = t.replace(/\s/g, '').match(/.{8}/g).map((b) => parseInt(b, 2));
        return reply(`💻 ${Buffer.from(bytes).toString('utf8')}`, { raw: true });
      }
      await reply(`💻 ${[...Buffer.from(t, 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' ')}`, { raw: true });
    },
  },
  {
    name: 'reverso', aliases: ['alreves'], cat: CAT, desc: 'Escribe al reves (!reverso hola)',
    async run({ args, reply, prefix }) {
      const t = args.join(' ');
      if (!t) return reply(`Uso: ${prefix}reverso hola mundo`);
      await reply([...t].reverse().join(''), { raw: true });
    },
  },
  {
    name: 'contar', aliases: ['count'], cat: CAT, desc: 'Cuenta letras y palabras (!contar texto)',
    async run({ args, reply, prefix }) {
      const t = args.join(' ');
      if (!t) return reply(`Uso: ${prefix}contar texto a contar`);
      await reply(`🔢 *CONTADOR*\n❖ Caracteres ➜ ${[...t].length}\n❖ Sin espacios ➜ ${t.replace(/\s/g, '').length}\n❖ Palabras ➜ ${t.trim().split(/\s+/).length}`);
    },
  },
  {
    name: 'uuid', cat: CAT, desc: 'Genera un identificador UUID',
    async run({ reply }) { await reply(`🆔 ${crypto.randomUUID()}`, { raw: true }); },
  },
  {
    name: 'tirar', aliases: ['dados', 'rolldice'], cat: 'Diversion', desc: 'Dados con notacion (!tirar 2d6+3)',
    async run({ args, reply, prefix }) {
      const x = (args[0] || '').toLowerCase().match(/^(\d{1,2})d(\d{1,4})([+-]\d{1,4})?$/);
      if (!x) return reply(`Uso: ${prefix}tirar 2d6   |   ${prefix}tirar 1d20+5`);
      const n = Number(x[1]), f = Number(x[2]), k = Number(x[3] || 0);
      if (n < 1 || n > 20 || f < 2) return reply('Maximo 20 dados y minimo 2 caras.');
      const rolls = Array.from({ length: n }, () => rand(1, f));
      await reply(`🎲 *${n}d${f}${k ? (k > 0 ? `+${k}` : k) : ''}*\n❖ Tiradas ➜ ${rolls.join(', ')}\n❖ Total ➜ *${rolls.reduce((a, b) => a + b, 0) + k}*`);
    },
  },
  {
    name: 'random', aliases: ['azar', 'numero'], cat: 'Diversion', desc: 'Numero al azar (!random 1 100)',
    async run({ args, reply }) {
      let a = parseInt(args[0], 10), b = parseInt(args[1], 10);
      if (!Number.isFinite(a)) { a = 1; b = 100; } else if (!Number.isFinite(b)) { b = a; a = 1; }
      if (a > b) [a, b] = [b, a];
      await reply(`🎯 Numero entre ${a} y ${b}: *${rand(a, b)}*`);
    },
  },
];
