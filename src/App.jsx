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

// HE CREADO ESTA LISTA NUEVA CON LAS VIEJAS + LAS NUEVAS
const GALERIA = [
  'https://i.ibb.co/hJxW45tC/20241210-084225.jpg',
  'https://i.ibb.co/mrJHGscm/Screenshot-2025-05-09-15-04-17.png',
  'https://i.ibb.co/Psstvn93/20241210-084647.jpg',
  'https://i.ibb.co/gFT6zfHC/20241210-083956.jpg',
  'https://i.ibb.co/pvDBMSbv/20241210-083700.jpg',
  'https://i.ibb.co/9B0Fb23/20241210-083619.jpg'
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
    descripcion: 'Iniciación y familiarización con el medio acuático. El monitor está dentro del agua para mayor seguridad y confianza.\n\n⬇️ HORARIOS ⬇️\n• 1 día/sem (45€): Lunes a Viernes (16:00-17:00).', 
    aviso: 'Mínimo 5 alumnos.',
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
    descripcion: 'Desarrollo de estilos y técnica. Se divide en subgrupos por nivel. Ideal para perfeccionar la natación.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (65€): L/X o M/J.\n⭐ DÍA SUELTO (45€): L, M, X, J o V.', 
    aviso: 'Mínimo 6 alumnos.',
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
    descripcion: 'Sesiones breves, dinámicas y muy seguras para avanzar en autonomía acuática. Grupos reducidos.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Cualquier día.', 
    aviso: 'Mínimo 4 alumnos.',
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
    descripcion: 'Para quienes quieren seguir mejorando técnica y condición física. Ideal como complemento a otras actividades deportivas.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€).\n⭐ DÍA SUELTO (37€).', 
    aviso: 'Mínimo 4 alumnos.',
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
    descripcion: 'Iniciación al waterpolo. Deporte de equipo, balón y natación. Fomenta el compañerismo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (60€): L/X o M/J.\n⭐ DÍA SUELTO (45€): L, M, X, J o V.', 
    aviso: 'Mínimo 7 alumnos.',
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
    descripcion: 'Actividad de bajo impacto ideal para mantenerse en forma sin sobrecargar articulaciones. Mejora la movilidad y el tono muscular.\n\n⬇️ HORARIOS ⬇️\n• PACK 2 DÍAS (50€): Martes y Jueves (17:30-18:15).', 
    aviso: 'Mínimo 5 alumnos.',
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
    descripcion: 'Clases para adultos que quieran mantenerse activos o mejorar su estilo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Cualquier día.\n(Horarios variables según el día).', 
    aviso: 'Mínimo 4 alumnos.',
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
    descripcion: 'Sesiones específicas para adolescentes, con técnica, mantenimiento o preparación física.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): Tardes.\n⭐ DÍA SUELTO (37€): Tarde o Mediodía.', 
    aviso: 'Mínimo 4 alumnos.',
    opciones: [
        { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:30-19:00', precio: '50€' },
        { dias: '[1 DÍA] Lunes', horario: '18:30-19:00', precio: '37€' },
        { dias: '[1 DÍA] Miércoles', horario: '18:30-19:00', precio: '37€' },
        { dias: '[1 DÍA] Viernes', horario: '14:15-15:00', precio: '37€' }
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

// Formato de fecha para ID (YYYY-MM-DD)
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
  Escuela de Natación <br /> 
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
          
          {/* VISTA ACTIVIDADES (CON TARJETAS AZULES COMPLETAS) */}
          {tab === 'actividades' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {OFERTA_ACTIVIDADES.map((act) => (
                <div key={act.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col hover:shadow-xl transition-shadow">
                  {/* Encabezado Azul */}
                  <div className="bg-blue-600 p-4 relative">
                    <h3 className="text-white font-bold text-lg pr-8">{act.nombre}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-blue-800 text-white text-xs px-2 py-1 rounded shadow-sm font-mono">
                        📅 {act.diasResumen}
                      </span>
                      {act.requierePrueba && (
                        <span className="bg-red-500 text-white text-[10px] md:text-xs px-2 py-1 rounded font-bold shadow-sm animate-pulse whitespace-nowrap">
                          ❗ Requiere Prueba de nivel
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Cuerpo de la tarjeta */}
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-gray-600 text-sm mb-4 flex-1 whitespace-pre-line leading-relaxed">
                      {act.descripcion}
                    </p>
                    {/* Aviso amarillo */}
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800 mb-4 font-medium flex gap-2">
                      <span>⚠️</span>
                      <span>{act.aviso}</span>
                    </div>
                    {/* Precio al final */}
                    <div className="border-t pt-3 mt-auto flex justify-end items-center">
                       <span className="text-xs text-gray-400 mr-2">Precio:</span>
                       <p className="text-2xl font-black text-blue-600">{act.precioResumen}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VISTA INFO COMPLETA (TEXTOS LARGOS RECUPERADOS) */}
          {tab === 'info' && (
            <div className="space-y-10 animate-fade-in">
               {/* MAPA */}
               <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">🗺️ Mapa de Accesos</h3>
                  <div className="w-full bg-gray-100 rounded-lg overflow-hidden border relative flex justify-center p-4">
                      <img src={MAPA_IMAGEN_URL} className="max-h-[500px] object-contain rounded shadow-sm" alt="Mapa" />
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Acceso por el portón azul al final del patio.</p>
               </div>

              {/* MATERIAL NECESARIO */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-blue-600 p-4 text-white font-bold text-lg flex items-center gap-2">🎒 Material Necesario</div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
                  <div className="flex flex-col items-center"><span className="text-3xl mb-2">👙</span> <span className="font-bold text-gray-700">Bañador</span></div>
                  <div className="flex flex-col items-center"><span className="text-3xl mb-2">🧼</span> <span className="font-bold text-gray-700">Toalla</span></div>
                  <div className="flex flex-col items-center"><span className="text-3xl mb-2">🥽</span> <span className="font-bold text-gray-700">Gafas</span></div>
                  <div className="flex flex-col items-center"><span className="text-3xl mb-2">🎩</span> <span className="font-bold text-gray-700">Gorro</span></div>
                  <div className="flex flex-col items-center"><span className="text-3xl mb-2">🩴</span> <span className="font-bold text-gray-700">Chanclas</span></div>
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
              {/* ⚠️ NORMATIVA DE BAJAS Y ALTAS (SE MANTIENE IGUAL)        */}
              {/* ======================================================== */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-8">
                <h3 className="text-2xl font-bold text-amber-800 mb-6">⚠️ Normativa de Bajas y Altas</h3>
                <div className="grid md:grid-cols-1 gap-6">
                  <div>
                    <h4 className="font-bold text-amber-900 text-lg mb-2">📅 Bajas</h4>
                    <p className="text-amber-900 text-sm">
                      La fecha límite para solicitar la baja es el <strong>día 25 de cada mes</strong>. Si se comunica después, se cobrará el mes siguiente completo sin excepciones.
                    </p>
                  </div>
                  <div className="border-t border-amber-200 pt-6">
                    <h4 className="font-bold text-amber-900 text-lg mb-2">🆕 Altas y Mensualidades</h4>
                    <p className="text-amber-900 text-sm">
                      Si el alumno se incorpora una vez iniciado el mes, se deberá abonar la <strong>mensualidad completa</strong>. No se realizan prorrateos por días sueltos.
                    </p>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* 📞 NUEVA SECCIÓN: CONTACTO Y UBICACIÓN (AÑADIDA)         */}
              {/* ======================================================== */}
              <div className="grid md:grid-cols-2 gap-6 pt-4">
                
                {/* TARJETA DE CONTACTO */}
                <div className="bg-white border-l-4 border-blue-500 rounded-xl p-6 shadow-md hover:shadow-lg transition">
                  <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">📞 Contacto</h3>
                  
                  <div className="space-y-5">
                    {/* Teléfono */}
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-lg">☎️</div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Secretaría</p>
                            <a href="tel:915267161" className="text-xl font-bold text-blue-700 hover:text-blue-900 transition">
                                915 26 71 61
                            </a>
                        </div>
                    </div>

                    {/* Emails */}
                    <div className="flex items-start gap-3 border-t border-gray-100 pt-4">
                        <div className="bg-orange-100 p-2 rounded-full text-lg">📧</div>
                        <div className="flex flex-col gap-1 w-full">
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Correos Electrónicos</p>
                            <a href="mailto:extraescolarespiscina@sanbuenaventura.org" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition break-all">
                                • extraescolarespiscina@sanbuenaventura.org
                            </a>
                            <a href="mailto:extraescolares@sanbuenaventura.org" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition break-all">
                                • extraescolares@sanbuenaventura.org
                            </a>
                        </div>
                    </div>
                  </div>
                </div>

                {/* TARJETA DE UBICACIÓN */}
                <div className="bg-white border-l-4 border-green-500 rounded-xl p-6 shadow-md hover:shadow-lg transition flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-2">📍 Ubicación</h3>
                    
                    <div className="flex items-start gap-3 mb-6">
                        <div className="bg-green-100 p-2 rounded-full text-lg">🏫</div>
                        <div>
                            <p className="font-bold text-gray-800">Colegio San Buenaventura</p>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                C. de El Greco, 16,<br/>
                                Latina, 28011 Madrid
                            </p>
                        </div>
                    </div>
                  </div>

                  <a 
                    href="https://www.google.com/maps/search/?api=1&query=Calle+de+El+Greco+16+Madrid" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow transform hover:-translate-y-1"
                  >
                    🗺️ Cómo llegar (Google Maps)
                  </a>
                </div>

              </div>

            </div>
          )}

{/* VISTA INSTALACIONES */}
{tab === 'instalaciones' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {GALERIA.map((foto, index) => (
                <img 
                  key={index} 
                  src={foto} 
                  className="w-full h-64 object-cover rounded-xl shadow hover:scale-105 transition duration-300" 
                  alt={`Instalación ${index + 1}`} 
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-8 text-center text-sm text-gray-400 mt-10 rounded-xl">
        <p>© 2026 Colegio San Buenaventura - Escuela de Natación</p>
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
  const [nuevoAviso, setNuevoAviso] = useState('');
  
  const [newStaff, setNewStaff] = useState({ email: '', password: '', role: 'profe' });
  const [loadingStaff, setLoadingStaff] = useState(false);

  // ESTADO PARA LA FICHA (ALUMNO SELECCIONADO)
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);

  const soySuperAdmin = userRole === 'admin'; 

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
  
  // Abrir Ficha: Combina datos del alumno con los del padre
  const abrirFicha = (alumno) => {
      const datosPadre = padres[alumno.parentId] || {};
      setAlumnoSeleccionado({ ...alumno, datosPadre });
  };

  const validarPlaza = async (alumno) => {
    if (userRole !== 'admin') return alert("⛔ Solo coordinadores.");
    
    const grupoFinal = alumno.actividad || "GRUPO A DETERMINAR";
    
    if (confirm(`✅ ¿Validar plaza para ${alumno.nombre}?`)) {
        // Cogemos la fecha de HOY (AAAA-MM-DD)
        const hoy = new Date().toISOString().split('T')[0];

        await updateDoc(doc(db, 'students', alumno.id), { 
            estado: 'inscrito', 
            actividad: grupoFinal, 
            validadoAdmin: true,
            fechaAlta: hoy,      // ✅ Pone la fecha de hoy
            fechaBaja: null      // 🧹 LIMPIEZA: Borra la fecha de baja si tenía una vieja
        });
    }
};
// ⚡ FUNCIÓN NUEVA: Pone fecha de hoy a los de Infantil que no la tengan
const fijarAltaHoy = async (e, alumno) => {
  e.stopPropagation(); // Para que no se abra la ficha al hacer clic
  if (userRole !== 'admin') return;
  
  const hoy = new Date().toISOString().split('T')[0];
  if (confirm(`📅 ¿Asignar fecha de HOY (${hoy}) como alta para ${alumno.nombre}?`)) {
      await updateDoc(doc(db, 'students', alumno.id), { fechaAlta: hoy });
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

  // --- 4. LISTAS FILTRADAS ---
  const gruposUnicos = [...new Set(alumnos.map(a => a.actividad).filter(g => g))].sort();
  
// --- 1. LISTADO GLOBAL (MODIFICADO PARA INFANTIL) ---
const listadoGlobal = alumnos.filter(a => {
  const coincideNombre = (a.nombre || '').toLowerCase().includes(busqueda.toLowerCase());
  const coincideGrupo = filtroGrupo ? a.actividad === filtroGrupo : true;
  
  // DETECTAMOS SI ES INFANTIL (buscando la palabra en curso o actividad)
  const esInfantil = (a.curso || '').toUpperCase().includes('INFANTIL') || (a.actividad || '').toUpperCase().includes('INFANTIL');

  // REGLA: Pasa si tiene el OK del admin... O SI ES INFANTIL (Pase VIP)
  const debeAparecer = (a.validadoAdmin === true) || esInfantil;

  // Importante: Que no sea una baja
  const noEsBaja = a.estado !== 'baja_pendiente' && a.estado !== 'baja_finalizada';

  return coincideNombre && coincideGrupo && debeAparecer && noEsBaja;
});

// --- 2. LISTADO PRUEBAS (MODIFICADO PARA QUE NO SALGA INFANTIL) ---
const listadoPruebas = alumnos.filter(a => {
  // Excluimos a los que se están dando de baja o son antiguos
  if (a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada' || a.esAntiguoAlumno) return false;
  
  // DETECTAMOS SI ES INFANTIL
  const esInfantil = (a.curso || '').toUpperCase().includes('INFANTIL') || (a.actividad || '').toUpperCase().includes('INFANTIL');
  
  // SI ES INFANTIL, LO ECHAMOS DE AQUÍ (Ya sale en la Global, no hay que validarlo)
  if (esInfantil) return false;

  // Si tiene cita, sale.
  if (a.estado === 'prueba_reservada') return true;

  // Si está inscrito (Adulto/Primaria) y NO tiene el OK, sale para que lo valides.
  return (a.estado === 'inscrito' && !a.validadoAdmin);
});

// 2. CORRECCIÓN BAJAS: Añadimos 'baja_finalizada' para que no desaparezcan
const listadoBajas = alumnos.filter(a => a.estado === 'baja_pendiente' || a.estado === 'baja_finalizada');

  // --- 5. RENDERIZADO (HTML) ---
  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans relative">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded shadow">
        <div>
            <h1 className="text-xl font-bold text-gray-800">Panel de Gestión</h1>
            <p className="text-xs text-gray-500">{userEmail} ({userRole})</p>
        </div>
        <div className="flex gap-2">
            {userRole === 'admin' && <button onClick={descargarExcel} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold">Excel</button>}
            <button onClick={logout} className="text-red-500 border border-red-200 px-3 py-1 rounded text-sm font-bold">Salir</button>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
          {['global', 'pruebas', 'bajas', 'equipo', 'avisos'].map(t => {
             if ((t === 'equipo' || t === 'bajas') && userRole !== 'admin') return null;
             let count = 0; if (t === 'pruebas') count = listadoPruebas.length; if (t === 'bajas') count = listadoBajas.length;
             return (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold uppercase text-sm whitespace-nowrap flex items-center gap-2 ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                    {t.toUpperCase()} {count > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{count}</span>}
                </button>
             );
          })}
      </div>

     {/* TAB: GLOBAL (CORREGIDO: INFANTIL SALE DIRECTO SIN BOTONES) */}
     {tab === 'global' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4">
                  <input className="flex-1 border p-2 rounded" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                  <select className="border p-2 rounded md:w-1/3" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
                      <option value="">📂 Todos los Grupos</option>
                      {gruposUnicos.map(g => (<option key={g} value={g}>{g}</option>))}
                  </select>
              </div>
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs"><tr><th className="p-3">Alumno</th><th className="p-3">Actividad</th><th className="p-3 text-right"></th></tr></thead>
                  <tbody>
                      {listadoGlobal.length > 0 ? listadoGlobal.map(a => (
                          <tr 
                            key={a.id} 
                            onClick={() => abrirFicha(a)} 
                            className={`border-b cursor-pointer transition ${a.estado === 'baja_pendiente' ? 'bg-red-50' : 'hover:bg-blue-50'}`}
                          >
                              <td className="p-3">
                                <span className="font-bold text-gray-900 block">{a.nombre}</span>
                                {a.estado === 'baja_pendiente' && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">BAJA PENDIENTE</span>}
                                
                                {/* AQUI YA NO HAY BOTÓN DE INFANTIL */}

                                {/* 👉 AQUÍ SIGUE ESTANDO LA LETRA VISIBLE */}
                                <div className="text-blue-600 font-bold text-xs mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded">
                                    {a.curso} - {a.letra}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-gray-800">{a.actividad || '-'}</div>
                                {a.dias && <div className="text-[10px] text-gray-500 mt-1">📅 {a.dias} | ⏰ {a.horario}</div>}
                                
                                {/* Si tiene fecha de alta la mostramos (informativo), si no, no pasa nada */}
                                {a.fechaAlta && <div className="text-[10px] text-green-600 font-bold mt-1">Alta: {a.fechaAlta}</div>}
                              </td>
                              <td className="p-3 text-right">{userRole === 'admin' && <button onClick={(e) => borrarAlumno(e, a.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full">🗑️</button>}</td>
                          </tr>
                      )) : <tr><td colSpan="3" className="p-8 text-center text-gray-400">No hay resultados.</td></tr>}
                  </tbody>
              </table>
          </div>
      )}

      {/* TAB: PRUEBAS */}
      {tab === 'pruebas' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-3 bg-blue-50 text-blue-800 text-xs font-bold border-b">ℹ️ Validar Plazas</div>
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs"><tr><th className="p-3">Cita</th><th className="p-3">Alumno</th><th className="p-3">Solicita</th><th className="p-3 text-right">Acción</th></tr></thead>
                  <tbody>
                      {listadoPruebas.map(a => (
                          <tr key={a.id} onClick={() => abrirFicha(a)} className="hover:bg-orange-50 cursor-pointer border-b">
                              <td className="p-3 text-blue-600 font-bold">{a.citaNivel || 'Sin hora'}</td>
                              <td className="p-3 font-bold">
                                  {a.nombre}
                                  <div className="text-[10px] text-gray-400 font-normal">{a.estado === 'inscrito' ? 'Pre-inscrito' : 'Reserva'}</div>
                                  <span className="text-blue-600 text-xs font-bold">{a.curso} - {a.letra}</span>
                              </td>
                              <td className="p-3"><span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">{a.actividad || 'Sin elegir'}</span></td>
                              <td className="p-3 text-right"><button onClick={(e) => { e.stopPropagation(); validarPlaza(a); }} className="bg-green-500 text-white px-3 py-1 rounded font-bold text-xs shadow hover:bg-green-600">✅ OK</button></td>
                          </tr>
                      ))}
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
            userRole={userRole}  // 👈 ¡IMPORTANTE! AÑADE ESTA LÍNEA
        />
      )}
    </div>
  );
};

// ==========================================
// 📄 COMPONENTE FICHA (CON FECHAS Y GUARDADO AUTOMÁTICO)
// ==========================================
function FichaAlumno({ alumno, cerrar, userRole }) {
  if (!alumno) return null;
  const p = alumno.datosPadre || {}; 

  // Función que guarda la fecha en Firebase al instante
  const cambiarFecha = async (campo, e) => {
      // 1. Si no eres admin, no dejamos guardar
      if (userRole !== 'admin') return;
      
      const nuevaFecha = e.target.value;

      try {
          // Usamos las herramientas (db, updateDoc, doc) que importaste al principio del archivo
          await updateDoc(doc(db, 'students', alumno.id), { 
              [campo]: nuevaFecha 
          });
      } catch (error) {
          console.error("Error al guardar fecha:", error);
          alert("❌ Error: No se pudo guardar la fecha. Comprueba tu conexión.");
      }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
        
        {/* CABECERA */}
        <div className="bg-blue-900 p-5 text-white flex justify-between items-start sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">{alumno.nombre}</h2>
            <div className="mt-2 flex items-center gap-3">
              <span className="bg-blue-700 px-3 py-1 rounded text-sm font-bold">{alumno.curso}</span>
              <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded text-sm font-bold shadow-sm">Letra: {alumno.letra || '?'}</span>
            </div>
          </div>
          <button onClick={cerrar} className="bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition">✕</button>
        </div>

        {/* CONTENIDO */}
        <div className="p-6 space-y-6 text-gray-800">
          
          {/* --- AQUÍ ESTÁN LAS FECHAS DE ALTA Y BAJA --- */}
          <div className="bg-gray-100 p-4 rounded border border-gray-300 grid grid-cols-2 gap-4 shadow-inner">
              {/* ALTA */}
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">📅 Fecha de Alta</label>
                  <input 
                    type="date" 
                    defaultValue={alumno.fechaAlta || ''}
                    disabled={userRole !== 'admin'} // Bloqueado si no eres admin
                    onChange={(e) => cambiarFecha('fechaAlta', e)}
                    className={`w-full p-2 rounded border font-bold ${
                        userRole === 'admin' 
                        ? 'bg-white border-blue-400 cursor-pointer hover:bg-blue-50' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  />
              </div>

              {/* BAJA */}
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">🏁 Fecha de Baja</label>
                  <input 
                    type="date" 
                    defaultValue={alumno.fechaBaja || ''}
                    disabled={userRole !== 'admin'} // Bloqueado si no eres admin
                    onChange={(e) => cambiarFecha('fechaBaja', e)}
                    className={`w-full p-2 rounded border font-bold ${
                        userRole === 'admin' 
                        ? 'bg-white border-red-400 cursor-pointer hover:bg-red-50' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  />
              </div>
              
              {userRole === 'admin' && (
                  <p className="col-span-2 text-[10px] text-gray-400 text-center italic mt-1">
                      * Al cambiar la fecha se guarda automáticamente.
                  </p>
              )}
          </div>
          {/* --------------------------------------------- */}

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
             <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Actividad Inscrita</h3>
             <p className="text-xl font-bold text-blue-900">{alumno.actividad || 'Pendiente de asignar'}</p>
             {alumno.dias && <p className="text-sm text-blue-700 mt-1 font-medium">📅 {alumno.dias} — ⏰ {alumno.horario}</p>}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded border"><span className="text-xs text-gray-500 uppercase font-bold">Nacimiento</span><p className="font-medium">{alumno.fechaNacimiento || '-'}</p></div>
            <div className="bg-gray-50 p-3 rounded border"><span className="text-xs text-gray-500 uppercase font-bold">Estado</span><p className="font-medium">{alumno.esAntiguoAlumno ? '✅ Antiguo Alumno' : '🆕 Nuevo Alumno'}</p></div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">💳 Datos del Pagador / Tutor</h3>
            <div className="grid md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div><span className="block text-gray-500 text-xs font-bold uppercase">Nombre Titular</span><span className="font-medium text-lg">{alumno.nombrePagador || p.nombrePagador || '-'}</span></div>
              <div><span className="block text-gray-500 text-xs font-bold uppercase">DNI</span><span className="font-medium">{alumno.dniPagador || p.dniPagador || '-'}</span></div>
              <div><span className="block text-gray-500 text-xs font-bold uppercase">Teléfono</span><span className="font-medium text-lg">{alumno.telefono1 || p.telefono1 || '-'}</span></div>
              <div><span className="block text-gray-500 text-xs font-bold uppercase">Email</span><span className="font-medium">{alumno.emailContacto || p.email || '-'}</span></div>
              <div className="md:col-span-2 bg-gray-100 p-3 rounded font-mono text-gray-700 border"><span className="block text-gray-400 text-[10px] font-bold uppercase mb-1">IBAN</span>{alumno.iban || p.iban || 'No indicado'}</div>
            </div>
          </div>

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
          
          // ¿Tiene plaza real? (Si el admin validó O si es infantil)
          const estaAdmitido = hijo.validadoAdmin === true || esInfantil;
          
          // ¿Está libre para inscribirse? (Si no tiene nada O si ya terminó su baja)
          const estaLibre = hijo.estado === 'sin_inscripcion' || hijo.estado === 'baja_finalizada';
          
          let bordeColor = 'bg-gray-400';
          let estadoTexto = 'Sin Actividad';
          
          // 2. CONFIGURAMOS COLORES
          if (hijo.estado === 'inscrito') {
              if (estaAdmitido) {
                  bordeColor = 'bg-green-500';
                  estadoTexto = '✅ Inscrito';
              } else {
                  bordeColor = 'bg-yellow-400';
                  estadoTexto = '⏳ Pendiente Validación';
              }
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
                    {hijo.nombre} <button onClick={() => setAlumnoEditar(hijo)} className="text-gray-400 hover:text-blue-600 bg-gray-50 p-1.5 rounded-full">✏️</button>
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">{hijo.curso} • {hijo.letra}</p>
                </div>
                <div className="flex flex-col items-end gap-2"><span className="px-2 py-1 rounded text-[10px] font-extrabold uppercase bg-gray-100 text-gray-500">{estadoTexto}</span></div>
              </div>

              {/* DATOS DE ACTIVIDAD (Inscrito o Baja Pendiente) */}
              {(hijo.estado === 'inscrito' || hijo.estado === 'baja_pendiente') && (
                <div className={`ml-3 mt-4 p-3 rounded-lg border text-sm 
                    ${hijo.estado === 'baja_pendiente' ? 'bg-red-50 border-red-200' : 
                      !estaAdmitido ? 'bg-yellow-50 border-yellow-200' : 
                      'bg-green-50 border-green-100'
                    }`}>
                  
                  {/* CASO: PENDIENTE DE VALIDAR (AMARILLO) */}
                  {!estaAdmitido && hijo.estado === 'inscrito' ? (
                      <div className="text-center">
                          <p className="font-bold text-yellow-900 text-sm uppercase mb-1">{hijo.actividad}</p>
                          <div className="flex justify-center gap-2 text-yellow-800 text-xs mb-2 opacity-80">
                              <span>📅 {hijo.dias}</span><span>⏰ {hijo.horario}</span>
                          </div>
                          <div className="bg-white/50 rounded p-1 border border-yellow-200">
                              <p className="font-bold text-yellow-800 text-xs">⏳ Solicitud Recibida</p>
                              <p className="text-[10px] text-yellow-700">El coordinador está validando el nivel.</p>
                          </div>
                      </div>
                  ) : (
                      /* CASO: ADMITIDO O BAJA PENDIENTE */
                      <>
                        <p className="font-bold mb-1 text-gray-800">{hijo.actividad}</p>
                        <div className="flex items-center gap-2 text-gray-600"><span>📅 {hijo.dias}</span><span>⏰ {hijo.horario}</span></div>
                        {hijo.estado === 'baja_pendiente' && <p className="text-red-600 font-bold text-xs mt-2">⚠️ Baja efectiva a fin de mes</p>}
                      </>
                  )}
                </div>
              )}
              
              {/* DATOS DE PRUEBA */}
              {hijo.estado === 'prueba_reservada' && (
                <div className="ml-3 mt-4 bg-orange-50 p-3 rounded-lg border border-orange-200 text-sm">
                  <div className="mb-3 pb-3 border-b border-orange-200">
                      <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">🎯 Grupo Pre-seleccionado:</p>
                      {hijo.actividad ? (
                          <div>
                            <p className="text-lg font-black text-orange-900 leading-tight">{hijo.actividad}</p>
                            {/* --- AQUÍ AÑADIMOS LOS DÍAS Y EL HORARIO --- */}
                            <div className="flex gap-3 text-orange-800 text-xs mt-1 font-bold">
                                <span>📅 {hijo.dias || 'Días pendientes'}</span>
                                <span>⏰ {hijo.horario || 'Horario pendiente'}</span>
                            </div>
                          </div>
                      ) : (
                          <button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} className="w-full bg-white border border-orange-300 text-orange-700 py-1.5 rounded text-xs font-bold hover:bg-orange-100">
                              👉 Elegir Grupo
                          </button>
                      )}
                  </div>
                  
                  {/* ... resto del código de la cita de nivel ... */}
                  <div className="flex items-center gap-2">
                      <span className="text-2xl">🗓️</span>
                      <div>
                          <p className="font-bold text-orange-900 text-xs uppercase">Cita para Prueba</p>
                          {hijo.citaNivel ? (
                              <p className="text-orange-800 font-bold">{hijo.citaNivel}</p>
                          ) : (
                              <button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('prueba'); }} className="text-red-600 font-bold underline cursor-pointer animate-pulse hover:text-red-800">
                                  ¡Reservar Hora!
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
    const telefonoLimpio = data?.telefono ? String(data.telefono).trim() : "";
    
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
            <p className="text-sm font-bold text-blue-800 mb-2">¿Estuvo en natación el curso pasado?</p>
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
    fechaNacimiento: alumno.fechaNacimiento || '' 
  });
  
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

  // 2. FUNCIÓN DE INSCRIPCIÓN
  const inscribir = async (act, op) => {
    if (normasRef.current !== true) {
        return alert("⚠️ Es obligatorio aceptar las normas.");
    }
    
    // 🔄 LECTURA DE SEGURIDAD
    const alumnoRef = doc(db, 'students', alumno.id);
    const snap = await getDoc(alumnoRef);
    const d = snap.exists() ? snap.data() : alumno;

    // 🕵️‍♂️ MODO DETECTIVE: Esto te dirá en la consola (F12) qué está pasando
    console.log("DEBUG INSCRIPCIÓN:", {
        nombre: d.nombre,
        curso: d.curso,
        natacionPasado: d.natacionPasado,
        esAntiguo: d.esAntiguoAlumno
    });

    const datosComunes = {
        nombre: d.nombre, 
        curso: d.curso, 
        actividad: act.nombre,
        dias: op.dias,
        horario: op.horario,
        precio: op.precio,
        estado: 'inscrito', // Por defecto los VIP entran como inscritos
        fechaInscripcion: new Date().toISOString()
    };

    // 🛡️ EL FILTRO DEFINITIVO (Pase VIP)
    const cursoNombre = (d.curso || '').toUpperCase();
    const esInfantil = cursoNombre.includes('INF');
    
    // Comprobamos todas las formas en las que hayamos podido guardar el "SÍ"
    const tienePaseVIP = 
        d.natacionPasado === 'si' || 
        d.esAntiguoAlumno === true || 
        d.esAntiguoAlumno === 'true' ||
        d.antiguo === 'si';

    // CASO A: SOLO ENTRA SI NO ES INFANTIL Y NO ES VIP
    if (act.requierePrueba && !esInfantil && !tienePaseVIP && !d.citaNivel && d.estado !== 'prueba_reservada') {
        if(!confirm(`⚠️ Esta actividad requiere PRUEBA DE NIVEL.\n\n¿Continuar para elegir hora?`)) return;

        await updateDoc(alumnoRef, { 
            ...datosComunes,
            estado: 'prueba_reservada'
        });
        
        refresh(user.uid);
        onRequirePrueba();
        return; 
    }

    // CASO B: INSCRIPCIÓN DIRECTA (VIP e INFANTIL caen aquí)
    if (!confirm(`¿Confirmar inscripción definitiva en ${act.nombre}?`)) return;
    
    await updateDoc(alumnoRef, { 
        ...datosComunes,
        estado: 'inscrito'
    });
    
    alert("✅ ¡Inscripción realizada con éxito!");
    refresh(user.uid); 
    close();
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
            
            {/* DATOS BÁSICOS */}
            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nombre</label>
                    <input 
                        className="w-full border-b bg-transparent font-bold text-gray-800 focus:outline-none" 
                        value={datosAlumno.nombre} 
                        onChange={e=>setDatosAlumno({...datosAlumno, nombre: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Curso Escolar</label>
                    <div className="font-bold text-blue-600 bg-white px-2 py-1 rounded border inline-block">{datosAlumno.curso}</div>
                </div>
            </div>

            {/* CHECKBOX MANUAL (SIN INPUT NATIVO PARA EVITAR ERRORES) */}
            <div 
                onClick={toggleNormas}
                className={`p-4 rounded-lg mb-6 border transition cursor-pointer select-none flex items-start gap-3 
                ${aceptaNormasVisual ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'}`}
            >
                {/* Caja simulada del Checkbox */}
                <div className={`mt-1 w-6 h-6 rounded border flex items-center justify-center transition-colors ${aceptaNormasVisual ? 'bg-green-600 border-green-600' : 'bg-white border-gray-400'}`}>
                    {aceptaNormasVisual && <span className="text-white font-bold text-sm">✓</span>}
                </div>
                
                <div className="text-sm flex-1">
                    <span className={`font-bold block mb-1 ${aceptaNormasVisual ? 'text-green-800' : 'text-yellow-900'}`}>
                        {aceptaNormasVisual ? '✅ Normas aceptadas' : '⚠️ Aceptación requerida'}
                    </span>
                    <span className="text-gray-600">
                        He leído y acepto la normativa de la escuela, condiciones de pago y política de bajas (aviso día 25).
                    </span>
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
                                {act.opciones.map((op, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => inscribir(act, op)} 
                                        className="flex justify-between items-center w-full p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition text-left relative"
                                    >
                                        <div>
                                            <span className="block font-bold text-gray-800 group-hover:text-blue-700">
                                                {op.dias}
                                            </span>
                                            <span className="text-xs text-gray-500 font-mono bg-white px-1 rounded border mt-1 inline-block">
                                                ⏰ {op.horario}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full text-sm block">
                                                {op.precio}
                                            </span>
                                        </div>
                                    </button>
                                ))}
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
            Como <strong>{alumno.nombre}</strong> ya estuvo en natación el curso pasado, no necesita realizar la prueba de nivel.
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
      
      await updateDoc(doc(db, 'students', alumno.id), {
        estado: 'prueba_reservada',
        citaNivel: citaTexto,
        citaFecha: fecha,
        citaHora: hora,
        fechaSolicitud: new Date().toISOString()
      });

      if (user?.email) {
        // Llamamos a tu función personalizada del Portón Azul
        await enviarEmailConfirmacion(user.email, alumno.nombre, citaTexto);
      }

      alert("✅ ¡Cita confirmada! Revisa tu email.");
      if (onSuccess) onSuccess();
      close();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };
  // 🚀 ATAJO PARA ANTIGUOS ALUMNOS (PASE VIP)
  // Comprobamos si marcó 'si' en natacionPasado (o esAntiguoAlumno, según tu variable)
  if (alumno.natacionPasado === 'si' || alumno.esAntiguoAlumno === true) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
            ✅
          </div>
          <h3 className="text-2xl font-black text-blue-900 mb-2">¡Pase Directo!</h3>
          <p className="text-gray-600 mb-6 font-medium">
            Como <strong>{alumno.nombre}</strong> ya estuvo en natación el curso pasado, no necesita realizar la prueba de nivel.
          </p>
          <button 
            onClick={async () => {
              // Marcamos como exento en la base de datos por si acaso
              await updateDoc(doc(db, 'students', alumno.id), {
                citaNivel: 'EXENTO - ANTIGUO ALUMNO'
              });
              if (onSuccess) onSuccess(); // Esto abre el modal de inscripción automáticamente
              close();
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
          <button onClick={close} className="text-2xl hover:bg-white/20 rounded-full px-2">✕</button>
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

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-4">
          <button onClick={close} className="px-6 py-2 font-bold text-gray-400">Cancelar</button>
          <button 
            onClick={confirmarReserva}
            disabled={loading || !hora}
            className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl disabled:bg-gray-200"
          >
            {loading ? 'Confirmando...' : 'Confirmar Lunes'}
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
    // Datos Pagador (Solo Externos)
    nombrePagador: '', dniPagador: '', telefono1: '', telefono2: '', 
    direccion: '', cp: '', poblacion: '', iban: '', emailPagador: '',
    // Datos Alumno (Todos)
    nombreAlumno: '', 
    
    // 👇👇👇 AQUÍ ESTÁ EL CAMBIO 👇👇👇
    curso: 'INF3',  // Antes ponía '3PRI'. Ahora coincide con el primero de la lista.
    
    letra: 'A', fechaNacimiento: '', esAntiguoAlumno: false,
    alergias: '', observaciones: '',
    // Datos Contacto (Solo Internos)
    emailContacto: '', 
    // Password (Todos)
    password: ''
  });

  const validateAndRegister = async (e) => {
    e.preventDefault();
    
    // 1. Validaciones de Seguridad
    if (!regData.password || !confirmPassword) return alert("⛔ Escribe la contraseña dos veces.");
    if (regData.password !== confirmPassword) return alert("⛔ Las contraseñas NO coinciden.");
    if (regData.password.length < 6) return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");

    // 2. Validaciones Alumno
    if (!regData.nombreAlumno) return alert('⚠️ Falta el NOMBRE del alumno.');
    if (!regData.fechaNacAlumno) return alert('⚠️ Falta la FECHA DE NACIMIENTO.');

    // 3. Validaciones Específicas
    if (regData.tipo === 'externo') {
      if (!regData.nombrePagador) return alert('⚠️ Falta: Nombre del Pagador');
      if (!regData.dniPagador) return alert('⚠️ Falta: DNI del Pagador');
      
      // --- BLOQUEO TELÉFONO EXTERNO ---
      const tel1 = regData.telefono1 ? String(regData.telefono1).trim() : "";
      if (tel1.length < 9) return alert(`⛔ El teléfono debe tener 9 cifras (has puesto ${tel1.length})`);
      // --------------------------------
      
      if (!regData.direccion) return alert('⚠️ Falta: Dirección');
      if (!regData.cp) return alert('⚠️ Falta: Código Postal');
      if (!regData.iban) return alert('⚠️ Falta: IBAN Bancario');
      if (!regData.emailPagador) return alert('⚠️ Falta: EMAIL del Pagador (será tu usuario)');
  } else {
      // --- BLOQUEO TELÉFONO INTERNO ---
      // Si para internos usas otro campo de teléfono, asegúrate de que el nombre sea correcto (ej: regData.telefonoContacto)
      const telInterno = regData.telefono1 ? String(regData.telefono1).trim() : ""; 
      if (telInterno && telInterno.length < 9) {
          return alert(`⛔ El teléfono debe tener 9 cifras (has puesto ${telInterno.length})`);
      }
      // --------------------------------

      if (!regData.emailContacto) return alert('⚠️ Falta: Tu Email de contacto (será tu usuario)');
  }

    try {
      // El email de usuario será el del pagador (externo) o el de contacto (interno)
      const emailFinal = regData.tipo === 'externo' ? regData.emailPagador : regData.emailContacto;

      // Crear en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, emailFinal, regData.password);
      
      // Guardar Usuario (Padre/Pagador)
      await setDoc(doc(db, 'users', cred.user.uid), { 
          email: emailFinal, 
          role: 'user', 
          tipo: regData.tipo,
          ...(regData.tipo === 'externo' ? {
              nombrePagador: regData.nombrePagador, 
              dniPagador: regData.dniPagador, 
              telefono1: regData.telefono1, 
              telefono2: regData.telefono2,
              direccion: regData.direccion, 
              cp: regData.cp, 
              poblacion: regData.poblacion,
              iban: regData.iban
          } : {
              emailContacto: regData.emailContacto // Para internos guardamos el contacto
          })
      });
      
      // Guardar Alumno
      // Guardar Alumno (Corregido)
      await addDoc(collection(db, 'students'), { 
        parentId: cred.user.uid, 
        nombre: regData.nombreAlumno, 
        curso: regData.curso, 
        letra: regData.letra, 
        fechaNacimiento: regData.fechaNacAlumno, 
        
        // 🔑 AQUÍ ESTÁ EL ARREGLO:
        // Guardamos natacionPasado (que es lo que el filtro lee) 
        // basándonos en lo que viene del formulario
        natacionPasado: regData.natacionPasado || 'no',
        esAntiguoAlumno: regData.natacionPasado === 'si' ? true : false,
        
        alergias: regData.alergias || '', 
        observaciones: regData.observaciones || '',
        estado: 'sin_inscripcion', 
        aceptaNormas: false, 
        autorizaFotos: false 
    });
      
      alert("✅ ¡Registro completado! Ya puedes entrar.");
      // Limpiamos o redirigimos si quieres
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
                    <input className="border p-2 rounded bg-white" placeholder="Nombre Completo Titular *" onChange={e => setRegData({ ...regData, nombrePagador: e.target.value })} />
                    <input className="border p-2 rounded bg-white" placeholder="DNI / NIE *" onChange={e => setRegData({ ...regData, dniPagador: e.target.value })} />
                    
                    <input className="border p-2 rounded bg-white font-bold text-blue-600" placeholder="Teléfono 1 (9 cifras) *" onChange={e => setRegData({ ...regData, telefono1: e.target.value })} />
                    <input className="border p-2 rounded bg-white" placeholder="Teléfono 2" onChange={e => setRegData({ ...regData, telefono2: e.target.value })} />
                    
                    <input className="border p-2 rounded bg-white md:col-span-2" placeholder="Dirección Postal Completa *" onChange={e => setRegData({ ...regData, direccion: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        <input className="border p-2 rounded bg-white" placeholder="CP *" onChange={e => setRegData({ ...regData, cp: e.target.value })} />
                        <input className="border p-2 rounded bg-white" placeholder="Población *" onChange={e => setRegData({ ...regData, poblacion: e.target.value })} />
                    </div>
                    
                    <input className="border p-2 rounded bg-white md:col-span-2 font-mono border-orange-300" placeholder="IBAN (ES...) *" onChange={e => setRegData({ ...regData, iban: e.target.value })} />
                    
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
                      <div>
                          <label className="text-xs font-bold text-blue-800 uppercase">Tu Email de Contacto (Será tu Usuario) *</label>
                          <input type="email" className="w-full border p-2 rounded bg-white font-bold text-blue-900" placeholder="ejemplo@correo.com" onChange={e => setRegData({ ...regData, emailContacto: e.target.value })} />
                      </div>
                      {/* Aquí añadimos el móvil único para internos */}
                      <div>
                          <label className="text-xs font-bold text-blue-800 uppercase">Teléfono Móvil (9 cifras) *</label>
                          <input type="tel" className="w-full border p-2 rounded bg-white font-bold text-blue-600" placeholder="600000000" onChange={e => setRegData({ ...regData, telefono1: e.target.value })} />
                      </div>
                  </div>
              </div>
          )}

          {/* 3. DATOS DEL ALUMNO (SIEMPRE IGUAL) */}
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3 border-b pb-1">🎓 Primer Alumno</h3>
            <div className="grid md:grid-cols-2 gap-4">
  {/* Nombre: Ocupa todo el ancho */}
  <input 
    className="border p-2 rounded md:col-span-2 bg-white" 
    placeholder="Nombre y Apellidos del Alumno *" 
    onChange={e => setRegData({ ...regData, nombreAlumno: e.target.value })} 
  />
  {/* NUEVA PREGUNTA DE NATACIÓN */}
  <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-200 my-2">
      <p className="text-sm font-bold text-blue-900 mb-3">
        ¿Estuvo inscrito en natación extraescolar en este colegio durante el curso pasado?
      </p>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="radio" 
            name="natacionPasado" 
            checked={regData.natacionPasado === 'si'}
            onChange={() => setRegData({...regData, natacionPasado: 'si'})} 
          /> 
          <span className="text-sm font-medium text-gray-700">Sí (Sin prueba de nivel)</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="radio" 
            name="natacionPasado" 
            checked={regData.natacionPasado === 'no'}
            onChange={() => setRegData({...regData, natacionPasado: 'no'})} 
          /> 
          <span className="text-sm font-medium text-gray-700">No</span>
        </label>
      </div>
    </div>

  {/* Curso y Letra: Comparten fila */}
  <select className="border p-2 rounded bg-white" onChange={e => setRegData({ ...regData, curso: e.target.value })}>
    {LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
  </select>
  <select className="border p-2 rounded bg-white" onChange={e => setRegData({ ...regData, letra: e.target.value })}>
    <option>A</option><option>B</option><option>C</option>
  </select>



  {/* Fecha de Nacimiento: También en su propia fila */}
  <div className="md:col-span-2">
    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Fecha de Nacimiento *</label>
    <input 
      type="date" 
      className="w-full border p-2 rounded bg-white" 
      onChange={e => setRegData({ ...regData, fechaNacAlumno: e.target.value })} 
    />
  </div>

  {/* Alergias */}
  <textarea 
    className="border p-2 rounded md:col-span-2 text-sm bg-white" 
    placeholder="Alergias o problemas médicos (Opcional)" 
    rows="2" 
    onChange={e => setRegData({ ...regData, alergias: e.target.value })}
  ></textarea>
</div>
          </div>

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
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [view, setView] = useState('landing');
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
  }, []);

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
