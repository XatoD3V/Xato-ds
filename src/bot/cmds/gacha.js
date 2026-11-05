// Gacha de personajes (adaptado del HuTao). Las imagenes se obtienen de AniList (contenido apto para todo publico).
const characters = require('../../data/characters.json');
const { takeCooldown, getTargets, num, norm, fmtTime, pick } = require('../util');

const CAT = 'Gacha';
const byName = new Map(characters.map((c) => [c.name, c]));
const lastRoll = new Map(); // chat -> { char, exp }
const imgCache = new Map();
const fmt = (n) => Number(n).toLocaleString('es-PE');
const sellPrice = (c) => Math.max(20, Math.floor(c.value / 400));

async function charImage(name) {
  if (imgCache.has(name)) return imgCache.get(name);
  let url = null;
  try {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query($s:String){Character(search:$s){image{large}}}', variables: { s: name } }),
      signal: AbortSignal.timeout(12000),
    });
    const j = await r.json();
    url = j && j.data && j.data.Character && j.data.Character.image && j.data.Character.image.large;
  } catch { /* sin imagen */ }
  imgCache.set(name, url || null);
  return url || null;
}

function findChar(q, pool = characters) {
  const n = norm(q);
  if (!n) return null;
  return pool.find((c) => norm(c.name) === n) || pool.find((c) => norm(c.name).includes(n)) || null;
}

const ownerOf = (store, c) => store.owners()[c.name] || null;
function card(c, store) {
  const owner = ownerOf(store, c);
  const ow = owner && store.user(owner);
  return (
    `╭━━〔 🎴 *PERSONAJE* 〕━━⬣\n┃ ✨ *${c.name}*\n┃ ⚧️ *Genero:* ${c.gender}\n┃ 📺 *Serie:* ${c.source}\n` +
    `┃ 💎 *Valor:* ${fmt(c.value)}\n┃ 📌 *Estado:* ${owner ? `🔴 de ${ow ? ow.name : 'alguien'}` : '🟢 libre'}\n╰━━━━━━━━━━━━━━⬣`
  );
}

async function sendCard(sock, jid, m, c, store, extra = '') {
  const text = card(c, store) + extra;
  const img = await charImage(c.name);
  if (img) return sock.sendMessage(jid, { image: { url: img }, caption: text }, { quoted: m }).catch(() => sock.sendMessage(jid, { text }, { quoted: m }));
  return sock.sendMessage(jid, { text }, { quoted: m });
}

