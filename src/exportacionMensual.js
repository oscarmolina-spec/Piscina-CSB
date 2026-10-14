export function fechaExportacion(valor) {
  if (!valor) return '';
  let texto = valor;
  if (typeof valor?.toDate === 'function') texto = valor.toDate().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  else if (typeof valor?.seconds === 'number') texto = new Date(valor.seconds * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(texto)) return '';
  const dia = texto.slice(0, 10);
  const date = new Date(dia + 'T12:00:00Z');
  return !isNaN(date) && date.toISOString().slice(0, 10) === dia ? dia : '';
}
function importe(valor) {
  const texto = String(valor ?? '').replace('€', '').trim();
  return /^\d+(?:[.,]\d{1,2})?$/.test(texto) ? Number(texto.replace(',', '.')) : null;
}
export function prepararExportacion(alumnos, padres, catalogo, mes, completo = false) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Selecciona un mes válido.');
  const [year, month] = mes.split('-').map(Number);
  const inicioMes = mes + '-01';
  const finMes = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const cabecera = ['Alumno','Curso','Letra','Tipo','Actividad','Días','Horario','Fecha Alta','Precio','Pagador','DNI Pagador','Email Pagador','CP','Población','Dirección','IBAN','Telefono','Estado','Fecha Baja','Mes de referencia','Importe de referencia','Revisión'];
  const filas = [];
  let excluidos = 0, revisar = 0;
  for (const a of alumnos) {
    const alta = fechaExportacion(a.fechaAlta);
    const baja = fechaExportacion(a.fechaBaja);
    const retirada = a.motivoBaja === 'Retirada de solicitud sin inscripción confirmada';
    const activo = ['inscrito','baja_pendiente','baja_finalizada'].includes(a.estado) && !retirada;
    // fechaBaja es la primera fecha sin actividad (administración registra el día 1).
    if (!completo && (!activo || (alta && alta > finMes) || (baja && baja <= inicioMes))) { excluidos++; continue; }
    if (completo && !['inscrito','requiere_prueba','prueba_reservada','baja_pendiente','baja_finalizada'].includes(a.estado)) continue;
    const p = padres[a.parentId || a.user] || {};
    const actividad = catalogo.find(act => act.id === a.actividadId || act.nombre === a.actividad);
    const opcion = actividad?.opciones?.find(op => op.dias === a.dias && (!a.horario || op.horario === a.horario));
    const cuota = importe(a.precio) ?? importe(opcion?.precio);
    const avisos = [];
    if (!alta) avisos.push('Falta fecha de inicio válida: no se calcula importe');
    if (cuota === null) avisos.push('Falta cuota válida: no se calcula importe');
    if (a.fechaBaja && !baja) avisos.push('Fecha de baja inválida: revisar');
    if (a.estado === 'baja_finalizada' && !baja) avisos.push('Baja sin fecha efectiva: revisar');
    if (a.estado === 'baja_pendiente') avisos.push('Baja pendiente de tramitar');
    if (!activo) avisos.push('Solicitud sin inscripción confirmada');
    if (retirada) avisos.push('Solicitud retirada sin plaza confirmada');
    if (avisos.length) revisar++;
    const calculable = activo && alta && alta <= finMes && (!baja || baja > inicioMes) && cuota !== null && !(a.fechaBaja && !baja) && !(a.estado === 'baja_finalizada' && !baja);
    filas.push([a.nombre,a.curso,a.letra,p.tipo === 'externo' ? 'EXTERNO' : 'INTERNO',a.actividad,a.dias,a.horario,alta,cuota ?? '',p.nombrePagador,p.dniPagador,p.email,p.cp,p.poblacion,p.direccion,p.iban,p.telefono1,a.estado,baja,completo ? '' : mes,completo || !calculable ? '' : cuota,avisos.join(' · ')]);
  }
  // Cada registro se mantiene: dos días contratados no se deduplican.
  const celda = valor => {
    let texto = String(valor ?? '');
    if (typeof valor !== 'number' && /^[=+@-]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replaceAll('"','""') + '"';
  };
  return { csv: '\uFEFF' + [cabecera, ...filas].map(f => f.map(celda).join(',')).join('\r\n'), filas: filas.length, revisar, excluidos };
}
