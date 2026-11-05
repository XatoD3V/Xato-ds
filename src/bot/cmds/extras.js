// Comandos gratuitos con APIs publicas SIN clave: mascotas, chistes, pokemon, NASA, recetas, libros, diccionario y mas.
const { getJson, getText, getBuffer, pick, norm } = require('../util');

const fmt = (n) => Number(n).toLocaleString('es-PE');
const fail = (reply) => reply('❌ No pude obtener eso ahora. Intenta mas tarde.');
const bar = (v, max = 180) => '█'.repeat(Math.max(1, Math.round((v / max) * 10))) + '░'.repeat(10 - Math.max(1, Math.round((v / max) * 10)));
const short = (t, n) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));

// Traduce al español con MyMemory (si falla, devuelve el texto original)
async function toEs(text) {
  try {
    const j = await getJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(short(text, 450))}&langpair=en|es`, { timeout: 12000 });
    return (j.responseData && j.responseData.translatedText) || text;
  } catch { return text; }
}

// Foto + ficha; si la imagen falla se envia solo la ficha
async function sendCard(ctx, imageUrl, caption) {
  const { sock, jid, m, reply } = ctx;
  if (imageUrl) {
    try { return await sock.sendMessage(jid, { image: { url: imageUrl }, caption }, { quoted: m }); } catch { /* texto */ }
  }
  return reply(caption);
}

const JOKES = [
  '¿Por que los pajaros vuelan al sur? Porque caminando tardarian mucho.',
  '¿Que le dice un 0 a un 8? Bonito cinturon.',
  '¿Cual es el colmo de un electricista? Que su esposa se llame Luz y sus hijos le sigan la corriente.',
  '¿Que hace una abeja en el gimnasio? ¡Zumba!',
  '¿Como se despiden los quimicos? Acido un placer.',
  '¿Por que el libro de matematicas esta triste? Porque tiene muchos problemas.',
  '¿Que le dijo un semaforo a otro? No me mires, me estoy cambiando.',
  '¿Que es un pez en un casino? Un pez-carta... digo, un pez-ca-dor de suerte.',
];

module.exports = [
  /* ---------------- mascotas y diversion ---------------- */
  {
    name: 'chiste', aliases: ['joke'], cat: 'Diversion', desc: 'Un chiste al azar',
    async run({ reply }) {
      try {
        const j = await getJson('https://v2.jokeapi.dev/joke/Any?lang=es&safe-mode&blacklistFlags=nsfw,religious,political,racist,sexist,explicit', { timeout: 10000 });
        if (j.error) throw new Error('sin chistes');
        return reply(`😂 ${j.type === 'twopart' ? `${j.setup}\n\n👉 ${j.delivery}` : j.joke}`);
      } catch { return reply(`😂 ${pick(JOKES)}`); }
    },
  },
  {
    name: 'perro', aliases: ['dog'], cat: 'Diversion', desc: 'Foto de un perro al azar',
    async run(ctx) {
      try { const j = await getJson('https://dog.ceo/api/breeds/image/random'); await sendCard(ctx, j.message, '🐶 *Guau!*'); } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'gato', aliases: ['cat'], cat: 'Diversion', desc: 'Foto de un gato al azar',
    async run(ctx) {
      try { await ctx.sock.sendMessage(ctx.jid, { image: { url: `https://cataas.com/cat?t=${Date.now()}` }, caption: '🐱 *Miau!*' }, { quoted: ctx.m }); } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'zorro', aliases: ['fox'], cat: 'Diversion', desc: 'Foto de un zorro al azar',
    async run(ctx) {
      try { const j = await getJson('https://randomfox.ca/floof/'); await sendCard(ctx, j.image, '🦊 *Zorro*'); } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'pato', aliases: ['duck'], cat: 'Diversion', desc: 'Foto de un pato al azar',
    async run(ctx) {
      try { const j = await getJson('https://random-d.uk/api/v2/random'); await sendCard(ctx, j.url, '🦆 *Cuac!*'); } catch { await fail(ctx.reply); }
    },
  },

  /* ---------------- informacion y curiosidades ---------------- */
  {
    name: 'pokemon', aliases: ['pokedex'], cat: 'Informacion', desc: 'Datos de un Pokemon (!pokemon pikachu)',
    async run(ctx) {
      const { args, reply, prefix } = ctx;
      const q = norm(args.join('-'));
      if (!q) return reply(`Uso: ${prefix}pokemon pikachu  (o su numero: ${prefix}pokemon 25)`);
      try {
        const p = await getJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(q)}`);
        const st = Object.fromEntries(p.stats.map((s) => [s.stat.name, s.base_stat]));
        const cap =
          `┏━━『 ✦ POKEDEX ✦ 』━━⬣\n┃ ❖ *${p.name.toUpperCase()}* #${p.id}\n┃ ❖ Tipo ➜ ${p.types.map((t) => t.type.name).join(', ')}\n` +
          `┃ ❖ Altura ➜ ${p.height / 10} m  ✦  Peso ➜ ${p.weight / 10} kg\n┃ ❖ Habilidades ➜ ${p.abilities.map((a) => a.ability.name).join(', ')}\n┃\n` +
          `┃ ❤️ PS     ${bar(st.hp)} ${st.hp}\n┃ ⚔️ Atq    ${bar(st.attack)} ${st.attack}\n┃ 🛡️ Def    ${bar(st.defense)} ${st.defense}\n` +
          `┃ ✨ Atq.E  ${bar(st['special-attack'])} ${st['special-attack']}\n┃ 🔰 Def.E  ${bar(st['special-defense'])} ${st['special-defense']}\n┃ 💨 Vel    ${bar(st.speed)} ${st.speed}\n┗━━━━━━━━━━━━━━━━⬣`;
        await sendCard(ctx, p.sprites.other && p.sprites.other['official-artwork'] ? p.sprites.other['official-artwork'].front_default : p.sprites.front_default, cap);
      } catch { await reply('❌ No encontre ese Pokemon. Usa su nombre en ingles o su numero.'); }
    },
  },
  {
    name: 'apod', aliases: ['nasa', 'espacio'], cat: 'Informacion', desc: 'Imagen astronomica del dia (NASA)',
    async run(ctx) {
      try {
        const j = await getJson('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', { timeout: 20000 });
        const es = await toEs(j.explanation || '');
        const cap = `┏━━『 ✦ NASA · ASTRONOMIA DEL DIA ✦ 』━━⬣\n┃ ❖ *${j.title}*\n┃ ❖ Fecha ➜ ${j.date}\n┗━━━━━━━━━━━━━━━━⬣\n\n${short(es, 600)}${j.media_type === 'video' ? `\n\n🎬 ${j.url}` : ''}`;
        await sendCard(ctx, j.media_type === 'image' ? (j.hdurl || j.url) : null, cap);
      } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'receta', aliases: ['comida', 'meal'], cat: 'Informacion', desc: 'Receta al azar o por nombre (!receta chicken)',
    async run(ctx) {
      const q = ctx.args.join(' ').trim();
      try {
        const j = await getJson(q ? `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}` : 'https://www.themealdb.com/api/json/v1/1/random.php');
        const d = j.meals && j.meals[0];
        if (!d) return ctx.reply('❌ No encontre esa receta. Prueba con el nombre en ingles (chicken, pasta, beef...).');
        const ing = [];
        for (let i = 1; i <= 20; i++) if (d[`strIngredient${i}`] && d[`strIngredient${i}`].trim()) ing.push(`${d[`strMeasure${i}`] || ''} ${d[`strIngredient${i}`]}`.trim());
        const steps = await toEs(short(d.strInstructions.replace(/\r?\n+/g, ' '), 420));
        const cap = `┏━━『 ✦ RECETA ✦ 』━━⬣\n┃ ❖ *${d.strMeal}*\n┃ ❖ Categoria ➜ ${d.strCategory}  ✦  Origen ➜ ${d.strArea}\n┗━━━━━━━━━━━━━━━━⬣\n\n🧂 *Ingredientes*\n${ing.map((x) => `❯ ${x}`).join('\n')}\n\n👨‍🍳 *Preparacion*\n${steps}${d.strYoutube ? `\n\n🎬 ${d.strYoutube}` : ''}`;
        await sendCard(ctx, d.strMealThumb, cap);
      } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'coctel', aliases: ['cocktail', 'trago'], cat: 'Informacion', desc: 'Receta de coctel (!coctel margarita)',
    async run(ctx) {
      const q = ctx.args.join(' ').trim();
      try {
        const j = await getJson(q ? `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}` : 'https://www.thecocktaildb.com/api/json/v1/1/random.php');
        const d = j.drinks && j.drinks[0];
        if (!d) return ctx.reply('❌ No encontre ese coctel. Prueba: margarita, mojito, daiquiri...');
        const ing = [];
        for (let i = 1; i <= 15; i++) if (d[`strIngredient${i}`]) ing.push(`${d[`strMeasure${i}`] || ''} ${d[`strIngredient${i}`]}`.trim());
        const cap = `┏━━『 ✦ COCTEL ✦ 』━━⬣\n┃ ❖ *${d.strDrink}*\n┃ ❖ ${d.strCategory} ✦ ${d.strAlcoholic}\n┃ ❖ Vaso ➜ ${d.strGlass}\n┗━━━━━━━━━━━━━━━━⬣\n\n🧊 *Ingredientes*\n${ing.map((x) => `❯ ${x}`).join('\n')}\n\n🍸 *Preparacion*\n${d.strInstructionsES || d.strInstructions}`;
        await sendCard(ctx, d.strDrinkThumb, cap);
      } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'libro', aliases: ['book'], cat: 'Informacion', desc: 'Busca un libro (!libro cien años de soledad)',
    async run(ctx) {
      const q = ctx.args.join(' ').trim();
      if (!q) return ctx.reply(`Uso: ${ctx.prefix}libro nombre del libro`);
      try {
        const j = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=1`);
        const d = j.docs && j.docs[0];
        if (!d) return ctx.reply('❌ No encontre ese libro.');
        const cap = `┏━━『 ✦ LIBRO ✦ 』━━⬣\n┃ ❖ *${d.title}*\n┃ ❖ Autor ➜ ${(d.author_name || ['?']).slice(0, 2).join(', ')}\n┃ ❖ Primera edicion ➜ ${d.first_publish_year || '?'}\n┃ ❖ Paginas ➜ ${d.number_of_pages_median || '?'}\n┃ ❖ Temas ➜ ${(d.subject || []).slice(0, 4).join(', ') || '-'}\n┗━━━━━━━━━━━━━━━━⬣\n_Fuente: Open Library_`;
        await sendCard(ctx, d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null, cap);
      } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'diccionario', aliases: ['dic', 'significado'], cat: 'Herramientas', desc: 'Definicion de una palabra (!diccionario casa)',
    async run({ args, reply, prefix }) {
      const w = norm(args[0] || '');
      if (!w) return reply(`Uso: ${prefix}diccionario palabra`);
      try {
        const j = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/es/${encodeURIComponent(w)}`);
        const e = j[0];
        const rows = e.meanings.slice(0, 3).map((m) => `❖ _${m.partOfSpeech}_\n${m.definitions.slice(0, 2).map((d, i) => `   ${i + 1}. ${d.definition}`).join('\n')}`).join('\n\n');
        await reply(`📖 *${e.word}* ${e.phonetic ? `_${e.phonetic}_` : ''}\n\n${rows}`);
      } catch { await reply('❌ No encontre esa palabra.'); }
    },
  },
  {
    name: 'anime', aliases: ['animeinfo'], cat: 'Informacion', desc: 'Informacion de un anime (!anime naruto)',
    async run(ctx) {
      const q = ctx.args.join(' ').trim();
      if (!q) return ctx.reply(`Uso: ${ctx.prefix}anime nombre`);
      try {
        const j = await getJson(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1&sfw=true`, { timeout: 20000 });
        const d = j.data && j.data[0];
        if (!d) return ctx.reply('❌ No encontre ese anime.');
        const syn = await toEs((d.synopsis || 'Sin sinopsis.').replace(/\[Written by.*?\]/i, ''));
        const cap = `┏━━『 ✦ ANIME ✦ 』━━⬣\n┃ ❖ *${d.title_english || d.title}*\n┃ ❖ Puntaje ➜ ⭐ ${d.score || '?'}  ✦  Episodios ➜ ${d.episodes || '?'}\n┃ ❖ Estado ➜ ${d.status}  ✦  Año ➜ ${d.year || '?'}\n┃ ❖ Generos ➜ ${(d.genres || []).map((g) => g.name).join(', ')}\n┗━━━━━━━━━━━━━━━━⬣\n\n${short(syn, 500)}\n\n🔗 ${d.url}`;
        await sendCard(ctx, d.images && d.images.jpg && d.images.jpg.large_image_url, cap);
      } catch { await fail(ctx.reply); }
    },
  },
  {
    name: 'iss', aliases: ['estacionespacial'], cat: 'Informacion', desc: 'Donde esta la Estacion Espacial ahora',
    async run({ reply }) {
      try {
        const [pos, crew] = await Promise.all([getJson('http://api.open-notify.org/iss-now.json'), getJson('http://api.open-notify.org/astros.json').catch(() => null)]);
        const { latitude: la, longitude: lo } = pos.iss_position;
        await reply(`🛰️ *ESTACION ESPACIAL INTERNACIONAL*\n\n❖ Latitud ➜ ${Number(la).toFixed(2)}\n❖ Longitud ➜ ${Number(lo).toFixed(2)}\n🗺️ https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=3/${la}/${lo}${crew ? `\n\n👨‍🚀 Personas en el espacio: *${crew.number}*` : ''}`);
      } catch { await fail(reply); }
    },
  },
  {
    name: 'juegogratis', aliases: ['freegame'], cat: 'Informacion', desc: 'Un juego gratis para PC (!juegogratis shooter)',
    async run(ctx) {
      const cat = norm(ctx.args[0] || '');
      try {
        const list = await getJson(`https://www.freetogame.com/api/games?platform=pc${cat ? `&category=${encodeURIComponent(cat)}` : ''}`, { timeout: 20000 });
        if (!Array.isArray(list) || !list.length) return ctx.reply('❌ No encontre juegos con esa categoria (prueba: shooter, mmorpg, strategy, moba, racing, sports).');
        const g = pick(list);
        const cap = `┏━━『 ✦ JUEGO GRATIS ✦ 』━━⬣\n┃ ❖ *${g.title}*\n┃ ❖ Genero ➜ ${g.genre}  ✦  Plataforma ➜ ${g.platform}\n┃ ❖ Desarrolla ➜ ${g.publisher}\n┃ ❖ Lanzamiento ➜ ${g.release_date}\n┗━━━━━━━━━━━━━━━━⬣\n\n${await toEs(g.short_description)}\n\n🔗 ${g.game_url}`;
        await sendCard(ctx, g.thumbnail, cap);
      } catch { await fail(ctx.reply); }
    },
  },

  /* ---------------- herramientas con API ---------------- */
  {
    name: 'acortar', aliases: ['short', 'isgd'], cat: 'Herramientas', desc: 'Acorta un enlace (!acortar https://...)',
    async run({ args, reply, prefix }) {
      if (!/^https?:\/\/\S+$/i.test(args[0] || '')) return reply(`Uso: ${prefix}acortar https://enlace-muy-largo.com/...`);
      try {
        const t = (await getText(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(args[0])}`, { timeout: 12000 })).trim();
        if (!/^https?:/.test(t)) throw new Error(t);
        await reply(`🔗 *Enlace acortado*\n${t}`);
      } catch { await reply('❌ No pude acortar ese enlace.'); }
    },
  },
  {
    name: 'github', aliases: ['gh'], cat: 'Herramientas', desc: 'Perfil de GitHub (!github usuario)',
    async run(ctx) {
      const u = (ctx.args[0] || '').replace(/[^\w-]/g, '');
      if (!u) return ctx.reply(`Uso: ${ctx.prefix}github usuario`);
      try {
        const d = await getJson(`https://api.github.com/users/${u}`, { headers: { Accept: 'application/vnd.github+json' } });
        const cap = `┏━━『 ✦ GITHUB ✦ 』━━⬣\n┃ ❖ *${d.name || d.login}* (@${d.login})\n┃ ❖ Repos ➜ ${d.public_repos}  ✦  Seguidores ➜ ${fmt(d.followers)}  ✦  Siguiendo ➜ ${d.following}\n┃ ❖ ${d.company ? `Empresa ➜ ${d.company}  ✦  ` : ''}Lugar ➜ ${d.location || '-'}\n┃ ❖ Creado ➜ ${d.created_at.slice(0, 10)}\n┗━━━━━━━━━━━━━━━━⬣\n${d.bio ? `\n📝 ${d.bio}\n` : ''}\n🔗 ${d.html_url}`;
        await sendCard(ctx, d.avatar_url, cap);
      } catch { await ctx.reply('❌ No encontre ese usuario de GitHub.'); }
    },
  },
  {
    name: 'npm', cat: 'Herramientas', desc: 'Datos de un paquete npm (!npm express)',
    async run({ args, reply, prefix }) {
      const p = (args[0] || '').toLowerCase();
      if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(p)) return reply(`Uso: ${prefix}npm express`);
      try {
        const d = await getJson(`https://registry.npmjs.org/${p.replace('/', '%2F')}/latest`);
        const dl = await getJson(`https://api.npmjs.org/downloads/point/last-week/${p}`).catch(() => null);
        await reply(`📦 *${d.name}* v${d.version}\n\n${d.description || ''}\n\n❖ Licencia ➜ ${d.license || '-'}\n${dl ? `❖ Descargas (7 dias) ➜ ${fmt(dl.downloads)}\n` : ''}🔗 ${d.homepage || `https://www.npmjs.com/package/${d.name}`}\n\n⌨️ npm i ${d.name}`);
      } catch { await reply('❌ No encontre ese paquete.'); }
    },
  },
  {
    name: 'whois', aliases: ['dominio'], cat: 'Herramientas', desc: 'Datos de un dominio (!whois google.com)',
    async run({ args, reply, prefix }) {
      const d = (args[0] || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return reply(`Uso: ${prefix}whois ejemplo.com`);
      try {
        const j = await getJson(`https://rdap.org/domain/${d}`, { timeout: 20000 });
        const ev = (a) => ((j.events || []).find((e) => e.eventAction === a) || {}).eventDate;
        const reg = (j.entities || []).find((e) => (e.roles || []).includes('registrar'));
        const regName = reg && reg.vcardArray && ((reg.vcardArray[1].find((x) => x[0] === 'fn') || [])[3]);
        await reply(`🌐 *${j.ldhName || d}*\n\n❖ Registrador ➜ ${regName || '-'}\n❖ Creado ➜ ${(ev('registration') || '-').slice(0, 10)}\n❖ Vence ➜ ${(ev('expiration') || '-').slice(0, 10)}\n❖ Actualizado ➜ ${(ev('last changed') || '-').slice(0, 10)}\n❖ Estado ➜ ${(j.status || []).slice(0, 2).join(', ') || '-'}\n❖ DNS ➜ ${(j.nameservers || []).slice(0, 3).map((n) => n.ldhName).join(', ') || '-'}`);
      } catch { await reply('❌ No pude consultar ese dominio.'); }
    },
  },
];
