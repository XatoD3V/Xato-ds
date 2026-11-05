// Descargas: YouTube (audio/video), TikTok, Facebook, Instagram, Twitter/X, Mediafire, Spotify.
// Orden de intentos: API configurada (.env) -> alternativa gratuita -> yt-dlp instalado en el equipo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const config = require('../../config');
const { getJson, getBuffer, getText, cooldown } = require('../util');

const CAT = 'Descargas';
const MAX_MB = 2000; // tope de WhatsApp (~2 GB)
const MAX_FILE_MB = 2000; // tope de WhatsApp para documentos (~2 GB)
const cfg = () => config.dl;
let running = 0;

/* ---------------- utilidades ---------------- */
const isUrl = (s) => /^https?:\/\/\S+$/i.test(s || '');
const fail = (reply, what = 'eso') => reply(`❌ No pude descargar ${what}. Revisa el enlace o intenta mas tarde.`);
const card = (title, rows) =>
  `╭━━〔 📥 *${title}* 〕━━⬣\n${rows.filter(Boolean).map((r) => `┃ ${r}`).join('\n')}\n╰━━━━━━━━━━━━━━━━⬣`;
const credit = () => `_${config.botName} · ${config.developer}_`;

// URL de la API configurada (null si no hay clave).
function apiUrl(which, p, params) {
  const { url, key } = which === 2 ? { url: cfg().url2, key: cfg().key2 } : { url: cfg().url, key: cfg().key };
  if (!key) return null;
  return `${url}${p}?${new URLSearchParams({ ...params, key })}`;
}

let ytdlpOk = { t: 0, ok: false };
function ytdlpAvailable() {
  if (Date.now() - ytdlpOk.t < 60000) return ytdlpOk.ok;
  ytdlpOk = { t: Date.now(), ok: spawnSync('yt-dlp', ['--version'], { timeout: 8000 }).status === 0 };
  return ytdlpOk.ok;
}

function runYtdlp(args, timeout = 240000) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xato-'));
    const p = spawn('yt-dlp', [
      '--no-playlist', '--no-warnings', '--max-filesize', `${MAX_MB}M`,
      '-o', path.join(dir, '%(title).70B.%(ext)s'), ...args,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => p.kill('SIGKILL'), timeout);
    p.on('error', (e) => { clearTimeout(timer); fs.rmSync(dir, { recursive: true, force: true }); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      const file = fs.readdirSync(dir).map((f) => path.join(dir, f))[0];
      if (code !== 0 || !file) { fs.rmSync(dir, { recursive: true, force: true }); return reject(new Error(err.slice(-200) || 'sin archivo')); }
      resolve({ file, dir, title: path.parse(file).name });
    });
  });
}

// Descarga con yt-dlp y la envia. kind: 'mp3' | 'mp4'
async function sendViaYtdlp({ sock, jid, m }, target, kind, title) {
  if (!ytdlpAvailable()) throw new Error('yt-dlp no instalado');
  const a = kind === 'mp3'
    ? ['-x', '--audio-format', 'mp3', '--audio-quality', '5', '--', target]
    : ['-f', `b[ext=mp4][filesize<${MAX_MB}M]/b[ext=mp4]/b`, '--merge-output-format', 'mp4', '--', target];
  const res = await runYtdlp(a);
  try {
    // Se envia desde el archivo (sin cargarlo entero en memoria)
    if (kind === 'mp3') await sock.sendMessage(jid, { audio: { url: res.file }, mimetype: 'audio/mpeg', fileName: `${title || res.title}.mp3` }, { quoted: m });
    else await sock.sendMessage(jid, { video: { url: res.file }, mimetype: 'video/mp4', caption: `🎬 *${title || res.title}*\n${credit()}` }, { quoted: m });
  } finally { fs.rmSync(res.dir, { recursive: true, force: true }); }
}

