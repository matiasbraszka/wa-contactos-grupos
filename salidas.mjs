// Quiénes se fueron (o fueron sacados) de cada grupo, según lo que WhatsApp manda al vincular.
import { idLimpio, telefonoDeJid } from './excel.mjs';

// "grupo|persona" -> { grupoJid, usuario, motivo, fecha (en segundos) }
export const salidas = new Map();

// Los números largos del protocolo llegan como objeto, no como número.
const aNumero = (v) => (v && typeof v === 'object' ? (v.toNumber?.() ?? Number(v.low ?? 0)) : Number(v) || 0);

function anotarSalida(grupoJid, usuarioJid, motivo, fecha) {
  if (!grupoJid?.endsWith('@g.us') || !usuarioJid) return;
  const usuario = idLimpio(usuarioJid);
  const clave = `${grupoJid}|${usuario}`;
  const previa = salidas.get(clave);
  if (!previa || fecha > previa.fecha) salidas.set(clave, { grupoJid, usuario, motivo, fecha });
}

// WhatsApp guarda por un tiempo la lista de "participantes anteriores" de cada grupo.
export function anotarParticipantesAnteriores(lista) {
  for (const g of lista || []) {
    for (const p of g.pastParticipants || []) {
      const loSacaron = p.leaveReason === 1 || p.leaveReason === 'REMOVED';
      anotarSalida(g.groupJid, p.userJid, loSacaron ? 'Lo sacaron' : 'Salió', aNumero(p.leaveTs));
    }
  }
}

// Además, cada salida deja en el chat un aviso ("Fulano salió"): sirve para las más viejas,
// mientras ese aviso siga en el historial que WhatsApp sincroniza.
const AVISO_LO_SACARON = 28;
const AVISO_SALIO = 32;

export function anotarAvisosDeSalida(mensajes, lidATelefono) {
  for (const m of mensajes || []) {
    if (m.messageStubType !== AVISO_SALIO && m.messageStubType !== AVISO_LO_SACARON) continue;
    for (const parametro of m.messageStubParameters || []) {
      // según la versión, el parámetro es el id a secas o un objeto en texto con id y teléfono
      let persona = parametro;
      try {
        const o = JSON.parse(parametro);
        if (o && typeof o === 'object') {
          persona = o.id || o.phoneNumber || parametro;
          if (o.id?.endsWith('@lid') && telefonoDeJid(o.phoneNumber)) lidATelefono.set(idLimpio(o.id), o.phoneNumber);
        }
      } catch {}
      anotarSalida(m.key?.remoteJid, persona, m.messageStubType === AVISO_LO_SACARON ? 'Lo sacaron' : 'Salió', aNumero(m.messageTimestamp));
    }
  }
}
