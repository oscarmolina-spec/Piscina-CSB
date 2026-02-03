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
const IMG_ESCUDO = 'https://i.ibb.co/JRz06Sym/San-uenaventura.png';
const IMG_PRINCIPAL = 'https://i.ibb.co/HLt30jVK/20241210-084606.jpg';
const IMG_GALERIA_1 = 'https://i.ibb.co/hJxW45tC/20241210-084225.jpg';
const IMG_GALERIA_2 = 'https://i.ibb.co/mrJHGscm/Screenshot-2025-05-09-15-04-17.png';
const MAPA_IMAGEN_URL = "https://i.ibb.co/35RNNBLz/Info-piscina.png";

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
    nombre: '🚼 Chapoteo (16:00 - 17:00)',
    cursos: ['INF3', 'INF4', 'INF5'],
    requierePrueba: false,
    diasResumen: 'L, M, X, J o V',
    precioResumen: '45€/mes',
    descripcion: '💧 Actividad de iniciación al medio acuático para Infantil.\n🎲 Juegos en el agua para disfrutar, familiarizarse y perder el miedo.\n⏰ Horario fijo: 16:00 - 17:00.',
    aviso: '⚠️ Mínimo 5 alumnos para abrir grupo.',
    opciones: [
      { dias: 'Lunes', horario: '16:00 - 17:00', precio: '45€/mes' },
      { dias: 'Martes', horario: '16:00 - 17:00', precio: '45€/mes' },
      { dias: 'Miércoles', horario: '16:00 - 17:00', precio: '45€/mes' },
      { dias: 'Jueves', horario: '16:00 - 17:00', precio: '45€/mes' },
      { dias: 'Viernes', horario: '16:00 - 17:00', precio: '45€/mes' },
    ],
  },
  {
    id: 'primaria_1615',
    nombre: '🏅 Natación Primaria (16:15 - 17:15)',
    cursos: ['1PRI', '2PRI', '3PRI', '4PRI', '5PRI', '6PRI'],
    requierePrueba: true,
    diasResumen: 'L-X, M-J o sueltos',
    precioResumen: 'Desde 45€',
    descripcion: '🏊 Para alumnos de 1º a 6º de Primaria.\n🎯 Trabajo por niveles, con objetivos técnicos y recreativos.\n⏰ Recogida 16:15 en portón azul. Salida 17:15.',
    aviso: '⚠️ Mínimo 6 alumnos por grupo.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '16:15 - 17:15', precio: '65€/mes' },
      { dias: 'Martes y Jueves', horario: '16:15 - 17:15', precio: '65€/mes' },
      { dias: 'Solo Lunes', horario: '16:15 - 17:15', precio: '45€/mes' },
      { dias: 'Solo Martes', horario: '16:15 - 17:15', precio: '45€/mes' },
      { dias: 'Solo Miércoles', horario: '16:15 - 17:15', precio: '45€/mes' },
      { dias: 'Solo Jueves', horario: '16:15 - 17:15', precio: '45€/mes' },
      { dias: 'Solo Viernes', horario: '16:15 - 17:15', precio: '45€/mes' },
    ],
  },
  {
    id: 'waterpolo',
    nombre: '🤽‍♂️ Waterpolo (17:30 - 18:30)',
    cursos: ['3PRI', '4PRI', '5PRI', '6PRI'],
    requierePrueba: false,
    diasResumen: 'L-X o V',
    precioResumen: 'Desde 45€',
    descripcion: '💦 Iniciación al waterpolo adaptada a cada edad.\n⚽ Trabajo en equipo, lanzamientos y diversión garantizada.\n⏰ Horario fijo: 17:30 - 18:30.',
    aviso: '⚠️ Mínimo 7 alumnos para formar equipo.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '17:30 - 18:30', precio: '60€/mes' },
      { dias: 'Solo Lunes', horario: '17:30 - 18:30', precio: '45€/mes' },
      { dias: 'Solo Miércoles', horario: '17:30 - 18:30', precio: '45€/mes' },
      { dias: 'Solo Viernes', horario: '17:30 - 18:30', precio: '45€/mes' },
    ],
  },
  {
    id: 'adultos',
    nombre: '👨‍👩‍👧 Adultos (Horario Variable)',
    cursos: ['ADULTO'],
    requierePrueba: false,
    diasResumen: 'L-X-V (18:00) | M-J (18:30)',
    precioResumen: 'Desde 37€',
    descripcion: '✨ Clases para adultos que quieran mantenerse activos o mejorar su estilo.\n🕓 Lunes, Miércoles, Viernes: 18:00 - 18:30.\n🕕 Martes, Jueves: 18:30 - 19:00.',
    aviso: '⚠️ Mínimo 4 alumnos.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '18:00 - 18:30', precio: '50€/mes' },
      { dias: 'Martes y Jueves', horario: '18:30 - 19:00', precio: '50€/mes' },
      { dias: 'Solo Lunes', horario: '18:00 - 18:30', precio: '37€/mes' },
      { dias: 'Solo Martes', horario: '18:30 - 19:00', precio: '37€/mes' },
      { dias: 'Solo Miércoles', horario: '18:00 - 18:30', precio: '37€/mes' },
      { dias: 'Solo Jueves', horario: '18:30 - 19:00', precio: '37€/mes' },
      { dias: 'Solo Viernes', horario: '18:00 - 18:30', precio: '37€/mes' },
    ],
  },
  {
    id: 'niveles_123',
    nombre: '🐟 Natación 1º-3º PRI (17:30 - 18:00)',
    cursos: ['1PRI', '2PRI', '3PRI'],
    requierePrueba: true,
    diasResumen: 'L-X, M-J o sueltos',
    precioResumen: 'Desde 37€',
    descripcion: '🧒 Sesiones breves, dinámicas y muy seguras para avanzar en autonomía acuática.\n⏰ Horario fijo: 17:30 - 18:00.',
    aviso: '⚠️ Mínimo 4 alumnos.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '17:30 - 18:00', precio: '50€/mes' },
      { dias: 'Martes y Jueves', horario: '17:30 - 18:00', precio: '50€/mes' },
      { dias: 'Solo Lunes', horario: '17:30 - 18:00', precio: '37€/mes' },
      { dias: 'Solo Martes', horario: '17:30 - 18:00', precio: '37€/mes' },
      { dias: 'Solo Miércoles', horario: '17:30 - 18:00', precio: '37€/mes' },
      { dias: 'Solo Jueves', horario: '17:30 - 18:00', precio: '37€/mes' },
      { dias: 'Solo Viernes', horario: '17:30 - 18:00', precio: '37€/mes' },
    ],
  },
  {
    id: 'niveles_456',
    nombre: '🏊 Natación 4º-6º PRI',
    cursos: ['4PRI', '5PRI', '6PRI'],
    requierePrueba: true,
    diasResumen: 'Varía según día',
    precioResumen: 'Desde 37€',
    descripcion: '🚀 Para quienes quieren seguir mejorando técnica y condición física. \n🕓 L-X-V: 17:30 - 18:30 (1 hora). \n🕕 M-J: 18:00 - 18:30 (30 min).',
    aviso: '⚠️ Mínimo 4 alumnos.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '17:30 - 18:30', precio: '50€/mes' },
      { dias: 'Martes y Jueves', horario: '18:00 - 18:30', precio: '50€/mes' },
      { dias: 'Solo Lunes', horario: '17:30 - 18:30', precio: '37€/mes' },
      { dias: 'Solo Martes', horario: '18:00 - 18:30', precio: '37€/mes' },
      { dias: 'Solo Miércoles', horario: '17:30 - 18:30', precio: '37€/mes' },
      { dias: 'Solo Jueves', horario: '18:00 - 18:30', precio: '37€/mes' },
      { dias: 'Solo Viernes', horario: '17:30 - 18:30', precio: '37€/mes' },
    ],
  },
  {
    id: 'eso_bach',
    nombre: '🎓 ESO y Bachillerato',
    cursos: ['1ESO', '2ESO', '3ESO', '4ESO', '1BACH', '2BACH'],
    requierePrueba: true,
    diasResumen: 'L-X o V',
    precioResumen: 'Desde 37€',
    descripcion: '🧠 Sesiones específicas para adolescentes, con técnica, mantenimiento o preparación física.\n🌙 Tardes: Lunes/Miércoles 18:30 - 19:00.\n☀️ Mediodía: Viernes 14:15 - 15:00.',
    aviso: '⚠️ Mínimo 4 alumnos.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '18:30 - 19:00', precio: '50€/mes' },
      { dias: 'Solo Lunes', horario: '18:30 - 19:00', precio: '37€/mes' },
      { dias: 'Solo Miércoles', horario: '18:30 - 19:00', precio: '37€/mes' },
      { dias: 'Solo Viernes (Mediodía)', horario: '14:15 - 15:00', precio: '37€/mes' },
    ],
  },
  {
    id: 'aquagym',
    nombre: '💧 Aquagym (17:30 - 18:15)',
    cursos: ['ADULTO', '1BACH', '2BACH'],
    requierePrueba: false,
    diasResumen: 'M y J',
    precioResumen: '50€/mes',
    descripcion: '🌊 Actividad acuática de bajo impacto ideal para mantenerse en forma sin sobrecargar las articulaciones.\n⏰ Martes y jueves de 17:30 - 18:15.',
    aviso: '⚠️ Mínimo 5 alumnos.',
    opciones: [
      { dias: 'Martes y Jueves', horario: '17:30 - 18:15', precio: '50€/mes' },
    ],
  },
  {
    id: 'nado_libre',
    nombre: '🧘 Nado Libre (18:30 - 19:00)',
    cursos: ['ADULTO', '1BACH', '2BACH'],
    requierePrueba: false,
    diasResumen: 'L, X, V',
    precioResumen: 'Desde 25€',
    descripcion: '🎧 Sin monitor, para jóvenes y adultos que prefieren nadar a su ritmo. 🌙 Ideal para relajarse al final del día.\n⏰ Lunes, Miércoles y Viernes de 18:30 a 19:00.',
    aviso: '⚠️ Mínimo 2 alumnos.',
    opciones: [
      { dias: 'Lunes y Miércoles', horario: '18:30 - 19:00', precio: '35€/mes' },
      { dias: 'Solo Lunes', horario: '18:30 - 19:00', precio: '25€/mes' },
      { dias: 'Solo Miércoles', horario: '18:30 - 19:00', precio: '25€/mes' },
      { dias: 'Solo Viernes', horario: '18:30 - 19:00', precio: '25€/mes' },
    ],
  },
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
// 🏠 PÁGINA PÚBLICA (LANDING PAGE - OFICIAL)
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
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
          <img src={IMG_ESCUDO} className="h-28 mx-auto mb-6 drop-shadow-2xl" alt="Escudo" />
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-md">
            Escuela de Natación <br /> San Buenaventura
          </h1>
          <p className="text-xl md:text-2xl font-light mb-8 drop-shadow-sm opacity-90">
            Deporte, Salud y Educación en el agua
          </p>
          <button
            onClick={() => setView('login')}
            className="bg-white text-blue-900 px-8 py-3 rounded-full font-bold text-lg hover:bg-blue-50 transition shadow-lg mt-6 transform hover:scale-105"
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
          
          {/* VISTA ACTIVIDADES */}
          {tab === 'actividades' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {OFERTA_ACTIVIDADES.map((act) => (
                <div key={act.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col hover:shadow-xl transition-shadow">
                  <div className="bg-blue-600 p-4 relative">
                    <h3 className="text-white font-bold text-lg pr-8">{act.nombre}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-blue-800 text-white text-xs px-2 py-1 rounded shadow-sm font-mono">
                        📅 {act.diasResumen}
                      </span>
                      {act.requierePrueba && (
  <span className="bg-red-500 text-white text-[10px] md:text-xs px-2 py-1 rounded font-bold shadow-sm animate-pulse whitespace-nowrap">
    ❗ Requiere Prueba de Nivel
  </span>
)}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-gray-600 text-sm mb-4 flex-1 whitespace-pre-line leading-relaxed">
                      {act.descripcion}
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800 mb-4 font-medium flex gap-2">
                      <span>⚠️</span>
                      <span>{act.aviso}</span>
                    </div>
                    {/* AQUI HEMOS QUITADO EL LISTADO DE PRECIOS */}
                    <div className="border-t pt-3 mt-auto flex justify-end">
                       <p className="text-2xl font-black text-blue-600">{act.precioResumen}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VISTA INFO COMPLETA */}
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

              {/* MATERIAL */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-blue-600 p-4 text-white font-bold text-lg flex items-center gap-2">🎒 Material Necesario</div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3"><span className="text-3xl">👙</span> <span className="font-bold text-gray-700">Bañador</span></div>
                  <div className="flex items-center gap-3"><span className="text-3xl">🧼</span> <span className="font-bold text-gray-700">Toalla (oblig)</span></div>
                  <div className="flex items-center gap-3"><span className="text-3xl">🥽</span> <span className="font-bold text-gray-700">Gafas</span></div>
                  <div className="flex items-center gap-3"><span className="text-3xl">🎩</span> <span className="font-bold text-gray-700">Gorro</span></div>
                  <div className="flex items-center gap-3"><span className="text-3xl">🩴</span> <span className="font-bold text-gray-700">Chanclas</span></div>
                </div>
              </div>

              {/* RECOGIDA ALUMNOS */}
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

              {/* AVISOS, AMPLIACIÓN Y NORMATIVA */}
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

              {/* BAJAS Y ALTAS */}
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
            </div>
          )}

          {/* VISTA INSTALACIONES */}
          {tab === 'instalaciones' && (
            <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
              <img src={IMG_GALERIA_1} className="w-full h-64 object-cover rounded-xl shadow hover:scale-105 transition" alt="Galeria 1" />
              <img src={IMG_GALERIA_2} className="w-full h-64 object-cover rounded-xl shadow hover:scale-105 transition" alt="Galeria 2" />
            </div>
          )}
        </div>
      </div>
      
      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-8 text-center text-sm text-gray-400">
        <p>© 2025 Colegio San Buenaventura - Escuela de Natación</p>
      </footer>
    </div>
  );
};

// ==========================================
// 🛡️ PANEL DE ADMINISTRADOR (VERSIÓN BLINDADA)
// ==========================================
const AdminDashboard = ({ logout }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [tab, setTab] = useState('global');
  const [busqueda, setBusqueda] = useState('');
  const [nuevoAviso, setNuevoAviso] = useState('');

  useEffect(() => {
    const unsubStudents = onSnapshot(query(collection(db, 'students')), (s) => setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubAvisos = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => setAvisos(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubStudents(); unsubAvisos(); };
  }, []);

  // 🛠️ AQUÍ ESTABA EL ERROR: AHORA USAMOS ( || '') PARA EVITAR QUE EXPLOTE
  const alumnosFiltrados = alumnos.filter(a => 
    (a.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) || 
    (a.curso && a.curso.toLowerCase().includes(busqueda.toLowerCase())) || 
    (a.actividad && (a.actividad || '').toLowerCase().includes(busqueda.toLowerCase()))
  );

  const descargarExcel = () => {
    const cabecera = ['Nombre,Curso,Letra,Estado,Actividad,Días,Horario,Precio,Fecha Nac.,Tutor ID\n'];
    const filas = alumnosFiltrados.map(a => `"${a.nombre || ''}","${a.curso || ''}","${a.letra || ''}","${a.estado || ''}","${a.actividad || '-'}","${a.dias || '-'}","${a.horario || '-'}","${a.precio || '-'}","${a.fechaNacimiento || ''}","${a.parentId || ''}"`);
    const csvContent = "data:text/csv;charset=utf-8," + cabecera + filas.join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "alumnos.csv"); document.body.appendChild(link); link.click();
  };

  const agregarAviso = async (e) => { e.preventDefault(); if (!nuevoAviso) return; await addDoc(collection(db, 'avisos'), { texto: nuevoAviso, fecha: new Date().toISOString() }); setNuevoAviso(''); };
  const borrarAviso = async (id) => { if (confirm('¿Borrar?')) await deleteDoc(doc(db, 'avisos', id)); };
  const borrarAlumno = async (id) => { if(confirm('⚠️ ¿Estás seguro de borrar este alumno y todo su historial?')) await deleteDoc(doc(db, 'students', id)); }

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3"><div className="bg-blue-900 text-white p-2 rounded-lg font-bold">🛡️ ADMIN</div><h1 className="text-xl font-bold text-gray-800 hidden md:block">Panel de Control</h1></div>
        <div className="flex gap-4"><button onClick={descargarExcel} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 text-sm">📥 Excel</button><button onClick={logout} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded font-bold hover:bg-red-100 text-sm">Salir</button></div>
      </div>
      <div className="p-6 max-w-7xl mx-auto w-full flex-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><p className="text-gray-500 text-xs font-bold uppercase">Total</p><p className="text-3xl font-black text-gray-800">{alumnos.length}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500"><p className="text-green-600 text-xs font-bold uppercase">Inscritos</p><p className="text-3xl font-black text-green-700">{alumnos.filter(a => a.estado === 'inscrito').length}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-400"><p className="text-orange-500 text-xs font-bold uppercase">Pruebas</p><p className="text-3xl font-black text-orange-600">{alumnos.filter(a => a.estado === 'prueba_reservada' || a.citaNivel).length}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-400"><p className="text-blue-500 text-xs font-bold uppercase">Avisos</p><p className="text-3xl font-black text-blue-600">{avisos.length}</p></div>
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {['global', 'pruebas', 'avisos'].map(t => <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-full font-bold text-sm uppercase ${tab === t ? 'bg-blue-900 text-white' : 'bg-white text-gray-600'}`}>{t}</button>)}
        </div>
        {tab === 'global' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
            <div className="p-4 border-b bg-gray-50 flex gap-4"><input type="text" placeholder="🔍 Buscar..." className="flex-1 border p-2 rounded" value={busqueda} onChange={e => setBusqueda(e.target.value)}/></div>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-600 uppercase text-xs"><tr><th className="p-3">Alumno</th><th className="p-3">Estado</th><th className="p-3">Actividad</th><th className="p-3 text-right">Acciones</th></tr></thead><tbody className="divide-y">{alumnosFiltrados.map(a => (<tr key={a.id} className="hover:bg-blue-50"><td className="p-3 font-bold">{a.nombre || '❌ SIN NOMBRE'}<br/><span className="text-xs text-gray-400">{a.curso}</span></td><td className="p-3">{a.estado}</td><td className="p-3">{a.actividad || '-'}</td><td className="p-3 text-right"><button onClick={() => borrarAlumno(a.id)} className="text-red-400 hover:text-red-600">🗑️</button></td></tr>))}</tbody></table></div>
          </div>
        )}
        {tab === 'pruebas' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-600 uppercase text-xs"><tr><th className="p-3">Fecha</th><th className="p-3">Alumno</th><th className="p-3">Curso</th></tr></thead><tbody className="divide-y">{alumnos.filter(a => a.estado === 'prueba_reservada' || a.citaNivel).map(a => (<tr key={a.id} className="hover:bg-orange-50"><td className="p-3 font-bold text-blue-600">{a.citaNivel}</td><td className="p-3 font-bold">{a.nombre || '❌ SIN NOMBRE'}</td><td className="p-3 text-gray-500">{a.curso}</td></tr>))}</tbody></table></div>
        )}
        {tab === 'avisos' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold mb-4">Nuevo Aviso</h3><form onSubmit={agregarAviso}><textarea className="w-full border p-3 rounded mb-4" rows="3" value={nuevoAviso} onChange={e => setNuevoAviso(e.target.value)} /><button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Publicar</button></form></div>
             <div className="space-y-3">{avisos.map(a => (<div key={a.id} className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex justify-between"><div><p className="text-yellow-900 font-medium">{a.texto}</p></div><button onClick={() => borrarAviso(a.id)} className="text-red-500">🗑️</button></div>))}</div>
          </div>
        )}
      </div>
    </div>
  );
};
// ==========================================
// 👨‍👩‍👧‍👦 PANEL DE FAMILIAS (DASHBOARD)
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

  // Función para dar de baja / borrar alumno
  const gestionarBaja = async (hijo) => {
    if (hijo.estado === 'sin_inscripcion') {
        if (window.confirm(`⚠️ ¿Quieres eliminar definitivamente el perfil de ${hijo.nombre}?`)) {
            await deleteDoc(doc(db, 'students', hijo.id));
            refresh(user.uid);
        }
        return;
    }
    // Si ya está inscrito, es una BAJA administrativa
    if (new Date().getDate() > 25) return alert('⛔ Plazo cerrado (día 25). Contacta con secretaría.');
    if (window.confirm(`⚠️ ¿Seguro que desea tramitar la BAJA de ${hijo.nombre}?\nPerderá su plaza actual.`)) {
      await updateDoc(doc(db, 'students', hijo.id), {
        estado: 'sin_inscripcion',
        actividad: null,
        dias: null,
        horario: null,
        precio: null,
        fechaInscripcion: null,
        citaId: null,
        citaNivel: null
      });
      refresh(user.uid);
      alert('✅ Baja tramitada correctamente.');
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen">
      {/* CABECERA USUARIO */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-full text-2xl">👨‍👩‍👧‍👦</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Familiar</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="text-red-500 font-medium border border-red-100 px-5 py-2 rounded-lg hover:bg-red-50 w-full md:w-auto">
          Cerrar Sesión
        </button>
      </div>

      {/* AVISOS IMPORTANTES */}
      {avisos.length > 0 && (
        <div className="mb-6 space-y-2">
          {avisos.map(aviso => (
            <div key={aviso.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm text-yellow-800 font-medium flex items-center gap-3 animate-bounce-subtle">
              <span className="text-2xl">📢</span> 
              <span>{aviso.texto}</span>
            </div>
          ))}
        </div>
      )}

      {/* TARJETAS DE ALUMNOS */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {misHijos.map((hijo) => {
          const esPendiente = hijo.estado === 'inscrito' && !hijo.esAntiguoAlumno;
          let bordeColor = 'bg-gray-400';
          let estadoTexto = 'Sin Actividad';
          let estadoClase = 'bg-gray-100 text-gray-500';

          if (hijo.estado === 'inscrito') {
            bordeColor = esPendiente ? 'bg-yellow-400' : 'bg-green-500';
            estadoTexto = esPendiente ? '⏳ Confirmación Pendiente' : '✅ Inscrito';
            estadoClase = esPendiente ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700';
          } else if (hijo.estado === 'prueba_reservada') {
            bordeColor = 'bg-orange-400';
            estadoTexto = 'Cita Pendiente';
            estadoClase = 'bg-orange-100 text-orange-700';
          }

          return (
            <div key={hijo.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${bordeColor}`}></div>
              
              <div className="flex justify-between items-start mb-2 pl-3">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                    {hijo.nombre} 
                    <button 
                        onClick={() => setAlumnoEditar(hijo)} 
                        className="text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 p-1.5 rounded-full transition" 
                        title="Editar datos personales"
                    >
                        ✏️
                    </button>
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">
                    {LISTA_CURSOS.find((c) => c.val === hijo.curso)?.label || hijo.curso} 
                    <span className="mx-1">•</span> Letra {hijo.letra}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-wide ${estadoClase}`}>
                    {estadoTexto}
                  </span>
                </div>
              </div>

              {hijo.estado === 'inscrito' && (
                <div className={`ml-3 mt-4 p-3 rounded-lg border text-sm ${esPendiente ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                  <p className="font-bold mb-1 text-gray-800">{hijo.actividad}</p>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>📅 {hijo.dias}</span>
                    <span>⏰ {hijo.horario}</span>
                  </div>
                </div>
              )}

              {hijo.estado === 'prueba_reservada' && (
                <div className="ml-3 mt-4 bg-orange-50 p-3 rounded-lg border border-orange-100 text-sm flex items-start gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-bold text-orange-900 mb-0.5">Prueba de Nivel Reservada</p>
                    <p className="text-orange-800">{hijo.citaNivel}</p>
                    <p className="text-xs text-orange-600 mt-1">Acude al portón azul.</p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 ml-3 border-t border-gray-100 flex gap-2">
                {hijo.estado === 'inscrito' ? (
                    <button onClick={() => gestionarBaja(hijo)} className="w-full bg-white text-red-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-50 border border-red-200 transition">
                      Baja
                    </button>
                ) : hijo.estado === 'prueba_reservada' ? (
                   <button className="w-full bg-orange-100 text-orange-700 py-2 rounded-lg text-sm font-bold cursor-default">
                      Esperando Prueba...
                   </button>
                ) : (
                  <div className="flex w-full gap-2">
                    <button 
                        onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} 
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm"
                    >
                        Gestionar Inscripción
                    </button>
                    <button 
                        onClick={() => gestionarBaja(hijo)} 
                        className="bg-white text-red-500 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-50 border border-red-200 transition"
                        title="Eliminar perfil"
                    >
                        🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <button 
        onClick={() => setShowForm(true)} 
        className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2 mb-10"
      >
        <span className="text-2xl">+</span> Añadir Otro Alumno
      </button>
      
      {showForm && (<FormularioHijo close={() => setShowForm(false)} user={user} refresh={refresh} />)}
      
      {alumnoEditar && (
        <FormularioEdicionHijo 
            alumno={alumnoEditar} 
            close={() => setAlumnoEditar(null)} 
            refresh={refresh} 
        />
      )}
      
      {modoModal === 'prueba' && alumnoEnVivo && (
        <PantallaPruebaNivel 
            alumno={alumnoEnVivo} 
            close={() => setModoModal(null)} 
            onSuccess={() => setModoModal(null)} 
            user={user} 
            refresh={refresh} 
        />
      )}
      
      {modoModal === 'inscripcion' && alumnoEnVivo && (
        <PantallaInscripcion 
            alumno={alumnoEnVivo} 
            close={() => setModoModal(null)} 
            onRequirePrueba={() => setModoModal('prueba')} 
            user={user} 
            refresh={refresh} 
        />
      )}
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
// 📝 MODAL DE INSCRIPCIÓN
// ==========================================
const PantallaInscripcion = ({ alumno, close, onRequirePrueba, user, refresh }) => {
  const [datosAlumno, setDatosAlumno] = useState({ 
    nombre: alumno.nombre, 
    curso: alumno.curso, 
    fechaNacimiento: alumno.fechaNacimiento || '' 
  });
  
  const actividadesDisponibles = OFERTA_ACTIVIDADES.filter((act) => act.cursos.includes(datosAlumno.curso));
  const [aceptaNormas, setAceptaNormas] = useState(alumno.aceptaNormas || false);
  const [autorizaFotos, setAutorizaFotos] = useState(alumno.autorizaFotos || false);

  const inscribir = async (act, op) => {
    if (!aceptaNormas) return alert("⚠️ Debes aceptar las normas para continuar.");
    if (!datosAlumno.nombre) return alert("⚠️ El nombre es obligatorio.");

    if (act.requierePrueba && !alumno.esAntiguoAlumno && !alumno.citaNivel && alumno.estado !== 'prueba_reservada') {
      await updateDoc(doc(db, 'students', alumno.id), { 
          ...datosAlumno, 
          aceptaNormas: true, 
          autorizaFotos 
      });
      if (confirm(`La actividad "${act.nombre}" requiere prueba de nivel.\n¿Deseas reservar cita ahora?`)) {
        onRequirePrueba();
      }
      return;
    }

    if (!confirm(`¿Confirmar inscripción en:\n${act.nombre}\n📅 ${op.dias}\n⏰ ${op.horario}?`)) return;

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
      autorizaFotos,
      aceptaNormas: true
    });
    refresh(user.uid);
    close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl max-w-lg w-full h-[90vh] flex flex-col shadow-2xl animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-blue-900">Inscripción y Datos</h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 space-y-3">
          <div>
            <label className="text-xs font-bold text-blue-800 uppercase">Nombre del Alumno</label>
            <input 
                className="w-full border border-blue-200 p-2 rounded bg-white text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                value={datosAlumno.nombre}
                onChange={e => setDatosAlumno({ ...datosAlumno, nombre: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-blue-800 uppercase">Curso Escolar</label>
              <select 
                className="w-full border border-blue-200 p-2 rounded bg-white text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                value={datosAlumno.curso}
                onChange={e => setDatosAlumno({ ...datosAlumno, curso: e.target.value })}
              >
                {LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-blue-800 uppercase">Fecha Nac.</label>
              <input 
                type="date"
                className="w-full border border-blue-200 p-2 rounded bg-white text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                value={datosAlumno.fechaNacimiento}
                onChange={e => setDatosAlumno({ ...datosAlumno, fechaNacimiento: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded mb-4 text-xs border border-gray-200">
            <label className="flex gap-2 mb-2 items-start cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={aceptaNormas} onChange={e => setAceptaNormas(e.target.checked)} disabled={alumno.aceptaNormas} /> 
                <span className={alumno.aceptaNormas ? 'text-green-700 font-bold' : ''}>{alumno.aceptaNormas ? '✅ Normas y Condiciones aceptadas' : 'He leído y acepto las normas (OBLIGATORIO)'}</span>
            </label>
            <label className="flex gap-2 items-start cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={autorizaFotos} onChange={e => setAutorizaFotos(e.target.checked)} /> 
                <span>Autorizo fotos/vídeos del menor con fines educativos.</span>
            </label>
        </div>
        <h3 className="font-bold text-gray-700 mb-2 text-sm border-b pb-1">Actividades Disponibles ({actividadesDisponibles.length})</h3>
        <div className="overflow-y-auto pr-2 space-y-4 flex-1">
          {actividadesDisponibles.length === 0 ? (
             <p className="text-center text-gray-500 py-10">No hay actividades para este curso escolar.</p>
          ) : (
             actividadesDisponibles.map(act => (
                <div key={act.id} className="border border-gray-200 rounded-xl p-3 hover:border-blue-400 hover:shadow-md transition bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-blue-900 text-sm">{act.nombre}</h3>
                    {act.requierePrueba && (
                        <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Requiere Prueba</span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {act.opciones.map((op, i) => (
                      <button
                        key={i}
                        onClick={() => inscribir(act, op)}
                        className="border border-gray-100 bg-gray-50 p-2 rounded hover:bg-blue-600 hover:text-white text-left text-xs flex justify-between items-center transition group"
                      >
                        <span className="font-medium">{op.dias}</span>
                        <div className="text-right">
                            <span className="block font-bold">{op.horario}</span>
                            <span className="block text-[10px] text-gray-500 group-hover:text-blue-200">{op.precio}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
             ))
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🔐 LOGIN Y REGISTRO (COMPLETO)
// ==========================================
const Login = ({ setView }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({
    tipo: 'interno',
    nombrePagador: '', dniPagador: '', iban: '', emailPagador: '', telPagador: '', direccion: '',
    nombreAlumno: '', curso: '3PRI', letra: 'A', fechaNacAlumno: '', esAntiguoAlumno: false,
    emailContacto: '', telefonoContacto: '', password: ''
  });

  const validateAndRegister = async (e) => {
    e.preventDefault();
    if (!regData.nombreAlumno || !regData.password) return alert('Faltan datos obligatorios.');
    if (regData.password.length < 6) return alert('La contraseña debe tener al menos 6 caracteres.');

    try {
      const email = regData.tipo === 'externo' ? regData.emailPagador : regData.emailContacto;
      if(!email) return alert("El email es obligatorio.");
      const cred = await createUserWithEmailAndPassword(auth, email, regData.password);
      await setDoc(doc(db, 'users', cred.user.uid), { email, ...regData });
      await addDoc(collection(db, 'students'), {
        parentId: cred.user.uid,
        nombre: regData.nombreAlumno,
        curso: regData.curso,
        letra: regData.letra,
        fechaNacimiento: regData.fechaNacAlumno,
        esAntiguoAlumno: regData.esAntiguoAlumno,
        estado: 'sin_inscripcion',
        aceptaNormas: false,
        autorizaFotos: false
      });
      alert("✅ Usuario creado con éxito");
    } catch (e) {
      alert('Error en registro: ' + e.message);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
    } catch (e) {
      alert("Error al entrar: " + e.message);
    }
  };

  if (isRegister) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black flex items-center gap-2">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl mt-10 animate-fade-in-up">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Registro de Familia</h2>
          <p className="text-sm text-gray-500">Crea tu cuenta para gestionar inscripciones</p>
        </div>
        <form onSubmit={validateAndRegister} className="space-y-6">
          <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
            <button type="button" onClick={() => setRegData({ ...regData, tipo: 'interno' })} className={`flex-1 py-2 font-bold rounded-md transition ${regData.tipo === 'interno' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Alumno del Colegio</button>
            <button type="button" onClick={() => setRegData({ ...regData, tipo: 'externo' })} className={`flex-1 py-2 font-bold rounded-md transition ${regData.tipo === 'externo' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Externo</button>
          </div>
          {regData.tipo === 'externo' && (
            <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-2">👤 Datos del Pagador (Padre/Madre/Tutor)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input className="border p-2 rounded" placeholder="Nombre Completo" onChange={e => setRegData({ ...regData, nombrePagador: e.target.value })} />
                <input className="border p-2 rounded" placeholder="DNI / NIE" onChange={e => setRegData({ ...regData, dniPagador: e.target.value })} />
                <input className="border p-2 rounded md:col-span-2" placeholder="IBAN Bancario" onChange={e => setRegData({ ...regData, iban: e.target.value })} />
                <input type="email" className="border p-2 rounded md:col-span-2" placeholder="Email del Pagador" onChange={e => setRegData({ ...regData, emailPagador: e.target.value })} />
              </div>
            </div>
          )}
          <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
            <h3 className="font-bold text-blue-800 mb-2">🎓 Datos del Primer Alumno</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <input className="border p-2 rounded md:col-span-2" placeholder="Nombre del Alumno" onChange={e => setRegData({ ...regData, nombreAlumno: e.target.value })} />
              <select className="border p-2 rounded" onChange={e => setRegData({ ...regData, curso: e.target.value })}>{LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}</select>
              <select className="border p-2 rounded" onChange={e => setRegData({ ...regData, letra: e.target.value })}><option>A</option><option>B</option><option>C</option></select>
              <input type="date" className="border p-2 rounded md:col-span-2" placeholder="Fecha Nacimiento" onChange={e => setRegData({ ...regData, fechaNacAlumno: e.target.value })} />
            </div>
            <div className="mt-2 flex gap-4">
               <label className="flex items-center gap-2 text-sm text-blue-900 cursor-pointer">
                  <input type="checkbox" onChange={e => setRegData({ ...regData, esAntiguoAlumno: e.target.checked })} />
                  ¿Es antiguo alumno?
               </label>
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-bold text-gray-700 mb-2">🔐 Datos de Acceso</h3>
            <div className="grid md:grid-cols-2 gap-4">
                {regData.tipo === 'interno' && (
                    <input type="email" className="border p-2 rounded md:col-span-2" placeholder="Email de Contacto (Será tu usuario)" onChange={e => setRegData({ ...regData, emailContacto: e.target.value })} />
                )}
                <input className="w-full border p-3 bg-white rounded md:col-span-2" type="password" placeholder="Contraseña (Mínimo 6 caracteres)" onChange={e => setRegData({ ...regData, password: e.target.value })} />
            </div>
          </div>
          <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition">Registrar Familia</button>
        </form>
        <button onClick={() => setIsRegister(false)} className="w-full mt-4 text-gray-500 hover:text-blue-600 font-medium">¿Ya tienes cuenta? Inicia Sesión</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black flex items-center gap-2">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
            <img src={IMG_ESCUDO} className="h-16 mx-auto mb-4" alt="Logo" />
            <h2 className="text-2xl font-bold mb-2 text-blue-900">Acceso Familias</h2>
            <p className="text-gray-500 text-sm">Gestiona tus inscripciones y pruebas</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" type="email" placeholder="Tu Email" onChange={e => setLoginData({ ...loginData, email: e.target.value })} />
          <input className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" type="password" placeholder="Contraseña" onChange={e => setLoginData({ ...loginData, password: e.target.value })} />
          <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">Entrar</button>
        </form>
        <div className="mt-6 text-center border-t pt-4">
          <p className="text-gray-500 text-sm mb-2">¿Es tu primera vez?</p>
          <button onClick={() => setIsRegister(true)} className="text-blue-600 font-bold hover:underline">Crear Cuenta Nueva</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🚀 COMPONENTE PRINCIPAL (ROUTER)
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [misHijos, setMisHijos] = useState([]);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        if (u.email === ADMIN_EMAIL) {
            setView('admin');
        } else {
            cargarHijos(u.uid);
            setView('dashboard');
        }
      } else {
        setUser(null);
        setView('landing');
      }
    });
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
      {view === 'admin' && <AdminDashboard logout={() => signOut(auth)} />}
    </div>
  );
}