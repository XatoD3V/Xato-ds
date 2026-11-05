// Arranca los 3 servidores (procesos independientes) y el panel/gateway.
const { fork } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const config = require('./config');
const { startGateway } = require('./gateway');

const INTERNAL_KEY = crypto.randomBytes(24).toString('hex');
const children = new Map();
let closing = false;

function launch(id) {
  const child = fork(path.join(__dirname, 'node-server.js'), [], {
    env: {
      ...process.env,
      SERVER_ID: String(id),
      SERVER_PORT: String(config.basePort + id - 1),
      INTERNAL_KEY,
    },
  });
  children.set(id, child);
  child.on('exit', (code) => {
    if (closing) return;
    console.log(`[core] Servidor ${id} se detuvo (${code}). Reiniciando en 3s...`);
    setTimeout(() => launch(id), 3000);
  });
}

console.log(`\n  ${config.brand}  |  bot: ${config.botName}\n`);
if (config.adminPassword === 'cambia-esta-clave') {
  console.log('[aviso] Usa ADMIN_PASSWORD en tu .env para cambiar la clave de administrador.\n');
}

const code = config.pairingCode;
console.log(`[core] Codigo de vinculacion: ${code.slice(0, 4)}-${code.slice(4)}`);
if (/[0IOU]/.test(code)) {
  console.log('[aviso] WhatsApp genera sus codigos sin las letras O, I, U ni el 0. Si tu telefono rechaza el codigo,');
  console.log('        cambia PAIRING_CODE en el .env por uno sin esos caracteres (ej: XATQD3VS).\n');
}

for (let i = 1; i <= config.servers; i++) launch(i);
startGateway(INTERNAL_KEY);

function shutdown() {
  closing = true;
  for (const c of children.values()) c.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
