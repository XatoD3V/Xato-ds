// Perfil, nivel y matrimonio (adaptado del HuTao).
const { levelFor, xpForLevel } = require('../db');
const { getTargets, num, norm } = require('../util');
const CAT = 'Perfil';
const pending = new Map(); // propuestas de matrimonio: numero destino -> { from, exp }

const fmt = (n) => Number(n).toLocaleString('es-PE');
const GENRES = { hombre: 'Hombre', masculino: 'Hombre', mujer: 'Mujer', femenino: 'Mujer', otro: 'Otro', otre: 'Otro' };

function ageFrom(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date(Date.now() - 5 * 3600000);
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age--;
  let next = Date.UTC(now.getUTCFullYear(), m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (next < today) next = Date.UTC(now.getUTCFullYear() + 1, m - 1, d);
  return { age, days: Math.round((next - today) / 86400000) };
}

const setter = (name, aliases, desc, field, parse, okMsg) => ({
  name, aliases, cat: CAT, desc,
  async run({ user, args, store, reply, prefix }) {
    const out = parse(args.join(' ').trim());
    if (out.error) return reply(`${out.error}\nUso: ${prefix}${name} ${out.usage || 'texto'}`);
    user[field] = out.value;
    store.save();
    await reply(`✅ ${okMsg} *${out.value}*`);
  },
});
const clearer = (name, aliases, desc, field, msg) => ({
  name, aliases, cat: CAT, desc,
  async run({ user, store, reply }) {
    if (!user[field]) return reply('No tienes nada guardado en ese campo.');
    delete user[field]; store.save();
    await reply(`🗑️ ${msg}`);
  },
});

module.exports = [
  {
    name: 'perfil', aliases: ['profile', 'yo'], cat: CAT, desc: 'Tu perfil (o el de otro: !perfil @user)',
    async run({ m, user: me, args, store, reply }) {
      const t = getTargets(m, args)[0];
      const u = t ? store.findByNum(num(t)) : me;
      if (!u) return reply('❌ Ese usuario no esta registrado.');
      const lvl = levelFor(u.xp);
      const partner = u.partner && store.user(u.partner);
      const birth = u.birth ? ageFrom(u.birth) : null;
      const charValues = (u.chars || []).length;
      await reply(
        `╭━━〔 🪪 *PERFIL* 〕━━⬣\n` +
        `┃ 📛 *Nombre:* ${u.name}\n┃ 🎂 *Edad:* ${birth ? `${birth.age} (cumple en ${birth.days} dias)` : u.age}\n` +
        `┃ ⚧️ *Genero:* ${u.genre || 'sin definir'}\n┃ 🎯 *Hobby:* ${u.hobby || 'sin definir'}\n` +
        `┃ 💍 *Pareja:* ${partner ? partner.name : 'soltero/a'}\n┃ 🆔 *ID:* ${u.serial}\n` +
        `┃ 🏅 *Nivel:* ${lvl} · ✨ ${fmt(u.xp)}/${fmt(xpForLevel(lvl + 1))} XP\n` +
        `┃ 🪙 *Cartera:* ${fmt(u.coins)} · 🏛️ *Banco:* ${fmt(u.bank || 0)}\n` +
        `┃ 🎴 *Personajes:* ${charValues}\n┃ 🎒 *Objetos:* ${Object.keys(u.items || {}).join(', ') || 'ninguno'}\n` +
        `╰━━━━━━━━━━━━━━⬣` + (u.desc ? `\n\n📝 _${u.desc}_` : '')
      );
    },
  },
  {
    name: 'level', aliases: ['nivel', 'lvl'], cat: CAT, desc: 'Tu nivel y progreso',
    async run({ user: u, reply }) {
      const lvl = levelFor(u.xp);
      const from = xpForLevel(lvl), to = xpForLevel(lvl + 1);
      const pct = Math.min(100, Math.round(((u.xp - from) / (to - from)) * 100));
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      await reply(`🏅 *Nivel ${lvl}*\n${bar} ${pct}%\n✨ ${fmt(u.xp)} / ${fmt(to)} XP\n_Escribe en el chat para ganar XP._`);
    },
  },
  setter('setbirth', ['cumple'], 'Tu cumpleaños (!setbirth 25/12/2000)', 'birth', (t) => {
    const x = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!x) return { error: '❌ Formato invalido.', usage: 'dia/mes/año  (ej: 25/12/2000)' };
    const [d, mo, y] = [Number(x[1]), Number(x[2]), Number(x[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1930 || y > new Date().getFullYear() - 8) return { error: '❌ Esa fecha no es valida.' };
    return { value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
  }, 'Cumpleaños guardado:'),
  clearer('delbirth', [], 'Borra tu cumpleaños', 'birth', 'Cumpleaños eliminado.'),
  setter('setdesc', ['descripcion'], 'Tu descripcion (!setdesc texto)', 'desc', (t) =>
    (!t ? { error: '❌ Escribe una descripcion.' } : t.length > 200 ? { error: '❌ Maximo 200 caracteres.' } : { value: t }), 'Descripcion guardada:'),
  clearer('deldesc', [], 'Borra tu descripcion', 'desc', 'Descripcion eliminada.'),
  setter('setgenre', ['setgenero'], 'Tu genero (!setgenre hombre|mujer|otro)', 'genre', (t) =>
    (GENRES[norm(t)] ? { value: GENRES[norm(t)] } : { error: '❌ Opcion invalida.', usage: 'hombre | mujer | otro' }), 'Genero guardado:'),
  clearer('delgenre', ['delgenero'], 'Borra tu genero', 'genre', 'Genero eliminado.'),
  setter('sethobby', ['sethobbie'], 'Tu hobby (!sethobby futbol)', 'hobby', (t) =>
    (!t ? { error: '❌ Escribe tu hobby.' } : t.length > 40 ? { error: '❌ Maximo 40 caracteres.' } : { value: t }), 'Hobby guardado:'),
  clearer('delhobby', ['removehobby'], 'Borra tu hobby', 'hobby', 'Hobby eliminado.'),

  /* ---------------- matrimonio ---------------- */
  {
    name: 'marry', aliases: ['casarse', 'boda'], cat: CAT, desc: 'Propone matrimonio (!marry @user)',
    async run({ m, user, args, store, sock, jid, reply, prefix }) {
      const t = getTargets(m, args)[0];
      if (!t) return reply(`Uso: ${prefix}marry @usuario`);
      const other = store.findByNum(num(t));
      if (!other) return reply('❌ Ese usuario no esta registrado.');
      if (other.id === user.id) return reply('😅 No puedes casarte contigo mismo.');
      if (user.partner) return reply('💍 Ya estas casado/a. Usa *!divorce* primero.');
      if (other.partner) return reply('💍 Esa persona ya esta casada.');
      pending.set(num(other.id), { from: user.id, exp: Date.now() + 120000 });
      await sock.sendMessage(jid, {
        text: `💍 *PROPUESTA*\n@${num(user.id)} le propone matrimonio a @${num(other.id)}.\n\n@${num(other.id)}, responde con *${prefix}aceptar* o *${prefix}rechazar* (2 minutos).`,
        mentions: [user.id, other.id],
      }, { quoted: m });
    },
  },
  {
    name: 'aceptar', aliases: ['accept'], cat: CAT, desc: 'Acepta una propuesta de matrimonio',
    async run({ user, store, sock, jid, m, reply }) {
      const p = pending.get(num(user.id));
      if (!p || p.exp < Date.now()) return reply('No tienes ninguna propuesta pendiente.');
      const from = store.user(p.from);
      pending.delete(num(user.id));
      if (!from || from.partner || user.partner) return reply('Esa propuesta ya no es valida.');
      from.partner = user.id; user.partner = from.id; store.save();
      await sock.sendMessage(jid, { text: `🎉💒 ¡@${num(from.id)} y @${num(user.id)} ahora estan casados!`, mentions: [from.id, user.id] }, { quoted: m });
    },
  },
  {
    name: 'rechazar', aliases: ['decline'], cat: CAT, desc: 'Rechaza una propuesta de matrimonio',
    async run({ user, reply }) {
      const p = pending.get(num(user.id));
      if (!p || p.exp < Date.now()) return reply('No tienes ninguna propuesta pendiente.');
      pending.delete(num(user.id));
      await reply('💔 Rechazaste la propuesta.');
    },
  },
  {
    name: 'divorce', aliases: ['divorcio'], cat: CAT, desc: 'Termina tu matrimonio',
    async run({ user, store, reply }) {
      if (!user.partner) return reply('No estas casado/a.');
      const ex = store.user(user.partner);
      if (ex) delete ex.partner;
      delete user.partner; store.save();
      await reply('💔 Te divorciaste.');
    },
  },
];
