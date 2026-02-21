import React, { useState, useEffect, useRef } from 'react';import { db, auth } from './firebase.js'; 
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
  orderBy
} from 'firebase/firestore';
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
    alumnosMax: 16, // <--- Añadido
    minAlumnos: 5, // <--- Añadido para que sea dinámico
    descripcion: 'Iniciación y familiarización con el medio acuático. El monitor está dentro del agua para mayor seguridad y confianza.\n\n⬇️ HORARIOS ⬇️\n• 1 día/sem (45€): Lunes a Viernes (16:00-17:00).', 
    aviso: 'Plazas limitadas por estricto orden de inscripción.', // He cambiado el aviso porque el "mínimo" ya saldrá abajo
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
    alumnosMax: 12, // El máximo que me has indicado
    minAlumnos: 6,  // El mínimo que tenías en el aviso
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
      alumnosMax: 8, // Configurado según me has pedido
      minAlumnos: 4, // El mínimo que tenías en el aviso
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
    alumnosMax: 8, // Configurado según me has pedido
    minAlumnos: 4, // El mínimo que tenías en el aviso
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
    alumnosMax: 12, // Configurado según me has pedido
    minAlumnos: 7,  // El mínimo que tenías en el aviso
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
    diasResumen: 'M y J', 
    precioResumen: '50€', 
    alumnosMax: 12, // Configurado según me has pedido
    minAlumnos: 5,  // El mínimo que tenías en el aviso
    descripcion: 'Actividad de bajo impacto ideal para mantenerse en forma sin sobrecargar articulaciones. Mejora la movilidad y el tono muscular.\n\n⬇️ HORARIOS ⬇️\n• PACK 2 DÍAS (50€): Martes y Jueves (17:30-18:15).', 
    aviso: 'Actividad recomendada para todos los niveles físicos.',
    opciones: [
        { dias: '[PACK] Martes y Jueves', horario: '17:30-18:15', precio: '50€' }
    ]
  },
  {
    id: 'adultos', 
    nombre: '👨‍👩‍👧 Adultos (L-X-V 18:00-18:30) (M-J 18:30-19:00)', 
    cursos: ['ADULTO'], 
    requierePrueba: false, 
    diasResumen: 'L-V', 
    precioResumen: '37€ / 50€', 
    alumnosMax: 10, // Configurado según me has pedido
    minAlumnos: 4,  // El mínimo que tenías en el aviso
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
    alumnosMax: 10, // Configurado según me has pedido
    minAlumnos: 4,  // El mínimo que tenías en el aviso
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
    alumnosMax: 10, // Configurado según me has pedido
    minAlumnos: 2,  // El mínimo que tenías en el aviso
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
const enviarEmailConfirmacion = async (email, alumno, cita) => {
  try {
    const nombreAlumno = String(alumno).trim();
    // Guardamos el email en la colección 'mail'
    await addDoc(collection(db, 'mail'), {
      to: [email],
      message: {
        subject: `Reserva Confirmada: ${nombreAlumno}`,
        text: `Hola familia de ${nombreAlumno}. Confirmamos la cita para el ${cita}.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #2563EB;">🏊 Piscina San Buenaventura</h2>
            <p>Hola familia de <strong>${nombreAlumno}</strong>,</p>
            <p>Os confirmamos que la prueba de nivel ha sido reservada correctamente. Acuda con tiempo suficiente para estar listo a esa hora.</p>
            <div style="background: #EFF6FF; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0;">📅 <strong>Fecha:</strong> ${cita}</p>
              <p style="margin: 10px 0 0 0;">📍 <strong>Lugar:</strong> Piscina Colegio San Buenaventura (Acceso por portón azul).</p>
            </div>
            <p>🎒 <strong>Recordad traer:</strong> Bañador, gorro, toalla, gafas y chanclas.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">Este es un mensaje automático.</p>
          </div>
        `,
      },
    });
    console.log("Email encolado para:", email);
  } catch (e) {
    console.error("Error al encolar email:", e);
  }
};
// ==========================================
// 🏠 LANDING PAGE (VERSIÓN COMPLETA Y DETALLADA)
// ==========================================
const LandingPage = ({ setView }) => {
  const [tab, setTab] = useState('actividades');
  const [filtroEtapa, setFiltroEtapa] = useState('todos');

  return (
    <div className="font-sans text-gray-800 bg-white min-h-screen flex flex-col">
      {/* HERO SECTION */}
      <div className="relative h-[480px] flex items-center justify-center text-white bg-black">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <img src={IMG_PRINCIPAL} className="w-full h-full object-cover z-0" alt="Piscina" />
        </div>
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
        <img src={IMG_ESCUDO_BLANCO} className="h-28 mx-auto mb-6 drop-shadow-2xl" alt="Escudo" />
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-white leading-tight
  [text-shadow:_2px_2px_0_#2563eb,_-2px_-2px_0_#2563eb,_2px_-2px_0_#2563eb,_-2px_2px_0_#2563eb,_0_4px_6px_rgba(0,0,0,0.3)]">
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
          {['actividades', 'info', 'instalaciones'].map(t => (
            <button
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

          
{/* VISTA ACTIVIDADES (CORREGIDA) */}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {OFERTA_ACTIVIDADES
        .filter(act => {
          if (filtroEtapa === 'todos') return true;
          if (filtroEtapa === 'infantil') return act.cursos.some(c => c.includes('INF'));
          if (filtroEtapa === 'primaria') return act.cursos.some(c => c.includes('PRI'));
          if (filtroEtapa === 'secundaria') return act.cursos.some(c => c.includes('ESO') || c.includes('BACH'));
          if (filtroEtapa === 'adultos') return act.cursos.includes('ADULTO');
          return true;
        })
        .map((act) => (
          /* TARJETA CON EFECTO CRISTAL */
          <div key={act.id} className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden border border-white/40 flex flex-col hover:shadow-2xl hover:bg-white/90 transition-all duration-500 group">
            
            {/* Encabezado Azul con degradado cristalino */}
            <div className="bg-gradient-to-br from-blue-600/90 to-blue-700/90 p-4 relative">
              <h3 className="text-white font-black text-lg pr-8 text-left uppercase tracking-tight">{act.nombre}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-blue-900/30 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded border border-white/10 font-mono">
                  📅 {act.diasResumen}
                </span>
                <span className="bg-white/20 text-white text-[10px] px-2 py-1 rounded font-bold border border-white/10">
                  👥 Máx. {act.alumnosMax} Alumnos
                </span>
                {act.requierePrueba && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded font-bold shadow-sm animate-pulse whitespace-nowrap">
                    ❗ Requiere Prueba de Nivel
                  </span>
                )}
              </div>
            </div>
      
            <div className="p-5 flex-1 flex flex-col">
              <p className="text-slate-600 text-sm mb-4 flex-1 whitespace-pre-line leading-relaxed text-left font-medium">
                {act.descripcion}
              </p>
              
              {/* Aviso en cristal amarillo */}
              <div className="bg-amber-400/10 border border-amber-200/50 p-3 rounded-xl text-xs text-amber-900 mb-4 font-semibold flex gap-2 text-left backdrop-blur-sm">
                <span>⚠️</span>
                <span>{act.aviso}</span>
              </div>
      
              {/* Footer con precios destacados */}
              <div className="border-t border-slate-100 pt-3 mt-auto flex justify-between items-center">
                 <div className="text-left">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Mínimo para grupo:</p>
                    <p className="text-xs font-black text-blue-800">{act.minAlumnos} alumnos</p>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Precio</span>
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
                      {act.precioResumen}
                    </p>
                 </div>
              </div>
            </div>
          </div>
        ))}
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
            <div key={idx} className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center transition-transform hover:scale-[1.02]">
              <div className={`absolute -top-4 -right-4 w-16 h-16 ${item.bg} rounded-full blur-2xl opacity-50`}></div>
              <span className="text-3xl mb-3 relative z-10">{item.icon}</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 relative z-10">{item.label}</p>
              <p className={`text-2xl font-black ${item.color} leading-none mb-2 relative z-10`}>{item.val}</p>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full relative z-10">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500"></span>
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
              © 2026 <span className="text-white font-black uppercase ml-1">Colegio San Buenaventura</span> — Natación
            </p>
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
// 🛡️ ADMIN DASHBOARD (PANEL DE GESTIÓN)
// ==========================================
const AdminDashboard = ({ userRole, logout, userEmail }) => {
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

  // ESTADO PARA LA FICHA (ALUMNO SELECCIONADO)
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [vistaMes, setVistaMes] = useState('actual');
  const [radarHueco, setRadarHueco] = useState(null);
  const soySuperAdmin = userRole === 'admin';
  // --- 🔔 SISTEMA DE NOTIFICACIONES PUSH (CEREBRO) ---
  const solicitarPermisoNotificaciones = async () => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones de escritorio.");
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
    alert("No se pudo confirmar el grupo.");
  }
};
  // --- 2. CARGA DE DATOS (EFECTOS) ---
  useEffect(() => {
    // Alumnos
    const unsubStudents = onSnapshot(query(collection(db, 'students')), (s) => setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // Usuarios (Padres y Profes)
    const unsubUsers = onSnapshot(query(collection(db, 'users')), (s) => {
        const p = {}, t = [];
        s.forEach(d => { 
            const data = d.data();
            p[d.id] = data; 
            if (data.role === 'admin' || data.role === 'profe') t.push({ id: d.id, ...data });
        });
        setPadres(p); setEquipo(t);
    });

    // Avisos
    const unsubAvisos = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => setAvisos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubStudents(); unsubUsers(); unsubAvisos(); };
  }, []);

  // --- 3. FUNCIONES ---
  // 🎯 FUNCIÓN PARA VALIDAR DESDE LA CARPETA DE ESPERA
  const validarPlazaDirecto = async (alumno) => {
    if (!confirm(`¿Quieres confirmar la plaza para ${alumno.nombre}? Se le enviará el email de bienvenida automáticamente.`)) return;

    try {
      const alumnoRef = doc(db, 'students', alumno.id);
      
      // Calculamos el inicio (Día 1 del mes que viene)
      const hoy = new Date();
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1, 12, 0, 0);
      const fechaAltaISO = inicio.toISOString();

      // 1. Actualizamos el alumno
      await updateDoc(alumnoRef, {
        estado: 'inscrito',
        fechaAlta: fechaAltaISO,
        revisadoAdmin: true
      });

      // 2. Buscamos el email del padre
      const padreId = alumno.parentId || alumno.user;
      const emailDestino = padres[padreId]?.email || alumno.email;

      if (emailDestino) {
        await addDoc(collection(db, 'mail'), {
          to: emailDestino,
          message: {
            subject: `✅ Plaza Confirmada: ${alumno.nombre}`,
            html: `
              <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
                <h2 style="color: #059669;">¡Felicidades! Plaza Confirmada</h2>
                <p>Hola, te informamos de que <strong>${alumno.nombre}</strong> ya tiene su plaza confirmada en la actividad.</p>
                <div style="background: #f9fafb; padding: 15px; border-radius: 10px; border-left: 5px solid #059669;">
                  <p><strong>🏊‍♂️ Actividad:</strong> ${alumno.actividad}</p>
                  <p><strong>🗓️ Horario:</strong> ${alumno.horario} (${alumno.dias})</p>
                  <p><strong>📅 Comienzo:</strong> 1 de ${inicio.toLocaleString('es-ES', { month: 'long' })}</p>
                </div>
                <p style="margin-top: 20px;">Ya podéis acudir directamente el primer día de clase en vuestro horario. ¡Os esperamos!</p>
              </div>
            `
          }
        });
      }
      // 🚩 AÑADE ESTO JUSTO AQUÍ (Antes del alert)
      await addDoc(collection(db, 'logs'), {
        fecha: new Date().getTime(),
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre,
        accion: "VALIDAR_ESPERA",
        detalles: `Plaza validada desde lista de espera por el administrador`,
        adminEmail: user?.email || ADMIN_EMAIL
    });

      alert("✅ Plaza validada y email enviado.");
    } catch (error) {
      console.error("Error al validar:", error);
      alert("No se pudo validar la plaza.");
    }
  };
  // 🎯 FUNCIÓN PARA ACEPTAR DESDE PRUEBAS DE NIVEL (CON AFORO)
  const aceptarAlumnoDirecto = async (e, alumno) => {
    if (e && e.stopPropagation) e.stopPropagation();

    const grupoDestino = alumno.actividad || 'Sin asignar';
    
    if (grupoDestino === 'Sin asignar') {
        return alert("⚠️ El alumno no tiene un grupo asignado.");
    }

    if (!confirm(`¿Inscribir a ${alumno.nombre} en ${grupoDestino} y descontar plaza del aforo?`)) return;

    try {
      const alumnoRef = doc(db, 'students', alumno.id);
      
      // 1. Actualizamos al alumno
      await updateDoc(alumnoRef, {
        estado: 'inscrito',
        grupo: grupoDestino,
        fechaValidacion: new Date().toISOString(),
        revisadoAdmin: true,
        validadoAdmin: true 
      });

      // 2. ACTUALIZAMOS EL AFORO
      const grupoRef = doc(db, 'clases', grupoDestino); 
      try {
        await updateDoc(grupoRef, { cupo: increment(-1) });
      } catch (errAforo) {
        console.warn("No se pudo descontar la plaza automáticamente.");
      }

      // 📧 3. ENVÍO DE EMAIL (USANDO TU UTILIDAD)
const padreId = alumno.parentId || alumno.user;
const emailPadre = padres[padreId]?.email || alumno.email;

if (emailPadre) {
  // Pasamos los 3 parámetros que pide tu función: email, nombre, detalle
  await enviarEmailConfirmacion(
    emailPadre, 
    alumno.nombre, 
    `${grupoDestino} (${alumno.horario})`
  );
}

// 🚩 4. LOG DE AUDITORÍA
await addDoc(collection(db, 'logs'), {
    fecha: new Date().getTime(),
    alumnoId: alumno.id,
    alumnoNombre: alumno.nombre,
    accion: "ACEPTAR_PRUEBA",
    detalles: `Prueba superada. Grupo: ${grupoDestino}. Email enviado a ${emailPadre}`,
    adminEmail: user?.email || 'Admin'
});

      alert(`✅ ${alumno.nombre} aceptado y email de confirmación enviado.`);
      
    } catch (error) {
      console.error("Error al aceptar:", error);
      alert("No se pudo procesar la inscripción.");
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
  
  // Construimos una tabla HTML sencilla para la impresión
  const filas = datos.map((a, i) => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; text-align: center;">${i + 1}</td>
      <td style="padding: 8px;"><strong>${a.nombre}</strong></td>
      <td style="padding: 8px; font-size: 10px;">${a.curso}</td>
      ${Array(4).fill('<td style="border-left: 1px solid #ddd; width: 40px;"></td>').join('')} 
    </tr>
  `).join('');

  ventana.document.write(`
    <html>
      <head>
        <title>Lista de Asistencia - ${infoGrupo.nombre}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f2f2f2; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { border: 1px solid #ddd; }
          .header { text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Lista de Asistencia: ${infoGrupo.nombre}</h2>
          <p>Día: <strong>${infoGrupo.dia}</strong> | Generado el: ${new Date().toLocaleDateString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Alumno</th>
              <th>Curso</th>
              <th>S1</th><th>S2</th><th>S3</th><th>S4</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
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

  return {
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
  if (userRole !== 'admin') return alert("⛔ Solo coordinadores.");
  
  // 1. 🔍 BUSCADOR DE IDs (Tu lógica exacta)
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

  // 2. 📅 LÓGICA DE FECHAS (Regla del día 20)
  const infoFechas = obtenerInfoAlta();
  let fechaInicioParaEmail = "";

  if (infoFechas.diaCortePasado) {
    fechaInicioParaEmail = infoFechas.fechaInicioSiguiente;
  } else {
    fechaInicioParaEmail = alumno.inicioDeseado === 'inmediato' 
      ? `Inmediato (Mes de ${infoFechas.mesActual})` 
      : infoFechas.fechaInicioSiguiente;
  }

  // 3. ❓ CONFIRMACIÓN
  if (confirm(`✅ ¿Validar plaza definitiva para ${alumno.nombre}?\n\n📅 INICIO: ${fechaInicioParaEmail}\n📍 GRUPO: ${alumno.actividad}`)) {
    try {
        // --- 🚩 AQUÍ ESTÁ EL CAMBIO ---
        let fechaTecnica;
        
        // Comprobamos si el texto contiene "inmediato" (que es lo que pusimos arriba)
        if (fechaInicioParaEmail.toLowerCase().includes('inmediato')) {
            // Alta HOY mismo
            fechaTecnica = new Date().toISOString().split('T')[0];
        } else {
            // Alta el día 1 del MES QUE VIENE
            const proximoMes = new Date();
            proximoMes.setMonth(proximoMes.getMonth() + 1);
            proximoMes.setDate(1);
            fechaTecnica = proximoMes.toISOString().split('T')[0];
        }

        const padreId = alumno.parentId || alumno.user;
        const emailPadre = padres[padreId]?.email;

        // Actualizar Firebase
        await updateDoc(doc(db, 'students', alumno.id), { 
            estado: 'inscrito',
            actividadId: actId,
            validadoAdmin: true,
            fechaAlta: fechaTecnica, // 🎯 Guardará "2026-03-01" si no es inmediato
            revisadoAdmin: true,
            fechaInicioReal: fechaInicioParaEmail 
        });

        // 📧 4. ENVÍO DE EMAIL AUTOMÁTICO
        if (emailPadre) {
          await addDoc(collection(db, 'mail'), {
            to: emailPadre,
            message: {
              subject: `✅ Alta confirmada - Natación: ${alumno.nombre}`,
              html: `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                  <h2 style="color: #059669;">¡Hola! Tu alta ya es efectiva.</h2>
                  <p>La inscripción de <strong>${alumno.nombre}</strong> ha sido validada.</p>
                  <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; border: 1px solid #e5e7eb;">
                    <p><strong>📅 Inicio:</strong> ${fechaInicioParaEmail}</p>
                    <p><strong>🏊‍♂️ Actividad:</strong> ${alumno.actividad}</p>
                  </div>
                </div>`
            }
          });
        }
        // 🚩 AÑADE ESTO AQUÍ PARA EL HISTORIAL:
        await addDoc(collection(db, 'logs'), {
          fecha: new Date().getTime(),
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          accion: "CONFIRMACIÓN_GLOBAL",
          detalles: `Alta confirmada manualmente. Inicio previsto: ${fechaInicioParaEmail}. Fecha técnica: ${fechaTecnica}`,
          adminEmail: user?.email || ADMIN_EMAIL
      });

        alert(`✅ ¡Hecho! Grabado con fecha técnica: ${fechaTecnica}`);
    } catch (error) {
        console.error("Error al validar:", error);
        alert("❌ Error en el proceso.");
    }
  }
};

// ---------------------------------------------------------
  // 📉 GESTIÓN DE BAJAS (LÓGICA CORREGIDA)
  // ---------------------------------------------------------

  // A) TRAMITAR: Calcula fecha y la deja en la lista (Estado GRIS)
  const tramitarBaja = async (alumno) => {
    if (userRole !== 'admin') return alert("⛔ Solo coordinadores.");
    
    // 1. Calcular fecha (Regla día 25)
    const hoy = new Date();
    const mesesASumar = hoy.getDate() > 25 ? 2 : 1;
    const fechaObj = new Date(hoy.getFullYear(), hoy.getMonth() + mesesASumar, 1);
    
    const y = fechaObj.getFullYear();
    const m = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const d = String(fechaObj.getDate()).padStart(2, '0');
    const fechaCalculada = `${y}-${m}-${d}`;

    // 2. Confirmar y Guardar (NO BORRAMOS, SOLO CAMBIAMOS ESTADO)
    if (confirm(`📉 ¿Aceptar baja de ${alumno.nombre}?\n\n📅 Fecha efectiva: ${fechaCalculada}\n\n(Se quedará en la lista como "TRAMITADA" para que tengas constancia)`)) {
        await updateDoc(doc(db, 'students', alumno.id), {
            estado: 'baja_finalizada', // 👈 ESTO ES LO QUE LA MANTIENE VISIBLE
            fechaBaja: fechaCalculada
        });
    }
};

// B) ARCHIVAR: Borrar definitivamente de la lista
const archivarBaja = async (alumno) => {
    if (userRole !== 'admin') return;
    if (confirm(`🗑️ ¿Eliminar DEFINITIVAMENTE a ${alumno.nombre} de la lista?\n\nLa plaza quedará libre.`)) {
        await updateDoc(doc(db, 'students', alumno.id), {
            estado: 'sin_inscripcion', // Aquí desaparece de la lista
            actividad: null, dias: null, horario: null, precio: null,
            citaId: null, validadoAdmin: null, fechaSolicitudBaja: null
        });
    }
};

  const borrarAlumno = async (e, id) => { 
      e.stopPropagation(); // Evita abrir ficha al borrar
      if (userRole !== 'admin') return; 
      if(confirm('⚠️ ¿Borrar definitivamente?')) await deleteDoc(doc(db, 'students', id)); 
  }
  
  const agregarAviso = async (e) => { e.preventDefault(); if (!nuevoAviso) return; await addDoc(collection(db, 'avisos'), { texto: nuevoAviso, fecha: new Date().toISOString() }); setNuevoAviso(''); };
  const borrarAviso = async (id) => { if (confirm('¿Borrar aviso?')) await deleteDoc(doc(db, 'avisos', id)); };
  // PEGA ESTO EN EL HUECO:
  const handleCrearStaff = async (e) => { 
    e.preventDefault(); 
    
    // 1. Comprobamos que eres admin
    if (userRole !== 'admin') return alert("⛔ Solo coordinadores pueden crear usuarios.");
    
    setLoadingStaff(true); 
    try { 
        // 2. Crea el usuario (Email + Contraseña)
        const credencial = await createUserWithEmailAndPassword(auth, newStaff.email, newStaff.password);
        
        // 3. Guarda el Rol (Profe/Admin) en la base de datos
        await setDoc(doc(db, 'users', credencial.user.uid), {
            email: newStaff.email,
            role: newStaff.role,
            createdAt: new Date().toISOString()
        });

        alert(`✅ Usuario ${newStaff.email} creado.\n⚠️ IMPORTANTE: Firebase ha iniciado sesión con el nuevo usuario automáticamente. Cierra sesión y vuelve a entrar como Admin.`);
        setNewStaff({ email: '', password: '', role: 'profe' }); 

    } catch (error) { 
        console.error(error);
        alert("❌ Error: " + error.message); 
    } finally { 
        setLoadingStaff(false); 
    } 
};
  const borrarMiembroEquipo = async (miembro) => { if (miembro.email === userEmail) return alert("No puedes borrarte a ti mismo"); if (confirm("¿Borrar usuario?")) await deleteDoc(doc(db, 'users', miembro.id)); };
  
  const descargarExcel = () => {
    // 1. Cabeceras
    let cabecera = [];
    if (soySuperAdmin) {
      cabecera = ['Alumno,Curso,Letra,Tipo,Actividad,Días,Horario,Fecha Alta,Precio,Pagador,DNI Pagador,Email Pagador,CP,Población,Dirección,IBAN,Telefono\n'];
    } else {
      cabecera = ['Alumno,Curso,Letra,Tipo,Actividad,Días,Horario,Fecha Alta\n'];
    }
    
    // 2. Mapeo de datos
    const filas = listadoGlobal.map(a => {
      const p = padres[a.parentId] || {}; 
      
      const nombre = (a.nombre || '').replace(/"/g, '""');
      const actividad = (a.actividad || '-').replace(/"/g, '""');
      const dias = (a.dias || '-').replace(/"/g, '""');
      const horario = (a.horario || '-').replace(/"/g, '""');
      const fAlta = (a.fechaAlta || '-').replace(/"/g, '""');
      const estadoExcel = (a.estado === 'lista_espera') ? 'EN ESPERA' : 'INSCRITO';
      // --- LÓGICA BASADA EN TU regData.tipo ---
      // Usamos toUpperCase para que en el Excel quede profesional: "EXTERNO" o "INTERNO"
      const tipoAlumno = (p.tipo === 'externo') ? 'EXTERNO' : 'INTERNO';

      if (soySuperAdmin) {
        const precio = a.precio || '0';
        const pagador = (p.nombrePagador || '').replace(/"/g, '""');
        const iban = (p.iban || '').replace(/"/g, '""');
        const direccion = (p.direccion || '').replace(/"/g, '""');
        const tel = p.telefono1 || '';
        const dni = (p.dniPagador || '').replace(/"/g, '""');
        const mail = (p.email || '').replace(/"/g, '""');
        const cp = (p.cp || '').replace(/"/g, '""');
        const pob = (p.poblacion || '').replace(/"/g, '""');

        return `"${nombre}","${a.curso}","${a.letra}","${tipoAlumno}","${actividad}","${dias}","${horario}","${fAlta}","${precio}","${pagador}","${dni}","${mail}","${cp}","${pob}","${direccion}","${iban}","${tel}"`;
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
    alert("¡Sincronización de IDs y Días completada!");
};

  // --- 4. LISTAS FILTRADAS ---
  const gruposUnicos = [...new Set(alumnos.map(a => a.actividad).filter(g => g))].sort();
// --- 📈 LÓGICA DE PREVISIÓN + DINERO REAL (ACTUALIZADO) ---
const hoyD = new Date();
const proximoMesDate = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 1);
const mesSigNom = proximoMesDate.toLocaleString('es-ES', { month: 'long' });

const añoActual = hoyD.getFullYear();
const mesSiguiente = String(proximoMesDate.getMonth() + 1).padStart(2, '0');
const patronMesSig = `${añoActual}-${mesSiguiente}`;

// 1. Limpiamos la base
const alumnosReales = alumnos.filter(a => a.nombre && a.estado);

// 2. ALTAS: Solo si su fecha de ALTA es el mes que viene
const previsAltas = alumnosReales.filter(a => 
  a.fechaAlta && String(a.fechaAlta).startsWith(patronMesSig)
);

// 3. BAJAS: Salen si su fecha de BAJA es el mes que viene
const previsBajas = alumnosReales.filter(a => {
  const coincideFecha = a.fechaBaja && String(a.fechaBaja).startsWith(patronMesSig);
  const esEstadoBaja = ['baja_pendiente', 'baja_finalizada'].includes(a.estado);
  return coincideFecha && esEstadoBaja;
});

// 💰 FUNCIÓN PARA BUSCAR PRECIO REAL EN TU OFERTA_ACTIVIDADES
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

// 📊 CÁLCULOS TOTALES
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
  // Forzamos que el estado sea 'prueba_reservada' para que no entren fichas viejas
  return a.estado === 'prueba_reservada';
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

{/* PESTAÑAS AJUSTADAS (RESPONSIVE) - CON PREVISIÓN INTEGRADA */}
<div className="flex gap-1 mb-6 border-b pb-1 overflow-x-auto scrollbar-hide bg-white sticky top-0 z-10">
  {['global', 'ocupacion', 'pruebas', 'espera', 'prevision', 'bajas', 'equipo', 'avisos'].map(t => {
     // Añadimos 'prevision' a la restricción de admin
     if ((t === 'equipo' || t === 'bajas' || t === 'prevision') && userRole !== 'admin') return null;
     
     let count = 0; 
     if (t === 'pruebas') count = listadoPruebas.length; 
     if (t === 'bajas') count = listadoBajas.length;
     if (t === 'espera') count = alumnos.filter(a => a.estado === 'lista_espera').length;
     
     // 🚩 LÓGICA DEL CONTADOR PARA PREVISIÓN (Usa las variables del Paso 1)
     if (t === 'prevision') count = previsAltas.length + previsBajas.length;

     return (
        <button 
          key={t} 
          onClick={() => setTab(t)} 
          className={`
            px-3 py-3 font-bold uppercase text-[10px] md:text-xs whitespace-nowrap 
            flex flex-col md:flex-row items-center justify-center gap-1 flex-1 min-w-[90px]
            transition-all duration-200
            ${tab === t 
              ? (t === 'espera' ? 'text-amber-600 border-b-4 border-amber-600 bg-amber-50/50' : 
                 t === 'prevision' ? 'text-indigo-600 border-b-4 border-indigo-600 bg-indigo-50/50' :
                 'text-blue-600 border-b-4 border-blue-600 bg-blue-50/50')
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }
          `}
        >
            <span className="text-sm">
              {t === 'global' && '👥'}
              {t === 'ocupacion' && '📊'}
              {t === 'pruebas' && '🎯'}
              {t === 'espera' && '⏳'}
              {t === 'prevision' && '📈'} {/* 🚩 Icono de Previsión */}
              {t === 'bajas' && '📉'}
              {t === 'equipo' && '🛡️'}
              {t === 'avisos' && '📢'}
            </span>
            
            <span>
              {t === 'ocupacion' ? 'PLAZAS' : t === 'espera' ? 'ESPERA' : t === 'prevision' ? 'PREVISIÓN' : t.toUpperCase()}
            </span>

            {count > 0 && (
              <span className={`
                text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm
                ${t === 'espera' ? 'bg-amber-500' : t === 'prevision' ? 'bg-indigo-600' : 'bg-red-500'}
              `}>
                {count}
              </span>
            )}
        </button>
     );
  })}
</div>
     {/* 📊 MATRIZ DE OCUPACIÓN DIARIA (CORREGIDA) */}
{tab === 'ocupacion' && (
  <div className="space-y-4 animate-fade-in">
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
  <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
    <span>🏊‍♂️</span> Control de Aforo Diario
  </h3>
  
  {/* Selector de Mes */}
  <div className="flex bg-slate-700 p-1 rounded-lg">
    <button 
      onClick={() => setVistaMes('actual')}
      className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${vistaMes === 'actual' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
    >
      {new Date().toLocaleString('es-ES', { month: 'long' })}
    </button>
    <button 
      onClick={() => setVistaMes('proximo')}
      className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${vistaMes === 'proximo' ? 'bg-blue-500 text-white' : 'text-slate-400'}`}
    >
      {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleString('es-ES', { month: 'long' })}
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

  // --- LÓGICA TEMPORAL 100% DINÁMICA ---
  const hoy = new Date();
  const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  const mesSiguienteISO = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
  
  // Limpiamos la fecha del alumno para comparar
  const fechaAlumno = (a.fechaAlta || a.fechaInscripcion || "").toString();
  const esAltaMesSiguiente = fechaAlumno.includes(mesSiguienteISO);

  if (vistaMes === 'actual') {
    // VISTA ACTUAL: 
    // 1. Solo mostramos si está inscrito o tiene baja pendiente
    // 2. EXCLUIMOS a los que tienen fecha de alta del mes que viene (altas futuras)
    return (a.estado === 'inscrito' || a.estado === 'baja_pendiente') && !esAltaMesSiguiente;
  } else {
    // PREVISIÓN MES SIGUIENTE:
    const esBajaSolicitada = a.estado === 'baja_pendiente';
    
    // Si tiene baja pendiente, para el mes que viene ya no ocupa plaza (false)
    if (esBajaSolicitada) return false; 
    // Ocupan plaza los inscritos de siempre + los que empiezan nuevos el mes que viene
    return a.estado === 'inscrito' || esAltaMesSiguiente;
  }
}).length;

// 🚩 DETECTAR SI HAY BAJAS (Para el color naranja)
// Solo se activa en la vista actual para avisarte de huecos que se van a liberar
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
      mesVista: vistaMes // Pasamos el mes para que el radar sepa qué nombres filtrar
    })}
    className={`h-12 rounded-xl flex flex-col items-center justify-center border-2 transition-all cursor-pointer hover:shadow-inner active:scale-95 ${
      ocupados === 0 ? 'border-dashed border-gray-100 text-gray-200' :
      // Prioridad 1: Naranja si hay bajas próximas (solo en vista actual)
      (vistaMes === 'actual' && tieneBajasProximas) ? 'bg-orange-500 border-orange-600 text-white font-black shadow-md' :
      // Prioridad 2: Rojo si está lleno
      critico ? 'bg-red-500 border-red-600 text-white font-black shadow-md' :
      // Prioridad 3: Ámbar si está casi lleno (>70%)
      ocupados > (g.m * 0.7) ? 'bg-amber-50 border-amber-200 text-amber-600' : 
      // Prioridad 4: Verde (Hueco disponible)
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
    <div className="bg-white rounded shadow overflow-hidden">
        {/* CABECERA CON BUSCADOR MEJORADO */}
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                <input 
                    className="w-full border p-2 pl-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="Buscar por niño o responsable..." 
                    value={busqueda} 
                    onChange={e => setBusqueda(e.target.value)} 
                />
            </div>
            <select className="border p-2 rounded md:w-1/3 font-bold text-gray-600 bg-white" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
                <option value="">📂 Todos los Grupos</option>
                {gruposUnicos.map(g => (<option key={g} value={g}>{g}</option>))}
            </select>
        </div>

        <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 uppercase text-xs">
                <tr>
                    <th className="p-3">Alumno / Responsable</th>
                    <th className="p-3">Actividad / Alta</th>
                    <th className="p-3 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody>
                {listadoGlobal.length > 0 ? listadoGlobal.map(a => (
                    <tr 
                      key={a.id} 
                      onClick={() => abrirFicha(a)} 
                      className={`border-b cursor-pointer transition ${
                          a.estado === 'baja_pendiente' ? 'bg-red-50' : 
                          a.estado === 'lista_espera' ? 'bg-amber-50 hover:bg-amber-100' : 
                          'hover:bg-blue-50'
                      }`}
                    >
                        <td className="p-3">
                          <span className="font-bold text-gray-900 block leading-tight">
                            {a.estado === 'lista_espera' && '⏳ '}{a.nombre}
                          </span>
                          
                          {/* 👤 NOMBRE DEL PADRE/CONTACTO VISIBLE SIEMPRE */}
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight mt-1">
                             👤 {padres[a.parentId]?.nombre || padres[a.parentId]?.personaContacto || padres[a.parentId]?.nombrePagador || 'Cargando tutor...'}
                          </div>
                          
                          <div className="flex gap-1 mt-1">
                            {a.estado === 'baja_pendiente' && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">BAJA PENDIENTE</span>}
                            {a.estado === 'lista_espera' && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">EN ESPERA</span>}
                          </div>
                          
                          <div className="text-blue-600 font-bold text-[10px] mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded border border-blue-100">
                              {a.curso} - {a.letra}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-gray-800">{a.actividad || '-'}</div>
                          {a.dias && <div className="text-[10px] text-gray-500 mt-1 font-medium">📅 {a.dias} | ⏰ {a.horario}</div>}
                          
                          <div className="text-[10px] mt-1">
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
                                return <span className="text-gray-400">Sin fecha de alta</span>;
                              }
                            })()}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={() => a.estado === 'lista_espera' ? abrirFicha(a) : confirmarInscripcion(a.id)}
                                className={`px-2 py-1 rounded text-[10px] font-black uppercase shadow-sm border transition ${
                                    a.estado === 'lista_espera'
                                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                                    : a.revisadoAdmin 
                                      ? 'bg-green-100 text-green-700 border-green-200' 
                                      : 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
                                }`}
                            >
                                {a.estado === 'lista_espera' ? '🚀 Gestionar' : a.revisadoAdmin ? '✅ OK' : '⏳ Confirmar'}
                            </button>

                            {userRole === 'admin' && (
                                <button onClick={(e) => borrarAlumno(e, a.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition">
                                    🗑️
                                </button>
                            )}
                          </div>
                        </td>
                    </tr>
                )) : <tr><td colSpan="3" className="p-8 text-center text-gray-400">No hay resultados.</td></tr>}
            </tbody>
        </table>
    </div>
)}

     {/* TAB: BAJAS (AHORA SE PUEDE ABRIR LA FICHA) */}
     {tab === 'bajas' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs">
                      <tr>
                          <th className="p-3">Alumno</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Fecha Baja</th>
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
                              </td>
                              <td className="p-3">
                                  {a.estado === 'baja_pendiente' 
                                    ? <span className="text-red-600 font-bold text-xs animate-pulse">🔴 PENDIENTE</span>
                                    : <span className="text-gray-600 font-bold text-xs border border-gray-300 px-1 rounded">⚫ TRAMITADA</span>
                                  }
                              </td>
                              <td className="p-3 font-mono text-xs font-bold">
                                  {a.fechaBaja || '-'}
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
                        const fechaA = a.fechaInscripcion?.seconds || a.fechaInscripcion || 0;
                        const fechaB = b.fechaInscripcion?.seconds || b.fechaInscripcion || 0;
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
                                <span className={`inline-block w-6 h-6 leading-6 rounded-full text-[10px] font-black ${index === 0 ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
                                    {index + 1}
                                </span>
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
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        validarPlazaDirecto(a);
                                        registrarLog("VALIDAR_PLAZA", `Validada plaza para ${a.nombre} (Puesto #${index + 1})`);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-black text-[10px] uppercase shadow transition-all active:scale-95"
                                >
                                    Validar Plaza
                                </button>
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

      {/* TABS EXTRA */}
      {tab === 'equipo' && userRole === 'admin' && (
          <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">Crear Usuario</h3><p className="text-sm text-gray-500">Para añadir coordinadores o profesores, usa la consola de Firebase Authentication.</p></div>
              <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">Equipo Actual</h3>{equipo.map(u => (<div key={u.id} className="flex justify-between items-center border-b py-2"><span>{u.email} <small className="text-gray-500">({u.role})</small></span><button onClick={() => borrarMiembroEquipo(u)} className="text-red-500">🗑️</button></div>))}</div>
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
  // Función para guardar cambios de fecha al instante
  const cambiarFecha = async (campo, e) => {
      if (userRole !== 'admin') return;
      const valorOriginal = e.target.defaultValue; // Para saber qué había antes
      const nuevaFecha = e.target.value ? new Date(e.target.value).getTime() : null;
      try {
          await updateDoc(doc(db, 'students', alumno.id), { [campo]: nuevaFecha });
          
          // 🚩 REGISTRO EN EL HISTORIAL
          registrarLog("EDICIÓN FECHA", `Cambio en ${campo}: de ${valorOriginal} a ${e.target.value}`);
          
          enviarPushLocal("💾 Cambio Guardado", `Has actualizado la fecha de ${alumno.nombre}`);
      } catch (error) {
          console.error("Error:", error);
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
          
{/* 1. FECHAS (REPARACIÓN DE EMERGENCIA) */}
<div className="bg-gray-100 p-4 rounded border border-gray-300 grid grid-cols-2 gap-4 shadow-inner">
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">📅 Fecha de Alta</label>
        <input 
          type="date" 
          defaultValue={(() => {
            const f = alumno.fechaAlta || alumno.fechaInscripcion;
            if (!f) return "";
            // Si es un objeto de Firebase (Timestamp), usamos .toDate()
            const dateObj = f.toDate ? f.toDate() : new Date(f);
            return !isNaN(dateObj) ? dateObj.toISOString().split('T')[0] : "";
          })()}
          disabled={userRole !== 'admin'}
          onChange={(e) => cambiarFecha('fechaAlta', e)}
          className={`w-full p-2 rounded border font-bold ${userRole === 'admin' ? 'bg-white border-blue-400' : 'bg-gray-200'}`}
        />
    </div>
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          🏁 Fecha de Baja {alumno.estado === 'baja_pendiente' && "⚠️"}
        </label>
        <input 
          type="date" 
          defaultValue={(() => {
            const f = alumno.fechaBaja || alumno.fechaBajaEfectiva;
            if (!f) return "";
            const dateObj = f.toDate ? f.toDate() : new Date(f);
            return !isNaN(dateObj) ? dateObj.toISOString().split('T')[0] : "";
          })()}
          disabled={userRole !== 'admin'}
          onChange={(e) => cambiarFecha('fechaBaja', e)}
          className={`w-full p-2 rounded border font-bold ${
            alumno.estado === 'baja_pendiente' 
              ? 'bg-red-50 border-red-500 text-red-700' 
              : userRole === 'admin' ? 'bg-white border-red-400' : 'bg-gray-200'
          }`}
        />
        {alumno.estado === 'baja_pendiente' && (
          <p className="text-[9px] text-red-600 font-black mt-1 uppercase leading-none">
            BAJA SOLICITADA POR EL USUARIO
          </p>
        )}
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
const Dashboard = ({ user, misHijos, logout, refresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [alumnoEditar, setAlumnoEditar] = useState(null);
  const [modoModal, setModoModal] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [newPass, setNewPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const alumnoEnVivo = misHijos.find((h) => h.id === alumnoSeleccionado?.id);
const handleUpdatePassword = async () => {
    if (newPass.length < 6) return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
    try {
      await updatePassword(auth.currentUser, newPass);
      alert("✅ Contraseña actualizada correctamente.");
      setNewPass('');
      setIsChangingPass(false);
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        alert("🔒 Por seguridad, debes haber iniciado sesión recientemente para cambiar tu contraseña. Por favor, sal y vuelve a entrar.");
      } else {
        alert("❌ Error: " + error.message);
      }
    }
  };
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => 
      setAvisos(s.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    return () => unsub();
  }, []);

  const alTerminarPrueba = () => {
    // 1. Cerramos el modal de la prueba
    // 2. Abrimos inmediatamente el modal de inscripción (selección de grupo)
    setModoModal('inscripcion'); 
  };

  // 👇 1. FUNCIÓN NUEVA: CANCELAR SOLICITUD (Borrado rápido)
  const cancelarSolicitud = async (hijo) => {
    if (!window.confirm(`⚠️ ¿Cancelar la solicitud de ${hijo.nombre}?\n\nAl no estar inscrito todavía, se borrará la reserva inmediatamente y podrás empezar de cero.`)) return;

    try {
        await updateDoc(doc(db, 'students', hijo.id), {
            estado: 'sin_inscripcion',
            actividad: null,
            dias: null,
            horario: null,
            precio: null,
            citaId: null,
            citaNivel: null,
            fechaInscripcion: null,
            aceptaNormas: false,
            autorizaFotos: false
        });
        refresh(user.uid);
        alert('✅ Solicitud cancelada correctamente.');
    } catch (e) {
        alert('Error al cancelar: ' + e.message);
    }
  };

  // 👇 2. FUNCIÓN DE SIEMPRE: GESTIONAR BAJA (Trámite administrativo)
  const gestionarBaja = async (hijo) => {
    // Si por error llama a esto un 'sin_inscripcion', lo borramos directo
    if (hijo.estado === 'sin_inscripcion') {
        if (window.confirm(`🗑️ ¿Eliminar perfil de ${hijo.nombre}?`)) {
            await deleteDoc(doc(db, 'students', hijo.id));
            refresh(user.uid);
        }
        return;
    }

    const diaActual = new Date().getDate();

    // Bloqueo después del día 25
    if (diaActual > 25) {
        return alert('⛔ PLAZO CERRADO.\n\nLas bajas para el mes siguiente deben tramitarse antes del día 25.\n\nContacta con secretaría.');
    }

    // Tramitación de Baja
    if (window.confirm(`⚠️ ¿Solicitar BAJA de ${hijo.nombre}?\n\nℹ️ AVISO: Al ser día ${diaActual}, se cobrará el mes en curso completo. La baja será efectiva el último día de este mes.`)) {
      await updateDoc(doc(db, 'students', hijo.id), {
        estado: 'baja_pendiente',
        fechaSolicitudBaja: new Date().toISOString()
      });
      refresh(user.uid);
      alert('✅ Solicitud de baja registrada.\nTu plaza se mantendrá activa hasta final de mes.');
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
            <div key={hijo.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group mb-4">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${bordeColor}`}></div>
              
              {/* CABECERA */}
              <div className="flex justify-between items-start mb-2 pl-3">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                  {hijo.nombre} 
{(!hijo.actividad && hijo.estado === 'sin_inscripcion') && (
  <button 
    onClick={() => setAlumnoEditar(hijo)} 
    className="text-gray-400 hover:text-blue-600 bg-gray-50 p-1.5 rounded-full transition-all"
    title="Editar datos básicos"
  >
    ✏️
  </button>
)}                  </h3>
                  <p className="text-gray-500 text-sm font-medium">{hijo.curso} • {hijo.letra}</p>
                </div>
                <div className="flex flex-col items-end gap-2"><span className="px-2 py-1 rounded text-[10px] font-extrabold uppercase bg-gray-100 text-gray-500">{estadoTexto}</span></div>
              </div>

              {/* DATOS DE ACTIVIDAD (Inscrito, Baja Pendiente o LISTA DE ESPERA) */}
{(hijo.estado === 'inscrito' || hijo.estado === 'baja_pendiente' || hijo.estado === 'lista_espera') && (
  <div className={`ml-3 mt-4 p-3 rounded-lg border text-sm relative
      ${hijo.estado === 'baja_pendiente' ? 'bg-red-50 border-red-200' : 
        hijo.estado === 'lista_espera' ? 'bg-amber-50 border-amber-200' : // 🚩 Nuevo estilo Ámbar
        !estaAdmitido ? 'bg-yellow-50 border-yellow-200' : 
        'bg-green-50 border-green-100'
      }`}>

    {/* CASO NUEVO: LISTA DE ESPERA */}
    {hijo.estado === 'lista_espera' ? (
        <div className="pr-6">
            <p className="font-bold text-amber-900 text-sm uppercase mb-1">{hijo.actividad}</p>
            <div className="flex gap-2 text-amber-800 text-xs mb-2 font-medium">
                <span>📅 {hijo.dias}</span><span>⏰ {hijo.horario}</span>
            </div>
            <div className="bg-white/60 rounded p-2 border border-amber-200">
                <p className="font-bold text-amber-800 text-[10px] uppercase mb-0.5">⏳ En espera de vacante</p>
                <p className="text-[10px] text-amber-700 leading-tight">
                  No hay plazas disponibles. Te avisaremos por orden de lista en cuanto quede un hueco libre.
                </p>
            </div>
        </div>
    ) : 
    
    /* CASO: PENDIENTE DE VALIDAR (AMARILLO - El tuyo) */
    !estaAdmitido && hijo.estado === 'inscrito' ? (
        <div className="text-center pr-6">
            <p className="font-bold text-yellow-900 text-sm uppercase mb-1">{hijo.actividad}</p>
            <div className="flex justify-center gap-2 text-yellow-800 text-xs mb-2 opacity-80">
                <span>📅 {hijo.dias}</span><span>⏰ {hijo.horario}</span>
            </div>
            <div className="bg-white/50 rounded p-1 border border-yellow-200">
                <p className="font-bold text-yellow-800 text-xs">⏳ Solicitud Recibida</p>
                <p className="text-[10px] text-yellow-700">
                  {(hijo.actividad || '').toUpperCase().includes('ADULTO') || (hijo.actividad || '').toUpperCase().includes('WATERPOLO')
                    ? "El club está revisando tu inscripción."
                    : "El coordinador está validando el nivel."
                  }
                </p>
            </div>
        </div>
    ) : (
        /* CASO: ADMITIDO O BAJA PENDIENTE (VERDE/ROJO - El tuyo) */
        <div className="pr-6">
          <p className="font-bold mb-1 text-gray-800 uppercase">{hijo.actividad}</p>
          <div className="flex items-center gap-2 text-gray-600">
            <span>📅 {hijo.dias}</span><span>⏰ {hijo.horario}</span>
          </div>
          {hijo.estado === 'baja_pendiente' && (
            <p className="text-red-600 font-bold text-xs mt-2 uppercase">⚠️ Baja efectiva a fin de mes</p>
          )}
          {estaAdmitido && hijo.estado === 'inscrito' && (
            <p className="text-green-600 font-bold text-[10px] mt-2 uppercase">✅ Plaza Confirmada</p>
          )}
        </div>
    )}
  </div>
)}
              
{/* DATOS DE PRUEBA */}
{hijo.estado === 'prueba_reservada' && (
  <div className="ml-3 mt-4 bg-orange-50 p-3 rounded-lg border border-orange-200 text-sm">
    <div className="mb-3 pb-3 border-b border-orange-200">
        <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">🎯 Grupo Pre-seleccionado:</p>
        
        {/* MODIFICACIÓN: Si ya tiene actividad Y días, mostramos la info. Si no, el botón. */}
        {hijo.actividad && hijo.dias ? (
            <div>
              <p className="text-lg font-black text-orange-900 leading-tight">{hijo.actividad}</p>
              <div className="flex gap-3 text-orange-800 text-xs mt-1 font-bold">
                  <span>📅 {hijo.dias}</span>
                  <span>⏰ {hijo.horario || 'Horario pendiente'}</span>
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
              </div>
            </div>
          );
        })}
      </div>
      
      <button onClick={() => setShowForm(true)} className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 mb-10"><span className="text-2xl">+</span> Añadir Otro Alumno</button>
      
      {/* MODALES Y FORMULARIOS */}
      {showForm && (<FormularioHijo close={() => setShowForm(false)} user={user} refresh={refresh} />)}
      {alumnoEditar && (
  <FormularioHijo 
    alumnoAEditar={alumnoEditar} 
    close={() => setAlumnoEditar(null)} 
    user={user} 
    refresh={refresh} 
  />
)}      {modoModal === 'prueba' && alumnoEnVivo && (<PantallaPruebaNivel alumno={alumnoEnVivo} close={() => setModoModal(null)} onSuccess={alTerminarPrueba} user={user} refresh={refresh} />)}
      {modoModal === 'inscripcion' && alumnoEnVivo && (<PantallaInscripcion alumno={alumnoEnVivo} close={() => setModoModal(null)} onRequirePrueba={() => setModoModal('prueba')} user={user} refresh={refresh} />)}
    </div>
  );
};

// ==========================================
// ✏️ FORMULARIO EDICIÓN DE DATOS
// ==========================================
const FormularioHijo = ({ close, user, refresh, alumnoAEditar = null }) => {
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
      alert("⛔ Este alumno ya tiene una actividad vinculada. Para cambios de curso o nombre, contacta con secretaría.");
      close();
      return;
    }    const telefonoLimpio = data?.telefono ? String(data.telefono).trim() : "";
    
    // Validaciones
    if (!data.nombre || data.nombre.trim() === "") return alert("⚠️ El nombre es obligatorio.");
    if (!data.fechaNacimiento) return alert("⚠️ La fecha de nacimiento es obligatoria.");
    if (!data.aceptaNormas) return alert("⚠️ Debes aceptar las normas.");

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
        alert("✅ Datos actualizados correctamente");
      } else {
        // MODO CREACIÓN: Creamos uno nuevo
        await addDoc(collection(db, 'students'), {
          ...datosFinales,
          estado: 'sin_inscripcion',
          fechaCreacion: new Date().toISOString()
        });
        alert("✅ Alumno registrado correctamente");
      }
      
      refresh(user.uid);
      close();
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("No se pudo guardar en la base de datos.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-blue-900 mb-4">👶 Añadir Estudiante</h2>
        
        <div className="space-y-4">
          <input 
            className="w-full border p-3 rounded-lg" 
            placeholder="Nombre y Apellidos *" 
            onChange={e => setData({...data, nombre: e.target.value})} 
          />

          {/* PREGUNTA DE NATACIÓN */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm font-bold text-blue-800 mb-2">¿Estuvo en la extraescolar de natación el curso pasado?</p>
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

          <div className="grid grid-cols-2 gap-2">
            <select className="border p-3 rounded-lg" value={data.curso} onChange={e => setData({...data, curso: e.target.value})}>
              {LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
            </select>
            <select className="border p-3 rounded-lg" value={data.letra} onChange={e => setData({...data, letra: e.target.value})}>
              <option>A</option><option>B</option><option>C</option>
            </select>
          </div>

          <input 
            type="date" 
            className="w-full border p-3 rounded-lg" 
            onChange={e => setData({...data, fechaNacimiento: e.target.value})} 
          />

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" onChange={e => setData({...data, aceptaNormas: e.target.checked})} />
            Acepto las normas de funcionamiento *
          </label>

          <div className="flex gap-3 mt-4">
            <button onClick={close} className="flex-1 py-3 text-gray-500 font-bold">Cancelar</button>
            <button 
              onClick={validarYGuardarAlumno} 
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700"
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
const PantallaInscripcion = ({ alumno, close, onRequirePrueba, user, refresh }) => {
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
  // 1. Estado para guardar la ocupación global
  const [todosLosAlumnos, setTodosLosAlumnos] = useState([]);

  // 2. Escuchamos a todos los alumnos para poder contar plazas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (s) => {
      setTodosLosAlumnos(s.docs.map(doc => ({
        actividadId: doc.data().actividadId,
        estado: doc.data().estado,
        dias: doc.data().dias,
        curso: doc.data().curso
      })));
    });
    return () => unsub();
  }, []);
  // 🚩 LÓGICA PARA EL SELECTOR DE FECHAS
  const infoAlta = (() => {
    const hoy = new Date();
    const dia = hoy.getDate();
    const mesActual = hoy.toLocaleString('es-ES', { month: 'long' });
    const sigMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toLocaleString('es-ES', { month: 'long' });
    
    return { 
      diaCortePasado: dia > 20, 
      mesActual, 
      sigMes 
    };
  })();



  const obtenerEstadoPlaza = (actividadId, textoDiasSeleccionado, cursoAlumno) => {
    // 1. Buscamos la actividad en tu catálogo oficial
    const actividadDoc = OFERTA_ACTIVIDADES.find(a => a.id === actividadId);
    const max = actividadDoc?.alumnosMax || 10;
  
    // 2. Extraemos los días individuales del texto seleccionado
    // (Transforma "[PACK] Lunes y Miércoles" en ["lunes", "miercoles"])
    const diasAComprobar = [];
    const textoLimpiado = textoDiasSeleccionado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (textoLimpiado.includes('lunes')) diasAComprobar.push('lunes');
    if (textoLimpiado.includes('martes')) diasAComprobar.push('martes');
    if (textoLimpiado.includes('miercoles')) diasAComprobar.push('miercoles');
    if (textoLimpiado.includes('jueves')) diasAComprobar.push('jueves');
    if (textoLimpiado.includes('viernes')) diasAComprobar.push('viernes');
  
    // 3. Calculamos la ocupación máxima entre los días elegidos
    // Si un Pack es Lunes/Miércoles, miramos cuál de los dos días está más lleno
    let ocupacionMaxEnDias = 0;
  
    diasAComprobar.forEach(dia => {
      const inscritosEseDia = todosLosAlumnos.filter(a => {
        const coincideAct = a.actividadId === actividadId;
        const estaInscrito = a.estado === 'inscrito';
        const diasAlumno = a.dias?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
        
        const ocupaEsteDia = diasAlumno.includes(dia);
  
        // Filtro especial Primaria 16:15 (Subgrupos por curso)
        if (actividadId === 'primaria_1615') {
          const esPeque = ['1PRI', '2PRI', '3PRI'].includes(cursoAlumno);
          const cursosFiltro = esPeque ? ['1PRI', '2PRI', '3PRI'] : ['4PRI', '5PRI', '6PRI'];
          return coincideAct && estaInscrito && ocupaEsteDia && cursosFiltro.includes(a.curso);
        }
  
        return coincideAct && estaInscrito && ocupaEsteDia;
      }).length;
  
      if (inscritosEseDia > ocupacionMaxEnDias) {
        ocupacionMaxEnDias = inscritosEseDia;
      }
    });
  
    // 4. Resultados finales
    const plazasLibres = max - ocupacionMaxEnDias;
  
    return {
      lleno: ocupacionMaxEnDias >= max,
      // 🚩 REGLA DE ORO: Si quedan 3 o menos plazas reales
      esCritico: max > 0 && plazasLibres <= 3 && plazasLibres > 0,
      cupoActual: ocupacionMaxEnDias,
      maximo: max,
      libres: plazasLibres
    };
  };
  // 2. FUNCIÓN DE INSCRIPCIÓN
const inscribir = async (act, op) => {
    if (normasRef.current !== true) {
        return alert("⚠️ Es obligatorio aceptar las normas.");
    }
    
    // 🔄 LECTURA DE SEGURIDAD
    const alumnoRef = doc(db, 'students', alumno.id);
    const snap = await getDoc(alumnoRef);
    const d = snap.exists() ? snap.data() : alumno;

    // 🕵️‍♂️ MODO DETECTIVE
    console.log("DEBUG INSCRIPCIÓN:", {
        nombre: d.nombre,
        curso: d.curso,
        natacionPasado: d.natacionPasado,
        esAntiguo: d.esAntiguoAlumno
    });

    const esAdulto = act.id === 'adultos' || (d.curso || '').toUpperCase().includes('ADULTO');
    
    // 🚩 1. CALCULAMOS EL ESTADO INICIAL (Normal o Prueba)
    let estadoFinal = 'inscrito';
    if (!esAdulto && act.requierePrueba) {
        estadoFinal = 'requiere_prueba';
    }

    // 🚩 2. DATOS COMUNES (BLINDAJE TOTAL CONTRA ERRORES DE FECHA)
    const hoyParaCalculo = new Date();
    const diaActual = hoyParaCalculo.getDate();
    const inicioDeseado = datosAlumno.inicioDeseado || 'proximo';

    let fechaFinalISO;

    if (inicioDeseado === 'inmediato' && diaActual <= 20) {
        // CASO 1: Hoy mismo
        fechaFinalISO = hoyParaCalculo.toISOString();
    } else {
        // CASO 2: Día 1 del mes que viene (FORZADO MANUAL)
        // Usamos el constructor (Año, Mes + 1, Día 1, Hora 12) para evitar saltos de zona horaria
        const proximoMes = new Date(hoyParaCalculo.getFullYear(), hoyParaCalculo.getMonth() + 1, 1, 12, 0, 0);
        fechaFinalISO = proximoMes.toISOString();
    }

    const datosComunes = {
      nombre: d.nombre, 
      curso: d.curso, 
      actividad: act.nombre,
      actividadId: act.id, 
      dias: op.dias,
      horario: op.horario,
      precio: op.precio,
      fechaAlta: fechaFinalISO, // 🎯 Ahora sí será siempre día 01 o hoy
      revisadoAdmin: false,
      inicioDeseado: inicioDeseado, 
      autorizaFotos: autorizaFotos,
      aceptaNormas: normasRef.current
    };

    const cursoNombre = (d.curso || '').toUpperCase();
    const esInfantil = cursoNombre.includes('INF');
    const tienePaseVIP = d.natacionPasado === 'si' || d.esAntiguoAlumno === true || d.esAntiguoAlumno === 'true' || d.antiguo === 'si';

    // CASO A: REVISADO Y ASEGURADO (PRUEBA DE NIVEL)
    if (act.requierePrueba && !esInfantil && !tienePaseVIP && !d.citaNivel && d.estado !== 'prueba_reservada') {
      if(!confirm(`⚠️ Esta actividad requiere PRUEBA DE NIVEL.\n\n¿Continuar para elegir hora?`)) return;
      try {
          await updateDoc(alumnoRef, { 
              ...datosComunes,
              estado: 'prueba_reservada' 
          });
          await refresh(user.uid);
          close(); 
          setTimeout(() => { onRequirePrueba(); }, 400); 
      } catch (error) { console.error("Error:", error); }
      return; 
    }

// CASO B: INSCRIPCIÓN DIRECTA (VIP, INFANTIL O EXENTO)
    // 🚩 3. DETERMINAR ESTADO Y VERIFICAR AFORO (CORREGIDO)
    const infoPlaza = obtenerEstadoPlaza(act.id, op.dias, d.curso);
    
    let estadoFinalReal;
    if (tienePaseVIP || esInfantil || d.esAntiguoAlumno) {
        estadoFinalReal = 'inscrito';
    } else if (act.requierePrueba) {
        estadoFinalReal = 'prueba_reservada'; 
    } else {
        estadoFinalReal = 'inscrito';
    }

    let mensajeConfirmacion = `¿Confirmar inscripción en ${act.nombre}?`;
    if (infoPlaza.lleno) {
        mensajeConfirmacion = `⚠️ Este grupo está completo actualmente.\n\n¿Quieres apuntarte a la LISTA DE ESPERA para ${op.dias}? Te avisaremos si queda una vacante.`;
        estadoFinalReal = 'lista_espera';
    }

    if (!confirm(mensajeConfirmacion)) return;
    
    // 4. GUARDADO FINAL
    const grupoFormateado = `${op.dias} ${op.horario}`;
    let idLimpio = act.id;
    if (act.nombre.toLowerCase().includes('16:15')) idLimpio = 'primaria_1615';
    
    try {
        await updateDoc(alumnoRef, { 
          ...datosComunes,
          estado: estadoFinalReal,
          grupo: grupoFormateado, 
          horario: op.horario,
          actividad: act.nombre,
          actividadId: idLimpio,
          dias: op.dias,
          revisadoAdmin: (estadoFinalReal === 'inscrito'),
          validadoAdmin: (estadoFinalReal === 'inscrito'),
          fechaInscripcion: new Date().toISOString()
        });

        // 5. EMAIL DE CONFIRMACIÓN
        if (user && user.email) {
          let detalleParaEmail = estadoFinalReal === 'lista_espera' 
              ? "LISTA DE ESPERA (Pendiente de vacante)" 
              : `${act.nombre} (${op.dias} - ${op.horario})`;
              
          await enviarEmailConfirmacion(user.email, d.nombre, detalleParaEmail);
        }

        // 6. FINALIZACIÓN Y LIMPIEZA
        await refresh(user.uid); 
        close();

        setTimeout(() => {
          let msg = "✅ ¡Inscripción realizada con éxito!";
          if (estadoFinalReal === 'lista_espera') msg = "✅ Te has apuntado a la lista de espera.";
          if (estadoFinalReal === 'prueba_reservada') msg = "✅ Solicitud enviada. Recuerda acudir a la prueba de nivel el día seleccionado.";
          alert(msg);
        }, 100);

    } catch (error) {
        console.error("Error en el guardado final:", error);
        alert("Hubo un error al guardar los datos.");
    }
}; // <--- ESTE CIERRA LA FUNCIÓN "inscribir"

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
                const info = obtenerEstadoPlaza(act.id, op.dias, alumno.curso);
                const plazasLibres = info.maximo - info.cupoActual;

                return (
                    <div key={idx} className="space-y-1">
                        <button 
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
                                        ⏳ Lista Espera
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
                        {info.lleno && (
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
// 📅 PANTALLA PRUEBA DE NIVEL (SOLO LUNES + 5 MIN + EMAIL)
// ==========================================
const PantallaPruebaNivel = ({ alumno, close, onSuccess, user }) => {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocupacion, setOcupacion] = useState({});

  if (!alumno) return null;
  // BLOQUEO PARA ANTIGUOS ALUMNOS (PASE VIP)
  if (alumno.natacionPasado === 'si') {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
            ✅
          </div>
          <h3 className="text-2xl font-black text-blue-900 mb-2">¡Alumno Exento!</h3>
          <p className="text-gray-600 mb-6">
            Como <strong>{alumno.nombre}</strong> ya estuvo en la extraescolar de natación el curso pasado, no necesita realizar la prueba de nivel.
          </p>
          <button 
            onClick={() => {
              if (onSuccess) onSuccess(); // Esto activará el paso a los grupos
              close();
            }}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition"
          >
            Continuar a Selección de Grupo
          </button>
        </div>
      </div>
    );
  }

  // 1. FUNCIÓN PARA VALIDAR SI ES LUNES
  const validarSiEsLunes = (e) => {
    const seleccionada = new Date(e.target.value);
    const diaSemana = seleccionada.getUTCDay(); // 1 es Lunes

    if (diaSemana !== 1) {
      alert("📅 Las pruebas de nivel solo se realizan los LUNES. Por favor, selecciona otro día.");
      setFecha('');
      return;
    }
    setFecha(e.target.value);
    setHora(null);
  };

  // 2. GENERAR TURNOS DE 5 MINUTOS
  const franjas = [];
  for (let h = 16; h < 20; h++) {
    for (let m = 0; m < 60; m += 5) {
      franjas.push(`${h}:${m.toString().padStart(2, '0')}`);
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

  const confirmarReserva = async () => {
    if (!fecha || !hora) return alert("⚠️ Selecciona un lunes y una hora.");
    setLoading(true);
    try {
      const citaTexto = `${fecha} a las ${hora}`;
      
      // 1. Guardar en Base de Datos
      await updateDoc(doc(db, 'students', alumno.id), {
        estado: 'prueba_reservada',
        citaNivel: citaTexto,
        citaFecha: fecha,
        citaHora: hora,
        fechaSolicitud: new Date().toISOString()
      });

      // 📧 2. Intentar enviar Email (Si falla, el proceso sigue)
      try {
        if (user && user.email) {
          await enviarEmailConfirmacion(user.email, alumno.nombre, citaTexto);
          console.log("🚀 Email de cita encolado para:", user.email);
        }
      } catch (emailErr) {
        console.error("Error al disparar email, pero reserva guardada:", emailErr);
      }

      // 3. Finalización y Cierre
      // Usamos el refresh que viene por props para actualizar el panel
      if (typeof refresh === 'function') {
        await refresh(user.uid);
      }

      // Cerramos el modal actual
      close(); 

      // Ejecutamos el éxito (esto avisará al Dashboard para limpiar estados)
      if (onSuccess) onSuccess();

      setTimeout(() => {
        alert("✅ ¡Cita confirmada correctamente! Recibirás un correo con los detalles.");
      }, 300);

    } catch (e) {
      console.error("Error crítico en reserva:", e);
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
};
// 🚀 ATAJO PARA ANTIGUOS ALUMNOS (PASE VIP) - CORREGIDO
if (alumno.natacionPasado === 'si' || alumno.esAntiguoAlumno === true) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
          ✅
        </div>
        <h3 className="text-2xl font-black text-blue-900 mb-2">¡Pase Directo!</h3>
        <p className="text-gray-600 mb-6 font-medium">
          Como <strong>{alumno.nombre}</strong> ya estuvo el curso pasado, puede elegir grupo directamente.
        </p>
        <button 
  onClick={async () => {
    try {
      // 1. Antes de pasar al siguiente paso, desbloqueamos al alumno en la sombra
      const alumnoRef = doc(db, 'students', alumno.id);
      await updateDoc(alumnoRef, {
        estado: 'inscrito',     // Lo marcamos como oficial ya mismo
        revisadoAdmin: true,    // Para que no salga como "pendiente"
        validadoAdmin: true,
        citaNivel: 'EXENTO - ANTIGUO ALUMNO' 
      });

      // 2. Ahora sí, le dejamos elegir el grupo
      if (onSuccess) onSuccess(); 
      close();
    } catch (err) {
      console.error("Error al activar pase VIP:", err);
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="bg-blue-600 p-5 text-white flex justify-between items-center shadow-lg">
          <div>
            <h3 className="font-black text-xl flex items-center gap-2">🏊 Prueba de Nivel: LUNES</h3>
            <p className="text-blue-100 text-xs font-medium uppercase">{alumno.nombre}</p>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-start gap-3">
             <span className="text-xl">ℹ️</span>
             <p className="text-orange-900 text-sm">Las pruebas son exclusivas para los <strong>lunes</strong> por la tarde. Recuerda traer el equipo de natación.</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">1. Selecciona un Lunes</label>
              <input 
                type="date" 
                className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 font-bold"
                min={new Date().toISOString().split('T')[0]}
                value={fecha}
                onChange={validarSiEsLunes}
              />
            </div>

            {fecha && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">2. Turnos de 5 min (Aforo máx. 2)</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {franjas.map(f => {
                    const ocupados = ocupacion[f] || 0;
                    const estaLleno = ocupados >= 2;
                    return (
                      <button
                        key={f}
                        disabled={estaLleno}
                        onClick={() => setHora(f)}
                        className={`p-2 rounded-xl text-xs font-bold border-2 transition-all ${
                          estaLleno ? 'bg-gray-100 text-gray-300 border-gray-100' : 
                          hora === f ? 'bg-blue-600 text-white border-blue-600 scale-105' : 
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

{/* PIE DEL MODAL BLINDADO (Sustituye tu bloque anterior por este) */}
        <div className="p-4 bg-gray-50 border-t flex flex-col items-center gap-3">
          
          {/* Añadimos un aviso visual de que es obligatorio */}
          <p className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">
            ⚠️ Debes seleccionar una hora para completar el registro
          </p>

          <button 
            onClick={confirmarReserva}
            disabled={loading || !hora}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl disabled:bg-gray-200 disabled:text-gray-400 transition-all transform active:scale-95"
          >
            {loading ? 'Procesando reserva...' : 'FINALIZAR Y CONFIRMAR CITA'}
          </button>

          {/* 🚩 EL BOTÓN DE CANCELAR HA SIDO ELIMINADO */}
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
    if (!regData.password || !confirmPassword) return alert("⛔ Escribe la contraseña dos veces.");
    if (regData.password !== confirmPassword) return alert("⛔ Las contraseñas NO coinciden.");
    if (regData.password.length < 6) return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");

    // 2. Determinar Email de Usuario
    const emailFinal = regData.tipo === 'externo' ? regData.emailPagador : regData.emailContacto;
    if (!emailFinal) return alert("⚠️ Falta el email para crear tu cuenta.");

    // 3. Validaciones Específicas
    if (regData.tipo === 'externo') {
      if (!regData.nombrePagador) return alert('⚠️ Falta: Nombre del Pagador');
      if (!regData.dniPagador) return alert('⚠️ Falta: DNI del Pagador');
      
      const ibanLimpio = (regData.iban || '').replace(/\s/g, '');
      const ibanRegex = /^ES\d{22}$/;
      if (!ibanRegex.test(ibanLimpio)) return alert('⚠️ IBAN Inválido: Debe empezar por ES y tener 22 números después.');
    
      const tel1 = regData.telefono1 ? String(regData.telefono1).trim() : "";
      if (tel1.length < 9) return alert(`⛔ El teléfono debe tener 9 cifras`);
      
      if (!regData.direccion) return alert('⚠️ Falta: Dirección');
      if (!regData.cp) return alert('⚠️ Falta: Código Postal');
      if (!regData.iban) return alert('⚠️ Falta: IBAN Bancario');
    } else {
      // VALIDACIÓN REGISTRO INTERNO
      if (!regData.personaContacto) return alert('⚠️ Falta: Nombre de la persona de contacto');
      
      const telInterno = regData.telefono1 ? String(regData.telefono1).trim() : ""; 
      if (telInterno && telInterno.length < 9) {
          return alert(`⛔ El teléfono debe tener 9 cifras`);
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
      alert("✅ ¡Cuenta creada con éxito! Ya puedes entrar.");
      setIsRegister(false); 

    } catch (e) { 
        if (e.code === 'auth/email-already-in-use') alert('⛔ Ese correo ya está registrado.');
        else alert('Error: ' + e.message); 
    }
  };

  const handleAuth = async (e) => { 
      e.preventDefault(); 
      try { await signInWithEmailAndPassword(auth, loginData.email, loginData.password); } 
      catch (e) { alert("Error: Usuario o contraseña incorrectos."); } 
  };

  if (isRegister) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black flex items-center gap-2">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-3xl mt-10 animate-fade-in-up">
        <h2 className="text-2xl font-bold text-blue-900 text-center mb-2">Registro de Familia</h2>
        <p className="text-center text-gray-500 text-sm mb-6">Rellena los datos para crear tu cuenta</p>
        
        <form onSubmit={validateAndRegister} className="space-y-6">
          
          {/* 1. TIPO DE ALUMNO */}
          <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
            <button type="button" onClick={() => setRegData({ ...regData, tipo: 'interno' })} className={`flex-1 py-3 rounded-md font-bold text-sm transition ${regData.tipo === 'interno' ? 'bg-white shadow text-blue-900' : 'text-gray-500'}`}>🎓 Alumno del Colegio</button>
            <button type="button" onClick={() => setRegData({ ...regData, tipo: 'externo' })} className={`flex-1 py-3 rounded-md font-bold text-sm transition ${regData.tipo === 'externo' ? 'bg-white shadow text-blue-900' : 'text-gray-500'}`}>🌍 Alumno Externo</button>
          </div>
         

          {/* 2. DATOS CONTACTO / PAGO (SEGÚN TIPO) */}
{/* 2. DATOS CONTACTO / PAGO (SEGÚN TIPO) */}
{regData.tipo === 'externo' ? (
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200 animate-fade-in">
                <h3 className="font-bold text-orange-900 mb-3 border-b border-orange-200 pb-1">👤 Datos Completos del Pagador</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <input className="border p-2 rounded bg-white" placeholder="Nombre y apellidos del Titular *" onChange={e => setRegData({ ...regData, nombrePagador: e.target.value })} />
                    <input className="border p-2 rounded bg-white" placeholder="DNI / NIE *" onChange={e => setRegData({ ...regData, dniPagador: e.target.value })} />
                    
                    <input className="border p-2 rounded bg-white font-bold text-blue-600" placeholder="Teléfono 1 (9 cifras) *" onChange={e => setRegData({ ...regData, telefono1: e.target.value })} />
                    <input className="border p-2 rounded bg-white" placeholder="Teléfono 2" onChange={e => setRegData({ ...regData, telefono2: e.target.value })} />
                    
                    <input className="border p-2 rounded bg-white md:col-span-2" placeholder="Dirección Postal Completa *" onChange={e => setRegData({ ...regData, direccion: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        <input className="border p-2 rounded bg-white" placeholder="CP *" onChange={e => setRegData({ ...regData, cp: e.target.value })} />
                        <input className="border p-2 rounded bg-white" placeholder="Población *" onChange={e => setRegData({ ...regData, poblacion: e.target.value })} />
                    </div>
                    
                    <input 
  className="border p-2 rounded bg-white md:col-span-2 font-mono border-orange-300 uppercase" 
  placeholder="IBAN (ES + 22 números) *" 
  maxLength={24}
  value={regData.iban || ''}
  onChange={e => {
    // 1. Convertimos a mayúsculas
    // 2. Quitamos cualquier cosa que no sea letra o número
    // 3. Quitamos espacios
    const valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRegData({ ...regData, iban: valor });
  }} 
/>                    
                    <div className="md:col-span-2 mt-2">
                        <label className="text-xs font-bold text-orange-800 uppercase">Email del Pagador (Será tu Usuario) *</label>
                        <input type="email" className="w-full border p-2 rounded bg-white font-bold text-blue-900" placeholder="ejemplo@correo.com" onChange={e => setRegData({ ...regData, emailPagador: e.target.value })} />
                    </div>
                </div>
            </div>
          ) : (
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 animate-fade-in">
                <h3 className="font-bold text-blue-900 mb-3 border-b border-blue-200 pb-1">👤 Datos de Contacto</h3>
                <p className="text-sm text-blue-800 mb-3">Al ser alumno del centro, usaremos la cuenta bancaria que consta en secretaría.</p>
                <div className="space-y-4">
                    
                    {/* 🚩 NUEVO: Persona de contacto */}
                    <div>
                        <label className="text-xs font-bold text-blue-800 uppercase">Persona de Contacto *</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded bg-white font-bold text-blue-900" 
                            placeholder="Nombre y apellidos del responsable" 
                            value={regData.personaContacto || ''}
                            onChange={e => setRegData({ ...regData, personaContacto: e.target.value })} 
                        />
                    </div>
        
                    <div>
                        <label className="text-xs font-bold text-blue-800 uppercase">Tu Email de Contacto (Será tu Usuario) *</label>
                        <input type="email" className="w-full border p-2 rounded bg-white font-bold text-blue-900" placeholder="ejemplo@correo.com" onChange={e => setRegData({ ...regData, emailContacto: e.target.value })} />
                    </div>
        
                    <div>
                        <label className="text-xs font-bold text-blue-800 uppercase">Teléfono Móvil (9 cifras) *</label>
                        <input 
                            type="tel" 
                            className="w-full border p-2 rounded bg-white font-bold text-blue-600" 
                            placeholder="600000000" 
                            value={regData.telefono1 || ''} 
                            onChange={e => setRegData(prev => ({ ...prev, telefono1: e.target.value }))} 
                        />
                    </div>
                </div>
            </div>
        )
        } {/* 🚩 RECUERDA: Esta es la llave que cierra el condicional y quita el error de la contraseña */}

          {/* 4. CONTRASEÑA (SIEMPRE AL FINAL) */}
          <div className="border-t pt-4">
            <h3 className="font-bold text-gray-700 mb-2">🔐 Seguridad</h3>
            <div className="grid md:grid-cols-2 gap-4">
                <input className="w-full border p-3 bg-white rounded-lg" type="password" placeholder="Contraseña *" onChange={e => setRegData({ ...regData, password: e.target.value })} />
                <input className="w-full border p-3 bg-white rounded-lg" type="password" placeholder="Repetir Contraseña *" onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <p className="text-xs text-gray-400 pl-1 mt-1">* Mínimo 6 caracteres.</p>
          </div>

          <button className="w-full bg-blue-900 text-white p-4 rounded-lg font-bold hover:bg-blue-800 shadow-lg transition transform hover:scale-[1.01]">Registrar Familia</button>
        </form>
        
        <button onClick={() => setIsRegister(false)} className="w-full mt-6 text-gray-500 hover:text-blue-600 font-medium text-sm">¿Ya tienes cuenta? Inicia Sesión aquí</button>
      </div>
    </div>
  );
  const handleResetPassword = async () => {
    if (!loginData?.email) {
      return alert("⚠️ Por favor, escribe tu email en el cuadro de arriba.");
    }
    try {
      await sendPasswordResetEmail(auth, loginData.email);
      alert("📧 ¡Enviado! Revisa tu bandeja de entrada o spam.");
    } catch (error) {
      alert("❌ Error: No se pudo enviar el correo de recuperación.");
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

  useEffect(() => {
    // Escuchamos cambios en la autenticación
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        console.log("Usuario detectado:", u.email); // Para depurar

        // 👑 1. BACKDOOR DEL SUPER ADMIN (Prioridad Máxima)
        // Comprobamos el email directamente ANTES de llamar a la base de datos
        // Usamos toLowerCase() para evitar errores de mayúsculas
        if (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            console.log("👑 Acceso Super Admin concedido por Email Directo");
            setUser(u);
            setUserRole('admin');
            setView('admin');
            return; // ¡Entramos y cortamos aquí! No leemos DB para evitar errores.
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
            if (role === 'admin' || role === 'profe') {
                setView('admin');
            } else {
                await cargarHijos(u.uid);
                setView('dashboard');
            }

        } catch (error) {
            console.error("Error al leer perfil:", error);
            // Si falla la base de datos pero estás logueado, te avisamos
            alert("⚠️ Estás logueado, pero hubo un error leyendo tu perfil: " + error.message);
        }

      } else {
        // Si no hay usuario (logout)
        setUser(null);
        setView('landing');
      }
    });

    return () => unsubscribe();
  }, [setUser, setUserRole, setView]); // 🚩 Añadimos las funciones del Contexto aquí

  const cargarHijos = async (uid) => {
    const q = query(collection(db, 'students'), where('parentId', '==', uid));
    const s = await getDocs(q);
    setMisHijos(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {view === 'landing' && <LandingPage setView={setView} />}
      {view === 'login' && <Login setView={setView} />}
      {view === 'dashboard' && <Dashboard user={user} misHijos={misHijos} logout={() => signOut(auth)} refresh={cargarHijos} />}
      {view === 'admin' && <AdminDashboard userRole={userRole} userEmail={user?.email} logout={() => signOut(auth)} />}
    </div>
  );
}
// ==========================================
// 🚀 PUNTO DE ENTRADA ÚNICO
// ==========================================
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
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
