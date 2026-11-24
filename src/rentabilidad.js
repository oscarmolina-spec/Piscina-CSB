// ==========================================
// 💰 MÓDULO DE CÁLCULO DE RENTABILIDAD Y ANÁLISIS OPERATIVO (MILICÉNTIMOS)
// Funciones puras para cálculo financiero, calendarios y aforos de piscina
// ==========================================

export function parsePrecioAMilicentimos(str) {
  if (str === null || str === undefined || str === '') return 0;
  if (typeof str === 'number') return Math.round(str * 100000);

  const limpio = String(str).replace(/[^\d.,]/g, '').trim().replace(',', '.');
  if (!limpio) return 0;
  const num = parseFloat(limpio);
  if (isNaN(num)) return 0;
  return Math.round(num * 100000);
}

export function parsePrecioACentimos(str) {
  return Math.round(parsePrecioAMilicentimos(str) / 1000);
}

export function normalizarFechaFirestore(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'object' && typeof val.seconds === 'number') return new Date(val.seconds * 1000);
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function extraerDiasSemana(textoDias) {
  if (!textoDias || typeof textoDias !== 'string') return [];
  const t = textoDias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const dias = [];

  if (t.includes('l-v') || t.includes('lunes a viernes')) {
    return ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  }
  if (t.includes('l-j') || t.includes('lunes a jueves')) {
    return ['lunes', 'martes', 'miercoles', 'jueves'];
  }

  if (t.includes('lunes')) dias.push('lunes');
  if (t.includes('martes')) dias.push('martes');
  if (t.includes('miercoles')) dias.push('miercoles');
  if (t.includes('jueves')) dias.push('jueves');
  if (t.includes('viernes')) dias.push('viernes');

  return Array.from(new Set(dias));
}

export function calcularDuracionMinutos(horarioStr) {
  if (!horarioStr || typeof horarioStr !== 'string') return 45;
  const partes = horarioStr.split('-');
  if (partes.length !== 2) return 45;

  const [h1, m1] = partes[0].split(':').map(Number);
  const [h2, m2] = partes[1].split(':').map(Number);

  if (isNaN(h1) || isNaN(h2)) return 45;

  const inicioMin = h1 * 60 + (m1 || 0);
  const finMin = h2 * 60 + (m2 || 0);

  const dur = finMin - inicioMin;
  return dur > 0 ? dur : 45;
}

export function obtenerSegmentoFisico(actividadId, curso, catalog = []) {
  if (catalog && catalog.length > 0) {
    const actDoc = catalog.find((a) => a.id === actividadId);
    if (actDoc && actDoc.segmentosFisicos && actDoc.segmentosFisicos.length > 0) {
      const segMatch = actDoc.segmentosFisicos.find((s) => s.cursos && s.cursos.includes(curso));
      if (segMatch) return segMatch.id;
      return actDoc.segmentosFisicos[0].id;
    }
  }

  if (actividadId === 'primaria_1615') {
    if (['1PRI', '2PRI', '3PRI'].includes(curso)) return 'primaria_1615_1a3';
    if (['4PRI', '5PRI', '6PRI'].includes(curso)) return 'primaria_1615_4a6';
    return 'primaria_1615_1a3';
  }
  return actividadId;
}

