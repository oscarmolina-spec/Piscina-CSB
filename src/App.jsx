import React, { useState, useEffect, useRef } from 'react';import { db, auth, secondaryAuth } from './firebase.js';
import { planificarTraslado, comprobarAforoTraslado } from './trasladoGrupo.js';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc, // <--- ¡AQUÍ ESTABA EL CULPABLE! FALTABA ESTO
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  runTransaction,
  serverTimestamp,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// Habilitar persistencia de Firestore offline para soportar mala cobertura
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("La persistencia falló: múltiples pestañas abiertas.");
  } else if (err.code === 'unimplemented') {
    console.warn("El navegador no soporta persistencia offline.");
  }
});
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
// ⚙️ CONFIGURACIÓN GENERAL DEL SISTEMA
// ==========================================

// Email del administrador (Superusuario)
const ADMIN_EMAIL = 'extraescolares@sanbuenaventura.org'; 

// Configuración de aforo para pruebas de nivel (alumnos por hueco de 5 min)
const CAPACIDAD_POR_HUECO = 2; 

// ==========================================
// 🖼️ BANCO DE IMÁGENES
// ==========================================
const IMG_ESCUDO_BLANCO = 'https://i.ibb.co/v6gvHDfv/logo-BLANCO.png';
const IMG_ESCUDO_COLOR = 'https://i.ibb.co/KjCWNLrc/CSB.png';

// 👇 ¡AÑADE ESTO PARA QUE NO SE QUEDE EN BLANCO! 👇
const IMG_ESCUDO = IMG_ESCUDO_COLOR; 

const IMG_PRINCIPAL = 'https://i.ibb.co/HLt30jVK/20241210-084606.jpg';
const MAPA_IMAGEN_URL = "https://i.ibb.co/35RNNBLz/Info-piscina.png";

const GALERIA = [
  { url: 'https://i.ibb.co/mrJHGscm/Screenshot-2025-05-09-15-04-17.png', nombre: "Vaso/Cristalera", zona: "Vista General" },
  { url: 'https://i.ibb.co/Psstvn93/20241210-084647.jpg', nombre: "Zona de Aguas", zona: "Vaso" },
  { url: 'https://i.ibb.co/gFT6zfHC/20241210-083956.jpg', nombre: "Duchas interiores", zona: "Instalaciones" },
  { url: 'https://i.ibb.co/pvDBMSbv/20241210-083700.jpg', nombre: "Vestuario Femenino", zona: "Equipado" },
  { url: 'https://i.ibb.co/hJxW45tC/20241210-084225.jpg', nombre: "Vestuario Masculino", zona: "Equipado" },
  { url: 'https://i.ibb.co/9B0Fb23/20241210-083619.jpg', nombre: "Entrada/Hall", zona: "Entrada Principal" }
];
// ==========================================
// 📚 LISTADO MAESTRO DE CURSOS ESCOLARES
// ==========================================
const LISTA_CURSOS = [
  { val: 'INF3', label: 'Infantil 3 Años' },
  { val: 'INF4', label: 'Infantil 4 Años' },
  { val: 'INF5', label: 'Infantil 5 Años' },
  { val: '1PRI', label: '1º Primaria' },
  { val: '2PRI', label: '2º Primaria' },
  { val: '3PRI', label: '3º Primaria' },
  { val: '4PRI', label: '4º Primaria' },
  { val: '5PRI', label: '5º Primaria' },
  { val: '6PRI', label: '6º Primaria' },
  { val: '1ESO', label: '1º ESO' },
  { val: '2ESO', label: '2º ESO' },
  { val: '3ESO', label: '3º ESO' },
  { val: '4ESO', label: '4º ESO' },
  { val: '1BACH', label: '1º Bachillerato' },
  { val: '2BACH', label: '2º Bachillerato' },
  { val: 'ADULTO', label: 'Adulto / +16 Años' },
];

// ==========================================
// 📋 CATÁLOGO DE ACTIVIDADES (DATABASE)
// ==========================================
const OFERTA_ACTIVIDADES = [
  {
    id: 'chapoteo', 
    nombre: '🚼 Chapoteo "Infantil" (16:00-17:00)', 
    cursos: ['INF3', 'INF4', 'INF5'], 
    requierePrueba: false, 
    diasResumen: 'L-V', 
    precioResumen: '45€', 
    alumnosMax: 16,
    minAlumnos: 5,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Iniciación y familiarización con el medio acuático. El monitor está dentro del agua para mayor seguridad y confianza.\n\n⬇️ HORARIOS ⬇️\n• 1 día/sem (45€): Lunes a Viernes (16:00-17:00).', 
    aviso: 'Plazas limitadas por estricto orden de inscripción.',
    opciones: [
        { dias: 'Lunes', horario: '16:00-17:00', precio: '45€' },
        { dias: 'Martes', horario: '16:00-17:00', precio: '45€' },
        { dias: 'Miércoles', horario: '16:00-17:00', precio: '45€' },
        { dias: 'Jueves', horario: '16:00-17:00', precio: '45€' },
        { dias: 'Viernes', horario: '16:00-17:00', precio: '45€' }
    ]
  },
  {
    id: 'primaria_1615', 
    nombre: '🏅 Natación Primaria (16:15-17:15)', 
    cursos: ['1PRI', '2PRI', '3PRI', '4PRI', '5PRI', '6PRI'], 
    requierePrueba: true, 
    diasResumen: 'L-V', 
    precioResumen: '45€ / 65€', 
    alumnosMax: 12,
    minAlumnos: 6,
    requiereMonitor: true,
    callesNecesarias: 1,
    segmentosFisicos: [
      {
        id: 'primaria_1615_1a3',
        nombre: 'Primaria 16:15 — 1.º a 3.º',
        cursos: ['1PRI', '2PRI', '3PRI'],
        minAlumnos: 6,
        alumnosMax: 12,
        callesNecesarias: 1,
        requiereMonitor: true
      },
      {
        id: 'primaria_1615_4a6',
        nombre: 'Primaria 16:15 — 4.º a 6.º',
        cursos: ['4PRI', '5PRI', '6PRI'],
        minAlumnos: 6,
        alumnosMax: 12,
        callesNecesarias: 1,
        requiereMonitor: true
      }
    ],
    descripcion: 'Desarrollo de estilos y técnica. Se divide en subgrupos por nivel. Ideal para perfeccionar la natación.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (65€): L/X o M/J.\n⭐ DÍA SUELTO (45€): L, M, X, J o V.', 
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.', 
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '16:15-17:15', precio: '65€' },
        { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '16:15-17:15', precio: '65€' },
        { dias: '[1 DÍA] Lunes', horario: '16:15-17:15', precio: '45€' },
        { dias: '[1 DÍA] Martes', horario: '16:15-17:15', precio: '45€' },
        { dias: '[1 DÍA] Miércoles', horario: '16:15-17:15', precio: '45€' },
        { dias: '[1 DÍA] Jueves', horario: '16:15-17:15', precio: '45€' },
        { dias: '[1 DÍA] Viernes', horario: '16:15-17:15', precio: '45€' }
    ]
  },
  {
      id: 'primaria_123_tarde', 
      nombre: '🐟 Natación 1º-3º Prim (17:30-18:00)', 
      cursos: ['1PRI', '2PRI', '3PRI'], 
      requierePrueba: true, 
      diasResumen: 'L-V', 
      precioResumen: '37€ / 50€', 
      alumnosMax: 8,
      minAlumnos: 4,
      requiereMonitor: true,
      callesNecesarias: 1,
      descripcion: 'Sesiones breves, dinámicas y muy seguras para avanzar en autonomía acuática. Grupos reducidos.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Cualquier día.', 
      aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.', 
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '17:30-18:00', precio: '50€' },
        { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '17:30-18:00', precio: '50€' },
        { dias: '[1 DÍA] Lunes', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Martes', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Miércoles', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Jueves', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Viernes', horario: '17:30-18:00', precio: '37€' }
    ]
  },
  {
    id: 'primaria_456_tarde', 
    nombre: '🏊 Natación 4º-6º Prim (17:30-18:00)', 
    cursos: ['4PRI', '5PRI', '6PRI'], 
    requierePrueba: true, 
    diasResumen: 'L-V', 
    precioResumen: '37€ / 50€', 
    alumnosMax: 8,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Para quienes quieren seguir mejorando técnica y condición física. Ideal como complemento a otras actividades deportivas.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€).\n⭐ DÍA SUELTO (37€).', 
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes (30m) y Miércoles (30m)', horario: '17:30-18:00', precio: '50€' },
        { dias: '[PACK 2 DÍAS] Martes (30m) y Jueves (30m)', horario: '17:30-18:00', precio: '50€' },
        { dias: '[1 DÍA] Lunes', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Martes', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Miércoles', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Jueves', horario: '17:30-18:00', precio: '37€' },
        { dias: '[1 DÍA] Viernes', horario: '17:30-18:00', precio: '37€' }
    ]
  },
  {
    id: 'waterpolo', 
    nombre: '🤽‍♂️ Waterpolo 3º-6º Prim (17:30-18:30)', 
    cursos: ['3PRI', '4PRI', '5PRI', '6PRI'], 
    requierePrueba: false, 
    diasResumen: 'L-V', 
    precioResumen: '45€ / 60€', 
    alumnosMax: 12,
    minAlumnos: 7,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Iniciación al waterpolo. Deporte de equipo, balón y natación. Fomenta el compañerismo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (60€): L/X o M/J.\n⭐ DÍA SUELTO (45€): L, M, X, J o V.', 
    aviso: 'Deporte de equipo con plazas limitadas por grupo.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '17:30-18:30', precio: '60€' },
        { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '17:30-18:30', precio: '60€' },
        { dias: '[1 DÍA] Lunes', horario: '17:30-18:30', precio: '45€' },
        { dias: '[1 DÍA] Martes', horario: '17:30-18:30', precio: '45€' },
        { dias: '[1 DÍA] Miércoles', horario: '17:30-18:30', precio: '45€' },
        { dias: '[1 DÍA] Jueves', horario: '17:30-18:30', precio: '45€' },
        { dias: '[1 DÍA] Viernes', horario: '17:30-18:30', precio: '45€' }
    ]
  },
  {
    id: 'aquagym', 
    nombre: '💧 Aquagym "+16 años" (17:30-18:15)', 
    cursos: ['ADULTO', '1BACH', '2BACH'], 
    requierePrueba: false, 
    diasResumen: 'L-J', 
    precioResumen: '37€ / 50€', 
    alumnosMax: 12,
    minAlumnos: 5,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Actividad de bajo impacto ideal para mantenerse en forma sin sobrecargar articulaciones. Mejora la movilidad y el tono muscular.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Lunes, Martes, Miércoles o Jueves.', 
    aviso: 'Actividad recomendada para todos los niveles físicos.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '17:30-18:15', precio: '50€' },
        { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '17:30-18:15', precio: '50€' },
        { dias: '[1 DÍA] Lunes', horario: '17:30-18:15', precio: '37€' },
        { dias: '[1 DÍA] Martes', horario: '17:30-18:15', precio: '37€' },
        { dias: '[1 DÍA] Miércoles', horario: '17:30-18:15', precio: '37€' },
        { dias: '[1 DÍA] Jueves', horario: '17:30-18:15', precio: '37€' }
    ]
  },
  {
    id: 'adultos', 
    nombre: '👨‍👩‍👧 Adultos (L-X-V 18:00-18:30) (M-J 18:30-19:00)', 
    cursos: ['ADULTO'], 
    requierePrueba: false, 
    diasResumen: 'L-V', 
    precioResumen: '37€ / 50€', 
    alumnosMax: 10,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Clases para adultos que quieran mantenerse activos o mejorar su estilo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Cualquier día.\n(Horarios variables según el día).', 
    aviso: 'Plazas asignadas por estricto orden de inscripción.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:00-18:30', precio: '50€' },
        { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '18:30-19:00', precio: '50€' },
        { dias: '[1 DÍA] Lunes', horario: '18:00-18:30', precio: '37€' },
        { dias: '[1 DÍA] Martes', horario: '18:30-19:00', precio: '37€' },
        { dias: '[1 DÍA] Miércoles', horario: '18:00-18:30', precio: '37€' },
        { dias: '[1 DÍA] Jueves', horario: '18:30-19:00', precio: '37€' },
        { dias: '[1 DÍA] Viernes', horario: '18:00-18:30', precio: '37€' }
    ]
  },
  {
    id: 'eso_bach', 
    nombre: '🎓 ESO/Bach (L-X 18:30-19:00) (V 14:15-15:00)', 
    cursos: ['1ESO', '2ESO', '3ESO', '4ESO', '1BACH', '2BACH'], 
    requierePrueba: true, 
    diasResumen: 'L/X o V', 
    precioResumen: '37€ / 50€', 
    alumnosMax: 10,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Sesiones específicas para adolescentes, con técnica, mantenimiento o preparación física.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): Tardes.\n⭐ DÍA SUELTO (37€): Tarde o Mediodía.', 
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:30-19:00', precio: '50€' },
        { dias: '[1 DÍA] Lunes', horario: '18:30-19:00', precio: '37€' },
        { dias: '[1 DÍA] Miércoles', horario: '18:30-19:00', precio: '37€' },
        { dias: '[1 DÍA] Viernes', horario: '14:15-15:00', precio: '37€' }
    ]
  },
  {
    id: 'nado_libre', 
    nombre: '🏊‍♂️ Nado Libre ">16 años" (18:30-19:00)', 
    cursos: ['ADULTO', '1BACH', '2BACH'], 
    requierePrueba: false, 
    diasResumen: 'L-V', 
    precioResumen: '25€ / 35€', 
    alumnosMax: 10,
    minAlumnos: 2,
    requiereMonitor: false,
    callesNecesarias: 1,
    descripcion: 'Uso de calle para entrenamiento personal sin monitor. Ideal para quienes buscan nadar a su propio ritmo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (35€): L/X o M/J.\n⭐ DÍA SUELTO (25€): Cualquier día de la semana.', 
    aviso: 'Uso exclusivo de calle para nado continuo sin monitor.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:30-19:00', precio: '35€' },
        { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '18:30-19:00', precio: '35€' },
        { dias: '[1 DÍA] Lunes', horario: '18:30-19:00', precio: '25€' },
        { dias: '[1 DÍA] Martes', horario: '18:30-19:00', precio: '25€' },
        { dias: '[1 DÍA] Miércoles', horario: '18:30-19:00', precio: '25€' },
        { dias: '[1 DÍA] Jueves', horario: '18:30-19:00', precio: '25€' },
        { dias: '[1 DÍA] Viernes', horario: '18:30-19:00', precio: '25€' }
    ]
  }
];

// ==========================================
// 📧 UTILIDADES Y FUNCIONES DE AYUDA
// ==========================================

// Ayudante dinámico para obtener el año académico actual/siguiente
const getDynamicAcademicYear = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  // El año académico de natación comienza el 1 de octubre.
  // Si estamos antes de octubre (meses 0 a 8 en JS), la temporada comienza el 1 de octubre de este año.
  // Si estamos en octubre o después (meses 9 a 11 en JS), comienza el 1 de octubre del año que viene.
  const startYear = today.getMonth() < 9 ? currentYear : currentYear + 1;
  return {
    startYear,
    isoStartDate: `${startYear}-10-01`,
    formattedStartDate: `01/10/${startYear}`,
    rawPattern: `${startYear}-10`
  };
};

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

const liberarPlazaAtomica = async ({ alumnoId, datosFinales }) => {
  const alumnoRef = doc(db, 'students', alumnoId);
  return runTransaction(db, async transaction => {
    const alumnoSnap = await transaction.get(alumnoRef);
    if (!alumnoSnap.exists()) throw new Error('ALUMNO_NO_EXISTE');
    const alumno = alumnoSnap.data();
    const actividadId = obtenerActividadIdAlumno(alumno);
    let slotIds = Array.isArray(alumno.aforoSlotIds) ? alumno.aforoSlotIds : [];
    if (slotIds.length === 0 && alumno.estado === 'inscrito' && actividadId) {
      slotIds = construirSlotsAforo({ actividadId, dias: alumno.dias || alumno.opcionDias, horario: alumno.horario, curso: alumno.curso }).map(s => s.id);
    }
    const refs = slotIds.map(id => doc(db, 'aforos', id));
    const snaps = [];
    for (const ref of refs) snaps.push(await transaction.get(ref));

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
    transaction.update(alumnoRef, {
      ...datosFinales,
      validadoAdmin: false,
      revisadoAdmin: false,
      aforoSlotIds: [],
      waitlistGroupKey: null,
      waitlistJoinedAt: null,
      ultimaActualizacion: serverTimestamp()
    });
  });
};

