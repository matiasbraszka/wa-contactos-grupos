// Extrae a un Excel los miembros de todos los grupos de WhatsApp del número que se vincule por QR.
// Corre entero en esta PC: no sube nada a ningún servidor, no guarda mensajes y no envía nada.
// Al terminar cierra la sesión (el dispositivo desaparece de "Dispositivos vinculados").
import http from 'node:http';
import path from 'node:path';
import { rm, writeFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from 'baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { escribirExcel, telefonoDeJid, idLimpio } from './excel.mjs';
import { salidas, anotarParticipantesAnteriores, anotarAvisosDeSalida } from './salidas.mjs';

const CARPETA = path.dirname(fileURLToPath(import.meta.url));
const SESION = path.join(CARPETA, 'sesion');
const PUERTO = 3210;
// Ya conectado, WhatsApp manda la agenda (de ahí salen los nombres) en tandas y la librería las
// retiene hasta 30 s antes de entregarlas. Se espera a que dejen de llegar, con un piso y un tope.
// Con "historial completo" se le pide a WhatsApp todo el historial en vez del reciente: trae los
// chats viejos, salidas más antiguas y más teléfonos y nombres. Tarda bastante más y baja más datos
// a la PC (se descartan igual, no se guardan).
const esperas = () =>
  opciones.completo
    ? { minima: 180_000, maxima: 20 * 60_000, silencio: 90_000 }
    : { minima: 45_000, maxima: 180_000, silencio: 20_000 };

// Lo que se elige con las casillas de la página. Las tres primeras (qué va al Excel) se pueden
// cambiar hasta que termine; "completo" solo antes de escanear, porque se le avisa a WhatsApp al
// vincular. MAS_NOMBRES=1 (extraer-con-mas-nombres.bat) lo deja tildado de entrada.
const opciones = { grupos: true, salieron: true, contactos: true, completo: process.env.MAS_NOMBRES === '1' };
// vinculado: ya se escaneó el QR, "completo" no se puede cambiar más
const estado = { fase: 'iniciando', qr: '', mensaje: 'Conectando con WhatsApp…', opciones, vinculado: false };
let conexion = 0; // número de la conexión vigente; lo que avise una anterior se ignora
let socketActual = null;
const nombres = new Map(); // id (lid o teléfono) -> nombre
const lidATelefono = new Map(); // lid -> jid con teléfono
const agenda = new Map(); // id -> { lid, phoneNumber }: los contactos guardados en el teléfono
const chats = new Set(); // ids de personas con las que hay un chat privado
let terminado = false;
let ultimaTanda = 0; // cuándo llegó el último dato de agenda
let cierresSeguidos = 0; // cortes de conexión sin haber llegado a mostrar un QR
const arranque = Date.now();
// Si nadie escanea en este tiempo, el programa deja de pedir códigos.
const ESPERA_QR_MAXIMA_MS = 15 * 60_000;

function tipoDeGrupo(g) {
  if (g.isCommunityAnnounce) return 'Avisos de comunidad';
  if (g.isCommunity) return 'Comunidad';
  if (g.linkedParent) return 'Grupo de comunidad';
  return 'Grupo';
}

async function esperarAgenda() {
  const inicio = Date.now();
  const { minima, maxima, silencio } = esperas();
  ultimaTanda = inicio;
  let juntado = 0;
  for (;;) {
    // "Sigue llegando" = se juntó algo nuevo. No alcanza con que lleguen eventos: en una cuenta
    // con muchos grupos entran mensajes todo el tiempo y la espera no terminaría nunca.
    const ahora = nombres.size + salidas.size + lidATelefono.size + agenda.size + chats.size;
    if (ahora !== juntado) {
      juntado = ahora;
      ultimaTanda = Date.now();
    }
    const pasado = Date.now() - inicio;
    const quieto = Date.now() - ultimaTanda;
    if (pasado >= maxima || (pasado >= minima && quieto >= silencio)) return;
    avisar('leyendo', `Conectado. Leyendo agenda e historial… (${agenda.size} de agenda, ${chats.size} chats, ${nombres.size} nombres, ${salidas.size} salidas de grupos, ${Math.round(pasado / 1000)} s). No cierres nada.`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

function avisar(fase, mensaje, qr = '') {
  Object.assign(estado, { fase, mensaje, qr });
  console.log(`[${fase}] ${mensaje}`);
}

function anotarContactos(contactos = []) {
  for (const c of contactos) {
    // WhatsApp a veces manda como "nombre" el teléfono enmascarado (+34∙∙∙∙∙∙∙12): eso no es un nombre.
    const nombre = [c.name, c.notify, c.verifiedName].find((n) => n && /\p{L}/u.test(n));
    for (const id of [c.id, c.lid, c.phoneNumber]) {
      if (id && nombre && !nombres.has(idLimpio(id))) nombres.set(idLimpio(id), nombre);
    }
    const lid = [c.id, c.lid].find((x) => x?.endsWith('@lid'));
    const pn = [c.id, c.phoneNumber].find((x) => telefonoDeJid(x));
    if (lid && pn) lidATelefono.set(idLimpio(lid), pn);
  }
}

const esPersona = (id) => /@(s\.whatsapp\.net|lid)$/.test(id || '');

// La agenda llega aparte del historial: son los contactos guardados, se haya hablado con ellos o no.
function anotarAgenda(contactos = []) {
  anotarContactos(contactos);
  for (const c of contactos) {
    if (esPersona(c.id)) agenda.set(idLimpio(c.id), { lid: c.lid, phoneNumber: c.phoneNumber });
  }
}

function anotarChats(lista = []) {
  for (const ch of lista || []) {
    if (esPersona(ch.id)) chats.add(idLimpio(ch.id));
  }
}

function anotarMapeos(mapeos = []) {
  for (const m of mapeos) {
    if (m?.lid && m?.pn) lidATelefono.set(idLimpio(m.lid), m.pn);
  }
}

async function extraer(sock) {
  await esperarAgenda();
  avisar('leyendo', 'Leyendo tus grupos…');

  const todos = Object.values(await sock.groupFetchAllParticipating());
  const yo = telefonoDeJid(idLimpio(sock.user?.id));
  const grupos = [];
  const nombreDeGrupo = new Map(); // jid del grupo -> nombre
  const actuales = new Map(); // jid del grupo -> ids y teléfonos de quienes están hoy
  // El nombre puede estar guardado bajo el lid y el grupo dar solo el teléfono: cruce al revés.
  const telefonoALid = new Map();
  for (const [lid, pn] of lidATelefono) telefonoALid.set(telefonoDeJid(idLimpio(pn)), lid);
  const hallado = { directo: 0, porTelefono: 0, porLid: 0, sinNombre: 0 }; // para el diagnóstico

  // Teléfono y nombre de una persona a partir de su id (lid o teléfono) y lo que haya traído el grupo.
  async function datosDe(idCrudo, p = {}) {
    const id = idLimpio(idCrudo);
    let telefono = telefonoDeJid(id) || telefonoDeJid(p.phoneNumber) || telefonoDeJid(lidATelefono.get(id));
    if (!telefono && id.endsWith('@lid')) {
      const pn = await sock.signalRepository?.lidMapping?.getPNForLID(id).catch(() => null);
      telefono = telefonoDeJid(idLimpio(pn));
    }
    const directo = nombres.get(id);
    // el teléfono pudo salir del cruce lid↔teléfono, y el nombre estar guardado bajo ese teléfono
    const porTelefono = nombres.get(idLimpio(p.phoneNumber)) || (telefono && nombres.get(`${telefono.slice(1)}@s.whatsapp.net`));
    const porLid = nombres.get(idLimpio(p.lid)) || (telefono && nombres.get(telefonoALid.get(telefono)));
    const nombre = directo || porTelefono || porLid || '';
    hallado[directo ? 'directo' : porTelefono ? 'porTelefono' : porLid ? 'porLid' : 'sinNombre']++;
    return { id, telefono, nombre };
  }

  for (const g of todos) {
    const miembros = [];
    const presentes = new Set();
    for (const p of g.participants) {
      const { id, telefono, nombre } = await datosDe(p.id, p);
      presentes.add(id);
      if (telefono) presentes.add(telefono);
      if (telefono && telefono === yo) continue;
      miembros.push({ telefono, nombre, usuario: p.username || '', admin: Boolean(p.admin) });
    }
    nombreDeGrupo.set(g.id, g.subject || g.id);
    actuales.set(g.id, presentes);
    grupos.push({ id: g.id, nombre: g.subject || g.id, tipo: tipoDeGrupo(g), miembros });
  }

  // Quienes se fueron (o fueron sacados) y hoy no están en ese grupo.
  const salieron = [];
  for (const s of salidas.values()) {
    const { id, telefono, nombre } = await datosDe(s.usuario);
    const presentes = actuales.get(s.grupoJid);
    if (presentes?.has(id) || (telefono && presentes?.has(telefono))) continue; // volvió a entrar
    if (telefono && telefono === yo) continue;
    salieron.push({
      grupoId: s.grupoJid,
      // si el grupo no está en la lista es porque este WhatsApp ya no participa de él
      grupo: nombreDeGrupo.get(s.grupoJid) || `(grupo del que ya no sos parte) ${s.grupoJid}`,
      telefono,
      nombre,
      motivo: s.motivo,
      fecha: s.fecha ? new Date(s.fecha * 1000) : null,
    });
  }

  // Contactos propios: los de la agenda (aunque nunca se haya hablado) + los de chats privados.
  // Una misma persona puede venir por su teléfono en la agenda y por su lid en el chat: se une.
  const propios = new Map();
  const sumarPropio = async (id, p, marca) => {
    const { telefono, nombre } = await datosDe(id, p);
    if (telefono && telefono === yo) return;
    const clave = telefono || idLimpio(id);
    const c = propios.get(clave) || { telefono, nombre: '', agendado: false, conChat: false };
    c.nombre ||= nombre;
    c[marca] = true;
    propios.set(clave, c);
  };
  for (const [id, p] of agenda) await sumarPropio(id, p, 'agendado');
  for (const id of chats) await sumarPropio(id, {}, 'conChat');
  // sin teléfono ni nombre no hay nada que usar
  const contactos = [...propios.values()].filter((c) => c.telefono || c.nombre);

  // Con hora, para no pisar un Excel anterior (ni chocar con uno que esté abierto).
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  const archivo = `contactos-grupos-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}h${dos(d.getMinutes())}.xlsx`;
  const r = await escribirExcel(path.join(CARPETA, archivo), grupos, salieron, contactos, opciones);

  // Solo cantidades (ningún dato de personas), para entender por qué un nombre no se encontró.
  const claves = [...nombres.keys()];
  await writeFile(
    path.join(CARPETA, archivo.replace('.xlsx', '-diagnostico.txt')),
    [
      `modo: ${opciones.completo ? 'historial completo' : 'rápido'}`,
      `nombres juntados: ${nombres.size} (bajo lid: ${claves.filter((k) => k.endsWith('@lid')).length}, bajo teléfono: ${claves.filter((k) => k.endsWith('@s.whatsapp.net')).length}, otros: ${claves.filter((k) => !k.endsWith('@lid') && !k.endsWith('@s.whatsapp.net')).length})`,
      `pares lid↔teléfono: ${lidATelefono.size}`,
      `salidas anotadas: ${salidas.size}`,
      `agenda: ${agenda.size} | chats privados: ${chats.size} | elegido: ${JSON.stringify(opciones)}`,
      `búsquedas de nombre (miembros + salidos + contactos propios): ${JSON.stringify(hallado)}`,
      `resultado: ${JSON.stringify(r)}`,
    ].join('\n'),
  ).catch(() => {});

  terminado = true;
  await sock.logout().catch(() => {});
  await rm(SESION, { recursive: true, force: true });

  avisar(
    'listo',
    `Listo: ${r.grupos} grupos, ${r.unicos} contactos únicos con teléfono (${r.sinTelefono} miembros sin teléfono visible). ` +
      `Se fueron: ${r.salieron} (${r.salieronConTelefono} con teléfono). ` +
      `Mis contactos: ${r.contactos} (${r.contactosConTelefono} con teléfono). Archivo: ${archivo}. La sesión ya se cerró.`,
  );
  if (!process.env.SIN_NAVEGADOR) exec(`start "" "${path.join(CARPETA, archivo)}"`);
  // Deja la página unos segundos más para que alcance a mostrar el resultado.
  setTimeout(() => process.exit(0), 15_000);
}

async function conectar() {
  const esta = ++conexion;
  // Nunca dos conexiones a la vez: se cierra la anterior (si ya estaba cerrada no pasa nada).
  try {
    socketActual?.end(undefined);
  } catch {}
  const { state, saveCreds } = await useMultiFileAuthState(SESION);
  if (esta !== conexion) return; // mientras se leía la sesión se pidió otra conexión
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    // Presentarse como app de escritorio ("Desktop") hace que WhatsApp corte la conexión (428) antes
    // del QR, así que el historial completo se pide con el mismo perfil de navegador.
    browser: Browsers.windows('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: opciones.completo,
    ...(opciones.completo ? { shouldSyncHistoryMessage: () => true } : {}),
  });
  socketActual = sock;

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('contacts.upsert', anotarAgenda);
  sock.ev.on('contacts.update', anotarContactos);
  sock.ev.on('chats.upsert', anotarChats);
  sock.ev.on('lid-mapping.update', (m) => anotarMapeos([m]));
  // Del historial solo se usan la agenda, los pares lid↔teléfono y quiénes salieron de cada grupo;
  // el contenido de los mensajes se descarta.
  sock.ev.on('messaging-history.set', ({ contacts, chats: listaDeChats, lidPnMappings, messages, pastParticipants }) => {
    anotarContactos(contacts);
    anotarChats(listaDeChats);
    anotarMapeos(lidPnMappings);
    anotarParticipantesAnteriores(pastParticipants);
    anotarAvisosDeSalida(messages, lidATelefono);
    // De cada mensaje solo se mira quién lo mandó y con qué nombre; el contenido no se toca.
    anotarContactos(
      (messages || [])
        .filter((m) => m.pushName && !m.key?.fromMe)
        .map((m) => ({ id: m.key.participant || m.key.remoteJid, phoneNumber: m.key.participantAlt || m.key.remoteJidAlt, notify: m.pushName })),
    );
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr, isNewLogin }) => {
    if (esta !== conexion) return; // conexión descartada (por ejemplo, al cambiar la casilla de historial)
    if (isNewLogin || connection === 'open') estado.vinculado = true;
    if (qr) {
      cierresSeguidos = 0;
      avisar('qr', 'Escaneá el código desde WhatsApp → Dispositivos vinculados → Vincular un dispositivo.', await QRCode.toDataURL(qr, { width: 320, margin: 2 }));
    }
    if (connection === 'open') {
      extraer(sock).catch((e) => {
        terminado = true;
        avisar('error', `No se pudo leer los grupos: ${e.message}`);
      });
    }
    if (connection === 'close' && !terminado) {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      console.log(`[conexión cerrada] código ${codigo ?? '?'}: ${lastDisconnect?.error?.message ?? 'sin detalle'}`);
      // Nunca dejar en pantalla un QR que ya no sirve.
      if (estado.fase === 'qr') avisar('iniciando', 'Renovando el código…');
      if (Date.now() - arranque > ESPERA_QR_MAXIMA_MS && estado.fase !== 'leyendo') {
        terminado = true;
        avisar('error', 'Pasó mucho tiempo sin escanear el código. Cerrá esta ventana y volvé a abrir extraer.bat.');
        return;
      }
      // Sesión inválida o rechazada: se borra para volver a pedir el QR desde cero.
      if (codigo === DisconnectReason.loggedOut) await rm(SESION, { recursive: true, force: true });
      // El resto (incluido el reinicio obligado justo después de escanear) se resuelve reconectando.
      // Si falla seguido se espera cada vez más, para no insistirle a WhatsApp.
      const espera = Math.min(1500 * 2 ** cierresSeguidos, 30_000);
      cierresSeguidos++;
      setTimeout(() => conectar().catch(fallar), espera);
    }
  });
}

function fallar(e) {
  avisar('error', `No se pudo conectar con WhatsApp: ${e.message}`);
}

// Cambiar "historial completo" obliga a pedir un QR nuevo: el dato viaja en el pedido de vinculación.
function reconectarConOtroModo() {
  avisar('iniciando', 'Preparando un código nuevo…');
  conectar().catch(fallar);
}

const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contactos de grupos</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f4f5;color:#18181b}
main{background:#fff;padding:32px;border-radius:16px;max-width:420px;text-align:center;box-shadow:0 2px 12px #0001}
img{width:320px;height:320px}p{line-height:1.5}
fieldset{border:1px solid #e4e4e7;border-radius:12px;text-align:left;margin:0 0 16px;padding:12px 16px}
legend{font-size:14px;color:#52525b;padding:0 6px}label{display:block;padding:4px 0;cursor:pointer}
small{color:#71717a}</style></head><body><main>
<h2>Contactos de WhatsApp</h2>
<fieldset id="ops"><legend>Qué querés en el Excel</legend>
<label><input type="checkbox" name="grupos"> Miembros de mis grupos</label>
<label><input type="checkbox" name="salieron"> Los que se fueron de los grupos</label>
<label><input type="checkbox" name="contactos"> Mis contactos <small>(agenda y chats privados)</small></label>
</fieldset>
<fieldset id="modo"><legend>Cómo leer</legend>
<label><input type="checkbox" name="completo"> Historial completo <small>(más lento, hasta 20 minutos)</small></label>
<small>Suma los chats privados viejos, salidas de grupos más antiguas y más teléfonos y nombres.
Sin tildar tarda 1 a 3 minutos y trae igual toda la agenda y todos los miembros de los grupos.
Elegilo antes de escanear: al cambiarlo aparece un código nuevo.</small>
</fieldset>
<div id="qr"></div><p id="msg">Cargando…</p></main>
<script>
const casillas=[...document.querySelectorAll('#ops input')];
const completo=document.querySelector('#modo input');
let tocado=false;
const enviar=()=>fetch('/opciones',{method:'POST',body:JSON.stringify(Object.fromEntries([...casillas,completo].map(x=>[x.name,x.checked])))});
casillas.forEach(c=>c.addEventListener('change',()=>{tocado=true;enviar()}));
let cambioModo=0;
completo.addEventListener('change',()=>{cambioModo=Date.now();enviar()});
async function tick(){
  try{
    const e=await (await fetch('/estado')).json();
    document.getElementById('msg').textContent=e.mensaje;
    document.getElementById('qr').innerHTML=e.fase==='qr'?'<img src="'+e.qr+'" alt="Código QR">':'';
    if(!tocado)casillas.forEach(c=>c.checked=e.opciones[c.name]);
    const cerrado=e.fase==='listo'||e.fase==='error';
    casillas.forEach(c=>c.disabled=cerrado);
    // el modo muestra siempre lo que el programa está usando de verdad
    if(Date.now()-cambioModo>3000)completo.checked=e.opciones.completo;
    completo.disabled=cerrado||e.vinculado;
  }catch{document.getElementById('msg').textContent='El programa se cerró. Ya podés cerrar esta pestaña.';return}
  setTimeout(tick,2000);
}
tick();
</script></body></html>`;

http
  .createServer((req, res) => {
    if (req.url === '/estado') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(estado));
      return;
    }
    if (req.url === '/opciones' && req.method === 'POST') {
      let cuerpo = '';
      req.on('data', (d) => (cuerpo += d));
      req.on('end', () => {
        try {
          const pedido = JSON.parse(cuerpo);
          for (const k of ['grupos', 'salieron', 'contactos']) if (typeof pedido[k] === 'boolean') opciones[k] = pedido[k];
          // "completo" solo se acepta antes de vincular, y cambiarlo pide un QR nuevo
          if (typeof pedido.completo === 'boolean' && pedido.completo !== opciones.completo && !estado.vinculado && !terminado) {
            opciones.completo = pedido.completo;
            reconectarConOtroModo();
          }
        } catch {}
        res.writeHead(204).end();
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGINA);
  })
  .listen(PUERTO, '127.0.0.1', () => {
    console.log(`Abrí http://localhost:${PUERTO} si el navegador no se abre solo.`);
    if (!process.env.SIN_NAVEGADOR) exec(`start "" "http://localhost:${PUERTO}"`);
  });

conectar().catch(fallar);