export function contarDiasOperativos(mesIndex, anio, festivosArray = []) {
  const month0 = mesIndex >= 0 && mesIndex <= 11 ? mesIndex : mesIndex - 1;
  const totalDiasMes = new Date(anio, month0 + 1, 0).getDate();

  const conteoPorDia = { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 };
  let totalDiasOperativos = 0;
  const fechasOperativas = [];

  const festivosSet = new Set((festivosArray || []).map((f) => String(f).trim()));

  for (let d = 1; d <= totalDiasMes; d++) {
    const fecha = new Date(anio, month0, d);
    const dayOfWeek = fecha.getDay();

    const isoDate = `${anio}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !festivosSet.has(isoDate)) {
      totalDiasOperativos++;
      fechasOperativas.push({ fechaDate: fecha, isoDate, dayOfWeek });

      if (dayOfWeek === 1) conteoPorDia.lunes++;
      if (dayOfWeek === 2) conteoPorDia.martes++;
      if (dayOfWeek === 3) conteoPorDia.miercoles++;
      if (dayOfWeek === 4) conteoPorDia.jueves++;
      if (dayOfWeek === 5) conteoPorDia.viernes++;
    }
  }

  return { totalDiasOperativos, conteoPorDia, fechasOperativas };
}

export function calcularCoberturaSocorrista(conteoPorDia, tarifaSocorristaConIvaMc) {
  const horasLJ = (conteoPorDia.lunes + conteoPorDia.martes + conteoPorDia.miercoles + conteoPorDia.jueves) * 3;
  const horasViernes = conteoPorDia.viernes * 3.75;
  const totalHorasSocorrista = horasLJ + horasViernes;
  const costeTotalSocorristaMc = Math.round(totalHorasSocorrista * tarifaSocorristaConIvaMc);

  return { totalHorasSocorrista, costeTotalSocorristaMc };
}

export function calcularCoberturaCoordinador(totalDiasOperativos, tarifaCoordinadorConIvaMc) {
  const totalHorasCoordinador = totalDiasOperativos * 1;
  const costeTotalCoordinadorMc = Math.round(totalHorasCoordinador * tarifaCoordinadorConIvaMc);
  return { totalHorasCoordinador, costeTotalCoordinadorMc };
}

export function construirSesionesFisicas(catalog) {
  const sesiones = [];

  (catalog || []).forEach((act) => {
    const requiereMonitorDefault = act.requiereMonitor !== false && act.id !== 'nado_libre';
    const callesNecesariasDefault = act.callesNecesarias || 1;

    const segmentos =
      act.segmentosFisicos && act.segmentosFisicos.length > 0
        ? act.segmentosFisicos
        : [
            {
              id: act.id,
              nombre: act.nombre,
              minAlumnos: act.minAlumnos || 4,
              alumnosMax: act.alumnosMax || 12,
              callesNecesarias: callesNecesariasDefault,
              requiereMonitor: requiereMonitorDefault
            }
          ];

    segmentos.forEach((seg) => {
      const segRequiereMonitor = seg.requiereMonitor !== undefined ? seg.requiereMonitor : requiereMonitorDefault;
      const segCallesNecesarias = seg.callesNecesarias !== undefined ? seg.callesNecesarias : callesNecesariasDefault;
      const segMin = seg.minAlumnos !== undefined ? seg.minAlumnos : act.minAlumnos || 4;
      const segMax = seg.alumnosMax !== undefined ? seg.alumnosMax : act.alumnosMax || 12;

      (act.opciones || []).forEach((op) => {
        const diasArray = extraerDiasSemana(op.dias);
        const duracionMin = calcularDuracionMinutos(op.horario);

        diasArray.forEach((dia) => {
          const key = `${act.id}_${seg.id}_${dia}_${op.horario}`;
          let existente = sesiones.find((s) => s.key === key);
          if (!existente) {
            existente = {
              key,
              actividadId: act.id,
              segmentoId: seg.id,
              nombreActividad: act.nombre,
              nombreSegmento: seg.nombre || act.nombre,
              dia,
              horario: op.horario,
              duracionMinutos: duracionMin,
              requiereMonitor: segRequiereMonitor,
              callesNecesarias: segCallesNecesarias,
              alumnosMin: segMin,
              alumnosMax: segMax,
              modalidadesAsociadas: []
            };
            sesiones.push(existente);
          }
          if (!existente.modalidadesAsociadas.includes(op.dias)) {
            existente.modalidadesAsociadas.push(op.dias);
          }
        });
      });
    });
  });

  return sesiones;
}

export function clasificarAlumnoParaMes(alumno, mesIndex, anio, catalog = []) {
  if (!alumno) return { categoria: 'descartado', motivo: 'Registro nulo' };

  if (alumno.estado === 'lista_espera') return { categoria: 'lista_espera', motivo: 'Lista de espera' };
  if (alumno.estado === 'prueba_reservada') return { categoria: 'prueba_reservada', motivo: 'Prueba reservada' };
  if (alumno.estado === 'sin_inscripcion') return { categoria: 'sin_inscripcion', motivo: 'Sin inscripción' };
  if (alumno.estado === 'baja_finalizada') {
    const fBaja = normalizarFechaFirestore(alumno.fechaBaja);
    const fInicioMes = new Date(anio, mesIndex, 1);
    const fFinMes = new Date(anio, mesIndex + 1, 0, 23, 59, 59);
    if (!fBaja || fBaja < fInicioMes || fBaja > fFinMes) {
      return { categoria: 'descartado', motivo: 'Baja finalizada fuera del mes' };
    }
  }

  const actividadId = alumno.actividadId || catalog.find((a) => a.nombre === alumno.actividad)?.id;
  const textoDias = alumno.opcionDias || alumno.dias;
  const horario = alumno.horario;

  if (!actividadId || !textoDias) {
    return { categoria: 'pendiente_revisar', motivo: 'Faltan datos de actividad o días' };
  }

  const actDoc = catalog.length > 0 ? catalog.find((a) => a.id === actividadId) : null;

  let precioMc = parsePrecioAMilicentimos(alumno.precio);
  if (precioMc === 0 && actDoc) {
    const diasNorm = extraerDiasSemana(textoDias);
    const opDoc = (actDoc.opciones || []).find((o) => {
      const oDias = extraerDiasSemana(o.dias);
      const coincideDias = oDias.length === diasNorm.length && oDias.every((d) => diasNorm.includes(d));
      const coincideHorario = !horario || o.horario === horario;
      return coincideDias && coincideHorario;
    });
    if (opDoc) {
      precioMc = parsePrecioAMilicentimos(opDoc.precio);
    }
  }

  if (precioMc === 0) {
    return { categoria: 'pendiente_revisar', motivo: 'Sin tarifa identificada' };
  }

  const precioCentimos = Math.round(precioMc / 1000);

  const fechaInicioMes = new Date(anio, mesIndex, 1);
  const fechaFinMes = new Date(anio, mesIndex + 1, 0, 23, 59, 59);

  const fechaAlta = normalizarFechaFirestore(alumno.fechaAlta || alumno.createdAt || alumno.fechaInscripcion);
  if (!fechaAlta) {
    return { categoria: 'pendiente_revisar', motivo: 'Sin fecha de alta válida' };
  }

  if (fechaAlta > fechaFinMes) {
    return { categoria: 'ingreso_potencial', motivo: 'Alta en mes posterior', precioMc, precioCentimos, actividadId, textoDias, horario };
  }

  const fechaBaja = normalizarFechaFirestore(alumno.fechaBaja);
  if (fechaBaja && fechaBaja < fechaInicioMes) {
    return { categoria: 'descartado', motivo: 'Baja finalizada antes del inicio del mes' };
  }

  const estaValidado = alumno.validadoAdmin === true || alumno.revisadoAdmin === true;

  if (!estaValidado) {
    return { categoria: 'ingreso_potencial', motivo: 'Pendiente de validación por admin', precioMc, precioCentimos, actividadId, textoDias, horario };
  }

  if (
    alumno.estado === 'inscrito' ||
    (alumno.estado === 'baja_pendiente' && (!fechaBaja || fechaBaja >= fechaInicioMes)) ||
    (alumno.estado === 'baja_finalizada' && fechaBaja >= fechaInicioMes && fechaBaja <= fechaFinMes)
  ) {
    return { categoria: 'ingreso_confirmado', precioMc, precioCentimos, actividadId, textoDias, horario };
  }

  return { categoria: 'pendiente_revisar', motivo: 'Estado no identificado' };
}

export function detectarConflictosCalles(sesionesFisicasViables, conteoPorDia, totalCallesPermitidas = 4) {
  const conflictos = [];
  const diasNombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  diasNombres.forEach((diaNombre) => {
    if ((conteoPorDia[diaNombre] || 0) === 0) return;

    const sesionesDelDia = sesionesFisicasViables.filter((s) => s.dia === diaNombre);
    if (sesionesDelDia.length === 0) return;

    for (let min = 840; min <= 1140; min++) {
      let callesEnUso = 0;
      const sesionesInvolucradas = [];

      sesionesDelDia.forEach((s) => {
        if (!s.horario) return;
        const partes = s.horario.split('-');
        if (partes.length !== 2) return;
        const [h1, m1] = partes[0].split(':').map(Number);
        const [h2, m2] = partes[1].split(':').map(Number);
        const startMin = h1 * 60 + (m1 || 0);
        const endMin = h2 * 60 + (m2 || 0);

        if (min >= startMin && min < endMin) {
          callesEnUso += s.callesNecesarias || 1;
          sesionesInvolucradas.push(s);
        }
      });

      if (callesEnUso > totalCallesPermitidas) {
        const hInicioStr = `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
        const conflictoExistente = conflictos.find((c) => c.dia === diaNombre && c.intervaloEndMin === min);

        if (conflictoExistente) {
          conflictoExistente.intervaloEndMin = min + 1;
          conflictoExistente.intervalo = `${conflictoExistente.hInicioStr}-${Math.floor((min + 1) / 60)}:${String((min + 1) % 60).padStart(2, '0')}`;
        } else {
          conflictos.push({
            dia: diaNombre,
            hInicioStr,
            intervaloStartMin: min,
            intervaloEndMin: min + 1,
            intervalo: `${hInicioStr}-${Math.floor((min + 1) / 60)}:${String((min + 1) % 60).padStart(2, '0')}`,
            callesNecesarias: callesEnUso,
            exceso: callesEnUso - totalCallesPermitidas,
            actividades: Array.from(new Set(sesionesInvolucradas.map((s) => s.nombreSegmento || s.nombreActividad)))
          });
        }
      }
    }
  });

  return conflictos;
}

