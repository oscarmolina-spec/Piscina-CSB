import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { db, auth, secondaryAuth } from './firebase.js';
import { planificarTraslado, comprobarAforoTraslado } from './trasladoGrupo.js';
import ComunicacionesPanel from './ComunicacionesPanel.jsx';
import { planificarBajaFamiliar } from './bajaFamilia.js';
import { prepararExportacion } from './exportacionMensual.js';
import LandingPage from './LandingPage.jsx';
import {
  CAPACIDAD_POR_HUECO,
  IMG_ESCUDO,
  LISTA_CURSOS,
  OFERTA_ACTIVIDADES
} from './catalogo.js';
import {
  parsePrecioACentimos,
  normalizarFechaFirestore,
  extraerDiasSemana,
  obtenerSegmentoFisico,
  clasificarAlumnoParaMes,
  simularCambioAlumnos,
  calcularRentabilidadMensual
} from './rentabilidad.js';
import {
  escaparHtml,
  normalizarEmail,
  validarIbanEspanol,
  validarDniNie,
  construirDocumentoMonitor
} from './seguridad.js';
import {
  obtenerAnioAcademico,
  obtenerInfoInicioInscripcion,
  calcularFechaAlta,
  construirIdSlotPruebaNivel,
  obtenerPermisoNotificaciones
} from './temporada.js';

const VoiceAssistant = lazy(() => import('./VoiceAssistant.jsx'));
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDocsFromServer,
  doc,
  setDoc,
  getDoc, // <--- ¡AQUÍ ESTABA EL CULPABLE! FALTABA ESTO
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  orderBy,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';

// Seguridad/RGPD: no persistimos la caché de Firestore en IndexedDB local para
// evitar que datos sensibles (IBAN, DNI, menores) queden almacenados en disco
// en ordenadores compartidos del centro.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updatePassword,        // <--- Añade esta
  sendPasswordResetEmail
} from 'firebase/auth';
// ==========================================
// 🌐 ESTADO GLOBAL (CONTEXTO DE AUTENTICACIÓN)
// ==========================================
const AuthContext = React.createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [view, setView] = useState('landing');
  const [loading, setLoading] = useState(true);

  // El "value" contiene todo lo que queremos que sea accesible desde cualquier sitio
  const value = {
    user, setUser,
    userRole, setUserRole,
    view, setView,
    isAdmin: userRole === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Este es el Hook personalizado para usar el estado global
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return context;
};

// ==========================================
// 📧 UTILIDADES Y FUNCIONES DE AYUDA
// ==========================================

// Ayudante dinámico para obtener el año académico actual/siguiente
const getDynamicAcademicYear = () => obtenerAnioAcademico();

// ==========================================
// 🔒 CONTROL ATÓMICO DE AFORO Y LISTA DE ESPERA
// ==========================================
// Los documentos de `aforos` solo contienen cifras agregadas. De este modo las
// familias pueden consultar plazas sin poder leer fichas de otros alumnos.
const normalizarTextoAforo = (valor = '') => String(valor)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '');

const obtenerDiasAforo = (textoDias = '') => {
  const texto = normalizarTextoAforo(textoDias);
  return ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].filter(dia => texto.includes(dia));
};

const obtenerActividadIdAlumno = (alumno = {}) => {
  if (alumno.actividadId && OFERTA_ACTIVIDADES.some(a => a.id === alumno.actividadId)) return alumno.actividadId;
  const nombre = String(alumno.actividad || '').toLowerCase();
  if (!nombre.trim()) return '';
  return OFERTA_ACTIVIDADES.find(a => nombre.includes(a.nombre.toLowerCase()) || a.nombre.toLowerCase().includes(nombre))?.id || '';
};

const obtenerSegmentoAforo = (actividadId, curso = '') => {
  if (actividadId !== 'primaria_1615') return 'general';
  return ['1PRI', '2PRI', '3PRI'].includes(String(curso).toUpperCase()) ? '1a3' : '4a6';
};

const construirSlotsAforo = ({ actividadId, dias, horario, curso }) => {
  const actividad = OFERTA_ACTIVIDADES.find(a => a.id === actividadId);
  if (!actividad) throw new Error('ACTIVIDAD_AFORO_INVALIDA');
  const diasNormalizados = obtenerDiasAforo(dias);
  if (diasNormalizados.length === 0 || !horario) throw new Error('GRUPO_AFORO_INCOMPLETO');

  const segmento = obtenerSegmentoAforo(actividadId, curso);
  const segmentoDoc = actividad.segmentosFisicos?.find(s =>
    (segmento === '1a3' && s.id.endsWith('1a3')) || (segmento === '4a6' && s.id.endsWith('4a6'))
  );
  const maximo = Number(segmentoDoc?.alumnosMax || actividad.alumnosMax);
  if (!Number.isInteger(maximo) || maximo <= 0) throw new Error('MAXIMO_AFORO_INVALIDO');

  const hoy = new Date();
  // Octubre-mayo pertenecen al curso ya iniciado; junio-septiembre preparan
  // el curso que comienza ese mismo año.
  const inicio = hoy.getMonth() <= 4 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  const temporada = `${inicio}-${inicio + 1}`;
  const horarioId = normalizarTextoAforo(horario);
  return diasNormalizados.map(dia => ({
    id: `${temporada}__${normalizarTextoAforo(actividadId)}__${segmento}__${dia}__${horarioId}`,
    temporada,
    actividadId,
    segmento,
    dia,
    horario,
    maximo
  })).sort((a, b) => a.id.localeCompare(b.id));
};

const claveListaEspera = (slots) => slots.map(s => s.id).sort().join('|');

const reservarPlazaAtomica = async ({ alumnoId, actividadId, actividad, dias, horario, curso, datosExtra = {} }) => {
  const slots = construirSlotsAforo({ actividadId, dias, horario, curso });
  const alumnoRef = doc(db, 'students', alumnoId);
  const slotRefs = slots.map(slot => doc(db, 'aforos', slot.id));

  const ejecutarReserva = () => runTransaction(db, async transaction => {
    const alumnoSnap = await transaction.get(alumnoRef);
    if (!alumnoSnap.exists()) throw new Error('ALUMNO_NO_EXISTE');
    const slotSnaps = [];
    for (const ref of slotRefs) slotSnaps.push(await transaction.get(ref));
    if (slotSnaps.some(s => !s.exists())) throw new Error('AFORO_NO_INICIALIZADO');

    const slotsActuales = Array.isArray(alumnoSnap.data().aforoSlotIds) ? [...alumnoSnap.data().aforoSlotIds].sort() : [];
    const slotsObjetivo = slots.map(s => s.id).sort();
    if (alumnoSnap.data().estado === 'inscrito' && JSON.stringify(slotsActuales) === JSON.stringify(slotsObjetivo)) {
      return { resultado: 'inscrito', slots, repetida: true };
    }
    if (alumnoSnap.data().estado === 'inscrito' || alumnoSnap.data().estado === 'baja_pendiente') {
      throw new Error('CAMBIO_GRUPO_REQUIERE_GESTION_ADMINISTRATIVA');
    }

    const hayPlazaEnTodos = slotSnaps.every((snap, index) => {
      const data = snap.data();
      return Number(data.ocupados || 0) < Number(data.maximo || slots[index].maximo);
    });
    const ahora = serverTimestamp();

    if (!hayPlazaEnTodos) {
      transaction.update(alumnoRef, {
        ...datosExtra,
        actividadId,
        actividad,
        dias,
        opcionDias: dias,
        horario,
        grupo: `${dias} ${horario}`,
        estado: 'lista_espera',
        revisadoAdmin: false,
        validadoAdmin: false,
        aforoSlotIds: [],
        waitlistGroupKey: claveListaEspera(slots),
        waitlistJoinedAt: alumnoSnap.data().waitlistGroupKey === claveListaEspera(slots)
          ? (alumnoSnap.data().waitlistJoinedAt || ahora)
          : ahora,
        ultimaActualizacion: ahora
      });
      return { resultado: 'lista_espera', slots };
    }

    slotSnaps.forEach((snap, index) => {
      const data = snap.data();
      transaction.update(slotRefs[index], {
        ocupados: Number(data.ocupados || 0) + 1,
        lastStudentId: alumnoId,
        lastActorUid: auth.currentUser?.uid || '',
        lastOperation: 'RESERVA',
        updatedAt: ahora
      });
    });
    transaction.update(alumnoRef, {
      ...datosExtra,
      actividadId,
      actividad,
      dias,
      opcionDias: dias,
      horario,
      grupo: `${dias} ${horario}`,
      estado: 'inscrito',
      revisadoAdmin: true,
      validadoAdmin: true,
      aforoSlotIds: slots.map(s => s.id),
      waitlistGroupKey: null,
      waitlistJoinedAt: null,
      ultimaActualizacion: ahora
    });
    return { resultado: 'inscrito', slots };
  });

  // Si dos familias intentan ocupar la última plaza a la vez, Firestore puede
  // rechazar el primer intento obsoleto antes de reintentarlo. Una relectura
  // inmediata convierte correctamente la segunda solicitud en lista de espera.
  for (let intento = 0; intento < 3; intento += 1) {
    try {
      return await ejecutarReserva();
    } catch (error) {
      const reintentable = ['permission-denied', 'aborted', 'unavailable'].includes(error?.code);
      if (!reintentable || intento === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 75 * (intento + 1)));
    }
  }
  throw new Error('NO_SE_PUDO_CONFIRMAR_AFORO');
};

const liberarPlazaAtomica = async ({ alumnoId, datosFinales, estadosPermitidos }) => {
  const alumnoRef = doc(db, 'students', alumnoId);
  return runTransaction(db, async transaction => {
    const alumnoSnap = await transaction.get(alumnoRef);
    if (!alumnoSnap.exists()) throw new Error('ALUMNO_NO_EXISTE');
    const alumno = alumnoSnap.data();
    if (estadosPermitidos && !estadosPermitidos.includes(alumno.estado)) throw new Error('El estado ha cambiado. Recarga la ficha.');
    const actividadId = obtenerActividadIdAlumno(alumno);
    let slotIds = Array.isArray(alumno.aforoSlotIds) ? alumno.aforoSlotIds : [];
    if (slotIds.length === 0 && alumno.estado === 'inscrito' && actividadId) {
      slotIds = construirSlotsAforo({ actividadId, dias: alumno.dias || alumno.opcionDias, horario: alumno.horario, curso: alumno.curso }).map(s => s.id);
    }
    const refs = slotIds.map(id => doc(db, 'aforos', id));
    const snaps = [];
    for (const ref of refs) snaps.push(await transaction.get(ref));

    const tieneCitaAforoPrueba = alumno.estado === 'prueba_reservada' &&
      typeof alumno.citaId === 'string' &&
      /^\d{4}-\d{2}-\d{2}__\d{2}-\d{2}$/.test(alumno.citaId);
    const citaPruebaRef = tieneCitaAforoPrueba ? doc(db, 'aforosPruebas', alumno.citaId) : null;
    const citaPruebaSnap = citaPruebaRef ? await transaction.get(citaPruebaRef) : null;

    if (alumno.estado === 'inscrito' || alumno.estado === 'baja_pendiente') {
      snaps.forEach((snap, index) => {
        if (!snap.exists()) throw new Error('AFORO_NO_INICIALIZADO');
        transaction.update(refs[index], {
          ocupados: Math.max(0, Number(snap.data().ocupados || 0) - 1),
          lastStudentId: alumnoId,
          lastActorUid: auth.currentUser?.uid || '',
          lastOperation: 'LIBERACION',
          updatedAt: serverTimestamp()
        });
      });
    }
    if (citaPruebaRef && citaPruebaSnap?.exists() && Number(citaPruebaSnap.data().ocupados || 0) > 0) {
      transaction.update(citaPruebaRef, {
        ocupados: Math.max(0, Number(citaPruebaSnap.data().ocupados || 0) - 1),
        lastStudentId: alumnoId,
        lastActorUid: auth.currentUser?.uid || '',
        lastOperation: 'LIBERACION',
        updatedAt: serverTimestamp()
      });
    }
    transaction.update(alumnoRef, {
      ...(typeof datosFinales === 'function' ? datosFinales(alumno) : datosFinales),
      ...(tieneCitaAforoPrueba ? { citaId: null } : {}),
      validadoAdmin: false,
      revisadoAdmin: false,
      aforoSlotIds: [],
      waitlistGroupKey: null,
      waitlistJoinedAt: null,
      ultimaActualizacion: serverTimestamp()
    });
  });
};

const trasladarGrupoAtomico = async ({ alumnoId, actividadOrigenId, actividadDestinoId, opcion, origenEsperado }) => {
  const actividad = OFERTA_ACTIVIDADES.find(a => a.id === actividadDestinoId);
  if (!actividad || !auth.currentUser || ![
    'extraescolares@sanbuenaventura.org',
    'extraescolarespiscina@sanbuenaventura.org'
  ].includes((auth.currentUser.email || '').toLowerCase())) throw new Error('TRASLADO_NO_PERMITIDO');

  const alumnoRef = doc(db, 'students', alumnoId);
  // La lectura previa permite conocer todos los documentos que leerá la transacción.
  // Dentro se comprueba otra vez el grupo, para descartar vistas desactualizadas.
  const inicial = await getDoc(alumnoRef);
  if (!inicial.exists()) throw new Error('ALUMNO_NO_EXISTE');
  const previo = inicial.data();
  if (previo.actividadId !== actividadOrigenId || !OFERTA_ACTIVIDADES.some(a => a.id === actividadOrigenId)) throw new Error('GRUPO_CAMBIADO');
  const slotsOrigen = construirSlotsAforo({ actividadId: actividadOrigenId, dias: previo.dias, horario: previo.horario, curso: previo.curso });
  const slotsDestino = construirSlotsAforo({ actividadId: actividadDestinoId, dias: opcion.dias, horario: opcion.horario, curso: previo.curso });
  planificarTraslado(previo, actividad, opcion, slotsOrigen, slotsDestino);
  const ids = [...new Set([...slotsOrigen, ...slotsDestino].map(s => s.id))].sort();
  const referencias = ids.map(id => doc(db, 'aforos', id));

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(alumnoRef);
    if (!snap.exists()) throw new Error('ALUMNO_NO_EXISTE');
    const actual = snap.data();
    if (actual.actividadId !== actividadOrigenId || actual.dias !== origenEsperado.dias ||
        actual.horario !== origenEsperado.horario || actual.precio !== origenEsperado.precio ||
        actual.estado !== 'inscrito' || actual.curso !== previo.curso ||
        JSON.stringify(actual.aforoSlotIds || []) !== JSON.stringify(previo.aforoSlotIds || [])) {
      throw new Error('GRUPO_CAMBIADO');
    }
    const plan = planificarTraslado(actual, actividad, opcion, slotsOrigen, slotsDestino);
    const documentos = [];
    for (const referencia of referencias) documentos.push(await transaction.get(referencia));
    const contadores = new Map(ids.map((id, index) => [id, documentos[index]]));
    if (documentos.some(d => !d.exists())) throw new Error('AFORO_NO_INICIALIZADO');
    comprobarAforoTraslado(plan, new Map(ids.map(id => [id, contadores.get(id).data()])));
    const ahora = serverTimestamp();
    for (const id of plan.liberar) {
      transaction.update(doc(db, 'aforos', id), {
        ocupados: Number(contadores.get(id).data().ocupados) - 1,
        lastStudentId: alumnoId, lastActorUid: auth.currentUser.uid,
        lastOperation: 'LIBERACION', updatedAt: ahora
      });
    }
    for (const id of plan.reservar) {
      transaction.update(doc(db, 'aforos', id), {
        ocupados: Number(contadores.get(id).data().ocupados) + 1,
        lastStudentId: alumnoId, lastActorUid: auth.currentUser.uid,
        lastOperation: 'RESERVA', updatedAt: ahora
      });
    }
    transaction.update(alumnoRef, {
      actividadId: actividad.id, actividad: actividad.nombre,
      dias: opcion.dias, opcionDias: opcion.dias, horario: opcion.horario,
      grupo: `${opcion.dias} ${opcion.horario}`, precio: opcion.precio,
      aforoSlotIds: plan.destino, ultimaActualizacion: ahora
    });
    return {
      nombre: actual.nombre,
      anterior: `${actual.actividad} — ${actual.dias} ${actual.horario}`,
      nuevo: `${actividad.nombre} — ${opcion.dias} ${opcion.horario}`
    };
  });
};

// Se ejecuta desde el panel de administración. Solo crea contadores que aún no
// existen y conserva expresamente situaciones históricas como el actual 17/16.
const inicializarAforosSiFaltan = async (alumnos = []) => {
  const slots = new Map();
  const alumnosNoClasificados = [];
  OFERTA_ACTIVIDADES.forEach(actividad => actividad.opciones.forEach(opcion => {
    const cursos = actividad.segmentosFisicos ? ['1PRI', '4PRI'] : [actividad.cursos[0]];
    cursos.forEach(curso => construirSlotsAforo({ actividadId: actividad.id, dias: opcion.dias, horario: opcion.horario, curso })
      .forEach(slot => slots.set(slot.id, { ...slot, ocupados: 0 })));
  }));

  alumnos.filter(a => a.estado === 'inscrito' || a.estado === 'baja_pendiente').forEach(alumno => {
    const actividadId = obtenerActividadIdAlumno(alumno);
    const diasAlumno = alumno.dias || alumno.opcionDias;
    if (!actividadId || !diasAlumno || !alumno.horario) {
      alumnosNoClasificados.push(alumno.nombre || alumno.id);
      return;
    }
    try {
      construirSlotsAforo({ actividadId, dias: diasAlumno, horario: alumno.horario, curso: alumno.curso }).forEach(slot => {
        const actual = slots.get(slot.id) || { ...slot, ocupados: 0 };
        slots.set(slot.id, { ...actual, ocupados: actual.ocupados + 1 });
      });
    } catch (error) {
      console.warn('Alumno no incluido en la inicialización de aforo:', alumno.id, error.message);
      alumnosNoClasificados.push(alumno.nombre || alumno.id);
    }
  });

  if (alumnosNoClasificados.length > 0) {
    throw new Error(`AFORO_INCOMPLETO: revisa actividad, días y horario de ${alumnosNoClasificados.join(', ')}`);
  }

  for (const slot of slots.values()) {
    const ref = doc(db, 'aforos', slot.id);
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) transaction.set(ref, {
        temporada: slot.temporada,
        actividadId: slot.actividadId,
        segmento: slot.segmento,
        dia: slot.dia,
        horario: slot.horario,
        maximo: slot.maximo,
        ocupados: slot.ocupados,
        lastStudentId: '',
        lastActorUid: auth.currentUser?.uid || '',
        lastOperation: 'INICIALIZACION',
        updatedAt: serverTimestamp()
      });
    });
  }

  // Las fichas anteriores al control de aforo carecen de IDs de contador.
  // Los añadimos sin alterar la ocupación ya contabilizada arriba.
  for (const alumno of alumnos.filter(a => a.estado === 'inscrito' || a.estado === 'baja_pendiente')) {
    if (Array.isArray(alumno.aforoSlotIds) && alumno.aforoSlotIds.length > 0) continue;
    const actividadId = obtenerActividadIdAlumno(alumno);
    const ids = construirSlotsAforo({
      actividadId,
      dias: alumno.dias || alumno.opcionDias,
      horario: alumno.horario,
      curso: alumno.curso
    }).map(slot => slot.id);
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'students', alumno.id);
      const actual = await transaction.get(ref);
      if (actual.exists() && ['inscrito', 'baja_pendiente'].includes(actual.data().estado) &&
          (!Array.isArray(actual.data().aforoSlotIds) || actual.data().aforoSlotIds.length === 0)) {
        transaction.update(ref, { aforoSlotIds: ids });
      }
    });
  }
};

// Sistema global de Toasts Premium
let globalShowToast = (msg, type) => { console.log("Toast: ", msg, type); };
const showToast = (message, type = 'success') => {
  globalShowToast(message, type);
};

// Calcular los próximos 4 lunes para las pruebas de nivel
const getNextMondays = () => {
  const d = new Date();
  // Avanzar hasta el próximo lunes
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
  const r = [];
  for (let i = 0; i < 4; i++) {
    r.push(new Date(d));
    d.setDate(d.getDate() + 7); // Saltar 7 días
  }
  return r;
};