// Control de abuso: espera por usuario + maximo de descargas simultaneas.
async function guarded(ctx, label, fn) {
  const { reply, sender } = ctx;
  const wait = cooldown(`dl:${sender}`, 15000);
  if (wait) return reply(`⏳ Espera ${wait}s para otra descarga.`);
  if (running >= 3) return reply('🚦 Hay muchas descargas en curso. Intenta en un momento.');
  running++;
  try {
    await reply(`📥 Descargando ${label}, un momento...`);
    await fn();
  } catch (e) {
    console.error(`[descarga ${label}]`, e.message);
    if (e.message === 'yt-dlp no instalado') {
      await reply('⚠️ Para esta descarga el dueño del bot debe configurar *DL_API_KEY* en el .env o instalar *yt-dlp* en el servidor. Mira el README.');
    } else await fail(reply, label);
  } finally { running--; }
}

/* ---------------- YouTube ---------------- */
async function ytInfo(text) {
  const idm = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/);
  try {
    const yts = require('yt-search');
    const r = idm ? await yts({ videoId: idm[1] }) : (await yts(text)).videos[0];
    if (r) {
      return {
        title: r.title, url: r.url || `https://youtu.be/${idm && idm[1]}`,
        channel: (r.author && r.author.name) || '-', duration: r.timestamp || (r.duration && r.duration.timestamp) || '-',
        views: r.views || 0, thumb: r.image || r.thumbnail,
      };
    }
  } catch { /* sin yt-search: se usa yt-dlp */ }
  if (idm) return { title: 'Video de YouTube', url: `https://youtu.be/${idm[1]}`, channel: '-', duration: '-', views: 0 };
  return null;
}

function youtube(kind) {
  const audio = kind === 'mp3';
  return async (ctx) => {
    const { sock, m, jid, args, reply, prefix } = ctx;
    const q = args.join(' ').trim();
    if (!q) return reply(`Uso: ${prefix}${audio ? 'play' : 'play2'} nombre o enlace de YouTube`);
    await guarded(ctx, audio ? 'el audio' : 'el video', async () => {
      const info = await ytInfo(q);
      if (!info && !ytdlpAvailable()) throw new Error('sin informacion');
      const target = info ? info.url : `ytsearch1:${q}`;
      if (info) {
        const caption = card(audio ? 'YOUTUBE AUDIO' : 'YOUTUBE VIDEO', [
          `🎵 *${info.title}*`, `📺 *Canal:* ${info.channel}`, `⏱️ *Duracion:* ${info.duration}`,
          `👁️ *Vistas:* ${Number(info.views).toLocaleString('es-PE')}`, `🔗 ${info.url}`,
        ]);
        if (info.thumb) await sock.sendMessage(jid, { image: { url: info.thumb }, caption }, { quoted: m }).catch(() => reply(caption));
        else await reply(caption);
      }

      const endpoint = info && (audio
        ? apiUrl(1, '/dl/ytmp3', { url: info.url })
        : apiUrl(1, '/dl/ytmp4', { url: info.url, quality: 'auto' }));
      if (endpoint) {
        try {
          const j = await getJson(endpoint, { timeout: 60000 });
          if (audio && j.status && j.data && j.data.dl) {
            return await sock.sendMessage(jid, { audio: { url: j.data.dl }, mimetype: 'audio/mpeg', fileName: j.data.fileName || `${info.title}.mp3` }, { quoted: m });
          }
          if (!audio && j.status && j.result && j.result.downloadUrl) {
            return await sock.sendMessage(jid, { video: { url: j.result.downloadUrl }, mimetype: 'video/mp4', fileName: `${j.result.title || info.title}.mp4`, caption: credit() }, { quoted: m });
          }
        } catch { /* se prueba yt-dlp */ }
      }
      await sendViaYtdlp(ctx, target, kind, info && info.title);
    });
  };
}