export function simularCambioAlumnos(alumnosReales = [], simulacionAjustes = {}, catalog = [], mesIndex = 0, anio = 2024) {
  let alumnosProcesados = [...alumnosReales];

  Object.keys(simulacionAjustes).forEach((simKey) => {
    const delta = simulacionAjustes[simKey] || 0;
    if (delta === 0) return;

    const partes = simKey.split('___');
    const actId = partes[0];
    let segmentoId = null;
    let opcionDias = null;

    if (partes.length >= 3) {
      segmentoId = partes[1];
      opcionDias = partes.slice(2).join('___');
    } else {
      opcionDias = partes.slice(1).join('___');
    }

    const actDoc = catalog.find((a) => a.id === actId);
    const opDoc = (actDoc?.opciones || []).find((o) => o.dias === opcionDias);

    if (delta < 0) {
      const aRetirarCount = Math.abs(delta);
      let retirados = 0;

      alumnosProcesados = alumnosProcesados.filter((al) => {
        if (retirados >= aRetirarCount) return true;

        const alAct = al.actividadId || catalog.find((a) => a.nombre === al.actividad)?.id;
        const alDias = al.opcionDias || al.dias;
        const alSeg = obtenerSegmentoFisico(alAct, al.curso, catalog);

        const coincideAct = alAct === actId;
        const coincideDias = alDias === opcionDias;
        const coincideSeg = !segmentoId || alSeg === segmentoId;

        const clasificacion = clasificarAlumnoParaMes(al, mesIndex, anio, catalog);
        const esConfirmado = clasificacion.categoria === 'ingreso_confirmado';

        if (coincideAct && coincideDias && coincideSeg && esConfirmado) {
          retirados++;
          return false;
        }
        return true;
      });
    } else if (delta > 0) {
      const cursoRepresentativo = segmentoId === 'primaria_1615_4a6' ? '4PRI' : actDoc?.cursos?.[0] || '1PRI';
      const mesStr = String(mesIndex + 1).padStart(2, '0');

      for (let i = 0; i < delta; i++) {
        alumnosProcesados.push({
          id: `sim_virtual_${simKey}_${i}_${Date.now()}`,
          nombre: `Alumno Simulado ${i + 1}`,
          actividadId: actId,
          actividad: actDoc?.nombre,
          opcionDias,
          dias: opcionDias,
          horario: opDoc?.horario,
          precio: opDoc?.precio || '45€',
          curso: cursoRepresentativo,
          estado: 'inscrito',
          validadoAdmin: true,
          revisadoAdmin: true,
          fechaAlta: `${anio}-${mesStr}-01`
        });
      }
    }
  });

  return alumnosProcesados;
}

