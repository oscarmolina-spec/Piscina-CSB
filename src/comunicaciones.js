export const claveGrupo = alumno => [alumno.actividadId || alumno.actividad || '', alumno.dias || '', alumno.horario || ''].join('|');

// Se usa únicamente el email de la cuenta de registro. Una cuenta con varios
// hijos seleccionados aparece una sola vez entre los destinatarios.
export function prepararDestinatarios(alumnos, usuarios, { alcance, ids = [], actividadId = '', grupo = '' }) {
  const inscritos = alumnos.filter(a => a.estado === 'inscrito');
  const elegidos = inscritos.filter(a => {
    if (alcance === 'todos') return true;
    if (alcance === 'personas') return ids.includes(a.id);
    if (alcance === 'actividad') return a.actividadId === actividadId;
    if (alcance === 'grupo') return claveGrupo(a) === grupo;
    return false;
  });
  const porCorreo = new Map();
  const sinCorreo = [];
  for (const alumno of elegidos) {
    const cuenta = usuarios[alumno.parentId || alumno.user];
    const email = String(cuenta?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sinCorreo.push(alumno.nombre || alumno.id);
      continue;
    }
    if (!porCorreo.has(email)) porCorreo.set(email, { email, alumnos: [] });
    porCorreo.get(email).alumnos.push(alumno.nombre || alumno.id);
  }
  return { destinatarios: [...porCorreo.values()].sort((a, b) => a.email.localeCompare(b.email)), sinCorreo, alumnosElegidos: elegidos.length };
}
