// Recuerda que a una persona se le mostro el menu, para aceptar solo "5" como respuesta (sin botones).
const { num } = require('./util');
const TTL = 3 * 60 * 1000;
const state = new Map();
const key = (jid, sender) => `${jid}|${num(sender)}`;

module.exports = {
  set(jid, sender) { state.set(key(jid, sender), Date.now() + TTL); },
  has(jid, sender) {
    const k = key(jid, sender);
    const t = state.get(k);
    if (!t || t < Date.now()) { state.delete(k); return false; }
    return true;
  },
};
