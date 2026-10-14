// Las inscripciones nunca se cancelan borrando sus datos: requieren revisión administrativa.
export function planificarBajaFamiliar(alumno, ahora = new Date()) {
  if (!['inscrito', 'prueba_reservada', 'requiere_prueba', 'lista_espera'].includes(alumno.estado)) {
    throw new Error('Esta solicitud ya no está activa. Recarga la ficha.');
  }
  const fecha = ahora.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const inicio = typeof alumno.fechaAlta === 'string' ? alumno.fechaAlta.split('T')[0]
    : alumno.fechaAlta?.toDate?.().toISOString().split('T')[0];
  const esInscripcion = alumno.estado === 'inscrito';
  const inicioFuturo = Boolean(inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio) && inicio > fecha);
  if (esInscripcion && !inicioFuturo && Number(fecha.slice(-2)) > 25) {
    throw new Error('PLAZO CERRADO. Contacta con coordinación para tramitar la baja después del día 25.');
  }
  const registro = {
    fecha: ahora.toISOString(), accion: esInscripcion ? 'SOLICITUD_BAJA_FAMILIA' : 'RETIRADA_SOLICITUD_FAMILIA',
    estadoAnterior: alumno.estado, actividadId: alumno.actividadId || null,
    actividad: alumno.actividad || null, dias: alumno.dias || null, horario: alumno.horario || null,
    precio: alumno.precio || null, fechaAlta: inicio || null
  };
  return {
    estado: esInscripcion ? 'baja_pendiente' : 'baja_finalizada',
    fechaSolicitudBaja: fecha,
    ...(esInscripcion ? {} : { fechaBaja: fecha, motivoBaja: 'Retirada de solicitud sin inscripción confirmada' }),
    historialInscripciones: [...(Array.isArray(alumno.historialInscripciones) ? alumno.historialInscripciones : []), registro]
  };
}