const trasladarGrupoAtomico = async ({ alumnoId, actividadId, opcion, origenEsperado }) => {
  const actividad = OFERTA_ACTIVIDADES.find(a => a.id === actividadId);
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
  if (previo.actividadId !== actividadId) throw new Error('GRUPO_CAMBIADO');
  const slotsOrigen = construirSlotsAforo({ actividadId, dias: previo.dias, horario: previo.horario, curso: previo.curso });
  const slotsDestino = construirSlotsAforo({ actividadId, dias: opcion.dias, horario: opcion.horario, curso: previo.curso });
  planificarTraslado(previo, actividad, opcion, slotsOrigen, slotsDestino);
  const ids = [...new Set([...slotsOrigen, ...slotsDestino].map(s => s.id))].sort();
  const referencias = ids.map(id => doc(db, 'aforos', id));

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(alumnoRef);
    if (!snap.exists()) throw new Error('ALUMNO_NO_EXISTE');
    const actual = snap.data();
    if (actual.actividadId !== actividadId || actual.dias !== origenEsperado.dias ||
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
      dias: opcion.dias, opcionDias: opcion.dias, horario: opcion.horario,
      grupo: `${opcion.dias} ${opcion.horario}`, precio: opcion.precio,
      aforoSlotIds: plan.destino, ultimaActualizacion: ahora
    });
    return { nombre: actual.nombre, anterior: `${actual.dias} ${actual.horario}`, nuevo: `${opcion.dias} ${opcion.horario}` };
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
    const esAlta = tipo === 'alta';
    const esListaEspera = tipo === 'lista_espera';

    // Formateamos la fecha si viene (de 2026-03-11 a 11/03/2026)
    const fechaFormateada = fechaInicio && fechaInicio !== 'cita' 
      ? fechaInicio.split('-').reverse().join('/') 
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
            <p>Hola familia de <strong>${nombreAlumno}</strong>,</p>
            
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
              <p style="margin: 10px 0 0 0; font-size: 16px;">${detalle}</p>
              
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
const escaparHtml = texto => String(texto || '').replace(/[&<>"']/g, caracter => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[caracter]);

const enviarAvisoTraslado = async (email, nombre, actividad, anterior, nuevo) => {
  // El documento en `mail` solicita el envío; la entrega definitiva depende
  // de la extensión de Firebase y puede consultarse en esa colección.
  return addDoc(collection(db, 'mail'), {
    to: [email],
    message: {
      subject: `Cambio de grupo confirmado: ${nombre}`,
      html: `<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#243044">
        <h2>Cambio de grupo confirmado</h2>
        <p>Hola,</p>
        <p>Os confirmamos el cambio de grupo de <strong>${escaparHtml(nombre)}</strong>
        en ${escaparHtml(actividad)}.</p>
        <p><strong>Grupo anterior:</strong> ${escaparHtml(anterior)}<br>
        <strong>Nuevo grupo:</strong> ${escaparHtml(nuevo)}</p>
        <p>La plaza ya figura en el nuevo grupo. Para cualquier duda, contactad con
        Coordinación de Extraescolares CSB.</p></div>`
    }
  });
};
// ==========================================
// 🏠 LANDING PAGE (VERSIÓN COMPLETA Y DETALLADA)
// ==========================================
const LandingPage = ({ setView }) => {
  const [tab, setTab] = useState('actividades');
  const [filtroEtapa, setFiltroEtapa] = useState('todos');
  const [highlightedActId, setHighlightedActId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const actId = params.get('act');
    if (actId) {
      const actExists = OFERTA_ACTIVIDADES.some(a => a.id === actId);
      if (actExists) {
        setTab('actividades');
        setFiltroEtapa('todos');
        setHighlightedActId(actId);
        
        // Esperar a que cambie el tab y se renderice el layout
        setTimeout(() => {
          const el = document.getElementById(`card-${actId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);

        // Limpiar el parámetro de la URL
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('act');
          window.history.replaceState({}, '', url.pathname + url.search);
        }, 1500);

        // Limpiar el resaltado después de 4 segundos
        setTimeout(() => {
          setHighlightedActId(null);
        }, 4000);
      }
    }
  }, []);

  // 🎨 GENERADOR DE TEMAS ESTÉTICOS POR ACTIVIDAD (factor WOW)
  const getThemeByActivity = (act) => {
    const id = act.id || '';
    if (id === 'chapoteo') {
      return {
        headerGrad: 'from-pink-500/90 to-rose-600/90',
        badgeText: '👶 Iniciación Infantil',
        btnBg: 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-600 hover:text-white',
        btnHover: 'group-hover:bg-pink-600 group-hover:text-white border-pink-100',
        shadowGlow: 'hover:shadow-pink-900/10 hover:border-pink-200',
        priceColor: 'from-pink-600 to-rose-500'
      };
    }
    if (id.includes('primaria')) {
      return {
        headerGrad: 'from-blue-600/90 to-indigo-700/90',
        badgeText: '🏅 Perfeccionamiento Primaria',
        btnBg: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white',
        btnHover: 'group-hover:bg-blue-600 group-hover:text-white border-blue-100',
        shadowGlow: 'hover:shadow-blue-900/10 hover:border-blue-200',
        priceColor: 'from-blue-600 to-indigo-500'
      };
    }
    if (id === 'waterpolo') {
      return {
        headerGrad: 'from-orange-500/90 to-red-600/90',
        badgeText: '🤽‍♂️ Balón y Deporte de Equipo',
        btnBg: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white',
        btnHover: 'group-hover:bg-orange-600 group-hover:text-white border-orange-100',
        shadowGlow: 'hover:shadow-orange-900/10 hover:border-orange-200',
        priceColor: 'from-orange-600 to-red-500'
      };
    }
    if (id === 'eso_bach') {
      return {
        headerGrad: 'from-purple-600/90 to-violet-700/90',
        badgeText: '🎓 Jóvenes y Mantenimiento',
        btnBg: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-600 hover:text-white',
        btnHover: 'group-hover:bg-purple-600 group-hover:text-white border-purple-100',
        shadowGlow: 'hover:shadow-purple-900/10 hover:border-purple-200',
        priceColor: 'from-purple-600 to-violet-500'
      };
    }
    if (id === 'aquagym') {
      return {
        headerGrad: 'from-cyan-500/90 to-teal-600/90',
        badgeText: '⚡ Fitness y Tono Acuático',
        btnBg: 'bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-600 hover:text-white',
        btnHover: 'group-hover:bg-cyan-600 group-hover:text-white border-cyan-100',
        shadowGlow: 'hover:shadow-cyan-900/10 hover:border-cyan-200',
        priceColor: 'from-cyan-600 to-teal-500'
      };
    }
    if (id === 'nado_libre') {
      return {
        headerGrad: 'from-slate-600/90 to-slate-850/90',
        badgeText: '⏱️ Nado Libre Independiente',
        btnBg: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-800 hover:text-white',
        btnHover: 'group-hover:bg-slate-800 group-hover:text-white border-slate-200',
        shadowGlow: 'hover:shadow-slate-900/10 hover:border-slate-350',
        priceColor: 'from-slate-700 to-slate-500'
      };
    }
    // Adultos
    return {
      headerGrad: 'from-emerald-600/90 to-teal-700/90',
      badgeText: '🌱 Salud & Bienestar Adultos',
      btnBg: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white',
      btnHover: 'group-hover:bg-emerald-600 group-hover:text-white border-emerald-100',
      shadowGlow: 'hover:shadow-emerald-900/10 hover:border-emerald-200',
      priceColor: 'from-emerald-600 to-teal-500'
    };
  };

  return (
    <div className="font-sans text-gray-800 bg-white min-h-screen flex flex-col">
      {/* HERO SECTION */}
      <div className="relative h-[480px] flex items-center justify-center text-white bg-black">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <img src={IMG_PRINCIPAL} className="w-full h-full object-cover z-0" alt="Piscina" />
        </div>
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
        <img src={IMG_ESCUDO_BLANCO} className="h-20 md:h-28 mx-auto mb-6 drop-shadow-2xl object-contain max-w-[85vw]" alt="Escudo" />
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black mb-4 text-white leading-tight [text-shadow:_2px_2px_0_#2563eb,_-2px_-2px_0_#2563eb,_2px_-2px_0_#2563eb,_-2px_2px_0_#2563eb,_0_4px_6px_rgba(0,0,0,0.3)]">
          Natación colegio <br /> 
          <span className="tracking-tight">San Buenaventura</span>
        </h1>
          
          {/* 👇 AQUÍ ESTÁN LAS FRASES QUE FALTABAN 👇 */}
          <p className="text-xl md:text-2xl font-light mb-2 drop-shadow-sm opacity-90">
            Deporte, salud y educación en el agua
          </p>
          <p className="text-xs md:text-sm italic text-gray-200 mb-8 max-w-2xl border-t border-white/30 pt-2">
            "Estas actividades tienen carácter voluntario, no discriminatorio y no lucrativo"
          </p>

          <button
            onClick={() => setView('login')}
            className="bg-white text-blue-900 px-8 py-3 rounded-full font-bold text-lg hover:bg-blue-50 transition shadow-lg mt-2 transform hover:scale-105"
          >
            Acceder al Área Privada
          </button>
        </div>
      </div>

      {/* NAV TABS */}
      <div className="sticky top-0 z-40 bg-white shadow-md border-b">
        <div className="max-w-4xl mx-auto flex">
{['actividades', 'info', 'instalaciones', 'tutorial'].map(t => (            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-4 font-bold text-sm uppercase border-b-4 transition-colors ${
                tab === t ? 'border-blue-600 text-blue-800 bg-blue-50' : 'border-transparent text-gray-500 hover:text-blue-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-6">
{/* 📹 NUEVA VISTA: REPRODUCTOR DEL VIDEOTUTORIAL DE INSCRIPCIÓN */}
          {tab === 'tutorial' && (
            <div className="max-w-3xl mx-auto animate-fade-in text-center space-y-6">
              <div>
                <h3 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-2">
                  📹 Videotutorial de Inscripción
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Te guiamos paso a paso para que puedas inscribir a tus hijos de forma fácil y rápida.
                </p>
              </div>

              {/* REPRODUCTOR DE VÍDEO CONECTADO A STORAGE */}
              <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <video 
                  src="https://firebasestorage.googleapis.com/v0/b/piscina-sanbuenaventura.firebasestorage.app/o/Inscripci%C3%B3n%20piscina.mp4?alt=media&token=5e916f7d-52b0-4a1c-90cb-a969bd7836fd" 
                  controls 
                  className="w-full rounded-2xl shadow-inner border border-gray-100"
                  poster="https://firebasestorage.googleapis.com/v0/b/piscina-sanbuenaventura.firebasestorage.app/o/colegio%20buena%20-%20Editad apng?alt=media&token=707d9103-533f-4460-b719-1274b2004031" // Imagen de fondo sutil antes de dar al play
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-xs text-blue-900 font-medium max-w-xl mx-auto">
                💡 <strong>¿Tienes alguna duda extra?</strong> Si tras ver el vídeo sigues necesitando ayuda, puedes acudir a la pestaña de "Información" para ver los teléfonos de contacto. ¡Al agua patos!
              </div>
            </div>
          )}
          
{/* VISTA ACTIVIDADES (CORREGIDA Y SIN ERRORES) */}
{tab === 'actividades' && (
  <div className="flex flex-col animate-fade-in w-full">
    
    {/* 1. TÍTULO */}
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 text-center">
      Navegación Rápida
    </p>

    {/* 2. FILTRO */}
    <div className="flex flex-wrap justify-center gap-3 mb-10">
      {[
        { id: 'todos', label: '🌟 Todas', color: 'bg-slate-800' },
        { id: 'infantil', label: '👶 Infantil', color: 'bg-pink-500' },
        { id: 'primaria', label: '👦 Primaria', color: 'bg-blue-500' },
        { id: 'secundaria', label: '🎓 ESO/Bach', color: 'bg-purple-600' },
        { id: 'adultos', label: '👨‍👩‍👧 Adultos', color: 'bg-emerald-600' }
      ].map((boton) => (
        <button
          key={boton.id}
          onClick={() => setFiltroEtapa(boton.id)}
          className={`px-5 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300 transform hover:scale-105 shadow-sm
            ${filtroEtapa === boton.id 
              ? `${boton.color} text-white shadow-lg ring-4 ring-offset-2 ring-opacity-50` 
              : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
        >
          {boton.label}
        </button>
      ))}
    </div>

    {/* 3. GRID DE TARJETAS */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-center justify-items-center">
    {OFERTA_ACTIVIDADES
        .filter(act => {
          if (filtroEtapa === 'todos') return true;
          if (filtroEtapa === 'infantil') return act.cursos.some(c => c.includes('INF'));
          if (filtroEtapa === 'primaria') return act.cursos.some(c => c.includes('PRI'));
          if (filtroEtapa === 'secundaria') return act.cursos.some(c => c.includes('ESO') || c.includes('BACH'));
          if (filtroEtapa === 'adultos') return act.cursos.includes('ADULTO');
          return true;
        })
        .map((act) => {
          const theme = getThemeByActivity(act);
          return (
            /* 🚀 CADA TARJETA AHORA LLEVA AL LOGIN */
            <div 
              key={act.id} 
              id={`card-${act.id}`}
              onClick={() => setView('login')}
              className={`bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden border flex flex-col hover:shadow-2xl hover:bg-white/90 transition-all duration-500 group cursor-pointer transform hover:-translate-y-1 w-full max-w-sm md:max-w-none ${
                highlightedActId === act.id 
                  ? 'ring-4 ring-blue-500 border-blue-500 scale-105 shadow-2xl z-10' 
                  : 'border-white/40'
              } ${theme.shadowGlow}`}
            >
              
              {/* Encabezado con degradado dinámico según actividad */}
              <div className={`bg-gradient-to-br ${theme.headerGrad} p-5 relative text-left`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-white/10">
                    {theme.badgeText}
                  </span>
                </div>
                <h3 className="text-white font-black text-lg pr-8 uppercase tracking-tight leading-tight">{act.nombre}</h3>
                
                {/* ✨ Aviso que sale al pasar el ratón */}
                <div className="absolute top-5 right-5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-black bg-blue-900/40 px-2.5 py-1.5 rounded-lg">ENTRAR ➔</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded border border-white/10 font-mono font-bold">
                    📅 {act.diasResumen}
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded font-bold border border-white/10">
                    👥 Máx. {act.alumnosMax} Alumnos
                  </span>
                  {act.requierePrueba && (
                    <span className="bg-red-500 text-white text-[10px] px-2.5 py-1 rounded font-bold shadow-sm animate-pulse whitespace-nowrap">
                      ❗ Requiere Prueba
                    </span>
                  )}
                </div>
              </div>
        
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-slate-600 text-sm mb-4 flex-1 whitespace-pre-line leading-relaxed text-left font-medium">
                  {act.descripcion}
                </p>
                
                {/* Aviso en cristal amarillo */}
                {act.aviso && (
                  <div className="bg-amber-400/10 border border-amber-200/50 p-3 rounded-xl text-xs text-amber-900 mb-4 font-semibold flex gap-2 text-left backdrop-blur-sm">
                    <span>⚠️</span>
                    <span>{act.aviso}</span>
                  </div>
                )}
        
                {/* Footer con precios destacados */}
                <div className="border-t border-slate-100 pt-3 mt-auto flex justify-between items-center">
                   <div className="text-left">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Mínimo para grupo:</p>
                      <p className="text-xs font-black text-blue-800">{act.minAlumnos} alumnos</p>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Precio</span>
                      <p className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${theme.priceColor}`}>
                        {act.precioResumen}
                      </p>
                   </div>
                </div>

                {/* ✨ Botones de Acción (Inscripción y Compartido) */}
                <div className="mt-4 flex gap-2 w-full">
                  <div className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl text-center transition-all border flex items-center justify-center ${theme.btnBg} ${theme.btnHover}`}>
                    Inscribirme / Reservar Prueba
                  </div>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const urlCompartir = `${window.location.origin}${window.location.pathname}?act=${act.id}`;
                      const textoCompartir = `¡Mira la actividad de natación de "${act.nombre}" del Colegio San Buenaventura! 🏊‍♂️✨`;
                      
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: act.nombre,
                            text: textoCompartir,
                            url: urlCompartir,
                          });
                          showToast('¡Compartido con éxito! 🚀', 'success');
                        } catch (err) {
                          if (err.name !== 'AbortError') console.error(err);
                        }
                      } else {
                        try {
                          await navigator.clipboard.writeText(urlCompartir);
                          showToast('📋 ¡Enlace copiado! Listo para compartir.', 'success');
                        } catch (err) {
                          console.error(err);
                          showToast('❌ No se pudo copiar el enlace', 'error');
                        }
                      }
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                    title="Compartir enlace directo"
                  >
                    🔗 Compartir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  </div>
)}

{/* VISTA INFO COMPLETA CON ÍNDICE DE ACCESO RÁPIDO */}
{tab === 'info' && (
            <div className="space-y-10 animate-fade-in">
              
{/* 🧭 ÍNDICE VISUAL DE SECCIONES (3 ARRIBA, 2 ABAJO) */}
<div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-sm mb-10 max-w-4xl mx-auto">
  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 text-center">
    Navegación Rápida
  </p>
  
  <div className="flex flex-col gap-4">
    {/* Fila superior */}
    <div className="grid grid-cols-3 gap-4">
      <a href="#mapa" className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:text-blue-600 transition-all">
        <span className="text-2xl">🗺️</span>
        <span className="font-black text-[10px] uppercase tracking-widest">Mapa</span>
      </a>
      <a href="#material" className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:text-blue-600 transition-all min-w-0">
  <span className="text-2xl">🎒</span>
  <span className="font-black text-[9px] uppercase tracking-wider leading-none text-center">
    Equipamiento
  </span>
</a>
      <a href="#normativa" className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:text-blue-600 transition-all">
        <span className="text-2xl">📅</span>
        <span className="font-black text-[10px] uppercase tracking-widest">Normas</span>
      </a>
    </div>

    {/* Fila inferior */}
    <div className="flex justify-center gap-4">
      <a href="#faq" className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:text-blue-600 transition-all w-full max-w-[31%]">
        <span className="text-2xl">🤔</span>
        <span className="font-black text-[10px] uppercase tracking-widest">Preguntas</span>
      </a>
      <a href="#contacto" className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:text-blue-600 transition-all w-full max-w-[31%]">
        <span className="text-2xl">📞</span>
        <span className="font-black text-[10px] uppercase tracking-widest">Contacto</span>
      </a>
    </div>
  </div>
</div>

               {/* MAPA */}
               <div id="mapa" className="bg-white p-6 rounded-xl shadow border border-gray-200 scroll-mt-20">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">🗺️ Mapa de Accesos</h3>
                  <div className="w-full bg-gray-100 rounded-lg overflow-hidden border relative flex justify-center p-4">
                      <img src={MAPA_IMAGEN_URL} className="max-h-[500px] object-contain rounded shadow-sm" alt="Mapa" />
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Acceso por el portón azul al final del patio.</p>
               </div>

              {/* MATERIAL NECESARIO - REDISEÑO PROFESIONAL */}
<div id="material" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden my-8 scroll-mt-20">
  {/* Cabecera con gradiente sutil */}
  <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-5 text-white">
    <div className="flex items-center gap-3">
      <span className="text-2xl">🎒</span>
      <div>
        <h3 className="font-black uppercase tracking-wider text-sm">Equipamiento</h3>
        <p className="text-blue-100 text-[10px] font-medium opacity-90">REQUERIDO PARA CADA CLASE</p>
      </div>
    </div>
  </div>

  {/* Grid de Materiales */}
  <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
    {[
      { icon: "🩲", label: "Bañador", desc: "Deportivo" },
      { icon: "🧣", label: "Toalla", desc: "O Albornoz" },
      { icon: "🥽", label: "Gafas", desc: "Ajustadas" },
      { icon: "🧢", label: "Gorro", desc: "Silicona/Lycra" },
      { icon: "🩴", label: "Chanclas", desc: "Goma" },
    ].map((item, idx) => (
      <div 
        key={idx} 
        className="group p-4 rounded-2xl border border-gray-50 bg-gray-50/30 hover:bg-blue-50 hover:border-blue-100 transition-all duration-300 flex flex-col items-center shadow-sm hover:shadow-md"
      >
        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform duration-300 mb-3">
          {item.icon}
        </div>
        <span className="font-black text-gray-800 text-[11px] uppercase tracking-wide">
          {item.label}
        </span>
        <span className="text-[9px] text-gray-400 font-bold group-hover:text-blue-500 transition-colors uppercase mt-1">
          {item.desc}
        </span>
      </div>
    ))}
  </div>

  {/* Recordatorio de Higiene sutil */}
  <div className="bg-gray-50 p-3 border-t border-gray-100 text-center">
    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
      ✨ Recuerda ducharte antes de entrar al agua
    </p>
  </div>
</div>

              {/* RECOGIDA ALUMNOS (TEXTOS COMPLETOS) */}
              <div className="grid md:grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-400">
                  <h4 className="font-bold text-lg mb-2 text-blue-900">👶 Infantil</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Los alumnos de Educación Infantil serán recogidos directamente en sus aulas por los monitores, quienes también se encargarán de ayudarles a cambiarse. Al finalizar la clase, los niños serán entregados a sus familias con la ropa de calle, <strong>en la puerta del vestuario correspondiente.</strong>
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600">
                  <h4 className="font-bold text-lg mb-2 text-blue-900">🧒 Primaria (16:15)</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    El monitor recogerá a los alumnos en el <strong>portón azul</strong> al final del patio. Al finalizar la clase, los niños serán entregados a sus familias con la ropa de calle en el mismo punto.
                  </p>
                </div>
              </div>

              {/* AVISOS Y AMPLIACIÓN */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <ul className="space-y-4 text-gray-700 text-sm">
                  <li className="flex gap-4">
                    <span className="text-2xl">🕓</span> 
                    <span><strong>Resto de actividades:</strong> El alumnado deberá ir directamente a la piscina con suficiente antelación para cambiarse.</span>
                  </li>
                  <li className="flex gap-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <span className="text-2xl">🕰️</span> 
                    <div>
                      <p className="font-bold text-orange-900 mb-1">Servicio de Ampliación</p>
                      <p>
                        Se ruega puntualidad a la hora de la recogida. En caso de llegar tarde, <strong>hasta las 18:00</strong> podrán recogerlos en el servicio de ampliación (consultar coste en secretaría).
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

{/* ======================================================== */}
{/* ⚠️ GESTIÓN DE ALTAS Y BAJAS - DISEÑO PROFESIONAL       */}
{/* ======================================================== */}
<div id="normativa" className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden my-10 scroll-mt-20">
  {/* Encabezado de Advertencia */}
  <div className="bg-gradient-to-r from-amber-600 to-amber-500 p-5 text-white">
    <div className="flex items-center gap-3">
      <span className="text-2xl">📅</span>
      <div>
        <h3 className="font-black uppercase tracking-wider text-sm">Calendario Administrativo</h3>
        <p className="text-amber-100 text-[10px] font-medium opacity-90">NORMAS DE INSCRIPCIÓN Y CANCELACIÓN</p>
      </div>
    </div>
  </div>

  <div className="p-6 md:p-8 space-y-8">
    {/* SECCIÓN BAJAS */}
    <div className="relative pl-8 border-l-2 border-amber-200">
      <div className="absolute -left-[9px] top-0 w-4 h-4 bg-amber-500 rounded-full border-4 border-white shadow-sm"></div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-xl">
          <h4 className="font-black text-amber-900 text-lg uppercase tracking-tight flex items-center gap-2">
            Solicitud de Bajas
          </h4>
          <p className="text-amber-800/80 text-sm mt-2 leading-relaxed font-medium">
            La fecha límite para procesar cualquier baja es el <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">Día 25</span> de cada mes.
          </p>
        </div>
        <div className="bg-amber-100/50 px-4 py-3 rounded-xl border border-amber-200 flex flex-col items-center min-w-[140px]">
          <span className="text-[10px] font-black text-amber-600 uppercase">Corte mensual</span>
          <span className="text-2xl font-black text-amber-900 leading-none mt-1">Día 25</span>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-amber-700/60 font-bold uppercase tracking-wide bg-amber-50 p-3 rounded-lg border border-amber-100/50">
        ⚠️ Comunicaciones posteriores al día 25 implican el cobro de la siguiente mensualidad completa.
      </p>
    </div>

   {/* SECCIÓN ALTAS - MEJORADA (MÁS LEGIBLE) */}
   <div className="relative pl-8 border-l-2 border-blue-500">
      {/* Círculo indicador más grande */}
      <div className="absolute -left-[11px] top-0 w-5 h-5 bg-blue-600 rounded-full border-4 border-white shadow-sm"></div>
      
      <h4 className="font-black text-slate-900 text-xl uppercase tracking-tight">
        Altas y Mensualidades
      </h4>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloque 1 */}
        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
          <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Política de Pago</span>
          <p className="text-slate-800 text-base font-bold mt-2 leading-relaxed">
            Las incorporaciones con el mes ya iniciado requieren el abono de la <span className="text-blue-700 underline decoration-2 underline-offset-4">mensualidad completa</span>.
          </p>
        </div>

        {/* Bloque 2 */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Aviso de Prorrateos</span>
          <p className="text-slate-800 text-base font-bold mt-2 leading-relaxed">
            No se realizan descuentos ni devoluciones por días sueltos o falta de asistencia.
          </p>
        </div>
      </div>
    </div>
  </div>

  {/* Espaciador inferior limpio (Sustituye al bloque negro de Transparencia) */}
  <div className="h-4 bg-gray-50/50"></div>
</div>
 {/* ❓ SECCIÓN AMPLIADA: PREGUNTAS FRECUENTES (FAQ)         */}
{/* ======================================================== */}
<div id="faq" className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden my-10 scroll-mt-24">
  <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white text-left">
    <div className="flex items-center gap-3">
      <span className="text-2xl">🤔</span>
      <div>
        <h3 className="font-black uppercase tracking-wider text-sm">Preguntas Frecuentes</h3>
        <p className="text-slate-300 text-[10px] font-medium opacity-90">TODO LO QUE NECESITAS SABER SOBRE NOSOTROS</p>
      </div>
    </div>
  </div>

  <div className="p-6 space-y-6">
    
    {/* CATEGORÍA: ACCESOS Y RECOGIDAS */}
    <div>
      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 text-left">📍 Accesos y Recogidas</h4>
      <div className="space-y-3">
        {[
          {
            q: "¿Dónde se recoge a los alumnos al finalizar la clase?",
            a: "La recogida se realiza en la puerta de las instalaciones de la piscina. Podrá acceder por el Portón Azul hasta las 18:30. A partir de esa hora, el acceso se realizará exclusivamente por la puerta del parking."
          },
          {
            q: "¿Por dónde entran y salen los alumnos a partir de las 18:30?",
            a: "El acceso principal al colegio se cierra. La entrada y salida se realiza exclusivamente por la puerta que está al final del parking del colegio. Pueden encontrar un mapa en la parte superior de esta sección."
          },
          {
            q: "¿Cómo es la recogida de los alumnos de Infantil?",
            a: "Para los alumnos de Infantil que terminan su clase, los monitores los recogen directamente en su clase."
          },
          {
            q: "¿Pueden entrar los padres a los vestuarios?",
            a: "Siguiendo la normativa de autonomía y seguridad, el acceso de adultos a vestuarios está limitado. Los alumnos de Primaria deben cambiarse solos para fomentar su independencia. En Infantil, se permite asistencia mínima si es estrictamente necesario."
          }
        ].map((item, idx) => (
          <details key={idx} className="group border border-slate-100 rounded-xl">
            <summary className="flex justify-between items-center p-4 bg-slate-50/50 cursor-pointer list-none hover:bg-white">
              <span className="text-sm font-bold text-slate-700 text-left leading-tight">{item.q}</span>
              <span className="text-blue-500 transition-transform group-open:rotate-180 ml-2">▼</span>
            </summary>
            <div className="p-4 bg-white text-sm text-slate-600 leading-relaxed border-t border-slate-50 text-left">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>

    {/* CATEGORÍA: INSCRIPCIONES Y PAGOS */}
    <div>
      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-3 text-left">💳 Inscripciones y Pagos</h4>
      <div className="space-y-3">
        {[
          {
            q: "¿Cómo me doy de baja en la actividad?",
            a: "Las bajas deben comunicarse antes del día 25 del mes anterior al que se desea hacer efectiva la baja. La baja se tramita desde el áera privada de cada usuario."
          },
          {
            q: "¿Qué pasa si devuelvo un recibo mensual?",
            a: "La devolución de un recibo genera gastos bancarios que deberán ser abonados por la familia. Si el impago persiste, el alumno perderá la plaza automáticamente."
          },
          {
            q: "¿Hay que pagar matrícula cada año?",
            a: "No, no hay matrícula."
          }
        ].map((item, idx) => (
          <details key={idx} className="group border border-slate-100 rounded-xl">
            <summary className="flex justify-between items-center p-4 bg-slate-50/50 cursor-pointer list-none hover:bg-white">
              <span className="text-sm font-bold text-slate-700 text-left leading-tight">{item.q}</span>
              <span className="text-blue-500 transition-transform group-open:rotate-180 ml-2">▼</span>
            </summary>
            <div className="p-4 bg-white text-sm text-slate-600 leading-relaxed border-t border-slate-50 text-left">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>

    {/* CATEGORÍA: DINÁMICA DE CLASES */}
    <div>
      <h4 className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-3 text-left">🏊‍♂️ Sobre las Clases</h4>
      <div className="space-y-3">
        {[
          {
            q: "¿Cuál es el número máximo de alumnos por grupo y qué horarios hay disponibles?",
            a: "Puedes consultar el detalle actualizado de horarios, días de clase y ratios de alumnos por monitor en la sección de 'Actividades' al principio de esta página. Allí encontrarás la información específica para cada nivel y edad."
          },
          {
            q: "¿A qué temperatura está el agua de la piscina?",
            a: "Nuestras instalaciones son de uso deportivo, por lo que el agua se mantiene en el rango óptimo recomendado para la actividad física: entre 27°C y 28°C. Esta temperatura garantiza el confort térmico del alumno durante el ejercicio, evitando tanto el sobrecalentamiento como la fatiga prematura."
          },
          {
            q: "¿Necesito hacer prueba de nivel si soy nuevo?",
            a: "Sí, todos los alumnos nuevos (de actividades que lo requieran) deben realizar una prueba de nivel previa para asignarles el grupo que mejor se adapte a su habilidad actual y asegurar su aprendizaje."
          },
          {
            q: "¿Qué material debe traer el alumno siempre?",
            a: "Bañador, gorro de silicona o lycra, gafas de natación, chanclas y toalla o albornoz. Todo marcado con el nombre del alumno a ser posible."
          },
          {
            q: "¿Puedo cambiar de horario a mitad de curso?",
            a: "Solo si hay plazas disponibles en el nivel correspondiente del nuevo horario solicitado. Deberá consultarse con el coordinador de la actividad."
          }
        ].map((item, idx) => (
          <details key={idx} className="group border border-slate-100 rounded-xl">
            <summary className="flex justify-between items-center p-4 bg-slate-50/50 cursor-pointer list-none hover:bg-white">
              <span className="text-sm font-bold text-slate-700 text-left leading-tight">{item.q}</span>
              <span className="text-blue-500 transition-transform group-open:rotate-180 ml-2">▼</span>
            </summary>
            <div className="p-4 bg-white text-sm text-slate-600 leading-relaxed border-t border-slate-50 text-left">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>

  </div>
</div>

{/* ======================================================== */}
              {/* 📞 SECCIÓN: CONTACTO Y UBICACIÓN (VERSIÓN MEJORADA)      */}
              {/* ======================================================== */}
              <div id="contacto" className="grid md:grid-cols-2 gap-6 pt-4 scroll-mt-20">
                
                {/* TARJETA DE CONTACTO */}
                <div className="bg-white border-l-4 border-blue-600 rounded-xl p-6 shadow-md hover:shadow-lg transition">
                  <h3 className="text-xl font-black text-blue-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">📞 Contacto y Redes</h3>
                  
                  <div className="space-y-6">
                    {/* Teléfono */}
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 w-12 h-12 flex items-center justify-center rounded-full text-xl shadow-sm">☎️</div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Secretaría General</p>
                            <a href="tel:915267161" className="text-2xl font-black text-blue-700 hover:text-blue-900 transition">
                                915 26 71 61
                            </a>
                        </div>
                    </div>
                   

                    {/* NUEVOS ENLACES: WEB E INSTAGRAM (REORDENADOS Y FUNCIONALES) */}
<div className="grid grid-cols-2 gap-3 pt-2">
    {/* Botón Web Colegio */}
    <a 
      href="https://www.sanbuenaventura.org/" 
      target="_blank" 
      rel="noopener noreferrer" 
      className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 transition shadow-sm group"
    >
        <span className="text-lg group-hover:scale-110 transition-transform">🌐</span>
        <span className="text-[10px] font-black text-gray-600 uppercase">Web Colegio</span>
    </a>

{/* Botón Instagram: Versión API Universal */}
<a 
  href="https://www.instagram.com/cs_buenaventura" 
  target="_blank" 
  rel="noopener noreferrer" 
  className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition shadow-sm group w-full"
  onClick={(e) => {
    // Si estamos en móvil, intentamos este truco de "doble salto"
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // Este es el enlace que "despierta" a la app en el perfil directamente
      window.location.href = "instagram://user?username=cs_buenaventura";
      // Evitamos que el navegador siga el enlace normal si ya abrió la app
      setTimeout(() => {
        // Si no ha saltado la app, no hacemos nada y el target="_blank" hará su trabajo
      }, 300);
    }
  }}
>
    <svg 
        viewBox="0 0 24 24" 
        className="w-5 h-5 group-hover:scale-110 transition-transform"
    >
        <defs>
            <radialGradient id="insta_final_api" r="150%" cx="30%" cy="107%">
                <stop offset="0%" stopColor="#fdf497" />
                <stop offset="45%" stopColor="#fd5949" />
                <stop offset="60%" stopColor="#d6249f" />
                <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
        </defs>
        <path 
            fill="url(#insta_final_api)" 
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" 
        />
    </svg>
    <span className="text-[10px] font-black text-gray-600 uppercase">Instagram</span>
</a>
</div>

                    {/* Emails */}
                    <div className="flex items-start gap-3 border-t border-gray-100 pt-6">
                        <div className="bg-orange-100 w-10 h-10 flex items-center justify-center rounded-full text-lg shrink-0">📧</div>
                        <div className="flex flex-col gap-2 w-full">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Correos Electrónicos</p>
                            <a href="mailto:extraescolarespiscina@sanbuenaventura.org" className="text-[13px] font-bold text-gray-700 hover:text-blue-600 transition break-all leading-tight">
                                • extraescolarespiscina@sanbuenaventura.org
                            </a>
                            <a href="mailto:extraescolares@sanbuenaventura.org" className="text-[13px] font-bold text-gray-700 hover:text-blue-600 transition break-all leading-tight">
                                • extraescolares@sanbuenaventura.org
                            </a>
                        </div>
                    </div>
                  </div>
                </div>
                {/* ======================================================== */}


                {/* TARJETA DE UBICACIÓN */}
                <div className="bg-white border-l-4 border-green-600 rounded-xl p-6 shadow-md hover:shadow-lg transition flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black text-green-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">📍 Ubicación</h3>
                    
                    <div className="flex items-start gap-4 mb-6">
                        <div className="bg-green-100 w-12 h-12 flex items-center justify-center rounded-xl text-2xl shadow-sm shrink-0">🏫</div>
                        <div>
                            <p className="font-black text-gray-900 uppercase text-sm tracking-tight">Colegio San Buenaventura</p>
                            <p className="text-base font-medium text-gray-600 mt-1 leading-relaxed">
                                C. de El Greco, 16,<br/>
                                Latina, 28011 Madrid
                            </p>
                        </div>
                    </div>
                  </div>

                  <a 
                    href="https://www.google.com/maps/dir/?api=1&destination=Colegio+San+Buenaventura+Madrid" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-green-700 transition shadow-xl transform active:scale-95 uppercase tracking-widest text-sm"
                  >
                    🗺️ Cómo llegar (Maps)
                  </a>
                </div>

              </div>

            </div>
          )}

{/* VISTA INSTALACIONES (ESTRUCTURA CORREGIDA) */}
{tab === 'instalaciones' && (
  <div className="flex flex-col animate-fade-in w-full space-y-12">
    
    {/* 1. PANEL DE ESTADO TÉCNICO (Ocupa todo el ancho) */}
    <div className="flex flex-col w-full">
      {/* Grid de 4 tarjetas técnicas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(() => {
          const now = new Date();
          const seed = now.getDate() + now.getHours();
          const getFluctuation = (base, range, seedValue) => {
            const hash = Math.sin(seedValue) * 10000;
            const random = hash - Math.floor(hash);
            return (base + random * range).toFixed(1);
          };

          const stats = [
            { label: 'Temperatura Agua', val: getFluctuation(27.4, 0.6, seed) + '°C', status: 'ÓPTIMO', icon: '🌡️', color: 'text-blue-600', bg: 'bg-blue-50/50' },
            { label: 'Nivel de pH', val: getFluctuation(7.1, 0.3, seed + 1), status: 'EQUILIBRADO', icon: '🧪', color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
            { label: 'Calidad Aire', val: '98%', status: 'EXCELENTE', icon: '💨', color: 'text-cyan-600', bg: 'bg-cyan-50/50' },
            { label: 'Estado Vaso', val: 'FILTRANDO', status: 'CONTINUO', icon: '🔄', color: 'text-indigo-500', bg: 'bg-indigo-50/50' }
          ];

          return stats.map((item, idx) => (
            <div key={idx} className="relative overflow-hidden bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-lg shadow-slate-200/50 flex flex-col items-center text-center transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:border-blue-200">
              <div className={`absolute -top-4 -right-4 w-16 h-16 ${item.bg} rounded-full blur-2xl opacity-60`}></div>
              <span className="text-3xl mb-3 relative z-10 drop-shadow-sm">{item.icon}</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 relative z-10">{item.label}</p>
              <p className={`text-2xl font-black ${item.color} leading-none mb-2 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.02)]`}>{item.val}</p>
              <div className="flex items-center gap-2 bg-slate-50/80 px-3 py-1 rounded-full relative z-10 border border-slate-100/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{item.status}</span>
              </div>
            </div>
          ));
        })()}
      </div>

{/* Bloque de sincronización (AHORA A LA IZQUIERDA Y SIN ERRORES) */}
<div className="flex justify-start items-center gap-4 mt-6 px-4 py-3 bg-blue-50/30 rounded-2xl border border-blue-100/50 max-w-fit mr-auto">
        {/* Barra lateral azul a la izquierda */}
        <div className="h-10 w-[3px] bg-gradient-to-b from-blue-400 to-blue-600 rounded-full shadow-sm"></div>
        
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">
              Monitorización en Tiempo Real
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
            Sincronizado con centralita: <span className="text-blue-600 font-black">{new Date().getHours()}:00h</span>
          </p>
          <p className="text-[8px] text-slate-400 font-medium italic">
            * Parámetros actualizados automáticamente cada 60 minutos.
          </p>
        </div>
      </div>
    </div> {/* <--- ESTE ES EL DIV QUE CIERRA EL CONTENEDOR DE LA PESTAÑA */}

    {/* 2. GALERÍA DE FOTOS (Independiente del panel de arriba) */}
    <div className="w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px bg-slate-100 flex-1"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Explora la instalación</p>
        <div className="h-px bg-slate-100 flex-1"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {GALERIA.map((foto, index) => (
          <div key={index} className="group flex flex-col">
            {/* Contenedor Imagen */}
            <div className="overflow-hidden rounded-[24px] shadow-sm border border-gray-100 bg-gray-50 aspect-[4/3]">
              <img 
                src={foto.url} 
                className="w-full h-full object-cover group-hover:scale-110 transition duration-500" 
                alt={foto.nombre} 
              />
            </div>
            
            {/* Textos debajo */}
            <div className="mt-4 px-1">
              <h4 className="font-black text-slate-800 uppercase text-[12px] tracking-widest text-left">
                {foto.nombre}
              </h4>
              <p className="text-[10px] text-blue-600 font-bold uppercase mt-1 text-left tracking-tight">
                {foto.zona}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

        </div>
      </div>

{/* 🏛️ FOOTER ESTILO ORIGINAL (FULL WIDTH) */}
<footer className="bg-gray-900 text-white py-8 mt-12 w-full border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Escudo a la izquierda con efecto blanco sutil */}
          <div className="flex items-center gap-4">
            <img 
              src="https://i.ibb.co/KjCWNLrc/CSB.png" 
              className="h-12 w-auto brightness-0 invert opacity-90 transition-opacity hover:opacity-100" 
              alt="CSB" 
            />
            <div className="h-8 w-[1px] bg-gray-700 hidden md:block"></div>
          </div>

          {/* Texto Central con mayor tracking */}
          <div className="text-center md:text-left flex-1 md:ml-6">
            <p className="text-sm font-medium text-gray-400 tracking-[0.1em]">
              © {new Date().getFullYear()} <span className="text-white font-black uppercase ml-1">Colegio San Buenaventura</span> — Natación
            </p>
            <p className="text-xs text-gray-500 mt-1">Calle de El Greco, 16, 28011 Madrid</p>
          </div>

          {/* Lado derecho: Un detalle extra de calidad */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Madrid</span>
          </div>
          
        </div>
      </footer>

    </div>
  );
}

// ==========================================
// 💰 MÓDULO DE CÁLCULO DE RENTABILIDAD Y ANÁLISIS OPERATIVO (MILICÉNTIMOS REFINADO)
// Funciones puras para cálculo financiero, calendarios y aforos de piscina
// ==========================================

/**
 * Convierte un texto o número de precio a milicéntimos enteros.
 * 1 Euro = 100.000 milicéntimos
 * 1 Céntimo = 1.000 milicéntimos
 * Formatos admitidos: "37€", "50 €", "65,00€", "37", 37, 14.5.
 */
function parsePrecioAMilicentimos(str) {
  if (str === null || str === undefined || str === '') return 0;
  if (typeof str === 'number') return Math.round(str * 100000);
  
  const limpio = String(str).replace(/[^\d.,]/g, '').trim().replace(',', '.');
  if (!limpio) return 0;
  const num = parseFloat(limpio);
  if (isNaN(num)) return 0;
  return Math.round(num * 100000);
}

/**
 * Convierte un precio a céntimos enteros (compatible con interfaces existentes).
 */
function parsePrecioACentimos(str) {
  return Math.round(parsePrecioAMilicentimos(str) / 1000);
}

/**
 * Normaliza fechas de Firestore (ISO String, Timestamp o Date) a Date.
 */
function normalizarFechaFirestore(val) {
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

/**
 * Extrae y normaliza los días de la semana de un texto comercial.
 * Devuelve valores unívocos: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
 */
function extraerDiasSemana(textoDias) {
  if (!textoDias || typeof textoDias !== 'string') return [];
  const t = textoDias.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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

/**
 * Calcula la duración en minutos a partir del string de horario "HH:MM-HH:MM"
 */
function calcularDuracionMinutos(horarioStr) {
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

/**
 * Determina el segmento físico al que pertenece un alumno según el catálogo y curso
 */
function obtenerSegmentoFisico(actividadId, curso, catalog = []) {
  if (catalog && catalog.length > 0) {
    const actDoc = catalog.find(a => a.id === actividadId);
    if (actDoc && actDoc.segmentosFisicos && actDoc.segmentosFisicos.length > 0) {
      const segMatch = actDoc.segmentosFisicos.find(s => s.cursos && s.cursos.includes(curso));
      if (segMatch) return segMatch.id;
      return actDoc.segmentosFisicos[0].id;
    }
  }

  // Fallback por defecto si no hay catálogo completo
  if (actividadId === 'primaria_1615') {
    if (['1PRI', '2PRI', '3PRI'].includes(curso)) return 'primaria_1615_1a3';
    if (['4PRI', '5PRI', '6PRI'].includes(curso)) return 'primaria_1615_4a6';
    return 'primaria_1615_1a3';
  }
  return actividadId;
}

/**
 * Cuenta los días operativos reales del mes y las apariciones de cada día de la semana
 */
function contarDiasOperativos(mesIndex, anio, festivosArray = []) {
  const month0 = (mesIndex >= 0 && mesIndex <= 11) ? mesIndex : (mesIndex - 1);
  const totalDiasMes = new Date(anio, month0 + 1, 0).getDate();

  const conteoPorDia = { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 };
  let totalDiasOperativos = 0;
  const fechasOperativas = [];

  const festivosSet = new Set((festivosArray || []).map(f => String(f).trim()));

  for (let d = 1; d <= totalDiasMes; d++) {
    const fecha = new Date(anio, month0, d);
    const dayOfWeek = fecha.getDay(); // 0: Sun, 1: Mon, ... 5: Fri, 6: Sat
    
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

/**
 * Cobertura real en horas del socorrista y su coste total en milicéntimos
 */
function calcularCoberturaSocorrista(conteoPorDia, tarifaSocorristaConIvaMc) {
  const horasLJ = (conteoPorDia.lunes + conteoPorDia.martes + conteoPorDia.miercoles + conteoPorDia.jueves) * 3;
  const horasViernes = conteoPorDia.viernes * 3.75;
  const totalHorasSocorrista = horasLJ + horasViernes;
  const costeTotalSocorristaMc = Math.round(totalHorasSocorrista * tarifaSocorristaConIvaMc);

  return { totalHorasSocorrista, costeTotalSocorristaMc };
}

/**
 * Cobertura del coordinador: 1 hora por día operativo
 */
function calcularCoberturaCoordinador(totalDiasOperativos, tarifaCoordinadorConIvaMc) {
  const totalHorasCoordinador = totalDiasOperativos * 1;
  const costeTotalCoordinadorMc = Math.round(totalHorasCoordinador * tarifaCoordinadorConIvaMc);
  return { totalHorasCoordinador, costeTotalCoordinadorMc };
}

/**
 * Construye todas las sesiones físicas unívocas a partir del catálogo oficial de actividades
 */
function construirSesionesFisicas(catalog) {
  const sesiones = [];

  (catalog || []).forEach(act => {
    const requiereMonitorDefault = act.requiereMonitor !== false && act.id !== 'nado_libre';
    const callesNecesariasDefault = act.callesNecesarias || 1;

    const segmentos = (act.segmentosFisicos && act.segmentosFisicos.length > 0)
      ? act.segmentosFisicos
      : [{
          id: act.id,
          nombre: act.nombre,
          minAlumnos: act.minAlumnos || 4,
          alumnosMax: act.alumnosMax || 12,
          callesNecesarias: callesNecesariasDefault,
          requiereMonitor: requiereMonitorDefault
        }];

    segmentos.forEach(seg => {
      const segRequiereMonitor = seg.requiereMonitor !== undefined ? seg.requiereMonitor : requiereMonitorDefault;
      const segCallesNecesarias = seg.callesNecesarias !== undefined ? seg.callesNecesarias : callesNecesariasDefault;
      const segMin = seg.minAlumnos !== undefined ? seg.minAlumnos : (act.minAlumnos || 4);
      const segMax = seg.alumnosMax !== undefined ? seg.alumnosMax : (act.alumnosMax || 12);

      (act.opciones || []).forEach(op => {
        const diasArray = extraerDiasSemana(op.dias);
        const duracionMin = calcularDuracionMinutos(op.horario);

        diasArray.forEach(dia => {
          const key = `${act.id}_${seg.id}_${dia}_${op.horario}`;
          let existente = sesiones.find(s => s.key === key);
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

/**
 * Clasifica a un alumno de Firestore según su validez y estado para el mes seleccionado
 */
function clasificarAlumnoParaMes(alumno, mesIndex, anio, catalog = []) {
  if (!alumno) return { categoria: 'descartado', motivo: 'Registro nulo' };

  // Estados no confirmados de origen
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

  // Detección de actividad y modalidad
  const actividadId = alumno.actividadId || (catalog.find(a => a.nombre === alumno.actividad)?.id);
  const textoDias = alumno.opcionDias || alumno.dias;
  const horario = alumno.horario;

  // Comprobar campos indispensables
  if (!actividadId || !textoDias) {
    return { categoria: 'pendiente_revisar', motivo: 'Faltan datos de actividad o días' };
  }

  const actDoc = catalog.length > 0 ? catalog.find(a => a.id === actividadId) : null;
  
  // Determinar precio en milicéntimos
  let precioMc = parsePrecioAMilicentimos(alumno.precio);
  if (precioMc === 0 && actDoc) {
    // Buscar en catálogo
    const diasNorm = extraerDiasSemana(textoDias);
    const opDoc = (actDoc.opciones || []).find(o => {
      const oDias = extraerDiasSemana(o.dias);
      const coincideDias = oDias.length === diasNorm.length && oDias.every(d => diasNorm.includes(d));
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

  // Comprobar fechas de alta y baja para el mes
  const fechaInicioMes = new Date(anio, mesIndex, 1);
  const fechaFinMes = new Date(anio, mesIndex + 1, 0, 23, 59, 59);

  const fechaAlta = normalizarFechaFirestore(alumno.fechaAlta || alumno.createdAt || alumno.fechaInscripcion);
  if (!fechaAlta) {
    return { categoria: 'pendiente_revisar', motivo: 'Sin fecha de alta válida' };
  }

  // Alta en mes futuro -> Ingreso potencial
  if (fechaAlta > fechaFinMes) {
    return { categoria: 'ingreso_potencial', motivo: 'Alta en mes posterior', precioMc, precioCentimos, actividadId, textoDias, horario };
  }

  const fechaBaja = normalizarFechaFirestore(alumno.fechaBaja);
  if (fechaBaja && fechaBaja < fechaInicioMes) {
    return { categoria: 'descartado', motivo: 'Baja finalizada antes del inicio del mes' };
  }

  // Validación por administrador
  const estaValidado = alumno.validadoAdmin === true || alumno.revisadoAdmin === true;

  if (!estaValidado) {
    return { categoria: 'ingreso_potencial', motivo: 'Pendiente de validación por admin', precioMc, precioCentimos, actividadId, textoDias, horario };
  }

  if (alumno.estado === 'inscrito' || (alumno.estado === 'baja_pendiente' && (!fechaBaja || fechaBaja >= fechaInicioMes)) || (alumno.estado === 'baja_finalizada' && fechaBaja >= fechaInicioMes && fechaBaja <= fechaFinMes)) {
    return { categoria: 'ingreso_confirmado', precioMc, precioCentimos, actividadId, textoDias, horario };
  }

  return { categoria: 'pendiente_revisar', motivo: 'Estado no identificado' };
}

/**
 * Detecta solapamiento de calles por minuto y comprueba si se superan las calles permitidas
 */
function detectarConflictosCalles(sesionesFisicasViables, conteoPorDia, totalCallesPermitidas = 4) {
  const conflictos = [];
  const diasNombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  diasNombres.forEach(diaNombre => {
    if ((conteoPorDia[diaNombre] || 0) === 0) return;

    const sesionesDelDia = sesionesFisicasViables.filter(s => s.dia === diaNombre);
    if (sesionesDelDia.length === 0) return;

    // Crear mapa de minutos de 14:00 (840) a 19:00 (1140)
    for (let min = 840; min <= 1140; min++) {
      let callesEnUso = 0;
      const sesionesInvolucradas = [];

      sesionesDelDia.forEach(s => {
        if (!s.horario) return;
        const partes = s.horario.split('-');
        if (partes.length !== 2) return;
        const [h1, m1] = partes[0].split(':').map(Number);
        const [h2, m2] = partes[1].split(':').map(Number);
        const startMin = h1 * 60 + (m1 || 0);
        const endMin = h2 * 60 + (m2 || 0);

        if (min >= startMin && min < endMin) {
          callesEnUso += (s.callesNecesarias || 1);
          sesionesInvolucradas.push(s);
        }
      });

      if (callesEnUso > totalCallesPermitidas) {
        // Encontrar intervalo del conflicto
        const hInicioStr = `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
        const conflictoExistente = conflictos.find(c => c.dia === diaNombre && c.intervaloEndMin === min);

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
            actividades: Array.from(new Set(sesionesInvolucradas.map(s => s.nombreSegmento || s.nombreActividad)))
          });
        }
      }
    }
  });

  return conflictos;
}

/**
 * MOTOR DE SIMULACIÓN VIRTUAL BIDIRECCIONAL (+1 / -1)
 * Permite añadir y retirar virtualmente alumnos reales sin tocar Firestore
 */
function simularCambioAlumnos(alumnosReales = [], simulacionAjustes = {}, catalog = [], mesIndex = 0, anio = 2024) {
  let alumnosProcesados = [...alumnosReales];

  Object.keys(simulacionAjustes).forEach(simKey => {
    const delta = simulacionAjustes[simKey] || 0;
    if (delta === 0) return;

    // simKey formato: "actId___segmentoId___opcionDias" o "actId___opcionDias"
    const partes = simKey.split('___');
    let actId = partes[0];
    let segmentoId = null;
    let opcionDias = null;

    if (partes.length >= 3) {
      segmentoId = partes[1];
      opcionDias = partes.slice(2).join('___');
    } else {
      opcionDias = partes.slice(1).join('___');
    }

    const actDoc = catalog.find(a => a.id === actId);
    const opDoc = (actDoc?.opciones || []).find(o => o.dias === opcionDias);

    if (delta < 0) {
      // Retirar virtualmente alumnos reales confirmados que coincidan
      const aRetirarCount = Math.abs(delta);
      let retirados = 0;

      alumnosProcesados = alumnosProcesados.filter(al => {
        if (retirados >= aRetirarCount) return true;
        
        const alAct = al.actividadId || (catalog.find(a => a.nombre === al.actividad)?.id);
        const alDias = al.opcionDias || al.dias;
        const alSeg = obtenerSegmentoFisico(alAct, al.curso, catalog);

        const coincideAct = alAct === actId;
        const coincideDias = alDias === opcionDias;
        const coincideSeg = !segmentoId || alSeg === segmentoId;

        const clasificacion = clasificarAlumnoParaMes(
          al,
          mesIndex,
          anio,
          catalog
        );
        const esConfirmado = clasificacion.categoria === 'ingreso_confirmado';

        if (coincideAct && coincideDias && coincideSeg && esConfirmado) {
          retirados++;
          return false; // se retira virtualmente
        }
        return true;
      });

    } else if (delta > 0) {
      // Añadir virtualmente alumnos confirmados válidos
      const cursoRepresentativo = (segmentoId === 'primaria_1615_4a6') ? '4PRI' : (actDoc?.cursos?.[0] || '1PRI');
      const mesStr = String(mesIndex + 1).padStart(2, '0');

      for (let i = 0; i < delta; i++) {
        alumnosProcesados.push({
          id: `sim_virtual_${simKey}_${i}_${Date.now()}`,
          nombre: `Alumno Simulado ${i + 1}`,
          actividadId: actId,
          actividad: actDoc?.nombre,
          opcionDias: opcionDias,
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

/**
 * ORQUESTADOR PRINCIPAL: Realiza todo el cálculo de rentabilidad en MILICÉNTIMOS ENTEROS
 */
function calcularRentabilidadMensual({
  alumnos = [],
  mesIndex = 9, // 0-11
  anio = 2024,
  festivos = [],
  tarifaMonitorBase = 10,
  tarifaSocorristaBase = 10,
  tarifaCoordinadorBase = 14.5,
  ivaPersonal = 21,
  totalCallesPermitidas = 4,
  catalog = []
}) {
  // 1. Tarifas con IVA en milicéntimos sin redondeo intermedio
  // 1 Euro = 100.000 milicéntimos. Coordinador 14.5 * 1.21 * 100000 = 1.754.500 mc exactos.
  const factorIva = 1 + (ivaPersonal / 100);
  const tarifaMonitorConIvaMc = Math.round(tarifaMonitorBase * factorIva * 100000);
  const tarifaSocorristaConIvaMc = Math.round(tarifaSocorristaBase * factorIva * 100000);
  const tarifaCoordinadorConIvaMc = Math.round(tarifaCoordinadorBase * factorIva * 100000);

  // 2. Días operativos del mes
  const { totalDiasOperativos, conteoPorDia } = contarDiasOperativos(mesIndex, anio, festivos);

  // 3. Coberturas fijas (Socorrista y Coordinador)
  const { totalHorasSocorrista } = calcularCoberturaSocorrista(conteoPorDia, tarifaSocorristaConIvaMc);
  const { totalHorasCoordinador } = calcularCoberturaCoordinador(totalDiasOperativos, tarifaCoordinadorConIvaMc);

  // 4. Construir catálogo de sesiones físicas
  const sesionesFisicas = construirSesionesFisicas(catalog);

  // 5. Clasificar alumnos
  const alumnosConfirmadosUnicos = new Set();
  const ingresosContabilizados = new Set();
  const alumnosPotenciales = [];
  const alumnosListaEspera = [];
  const pendientesDeRevisar = [];

  let ingresoConfirmadoTotalMc = 0;
  let ingresoPotencialTotalMc = 0;

  const inscripcionesPorSesion = {};
  sesionesFisicas.forEach(s => {
    inscripcionesPorSesion[s.key] = { confirmados: [], potenciales: [] };
  });

  (alumnos || []).forEach(alumno => {
    const resClass = clasificarAlumnoParaMes(alumno, mesIndex, anio, catalog);
    const docId = alumno.id || `${alumno.nombre || 'alumno'}_${alumno.curso || 'curso'}`;

    if (resClass.categoria === 'ingreso_confirmado') {
      if (ingresosContabilizados.has(docId)) {
        pendientesDeRevisar.push({
          alumno: { id: docId, curso: alumno.curso, actividad: alumno.actividad },
          motivo: "Inscripción duplicada en el cálculo"
        });
        return;
      }

      const diasAlumno = extraerDiasSemana(resClass.textoDias);
      const segmentoId = obtenerSegmentoFisico(resClass.actividadId, alumno.curso, catalog);

      const sesionesDelAlumno = sesionesFisicas.filter(s => 
        s.actividadId === resClass.actividadId &&
        s.segmentoId === segmentoId &&
        diasAlumno.includes(s.dia) &&
        (!resClass.horario || s.horario === resClass.horario)
      );

      if (sesionesDelAlumno.length === 0) {
        pendientesDeRevisar.push({
          alumno: { id: docId, curso: alumno.curso, actividad: alumno.actividad },
          motivo: "La inscripción no coincide con ninguna sesión física del catálogo"
        });
        return;
      }

      ingresosContabilizados.add(docId);
      alumnosConfirmadosUnicos.add(docId);
      ingresoConfirmadoTotalMc += resClass.precioMc;

      let totalPonderacion = 0;
      sesionesDelAlumno.forEach(s => {
        const apariciones = conteoPorDia[s.dia] || 0;
        totalPonderacion += (s.duracionMinutos * apariciones);
      });

      let acumCuotaMc = 0;
      sesionesDelAlumno.forEach((s, idx) => {
        const esUltima = (idx === sesionesDelAlumno.length - 1);
        const apariciones = conteoPorDia[s.dia] || 0;
        const ponderacion = (s.duracionMinutos * apariciones);

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
      ingresoPotencialTotalMc += (resClass.precioMc || 0);

      const diasAlumno = extraerDiasSemana(resClass.textoDias);
      const segmentoId = obtenerSegmentoFisico(resClass.actividadId, alumno.curso, catalog);

      const sesionesDelAlumno = sesionesFisicas.filter(s => 
        s.actividadId === resClass.actividadId &&
        s.segmentoId === segmentoId &&
        diasAlumno.includes(s.dia) &&
        (!resClass.horario || s.horario === resClass.horario)
      );

      sesionesDelAlumno.forEach(s => {
        inscripcionesPorSesion[s.key].potenciales.push(alumno);
      });

    } else if (resClass.categoria === 'lista_espera') {
      alumnosListaEspera.push(alumno);
    } else if (resClass.categoria === 'pendiente_revisar') {
      pendientesDeRevisar.push({ alumno, motivo: resClass.motivo });
    }
  });

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

  diasNombres.forEach(diaNombre => {
    if ((conteoPorDia[diaNombre] || 0) === 0) return;

    const viablesDia = resultadoSesiones.filter(s => s.dia === diaNombre && s.esViable);
    if (viablesDia.length === 0) return;

    const sesionesConT = viablesDia.map(s => {
      const { startMin, endMin } = parseHorarioMinutos(s.horario);
      return { ...s, startMin, endMin };
    });

    const puntosSet = new Set();
    sesionesConT.forEach(s => {
      if (s.endMin > s.startMin) {
        puntosSet.add(s.startMin);
        puntosSet.add(s.endMin);
      }
    });

    const puntos = Array.from(puntosSet).sort((a, b) => a - b);

    for (let i = 0; i < puntos.length - 1; i++) {
      const t1 = puntos[i];
      const t2 = puntos[i + 1];

      const sesionesActivas = sesionesConT.filter(s => s.startMin <= t1 && s.endMin >= t2);

      if (sesionesActivas.length > 0) {
        const callesOcupadas = sesionesActivas.reduce((acc, s) => acc + (s.callesNecesarias || 1), 0);
        const monitoresNecesarios = sesionesActivas.reduce((acc, s) => acc + (s.monitoresNecesarios || 0), 0);
        const nombresGrupos = Array.from(new Set(sesionesActivas.map(s => s.nombreSegmento || s.nombreActividad)));

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

  // 6. Evaluar viabilidad de sesiones físicas y calcular costes de monitores
  let costeMonitoresTotalMc = 0;
  let sesionesViablesCount = 0;
  let sesionesEnFormacionCount = 0;
  let sesionesNoSalenCount = 0;

  const resultadoSesiones = sesionesFisicas.map(s => {
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

    const esViable = (estado === 'Viable' || estado === 'Completo' || estado === 'Exceso de aforo');

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

  // 7. Reparto de costes compartidos (Socorrista y Coordinador) por día operativo según minutosCalle viables
  let costeFijoSinActividadMc = 0;
  let costeTotalSocorristaMc = 0;
  let costeTotalCoordinadorMc = 0;

  const diasNombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  diasNombres.forEach(diaNombre => {
    const numDias = conteoPorDia[diaNombre] || 0;
    if (numDias === 0) return;

    const horasSocorristaPorDia = diaNombre === 'viernes' ? 3.75 : 3.0;
    const costeSocorristaDiaTotalMc = Math.round(numDias * horasSocorristaPorDia * tarifaSocorristaConIvaMc);
    const costeCoordinadorDiaTotalMc = Math.round(numDias * 1 * tarifaCoordinadorConIvaMc);

    costeTotalSocorristaMc += costeSocorristaDiaTotalMc;
    costeTotalCoordinadorMc += costeCoordinadorDiaTotalMc;

    const viablesDelDia = resultadoSesiones.filter(s => s.dia === diaNombre && s.esViable);

    let totalMinutosCalleDia = 0;
    viablesDelDia.forEach(s => {
      totalMinutosCalleDia += (s.duracionMinutos * s.callesNecesarias * s.aparicionesMes);
    });

    if (totalMinutosCalleDia > 0) {
      let socorristaAsignadoAcum = 0;
      let coordinadorAsignadoAcum = 0;

      viablesDelDia.forEach((s, idx) => {
        const esUltima = (idx === viablesDelDia.length - 1);
        const minutosCalleSesion = (s.duracionMinutos * s.callesNecesarias * s.aparicionesMes);

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
      costeFijoSinActividadMc += (costeSocorristaDiaTotalMc + costeCoordinadorDiaTotalMc);
    }
  });

  // Convertir milicéntimos a céntimos enteros para resultados visibles
  resultadoSesiones.forEach(s => {
    s.costeTotalMc = s.costeMonitorMc + s.costeSocorristaMc + s.costeCoordinadorMc;
    s.resultadoOperativoMc = s.ingresoOperativoMc - s.costeTotalMc;
    s.margenPorcentaje = s.ingresoOperativoMc > 0 ? Math.round((s.resultadoOperativoMc / s.ingresoOperativoMc) * 100) : 0;

    // Campos en céntimos para UI
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
  const conciliacionIngresosCorrecta = (diferenciaConciliacionIngresosMc === 0) &&
    (ingresoOperativoTotalMc + ingresoPendienteAperturaTotalMc === ingresoAtribuidoTotalMc);

  const costeTotalPersonalMc = costeMonitoresTotalMc + costeTotalSocorristaMc + costeTotalCoordinadorMc;
  const resultadoOperativoConfirmadoMc = ingresoOperativoTotalMc - costeTotalPersonalMc;
  const resultadoOperativoPotencialMc = (ingresoOperativoTotalMc + ingresoPotencialTotalMc) - costeTotalPersonalMc;
  const margenConfirmadoPorcentaje = ingresoOperativoTotalMc > 0 ? Math.round((resultadoOperativoConfirmadoMc / ingresoOperativoTotalMc) * 100) : 0;

  const sesionesViables = resultadoSesiones.filter(s => s.esViable);
  const conflictosCalles = detectarConflictosCalles(sesionesViables, conteoPorDia, totalCallesPermitidas);
  const { franjasMonitores, maximoMonitoresSimultaneos } = calcularFranjasMonitores(resultadoSesiones, conteoPorDia);

  return {
    mesIndex,
    anio,
    totalDiasOperativos,
    conteoPorDia,

    // Tarifas con IVA en mc y céntimos
    tarifaMonitorConIvaMc,
    tarifaSocorristaConIvaMc,
    tarifaCoordinadorConIvaMc,
    tarifaMonitorConIvaCentimos: Math.round(tarifaMonitorConIvaMc / 1000),
    tarifaSocorristaConIvaCentimos: Math.round(tarifaSocorristaConIvaMc / 1000),
    tarifaCoordinadorConIvaCentimos: Math.round(tarifaCoordinadorConIvaMc / 1000),

    // Conteos
    alumnosConfirmadosCount: alumnosConfirmadosUnicos.size,
    alumnosPotencialesCount: alumnosPotenciales.length,
    alumnosListaEsperaCount: alumnosListaEspera.length,
    pendientesDeRevisarCount: pendientesDeRevisar.length,
    pendientesDeRevisar,

    // Ingresos en milicéntimos y céntimos
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

    // Costes en milicéntimos y céntimos
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

    // Resultados
    resultadoOperativoConfirmadoMc,
    resultadoOperativoPotencialMc,
    resultadoOperativoConfirmadoCentimos: Math.round(resultadoOperativoConfirmadoMc / 1000),
    resultadoOperativoPotencialCentimos: Math.round(resultadoOperativoPotencialMc / 1000),
    margenConfirmadoPorcentaje,

    // Sesiones, Franjas y Conflictos
    sesionesViablesCount,
    sesionesEnFormacionCount,
    sesionesNoSalenCount,
    resultadoSesiones,
    conflictosCalles,
    franjasMonitores,
    maximoMonitoresSimultaneos
  };
}

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
  
  const [tab, setTab] = useState('global');
  const [busqueda, setBusqueda] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroRadar, setFiltroRadar] = useState(null);
  const [nuevoAviso, setNuevoAviso] = useState('');
  
  const [newStaff, setNewStaff] = useState({ email: '', password: '', role: 'profe' });
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
const datosMonitor = equipo.find(m => m.email === emailNormalizado);
const soyMonitor = datosMonitor?.rol === 'monitor';
  // --- 🔔 SISTEMA DE NOTIFICACIONES PUSH (CEREBRO) ---
  const solicitarPermisoNotificaciones = async () => {
    if (!("Notification" in window)) {
      showToast("Este navegador no soporta notificaciones de escritorio.", "warning");
      return;
    }
    const permiso = await Notification.requestPermission();
    if (permiso === "granted") {
      new Notification("🚀 ¡Sistema Activado!", {
        body: "Ahora recibirás avisos importantes de la piscina en este dispositivo.",
        icon: "https://cdn-icons-png.flaticon.com/512/5822/5822050.png" 
      });
    }
  };

  const enviarPushLocal = (titulo, mensaje) => {
    if (Notification.permission === "granted") {
      new Notification(titulo, {
        body: mensaje,
        icon: "https://cdn-icons-png.flaticon.com/512/5822/5822050.png"
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
const opcionesTraslado = (actividadTraslado?.opciones || []).filter(o =>
  actividadTraslado.cursos.includes(alumnoTraslado?.curso) &&
  !(o.dias === alumnoTraslado?.dias && o.horario === alumnoTraslado?.horario) &&
  (actividadTraslado.id !== 'chapoteo' ||
    (o.horario === alumnoTraslado?.horario && o.precio === alumnoTraslado?.precio))
);
const destinoTraslado = opcionesTraslado.find((_, index) => String(index) === opcionTraslado);

const confirmarTraslado = async () => {
  if (!puedeGestionarTodo || trasladoEnCurso || !alumnoTraslado || !actividadTraslado || !destinoTraslado) return;
  const padreId = alumnoTraslado.parentId || alumnoTraslado.user;
  const emailDestino = padres[padreId]?.email || padres[padreId]?.emailContacto ||
    padres[padreId]?.emailPagador || alumnoTraslado.emailContacto ||
    alumnoTraslado.emailPagador || alumnoTraslado.email;
  if (!emailDestino) return showToast('Falta un correo de contacto. No se ha cambiado el grupo.', 'error');
  const anterior = `${alumnoTraslado.dias} ${alumnoTraslado.horario}`;
  if (!window.confirm(`¿Trasladar a ${alumnoTraslado.nombre}?\n\nDe: ${anterior}\nA: ${destinoTraslado.dias} ${destinoTraslado.horario}\nCuota: ${alumnoTraslado.precio} → ${destinoTraslado.precio}\n\nSe avisará a ${emailDestino}.`)) return;
  setTrasladoEnCurso(true);
  try {
    const resultado = await trasladarGrupoAtomico({
      alumnoId: alumnoTraslado.id,
      actividadId: actividadTraslado.id,
      opcion: destinoTraslado,
      origenEsperado: { dias: alumnoTraslado.dias, horario: alumnoTraslado.horario, precio: alumnoTraslado.precio }
    });
    setTrasladoId(null);
    setOpcionTraslado('');
    let avisoSolicitado = false;
    try {
      await enviarAvisoTraslado(emailDestino, resultado.nombre, actividadTraslado.nombre, resultado.anterior, resultado.nuevo);
      avisoSolicitado = true;
    } catch (error) {
      console.error('El traslado se guardó, pero falló la solicitud de correo:', error);
    }
    try {
      await addDoc(collection(db, 'logs'), {
        fecha: Date.now(), alumnoId: alumnoTraslado.id, alumnoNombre: resultado.nombre,
        accion: 'CAMBIO_GRUPO',
        detalles: `${actividadTraslado.nombre}: ${resultado.anterior} → ${resultado.nuevo}. Correo solicitado: ${avisoSolicitado ? 'sí' : 'no'}`,
        adminEmail: emailNormalizado
      });
    } catch (error) { console.error('No se pudo registrar el traslado en logs:', error); }
    showToast(avisoSolicitado
      ? 'Grupo cambiado. Se ha solicitado el correo de confirmación.'
      : `Grupo cambiado, pero NO se pudo solicitar el correo a ${emailDestino}. Contacta con la familia.`,
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

    // 3. 🚀 NUEVO: Radar de Equipo (Monitores y Coordinadores)
    // Solo se activa si el usuario tiene permisos de gestión
    let unsubEquipo = () => {};
    if (puedeGestionarTodo) {
      unsubEquipo = onSnapshot(query(collection(db, 'equipo'), orderBy('nombre', 'asc')), (s) => {
        setEquipo(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error("Error en equipo:", error);
        showToast("Error al cargar equipo: " + error.message, "error");
      });
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
  }, [puedeGestionarTodo]); // 🚩 IMPORTANTE: Añadimos esto para que se refresque si cambian los permisos
// 🏊‍♂️ FILTRO DE ALUMNOS PARA EL MONITOR (NUEVO)
  // ---------------------------------------------------------
  const alumnosAsignados = alumnos.filter(alumno => {
    if (!soyMonitor) return false; // Si no es monitor, la lista está vacía
    const susGrupos = datosMonitor?.gruposAsignados || [];
    return susGrupos.includes(alumno.actividad) && alumno.estado === 'inscrito';
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
      const mesActual = hoy.getMonth() + 1; // 1-12
      const esPeriodoReserva = mesActual >= 6 && mesActual <= 9;
      const academicInfo = getDynamicAcademicYear();
      let fechaParaDB = "";

      // 1. 🛡️ COMPROBACIÓN DE TEMPORADA (Si hoy es periodo de reserva de junio a septiembre)
      if (esPeriodoReserva) {
        fechaParaDB = academicInfo.isoStartDate; // Modo Reserva: Todo al estreno del curso
      } 
      // 2. 🏊‍♂️ MODO CURSO ACTIVO (Si ya es Octubre a Mayo)
      else {
        const diaActual = hoy.getDate();
        const añoActual = hoy.getFullYear();
        const preferencia = String(alumno.inicioDeseado || 'proximo').toLowerCase();

        if (diaActual > 20 || preferencia.includes('prox')) {
          let mSig = mesActual + 1; let aSig = añoActual;
          if (mSig > 12) { mSig = 1; aSig++; }
          fechaParaDB = `${aSig}-${String(mSig).padStart(2, '0')}-01`;
        } else {
          fechaParaDB = hoy.toISOString().split('T')[0];
        }
      }

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
  
  // Construimos una tabla HTML sencilla y compacta para la impresión
  const filas = datos.map((a, i) => `
    <tr style="border-bottom: 1px solid #e2e8f0; height: 32px;">
      <td style="padding: 6px 10px; text-align: center; font-size: 11px; font-weight: bold; color: #475569; border-right: 1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding: 6px 12px; font-size: 12px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">${a.nombre}</td>
      <td style="padding: 6px 12px; font-size: 10px; font-weight: 600; color: #475569; text-transform: uppercase; border-right: 1px solid #e2e8f0;">${a.curso}</td>
      ${Array(4).fill('<td style="border-right: 1px solid #cbd5e1; width: 45px;"></td>').join('')} 
    </tr>
  `).join('');

  ventana.document.write(`
    <html>
      <head>
        <title>Lista de Asistencia - ${infoGrupo.nombre}</title>
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
          <div>Grupo: <strong style="color: #1e3a8a; text-transform: uppercase;">${infoGrupo.nombre}</strong></div>
          <div>Día de Clase: <strong style="color: #1e3a8a; text-transform: uppercase;">${infoGrupo.dia}</strong></div>
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
// --- 🚩 PASO 1: LÓGICA DE FECHAS DE ALTA (BLINDADA) ---
const obtenerInfoAlta = () => {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  
  // 1. Datos Mes Actual
  const mesActualNom = hoy.toLocaleString('es-ES', { month: 'long' });
  const fechaTecnicaHoy = hoy.toISOString().split('T')[0];

  // 2. Datos Mes Siguiente (Calculado de forma segura)
  const proximoMesDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  const mesSiguienteNom = proximoMesDate.toLocaleString('es-ES', { month: 'long' });
  const fechaTecnicaProximoMes = proximoMesDate.toISOString().split('T')[0];

  const mesActualNum = hoy.getMonth() + 1; // 1-12
  const esPeriodoReserva = mesActualNum >= 6 && mesActualNum <= 9;

  return {
    esPeriodoReserva,
    diaCortePasado: diaActual > 20,
    mesActual: mesActualNom,
    mesSiguiente: mesSiguienteNom,
    fechaInicioSiguiente: `1 de ${mesSiguienteNom}`,
    // 🚩 CLAVE: Devolvemos ya las fechas listas para Firebase
    tecnicaHoy: fechaTecnicaHoy,
    tecnicaProximoMes: fechaTecnicaProximoMes
  };
};
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

  // --- 📅 2. LÓGICA DE FECHAS ÚNICA Y BLINDADA ---
  const info = obtenerInfoAlta();
  const hoy = new Date();
  let fechaParaDB = "";
  let textoInicioReal = "";

  if (info.esPeriodoReserva) {
      const academicInfo = getDynamicAcademicYear();
      fechaParaDB = academicInfo.isoStartDate;
      textoInicioReal = `Inicio de Curso (${academicInfo.formattedStartDate})`;
  } else if (info.diaCortePasado) {
      // CASO A: Día 21 al 31 -> Siempre 1 del mes que viene
      const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      fechaParaDB = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}-01`;
      textoInicioReal = info.fechaInicioSiguiente;
  } else {
      // CASO B: Día 1 al 20
      if (alumno.inicioDeseado === 'inmediato') {
          fechaParaDB = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
          textoInicioReal = `Inmediato (Mes de ${info.mesActual})`;
      } else {
          const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
          fechaParaDB = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}-01`;
          textoInicioReal = info.fechaInicioSiguiente;
      }
  }

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
              await addDoc(collection(db, 'mail'), {
                  to: [emailDestino],
                  message: {
                      subject: `📉 Confirmación de Baja: ${alumno.nombre}`,
                      html: `
                          <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 15px; max-width: 600px;">
                              <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-top: 0;">
                                 🏊 Tramitación de Baja Efectiva
                              </h2>
                              <p>Hola familia de <strong>${alumno.nombre}</strong>,</p>
                              <p>Te escribimos para confirmarte que hemos procesado correctamente la solicitud de baja en la actividad de natación extraescolar.</p>

                              <div style="background: #FEF2F2; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid #FCA5A5;">
                                  <p style="margin: 0; color: #991B1B; font-weight: bold;">📍 Detalles del Trámite:</p>
                                  <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Alumno:</strong> ${alumno.nombre}</p>
                                  <p style="margin: 5px 0 0 0; font-size: 16px; color: #b91c1c;"><strong>📅 Fecha de efecto:</strong> ${fechaFormateada}</p>
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
  // PEGA ESTO EN EL HUECO:
  const handleCrearStaff = async (e) => { 
    e.preventDefault(); 
    
    // 1. Comprobamos que eres admin
    if (userRole !== 'admin') return showToast("⛔ Solo coordinadores pueden crear usuarios.", "error");
    
    setLoadingStaff(true); 
    try { 
        // 2. Crea el usuario (Email + Contraseña)
        // La sesión principal conserva los permisos de administración.
        const credencial = await createUserWithEmailAndPassword(secondaryAuth, newStaff.email, newStaff.password);
        
        // 3. Guarda el Rol (Profe/Admin) en la base de datos
        await setDoc(doc(db, 'users', credencial.user.uid), {
            email: newStaff.email,
            role: newStaff.role,
            createdAt: new Date().toISOString()
        });
        await signOut(secondaryAuth);

        showToast(`✅ Usuario ${newStaff.email} creado. Cierra sesión y entra como Admin.`, "success");
        setNewStaff({ email: '', password: '', role: 'profe' }); 

    } catch (error) { 
        console.error(error);
        showToast("❌ Error: " + error.message, "error"); 
    } finally { 
        setLoadingStaff(false); 
    } 
};
  const borrarMiembroEquipo = async (miembro) => {
    if (miembro.email === emailNormalizado) return showToast("No puedes borrarte a ti mismo", "warning");
    if (confirm(`¿Borrar a ${miembro.nombre || miembro.email} del equipo?`)) {
      try {
        await deleteDoc(doc(db, 'equipo', miembro.id));
        
        const q = query(collection(db, 'users'), where('email', '==', miembro.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          await deleteDoc(doc(db, 'users', querySnapshot.docs[0].id));
        }
        
        showToast("✅ Miembro eliminado del equipo con éxito.", "success");
      } catch (err) {
        showToast("❌ Error al eliminar: " + err.message, "error");
      }
    }
  };
  
  const descargarExcel = () => {
    // 1. Cabeceras
    let cabecera = [];
    if (soySuperAdmin) {
      cabecera = ['Alumno,Curso,Letra,Tipo,Actividad,Días,Horario,Fecha Alta,Precio,Pagador,DNI Pagador,Email Pagador,CP,Población,Dirección,IBAN,Telefono\n'];
    } else {
      cabecera = ['Alumno,Curso,Letra,Tipo,Actividad,Días,Horario,Fecha Alta\n'];
    }
    
    // 2. Mapeo de datos con CÁLCULO DE PRECIO REAL
    const filas = listadoGlobal.map(a => {
      const p = padres[a.parentId] || {}; 
      
      const nombre = (a.nombre || '').replace(new RegExp('"', 'g'), '""');
      const actividad = (a.actividad || '-').replace(new RegExp('"', 'g'), '""');
      const dias = (a.dias || '-').replace(new RegExp('"', 'g'), '""');
      const horario = (a.horario || '-').replace(new RegExp('"', 'g'), '""');
      const fAlta = (a.fechaAlta || '-').replace(new RegExp('"', 'g'), '""');
      const tipoAlumno = (p.tipo === 'externo') ? 'EXTERNO' : 'INTERNO';

      // 💰 LÓGICA DE PRECIO INTELIGENTE PARA EL EXCEL
      let precioFinal = '0';
      if (a.precio && parseInt(a.precio) > 0) {
        precioFinal = a.precio;
      } else {
        // Si es 0 o está vacío, buscamos en el catálogo de actividades
        const actividadMatch = OFERTA_ACTIVIDADES.find(act => 
          act.nombre === a.actividad || act.id === a.actividadId
        );
        if (actividadMatch) {
          const opcionMatch = actividadMatch.opciones?.find(op => op.dias === a.dias);
          precioFinal = opcionMatch ? opcionMatch.precio : actividadMatch.precioResumen;
        }
      }
      // Limpiamos el símbolo € por si acaso para que en el Excel sea un número puro
      precioFinal = String(precioFinal).replace('€', '').trim();

      if (soySuperAdmin) {
        const pagador = (p.nombrePagador || '').replace(new RegExp('"', 'g'), '""');
        const iban = (p.iban || '').replace(new RegExp('"', 'g'), '""');
        const direccion = (p.direccion || '').replace(new RegExp('"', 'g'), '""');
        const tel = p.telefono1 || '';
        const dni = (p.dniPagador || '').replace(new RegExp('"', 'g'), '""');
        const mail = (p.email || '').replace(new RegExp('"', 'g'), '""');
        const cp = (p.cp || '').replace(new RegExp('"', 'g'), '""');
        const pob = (p.poblacion || '').replace(new RegExp('"', 'g'), '""');

        return `"${nombre}","${a.curso}","${a.letra}","${tipoAlumno}","${actividad}","${dias}","${horario}","${fAlta}","${precioFinal}","${pagador}","${dni}","${mail}","${cp}","${pob}","${direccion}","${iban}","${tel}"`;
      } else {
        return `"${nombre}","${a.curso}","${a.letra}","${tipoAlumno}","${actividad}","${dias}","${horario}","${fAlta}"`;
      }
    });

    // 3. Generación del archivo
    const link = document.createElement("a"); 
    link.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURI(cabecera + filas.join("\n")); 
    
    const nombreArchivo = soySuperAdmin ? "listado_PAGOS_completo.csv" : "listado_asistencia_profes.csv";
    link.download = nombreArchivo; 
    link.click();
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
// --- 📈 LÓGICA DE PREVISIÓN INTELIGENTE (REPARADA) ---
const hoyD = new Date();
const mesActualNum = hoyD.getMonth() + 1; 

// 🎯 DETECTOR DE TEMPORADA: De Marzo a Septiembre, la previsión SIEMPRE mira a Octubre
const esTemporadaReserva = mesActualNum >= 3 && mesActualNum <= 9;

let mesSigNom = "";
let patronMesSig = "";

if (esTemporadaReserva) {
    // 🚀 MODO RESERVA: Forzamos la vista al estreno del curso
    mesSigNom = "octubre";
    patronMesSig = getDynamicAcademicYear().rawPattern;
} else {
    // 🏊 MODO CURSO: Lógica normal de mes siguiente
    const proximoMesDate = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 1);
    mesSigNom = proximoMesDate.toLocaleString('es-ES', { month: 'long' });
    const añoRef = proximoMesDate.getFullYear();
    const mesRef = String(proximoMesDate.getMonth() + 1).padStart(2, '0');
    patronMesSig = `${añoRef}-${mesRef}`;
}

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
    <div className="min-h-screen bg-gray-100 p-6 font-sans relative">
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
      {userRole === 'admin' && (
        <button 
          onClick={descargarExcel} 
          className="flex-1 md:flex-none bg-green-600 text-white px-3 py-2 md:py-1 rounded text-xs font-bold shadow-sm hover:bg-green-700 transition-colors uppercase whitespace-nowrap"
        >
          Excel
        </button>
      )}
      {/* 🔔 BOTÓN DE NOTIFICACIONES (NUEVO) */}
      <button 
        onClick={solicitarPermisoNotificaciones}
        className={`p-2 rounded-full transition-all shadow-sm flex items-center justify-center border ${
          Notification.permission === 'granted' 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
            : 'bg-amber-50 text-amber-600 border-amber-200 animate-bounce'
        }`}
        title="Activar avisos en este equipo"
      >
        <span className="text-sm">{Notification.permission === 'granted' ? '🔔' : '🔕'}</span>
      </button>

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
  {['global', 'ocupacion', 'pruebas', 'espera', 'prevision', 'bajas', 'rentabilidad', 'equipo', 'avisos'].map(t => {
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
  {t === 'mis_clases' && '🏊‍♂️'}
</span>
            
<span>
  {t === 'ocupacion' ? 'PLAZAS' : 
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
            {/* 🚩 CAMBIO CLAVE: Si hoy es antes de Octubre, forzamos el nombre a Octubre */}
            {new Date() < new Date(`${getDynamicAcademicYear().startYear}-10-01`) 
              ? 'PREVISIÓN OCTUBRE' 
              : new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleString('es-ES', { month: 'long' })}
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
                    const hoy = new Date();
                    const academicInfo = getDynamicAcademicYear();
                    const fechaAlu = (a.fechaAlta || a.fechaInscripcion || "").toString();
                    const esAltaOctubre = fechaAlu.includes(academicInfo.rawPattern);

                    if (vistaMes === 'actual') {
                      // VISTA ABRIL: Solo inscritos actuales. EXCLUIMOS a los de Octubre.
                      return (a.estado === 'inscrito' || a.estado === 'baja_pendiente') && !esAltaOctubre;
                    } else {
                      // VISTA OCTUBRE (PREVISIÓN):
                      if (hoy < new Date(academicInfo.isoStartDate)) {
                        // Si estamos en pre-inscripción: Contamos los que están (y no son baja) + los de Octubre
                        if (a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada') return false;
                        return a.estado === 'inscrito' || esAltaOctubre;
                      } else {
                        // Si ya pasamos Octubre: Lógica de mes siguiente normal
                        const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
                        const mesSiguienteISO = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
                        if (a.estado === 'baja_pendiente') return false;
                        return a.estado === 'inscrito' || fechaAlu.includes(mesSiguienteISO);
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
                              >Cambiar grupo</button>
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
      alert("Introduce una fecha válida");
      return;
    }
    if (fAnio !== anioRentabilidad || fMes !== mesRentabilidad) {
      alert("El festivo debe pertenecer al mes y año seleccionados");
      return;
    }
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      alert("Solo se pueden añadir festivos entre Lunes y Viernes");
      return;
    }
    if (festivosRentabilidad.includes(nuevoFestivoInput)) {
      alert("El festivo ya está registrado");
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
    const nombre = e.target.nombre.value;
    const email = e.target.email.value.toLowerCase().trim();
    const password = e.target.password.value; // 👈 Capturamos la clave que tú inventes
    
    if(!nombre || !email || !password) return showToast("⚠️ ¡Ups! Falta información. Nombre, email y clave son obligatorios.", "warning");
    if(password.length < 6) return showToast("⚠️ La contraseña debe tener al menos 6 caracteres.", "warning");

    try {
      await addDoc(collection(db, 'equipo'), {
        nombre,
        email,
        password, // 👈 Se guarda en la ficha del monitor
        rol: 'monitor',
        gruposAsignados: [],
        fechaAlta: new Date().toISOString(),
        creadoPor: emailNormalizado
      });
      showToast(`✅ ¡Monitor creado! Email: ${email}`, "success");
      e.target.reset();
    } catch (err) {
      showToast("❌ Error al guardar: " + err.message, "error");
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
      <input name="password" type="text" className="w-full border-2 border-gray-50 p-3 rounded-xl bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all" placeholder="Escribe una clave" />
    </div>
    <button type="submit" className="bg-blue-600 text-white p-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95">
      Crear Monitor
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
              <div className="flex-1 flex flex-wrap gap-1.5 justify-start">
                {miembro.gruposAsignados?.length > 0 ? (
                  miembro.gruposAsignados.map(g => (
                    <span key={g} className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-md border border-blue-100 uppercase">
                      {g}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-gray-300 italic">Sin clases asignadas</span>
                )}
                
                <button 
                  onClick={() => {
                    const grupo = prompt("Escribe el nombre del grupo para este monitor (Ej: Primaria 16:15 L-M):");
                    if (grupo) {
                      const actuales = miembro.gruposAsignados || [];
                      updateDoc(doc(db, 'equipo', miembro.id), { gruposAsignados: [...actuales, grupo] });
                    }
                  }}
                  className="text-[9px] font-black text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-md border border-dashed border-blue-200 transition-colors"
                >
                  + ASIGNAR GRUPO
                </button>
              </div>

              <button 
                onClick={() => borrarMiembroEquipo(miembro)} 
                className="text-gray-300 hover:text-red-500 transition-colors p-2 text-xl"
                title="Eliminar del equipo"
              >
                🗑️
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
          // Filtramos los alumnos que tienen esta actividad asignada
          const alumnosDelGrupo = alumnos.filter(a => a.actividad === nombreGrupo && a.estado === 'inscrito');

          return (
            <div key={nombreGrupo} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-left">
              <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-black text-blue-900 uppercase text-xs tracking-widest">
                  {nombreGrupo}
                </h3>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full">
                  {alumnosDelGrupo.length} ALUMNOS
                </span>
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
            <h2 id="titulo-traslado" className="text-xl font-bold text-blue-900">Cambiar grupo</h2>
            {alumnoTraslado?.estado === 'inscrito' && actividadTraslado ? <>
              <p className="mt-3 font-semibold">{alumnoTraslado.nombre}</p>
              <p className="text-sm text-gray-600">{actividadTraslado.nombre}</p>
              <p className="mt-3 text-sm">Actual: <strong>{alumnoTraslado.dias} · {alumnoTraslado.horario}</strong> ({alumnoTraslado.precio})</p>
              <label htmlFor="destino-traslado" className="block mt-5 mb-2 text-sm font-bold">Nuevo grupo</label>
              <select id="destino-traslado" value={opcionTraslado} onChange={e => setOpcionTraslado(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white">
                <option value="">Selecciona una opción</option>
                {opcionesTraslado.map((op, index) => <option key={`${op.dias}-${op.horario}`} value={index}>
                  {op.dias} · {op.horario} · {op.precio}
                </option>)}
              </select>
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
          
{/* 1. FECHAS (BLOQUE REPARADO Y SIN ENGAÑOS) */}
<div className="bg-gray-100 p-4 rounded border border-gray-300 grid grid-cols-2 gap-4 shadow-inner">
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">📅 Fecha de Alta Real</label>
        <input 
          type="date" 
          defaultValue={alumno.fechaAlta || ""} 
          disabled={userRole !== 'admin'}
          onChange={(e) => {
            cambiarFecha('fechaAlta', e);
            // 🚩 Truco: Si cambias la fecha a mano, esto ayuda a que se guarde
          }}
          className={`w-full p-2 rounded border font-bold ${userRole === 'admin' ? 'bg-white border-blue-400' : 'bg-gray-200'}`}
        />
        {/* 🚩 CAMBIO: Usamos una condición más sólida */}
        {(!alumno.fechaAlta || alumno.fechaAlta === "") && (
          <p className="text-[9px] text-red-600 font-black mt-1 uppercase">
            ⚠️ SIN FECHA (Saldrá en el mes anterior)
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

  // 👇 1. FUNCIÓN NUEVA: CANCELAR SOLICITUD (Borrado rápido)
  const cancelarSolicitud = async (hijo) => {
    if (!window.confirm(`⚠️ ¿Cancelar la solicitud de ${hijo.nombre}?\n\nAl no estar inscrito todavía, se borrará la reserva inmediatamente y podrás empezar de cero.`)) return;

    try {
        await liberarPlazaAtomica({ alumnoId: hijo.id, datosFinales: {
            estado: 'sin_inscripcion',
            actividad: null,
            dias: null,
            horario: null,
            precio: null,
            citaId: null,
            citaNivel: null,
            citaFecha: null,
            citaHora: null,
            fechaInscripcion: null,
            aceptaNormas: false,
            autorizaFotos: false,
            fechaAlta: null,
            fechaBaja: null,
            grupo: null,
            revisadoAdmin: null
        }});
        showToast('✅ Solicitud cancelada correctamente.', 'success');
    } catch (e) {
        showToast('Error al cancelar: ' + e.message, 'error');
    }
  };

  // 👇 2. FUNCIÓN DE SIEMPRE: GESTIONAR BAJA (Trámite administrativo)
  const gestionarBaja = async (hijo) => {
    // Si por error llama a esto un 'sin_inscripcion', lo borramos directo
    if (hijo.estado === 'sin_inscripcion') {
        if (window.confirm(`🗑️ ¿Eliminar perfil de ${hijo.nombre}?`)) {
            await deleteDoc(doc(db, 'students', hijo.id));
        }
        return;
    }

    const academicInfo = getDynamicAcademicYear();
    const hoy = new Date();
    // Límite de baja libre para el curso: 25 de Septiembre del año de inicio
    const fechaLimiteLibre = new Date(academicInfo.startYear, 8, 25); // 8 = Septiembre

    const esBajaLibre = hoy < fechaLimiteLibre;

    if (esBajaLibre) {
      // BAJA DIRECTA AUTOMÁTICA (ANTES DEL 25 DE SEPTIEMBRE)
      if (window.confirm(`⚠️ ¿Deseas cancelar la inscripción de ${hijo.nombre}?\n\nAl no haber comenzado el curso escolar todavía (inicia el ${academicInfo.formattedStartDate}), la inscripción se cancelará inmediatamente y sin ningún coste.`)) {
        try {
          await liberarPlazaAtomica({ alumnoId: hijo.id, datosFinales: {
            estado: 'sin_inscripcion',
            actividad: null, dias: null, horario: null, precio: null,
            citaId: null, citaNivel: null, citaFecha: null, citaHora: null,
            fechaInscripcion: null, aceptaNormas: false, autorizaFotos: false,
            fechaAlta: null, fechaBaja: null, grupo: null, revisadoAdmin: null
          }});

          // Encolar email de confirmación de cancelación directa
          if (user?.email) {
            await addDoc(collection(db, 'mail'), {
              to: [user.email],
              message: {
                subject: `❌ Inscripción Cancelada: ${hijo.nombre}`,
                html: `
                  <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 15px; max-width: 600px;">
                    <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-top: 0;">
                       🏊 Inscripción Cancelada (Antes del Curso)
                    </h2>
                    <p>Hola familia de <strong>${hijo.nombre}</strong>,</p>
                    <p>Te confirmamos que se ha cancelado correctamente tu reserva de plaza en la actividad de natación extraescolar antes del inicio del curso.</p>
                    <p>Al no haber comenzado la actividad escolar (inicio el ${academicInfo.formattedStartDate}), este trámite no conlleva **ningún tipo de coste ni cargo**.</p>
                    <p>Saludos,<br><strong>Coordinación de Extraescolares CSB</strong></p>
                  </div>
                `
              }
            });
          }
          showToast('✅ Inscripción cancelada y plaza liberada.', 'success');
        } catch (e) {
          showToast('Error al cancelar: ' + e.message, 'error');
        }
      }
      return;
    }

    // SI YA ES 25 DE SEPTIEMBRE O DESPUÉS, ENTRA LA REGLA NORMAL DE CADA MES
    const diaActual = hoy.getDate();

    // Bloqueo después del día 25
    if (diaActual > 25) {
        return showToast('⛔ PLAZO CERRADO. Las bajas para el mes siguiente deben tramitarse antes del día 25.', 'error');
    }

    // Tramitación de Baja estándar
    if (window.confirm(`⚠️ ¿Solicitar BAJA de ${hijo.nombre}?\n\nℹ️ AVISO: Al ser día ${diaActual}, se cobrará el mes en curso completo. La baja será efectiva el último día de este mes.`)) {
      await updateDoc(doc(db, 'students', hijo.id), {
        estado: 'baja_pendiente',
        fechaSolicitudBaja: new Date().toISOString()
      });

      // 📧 Encolar email de solicitud de baja recibida
      if (user?.email) {
        try {
          await addDoc(collection(db, 'mail'), {
            to: [user.email],
            message: {
              subject: `📉 Solicitud de Baja Recibida: ${hijo.nombre}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 15px; max-width: 600px;">
                  <h2 style="color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 10px; margin-top: 0;">
                     🏊 Solicitud de Baja Registrada
                  </h2>
                  <p>Hola familia de <strong>${hijo.nombre}</strong>,</p>
                  <p>Hemos recibido correctamente tu solicitud de baja para la actividad de natación extraescolar.</p>
                  
                  <div style="background: #FFF7ED; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid #FED7AA;">
                    <p style="margin: 0; color: #C2410C; font-weight: bold;">📍 Detalles de la Solicitud:</p>
                    <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Alumno:</strong> ${hijo.nombre}</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;"><strong>Estado:</strong> Baja Pendiente (Tramitando)</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;"><strong>ℹ️ Nota:</strong> Tu plaza se mantendrá activa hasta final de mes y la baja se hará efectiva antes del día 1 del próximo mes.</p>
                  </div>

                  <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                    Si no has realizado esta solicitud o deseas reactivar la plaza, por favor ponte en contacto con la coordinación lo antes posible.
                  </p>
                  <p style="margin-top: 25px;">Saludos,<br><strong>Coordinación de Extraescolares CSB</strong></p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                  <p style="font-size: 11px; color: #999;">Este es un mensaje automático generado por el sistema de gestión de piscina.</p>
                </div>
              `
            }
          });
        } catch (mailError) {
          console.error("Error al encolar email de solicitud de baja:", mailError);
        }
      }

      showToast('✅ Solicitud de baja registrada. Tu plaza se mantendrá activa hasta final de mes.', 'success');
    }
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
                {hijo.estado === 'inscrito' && estaAdmitido && (
                    <button onClick={() => gestionarBaja(hijo)} className="w-full bg-white text-red-600 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">
                        Tramitar Baja
                    </button>
                )}

                {/* 2. SI ESTÁ INSCRITO PERO PENDIENTE -> CANCELAR (Borrado simple) */}
                {hijo.estado === 'inscrito' && !estaAdmitido && (
                    <button onClick={() => cancelarSolicitud(hijo)} className="w-full bg-white text-red-500 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">
                        ✖️ Cancelar Solicitud
                    </button>
                )}

                {/* 3. INSCRIBIR (Nuevos o Bajas Finalizadas) */}
                {estaLibre && (
                  <div className="flex w-full gap-2">
                    <button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">
                        Inscribir
                    </button>
                    {hijo.estado === 'sin_inscripcion' && (
                        <button onClick={() => gestionarBaja(hijo)} className="bg-white text-red-500 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">🗑️</button>
                    )}
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
    // 🚩 AÑADE ESTO AQUÍ: Es el valor por defecto
    inicioDeseado: 'proximo' 
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
  // 🚩 LÓGICA DE TEMPORADA (MARZO-SEPTIEMBRE = SOLO OCTUBRE)
  const infoAlta = (() => {
    const hoy = new Date();
    const dia = hoy.getDate();
    const mesActualNum = hoy.getMonth() + 1; // Marzo es 3
    
    // 🎯 REGLA DE ORO: Si el mes es menor a 10 (estamos en Marzo, Mayo, Sept...),
    // bloqueamos el alta inmediata y solo dejamos "Octubre".
    const esPeriodoReserva = mesActualNum < 10;

    if (esPeriodoReserva) {
      return { 
        diaCortePasado: true, // Esto oculta el botón de "Empezar Hoy"
        mesActual: hoy.toLocaleString('es-ES', { month: 'long' }),
        sigMes: "octubre" // Forzamos que el texto del botón sea Octubre
      };
    }

    // SI YA ES OCTUBRE, NOVIEMBRE O DICIEMBRE: Lógica normal
    return { 
      diaCortePasado: dia > 20, 
      mesActual: hoy.toLocaleString('es-ES', { month: 'long' }), 
      sigMes: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toLocaleString('es-ES', { month: 'long' })
    };
  })();



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

    // 🚩 CÁLCULO DE FECHA BLINDADO POR TEMPORADA (REVISADO)
    const hoyParaCalculo = new Date();
    const diaActual = hoyParaCalculo.getDate();
    const mesActualNum = hoyParaCalculo.getMonth() + 1; 
    const inicioDeseado = datosAlumno.inicioDeseado || 'proximo';

    let fechaFinalISO;

    // REGLA: De Junio a Septiembre siempre es 1 de Octubre del próximo curso
    if (mesActualNum >= 6 && mesActualNum <= 9) {
        const academicInfo = getDynamicAcademicYear();
        fechaFinalISO = new Date(`${academicInfo.isoStartDate}T12:00:00.000Z`).toISOString();
    } else {
        // Temporada activa (Octubre-Mayo)
        if (inicioDeseado === 'inmediato' && diaActual <= 20) {
            fechaFinalISO = hoyParaCalculo.toISOString();
        } else {
            const proximoMes = new Date(hoyParaCalculo.getFullYear(), hoyParaCalculo.getMonth() + 1, 1, 12, 0, 0);
            fechaFinalISO = proximoMes.toISOString();
        }
    }

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
            ¿Cuándo quieres comenzar?
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
            <span className={`text-[10px] font-bold mb-1 ${datosAlumno.inicioDeseado === 'proximo' ? 'text-blue-600' : 'text-gray-400'}`}>OPCIÓN RECOMENDADA</span>
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

  // 3. CONSULTAR AFORO
  useEffect(() => {
    if (!fecha) return;
    const consultarAforo = async () => {
      try {
        const q = query(collection(db, 'students'), 
          where('estado', '==', 'prueba_reservada'),
          where('citaFecha', '==', fecha)
        );
        const snap = await getDocs(q);
        const counts = {};
        snap.forEach(d => {
          const h = d.data().citaHora;
          if (h) counts[h] = (counts[h] || 0) + 1;
        });
        setOcupacion(counts);
      } catch (e) { console.error("Error:", e); }
    };
    consultarAforo();
  }, [fecha]);

// 4. FUNCIÓN GUARDAR RESERVA (BLINDAJE TOTAL OCTUBRE)
const confirmarReserva = async () => {
  if (!fecha || !hora) return showToast("⚠️ Selecciona un lunes y una hora.", "warning");
  
  const citaTexto = `${fecha.split('-').reverse().join('/')} a las ${hora}`;
  if (citaTexto.includes('undefined') || !citaTexto) return showToast("⚠️ Error al generar la cita.", "error");

  setLoading(true);
  try {
    const alumnoRef = doc(db, 'students', alumno.id);
    
    // 🎯 LA FECHA DE ORO: 1 de Octubre (Formato ISO puro sin horas de hoy)
    const academicInfo = getDynamicAcademicYear();
    const fechaFijaOctubre = `${academicInfo.isoStartDate}T08:00:00.000Z`;
    const soloFechaOctubre = academicInfo.isoStartDate;

    await updateDoc(alumnoRef, {
      estado: 'prueba_reservada',
      citaNivel: citaTexto, 
      citaFecha: fecha,
      citaHora: hora,

      // 🚩 LIMPIEZA DE SEGURIDAD:
      // Borramos estos campos para que el Panel Familiar NO muestre "Inscrito" todavía.
      fechaAlta: null,
      fechaSolicitud: null,
      fecha_alta: null,
      
      actividad: alumno.actividad || '', 
      actividadId: alumno.actividadId || '',
      dias: alumno.dias || '',
      horario: alumno.horario || '',
      
      // 🎯 Solo dejamos anotada la preferencia para cuando el Admin acepte
      inicioDeseado: academicInfo.isoStartDate, 
      mesInicio: 'octubre',
      
      grupo: (alumno.dias && alumno.horario) ? `${alumno.dias} ${alumno.horario}` : ''
    });

    if (user?.email) {
      enviarEmailConfirmacion(user.email, alumno.nombre, citaTexto, 'cita')
        .catch(e => console.error(e));
    }

    close(); 

    // ... justo después del close() ...

    setTimeout(() => {
      // 🚩 CAMBIAMOS EL MENSAJE PARA NO DAR FALSAS ESPERANZAS
      showToast(`✅ ¡CITA RESERVADA! Prueba de nivel: ${citaTexto}`, "success");
    }, 300);

  } catch (e) {
    console.error("Error crítico en reserva:", e);
    showToast("❌ Hubo un error al guardar.", "error");
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
                    const estaLleno = ocupados >= 2;
                    return (
                      <button
                        key={f}
                        type="button"
                        disabled={estaLleno}
                        onClick={() => setHora(f)}
                        className={`p-2 rounded-xl text-xs font-bold border-2 transition-all ${
                          estaLleno ? 'bg-gray-100 text-gray-300 border-gray-100' : 
                          hora === f ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md' : 
                          'bg-white text-blue-600 border-blue-50 hover:border-blue-500'
                        }`}
                      >
                        {f}
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
    const emailFinal = regData.tipo === 'externo' ? regData.emailPagador : regData.emailContacto;
    if (!emailFinal) return showToast("⚠️ Falta el email para crear tu cuenta.", "error");

    // 3. Validaciones Específicas
    if (regData.tipo === 'externo') {
      if (!regData.nombrePagador) return showToast('⚠️ Falta: Nombre del Pagador', "warning");
      if (!regData.dniPagador) return showToast('⚠️ Falta: DNI del Pagador', "warning");
      
      const ibanLimpio = (regData.iban || '').replace(/\s/g, '');
      const ibanRegex = /^ES\d{22}$/;
      if (!ibanRegex.test(ibanLimpio)) return showToast('⚠️ IBAN Inválido: Debe empezar por ES y tener 22 números después.', "error");
    
      const tel1 = regData.telefono1 ? String(regData.telefono1).trim() : "";
      if (tel1.length < 9) return showToast("⛔ El teléfono debe tener 9 cifras", "warning");
      
      if (!regData.direccion) return showToast("⚠️ Falta: Dirección", "warning");
      if (!regData.cp) return showToast("⚠️ Falta: Código Postal", "warning");
      if (!regData.iban) return showToast("⚠️ Falta: IBAN Bancario", "warning");
    } else {
      // VALIDACIÓN REGISTRO INTERNO
      if (!regData.personaContacto) return showToast("⚠️ Falta: Nombre de la persona de contacto", "warning");
      
      const telInterno = regData.telefono1 ? String(regData.telefono1).trim() : ""; 
      if (telInterno && telInterno.length < 9) {
          return showToast("⛔ El teléfono debe tener 9 cifras", "warning");
      }
    }

    try {
      const emailFinal = regData.tipo === 'externo' ? regData.emailPagador : regData.emailContacto;

      // A. Crear en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, emailFinal, regData.password);
      
      // B. Guardar Usuario (Padre/Pagador)
      await setDoc(doc(db, 'users', cred.user.uid), { 
        email: emailFinal, 
        role: 'user', 
        tipo: regData.tipo,
        telefono1: regData.telefono1 || '', 
        telefono2: regData.telefono2 || '',
        aceptaPrivacidad: true,
        fechaAceptacionPrivacidad: new Date().toISOString(),
        
        // 🚩 ESTO ES LO QUE ARREGLA EL NOMBRE EN LA FICHA:
        nombre: regData.tipo === 'externo' ? regData.nombrePagador : regData.personaContacto,
        personaContacto: regData.personaContacto || '',
        
        ...(regData.tipo === 'externo' ? {
            nombrePagador: regData.nombrePagador, 
            dniPagador: regData.dniPagador, 
            dni: regData.dniPagador, // 👈 También guardamos el DNI aquí
            direccion: regData.direccion, 
            cp: regData.cp, 
            poblacion: regData.poblacion,
            iban: regData.iban
        } : {
            emailContacto: regData.emailContacto 
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
    const email = loginData.email?.toLowerCase().trim();
    const pass = loginData.password;

    if (!email || !pass) return showToast("⚠️ Escribe tu email y contraseña", "warning");

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        
        // 1. REGLA PARA TUS MONITORES (CORREGIDA PARA EVITAR CRASH)
        try {
          const q = query(collection(db, 'equipo'), where('email', '==', email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const miembroDoc = querySnapshot.docs[0];
            const miembroData = miembroDoc.data();
            
            if (miembroData.password === pass) {
              const cred = await createUserWithEmailAndPassword(auth, email, pass);
              // Asignar rol de monitor en la colección users al crearse la cuenta
              await setDoc(doc(db, 'users', cred.user.uid), {
                email: email,
                role: 'monitor',
                createdAt: new Date().toISOString()
              });
              return;
            }
          }
        } catch (dbErr) {
          console.error("Error al verificar credenciales de equipo:", dbErr);
        }

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
// 🎙️ COMPONENTE ASISTENTE DE VOZ CSB (CASTELLANO es-ES)
// ==========================================
function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'bot',
      text: '¡Hola! 👋 Soy el Asistente de Voz de la Piscina del Colegio San Buenaventura. Pregúntame sobre horarios, precios, normativa, vestuarios o pruebas de nivel.'
    }
  ]);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const [voicesList, setVoicesList] = useState([]);

  // Cargar lista de voces del navegador de forma asíncrona (onvoiceschanged)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const cargarVoces = () => {
        const voices = window.speechSynthesis.getVoices();
        setVoicesList(voices);
      };
      cargarVoces();
      window.speechSynthesis.onvoiceschanged = cargarVoces;
    }
  }, []);

  // Auto-scroll al último mensaje
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, open]);

  // Inicializar motor de reconocimiento en castellano (es-ES)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = 'es-ES';
        rec.continuous = false;
        rec.interimResults = true;

        rec.onstart = () => {
          setListening(true);
          setTranscript('');
        };

        rec.onresult = (event) => {
          let current = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
          if (event.results[0] && event.results[0].isFinal) {
            handleUserQuery(current);
          }
        };

        rec.onerror = (event) => {
          console.warn('Error en reconocimiento de voz:', event.error);
          setListening(false);
        };

        rec.onend = () => {
          setListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  // Función para sintetizar voz humana y fluida en castellano neutro
  const speakText = (text) => {
    if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    // Cancelar emisiones anteriores
    window.speechSynthesis.cancel();

    // Limpiar emojis, bullets y markdown para una lectura hablada humana y fluida
    const textoLimpio = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/•/g, '. ')
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(textoLimpio);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95; // Ritmo ligeramente más pausado y cálido para evitar el efecto robótico
    utterance.pitch = 1.0;

    // ALGORITMO DE SELECCIÓN DE VOZ NATURAL / NEURAL HUMANA EN CASTELLANO:
    const voices = voicesList.length > 0 ? voicesList : window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));

    // 1. Prioridad Máxima: Voces Neurales / Naturales (Microsoft Edge, Chrome HD, Apple Enhanced)
    const vozNatural = spanishVoices.find(v => 
      (v.lang === 'es-ES' || v.lang === 'es_ES') && 
      (v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('Online') || v.name.includes('Neural') || v.name.includes('Alvaro') || v.name.includes('Elvira') || v.name.includes('Google') || v.name.includes('Monica') || v.name.includes('Jorge') || v.name.includes('Helena'))
    ) || spanishVoices.find(v => v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('Online') || v.name.includes('Neural'))
      || spanishVoices.find(v => v.lang === 'es-ES' || v.lang === 'es_ES')
      || spanishVoices[0];

    if (vozNatural) {
      utterance.voice = vozNatural;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Reconocimiento ya activo:', err);
      }
    } else {
      if (typeof globalShowToast === 'function') {
        globalShowToast('⚠️ Tu navegador no soporta entrada de voz directa. Puedes escribir en el chat.', 'warning');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  // Motor del Conocimiento y Respuestas en Castellano
  const responderPregunta = (query) => {
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. AQUAGYM
    if (q.includes('aquagym') || q.includes('agua gym') || q.includes('gimnasia acuatic')) {
      return "💧 **Aquagym (+16 años)**:\n• Horarios: Lunes y Miércoles o Martes y Jueves de 17:30 a 18:15.\n• Precios: Pack 2 días a 50€/mes o 1 día suelto a 37€/mes.\n• No requiere prueba de nivel previa.";
    }

    // 2. HORARIOS GENERALES Y ACTIVIDADES
    if (q.includes('horario') || q.includes('dias') || q.includes('turnos') || q.includes('cuando')) {
      if (q.includes('chapoteo') || q.includes('infantil') || q.includes('peque')) {
        return "👶 **Chapoteo (Infantil 3-5 años)**:\nDe Lunes a Viernes a las 16:00 (duración 45 min). Mínimo 2 días a la semana.";
      }
      if (q.includes('primaria')) {
        return "🏊 **Natación Primaria**:\n• Turno salida del cole: 16:15 a 17:15.\n• Turno de tarde: 17:30 a 18:00 (30 min). Packs L/X o M/J, o días sueltos.";
      }
      if (q.includes('waterpolo')) {
        return "🤽‍♂️ **Waterpolo (3º-6º Primaria)**:\nDe Lunes a Viernes de 17:30 a 18:30 (1 hora). Pack 2 días a 60€/mes o 1 día suelto a 45€/mes.";
      }
      if (q.includes('eso') || q.includes('bach') || q.includes('adolescent')) {
        return "🎓 **ESO y Bachillerato**:\nLunes y Miércoles de 18:30 a 19:00 o Viernes al mediodía de 14:15 a 15:00.";
      }
      if (q.includes('adulto')) {
        return "👨‍👩‍👧 **Adultos**:\nLunes, Miércoles y Viernes a las 18:00 o Martes y Jueves a las 18:30.";
      }
      if (q.includes('nado libre') || q.includes('libre')) {
        return "⏱️ **Nado Libre Independiente**:\nDe Lunes a Viernes de 18:30 a 19:00. 35€/mes pack 2 días o 25€/mes 1 día suelto.";
      }
      return "📅 **Resumen de Horarios principales**:\n• Chapoteo: 16:00h\n• Primaria: 16:15h y 17:30h\n• Waterpolo: 17:30h\n• Aquagym: 17:30h (L/X y M/J)\n• Adultos: 18:00h y 18:30h\n• ESO/Bach: 18:30h (Viernes 14:15h)\n¿De qué actividad deseas saber más?";
    }

    // 3. PRECIOS Y PRECIO SUELTO
    if (q.includes('precio') || q.includes('cuota') || q.includes('cuanto cuesta') || q.includes('vale') || q.includes('tarifa') || q.includes('descuento')) {
      return "💰 **Tarifas Oficiales de Piscina**:\n• **Packs de 2 días/semana**: 50€/mes (Aquagym, Adultos, Primaria tarde), 60€/mes (Waterpolo) o 65€/mes (Primaria 16:15).\n• **1 día suelto/semana**: 37€/mes (Aquagym, Adultos, Primaria) o 45€/mes (Waterpolo / Primaria 16:15).\nTodos los cobros son mensuales.";
    }

    // 4. NORMATIVA, EQUIPAMIENTO Y GORRO
    if (q.includes('gorro') || q.includes('chancla') || q.includes('ropa') || q.includes('llevar') || q.includes('material') || q.includes('norma') || q.includes('calzado') || q.includes('vestuar')) {
      if (q.includes('vestuar') || q.includes('padre') || q.includes('acceso') || q.includes('acompan')) {
        return "🚪 **Acceso a Vestuarios**:\nLas familias solo pueden acceder al vestuario para ayudar a cambiarse en **Chapoteo** e **Infantil/1º-3º Primaria**. En el resto de edades los alumnos acceden de forma autónoma.";
      }
      return "🧢 **Material y Normativa Obligatoria**:\n1. Gorro de natación (silicona o tela).\n2. Chancletas de agua de uso exclusivo para vestuarios.\n3. Bañador deportivo y toalla/albornoz.\n⛔ **Prohibido estricto**: Calzado de calle en la zona de playa de la piscina.";
    }

    // 5. PRUEBAS DE NIVEL
    if (q.includes('prueba') || q.includes('nivel') || q.includes('evalua') || q.includes('cita')) {
      return "🧪 **Pruebas de Nivel**:\n• **Obligatorias previa inscripción**: Primaria (1º-6º) y ESO/Bachillerato.\n• **No requieren prueba**: Chapoteo, Aquagym, Waterpolo, Adultos y Nado Libre.\nPuedes reservar tu cita de prueba de nivel directamente desde el botón azul del inicio.";
    }

    // 6. BAJAS Y RESERVAS
    if (q.includes('baja') || q.includes('cancelar') || q.includes('reserva') || q.includes('octubre')) {
      if (q.includes('baja') || q.includes('cancelar')) {
        return "📋 **Gestión de Bajas**:\nLas bajas deben tramitarse antes del **día 20 del mes anterior** desde el panel familiar de la web para no cargar el recibo del mes siguiente.";
      }
      return "📆 **Renovaciones de Octubre**:\nLas plazas confirmadas se mantienen reservadas automáticamente para el inicio de curso escolar el 1 de Octubre.";
    }

    // 7. CONTACTO Y UBICACIÓN
    if (q.includes('donde') || q.includes('direccion') || q.includes('ubicacion') || q.includes('colegio') || q.includes('contacto') || q.includes('telefono')) {
      return "📍 **Colegio San Buenaventura CSB**:\nCalle de El Greco, 16, 28011 Madrid. Las clases de natación se realizan en el vaso de la piscina cubierta del colegio.";
    }

    // RESUMEN POR DEFECTO
    return "😊 Puedo ayudarte con cualquier información de la piscina. ¿Te gustaría saber sobre **horarios**, **precios**, **normativa de gorros/chancletas** o **pruebas de nivel**?";
  };

  const handleUserQuery = (queryText) => {
    if (!queryText || !queryText.trim()) return;

    const userMessage = { sender: 'user', text: queryText.trim() };
    const botResponseText = responderPregunta(queryText);
    const botMessage = { sender: 'bot', text: botResponseText };

    setChatHistory((prev) => [...prev, userMessage, botMessage]);
    setInputText('');
    setTranscript('');

    // Emitir respuesta hablada en castellano
    speakText(botResponseText);
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      handleUserQuery(inputText);
    }
  };

  return (
    <>
      {/* 🎙️ BOTÓN FLOTANTE PRINCIPAL */}
      <div className="fixed bottom-6 right-6 z-[9998]">
        <button
          onClick={() => setOpen(!open)}
          className="group relative flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white font-extrabold text-sm shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20 backdrop-blur-xl"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-200"></span>
          </span>
          <span className="text-xl">🎙️</span>
          <span className="hidden sm:inline tracking-wide uppercase text-xs font-black">Asistente de Voz CSB</span>
        </button>
      </div>

      {/* 💬 MODAL VENTANA DEL ASISTENTE */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[9999] w-[92vw] sm:w-[420px] max-h-[80vh] flex flex-col rounded-3xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl shadow-cyan-950/80 backdrop-blur-2xl text-white overflow-hidden animate-fade-in-up">
          {/* CABECERA */}
          <div className="flex items-center justify-between p-4 px-5 border-b border-white/10 bg-gradient-to-r from-cyan-900/40 via-teal-900/40 to-slate-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-xl shadow-inner">
                🎙️
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Asistente de Voz CSB</h3>
                <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Castellano (es-ES) • En línea
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setVoiceMuted(!voiceMuted);
                  if (speaking) window.speechSynthesis.cancel();
                }}
                title={voiceMuted ? 'Activar respuesta por voz' : 'Silenciar voz'}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs transition-colors"
              >
                {voiceMuted ? '🔇' : '🔊'}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  if (speaking) window.speechSynthesis.cancel();
                  if (listening) stopListening();
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* CUERPO DEL CHAT */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[380px] text-xs">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl whitespace-pre-line leading-relaxed shadow-lg ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none font-medium'
                      : 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-bl-none font-normal'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* ONDAS Y ESTADO DE ESCUCHA */}
            {listening && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 animate-pulse">
                <span className="text-base animate-spin">🎙️</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider">Escuchando en castellano...</p>
                  <p className="text-[10px] text-cyan-200/80 italic">{transcript || 'Habla ahora...'}</p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* PILL SUGERENCIAS RÁPIDAS */}
          <div className="p-2.5 px-4 bg-slate-950/60 border-t border-white/5 flex gap-1.5 overflow-x-auto text-[10px] font-bold">
            <button
              onClick={() => handleUserQuery('Horarios de natación y aquagym')}
              className="px-2.5 py-1 rounded-full bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600 hover:text-white transition-all whitespace-nowrap"
            >
              🏊 Horarios
            </button>
            <button
              onClick={() => handleUserQuery('Precios y cuotas de piscina')}
              className="px-2.5 py-1 rounded-full bg-teal-900/40 border border-teal-500/30 text-teal-300 hover:bg-teal-600 hover:text-white transition-all whitespace-nowrap"
            >
              💰 Precios
            </button>
            <button
              onClick={() => handleUserQuery('Normativa de gorro y chancletas')}
              className="px-2.5 py-1 rounded-full bg-blue-900/40 border border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap"
            >
              🧢 Normativa
            </button>
            <button
              onClick={() => handleUserQuery('Pruebas de nivel requeridas')}
              className="px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white transition-all whitespace-nowrap"
            >
              🧪 Pruebas
            </button>
          </div>

          {/* FOOTER CON BOTÓN DE MICRÓFONO Y ENTRADA DE TEXTO */}
          <form onSubmit={handleSendText} className="p-3 border-t border-white/10 bg-slate-950 flex items-center gap-2">
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              className={`p-3 rounded-2xl flex items-center justify-center text-lg transition-all duration-300 shadow-lg ${
                listening
                  ? 'bg-rose-600 text-white animate-bounce shadow-rose-600/50'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
              }`}
              title={listening ? 'Detener micrófono' : 'Hablar por micrófono'}
            >
              🎙️
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Habla o escribe tu duda en castellano..."
              className="flex-1 bg-slate-800/80 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs disabled:opacity-40 transition-all"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}

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
      {view === 'landing' && <LandingPage setView={setView} />}
      {view === 'login' && <Login setView={setView} />}
      {view === 'dashboard' && <Dashboard user={user} misHijos={misHijos} logout={() => signOut(auth)} />}
      {view === 'admin' && <AdminDashboard userRole={userRole} userEmail={user?.email?.toLowerCase()} logout={() => signOut(auth)} />}
      <VoiceAssistant />
    </div>
  );
}
// ==========================================
// 🚀 PUNTO DE ENTRADA ÚNICO
// ==========================================
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

    // Inyectar Tipografía Outfit y Clases de Animación Premium en el DOM
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.innerHTML = `
      * {
        font-family: 'Outfit', sans-serif !important;
      }
      .glass-card {
        background: rgba(255, 255, 255, 0.75) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
      }
      .glass-card-dark {
        background: rgba(15, 23, 42, 0.7) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .animate-fade-in-up {
        animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(16px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </AuthProvider>
  );
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('🚀 Service Worker registrado con éxito'))
      .catch(err => console.error('❌ Error al registrar el Service Worker', err));
  });
}
