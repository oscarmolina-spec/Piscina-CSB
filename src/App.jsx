import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase.js'; // Importamos tu archivo de claves
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
// ⚙️ CONFIGURACIÓN GENERAL Y CONSTANTES
// ==========================================

const ADMIN_EMAIL = 'extraescolares@sanbuenaventura.org'; // Email del administrador
const CAPACIDAD_POR_HUECO = 2; // Máximo de alumnos por hueco en prueba de nivel

// Imágenes del sistema
const IMG_ESCUDO = 'https://i.ibb.co/JRz06Sym/San-uenaventura.png';
const IMG_PRINCIPAL = 'https://i.ibb.co/HLt30jVK/20241210-084606.jpg';
const IMG_GALERIA_1 = 'https://i.ibb.co/hJxW45tC/20241210-084225.jpg';
const IMG_GALERIA_2 = 'https://i.ibb.co/mrJHGscm/Screenshot-2025-05-09-15-04-17.png';
const MAPA_IMAGEN_URL = "https://i.ibb.co/35RNNBLz/Info-piscina.png";

// Listado Maestro de Cursos Escolares
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
    descripcion: '💧 Iniciación al medio acuático mediante el juego.\n⏰ Horario fijo: 16:00 - 17:00.\nIdeal para perder el miedo y aprender a flotar.',
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
    descripcion: '🏊 Trabajo por niveles (Iniciación, Medio, Perfeccionamiento).\n⏰ Recogida a las 16:15 en el portón azul.',
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
    descripcion: '💦 Iniciación al waterpolo, pases, reglas y juego en equipo.',
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
    descripcion: '✨ Clases para adultos de todos los niveles.',
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
    descripcion: '🧒 Sesiones dinámicas de 30 minutos.',
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
    descripcion: '🚀 Mejora técnica y resistencia.',
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
    descripcion: '🧠 Entrenamiento adaptado a adolescentes.',
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
    descripcion: '🌊 Gimnasia en el agua. Bajo impacto articular.',
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
    descripcion: '🎧 Calle asignada para nadar a tu ritmo. Sin monitor.',
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
// 📧 UTILIDADES: FECHAS Y CORREO
// ==========================================

// Calcular los próximos 4 lunes para las pruebas de nivel
const getNextMondays = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
  const r = [];
  for (let i = 0; i < 4; i++) {
    r.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return r;
};

const getDateId = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getHumanDate = (d) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

