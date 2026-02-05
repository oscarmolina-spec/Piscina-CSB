import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase.js'; 
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
const IMG_ESCUDO = 'https://i.ibb.co/v6gvHDfv/logo-BLANCO.png';
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
    nombre: '🤽‍♂️ Waterpolo (17:30-18:30)', 
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
            <p>Os confirmamos que la prueba de nivel ha sido reservada correctamente.</p>
            <div style="background: #EFF6FF; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0;">📅 <strong>Fecha:</strong> ${cita}</p>
              <p style="margin: 10px 0 0 0;">📍 <strong>Lugar:</strong> Piscina Colegio (Portón Azul).</p>
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
          <img src={IMG_ESCUDO} className="h-28 mx-auto mb-6 drop-shadow-2xl" alt="Escudo" />
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-md text-white [-webkit-text-stroke:2px_#2563eb]">
  Escuela de Natación <br /> San Buenaventura
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
// 🛡️ ADMIN DASHBOARD (SOLUCIÓN: PRUEBAS RESERVADAS + INSCRITOS SIN VALIDAR)
// ==========================================
const AdminDashboard = ({ userRole, logout, userEmail }) => {
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

  const soySuperAdmin = userEmail && userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    const unsubStudents = onSnapshot(query(collection(db, 'students')), (s) => setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(query(collection(db, 'users')), (s) => {
        const p = {}, t = [];
        s.forEach(d => { 
            const data = d.data();
            p[d.id] = data; 
            if (data.role === 'admin' || data.role === 'profe') t.push({ id: d.id, ...data });
        });
        setPadres(p); setEquipo(t);
    });
    const unsubAvisos = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => setAvisos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubStudents(); unsubUsers(); unsubAvisos(); };
  }, []);

  // ==========================================
  // 🧠 CÁLCULOS DE LISTAS
  // ==========================================

  // 1. LISTA GLOBAL
  const gruposUnicos = [...new Set(alumnos.map(a => a.actividad).filter(g => g))].sort();
  const listadoGlobal = alumnos.filter(a => {
      const coincideNombre = (a.nombre || '').toLowerCase().includes(busqueda.toLowerCase());
      const coincideGrupo = filtroGrupo ? a.actividad === filtroGrupo : true;
      const esRelevante = a.estado !== 'sin_inscripcion' || a.actividad; 
      return coincideNombre && coincideGrupo && esRelevante;
  });

  // 2. LISTA PRUEBAS (CORRECCIÓN: DETECTA A LOS "FALSOS INSCRITOS")
  const listadoPruebas = alumnos.filter(a => {
      // Regla 0: Si es baja o antiguo alumno, fuera.
      if (a.estado === 'baja_pendiente' || a.esAntiguoAlumno) return false;

      // Regla 1: Estado explícito de prueba
      const esPruebaOficial = a.estado === 'prueba_reservada';
      
      // Regla 2: El caso del error -> Está 'inscrito' Y tiene cita Y NO ha sido validado por el admin aun
      // (Usamos la propiedad 'validadoAdmin' para marcar los que ya revisaste)
      const esFalsoInscrito = a.estado === 'inscrito' && a.citaNivel && !a.validadoAdmin;

      return esPruebaOficial || esFalsoInscrito;
  });

  // 3. LISTA BAJAS
  const listadoBajas = alumnos.filter(a => a.estado === 'baja_pendiente');


  // ==========================================
  // ⚡ ACCIONES
  // ==========================================
  
  const validarPlaza = async (alumno) => {
      if (userRole !== 'admin') return alert("⛔ Solo coordinadores.");
      
      const grupoFinal = alumno.actividad || "GRUPO A DETERMINAR (Editar)";
      
      if (confirm(`✅ ¿VALIDAR PLAZA?\n\nAlumno: ${alumno.nombre}\nGrupo: ${grupoFinal}\n\nSe confirmará su inscripción definitivamente.`)) {
          await updateDoc(doc(db, 'students', alumno.id), { 
              estado: 'inscrito',
              actividad: grupoFinal,
              validadoAdmin: true // <--- ESTA ES LA CLAVE: Lo marcamos para que salga de la lista de pruebas
          });
          alert("🎉 Alumno validado correctamente.");
      }
  };

  const finalizarBaja = async (alumno) => {
      if (userRole !== 'admin') return alert("⛔ Solo coordinadores.");
      if (confirm(`🗑️ ¿HACER EFECTIVA LA BAJA?\n\n${alumno.nombre} saldrá de los listados.`)) {
          await updateDoc(doc(db, 'students', alumno.id), {
              estado: 'sin_inscripcion', actividad: null, dias: null, horario: null, precio: null,
              fechaInscripcion: null, citaId: null, citaNivel: null, fechaSolicitudBaja: null, validadoAdmin: null
          });
      }
  };

  // Auxiliares
  const borrarAlumno = async (id) => { if (userRole !== 'admin') return; if(confirm('⚠️ ¿Borrar definitivamente?')) await deleteDoc(doc(db, 'students', id)); }
  const agregarAviso = async (e) => { e.preventDefault(); if (!nuevoAviso) return; await addDoc(collection(db, 'avisos'), { texto: nuevoAviso, fecha: new Date().toISOString() }); setNuevoAviso(''); };
  const borrarAviso = async (id) => { if (confirm('¿Borrar aviso?')) await deleteDoc(doc(db, 'avisos', id)); };
  const handleCrearStaff = async (e) => { e.preventDefault(); if (userRole !== 'admin') return; setLoadingStaff(true); try { await crearUsuarioSecundario(newStaff.email, newStaff.password, newStaff.role); alert("Creado"); setNewStaff({ email: '', password: '', role: 'profe' }); } catch (e) { alert(e.message); } finally { setLoadingStaff(false); } };
  const borrarMiembroEquipo = async (miembro) => { if (miembro.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return alert("No puedes borrar al Super Admin"); if (confirm("¿Borrar usuario?")) await deleteDoc(doc(db, 'users', miembro.id)); };
  const getFinDeMes = (fecha) => { if(!fecha) return "-"; const d = new Date(fecha); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString(); };
  
  const descargarExcel = () => {
    const cabecera = ['Alumno,Estado,Grupo,Pagador\n'];
    const filas = listadoGlobal.map(a => `"${a.nombre}","${a.estado}","${a.actividad||'-'}","${padres[a.parentId]?.nombrePagador||''}"`);
    const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI(cabecera + filas.join("\n")); link.download = "listado.csv"; link.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded shadow">
        <div>
            <h1 className="text-xl font-bold text-gray-800">Panel de Gestión</h1>
            <p className="text-xs text-gray-500">{userEmail} ({soySuperAdmin ? 'Super Admin' : userRole})</p>
        </div>
        <div className="flex gap-2">
            {userRole === 'admin' && <button onClick={descargarExcel} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold">Excel</button>}
            <button onClick={logout} className="text-red-500 border border-red-200 px-3 py-1 rounded text-sm font-bold">Salir</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
          {['global', 'pruebas', 'bajas', 'equipo', 'avisos', 'alta_manual'].map(t => {
             if ((t === 'equipo' || t === 'alta_manual' || t === 'bajas') && userRole !== 'admin') return null;
             
             let count = 0;
             if (t === 'pruebas') count = listadoPruebas.length;
             if (t === 'bajas') count = listadoBajas.length;

             return (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-bold uppercase text-sm whitespace-nowrap flex items-center gap-2 ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                    {t.replace('_', ' ')}
                    {count > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{count}</span>}
                </button>
             );
          })}
      </div>

      {tab === 'global' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4">
                  <input className="flex-1 border p-2 rounded" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                  <select className="border p-2 rounded bg-white font-bold text-gray-700 md:w-1/3" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
                      <option value="">📂 Todos los Grupos</option>
                      {gruposUnicos.map(g => (<option key={g} value={g}>{g}</option>))}
                  </select>
              </div>
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs"><tr><th className="p-3">Alumno</th><th className="p-3">Grupo</th><th className="p-3 text-right">Acción</th></tr></thead>
                  <tbody>
                      {listadoGlobal.length > 0 ? listadoGlobal.map(a => (
                          <tr key={a.id} className={`border-b ${a.estado === 'baja_pendiente' ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                              <td className="p-3 font-bold">{a.nombre} {a.estado === 'baja_pendiente' && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded ml-1">BAJA</span>}<br/><span className="text-gray-400 text-xs">{a.curso}</span></td>
                              <td className="p-3">{a.actividad || '-'}</td>
                              <td className="p-3 text-right">{userRole === 'admin' && <button onClick={() => borrarAlumno(a.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>}</td>
                          </tr>
                      )) : <tr><td colSpan="3" className="p-8 text-center text-gray-400">No hay resultados.</td></tr>}
                  </tbody>
              </table>
          </div>
      )}

      {tab === 'pruebas' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-3 bg-blue-50 text-blue-800 text-xs font-bold border-b">
                  ℹ️ Validar Plazas: Alumnos con cita de nivel o pendientes de confirmación.
              </div>
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs"><tr><th className="p-3">Cita</th><th className="p-3">Alumno</th><th className="p-3">Solicita</th><th className="p-3 text-right">Validar</th></tr></thead>
                  <tbody>
                      {listadoPruebas.length > 0 ? listadoPruebas.map(a => (
                          <tr key={a.id} className="hover:bg-orange-50">
                              <td className="p-3 text-blue-600 font-bold">{a.citaNivel || 'Sin hora'}</td>
                              <td className="p-3 font-bold">
                                  {a.nombre}
                                  {/* Debug para que veas por qué salen */}
                                  <div className="text-[10px] text-gray-400 font-normal">
                                      {a.estado === 'inscrito' ? 'Pre-inscrito (Falta Validar)' : 'Reserva Prueba'}
                                  </div>
                              </td>
                              <td className="p-3"><span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">{a.actividad || 'Sin elegir'}</span></td>
                              <td className="p-3 text-right"><button onClick={() => validarPlaza(a)} className="bg-green-500 text-white px-3 py-1 rounded font-bold text-xs shadow hover:bg-green-600">✅ Aceptar</button></td>
                          </tr>
                      )) : <tr><td colSpan="4" className="p-6 text-center text-gray-400">Todo validado.</td></tr>}
                  </tbody>
              </table>
          </div>
      )}

      {tab === 'bajas' && (
          <div className="bg-white rounded shadow overflow-hidden">
              <div className="p-3 bg-red-50 text-red-800 text-xs font-bold border-b">ℹ️ Bajas solicitadas (Pendientes de finalizar).</div>
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs"><tr><th className="p-3">Alumno</th><th className="p-3">Grupo</th><th className="p-3">Solicitada</th><th className="p-3 text-red-600">Efectiva</th><th className="p-3 text-right">Acción</th></tr></thead>
                  <tbody>
                      {listadoBajas.length > 0 ? listadoBajas.map(a => (
                          <tr key={a.id} className="hover:bg-red-50">
                              <td className="p-3 font-bold">{a.nombre}</td>
                              <td className="p-3 text-gray-600">{a.actividad}</td>
                              <td className="p-3">{a.fechaSolicitudBaja ? new Date(a.fechaSolicitudBaja).toLocaleDateString() : '-'}</td>
                              <td className="p-3 font-bold text-red-700">{getFinDeMes(a.fechaSolicitudBaja)}</td>
                              <td className="p-3 text-right"><button onClick={() => finalizarBaja(a)} className="bg-red-100 text-red-700 border border-red-300 px-3 py-1 rounded font-bold text-xs hover:bg-red-600 hover:text-white">🗑️ Finalizar</button></td>
                          </tr>
                      )) : <tr><td colSpan="5" className="p-6 text-center text-gray-400">No hay bajas pendientes.</td></tr>}
                  </tbody>
              </table>
          </div>
      )}

      {tab === 'equipo' && userRole === 'admin' && (
          <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">Crear Usuario</h3><form onSubmit={handleCrearStaff} className="space-y-2"><input className="border p-2 w-full rounded" placeholder="Email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} /><input className="border p-2 w-full rounded" placeholder="Contraseña" type="password" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} /><select className="border p-2 w-full rounded" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})}><option value="profe">Profesor</option><option value="admin">Coordinador</option></select><button disabled={loadingStaff} className="bg-purple-600 text-white w-full py-2 rounded font-bold">Crear</button></form></div>
              <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">Lista Equipo</h3>{equipo.map(u => (<div key={u.id} className="flex justify-between items-center border-b py-2"><span>{u.email} <small className="text-gray-500">({u.role})</small></span><button onClick={() => borrarMiembroEquipo(u)} className="text-red-500">🗑️</button></div>))}</div>
          </div>
      )}

      {tab === 'avisos' && (<div className="grid md:grid-cols-2 gap-6"><div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">Nuevo Aviso</h3><form onSubmit={agregarAviso}><textarea className="w-full border p-2 rounded mb-2" rows="3" value={nuevoAviso} onChange={e => setNuevoAviso(e.target.value)} /><button className="bg-blue-600 text-white px-4 py-2 rounded font-bold w-full">Publicar</button></form></div><div className="space-y-2">{avisos.map(a => (<div key={a.id} className="bg-yellow-50 p-3 rounded border border-yellow-200 flex justify-between"><span>{a.texto}</span>{userRole === 'admin' && <button onClick={() => borrarAviso(a.id)} className="text-red-500">🗑️</button>}</div>))}</div></div>)}
      {tab === 'alta_manual' && (<div className="bg-white p-8 rounded shadow text-center"><h2 className="text-xl font-bold mb-4">Alta Manual</h2><button className="bg-blue-600 text-white px-6 py-3 rounded font-bold" onClick={() => window.open(window.location.href, '_blank')}>Abrir Formulario ↗</button></div>)}
    </div>
  );
};
// ==========================================
// 👨‍👩‍👧‍👦 DASHBOARD FAMILIAS (CON GESTIÓN DE BAJAS DIFERIDA)
// ==========================================
const Dashboard = ({ user, misHijos, logout, refresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [alumnoEditar, setAlumnoEditar] = useState(null);
  const [modoModal, setModoModal] = useState(null);
  const [avisos, setAvisos] = useState([]);
  
  const alumnoEnVivo = misHijos.find((h) => h.id === alumnoSeleccionado?.id);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => 
      setAvisos(s.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    return () => unsub();
  }, []);

  const alTerminarPrueba = () => {
      setModoModal('inscripcion'); 
      refresh(user.uid);
  };

  const gestionarBaja = async (hijo) => {
    // 1. Si no tiene actividad, borramos el perfil directamente
    if (hijo.estado === 'sin_inscripcion') {
        if (window.confirm(`🗑️ ¿Eliminar perfil de ${hijo.nombre}?`)) {
            await deleteDoc(doc(db, 'students', hijo.id));
            refresh(user.uid);
        }
        return;
    }

    const diaActual = new Date().getDate();

    // 2. Bloqueo después del día 25
    if (diaActual > 25) {
        return alert('⛔ PLAZO CERRADO.\n\nLas bajas para el mes siguiente deben tramitarse antes del día 25.\n\nContacta con secretaría.');
    }

    // 3. Tramitación de Baja (NO BORRA, SOLO MARCA)
    if (window.confirm(`⚠️ ¿Solicitar BAJA de ${hijo.nombre}?\n\nℹ️ AVISO: Al ser día ${diaActual}, se cobrará el mes en curso completo. La baja será efectiva el último día de este mes.`)) {
      await updateDoc(doc(db, 'students', hijo.id), {
        estado: 'baja_pendiente', // Nuevo estado intermedio
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
        <button onClick={logout} className="text-red-500 font-medium border border-red-100 px-5 py-2 rounded-lg hover:bg-red-50 w-full md:w-auto">Cerrar Sesión</button>
      </div>

      {avisos.length > 0 && (<div className="mb-6 space-y-2">{avisos.map(aviso => (<div key={aviso.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm text-yellow-800 font-medium flex items-center gap-3"><span className="text-2xl">📢</span><span>{aviso.texto}</span></div>))}</div>)}

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {misHijos.map((hijo) => {
          const esPendiente = hijo.estado === 'inscrito' && !hijo.esAntiguoAlumno;
          
          let bordeColor = 'bg-gray-400';
          let estadoTexto = 'Sin Actividad';
          
          if (hijo.estado === 'inscrito') {
              bordeColor = esPendiente ? 'bg-yellow-400' : 'bg-green-500';
              estadoTexto = esPendiente ? '⏳ Pendiente Validación' : '✅ Inscrito';
          } else if (hijo.estado === 'prueba_reservada') {
              bordeColor = 'bg-orange-500';
              estadoTexto = '⏳ Prueba Pendiente';
          } else if (hijo.estado === 'baja_pendiente') {
              bordeColor = 'bg-red-500';
              estadoTexto = '📉 Baja Solicitada';
          }

          return (
            <div key={hijo.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${bordeColor}`}></div>
              <div className="flex justify-between items-start mb-2 pl-3">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                    {hijo.nombre} <button onClick={() => setAlumnoEditar(hijo)} className="text-gray-400 hover:text-blue-600 bg-gray-50 p-1.5 rounded-full">✏️</button>
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">{hijo.curso} • {hijo.letra}</p>
                </div>
                <div className="flex flex-col items-end gap-2"><span className="px-2 py-1 rounded text-[10px] font-extrabold uppercase bg-gray-100 text-gray-500">{estadoTexto}</span></div>
              </div>

              {/* SI ESTÁ INSCRITO O BAJA PENDIENTE (Muestra datos porque aún asiste) */}
              {(hijo.estado === 'inscrito' || hijo.estado === 'baja_pendiente') && (
                <div className={`ml-3 mt-4 p-3 rounded-lg border text-sm ${hijo.estado === 'baja_pendiente' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                  <p className="font-bold mb-1 text-gray-800">{hijo.actividad}</p>
                  <div className="flex items-center gap-2 text-gray-600"><span>📅 {hijo.dias}</span><span>⏰ {hijo.horario}</span></div>
                  {hijo.estado === 'baja_pendiente' && <p className="text-red-600 font-bold text-xs mt-2">⚠️ Baja efectiva a fin de mes</p>}
                </div>
              )}
              
              {/* SI ESTÁ EN PRUEBA */}
              {hijo.estado === 'prueba_reservada' && (
                <div className="ml-3 mt-4 bg-orange-50 p-3 rounded-lg border border-orange-200 text-sm">
                  <div className="mb-3 pb-3 border-b border-orange-200">
                      <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">🎯 Solicitud:</p>
                      {hijo.actividad ? (<div><p className="text-lg font-black text-orange-900 leading-tight">{hijo.actividad}</p></div>) : (<button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} className="w-full bg-white border border-orange-300 text-orange-700 py-1.5 rounded text-xs font-bold">👉 Elegir Grupo</button>)}
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="text-2xl">🗓️</span>
                      <div><p className="font-bold text-orange-900 text-xs uppercase">Prueba de Nivel</p>{hijo.citaNivel ? (<p className="text-orange-800 font-bold">{hijo.citaNivel}</p>) : (<button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('prueba'); }} className="text-red-600 font-bold underline cursor-pointer animate-pulse">¡Reservar Hora!</button>)}</div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 ml-3 border-t border-gray-100 flex gap-2">
                {/* BOTÓN BAJA (Solo si está inscrito y no ha pedido ya la baja) */}
                {hijo.estado === 'inscrito' && (
                    <button onClick={() => gestionarBaja(hijo)} className="w-full bg-white text-red-600 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">Tramitar Baja</button>
                )}
                
                {hijo.estado === 'sin_inscripcion' && (
                  <div className="flex w-full gap-2">
                    <button onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">Inscribir</button>
                    <button onClick={() => gestionarBaja(hijo)} className="bg-white text-red-500 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">🗑️</button>
                  </div>
                )}
                
                {hijo.estado === 'prueba_reservada' && (<button onClick={() => gestionarBaja(hijo)} className="w-full bg-white text-red-500 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-50">Cancelar Solicitud</button>)}
              </div>
            </div>
          );
        })}
      </div>
      
      <button onClick={() => setShowForm(true)} className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 mb-10"><span className="text-2xl">+</span> Añadir Otro Alumno</button>
      
      {showForm && (<FormularioHijo close={() => setShowForm(false)} user={user} refresh={refresh} />)}
      {alumnoEditar && (<FormularioEdicionHijo alumno={alumnoEditar} close={() => setAlumnoEditar(null)} refresh={refresh} />)}
      {modoModal === 'prueba' && alumnoEnVivo && (<PantallaPruebaNivel alumno={alumnoEnVivo} close={() => setModoModal(null)} onSuccess={alTerminarPrueba} user={user} refresh={refresh} />)}
      {modoModal === 'inscripcion' && alumnoEnVivo && (<PantallaInscripcion alumno={alumnoEnVivo} close={() => setModoModal(null)} onRequirePrueba={() => setModoModal('prueba')} user={user} refresh={refresh} />)}
    </div>
  );
};

// ==========================================
// ✏️ FORMULARIO EDICIÓN DE DATOS
// ==========================================
const FormularioEdicionHijo = ({ alumno, close, refresh }) => {
  const [data, setData] = useState({ 
    nombre: alumno.nombre, 
    curso: alumno.curso, 
    letra: alumno.letra, 
    fechaNacimiento: alumno.fechaNacimiento || '' 
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
        await updateDoc(doc(db, 'students', alumno.id), data);
        refresh(auth.currentUser.uid);
        close();
    } catch (error) {
        alert("Error al actualizar: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-2xl animate-fade-in-up">
        <h3 className="text-xl font-bold mb-4 text-blue-900 border-b pb-2">Editar Datos Personales</h3>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Nombre Completo</label>
            <input className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={data.nombre} onChange={(e) => setData({ ...data, nombre: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Fecha Nacimiento</label>
            <input type="date" className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={data.fechaNacimiento} onChange={(e) => setData({ ...data, fechaNacimiento: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Curso</label>
              <select className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={data.curso} onChange={(e) => setData({ ...data, curso: e.target.value })}>
                {LISTA_CURSOS.map((c) => (<option key={c.val} value={c.val}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Letra</label>
              <select className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={data.letra} onChange={(e) => setData({ ...data, letra: e.target.value })}>
                <option>A</option><option>B</option><option>C</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={close} className="flex-1 border border-gray-300 py-2 rounded text-gray-600 font-bold hover:bg-gray-50">Cancelar</button>
            <button className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 shadow-lg">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// ➕ FORMULARIO ALTA HIJO
// ==========================================
const FormularioHijo = ({ close, user, refresh }) => {
  const [data, setData] = useState({ 
    nombre: '', 
    curso: '3PRI', 
    letra: 'A', 
    fechaNacimiento: '', 
    esAntiguoAlumno: false, 
    aceptaNormas: false, 
    autorizaFotos: false 
  });

  const save = async (e) => {
    e.preventDefault();
    if (!data.aceptaNormas) return alert("⚠️ Debes aceptar las normas para crear el perfil.");
    if (!data.nombre) return alert("⚠️ El nombre es obligatorio.");

    await addDoc(collection(db, 'students'), {
      parentId: user.uid,
      ...data,
      estado: 'sin_inscripcion'
    });
    refresh(user.uid);
    close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-2xl animate-fade-in-up">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Añadir Nuevo Alumno</h3>
        <form onSubmit={save} className="space-y-4">
          <input 
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Nombre y Apellidos" 
            onChange={e => setData({ ...data, nombre: e.target.value })} 
          />
          
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <label className="text-sm font-bold text-blue-900 block mb-2">¿Fue alumno el año pasado?</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="antiguo" onChange={() => setData({ ...data, esAntiguoAlumno: true })} /> 
                Sí (No necesita prueba)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="antiguo" defaultChecked onChange={() => setData({ ...data, esAntiguoAlumno: false })} /> 
                No
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Curso</label>
                <select className="w-full border p-2 rounded-lg" onChange={e => setData({ ...data, curso: e.target.value })}>
                {LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Letra</label>
                <select className="w-full border p-2 rounded-lg" onChange={e => setData({ ...data, letra: e.target.value })}>
                <option>A</option><option>B</option><option>C</option>
                </select>
            </div>
          </div>
          
          <div>
            <label className="text-xs text-gray-500 font-bold uppercase">Fecha Nacimiento</label>
            <input type="date" className="w-full border p-2 rounded-lg" onChange={e => setData({ ...data, fechaNacimiento: e.target.value })} />
          </div>

          <div className="text-xs space-y-2 pt-2 border-t">
            <label className="flex gap-2 cursor-pointer items-start">
                <input type="checkbox" className="mt-0.5" checked={data.aceptaNormas} onChange={e => setData({ ...data, aceptaNormas: e.target.checked })} /> 
                Acepto normas de funcionamiento (OBLIGATORIO)
            </label>
            <label className="flex gap-2 cursor-pointer items-start">
                <input type="checkbox" className="mt-0.5" checked={data.autorizaFotos} onChange={e => setData({ ...data, autorizaFotos: e.target.checked })} /> 
                Autorizo fotos/vídeos
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={close} className="flex-1 text-gray-500 font-bold py-2 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md">Crear Perfil</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 📅 MODAL DE PRUEBA DE NIVEL
// ==========================================
const PantallaPruebaNivel = ({ alumno, close, onSuccess, user, refresh }) => {
  const [citasOcupadas, setCitasOcupadas] = useState({});
  const diasPrueba = getNextMondays();
  const [diaIdSeleccionado, setDiaIdSeleccionado] = useState(getDateId(diasPrueba[0]));
  const [aceptaNormas, setAceptaNormas] = useState(alumno.aceptaNormas || false);
  const [autorizaFotos, setAutorizaFotos] = useState(alumno.autorizaFotos || false);

  const horas = [];
  for (let h = 16; h < 18; h++) {
    for (let m = 0; m < 60; m += 5) {
      horas.push(`${h}:${m.toString().padStart(2, '0')}`);
    }
  }

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'students')), s => {
      const c = {};
      s.forEach(d => {
        const dt = d.data();
        if (dt.citaId) c[dt.citaId] = (c[dt.citaId] || 0) + 1;
      });
      setCitasOcupadas(c);
    });
    return () => unsub();
  }, []);

  const confirmarCita = async (hora) => {
    if (!aceptaNormas) return alert("⚠️ Debes aceptar las normas de funcionamiento.");
    
    const citaId = `${diaIdSeleccionado}_${hora}`;
    const textoCita = `${getHumanDate(diasPrueba.find(d => getDateId(d) === diaIdSeleccionado))} a las ${hora}`;

    if ((citasOcupadas[citaId] || 0) >= CAPACIDAD_POR_HUECO) return alert('⚠️ Esa hora ya está completa. Por favor elige otra.');

    if (!window.confirm(`¿Confirmar reserva de prueba?\n\n📅 ${textoCita}\n📍 Portón Azul`)) return;

    try {
      await updateDoc(doc(db, 'students', alumno.id), {
        estado: 'prueba_reservada',
        citaId,
        citaNivel: textoCita,
        aceptaNormas: true,
        autorizaFotos
      });
      await enviarEmailConfirmacion(auth.currentUser.email, alumno.nombre, textoCita);
      alert('✅ Cita Confirmada correctamente.');
      refresh(user.uid);
      onSuccess();
    } catch (e) {
      alert('Error al reservar: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl max-w-lg w-full h-[85vh] flex flex-col shadow-2xl animate-fade-in-up">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
           <h2 className="text-2xl font-bold text-blue-900">Reserva de Prueba</h2>
           <button onClick={close} className="text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
        </div>
        {!alumno.aceptaNormas && (
          <div className="bg-yellow-50 p-4 rounded-lg mb-4 text-xs border border-yellow-200">
            <h4 className="font-bold text-yellow-800 mb-2">Requisitos Previos</h4>
            <label className="flex gap-2 mb-2 cursor-pointer items-start">
              <input type="checkbox" className="mt-1" checked={aceptaNormas} onChange={e => setAceptaNormas(e.target.checked)} />
              <span>He leído y acepto las <strong>normas de funcionamiento</strong> de la escuela (OBLIGATORIO).</span>
            </label>
            <label className="flex gap-2 cursor-pointer items-start">
              <input type="checkbox" className="mt-1" checked={autorizaFotos} onChange={e => setAutorizaFotos(e.target.checked)} />
              <span>Autorizo la toma de imágenes para uso interno/promocional del club.</span>
            </label>
          </div>
        )}
        <label className="text-sm font-bold text-gray-600 mb-1">Selecciona el día:</label>
        <select 
          className="w-full border-2 border-blue-100 p-3 rounded-lg mb-4 font-bold text-blue-900 bg-blue-50 focus:border-blue-500 outline-none"
          value={diaIdSeleccionado}
          onChange={e => setDiaIdSeleccionado(e.target.value)}
        >
          {diasPrueba.map(d => (
            <option key={getDateId(d)} value={getDateId(d)}>{getHumanDate(d)}</option>
          ))}
        </select>
        <p className="text-xs text-center text-gray-500 mb-2">Huecos disponibles cada 5 minutos (Máx 2 alumnos)</p>
        <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-2 pr-1">
          {horas.map(h => {
            const ocupacion = citasOcupadas[`${diaIdSeleccionado}_${h}`] || 0;
            const lleno = ocupacion >= CAPACIDAD_POR_HUECO;
            return (
              <button
                key={h}
                disabled={lleno}
                onClick={() => confirmarCita(h)}
                className={`p-2 rounded-lg text-xs font-bold transition ${
                  lleno 
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200' 
                    : 'bg-white text-green-700 border border-green-200 hover:bg-green-500 hover:text-white shadow-sm'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 📝 MODAL INSCRIPCIÓN (LÓGICA PRE-RESERVA)
// ==========================================
const PantallaInscripcion = ({ alumno, close, onRequirePrueba, user, refresh }) => {
  const [datosAlumno, setDatosAlumno] = useState({ 
    nombre: alumno.nombre, 
    curso: alumno.curso, 
    fechaNacimiento: alumno.fechaNacimiento || '' 
  });
  const actividadesDisponibles = OFERTA_ACTIVIDADES.filter((act) => act.cursos.includes(datosAlumno.curso));
  const [aceptaNormas, setAceptaNormas] = useState(alumno.aceptaNormas || false);

  const inscribir = async (act, op) => {
    if (!aceptaNormas) return alert("⚠️ Debes aceptar las normas.");
    
    // CASO 1: REQUIERE PRUEBA Y NO LA TIENE (NI ES ANTIGUO)
    if (act.requierePrueba && !alumno.esAntiguoAlumno && !alumno.citaNivel && alumno.estado !== 'prueba_reservada') {
        
        alert(`✅ Hemos anotado tu solicitud para: ${act.nombre}.\n\n🛑 PERO OJO: Esta actividad requiere PRUEBA DE NIVEL.\n\nLa plaza quedará "Pendiente de Validación" hasta que el coordinador realice la prueba.\n\n👉 A continuación, elige fecha para la prueba.`);
        
        // 🔥 AQUÍ ESTÁ EL CAMBIO CLAVE:
        // Guardamos el grupo que quiere (Pre-inscripción) AUNQUE no tenga la prueba hecha.
        await updateDoc(doc(db, 'students', alumno.id), { 
            ...datosAlumno, 
            aceptaNormas: true,
            // Guardamos la preferencia del grupo
            actividad: act.nombre,
            dias: op.dias,
            horario: op.horario,
            precio: op.precio,
            // Estado especial: está reservado pero pendiente de la prueba
            estado: 'prueba_reservada' 
        });
        
        refresh(user.uid);
        onRequirePrueba(); // Le llevamos a pedir la cita
        return; 
    }

    // CASO 2: INSCRIPCIÓN DIRECTA (Sin prueba o ya la tiene)
    if (!confirm(`¿Confirmar inscripción definitiva en:\n📘 ${act.nombre}\n📅 ${op.dias}?`)) return;
    
    await updateDoc(doc(db, 'students', alumno.id), { 
        nombre: datosAlumno.nombre, 
        curso: datosAlumno.curso, 
        fechaNacimiento: datosAlumno.fechaNacimiento, 
        estado: 'inscrito', 
        actividad: act.nombre, 
        dias: op.dias, 
        horario: op.horario, 
        precio: op.precio, 
        fechaInscripcion: new Date().toISOString(), 
        aceptaNormas: true 
    });
    
    refresh(user.uid); 
    close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl max-w-lg w-full h-[90vh] flex flex-col shadow-2xl animate-fade-in-up">
        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-blue-900">Inscripción</h2><button onClick={close}>✕</button></div>
        
        <div className="bg-blue-50 p-4 rounded-xl mb-4 space-y-3 border border-blue-100">
            <input className="w-full border p-2 rounded" value={datosAlumno.nombre} onChange={e => setDatosAlumno({ ...datosAlumno, nombre: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
                <select className="border p-2 rounded" value={datosAlumno.curso} onChange={e => setDatosAlumno({ ...datosAlumno, curso: e.target.value })}>{LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}</select>
                <input type="date" className="border p-2 rounded" value={datosAlumno.fechaNacimiento} onChange={e => setDatosAlumno({ ...datosAlumno, fechaNacimiento: e.target.value })} />
            </div>
        </div>

        <div className="bg-gray-50 p-3 rounded mb-4 text-xs"><label className="flex gap-2"><input type="checkbox" checked={aceptaNormas} onChange={e => setAceptaNormas(e.target.checked)} disabled={alumno.aceptaNormas} /> {alumno.aceptaNormas ? 'Normas aceptadas' : 'He leído y acepto las normas'}</label></div>
        
        <h3 className="font-bold text-gray-700 mb-2 text-sm border-b pb-1">Selecciona Grupo ({actividadesDisponibles.length})</h3>
        <div className="overflow-y-auto pr-2 space-y-4 flex-1">
            {actividadesDisponibles.map(act => (
                <div key={act.id} className="border border-gray-200 rounded-xl p-3 hover:border-blue-400 bg-white">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-blue-900 text-sm">{act.nombre}</h3>
                        {act.requierePrueba && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Requiere Prueba</span>}
                    </div>
                    <div className="grid gap-2">
                        {act.opciones.map((op, i) => (
                            <button key={i} onClick={() => inscribir(act, op)} className="border border-gray-100 bg-gray-50 p-2 rounded hover:bg-blue-600 hover:text-white text-left text-xs flex justify-between items-center transition group">
                                <span className="font-medium">{op.dias}</span>
                                <span className="font-bold">{op.horario} - {op.precio}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
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
    nombreAlumno: '', curso: '3PRI', letra: 'A', fechaNacimiento: '', esAntiguoAlumno: false,
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
        if (!regData.telefono1) return alert('⚠️ Falta: Teléfono de contacto');
        if (!regData.direccion) return alert('⚠️ Falta: Dirección');
        if (!regData.cp) return alert('⚠️ Falta: Código Postal');
        if (!regData.iban) return alert('⚠️ Falta: IBAN Bancario');
        if (!regData.emailPagador) return alert('⚠️ Falta: EMAIL del Pagador (será tu usuario)');
    } else {
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
      await addDoc(collection(db, 'students'), { 
          parentId: cred.user.uid, 
          nombre: regData.nombreAlumno, 
          curso: regData.curso, 
          letra: regData.letra, 
          fechaNacimiento: regData.fechaNacAlumno, 
          esAntiguoAlumno: regData.esAntiguoAlumno,
          alergias: regData.alergias, 
          observaciones: regData.observaciones,
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
          {regData.tipo === 'externo' ? (
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200 animate-fade-in">
                <h3 className="font-bold text-orange-900 mb-3 border-b border-orange-200 pb-1">👤 Datos Completos del Pagador</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <input className="border p-2 rounded bg-white" placeholder="Nombre Completo Titular *" onChange={e => setRegData({ ...regData, nombrePagador: e.target.value })} />
                    <input className="border p-2 rounded bg-white" placeholder="DNI / NIE *" onChange={e => setRegData({ ...regData, dniPagador: e.target.value })} />
                    
                    <input className="border p-2 rounded bg-white" placeholder="Teléfono 1 *" onChange={e => setRegData({ ...regData, telefono1: e.target.value })} />
                    <input className="border p-2 rounded bg-white" placeholder="Teléfono 2" onChange={e => setRegData({ ...regData, telefono2: e.target.value })} />
                    
                    <input className="border p-2 rounded bg-white md:col-span-2" placeholder="Dirección Postal Completa *" onChange={e => setRegData({ ...regData, direccion: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        <input className="border p-2 rounded bg-white" placeholder="CP *" onChange={e => setRegData({ ...regData, cp: e.target.value })} />
                        <input className="border p-2 rounded bg-white" placeholder="Población *" onChange={e => setRegData({ ...regData, poblacion: e.target.value })} />
                    </div>
                    
                    <input className="border p-2 rounded bg-white md:col-span-2 font-mono border-orange-300" placeholder="IBAN (ES...) *" onChange={e => setRegData({ ...regData, iban: e.target.value })} />
                    
                    {/* EMAIL DENTRO DEL BLOQUE EXTERNO */}
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
                  <div>
                      <label className="text-xs font-bold text-blue-800 uppercase">Tu Email de Contacto (Será tu Usuario) *</label>
                      <input type="email" className="w-full border p-2 rounded bg-white font-bold text-blue-900" placeholder="ejemplo@correo.com" onChange={e => setRegData({ ...regData, emailContacto: e.target.value })} />
                  </div>
              </div>
          )}

          {/* 3. DATOS DEL ALUMNO (SIEMPRE IGUAL) */}
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3 border-b pb-1">🎓 Primer Alumno</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <input className="border p-2 rounded md:col-span-2 bg-white" placeholder="Nombre y Apellidos del Alumno *" onChange={e => setRegData({ ...regData, nombreAlumno: e.target.value })} />
              <select className="border p-2 rounded bg-white" onChange={e => setRegData({ ...regData, curso: e.target.value })}>{LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}</select>
              <select className="border p-2 rounded bg-white" onChange={e => setRegData({ ...regData, letra: e.target.value })}><option>A</option><option>B</option><option>C</option></select>
              <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-bold ml-1">Fecha de Nacimiento *</label>
                  <input type="date" className="border p-2 rounded w-full bg-white" onChange={e => setRegData({ ...regData, fechaNacAlumno: e.target.value })} />
              </div>
              <textarea className="border p-2 rounded md:col-span-2 text-sm bg-white" placeholder="Alergias o problemas médicos (Opcional)" rows="2" onChange={e => setRegData({ ...regData, alergias: e.target.value })}></textarea>
            </div>
            <div className="mt-3 bg-white p-2 rounded border border-gray-200">
               <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" className="accent-blue-600 w-4 h-4" onChange={e => setRegData({ ...regData, esAntiguoAlumno: e.target.checked })} />
                  ¿Asistió a las extraescolares de natación del colegio el año pasado?
               </label>
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black flex items-center gap-2">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="text-center mb-6"><img src={IMG_ESCUDO} className="h-16 mx-auto mb-4" alt="Logo" /><h2 className="text-2xl font-bold mb-2 text-blue-900">Acceso Familias</h2><p className="text-gray-500 text-sm">Gestiona tus inscripciones y pruebas</p></div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" type="email" placeholder="Tu Email" onChange={e => setLoginData({ ...loginData, email: e.target.value })} />
          <input className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" type="password" placeholder="Contraseña" onChange={e => setLoginData({ ...loginData, password: e.target.value })} />
          <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">Entrar</button>
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