// Formato de fecha para ID (DD-MM-YYYY)
const getDateId = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Formato de fecha legible (Lunes 14 de Febrero)
const getHumanDate = (d) => {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Sistema de envío de Emails (simulado con extensión Firebase Trigger Email)
const enviarEmailConfirmacion = async (email, alumno, detalle, tipo, fechaInicio) => { // 🚩 Quitamos el '= cita' para que use el valor real
  try {
    const nombreAlumno = String(alumno).trim();
    const nombreAlumnoSeguro = escaparHtml(nombreAlumno);
    const detalleSeguro = escaparHtml(detalle);
    const esAlta = tipo === 'alta';
    const esListaEspera = tipo === 'lista_espera';

    // Formateamos la fecha si viene (de 2026-03-11 a 11/03/2026)
    const fechaFormateada = fechaInicio && fechaInicio !== 'cita' 
      ? escaparHtml(String(fechaInicio).split('-').reverse().join('/'))
      : null;

    await addDoc(collection(db, 'mail'), {
      to: [email],
      message: {
        subject: esListaEspera
          ? `⏳ Lista de espera: ${nombreAlumno}`
          : (esAlta ? `✅ Plaza Confirmada: ${nombreAlumno}` : `Reserva Confirmada: ${nombreAlumno}`),
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 15px; max-width: 600px;">
            <h2 style="color: ${esListaEspera ? '#B45309' : (esAlta ? '#059669' : '#2563EB')}; border-bottom: 2px solid ${esListaEspera ? '#F59E0B' : (esAlta ? '#059669' : '#2563EB')}; padding-bottom: 10px;">
               ${esListaEspera ? '⏳ Inscripción en lista de espera' : (esAlta ? '🏊 Plaza Validada Correctamente' : '🏊 Reserva Prueba de Nivel')}
            </h2>
            <p>Hola familia de <strong>${nombreAlumnoSeguro}</strong>,</p>
            
            ${esListaEspera
              ? `<p><strong>El grupo está completo y todavía NO existe una plaza confirmada.</strong> La solicitud se ha guardado correctamente y se atenderá por orden de inscripción dentro de este grupo y horario.</p>`
              : esAlta 
              ? `<p>¡Buenas noticias! La inscripción ha sido revisada y validada por la coordinación. El alumno ya tiene su plaza definitiva confirmada.</p>`
              : `<p>Os confirmamos que la prueba de nivel ha sido reservada correctamente. Rogamos acudan con tiempo suficiente para estar listos a la hora indicada.</p>`
            }

            <div style="background: ${esListaEspera ? '#FFFBEB' : (esAlta ? '#ECFDF5' : '#EFF6FF')}; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid ${esListaEspera ? '#F59E0B' : (esAlta ? '#10B981' : '#BFDBFE')};">
              <p style="margin: 0; color: ${esListaEspera ? '#92400E' : (esAlta ? '#065F46' : '#1E40AF')}; font-weight: bold;">
                ${esListaEspera ? '📍 Grupo solicitado:' : (esAlta ? '📍 Detalles de la Inscripción:' : '📅 Detalles de la Cita:')}
              </p>
              <p style="margin: 10px 0 0 0; font-size: 16px;">${detalleSeguro}</p>
              
              ${esAlta && fechaFormateada ? `
                <p style="margin: 10px 0 0 0; font-size: 16px; color: #d32f2f;">
                  <strong>📅 Fecha de inicio:</strong> ${fechaFormateada}
                </p>
              ` : ''}
            </div>

            ${esListaEspera
              ? `<p>Cuando quede una plaza libre, coordinación contactará con la primera persona de la lista antes de confirmar el alta.</p>`
              : esAlta 
              ? `<p>🎒 <strong>Recordad traer:</strong> Bañador, gorro, toalla, gafas y chanclas.</p>`
              : `<p>🎒 <strong>Recordad traer:</strong> Bañador, gorro, toalla, gafas y chanclas.</p>`
            }

            <p style="margin-top: 25px;">Saludos,<br><strong>Coordinación de Extraescolares CSB</strong></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 11px; color: #999;">Este es un mensaje automático generado por el sistema de gestión de piscina.</p>
          </div>
        `,
      },
    });
    console.log(`🚀 Email de ${tipo} encolado para:`, email);
  } catch (e) {
    console.error("Error al encolar email:", e);
  }
};

const enviarAvisoTraslado = async (email, nombre, anterior, nuevo) => {
  // El documento en `mail` solicita el envío; la entrega definitiva depende
  // de la extensión de Firebase y puede consultarse en esa colección.
  return addDoc(collection(db, 'mail'), {
    to: [email],
    message: {
      subject: `Cambio de actividad o grupo confirmado: ${nombre}`,
      html: `<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#243044">
        <h2>Cambio de actividad o grupo confirmado</h2>
        <p>Hola,</p>
        <p>Os confirmamos el cambio de inscripción de <strong>${escaparHtml(nombre)}</strong>.</p>
        <p><strong>Actividad y grupo anteriores:</strong> ${escaparHtml(anterior)}<br>
        <strong>Nueva actividad y grupo:</strong> ${escaparHtml(nuevo)}</p>
        <p>La plaza ya figura en el nuevo grupo. Para cualquier duda, contactad con
        Coordinación de Extraescolares CSB.</p></div>`
    }
  });
};
// ==========================================
// 🛡️ ADMIN DASHBOARD (PANEL DE GESTIÓN)
// ==========================================
const AdminDashboard = ({ userRole, logout, userEmail }) => {
  const emailNormalizado = (userEmail || '').toLowerCase().trim();

  // --- 1. ESTADOS ---
  const [alumnos, setAlumnos] = useState([]);
  const [padres, setPadres] = useState({});
  const [avisos, setAvisos] = useState([]);
  const [equipo, setEquipo] = useState([]);
  
  const esPersonalMonitor = userRole === 'monitor' || userRole === 'profe';
  const [tab, setTab] = useState(() => (userRole === 'monitor' || userRole === 'profe' ? 'mis_clases' : 'global'));
  const [busqueda, setBusqueda] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [mostrarExportacion, setMostrarExportacion] = useState(false);
  const [mesExportacion, setMesExportacion] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 7));
  const [exportando, setExportando] = useState(false);
  const [filtroRadar, setFiltroRadar] = useState(null);
  const [nuevoAviso, setNuevoAviso] = useState('');
  
  const [loadingStaff, setLoadingStaff] = useState(false);

  // --- 💰 ESTADOS MÓDULO DE RENTABILIDAD Y ANÁLISIS OPERATIVO ---
  const hoyRentabilidad = new Date();
  const [mesRentabilidad, setMesRentabilidad] = useState(hoyRentabilidad.getMonth());
  const [anioRentabilidad, setAnioRentabilidad] = useState(hoyRentabilidad.getFullYear());
  const [festivosRentabilidad, setFestivosRentabilidad] = useState([]);
  const [nuevoFestivoInput, setNuevoFestivoInput] = useState('');
  const [tarifaMonitorBase, setTarifaMonitorBase] = useState(10);
  const [tarifaSocorristaBase, setTarifaSocorristaBase] = useState(10);
  const [tarifaCoordinadorBase, setTarifaCoordinadorBase] = useState(14.5);
  const [ivaPersonal, setIvaPersonal] = useState(21);
  const [totalCallesPermitidas, setTotalCallesPermitidas] = useState(4);
  const [simulacionAjustes, setSimulacionAjustes] = useState({});
  const [simActividadSel, setSimActividadSel] = useState('');
  const [simSegmentoSel, setSimSegmentoSel] = useState('');
  const [simOpcionSel, setSimOpcionSel] = useState('');

  // ESTADO PARA LA FICHA (ALUMNO SELECCIONADO)
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [trasladoId, setTrasladoId] = useState(null);
  const [opcionTraslado, setOpcionTraslado] = useState('');
  const [trasladoEnCurso, setTrasladoEnCurso] = useState(false);
  const [vistaMes, setVistaMes] = useState('actual');
  const [radarHueco, setRadarHueco] = useState(null);
  const aforosInicializadosRef = useRef(false);
  // --- 👑 JERARQUÍA DE PODERES ---
const emailJefe = 'extraescolares@sanbuenaventura.org';
const emailCoordinador = 'extraescolarespiscina@sanbuenaventura.org'; 

const soySuperAdmin = emailNormalizado === emailJefe;
const soyCoordinador = emailNormalizado === emailCoordinador;

// Ambos pueden crear monitores y ver datos sensibles
const puedeGestionarTodo = soySuperAdmin || soyCoordinador;

// --- 🏊‍♂️ IDENTIFICACIÓN DEL MONITOR ---
// Buscamos si el que ha entrado está en la lista de equipo como monitor
const datosMonitor = equipo.find(m => normalizarEmail(m.email) === emailNormalizado);
const soyMonitor = esPersonalMonitor || datosMonitor?.rol === 'monitor';
const permisoNotificaciones = obtenerPermisoNotificaciones();
  // --- 🔔 SISTEMA DE NOTIFICACIONES PUSH (CEREBRO) ---
  const solicitarPermisoNotificaciones = async () => {
    if (obtenerPermisoNotificaciones() === 'unsupported') {
      showToast("Este navegador no soporta notificaciones de escritorio.", "warning");
      return;
    }
    const permiso = await Notification.requestPermission();
    if (permiso === "granted") {
      new Notification("🚀 ¡Sistema Activado!", {
        body: "Ahora recibirás avisos importantes de la piscina en este dispositivo.",
        icon: "/icon-pwa.png"
      });
    }
  };

  const enviarPushLocal = (titulo, mensaje) => {
    if (obtenerPermisoNotificaciones() === "granted") {
      new Notification(titulo, {
        body: mensaje,
        icon: "/icon-pwa.png"
      });
    }
  }; 
// --- 1.5 FUNCIONES DE ACCIÓN ---
const confirmarInscripcion = async (alumnoId) => {
  try {
    const alumnoRef = doc(db, 'students', alumnoId);
    await updateDoc(alumnoRef, { revisadoAdmin: true });
  } catch (error) {
    console.error("Error al confirmar:", error);
    showToast("No se pudo confirmar el grupo.", "error");
  }
};
const alumnoTraslado = alumnos.find(a => a.id === trasladoId);
const actividadTraslado = OFERTA_ACTIVIDADES.find(a => a.id === alumnoTraslado?.actividadId);
const opcionesTraslado = OFERTA_ACTIVIDADES.flatMap(actividad => {
  if (!actividadTraslado || !actividad.cursos.includes(alumnoTraslado?.curso) ||
      (actividadTraslado.id === 'chapoteo' && actividad.id !== 'chapoteo') ||
      (actividadTraslado.id !== 'chapoteo' && actividad.id === 'chapoteo')) return [];
  return actividad.opciones
    .filter(opcion => !(actividad.id === actividadTraslado.id && opcion.dias === alumnoTraslado.dias && opcion.horario === alumnoTraslado.horario))
    .map(opcion => ({ actividad, opcion }));
});
const destinoTraslado = opcionesTraslado.find((_, index) => String(index) === opcionTraslado);

const confirmarTraslado = async () => {
  if (!puedeGestionarTodo || trasladoEnCurso || !alumnoTraslado || !actividadTraslado || !destinoTraslado) return;
  const padreId = alumnoTraslado.parentId || alumnoTraslado.user;
  const emailDestino = padres[padreId]?.email || padres[padreId]?.emailContacto ||
    padres[padreId]?.emailPagador || alumnoTraslado.emailContacto ||
    alumnoTraslado.emailPagador || alumnoTraslado.email;
  if (!emailDestino) return showToast('Falta un correo de contacto. No se ha cambiado el grupo.', 'error');
  const anterior = `${alumnoTraslado.dias} ${alumnoTraslado.horario}`;
  if (!window.confirm(`¿Trasladar a ${alumnoTraslado.nombre}?\n\nDe: ${actividadTraslado.nombre} — ${anterior}\nA: ${destinoTraslado.actividad.nombre} — ${destinoTraslado.opcion.dias} ${destinoTraslado.opcion.horario}\nCuota: ${alumnoTraslado.precio} → ${destinoTraslado.opcion.precio}\n\nSe avisará a ${emailDestino}.`)) return;
  setTrasladoEnCurso(true);
  try {
    const resultado = await trasladarGrupoAtomico({
      alumnoId: alumnoTraslado.id,
      actividadOrigenId: actividadTraslado.id,
      actividadDestinoId: destinoTraslado.actividad.id,
      opcion: destinoTraslado.opcion,
      origenEsperado: { dias: alumnoTraslado.dias, horario: alumnoTraslado.horario, precio: alumnoTraslado.precio }
    });
    setTrasladoId(null);
    setOpcionTraslado('');
    let avisoSolicitado = false;
    try {
      await enviarAvisoTraslado(emailDestino, resultado.nombre, resultado.anterior, resultado.nuevo);
      avisoSolicitado = true;
    } catch (error) {
      console.error('El traslado se guardó, pero falló la solicitud de correo:', error);
    }
    try {
      await addDoc(collection(db, 'logs'), {
        fecha: Date.now(), alumnoId: alumnoTraslado.id, alumnoNombre: resultado.nombre,
        accion: 'CAMBIO_GRUPO',
        detalles: `${resultado.anterior} → ${resultado.nuevo}. Correo solicitado: ${avisoSolicitado ? 'sí' : 'no'}`,
        adminEmail: emailNormalizado
      });
    } catch (error) { console.error('No se pudo registrar el traslado en logs:', error); }
    showToast(avisoSolicitado
      ? 'Inscripción cambiada. Se ha solicitado el correo de confirmación.'
      : `Inscripción cambiada, pero NO se pudo solicitar el correo a ${emailDestino}. Contacta con la familia.`,
    avisoSolicitado ? 'success' : 'warning');
  } catch (error) {
    console.error('Traslado rechazado:', error);
    const mensajes = {
      GRUPO_COMPLETO: 'El grupo de destino ya está completo. No se ha cambiado nada.',
      GRUPO_CAMBIADO: 'La ficha cambió mientras la consultabas. Vuelve a revisar el grupo.',
      AFORO_ORIGEN_INCONSISTENTE: 'Las plazas de origen no coinciden con la ficha. No se ha cambiado nada.',
      AFORO_NO_INICIALIZADO: 'Falta un contador de plazas. No se ha cambiado nada.'
    };
    showToast(mensajes[error.message] || 'No se pudo cambiar el grupo. No se ha modificado la inscripción.', 'error');
  } finally {
    setTrasladoEnCurso(false);
  }
};
  // --- 2. CARGA DE DATOS (EFECTOS) ---
  useEffect(() => {
    // 1. Radar de Alumnos (Intacto)
    const unsubStudents = onSnapshot(query(collection(db, 'students')), (s) => {
      const alumnosCargados = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlumnos(alumnosCargados);
      if (puedeGestionarTodo && !aforosInicializadosRef.current) {
        aforosInicializadosRef.current = true;
        inicializarAforosSiFaltan(alumnosCargados).catch(error => {
          aforosInicializadosRef.current = false;
          console.error('No se pudieron inicializar los contadores de aforo:', error);
          showToast('No se pudo preparar el control de plazas. No se admitirán altas hasta corregirlo.', 'error');
        });
      }
    }, (error) => {
      console.error("Error en alumnos:", error);
      showToast("Error al cargar alumnos: " + error.message, "error");
    });
    
    // 2. Radar de Padres (Solo si tiene permisos de gestión)
    let unsubUsers = () => {};
    if (puedeGestionarTodo) {
      unsubUsers = onSnapshot(query(collection(db, 'users')), (s) => {
          const p = {};
          s.forEach(d => { p[d.id] = d.data(); });
          setPadres(p); 
      }, (error) => {
          console.error("Error en padres:", error);
          showToast("Error al cargar tutores: " + error.message, "error");
      });
    }

    // 3. 🚀 Radar de Equipo (Admins ven todo el equipo; monitores ven su propia ficha)
    let unsubEquipo = () => {};
    if (puedeGestionarTodo) {
      unsubEquipo = onSnapshot(query(collection(db, 'equipo'), orderBy('nombre', 'asc')), (s) => {
        setEquipo(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error("Error en equipo:", error);
        showToast("Error al cargar equipo: " + error.message, "error");
      });
    } else if (esPersonalMonitor && emailNormalizado) {
      unsubEquipo = onSnapshot(
        query(collection(db, 'equipo'), where('email', '==', emailNormalizado)),
        (s) => {
          setEquipo(s.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (error) => {
          console.error("Error al cargar ficha del monitor:", error);
        }
      );
    }

    // 4. Radar de Avisos (Intacto)
    const unsubAvisos = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => {
      setAvisos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error en avisos:", error);
    });

    // 🧹 Limpieza al salir
    return () => { 
      unsubStudents(); 
      unsubUsers(); 
      unsubEquipo(); 
      unsubAvisos(); 
    };
  }, [puedeGestionarTodo, esPersonalMonitor, emailNormalizado]);
// 🏊‍♂️ FILTRO DE ALUMNOS PARA EL MONITOR
  // ---------------------------------------------------------
  const alumnosAsignados = alumnos.filter(alumno => {
    if (!soyMonitor) return false;
    const susGrupos = datosMonitor?.gruposAsignados || [];
    return (susGrupos.includes(alumno.actividad) || susGrupos.includes(alumno.actividadId)) && alumno.estado === 'inscrito';
  });
 
  // --- 3. FUNCIONES ---
  // 🎯 FUNCIÓN PARA ACEPTAR DESDE PRUEBAS DE NIVEL (INTELIGENTE: RESERVA VS CURSO)
  const aceptarAlumnoDirecto = async (e, alumno) => {
    if (e && e.stopPropagation) e.stopPropagation();

    const grupoDestino = alumno.actividad || 'Sin asignar';
    if (grupoDestino === 'Sin asignar') return showToast("El alumno no tiene un grupo asignado.", "warning");

    if (!confirm(`¿Inscribir a ${alumno.nombre} en ${grupoDestino}?`)) return;

    try {
      const alumnoRef = doc(db, 'students', alumno.id);
      
      const hoy = new Date();
      const fechaParaDB = calcularFechaAlta(alumno.inicioDeseado, hoy).fechaYMD;

      const actividadId = obtenerActividadIdAlumno(alumno);
      if (!actividadId) throw new Error('No se ha podido identificar la actividad del alumno.');
      const actividadDoc = OFERTA_ACTIVIDADES.find(a => a.id === actividadId);
      const resultadoReserva = await reservarPlazaAtomica({
        alumnoId: alumno.id,
        actividadId,
        actividad: alumno.actividad || actividadDoc.nombre,
        dias: alumno.dias,
        horario: alumno.horario,
        curso: alumno.curso,
        datosExtra: {
          fechaValidacion: hoy.toISOString(),
          fechaAlta: fechaParaDB,
          fecha_alta: fechaParaDB,
          inicioDeseado: fechaParaDB,
          fechaSolicitud: fechaParaDB
        }
      });

      // 📧 ENVÍO DE EMAIL
      const padreId = alumno.parentId || alumno.user;
      const emailPadre = padres[padreId]?.email || padres[padreId]?.emailContacto || padres[padreId]?.emailPagador || alumno.emailContacto || alumno.emailPagador || alumno.email || null;
      if (emailPadre) {
        const detalleGrupoCompleto = `${alumno.actividad} — ${alumno.dias} a las ${alumno.horario}`;
        await enviarEmailConfirmacion(
          emailPadre,
          alumno.nombre,
          detalleGrupoCompleto,
          resultadoReserva.resultado === 'lista_espera' ? 'lista_espera' : 'alta',
          fechaParaDB
        );
      }

      // 🚩 LOG DE AUDITORÍA
      await addDoc(collection(db, 'logs'), {
        fecha: hoy.getTime(),
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre,
        accion: "ACEPTAR_PRUEBA",
        detalles: `Alta confirmada para: ${fechaParaDB}`,
        adminEmail: emailNormalizado || 'admin' 
      });

      showToast(
        resultadoReserva.resultado === 'lista_espera'
          ? `El grupo está completo. ${alumno.nombre} pasa a la lista de espera.`
          : `¡Perfecto! La ficha de ${alumno.nombre} se ha activado para el: ${fechaParaDB.split('-').reverse().join('/')}`,
        resultadoReserva.resultado === 'lista_espera' ? 'warning' : 'success'
      );
      
      // ✨ ¡MAGIA! Hemos quitado window.location.reload();
      // Si tienes el radar de nombres abierto abajo, lo cerramos para limpiar la vista:
      if (typeof setFiltroRadar === 'function') setFiltroRadar(null);

    } catch (error) {
      console.error("Error al aceptar:", error);
      showToast("No se pudo procesar: " + error.message, "error");
    }
  };
  
  // Abrir Ficha: Combina datos del alumno con los del padre
  const abrirFicha = (alumno) => {
    // 1. Identificamos al padre
    const padreId = alumno.parentId || alumno.user; 
    const datosPadre = padres[padreId] || {};
    
    // 2. Buscamos el nombre en "cascada" (si no está en uno, busca en el siguiente)
    const nombreFinal = 
        datosPadre.nombre ||              // Campo unificado nuevo
        datosPadre.personaContacto ||     // Campo de registro interno
        datosPadre.nombrePagador ||       // Campo de registro externo
        alumno.nombrePagador ||           // A veces se guarda en el alumno
        alumno.personaContacto ||         // A veces se guarda en el alumno
        datosPadre.displayName ||         // Nombre de Google/Auth
        'No indicado';

    // 3. Hacemos lo mismo con el DNI
    const dniFinal = 
        datosPadre.dni || 
        datosPadre.dniPagador || 
        alumno.dniPagador || 
        'No indicado';

    setAlumnoSeleccionado({ 
        ...alumno, 
        nombreTutor: nombreFinal,
        dniTutor: dniFinal,
        datosPadre: datosPadre 
    });
};

const imprimirListaAsistencia = (datos, infoGrupo) => {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    showToast('Permite las ventanas emergentes para imprimir la lista de asistencia.', 'warning');
    return;
  }

  const nombreGrupoSeguro = escaparHtml(infoGrupo?.nombre || '');
  const diaGrupoSeguro = escaparHtml(infoGrupo?.dia || '');

  // Construimos una tabla HTML sencilla y compacta para la impresión (escapada contra XSS)
  const filas = datos.map((a, i) => `
    <tr style="border-bottom: 1px solid #e2e8f0; height: 32px;">
      <td style="padding: 6px 10px; text-align: center; font-size: 11px; font-weight: bold; color: #475569; border-right: 1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding: 6px 12px; font-size: 12px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">${escaparHtml(a.nombre)}</td>
      <td style="padding: 6px 12px; font-size: 10px; font-weight: 600; color: #475569; text-transform: uppercase; border-right: 1px solid #e2e8f0;">${escaparHtml(a.curso)}</td>
      ${Array(4).fill('<td style="border-right: 1px solid #cbd5e1; width: 45px;"></td>').join('')} 
    </tr>
  `).join('');

  ventana.document.write(`
    <html>
      <head>
        <title>Lista de Asistencia - ${nombreGrupoSeguro}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { 
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            color: #0f172a;
            margin: 0;
            padding: 0;
            line-height: 1.4;
          }
          .header { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .header-left h1 {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            margin: 0;
            color: #1e3a8a;
          }
          .header-left p {
            font-size: 11px;
            margin: 3px 0 0 0;
            color: #475569;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-right {
            text-align: right;
          }
          .header-right .badge {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px; 
            border: 1px solid #cbd5e1;
          }
          th { 
            background: #f8fafc; 
            color: #1e3a8a;
            font-size: 10px; 
            font-weight: 900; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
            padding: 8px 10px; 
            text-align: left; 
            border-bottom: 2px solid #cbd5e1;
            border-right: 1px solid #cbd5e1;
          }
          .footer-signature {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
            font-weight: bold;
          }
          .signature-box {
            width: 200px;
            border-top: 1px dashed #cbd5e1;
            text-align: center;
            padding-top: 6px;
            margin-top: 30px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>Colegio San Buenaventura</h1>
            <p>🏊 Control de Asistencia - Natación Extraescolar</p>
          </div>
          <div class="header-right">
            <span class="badge">Natación CSB</span>
          </div>
        </div>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; gap: 15px; font-size: 11px;">
          <div>Grupo: <strong style="color: #1e3a8a; text-transform: uppercase;">${nombreGrupoSeguro}</strong></div>
          <div>Día de Clase: <strong style="color: #1e3a8a; text-transform: uppercase;">${diaGrupoSeguro}</strong></div>
          <div>Fecha Impresión: <strong style="color: #475569;">${new Date().toLocaleDateString('es-ES')}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>Alumno</th>
              <th style="width: 110px;">Curso</th>
              <th style="width: 45px; text-align: center;">Sem 1</th>
              <th style="width: 45px; text-align: center;">Sem 2</th>
              <th style="width: 45px; text-align: center;">Sem 3</th>
              <th style="width: 45px; text-align: center;">Sem 4</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        <div class="footer-signature">
          <div>Incidencias: ________________________________________________________________</div>
          <div class="signature-box">Firma del Monitor</div>
        </div>

        <script>window.print();</script>
      </body>
    </html>
  `);
  ventana.document.close();
};
// --- 🚩 PASO 1: LÓGICA DE FECHAS DE ALTA (UNIFICADA) ---
const obtenerInfoAlta = () => obtenerInfoInicioInscripcion();
const validarPlaza = async (alumno) => {
  if (userRole !== 'admin') return showToast("Solo coordinadores.", "error");
  
  // 1. 🔍 BUSCADOR DE IDs (Limpiado)
  let actId = alumno.actividadId;
  const actText = (alumno.actividad || "").toLowerCase();
  if (!actId) {
      if (actText.includes('chapoteo')) actId = 'chapoteo';
      else if (actText.includes('16:15')) actId = 'primaria_1615';
      else if (actText.includes('1º-3º')) actId = 'primaria_123_tarde';
      else if (actText.includes('4º-6º')) actId = 'primaria_456_tarde';
      else if (actText.includes('waterpolo')) actId = 'waterpolo';
      else if (actText.includes('nado') || actText.includes('libre')) actId = 'nado_libre';
      else if (actText.includes('eso') || actText.includes('bach')) actId = 'eso_bach';
      else if (actText.includes('adulto')) actId = 'adultos';
      else if (actText.includes('aquagym')) actId = 'aquagym';
  }
  if (!actId) return showToast('No se ha podido identificar la actividad.', 'error');

  // La promoción respeta el orden de llegada dentro del grupo exacto.
  if (alumno.estado === 'lista_espera') {
    const slotsSolicitados = construirSlotsAforo({ actividadId: actId, dias: alumno.dias, horario: alumno.horario, curso: alumno.curso });
    const grupoEspera = alumno.waitlistGroupKey || claveListaEspera(slotsSolicitados);
    const fechaOrden = item => {
      const valor = item.waitlistJoinedAt || item.fechaInscripcion;
      if (valor?.toMillis) return valor.toMillis();
      if (valor?.seconds) return valor.seconds * 1000;
      const ms = new Date(valor || 0).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    const primero = alumnos
      .filter(item => {
        if (item.estado !== 'lista_espera') return false;
        try {
          const itemActId = obtenerActividadIdAlumno(item);
          const itemKey = item.waitlistGroupKey || claveListaEspera(construirSlotsAforo({ actividadId: itemActId, dias: item.dias, horario: item.horario, curso: item.curso }));
          return itemKey === grupoEspera;
        } catch (_) { return false; }
      })
      .sort((a, b) => fechaOrden(a) - fechaOrden(b))[0];
    if (primero && primero.id !== alumno.id) {
      return showToast(`Debe entrar primero ${primero.nombre}, que encabeza la lista de este grupo.`, 'warning');
    }
  }

  // --- 📅 2. LÓGICA DE FECHAS ÚNICA Y UNIFICADA ---
  const altaCalculada = calcularFechaAlta(alumno.inicioDeseado);
  const fechaParaDB = altaCalculada.fechaYMD;
  const textoInicioReal = altaCalculada.textoInicio;

  // 3. CONFIRMACIÓN
  if (!confirm(`✅ ¿Validar plaza definitiva para ${alumno.nombre}?\n\n📅 INICIO: ${textoInicioReal}\n📍 GRUPO: ${alumno.actividad}`)) return;

  try {
      const idCorrecto = String(alumno.id || alumno.docId || alumno.uid || "").trim();
      if (!idCorrecto || idCorrecto === "undefined") throw new Error("ID no localizado.");

      const padreId = alumno.parentId || alumno.user;
      const emailPadre = padres[padreId]?.email || padres[padreId]?.emailContacto || padres[padreId]?.emailPagador || alumno.emailContacto || alumno.emailPagador || alumno.email || null;
      
      const actividadDoc = OFERTA_ACTIVIDADES.find(a => a.id === actId);
      const resultadoReserva = await reservarPlazaAtomica({
        alumnoId: idCorrecto,
        actividadId: actId,
        actividad: alumno.actividad || actividadDoc.nombre,
        dias: alumno.dias,
        horario: alumno.horario,
        curso: alumno.curso,
        datosExtra: {
          fechaAlta: fechaParaDB,
          fechaInicioReal: textoInicioReal
        }
      });

      // 📧 4. EMAIL
      if (emailPadre) {
        try {
          await enviarEmailConfirmacion(
            emailPadre, 
            alumno.nombre, 
            `${alumno.actividad || 'Natación'} — ${alumno.dias || ''} ${alumno.horario || ''}`, 
            resultadoReserva.resultado === 'lista_espera' ? 'lista_espera' : 'alta', 
            fechaParaDB
          );
        } catch (e) { console.warn("Email falló: ", e); }
      }

      // 📜 5. LOGS
      await addDoc(collection(db, 'logs'), {
        fecha: new Date().getTime(),
        alumnoId: idCorrecto,
        alumnoNombre: alumno.nombre,
        accion: "VALIDACIÓN_ADMIN",
        detalles: `Alta confirmada para ${fechaParaDB}`,
        adminEmail: emailNormalizado || 'admin'
      });

      showToast(
        resultadoReserva.resultado === 'lista_espera'
          ? 'El grupo sigue completo. El alumno permanece en lista de espera.'
          : `GUARDADO CON ÉXITO. Fecha Alta: ${fechaParaDB}`,
        resultadoReserva.resultado === 'lista_espera' ? 'warning' : 'success'
      );
      // La recarga ya no es necesaria gracias al listener en tiempo real onSnapshot

  } catch (error) {
      showToast("Error: " + error.message, "error");
  }
};

// ---------------------------------------------------------
  // 📉 GESTIÓN DE BAJAS (LÓGICA CORREGIDA)
  // ---------------------------------------------------------

// A) TRAMITAR: Busca el email en el usuario Padre y envía el correo con éxito
const tramitarBaja = async (alumno) => {
  if (userRole !== 'admin') return showToast("Solo coordinadores.", "error");
  
  const hoy = new Date();
  const mesesASumar = hoy.getDate() > 25 ? 2 : 1;
  const fechaObj = new Date(hoy.getFullYear(), hoy.getMonth() + mesesASumar, 1);
  
  const y = fechaObj.getFullYear();
  const m = String(fechaObj.getMonth() + 1).padStart(2, '0');
  const d = String(fechaObj.getDate()).padStart(2, '0');
  const fechaCalculada = `${y}-${m}-${d}`;
  const fechaFormateada = `${d}/${m}/${y}`;

  if (confirm(`📉 ¿Aceptar baja de ${alumno.nombre}?\n\n📅 Fecha efectiva: ${fechaCalculada}\n\n(Se enviará un correo de confirmación a la familia)`)) {
      try {
          // 1. La baja y la liberación de plaza se hacen en la misma transacción.
          await liberarPlazaAtomica({
            alumnoId: alumno.id,
            datosFinales: {
              estado: 'baja_finalizada',
              fechaBaja: fechaCalculada
            }
          });

          // 2. BÚSQUEDA OPTIMIZADA A COSTE CERO DEL EMAIL DEL PADRE
          const padreId = alumno.parentId || alumno.user;
          const emailDestino = padres[padreId]?.email || padres[padreId]?.emailContacto || padres[padreId]?.emailPagador || alumno.emailContacto || alumno.emailPagador || alumno.email || null;

          console.log("🎯 Email final encontrado para enviar:", emailDestino);

          // 4. SI YA TENEMOS EL EMAIL, CREAMOS EL PAPELITO EN FIREBASE
          if (emailDestino) {
              const nombreSeguroBaja = escaparHtml(alumno.nombre);
              const fechaSeguraBaja = escaparHtml(fechaFormateada);
              await addDoc(collection(db, 'mail'), {
                  to: [emailDestino],
                  message: {
                      subject: `📉 Confirmación de Baja: ${alumno.nombre}`,
                      html: `
                          <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 15px; max-width: 600px;">
                              <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-top: 0;">
                                 🏊 Tramitación de Baja Efectiva
                              </h2>
                              <p>Hola familia de <strong>${nombreSeguroBaja}</strong>,</p>
                              <p>Te escribimos para confirmarte que hemos procesado correctamente la solicitud de baja en la actividad de natación extraescolar.</p>

                              <div style="background: #FEF2F2; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid #FCA5A5;">
                                  <p style="margin: 0; color: #991B1B; font-weight: bold;">📍 Detalles del Trámite:</p>
                                  <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Alumno:</strong> ${nombreSeguroBaja}</p>
                                  <p style="margin: 5px 0 0 0; font-size: 16px; color: #b91c1c;"><strong>📅 Fecha de efecto:</strong> ${fechaSeguraBaja}</p>
                                  <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;"><strong>Estado:</strong> Baja Tramitada Correctamente</p>
                              </div>

                              <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                                  Sentimos mucho que no puedas continuar con nosotros este trimestre. ¡Esperamos volver a verte muy pronto con las gafas de bucear puestas! 🌊
                              </p>
                              <p style="margin-top: 25px;">Saludos,<br><strong>Coordinación de Extraescolares CSB</strong></p>
                              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                              <p style="font-size: 11px; color: #999;">Este es un mensaje automático generado por el sistema de gestión de piscina.</p>
                          </div>
                      `
                  }
              });
              console.log("🚀 ¡Perfecto! Documento de correo creado en la colección 'mail'.");
          } else {
              console.log("⚠️ Alerta: No se encontró ningún email ni en el alumno ni en el usuario padre.");
          }

          try {
              await addDoc(collection(db, 'logs'), {
                  fecha: Date.now(),
                  alumnoId: alumno.id,
                  alumnoNombre: alumno.nombre || '',
                  accion: 'TRAMITAR_BAJA',
                  detalles: `Baja tramitada con fecha efectiva ${fechaCalculada}`,
                  adminEmail: emailNormalizado || 'admin'
              });
          } catch (logErr) {
              console.error('No se pudo registrar la baja en logs:', logErr);
          }

          showToast("✅ Baja tramitada correctamente.", "success");

      } catch (error) {
          console.error("❌ Error en el proceso de baja:", error);
          showToast("❌ Hubo un error al tramitar la baja: " + error.message, "error");
      }
  }
};

// B) ARCHIVAR: Borrar definitivamente de la lista
const archivarBaja = async (alumno) => {
    if (userRole !== 'admin') return;
    if (confirm(`🗑️ ¿Eliminar DEFINITIVAMENTE a ${alumno.nombre} de la lista?\n\nLa plaza quedará libre.`)) {
        await liberarPlazaAtomica({ alumnoId: alumno.id, datosFinales: {
            estado: 'sin_inscripcion', // Aquí desaparece de la lista
            actividad: null, dias: null, horario: null, precio: null,
            citaId: null, citaNivel: null, citaFecha: null, citaHora: null,
            validadoAdmin: null, fechaSolicitudBaja: null,
            fechaAlta: null, fechaBaja: null, grupo: null, revisadoAdmin: null
        }});
    }
};

  const borrarAlumno = async (e, id) => { 
      e.stopPropagation(); // Evita abrir ficha al borrar
      if (userRole !== 'admin') return; 
      const alumno = alumnos.find(a => a.id === id);
      if (!confirm('⚠️ ¿Retirar al alumno?')) return;
      if (alumno?.estado === 'inscrito' || alumno?.estado === 'baja_pendiente') {
        await liberarPlazaAtomica({ alumnoId: id, datosFinales: { estado: 'sin_inscripcion' } });
      }
      await deleteDoc(doc(db, 'students', id));
  }
  
  const agregarAviso = async (e) => { e.preventDefault(); if (!nuevoAviso) return; await addDoc(collection(db, 'avisos'), { texto: nuevoAviso, fecha: new Date().toISOString() }); setNuevoAviso(''); };
  const borrarAviso = async (id) => { if (confirm('¿Borrar aviso?')) await deleteDoc(doc(db, 'avisos', id)); };
  const borrarMiembroEquipo = async (miembro) => {
    const emailMiembro = normalizarEmail(miembro.email);
    if (emailMiembro === emailNormalizado) return showToast("No puedes borrarte a ti mismo", "warning");
    if (confirm(`¿Borrar a ${miembro.nombre || miembro.email} del equipo?`)) {
      try {
        await deleteDoc(doc(db, 'equipo', miembro.id));

        const idsUsuariosABorrar = new Set();
        if (miembro.uid) idsUsuariosABorrar.add(miembro.uid);

        const correosConsulta = [...new Set([miembro.email, emailMiembro].filter(Boolean))];
        for (const correo of correosConsulta) {
          const snap = await getDocs(query(collection(db, 'users'), where('email', '==', correo)));
          snap.forEach((d) => {
            const rol = d.data()?.role;
            if (rol !== 'admin') idsUsuariosABorrar.add(d.id);
          });
        }

        for (const uid of idsUsuariosABorrar) {
          await deleteDoc(doc(db, 'users', uid));
        }

        showToast("✅ Miembro eliminado del equipo y permisos revocados.", "success");
      } catch (err) {
        showToast("❌ Error al eliminar: " + err.message, "error");
      }
    }
  };
  
  const descargarExcel = async (completo = false) => {
    if (!puedeGestionarTodo || exportando) return;
    setExportando(true);
    try {
      // La exportación consulta el servidor y no depende del buscador ni de la caché local.
      const [studentsSnap, usersSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'students')),
        getDocsFromServer(collection(db, 'users'))
      ]);
      const responsables = Object.fromEntries(usersSnap.docs.map(d => [d.id, d.data()]));
      const resultado = prepararExportacion(studentsSnap.docs.map(d => ({ ...d.data(), id: d.id })), responsables, OFERTA_ACTIVIDADES, mesExportacion, completo);
      if (!resultado.filas) return showToast('No hay registros para esta selección.', 'warning');
      const detalle = completo ? 'Listado completo de gestión' : `Borrador mensual: ${mesExportacion}`;
      if (!window.confirm(`${detalle}\n\n${resultado.filas} registros; ${resultado.revisar} para revisar.\n\nSe conserva cada día contratado. Los importes usan la tarifa actual; los descuentos, devoluciones o cambios históricos deben revisarse. No se ejecutará ningún cobro. ¿Descargar?`)) return;
      const urlArchivo = URL.createObjectURL(new Blob([resultado.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = urlArchivo;
      link.download = completo ? 'listado_PAGOS_completo.csv' : `borrador_PAGOS_${mesExportacion}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(urlArchivo), 1000);
      setMostrarExportacion(false);
      showToast(`Descargados ${resultado.filas} registros; ${resultado.revisar} para revisar.`, 'success');
    } catch (error) {
      console.error('Error de exportación:', error);
      showToast('No se pudo consultar el listado actualizado. Comprueba la conexión y vuelve a intentarlo.', 'error');
    } finally { setExportando(false); }
  };
  // 🔄 FUNCIÓN PARA SINCRONIZAR IDs ANTIGUOS
  const sincronizarAlumnosAntiguos = async () => {
    const confirmacion = window.confirm("¿Sincronizar IDs y DÍAS de alumnos antiguos?");
    if (!confirmacion) return;

    const promesas = alumnos.map(async (alumno) => {
      let updates = {};
      const actText = (alumno.actividad || '').toLowerCase(); // <--- Esta es tu variable

      // 1. Detectar ID (Si no lo tiene)
      if (!alumno.actividadId) {
          if (actText.includes('chapoteo')) updates.actividadId = 'chapoteo';
          else if (actText.includes('16:15')) updates.actividadId = 'primaria_1615';
          else if (actText.includes('1º-3º')) updates.actividadId = 'primaria_123_tarde';
          else if (actText.includes('4º-6º')) updates.actividadId = 'primaria_456_tarde';
          else if (actText.includes('waterpolo')) updates.actividadId = 'waterpolo';
          else if (actText.includes('nado libre') || actText.includes('libre')) updates.actividadId = 'nado_libre';
          // ⬇️ CORREGIDO: Usamos actText y no texto
          else if (actText.includes('eso') || actText.includes('bach')) updates.actividadId = 'eso_bach';
          else if (actText.includes('adulto')) updates.actividadId = 'adultos';
          else if (actText.includes('aquagym')) updates.actividadId = 'aquagym';
      }

        // 2. Detectar DÍAS (Vital para el aforo diario)
        // Si el texto de la actividad dice "Lunes", le asignamos "Lunes"
        if (!alumno.dias) {
            if (actText.includes('lunes')) updates.dias = 'Lunes';
            if (actText.includes('martes')) updates.dias = 'Martes';
            if (actText.includes('miércoles')) updates.dias = 'Miércoles';
            if (actText.includes('jueves')) updates.dias = 'Jueves';
            if (actText.includes('viernes')) updates.dias = 'Viernes';
            // Para los packs
            if (actText.includes('lunes y miércoles')) updates.dias = 'Lunes y Miércoles';
            if (actText.includes('martes y jueves')) updates.dias = 'Martes y Jueves';
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'students', alumno.id), updates);
        }
    });

    await Promise.all(promesas);
    showToast("¡Sincronización de IDs y Días completada!", "success");
};

  // --- 4. LISTAS FILTRADAS ---
  const gruposUnicos = [...new Set(alumnos.map(a => a.actividad).filter(g => g))].sort();
// --- 📈 LÓGICA DE PREVISIÓN UNIFICADA (Junio-Septiembre = Octubre; resto = mes siguiente) ---
const infoPrevision = obtenerInfoInicioInscripcion();
const esTemporadaReserva = infoPrevision.esPeriodoReserva;
const mesSigNom = infoPrevision.mesSiguiente;
const patronMesSig = infoPrevision.patronMesPrevision;

// 1. Limpiamos la base
const alumnosReales = alumnos.filter(a => a.nombre && a.estado);

// 2. ALTAS: Solo si su fecha de ALTA coincide con el patrón (ej: "2026-10") y están inscritos
const previsAltas = alumnosReales.filter(a => 
  a.estado === 'inscrito' && a.fechaAlta && String(a.fechaAlta).startsWith(patronMesSig)
);

// 3. BAJAS: Salen si su fecha de BAJA coincide con el patrón
const previsBajas = alumnosReales.filter(a => {
  const coincideFecha = a.fechaBaja && String(a.fechaBaja).startsWith(patronMesSig);
  const esEstadoBaja = ['baja_pendiente', 'baja_finalizada'].includes(a.estado);
  return coincideFecha && esEstadoBaja;
});

// 💰 FUNCIÓN PARA BUSCAR PRECIO REAL (Tu lógica original intacta)
const obtenerPrecioReal = (alumno) => {
  if (alumno.precio) return parseInt(alumno.precio);
  const actividadMatch = OFERTA_ACTIVIDADES.find(act => 
    act.nombre === alumno.actividad || act.id === alumno.actividadId
  );
  if (actividadMatch) {
    const opcionMatch = actividadMatch.opciones?.find(op => op.dias === alumno.dias);
    if (opcionMatch) return parseInt(opcionMatch.precio);
    return parseInt(actividadMatch.precioResumen) || 0;
  }
  return 0;
};

// 📊 CÁLCULOS TOTALES (Basados en el mes inteligente)
const ingresosAltas = previsAltas.reduce((total, a) => total + obtenerPrecioReal(a), 0);
const perdidasBajas = previsBajas.reduce((total, a) => total + obtenerPrecioReal(a), 0);
const balanceNeto = previsAltas.length - previsBajas.length;
const balanceEconomico = ingresosAltas - perdidasBajas;
// --- 1. LISTADO GLOBAL (VITAMINADO CON BUSCADOR DE PADRES) ---
const listadoGlobal = alumnos.filter(a => {
  // 1. Obtenemos los datos del padre usando el parentId del alumno
  const p = padres[a.parentId] || {};
  
  const busq = busqueda.toLowerCase();
  
  // 2. ¿Coincide el nombre del niño?
  const coincideNombreNiño = (a.nombre || '').toLowerCase().includes(busq);
  
  // 3. ¿Coincide algún dato del responsable? (Nombre, Contacto o Pagador)
  // 🚩 Incluimos 'personaContacto' que es lo que añadimos ayer para registros internos
  const coincideResponsable = 
    (p.nombre || '').toLowerCase().includes(busq) || 
    (p.personaContacto || '').toLowerCase().includes(busq) ||
    (p.nombrePagador || '').toLowerCase().includes(busq);

  // 4. Filtro de grupo y estados
  const coincideGrupo = filtroGrupo ? a.actividad === filtroGrupo : true;
  
  // Mantenemos tus estados activos (sin lista de espera como querías)
  const estadosActivos = ['inscrito', 'requiere_prueba', 'prueba_reservada', 'baja_pendiente']; 
  const esAlumnoReal = estadosActivos.includes(a.estado);

  // RESULTADO: Si coincide el niño O el padre, y el grupo/estado es correcto, se muestra
  return (coincideNombreNiño || coincideResponsable) && coincideGrupo && esAlumnoReal;
});

// --- 2. LISTADO PRUEBAS (FILTRO BLINDADO) ---
const listadoPruebas = alumnos.filter(a => {
  // REGLA 1: Si ya está aceptado o revisado, FUERA (esto es lo que hace que desaparezcan al dar al botón)
  if (a.estado === 'inscrito' || a.revisadoAdmin === true || a.validadoAdmin === true) return false;

  // REGLA 2: Si es una baja o antiguo, FUERA (esto elimina a los fantasmas)
  if (a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada' || a.esAntiguoAlumno) return false;

  // REGLA 3: Exclusiones por categoría (Waterpolo, Infantil, Adultos)
  const act = (a.actividad || '').toUpperCase();
  const cur = (a.curso || '').toUpperCase();
  if (act.includes('INFANTIL') || cur.includes('INFANTIL') || 
      act.includes('ADULTO') || cur.includes('ADULTO') || 
      act.includes('WATERPOLO')) return false;

  // REGLA 4: Solo entran los que están esperando prueba
  // 🚩 CAMBIO: Añadimos check de citaNivel para evitar registros incompletos
  return a.estado === 'prueba_reservada' && a.citaNivel;
});

// 2. CORRECCIÓN BAJAS: Añadimos 'baja_finalizada' para que no desaparezcan
const listadoBajas = alumnos.filter(a => a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada');

  // --- 5. RENDERIZADO (HTML) ---
  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-24 font-sans relative">
     {/* HEADER RESPONSIVO CORREGIDO */}
<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded shadow gap-4">
  <div>
      <h1 className="text-xl font-black text-gray-800">Panel de Gestión</h1>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
        {userEmail} <span className="text-blue-500 mx-1">•</span> {userRole}
      </p>
  </div>

  <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
      {/* 🔄 BOTÓN DE SINCRONIZACIÓN */}
      {userRole === 'admin' && (
        <button 
          onClick={sincronizarAlumnosAntiguos} 
          className="flex-1 md:flex-none bg-amber-100 text-amber-700 px-3 py-2 md:py-1 rounded text-[10px] font-black border border-amber-200 hover:bg-amber-200 transition-colors uppercase whitespace-nowrap"
        >
          🔄 <span className="hidden xs:inline">Sincronizar</span>
        </button>
      )}

      {/* 📊 BOTÓN EXCEL */}
      {puedeGestionarTodo && (
        <button 
          onClick={() => setMostrarExportacion(true)}
          className="flex-1 md:flex-none bg-green-600 text-white px-3 py-2 md:py-1 rounded text-xs font-bold shadow-sm hover:bg-green-700 transition-colors uppercase whitespace-nowrap"
        >
          Excel
        </button>
      )}
      {/* 🔔 BOTÓN DE NOTIFICACIONES (SOLO SI EL NAVEGADOR LO SOPORTA; EVITA CRASH EN iOS SAFARI) */}
      {permisoNotificaciones !== 'unsupported' && (
        <button 
          onClick={solicitarPermisoNotificaciones}
          className={`p-2 rounded-full transition-all shadow-sm flex items-center justify-center border ${
            permisoNotificaciones === 'granted' 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
              : 'bg-amber-50 text-amber-600 border-amber-200 animate-bounce'
          }`}
          title="Activar avisos en este equipo"
        >
          <span className="text-sm">{permisoNotificaciones === 'granted' ? '🔔' : '🔕'}</span>
        </button>
      )}

      {/* 🚪 BOTÓN SALIR */}
      <button 
        onClick={logout} 
        className="flex-1 md:flex-none text-red-500 border border-red-200 px-3 py-2 md:py-1 rounded text-xs font-bold hover:bg-red-50 transition-colors uppercase whitespace-nowrap"
      >
        Salir
      </button>
  </div>
</div>

{/* PESTAÑAS AJUSTADAS ESTILO CHIPS FLOTANTES GLASSMORPHIC */}
<div className="flex gap-2 p-1.5 mb-8 overflow-x-auto scrollbar-hide bg-white/80 backdrop-blur-md border border-gray-100 rounded-2xl sticky top-2 z-40 shadow-sm">
  {['mis_clases', 'global', 'ocupacion', 'pruebas', 'espera', 'prevision', 'bajas', 'rentabilidad', 'equipo', 'avisos', 'correos'].map(t => {
     if (t === 'mis_clases' && !esPersonalMonitor && !datosMonitor) return null;
     if (t === 'correos' && !puedeGestionarTodo) return null;
     if ((t === 'equipo' || t === 'bajas' || t === 'prevision' || t === 'rentabilidad') && userRole !== 'admin') return null;
     
     let count = 0; 
     if (t === 'pruebas') count = listadoPruebas.length; 
     if (t === 'bajas') count = listadoBajas.length;
     if (t === 'espera') count = alumnos.filter(a => a.estado === 'lista_espera').length;
     if (t === 'prevision') count = previsAltas.length + previsBajas.length;

     return (
        <button 
          key={t} 
          onClick={() => setTab(t)} 
          className={`
            px-4 py-3 font-bold uppercase text-[9px] md:text-xs whitespace-nowrap 
            flex items-center justify-center gap-2 rounded-xl transition-all duration-300 transform active:scale-95 flex-1 min-w-[100px]
            ${tab === t 
              ? (t === 'espera' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 border border-amber-500 font-extrabold' : 
                 t === 'prevision' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-600 font-extrabold' :
                 t === 'rentabilidad' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 border border-emerald-600 font-extrabold' :
                 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-600 font-extrabold')
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 border border-transparent'
            }
          `}
        >
            <span className="text-sm">
  {t === 'global' && '👥'}
  {t === 'ocupacion' && '📊'}
  {t === 'pruebas' && '🎯'}
  {t === 'espera' && '⏳'}
  {t === 'prevision' && '📈'} 
  {t === 'bajas' && '📉'}
  {t === 'rentabilidad' && '💰'}
  {t === 'equipo' && '🛡️'}
  {t === 'avisos' && '📢'}
  {t === 'correos' && '✉️'}
  {t === 'mis_clases' && '🏊‍♂️'}
</span>
            
<span>
  {t === 'ocupacion' ? 'PLAZAS' :
   t === 'correos' ? 'CORREOS' :
   t === 'espera' ? 'ESPERA' : 
   t === 'prevision' ? 'PREVISIÓN' : 
   t === 'rentabilidad' ? 'RENTABILIDAD' :
   t === 'mis_clases' ? 'MIS CLASES' :
   t.toUpperCase()}
</span>

{count > 0 && (
  <span className={`
    text-[9px] px-2 py-0.5 rounded-full font-black font-mono shadow-sm transition-colors duration-300
    ${tab === t 
      ? 'bg-white text-slate-900 shadow-inner' 
      : (t === 'espera' ? 'bg-amber-100 text-amber-800' : t === 'prevision' ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800')
    }
  `}>
    {count}
  </span>
)}
        </button>
     );
  })}
</div>
     {mostrarExportacion && puedeGestionarTodo && (
       <div role="dialog" aria-modal="true" aria-labelledby="titulo-exportacion" className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
         <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
           <h2 id="titulo-exportacion" className="text-xl font-bold">Exportar alumnado y cuotas</h2>
           <label className="block font-bold text-sm">Mes de referencia
             <input aria-label="Mes de referencia" type="month" value={mesExportacion} onChange={e => setMesExportacion(e.target.value)} disabled={exportando} className="block w-full border rounded p-2 mt-2" />
           </label>
           <p className="text-sm text-slate-600">El borrador mensual excluye altas posteriores al mes y solicitudes sin inscripción confirmada. Conserva los dos días si hay dos registros. Los casos sin fecha quedan señalados para revisión y sin importe calculado.</p>
           <p className="text-sm bg-amber-50 border border-amber-200 rounded p-3">Los importes son una referencia con la tarifa actual. Revisa descuentos, devoluciones y cambios históricos antes de cobrar. No se aplica ningún ajuste automáticamente.</p>
           <button disabled={exportando || !mesExportacion} onClick={() => descargarExcel(false)} className="w-full bg-green-600 text-white font-bold rounded p-3 disabled:opacity-50">{exportando ? 'Consultando datos…' : 'Descargar borrador del mes'}</button>
           <button disabled={exportando || !mesExportacion} onClick={() => descargarExcel(true)} className="w-full border rounded p-3 disabled:opacity-50">Descargar listado completo de gestión</button>
           <button disabled={exportando} onClick={() => setMostrarExportacion(false)} className="w-full text-slate-500 p-2 disabled:opacity-50">Cerrar</button>
         </div>
       </div>
     )}
     {tab === 'correos' && puedeGestionarTodo && <ComunicacionesPanel
       alumnos={alumnos} padres={padres} userEmail={emailNormalizado} showToast={showToast}
     />}
     {/* 📊 MATRIZ DE OCUPACIÓN DIARIA (INTELIGENTE TEMPORADA OCTUBRE) */}
{tab === 'ocupacion' && (
  <div className="space-y-4 animate-fade-in">
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <span>🏊‍♂️</span> Control de Aforo Diario
        </h3>
        
        {/* Selector de Mes Inteligente */}
        <div className="flex bg-slate-700 p-1 rounded-lg">
          <button 
            onClick={() => setVistaMes('actual')}
            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${vistaMes === 'actual' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
          >
            {new Date().toLocaleString('es-ES', { month: 'long' })} (Ahora)
          </button>
          <button 
            onClick={() => setVistaMes('proximo')}
            className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${vistaMes === 'proximo' ? 'bg-blue-500 text-white' : 'text-slate-400'}`}
          >
            {/* En periodo de reserva (junio-septiembre) mostramos octubre; el resto del año, el mes siguiente. */}
            PREVISIÓN {mesSigNom}
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase border-r">Actividad</th>
              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(d => (
                <th key={d} className="p-4 text-[10px] font-black text-gray-400 uppercase text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'chapoteo', m: 16, n: 'Chapoteo (16:00)' },
              { id: 'primaria_1615', m: 12, n: 'Primaria 1º-3º (16:15)', cursosRelacionados: ['1PRI', '2PRI', '3PRI'] },
              { id: 'primaria_1615', m: 12, n: 'Primaria 4º-6º (16:15)', cursosRelacionados: ['4PRI', '5PRI', '6PRI'] },
              { id: 'primaria_123_tarde', m: 8, n: '1º-3º Prim (17:30)' },
              { id: 'primaria_456_tarde', m: 8, n: '4º-6º Prim (17:30)' },
              { id: 'waterpolo', m: 12, n: 'Waterpolo' },
              { id: 'eso_bach', m: 10, n: 'ESO / Bachillerato', cursosRelacionados: ['1ESO', '2ESO', '3ESO', '4ESO', '1BACH', '2BACH'] },
              { id: 'adultos', m: 10, n: 'Adultos' },
              { id: 'aquagym', m: 12, n: 'Aquagym' },
              { id: 'nado_libre', m: 10, n: 'Nado Libre (18:30-19:00)' } 
            ].map((g, index) => (
              <tr key={g.n + index} className="border-b hover:bg-gray-50/50 transition-colors">
                <td className="p-4 border-r bg-gray-50/30">
                  <p className="text-xs font-bold text-gray-700 leading-tight">{g.n}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Límite: {g.m}</p>
                </td>
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(dia => {
                  const ocupados = alumnos.filter(a => {
                    const coincideId = a.actividadId === g.id;
                    const coincideDia = a.dias?.toLowerCase().includes(dia.toLowerCase());
                    const listaCursos = g.cursosRelacionados || g.cursos;
                    const coincideCurso = listaCursos ? listaCursos.includes(a.curso) : true;
                    
                    if (!coincideId || !coincideDia || !coincideCurso) return false;

                     // --- 🧠 NUEVA LÓGICA TEMPORAL PARA TEMPORADA DE RESERVA ---
                    const academicInfo = getDynamicAcademicYear();
                    const fechaAlu = (a.fechaAlta || a.fechaInscripcion || "").toString();
                    const esAltaOctubre = fechaAlu.includes(academicInfo.rawPattern);

                    if (vistaMes === 'actual') {
                      // VISTA ABRIL: Solo inscritos actuales. EXCLUIMOS a los de Octubre.
                      return (a.estado === 'inscrito' || a.estado === 'baja_pendiente') && !esAltaOctubre;
                    } else {
                      // VISTA PREVISIÓN (Octubre en junio-septiembre; mes siguiente el resto del curso):
                      if (esTemporadaReserva) {
                        // Si estamos en pre-inscripción (junio-septiembre): Contamos los que están (y no son baja) + los de Octubre
                        if (a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada') return false;
                        return a.estado === 'inscrito' || esAltaOctubre;
                      } else {
                        // Resto del curso: Lógica de mes siguiente normal
                        if (a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada') return false;
                        return a.estado === 'inscrito' || fechaAlu.includes(patronMesSig);
                      }
                    }
                  }).length;

                  const tieneBajasProximas = alumnos.some(a => {
                    const coincideId = a.actividadId === g.id;
                    const coincideDia = a.dias?.toLowerCase().includes(dia.toLowerCase());
                    const listaCursos = g.cursosRelacionados || g.cursos;
                    const coincideCurso = listaCursos ? listaCursos.includes(a.curso) : true;
                    return coincideId && coincideDia && coincideCurso && a.estado === 'baja_pendiente';
                  });
                              
                  const critico = ocupados >= g.m;

                  return (
                    <td key={dia} className="p-2">
                      <div 
                        onClick={() => ocupados > 0 && setFiltroRadar({ 
                          id: g.id, 
                          nombre: g.n, 
                          dia: dia, 
                          cursos: g.cursosRelacionados || g.cursos,
                          mesVista: vistaMes
                        })}
                        className={`h-12 rounded-xl flex flex-col items-center justify-center border-2 transition-all cursor-pointer hover:shadow-inner active:scale-95 ${
                          ocupados === 0 ? 'border-dashed border-gray-100 text-gray-200' :
                          (vistaMes === 'actual' && tieneBajasProximas) ? 'bg-orange-500 border-orange-600 text-white font-black shadow-md' :
                          critico ? 'bg-red-500 border-red-600 text-white font-black shadow-md' :
                          ocupados > (g.m * 0.7) ? 'bg-amber-50 border-amber-200 text-amber-600' : 
                          'bg-emerald-50 border-emerald-100 text-emerald-600 font-bold'
                        }`}
                      >
                        <span className="text-sm leading-none">{ocupados > 0 ? ocupados : '-'}</span>
                        {ocupados > 0 && <span className="text-[8px] mt-1 opacity-60">/{g.m}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

{/* 📋 LISTA DETALLADA DE ALUMNOS (Aparece abajo al pulsar un número) */}
{filtroRadar && (
      <div className="bg-blue-600 rounded-2xl shadow-lg p-4 text-white animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="font-black text-sm uppercase tracking-tighter">Lista de Asistencia</h4>
            <p className="text-[10px] opacity-80 font-bold uppercase">{filtroRadar.nombre} — {filtroRadar.dia}</p>
          </div>
          
          {/* 🚩 CONTENEDOR DE BOTONES */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                // Filtramos los alumnos exactamente igual que en el Radar dinámico
                const hoy = new Date();
                const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
                const mesSigISO = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;

                const listaParaImprimir = alumnos.filter(a => {
                  const coincideId = a.actividadId === filtroRadar.id;
                  const coincideDia = a.dias?.toLowerCase().includes(filtroRadar.dia.toLowerCase());
                  const coincideCurso = filtroRadar.cursos ? filtroRadar.cursos.includes(a.curso) : true;
                  const fechaAlu = (a.fechaAlta || a.fechaInscripcion || "").toString();

                  if (!coincideId || !coincideDia || !coincideCurso) return false;

                  if (filtroRadar.mesVista === 'actual') {
                    const esAltaFutura = fechaAlu.includes(mesSigISO);
                    return (a.estado === 'inscrito' || a.estado === 'baja_pendiente') && !esAltaFutura;
                  } else {
                    if (a.estado === 'baja_pendiente') return false;
                    return a.estado === 'inscrito' || fechaAlu.includes(mesSigISO);
                  }
                });
                imprimirListaAsistencia(listaParaImprimir, filtroRadar);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
            >
              <span>🖨️</span> Imprimir
            </button>

            <button 
              onClick={() => setFiltroRadar(null)}
              className="bg-white/20 hover:bg-white/40 p-2 rounded-full transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {alumnos
            .filter(a => {
              const coincideId = a.actividadId === filtroRadar.id;
              const coincideDia = a.dias?.toLowerCase().includes(filtroRadar.dia.toLowerCase());
              const coincideCurso = filtroRadar.cursos ? filtroRadar.cursos.includes(a.curso) : true;
              
              if (!coincideId || !coincideDia || !coincideCurso) return false;

              // Lógica dinámica de meses
              const hoy = new Date();
              const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
              const mesSigISO = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
              const fechaAlu = (a.fechaAlta || a.fechaInscripcion || "").toString();

              if (filtroRadar.mesVista === 'actual') {
                // Filtro para el mes en curso: Incluye inscritos/bajas pero quita altas futuras
                const esAltaFutura = fechaAlu.includes(mesSigISO);
                return (a.estado === 'inscrito' || a.estado === 'baja_pendiente') && !esAltaFutura;
              } else {
                // Filtro para el mes siguiente: Quita bajas y suma altas nuevas
                if (a.estado === 'baja_pendiente') return false;
                return a.estado === 'inscrito' || fechaAlu.includes(mesSigISO);
              }
            })
            .map(a => (
              <div 
                key={a.id} 
                onClick={() => { setFiltroRadar(null); abrirFicha(a); }}
                className="bg-white/10 hover:bg-white/20 border border-white/10 p-2 rounded-lg cursor-pointer flex justify-between items-center transition relative"
              >
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate">{a.nombre}</p>
                  <p className="text-[9px] opacity-60 italic">{a.curso}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.estado === 'baja_pendiente' && (
                    <span className="bg-orange-500 text-[7px] px-1.5 py-0.5 rounded font-black uppercase">Baja</span>
                  )}
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">ficha →</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    )}
  </div>
)}
{/* 🚀 TAB: PREVISIÓN (VERSION PRO CON DINERO Y RADAR) */}
{tab === 'prevision' && (
  <div className="space-y-6 animate-fade-in pb-20 text-left">
    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
      <div className="relative z-10">
        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Previsión: {mesSigNom}</h2>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
          Balance económico y gestión de plazas libres
        </p>
      </div>
      <div className="absolute right-[-10px] top-[-10px] text-8xl opacity-10">📈</div>
    </div>

    {/* TARJETAS CON DINERO REAL */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-2xl shadow-sm border-b-4 border-emerald-500">
        <p className="text-gray-400 text-[10px] font-black uppercase">Altas: +{ingresosAltas}€</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-3xl font-black text-slate-800">{previsAltas.length}</span>
          <span className="text-emerald-500 text-xl font-black">↑</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border-b-4 border-red-500">
        <p className="text-gray-400 text-[10px] font-black uppercase">Bajas: -{perdidasBajas}€</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-3xl font-black text-slate-800">{previsBajas.length}</span>
          <span className="text-red-500 text-xl font-black">↓</span>
        </div>
      </div>

      <div className={`p-5 rounded-2xl shadow-sm border-b-4 ${balanceEconomico >= 0 ? 'border-indigo-500 bg-indigo-50' : 'border-orange-500 bg-orange-50'}`}>
        <p className="text-gray-400 text-[10px] font-black uppercase">Balance Neto</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-2xl font-black ${balanceEconomico >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
            {balanceEconomico > 0 ? `+${balanceEconomico}` : balanceEconomico}€
          </span>
          <span className="text-[10px] font-bold text-gray-500 uppercase italic">Caja</span>
        </div>
      </div>

      <div className="bg-amber-500 p-5 rounded-2xl shadow-sm border-b-4 border-amber-700 text-white">
        <p className="text-amber-100 text-[10px] font-black uppercase">Radar de Huecos</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-3xl font-black">{previsBajas.length}</span>
          <span className="text-xs font-bold uppercase opacity-80 italic">Libres</span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* COLUMNA ENTRADAS (ALTAS) */}
  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="bg-emerald-500 p-4 text-white font-black text-[10px] uppercase tracking-[0.2em] text-center">
      📥 Altas Confirmadas
    </div>
    <div className="divide-y divide-gray-50 max-h-[450px] overflow-y-auto">
      {previsAltas.map(a => (
        <div key={a.id} onClick={() => abrirFicha(a)} className="p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer group transition-colors text-left">
          <div>
            <p className="font-bold text-slate-800 text-sm">{a.nombre}</p>
            {/* 🚩 CORRECCIÓN: Mostramos Actividad + Días */}
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-tight">
              {a.actividad} <span className="text-gray-400 mx-1">•</span> {a.dias || 'Día no asignado'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-emerald-600 font-bold text-xs">+{obtenerPrecioReal(a)}€</p>
            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">Nuevo</span>
          </div>
        </div>
      ))}
      {previsAltas.length === 0 && <p className="p-10 text-center text-gray-400 text-xs italic">No hay altas para este mes</p>}
    </div>
  </div>

  {/* COLUMNA SALIDAS (BAJAS) */}
  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="bg-red-500 p-4 text-white font-black text-[10px] uppercase tracking-[0.2em] text-center">
      📤 Huecos que se liberan
    </div>
    <div className="divide-y divide-gray-50 max-h-[450px] overflow-y-auto">
      {previsBajas.map(a => {
        const candidatos = alumnos.filter(esp => esp.estado === 'lista_espera' && esp.actividad === a.actividad);
        
        return (
          <div key={a.id} className="p-4 flex flex-col gap-3 hover:bg-red-50/20 transition-all group text-left">
            <div className="flex justify-between items-center" onClick={() => abrirFicha(a)}>
              <div>
                <p className="font-bold text-slate-800 text-sm">{a.nombre}</p>
                {/* 🚩 CORRECCIÓN: Mostramos Actividad + Días */}
                <p className="text-[10px] text-red-600 font-black uppercase tracking-tight">
                  {a.actividad} <span className="text-gray-400 mx-1">•</span> {a.dias || 'Día no indicado'}
                </p>

                {/* 📅 CONTROL DE FECHAS SEGURO (NUEVO) */}
                <div className="mt-2 grid grid-cols-2 gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200/60 w-56">
                  <div>
                    <span className="block text-[8px] font-black text-gray-400 uppercase">📩 Solicitada:</span>
                    <span className="text-[10px] font-bold text-blue-900">
                      {a.fechaSolicitudBaja 
                        ? a.fechaSolicitudBaja.split('-').reverse().join('/') 
                        : 'No marcada'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-gray-400 uppercase">📅 Efectiva:</span>
                    <span className="text-[10px] font-bold text-red-600">
                      {a.fechaBaja 
                        ? a.fechaBaja.split('-').reverse().join('/') 
                        : 'Por tramitar'}
                    </span>
                  </div>
                </div>

              </div>
              <div className="text-right">
                <p className="text-red-500 font-bold text-xs">-{obtenerPrecioReal(a)}€</p>
                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase italic text-center">Salida</span>
              </div>
            </div>

            {/* BOTÓN INTELIGENTE: RADAR DE HUECOS (Mantenemos la funcionalidad que ya te gustaba) */}
            {candidatos.length > 0 && (
              <button 
                onClick={() => setRadarHueco(a)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-700 text-[9px] font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-amber-200 shadow-sm transition-all active:scale-95"
              >
                🎯 HAY {candidatos.length} CANDIDATOS PARA ESTE HUECO
              </button>
            )}
          </div>
        );
      })}
      {previsBajas.length === 0 && <p className="p-10 text-center text-gray-400 text-xs italic">No hay bajas tramitadas</p>}
    </div>
  </div>
</div>  </div>
)}
    {/* TAB: GLOBAL (ACTUALIZADO CON LISTA DE ESPERA) */}
    {tab === 'global' && (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in text-left">
        {/* CABECERA CON BUSCADOR GLASSMORPHIC MEJORADO */}
        <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100/30 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <span className="absolute left-3.5 top-3.5 text-slate-400 text-sm">🔍</span>
                <input 
                    className="w-full border border-slate-200 p-3 pl-10 rounded-2xl bg-white outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm text-sm font-medium text-slate-800" 
                    placeholder="Buscar por alumno o tutor..." 
                    value={busqueda} 
                    onChange={e => setBusqueda(e.target.value)} 
                />
                {busqueda && (
                  <button 
                    onClick={() => setBusqueda('')} 
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    ✕
                  </button>
                )}
            </div>
            <select 
                className="w-full md:w-1/3 border border-slate-200 p-3 rounded-2xl font-black text-slate-600 bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm text-xs tracking-wider uppercase cursor-pointer" 
                value={filtroGrupo} 
                onChange={e => setFiltroGrupo(e.target.value)}
            >
                <option value="">📂 Todos los Grupos</option>
                {gruposUnicos.map(g => (<option key={g} value={g}>{g}</option>))}
            </select>
        </div>

        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 uppercase text-[10px] font-black tracking-widest text-slate-500 border-b border-slate-100">
                <tr>
                    <th className="p-4">Alumno / Responsable</th>
                    <th className="p-4">Actividad / Alta</th>
                    <th className="p-4 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {listadoGlobal.length > 0 ? listadoGlobal.map(a => (
                    <tr 
                      key={a.id} 
                      onClick={() => abrirFicha(a)} 
                      className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                          a.estado === 'baja_pendiente' ? 'bg-red-50/40 hover:bg-red-50/70' : 
                          a.estado === 'lista_espera' ? 'bg-amber-50/40 hover:bg-amber-50/70' : 
                          'hover:bg-blue-50/40'
                      }`}
                    >
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="font-bold text-slate-800 text-sm leading-tight">
                              {a.nombre}
                            </span>
                            
                            {/* 👤 NOMBRE DEL TUTOR */}
                            <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                               <span>👤</span> {padres[a.parentId]?.nombre || padres[a.parentId]?.personaContacto || padres[a.parentId]?.nombrePagador || 'Cargando tutor...'}
                            </div>
                            
                            {/* BADGES DE ESTADO PREMIUM */}
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100/50 uppercase font-mono tracking-wider">
                                  {a.curso} - {a.letra}
                              </span>
                              
                              {a.estado === 'inscrito' && (
                                <span className="text-[8px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black border border-emerald-200/40 uppercase tracking-widest leading-none shadow-sm flex items-center gap-1">
                                  ✅ ACTIVO
                                </span>
                              )}
                              
                              {a.estado === 'prueba_reservada' && (
                                <span className="text-[8px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black border border-indigo-200/40 uppercase tracking-widest leading-none shadow-sm flex items-center gap-1">
                                  🏊‍♂️ PRUEBA NIVEL
                                </span>
                              )}

                              {a.estado === 'baja_pendiente' && (
                                <span className="text-[8px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-black border border-rose-200/40 uppercase tracking-widest leading-none shadow-sm flex items-center gap-1">
                                  ⚠️ BAJA PENDIENTE
                                </span>
                              )}
                              
                              {a.estado === 'lista_espera' && (
                                <span className="text-[8px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black border border-amber-200/40 uppercase tracking-widest leading-none shadow-sm flex items-center gap-1 animate-pulse">
                                  ⏳ EN ESPERA
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-700 text-sm">{a.actividad || '-'}</div>
                          {a.dias && <div className="text-[10px] text-slate-400 mt-1 font-medium bg-slate-50 border border-slate-100 rounded px-2 py-0.5 w-fit">📅 {a.dias} | ⏰ {a.horario}</div>}
                          
                          <div className="text-[10px] mt-1.5">
                            {(() => {
                              let fechaLimpia = '---';
                              try {
                                const f = a.fechaAlta || a.fechaInscripcion;
                                if (f) {
                                  const iso = typeof f === 'string' ? f : (f.toDate ? f.toDate() : new Date(f)).toISOString();
                                  fechaLimpia = iso.split('T')[0].split('-').reverse().join('/');
                                }
                              } catch (e) { fechaLimpia = 'Error fecha'; }

                              if (a.estado === 'lista_espera') {
                                return <span className="text-amber-600 font-bold italic">Solicitud: {fechaLimpia}</span>;
                              } else if (a.fechaAlta || a.fechaInscripcion) {
                                return <span className="text-green-600 font-bold italic">Alta: {fechaLimpia}</span>;
                              } else {
                                return <span className="text-slate-400">Sin fecha de alta</span>;
                              }
                            })()}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {puedeGestionarTodo && a.estado === 'inscrito' && (
                              <button
                                onClick={() => { setTrasladoId(a.id); setOpcionTraslado(''); }}
                                className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                              >Cambiar actividad / grupo</button>
                            )}
                            <button 
                                onClick={() => a.estado === 'lista_espera' ? abrirFicha(a) : confirmarInscripcion(a.id)}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm border transition duration-300 transform active:scale-95 ${
                                    a.estado === 'lista_espera'
                                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-amber-500/20 shadow-md'
                                    : a.revisadoAdmin 
                                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 shadow-orange-500/10 shadow-md'
                                }`}
                            >
                                {a.estado === 'lista_espera' ? '🚀 Gestionar' : a.revisadoAdmin ? '✅ OK' : '⏳ Confirmar'}
                            </button>

                            {userRole === 'admin' && (
                                <button onClick={(e) => borrarAlumno(e, a.id)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-all duration-200">
                                    🗑️
                                </button>
                            )}
                          </div>
                        </td>
                    </tr>
                )) : <tr><td colSpan="3" className="p-8 text-center text-slate-400 font-bold italic">No hay resultados en la búsqueda.</td></tr>}
            </tbody>
        </table>
    </div>
)}

     {/* TAB: BAJAS (AHORA SE PUEDE ABRIR LA FICHA CON FECHAS SEGURAS) */}
     {tab === 'bajas' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs">
                      <tr>
                          <th className="p-3">Alumno</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Fecha Baja Efectiva</th>
                          <th className="p-3 text-right">Acción</th>
                      </tr>
                  </thead>
                  <tbody>
                      {listadoBajas.map(a => (
                          <tr 
                            key={a.id} 
                            onClick={() => abrirFicha(a)} // 👈 ESTO ABRE LA FICHA
                            className={`border-b cursor-pointer transition ${
                                a.estado === 'baja_finalizada' 
                                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                                : 'bg-red-50 hover:bg-red-100'
                            }`}
                          >
                              <td className="p-3 font-bold">
                                  {a.nombre}
                                  <div className="text-xs font-normal opacity-75">{a.actividad}</div>
                                  
                                  {/* 📩 NUEVO: Fecha en la que la familia pulsó el botón */}
                                  <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                                    📩 Solicitada: {a.fechaSolicitudBaja 
  ? (a.fechaSolicitudBaja.includes('T') 
      ? a.fechaSolicitudBaja.split('T')[0].split('-').reverse().join('/') 
      : a.fechaSolicitudBaja.split('-').reverse().join('/'))
  : 'No registrada'}
                                  </div>
                              </td>
                              <td className="p-3">
                                  {a.estado === 'baja_pendiente' 
                                    ? <span className="text-red-600 font-bold text-xs animate-pulse">🔴 PENDIENTE</span>
                                    : <span className="text-gray-600 font-bold text-xs border border-gray-300 px-1 rounded">⚫ TRAMITADA</span>
                                  }
                              </td>
                              <td className="p-3 font-mono text-xs font-bold">
                                  {a.fechaBaja 
                                    ? a.fechaBaja.split('-').reverse().join('/') 
                                    : 'Por calcular'}
                              </td>
                              <td className="p-3 text-right">
                                  {a.estado === 'baja_pendiente' ? (
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); tramitarBaja(a); }} // 👈 stopPropagation evita abrir ficha
                                          className="bg-red-600 text-white px-3 py-1 rounded font-bold text-xs shadow hover:bg-red-700"
                                      >
                                          Tramitar Baja
                                      </button>
                                  ) : (
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); archivarBaja(a); }} // 👈 stopPropagation evita abrir ficha
                                          className="bg-white text-gray-600 px-3 py-1 rounded font-bold text-xs border border-gray-300 hover:bg-gray-200"
                                      >
                                          🗑️ Eliminar
                                      </button>
                                  )}
                              </td>
                          </tr>
                      ))}
                      {listadoBajas.length === 0 && (
                          <tr><td colSpan="4" className="p-4 text-center text-gray-400">No hay bajas pendientes ni tramitadas.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}
{/* --- TAB: PRUEBAS DE NIVEL --- */}
{tab === 'pruebas' && (
    <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 uppercase text-xs font-black text-gray-600">
                <tr>
                    <th className="p-3">Alumno</th>
                    <th className="p-3">Grupo Solicitado</th>
                    <th className="p-3">Cita Prueba</th>
                    <th className="p-3 text-right">Acción</th>
                </tr>
            </thead>
            <tbody>
                {listadoPruebas.map(a => (
                    <tr 
                      key={a.id} 
                      onClick={() => abrirFicha(a)} 
                      className="border-b cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                        <td className="p-3">
                            <div className="font-bold text-gray-900 leading-tight">{a.nombre}</div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">{a.curso}</div>
                        </td>
                        
                        {/* 🚩 NUEVO: Grupo seleccionado */}
                        <td className="p-3 font-bold text-blue-700">
                            {a.actividad || '---'}
                        </td>

                        {/* 🚩 NUEVO: Datos de la cita */}
                        <td className="p-3">
    {a.citaNivel ? (
        <div className="leading-tight">
            <p className="font-bold text-gray-800">
                📅 {a.citaNivel}
            </p>
            {/* Solo muestra el reloj y la hora si el campo existe y no está vacío */}
            {(a.horaCita || a.hora || a.horaNivel || a.horaPrueba) && (
                <p className="text-xs text-gray-500 mt-0.5">
                    ⏰ {a.horaCita || a.hora || a.horaNivel || a.horaPrueba}
                </p>
            )}
        </div>
    ) : (
        <span className="text-xs text-gray-400 italic font-medium">Sin cita</span>
    )}
</td>

<td className="p-3 text-right">
    <button 
        /* 🚩 CAMBIAMOS EL NOMBRE AQUÍ PARA QUE COINCIDA CON EL PASO 1 */
        onClick={(e) => aceptarAlumnoDirecto(e, a)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition-transform active:scale-95"
    >
        ACEPTAR
    </button>
</td>
                    </tr>
                ))}
                {listadoPruebas.length === 0 && (
                    <tr><td colSpan="4" className="p-10 text-center text-gray-400 font-medium">No hay pruebas de nivel pendientes.</td></tr>
                )}
            </tbody>
        </table>
    </div>
)}

{/* --- TAB: LISTA DE ESPERA (ORDEN CRONOLÓGICO ESTRICTO) --- */}
{tab === 'espera' && (
    <div className="bg-white rounded shadow overflow-hidden border-t-4 border-amber-500">
        <table className="w-full text-sm text-left">
            <thead className="bg-amber-50 uppercase text-[10px] font-black text-amber-800">
                <tr>
                    <th className="p-3 w-16 text-center">Puesto</th>
                    <th className="p-3">Alumno</th>
                    <th className="p-3">Actividad Solicitada</th>
                    <th className="p-3 text-right">Acción</th>
                </tr>
            </thead>
            <tbody>
                {alumnos
                    .filter(a => a.estado === 'lista_espera')
                    .sort((a, b) => {
                        // 🚩 PRIORIDAD ÚNICA: Fecha de inscripción (Antigüedad)
                        const valorA = a.waitlistJoinedAt || a.fechaInscripcion;
                        const valorB = b.waitlistJoinedAt || b.fechaInscripcion;
                        const fechaA = valorA?.toMillis ? valorA.toMillis() : (valorA?.seconds ? valorA.seconds * 1000 : new Date(valorA || 0).getTime());
                        const fechaB = valorB?.toMillis ? valorB.toMillis() : (valorB?.seconds ? valorB.seconds * 1000 : new Date(valorB || 0).getTime());
                        return fechaA - fechaB;
                    })
                    .map((a, index) => (
                        <tr 
                          key={a.id} 
                          onClick={() => abrirFicha(a)} 
                          className="border-b cursor-pointer hover:bg-amber-50 transition"
                        >
                            {/* PUESTO POR ORDEN DE LLEGADA */}
                            <td className="p-3 text-center">
                                {(() => {
                                  let key = a.waitlistGroupKey;
                                  try {
                                    if (!key) key = claveListaEspera(construirSlotsAforo({ actividadId: obtenerActividadIdAlumno(a), dias: a.dias, horario: a.horario, curso: a.curso }));
                                  } catch (_) { key = `${a.actividadId}|${a.dias}|${a.horario}`; }
                                  const fechaOrden = item => {
                                    const valor = item.waitlistJoinedAt || item.fechaInscripcion;
                                    return valor?.toMillis ? valor.toMillis() : (valor?.seconds ? valor.seconds * 1000 : new Date(valor || 0).getTime());
                                  };
                                  const mismaLista = alumnos.filter(item => {
                                    if (item.estado !== 'lista_espera') return false;
                                    try {
                                      const itemKey = item.waitlistGroupKey || claveListaEspera(construirSlotsAforo({ actividadId: obtenerActividadIdAlumno(item), dias: item.dias, horario: item.horario, curso: item.curso }));
                                      return itemKey === key;
                                    } catch (_) { return false; }
                                  }).sort((x, y) => fechaOrden(x) - fechaOrden(y));
                                  const puesto = mismaLista.findIndex(item => item.id === a.id) + 1;
                                  return <span className={`inline-block w-6 h-6 leading-6 rounded-full text-[10px] font-black ${puesto === 1 ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>{puesto || index + 1}</span>;
                                })()}
                            </td>

                            {/* ALUMNO */}
                            <td className="p-3">
                                <div className="font-bold text-gray-900">{a.nombre}</div>
                                <div className="text-xs text-blue-600 font-bold">{a.curso}</div>
                            </td>

                            {/* ACTIVIDAD */}
                            <td className="p-3">
                                <div className="font-medium text-gray-800 uppercase text-xs">{a.actividad}</div>
                                <div className="text-[10px] text-gray-500">📅 {a.dias} | ⏰ {a.horario}</div>
                            </td>

                            {/* ACCIÓN */}
                            <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                            <button 
    onClick={(e) => {
        e.stopPropagation();
        // CAMBIAMOS validarPlazaDirecto POR validarPlaza
        validarPlaza(a);
    }}
    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-black text-[10px] uppercase shadow transition-all active:scale-95"
>
    Validar Plaza
</button>
                            {userRole === 'admin' && (
                              <button
                                type="button"
                                onClick={(e) => borrarAlumno(e, a.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold text-[10px] uppercase border border-red-200"
                              >
                                Retirar de espera
                              </button>
                            )}
                            </div>
                            </td>
                        </tr>
                    ))}
                
                {alumnos.filter(a => a.estado === 'lista_espera').length === 0 && (
                    <tr><td colSpan="4" className="p-8 text-center text-gray-400 italic">La lista de espera está vacía.</td></tr>
                )}
            </tbody>
        </table>
    </div>
)}

{/* 💰 TAB: RENTABILIDAD INTEGRAL Y ANÁLISIS OPERATIVO REAL */}
{tab === 'rentabilidad' && userRole === 'admin' && (() => {

  const alumnosProcesados = simularCambioAlumnos(
    alumnos || [],
    simulacionAjustes,
    OFERTA_ACTIVIDADES,
    mesRentabilidad,
    anioRentabilidad
  );

  const simulacionAplicadaCount = Object.values(simulacionAjustes).reduce((acc, v) => acc + Math.abs(v), 0);

  const rentabilidad = calcularRentabilidadMensual({
    alumnos: alumnosProcesados,
    mesIndex: mesRentabilidad,
    anio: anioRentabilidad,
    festivos: festivosRentabilidad,
    tarifaMonitorBase,
    tarifaSocorristaBase,
    tarifaCoordinadorBase,
    ivaPersonal,
    totalCallesPermitidas,
    catalog: OFERTA_ACTIVIDADES
  });

  const factorIva = 1 + (ivaPersonal / 100);
  const monitorConIvaEur = (tarifaMonitorBase * factorIva).toFixed(2);
  const socorristaConIvaEur = (tarifaSocorristaBase * factorIva).toFixed(2);
  const coordinadorConIvaEur = (tarifaCoordinadorBase * factorIva).toFixed(3);

  const opcionesSimulador = [];
  OFERTA_ACTIVIDADES.forEach(act => {
    if (act.segmentosFisicos && act.segmentosFisicos.length > 0) {
      act.segmentosFisicos.forEach(seg => {
        (act.opciones || []).forEach(op => {
          opcionesSimulador.push({
            key: `${act.id}___${seg.id}___${op.dias}`,
            actividadId: act.id,
            segmentoId: seg.id,
            nombreActividad: `${act.nombre} (${seg.nombre})`,
            nombreSegmento: seg.nombre,
            dias: op.dias,
            horario: op.horario,
            precio: op.precio
          });
        });
      });
    } else {
      (act.opciones || []).forEach(op => {
        opcionesSimulador.push({
          key: `${act.id}___${op.dias}`,
          actividadId: act.id,
          segmentoId: act.id,
          nombreActividad: act.nombre,
          nombreSegmento: act.nombre,
          dias: op.dias,
          horario: op.horario,
          precio: op.precio
        });
      });
    }
  });

  const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const aoActual = new Date().getFullYear();
  const anosDisponibles = Array.from(
    new Set([aoActual - 1, aoActual, aoActual + 1, aoActual + 2, aoActual + 3, anioRentabilidad])
  ).sort((a, b) => a - b);

  const mesISOStr = `${anioRentabilidad}-${String(mesRentabilidad + 1).padStart(2, '0')}`;
  const festivosDelMes = festivosRentabilidad.filter(f => f.startsWith(mesISOStr));

  const agregarFestivo = () => {
    if (!nuevoFestivoInput) return;
    const parts = nuevoFestivoInput.split('-');
    if (parts.length !== 3) return;
    const fAnio = parseInt(parts[0], 10);
    const fMes = parseInt(parts[1], 10) - 1;
    const fDia = parseInt(parts[2], 10);
    const dateObj = new Date(fAnio, fMes, fDia);

    if (isNaN(dateObj.getTime()) || dateObj.getDate() !== fDia || dateObj.getMonth() !== fMes || dateObj.getFullYear() !== fAnio) {
      showToast("Introduce una fecha válida.", "warning");
      return;
    }
    if (fAnio !== anioRentabilidad || fMes !== mesRentabilidad) {
      showToast("El festivo debe pertenecer al mes y año seleccionados.", "warning");
      return;
    }
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      showToast("Solo se pueden añadir festivos entre Lunes y Viernes.", "warning");
      return;
    }
    if (festivosRentabilidad.includes(nuevoFestivoInput)) {
      showToast("El festivo ya está registrado.", "warning");
      return;
    }
    setFestivosRentabilidad([...festivosRentabilidad, nuevoFestivoInput]);
    setNuevoFestivoInput('');
  };

  return (
    <div className="space-y-6 animate-fade-in text-left pb-20">

      {/* 1. CABECERA Y NOTA EXCLUSIVA DE RESPONSABILIDAD (SECCIÓN 13) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
            <span>💎 Audit Financiero y Operativo Pro</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic">
            Calculadora de Rentabilidad Operativa
          </h2>
          <p className="text-slate-300 text-xs md:text-sm font-medium mt-2 leading-relaxed">
            Modelo de auditoría exacta: días de calendario real, 1 socorrista compartido, 1h/día de coordinador, monitores por sesión viable e IVA del 21%.
          </p>
        </div>
        <div className="absolute right-4 bottom-[-10px] text-9xl opacity-10 pointer-events-none">📊</div>
      </div>

      {/* AVISO LEGAL DE ALCANCE FINANCIERO */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div className="text-xs text-amber-900 font-medium">
          <strong className="font-bold block uppercase text-[11px] text-amber-950">Aviso de alcance de resultados:</strong>
          Los importes calculados representan exclusivamente el <strong>Resultado operativo después de costes de personal</strong>. No incluye alquiler, suministros, seguros, material, comisiones bancarias, impuestos ni otros gastos generales.
        </div>
      </div>

      {/* 2. ALERTAS DE EXCESO DE CALLES (> 4 CALLES) (SECCIÓN 12 & REQ 6) */}
      {rentabilidad.conflictosCalles.length > 0 && (
        <div className="bg-rose-600 text-white p-6 rounded-3xl shadow-xl space-y-3 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚨</span>
            <h3 className="text-base font-black uppercase tracking-wider">
              ¡Alerta de Exceso de Aforo de Calles Detectado! ({rentabilidad.conflictosCalles.length} Conflicto(s))
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rentabilidad.conflictosCalles.map((conf, cIdx) => (
              <div key={cIdx} className="bg-rose-950/60 border border-rose-400/30 p-3 rounded-2xl text-xs">
                <p className="font-bold uppercase text-amber-300">
                  📅 {conf.dia.toUpperCase()} • Intervalo: {conf.intervalo}
                </p>
                <p className="mt-1">
                  Calles requeridas: <strong className="font-mono text-white font-bold">{conf.callesNecesarias}</strong> / Permitidas: <span className="font-mono font-bold">{totalCallesPermitidas}</span> (Exceso: <strong className="text-rose-200">+{conf.exceso} calle(s)</strong>)
                </p>
                <p className="text-[10px] text-rose-200 mt-1 italic">
                  Actividades involucradas: {conf.actividades.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PANEL DE CONFIGURACIÓN ECONÓMICA Y CALENDARIO REAL (SECCIÓN 1 & 2 & REQ 7 & REQ 8) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <span>⚙️</span> Configuración Económica y Calendario Operativo
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Conserva precisión de céntimos sin redondeo prematuro intermedio.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <select
              value={mesRentabilidad}
              onChange={e => {
                setMesRentabilidad(Number(e.target.value));
                setSimulacionAjustes({});
                setSimActividadSel('');
                setSimSegmentoSel('');
                setSimOpcionSel('');
              }}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none"
            >
              {mesesNombres.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={anioRentabilidad}
              onChange={e => {
                setAnioRentabilidad(Number(e.target.value));
                setSimulacionAjustes({});
                setSimActividadSel('');
                setSimSegmentoSel('');
                setSimOpcionSel('');
              }}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none"
            >
              {anosDisponibles.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              Importe antes de IVA (Monitor)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                value={tarifaMonitorBase}
                onChange={e => setTarifaMonitorBase(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-800"
              />
              <span className="text-xs font-bold text-slate-600">€/h</span>
            </div>
            <p className="text-[10px] font-extrabold text-emerald-700 mt-1">Con IVA: {monitorConIvaEur} €/h</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              Importe antes de IVA (Socorrista)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                value={tarifaSocorristaBase}
                onChange={e => setTarifaSocorristaBase(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-800"
              />
              <span className="text-xs font-bold text-slate-600">€/h</span>
            </div>
            <p className="text-[10px] font-extrabold text-emerald-700 mt-1">Con IVA: {socorristaConIvaEur} €/h</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              Importe antes de IVA (Coordinador)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                value={tarifaCoordinadorBase}
                onChange={e => setTarifaCoordinadorBase(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-800"
              />
              <span className="text-xs font-bold text-slate-600">€/h</span>
            </div>
            <p className="text-[10px] font-extrabold text-emerald-700 mt-1">Con IVA: {coordinadorConIvaEur} €/h</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              IVA Aplicable (%)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={ivaPersonal}
                onChange={e => setIvaPersonal(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-800"
              />
              <span className="text-xs font-bold text-slate-600">%</span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-1">Estándar personal: 21%</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              Límite Calles Piscina
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={totalCallesPermitidas}
                onChange={e => setTotalCallesPermitidas(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-800"
              />
              <span className="text-xs font-bold text-slate-600">calles</span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-1">Configurado: {totalCallesPermitidas}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <span>📅</span> Días Cerrados o Festivos ({mesesNombres[mesRentabilidad]} {anioRentabilidad}):
            </span>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={nuevoFestivoInput}
                onChange={e => setNuevoFestivoInput(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold"
              />
              <button
                onClick={agregarFestivo}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                + Añadir Festivo
              </button>
            </div>
          </div>

          {festivosDelMes.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {festivosDelMes.map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-full text-xs font-bold">
                  <span>🔴 {f}</span>
                  <button
                    onClick={() => setFestivosRentabilidad(festivosRentabilidad.filter(x => x !== f))}
                    className="text-rose-600 hover:text-rose-900 font-extrabold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">No hay festivos excluidos para {mesesNombres[mesRentabilidad]} {anioRentabilidad}. Todos los días lectivos L-V son operativos.</p>
          )}

          <div className="pt-2 text-xs font-bold text-slate-700 border-t border-slate-200 flex flex-wrap gap-4">
            <span>📊 Calendario de {mesesNombres[mesRentabilidad]} {anioRentabilidad}: <span className="text-emerald-700 font-black">{rentabilidad.totalDiasOperativos} Días Operativos</span> ({rentabilidad.conteoPorDia.lunes}L, {rentabilidad.conteoPorDia.martes}M, {rentabilidad.conteoPorDia.miercoles}X, {rentabilidad.conteoPorDia.jueves}J, {rentabilidad.conteoPorDia.viernes}V).</span>
          </div>
        </div>
      </div>

      {/* ALERTA DE CONCILIACIÓN DE INGRESOS */}
      {!rentabilidad.conciliacionIngresosCorrecta && (
        <div className="bg-rose-100 border-2 border-rose-400 text-rose-900 p-4 rounded-2xl font-bold text-xs flex items-center gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <span>Revisar ingresos: las cuotas confirmadas no coinciden con el reparto por sesiones.</span>
        </div>
      )}

      {/* 4. RESULTADOS SUPERIORES (TARJETAS MÉTRICAS DE CLASIFICACIÓN EXPLICITA) (SECCIÓN 13) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Alumnos Confirmados</span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">{rentabilidad.alumnosConfirmadosCount}</span>
          <span className="text-[10px] text-slate-400 font-medium">Personas únicas</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">Alumnos Potenciales</span>
          <span className="text-2xl font-black text-amber-700 font-mono mt-1 block">{rentabilidad.alumnosPotencialesCount}</span>
          <span className="text-[10px] text-slate-400 font-medium">Pend. admin / futuro</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">Ingreso Operativo Real</span>
          <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
            +{(rentabilidad.ingresoOperativoTotalCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Grupos operativamente viables</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">Pendiente de Apertura</span>
          <span className="text-xl font-black text-amber-700 font-mono mt-1 block">
            +{(rentabilidad.ingresoPendienteAperturaTotalCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Formación / No salen</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">Total Cuotas Confirmadas</span>
          <span className="text-xl font-black text-indigo-700 font-mono mt-1 block">
            +{(rentabilidad.ingresoConfirmadoTotalCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Operativo + Pendiente</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider block">Pico Monitores Simultáneos</span>
          <span className="text-2xl font-black text-purple-700 font-mono mt-1 block">
            {rentabilidad.maximoMonitoresSimultaneos}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Máximo simultáneo por franja</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Coste Monitores</span>
          <span className="text-xl font-black text-rose-700 font-mono mt-1 block">
            -{(rentabilidad.costeMonitoresTotalCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Grupos viables dirigidos</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Coste Socorrista</span>
          <span className="text-xl font-black text-rose-700 font-mono mt-1 block">
            -{(rentabilidad.costeTotalSocorristaCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Único socorrista fijo</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Coste Coordinador</span>
          <span className="text-xl font-black text-rose-700 font-mono mt-1 block">
            -{(rentabilidad.costeTotalCoordinadorCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-400 font-medium">1 hora por día lectivo</span>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800 col-span-2 sm:col-span-3">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Resultado Operativo Real (Confirmado)</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
            {(rentabilidad.resultadoOperativoConfirmadoCentimos / 100).toFixed(2)} €
          </span>
          <span className="text-[10px] text-slate-300 font-bold">Ingreso operativo real - Coste de personal | Margen: {rentabilidad.margenConfirmadoPorcentaje}%</span>
        </div>
      </div>

      {/* 5. SECCIÓN DE DATOS PENDIENTES DE REVISAR (SIN PII COMPLETA) (SECCIÓN 6) */}
      {rentabilidad.pendientesDeRevisarCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <span>⚠️</span> Registros Pendientes de Revisar ({rentabilidad.pendientesDeRevisarCount} Alumno(s))
            </h4>
            <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
              Requieren atención de datos
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {rentabilidad.pendientesDeRevisar.map((item, pIdx) => (
              <div key={pIdx} className="bg-white p-3 rounded-2xl border border-amber-200 text-xs shadow-xs">
                <p className="font-bold text-slate-800">
                  ID: <span className="font-mono text-slate-600">{item.alumno?.id || `Reg-#${pIdx+1}`}</span>
                </p>
                <p className="text-[11px] text-amber-800 font-medium mt-0.5">Motivo: {item.motivo}</p>
                <p className="text-[10px] text-slate-400 italic mt-0.5">
                  Curso: {item.alumno?.curso || 'N/D'} | Actividad: {item.alumno?.actividad || 'N/D'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TABLA 1: DESGLOSE POR SESIÓN FÍSICA REAL (SECCIÓN 14) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-3 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <span>🏊‍♂️</span> Desglose por Sesión Física Real
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sesiones agrupadas por actividad, segmento, día y horario. Muestra mínimos, monitores y costes compartidos repartidos por minutos-calle.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="p-3">Actividad / Segmento</th>
                <th className="p-3">Día y Horario</th>
                <th className="p-3 text-center">Dur. / Apar.</th>
                <th className="p-3 text-center">Alumnos (Min-Max)</th>
                <th className="p-3 text-center">Calles / Monitores</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Ingreso Operativo</th>
                <th className="p-3 text-right">Coste Monitor</th>
                <th className="p-3 text-right">Socorrista Atrib.</th>
                <th className="p-3 text-right">Coordinador Atrib.</th>
                <th className="p-3 text-right">Coste Total</th>
                <th className="p-3 text-right">Res. Operativo</th>
                <th className="p-3 text-center">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {rentabilidad.resultadoSesiones.map(s => (
                <tr key={s.key} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <span className="font-bold text-slate-900 block">{s.nombreSegmento || s.nombreActividad}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {s.segmentoId}</span>
                    {s.actividadId === 'chapoteo' && s.numConfirmados >= 10 && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-bold border border-blue-200">
                        Dividido en 2 subgrupos — 2 monitores en 1 calle
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-indigo-900 uppercase block">{s.dia}</span>
                    <span className="text-[10px] font-mono text-slate-500">{s.horario}</span>
                  </td>
                  <td className="p-3 text-center font-mono text-xs">
                    {s.duracionMinutos}m / <strong className="text-slate-800">{s.aparicionesMes}d</strong>
                  </td>
                  <td className="p-3 text-center font-mono">
                    <strong className="text-slate-900 text-sm">{s.numConfirmados}</strong>
                    <span className="text-slate-400 text-[10px] block">({s.alumnosMin}–{s.alumnosMax})</span>
                  </td>
                  <td className="p-3 text-center font-mono">
                    <span className="font-bold text-slate-700 block">{s.callesNecesarias} calle{s.callesNecesarias > 1 ? 's' : ''}</span>
                    <span className="text-slate-500 text-[10px] block font-medium">
                      ({s.monitoresNecesarios} monitor{s.monitoresNecesarios !== 1 ? 'es' : ''})
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      s.estado === 'Viable' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      s.estado === 'Completo' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                      s.estado === 'Exceso de aforo' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      s.estado === 'En formación' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      s.estado === 'No sale' ? 'bg-red-100 text-red-800 border border-red-300' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {s.estado}
                    </span>
                    {s.estado === 'En formación' && (
                      <span className="text-[10px] text-amber-700 block font-bold mt-0.5">Falta 1 alumno</span>
                    )}
                    {s.estado === 'No sale' && (
                      <span className="text-[10px] text-red-700 block font-bold mt-0.5">Faltan {s.faltanParaMinimo} alumnos</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700">
                    +{(s.ingresoOperativoCentimos / 100).toFixed(2)} €
                    {s.ingresoPendienteAperturaCentimos > 0 && (
                      <span className="text-[10px] text-amber-600 block font-normal">
                        (Pend: +{(s.ingresoPendienteAperturaCentimos / 100).toFixed(2)} €)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-700 font-bold">
                    {s.costeMonitorCentimos > 0 ? `-${(s.costeMonitorCentimos / 100).toFixed(2)} €` : '0,00 €'}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-700">
                    {s.costeSocorristaCentimos > 0 ? `-${(s.costeSocorristaCentimos / 100).toFixed(2)} €` : '0,00 €'}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-700">
                    {s.costeCoordinadorCentimos > 0 ? `-${(s.costeCoordinadorCentimos / 100).toFixed(2)} €` : '0,00 €'}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-rose-800">
                    -{(s.costeTotalCentimos / 100).toFixed(2)} €
                  </td>
                  <td className="p-3 text-right font-mono font-black">
                    <span className={s.resultadoOperativoCentimos >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {(s.resultadoOperativoCentimos / 100).toFixed(2)} €
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-700">
                    {s.margenPorcentaje}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6B. TABLA DE MONITORES NECESARIOS POR FRANJA (SECCIÓN 3) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-3 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <span>⏱️</span> Monitores Necesarios por Franja Horaria
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Coordinación de personal simultáneo sin solapamientos. Refleja las calles ocupadas y monitores reales requeridos por cada franja. Pico máximo: <strong className="text-indigo-900 font-black">{rentabilidad.maximoMonitoresSimultaneos} monitores simultáneos</strong>.
            </p>
          </div>
        </div>

        {rentabilidad.franjasMonitores && rentabilidad.franjasMonitores.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="p-3">Día</th>
                  <th className="p-3">Franja</th>
                  <th className="p-3">Grupos Activos</th>
                  <th className="p-3 text-center">Calles Ocupadas</th>
                  <th className="p-3 text-center">Monitores Necesarios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {rentabilidad.franjasMonitores.map((f, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-indigo-900 uppercase">{f.dia}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{f.franja}</td>
                    <td className="p-3 text-slate-700">
                      <span className="font-semibold">{f.nombresGrupos.join(', ')}</span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">
                      {f.callesOcupadas} calle{f.callesOcupadas !== 1 ? 's' : ''}
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 font-black border border-indigo-300">
                        {f.monitoresNecesarios} monitor{f.monitoresNecesarios !== 1 ? 'es' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No hay franjas de actividad viable registradas para el mes seleccionado.</p>
        )}
      </div>

      {/* 7. TABLA 2: DESGLOSE POR MODALIDAD COMERCIAL (SECCIÓN 14 & REQ 3) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-3 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <span>🏷️</span> Desglose por Modalidad Comercial e Inscripción
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Muestra inscripciones comerciales, precios por cuota y sesiones físicas compartidas asociadas (totales reales y simulados).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="p-3">Actividad</th>
                <th className="p-3">Modalidad Comercial</th>
                <th className="p-3 text-center">Alumnos (Real / Sim)</th>
                <th className="p-3 text-right">Precio Cuota</th>
                <th className="p-3 text-right">Ingreso Confirmado (Real / Sim)</th>
                <th className="p-3 text-right">Ingreso Potencial</th>
                <th className="p-3">Sesiones Físicas Asociadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {opcionesSimulador.map(opItem => {
                const actDoc = OFERTA_ACTIVIDADES.find(a => a.id === opItem.actividadId);
                const diasNorm = extraerDiasSemana(opItem.dias);

                const confirmadosRealesMod = (alumnos || []).filter(a => {
                  const resC = clasificarAlumnoParaMes(a, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                  if (resC.categoria !== 'ingreso_confirmado') return false;
                  if (a.actividadId !== opItem.actividadId && a.actividad !== actDoc?.nombre) return false;
                  const alSeg = obtenerSegmentoFisico(opItem.actividadId, a.curso, OFERTA_ACTIVIDADES);
                  if (opItem.segmentoId && alSeg !== opItem.segmentoId) return false;
                  const dAl = (a.opcionDias || a.dias || '').trim().toLowerCase();
                  const dOp = opItem.dias.trim().toLowerCase();
                  return dAl === dOp;
                });

                const confirmadosSimuladosMod = (alumnosProcesados || []).filter(a => {
                  const resC = clasificarAlumnoParaMes(a, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                  if (resC.categoria !== 'ingreso_confirmado') return false;
                  if (a.actividadId !== opItem.actividadId && a.actividad !== actDoc?.nombre) return false;
                  const alSeg = obtenerSegmentoFisico(opItem.actividadId, a.curso, OFERTA_ACTIVIDADES);
                  if (opItem.segmentoId && alSeg !== opItem.segmentoId) return false;
                  const dAl = (a.opcionDias || a.dias || '').trim().toLowerCase();
                  const dOp = opItem.dias.trim().toLowerCase();
                  return dAl === dOp;
                });

                const potencialesMod = (alumnosProcesados || []).filter(a => {
                  const resC = clasificarAlumnoParaMes(a, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                  if (resC.categoria !== 'ingreso_potencial') return false;
                  if (a.actividadId !== opItem.actividadId && a.actividad !== actDoc?.nombre) return false;
                  const alSeg = obtenerSegmentoFisico(opItem.actividadId, a.curso, OFERTA_ACTIVIDADES);
                  if (opItem.segmentoId && alSeg !== opItem.segmentoId) return false;
                  const dAl = (a.opcionDias || a.dias || '').trim().toLowerCase();
                  const dOp = opItem.dias.trim().toLowerCase();
                  return dAl === dOp;
                });

                const ingConfRealMc = confirmadosRealesMod.reduce((acc, a) => {
                  const resC = clasificarAlumnoParaMes(a, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                  return acc + (resC.precioMc || 0);
                }, 0);

                const ingConfSimMc = confirmadosSimuladosMod.reduce((acc, a) => {
                  const resC = clasificarAlumnoParaMes(a, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                  return acc + (resC.precioMc || 0);
                }, 0);

                const ingPotMc = potencialesMod.reduce((acc, a) => {
                  const resC = clasificarAlumnoParaMes(a, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                  return acc + (resC.precioMc || 0);
                }, 0);

                const ingConfRealCentimos = Math.round(ingConfRealMc / 1000);
                const ingConfSimCentimos = Math.round(ingConfSimMc / 1000);
                const ingPotCentimos = Math.round(ingPotMc / 1000);

                return (
                  <tr key={opItem.key} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{opItem.nombreActividad}</td>
                    <td className="p-3 font-medium text-slate-800">
                      {opItem.dias} <span className="text-[10px] text-slate-500">({opItem.horario})</span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className="text-slate-600 block text-xs">Real: {confirmadosRealesMod.length}</span>
                      <span className="text-emerald-700 font-bold block text-xs">Sim: {confirmadosSimuladosMod.length}</span>
                      {potencialesMod.length > 0 && (
                        <span className="text-amber-700 font-bold block text-[10px]">+{potencialesMod.length} pot.</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                      {opItem.precio}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className="text-slate-500 block text-[10px]">Real: +{(ingConfRealCentimos / 100).toFixed(2)} €</span>
                      <span className="text-emerald-700 font-bold block">Sim: +{(ingConfSimCentimos / 100).toFixed(2)} €</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                      +{(ingPotCentimos / 100).toFixed(2)} €
                    </td>
                    <td className="p-3 text-[10px] text-slate-600">
                      {diasNorm.map(d => `${d} ${opItem.horario}`).join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. SIMULADOR DE RENTABILIDAD CON DELTAS POSITIVOS Y NEGATIVOS (+1 / -1) (SECCIÓN 15 & REQ 5) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-800/40 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/30 rounded-full text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>🎮 Sandbox de Simulación Bidireccional</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight italic">
              Simulador de Rentabilidad Operativa (+1 / -1)
            </h3>
            <p className="text-amber-200 text-xs font-bold uppercase tracking-widest mt-1">
              Simulación: no modifica inscripciones reales en Firestore.
            </p>
          </div>

          {simulacionAplicadaCount > 0 && (
            <button
              onClick={() => setSimulacionAjustes({})}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-2xl transition-all shadow-lg shadow-amber-500/20"
            >
              🔄 Restablecer simulación ({simulacionAplicadaCount} ajuste(s))
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div>
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
              1. Actividad
            </label>
            <select
              value={simActividadSel}
              onChange={e => {
                setSimActividadSel(e.target.value);
                setSimSegmentoSel('');
                setSimOpcionSel('');
              }}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold p-2.5 rounded-xl focus:outline-none"
            >
              <option value="">-- Elige Actividad --</option>
              {OFERTA_ACTIVIDADES.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>

          {simActividadSel && (() => {
            const actSel = OFERTA_ACTIVIDADES.find(a => a.id === simActividadSel);
            if (!actSel || !actSel.segmentosFisicos || actSel.segmentosFisicos.length === 0) return null;
            return (
              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
                  1.5. Subgrupo / Segmento
                </label>
                <select
                  value={simSegmentoSel}
                  onChange={e => setSimSegmentoSel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold p-2.5 rounded-xl focus:outline-none"
                >
                  <option value="">-- Elige Subgrupo --</option>
                  {actSel.segmentosFisicos.map(seg => (
                    <option key={seg.id} value={seg.id}>{seg.nombre}</option>
                  ))}
                </select>
              </div>
            );
          })()}

          <div>
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
              2. Modalidad Comercial
            </label>
            <select
              value={simOpcionSel}
              onChange={e => setSimOpcionSel(e.target.value)}
              disabled={!simActividadSel}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold p-2.5 rounded-xl focus:outline-none disabled:opacity-50"
            >
              <option value="">-- Elige Modalidad --</option>
              {simActividadSel && (OFERTA_ACTIVIDADES.find(a => a.id === simActividadSel)?.opciones || []).map((o, oIdx) => (
                <option key={oIdx} value={o.dias}>{o.dias} ({o.horario}) - {o.precio}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            {(() => {
              const actSelDoc = OFERTA_ACTIVIDADES.find(a => a.id === simActividadSel);
              const tieneSegs = actSelDoc?.segmentosFisicos && actSelDoc.segmentosFisicos.length > 0;
              const disabledButtons = !simActividadSel || !simOpcionSel || (tieneSegs && !simSegmentoSel);

              const simKey = tieneSegs
                ? `${simActividadSel}___${simSegmentoSel}___${simOpcionSel}`
                : `${simActividadSel}___${simOpcionSel}`;

              const deltaActual = simulacionAjustes[simKey] || 0;

              const confirmadosRealesMod = (alumnos || []).filter(al => {
                const resC = clasificarAlumnoParaMes(al, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
                if (resC.categoria !== 'ingreso_confirmado') return false;
                const alAct = al.actividadId || (OFERTA_ACTIVIDADES.find(a => a.nombre === al.actividad)?.id);
                const alDias = al.opcionDias || al.dias;
                const alSeg = obtenerSegmentoFisico(alAct, al.curso, OFERTA_ACTIVIDADES);
                const coincideAct = alAct === simActividadSel;
                const coincideDias = alDias === simOpcionSel;
                const coincideSeg = !simSegmentoSel || alSeg === simSegmentoSel;
                return coincideAct && coincideDias && coincideSeg;
              }).length;

              const totalSimuladoMod = confirmadosRealesMod + deltaActual;
              const deshabilitarRestar = disabledButtons || totalSimuladoMod <= 0;

              return (
                <>
                  <button
                    disabled={disabledButtons}
                    onClick={() => {
                      setSimulacionAjustes({
                        ...simulacionAjustes,
                        [simKey]: deltaActual + 1
                      });
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black p-2.5 rounded-xl transition-all disabled:opacity-40"
                  >
                    +1 Alumno Virtual
                  </button>

                  <button
                    disabled={deshabilitarRestar}
                    onClick={() => {
                      if (totalSimuladoMod > 0) {
                        setSimulacionAjustes({
                          ...simulacionAjustes,
                          [simKey]: deltaActual - 1
                        });
                      }
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black p-2.5 rounded-xl transition-all disabled:opacity-40"
                  >
                    -1 Alumno Real/Virt
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        {simActividadSel && simOpcionSel && (() => {
          const actDoc = OFERTA_ACTIVIDADES.find(a => a.id === simActividadSel);
          const opDoc = (actDoc?.opciones || []).find(o => o.dias === simOpcionSel);
          const esPack = (simOpcionSel || '').includes('PACK 2 DÍAS');
          const precioCentimosSim = parsePrecioACentimos(opDoc?.precio || '0€');

          const tieneSegs = actDoc?.segmentosFisicos && actDoc.segmentosFisicos.length > 0;
          const simKey = tieneSegs
            ? `${simActividadSel}___${simSegmentoSel}___${simOpcionSel}`
            : `${simActividadSel}___${simOpcionSel}`;

          const deltaActual = simulacionAjustes[simKey] || 0;

          const confirmadosRealesMod = (alumnos || []).filter(al => {
            const resC = clasificarAlumnoParaMes(al, mesRentabilidad, anioRentabilidad, OFERTA_ACTIVIDADES);
            if (resC.categoria !== 'ingreso_confirmado') return false;
            const alAct = al.actividadId || (OFERTA_ACTIVIDADES.find(a => a.nombre === al.actividad)?.id);
            const alDias = al.opcionDias || al.dias;
            const alSeg = obtenerSegmentoFisico(alAct, al.curso, OFERTA_ACTIVIDADES);
            const coincideAct = alAct === simActividadSel;
            const coincideDias = alDias === simOpcionSel;
            const coincideSeg = !simSegmentoSel || alSeg === simSegmentoSel;
            return coincideAct && coincideDias && coincideSeg;
          }).length;

          const totalSimuladoMod = confirmadosRealesMod + deltaActual;

          return (
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Efecto +1 Alumno ({esPack ? 'Pack 2 Días' : '1 Día'})</span>
                  <span className="text-emerald-400 font-mono font-black text-base mt-1 block">+{(precioCentimosSim / 100).toFixed(2)} €/mes</span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Alumnado Real Confirmado</span>
                  <span className="text-white font-mono font-black text-base mt-1 block">{confirmadosRealesMod} alumno(s)</span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Ajuste de Simulación</span>
                  <span className={`font-mono font-black text-base mt-1 block ${deltaActual > 0 ? 'text-emerald-400' : deltaActual < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {deltaActual > 0 ? `+${deltaActual}` : deltaActual}
                  </span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Resultado Operativo Simulado</span>
                  <span className="text-emerald-400 font-mono font-black text-base mt-1 block">
                    {(rentabilidad.resultadoOperativoConfirmadoCentimos / 100).toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

    </div>
  );
})()}

      {/* TABS EXTRA */}
      {/* 👥 PESTAÑA DE EQUIPO Y MONITORES (VERSIÓN PRO) */}
{tab === 'equipo' && puedeGestionarTodo && (
  <div className="animate-fade-in space-y-6">
    
    {/* 1. PANEL DE ALTA RÁPIDA */}
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left">
      <h2 className="text-xl font-black text-blue-900 uppercase tracking-tighter mb-4 flex items-center gap-2">
        <span>🚀</span> Registro de Monitores
      </h2>
      
      <form onSubmit={async (e) => {
    e.preventDefault();
    if (!puedeGestionarTodo || loadingStaff) return;
    const nombre = e.target.nombre.value.trim();
    const email = normalizarEmail(e.target.email.value);
    const password = e.target.password.value;
    
    if(!nombre || !email || !password) return showToast("⚠️ ¡Ups! Falta información. Nombre, email y clave son obligatorios.", "warning");
    if(password.length < 6) return showToast("⚠️ La contraseña debe tener al menos 6 caracteres.", "warning");

    setLoadingStaff(true);
    try {
      // Creamos la cuenta real en Firebase Auth usando secondaryAuth para no cerrar
      // la sesión del administrador y sin almacenar nunca contraseñas en Firestore.
      const credencial = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const ahoraIso = new Date().toISOString();
      await setDoc(doc(db, 'users', credencial.user.uid), {
        email,
        nombre,
        role: 'monitor',
        createdAt: ahoraIso
      });
      await setDoc(
        doc(db, 'equipo', credencial.user.uid),
        construirDocumentoMonitor({
          uid: credencial.user.uid,
          nombre,
          email,
          creadoPor: emailNormalizado,
          fechaAlta: ahoraIso
        })
      );
      showToast(`✅ ¡Monitor creado! Ya puede iniciar sesión con ${email}`, "success");
      e.target.reset();
    } catch (err) {
      if (err?.code === 'auth/email-already-in-use') {
        showToast("⚠️ Ese correo ya tiene cuenta en Firebase Auth.", "warning");
      } else {
        showToast("❌ Error al crear monitor: " + err.message, "error");
      }
    } finally {
      await signOut(secondaryAuth).catch(() => {});
      setLoadingStaff(false);
    }
  }} className="grid md:grid-cols-4 gap-4 items-end"> {/* 👈 Ahora son 4 columnas */}
    <div>
      <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1 tracking-widest">Nombre del Profesor</label>
      <input name="nombre" className="w-full border-2 border-gray-50 p-3 rounded-xl bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all" placeholder="Ej: Manuel García" />
    </div>
    <div>
      <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1 tracking-widest">Email de Acceso</label>
      <input name="email" type="email" className="w-full border-2 border-gray-50 p-3 rounded-xl bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all" placeholder="profe@escuela.com" />
    </div>
    <div>
      <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1 tracking-widest">Contraseña Privada</label>
      <input name="password" type="password" autoComplete="new-password" minLength={6} className="w-full border-2 border-gray-50 p-3 rounded-xl bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all" placeholder="Mínimo 6 caracteres" />
    </div>
    <button type="submit" disabled={loadingStaff} className="bg-blue-600 text-white p-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
      {loadingStaff ? 'Creando...' : 'Crear Monitor'}
    </button>
</form>
    </div>

    {/* 2. TABLA DE GESTIÓN Y ASIGNACIÓN */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Miembros del Equipo</h3>
        <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-1 rounded-full uppercase">
          {equipo.length} Personas
        </span>
      </div>
      
      <div className="divide-y divide-gray-50">
        {/* 👑 1. TÚ (SUPER ADMIN) */}
  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 border-l-4 border-amber-500 mb-1 rounded-r-xl">
    <div className="text-left">
      <div className="flex items-center gap-2">
        <p className="font-bold text-white text-sm">Director de Extraescolares</p>
        <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Super Admin</span>
      </div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">extraescolares@sanbuenaventura.org</p>
    </div>
    <div className="text-xl">👑</div>
  </div>

  {/* 🛡️ 2. TU MANO DERECHA (EL COORDINADOR) */}
  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50 border-l-4 border-blue-600 mb-1 rounded-r-xl">
    <div className="text-left">
      <div className="flex items-center gap-2">
        <p className="font-bold text-blue-900 text-sm">Coordinador de Piscina</p>
        <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded">MANO DERECHA</span>
      </div>
      <p className="text-[10px] text-blue-400 font-bold uppercase mt-0.5">
        extraescolarespiscina@sanbuenaventura.org
      </p>
    </div>
    <div className="text-xl">⭐</div>
  </div>
        {equipo.length === 0 ? (
          <div className="p-10 text-center text-gray-400 italic text-sm">No hay nadie en el equipo... ¡Añade al primero arriba!</div>
        ) : (
          equipo.map((miembro) => (
            <div key={miembro.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="text-left min-w-[200px]">
                <p className="font-bold text-gray-800">{miembro.nombre || 'Sin nombre'}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{miembro.email}</p>
              </div>
              
              {/* 🏊 CLASES ASIGNADAS */}
              <div className="flex-1 flex flex-wrap items-center gap-1.5 justify-start">
                {miembro.gruposAsignados?.length > 0 ? (
                  miembro.gruposAsignados.map(g => (
                    <span key={g} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[9px] font-black px-2.5 py-1 rounded-md border border-blue-100 uppercase">
                      <span>{g}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const filtrados = (miembro.gruposAsignados || []).filter(item => item !== g);
                            await updateDoc(doc(db, 'equipo', miembro.id), {
                              gruposAsignados: filtrados,
                              password: deleteField()
                            });
                          } catch (err) {
                            showToast('❌ No se pudo quitar el grupo: ' + err.message, 'error');
                          }
                        }}
                        className="ml-1 text-blue-400 hover:text-red-600 font-bold"
                        title="Quitar grupo"
                        aria-label={`Quitar ${g}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-gray-300 italic">Sin clases asignadas</span>
                )}
                
                <select
                  value=""
                  aria-label={`Asignar grupo a ${miembro.nombre || miembro.email}`}
                  onChange={async (e) => {
                    const grupo = e.target.value;
                    if (!grupo) return;
                    const actuales = miembro.gruposAsignados || [];
                    if (actuales.includes(grupo)) return;
                    try {
                      await updateDoc(doc(db, 'equipo', miembro.id), {
                        gruposAsignados: [...actuales, grupo],
                        password: deleteField()
                      });
                      showToast(`✅ Grupo asignado a ${miembro.nombre || miembro.email}.`, 'success');
                    } catch (err) {
                      showToast('❌ No se pudo asignar el grupo: ' + err.message, 'error');
                    }
                  }}
                  className="text-[10px] font-bold text-blue-700 bg-white hover:bg-blue-50 px-2.5 py-1 rounded-md border border-dashed border-blue-300 transition-colors cursor-pointer outline-none"
                >
                  <option value="">+ Asignar actividad...</option>
                  {OFERTA_ACTIVIDADES.filter(act => !(miembro.gruposAsignados || []).includes(act.nombre)).map(act => (
                    <option key={act.id} value={act.nombre}>{act.nombre}</option>
                  ))}
                </select>
              </div>

              <button 
                type="button"
                onClick={() => borrarMiembroEquipo(miembro)} 
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors text-xs font-bold flex items-center gap-1.5 shrink-0"
                title="Eliminar del equipo"
              >
                <span>🗑️</span>
                <span>Eliminar</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
{/* 🏊‍♂️ PESTAÑA: MIS CLASES (PARA EL MONITOR) */}
{tab === 'mis_clases' && (
  <div className="animate-fade-in space-y-6">
    {/* Cabecera */}
    <div className="text-left bg-gradient-to-r from-blue-600 to-blue-400 p-6 rounded-3xl shadow-lg">
      <h2 className="text-2xl font-black text-white uppercase tracking-tighter">🌊 Mis Clases</h2>
      <p className="text-blue-100 text-sm font-medium">Panel de control para monitores de natación</p>
    </div>

    {/* Lista de Grupos */}
    <div className="grid gap-6">
      {datosMonitor?.gruposAsignados?.length > 0 ? (
        datosMonitor.gruposAsignados.map(nombreGrupo => {
          // Filtramos los alumnos que tienen esta actividad asignada (compatible con nombre o ID)
          const alumnosDelGrupo = alumnos.filter(a => (a.actividad === nombreGrupo || a.actividadId === nombreGrupo) && a.estado === 'inscrito');

          return (
            <div key={nombreGrupo} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-left">
              <div className="bg-gray-50 p-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-black text-blue-900 uppercase text-xs tracking-widest">
                  {nombreGrupo}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full">
                    {alumnosDelGrupo.length} ALUMNOS
                  </span>
                  {alumnosDelGrupo.length > 0 && (
                    <button
                      type="button"
                      onClick={() => imprimirListaAsistencia(alumnosDelGrupo, { nombre: nombreGrupo, dia: 'Grupo asignado' })}
                      className="bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase transition-colors"
                    >
                      🖨️ Imprimir lista
                    </button>
                  )}
                </div>
              </div>
              
              <div className="divide-y divide-gray-50">

                {alumnosDelGrupo.length > 0 ? (
                  alumnosDelGrupo.map(al => (
                    <div key={al.id} className="p-4 flex justify-between items-center hover:bg-blue-50/50 transition-colors">
                      <div>
                        <p className="font-bold text-gray-800">{al.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">
                          {al.curso} {al.letra} | {al.tipo === 'interno' ? '🏫 COLEGIO' : '🌍 EXTERNO'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                         {/* Aquí en el futuro podrías añadir un botón de "Pasar lista" */}
                         <span className="text-[9px] font-black text-blue-500 border border-blue-200 px-2 py-1 rounded uppercase">Vigente</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-8 text-center text-gray-400 italic text-sm">No hay alumnos todavía en este grupo.</p>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-amber-50 p-12 rounded-3xl border-2 border-dashed border-amber-200 text-center">
          <p className="text-amber-700 font-black uppercase tracking-widest">⚠️ Sin clases asignadas</p>
          <p className="text-amber-600 text-xs mt-2">Dile al coordinador que te asigne grupos en el panel de equipo.</p>
        </div>
      )}
    </div>
  </div>
)}
      {tab === 'avisos' && (<div className="p-4 bg-white rounded shadow"><form onSubmit={agregarAviso} className="flex gap-2 mb-4"><input className="border p-2 flex-1 rounded" value={nuevoAviso} onChange={e => setNuevoAviso(e.target.value)} placeholder="Escribe un aviso..." /><button className="bg-blue-600 text-white px-4 rounded font-bold">Publicar</button></form>{avisos.map(a => (<div key={a.id} className="bg-yellow-50 p-2 mb-2 border border-yellow-200 flex justify-between rounded"><span>{a.texto}</span>{userRole === 'admin' && <button onClick={() => borrarAviso(a.id)} className="text-red-500 font-bold ml-2">x</button>}</div>))}</div>)}

      {/* COMPONENTE VISUAL: LA FICHA QUE SE ABRE */}
      {alumnoSeleccionado && (
        <FichaAlumno 
            alumno={alumnoSeleccionado} 
            cerrar={() => setAlumnoSeleccionado(null)}
            userRole={userRole}
        />
      )}

      {/* 🎯 PASO 2: PEGA EL RADAR AQUÍ ABAJO */}
      {trasladoId && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg text-left" role="dialog" aria-modal="true" aria-labelledby="titulo-traslado">
            <h2 id="titulo-traslado" className="text-xl font-bold text-blue-900">Cambiar actividad o grupo</h2>
            {alumnoTraslado?.estado === 'inscrito' && actividadTraslado ? <>
              <p className="mt-3 font-semibold">{alumnoTraslado.nombre}</p>
              <p className="text-sm text-gray-600">{actividadTraslado.nombre}</p>
              <p className="mt-3 text-sm">Actual: <strong>{alumnoTraslado.dias} · {alumnoTraslado.horario}</strong> ({alumnoTraslado.precio})</p>
              <label htmlFor="destino-traslado" className="block mt-5 mb-2 text-sm font-bold">Nueva actividad y grupo</label>
              <select id="destino-traslado" value={opcionTraslado} onChange={e => setOpcionTraslado(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white">
                <option value="">Selecciona una opción</option>
                {opcionesTraslado.map(({ actividad, opcion }, index) => <option key={`${actividad.id}-${opcion.dias}-${opcion.horario}`} value={index}>
                  {actividad.nombre} · {opcion.dias} · {opcion.horario} · {opcion.precio}
                </option>)}
              </select>
              {destinoTraslado?.actividad.id !== actividadTraslado.id && destinoTraslado?.actividad.requierePrueba && (
                <p className="mt-3 text-xs font-semibold text-amber-800">Esta actividad requiere prueba de nivel. Comprueba que el participante tenga el nivel adecuado antes de confirmar.</p>
              )}
              <p className="mt-3 text-xs text-gray-600">La plaza se comprobará al confirmar. Se enviará un aviso al correo de contacto.</p>
            </> : <p className="mt-4 text-sm text-red-600">Esta inscripción ya no permite el traslado.</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" disabled={trasladoEnCurso} onClick={() => { setTrasladoId(null); setOpcionTraslado(''); }}
                className="px-4 py-2 rounded-lg border disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={!destinoTraslado || trasladoEnCurso || !puedeGestionarTodo}
                onClick={confirmarTraslado} className="px-4 py-2 rounded-lg bg-blue-700 text-white font-bold disabled:opacity-50">
                {trasladoEnCurso ? 'Guardando...' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
      {radarHueco && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-white/20">
            <div className="bg-amber-500 p-6 text-white text-left">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Sustitución Inteligente</p>
                  <h3 className="text-xl font-black uppercase mt-1 leading-tight">Cubrir hueco de:</h3>
                  <p className="font-bold text-amber-900 bg-white/30 inline-block px-2 py-0.5 rounded mt-2">{radarHueco.actividad}</p>
                </div>
                <button onClick={() => setRadarHueco(null)} className="bg-white/20 hover:bg-white/40 p-2 rounded-full text-xl transition">✕</button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-500 text-xs font-medium mb-4 text-left">Candidatos en espera para este grupo:</p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                {alumnos
                  .filter(esp => esp.estado === 'lista_espera' && esp.actividad === radarHueco.actividad)
                  .map((cand, idx) => (
                    <div key={cand.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-400 transition-all group">
                      <div className="text-left">
                        <p className="font-bold text-slate-800 text-sm">{cand.nombre}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{cand.curso}</p>
                      </div>
                      <button 
                        onClick={() => { abrirFicha(cand); setRadarHueco(null); }}
                        className="bg-white text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm"
                      >
                        Asignar
                      </button>
                    </div>
                  ))}
                {alumnos.filter(esp => esp.estado === 'lista_espera' && esp.actividad === radarHueco.actividad).length === 0 && (
                  <div className="text-center py-10">
                    <span className="text-3xl block mb-2">🏖️</span>
                    <p className="text-gray-400 text-xs italic">No hay nadie en espera para este horario.</p>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setRadarHueco(null)} 
                className="w-full mt-6 py-2 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-gray-600 transition-colors"
              >
                Cerrar Radar
              </button>
            </div>
          </div>
        </div>
      )}
    </div> // <--- Este es el cierre del AdminDashboard
  );
};

// ==========================================
// 📄 COMPONENTE FICHA (CON SÚPER BÚSQUEDA DE TELÉFONO)
// ==========================================
function FichaAlumno({ alumno, cerrar, userRole }) {
  const { user } = useAuth();
  if (!alumno) return null;
  const fechaAltaNormalizada = normalizarFechaFirestore(alumno.fechaAlta);
  const fechaInicioActividad = fechaAltaNormalizada && !isNaN(fechaAltaNormalizada.getTime())
    ? (typeof alumno.fechaAlta === 'string' ? alumno.fechaAlta.split('T')[0] : fechaAltaNormalizada.toISOString().split('T')[0])
    : '';
  const p = alumno.datosPadre || {}; 
// 📜 FUNCIÓN INTERNA PARA REGISTRAR MOVIMIENTOS
const registrarLog = async (accion, detalles) => {
  try {
    await addDoc(collection(db, 'logs'), {
      fecha: new Date().getTime(),
      alumnoId: alumno.id,
      alumnoNombre: alumno.nombre,
      accion: accion, 
      detalles: detalles,
      adminEmail: user?.email || 'Sistema'
    });
  } catch (error) {
    console.error("Error al registrar log:", error);
  }
};
// 🚩 FUNCIÓN REFORZADA: Asegura el ID y refresca la vista
const cambiarFecha = async (campo, e) => {
  if (userRole !== 'admin') return;
  
  const valorNuevoTexto = e.target.value; 
  // 🚩 ASEGURAMOS EL ID: Si uno falla, usamos el otro
  const idReal = alumno.id || alumno.uid;

  if (!idReal) {
      return showToast("Error: No se encuentra el ID del alumno para guardar", "error");
  }

  try {
      const alumnoRef = doc(db, 'students', idReal);
      
      await updateDoc(alumnoRef, { 
          [campo]: valorNuevoTexto,
          ultimaActualizacion: new Date().getTime() // Forzamos cambio en DB
      });
      
      // Registro en el historial
      registrarLog("EDICIÓN FECHA", `Cambio en ${campo}: a ${valorNuevoTexto}`);
      
      showToast("Fecha guardada correctamente", "success");
      
      // La recarga ya no es necesaria gracias al listener en tiempo real onSnapshot

  } catch (error) {
      console.error("Error al guardar fecha:", error);
      showToast("Error al guardar: " + error.message, "error");
  }
};
  const camposAlumno = Object.keys(alumno).join(', ');
  const camposPadre = Object.keys(p).join(', ');

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
        
        {/* CABECERA: CURSO+LETRA JUNTOS, ACTIVIDAD Y DÍAS */}
        <div className="bg-blue-900 p-5 text-white flex justify-between items-start sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">{alumno.nombre}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              
              {/* CURSO Y LETRA (UNIFICADOS) */}
              <div className="flex items-center overflow-hidden rounded shadow-sm border border-blue-600 font-black text-[11px] uppercase tracking-wider">
                <span className="bg-blue-700 px-3 py-1 border-r border-blue-600/50">
                  {alumno.curso}
                </span>
                <span className="bg-yellow-400 text-yellow-900 px-3 py-1">
                  {alumno.letra || '?'}
                </span>
              </div>

              {/* ACTIVIDAD */}
              <span className="bg-emerald-500 text-white px-3 py-1 rounded text-[11px] font-black uppercase tracking-widest shadow-sm border border-emerald-400">
                {alumno.actividad || 'Sin Actividad'}
              </span>

              {/* DÍAS DE LA ACTIVIDAD */}
              <span className="bg-slate-800/50 text-slate-200 px-3 py-1 rounded text-[11px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                🗓️ {alumno.dias || 'Días no definidos'}
              </span>

            </div>
          </div>
          <button 
            onClick={cerrar} 
            className="bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-all active:scale-90"
          >
            ✕
          </button>
        </div>


        {/* CONTENIDO */}
        <div className="p-6 space-y-6 text-gray-800">
          {alumno.historialInscripciones?.length > 0 && (
            <div className="bg-slate-50 p-4 rounded border">
              <h3 className="font-bold text-sm">Historial de solicitudes y bajas</h3>
              {alumno.historialInscripciones.map((registro, index) => (
                <p key={index} className="text-xs mt-2">{registro.fecha?.split('T')[0]} · {registro.accion} · {registro.actividad || 'Sin actividad'} · {registro.dias || ''} · Inicio: {registro.fechaAlta || 'Sin fecha'} · Precio: {registro.precio || 'Sin precio'}</p>
              ))}
            </div>
          )}
          
{/* 1. FECHAS (BLOQUE REPARADO Y SIN ENGAÑOS) */}
<div className="bg-gray-100 p-4 rounded border border-gray-300 grid grid-cols-2 gap-4 shadow-inner">
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">📅 Inicio en la actividad</label>
        <input 
          type="date" 
          key={`${alumno.id}-${fechaInicioActividad}`}
          defaultValue={fechaInicioActividad}
          disabled={userRole !== 'admin'}
          onChange={(e) => {
            cambiarFecha('fechaAlta', e);
            // 🚩 Truco: Si cambias la fecha a mano, esto ayuda a que se guarde
          }}
          className={`w-full p-2 rounded border font-bold ${userRole === 'admin' ? 'bg-white border-blue-400' : 'bg-gray-200'}`}
        />
        {/* 🚩 CAMBIO: Usamos una condición más sólida */}
        {!fechaInicioActividad && (
          <p className="text-[9px] text-red-600 font-black mt-1 uppercase">
            Sin fecha de inicio
          </p>
        )}
    </div>
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          🏁 Fecha de Baja {alumno.estado === 'baja_pendiente' && "⚠️"}
        </label>
        <input 
          type="date" 
          defaultValue={alumno.fechaBaja || ""}
          disabled={userRole !== 'admin'}
          onChange={(e) => cambiarFecha('fechaBaja', e)}
          className={`w-full p-2 rounded border font-bold bg-white`}
        />
    </div>
</div>
{/* 📜 HISTORIAL DE MOVIMIENTOS (AÑADIR JUSTO AQUÍ) */}
{userRole === 'admin' && (
  <div className="mt-8 border-t border-slate-200 pt-6 text-left">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
        <span className="text-sm">🕒</span> Historial de la ficha
      </h3>
      <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
        Audit Log Activo
      </span>
    </div>
    
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-inner">
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center mb-3">
          <span className="text-lg">📋</span>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase italic">
          Registro de auditoría vinculado
        </p>
        <p className="text-[9px] text-slate-400 mt-1 max-w-[250px] leading-relaxed">
          Cualquier cambio manual en fechas o estados quedará guardado con el email del administrador responsable.
        </p>
      </div>
      
      {/* Botón de acceso rápido a la base de datos de logs */}
      <button 
        onClick={() => window.open(`https://console.firebase.google.com/project/${db._databaseId.projectId}/firestore/data/~2Flogs`, '_blank')}
        className="w-full mt-4 py-3 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center justify-center gap-2"
      >
        <span>Consultar registros maestros</span>
        <span className="text-[12px]">↗</span>
      </button>
    </div>
  </div>
)}

          {/* 2. EL TELÉFONO (CUADRO VERDE - BUSCA EN TODAS PARTES) */}
          <div className="bg-green-600 p-4 rounded-lg shadow-md flex justify-between items-center text-white">
              <div>
                  <h3 className="text-xs font-bold uppercase opacity-90 text-white">📞 Teléfono de Emergencia</h3>
                  <p className="text-2xl font-black">
                      {/* Aquí está el truco: busca en todos los campos posibles */}
                      {alumno.telefono || alumno.telefono1 || p.telefono || p.telefono1 || alumno.telefonoContacto || 'Sin teléfono'}
                  </p>
              </div>
              <a 
                href={`tel:${alumno.telefono || alumno.telefono1 || p.telefono || p.telefono1}`}
                className="bg-white text-green-600 p-3 rounded-full shadow-lg hover:scale-110 transition"
              >
                  <span className="text-xl">📞</span>
              </a>
          </div>

          {/* 3. DATOS DE RESPONSABLE Y FACTURACIÓN (SOLO ADMIN) */}
{userRole === 'admin' ? (
  <div className="border-t pt-4 space-y-4">
    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">💳 Datos de Responsable</h3>
    <div className="grid md:grid-cols-2 gap-4 text-sm">
      
      {/* NOMBRE DEL TUTOR / CONTACTO / PAGADOR */}
      <div className="bg-blue-50 p-3 rounded border border-blue-200">
        <span className="block text-blue-500 text-xs font-bold uppercase">Nombre Responsable</span>
        <span className="font-bold text-lg text-gray-900">
          {alumno.nombreTutor || alumno.nombrePagador || p.personaContacto || p.nombrePagador || p.nombre || '-'}
        </span>
      </div>

      {/* DNI UNIFICADO */}
      <div className="bg-gray-50 p-3 rounded border border-gray-300">
        <span className="block text-gray-500 text-xs font-bold uppercase">DNI / NIE</span>
        <span className="font-bold text-lg text-gray-900">
          {alumno.dniTutor || alumno.dni || alumno.dniPagador || p.dni || p.dniPagador || '-'}
        </span>
      </div>

      <div className="bg-gray-50 p-3 rounded border border-gray-300">
        <span className="block text-gray-500 text-xs font-bold uppercase">Email Principal</span>
        <span className="font-medium">{p.email || alumno.email || '-'}</span>
      </div>

      <div className="bg-gray-100 p-3 rounded font-mono text-gray-700 border md:col-span-2">
        <span className="block text-gray-400 text-[10px] font-bold uppercase mb-1">IBAN de Cobro</span>
        <span className="font-bold tracking-wider">{alumno.iban || p.iban || 'No indicado'}</span>
      </div>
    </div>
  </div>
) : (
  <div className="bg-amber-50 p-4 rounded border border-amber-200 text-amber-800 text-sm italic">
     🔒 Los datos bancarios y de facturación están protegidos.
  </div>
)}

          {/* 4. SALUD (SIEMPRE VISIBLE) */}
          {(alumno.alergias || alumno.observaciones) && (
            <div className="grid gap-3 pt-2">
               {alumno.alergias && <div className="bg-red-50 border-l-4 border-red-500 p-3"><span className="font-bold text-red-700 block text-xs uppercase">⚠️ Alergias / Médico</span><p className="text-red-900 text-sm font-medium">{alumno.alergias}</p></div>}
               {alumno.observaciones && <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3"><span className="font-bold text-yellow-800 block text-xs uppercase">📝 Observaciones</span><p className="text-yellow-900 text-sm">{alumno.observaciones}</p></div>}
            </div>
          )}
        </div>

        {/* PIE */}
        <div className="p-4 bg-gray-50 border-t text-right sticky bottom-0 rounded-b-xl">
          <button onClick={cerrar} className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-black transition font-bold shadow-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 👨‍👩‍👧‍👦 DASHBOARD FAMILIAS (VERSIÓN FINAL ARREGLADA)
// ==========================================
const Dashboard = ({ user, misHijos, logout }) => {
  const [showForm, setShowForm] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [alumnoEditar, setAlumnoEditar] = useState(null);
  const [modoModal, setModoModal] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [newPass, setNewPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const alumnoEnVivo = misHijos.find((h) => h.id === alumnoSeleccionado?.id);
const handleUpdatePassword = async () => {
    if (newPass.length < 6) return showToast("⚠️ La contraseña debe tener al menos 6 caracteres.", "warning");
    try {
      await updatePassword(auth.currentUser, newPass);
      showToast("✅ Contraseña actualizada correctamente.", "success");
      setNewPass('');
      setIsChangingPass(false);
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        showToast("🔒 Por seguridad, debes haber iniciado sesión recientemente para cambiar tu contraseña. Por favor, sal y vuelve a entrar.", "error");
      } else {
        showToast("❌ Error: " + error.message, "error");
      }
    }
  };
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => 
      setAvisos(s.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    return () => unsub();
  }, []);

  // Localiza esto en tu Dashboard y cámbialo:
  const alTerminarPrueba = (datosExtras) => {
    // Actualizamos el alumno metiendo la actividad en su "mochila"
    setAlumnoSeleccionado(prev => {
      const alumnoConActividad = { ...prev, ...datosExtras };
      
      // 🚩 LA CLAVE: Abrimos el calendario SOLO cuando ya tenemos el objeto listo
      setModoModal('prueba'); 
      
      return alumnoConActividad;
    });
  };

  // Las familias solicitan bajas; nunca eliminan inscripciones ni perfiles históricos.
  const cancelarSolicitud = async (hijo) => gestionarBaja(hijo);

  const gestionarBaja = async (hijo) => {
    if (hijo.estado === 'sin_inscripcion') {
      return showToast('Para retirar un perfil, contacta con coordinación. Se conserva su historial.', 'warning');
    }
    const esInscripcion = hijo.estado === 'inscrito';
    const aviso = esInscripcion
      ? 'La solicitud quedará registrada en Bajas para que coordinación revise la fecha efectiva y los posibles cargos. Tu inscripción se conservará hasta tramitarla.'
      : 'Se retirará la solicitud y se conservará un registro para coordinación.';
    if (!window.confirm(`¿${esInscripcion ? 'Solicitar la baja' : 'Retirar la solicitud'} de ${hijo.nombre}?\n\n${aviso}`)) return;
    try {
      if (esInscripcion) {
        await runTransaction(db, async transaction => {
          const ref = doc(db, 'students', hijo.id);
          const snap = await transaction.get(ref);
          if (!snap.exists() || snap.data().estado !== 'inscrito') throw new Error('El estado ha cambiado. Recarga la ficha.');
          transaction.update(ref, planificarBajaFamiliar(snap.data()));
        });
      } else {
        // Releer evita retirar una inscripción aceptada desde que se abrió la pantalla.
        const snap = await getDoc(doc(db, 'students', hijo.id));
        if (!snap.exists()) throw new Error('No se encuentra el alumno.');
        const actual = snap.data();
        if (actual.estado !== hijo.estado || actual.estado === 'inscrito') throw new Error('El estado ha cambiado. Recarga la ficha.');
        await liberarPlazaAtomica({
          alumnoId: hijo.id, datosFinales: actualEnTransaccion => planificarBajaFamiliar(actualEnTransaccion),
          estadosPermitidos: [hijo.estado]
        });
      }
      showToast(esInscripcion ? 'Solicitud de baja registrada para revisión de coordinación.' : 'Solicitud retirada y registrada en Bajas.', 'success');
      if (user?.email) {
        try {
          await addDoc(collection(db, 'mail'), {
            to: [user.email],
            message: {
              subject: `${esInscripcion ? 'Solicitud de baja recibida' : 'Solicitud retirada'}: ${hijo.nombre}`,
              html: `<div style="font-family:sans-serif"><h2>${esInscripcion ? 'Solicitud de baja registrada' : 'Retirada de solicitud registrada'}</h2><p>${esInscripcion ? 'Coordinación revisará la fecha efectiva y los posibles cargos. La inscripción y sus datos se conservan hasta la tramitación. Este aviso no confirma una baja sin coste.' : 'Se ha registrado la retirada de la solicitud. Contacta con coordinación si necesitas aclarar tu situación.'}</p><p>Coordinación de Extraescolares CSB</p></div>`
            }
          });
        } catch (error) { console.error('La solicitud se guardó, pero falló el aviso por email:', error); }
      }
    } catch (error) { showToast(error.message || 'No se pudo registrar la solicitud.', 'error'); }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-full text-2xl">👨‍👩‍👧‍👦</div>
          <div><h1 className="text-2xl font-bold text-gray-800">Panel Familiar</h1><p className="text-sm text-gray-500">{user.email}</p></div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* BOTÓN O FORMULARIO DE CAMBIO DE CONTRASEÑA */}
          {!isChangingPass ? (
            <button 
              onClick={() => setIsChangingPass(true)} 
              className="text-blue-600 font-medium border border-blue-100 px-5 py-2 rounded-lg hover:bg-blue-50 w-full md:w-auto text-sm"
            >
              ⚙️ Cambiar Contraseña
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-blue-50 p-1 rounded-lg border border-blue-100 animate-fade-in">
              <input 
                type="password" 
                placeholder="Nueva clave" 
                className="text-sm border p-2 rounded w-32 outline-none focus:ring-2 focus:ring-blue-400"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
              <button 
                onClick={handleUpdatePassword}
                className="bg-green-600 text-white text-[10px] px-3 py-2.5 rounded font-bold uppercase hover:bg-green-700"
              >
                OK
              </button>
              <button 
                onClick={() => { setIsChangingPass(false); setNewPass(''); }}
                className="bg-gray-400 text-white text-[10px] px-2 py-2.5 rounded font-bold uppercase"
              >
                X
              </button>
            </div>
          )}

          {/* TU BOTÓN ORIGINAL DE CERRAR SESIÓN */}
          <button 
            onClick={logout} 
            className="text-red-500 font-medium border border-red-100 px-5 py-2 rounded-lg hover:bg-red-50 w-full md:w-auto"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {avisos.length > 0 && (<div className="mb-6 space-y-2">{avisos.map(aviso => (<div key={aviso.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm text-yellow-800 font-medium flex items-center gap-3"><span className="text-2xl">📢</span><span>{aviso.texto}</span></div>))}</div>)}

      <div className="grid gap-6 md:grid-cols-2 mb-8">
      {misHijos.map((hijo) => {
          // 1. LÓGICA DE ESTADO
          const esInfantil = (hijo.curso || '').toUpperCase().includes('INFANTIL');
          
          // --- 1. LÓGICA DE ADMISIÓN ACTUALIZADA ---
// ¿Tiene plaza real? (Si el admin validó, si es infantil, O si tú pulsaste el nuevo botón de CONFIRMAR)
const estaAdmitido = hijo.validadoAdmin === true || esInfantil || hijo.revisadoAdmin === true;

// ¿Está libre para inscribirse?
const estaLibre = hijo.estado === 'sin_inscripcion' || hijo.estado === 'baja_finalizada';
          
          let bordeColor = 'bg-gray-400';
          let estadoTexto = 'Sin Actividad';
          
          // 2. CONFIGURAMOS COLORES (Versión actualizada con Lista de Espera)
if (hijo.estado === 'inscrito') {
  if (estaAdmitido) {
      bordeColor = 'bg-green-500';
      estadoTexto = '✅ Inscrito';
  } else {
      bordeColor = 'bg-yellow-400';
      estadoTexto = '⏳ Pendiente Validación';
  }
} else if (hijo.estado === 'lista_espera') {
  // 🚩 NUEVO: Color Ámbar para que el padre sepa que está en cola
  bordeColor = 'bg-amber-500'; 
  estadoTexto = '⏳ Lista de Espera';
} else if (hijo.estado === 'prueba_reservada') {
  bordeColor = 'bg-orange-500';
  estadoTexto = '⏳ Prueba Pendiente';
} else if (hijo.estado === 'baja_pendiente') {
  bordeColor = 'bg-red-500';
  estadoTexto = '📉 Baja Solicitada';
} else if (hijo.estado === 'baja_finalizada') {
  bordeColor = 'bg-gray-600';
  estadoTexto = '⚫ Baja Finalizada';
}

          return (
            <div key={hijo.id} className="bg-white/75 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-white/50 relative overflow-hidden group mb-6 transition-all duration-300 hover:shadow-xl hover:border-blue-200 text-left">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${bordeColor}`}></div>
              
              {/* CABECERA */}
              <div className="flex justify-between items-start mb-2 pl-3">
                <div className="flex-1">
                  <h3 className="font-black text-xl text-slate-800 flex items-center gap-2 tracking-tight">
                    {hijo.nombre} 
                    {(!hijo.actividad && hijo.estado === 'sin_inscripcion') && (
                      <button 
                        onClick={() => setAlumnoEditar(hijo)} 
                        className="text-gray-400 hover:text-blue-600 bg-slate-50 border border-slate-100 p-1.5 rounded-full transition-all"
                        title="Editar datos básicos"
                      >
                        ✏️
                      </button>
                    )}
                  </h3>
                  <p className="text-gray-500 text-xs font-black uppercase tracking-wider mt-0.5">{hijo.curso} • {hijo.letra}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm border
                    ${hijo.estado === 'inscrito' && estaAdmitido ? 'bg-green-50 text-green-700 border-green-200' : ''}
                    ${hijo.estado === 'inscrito' && !estaAdmitido ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}
                    ${hijo.estado === 'lista_espera' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                    ${hijo.estado === 'prueba_reservada' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                    ${hijo.estado === 'baja_pendiente' ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}
                    ${hijo.estado === 'baja_finalizada' ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                    ${hijo.estado === 'sin_inscripcion' ? 'bg-slate-50 text-slate-500 border-slate-200' : ''}
                  `}>
                    {estadoTexto}
                  </span>
                </div>
              </div>

              {/* 📊 BARRA DE PROGRESO DE INSCRIPCIÓN */}
              {hijo.estado !== 'sin_inscripcion' && hijo.estado !== 'baja_finalizada' && (
                <div className="ml-3 mt-4 mb-5 px-2 py-3 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center relative gap-2">
                  {(() => {
                    const statusSteps = [
                      { label: 'Solicitud', active: true },
                      { label: 'Prueba', active: hijo.estado === 'prueba_reservada' || hijo.estado === 'inscrito' },
                      { label: 'Validación', active: hijo.estado === 'inscrito' || hijo.estado === 'lista_espera' },
                      { label: 'Confirmada', active: hijo.estado === 'inscrito' && estaAdmitido }
                    ];
                    
                    let activeIndex = 0;
                    if (hijo.estado === 'prueba_reservada') activeIndex = 1;
                    if (hijo.estado === 'lista_espera') activeIndex = 2;
                    if (hijo.estado === 'inscrito') {
                      activeIndex = estaAdmitido ? 3 : 2;
                    }

                    return statusSteps.map((step, idx) => {
                      const isCompleted = idx < activeIndex;
                      const isCurrent = idx === activeIndex;

                      let dotBg = 'bg-slate-200 border-slate-300';
                      let labelColor = 'text-slate-400 font-bold';
                      if (isCompleted) {
                        dotBg = 'bg-blue-600 border-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]';
                        labelColor = 'text-blue-800 font-black';
                      } else if (isCurrent) {
                        if (estaAdmitido) {
                          // 🟢 ¡PASO FINAL CONFIRMADO! En verde esmeralda con sombra, sin parpadeo
                          dotBg = 'bg-green-600 border-green-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]';
                          labelColor = 'text-green-700 font-black';
                        } else {
                          // ⏳ En proceso (amarillo parpadeando)
                          dotBg = hijo.estado === 'lista_espera'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse'
                            : 'bg-yellow-500 border-yellow-500 text-white shadow-[0_0_8px_rgba(234,179,8,0.4)] animate-pulse';
                          labelColor = hijo.estado === 'lista_espera' ? 'text-amber-700 font-black' : 'text-yellow-700 font-black';
                        }
                      }

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center relative z-10">
                          {/* Línea conectora */}
                          {idx > 0 && (
                            <div className={`absolute right-1/2 top-3 -translate-y-1/2 h-[2px] -z-10
                              ${idx <= activeIndex ? 'bg-blue-600' : 'bg-slate-200'}
                            `} style={{ right: '50%', width: '100%' }}></div>
                          )}
                          
                          {/* Círculo indicador */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${dotBg}`}>
                            {isCompleted || (isCurrent && estaAdmitido) ? '✓' : idx + 1}
                          </div>
                          
                          {/* Etiqueta */}
                          <span className={`text-[8px] uppercase tracking-wider mt-1.5 leading-none transition-colors duration-300 ${labelColor}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* DATOS DE ACTIVIDAD (Inscrito, Baja Pendiente o LISTA DE ESPERA) */}
              {(hijo.estado === 'inscrito' || hijo.estado === 'baja_pendiente' || hijo.estado === 'lista_espera') && (
                <div className={`ml-3 mt-4 p-4 rounded-2xl border text-sm relative
                    ${hijo.estado === 'baja_pendiente' ? 'bg-red-50/50 border-red-200' : 
                      hijo.estado === 'lista_espera' ? 'bg-amber-50/50 border-amber-200' :
                      !estaAdmitido ? 'bg-yellow-50/50 border-yellow-200' : 
                      'bg-green-50/50 border-green-100'
                    }`}>

                  {/* CASO NUEVO: LISTA DE ESPERA */}
                  {hijo.estado === 'lista_espera' ? (
                      <div className="pr-6">
                          <p className="font-black text-amber-900 text-base uppercase mb-2 tracking-tight">{hijo.actividad}</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 text-[10px] font-black uppercase tracking-wide">
                                📅 {hijo.dias}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-black uppercase tracking-wide">
                                ⏰ {hijo.horario}
                              </span>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-amber-200 shadow-sm">
                              <p className="font-black text-amber-800 text-[10px] uppercase mb-0.5">⏳ En espera de vacante</p>
                              <p className="text-[10px] text-amber-700 leading-tight">
                                No hay plazas disponibles. Te avisaremos por orden de lista en cuanto quede un hueco libre.
                              </p>
                          </div>
                      </div>
                  ) : 
                  
              /* CASO: PENDIENTE DE VALIDAR (AMARILLO) */
              !estaAdmitido && hijo.estado === 'inscrito' ? (
                <div className="text-center pr-6">
                    <p className="font-black text-yellow-900 text-base uppercase mb-2 tracking-tight">{hijo.actividad}</p>
                    
                    {/* 🚀 FECHA PREVISTA EN AMARILLO */}
                    {hijo.inicioDeseado && (
                      <p className="text-[10px] font-black text-yellow-700 mb-2 uppercase tracking-wide">
                        🎯 Previsto para: {hijo.inicioDeseado.split('-').reverse().join('/')}
                      </p>
                    )}

                    <div className="flex flex-wrap justify-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 text-[10px] font-black uppercase tracking-wide">
                          📅 {hijo.dias}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-black uppercase tracking-wide">
                          ⏰ {hijo.horario}
                        </span>
                    </div>
                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-yellow-200 shadow-sm">
                        <p className="font-black text-yellow-800 text-xs">⏳ Solicitud Recibida</p>
                        <p className="text-[10px] text-yellow-700 mt-0.5">
                          {(hijo.actividad || '').toUpperCase().includes('ADULTO') || (hijo.actividad || '').toUpperCase().includes('WATERPOLO')
                            ? "El club está revisando tu inscripción."
                            : "El coordinador está validando el nivel."
                          }
                        </p>
                    </div>
                </div>
              ) : (
                /* CASO: ADMITIDO O BAJA PENDIENTE */
                <div className="pr-6">
                  <p className="font-black text-slate-800 text-base uppercase mb-2 tracking-tight">{hijo.actividad}</p>
                  
                  {/* 🚀 FECHA DE INICIO CONFIRMADA EN AZUL */}
                  {hijo.fechaAlta && (
                    <div className="mb-2.5">
                      <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm inline-flex items-center gap-1 uppercase tracking-wide">
                        🚀 Inicio: {hijo.fechaAlta.split('T')[0].split('-').reverse().join('/')}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 text-[10px] font-black uppercase tracking-wide">
                        📅 {hijo.dias}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-black uppercase tracking-wide">
                        ⏰ {hijo.horario}
                      </span>
                  </div>
                  {hijo.estado === 'baja_pendiente' && (
                    <p className="text-red-600 font-bold text-xs mt-2.5 uppercase tracking-wide flex items-center gap-1"><span>⚠️</span> Baja efectiva a fin de mes</p>
                  )}
                  {estaAdmitido && hijo.estado === 'inscrito' && (
                    <p className="text-green-600 font-bold text-[10px] mt-2.5 uppercase tracking-wider flex items-center gap-1"><span>✅</span> Plaza Confirmada</p>
                  )}
                </div>
              )}
              </div>
              )}
              
{/* DATOS DE PRUEBA */}
{hijo.estado === 'prueba_reservada' && (
  <div className="ml-3 mt-4 bg-orange-50/50 p-4 rounded-2xl border border-orange-200 text-sm">
    <div className="mb-3 pb-3 border-b border-orange-200/50">
        <p className="text-[10px] font-black text-orange-800 uppercase tracking-wider mb-1">🎯 Grupo Pre-seleccionado:</p>
        
        {/* MODIFICACIÓN: Si ya tiene actividad Y días, mostramos la info. Si no, el botón. */}
        {hijo.actividad && hijo.dias ? (
            <div>
              <p className="text-lg font-black text-orange-950 leading-tight uppercase tracking-tight">{hijo.actividad}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 text-[10px] font-black uppercase tracking-wide">
                    📅 {hijo.dias}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-black uppercase tracking-wide">
                    ⏰ {hijo.horario || 'Horario pendiente'}
                  </span>
              </div>
            </div>
        ) : (
            <button 
              onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} 
              className="w-full bg-white border border-orange-300 text-orange-700 py-1.5 rounded text-xs font-bold hover:bg-orange-100 transition"
            >
                👉 Elegir Grupo y Horario
            </button>
        )}
    </div>
    
{/* SECCIÓN DE LA CITA DE NIVEL - VERSIÓN FINAL SEGURA */}
<div className="flex items-center gap-2">
  <span className="text-2xl">🗓️</span>
  <div>
    <p className="font-bold text-orange-900 text-[10px] uppercase">Cita para Prueba</p>
    
    {/* 🚩 LA LLAVE MAESTRA:
        Si el estado es 'prueba_reservada', el botón rojo DESAPARECE.
        Mostramos el texto de la cita si existe, y si no, un mensaje de carga. */}
    {hijo.estado === 'prueba_reservada' || hijo.citaNivel ? (
      <div className="mt-1 bg-white/80 p-2 rounded-lg border border-green-200 shadow-sm">
        <p className="text-indigo-950 font-black leading-tight text-xs">
          {hijo.citaNivel || "Cita confirmada"} 
        </p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-green-600 text-[10px]">●</span>
          <span className="text-[9px] text-green-700 font-black uppercase tracking-widest">
            Cita Confirmada
          </span>
        </div>
      </div>
    ) : (
      /* El botón rojo solo sale si el estado NO es reserva Y NO hay citaNivel */
      <button 
        type="button"
        onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('prueba'); }} 
        className="mt-1 text-red-600 font-black underline animate-pulse text-sm block cursor-pointer"
      >
        ⚠️ ¡RESERVAR HORA AHORA!
      </button>
    )}
  </div>
</div>
  </div>
)}

              {/* AVISO BAJA FINALIZADA */}
              {hijo.estado === 'baja_finalizada' && (
                 <div className="text-center py-2 text-gray-400 text-xs italic mt-2 border-t border-gray-100 pt-3">
                     Este alumno ha finalizado su actividad.
                 </div>
              )}

              {/* === BOTONES DE ACCIÓN (AQUÍ ESTÁ LA CORRECCIÓN) === */}
              <div className="mt-6 pt-4 ml-3 border-t border-gray-100 flex gap-2">
                
                {/* 1. SOLO SI TIENE PLAZA CONFIRMADA -> TRAMITAR BAJA (Oficial) */}
                {hijo.estado === 'inscrito' && (
                    <button onClick={() => gestionarBaja(hijo)} className="w-full bg-white text-red-600 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">
                        Tramitar Baja
                    </button>
                )}

                {/* 3. INSCRIBIR (Nuevos o Bajas Finalizadas) */}
                {estaLibre && (
                  <div className="flex w-full gap-2">
                    <button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">
                        Inscribir
                    </button>

                  </div>
                )}

                {/* 4. CANCELAR PRUEBA */}
                {hijo.estado === 'prueba_reservada' && (
                    <button onClick={() => cancelarSolicitud(hijo)} className="w-full bg-white text-red-500 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">
                        ✖️ Cancelar Solicitud
                    </button>
                )}

                {/* Una solicitud en espera no ocupa aforo: la familia puede retirarla. */}
                {hijo.estado === 'lista_espera' && (
                    <button onClick={() => cancelarSolicitud(hijo)} className="w-full bg-white text-red-600 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">
                        ✖️ Salir de la lista de espera
                    </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <button onClick={() => setShowForm(true)} className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 mb-10"><span className="text-2xl">+</span> Añadir Otro Alumno</button>
      
{/* MODALES Y FORMULARIOS */}
{showForm && (<FormularioHijo close={() => setShowForm(false)} user={user} />)}
      
      {alumnoEditar && (
        <FormularioHijo 
          alumnoAEditar={alumnoEditar} 
          close={() => setAlumnoEditar(null)} 
          user={user} 
        />
      )}

      {/* 1. Cambiamos alumnoEnVivo por alumnoSeleccionado para que lea la actividad de la memoria */}
      {modoModal === 'prueba' && alumnoSeleccionado && (
        <PantallaPruebaNivel 
          alumno={alumnoSeleccionado} 
          close={() => setModoModal(null)} 
          onSuccess={alTerminarPrueba} 
          user={user} 
        />
      )}

      {/* 2. Cambiamos la función anónima por alTerminarPrueba para que reciba los datos del grupo */}
      {modoModal === 'inscripcion' && alumnoEnVivo && (
        <PantallaInscripcion 
          alumno={alumnoEnVivo} 
          close={() => setModoModal(null)} 
          onRequirePrueba={alTerminarPrueba} 
          user={user} 
        />
      )}
    </div>
  );
};

// ==========================================
// ✏️ FORMULARIO EDICIÓN DE DATOS
// ==========================================
const FormularioHijo = ({ close, user, alumnoAEditar = null }) => {
  // Cambiamos el useState para que elija: o datos del alumno o vacío
  const [data, setData] = useState(alumnoAEditar ? { ...alumnoAEditar } : { 
    nombre: '', 
    telefono: '',
    curso: LISTA_CURSOS[0].val, 
    letra: 'A', 
    fechaNacimiento: '', 
    natacionPasado: 'no', 
    aceptaNormas: false, 
    autorizaFotos: false 
  });
  

  const validarYGuardarAlumno = async () => {
    // 🚩 BLOQUEO DE SEGURIDAD: Si ya tiene actividad, no se puede editar
    if (alumnoAEditar && alumnoAEditar.actividad) {
      showToast("⛔ Este alumno ya tiene una actividad vinculada. Para cambios, contacta con secretaría.", "error");
      close();
      return;
    }    const telefonoLimpio = data?.telefono ? String(data.telefono).trim() : "";
    
    // Validaciones
    if (!data.nombre || data.nombre.trim() === "") return showToast("⚠️ El nombre es obligatorio.", "warning");
    if (!data.fechaNacimiento) return showToast("⚠️ La fecha de nacimiento es obligatoria.", "warning");
    if (!data.aceptaNormas) return showToast("⚠️ Debes aceptar las normas.", "warning");

    try {
      const esInfantil = (data.curso || '').toUpperCase().includes('INF');

      // PREPARAMOS LOS DATOS COMUNES
      const datosFinales = {
        ...data,
        parentId: user.uid,
        telefono: telefonoLimpio,
        natacionPasado: data.natacionPasado, 
        esAntiguoAlumno: data.natacionPasado === 'si',
        esInfantil: esInfantil,
      };

      // ---------------------------------------------------------
      // 🚀 EL INTERRUPTOR: ¿EDICIÓN O CREACIÓN?
      // ---------------------------------------------------------
      if (alumnoAEditar && alumnoAEditar.id) {
        // MODO EDICIÓN: Actualizamos el que ya existe
        const alumnoRef = doc(db, 'students', alumnoAEditar.id);
        await updateDoc(alumnoRef, {
          ...datosFinales,
          ultimaEdicion: new Date().toISOString()
        });
        showToast("✅ Datos actualizados correctamente", "success");
      } else {
        // MODO CREACIÓN: Creamos uno nuevo
        await addDoc(collection(db, 'students'), {
          ...datosFinales,
          estado: 'sin_inscripcion',
          fechaCreacion: new Date().toISOString()
        });
        showToast("✅ Alumno registrado correctamente", "success");
      }
      
      close();
    } catch (error) {
      console.error("Error al guardar:", error);
      showToast("No se pudo guardar en la base de datos.", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-blue-900 mb-4">👶 Añadir Estudiante</h2>
        
        <div className="space-y-4 text-left">
          {/* 1. NOMBRE */}
          <div>
            <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1">Nombre y Apellidos *</label>
            <input 
              className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white outline-none" 
              placeholder="Nombre completo" 
              value={data.nombre}
              onChange={e => setData({...data, nombre: e.target.value})} 
            />
          </div>

          {/* 2. PREGUNTA DE NATACIÓN */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs font-bold text-blue-800 mb-2">¿Estuvo en la extraescolar el curso pasado?</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="nat" 
                  checked={data.natacionPasado === 'si'} 
                  onChange={() => setData({...data, natacionPasado: 'si'})} 
                /> 
                <span className="text-sm font-medium">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="nat" 
                  checked={data.natacionPasado === 'no'} 
                  onChange={() => setData({...data, natacionPasado: 'no'})} 
                /> 
                <span className="text-sm font-medium">No</span>
              </label>
            </div>
          </div>

          {/* 3. CURSO Y LETRA */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1">Curso</label>
              <select className="w-full border p-3 rounded-lg bg-gray-50" value={data.curso} onChange={e => setData({...data, curso: e.target.value})}>
                {LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1">Letra</label>
              <select className="w-full border p-3 rounded-lg bg-gray-50" value={data.letra} onChange={e => setData({...data, letra: e.target.value})}>
                <option>A</option><option>B</option><option>C</option>
              </select>
            </div>
          </div>

          {/* 4. FECHA DE NACIMIENTO */}
          <div>
            <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 ml-1">Fecha de Nacimiento *</label>
            <input 
              type="date" 
              className="w-full border p-3 rounded-lg bg-gray-50" 
              value={data.fechaNacimiento}
              onChange={e => setData({...data, fechaNacimiento: e.target.value})} 
            />
          </div>

          {/* 5. NORMAS */}
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={data.aceptaNormas} onChange={e => setData({...data, aceptaNormas: e.target.checked})} />
            Acepto las normas de funcionamiento *
          </label>

          {/* 6. BOTONES */}
          <div className="flex gap-3 mt-4">
            <button onClick={close} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition">Cancelar</button>
            <button 
              onClick={validarYGuardarAlumno} 
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 📝 MODAL INSCRIPCIÓN (SOLUCIÓN DEFINITIVA CHECKBOX)
// ==========================================
const PantallaInscripcion = ({ alumno, close, onRequirePrueba, user }) => {
  // 1. ESTADOS
  const [datosAlumno, setDatosAlumno] = useState({ 
    nombre: alumno.nombre, 
    curso: alumno.curso, 
    fechaNacimiento: alumno.fechaNacimiento || '',
    // La familia debe elegir expresamente cuándo comenzar.
    inicioDeseado: ''
  });
  const [verNormas, setVerNormas] = useState(false);
  const [autorizaFotos, setAutorizaFotos] = useState(alumno.autorizaFotos === true);
  
  // USAREMOS UNA REFERENCIA PARA EVITAR EL BUG DE SINCRONIZACIÓN
  // Esto guarda el valor "real" sin depender de los renderizados de React
  const normasRef = useRef(alumno.aceptaNormas === true);
  
  // Estado visual para que se pinte verde/gris
  const [aceptaNormasVisual, setAceptaNormasVisual] = useState(alumno.aceptaNormas === true);

  // Filtramos las actividades (Asegúrate de tener OFERTA_ACTIVIDADES importado o definido)
  const actividadesDisponibles = OFERTA_ACTIVIDADES.filter((act) => act.cursos.includes(datosAlumno.curso));

  // Función para cambiar el checkbox de forma segura
  const toggleNormas = () => {
      const nuevoValor = !normasRef.current; // Invertimos el valor actual
      normasRef.current = nuevoValor;        // Guardamos en la referencia (Lógica)
      setAceptaNormasVisual(nuevoValor);     // Guardamos en el estado (Visual)
  };
  // 1. Estado para guardar únicamente cifras agregadas de ocupación (sin datos de otros alumnos)
  const [aforosPublicos, setAforosPublicos] = useState({});

  // 2. Los documentos de aforo son públicos y no contienen nombres ni identificadores personales.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'aforos'), (s) => {
      const siguiente = {};
      s.forEach(documento => { siguiente[documento.id] = documento.data(); });
      setAforosPublicos(siguiente);
    }, (error) => {
      console.error("Error al escuchar ocupación de plazas:", error);
      setAforosPublicos({});
    });
    return () => unsub();
  }, []);
  // 🚩 LÓGICA DE TEMPORADA UNIFICADA (Junio-Septiembre = Octubre; Octubre-Mayo = curso activo)
  const infoAlta = obtenerInfoInicioInscripcion();



  const obtenerEstadoPlaza = (actividadId, textoDiasSeleccionado, cursoAlumno, horarioSeleccionado) => {
    try {
      const slots = construirSlotsAforo({ actividadId, dias: textoDiasSeleccionado, horario: horarioSeleccionado, curso: cursoAlumno });
      const datos = slots.map(slot => aforosPublicos[slot.id]).filter(Boolean);
      const inicializado = datos.length === slots.length;
      const ocupacionMaxEnDias = inicializado ? Math.max(...datos.map(d => Number(d.ocupados || 0))) : 0;
      const max = slots[0]?.maximo || 0;
      const plazasLibres = Math.max(0, max - ocupacionMaxEnDias);
      return {
      lleno: !inicializado || datos.some(d => Number(d.ocupados || 0) >= Number(d.maximo || max)),
      inicializado,
      // 🚩 REGLA DE ORO: Si quedan 3 o menos plazas reales
      esCritico: max > 0 && plazasLibres <= 3 && plazasLibres > 0,
      cupoActual: ocupacionMaxEnDias,
      maximo: max,
      libres: plazasLibres
    };
    } catch (error) {
      return { lleno: true, inicializado: false, esCritico: false, cupoActual: 0, maximo: 0, libres: 0 };
    }
  };
  // 2. FUNCIÓN DE INSCRIPCIÓN
  const inscribir = async (act, op) => {
    if (!['proximo', 'inmediato'].includes(datosAlumno.inicioDeseado)) {
      return showToast('Elige cuándo quieres comenzar antes de inscribirte.', 'warning');
    }
    // 1. Verificación de Normas
    if (normasRef.current !== true) {
        return showToast("⚠️ Es obligatorio aceptar las normas.", "warning");
    }
    
    // 🔄 LECTURA DE SEGURIDAD
    const alumnoRef = doc(db, 'students', alumno.id);
    const snap = await getDoc(alumnoRef);
    const d = snap.exists() ? snap.data() : alumno;

    // 🕵️‍♂️ DEFINICIÓN DE VARIABLES CRÍTICAS (Aquí estaba el fallo, ahora están todas)
    const cursoNombre = (d.curso || '').toUpperCase();
    const esInfantil = cursoNombre.includes('INF');
    const tienePaseVIP = d.natacionPasado === 'si' || d.esAntiguoAlumno === true || d.antiguo === 'si';
    const esAdulto = act.id === 'adultos' || cursoNombre.includes('ADULTO');

    // 🚩 CÁLCULO DE FECHA UNIFICADO POR TEMPORADA
    const inicioDeseado = datosAlumno.inicioDeseado;
    const fechaFinalISO = calcularFechaAlta(inicioDeseado).fechaISO;

    const datosComunes = {
      nombre: d.nombre, 
      curso: d.curso, 
      actividad: act.nombre,
      actividadId: act.id, 
      dias: op.dias,
      horario: op.horario,
      precio: op.precio,
      fechaAlta: fechaFinalISO, 
      revisadoAdmin: false,
      inicioDeseado: inicioDeseado, 
      autorizaFotos: autorizaFotos,
      aceptaNormas: normasRef.current
    };

    // CASO A: REQUIERE PRUEBA DE NIVEL (REVISADO)
    // No piden prueba: Infantiles, VIPs, Adultos o si ya tienen cita/reserva activa
    const tieneCitaValida = d.citaNivel && d.estado !== 'sin_inscripcion' && d.estado !== 'baja_finalizada';

    if (act.requierePrueba && !esInfantil && !tienePaseVIP && !tieneCitaValida && d.estado !== 'prueba_reservada' && !esAdulto) {
      if(!confirm(`⚠️ Esta actividad requiere PRUEBA DE NIVEL.\n\n¿Continuar para elegir hora?`)) return;
      
      close(); 
      setTimeout(() => { 
        onRequirePrueba({
          ...datosComunes,
          inicioDeseado: inicioDeseado
        }); 
      }, 400); 
      return; 
    }

    // CASO B: INSCRIPCIÓN DIRECTA O LISTA DE ESPERA
    const infoPlaza = obtenerEstadoPlaza(act.id, op.dias, d.curso, op.horario);
    if (!infoPlaza.inicializado) {
      return showToast('Estamos comprobando las plazas. Inténtalo de nuevo en unos minutos.', 'warning');
    }
    
    let estadoFinalReal;
    if (tienePaseVIP || esInfantil || esAdulto) {
        estadoFinalReal = 'inscrito';
    } else if (act.requierePrueba) {
        estadoFinalReal = 'prueba_reservada'; 
    } else {
        estadoFinalReal = 'inscrito';
    }

    let mensajeConfirmacion = `¿Confirmar inscripción en ${act.nombre}?`;
    if (infoPlaza.lleno) {
        mensajeConfirmacion = `⚠️ Este grupo está completo actualmente.\n\n¿Quieres apuntarte a la LISTA DE ESPERA para ${op.dias}?`;
        estadoFinalReal = 'lista_espera';
    }

    if (!confirm(mensajeConfirmacion)) return;
    
    try {
        const resultadoReserva = await reservarPlazaAtomica({
          alumnoId: alumno.id,
          actividadId: act.id,
          actividad: act.nombre,
          dias: op.dias,
          horario: op.horario,
          curso: d.curso,
          datosExtra: {
            ...datosComunes,
            fechaInscripcion: serverTimestamp(),
            citaNivel: null,
            citaFecha: null,
            citaHora: null,
            citaId: null
          }
        });
        estadoFinalReal = resultadoReserva.resultado;

        // Envío de Email
        if (user && user.email) {
            let detalleParaEmail = estadoFinalReal === 'lista_espera' 
                ? `LISTA DE ESPERA para ${act.nombre} (${op.dias})` 
                : `${act.nombre} — ${op.dias} a las ${op.horario}`; 
            await enviarEmailConfirmacion(
              user.email,
              d.nombre,
              detalleParaEmail,
              estadoFinalReal === 'lista_espera' ? 'lista_espera' : 'alta'
            );
        }

        close();
        showToast(
          estadoFinalReal === 'lista_espera'
            ? '⏳ Grupo completo: inscripción guardada en lista de espera.'
            : '✅ Plaza confirmada correctamente.',
          estadoFinalReal === 'lista_espera' ? 'warning' : 'success'
        );

    } catch (error) {
        console.error("Error final:", error);
        showToast("Hubo un error al guardar los datos.", "error");
    }
};

return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* CABECERA */}
        <div className="bg-blue-600 p-4 flex justify-between items-center shrink-0 rounded-t-xl">
            <h3 className="text-white font-bold text-lg">Inscribir a {alumno.nombre}</h3>
            <button onClick={close} className="text-white/80 hover:text-white hover:bg-blue-700 p-2 rounded-full transition">✕</button>
        </div>

        {/* CUERPO CON SCROLL */}
<div className="p-6 overflow-y-auto flex-1">
  

{/* 🚩 BLOQUE DE FECHA OBLIGATORIO (PASO 1) */}
<div className="mb-8 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-sm">
    <div className="flex items-center justify-center gap-2 mb-4">
        <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">PASO 1</span>
        <p className="text-[11px] font-black text-blue-900 uppercase tracking-widest">
            ¿Cuándo quieres comenzar? Elige una opción
        </p>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
        {/* Opción Mes Siguiente */}
        <button 
            type="button"
            onClick={() => setDatosAlumno({ ...datosAlumno, inicioDeseado: 'proximo' })}
            className={`group relative p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${
                datosAlumno.inicioDeseado === 'proximo' 
                ? 'border-blue-600 bg-white shadow-lg ring-4 ring-blue-100' 
                : 'border-gray-200 bg-gray-50/50 grayscale hover:grayscale-0'
            }`}
        >
            <span className={`text-[10px] font-bold mb-1 ${datosAlumno.inicioDeseado === 'proximo' ? 'text-blue-600' : 'text-gray-400'}`}>INICIO EL DÍA 1</span>
            <span className="text-sm font-black text-gray-800 uppercase">1 de {infoAlta.sigMes}</span>
            {datosAlumno.inicioDeseado === 'proximo' && <span className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md">✓</span>}
        </button>

        {/* Opción Mes Actual (Día 20) */}
{!infoAlta.diaCortePasado && (
    <button 
        type="button"
        onClick={() => setDatosAlumno({ ...datosAlumno, inicioDeseado: 'inmediato' })}
        className={`group relative p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${
            datosAlumno.inicioDeseado === 'inmediato' 
            ? 'border-orange-500 bg-orange-50 shadow-lg ring-4 ring-orange-200 scale-105' 
            : 'border-gray-200 bg-gray-50/50 opacity-70'
        }`}
    >
        <span className={`text-[10px] font-black mb-1 px-2 py-0.5 rounded-full ${datosAlumno.inicioDeseado === 'inmediato' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            EMPEZAR HOY
        </span>
        
        <span className="text-sm font-black text-gray-900 uppercase">
            Mes de {infoAlta.mesActual}
        </span>
        
        {/* RECUADRO DE ADVERTENCIA ECONÓMICA MUY CLARO */}
        <div className={`mt-2 p-2 rounded-lg border-2 flex flex-col items-center gap-1 ${datosAlumno.inicioDeseado === 'inmediato' ? 'bg-white border-red-200' : 'bg-transparent border-gray-200'}`}>
            <span className="text-lg">⚠️</span>
            <p className="text-[10px] font-black text-red-600 leading-tight uppercase">
                ¡ATENCIÓN!<br/>
                SE COBRARÁ EL MES DE<br/>
                <span className="text-xs font-extrabold">{infoAlta.mesActual.toUpperCase()} COMPLETO</span>
            </p>
        </div>

        {datosAlumno.inicioDeseado === 'inmediato' && (
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md font-bold">✓</span>
        )}
    </button>
)}
    </div>

    {infoAlta.diaCortePasado && (
        <p className="text-[10px] text-gray-500 text-center mt-3 italic">
            * Las inscripciones para {infoAlta.mesActual} están cerradas por fecha de corte.
        </p>
    )}
</div>

{/* DATOS BÁSICOS (Lo que ya tenías) */}
<div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
    {/* ... nombre y curso ... */}
</div>

           {/* SECCIÓN DE NORMATIVA DESPLEGABLE */}
<div className="mb-4">
    <div 
        onClick={() => setVerNormas(!verNormas)} 
        className="flex justify-between items-center p-3 bg-gray-100 rounded-t-lg border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors"
    >
        <span className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest">
            📄 Ver Normativa y Condiciones
        </span>
        <span className="text-gray-400 text-xs">{verNormas ? '▲ Ocultar' : '▼ Mostrar'}</span>
    </div>

    {verNormas && (
        <div className="w-full h-40 overflow-y-auto p-4 bg-white border-x border-gray-200 text-[11px] text-gray-600 leading-relaxed shadow-inner">
            <h4 className="font-bold text-gray-800 mb-1">1. CONDICIONES GENERALES</h4>
            <p className="mb-3">El club se reserva el derecho de organizar los grupos por niveles...</p>
            <h4 className="font-bold text-red-800 mb-1 italic underline">2. POLÍTICA DE BAJAS</h4>
            <p className="mb-3 font-medium">Las bajas deben tramitarse antes del día 25 del mes anterior. No se realizarán devoluciones una vez pasado dicho día.</p>
        </div>
    )}

    <div 
        onClick={toggleNormas}
        className={`p-4 rounded-b-lg border transition-all cursor-pointer flex items-center gap-3 
        ${aceptaNormasVisual ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}
    >
        <div className={`w-6 h-6 rounded border flex items-center justify-center ${aceptaNormasVisual ? 'bg-green-600 border-green-600' : 'bg-white border-gray-400'}`}>
            {aceptaNormasVisual && <span className="text-white font-bold text-sm">✓</span>}
        </div>
        <span className={`text-sm font-bold ${aceptaNormasVisual ? 'text-green-800' : 'text-yellow-900'}`}>
            He leído y acepto la normativa (Obligatorio)
        </span>
    </div>
</div>
{/* SECCIÓN DE FOTOS (OPCIONAL) */}
<div 
    onClick={() => setAutorizaFotos(!autorizaFotos)}
    className={`mb-6 p-4 rounded-lg border transition-all cursor-pointer flex items-start gap-3 
    ${autorizaFotos ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}
>
    <div className={`mt-1 w-6 h-6 rounded border flex items-center justify-center transition-colors ${autorizaFotos ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
        {autorizaFotos && <span className="text-white font-bold text-sm">✓</span>}
    </div>
    <div className="text-xs">
        <p className={`font-bold mb-1 ${autorizaFotos ? 'text-blue-900' : 'text-gray-700'}`}>
            📸 Autorización de imagen (Opcional)
        </p>
        <p className={autorizaFotos ? 'text-blue-800' : 'text-gray-500'}>
            Autorizo el uso de fotos/vídeos del alumno para fines informativos y redes sociales.
        </p>
    </div>
</div>

            <h4 className="font-bold text-gray-800 text-lg mb-4 border-b pb-2">Elige Actividad y Horario:</h4>

            {actividadesDisponibles.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-100 rounded-xl border border-dashed border-gray-300">
                    <p>No hay actividades disponibles para <strong>{datosAlumno.curso}</strong>.</p>
                </div>
            ) : (
                <div className="space-y-4">
{actividadesDisponibles.map(act => (
    <div key={act.id} className="border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition bg-white group">
        
        {/* Header de la actividad */}
        <div className="bg-gray-50 p-3 border-b flex justify-between items-center group-hover:bg-blue-50 transition">
            <h5 className="font-bold text-blue-900 text-lg">{act.nombre}</h5>
            {act.requierePrueba && (
                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded border border-orange-200 uppercase tracking-wide">
                    Requiere Prueba
                </span>
            )}
        </div>

        {/* Lista de horarios */}
        <div className="p-3 grid gap-2">
            {act.opciones.map((op, idx) => {
                // 🔍 CALCULAMOS EL ESTADO PARA ESTA OPCIÓN
                const info = obtenerEstadoPlaza(act.id, op.dias, alumno.curso, op.horario);
                const plazasLibres = info.maximo - info.cupoActual;

                return (
                    <div key={idx} className="space-y-1">
                        <button 
                            type="button"
                            disabled={!info.inicializado}
                            onClick={() => inscribir(act, op)} 
                            className={`flex justify-between items-center w-full p-3 rounded-lg border transition-all text-left relative ${
                                info.lleno 
                                ? 'bg-amber-50 border-amber-200 shadow-sm' 
                                : 'bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50 shadow-sm'
                            }`}
                        >
                            <div>
                                <span className={`block font-bold ${info.lleno ? 'text-amber-800' : 'text-gray-800'}`}>
                                    {op.dias}
                                </span>
                                <span className="text-xs text-gray-500 font-mono bg-white px-1 rounded border mt-1 inline-block">
                                    ⏰ {op.horario}
                                </span>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1">
                                <span className={`font-bold px-3 py-1 rounded-full text-sm block ${
                                    info.lleno ? 'bg-amber-200 text-amber-700' : 'bg-blue-100 text-blue-600'
                                }`}>
                                    {op.precio}
                                </span>

                                {/* 🚦 ETIQUETAS DINÁMICAS */}
                                {info.lleno ? (
                                    <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black uppercase">
                                        {info.inicializado ? '⏳ Lista Espera' : '🔄 Comprobando plazas'}
                                    </span>
                                ) : info.esCritico ? (
                                    <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-black uppercase animate-pulse">
                                        ⚠️ Quedan {plazasLibres} plazas
                                    </span>
                                ) : (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-black uppercase">
                                        ✅ Disponible
                                    </span>
                                )}
                            </div>
                        </button>

                        {/* PEQUEÑA NOTA ACLARATORIA SI ESTÁ LLENO */}
                        {info.lleno && info.inicializado && (
                            <p className="text-[9px] text-amber-600 font-bold px-2 italic">
                                * Se inscribirá automáticamente en lista de espera
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 📅 PANTALLA PRUEBA DE NIVEL (VERSIÓN FINAL BLINDADA)
// ==========================================
const PantallaPruebaNivel = ({ alumno, close, onSuccess, user }) => {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocupacion, setOcupacion] = useState({});
  const [mesVisual, setMesVisual] = useState(new Date());

  // 1. FUNCIONES DE APOYO
  const seleccionarDiaPrueba = (fechaISO) => {
    setFecha(fechaISO);
    setHora(null); 
  };

  const moverMes = (delta) => {
    const nuevoMes = new Date(mesVisual.getFullYear(), mesVisual.getMonth() + delta, 1);
    setMesVisual(nuevoMes);
  };

  // 2. GENERAR TURNOS DE 5 MINUTOS (JUNIO DE 17 A 18 Y SEPTIEMBRE DE 15 A 17)
  const franjas = [];
  if (fecha) {
    const d = new Date(fecha);
    const mesActual = d.getUTCMonth() + 1;
    
    let horaInicio = 16;
    let horaFin = 18;
    if (mesActual === 6) {
      horaInicio = 17;
      horaFin = 18;
    } else if (mesActual === 9) {
      horaInicio = 15;
      horaFin = 17;
    }

    for (let h = horaInicio; h < horaFin; h++) {
      for (let m = 0; m < 60; m += 5) {
        franjas.push(`${h}:${m.toString().padStart(2, '0')}`);
      }
    }
  }

  // 3. CONSULTAR AFORO EN TIEMPO REAL SIN PII (`aforosPruebas`)
  useEffect(() => {
    if (!fecha) {
      setOcupacion({});
      return;
    }
    const q = query(collection(db, 'aforosPruebas'), where('fecha', '==', fecha));
    const unsub = onSnapshot(q, (snap) => {
      const counts = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.hora) counts[data.hora] = Number(data.ocupados || 0);
      });
      setOcupacion(counts);
    }, (e) => {
      console.error("Error al consultar aforo de pruebas de nivel:", e);
      setOcupacion({});
    });
    return () => unsub();
  }, [fecha]);

// 4. FUNCIÓN GUARDAR RESERVA ATÓMICA (CAPACIDAD REAL 2 ALUMNOS / 5 MIN + TEMPORADA UNIFICADA)
const confirmarReserva = async () => {
  if (!fecha || !hora) return showToast("⚠️ Selecciona un lunes y una hora.", "warning");
  
  const citaTexto = `${fecha.split('-').reverse().join('/')} a las ${hora}`;
  if (citaTexto.includes('undefined') || !citaTexto) return showToast("⚠️ Error al generar la cita.", "error");

  setLoading(true);
  try {
    const slotId = construirIdSlotPruebaNivel(fecha, hora);
    const alumnoRef = doc(db, 'students', alumno.id);
    const slotRef = doc(db, 'aforosPruebas', slotId);
    const altaPlanificada = calcularFechaAlta(alumno.inicioDeseado);
    const actorUid = auth.currentUser?.uid || user?.uid || '';

    await runTransaction(db, async (transaction) => {
      const alumnoSnap = await transaction.get(alumnoRef);
      if (!alumnoSnap.exists()) throw new Error('ALUMNO_NO_EXISTE');
      const actual = alumnoSnap.data();

      const slotSnap = await transaction.get(slotRef);
      const prevSlotId = typeof actual.citaId === 'string' && /^\d{4}-\d{2}-\d{2}__\d{2}-\d{2}$/.test(actual.citaId)
        ? actual.citaId
        : null;
      const prevSlotRef = prevSlotId && prevSlotId !== slotId ? doc(db, 'aforosPruebas', prevSlotId) : null;
      const prevSlotSnap = prevSlotRef ? await transaction.get(prevSlotRef) : null;

      const mismoHueco = prevSlotId === slotId && actual.estado === 'prueba_reservada';
      const ocupadosActuales = slotSnap.exists() ? Number(slotSnap.data().ocupados || 0) : 0;
      const maximoHueco = slotSnap.exists() ? Number(slotSnap.data().maximo || CAPACIDAD_POR_HUECO) : CAPACIDAD_POR_HUECO;

      if (!mismoHueco && ocupadosActuales >= maximoHueco) {
        throw new Error('HUECO_COMPLETO');
      }

      const ahora = serverTimestamp();

      if (prevSlotRef && prevSlotSnap?.exists() && Number(prevSlotSnap.data().ocupados || 0) > 0) {
        transaction.update(prevSlotRef, {
          ocupados: Number(prevSlotSnap.data().ocupados) - 1,
          lastStudentId: alumno.id,
          lastActorUid: actorUid,
          lastOperation: 'LIBERACION',
          updatedAt: ahora
        });
      }

      if (!mismoHueco) {
        if (slotSnap.exists()) {
          transaction.update(slotRef, {
            ocupados: ocupadosActuales + 1,
            lastStudentId: alumno.id,
            lastActorUid: actorUid,
            lastOperation: 'RESERVA',
            updatedAt: ahora
          });
        } else {
          transaction.set(slotRef, {
            fecha,
            hora,
            maximo: CAPACIDAD_POR_HUECO,
            ocupados: 1,
            lastStudentId: alumno.id,
            lastActorUid: actorUid,
            lastOperation: 'RESERVA',
            updatedAt: ahora
          });
        }
      }

      transaction.update(alumnoRef, {
        estado: 'prueba_reservada',
        citaNivel: citaTexto,
        citaFecha: fecha,
        citaHora: hora,
        citaId: slotId,

        // Borramos estos campos para que el Panel Familiar NO muestre "Inscrito" todavía.
        fechaAlta: null,
        fechaSolicitud: null,
        fecha_alta: null,

        actividad: alumno.actividad || '',
        actividadId: alumno.actividadId || '',
        dias: alumno.dias || '',
        horario: alumno.horario || '',

        // Preferencia coherente con la temporada actual (jun-sep -> octubre; oct-may -> curso activo).
        inicioDeseado: altaPlanificada.inicioDeseadoFinal,
        mesInicio: altaPlanificada.mesInicio,

        grupo: (alumno.dias && alumno.horario) ? `${alumno.dias} ${alumno.horario}` : '',
        ultimaActualizacion: ahora
      });
    });

    if (user?.email) {
      enviarEmailConfirmacion(user.email, alumno.nombre, citaTexto, 'cita')
        .catch(e => console.error(e));
    }

    close(); 

    setTimeout(() => {
      showToast(`✅ ¡CITA RESERVADA! Prueba de nivel: ${citaTexto}`, "success");
    }, 300);

  } catch (e) {
    console.error("Error crítico en reserva:", e);
    if (e?.message === 'HUECO_COMPLETO') {
      setHora(null);
      showToast("⚠️ Ese turno se acaba de llenar. Elige otra hora disponible.", "warning");
    } else {
      showToast("❌ No se pudo guardar la reserva de prueba de nivel.", "error");
    }
  } finally {
    setLoading(false);
  }
};

  // 5. BLOQUEOS PARA ANTIGUOS ALUMNOS
  if (!alumno) return null;

  if (alumno.natacionPasado === 'si' || alumno.esAntiguoAlumno === true) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-md p-8 text-center animate-in zoom-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">✅</div>
          <h3 className="text-2xl font-black text-blue-900 mb-2">¡Pase Directo!</h3>
          <p className="text-gray-600 mb-6 font-medium">Como <strong>{alumno.nombre}</strong> ya estuvo el curso pasado, puede elegir grupo directamente.</p>
          <button 
            onClick={async () => {
              try {
                const actividadId = obtenerActividadIdAlumno(alumno);
                if (!actividadId) throw new Error('No se ha podido identificar la actividad elegida.');
                const actividadDoc = OFERTA_ACTIVIDADES.find(a => a.id === actividadId);
                const resultadoReserva = await reservarPlazaAtomica({
                  alumnoId: alumno.id,
                  actividadId,
                  actividad: alumno.actividad || actividadDoc.nombre,
                  dias: alumno.dias,
                  horario: alumno.horario,
                  curso: alumno.curso,
                  datosExtra: { citaNivel: 'EXENTO - ANTIGUO ALUMNO' }
                });
                if (user?.email) {
                  await enviarEmailConfirmacion(
                    user.email,
                    alumno.nombre,
                    `${alumno.actividad || actividadDoc.nombre} — ${alumno.dias} a las ${alumno.horario}`,
                    resultadoReserva.resultado === 'lista_espera' ? 'lista_espera' : 'alta'
                  );
                }
                showToast(
                  resultadoReserva.resultado === 'lista_espera'
                    ? 'El grupo está completo. La solicitud queda en lista de espera.'
                    : '✅ Plaza confirmada correctamente.',
                  resultadoReserva.resultado === 'lista_espera' ? 'warning' : 'success'
                );
                if (onSuccess) onSuccess({ citaNivel: 'EXENTO - ANTIGUO ALUMNO' });
                close();
              } catch (err) {
                console.error(err);
                showToast('No se pudo completar la inscripción: ' + err.message, 'error');
              }
            }}
            className="w-full bg-green-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-green-700 transition transform active:scale-95"
          >
            ELEGIR GRUPO Y HORARIO
          </button>
        </div>
      </div>
    );
  }

  // 6. RENDERIZADO DE LA PANTALLA
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="bg-blue-600 p-5 text-white flex justify-between items-center shadow-lg shrink-0">
          <div>
            <h3 className="font-black text-xl flex items-center gap-2">🏊 Reserva Prueba de Nivel</h3>
            <p className="text-blue-100 text-xs font-medium uppercase">{alumno.nombre}</p>
          </div>
          <button onClick={close} className="text-white/80 hover:text-white transition-colors p-2 text-xl">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <div className="space-y-6">
            
            <div className="bg-white border-2 border-blue-50 rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-slate-800 p-4 text-white flex justify-between items-center px-6">
                <button type="button" onClick={() => moverMes(-1)} className="bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-all">◀</button>
                
                <div className="flex flex-col items-center">
                  <select 
                    value={mesVisual.getMonth()} 
                    onChange={(e) => setMesVisual(new Date(mesVisual.getFullYear(), parseInt(e.target.value), 1))}
                    className="bg-slate-700 text-white text-xs font-black uppercase tracking-widest p-2 rounded-lg border-2 border-slate-600 outline-none cursor-pointer"
                  >
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map((mIdx) => (
                      <option key={mIdx} value={mIdx} className="bg-slate-800">
                        {new Date(mesVisual.getFullYear(), mIdx).toLocaleString('es-ES', { month: 'long' }).toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-[0.2em]">{mesVisual.getFullYear()}</span>
                </div>

                <button type="button" onClick={() => moverMes(1)} className="bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-all">▶</button>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => (
                    <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const celdas = [];
                    const año = mesVisual.getFullYear();
                    const mesIdx = mesVisual.getMonth();
                    const primerDia = new Date(año, mesIdx, 1);
                    const offset = (primerDia.getDay() === 0 ? 7 : primerDia.getDay()) - 1;
                    const diasEnMes = new Date(año, mesIdx + 1, 0).getDate();

                    for (let i = 0; i < offset; i++) celdas.push(<div key={`v-${i}`} className="h-10"></div>);

                    for (let d = 1; d <= diasEnMes; d++) {
                      const fActual = new Date(año, mesIdx, d);
                      const iso = `${año}-${String(mesIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const sem = fActual.getDay();
                      const esPasado = fActual < new Date().setHours(0,0,0,0);
                      
                      let permitido = false;
                      const mNum = mesIdx + 1;

                      if (!esPasado) {
                        if (mNum === 6 || mNum === 9) {
                          if (mNum === 9 && d < 14) permitido = false;
                          else if (sem === 1 || sem === 3) permitido = true;
                        } else if (mNum === 7 || mNum === 8) {
                          permitido = false;
                        } else {
                          if (sem === 1) permitido = true;
                        }
                      }

                      celdas.push(
                        <button
                          key={iso}
                          type="button"
                          disabled={!permitido}
                          onClick={() => seleccionarDiaPrueba(iso)}
                          className={`h-11 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center
                            ${!permitido ? 'text-slate-200 cursor-not-allowed opacity-30' : 
                              fecha === iso ? 'bg-blue-600 text-white shadow-lg scale-105 z-10' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}
                          `}
                        >
                          {d}
                          {permitido && (
                            <span className={`text-[5px] font-black ${fecha === iso ? 'text-blue-100' : 'text-blue-400'}`}>
                              {mNum === 6 ? '17:00' : mNum === 9 ? '15:00' : '16:00'}
                            </span>
                          )}
                        </button>
                      );
                    }
                    return celdas;
                  })()}
                </div>
              </div>
              <div className="bg-slate-50 p-2 text-[8px] text-center text-slate-500 font-bold uppercase border-t border-blue-50 italic">
                💡 Elige un mes y luego un día azul
              </div>
            </div>

            {fecha && (
              <div className="animate-in fade-in slide-in-from-bottom-4 bg-blue-50/50 p-5 rounded-3xl border-2 border-blue-100">
                <div className="flex flex-col items-center mb-4 text-center">
                    <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full mb-1">DÍA ELEGIDO: {fecha.split('-').reverse().join('/')}</span>
                    <label className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Selecciona tu hora preferida:</label>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {franjas.map(f => {
                    const ocupados = ocupacion[f] || 0;
                    const estaLleno = ocupados >= CAPACIDAD_POR_HUECO;
                    const libres = Math.max(0, CAPACIDAD_POR_HUECO - ocupados);
                    return (
                      <button
                        key={f}
                        type="button"
                        disabled={estaLleno}
                        onClick={() => setHora(f)}
                        className={`p-2 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center ${
                          estaLleno ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed line-through' : 
                          hora === f ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md' : 
                          'bg-white text-blue-600 border-blue-50 hover:border-blue-500'
                        }`}
                      >
                        <span>{f}</span>
                        {estaLleno ? (
                          <span className="text-[8px] font-black uppercase text-gray-400 no-underline">Lleno</span>
                        ) : libres === 1 ? (
                          <span className={`text-[8px] font-black uppercase ${hora === f ? 'text-emerald-100' : 'text-amber-600'}`}>1 plaza</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex flex-col items-center gap-3 shrink-0">
          <button 
            onClick={confirmarReserva}
            disabled={loading || !hora}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl disabled:bg-gray-200 disabled:text-gray-400 transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? 'Procesando...' : (hora ? '✅ FINALIZAR RESERVA' : 'ELIGE DÍA Y HORA')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🔐 LOGIN Y REGISTRO (CON VALIDACIÓN ESTRICTA Y DOBLE CONTRASEÑA)
// ==========================================
const Login = ({ setView }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  
  // Estado para confirmar contraseña
  const [confirmPassword, setConfirmPassword] = useState('');

  const [regData, setRegData] = useState({ 
    tipo: 'interno', 
    
    // 🚩 AÑADE ESTA LÍNEA AQUÍ
    personaContacto: '', 

    // 📞 DATOS DE CONTACTO (Ahora para TODOS: Internos y Externos)
    telefono1: '', 
    telefono2: '',
    emailContacto: '',

    // 💳 DATOS PAGADOR (Solo Externos)
    nombrePagador: '', 
    dniPagador: '', 
    direccion: '', 
    cp: '', 
    poblacion: '', 
    iban: '', 
    emailPagador: '',

    // 🧒 DATOS ALUMNO (Todos)
    nombreAlumno: '', 
    curso: 'INF3', 
    letra: 'A', 
    fechaNacimiento: '', 
    esAntiguoAlumno: false,
    alergias: '', 
    observaciones: '',
    
    // 🔐 PASSWORD
    password: ''
  });

  const validateAndRegister = async (e) => {
    e.preventDefault();
    
    // 1. Validaciones de Seguridad
    if (!regData.password || !confirmPassword) return showToast("⛔ Escribe la contraseña dos veces.", "warning");
    if (regData.password !== confirmPassword) return showToast("⛔ Las contraseñas NO coinciden.", "warning");
    if (regData.password.length < 6) return showToast("⚠️ La contraseña debe tener al menos 6 caracteres.", "warning");
    if (!regData.aceptaPrivacidad) return showToast("⛔ Debes leer y aceptar la política de protección de datos y privacidad.", "warning");

    // 2. Determinar Email de Usuario
    const emailFinal = normalizarEmail(regData.tipo === 'externo' ? regData.emailPagador : regData.emailContacto);
    if (!emailFinal) return showToast("⚠️ Falta el email para crear tu cuenta.", "error");

    // 3. Validaciones Específicas
    let dniValidado = null;
    let ibanValidado = null;
    if (regData.tipo === 'externo') {
      if (!regData.nombrePagador?.trim()) return showToast('⚠️ Falta: Nombre del Pagador', "warning");
      if (!regData.dniPagador?.trim()) return showToast('⚠️ Falta: DNI/NIE del Pagador', "warning");
      dniValidado = validarDniNie(regData.dniPagador);
      if (!dniValidado.valido) return showToast(`⚠️ ${dniValidado.error}`, "error");

      if (!regData.iban?.trim()) return showToast("⚠️ Falta: IBAN Bancario", "warning");
      ibanValidado = validarIbanEspanol(regData.iban);
      if (!ibanValidado.valido) return showToast(`⚠️ ${ibanValidado.error}`, "error");
    
      const tel1 = regData.telefono1 ? String(regData.telefono1).trim() : "";
      if (tel1.length < 9) return showToast("⛔ El teléfono debe tener 9 cifras", "warning");
      
      if (!regData.direccion?.trim()) return showToast("⚠️ Falta: Dirección", "warning");
      if (!regData.cp?.trim()) return showToast("⚠️ Falta: Código Postal", "warning");
    } else {
      // VALIDACIÓN REGISTRO INTERNO
      if (!regData.personaContacto?.trim()) return showToast("⚠️ Falta: Nombre de la persona de contacto", "warning");
      
      const telInterno = regData.telefono1 ? String(regData.telefono1).trim() : ""; 
      if (telInterno && telInterno.length < 9) {
          return showToast("⛔ El teléfono debe tener 9 cifras", "warning");
      }
    }

    try {
      // A. Crear en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, emailFinal, regData.password);
      
      // B. Guardar Usuario (Padre/Pagador)
      await setDoc(doc(db, 'users', cred.user.uid), { 
        email: emailFinal, 
        role: 'user', 
        tipo: regData.tipo,
        telefono1: String(regData.telefono1 || '').trim(), 
        telefono2: String(regData.telefono2 || '').trim(),
        aceptaPrivacidad: true,
        fechaAceptacionPrivacidad: new Date().toISOString(),
        
        // 🚩 ESTO ES LO QUE ARREGLA EL NOMBRE EN LA FICHA:
        nombre: (regData.tipo === 'externo' ? regData.nombrePagador : regData.personaContacto).trim(),
        personaContacto: String(regData.personaContacto || '').trim(),
        
        ...(regData.tipo === 'externo' ? {
            nombrePagador: regData.nombrePagador.trim(), 
            dniPagador: dniValidado.normalizado, 
            dni: dniValidado.normalizado, // 👈 También guardamos el DNI aquí
            direccion: regData.direccion.trim(), 
            cp: String(regData.cp || '').trim(), 
            poblacion: String(regData.poblacion || '').trim(),
            iban: ibanValidado.normalizado
        } : {
            emailContacto: emailFinal
        })
      });

      // ✅ MENSAJE Y CIERRE DE FUNCIÓN (Sin errores de paréntesis)
      showToast("✅ ¡Cuenta creada con éxito! Ya puedes entrar.", "success");
      setIsRegister(false); 

    } catch (e) { 
        if (e.code === 'auth/email-already-in-use') showToast("⛔ Ese correo ya está registrado.", "error");
        else showToast("Error: " + e.message, "error"); 
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const email = normalizarEmail(loginData.email);
    const pass = loginData.password;

    if (!email || !pass) return showToast("⚠️ Escribe tu email y contraseña", "warning");

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        showToast("⚠️ Email o contraseña incorrectos.", "error");
      } else {
        showToast("⚠️ Error: " + error.message, "error");
      }
    }
};

  if (isRegister) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black flex items-center gap-2">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-3xl mt-10 animate-fade-in-up">
        <h2 className="text-2xl font-black text-blue-900 text-center mb-2 uppercase tracking-tighter">Registro de Familia</h2>
        <p className="text-center text-gray-500 text-sm mb-6 font-medium">Crea tu cuenta para gestionar las inscripciones</p>
        
        <form onSubmit={validateAndRegister} className="space-y-6">
          
          {/* 1. TIPO DE ALUMNO */}
          <div className="flex gap-4 p-1 bg-gray-100 rounded-xl">
            <button type="button" onClick={() => setRegData({ ...regData, tipo: 'interno' })} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${regData.tipo === 'interno' ? 'bg-white shadow-md text-blue-900 scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}>🎓 Alumno del Colegio</button>
            <button type="button" onClick={() => setRegData({ ...regData, tipo: 'externo' })} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${regData.tipo === 'externo' ? 'bg-white shadow-md text-blue-900 scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}>🌍 Alumno Externo</button>
          </div>
         
          {/* 2. DATOS CONTACTO / PAGO (SEGÚN TIPO) */}
          {regData.tipo === 'externo' ? (
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 animate-fade-in text-left">
                <h3 className="font-black text-orange-900 mb-4 border-b border-orange-200 pb-2 uppercase text-xs tracking-widest">👤 Datos del Titular del Pago</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-orange-700 uppercase mb-1 ml-1 tracking-wider">Nombre y apellidos del Titular *</label>
                        <input className="w-full border-2 border-orange-100 p-2.5 rounded-xl bg-white focus:border-orange-400 outline-none transition-all" placeholder="Ej: Padre/Madre/Tutor" onChange={e => setRegData({ ...regData, nombrePagador: e.target.value })} />
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-orange-700 uppercase mb-1 ml-1 tracking-wider">DNI / NIE *</label>
                        <input className="w-full border-2 border-orange-100 p-2.5 rounded-xl bg-white focus:border-orange-400 outline-none transition-all" placeholder="12345678X" onChange={e => setRegData({ ...regData, dniPagador: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-orange-700 uppercase mb-1 ml-1 tracking-wider">Teléfono Principal *</label>
                        <input className="w-full border-2 border-orange-100 p-2.5 rounded-xl bg-white font-bold text-blue-600 focus:border-orange-400 outline-none transition-all" placeholder="600000000" onChange={e => setRegData({ ...regData, telefono1: e.target.value })} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-orange-700 uppercase mb-1 ml-1 tracking-wider">Dirección Postal Completa *</label>
                        <input className="w-full border-2 border-orange-100 p-2.5 rounded-xl bg-white focus:border-orange-400 outline-none transition-all" placeholder="Calle, número, piso..." onChange={e => setRegData({ ...regData, direccion: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        <div>
                            <label className="block text-[10px] font-black text-orange-700 uppercase mb-1 ml-1 tracking-wider">Código Postal *</label>
                            <input className="w-full border-2 border-orange-100 p-2.5 rounded-xl bg-white focus:border-orange-400 outline-none transition-all" placeholder="280XX" onChange={e => setRegData({ ...regData, cp: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-orange-700 uppercase mb-1 ml-1 tracking-wider">Población *</label>
                            <input className="w-full border-2 border-orange-100 p-2.5 rounded-xl bg-white focus:border-orange-400 outline-none transition-all" placeholder="Madrid" onChange={e => setRegData({ ...regData, poblacion: e.target.value })} />
                        </div>
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-red-700 uppercase mb-1 ml-1 tracking-wider">IBAN Cuenta Bancaria (Para recibos) *</label>
                        <input 
                          className="w-full border-2 border-red-100 p-2.5 rounded-xl bg-white font-mono uppercase focus:border-red-400 outline-none transition-all" 
                          placeholder="ES00 0000 0000 0000 0000 0000" 
                          maxLength={24}
                          value={regData.iban || ''}
                          onChange={e => {
                            const valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            setRegData({ ...regData, iban: valor });
                          }} 
                        />
                    </div>
                    
                    <div className="md:col-span-2 mt-2">
                        <label className="block text-[10px] font-black text-blue-800 uppercase mb-1 ml-1 tracking-wider">Email del Pagador (Será tu Usuario) *</label>
                        <input type="email" className="w-full border-2 border-blue-200 p-2.5 rounded-xl bg-white font-bold text-blue-900 outline-none" placeholder="ejemplo@correo.com" onChange={e => setRegData({ ...regData, emailPagador: e.target.value })} />
                    </div>
                </div>
            </div>
          ) : (
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 animate-fade-in text-left">
                <h3 className="font-black text-blue-900 mb-4 border-b border-blue-200 pb-2 uppercase text-xs tracking-widest">👤 Datos de Contacto (Interno)</h3>
                <p className="text-xs text-blue-700 mb-4 font-medium italic">Al ser alumno del centro, usaremos la cuenta bancaria que consta en secretaría.</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-blue-700 uppercase mb-1 ml-1 tracking-wider">Nombre de la Persona de Contacto *</label>
                        <input 
                            type="text" 
                            className="w-full border-2 border-blue-100 p-2.5 rounded-xl bg-white font-bold text-blue-900 focus:border-blue-400 outline-none transition-all" 
                            placeholder="Nombre y apellidos del responsable" 
                            value={regData.personaContacto || ''}
                            onChange={e => setRegData({ ...regData, personaContacto: e.target.value })} 
                        />
                    </div>
        
                    <div>
                        <label className="block text-[10px] font-black text-blue-700 uppercase mb-1 ml-1 tracking-wider">Tu Email de Usuario *</label>
                        <input type="email" className="w-full border-2 border-blue-100 p-2.5 rounded-xl bg-white font-bold text-blue-900 focus:border-blue-400 outline-none transition-all" placeholder="ejemplo@correo.com" onChange={e => setRegData({ ...regData, emailContacto: e.target.value })} />
                    </div>
        
                    <div>
                        <label className="block text-[10px] font-black text-blue-700 uppercase mb-1 ml-1 tracking-wider">Teléfono Móvil (9 cifras) *</label>
                        <input 
                            type="tel" 
                            className="w-full border-2 border-blue-100 p-2.5 rounded-xl bg-white font-bold text-blue-600 focus:border-blue-400 outline-none transition-all" 
                            placeholder="600000000" 
                            value={regData.telefono1 || ''} 
                            onChange={e => setRegData(prev => ({ ...prev, telefono1: e.target.value }))} 
                        />
                    </div>
                </div>
            </div>
          )}

          {/* 4. CONTRASEÑA */}
          <div className="border-t border-gray-100 pt-6 text-left">
            <h3 className="font-black text-gray-700 mb-4 uppercase text-[10px] tracking-[0.2em] ml-1">🔐 Seguridad de acceso</h3>
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1 tracking-wider">Crea una Contraseña *</label>
                    <input className="w-full border-2 border-gray-100 p-3 bg-white rounded-xl focus:border-blue-500 outline-none transition-all" type="password" placeholder="Mínimo 6 caracteres" onChange={e => setRegData({ ...regData, password: e.target.value })} />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1 tracking-wider">Repite la Contraseña *</label>
                    <input className="w-full border-2 border-gray-100 p-3 bg-white rounded-xl focus:border-blue-500 outline-none transition-all" type="password" placeholder="Confirma tu clave" onChange={e => setConfirmPassword(e.target.value)} />
                </div>
            </div>
            <p className="text-[9px] text-gray-400 font-bold uppercase mt-3 ml-1 tracking-widest">* Por seguridad, usa una clave que no uses en otros sitios.</p>
          </div>

          {/* 5. ACEPTACIÓN DE PRIVACIDAD */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={regData.aceptaPrivacidad || false}
                onChange={e => setRegData({ ...regData, aceptaPrivacidad: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-900 focus:ring-blue-500" 
              />
              <span className="text-xs text-gray-600 leading-tight">
                He leído y acepto la <a href="https://drive.google.com/file/d/1LARo4uZu19J6sDcrCofKq_fjkdmz6FHd/view" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">Información Detallada sobre Protección de Datos y Privacidad</a> del Colegio San Buenaventura.
              </span>
            </label>
          </div>

          <button className="w-full bg-blue-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-800 transition-all transform active:scale-95">Registrar Familia</button>
        </form>
        
        <button onClick={() => setIsRegister(false)} className="w-full mt-6 text-gray-500 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-colors">¿Ya tienes cuenta? Inicia Sesión aquí</button>
      </div>
    </div>
  );
  const handleResetPassword = async () => {
    if (!loginData?.email) {
      return showToast("⚠️ Por favor, escribe tu email en el cuadro de arriba.", "warning");
    }
    try {
      await sendPasswordResetEmail(auth, loginData.email);
      showToast("📧 ¡Enviado! Revisa tu bandeja de entrada o spam.", "success");
    } catch (error) {
      showToast("❌ Error: No se pudo enviar el correo de recuperación.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black flex items-center gap-2">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md animate-fade-in">
      <div className="text-center mb-10">
  <img 
    src={IMG_ESCUDO} 
    className="h-32 md:h-40 mx-auto mb-6 drop-shadow-xl transition-transform hover:scale-105" 
    alt="Logo San Buenaventura" 
  />
  <h2 className="text-3xl font-black mb-2 text-blue-900 tracking-tight">
    Acceso Familias
  </h2>
  <p className="text-gray-500 text-sm font-medium">
    Gestiona tus inscripciones y pruebas de nivel
  </p>
</div>        
<form onSubmit={handleAuth} className="space-y-4">
          <input 
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            type="email" 
            placeholder="Tu Email" 
            onChange={e => setLoginData({ ...loginData, email: e.target.value })} 
          />
          
          <div className="w-full">
            <input 
              className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              type="password" 
              placeholder="Contraseña" 
              onChange={e => setLoginData({ ...loginData, password: e.target.value })} 
            />
            {/* BOTÓN DE RECUPERACIÓN */}
            <div className="flex justify-end mt-1">
              <button 
                type="button" 
                onClick={handleResetPassword}
                className="text-[10px] font-black text-blue-600 uppercase pr-1 hover:underline"
              >
                ¿Has olvidado tu contraseña?
              </button>
            </div>
          </div>

          <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">
            Entrar
          </button>
        </form>
        <div className="mt-6 text-center border-t pt-4"><p className="text-gray-500 text-sm mb-2">¿Es tu primera vez?</p><button onClick={() => setIsRegister(true)} className="text-blue-600 font-bold hover:underline">Crear Cuenta Nueva</button></div>
      </div>
    </div>
  );
};

// ==========================================
// 🚀 COMPONENTE PRINCIPAL (ROUTER)
// ==========================================
function AppContent() {
  // 🚩 SUSTITUIMOS LOS 3 useState POR ESTO:
  const { user, setUser, userRole, setUserRole, view, setView } = useAuth();
  
  // Este se queda porque es solo para esta pantalla
  const [misHijos, setMisHijos] = useState([]);

  // Escuchamos en tiempo real la lista de hijos cuando el usuario es del tipo familiar
  useEffect(() => {
    if (user && userRole === 'user') {
      const q = query(collection(db, 'students'), where('parentId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMisHijos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error("Error al escuchar cambios en alumnos familiares:", error);
      });
      return () => unsubscribe();
    } else {
      setMisHijos([]);
    }
  }, [user, userRole]);

  useEffect(() => {
    // Escuchamos cambios en la autenticación
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        console.log("Usuario detectado:", u.email); // Para depurar

        // 👑 1. BACKDOOR DE JEFES (Super Admin y Coordinador)
        const emailLimpio = u.email ? u.email.toLowerCase() : "";
        
        // Emails que tienen permiso total
        const emailJefe = 'extraescolares@sanbuenaventura.org';
        const emailManoDerecha = 'extraescolarespiscina@sanbuenaventura.org';

        if (emailLimpio === emailJefe || emailLimpio === emailManoDerecha) {
            console.log("🚀 Acceso de Gestión concedido por Email Directo");
            setUser(u);
            setUserRole('admin'); // Le damos el carnet de admin
            setView('admin');      // Lo mandamos a la habitación de los jefes
            return; // ¡Listo! No seguimos buscando
        }

        try {
            // 2. Si no es el jefe supremo, miramos en la base de datos
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            let role = 'user';
            
            if (userDoc.exists()) {
                role = userDoc.data().role || 'user';
            }

            setUser(u);
            setUserRole(role);

            // 3. Redirección según rol encontrado en BD
        if (role === 'admin' || role === 'profe' || role === 'monitor') { // 👈 Añadimos 'monitor'
          setView('admin');
      } else {
          setView('dashboard');
      }

        } catch (error) {
            console.error("Error al leer perfil:", error);
            // Si falla la base de datos pero estás logueado, te avisamos
            showToast("⚠️ Estás logueado, pero hubo un error leyendo tu perfil: " + error.message, "error");
        }

      } else {
        // Si no hay usuario (logout)
        setUser(null);
        setView('landing');
      }
    });

    return () => unsubscribe();
  }, [setUser, setUserRole, setView]); // 🚩 Añadimos las funciones del Contexto aquí

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {view === 'landing' && <LandingPage setView={setView} showToast={showToast} />}
      {view === 'login' && <Login setView={setView} />}
      {view === 'dashboard' && <Dashboard user={user} misHijos={misHijos} logout={() => signOut(auth)} />}
      {view === 'admin' && <AdminDashboard userRole={userRole} userEmail={user?.email?.toLowerCase()} logout={() => signOut(auth)} />}
      {view !== 'admin' && (
        <Suspense fallback={null}>
          <VoiceAssistant showToast={showToast} />
        </Suspense>
      )}
    </div>
  );
}
// ==========================================
// 🚀 PUNTO DE ENTRADA ÚNICO
// ==========================================
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-fade-in-up
            ${t.type === 'success' ? 'bg-emerald-600/95 border-emerald-500/30 text-white shadow-emerald-500/20' : ''}
            ${t.type === 'warning' ? 'bg-amber-500/95 border-amber-400/30 text-white shadow-amber-500/20' : ''}
            ${t.type === 'danger' || t.type === 'error' ? 'bg-rose-600/95 border-rose-500/30 text-white shadow-rose-500/20' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {t.type === 'success' && '✅'}
              {t.type === 'warning' && '⚠️'}
              {(t.type === 'error' || t.type === 'danger') && '❌'}
            </span>
            <p className="text-xs font-black uppercase tracking-wide leading-tight">{t.message}</p>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-4 text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Vincular la función global al estado local de este Punto de Entrada
    globalShowToast = (message, type = 'success') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
  }, []);

  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </AuthProvider>
  );
}
