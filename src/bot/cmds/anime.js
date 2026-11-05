// Interacciones anime (GIFs de nekos.best, contenido apto para todo publico).
const { getJson, getTargets, num, gifToMp4 } = require('../util');
const CAT = 'Anime';

// [comando, alias, endpoint, texto hacia otro, texto sobre si mismo]
const LIST = [
  ['abrazar', ['hug'], 'hug', 'le dio un abrazo a', 'se abrazo a si mismo/a'],
  ['acariciar', ['pat'], 'pat', 'acaricio la cabeza de', 'se acaricio la cabeza'],
  ['besar', ['kiss'], 'kiss', 'le dio un beso a', 'se mando un beso'],
  ['acurrucar', ['cuddle'], 'cuddle', 'se acurruco con', 'se acurruco solo/a'],
  ['bofetada', ['slap'], 'slap', 'le dio una bofetada a', 'se dio una bofetada'],
  ['morder', ['bite'], 'bite', 'mordio a', 'se mordio'],
  ['picar', ['poke'], 'poke', 'pico a', 'se pico'],
  ['saludar', ['wave'], 'wave', 'saludo a', 'se saludo en el espejo'],
  ['bailar', ['dance'], 'dance', 'bailo con', 'esta bailando'],
  ['llorar', ['cry'], 'cry', 'lloro por', 'esta llorando'],
  ['reir', ['laugh'], 'laugh', 'se rio de', 'se esta riendo'],
  ['sonreir', ['smile'], 'smile', 'le sonrio a', 'esta sonriendo'],
  ['guinar', ['wink'], 'wink', 'le guiño un ojo a', 'se guiño en el espejo'],
  ['cosquillas', ['tickle'], 'tickle', 'le hizo cosquillas a', 'se hizo cosquillas'],
  ['golpear', ['punch'], 'punch', 'golpeo a', 'se golpeo'],
  ['chocar5', ['highfive'], 'highfive', 'choco los cinco con', 'choco los cinco con el aire'],
  ['manos', ['handhold'], 'handhold', 'le tomo la mano a', 'se tomo la mano'],
  ['puchero', ['pout'], 'pout', 'hizo pucheros a', 'esta haciendo pucheros'],
  ['sonrojar', ['blush'], 'blush', 'se sonrojo por', 'se sonrojo'],
  ['mirar', ['stare'], 'stare', 'miro fijamente a', 'esta mirando al vacio'],
  ['dormir', ['sleep'], 'sleep', 'se durmio junto a', 'se durmio'],
  ['pensar', ['think'], 'think', 'esta pensando en', 'esta pensando'],
  ['alimentar', ['feed'], 'feed', 'le dio de comer a', 'se alimento'],
];

module.exports = LIST.map(([name, aliases, endpoint, other, self]) => ({
  name, aliases, cat: CAT, desc: `Interaccion: ${name} (!${name} @user)`,
  async run({ sock, m, jid, args, sender, reply }) {
    const t = getTargets(m, args)[0];
    const a = `@${num(sender)}`;
    const text = t && num(t) !== num(sender) ? `${a} ${other} @${num(t)}` : `${a} ${self}`;
    const mentions = [sender, t].filter(Boolean);
    try {
      const j = await getJson(`https://nekos.best/api/v2/${endpoint}`, { timeout: 15000 });
      const url = j.results && j.results[0] && j.results[0].url;
      if (!url) throw new Error('sin gif');
      let mp4 = null;
      try { mp4 = await gifToMp4(url); } catch { /* sin ffmpeg */ }
      if (mp4) await sock.sendMessage(jid, { video: mp4, gifPlayback: true, caption: text, mentions }, { quoted: m });
      else await sock.sendMessage(jid, { image: { url }, caption: text, mentions }, { quoted: m });
    } catch {
      await sock.sendMessage(jid, { text, mentions }, { quoted: m });
    }
  },
}));
