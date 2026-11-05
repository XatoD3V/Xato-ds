// Mensajes con botones (nativeFlow): lista desplegable + botones de respuesta rapida.
// Se envian con los nodos binarios que usa WhatsApp (biz > interactive > native_flow; en privado, ademas bot).
// Respeta los limites de WhatsApp: cuerpo 1024 caracteres, titulo de boton 20, pie 60, lista 10 filas.
const baileys = require('./baileys');

const enabled = () => String(process.env.BUTTONS || 'on').toLowerCase() !== 'off';
const defaultWrap = () => (String(process.env.BUTTONS_WRAP || 'plain').toLowerCase() === 'viewonce' ? 'viewonce' : 'plain');
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const quick = (text, id) => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: trunc(text, 20), id }) });
const link = (text, url) => ({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: trunc(text, 20), url, merchant_url: url }) });
const list = (title, sections) => ({
  name: 'single_select',
  buttonParamsJson: JSON.stringify({
    title: trunc(title, 20),
    sections: sections.map((s) => ({ ...s, rows: s.rows.slice(0, 10).map((r) => ({ ...r, title: trunc(r.title, 24), description: trunc(r.description || '', 72) })) })),
  }),
});

// Devuelve true si se envio con botones, false si no se pudo (el menu usa entonces solo texto).
async function sendButtons(sock, jid, { text, footer = '', image = null, buttons = [], quoted = null, wrap = null }) {
  if (!enabled() || !buttons.length) return false;
  if (text.length > 1024) { console.error('[botones] el cuerpo supera 1024 caracteres; se envia como texto'); return false; }
  try {
    const B = await baileys.load();
    const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = B;
    if (!generateWAMessageFromContent || !proto) return false;
    const IM = proto.Message.InteractiveMessage;

    let header = IM.Header.create({ title: '', subtitle: '', hasMediaAttachment: false });
    if (image) {
      const media = await prepareWAMessageMedia({ image }, { upload: sock.waUploadToServer });
      header = IM.Header.create({ ...media, title: '', subtitle: '', hasMediaAttachment: true });
    }
    const interactiveMessage = IM.create({
      header,
      body: IM.Body.create({ text }),
      footer: IM.Footer.create({ text: trunc(footer, 60) }),
      nativeFlowMessage: IM.NativeFlowMessage.create({ buttons, messageParamsJson: '' }),
    });
    const content = (wrap || defaultWrap()) === 'viewonce'
      ? { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage } } }
      : { interactiveMessage };

    const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id, quoted: quoted || undefined });
    const nodes = [{
      tag: 'biz', attrs: {},
      content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }],
    }];
    if (!jid.endsWith('@g.us')) nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: nodes });
    return true;
  } catch (e) {
    console.error('[botones]', e.message);
    return false;
  }
}

// Extrae el comando elegido de una respuesta a botones/listas.
function responseText(c) {
  if (!c) return '';
  if (c.buttonsResponseMessage) return c.buttonsResponseMessage.selectedButtonId || '';
  if (c.templateButtonReplyMessage) return c.templateButtonReplyMessage.selectedId || '';
  if (c.listResponseMessage && c.listResponseMessage.singleSelectReply) return c.listResponseMessage.singleSelectReply.selectedRowId || '';
  const nf = c.interactiveResponseMessage && c.interactiveResponseMessage.nativeFlowResponseMessage;
  if (nf && nf.paramsJson) { try { return JSON.parse(nf.paramsJson).id || ''; } catch { return ''; } }
  return '';
}

module.exports = { sendButtons, quick, link, list, responseText, enabled };
