// Comparte la validación entre la vista y la transacción: nunca se traslada
// a una opción fuera de la actividad actual ni se altera una plaza compartida.
export function planificarTraslado(alumno, actividad, opcion, slotsOrigen, slotsDestino) {
  if (alumno.estado !== 'inscrito' || alumno.actividadId !== actividad?.id ||
      !actividad.cursos.includes(alumno.curso) ||
      !actividad.opciones.some(o => o.dias === opcion?.dias && o.horario === opcion?.horario && o.precio === opcion?.precio)) {
    throw new Error('TRASLADO_NO_PERMITIDO');
  }
  if (actividad.id === 'chapoteo' && (slotsDestino.length !== 1 ||
      opcion.horario !== alumno.horario || opcion.precio !== alumno.precio)) {
    throw new Error('CHAPOTEO_SOLO_DIA');
  }
  const origen = slotsOrigen.map(s => s.id).sort();
  const destino = slotsDestino.map(s => s.id).sort();
  const guardados = Array.isArray(alumno.aforoSlotIds) ? [...alumno.aforoSlotIds].sort() : [];
  if (!origen.length || origen.length > 2 || !destino.length || destino.length > 2 ||
      JSON.stringify(origen) !== JSON.stringify(guardados)) {
    throw new Error('AFORO_ORIGEN_INCONSISTENTE');
  }
  if (JSON.stringify(origen) === JSON.stringify(destino)) throw new Error('MISMO_GRUPO');
  return {
    liberar: origen.filter(id => !destino.includes(id)),
    reservar: destino.filter(id => !origen.includes(id)),
    mantener: origen.filter(id => destino.includes(id)),
    destino
  };
}

export function comprobarAforoTraslado(plan, contadores) {
  for (const id of plan.reservar) {
    const contador = contadores.get(id);
    if (!contador) throw new Error('AFORO_NO_INICIALIZADO');
    if (!Number.isInteger(contador.ocupados) || !Number.isInteger(contador.maximo)) throw new Error('AFORO_INCONSISTENTE');
    if (contador.ocupados >= contador.maximo) throw new Error('GRUPO_COMPLETO');
  }
  for (const id of plan.liberar) {
    const contador = contadores.get(id);
    if (!contador) throw new Error('AFORO_NO_INICIALIZADO');
    if (!Number.isInteger(contador.ocupados) || contador.ocupados < 1) throw new Error('AFORO_ORIGEN_INCONSISTENTE');
  }
}