module.exports = [
  {
    name: 'rw', aliases: ['roll', 'rollwaifu', 'gacha'], cat: CAT, desc: 'Invoca un personaje al azar (3 min)',
    async run({ sock, m, jid, user, store, prefix }) {
      const left = takeCooldown(user, 'rw', 3 * 60000);
      if (left) return sock.sendMessage(jid, { text: `⏳ Espera *${fmtTime(left)}* para invocar otro personaje.` }, { quoted: m });
      const c = pick(characters);
      lastRoll.set(jid, { char: c, exp: Date.now() + 90000 });
      store.save();
      await sendCard(sock, jid, m, c, store, ownerOf(store, c) ? '' : `\n\n_Usa *${prefix}claim* en 90 segundos para quedartelo._`);
    },
  },
  {
    name: 'claim', aliases: ['c', 'reclamar'], cat: CAT, desc: 'Reclama el ultimo personaje invocado (10 min)',
    async run({ jid, user, store, reply }) {
      const r = lastRoll.get(jid);
      if (!r || r.exp < Date.now()) return reply('❌ No hay un personaje para reclamar. Invoca uno con *!rw*.');
      if (ownerOf(store, r.char)) return reply('🔴 Ese personaje ya tiene dueño.');
      const left = takeCooldown(user, 'claim', 10 * 60000);
      if (left) return reply(`⏳ Podras reclamar de nuevo en *${fmtTime(left)}*.`);
      store.owners()[r.char.name] = user.id;
      user.chars.push(r.char.name);
      lastRoll.delete(jid);
      store.save();
      await reply(`🎉 *${user.name}* reclamo a *${r.char.name}* (${fmt(r.char.value)} 💎).`);
    },
  },
  {
    name: 'harem', aliases: ['personajes', 'misperso'], cat: CAT, desc: 'Tus personajes (!harem [@user] [pagina])',
    async run({ m, user, args, store, reply }) {
      const t = getTargets(m, args.filter((a) => !/^\d{1,3}$/.test(a)))[0];
      const u = t ? store.findByNum(num(t)) : user;
      if (!u) return reply('❌ Ese usuario no esta registrado.');
      const page = Math.max(1, parseInt(args.find((a) => /^\d{1,3}$/.test(a)), 10) || 1);
      const list = (u.chars || []).map((n) => byName.get(n)).filter(Boolean).sort((a, b) => b.value - a.value);
      if (!list.length) return reply(`🎴 *${u.name}* aun no tiene personajes.`);
      const per = 15, pages = Math.ceil(list.length / per);
      const rows = list.slice((page - 1) * per, page * per).map((c, i) => `*${(page - 1) * per + i + 1}.* ${c.name} · 💎 ${fmt(c.value)}`).join('\n');
      await reply(`🎴 *PERSONAJES DE ${u.name.toUpperCase()}*\n💎 Valor total: *${fmt(list.reduce((s, c) => s + c.value, 0))}* · Cantidad: *${list.length}*\n\n${rows}\n\n_Pagina ${page}/${pages}_`);
    },
  },
  {
    name: 'charinfo', aliases: ['winfo', 'infopersonaje'], cat: CAT, desc: 'Informacion de un personaje (!charinfo asuna)',
    async run({ sock, m, jid, args, store, reply, prefix }) {
      const c = findChar(args.join(' '));
      if (!c) return reply(`No encontre ese personaje. Uso: ${prefix}charinfo nombre`);
      await sendCard(sock, jid, m, c, store);
    },
  },
  {
    name: 'sell', aliases: ['vender'], cat: CAT, desc: 'Vende un personaje por monedas (!sell nombre)',
    async run({ user, args, store, reply, prefix }) {
      const c = findChar(args.join(' '), (user.chars || []).map((n) => byName.get(n)).filter(Boolean));
      if (!c) return reply(`No tienes ese personaje. Uso: ${prefix}sell nombre`);
      const price = sellPrice(c);
      user.chars = user.chars.filter((n) => n !== c.name);
      delete store.owners()[c.name];
      user.coins += price; store.save();
      await reply(`💰 Vendiste a *${c.name}* por *${fmt(price)}* monedas.\n🪙 Cartera: *${fmt(user.coins)}*`);
    },
  },
  {
    name: 'givechar', aliases: ['regalarpersonaje'], cat: CAT, desc: 'Regala un personaje (!givechar @user nombre)',
    async run({ m, user, args, store, sock, jid, reply, prefix }) {
      const t = getTargets(m, args)[0];
      const name = args.filter((a) => a.replace(/\D/g, '').length < 8 && !a.startsWith('@')).join(' ');
      const c = findChar(name, (user.chars || []).map((n) => byName.get(n)).filter(Boolean));
      if (!t || !c) return reply(`Uso: ${prefix}givechar @usuario nombre del personaje`);
      const dest = store.findByNum(num(t));
      if (!dest || dest.id === user.id) return reply('❌ Elige a otro usuario registrado.');
      user.chars = user.chars.filter((n) => n !== c.name);
      dest.chars.push(c.name);
      store.owners()[c.name] = dest.id; store.save();
      await sock.sendMessage(jid, { text: `🎁 Le diste a *${c.name}* a @${num(dest.id)}.`, mentions: [dest.id] }, { quoted: m });
    },
  },
  {
    name: 'waifutop', aliases: ['topchars', 'toppersonajes'], cat: CAT, desc: 'Ranking de coleccionistas',
    async run({ store, reply }) {
      const rows = store.users().map((u) => {
        const list = (u.chars || []).map((n) => byName.get(n)).filter(Boolean);
        return { name: u.name, n: list.length, v: list.reduce((s, c) => s + c.value, 0) };
      }).filter((r) => r.n).sort((a, b) => b.v - a.v).slice(0, 10);
      if (!rows.length) return reply('Aun nadie tiene personajes. Usa *!rw* y *!claim*.');
      const medals = ['🥇', '🥈', '🥉'];
      await reply(`🏆 *TOP COLECCIONISTAS*\n\n${rows.map((r, i) => `${medals[i] || `*${i + 1}.*`} ${r.name} · 🎴 ${r.n} · 💎 ${fmt(r.v)}`).join('\n')}`);
    },
  },
];
