// Diagnostico de botones: envia varias variantes para ver cual muestra tu WhatsApp. (Ocultos del menu)
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { sendButtons, quick, link, list } = require('../buttons');

const IMG = path.join(config.assetsDir, 'menu.jpg');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = [
  {
    name: 'testbotones', selfOk: true, aliases: ['testbtn'], cat: 'Owner', owner: true, hidden: true, desc: 'Prueba de botones',
    async run({ sock, m, jid, reply, prefix }) {
      const img = fs.existsSync(IMG) ? fs.readFileSync(IMG) : null;
      const rows = [
        { header: '', title: 'Opcion A', description: 'Primera opcion', id: `${prefix}btn lista-A` },
        { header: '', title: 'Opcion B', description: 'Segunda opcion', id: `${prefix}btn lista-B` },
      ];
      const tests = [
        { t: '1/6 respuestas rapidas (plain)', wrap: 'plain', b: [quick('Boton 1', `${prefix}btn rapido1`), quick('Boton 2', `${prefix}btn rapido2`)] },
        { t: '2/6 lista (plain)', wrap: 'plain', b: [list('Ver lista', [{ title: 'Lista', rows }])] },
        { t: '3/6 respuestas rapidas (viewonce)', wrap: 'viewonce', b: [quick('Boton 1', `${prefix}btn vo-rapido1`), quick('Boton 2', `${prefix}btn vo-rapido2`)] },
        { t: '4/6 lista (viewonce)', wrap: 'viewonce', b: [list('Ver lista', [{ title: 'Lista', rows }])] },
        { t: '5/6 mixto con imagen (plain)', wrap: 'plain', image: img, b: [list('Ver lista', [{ title: 'Lista', rows }]), quick('Boton 1', `${prefix}btn mixto1`)] },
        { t: '6/6 enlace', wrap: 'plain', b: [link('Abrir enlace', 'https://github.com')] },
      ];
      await reply('🧪 *PRUEBA DE BOTONES*\nTe enviare 6 mensajes. Dime cuales muestran botones y toca alguno: te respondere con lo que recibi.\n_Nota: los botones de respuesta rapida no funcionan en el chat contigo mismo._');
      for (const x of tests) {
        const ok = await sendButtons(sock, jid, { text: `Prueba ${x.t}`, footer: 'Xato Ds', image: x.image || null, buttons: x.b, quoted: m, wrap: x.wrap });
        if (!ok) await reply(`❌ La prueba ${x.t} no se pudo enviar (revisa los logs).`);
        await sleep(1200);
      }
    },
  },
  {
    name: 'btn', cat: 'Owner', noReg: true, hidden: true, desc: 'Respuesta de prueba de botones',
    async run({ args, reply }) { await reply(`✅ Recibi tu toque: *${args.join(' ') || '(vacio)'}*`); },
  },
];