// Sistema de envío de Emails simulado (guarda en colección 'mail' para extensión de Firebase)
const enviarEmailConfirmacion = async (email, alumno, cita) => {
  try {
    const nombreAlumno = String(alumno).trim();
    // Guardamos el email en la colección 'mail' que lee la extensión Trigger Email
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
            <p style="font-size: 12px; color: #888;">Este es un mensaje automático. No respondas a este correo.</p>
          </div>
        `,
      },
    });
    console.log("Email en cola de envío para:", email);
  } catch (e) {
    console.error("Error al encolar email:", e);
  }
};
// ==========================================
// 🏠 PÁGINA PÚBLICA (LANDING PAGE)
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {OFERTA_ACTIVIDADES.map((act) => (
                <div key={act.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col hover:shadow-xl transition-shadow">
                  <div className="bg-blue-600 p-4 relative">
                    <h3 className="text-white font-bold text-lg pr-8">{act.nombre}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-blue-800 text-white text-xs px-2 py-1 rounded shadow-sm">
                        📅 {act.diasResumen}
                      </span>
                      {act.requierePrueba && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold shadow-sm animate-pulse">
                          ❗ Requiere Prueba
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
                    <div className="border-t pt-3 mt-auto">
                      <p className="text-blue-600 text-xl font-black text-right">{act.precioResumen}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VISTA INFO */}
          {tab === 'info' && (
            <div className="space-y-10 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow border">
                <h3 className="text-xl font-bold mb-4 text-blue-900 flex items-center gap-2">
                  🗺️ Mapa de Accesos
                </h3>
                <div className="w-full bg-gray-100 rounded flex justify-center p-4">
                  <img src={MAPA_IMAGEN_URL} className="max-h-[600px] object-contain rounded shadow-sm" alt="Mapa" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow border overflow-hidden">
                <div className="bg-blue-600 p-4 text-white font-bold text-lg">🎒 Material Necesario</div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-6 text-gray-700 font-bold text-center">
                  <div className="p-4 bg-gray-50 rounded-lg">👙 Bañador Deportivo</div>
                  <div className="p-4 bg-gray-50 rounded-lg">🧼 Toalla / Albornoz</div>
                  <div className="p-4 bg-gray-50 rounded-lg">🥽 Gafas de Agua</div>
                  <div className="p-4 bg-gray-50 rounded-lg">🩴 Chanclas Antideslizantes</div>
                  <div className="p-4 bg-gray-50 rounded-lg">🎩 Gorro de Piscina</div>
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
// 🛡️ PANEL DE ADMINISTRADOR
// ==========================================
const AdminDashboard = ({ logout }) => {
  const [alumnos, setAlumnos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [tab, setTab] = useState('pruebas');
  const [nuevoAviso, setNuevoAviso] = useState('');

  useEffect(() => {
    // Escuchar cambios en alumnos
    const u1 = onSnapshot(query(collection(db, 'students')), s => 
      setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Escuchar cambios en avisos
    const u2 = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), s => 
      setAvisos(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); };
  }, []);

  const agregarAviso = async (e) => {
    e.preventDefault();
    if (!nuevoAviso) return;
    await addDoc(collection(db, 'avisos'), { texto: nuevoAviso, fecha: new Date().toISOString() });
    setNuevoAviso('');
  };

  const borrarAviso = async (id) => {
    if (confirm('¿Borrar aviso?')) await deleteDoc(doc(db, 'avisos', id));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded shadow">
        <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
        <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700">Cerrar Sesión</button>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('pruebas')} className={`px-4 py-2 rounded shadow font-bold ${tab === 'pruebas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Pruebas de Nivel</button>
        <button onClick={() => setTab('avisos')} className={`px-4 py-2 rounded shadow font-bold ${tab === 'avisos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Gestionar Avisos</button>
      </div>

      {tab === 'avisos' && (
        <div className="bg-white p-6 rounded shadow max-w-2xl">
          <h3 className="font-bold mb-4">Publicar Aviso para Familias</h3>
          <form onSubmit={agregarAviso} className="flex gap-2 mb-4">
            <input 
              className="border p-2 flex-1 rounded" 
              value={nuevoAviso} 
              onChange={e => setNuevoAviso(e.target.value)} 
              placeholder="Escribe un aviso importante..." 
            />
            <button className="bg-green-600 text-white px-4 rounded font-bold">Publicar</button>
          </form>
          <div className="space-y-2">
            {avisos.map(a => (
              <div key={a.id} className="flex justify-between border-b p-3 bg-yellow-50 rounded">
                <span>{a.texto}</span>
                <button onClick={() => borrarAviso(a.id)} className="text-red-500 font-bold hover:bg-red-100 px-2 rounded">🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pruebas' && (
        <div className="bg-white rounded shadow p-4 overflow-x-auto">
          <h3 className="font-bold mb-4">Listado de Pruebas Reservadas</h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="p-3 border-b">Fecha Cita</th>
                <th className="p-3 border-b">Alumno</th>
                <th className="p-3 border-b">Estado</th>
                <th className="p-3 border-b">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.filter(a => a.estado === 'prueba_reservada' || a.citaNivel).map(a => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-blue-600">{a.citaNivel || 'Sin fecha'}</td>
                  <td className="p-3 font-bold">{a.nombre}</td>
                  <td className="p-3"><span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">Prueba Pendiente</span></td>
                  <td className="p-3 text-gray-500">{a.curso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
// ==========================================
// 👨‍👩‍👧‍👦 PANEL DE FAMILIAS (DASHBOARD)
// ==========================================
const Dashboard = ({ user, misHijos, logout, refresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [alumnoEditar, setAlumnoEditar] = useState(null); // Estado para abrir modal de edición
  const [modoModal, setModoModal] = useState(null);
  const [avisos, setAvisos] = useState([]);
  
  const alumnoEnVivo = misHijos.find((h) => h.id === alumnoSeleccionado?.id);

  // Cargar avisos del admin
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'avisos'), orderBy('fecha', 'desc')), (s) => 
      setAvisos(s.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    return () => unsub();
  }, []);

  // Función para dar de baja / borrar alumno
  const gestionarBaja = async (hijo) => {
    if (hijo.estado === 'sin_inscripcion') {
        // Si no está inscrito, BORRAMOS DIRECTAMENTE
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
          // Colores según estado
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
              {/* Barra lateral de color */}
              <div className={`absolute top-0 left-0 w-1.5 h-full ${bordeColor}`}></div>
              
              <div className="flex justify-between items-start mb-2 pl-3">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                    {hijo.nombre} 
                    {/* BOTÓN EDITAR DATOS (LÁPIZ) */}
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

              {/* INFO DE INSCRIPCIÓN */}
              {hijo.estado === 'inscrito' && (
                <div className={`ml-3 mt-4 p-3 rounded-lg border text-sm ${esPendiente ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                  <p className="font-bold mb-1 text-gray-800">{hijo.actividad}</p>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>📅 {hijo.dias}</span>
                    <span>⏰ {hijo.horario}</span>
                  </div>
                </div>
              )}

              {/* INFO DE CITA */}
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

              {/* BOTONERA ACCIONES */}
              <div className="mt-6 pt-4 ml-3 border-t border-gray-100 flex gap-2">
                {hijo.estado === 'inscrito' ? (
                  <>
                    <button className="flex-1 bg-gray-100 text-gray-400 py-2 rounded-lg text-sm font-bold cursor-not-allowed border border-transparent">
                      🔒 Grupo Asignado
                    </button>
                    <button onClick={() => gestionarBaja(hijo)} className="bg-white text-red-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-50 border border-red-200 transition">
                      Baja
                    </button>
                  </>
                ) : hijo.estado === 'prueba_reservada' ? (
                   <button className="w-full bg-orange-100 text-orange-700 py-2 rounded-lg text-sm font-bold cursor-default">
                      Esperando Prueba...
                   </button>
                ) : (
                  <div className="flex w-full gap-2">
                    <button 
                        onClick={() => { setAlumnoSeleccionado(hijo); setModoModal('inscripcion'); }} 
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm"
                    >
                        Gestionar Inscripción
                    </button>
                    {/* BOTÓN BORRAR ALUMNO (PAPELERA) PARA LOS NO INSCRITOS */}
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
      
      {/* BOTÓN AÑADIR NUEVO HIJO */}
      <button 
        onClick={() => setShowForm(true)} 
        className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2 mb-10"
      >
        <span className="text-2xl">+</span> Añadir Otro Alumno
      </button>
      
      {/* RENDERIZADO CONDICIONAL DE MODALES */}
      {showForm && (<FormularioHijo close={() => setShowForm(false)} user={user} refresh={refresh} />)}
      
      {/* MODAL DE EDICIÓN DE DATOS */}
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
            onSuccess={() => setModoModal(null)} // AL TERMINAR LA PRUEBA, CIERRA Y VUELVE AL DASHBOARD
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
// ✏️ FORMULARIO EDICIÓN DE DATOS (NUEVO)
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
// 📅 MODAL DE PRUEBA DE NIVEL
// ==========================================
const PantallaPruebaNivel = ({ alumno, close, onSuccess, user, refresh }) => {
  const [citasOcupadas, setCitasOcupadas] = useState({});
  const diasPrueba = getNextMondays();
  const [diaIdSeleccionado, setDiaIdSeleccionado] = useState(getDateId(diasPrueba[0]));
  
  // Checks de aceptación
  const [aceptaNormas, setAceptaNormas] = useState(alumno.aceptaNormas || false);
  const [autorizaFotos, setAutorizaFotos] = useState(alumno.autorizaFotos || false);

  // Generar huecos de 5 min
  const horas = [];
  for (let h = 16; h < 18; h++) {
    for (let m = 0; m < 60; m += 5) {
      horas.push(`${h}:${m.toString().padStart(2, '0')}`);
    }
  }

  // Cargar citas ocupadas
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
      
      // Enviar correo de confirmación
      await enviarEmailConfirmacion(auth.currentUser.email, alumno.nombre, textoCita);

      alert('✅ Cita Confirmada correctamente.');
      refresh(user.uid);
      onSuccess(); // ESTO CIERRA EL MODAL Y VUELVE AL DASHBOARD
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

        {/* CHECKBOXES NORMAS (Si no estaban aceptadas antes) */}
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
  // Estado local para permitir edición antes de inscribir
  const [datosAlumno, setDatosAlumno] = useState({ 
    nombre: alumno.nombre, 
    curso: alumno.curso, 
    fechaNacimiento: alumno.fechaNacimiento || '' 
  });
  
  // Filtrar actividades disponibles según el curso seleccionado en tiempo real
  const actividadesDisponibles = OFERTA_ACTIVIDADES.filter((act) => act.cursos.includes(datosAlumno.curso));
  
  const [aceptaNormas, setAceptaNormas] = useState(alumno.aceptaNormas || false);
  const [autorizaFotos, setAutorizaFotos] = useState(alumno.autorizaFotos || false);

  const inscribir = async (act, op) => {
    if (!aceptaNormas) return alert("⚠️ Debes aceptar las normas para continuar.");
    if (!datosAlumno.nombre) return alert("⚠️ El nombre es obligatorio.");

    // Lógica de Prueba de Nivel
    if (act.requierePrueba && !alumno.esAntiguoAlumno && !alumno.citaNivel && alumno.estado !== 'prueba_reservada') {
      // Guardamos los cambios de nombre/curso y los checks antes de ir a la prueba
      await updateDoc(doc(db, 'students', alumno.id), { 
          ...datosAlumno, 
          aceptaNormas: true, 
          autorizaFotos 
      });
      
      if (confirm(`La actividad "${act.nombre}" requiere prueba de nivel.\n¿Deseas reservar cita ahora?`)) {
        onRequirePrueba(); // Abrir modal de prueba
      }
      return;
    }

    if (!confirm(`¿Confirmar inscripción en:\n${act.nombre}\n📅 ${op.dias}\n⏰ ${op.horario}?`)) return;

    // Guardar Inscripción Definitiva
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

        {/* SECCIÓN DATOS ALUMNO (EDITABLES) */}
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

        {/* SECCIÓN NORMAS */}
        <div className="bg-gray-50 p-3 rounded mb-4 text-xs border border-gray-200">
            <label className="flex gap-2 mb-2 items-start cursor-pointer">
                <input 
                    type="checkbox" 
                    className="mt-0.5"
                    checked={aceptaNormas} 
                    onChange={e => setAceptaNormas(e.target.checked)} 
                    disabled={alumno.aceptaNormas} // Si ya aceptó antes, no se puede quitar
                /> 
                <span className={alumno.aceptaNormas ? 'text-green-700 font-bold' : ''}>
                    {alumno.aceptaNormas ? '✅ Normas y Condiciones aceptadas' : 'He leído y acepto las normas (OBLIGATORIO)'}
                </span>
            </label>
            <label className="flex gap-2 items-start cursor-pointer">
                <input 
                    type="checkbox" 
                    className="mt-0.5"
                    checked={autorizaFotos} 
                    onChange={e => setAutorizaFotos(e.target.checked)} 
                /> 
                <span>Autorizo fotos/vídeos del menor con fines educativos.</span>
            </label>
        </div>

        <h3 className="font-bold text-gray-700 mb-2 text-sm border-b pb-1">Actividades Disponibles ({actividadesDisponibles.length})</h3>

        {/* LISTADO DE ACTIVIDADES */}
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
                  <p className="text-xs text-gray-500 mb-3 whitespace-pre-line">{act.descripcion}</p>
                  
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
// ➕ FORMULARIO ALTA HIJO (Inicial)
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
// 🔐 LOGIN Y REGISTRO (COMPLEJO)
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

      // 1. Crear usuario en Auth
      const cred = await createUserWithEmailAndPassword(auth, email, regData.password);
      
      // 2. Guardar datos del padre/usuario
      await setDoc(doc(db, 'users', cred.user.uid), { email, ...regData });
      
      // 3. Crear el primer alumno automáticamente
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl mt-10 animate-fade-in-up">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Registro de Familia</h2>
          <p className="text-sm text-gray-500">Crea tu cuenta para gestionar inscripciones</p>
        </div>
        
        <form onSubmit={validateAndRegister} className="space-y-6">
          {/* SELECTOR TIPO */}
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
              <select className="border p-2 rounded" onChange={e => setRegData({ ...regData, curso: e.target.value })}>
                {LISTA_CURSOS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
              </select>
              <select className="border p-2 rounded" onChange={e => setRegData({ ...regData, letra: e.target.value })}>
                <option>A</option><option>B</option><option>C</option>
              </select>
              <input type="date" className="border p-2 rounded md:col-span-2" placeholder="Fecha Nacimiento" onChange={e => setRegData({ ...regData, fechaNacAlumno: e.target.value })} />
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <button onClick={() => setView('landing')} className="absolute top-4 left-4 font-bold text-gray-500 hover:text-black">⬅ Volver al Inicio</button>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-