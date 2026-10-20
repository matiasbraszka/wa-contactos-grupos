import ExcelJS from 'exceljs';
import { paisDeTelefono } from './paises.mjs';

export { paisDeTelefono };

// "5491100000000:12@s.whatsapp.net" -> "+5491100000000". Un lid (…@lid) NO es un teléfono: devuelve ''.
export function telefonoDeJid(jid) {
  const m = /^(\d{6,15})(?::\d+)?@s\.whatsapp\.net$/.exec(jid || '');
  return m ? `+${m[1]}` : '';
}

// Saca el sufijo de dispositivo para poder comparar ids ("123:4@lid" -> "123@lid").
export function idLimpio(jid) {
  return (jid || '').replace(/:\d+@/, '@');
}

// Nombre prolijo: sin espacios dobles ni saltos de línea.
const prolijo = (nombre) => (nombre || '').replace(/\s+/g, ' ').trim();

const alfabetico = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
// Para ordenar se ignoran los emojis y símbolos del principio ("🔥 Ana" va con las A).
const claveDeNombre = (nombre) => prolijo(nombre).replace(/^[^\p{L}\p{N}]+/u, '');
// Lo vacío va siempre al final, no al principio.
const vacioAlFinal = (a, b) => (a ? 0 : 1) - (b ? 0 : 1);

// Orden de las personas en todas las hojas: país, después nombre, después teléfono.
function porPaisYNombre(a, b) {
  return (
    vacioAlFinal(a.telefono, b.telefono) ||
    alfabetico.compare(a.pais, b.pais) ||
    vacioAlFinal(claveDeNombre(a.nombre), claveDeNombre(b.nombre)) ||
    alfabetico.compare(claveDeNombre(a.nombre), claveDeNombre(b.nombre)) ||
    alfabetico.compare(a.telefono, b.telefono) ||
    alfabetico.compare(a.usuario || '', b.usuario || '')
  );
}

/**
 * grupos: [{ id, nombre, tipo, miembros: [{ telefono, nombre, usuario, admin }] }]
 * salieron: [{ grupoId, grupo, nombre, telefono, motivo, fecha }] — quienes ya no están en el grupo
 * contactos: [{ nombre, telefono, agendado, conChat }] — agenda y chats privados del número
 * opciones: { grupos, salieron, contactos } — qué hojas dejar; lo no elegido no se escribe.
 *           completo: true si se pidió el historial completo (cambia el título de la columna de chats)
 * Devuelve el resumen que se muestra en pantalla.
 */