function calcularMonitoresNecesarios(sesion, numConfirmados) {
  if (!sesion.esViable || !sesion.requiereMonitor) return 0;
  if (sesion.actividadId === 'chapoteo') {
    return numConfirmados >= 10 ? 2 : 1;
  }
  return sesion.monitoresNecesarios || 1;
}

function parseHorarioMinutos(horarioStr) {
  if (!horarioStr || typeof horarioStr !== 'string') return { startMin: 0, endMin: 0 };
  const partes = horarioStr.split('-');
  if (partes.length !== 2) return { startMin: 0, endMin: 0 };
  const [h1, m1] = partes[0].split(':').map(Number);
  const [h2, m2] = partes[1].split(':').map(Number);
  const startMin = (isNaN(h1) ? 0 : h1) * 60 + (isNaN(m1) ? 0 : m1);
  const endMin = (isNaN(h2) ? 0 : h2) * 60 + (isNaN(m2) ? 0 : m2);
  return { startMin, endMin };
}

function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calcularFranjasMonitores(resultadoSesiones = [], conteoPorDia = {}) {
  const diasNombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  const franjas = [];
  let maximoMonitoresSimultaneos = 0;

  diasNombres.forEach((diaNombre) => {
    if ((conteoPorDia[diaNombre] || 0) === 0) return;

    const viablesDia = resultadoSesiones.filter((s) => s.dia === diaNombre && s.esViable);
    if (viablesDia.length === 0) return;

    const sesionesConT = viablesDia.map((s) => {
      const { startMin, endMin } = parseHorarioMinutos(s.horario);
      return { ...s, startMin, endMin };
    });

    const puntosSet = new Set();
    sesionesConT.forEach((s) => {
      if (s.endMin > s.startMin) {
        puntosSet.add(s.startMin);
        puntosSet.add(s.endMin);
      }
    });

    const puntos = Array.from(puntosSet).sort((a, b) => a - b);

    for (let i = 0; i < puntos.length - 1; i++) {
      const t1 = puntos[i];
      const t2 = puntos[i + 1];

      const sesionesActivas = sesionesConT.filter((s) => s.startMin <= t1 && s.endMin >= t2);

      if (sesionesActivas.length > 0) {
        const callesOcupadas = sesionesActivas.reduce((acc, s) => acc + (s.callesNecesarias || 1), 0);
        const monitoresNecesarios = sesionesActivas.reduce((acc, s) => acc + (s.monitoresNecesarios || 0), 0);
        const nombresGrupos = Array.from(new Set(sesionesActivas.map((s) => s.nombreSegmento || s.nombreActividad)));

        if (monitoresNecesarios > maximoMonitoresSimultaneos) {
          maximoMonitoresSimultaneos = monitoresNecesarios;
        }

        franjas.push({
          dia: diaNombre,
          franja: `${minToHHMM(t1)}-${minToHHMM(t2)}`,
          t1,
          t2,
          sesionesActivas,
          callesOcupadas,
          monitoresNecesarios,
          nombresGrupos
        });
      }
    }
  });

  return { franjasMonitores: franjas, maximoMonitoresSimultaneos };
}