/* ---------------- TikTok ---------------- */
async function tiktokData(url, wantMp3) {
  const e = apiUrl(1, wantMp3 ? '/dl/tiktokmp3' : '/dl/tiktok', { url });
  if (e) {
    try {
      const j = await getJson(e, { timeout: 40000 });
      if (j.data && j.data.dl) {
        const d = j.data;
        return { title: d.title || 'TikTok', dl: d.dl, thumb: d.thumbnail, author: (d.author && (d.author.nickname || d.author.unique_id)) || '-',
          duration: d.duration, likes: d.stats && d.stats.likes, views: d.stats && (d.stats.views || d.stats.plays), type: d.type || 'video' };
      }
    } catch { /* alternativa gratuita */ }
  }
  const j = await getJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, { timeout: 25000 });
  if (j.code !== 0 || !j.data) throw new Error('tikwm');
  const d = j.data;
  const fix = (u) => (u && u.startsWith('/') ? `https://www.tikwm.com${u}` : u);
  return { title: d.title || 'TikTok', dl: fix(wantMp3 ? d.music : d.hdplay || d.play), thumb: fix(d.cover), author: (d.author && d.author.nickname) || '-',
    duration: d.duration, likes: d.digg_count, views: d.play_count, type: 'video' };
}

function tiktok(forceMp3) {
  return async (ctx) => {
    const { sock, m, jid, args, reply, prefix } = ctx;
    const wantMp3 = forceMp3 || args.includes('--mp3');
    const url = args.find((a) => /tiktok\.com/i.test(a));

    if (!url) return reply(`Uso: ${prefix}tiktok https://vm.tiktok.com/xxxx\nAudio: ${prefix}tiktok enlace --mp3`);

    await guarded(ctx, wantMp3 ? 'el audio de TikTok' : 'TikTok', async () => {
      let d;
      try { d = await tiktokData(url, wantMp3); } catch {
        return await sendViaYtdlp(ctx, url, wantMp3 ? 'mp3' : 'mp4');
      }
      const caption = card('TIKTOK', [
        `📝 *${String(d.title).slice(0, 120)}*`, `👤 *Autor:* ${d.author}`, d.duration ? `⏱️ *Duracion:* ${d.duration}` : '',
        d.likes ? `❤️ *Likes:* ${Number(d.likes).toLocaleString('es-PE')}` : '', d.views ? `👁️ *Vistas:* ${Number(d.views).toLocaleString('es-PE')}` : '',
      ]) + `\n${credit()}`;
      if (wantMp3) {
        if (d.thumb) await sock.sendMessage(jid, { image: { url: d.thumb }, caption }, { quoted: m }).catch(() => {});
        return await sock.sendMessage(jid, { audio: { url: d.dl }, mimetype: 'audio/mpeg', fileName: `${d.title.slice(0, 60)}.mp3` }, { quoted: m });
      }
      await sock.sendMessage(jid, { [d.type === 'image' ? 'image' : 'video']: { url: d.dl }, caption }, { quoted: m });
    });
  };
}

/* ---------------- Facebook ---------------- */
async function facebook(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const url = args.find((a) => /facebook\.com|fb\.watch|video\.fb\.com/i.test(a));
  if (!url) return reply(`Uso: ${prefix}facebook https://fb.watch/xxxx`);
  await guarded(ctx, 'el video de Facebook', async () => {
    const e = apiUrl(1, '/dl/facebookv2', { url });
    if (e) {
      try {
        const { buffer, type } = await getBuffer(e, { timeout: 90000 });
        if (type.startsWith('video') || type.includes('octet')) {
          if (buffer.length > MAX_MB * 1048576) return reply(`❌ El video supera el limite de ${MAX_MB} MB.`);
          return await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', fileName: 'facebook.mp4', caption: credit() }, { quoted: m });
        }
      } catch { /* yt-dlp */ }
    }
    await sendViaYtdlp(ctx, url, 'mp4');
  });
}

