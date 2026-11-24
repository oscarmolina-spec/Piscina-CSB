const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

function formatearYMDLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function obtenerAnioAcademico(ahora = new Date()) {
  const anioActual = ahora.getFullYear();
  // El curso de natación comienza el 1 de octubre.
  // Antes de octubre (meses 0..8), el inicio del curso es el 1 de octubre de este año.
  // Desde octubre (meses 9..11), el próximo curso empieza el 1 de octubre del año siguiente.
  const startYear = ahora.getMonth() < 9 ? anioActual : anioActual + 1;
  return {
    startYear,
    isoStartDate: `${startYear}-10-01`,
    formattedStartDate: `01/10/${startYear}`,
    rawPattern: `${startYear}-10`
  };
}

// Temporada de reserva anticipada: junio a septiembre (meses 6..9).
// Durante octubre..mayo el curso está activo y las altas van al mes actual o al siguiente.
export function esPeriodoReserva(ahora = new Date()) {
  const mes = ahora.getMonth() + 1;
  return mes >= 6 && mes <= 9;
}

export function obtenerInfoInicioInscripcion(ahora = new Date()) {
  const reserva = esPeriodoReserva(ahora);
  const diaActual = ahora.getDate();
  const mesActual = MESES_ES[ahora.getMonth()];
  const tecnicaHoy = formatearYMDLocal(ahora);

  if (reserva) {
    const academico = obtenerAnioAcademico(ahora);
    return {
      esPeriodoReserva: true,
      diaCortePasado: true,
      mesActual,
      mesSiguiente: 'octubre',
      sigMes: 'octubre',
      fechaInicioSiguiente: '1 de octubre',
      patronMesPrevision: academico.rawPattern,
      tecnicaHoy,
      tecnicaProximoMes: academico.isoStartDate
    };
  }

  const proximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const mesSiguiente = MESES_ES[proximoMes.getMonth()];
  const tecnicaProximoMes = formatearYMDLocal(proximoMes);

  return {
    esPeriodoReserva: false,
    diaCortePasado: diaActual > 20,
    mesActual,
    mesSiguiente,
    sigMes: mesSiguiente,
    fechaInicioSiguiente: `1 de ${mesSiguiente}`,
    patronMesPrevision: tecnicaProximoMes.slice(0, 7),
    tecnicaHoy,
    tecnicaProximoMes
  };
}

export function calcularFechaAlta(inicioDeseado, ahora = new Date()) {
  const info = obtenerInfoInicioInscripcion(ahora);
  const preferencia = String(inicioDeseado || 'proximo').toLowerCase();

  if (info.esPeriodoReserva) {
    const academico = obtenerAnioAcademico(ahora);
    return {
      fechaYMD: academico.isoStartDate,
      fechaISO: `${academico.isoStartDate}T12:00:00.000Z`,
      textoInicio: `Inicio de Curso (${academico.formattedStartDate})`,
      mesInicio: 'octubre',
      inicioDeseadoFinal: academico.isoStartDate
    };
  }

  if (!info.diaCortePasado && preferencia === 'inmediato') {
    return {
      fechaYMD: info.tecnicaHoy,
      fechaISO: ahora.toISOString(),
      textoInicio: `Inmediato (Mes de ${info.mesActual})`,
      mesInicio: info.mesActual,
      inicioDeseadoFinal: 'inmediato'
    };
  }

  return {
    fechaYMD: info.tecnicaProximoMes,
    fechaISO: `${info.tecnicaProximoMes}T12:00:00.000Z`,
    textoInicio: info.fechaInicioSiguiente,
    mesInicio: info.mesSiguiente,
    inicioDeseadoFinal: 'proximo'
  };
}

export function construirIdSlotPruebaNivel(fecha, hora) {
  const fechaLimpia = String(fecha || '').trim();
  const horaLimpia = String(hora || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) {
    throw new Error('FECHA_PRUEBA_INVALIDA');
  }
  const matchHora = /^(\d{1,2}):(\d{2})$/.exec(horaLimpia);
  if (!matchHora) {
    throw new Error('HORA_PRUEBA_INVALIDA');
  }
  const hh = matchHora[1].padStart(2, '0');
  const mm = matchHora[2];
  return `${fechaLimpia}__${hh}-${mm}`;
}

export function obtenerPermisoNotificaciones(notificationApi = globalThis.Notification) {
  if (!notificationApi || typeof notificationApi.permission !== 'string') {
    return 'unsupported';
  }
  return notificationApi.permission;
}