export function calcularRentabilidadMensual({
  alumnos = [],
  mesIndex = 9,
  anio = 2024,
  festivos = [],
  tarifaMonitorBase = 10,
  tarifaSocorristaBase = 10,
  tarifaCoordinadorBase = 14.5,
  ivaPersonal = 21,
  totalCallesPermitidas = 4,
  catalog = []
}) {
  const factorIva = 1 + ivaPersonal / 100;
  const tarifaMonitorConIvaMc = Math.round(tarifaMonitorBase * factorIva * 100000);
  const tarifaSocorristaConIvaMc = Math.round(tarifaSocorristaBase * factorIva * 100000);
  const tarifaCoordinadorConIvaMc = Math.round(tarifaCoordinadorBase * factorIva * 100000);

  const { totalDiasOperativos, conteoPorDia } = contarDiasOperativos(mesIndex, anio, festivos);

  calcularCoberturaSocorrista(conteoPorDia, tarifaSocorristaConIvaMc);
  calcularCoberturaCoordinador(totalDiasOperativos, tarifaCoordinadorConIvaMc);

  const sesionesFisicas = construirSesionesFisicas(catalog);

  const alumnosConfirmadosUnicos = new Set();
  const ingresosContabilizados = new Set();
  const alumnosPotenciales = [];
  const alumnosListaEspera = [];
  const pendientesDeRevisar = [];

  let ingresoConfirmadoTotalMc = 0;
  let ingresoPotencialTotalMc = 0;

  const inscripcionesPorSesion = {};
  sesionesFisicas.forEach((s) => {
    inscripcionesPorSesion[s.key] = { confirmados: [], potenciales: [] };
  });

  (alumnos || []).forEach((alumno) => {
    const resClass = clasificarAlumnoParaMes(alumno, mesIndex, anio, catalog);
    const docId = alumno.id || `${alumno.nombre || 'alumno'}_${alumno.curso || 'curso'}`;

    if (resClass.categoria === 'ingreso_confirmado') {
      if (ingresosContabilizados.has(docId)) {
        pendientesDeRevisar.push({
          alumno: { id: docId, curso: alumno.curso, actividad: alumno.actividad },
          motivo: 'Inscripción duplicada en el cálculo'
        });
        return;
      }

      const diasAlumno = extraerDiasSemana(resClass.textoDias);
      const segmentoId = obtenerSegmentoFisico(resClass.actividadId, alumno.curso, catalog);

      const sesionesDelAlumno = sesionesFisicas.filter(
        (s) =>
          s.actividadId === resClass.actividadId &&
          s.segmentoId === segmentoId &&
          diasAlumno.includes(s.dia) &&
          (!resClass.horario || s.horario === resClass.horario)
      );

      if (sesionesDelAlumno.length === 0) {
        pendientesDeRevisar.push({
          alumno: { id: docId, curso: alumno.curso, actividad: alumno.actividad },
          motivo: 'La inscripción no coincide con ninguna sesión física del catálogo'
        });
        return;
      }

      ingresosContabilizados.add(docId);
      alumnosConfirmadosUnicos.add(docId);
      ingresoConfirmadoTotalMc += resClass.precioMc;

      let totalPonderacion = 0;
      sesionesDelAlumno.forEach((s) => {
        const apariciones = conteoPorDia[s.dia] || 0;
        totalPonderacion += s.duracionMinutos * apariciones;
      });

      let acumCuotaMc = 0;
      sesionesDelAlumno.forEach((s, idx) => {
        const esUltima = idx === sesionesDelAlumno.length - 1;
        const apariciones = conteoPorDia[s.dia] || 0;
        const ponderacion = s.duracionMinutos * apariciones;

        let fraccionCuotaMc = 0;
        if (esUltima) {
          fraccionCuotaMc = resClass.precioMc - acumCuotaMc;
        } else {
          fraccionCuotaMc = totalPonderacion > 0 ? Math.round((resClass.precioMc * ponderacion) / totalPonderacion) : 0;
          acumCuotaMc += fraccionCuotaMc;
        }

        inscripcionesPorSesion[s.key].confirmados.push({
          alumnoId: docId,
          cuotaTotalMc: resClass.precioMc,
          fraccionAtribuidaMc: fraccionCuotaMc
        });
      });
    } else if (resClass.categoria === 'ingreso_potencial') {
      alumnosPotenciales.push(alumno);
      ingresoPotencialTotalMc += resClass.precioMc || 0;

      const diasAlumno = extraerDiasSemana(resClass.textoDias);
      const segmentoId = obtenerSegmentoFisico(resClass.actividadId, alumno.curso, catalog);

      const sesionesDelAlumno = sesionesFisicas.filter(
        (s) =>
          s.actividadId === resClass.actividadId &&
          s.segmentoId === segmentoId &&
          diasAlumno.includes(s.dia) &&
          (!resClass.horario || s.horario === resClass.horario)
      );

      sesionesDelAlumno.forEach((s) => {
        inscripcionesPorSesion[s.key].potenciales.push(alumno);
      });
    } else if (resClass.categoria === 'lista_espera') {
      alumnosListaEspera.push(alumno);
    } else if (resClass.categoria === 'pendiente_revisar') {
      pendientesDeRevisar.push({ alumno, motivo: resClass.motivo });
    }
  });

  let costeMonitoresTotalMc = 0;
  let sesionesViablesCount = 0;
  let sesionesEnFormacionCount = 0;
  let sesionesNoSalenCount = 0;

  const resultadoSesiones = sesionesFisicas.map((s) => {
    const confirmados = inscripcionesPorSesion[s.key].confirmados;
    const potenciales = inscripcionesPorSesion[s.key].potenciales;

    const numConfirmados = confirmados.length;
    const aparicionesMes = conteoPorDia[s.dia] || 0;
    const faltanParaMinimo = Math.max(0, s.alumnosMin - numConfirmados);

    let estado = 'Sin alumnado';
    if (numConfirmados > s.alumnosMax) {
      estado = 'Exceso de aforo';
    } else if (numConfirmados === s.alumnosMax) {
      estado = 'Completo';
    } else if (numConfirmados >= s.alumnosMin) {
      estado = 'Viable';
    } else if (faltanParaMinimo === 1) {
      estado = 'En formación';
    } else if (numConfirmados > 0) {
      estado = 'No sale';
    }

    const esViable = estado === 'Viable' || estado === 'Completo' || estado === 'Exceso de aforo';

    if (esViable) sesionesViablesCount++;
    if (estado === 'En formación') sesionesEnFormacionCount++;
    if (estado === 'No sale') sesionesNoSalenCount++;

    const ingresoAtribuidoMc = confirmados.reduce((acc, c) => acc + c.fraccionAtribuidaMc, 0);
    const ingresoOperativoMc = esViable ? ingresoAtribuidoMc : 0;
    const ingresoPendienteAperturaMc = esViable ? 0 : ingresoAtribuidoMc;

    const monitoresNecesarios = calcularMonitoresNecesarios({ ...s, esViable }, numConfirmados);

    let costeMonitorMc = 0;
    if (esViable && s.requiereMonitor) {
      const horasMes = (s.duracionMinutos / 60) * aparicionesMes * monitoresNecesarios;
      costeMonitorMc = Math.round(horasMes * tarifaMonitorConIvaMc);
      costeMonitoresTotalMc += costeMonitorMc;
    }

    return {
      ...s,
      numConfirmados,
      numPotenciales: potenciales.length,
      aparicionesMes,
      faltanParaMinimo,
      estado,
      esViable,
      monitoresNecesarios,
      ingresoAtribuidoMc,
      ingresoOperativoMc,
      ingresoPendienteAperturaMc,
      costeMonitorMc,
      costeSocorristaMc: 0,
      costeCoordinadorMc: 0,
      costeTotalMc: 0,
      resultadoOperativoMc: 0
    };
  });

  let costeFijoSinActividadMc = 0;
  let costeTotalSocorristaMc = 0;
  let costeTotalCoordinadorMc = 0;

  const diasNombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  diasNombres.forEach((diaNombre) => {
    const numDias = conteoPorDia[diaNombre] || 0;
    if (numDias === 0) return;

    const horasSocorristaPorDia = diaNombre === 'viernes' ? 3.75 : 3.0;
    const costeSocorristaDiaTotalMc = Math.round(numDias * horasSocorristaPorDia * tarifaSocorristaConIvaMc);
    const costeCoordinadorDiaTotalMc = Math.round(numDias * 1 * tarifaCoordinadorConIvaMc);

    costeTotalSocorristaMc += costeSocorristaDiaTotalMc;
    costeTotalCoordinadorMc += costeCoordinadorDiaTotalMc;

    const viablesDelDia = resultadoSesiones.filter((s) => s.dia === diaNombre && s.esViable);

    let totalMinutosCalleDia = 0;
    viablesDelDia.forEach((s) => {
      totalMinutosCalleDia += s.duracionMinutos * s.callesNecesarias * s.aparicionesMes;
    });

    if (totalMinutosCalleDia > 0) {
      let socorristaAsignadoAcum = 0;
      let coordinadorAsignadoAcum = 0;

      viablesDelDia.forEach((s, idx) => {
        const esUltima = idx === viablesDelDia.length - 1;
        const minutosCalleSesion = s.duracionMinutos * s.callesNecesarias * s.aparicionesMes;

        let fraccionSocorrista = 0;
        let fraccionCoordinador = 0;

        if (esUltima) {
          fraccionSocorrista = costeSocorristaDiaTotalMc - socorristaAsignadoAcum;
          fraccionCoordinador = costeCoordinadorDiaTotalMc - coordinadorAsignadoAcum;
        } else {
          fraccionSocorrista = Math.round((costeSocorristaDiaTotalMc * minutosCalleSesion) / totalMinutosCalleDia);
          fraccionCoordinador = Math.round((costeCoordinadorDiaTotalMc * minutosCalleSesion) / totalMinutosCalleDia);

          socorristaAsignadoAcum += fraccionSocorrista;
          coordinadorAsignadoAcum += fraccionCoordinador;
        }

        s.costeSocorristaMc += fraccionSocorrista;
        s.costeCoordinadorMc += fraccionCoordinador;
      });
    } else {
      costeFijoSinActividadMc += costeSocorristaDiaTotalMc + costeCoordinadorDiaTotalMc;
    }
  });

  resultadoSesiones.forEach((s) => {
    s.costeTotalMc = s.costeMonitorMc + s.costeSocorristaMc + s.costeCoordinadorMc;
    s.resultadoOperativoMc = s.ingresoOperativoMc - s.costeTotalMc;
    s.margenPorcentaje = s.ingresoOperativoMc > 0 ? Math.round((s.resultadoOperativoMc / s.ingresoOperativoMc) * 100) : 0;

    s.ingresoAtribuidoCentimos = Math.round(s.ingresoAtribuidoMc / 1000);
    s.ingresoOperativoCentimos = Math.round(s.ingresoOperativoMc / 1000);
    s.ingresoPendienteAperturaCentimos = Math.round(s.ingresoPendienteAperturaMc / 1000);
    s.costeMonitorCentimos = Math.round(s.costeMonitorMc / 1000);
    s.costeSocorristaCentimos = Math.round(s.costeSocorristaMc / 1000);
    s.costeCoordinadorCentimos = Math.round(s.costeCoordinadorMc / 1000);
    s.costeTotalCentimos = Math.round(s.costeTotalMc / 1000);
    s.resultadoOperativoCentimos = Math.round(s.resultadoOperativoMc / 1000);
  });

  const ingresoAtribuidoTotalMc = resultadoSesiones.reduce((acc, s) => acc + s.ingresoAtribuidoMc, 0);
  const ingresoOperativoTotalMc = resultadoSesiones.reduce((acc, s) => acc + s.ingresoOperativoMc, 0);
  const ingresoPendienteAperturaTotalMc = resultadoSesiones.reduce((acc, s) => acc + s.ingresoPendienteAperturaMc, 0);

  const diferenciaConciliacionIngresosMc = ingresoConfirmadoTotalMc - ingresoAtribuidoTotalMc;
  const conciliacionIngresosCorrecta =
    diferenciaConciliacionIngresosMc === 0 && ingresoOperativoTotalMc + ingresoPendienteAperturaTotalMc === ingresoAtribuidoTotalMc;

  const costeTotalPersonalMc = costeMonitoresTotalMc + costeTotalSocorristaMc + costeTotalCoordinadorMc;
  const resultadoOperativoConfirmadoMc = ingresoOperativoTotalMc - costeTotalPersonalMc;
  const resultadoOperativoPotencialMc = ingresoOperativoTotalMc + ingresoPotencialTotalMc - costeTotalPersonalMc;
  const margenConfirmadoPorcentaje =
    ingresoOperativoTotalMc > 0 ? Math.round((resultadoOperativoConfirmadoMc / ingresoOperativoTotalMc) * 100) : 0;

  const sesionesViables = resultadoSesiones.filter((s) => s.esViable);
  const conflictosCalles = detectarConflictosCalles(sesionesViables, conteoPorDia, totalCallesPermitidas);
  const { franjasMonitores, maximoMonitoresSimultaneos } = calcularFranjasMonitores(resultadoSesiones, conteoPorDia);

  return {
    mesIndex,
    anio,
    totalDiasOperativos,
    conteoPorDia,
    tarifaMonitorConIvaMc,
    tarifaSocorristaConIvaMc,
    tarifaCoordinadorConIvaMc,
    tarifaMonitorConIvaCentimos: Math.round(tarifaMonitorConIvaMc / 1000),
    tarifaSocorristaConIvaCentimos: Math.round(tarifaSocorristaConIvaMc / 1000),
    tarifaCoordinadorConIvaCentimos: Math.round(tarifaCoordinadorConIvaMc / 1000),
    alumnosConfirmadosCount: alumnosConfirmadosUnicos.size,
    alumnosPotencialesCount: alumnosPotenciales.length,
    alumnosListaEsperaCount: alumnosListaEspera.length,
    pendientesDeRevisarCount: pendientesDeRevisar.length,
    pendientesDeRevisar,
    ingresoConfirmadoTotalMc,
    ingresoAtribuidoTotalMc,
    ingresoOperativoTotalMc,
    ingresoPendienteAperturaTotalMc,
    ingresoPotencialTotalMc,
    ingresoConfirmadoTotalCentimos: Math.round(ingresoConfirmadoTotalMc / 1000),
    ingresoAtribuidoTotalCentimos: Math.round(ingresoAtribuidoTotalMc / 1000),
    ingresoOperativoTotalCentimos: Math.round(ingresoOperativoTotalMc / 1000),
    ingresoPendienteAperturaTotalCentimos: Math.round(ingresoPendienteAperturaTotalMc / 1000),
    ingresoPotencialTotalCentimos: Math.round(ingresoPotencialTotalMc / 1000),
    diferenciaConciliacionIngresosMc,
    conciliacionIngresosCorrecta,
    costeMonitoresTotalMc,
    costeTotalSocorristaMc,
    costeTotalCoordinadorMc,
    costeFijoSinActividadMc,
    costeTotalPersonalMc,
    costeMonitoresTotalCentimos: Math.round(costeMonitoresTotalMc / 1000),
    costeTotalSocorristaCentimos: Math.round(costeTotalSocorristaMc / 1000),
    costeTotalCoordinadorCentimos: Math.round(costeTotalCoordinadorMc / 1000),
    costeFijoSinActividadCentimos: Math.round(costeFijoSinActividadMc / 1000),
    costeTotalPersonalCentimos: Math.round(costeTotalPersonalMc / 1000),
    resultadoOperativoConfirmadoMc,
    resultadoOperativoPotencialMc,
    resultadoOperativoConfirmadoCentimos: Math.round(resultadoOperativoConfirmadoMc / 1000),
    resultadoOperativoPotencialCentimos: Math.round(resultadoOperativoPotencialMc / 1000),
    margenConfirmadoPorcentaje,
    sesionesViablesCount,
    sesionesEnFormacionCount,
    sesionesNoSalenCount,
    resultadoSesiones,
    conflictosCalles,
    franjasMonitores,
    maximoMonitoresSimultaneos
  };
}