export async function escribirExcel(ruta, grupos, salieron = [], contactos = [], opciones = {}) {
  const libro = new ExcelJS.Workbook();

  const porGrupo = libro.addWorksheet('Por grupo');
  porGrupo.columns = [
    { header: 'Grupo', key: 'grupo', width: 40 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 20 },
    { header: 'País', key: 'pais', width: 20 },
    { header: 'Admin', key: 'admin', width: 8 },
    { header: 'Usuario', key: 'usuario', width: 20 },
  ];

  const resumen = libro.addWorksheet('Grupos');
  resumen.columns = [
    { header: 'Grupo', key: 'grupo', width: 40 },
    { header: 'Tipo', key: 'tipo', width: 22 },
    { header: 'Miembros', key: 'miembros', width: 12 },
    { header: 'Con teléfono', key: 'conTelefono', width: 14 },
    { header: 'Se fueron', key: 'seFueron', width: 12 },
  ];

  // Salidas por grupo. Se cuenta por id y no por nombre: hay grupos distintos que se llaman igual.
  const salidasDe = new Map();
  for (const s of salieron) {
    const clave = s.grupoId || s.grupo;
    salidasDe.set(clave, (salidasDe.get(clave) || 0) + 1);
  }

  const unicos = new Map();
  const conUsuario = new Map(); // quien usa username no muestra el teléfono: van en hoja aparte
  let filas = 0;
  let sinTelefono = 0;

  for (const g of [...grupos].sort((a, b) => alfabetico.compare(claveDeNombre(a.nombre), claveDeNombre(b.nombre)))) {
    let conTelefono = 0;
    const miembros = g.miembros
      .map((m) => ({ ...m, nombre: prolijo(m.nombre), pais: paisDeTelefono(m.telefono) }))
      .sort(porPaisYNombre);
    for (const m of miembros) {
      porGrupo.addRow({
        grupo: g.nombre,
        nombre: m.nombre,
        telefono: m.telefono,
        pais: m.pais,
        admin: m.admin ? 'Sí' : '',
        usuario: m.usuario,
      });
      filas++;
      if (!m.telefono) {
        sinTelefono++;
        if (m.usuario) {
          const u = conUsuario.get(m.usuario) || { nombre: '', grupos: [] };
          u.nombre ||= m.nombre;
          u.grupos.push(g.nombre);
          conUsuario.set(m.usuario, u);
        }
        continue;
      }
      conTelefono++;
      const u = unicos.get(m.telefono) || { telefono: m.telefono, pais: m.pais, nombre: '', usuario: '', grupos: [] };
      u.nombre ||= m.nombre;
      u.usuario ||= m.usuario;
      u.grupos.push(g.nombre);
      unicos.set(m.telefono, u);
    }
    resumen.addRow({
      grupo: g.nombre,
      tipo: g.tipo || '',
      miembros: g.miembros.length,
      conTelefono,
      // seFueron ya calculado solo viene al rearmar un Excel viejo, que no guarda el id del grupo
      seFueron: g.seFueron ?? (salidasDe.get(g.id || g.nombre) || 0),
    });
  }

  const hojaUnicos = libro.addWorksheet('Únicos');
  hojaUnicos.columns = [
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 20 },
    { header: 'País', key: 'pais', width: 20 },
    { header: 'En cuántos grupos', key: 'cantidad', width: 18 },
    { header: 'Usuario', key: 'usuario', width: 20 },
    { header: 'Grupos', key: 'grupos', width: 80 },
  ];
  for (const u of [...unicos.values()].sort(porPaisYNombre)) {
    hojaUnicos.addRow({ ...u, cantidad: u.grupos.length, grupos: u.grupos.join(', ') });
  }

  const hojaUsuarios = libro.addWorksheet('Con username');
  hojaUsuarios.columns = [
    { header: 'Usuario', key: 'usuario', width: 30 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'En cuántos grupos', key: 'cantidad', width: 18 },
    { header: 'Grupos', key: 'grupos', width: 80 },
  ];
  for (const [usuario, u] of [...conUsuario].sort((a, b) => alfabetico.compare(a[0], b[0]))) {
    hojaUsuarios.addRow({ usuario, nombre: u.nombre, cantidad: u.grupos.length, grupos: u.grupos.join(', ') });
  }

  const hojaSalieron = libro.addWorksheet('Se fueron');
  hojaSalieron.columns = [
    { header: 'Grupo', key: 'grupo', width: 40 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 20 },
    { header: 'País', key: 'pais', width: 20 },
    { header: 'Qué pasó', key: 'motivo', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  ];
  // por grupo y, dentro de cada grupo, de la salida más reciente a la más vieja
  const salidasOrdenadas = salieron
    .map((s) => ({ ...s, nombre: prolijo(s.nombre), pais: paisDeTelefono(s.telefono) }))
    .sort(
      (a, b) =>
        alfabetico.compare(claveDeNombre(a.grupo), claveDeNombre(b.grupo)) ||
        (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0) ||
        porPaisYNombre(a, b),
    );
  for (const s of salidasOrdenadas) hojaSalieron.addRow(s);

  const hojaContactos = libro.addWorksheet('Mis contactos');
  hojaContactos.columns = [
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 20 },
    { header: 'País', key: 'pais', width: 20 },
    { header: 'Agendado', key: 'agendado', width: 10 },
    // la versión rápida solo recibe los chats recientes: que no diga "Sí" no significa que no haya chat
    { header: opciones.completo ? 'Chat privado' : 'Chat privado reciente', key: 'conChat', width: 22 },
    { header: 'Grupo en común', key: 'enGrupo', width: 16 },
    { header: 'En cuántos grupos', key: 'cantidad', width: 18 },
    { header: 'Grupos en común', key: 'grupos', width: 80 },
  ];
  const contactosOrdenados = contactos
    .map((c) => ({ ...c, nombre: prolijo(c.nombre), pais: paisDeTelefono(c.telefono) }))
    .sort(porPaisYNombre);
  for (const c of contactosOrdenados) {
    // grupos de este WhatsApp donde esa persona está hoy
    const enComun = unicos.get(c.telefono)?.grupos || [];
    hojaContactos.addRow({
      nombre: c.nombre,
      telefono: c.telefono,
      pais: c.pais,
      agendado: c.agendado ? 'Sí' : '',
      conChat: c.conChat ? 'Sí' : '',
      enGrupo: enComun.length ? 'Sí' : '',
      cantidad: enComun.length,
      grupos: enComun.join(', '),
    });
  }

  // Última columna de las hojas de personas: enlace para abrir el chat de WhatsApp con un clic.
  for (const hoja of [hojaUnicos, hojaSalieron, hojaContactos]) {
    const colTelefono = hoja.columns.findIndex((c) => c.key === 'telefono') + 1;
    const colEnlace = hoja.columns.length + 1;
    hoja.getColumn(colEnlace).width = 12;
    hoja.getRow(1).getCell(colEnlace).value = 'WhatsApp';
    hoja.eachRow((fila, i) => {
      const digitos = String(fila.getCell(colTelefono).value || '').replace(/\D/g, '');
      if (i === 1 || !digitos) return;
      fila.getCell(colEnlace).value = { text: 'Escribir', hyperlink: `https://wa.me/${digitos}` };
      fila.getCell(colEnlace).font = { color: { argb: 'FF0563C1' }, underline: true };
    });
  }

  for (const hoja of [porGrupo, resumen, hojaUnicos, hojaUsuarios, hojaSalieron, hojaContactos]) {
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    // flechitas en los títulos, para filtrar por país o reordenar desde Excel
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
  }

  // Lo que no se eligió se saca al final (y no antes) porque las hojas se cruzan entre sí.
  const quitar = [];
  if (opciones.grupos === false) quitar.push(porGrupo, resumen, hojaUnicos, hojaUsuarios);
  if (opciones.salieron === false) quitar.push(hojaSalieron);
  if (opciones.contactos === false) quitar.push(hojaContactos);
  // un Excel sin ninguna hoja no abre: si se destildó todo, se deja todo
  if (quitar.length < 6) for (const hoja of quitar) libro.removeWorksheet(hoja.id);

  await libro.xlsx.writeFile(ruta);
  return {
    grupos: grupos.length,
    filas,
    unicos: unicos.size,
    sinTelefono,
    conUsuario: conUsuario.size,
    salieron: salieron.length,
    salieronConTelefono: salieron.filter((s) => s.telefono).length,
    contactos: contactos.length,
    contactosConTelefono: contactos.filter((c) => c.telefono).length,
  };
}
