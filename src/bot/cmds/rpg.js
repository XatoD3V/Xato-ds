// Economia avanzada adaptada del HuTao: banco, RPG y casino (montos ajustados a la economia de Xato Ds).
const { takeCooldown, rand, pick, fmtTime, norm, getTargets, num, sameUser } = require('../util');

const RPG = 'Rpg';
const CASINO = 'Casino';
const BANK = 'Economia';
const fmt = (n) => Number(n).toLocaleString('es-PE');
const box = (title, lines) => `╭━━〔 ${title} 〕━━⬣\n${lines.map((l) => `┃ ${l}`).join('\n')}\n╰━━━━━━━━━━━━━━⬣`;

// Pierde monedas de la cartera (el banco es seguro). Devuelve lo realmente perdido.
function lose(user, n) {
  const lost = Math.min(user.coins, n);
  user.coins -= lost;
  return lost;
}

// Crea un comando de aventura con cooldown, exito/fallo y mensajes.
function adventure({ name, aliases, desc, key, minutes, chance, win, loss, wins, fails }) {
  return {
    name, aliases, cat: RPG, desc,
    async run({ user, store, reply }) {
      const left = takeCooldown(user, key, minutes * 60000);
      if (left) return reply(`⏳ Debes esperar *${fmtTime(left)}* para usar *${name}* otra vez.`);
      let text;
      if (Math.random() < chance) {
        const n = rand(...win);
        user.coins += n;
        text = `${pick(wins)}\n💰 Ganaste *${fmt(n)}* monedas.`;
      } else {
        const n = lose(user, rand(...loss));
        text = `${pick(fails)}\n💸 Perdiste *${fmt(n)}* monedas.`;
      }
      store.save();
      await reply(`${text}\n🪙 Cartera: *${fmt(user.coins)}*`);
    },
  };
}

const amountOf = (arg, max) => (/^(todo|all)$/i.test(arg || '') ? max : parseInt(arg, 10));