/* ---------------- Instagram ---------------- */
async function instagram(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const url = args.find((a) => /instagram\.com\/(p|reel|reels|share|tv)\//i.test(a));
  if (!url) return reply(`Uso: ${prefix}instagram https://www.instagram.com/reel/xxxx`);
  await guarded(ctx, 'contenido de Instagram', async () => {
    const e = apiUrl(2, '/dl/instagram', { url });
    if (e) {
      try {
        const j = await getJson(e, { timeout: 60000 });
        const items = (j.status && j.data && j.data.download) || [];
        if (items.length) {
          for (const it of items.slice(0, 10)) {
            await sock.sendMessage(jid, it.type === 'video'
              ? { video: { url: it.url }, mimetype: 'video/mp4', caption: credit() }
              : { image: { url: it.url }, caption: credit() }, { quoted: m });
          }
          return;
        }
      } catch { /* yt-dlp */ }
    }
    await sendViaYtdlp(ctx, url, 'mp4');
  });
}

/* ---------------- Twitter / X ---------------- */
async function twitter(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const url = args.find((a) => /(twitter|x)\.com\/.+\/status\/\d+/i.test(a));
  if (!url) return reply(`Uso: ${prefix}twitter https://x.com/usuario/status/123456789`);
  await guarded(ctx, 'el contenido de X/Twitter', async () => {
    try {
      const id = url.match(/status\/(\d+)/)[1];
      const j = await getJson(`https://api.fxtwitter.com/status/${id}`, { timeout: 25000 });
      const t = j.tweet;
      const media = (t && t.media) || {};
      const caption = `${card('X / TWITTER', [`👤 *${(t.author && t.author.name) || '-'}* (@${(t.author && t.author.screen_name) || '-'})`, `📝 ${String(t.text || '').slice(0, 300)}`])}\n${credit()}`;
      const videos = media.videos || [];
      const photos = media.photos || [];
      if (!videos.length && !photos.length) throw new Error('sin medios');
      for (const v of videos.slice(0, 4)) await sock.sendMessage(jid, { video: { url: v.url }, caption }, { quoted: m });
      for (const p of photos.slice(0, 4)) await sock.sendMessage(jid, { image: { url: p.url }, caption }, { quoted: m });
    } catch {
      await sendViaYtdlp(ctx, url, 'mp4');
    }
  });
}

/* ---------------- Mediafire ---------------- */
function parseSizeMB(s = '') {
  const x = String(s).match(/([\d.,]+)\s*(KB|MB|GB)/i);
  if (!x) return 0;
  const n = parseFloat(x[1].replace(',', '.'));
  return { KB: n / 1024, MB: n, GB: n * 1024 }[x[2].toUpperCase()];
}

async function mediafire(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const url = args.find((a) => /^https?:\/\/(www\.)?mediafire\.com\//i.test(a));
  if (!url) return reply(`Uso: ${prefix}mediafire https://www.mediafire.com/file/xxxx`);
  await guarded(ctx, 'el archivo de Mediafire', async () => {
    let f = null;
    const e = apiUrl(1, '/dl/mediafire', { url });
    if (e) {
      try {
        const j = await getJson(e, { timeout: 40000 });
        if (j.status && j.result) f = { name: j.result.filename, type: j.result.filetype, size: j.result.filesize, date: j.result.uploaded, dl: j.result.download };
      } catch { /* scraping */ }
    }
    if (!f) {
      const html = await getText(url, { timeout: 25000 });
      const link = (html.match(/id="downloadButton"[^>]*href="([^"]+)"/) || html.match(/href="(https?:\/\/download[^"]+)"/) || [])[1];
      if (!link) throw new Error('sin enlace');
      const name = decodeURIComponent((link.split('/').pop() || 'archivo').split('?')[0]);
      const size = (html.match(/<li>File size: <span>([^<]+)<\/span>/i) || html.match(/class="details"[\s\S]*?<span>([^<]+)<\/span>/) || [])[1] || '';
      f = { name, type: (name.split('.').pop() || '').toUpperCase(), size, date: '-', dl: link };
    }
    if (parseSizeMB(f.size) > MAX_FILE_MB) return reply(`❌ El archivo pesa ${f.size} y supera el limite de ${MAX_FILE_MB} MB.`);
    await reply(card('MEDIAFIRE', [`📄 *${f.name}*`, `🏷️ *Tipo:* ${f.type}`, `📦 *Tamano:* ${f.size || '?'}`, `📅 *Subido:* ${f.date}`, '', 'Enviando archivo...']));
    await sock.sendMessage(jid, { document: { url: f.dl }, mimetype: 'application/octet-stream', fileName: f.name, caption: credit() }, { quoted: m });
  });
}

/* ---------------- Descarga generica (yt-dlp) ---------------- */
async function generic(ctx) {
  const { args, reply, prefix } = ctx;
  if (!isUrl(args[0])) return reply(`Uso: ${prefix}dl https://enlace-del-video`);
  if (!ytdlpAvailable()) return reply('⚠️ Este comando necesita *yt-dlp* instalado en el servidor. Mira el README.');
  await guarded(ctx, 'el video', () => sendViaYtdlp(ctx, args[0], 'mp4'));
}


/* ---------------- Pinterest ---------------- */
async function pinterest(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const q = args.join(' ').trim();
  if (!q) return reply(`Uso: ${prefix}pinterest https://www.pinterest.com/pin/xxxx`);

  if (!isUrl(q)) return reply(`Uso: ${prefix}pinterest https://www.pinterest.com/pin/xxxx`);

  await guarded(ctx, 'el pin de Pinterest', async () => {
    const e = apiUrl(1, '/dl/pinterest', { url: q });
    if (e) {
      try {
        const j = await getJson(e, { timeout: 40000 });
        if (j.data && j.data.dl) {
          const kind = ['image', 'video'].includes(j.data.type) ? j.data.type : 'document';
          return await sock.sendMessage(jid, { [kind]: { url: j.data.dl }, ...(kind === 'document' ? { mimetype: 'application/octet-stream', fileName: 'pinterest' } : { caption: credit() }) }, { quoted: m });
        }
      } catch { /* extraccion directa */ }
    }
    const html = await getText(q, { timeout: 25000 });
    const video = (html.match(/"contentUrl":"(https:[^"]+?\.mp4)"/) || [])[1];
    const image = (html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/content="([^"]+)"\s+property="og:image"/) || [])[1];
    if (video) return sock.sendMessage(jid, { video: { url: video.replace(/\\u002F/g, '/') }, caption: credit() }, { quoted: m });
    if (image) return sock.sendMessage(jid, { image: { url: image.replace('/236x/', '/originals/') }, caption: credit() }, { quoted: m });
    throw new Error('sin medios');
  });
}

/* ---------------- APK (Aptoide) ---------------- */
async function apk(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const q = args.join(' ').trim();
  if (!q) return reply(`Uso: ${prefix}apk nombre de la aplicacion`);
  await guarded(ctx, 'la aplicacion', async () => {
    let app = null;
    try {
      const j = await getJson(`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(q)}&limit=1`, { timeout: 25000 });
      const a = j.datalist && j.datalist.list && j.datalist.list[0];
      if (a && a.file && a.file.path) {
        app = { name: a.name, pkg: a.package, updated: String(a.updated || '').slice(0, 10), bytes: a.file.filesize || a.size || 0,
          version: a.file.vername, dl: a.file.path, icon: a.icon };
      }
    } catch { /* API de respaldo */ }
    if (!app) {
      const e = apiUrl(1, '/search/apk', { query: q });
      if (e) {
        const j = await getJson(e, { timeout: 40000 });
        const d = j.data;
        if (d && d.name && d.dl) app = { name: d.name, pkg: d.package, updated: d.lastUpdated, size: d.size, dl: d.dl };
      }
    }
    if (!app) return reply(`No encontre la aplicacion *${q}*.`);
    const mb = app.bytes ? app.bytes / 1048576 : parseSizeMB(app.size);
    if (mb > MAX_FILE_MB) return reply(`❌ ${app.name} pesa ${mb.toFixed(0)} MB y supera el limite de ${MAX_FILE_MB} MB.`);
    const caption = card('APK', [
      `📱 *${app.name}*`, `📦 *Paquete:* ${app.pkg || '-'}`, app.version ? `🏷️ *Version:* ${app.version}` : '',
      `💾 *Tamano:* ${mb ? `${mb.toFixed(1)} MB` : app.size || '?'}`, `📅 *Actualizado:* ${app.updated || '-'}`, '', 'Enviando archivo...',
    ]);
    if (app.icon) await sock.sendMessage(jid, { image: { url: app.icon }, caption }, { quoted: m }).catch(() => reply(caption));
    else await reply(caption);
    await sock.sendMessage(jid, { document: { url: app.dl }, fileName: `${app.name}.apk`, mimetype: 'application/vnd.android.package-archive', caption: `${credit()}\n⚠️ Instala solo apps de fuentes confiables.` }, { quoted: m });
  });
}

/* ---------------- Buscar en YouTube ---------------- */
async function ytsearch(ctx) {
  const { sock, m, jid, args, reply, prefix } = ctx;
  const q = args.join(' ').trim();
  if (!q) return reply(`Uso: ${prefix}ytsearch nombre del video`);
  try {
    const list = (await require('yt-search')(q)).videos.slice(0, 6);
    if (!list.length) return reply('No encontre resultados.');
    const rows = list.map((v, i) => `*${i + 1}.* ${v.title}\n   ⏱️ ${v.timestamp} · 👁️ ${Number(v.views).toLocaleString('es-PE')} · 📺 ${(v.author && v.author.name) || '-'}\n   🔗 ${v.url}`).join('\n\n');
    const caption = `╭━━〔 🔎 *YOUTUBE* 〕━━⬣\n┃ Resultados para *${q}*\n╰━━━━━━━━━━━━━━⬣\n\n${rows}\n\n_Descarga con ${prefix}play enlace o ${prefix}play2 enlace_`;
    if (list[0].image) await sock.sendMessage(jid, { image: { url: list[0].image }, caption }, { quoted: m }).catch(() => reply(caption));
    else await reply(caption);
  } catch { await reply('❌ No pude buscar en YouTube ahora.'); }
}

const cmd = (name, aliases, desc, run) => ({ name, aliases, cat: CAT, desc, run });

module.exports = [
  cmd('play', ['ytmp3', 'ytaudio', 'playaudio', 'mp3'], 'YouTube audio (!play nombre|enlace)', youtube('mp3')),
  cmd('play2', ['ytmp4', 'ytvideo', 'playvideo', 'mp4'], 'YouTube video (!play2 nombre|enlace)', youtube('mp4')),
  cmd('tiktok', ['tt'], 'TikTok sin marca (!tiktok enlace [--mp3])', tiktok(false)),
  cmd('tiktokmp3', ['ttmp3'], 'Audio de un TikTok (!tiktokmp3 enlace)', tiktok(true)),
  cmd('facebook', ['fb'], 'Video de Facebook (!facebook enlace)', facebook),
  cmd('instagram', ['ig', 'insta', 'reel'], 'Reels y posts de Instagram (!instagram enlace)', instagram),
  cmd('twitter', ['x', 'xdl'], 'Videos e imagenes de X (!twitter enlace)', twitter),
  cmd('mediafire', ['mf'], 'Archivos de Mediafire (!mediafire enlace)', mediafire),
  cmd('pinterest', ['pin'], 'Imagen o video de un pin (!pinterest enlace)', pinterest),
  cmd('apk', ['aptoide', 'apkdl'], 'Descarga apps APK (!apk whatsapp)', apk),
  cmd('ytsearch', ['yts'], 'Busca videos en YouTube (!ytsearch texto)', ytsearch),
  cmd('dl', ['descargar'], 'Otros sitios con yt-dlp (!dl enlace)', generic),
];