module.exports = [
  /* ---------------- banco ---------------- */
  {
    name: 'banco', aliases: ['bank'], cat: BANK, desc: 'Tu cartera y tu banco',
    async run({ user, reply }) {
      await reply(box('🏦 BANCO', [`🪙 *Cartera:* ${fmt(user.coins)}`, `🏛️ *Banco:* ${fmt(user.bank)}`, `💎 *Total:* ${fmt(user.coins + user.bank)}`, '_El dinero del banco no se puede robar._']));
    },
  },
  {
    name: 'depositar', aliases: ['dep', 'deposit'], cat: BANK, desc: 'Guarda monedas en el banco (!dep 100|todo)',
    async run({ user, args, store, reply, prefix }) {
      const n = amountOf(args[0], user.coins);
      if (!Number.isFinite(n) || n < 1) return reply(`Uso: ${prefix}dep 100  o  ${prefix}dep todo`);
      if (n > user.coins) return reply('❌ No tienes tantas monedas en la cartera.');
      user.coins -= n; user.bank += n; store.save();
      await reply(`🏛️ Depositaste *${fmt(n)}* monedas.\n🪙 Cartera: ${fmt(user.coins)} · 🏛️ Banco: ${fmt(user.bank)}`);
    },
  },
  {
    name: 'retirar', aliases: ['withdraw', 'with'], cat: BANK, desc: 'Saca monedas del banco (!retirar 100|todo)',
    async run({ user, args, store, reply, prefix }) {
      const n = amountOf(args[0], user.bank);
      if (!Number.isFinite(n) || n < 1) return reply(`Uso: ${prefix}retirar 100  o  ${prefix}retirar todo`);
      if (n > user.bank) return reply('❌ No tienes tantas monedas en el banco.');
      user.bank -= n; user.coins += n; store.save();
      await reply(`🏦 Retiraste *${fmt(n)}* monedas.\n🪙 Cartera: ${fmt(user.coins)} · 🏛️ Banco: ${fmt(user.bank)}`);
    },
  },
  {
    name: 'tiempos', aliases: ['cooldowns', 'waittimes'], cat: BANK, desc: 'Tiempos de espera de tus comandos',
    async run({ user, reply }) {
      const list = [
        ['🎁 diario', user.lastDaily + 24 * 3600000], ['💼 trabajar', user.lastWork + 3600000],
        ['🦹 crime', user.cd.crime], ['🎣 pescar', user.cd.pescar], ['🏹 cazar', user.cd.cazar],
        ['⛏️ minar', user.cd.minar], ['🥷 robar', user.cd.robar], ['🔮 ritual', user.cd.ritual],
      ];
      const lines = list.map(([n, t]) => `${n}: ${t && t > Date.now() ? `⏳ ${fmtTime(t - Date.now())}` : '✅ listo'}`);
      await reply(box('⏱️ TIEMPOS', lines));
    },
  },

  /* ---------------- RPG ---------------- */
  adventure({
    name: 'crime', aliases: ['crimen'], desc: 'Arriesga monedas en un golpe (10 min)', key: 'crime', minutes: 10, chance: 0.5, win: [100, 600], loss: [50, 400],
    wins: ['🦹 Hackeaste un sistema de seguridad con exito.', '🦹 Vendiste informacion confidencial.', '🦹 Planeaste un golpe perfecto.', '🦹 Te volviste el rey del contrabando.'],
    fails: ['🚔 Te atraparon tras el robo.', '🚔 Te reconocieron por el disfraz.', '🚔 Tu plan fue delatado.'],
  }),
  adventure({
    name: 'pescar', aliases: ['fish'], desc: 'Pesca para ganar monedas (8 min)', key: 'pescar', minutes: 8, chance: 0.6, win: [80, 300], loss: [30, 150],
    wins: ['🎣 Pescaste un salmon enorme.', '🎣 Atrapaste una trucha dorada.', '🎣 Capturaste un pulpo azul.', '🎣 Sacaste una carpa real.'],
    fails: ['🌊 Una ola se llevo tu cana.', '🌊 El pez rompio la linea y perdiste el cebo.'],
  }),
  adventure({
    name: 'cazar', aliases: ['hunt'], desc: 'Caza para ganar monedas (12 min)', key: 'cazar', minutes: 12, chance: 0.55, win: [150, 500], loss: [80, 250],
    wins: ['🏹 Cazaste un ciervo majestuoso.', '🏹 Atrapaste un jabali.', '🏹 Cazaste un faisan raro.'],
    fails: ['🐻 Un oso te hizo huir y perdiste equipo.', '🐗 La presa escapo y rompiste tu arco.'],
  }),
  {
    name: 'minar', aliases: ['mine'], cat: RPG, desc: 'Mina recursos (10 min)',
    async run({ user, store, reply }) {
      const left = takeCooldown(user, 'minar', 10 * 60000);
      if (left) return reply(`⏳ Debes esperar *${fmtTime(left)}* para minar otra vez.`);
      let n, text;
      if (Math.random() < 0.03) { n = rand(2000, 4000); text = '💎 ¡Encontraste un *diamante legendario*!'; }
      else { n = rand(60, 250); text = '⛏️ Picaste roca y sacaste minerales.'; }
      if (Math.random() < 0.1) { const b = rand(30, 150); n += b; text += `\n✨ Bonus de veta: +${b}`; }
      user.coins += n; store.save();
      await reply(`${text}\n💰 Ganaste *${fmt(n)}* monedas.\n🪙 Cartera: *${fmt(user.coins)}*`);
    },
  },
  {
    name: 'ritual', cat: RPG, desc: 'Invoca un ritual (15 min)',
    async run({ user, store, reply }) {
      const left = takeCooldown(user, 'ritual', 15 * 60000);
      if (left) return reply(`⏳ Debes esperar *${fmtTime(left)}* para otro ritual.`);
      const r = Math.random();
      let text;
      if (r < 0.02) { const n = rand(3000, 6000); user.coins += n; text = `🌌 ¡Un espiritu ancestral te entrega un tesoro!\n💰 +${fmt(n)} monedas (MITICO)`; }
      else if (r < 0.2) { const n = rand(300, 800); user.coins += n; text = `🔮 Se abre un portal y caen riquezas.\n💰 +${fmt(n)} monedas`; }
      else if (r < 0.7) { const n = rand(80, 300); user.coins += n; text = `🌙 Bajo la luna, el ritual te concede monedas.\n💰 +${fmt(n)} monedas`; }
      else { const n = lose(user, rand(50, 200)); text = `💀 El ritual salio mal y una maldicion te quita *${fmt(n)}* monedas.`; }
      store.save();
      await reply(`${text}\n🪙 Cartera: *${fmt(user.coins)}*`);
    },
  },
  {
    name: 'robar', aliases: ['steal', 'rob'], cat: RPG, desc: 'Roba monedas a un inactivo (!robar @user)',
    async run({ m, user, args, store, reply, prefix, sock, jid }) {
      const t = getTargets(m, args)[0];
      if (!t) return reply(`Uso: ${prefix}robar @usuario`);
      const victim = store.findByNum(num(t));
      if (!victim) return reply('❌ Ese usuario no esta registrado.');
      if (victim.id === user.id) return reply('❌ No puedes robarte a ti mismo.');
      if (Date.now() - (victim.lastSeen || 0) < 3600000) return reply('🛡️ Solo puedes robar a usuarios que lleven *1 hora inactivos*.');
      if (victim.coins < 50) return reply('😅 Esa persona casi no tiene monedas en la cartera.');
      const left = takeCooldown(user, 'robar', 30 * 60000);
      if (left) return reply(`⏳ Debes esperar *${fmtTime(left)}* para robar otra vez.`);

      if (Math.random() < 0.65) {
        const n = Math.min(rand(30, 300), Math.floor(victim.coins * 0.3));
        victim.coins -= n; user.coins += n; store.save();
        await sock.sendMessage(jid, { text: `🥷 Le robaste *${fmt(n)}* monedas a @${num(victim.id)}.`, mentions: [victim.id] }, { quoted: m });
      } else {
        const fine = lose(user, rand(30, 120));
        victim.coins += fine; store.save();
        await sock.sendMessage(jid, { text: `🚨 @${num(victim.id)} te descubrio. Pagaste una multa de *${fmt(fine)}* monedas.`, mentions: [victim.id] }, { quoted: m });
      }
    },
  },

  /* ---------------- casino ---------------- */
  {
    name: 'slot', aliases: ['tragamonedas'], cat: CASINO, desc: 'Tragamonedas (!slot 100)',
    async run({ user, args, store, sock, jid, m, reply, prefix }) {
      const bet = amountOf(args[0], user.coins);
      if (!Number.isFinite(bet) || bet < 20) return reply(`Uso: ${prefix}slot 100  (minimo 20)`);
      if (bet > user.coins) return reply('❌ No tienes suficientes monedas en la cartera.');
      const left = takeCooldown(user, 'slot', 20000);
      if (left) return reply(`⏳ Espera ${fmtTime(left)} para jugar de nuevo.`);
      const S = ['🍒', '🍉', '🍋', '⭐', '7️⃣'];
      const spin = () => [pick(S), pick(S), pick(S)];
      const view = (r) => `🎰 *SLOTS*\n━━━━━━━━━━\n   ${r.join(' ┃ ')}\n━━━━━━━━━━`;
      const final = spin();
      let key;
      try {
        const sent = await sock.sendMessage(jid, { text: view(spin()) }, { quoted: m });
        key = sent && sent.key;
        for (let i = 0; i < 2 && key; i++) {
          await new Promise((r) => setTimeout(r, 700));
          await sock.sendMessage(jid, { text: view(spin()), edit: key });
        }
        if (key) await new Promise((r) => setTimeout(r, 700));
      } catch { key = null; }
      const same = new Set(final).size;
      let mult = 0, label = '💀 Perdiste';
      if (same === 1) { mult = final[0] === '7️⃣' ? 10 : 6; label = '🎉 ¡JACKPOT!'; }
      else if (same === 2) { mult = 1.2; label = '✅ Par'; }
      const profit = Math.round(bet * mult) - bet;
      user.coins += mult ? profit : -bet; store.save();
      const text = `${view(final)}\n${label} ${mult ? `· ganaste *${fmt(Math.round(bet * mult))}*` : `· perdiste *${fmt(bet)}*`}\n🪙 Cartera: *${fmt(user.coins)}*`;
      if (key) await sock.sendMessage(jid, { text, edit: key }).catch(() => reply(text));
      else await reply(text);
    },
  },
  {
    name: 'ruleta', aliases: ['rt', 'roulette'], cat: CASINO, desc: 'Ruleta (!ruleta 100 rojo|negro|verde)',
    async run({ user, args, store, reply, prefix }) {
      const bet = amountOf(args[0], user.coins);
      const col = { rojo: 'rojo', red: 'rojo', negro: 'negro', black: 'negro', verde: 'verde', green: 'verde' }[norm(args[1] || '')];
      if (!Number.isFinite(bet) || bet < 20 || !col) return reply(`Uso: ${prefix}ruleta 100 rojo|negro|verde  (minimo 20)\n_Rojo y negro pagan x2, verde paga x14._`);
      if (bet > user.coins) return reply('❌ No tienes suficientes monedas en la cartera.');
      const left = takeCooldown(user, 'ruleta', 30000);
      if (left) return reply(`⏳ Espera ${fmtTime(left)} para apostar de nuevo.`);
      const n = rand(0, 36);
      const result = n === 0 ? 'verde' : n % 2 ? 'rojo' : 'negro';
      const icon = { rojo: '🔴', negro: '⚫', verde: '🟢' }[result];
      const win = result === col;
      const gain = win ? bet * (col === 'verde' ? 14 : 2) - bet : -bet;
      user.coins += gain; store.save();
      await reply(`🎡 *RULETA*\nSalio: ${icon} *${n} ${result}*\n${win ? `🎉 ¡Ganaste *${fmt(gain)}* monedas!` : `💀 Perdiste *${fmt(bet)}* monedas.`}\n🪙 Cartera: *${fmt(user.coins)}*`);
    },
  },
  {
    name: 'cf', aliases: ['flip', 'coinflip'], cat: CASINO, desc: 'Cara o sello apostando (!cf 100 cara)',
    async run({ user, args, store, reply, prefix }) {
      const bet = amountOf(args[0], user.coins);
      const side = { cara: 'cara', heads: 'cara', sello: 'sello', cruz: 'sello', tails: 'sello' }[norm(args[1] || '')];
      if (!Number.isFinite(bet) || bet < 20 || !side) return reply(`Uso: ${prefix}cf 100 cara|sello  (minimo 20)`);
      if (bet > user.coins) return reply('❌ No tienes suficientes monedas en la cartera.');
      const left = takeCooldown(user, 'cf', 15000);
      if (left) return reply(`⏳ Espera ${fmtTime(left)} para jugar de nuevo.`);
      const res = pick(['cara', 'sello']);
      const win = res === side;
      user.coins += win ? bet : -bet; store.save();
      await reply(`🪙 Salio *${res}*.\n${win ? `🎉 Ganaste *${fmt(bet)}* monedas.` : `💀 Perdiste *${fmt(bet)}* monedas.`}\n🪙 Cartera: *${fmt(user.coins)}*`);
    },
  },
];
