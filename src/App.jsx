'use client';
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot, // 👈 ¡Sincronización en tiempo real activa!
  enableIndexedDbPersistence
} from 'firebase/firestore';

// Habilitar persistencia de Firestore offline para soportar mala cobertura en el pabellón/colegio
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("La persistencia falló: múltiples pestañas abiertas.");
    } else if (err.code === 'unimplemented') {
      console.warn("El navegador no soporta persistencia offline.");
    }
  });
}
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Esto es como un "escudo" para que el mapa cargue solo cuando la web esté lista
const MapaActividad = dynamic(() => import('./Mapa'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '350px',
        backgroundColor: '#f1f5f9',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
      }}
    >
      Cargando mapa interactivo...
    </div>
  ),
});
// ⭐ ESTE ES EL NUEVO: Mapa para los Puntos de Interés Generales
const MapaPuntosInteres = dynamic(() => import('./MapaPuntosInteres'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100vh', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Cargando mapa maestro...</p>
    </div>
  ),
});

// 🔔 Componente Toast Premium para notificaciones elegantes
function ToastContainer({ toasts }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '350px',
      width: '100%',
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '16px 20px',
          borderRadius: '16px',
          backgroundColor: t.tipo === 'exito' ? '#10b981' : t.tipo === 'error' ? '#ef4444' : t.tipo === 'advertencia' ? '#f59e0b' : '#3b82f6',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '15px',
          pointerEvents: 'auto',
          animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards, fadeOut 0.3s ease-in 3.2s forwards',
          borderLeft: '5px solid rgba(0,0,0,0.2)'
        }}>
          <span>{t.mensaje}</span>
        </div>
      ))}
    </div>
  );
}

// 🔑 Componente Modal de Login Admin Premium (Glassmorphism con Firebase Auth)
function AdminPasswordModal({ mostrar, onClose, db, setIsAdmin, lanzarToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarOjo, setMostrarOjo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mostrar) {
      setEmail('');
      setPassword('');
      setLoading(false);
    }
  }, [mostrar]);

  if (!mostrar) return null;

  const validar = async (e) => {
    e.preventDefault();
    if (!email) return lanzarToast('¡Escribe tu correo de administrador! 📧', 'advertencia');
    if (!password) return lanzarToast('¡Escribe tu contraseña! 🔑', 'advertencia');
    setLoading(true);

    try {
      // 🔐 AUTENTICACIÓN REAL CONTRA FIREBASE AUTH EN TIEMPO REAL
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();
      
      await signInWithEmailAndPassword(auth, email, password);
      
      setIsAdmin(true);
      lanzarToast('¡Superpoderes de Admin activados! 🌟 (Autenticado de forma 100% segura)', 'exito');
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        lanzarToast('❌ Correo o contraseña incorrectos', 'error');
      } else {
        lanzarToast('❌ Error de conexión al autenticar', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <form onSubmit={validar} style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '35px',
        borderRadius: '32px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🔑</div>
        <h3 style={{ margin: '0 0 10px', color: '#0f172a', fontWeight: '900', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
          Área de Administración
        </h3>
        <p style={{ margin: '0 0 25px', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
          Introduce tu correo y contraseña de Firebase para activar los superpoderes de edición de forma 100% segura.
        </p>

        {/* Campo de Correo Electrónico */}
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <input
            type="email"
            placeholder="Correo del administrador..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '2px solid #e2e8f0',
              fontSize: '1rem',
              outline: 'none',
              boxSizing: 'border-box',
              fontWeight: 'bold',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>

        {/* Campo de Contraseña */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input
            type={mostrarOjo ? 'text' : 'password'}
            placeholder="Introduce la contraseña..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 45px 14px 16px',
              borderRadius: '16px',
              border: '2px solid #e2e8f0',
              fontSize: '1rem',
              outline: 'none',
              boxSizing: 'border-box',
              fontWeight: 'bold',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
          <button
            type="button"
            onClick={() => setMostrarOjo(!mostrarOjo)}
            style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}
          >
            {mostrarOjo ? '👁️' : '🙈'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s'
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Validando...' : 'Validar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 💀 Componente de Carga Esqueleto (Skeleton Card)
function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '28px',
      height: '530px',
      overflow: 'hidden',
      border: '3px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 20px 35px rgba(0, 0, 0, 0.05)',
      animation: 'pulse 1.5s infinite ease-in-out'
    }}>
      {/* Img Box */}
      <div style={{ height: '180px', backgroundColor: '#e2e8f0' }} />
      {/* Content Box */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '12px' }}>
        <div style={{ height: '24px', backgroundColor: '#e2e8f0', borderRadius: '6px', width: '70%' }} />
        <div style={{ height: '30px', backgroundColor: '#e2e8f0', borderRadius: '12px', width: '45%', marginTop: '5px' }} />
        <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', width: '55%' }} />
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', height: '24px' }}>
            <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '25%' }} />
            <div style={{ height: '28px', backgroundColor: '#e2e8f0', borderRadius: '6px', width: '35%' }} />
          </div>
          <div style={{ height: '42px', backgroundColor: '#e2e8f0', borderRadius: '14px', width: '100%' }} />
          <div style={{ height: '42px', backgroundColor: '#e2e8f0', borderRadius: '14px', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [vista, setVista] = useState('catalogo');
  const [fotoFondoHeader, setFotoFondoHeader] = useState('');
  const [fotosEtapas, setFotosEtapas] = useState({
    Infantil: '',
    Primaria: '',
    ESO: '',
    Adultos: '',
    'Clubes Amigos': ''
  });
  const [preguntaAbierta, setPreguntaAbierta] = useState(null);
  const [etapaActiva, setEtapaActiva] = useState('Todos');
  const [actividades, setActividades] = useState([]);
  const [puntosInteres, setPuntosInteres] = useState([]);
  const [editandoPuntoId, setEditandoPuntoId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Este es el estado que le dirá al mapa a dónde volar
  const [destino, setDestino] = useState(null);
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [editandoId, setEditandoId] = useState(null); // Para saber si estamos creando o editando
  const [pestaña, setPestaña] = useState('info'); // Puede ser 'info' o 'mapa'
  const [coordsTemp, setCoordsTemp] = useState({
    latA: '',
    lngA: '',
    latM: '',
    lngM: '',
    latF: '',
    lngF: '',
  });

  // 🌟 NUEVOS ESTADOS PREMIUM
  const [toasts, setToasts] = useState([]); // [{ id, mensaje, tipo }]
  const [mostrarAdminModal, setMostrarAdminModal] = useState(false);
  const [claveInput, setClaveInput] = useState('');
  const [mostrarOjo, setMostrarOjo] = useState(false);
  const [cargando, setCargando] = useState(true); // Control del Skeleton Loading
  const [modoOscuro, setModoOscuro] = useState(false); // 🌓 Control del Modo Oscuro
  const [capturandoCoordenadasPara, setCapturandoCoordenadasPara] = useState(null); // 📡 Indica qué campo se está rellenando al hacer clic en el mapa
  const [mostrarSubirArriba, setMostrarSubirArriba] = useState(false); // ⬆️ Control de visibilidad del botón para volver arriba
  const [mostrarMenuEtapas, setMostrarMenuEtapas] = useState(true); // 🧸 Control del portal de bienvenida por etapas
  const [subcategoriaActiva, setSubcategoriaActiva] = useState('Todas');

  // 🔔 FUNCIÓN DE TOASTS PERSONALIZADOS
  const lanzarToast = (mensaje, tipo = 'exito') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 📚 FUNCIÓN DE RESOLUCIÓN EN TIEMPO REAL DE ACTIVIDADES DE ETAPA (100% REALES DESDE FIRESTORE)
  const obtenerPillsEjemplos = (etapaId) => {
    const actsEtapa = pillsEjemplosPorEtapa[etapaId] || [];

    if (actsEtapa.length === 0) {
      return (
        <span style={{ fontSize: '0.78rem', color: modoOscuro ? '#94a3b8' : '#64748b', fontStyle: 'italic', display: 'block', padding: '4px 0' }}>
          ¡Próximamente más actividades! 🚀
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {actsEtapa.map((item, idx) => (
          <span
            key={item.id || idx}
            style={{
              fontSize: '0.76rem',
              color: modoOscuro ? '#cbd5e1' : '#334155',
              fontWeight: '600',
              backgroundColor: modoOscuro ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              padding: '4px 10px',
              borderRadius: '10px',
              border: `1px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}`
            }}
          >
            {item.nombre}
          </span>
        ))}
      </div>
    );
  };


  // 🔑 ESCUCHA EN TIEMPO REAL PARA MANTENER LA SESIÓN DEL ADMINISTRADOR ACTIVA
  useEffect(() => {
    const escucharAuth = async () => {
      try {
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');
        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
          if (user) {
            setIsAdmin(true);
            lanzarToast('¡Sesión de administrador recuperada! 🔑', 'info');
          } else {
            setIsAdmin(false);
          }
        });
      } catch (err) {
        console.error("Error al inicializar escucha de autenticación:", err);
      }
    };
    escucharAuth();
  }, []);

  // ⬆️ ESCUCHA DE SCROLL PARA MOSTRAR U OCULTAR EL BOTÓN "VOLVER ARRIBA"
  useEffect(() => {
    const manejarScroll = () => {
      if (window.scrollY > 400) {
        setMostrarSubirArriba(true);
      } else {
        setMostrarSubirArriba(false);
      }
    };
    window.addEventListener('scroll', manejarScroll);
    return () => window.removeEventListener('scroll', manejarScroll);
  }, []);

  // 2️⃣ SEGUNDO: ¡AQUÍ JUSTO VA TU NUEVO ROBOT (useEffect)!
  // Colócalo aquí mismo, libre y sin meterlo en ningún "if"
  useEffect(() => {
    const cargarConfiguracionCole = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        // 🔍 Buscamos en el rincón seguro de las actividades
        const docSnap = await getDoc(doc(db, "actividades_cole", "configuracion_header"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fotoFondoHeader) {
            setFotoFondoHeader(data.fotoFondoHeader);
          }
          setFotosEtapas({
            Infantil: data.fotoEtapaInfantil || '',
            Primaria: data.fotoEtapaPrimaria || '',
            ESO: data.fotoEtapaESO || '',
            Adultos: data.fotoEtapaAdultos || '',
            'Clubes Amigos': data.fotoEtapaClubes || ''
          });
        }
      } catch (error) {
        console.error("Error al cargar la configuración de fotos:", error);
      }
    };
    cargarConfiguracionCole();
  }, []);

  // 📡 HOOK GLOBAL PARA INTERCEPTAR CLICS EN LOS MAPAS DE LEAFLET
  useEffect(() => {
    const hookLeaflet = () => {
      if (typeof window !== 'undefined' && window.L && window.L.Map) {
        if (!window.L.Map.prototype._hasAntigravityClickHook) {
          window.L.Map.prototype._hasAntigravityClickHook = true;
          window.L.Map.addInitHook(function () {
            this.on('click', (e) => {
              window.dispatchEvent(new CustomEvent('leaflet-map-click', { 
                detail: { lat: e.latlng.lat, lng: e.latlng.lng } 
              }));
            });
          });
        }
      }
    };

    hookLeaflet();
    const interval = setInterval(hookLeaflet, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMapClick = (e) => {
      const { lat, lng } = e.detail;
      if (!capturandoCoordenadasPara) return;

      const latFijo = lat.toFixed(6);
      const lngFijo = lng.toFixed(6);

      if (capturandoCoordenadasPara === 'maestro') {
        const inputLat = document.getElementById('nuevoPuntoLat');
        const inputLng = document.getElementById('nuevoPuntoLng');
        if (inputLat && inputLng) {
          inputLat.value = latFijo;
          inputLng.value = lngFijo;
          inputLat.dispatchEvent(new Event('input', { bubbles: true }));
          inputLng.dispatchEvent(new Event('input', { bubbles: true }));
          lanzarToast('¡Coordenadas del mapa maestro capturadas! 📍', 'exito');
        }
      } else if (capturandoCoordenadasPara === 'actividad') {
        setNuevaAct(prev => ({ ...prev, latAct: latFijo, lngAct: lngFijo }));
        lanzarToast('¡Coordenadas de la actividad capturadas! 🎒', 'exito');
      } else if (capturandoCoordenadasPara === 'monitores') {
        setNuevaAct(prev => ({ ...prev, latMon: latFijo, lngMon: lngFijo }));
        lanzarToast('¡Coordenadas de monitores capturadas! 🚶‍♂️', 'exito');
      } else if (capturandoCoordenadasPara === 'familias') {
        setNuevaAct(prev => ({ ...prev, latFam: latFijo, lngFam: lngFijo }));
        lanzarToast('¡Coordenadas de familias capturadas! 👨‍👩‍👧', 'exito');
      }

      setCapturandoCoordenadasPara(null); // Desactivar modo captura
      setVista('panel'); // Volver automáticamente al panel de control
    };

    window.addEventListener('leaflet-map-click', handleMapClick);
    return () => window.removeEventListener('leaflet-map-click', handleMapClick);
  }, [capturandoCoordenadasPara, setVista]);

  const [clubes, setClubes] = useState([]); // Aquí guardaremos la lista que viene de la nube
  const [empresaActiva, setEmpresaActiva] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false); // Para abrir y cerrar el panel
  const [diaActivo, setDiaActivo] = useState('Todos');         // Para saber qué día eligen
  const [nuevoClub, setNuevoClub] = useState({
  nombre: '',
  etapas: [],
  horario: '',
  descripcion: '',
  imagen: '',          // Aquí irá el logo
  contacto: '',        // Teléfono o Email
  linkInscripcion: '', // El enlace directo general
  latAct: '',          // Punto de interés (latitud)
  lngAct: '',          // Punto de interés (longitud)
  linksMultiples: []   // 🌟 ¡NUEVO! Aquí guardaremos la lista de cursos y enlaces
});

  // 📚 MEMOIZACIÓN PREMIUM DE ACTIVIDADES DE ETAPA (100% REALES Y OPTIMIZADAS)
  const pillsEjemplosPorEtapa = useMemo(() => {
    const todoJunto = [
      ...actividades.map(a => ({ ...a, esClub: false })),
      ...clubes.map(c => ({ ...c, esClub: true }))
    ];
    
    const obtenerActs = (etapaId) => {
      return todoJunto.filter(item => {
        if (etapaId === 'Clubes Amigos') {
          return item.esClub || item.etapa === 'Clubes Amigos' || (item.etapas && item.etapas.includes('Clubes Amigos'));
        }
        if (etapaId === 'Infantil') {
          return item.Infantil || item.etapa === 'Infantil' || (item.etapas && item.etapas.includes('Infantil'));
        }
        if (etapaId === 'ESO') {
          return item.ESO || item.etapa === 'ESO' || (item.etapas && item.etapas.includes('ESO'));
        }
        if (etapaId === 'Adultos') {
          return item.Adultos || item.etapa === 'Adultos' || (item.etapas && item.etapas.includes('Adultos'));
        }
        if (etapaId === 'Primaria') {
          return item.Primaria || item.etapa === 'Primaria' || (item.etapas && item.etapas.includes('Primaria')) ||
                 (!item.esClub && !item.Infantil && !item.ESO && !item.Adultos && item.etapa !== 'Infantil' && item.etapa !== 'ESO' && item.etapa !== 'Adultos' && item.etapa !== 'Clubes Amigos');
        }
        return false;
      });
    };

    return {
      Infantil: obtenerActs('Infantil').slice(0, 4),
      Primaria: obtenerActs('Primaria').slice(0, 4),
      ESO: obtenerActs('ESO').slice(0, 4),
      Adultos: obtenerActs('Adultos').slice(0, 4),
      'Clubes Amigos': obtenerActs('Clubes Amigos').slice(0, 4)
    };
  }, [actividades, clubes]);

  // 🧠 CLASIFICADOR AUTOMÁTICO INTELIGENTE POR PALABRAS CLAVE CON CONTROL TOTAL
  const obtenerCategoriaDeActividad = (item) => {
    if (item.categoria) return item.categoria;

    const nombre = (item.nombre || '').toLowerCase();
    const info = (item.info || item.descripcion || '').toLowerCase();
    const textoCompleto = `${nombre} ${info}`;

    const keywordsDeportes = [
      'futbol', 'fútbol', 'baloncesto', 'judo', 'natacion', 'natación', 'patinaje', 'deporte', 
      'gimnasia', 'atletismo', 'tenis', 'padel', 'pádel', 'karate', 'taekwondo', 'balonmano',
      'voleibol', 'futbolin', 'fútbolin', 'esgrima', 'deportiva'
    ];

    const keywordsIdiomas = [
      'ingles', 'inglés', 'english', 'idioma', 'idiomas', 'frances', 'francés', 'aleman', 'alemán', 
      'oratoria', 'debate', 'chinesse', 'chino', 'language', 'cambridge'
    ];

    const keywordsArte = [
      'teatro', 'zumba', 'baile', 'danza', 'lectura', 'arte', 'expresion', 'expresión', 'musica', 
      'música', 'pintura', 'dibujo', 'coro', 'guitarra', 'piano', 'flauta', 'violn', 'violín', 
      'espectaculo', 'espectáculo', 'creatividad', 'creativa'
    ];

    const keywordsTecnologia = [
      'robotica', 'robótica', 'ajedrez', 'digital', 'tecnologia', 'tecnología', 'programacion', 
      'programación', 'manualidades', 'costura', 'cocina', 'lego', 'minecraft', 'scratch', 
      'ciencias', 'experimentos', 'brico', 'bricolaje', 'taller'
    ];

    const contieneKeyword = (texto, keywords) => {
      return keywords.some(keyword => texto.includes(keyword));
    };

    if (contieneKeyword(textoCompleto, keywordsDeportes)) return 'Deportes';
    if (contieneKeyword(textoCompleto, keywordsIdiomas)) return 'Idiomas';
    if (contieneKeyword(textoCompleto, keywordsArte)) return 'Arte/expresión';
    if (contieneKeyword(textoCompleto, keywordsTecnologia)) return 'Tecnología/manualidades';

    return 'Deportes'; // Default fallback si no coincide nada
  };

  // 🚀 ACTIVIDADES ACTIVAS EN LA ETAPA ACTUAL (Para conteo dinámico y visibilidad reactiva)
  const activitiesInActiveStage = useMemo(() => {
    const todoJunto = [
      ...actividades.map(a => ({ ...a, esClub: false })),
      ...clubes.map(c => ({ ...c, esClub: true }))
    ];
    const etapaBoton = etapaActiva.trim().toLowerCase();
    if (etapaBoton === 'todos') return todoJunto;

    return todoJunto.filter(item => {
      const esClub = item.etapas && item.etapas.includes('Clubes Amigos');
      if (etapaBoton === 'clubes amigos') return esClub;
      if (esClub) return false;

      const estaEnListaEtapas = Array.isArray(item.etapas) && 
                                item.etapas.some(e => e.trim().toLowerCase() === etapaBoton);
      const etapaSimple = (item.etapa || "").trim().toLowerCase();
      return estaEnListaEtapas || (etapaSimple === etapaBoton);
    });
  }, [actividades, clubes, etapaActiva]);

  // 📊 CONTEO REACTIVO DE ACTIVIDADES POR SUB-CATEGORÍA EN LA ETAPA ACTIVA
  const categoriasDisponibles = useMemo(() => {
    const counts = {
      Todas: activitiesInActiveStage.length,
      Deportes: 0,
      Idiomas: 0,
      'Arte/expresión': 0,
      'Tecnología/manualidades': 0
    };

    activitiesInActiveStage.forEach(item => {
      const cat = obtenerCategoriaDeActividad(item);
      if (cat && cat in counts) {
        counts[cat]++;
      }
    });

    return counts;
  }, [activitiesInActiveStage]);

  // 🚀 FILTRO MEMOIZADO SÚPER VELOZ PARA EL CATÁLOGO (CERO RELENTIZACIONES)
  const itemsFiltrados = useMemo(() => {
    const todoJunto = [
      ...actividades.map(a => ({ ...a, esClub: false })),
      ...clubes.map(c => ({ ...c, esClub: true }))
    ];

    const normalizar = (texto) => 
      texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      
    const loQueEscribeLaFamilia = normalizar(busqueda);
    const etapaBoton = etapaActiva.trim().toLowerCase();
    const empresaBoton = empresaActiva.trim().toLowerCase();
    const diaBoton = diaActivo.toLowerCase();

    return todoJunto.filter((item) => {
      // 1. Filtrar por subcategoría activa si no es 'Todas'
      if (subcategoriaActiva !== 'Todas') {
        const cat = obtenerCategoriaDeActividad(item);
        if (cat !== subcategoriaActiva) return false;
      }

      const nombreActividad = normalizar(item.nombre || "");
      if (!nombreActividad.includes(loQueEscribeLaFamilia)) return false;
    
      const empresaActividad = (item.empresa || "").trim().toLowerCase();
      const cumpleEmpresa = 
        empresaBoton === 'todas' || 
        empresaActividad === empresaBoton ||
        (empresaBoton === 'san buenaventura' && empresaActividad === 'colegio san buenaventura');
    
      if (!cumpleEmpresa) return false;
    
      const diasActividad = (item.dias || "").toLowerCase();
      const cumpleDia = diaBoton === 'todos' || diasActividad.includes(diaBoton);
      if (!cumpleDia) return false;
    
      const esClub = item.etapas && item.etapas.includes('Clubes Amigos');
      if (etapaBoton === 'clubes amigos') return esClub;
      if (esClub) return false;
      
      if (etapaBoton === 'todos') return true;
      
      const estaEnListaEtapas = Array.isArray(item.etapas) && 
                                item.etapas.some(e => e.trim().toLowerCase() === etapaBoton);
      
      const etapaSimple = (item.etapa || "").trim().toLowerCase();
      const esEtapaVieja = etapaSimple === etapaBoton;
    
      return estaEnListaEtapas || esEtapaVieja;
    });
  }, [actividades, clubes, busqueda, etapaActiva, empresaActiva, diaActivo, subcategoriaActiva]);
// 🚀 ¡AQUÍ LAS PEGAS! LAS TRES FUNCIONES NUEVAS:
  const agregarFilaLink = () => {
    setNuevoClub({
      ...nuevoClub,
      linksMultiples: [...(nuevoClub.linksMultiples || []), { etiqueta: '', url: '' }]
    });
  };

  const manejarCambioLink = (index, campo, valor) => {
    const nuevosLinks = [...(nuevoClub.linksMultiples || [])];
    nuevosLinks[index][campo] = valor;
    setNuevoClub({ ...nuevoClub, linksMultiples: nuevosLinks });
  };

  const eliminarFilaLink = (index) => {
    const nuevosLinks = (nuevoClub.linksMultiples || []).filter((_, i) => i !== index);
    setNuevoClub({ ...nuevoClub, linksMultiples: nuevosLinks });
  };
  // 🏰 El enlace mágico de tu escudo desde Storage
  const URL_ESCUDO =
    'https://firebasestorage.googleapis.com/v0/b/extraescolarescsb.firebasestorage.app/o/colegio%20buena%20-%20Editada.png?alt=media&token=d30127c6-037e-47c5-a7e0-29d7cd5585fd';

    const [nuevaAct, setNuevaAct] = useState({
      nombre: '',
      categoria: '', // 👈 Control Total Manual o Clasificación Automática
      etapas: [], // 👈 ¡Ahora es una lista para marcar varias!
      dias: '',
      horario: '',
      lugar: '',
      info: '',
      imagen: '',
      recogidaMonitores: '',
      recogidaFamilias: '',
      precio: '',
      latAct: '40.407937755274425',
      lngAct: '-3.7469348757382366',
      fotoAct: '', 
      fotoMon: '', 
      fotoFam: '', 
    });

  // 📡 SINCRONIZACIÓN EN TIEMPO REAL CON FIRESTORE (onSnapshot)
  useEffect(() => {
    setCargando(true);

    // 1. Actividades reales en tiempo real
    const qAct = query(collection(db, 'actividades_cole'));
    const unsubAct = onSnapshot(qAct, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const actividadesReales = docs.filter(
        (item) =>
          item.id !== 'configuracion_header' &&
          item.id !== 'configuración header' &&
          !item.id.toLowerCase().includes('configuracio')
      );
      setActividades(actividadesReales);
      setCargando(false);
    }, (error) => {
      console.error("Error al cargar actividades:", error);
      lanzarToast("Error al conectar con la base de datos de actividades ☁️", "error");
      setCargando(false);
    });

    // 2. Puntos de interés en tiempo real (Mapa Maestro)
    const qPuntos = query(collection(db, 'puntos_interes_cole'));
    const unsubPuntos = onSnapshot(qPuntos, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPuntosInteres(docs);
    }, (error) => {
      console.error("Error al cargar puntos de interés:", error);
    });

    // 3. Clubes Amigos en tiempo real
    const qClubes = query(collection(db, 'clubes_cole'));
    const unsubClubes = onSnapshot(qClubes, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClubes(docs);
    }, (error) => {
      console.error("Error al cargar clubes:", error);
    });

    return () => {
      unsubAct();
      unsubPuntos();
      unsubClubes();
    };
  }, []);

  // 📡 CONTROL DE ENLACES COMPARTIDOS (DEEP LINKING / URL PARAMS)
  useEffect(() => {
    if (cargando || (actividades.length === 0 && clubes.length === 0)) return;

    const params = new URLSearchParams(window.location.search);
    const actId = params.get('act');
    if (actId) {
      const encontrada = actividades.find(a => a.id === actId) || clubes.find(c => c.id === actId);
      if (encontrada) {
        setActividadSeleccionada(encontrada);
        setVista('detalles');
      }
    }
  }, [cargando, actividades, clubes]);

  // Funciones de compatibilidad para evitar errores al guardar/borrar
  const cargarActividades = () => {};
  const cargarPuntosInteres = () => {};

  const guardarActividad = async () => {
    if (!isAdmin) return lanzarToast('🛑 ¡Acceso denegado! No tienes permisos de administrador. 🔐', 'error');
    if (!nuevaAct.nombre) return lanzarToast('¡Escribe el nombre de la actividad! 📝', 'advertencia');
    
    if (!nuevaAct.etapas || nuevaAct.etapas.length === 0) {
      return lanzarToast('¡Debes elegir al menos una etapa para que aparezca en la web! 🚩', 'advertencia');
    }

    // 🚀 Preparamos el paquete limpiando los enlaces antiguos y nuevos
    const actividadFinal = {
      ...nuevaAct,
      etapas: nuevaAct.etapas,
      // 🌟 EL TRUCO DE LA PISCINA: Aseguramos que la casilla principal guarde la web en los dos campos posibles
      enlace: nuevaAct.enlace || '',
      linkInscripcion: nuevaAct.enlace || '',
      // 🌟 Añadimos también los links múltiples por si acaso
      linksMultiples: nuevaAct.linksMultiples || [],
      latAct: parseFloat(nuevaAct.latAct) || 0,
      lngAct: parseFloat(nuevaAct.lngAct) || 0,
      latMon: parseFloat(nuevaAct.latMon) || 0,
      lngMon: parseFloat(nuevaAct.lngMon) || 0,
      latFam: parseFloat(nuevaAct.latFam) || 0,
      lngFam: parseFloat(nuevaAct.lngFam) || 0,
    };

    delete actividadFinal.etapa;

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'actividades_cole', editandoId), actividadFinal);
        lanzarToast('¡Actividad actualizada con éxito! 🔄', 'exito');
      } else {
        await addDoc(collection(db, 'actividades_cole'), actividadFinal);
        lanzarToast('¡Publicado con éxito! ✨', 'exito');
      }

      // ✨ LIMPIEZA TOTAL (¡Actualizada con los enlaces!)
      setNuevaAct({
        nombre: '',
        categoria: '', // 🧹 Limpiamos la categoría
        etapas: [],
        empresa: '',
        logoEmpresa: '',
        nombreContacto: '',
        contacto: '', // Este es el email
        dias: '',
        horario: '',
        lugar: '',
        info: '',
        imagen: '',
        enlace: '',           // 🧹 Limpiamos el enlace principal antiguo
        linksMultiples: [],   // 🧹 Limpiamos la nueva lista de enlaces múltiples
        recogidaMonitores: '',
        recogidaFamilias: '',
        precio: '',
        latAct: '40.407937755274425',
        lngAct: '-3.7469348757382366',
        latMon: '',
        lngMon: '',
        latFam: '',
        lngFam: '',
        fotoAct: '',
        fotoMon: '',
        fotoFam: '',
      });

      setEditandoId(null);
      setVista('catalogo');
      cargarActividades();
    } catch (e) {
      console.error('Error al guardar:', e);
      lanzarToast('Vaya, parece que ha habido un error al conectar con la nube.', 'error');
    }
  };

  // 🚀 El "brazo robótico" para guardar Clubes Amigos (¡También actualizado!)
  const guardarClub = async () => {
    if (!isAdmin) return lanzarToast('🛑 ¡Acceso denegado! No tienes permisos de administrador. 🔐', 'error');
    if (!nuevoClub.nombre) return lanzarToast('¡Escribe el nombre del club! 🥋', 'advertencia');
    if (nuevoClub.etapas.length === 0) return lanzarToast('¡Marca al menos una etapa! 🏁', 'advertencia');

    try {
      // 🚀 Preparamos el paquete como siempre
      const clubFinal = {
        nombre: nuevoClub.nombre,
        etapas: nuevoClub.etapas,
        horario: nuevoClub.horario || '',
        descripcion: nuevoClub.descripcion || '',
        imagen: nuevoClub.imagen || '',
        contacto: nuevoClub.contacto || '',
        linkInscripcion: nuevoClub.linkInscripcion || '',
        linksMultiples: nuevoClub.linksMultiples || [], // 🌟 ¡NUEVO! Añadimos esto para la nube de los clubes
        latAct: parseFloat(nuevoClub.latAct) || 0,
        lngAct: parseFloat(nuevoClub.lngAct) || 0
      };

      // ✨ ¡AQUÍ ESTÁ EL TRUCO!
      if (editandoId) {
        // ✏️ SI HAY UN ID: Usamos updateDoc para sobrescribir el viejo
        await updateDoc(doc(db, 'clubes_cole', editandoId), clubFinal);
        lanzarToast('¡Club Amigo actualizado! ✨', 'exito');
      } else {
        // 🆕 SI NO HAY ID: Usamos addDoc para crear uno nuevo
        await addDoc(collection(db, 'clubes_cole'), clubFinal);
        lanzarToast('¡Club Amigo guardado con éxito! 🌟', 'exito');
      }

      // 🧹 Limpiamos el cajón y reseteamos el ID de edición
      setNuevoClub({
        nombre: '', etapas: [], horario: '', descripcion: '',
        imagen: '', contacto: '', linkInscripcion: '', latAct: '', lngAct: '',
        linksMultiples: [] // 🌟 ¡NUEVO! También limpiamos la lista de los clubes al terminar
      });
      setEditandoId(null); // 👈 ¡Súper importante para que el siguiente no sea una edición!
      
      setVista('catalogo');
      if (typeof cargarClubes === 'function') cargarClubes();

    } catch (e) {
      console.error('Error al guardar/actualizar:', e);
      lanzarToast('¡Uy! Ha fallado el envío a la nube.', 'error');
    }
  };
  const cargarClubes = () => {};
// 📑 Lista de preguntas frecuentes corregidas y adaptadas para las familias
const preguntasFrecuentes = [
  {
    id: 1,
    pregunta: "❓ ¿Cómo recogen los monitores a los alumnos y dónde se entregan?",
    respuesta: "¡Es súper fácil! Dentro de esta misma web, si pulsas en el botón 'Ver información completa' de cada actividad, verás detallado paso a paso el lugar exacto donde se realiza, dónde recogen los monitores a los niños y en qué punto se entregan a las familias al terminar. ¡Todo bien especificado para tu total tranquilidad!"
  },
  {
    id: 2,
    pregunta: "📋 ¿Cuándo se pasan los recibos mensuales de las actividades?",
    respuesta: "Los recibos de las actividades extraescolares se cobran de forma cómoda para las familias siempre a principio de cada mes."
  },
  {
    id: 3,
    pregunta: "❌ ¿Cómo puedo solicitar la baja de una actividad?",
    respuesta: "Si necesitas solicitar una baja, recuerda hacerlo siempre antes del día 25 del mes anterior. El trámite se realiza directamente a través de la página web de Alventus, a excepción de las actividades de piscina, las cuales se gestionan cómodamente desde la propia página web de la piscina."
  },
  {
    id: 4,
    pregunta: "🌧️ ¿Qué pasa si llueve y la actividad es al aire libre?",
    respuesta: "¡La diversión nunca se detiene en el cole! En caso de lluvia o mal tiempo, los monitores tienen previstos espacios cubiertos alternativos dentro del colegio (como aulas asignadas, porches o el gimnasio) para realizar la actividad de forma segura y adaptada."
  },
  {
    id: 5,
    pregunta: "🏊‍♂️ ¿Cómo accedo a las actividades y reservas de la Piscina?",
    respuesta: (
      <span>
        Las actividades acuáticas y de natación del colegio tienen un portal propio e independiente. Puedes acceder directamente a través de <a href="https://piscina-csb.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: '700' }}>piscina-csb.vercel.app</a> para consultar los niveles, reservar citas para pruebas de nivel y gestionar cómodamente las inscripciones online.
      </span>
    )
  },
  {
    id: 6,
    pregunta: "✍️ ¿Puedo inscribir a mi hijo en una actividad si el curso ya ha comenzado?",
    respuesta: (
      <span>
        ¡Sí, por supuesto! Las inscripciones permanecen abiertas durante todo el curso escolar (que se imparte de <strong>octubre a mayo</strong>), siempre y cuando queden vacantes en la actividad elegida. Ten en cuenta que <strong>no se aplican descuentos ni prorrateos por apuntarse a mitad de mes</strong> (se cobrará la mensualidad completa). Si lo prefieres, <strong>puedes solicitar comenzar la actividad a partir del primer día del mes siguiente</strong> para evitar el cobro del mes en curso. Asimismo, recuerda que la viabilidad de cada actividad al inicio del curso está sujeta a alcanzar un <strong>mínimo de alumnos inscritos</strong> en el grupo.
      </span>
    )
  },
  {
    id: 7,
    pregunta: "🥋 ¿Qué equipamiento o ropa especial necesita llevar mi hijo para la actividad?",
    respuesta: (
      <span>
        ¡No te preocupes! <strong>Dentro de la ficha de información detallada de cada actividad en esta web viene especificado exactamente el material técnico</strong>, ropa o calzado que el alumno necesita llevar a las sesiones. Por norma general, para las actividades deportivas se recomienda asistir con ropa cómoda o el chándal oficial del colegio.
      </span>
    )
  },
  {
    id: 8,
    pregunta: "📅 ¿Hay actividades extraescolares los días festivos o no lectivos?",
    respuesta: "No, las actividades extraescolares siguen estrictamente el calendario escolar oficial del colegio. Por tanto, no habrá clases los días festivos nacionales, autonómicos o municipales, ni durante las vacaciones escolares (Navidad, Semana Santa y verano) o los días no lectivos marcados por el centro."
  },
  {
    id: 9,
    pregunta: "💰 ¿Existen descuentos por hermanos o por apuntarse a más de una actividad?",
    respuesta: "Las políticas de precios y los posibles descuentos dependen directamente de la empresa gestora de la actividad (como Alventus para las actividades generales o los respectivos clubes deportivos para el baloncesto o judo). Te aconsejamos consultar la ficha de información detallada de cada actividad para revisar sus condiciones tarifarias específicas."
  },
  {
    id: 10,
    pregunta: "🔄 ¿Se puede realizar un cambio de actividad a mitad de curso?",
    respuesta: "¡Claro que sí! Para cambiar de actividad, deberás solicitar la baja de la actividad en la que está inscrito el alumno antes del día 25 del mes y realizar una nueva inscripción en la actividad que prefiera. El cambio estará siempre sujeto a la disponibilidad de plazas libres en el nuevo grupo."
  }
];

// 🌟 Estado para saber qué pregunta está abierta
  if (vista === 'catalogo') {
    return (
      <div
        style={{
          fontFamily: 'sans-serif',
          // 🎨 ¡CAMBIO MÁGICO! Fondo claro, limpio y con un contraste del 100% (Modo oscuro compatible!)
          backgroundColor: modoOscuro ? '#0a0f1d' : '#f1f5f9', 
          color: modoOscuro ? '#f1f5f9' : '#1e293b',
          minHeight: '100vh',        // 📐 ¡Toda la altura de la pantalla obligatoria!
          
          // 🧲 ACTIVAMOS EL IMÁN ANTI-ESPACIOS BLANCOS:
          display: 'flex',          
          flexDirection: 'column',  
          justifyContent: 'space-between', 
          position: 'relative',
          overflowX: 'hidden',
          paddingBottom: '0px',     
          transition: 'background-color 0.3s ease, color 0.3s ease',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes fadeOut {
            to { opacity: 0; transform: translateY(-10px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .card-premium {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .card-premium:hover {
            transform: translateY(-8px) !important;
            border-color: var(--hover-color, #3b82f6) !important;
            box-shadow: var(--hover-shadow, 0 15px 35px rgba(0, 0, 0, 0.1)) !important;
          }
          .card-img-zoom {
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .card-premium:hover .card-img-zoom {
            transform: scale(1.05) !important;
          }
          @media (max-width: 768px) {
            .explore-banner {
              flex-direction: column !important;
              align-items: center !important;
              text-align: center !important;
            }
            .footer-grid {
              text-align: center !important;
            }
            .footer-grid > div {
              align-items: center !important;
            }
            .admin-panel-card {
              width: 95% !important;
              padding: 18px !important;
            }
          }
        ` }} />
        {/* 🔮 CÍRCULOS DE LUZ SUAVES EN EL FONDO GENERAL (Ahora más sutiles para fondo claro) */}
        <div style={{ position: 'absolute', top: '15%', left: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,70,239,0.08) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

        <header
          style={{
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 15, 30, 0.98) 100%)',
            backdropFilter: 'blur(25px) saturate(180%)', // 💎 Apple-like premium glassmorphism
            WebkitBackdropFilter: 'blur(25px) saturate(180%)',
            padding: '20px 20px 35px',
            textAlign: 'center',
            borderRadius: '0 0 50px 50px', // Curvas grandes y fluidas
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '25px',
            position: 'relative',
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          {/* 🌫️ ¡EL EFECTO SILUETA REFORZADO!: Ocupa todo tu header por detrás de las letras con más fuerza */}
          {typeof fotoFondoHeader !== 'undefined' && fotoFondoHeader && (
            <img
              src={fotoFondoHeader}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',   // 🍿 Obliga a la foto a cubrir todo el espacio sin deformarse
                opacity: 0.15,        // 📈 ¡SUBIDO!: Pasamos del 6% al 15% para que la silueta tenga más cuerpo
                filter: 'blur(1.5px) grayscale(100%)', // 🌫️ ¡MÁS NÍTIDO!: Bajamos el difuminado de 3px a 1.5px para que se reconozcan mejor las ventanas y paredes
                zIndex: 0,            // Envía la foto al piso de abajo del todo
                pointerEvents: 'none' // 🖱️ Los clics pasan a través de ella sin molestar a los botones
              }}
            />
          )}

          {/* 🧭 NAV BAR SUPERIOR FLEX RESPONSIVA */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto 25px',
            padding: '10px 20px',
            boxSizing: 'border-box',
            flexWrap: 'wrap',
            gap: '12px',
            zIndex: 100,
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}>
            {/* Logotipo o insignia pequeña en navbar izquierdo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                color: '#f8fafc', 
                fontSize: '0.85rem', 
                fontWeight: '900', 
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                Colegio San Buenaventura - Madrid
              </span>
            </div>

            {/* Grupo de botones a la derecha */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* 🌓 BOTÓN DE MODO OSCURO */}
              <button
                type="button"
                onClick={() => setModoOscuro(!modoOscuro)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  transition: 'all 0.25s ease',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>{modoOscuro ? '☀️' : '🌙'}</span>
                <span>{modoOscuro ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>

              <button
                type="button"
                onClick={() => setVista('mapa')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  transition: 'all 0.25s ease',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>📍</span>
                <span>Mapa Cole</span>
              </button>

              <button
                type="button"
                onClick={() => setVista('faq')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  transition: 'all 0.25s ease',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>💬</span>
                <span>Preguntas</span>
              </button>

              {!isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setClaveInput('');
                    setMostrarAdminModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.25s ease',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span>🔑</span>
                  <span>Admin</span>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setVista('panel')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#10ac84',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      transition: 'all 0.25s ease',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0e906f';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#10ac84';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span>➕</span>
                    <span>Añadir</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { getAuth } = await import('firebase/auth');
                        await getAuth().signOut();
                        setIsAdmin(false);
                        lanzarToast('¡Sesión de administrador cerrada! 🔐', 'info');
                      } catch (err) {
                        console.error(err);
                        lanzarToast('Error al cerrar sesión', 'error');
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      transition: 'all 0.25s ease',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }} 
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span>🚪</span>
                    <span>Salir</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Brillo decorativo de fondo */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }}></div>

  {/* ⭐ MEJORA 1: ¡EL ESCUDO RECUPERA SUS 400PX ORIGINALES Y MAJESTUOSOS SIN DESBORDAR! */}
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', width: '100%', padding: '0 10px', boxSizing: 'border-box' }}>
    <img
      src="https://firebasestorage.googleapis.com/v0/b/extraescolarescsb.firebasestorage.app/o/colegio%20buena%20-%20Editada.png?alt=media&token=d30127c6-037e-47c5-a7e0-29d7cd5585fd"
      style={{
        width: '100%',
        maxWidth: '400px', // 🛡️ ¡Vuelve a su tamaño grande original!
        height: 'auto',
        filter: `drop-shadow(2px 0 0 white) drop-shadow(-2px 0 0 white) drop-shadow(0 2px 0 white) drop-shadow(0 -2px 0 white) drop-shadow(0 25px 35px rgba(0, 0, 0, 0.5))`
      }}
    />
    <h1 style={{ 
      margin: '10px 0 0', 
      fontSize: 'clamp(1.8rem, 6vw, 2.5rem)', // 📐 ¡Adaptativo inteligente en móviles!
      fontWeight: '800', 
      color: '#ffffff', 
      letterSpacing: '-1px',
      textAlign: 'center'
    }}>
      Actividades Extraescolares
    </h1>
{/* 🌟 ¡TU FRASE AJUSTADA: CURSIVA, CON COMILLAS Y MÁS PEQUEÑA! */}
<p style={{
      color: 'rgba(255, 255, 255, 0.85)', // Blanco suave y elegante
      fontSize: '0.85rem', // 📐 ¡Tamaño reducido para que quede fina!
      fontWeight: '500',
      fontStyle: 'italic', // 🪄 ¡Cursiva activada!
      margin: '12px 0 0 0',
      textAlign: 'center',
      maxWidth: '500px',
      textShadow: '0 2px 4px rgba(0,0,0,0.6)'
    }}>
      "Estas actividades tienen carácter voluntario, no discriminatorio y no lucrativo"
    </p>
  </div>

{/* --- 🛒 MEJORA 2: CAJA CONTENEDORA EN VERTICAL (¡CENTRADO ULTRA REFORZADO!) --- */}
<div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '15px', 
    maxWidth: '400px', 
    margin: '25px auto 0', // Centra la caja grande respecto al escudo
    padding: '0 20px', 
    alignItems: 'center', // Centra de forma interna el botón y el buscador
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box'
  }}>
    
    {/* Buscador inteligente con imán de centrado directo */}
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      maxWidth: '360px', // Le damos un ancho máximo fijo muy elegante
      margin: '0 auto' // 🎯 ¡EL TRUCO DEFINITIVO!: Obliga a este div a centrarse en su celda
    }}>
      <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', zIndex: 3 }}>🔍</span>
      <input
        type="text"
        placeholder="Busca por nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 15px 12px 45px',
          borderRadius: '15px',
          border: '2px solid rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.07)',
          color: 'white',
          fontSize: '1rem',
          outline: 'none',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease',
          display: 'block', // Evita comportamientos extraños de línea
          boxSizing: 'border-box' // Asegura que los paddings no ensanchen el cuadro
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#3b82f6';
          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.35), inset 0 2px 4px rgba(0,0,0,0.2)';
          e.currentTarget.style.transform = 'scale(1.03)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
          e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      />
    </div>

    {/* 🎛️ BOTÓN INTERACTIVO: Siguiendo la línea recta perfecta */}
    <button
      onClick={() => setMostrarFiltros(!mostrarFiltros)}
      style={{
        padding: '10px 24px',
        borderRadius: '14px',
        border: 'none',
        backgroundColor: mostrarFiltros ? '#3b82f6' : 'rgba(255,255,255,0.1)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '0.95rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: mostrarFiltros ? '0 8px 20px rgba(59, 130, 246, 0.4)' : 'none',
        transition: 'all 0.3s ease',
        width: 'fit-content',
        margin: '0 auto'
      }}
    >
      <span>🎛️</span>
      <span>{mostrarFiltros ? 'Ocultar Filtros' : 'Filtrar por Etapa / Empresa / Día'}</span>
    </button>
  </div>

  {/* 📦 PANEL DESPLEGABLE CON SELECTORES DE CRISTAL INTELIGENTES */}
  {mostrarFiltros && (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      marginTop: '25px',
      padding: '24px',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      borderRadius: '28px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      maxWidth: '650px',
      margin: '25px auto 0'
    }}>
      
      {/* Selector 1: Etapas */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>🎒 ETAPA</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {[
            { value: 'Todos', label: 'Todas las Etapas' },
            { value: 'Infantil', label: 'Infantil' },
            { value: 'Primaria', label: 'Primaria' },
            { value: 'ESO', label: 'ESO' },
            { value: 'Adultos', label: 'Adultos' },
            { value: 'Clubes Amigos', label: 'Clubes Amigos' }
          ].map(opt => {
            const activo = etapaActiva === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setEtapaActiva(opt.value);
                  setSubcategoriaActiva('Todas');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: activo ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                  background: activo ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'rgba(255, 255, 255, 0.05)',
                  color: activo ? 'white' : '#94a3b8',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: activo ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                  transform: activo ? 'scale(1.05)' : 'scale(1)',
                  outline: 'none'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector 2: Empresas */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>🏢 EMPRESA</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {[
            { value: 'Todas', label: 'Todas las Empresas' },
            { value: 'Alventus', label: 'Alventus' },
            { value: '4life', label: '4life' },
            { value: 'Kids&Us', label: 'Kids&Us' },
            { value: 'San Buenaventura', label: 'San Buenaventura' }
          ].map(opt => {
            const activo = empresaActiva === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEmpresaActiva(opt.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: activo ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  background: activo ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.05)',
                  color: activo ? 'white' : '#94a3b8',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: activo ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
                  transform: activo ? 'scale(1.05)' : 'scale(1)',
                  outline: 'none'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector 3: Filtro por Días */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>📅 DÍA SEMANA</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {[
            { value: 'Todos', label: 'Todos los Días' },
            { value: 'lunes', label: 'Lunes' },
            { value: 'martes', label: 'Martes' },
            { value: 'miércoles', label: 'Miércoles' },
            { value: 'jueves', label: 'Jueves' },
            { value: 'viernes', label: 'Viernes' }
          ].map(opt => {
            const activo = diaActivo === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDiaActivo(opt.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: activo ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                  background: activo ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'rgba(255, 255, 255, 0.05)',
                  color: activo ? 'white' : '#94a3b8',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: activo ? '0 4px 12px rgba(139, 92, 246, 0.4)' : 'none',
                  transform: activo ? 'scale(1.05)' : 'scale(1)',
                  outline: 'none'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  )}
</header>

        <main style={{ flex: 1, width: '100%', zIndex: 1 }}>
          {/* 🧸 PORTAL DE BIENVENIDA POR ETAPAS (Opción 1) */}
          {mostrarMenuEtapas && !busqueda ? (
            <div style={{
              width: '100%',
              boxSizing: 'border-box',
              maxWidth: '1100px',
              margin: '30px auto',
              padding: '0 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '30px',
              animation: 'fadeIn 0.6s ease-out'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h2 style={{
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: modoOscuro ? '#f8fafc' : '#0f172a',
                  margin: '0 0 10px 0',
                  letterSpacing: '-0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  Explora las Actividades del Colegio
                  <img 
                    src="https://firebasestorage.googleapis.com/v0/b/extraescolarescsb.firebasestorage.app/o/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(9).png?alt=media&token=155598bc-fb6e-4383-aca6-66dbb5bfe3f7" 
                    alt="Escudo" 
                    style={{ 
                      height: '42px', 
                      width: 'auto', 
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))'
                    }} 
                  />
                </h2>
                <p style={{
                  fontSize: '1rem',
                  color: modoOscuro ? '#94a3b8' : '#475569',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Selecciona una etapa escolar para ver los horarios, precios e inscribirte cómodamente
                </p>
              </div>

              {/* Grid de las 5 Tarjetas Premium */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '25px',
                width: '100%'
              }}>
                {[
                  {
                    id: 'Infantil',
                    emoji: '🧸',
                    titulo: 'Educación Infantil',
                    tituloMini: 'Infantil',
                    color: '#22c55e',
                    bgColor: modoOscuro ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.06)',
                    imagen: fotosEtapas.Infantil || 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=350&q=80',
                    desc: 'Actividades diseñadas para el desarrollo psicomotriz, lingüístico y creativo de los más pequeños.'
                  },
                  {
                    id: 'Primaria',
                    emoji: '🎒',
                    titulo: 'Educación Primaria',
                    tituloMini: 'Primaria',
                    color: '#3b82f6',
                    bgColor: modoOscuro ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.06)',
                    imagen: fotosEtapas.Primaria || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=350&q=80',
                    desc: 'Amplia gama de disciplinas deportivas, artísticas y tecnológicas para potenciar el talento.'
                  },
                  {
                    id: 'ESO',
                    emoji: '🎓',
                    titulo: 'Secundaria y Bachillerato',
                    tituloMini: 'Secundaria',
                    color: '#f97316',
                    bgColor: modoOscuro ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.06)',
                    imagen: fotosEtapas.ESO || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=350&q=80',
                    desc: 'Actividades enfocadas en habilidades competitivas, razonamiento lógico y expresión personal.'
                  },
                  {
                    id: 'Adultos',
                    emoji: '🧘',
                    titulo: 'Actividades de Adultos',
                    tituloMini: 'Adultos',
                    color: '#8b5cf6',
                    bgColor: modoOscuro ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.06)',
                    imagen: fotosEtapas.Adultos || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=350&q=80',
                    desc: 'Espacios de bienestar, salud y cultura dirigidos exclusivamente a padres y adultos.'
                  },
                  {
                    id: 'Clubes Amigos',
                    emoji: '🌟',
                    titulo: 'Clubes Amigos',
                    tituloMini: 'Clubes',
                    color: '#d946ef',
                    bgColor: modoOscuro ? 'rgba(217, 70, 239, 0.1)' : 'rgba(217, 70, 239, 0.06)',
                    imagen: fotosEtapas['Clubes Amigos'] || 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=350&q=80',
                    desc: 'Actividades federadas y convenios deportivos externos de alto rendimiento.'
                  }
                ].map((tarjeta) => (
                  <div
                    key={tarjeta.id}
                    className="card-premium"
                    onClick={() => {
                      setEtapaActiva(tarjeta.id);
                      setSubcategoriaActiva('Todas');
                      setMostrarMenuEtapas(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      background: modoOscuro ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.65)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      borderRadius: '24px',
                      padding: '20px',
                      border: `1.5px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                      borderTop: `4px solid ${tarjeta.color}`,
                      boxShadow: modoOscuro ? '0 10px 30px rgba(0, 0, 0, 0.3)' : '0 10px 25px rgba(0, 0, 0, 0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '430px',
                      boxSizing: 'border-box',
                      '--hover-color': tarjeta.color,
                      '--hover-shadow': modoOscuro ? `0 15px 35px rgba(${tarjeta.id === 'Infantil' ? '34, 197, 94' : tarjeta.id === 'Primaria' ? '59, 130, 246' : tarjeta.id === 'ESO' ? '249, 115, 22' : tarjeta.id === 'Adultos' ? '139, 92, 246' : '217, 70, 239'}, 0.2)` : '0 15px 35px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div>
                      {/* 🖼️ FOTO DE LA ETAPA CON BADGE GLASSMORPHIC */}
                      <div style={{ position: 'relative', height: '140px', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
                        <img src={tarjeta.imagen} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={tarjeta.titulo} />
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          padding: '6px 12px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(15, 23, 42, 0.65)',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                          color: 'white',
                          fontWeight: '800',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>{tarjeta.emoji}</span>
                          <span>{tarjeta.tituloMini}</span>
                        </div>
                      </div>

                      <h3 style={{
                        margin: '0 0 10px 0',
                        fontSize: '1.2rem',
                        fontWeight: '800',
                        color: modoOscuro ? '#f8fafc' : '#0f172a',
                        letterSpacing: '-0.3px'
                      }}>
                        {tarjeta.titulo}
                      </h3>

                      <p style={{
                        margin: '0 0 15px 0',
                        fontSize: '0.85rem',
                        lineHeight: '1.5',
                        color: modoOscuro ? '#94a3b8' : '#475569',
                        fontWeight: '500'
                      }}>
                        {tarjeta.desc}
                      </p>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginBottom: '15px',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        backgroundColor: tarjeta.bgColor
                      }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          color: tarjeta.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'block',
                          marginBottom: '4px'
                        }}>
                          ✨ Actividades Destacadas:
                        </span>
                        {obtenerPillsEjemplos(tarjeta.id)}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: tarjeta.color,
                      fontWeight: '800',
                      fontSize: '0.88rem',
                      gap: '5px',
                      marginTop: '5px'
                    }}>
                      Explorar Actividades <span style={{ transition: 'transform 0.2s' }} className="explore-arrow">→</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón premium inferior para ver TODO directamente */}
              <button
                type="button"
                onClick={() => {
                  setEtapaActiva('Todos');
                  setSubcategoriaActiva('Todas');
                  setMostrarMenuEtapas(false);
                }}
                style={{
                  alignSelf: 'center',
                  marginTop: '15px',
                  padding: '14px 30px',
                  borderRadius: '18px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(59, 130, 246, 0.35)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.35)';
                }}
              >
                🔍 Explorar Todo el Catálogo
              </button>
            </div>
          ) : (
            <>
              {/* banner/cabecera minimalista Glassmorphic cuando exploramos una etapa */}
              <div 
                className="explore-banner"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  maxWidth: '1200px',
                  margin: '20px auto 10px',
                  padding: '0 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '15px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 20px',
                  background: modoOscuro ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.65)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: '20px',
                  border: `1px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  color: modoOscuro ? '#cbd5e1' : '#334155'
                }}>
                  <span>📍 Explorando:</span>
                  <span style={{
                    color: etapaActiva === 'Infantil' ? '#22c55e' : etapaActiva === 'Primaria' ? '#3b82f6' : etapaActiva === 'ESO' ? '#f97316' : etapaActiva === 'Adultos' ? '#8b5cf6' : etapaActiva === 'Clubes Amigos' ? '#d946ef' : '#3b82f6',
                    fontWeight: '900',
                    fontSize: '1rem',
                    textTransform: 'uppercase'
                  }}>
                    {etapaActiva === 'Todos' ? 'Todas las Etapas' : etapaActiva}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMostrarMenuEtapas(true);
                    setEtapaActiva('Todos');
                    setSubcategoriaActiva('Todas');
                    setBusqueda('');
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: modoOscuro ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    color: modoOscuro ? '#cbd5e1' : '#475569',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.transform = 'translateX(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  ← Volver al Menú
                </button>
              </div>

              {/* 📁 SUB-CATEGORÍAS PREMIUM (Glassmorphism + Dynamic Counts + Responsive Slider) */}
              {etapaActiva !== 'Todos' && activitiesInActiveStage.length > 0 && (
                <div style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  maxWidth: '1200px',
                  margin: '0 auto 20px',
                  padding: '0 20px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'none',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }} className="scrollbar-hidden">
                  <style dangerouslySetInnerHTML={{ __html: `
                    .scrollbar-hidden::-webkit-scrollbar {
                      display: none;
                    }
                  ` }} />
                  {['Todas', 'Deportes', 'Idiomas', 'Arte/expresión', 'Tecnología/manualidades'].map(cat => {
                    const count = categoriasDisponibles[cat];
                    if (cat !== 'Todas' && count === 0) return null; // Ocultamos categorías vacías
                    
                    const esActivo = subcategoriaActiva === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSubcategoriaActiva(cat)}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '24px',
                          border: `1.5px solid ${esActivo ? 'transparent' : (modoOscuro ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')}`,
                          background: esActivo 
                            ? (modoOscuro ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)')
                            : (modoOscuro ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.65)'),
                          color: esActivo ? 'white' : (modoOscuro ? '#cbd5e1' : '#475569'),
                          fontWeight: '800',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          boxShadow: esActivo ? '0 8px 16px rgba(37, 99, 235, 0.25)' : 'none',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                        }}
                        onMouseEnter={(e) => {
                          if (!esActivo) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!esActivo) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.65)';
                          }
                        }}
                      >
                        <span>{cat === 'Todas' ? '✨ Todas' : cat === 'Deportes' ? '⚽ Deportes' : cat === 'Idiomas' ? '🗣️ Idiomas' : cat === 'Arte/expresión' ? '🎨 Arte/Expresión' : '💻 Tecnología'}</span>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: esActivo ? 'rgba(255, 255, 255, 0.25)' : (modoOscuro ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'),
                          color: esActivo ? 'white' : (modoOscuro ? '#cbd5e1' : '#64748b'),
                          fontWeight: 'bold',
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 🌟 FILTROS Y RECORRIDO EN ACCIÓN */}
              <>
    {/* 🚩 Mensaje si no hay nada que enseñar (Solo si no está cargando) */}
    {!cargando && itemsFiltrados.length === 0 && (
      <div style={{ 
        textAlign: 'center', 
        padding: '50px 30px', 
        background: modoOscuro ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.45)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        color: modoOscuro ? '#f8fafc' : '#0f172a', 
        borderRadius: '32px', 
        margin: '40px auto', 
        maxWidth: '650px', 
        border: modoOscuro ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)', 
        boxShadow: modoOscuro ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 20px 40px -15px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        animation: 'fadeIn 0.6s ease-out'
      }}>
        {/* Floating animated icon container */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: modoOscuro ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '2.5rem',
          boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.1)',
          animation: 'pulse 3s infinite ease-in-out'
        }}>
          🔍
        </div>
        
        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
          Sin resultados
        </h3>
        
        <p style={{ 
          fontSize: '1rem', 
          margin: 0, 
          color: modoOscuro ? '#94a3b8' : '#475569', 
          lineHeight: '1.6', 
          maxWidth: '85%',
          fontWeight: '550'
        }}>
          No hay actividades que coincidan con 
          {busqueda ? ` "${busqueda}"` : ''} 
          {empresaActiva !== 'Todas' ? ` de ${empresaActiva}` : ''}
          {etapaActiva !== 'Todos' ? ` en la etapa ${etapaActiva}` : ''}
          {diaActivo !== 'Todos' ? ` los ${diaActivo}` : ''}.
        </p>

        {isAdmin && (
          <p style={{ 
            color: '#10b981', 
            fontWeight: '700', 
            fontSize: '0.9rem', 
            margin: '0', 
            backgroundColor: modoOscuro ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)',
            padding: '6px 16px',
            borderRadius: '12px'
          }}>
            💡 ¡Usa el panel de administrador para añadir una!
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setBusqueda('');
            setEtapaActiva('Todos');
            setSubcategoriaActiva('Todas');
            setEmpresaActiva('Todas');
            setDiaActivo('Todos');
            lanzarToast('Filtros restaurados correctamente', 'exito');
          }}
          style={{
            marginTop: '10px',
            padding: '12px 24px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white',
            fontWeight: '750',
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(37, 99, 235, 0.2)';
          }}
        >
          🔄 Restaurar Filtros
        </button>
      </div>
    )}

    {/* 📦 CONTENEDOR INTELIGENTE EN REJILLA */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
      gap: '30px',
      padding: '20px 15px',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      alignItems: 'stretch', 
      justifyContent: 'center' 
    }}>
      {cargando ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        itemsFiltrados.map((item) => {
          const m = ['Infantil', 'Primaria', 'ESO', 'Adultos'].filter(e => item[e] || (item.etapa === e) || (item.etapas && item.etapas.includes(e))).length > 1;
          const cardColor = m ? '#a855f7' : (item.esClub || item.etapa === 'Clubes Amigos' || (item.etapas && item.etapas.includes('Clubes Amigos'))) ? '#d946ef' : (item.Infantil || item.etapa === 'Infantil' || (item.etapas && item.etapas.includes('Infantil'))) ? '#22c55e' : (item.ESO || item.etapa === 'ESO' || (item.etapas && item.etapas.includes('ESO'))) ? '#f97316' : '#3b82f6';
          
          return (
            <div
              key={item.id} 
              className="card-premium"
              style={{
                background: modoOscuro ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '28px', 
                overflow: 'hidden',
                boxShadow: modoOscuro ? '0 20px 40px rgba(0, 0, 0, 0.6)' : '0 20px 40px rgba(0, 0, 0, 0.15)', 
                border: `3px solid ${cardColor}`, 
                display: 'flex',
                flexDirection: 'column',
                minHeight: '530px', 
                height: '100%',
                '--hover-color': cardColor,
                '--hover-shadow': modoOscuro ? '0 30px 60px rgba(96, 165, 250, 0.25)' : '0 30px 60px rgba(59, 130, 246, 0.25)'
              }}
            >
          {/* 🖼️ IMAGEN / LOGO */}
          <div style={{ position: 'relative', height: '180px', minHeight: '180px', maxHeight: '180px', overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={item.imagen || item.foto || 'https://via.placeholder.com/400x200?text=San+Buenaventura'}
              className="card-img-zoom"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Imagen+No+Disponible'; }}
            />
            <div style={{
              position: 'absolute', top: '12px', right: '12px',
              display: 'flex', gap: '6px', flexWrap: 'wrap',
              justifyContent: 'flex-end', maxWidth: '85%'
            }}>
              {item.esClub ? (
                <div style={{
                  backgroundColor: '#d946ef',
                  padding: '6px 12px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '800',
                  color: 'white',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                  letterSpacing: '0.5px'
                }}>
                  🌟 CLUB AMIGO
                </div>
              ) : (
                (() => {
                  const etapasArray = Array.isArray(item.etapas) ? item.etapas : (item.etapa ? [item.etapa] : []);
                  return etapasArray.map((et, index) => {
                    let bgColor = '#64748b'; // default slate
                    let text = et;
                    const lowerEt = et.toLowerCase().trim();
                    if (lowerEt.includes('infantil')) {
                      bgColor = '#22c55e';
                      text = '👶 INFANTIL';
                    } else if (lowerEt.includes('primaria')) {
                      bgColor = '#3b82f6';
                      text = '🎒 PRIMARIA';
                    } else if (lowerEt.includes('eso') || lowerEt.includes('secundaria')) {
                      bgColor = '#f97316';
                      text = '⚡ ESO';
                    } else if (lowerEt.includes('adulto')) {
                      bgColor = '#6366f1';
                      text = '👥 ADULTOS';
                    } else if (lowerEt.includes('club')) {
                      bgColor = '#d946ef';
                      text = '🌟 CLUB';
                    }
                    return (
                      <div key={index} style={{
                        backgroundColor: bgColor,
                        padding: '5px 10px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '800',
                        color: 'white',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                        letterSpacing: '0.5px'
                      }}>
                        {text}
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>

          {/* 📝 CONTENIDO ESTILIZADO CON CONTRASTE REFORZADO Y MEJOR JERARQUÍA VISUAL */}
          <div style={{ padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            
            {/* 👑 1. EL REY DE LA TARJETA: Título más grande en negro puro */}
            <h3 style={{ margin: '0 0 4px', fontSize: '1.4rem', color: modoOscuro ? '#f8fafc' : '#0f172a', fontWeight: '900', letterSpacing: '-0.5px' }}>
              {item.nombre}
            </h3>
            
            {/* 🗓️⏰ Badges de Días y Horarios en Colores del Colegio (Azul y Amarillo) */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {/* Badge de Días (Azul Corporativo) */}
              <div style={{ 
                backgroundColor: modoOscuro ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff', 
                color: modoOscuro ? '#60a5fa' : '#1d4ed8', 
                fontSize: '0.7rem', 
                fontWeight: '900', 
                padding: '5px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                border: `1px solid ${modoOscuro ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe'}`,
              }}>
                <span>🗓️</span>
                <span>{item.dias ? item.dias.toUpperCase() : 'DÍAS A CONSULTAR'}</span>
              </div>

              {/* Badge de Horario (Amarillo Dorado Corporativo) */}
              <div style={{ 
                backgroundColor: modoOscuro ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', 
                color: modoOscuro ? '#fbbf24' : '#b45309', 
                fontSize: '0.7rem', 
                fontWeight: '900', 
                padding: '5px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                border: `1px solid ${modoOscuro ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'}`,
              }}>
                <span>⏰</span>
                <span>{item.horario ? item.horario.toUpperCase() : 'HORARIO A CONSULTAR'}</span>
              </div>
            </div>

            {/* 📝 MINI-DESCRIPCIÓN DINÁMICA (Máximo 2 líneas con elipsis y limpieza de URLs) */}
            <p style={{
              color: modoOscuro ? '#94a3b8' : '#64748b',
              fontSize: '0.8rem',
              margin: '4px 0 0',
              lineHeight: '1.4',
              fontWeight: '600',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              height: '38px' // Fija la altura a exactamente 2 líneas para simetría impecable
            }}>
              {(() => {
                const rawInfo = item.info || item.descripcion || '';
                const infoLimpia = rawInfo.includes('https://firebasestorage.googleapis.com')
                  ? rawInfo.split('https://firebasestorage.googleapis.com')[0].trim()
                  : rawInfo;
                return infoLimpia || 'Sin descripción disponible.';
              })()}
            </p>

            {/* 🍃 EL COLCHÓN DE AIRE (marginTop: 'auto') empuja todo lo demás al fondo de forma limpia */}
            <div style={{ marginTop: 'auto' }}>
              
              {/* 💰 PRECIO Y BOTÓN EN UNA SOLA FILA HORIZONTAL COMPACTA Y PRESTIGIOSA */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '8px',
                padding: '0 2px'
              }}>
                {/* Bloque del Precio */}
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.65rem', color: modoOscuro ? '#94a3b8' : '#64748b', fontWeight: '800', letterSpacing: '0.5px' }}>PRECIO</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '900', color: item.esClub ? '#d946ef' : (modoOscuro ? '#60a5fa' : '#1d4ed8'), lineHeight: '1.1' }}>
                    {item.precio ? (String(item.precio).endsWith('€') ? item.precio : `${item.precio}€`) : '---'}
                    <small style={{ fontSize: '0.7rem', fontWeight: '700', color: modoOscuro ? '#94a3b8' : '#64748b', marginLeft: '2px' }}>/mes</small>
                  </span>
                </div>

                {/* Acciones de la Tarjeta */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Botón Compartir Rápido */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const urlCompartir = `${window.location.origin}${window.location.pathname}?act=${item.id}`;
                      const textoCompartir = `¡Mira la actividad extraescolar de "${item.nombre}" del Colegio San Buenaventura! 🏫✨`;
                      
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: item.nombre,
                            text: textoCompartir,
                            url: urlCompartir,
                          });
                          lanzarToast('¡Compartido con éxito! 🚀', 'exito');
                        } catch (err) {
                          if (err.name !== 'AbortError') console.error(err);
                        }
                      } else {
                        try {
                          await navigator.clipboard.writeText(urlCompartir);
                          lanzarToast('📋 ¡Enlace copiado! Listo para compartir.', 'exito');
                        } catch (err) {
                          console.error(err);
                          lanzarToast('❌ No se pudo copiar el enlace', 'error');
                        }
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: modoOscuro ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                      color: modoOscuro ? '#cbd5e1' : '#475569',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      outline: 'none',
                    }}
                    title="Compartir enlace directo"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255, 255, 255, 0.18)' : '#e2e8f0';
                      e.currentTarget.style.color = modoOscuro ? '#ffffff' : '#0f172a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';
                      e.currentTarget.style.color = modoOscuro ? '#cbd5e1' : '#475569';
                    }}
                  >
                    🔗
                  </button>

                  {/* Botón Detalles Compacto */}
                  <button
                    type="button"
                    onClick={() => {
                      setActividadSeleccionada(item);
                      setVista('detalles');
                    }}
                    style={{
                      padding: '8px 14px', 
                      borderRadius: '12px', 
                      border: 'none',
                      backgroundColor: modoOscuro ? '#3b82f6' : '#0f172a', 
                      color: '#ffffff', 
                      fontWeight: '800', 
                      cursor: 'pointer', 
                      fontSize: '0.78rem',
                      boxShadow: modoOscuro ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 4px 10px rgba(15, 23, 42, 0.15)',
                      transition: 'all 0.2s',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = modoOscuro ? '#60a5fa' : '#1e293b';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = modoOscuro ? '#3b82f6' : '#0f172a';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span>Detalles</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* 🔗 SECCIÓN DE INSCRIPCIÓN INTELIGENTE */}
              <div style={{ width: '100%', paddingTop: '5px' }}>
                {item.linksMultiples && item.linksMultiples.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select
                      id={`select-${item.id}`}
                      defaultValue=""
                      style={{
                        width: '100%',
                        padding: '8px 11px',
                        borderRadius: '12px',
                        border: modoOscuro ? '2px solid rgba(255,255,255,0.2)' : '2px solid #0f172a',
                        backgroundColor: modoOscuro ? '#1e293b' : '#ffffff',
                        color: modoOscuro ? '#f8fafc' : '#0f172a',
                        fontWeight: 'bold',
                        fontSize: '0.82rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                      onChange={(e) => {
                        const botonIr = document.getElementById(`btn-ir-${item.id}`);
                        if (botonIr) {
                          botonIr.href = e.target.value;
                          botonIr.style.opacity = e.target.value ? '1' : '0.5';
                          botonIr.style.pointerEvents = e.target.value ? 'auto' : 'none';
                        }
                      }}
                    >
                      <option value="" disabled>👇 Selecciona tu categoría / curso</option>
                      {item.linksMultiples.map((link, index) => (
                        <option key={index} value={link.url}>
                          {link.etiqueta}
                        </option>
                      ))}
                    </select>

                    <a
                      id={`btn-ir-${item.id}`}
                      href=""
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'block', 
                        padding: '9px 12px', 
                        backgroundColor: item.esClub ? '#d946ef' : '#ff6b6b',
                        color: 'white', 
                        borderRadius: '12px', 
                        textDecoration: 'none', 
                        fontWeight: '900',
                        fontSize: '0.82rem', 
                        textAlign: 'center', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        opacity: '0.5',          
                        pointerEvents: 'none',   
                        transition: 'all 0.2s ease'
                      }}
                    >
                      📝 ¡INSCRIBIRSE AHORA!
                    </a>
                  </div>
                ) : (
                  (item.linkInscripcion || item.enlace) && (
                    <a
                      href={item.linkInscripcion ? item.linkInscripcion : item.enlace}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'block', 
                        padding: '9px 12px', 
                        backgroundColor: item.esClub ? '#d946ef' : '#ff6b6b',
                        color: 'white', 
                        borderRadius: '12px', 
                        textDecoration: 'none', 
                        fontWeight: '900',
                        fontSize: '0.82rem', 
                        textAlign: 'center', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      📝 ¡INSCRIBIRSE AHORA!
                    </a>
                  )
                )}
              </div>

              {/* 🛠️ BOTONES DE ADMINISTRACIÓN (¡A salvo e intactos!) */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: modoOscuro ? '1px dotted rgba(255,255,255,0.15)' : '1px dotted rgba(0,0,0,0.2)' }}>
                  <button
                    onClick={() => {
                      setNuevaAct({
                        ...item, 
                        nombre: item.nombre || '',
                        etapas: item.etapas || [], 
                        horario: item.horario || '',
                        dias: item.dias || '',
                        lugar: item.lugar || '',
                        info: item.info || item.descripcion || '',
                        imagen: item.imagen || '',
                        precio: item.precio || '',
                        empresa: item.empresa || '',
                        logoEmpresa: item.logoEmpresa || '',
                        nombreContacto: item.nombreContacto || '',
                        contacto: item.contacto || '', 
                        latAct: item.latAct ? Number(item.latAct) : 40.407937755274425,
                        lngAct: item.lngAct ? Number(item.lngAct) : -3.7469348757382366,
                        latMon: item.latMon ? Number(item.latMon) : '',
                        lngMon: item.lngMon ? Number(item.lngMon) : '',
                        latFam: item.latFam ? Number(item.latFam) : '',
                        lngFam: item.lngFam ? Number(item.lngFam) : '',
                        fotoAct: item.fotoAct || '',
                        fotoMon: item.fotoMon || '',
                        fotoFam: item.fotoFam || '',
                        recogidaMonitores: item.recogidaMonitores || '',
                        recogidaFamilias: item.recogidaFamilias || '',
                        linkInscripcion: item.linkInscripcion || item.enlace || '',
                        categoria: item.categoria || ''
                      });
                      setEditandoId(item.id); 
                      setVista('panel');      
                    }}
                    style={{ flex: 1, padding: '8px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    EDITAR
                  </button>

                  <button
                    onClick={async () => {
                      if (!isAdmin) return lanzarToast('🛑 ¡No tienes permiso! 🔐', 'error');
                      if (confirm(`⚠️ ¿Quieres eliminar permanentemente la actividad o club "${item.nombre}"?\n\nEsta acción no se puede deshacer y se borrará para todas las familias inmediatamente.`)) {
                        const coleccion = item.esClub ? 'clubes_cole' : 'actividades_cole';
                        await deleteDoc(doc(db, coleccion, item.id));
                        item.esClub ? cargarClubes() : cargarActividades();
                      }
                    }}
                    style={{ flex: 1, padding: '8px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    BORRAR
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      );
      })
      )}
    </div>
  </>
            </>
          )}
        </main>

        {/* 🛡️ FOOTER PREMIUM GLASSMORPHIC */}
        <footer style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', // 🌌 Azul oscuro degradado premium
          backdropFilter: 'blur(15px) saturate(160%)',
          WebkitBackdropFilter: 'blur(15px) saturate(160%)',
          borderTop: '1.5px solid rgba(255, 255, 255, 0.08)',
          padding: '40px 20px 30px',
          borderRadius: '32px 32px 0 0',
          marginTop: '50px',
          position: 'relative',
          boxShadow: '0 50vh 0 #0f172a', // 🎨 Relleno oscuro infinito
          color: '#cbd5e1', // Texto claro legible
          transition: 'all 0.3s ease',
          marginBottom: '0px',
        }}>
          <div 
            className="footer-grid"
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '30px',
              textAlign: 'left'
            }}
          >
            {/* Columna 1: Identidad */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src="https://firebasestorage.googleapis.com/v0/b/extraescolarescsb.firebasestorage.app/o/logo%20BLANCO.png?alt=media&token=753d085f-d9d1-4b78-9d54-26e88578c35b" 
                  alt="Escudo Cole" 
                  style={{ 
                    width: '140px', // 🛡️ Agrandado premium
                    height: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))'
                  }} 
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0', lineHeight: '1.5', fontWeight: '500' }}>
                Portal oficial de actividades extraescolares
              </p>
            </div>

            {/* Columna 2: Contacto Premium */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#60a5fa', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Contacto Directo
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a 
                  href="https://maps.google.com/?q=Calle+de+El+Greco+16,+Madrid"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    fontSize: '0.85rem', 
                    color: '#cbd5e1', 
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'color 0.2s',
                    wordBreak: 'break-word'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                >
                  <span>📍</span> Calle de El Greco 16, Madrid
                </a>
                <a 
                  href="tel:915267161"
                  style={{ 
                    fontSize: '0.85rem', 
                    color: '#cbd5e1', 
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                >
                  <span>📞</span> 915 267 161
                </a>
                <a 
                  href="mailto:extraescolares@sanbuenaventura.org"
                  style={{ 
                    fontSize: '0.85rem', 
                    color: '#cbd5e1', 
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'color 0.2s',
                    wordBreak: 'break-all'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                >
                  <span>📧</span> extraescolares@sanbuenaventura.org
                </a>
                <a 
                  href="mailto:extraescolarespiscina@sanbuenaventura.org"
                  style={{ 
                    fontSize: '0.85rem', 
                    color: '#cbd5e1', 
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'color 0.2s',
                    wordBreak: 'break-all'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                >
                  <span>📧</span> extraescolarespiscina@sanbuenaventura.org
                </a>
              </div>
            </div>

            {/* Columna 3: Enlaces Rápidos y Copyright */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#60a5fa', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Navegación Rápida
                </span>
                <div style={{ display: 'flex', gap: '15px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: 0, transition: 'color 0.2s', outline: 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    ↑ Inicio
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVista('faq')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: 0, transition: 'color 0.2s', outline: 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    💬 FAQ
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVista('mapa')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: 0, transition: 'color 0.2s', outline: 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    📍 Mapa
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>
                © {new Date().getFullYear()} Extraescolares Colegio San Buenaventura.
              </div>
            </div>
          </div>
        </footer>

        {/* 🌟 COMPONENTES PREMIUM GLOBALES */}
        <ToastContainer toasts={toasts} />
        <AdminPasswordModal 
          mostrar={mostrarAdminModal} 
          onClose={() => setMostrarAdminModal(false)}
          db={db}
          setIsAdmin={setIsAdmin}
          lanzarToast={lanzarToast}
        />

        {/* ⬆️ BOTÓN FLOTANTE "VOLVER ARRIBA" DILUIDO CON GLASSMORPHISM */}
        {mostrarSubirArriba && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              position: 'fixed',
              bottom: '30px',
              right: '30px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '1.4rem',
              cursor: 'pointer',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
              animation: 'fadeIn 0.3s ease-out',
              transition: 'transform 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ▲
          </button>
        )}
      </div>
);
}

// 🚩 ESTA ES LA "HABITACIÓN" DEL MAPA QUE FALTABA (¡Consolidada y con soporte Modo Oscuro!)
if (vista === 'mapa') {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: modoOscuro ? '#0a0f1d' : '#f8fafc',
        color: modoOscuro ? '#f1f5f9' : '#1e293b',
        transition: 'background-color 0.3s ease, color 0.3s ease',
      }}
    >
      <div
        style={{
          padding: '15px 20px',
          backgroundColor: modoOscuro ? '#1e293b' : 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: modoOscuro ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.1)',
          borderBottom: modoOscuro ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          zIndex: 1000,
          transition: 'all 0.3s ease',
        }}
      >
        <button
          onClick={() => setVista('catalogo')}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.25)',
            transition: 'transform 0.2s, background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          ← Volver al Inicio
        </button>
        <h2
          style={{
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: '800',
            color: modoOscuro ? '#f8fafc' : '#1e293b',
            letterSpacing: '-0.5px',
          }}
        >
          📍 Puntos Clave del Colegio
        </h2>
        <div style={{ width: '85px' }}></div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapaPuntosInteres puntos={puntosInteres} />
      </div>
    </div>
  );
}
  if (vista === 'detalles' && actividadSeleccionada) {
    const act = actividadSeleccionada;
    const latMonNum = Number(act.latMon);
    const latFamNum = Number(act.latFam);
    const latActNum = Number(act.latAct);
    const esMonValido = act.latMon && !isNaN(latMonNum) && latMonNum !== 0 && latMonNum !== 40.407937755274425;
    const esFamValido = act.latFam && !isNaN(latFamNum) && latFamNum !== 0 && latFamNum !== 40.407937755274425;
    const esActValido = act.latAct && !isNaN(latActNum) && latActNum !== 0 && latActNum !== 40.407937755274425;
    return (
      <div
        style={{
          maxWidth: '650px',
          margin: '0 auto',
          padding: '20px',
          backgroundColor: modoOscuro ? '#0a0f1d' : '#f8fafc',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          color: modoOscuro ? '#f1f5f9' : '#1e293b',
          transition: 'all 0.3s ease',
        }}
      >
        {/* 🔙 Botón Volver Minimalista y Compartir */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
          <button
            onClick={() => {
              setVista('catalogo');
              setActividadSeleccionada(null);
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', window.location.pathname);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: modoOscuro ? '#94a3b8' : '#64748b',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem',
              outline: 'none',
            }}
          >
            ← Volver al catálogo
          </button>

          <button
            onClick={async () => {
              const urlCompartir = `${window.location.origin}${window.location.pathname}?act=${act.id}`;
              const textoCompartir = `¡Mira la actividad extraescolar de "${act.nombre}" del Colegio San Buenaventura! 🏫✨`;
              
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: act.nombre,
                    text: textoCompartir,
                    url: urlCompartir,
                  });
                  lanzarToast('¡Compartido con éxito! 🚀', 'exito');
                } catch (err) {
                  if (err.name !== 'AbortError') {
                    console.error(err);
                  }
                }
              } else {
                try {
                  await navigator.clipboard.writeText(urlCompartir);
                  lanzarToast('📋 ¡Enlace copiado! Compártelo por WhatsApp o Email.', 'exito');
                } catch (err) {
                  console.error(err);
                  lanzarToast('❌ No se pudo copiar el enlace', 'error');
                }
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: modoOscuro ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
              border: `1.5px solid ${modoOscuro ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe'}`,
              color: modoOscuro ? '#60a5fa' : '#1d4ed8',
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '0.88rem',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(59, 130, 246, 0.25)' : '#dbeafe';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>🔗</span>
            <span>Compartir</span>
          </button>
        </div>

        {/* 🖼️ Tarjeta Principal de Imagen */}
        <div
          style={{
            backgroundColor: modoOscuro ? '#1e293b' : 'white',
            borderRadius: '32px',
            overflow: 'hidden',
            boxShadow: modoOscuro ? '0 20px 25px -5px rgba(0,0,0,0.3)' : '0 20px 25px -5px rgba(0,0,0,0.05)',
            marginBottom: '25px',
            border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }}
        >
          <img
            src={
              act.imagen ||
              'https://via.placeholder.com/800x400?text=San+Buenaventura'
            }
            style={{ width: '100%', height: 'auto', maxHeight: '300px', aspectRatio: '16/9', objectFit: 'cover' }}
            onError={(e) => {
              e.target.src =
                'https://via.placeholder.com/800x400?text=Revisar+Imagen';
            }}
          />
          <div style={{ padding: '30px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '20px'
              }}
            >
              <div>
                {/* 🏷️ AQUÍ ESTÁN TODAS LAS ETAPAS JUNTAS */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {act.etapas && Array.isArray(act.etapas) ? (
                    act.etapas.map((et) => (
                      <span
                        key={et}
                        style={{
                          backgroundColor: et === 'Clubes Amigos' ? '#d946ef' : '#dbeafe',
                          color: et === 'Clubes Amigos' ? 'white' : '#1e40af',
                          padding: '6px 16px',
                          borderRadius: '99px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                        }}
                      >
                        {et === 'Clubes Amigos' ? '🌟 CLUB AMIGO' : et}
                      </span>
                    ))
                  ) : (
                    // Por si es una de las antiguas que no tenía lista de etapas
                    <span
                      style={{
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        padding: '6px 16px',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                      }}
                    >
                      {act.etapa}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    fontSize: '2.2rem',
                    color: '#0f172a',
                    margin: '15px 0 5px',
                    fontWeight: '800',
                    letterSpacing: '-1px',
                  }}
                >
                  {act.nombre}
                </h2>
              </div>

              {/* 💰 EL PRECIO A LA DERECHA */}
              <div style={{ textAlign: 'right' }}>
                <p
                  style={{
                    color: '#3b82f6',
                    fontSize: '1.8rem',
                    fontWeight: '800',
                    margin: 0,
                  }}
                >
                  {act.precio}€
                </p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                  al mes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 📋 SELECTOR DE PESTAÑAS (Estilo Apple, muy moderno) */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '25px',
            backgroundColor: '#f1f5f9',
            padding: '6px',
            borderRadius: '20px',
          }}
        >
          <button
            onClick={() => setPestaña('info')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '15px',
              border: 'none',
              backgroundColor: pestaña === 'info' ? 'white' : 'transparent',
              color: pestaña === 'info' ? '#1e293b' : '#64748b',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: '0.3s',
              boxShadow:
                pestaña === 'info' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            📝 Información
          </button>
          <button
            onClick={() => setPestaña('mapa')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '15px',
              border: 'none',
              backgroundColor: pestaña === 'mapa' ? 'white' : 'transparent',
              color: pestaña === 'mapa' ? '#1e293b' : '#64748b',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: '0.3s',
              boxShadow:
                pestaña === 'mapa' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            📍 Mapa y Recogida
          </button>
        </div>

        {/* 📦 CONTENIDO DINÁMICO */}
        {pestaña === 'info' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            {/* 📅 Grid de Información Rápida */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px',
                marginBottom: '25px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '24px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                  }}
                >
                  📅 Días
                </p>
                <p
                  style={{
                    margin: '5px 0 0',
                    fontWeight: '700',
                    color: '#1e293b',
                    fontSize: '1.1rem',
                    whiteSpace: 'pre-wrap', // 👈 ¡Esto permite los saltos de línea!
                    lineHeight: '1.4'       // Un poquito de espacio entre líneas para que se lea mejor
                  }}
                >
                  {act.dias}
                </p>
              </div>
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '24px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                  }}
                >
                  ⏰ Horario
                </p>
                <p
                  style={{
                    margin: '5px 0 0',
                    fontWeight: '700',
                    color: '#1e293b',
                    fontSize: '1.1rem',
                  }}
                >
                  {act.horario}
                </p>
              </div>
            </div>

            {/* 🎒 Material y Descripción */}
            <div
              style={{
                backgroundColor: 'white',
                padding: '30px',
                borderRadius: '32px',
                border: '1px solid #f1f5f9',
                marginBottom: '25px',
              }}
            >
<h4 style={{ color: '#1e293b', marginBottom: '10px' }}>
                Sobre la actividad
              </h4>
              <p
                style={{
                  color: '#475569',
                  lineHeight: '1.8',
                  fontSize: '1.05rem',
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word' 
                }}
              >
                {/* 🧹 ¡LIMPIEZA MÁGICA SEGURA!: Quitamos la palabra "item" y dejamos solo "act.info" para que no dé ningún error */}
                {act.info && act.info.includes('https://firebasestorage.googleapis.com')
                  ? act.info.split('https://firebasestorage.googleapis.com')[0].trim()
                  : act.info || ''} 
              </p>

              {/* 🎽 ¡LA FOTO SE QUEDA AQUÍ ABAJO PRECIOSA!: Supersegura y sin "item" */}
              {act.info && act.info.includes('firebasestorage.googleapis.com') && (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <img 
                    src="https://firebasestorage.googleapis.com/v0/b/extraescolarescsb.firebasestorage.app/o/futbol-pack.jpg.png?alt=media&token=5c92d35d-7d50-4a82-8c14-1323a82e7ee2" 
                    alt="Pack Equipación Fútbol" 
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: '16px',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                      border: '3px solid #3b82f6'
                    }}
                  />
                </div>
              )}
              {act.material && (
                <div
                  style={{
                    marginTop: '25px',
                    padding: '20px',
                    backgroundColor: '#fff7ed',
                    borderRadius: '20px',
                    borderLeft: '6px solid #f97316',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontWeight: '800',
                      color: '#9a3412',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>🎒</span> Material Necesario
                  </p>
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: '#c2410c',
                      fontWeight: '600',
                    }}
                  >
                    {act.material}
                  </p>
                </div>
              )}
            </div>

            {/* 🏢 Empresa e Inscripción */}
            {act.empresa && (
              <div
                style={{
                  padding: '30px',
                  backgroundColor: '#ffffff',
                  borderRadius: '32px',
                  border: '1px solid #e2e8f0',
                  textAlign: 'center',
                  marginBottom: '30px',
                }}
              >
                {/* 📸 ¡Aquí vuelve a estar tu logo! */}
                {act.logoEmpresa && (
                  <img
                    src={act.logoEmpresa}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      objectFit: 'contain',
                      marginBottom: '15px',
                      border: '3px solid #f1f5f9',
                      padding: '5px',
                    }}
                    alt="Logo empresa"
                  />
                )}

                <p
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                  }}
                >
                  Impartido por
                </p>
                <h4
                  style={{
                    margin: '5px 0 20px',
                    fontSize: '1.4rem',
                    color: '#1e293b',
                  }}
                >
                  {act.empresa}
                </h4>

                {act.contacto && (
                  <button
                    onClick={() => {
                      const mail = act.contacto
                        .replace(/\s/g, '')
                        .toLowerCase();
                      const asunto = encodeURIComponent(
                        `Consulta: ${act.nombre}`
                      );
                      window.open(
                        `https://mail.google.com/mail/?view=cm&fs=1&to=${mail}&su=${asunto}`,
                        '_blank'
                      );
                    }}
                    style={{
                      width: '100%',
                      padding: '15px',
                      backgroundColor: '#f1f5f9',
                      color: '#3b82f6',
                      border: 'none',
                      borderRadius: '16px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: '0.2s',
                    }}
                  >
                    ✉️ Contactar con la empresa
                  </button>
                )}
              </div>
            )}

            {act.enlace && (
              <a
                href={act.enlace}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '22px',
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  borderRadius: '24px',
                  textDecoration: 'none',
                  fontWeight: '800',
                  fontSize: '1.3rem',
                  boxShadow: '0 15px 30px rgba(255, 107, 107, 0.4)',
                  marginBottom: '60px',
                }}
              >
                📝 ¡INSCRIBIRSE AHORA!
              </a>
            )}
          </div>
        )}

        {pestaña === 'mapa' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ marginBottom: '25px' }}>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  color: '#64748b',
                  textTransform: 'uppercase',
                }}
              >
                📍 Localización en el centro
              </p>
              <MapaActividad
                posActividad={[
                  act.latAct || 40.407937755274425,
                  act.lngAct || -3.7469348757382366,
                ]}
                posMonitores={
                  act.latMon && act.latMon !== 40.407937755274425
                    ? [act.latMon, act.lngMon]
                    : null
                }
                posFamilias={
                  act.latFam && act.latFam !== 40.407937755274425
                    ? [act.latFam, act.lngFam]
                    : null
                }
                nombreAct={act.nombre}
                fotoAct={act.fotoAct}
                fotoMon={act.fotoMon}
                fotoFam={act.fotoFam}
                destinoVuelo={destino}
              />
            </div>

           {/* 📍 Logística (Recogidas) */}
           <div
              style={{
                backgroundColor: '#ffffff',
                padding: '25px',
                borderRadius: '28px',
                border: '1px solid #f1f5f9',
                marginBottom: '60px',
              }}
            >
              {/* 1. LUGAR (Vuela a la actividad) */}
              <div
                onClick={esActValido ? () => setDestino([act.latAct, act.lngAct]) : undefined}
                style={{ display: 'flex', gap: '15px', marginBottom: '20px', cursor: esActValido ? 'pointer' : 'default' }}
              >
                <div style={{ fontSize: '1.5rem', minWidth: '35px' }}>📍</div>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#1e293b' }}>
                    Lugar {esActValido && '(Ver en mapa)'}
                  </p>
                  <p style={{ margin: 0, color: '#64748b' }}>{act.lugar}</p>
                </div>
              </div>

              {/* 2. MONITORES (Vuela al punto de monitores) */}
              <div
                onClick={esMonValido ? () => setDestino([act.latMon, act.lngMon]) : undefined}
                style={{
                  display: 'flex',
                  gap: '15px',
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '20px',
                  cursor: esMonValido ? 'pointer' : 'default', // 👈 ¡Botón mágico solo si es válido!
                  transition: 'transform 0.1s active'
                }}
              >
                <div style={{ fontSize: '1.5rem', minWidth: '35px' }}>👨‍🏫</div>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#1e293b' }}>
                    {esMonValido ? 'Monitores (Toca para ubicar 📍)' : 'Monitores'}
                  </p>
                  <p 
                    style={{ 
                      margin: 0, 
                      color: '#64748b',
                      whiteSpace: 'pre-wrap', 
                      lineHeight: '1.4' 
                    }}
                  >
                    {esMonValido ? (act.recogidaMonitores || 'Consultar') : 'Punto de recogida general'}
                  </p>
                </div>
              </div>

              {/* 3. FAMILIAS (Vuela al punto de familias) */}
              <div 
                onClick={esFamValido ? () => setDestino([act.latFam, act.lngFam]) : undefined}
                style={{ 
                  display: 'flex', 
                  gap: '15px', 
                  cursor: esFamValido ? 'pointer' : 'default',
                  padding: '5px',
                  borderRadius: '15px' 
                }}
              >
                <div style={{ fontSize: '1.5rem', minWidth: '35px' }}>👪</div>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#1e293b' }}>
                    {esFamValido ? 'Familias (Toca para ubicar 📍)' : 'Familias'}
                  </p>
                  <p style={{ margin: 0, color: '#64748b' }}>
                    {esFamValido ? (act.recogidaFamilias || 'Consultar') : 'Punto de recogida general'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 🌟 NOTIFICACIONES TOASTS */}
        <ToastContainer toasts={toasts} />
      </div>
    );
  }
// 🚩 NUEVA PANTALLA EXCLUSIVA PARA LAS PREGUNTAS FRECUENTES (FAQ)
if (vista === 'faq') {
  return (
    <div style={{ 
      fontFamily: 'sans-serif',
      backgroundColor: modoOscuro ? '#0a0f1d' : '#f1f5f9', 
      color: modoOscuro ? '#f1f5f9' : '#1e293b',
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between',
      position: 'relative',
      overflowX: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* 🔮 Toques de luz de fondo */}
      <div style={{ position: 'absolute', top: '10%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,70,239,0.08) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ zIndex: 1, width: '100%' }}>
        {/* 🗂️ Barra superior */}
        <div style={{ 
          padding: '15px 20px', 
          backgroundColor: 'rgba(30, 41, 59, 0.95)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)', 
        }}>
          <span style={{ color: 'white', fontWeight: '800', fontSize: '1.1rem' }}>Colegio San Buenaventura</span>
          <button 
            onClick={() => setVista('catalogo')}
            style={{ 
              padding: '10px 20px', borderRadius: '12px', border: 'none', 
              backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(59,130,246,0.3)'
            }}
          >
            ⬅️ Volver al Catálogo
          </button>
        </div>

        {/* 💬 Contenedor de preguntas */}
        <div style={{ maxWidth: '750px', margin: '50px auto 40px', padding: '0 20px' }}>
          <h2 style={{ textAlign: 'center', color: modoOscuro ? '#f8fafc' : '#0f172a', fontSize: '2rem', fontWeight: '900', marginBottom: '30px', letterSpacing: '-0.5px' }}>
            💬 Preguntas Frecuentes
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {preguntasFrecuentes.map((faq) => {
              // 🌟 ¡SÚPER ESCUDO! Comprobamos de forma segura si esta pregunta está abierta
              const estaAbierta = preguntaAbierta === faq.id;

              return (
                <div 
                  key={faq.id}
                  style={{
                    background: modoOscuro ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '18px',
                    border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: estaAbierta ? (modoOscuro ? '0 15px 30px rgba(0,0,0,0.4)' : '0 15px 30px rgba(0,0,0,0.06)') : '0 4px 6px -1px rgba(0,0,0,0.02)',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <button
                    onClick={() => setPreguntaAbierta(estaAbierta ? null : faq.id)}
                    style={{
                      width: '100%', padding: '20px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', display: 'flex', 
                      justifyContent: 'space-between', alignItems: 'center', gap: '15px'
                    }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: '800', color: estaAbierta ? '#3b82f6' : (modoOscuro ? '#cbd5e1' : '#0f172a') }}>
                      {faq.pregunta}
                    </span>
                    <span style={{ 
                      fontSize: '1.1rem', transform: estaAbierta ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease',
                      color: estaAbierta ? '#3b82f6' : '#94a3b8'
                    }}>
                      👇
                    </span>
                  </button>

                  <div style={{
                    maxHeight: estaAbierta ? '220px' : '0px', opacity: estaAbierta ? 1 : 0,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: modoOscuro ? '#1e293b' : '#f8fafc', 
                    borderTop: estaAbierta ? (modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.04)') : 'none'
                  }}>
                    <p style={{ margin: 0, padding: '20px', fontSize: '0.95rem', color: modoOscuro ? '#94a3b8' : '#334155', lineHeight: '1.6', fontWeight: '500' }}>
                      {faq.respuesta}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🛡️ FOOTER PREMIUM GLASSMORPHIC */}
      <footer style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', // 🌌 Azul oscuro degradado premium
        backdropFilter: 'blur(15px) saturate(160%)',
        WebkitBackdropFilter: 'blur(15px) saturate(160%)',
        borderTop: '1.5px solid rgba(255, 255, 255, 0.08)',
        padding: '40px 20px 30px',
        borderRadius: '32px 32px 0 0',
        marginTop: '50px',
        position: 'relative',
        boxShadow: '0 50vh 0 #0f172a', // 🎨 Relleno oscuro infinito
        color: '#cbd5e1', // Texto claro legible
        transition: 'all 0.3s ease',
        marginBottom: '0px',
      }}>
        <div 
          className="footer-grid"
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '30px',
            textAlign: 'left'
          }}
        >
          {/* Columna 1: Identidad */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/extraescolarescsb.firebasestorage.app/o/logo%20BLANCO.png?alt=media&token=753d085f-d9d1-4b78-9d54-26e88578c35b" 
                alt="Escudo Cole" 
                style={{ 
                  width: '140px', // 🛡️ Agrandado premium
                  height: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))'
                }} 
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0', lineHeight: '1.5', fontWeight: '500' }}>
              Portal oficial de actividades extraescolares
            </p>
          </div>

          {/* Columna 2: Contacto Premium */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#60a5fa', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Contacto Directo
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a 
                href="https://maps.google.com/?q=Calle+de+El+Greco+16,+Madrid"
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  fontSize: '0.85rem', 
                  color: '#cbd5e1', 
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s',
                  wordBreak: 'break-word'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
              >
                <span>📍</span> Calle de El Greco 16, Madrid
              </a>
              <a 
                href="tel:915267161"
                style={{ 
                  fontSize: '0.85rem', 
                  color: '#cbd5e1', 
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
              >
                <span>📞</span> 915 267 161
              </a>
              <a 
                href="mailto:extraescolares@sanbuenaventura.org"
                style={{ 
                  fontSize: '0.85rem', 
                  color: '#cbd5e1', 
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s',
                  wordBreak: 'break-all'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
              >
                <span>📧</span> extraescolares@sanbuenaventura.org
              </a>
              <a 
                href="mailto:extraescolarespiscina@sanbuenaventura.org"
                style={{ 
                  fontSize: '0.85rem', 
                  color: '#cbd5e1', 
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.2s',
                  wordBreak: 'break-all'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
              >
                <span>📧</span> extraescolarespiscina@sanbuenaventura.org
              </a>
            </div>
          </div>

          {/* Columna 3: Enlaces Rápidos y Copyright */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#60a5fa', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Navegación Rápida
              </span>
              <div style={{ display: 'flex', gap: '15px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: 0, transition: 'color 0.2s', outline: 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  ↑ Inicio
                </button>
                <button 
                  type="button"
                  onClick={() => setVista('catalogo')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: 0, transition: 'color 0.2s', outline: 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  🎒 Catálogo
                </button>
                <button 
                  type="button"
                  onClick={() => setVista('mapa')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: 0, transition: 'color 0.2s', outline: 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  📍 Mapa
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>
              © {new Date().getFullYear()} Extraescolares Colegio San Buenaventura.
            </div>
          </div>
        </div>
      </footer>
      {/* 🌟 NOTIFICACIONES TOASTS */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
  
  if (vista === 'panel') {
    return (
      <div
        className="admin-panel-card"
        style={{
          padding: '30px',
          maxWidth: '600px',
          margin: '0 auto',
          fontFamily: 'sans-serif',
          backgroundColor: 'white',
          borderRadius: '20px',
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ textAlign: 'center', color: '#1e293b' }}>
          {editandoId ? 'Editar Actividad' : 'Nueva Actividad'}
        </h2>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {/* 📝 NOMBRE */}
          <input
            placeholder="Nombre de la Actividad"
            value={nuevaAct.nombre}
            onChange={(e) =>
              setNuevaAct({ ...nuevaAct, nombre: e.target.value })
            }
            style={estiloInput}
          />

          {/* 📁 CATEGORÍA (CONTROL TOTAL MANUAL) */}
          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>
              Categoría de la Actividad (Control Total Manual)
            </label>
            <select
              value={nuevaAct.categoria || ''}
              onChange={(e) => setNuevaAct({ ...nuevaAct, categoria: e.target.value })}
              style={{
                ...estiloInput,
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Clasificación Automática Inteligente ✨ --</option>
              <option value="Deportes">Deportes ⚽</option>
              <option value="Idiomas">Idiomas 🗣️</option>
              <option value="Arte/expresión">Arte/expresión 🎨</option>
              <option value="Tecnología/manualidades">Tecnología/manualidades 💻</option>
            </select>
          </div>

          {/* 🏁 NUEVO SELECTOR MULTI-ETAPA (Sustituye al viejo <select>) */}
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: '15px', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0',
            marginTop: '5px'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>
              ¿DÓNDE DEBE APARECER? (MARCA VARIAS SI QUIERES)
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Infantil', 'Primaria', 'ESO', 'Adultos', 'Clubes Amigos'].map((et) => (
                <label 
                key={et} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  cursor: 'pointer', 
                  padding: '8px 12px',
                  borderRadius: '10px',
                  // 🛡️ ESCUDO: Si 'nuevaAct.etapas' no existe, usamos el color gris claro (#f1f5f9)
                  backgroundColor: (nuevaAct.etapas && nuevaAct.etapas.includes(et)) ? '#3b82f6' : '#f1f5f9',
                  
                  // 🛡️ ESCUDO: Lo mismo para el color del texto
                  color: (nuevaAct.etapas && nuevaAct.etapas.includes(et)) ? 'white' : '#475569',
                  
                  transition: 'all 0.2s ease',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  border: '1px solid',
                  
                  // 🛡️ ESCUDO: Y para el borde
                  borderColor: (nuevaAct.etapas && nuevaAct.etapas.includes(et)) ? '#2563eb' : '#e2e8f0'
                }}
              >
                <input
                  type="checkbox"
                  style={{ cursor: 'pointer' }}
                  // 🛡️ ESCUDO: Aquí también para que el check no falle
                  checked={nuevaAct.etapas ? nuevaAct.etapas.includes(et) : false}
                  onChange={(e) => {
                    // 📝 Creamos una lista segura (si es undefined, usamos [])
                    const listaActual = nuevaAct.etapas || [];
                    const listaNueva = e.target.checked
                      ? [...listaActual, et]
                      : listaActual.filter((x) => x !== et);
                    setNuevaAct({ ...nuevaAct, etapas: listaNueva });
                  }}
                />
                {et}
              </label>
              ))}
            </div>
          </div>

          {/* 📅 Días - Ahora puedes poner uno debajo de otro */}
          <textarea
            placeholder="Días (ej: 
Lunes
Miércoles)"
            value={nuevaAct.dias}
            onChange={(e) => setNuevaAct({ ...nuevaAct, dias: e.target.value })}
            style={{ ...estiloInput, height: '80px', paddingTop: '10px' }}
          />

          {/* ⏰ Horario - También con espacio por si hay varios turnos */}
          <textarea
            placeholder="Horario (ej: 16:00 a 17:00)"
            value={nuevaAct.horario}
            onChange={(e) => setNuevaAct({ ...nuevaAct, horario: e.target.value })}
            style={{ ...estiloInput, height: '60px', paddingTop: '10px' }}
          />

          {/* 📍 Lugar - Para explicar bien dónde está el aula */}
          <textarea
            placeholder="Lugar o Aula"
            value={nuevaAct.lugar}
            onChange={(e) => setNuevaAct({ ...nuevaAct, lugar: e.target.value })}
            style={{ ...estiloInput, height: '60px', paddingTop: '10px' }}
          />

          {/* 💰 El Precio lo dejamos como input porque suele ser cortito */}
          <input
            placeholder="Precio mensual (ej: 34€)"
            value={nuevaAct.precio}
            onChange={(e) => setNuevaAct({ ...nuevaAct, precio: e.target.value })}
            style={estiloInput}
          />

          {/* 🔗 ENLACE DE INSCRIPCIÓN */}
          <div
            style={{
              backgroundColor: '#f5f3ff',
              padding: '15px',
              borderRadius: '15px',
              border: '2px dashed #7c3aed',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: '#5b21b6',
              }}
            >
              🔗 Enlace al formulario (Google Forms):
            </p>
            <input
              placeholder="Pega aquí el link del formulario"
              value={nuevaAct.enlace || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, enlace: e.target.value })
              }
              style={estiloInput}
            />
          </div>

          {/* 🔗 SECCIÓN DE ENLACES MÚLTIPLES POR CATEGORÍA / CURSO */}
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: '15px', 
            borderRadius: '15px', 
            border: '1px dashed #cbd5e1',
            textAlign: 'left'
          }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', fontSize: '0.9rem', color: '#1e293b' }}>
              🔗 Enlaces por Categoría / Curso (Opcional)
            </label>
            
            {/* Dibujamos cada fila de enlace */}
            {(nuevaAct.linksMultiples || []).map((link, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Ej: Prebenjamín (1º/2º)"
                  value={link.etiqueta}
                  onChange={(e) => {
                    const nuevosLinks = [...(nuevaAct.linksMultiples || [])];
                    nuevosLinks[index].etiqueta = e.target.value;
                    setNuevaAct({ ...nuevaAct, linksMultiples: nuevosLinks });
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b' }}
                />
                <input
                  type="text"
                  placeholder="https://enlace-formulario.com"
                  value={link.url}
                  onChange={(e) => {
                    const nuevosLinks = [...(nuevaAct.linksMultiples || [])];
                    nuevosLinks[index].url = e.target.value;
                    setNuevaAct({ ...nuevaAct, linksMultiples: nuevosLinks });
                  }}
                  style={{ flex: 2, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const nuevosLinks = (nuevaAct.linksMultiples || []).filter((_, i) => i !== index);
                    setNuevaAct({ ...nuevaAct, linksMultiples: nuevosLinks });
                  }}
                  style={{ padding: '8px 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ❌
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setNuevaAct({
                  ...nuevaAct,
                  linksMultiples: [...(nuevaAct.linksMultiples || []), { etiqueta: '', url: '' }]
                });
              }}
              style={{
                marginTop: '5px', padding: '8px 12px', backgroundColor: '#e0f2fe', color: '#0369a1',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              ➕ Añadir otra categoría/enlace
            </button>
          </div>

          {/* 📁 FOTO */}
          <div
            style={{
              backgroundColor: '#fff7ed',
              padding: '15px',
              borderRadius: '15px',
              border: '2px dashed #f97316',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: '#9a3412',
              }}
            >
              🖼️ Foto de la actividad:
            </p>
            <input
              placeholder="Enlace de la foto"
              value={nuevaAct.imagen || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, imagen: e.target.value })
              }
              style={estiloInput}
            />
            {nuevaAct.imagen && (nuevaAct.imagen.startsWith('http') || nuevaAct.imagen.startsWith('data:image')) && (
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={nuevaAct.imagen} 
                  alt="Vista previa actividad" 
                  style={{ maxHeight: '110px', maxWidth: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', objectFit: 'contain', padding: '3px', backgroundColor: 'white' }} 
                />
              </div>
            )}
          </div>

          <textarea
            placeholder="Información para las familias..."
            value={nuevaAct.info}
            onChange={(e) => setNuevaAct({ ...nuevaAct, info: e.target.value })}
            style={{ ...estiloInput, height: '80px' }}
          />

          {/* 🎒 MATERIAL */}
          <div
            style={{
              backgroundColor: '#eff6ff',
              padding: '15px',
              borderRadius: '15px',
              border: '2px dashed #3b82f6',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: '#1e40af',
              }}
            >
              🎒 Material necesario:
            </p>
            <input
              placeholder="Ej: Raqueta..."
              value={nuevaAct.material || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, material: e.target.value })
              }
              style={estiloInput}
            />
          </div>

          {/* 🏢 EMPRESA */}
          <div
            style={{
              backgroundColor: '#f0fdf4',
              padding: '15px',
              borderRadius: '15px',
              border: '2px dashed #22c55e',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: '#166534',
              }}
            >
              🏢 Empresa y Contacto:
            </p>
            <input
              placeholder="Nombre empresa"
              value={nuevaAct.empresa || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, empresa: e.target.value })
              }
              style={estiloInput}
            />
            {/* 📸 ¡NUEVO!: Enlace para el logo de la empresa */}
            <input
                placeholder="URL del Logo de la empresa (Ej: https://...)"
                value={nuevaAct.logoEmpresa || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, logoEmpresa: e.target.value })
                }
                style={estiloInput}
              />
            {nuevaAct.logoEmpresa && (nuevaAct.logoEmpresa.startsWith('http') || nuevaAct.logoEmpresa.startsWith('data:image')) && (
              <div style={{ marginTop: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={nuevaAct.logoEmpresa} 
                  alt="Vista previa logo empresa" 
                  style={{ maxHeight: '60px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'contain', padding: '2px', backgroundColor: 'white' }} 
                />
              </div>
            )}
            <input
              placeholder="Email contacto"
              value={nuevaAct.contacto || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, contacto: e.target.value })
              }
              style={estiloInput}
            />
          </div>

          {/* 🙋‍♂️ Recogida Monitores - Con espacio para explicarse bien */}
          <textarea
  placeholder="Punto de recogida Monitores (ej: 
- Puerta principal
- Patio cubierto)"
  value={nuevaAct.recogidaMonitores}
  onChange={(e) => setNuevaAct({ ...nuevaAct, recogidaMonitores: e.target.value })}
  style={{
    ...estiloInput,
    height: '100px',
    padding: '12px',
    lineHeight: '1.5',    // ↔️ Espacio justo entre líneas
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap' // 👈 Para que tú veas los saltos mientras escribes
  }}
/>
          <input
            placeholder="Punto de entrega a Familias"
            value={nuevaAct.recogidaFamilias}
            onChange={(e) =>
              setNuevaAct({ ...nuevaAct, recogidaFamilias: e.target.value })
            }
            style={estiloInput}
          />

          {/* 📍 SECCIÓN DE COORDENADAS (POR FIN LIBRES Y FUERA DEL BOTÓN) */}
          <div
            style={{
              marginTop: '10px',
              padding: '15px',
              backgroundColor: '#f8fafc',
              borderRadius: '15px',
              border: '2px solid #3b82f6',
              display: 'grid',
              gap: '10px',
            }}
          >
            <p
              style={{
                margin: '0',
                fontWeight: 'bold',
                color: '#1e293b',
                fontSize: '0.9rem',
              }}
            >
              📍 Coordenadas exactas para el mapa:
            </p>

            {/* Actividad */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 'bold' }}>🎒 UBICACIÓN ACTIVIDAD</span>
              <button
                type="button"
                onClick={() => {
                  setCapturandoCoordenadasPara('actividad');
                  setVista('mapa');
                  lanzarToast('📡 Redirigiendo al mapa... Pincha sobre la ubicación de la actividad.', 'info');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #3b82f6',
                  backgroundColor: capturandoCoordenadasPara === 'actividad' ? '#2563eb' : 'transparent',
                  color: capturandoCoordenadasPara === 'actividad' ? 'white' : '#3b82f6',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                {capturandoCoordenadasPara === 'actividad' ? '📡 Esperando clic...' : '🎯 Pinchar en mapa'}
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              <input
                placeholder="Lat. Actividad"
                value={nuevaAct.latAct || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, latAct: e.target.value })
                }
                style={estiloInput}
              />
              <input
                placeholder="Long. Actividad"
                value={nuevaAct.lngAct || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, lngAct: e.target.value })
                }
                style={estiloInput}
              />
            </div>

            {/* Monitores */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 'bold' }}>🚶‍♂️ PUNTO RECOGIDA MONITORES</span>
              <button
                type="button"
                onClick={() => {
                  setCapturandoCoordenadasPara('monitores');
                  setVista('mapa');
                  lanzarToast('📡 Redirigiendo al mapa... Pincha sobre el punto de recogida de monitores.', 'info');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #3b82f6',
                  backgroundColor: capturandoCoordenadasPara === 'monitores' ? '#2563eb' : 'transparent',
                  color: capturandoCoordenadasPara === 'monitores' ? 'white' : '#3b82f6',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                {capturandoCoordenadasPara === 'monitores' ? '📡 Esperando clic...' : '🎯 Pinchar en mapa'}
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              <input
                placeholder="Lat. Monitores"
                value={nuevaAct.latMon || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, latMon: e.target.value })
                }
                style={estiloInput}
              />
              <input
                placeholder="Long. Monitores"
                value={nuevaAct.lngMon || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, lngMon: e.target.value })
                }
                style={estiloInput}
              />
            </div>

            {/* Familias */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 'bold' }}>👨‍👩‍👧 PUNTO ENTREGA FAMILIAS</span>
              <button
                type="button"
                onClick={() => {
                  setCapturandoCoordenadasPara('familias');
                  setVista('mapa');
                  lanzarToast('📡 Redirigiendo al mapa... Pincha sobre el punto de recogida de familias.', 'info');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #3b82f6',
                  backgroundColor: capturandoCoordenadasPara === 'familias' ? '#2563eb' : 'transparent',
                  color: capturandoCoordenadasPara === 'familias' ? 'white' : '#3b82f6',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                {capturandoCoordenadasPara === 'familias' ? '📡 Esperando clic...' : '🎯 Pinchar en mapa'}
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              <input
                placeholder="Lat. Familias"
                value={nuevaAct.latFam || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, latFam: e.target.value })
                }
                style={estiloInput}
              />
              <input
                placeholder="Long. Familias"
                value={nuevaAct.lngFam || ''}
                onChange={(e) =>
                  setNuevaAct({ ...nuevaAct, lngFam: e.target.value })
                }
                style={estiloInput}
              />
            </div>
          </div>
          {/* 📸 FOTOS DE LOS PUNTOS */}
          <div
            style={{
              marginTop: '10px',
              padding: '15px',
              backgroundColor: '#f0f9ff',
              borderRadius: '15px',
              border: '2px solid #0ea5e9',
              display: 'grid',
              gap: '10px',
            }}
          >
            <p
              style={{
                margin: '0',
                fontWeight: 'bold',
                color: '#0369a1',
                fontSize: '0.9rem',
              }}
            >
              📸 Fotos para los globos del mapa (URLs):
            </p>
            <input
              placeholder="URL Foto Actividad"
              value={nuevaAct.fotoAct || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, fotoAct: e.target.value })
              }
              style={estiloInput}
            />
            {nuevaAct.fotoAct && (nuevaAct.fotoAct.startsWith('http') || nuevaAct.fotoAct.startsWith('data:image')) && (
              <div style={{ marginTop: '2px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={nuevaAct.fotoAct} 
                  alt="Vista previa foto actividad" 
                  style={{ maxHeight: '60px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'contain', padding: '2px', backgroundColor: 'white' }} 
                />
              </div>
            )}
            <input
              placeholder="URL Foto Monitores"
              value={nuevaAct.fotoMon || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, fotoMon: e.target.value })
              }
              style={estiloInput}
            />
            {nuevaAct.fotoMon && (nuevaAct.fotoMon.startsWith('http') || nuevaAct.fotoMon.startsWith('data:image')) && (
              <div style={{ marginTop: '2px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={nuevaAct.fotoMon} 
                  alt="Vista previa foto monitores" 
                  style={{ maxHeight: '60px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'contain', padding: '2px', backgroundColor: 'white' }} 
                />
              </div>
            )}
            <input
              placeholder="URL Foto Familias"
              value={nuevaAct.fotoFam || ''}
              onChange={(e) =>
                setNuevaAct({ ...nuevaAct, fotoFam: e.target.value })
              }
              style={estiloInput}
            />
            {nuevaAct.fotoFam && (nuevaAct.fotoFam.startsWith('http') || nuevaAct.fotoFam.startsWith('data:image')) && (
              <div style={{ marginTop: '2px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={nuevaAct.fotoFam} 
                  alt="Vista previa foto familias" 
                  style={{ maxHeight: '60px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'contain', padding: '2px', backgroundColor: 'white' }} 
                />
              </div>
            )}
          </div>

          {/* 🚀 BOTÓN DE GUARDAR (FUERA DE TODO, SIN MOLESTAR) */}
          <button
            type="button"
            onClick={guardarActividad}
            style={{
              padding: '18px',
              backgroundColor: '#10ac84',
              color: 'white',
              border: 'none',
              borderRadius: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1.1rem',
              width: '100%',
              marginTop: '10px',
            }}
          >
            🚀 GUARDAR ACTIVIDAD
          </button>

          <button
            type="button"
            onClick={() => setVista('catalogo')}
            style={{
              padding: '10px',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              width: '100%'
            }}
            
          >
            Volver sin guardar
          </button>

        </div> {/* 👈 AQUÍ CERRAMOS EL GRID DE LA ACTIVIDAD */}
        {/* ======================================================== */}
        {/* 📸 CAJA MÁGICA: SUBIR LA FOTO SUTIL DEL COLEGIO AL STORAGE */}
        {/* ======================================================== */}
        <div style={{
          backgroundColor: modoOscuro ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc',
          padding: '25px',
          borderRadius: '24px',
          border: `2px dashed ${modoOscuro ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
          marginTop: '30px',
          textAlign: 'left'
        }}>
          <h3 style={{ 
            color: modoOscuro ? '#f8fafc' : '#1e293b', 
            margin: '0 0 8px', 
            fontSize: '1.2rem', 
            fontWeight: '800', 
            textAlign: 'center' 
          }}>
            🖼️ Configuración de Fotos y Cabeceras
          </h3>
          <p style={{ 
            color: modoOscuro ? '#94a3b8' : '#64748b', 
            fontSize: '0.8rem', 
            margin: '0 0 20px', 
            textAlign: 'center',
            fontWeight: '500'
          }}>
            Pega los enlaces "https://..." de tus fotos de Firebase o internet para personalizar el portal.
          </p>
          
          {/* Foto de Fondo General */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.85rem', 
              fontWeight: '700', 
              color: modoOscuro ? '#cbd5e1' : '#475569', 
              marginBottom: '6px' 
            }}>
              🌌 Foto de Fondo del Header General
            </label>
            <input
              placeholder="Pega aquí el enlace de la foto de fondo del colegio"
              value={fotoFondoHeader}
              onChange={(e) => setFotoFondoHeader(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: `1px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
                backgroundColor: modoOscuro ? '#1e293b' : 'white',
                fontSize: '0.9rem',
                color: modoOscuro ? '#f8fafc' : '#334155',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ 
            borderTop: `1px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`, 
            paddingTop: '15px', 
            marginBottom: '20px' 
          }}>
            <h4 style={{ 
              color: modoOscuro ? '#f8fafc' : '#1e293b', 
              margin: '0 0 12px', 
              fontSize: '0.95rem', 
              fontWeight: '800' 
            }}>
              📸 Fotos Portada de cada Etapa Escolar
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: '🧸 Educación Infantil', key: 'Infantil' },
                { label: '🎒 Educación Primaria', key: 'Primaria' },
                { label: '🎓 Secundaria y Bachillerato (ESO)', key: 'ESO' },
                { label: '🧘 Actividades de Adultos', key: 'Adultos' },
                { label: '🌟 Clubes Amigos', key: 'Clubes Amigos' }
              ].map((etapa) => (
                <div key={etapa.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: '600', 
                    color: modoOscuro ? '#94a3b8' : '#64748b' 
                  }}>
                    {etapa.label}
                  </label>
                  <input
                    placeholder={`Enlace de la imagen para la etapa ${etapa.key}`}
                    value={fotosEtapas[etapa.key]}
                    onChange={(e) => setFotosEtapas(prev => ({ ...prev, [etapa.key]: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                      backgroundColor: modoOscuro ? '#0f172a' : 'white',
                      fontSize: '0.85rem',
                      color: modoOscuro ? '#f8fafc' : '#334155',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (!isAdmin) return lanzarToast('🛑 ¡Acceso denegado! No tienes permisos de administrador. 🔐', 'error');
              try {
                lanzarToast('⏳ Guardando la configuración de fotos...', 'info');
                const { doc, setDoc } = await import('firebase/firestore');
                
                await setDoc(doc(db, "actividades_cole", "configuracion_header"), { 
                  fotoFondoHeader: fotoFondoHeader,
                  fotoEtapaInfantil: fotosEtapas.Infantil,
                  fotoEtapaPrimaria: fotosEtapas.Primaria,
                  fotoEtapaESO: fotosEtapas.ESO,
                  fotoEtapaAdultos: fotosEtapas.Adultos,
                  fotoEtapaClubes: fotosEtapas['Clubes Amigos']
                }, { merge: true });
                
                lanzarToast('🎉 ¡Configuración de fotos guardada con éxito!', 'exito');
              } catch (error) {
                console.error("Error al guardar las fotos:", error);
                lanzarToast('❌ ¡Vaya! Algo ha fallado al guardar las fotos.', 'error');
              }
            }}
            style={{
              padding: '12px 18px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            💾 GUARDAR TODA LA CONFIGURACIÓN DE FOTOS
          </button>
        </div>
        {/* ======================================================== */}

        {/* 📍 AHORA EL MAPA ESTÁ FUERA, EN SU PROPIA ISLA AZUL */}
        <div style={{ 
          marginTop: '40px', 
          padding: '25px', 
          backgroundColor: '#eff6ff', 
          borderRadius: '20px',
          border: '2px dashed #3b82f6' 
        }}>
          <h3 style={{ color: '#1e293b', margin: '0 0 10px', textAlign: 'center' }}>📍 Gestionar Mapa Maestro</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', marginBottom: '20px' }}>
            (Estos puntos son independientes de las actividades)
          </p>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            <input
              placeholder="Nombre del sitio (Ej: Secretaría)"
              style={estiloInput}
              id="nuevoPuntoNombre"
            />
            <input
              placeholder="Breve descripción"
              style={estiloInput}
              id="nuevoPuntoDesc"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input placeholder="Latitud" style={estiloInput} id="nuevoPuntoLat" />
              <input placeholder="Longitud" style={estiloInput} id="nuevoPuntoLng" />
            </div>
            <button
              type="button"
              onClick={() => {
                setCapturandoCoordenadasPara('maestro');
                setVista('mapa');
                lanzarToast('📡 Redirigiendo al mapa... Pincha en el punto para capturar sus coordenadas.', 'info');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #3b82f6',
                backgroundColor: capturandoCoordenadasPara === 'maestro' ? '#2563eb' : 'transparent',
                color: capturandoCoordenadasPara === 'maestro' ? 'white' : '#3b82f6',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none',
                boxShadow: capturandoCoordenadasPara === 'maestro' ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none'
              }}
            >
              {capturandoCoordenadasPara === 'maestro' ? '📡 Esperando clic en el mapa...' : '🎯 Pinchar en el mapa para capturar coordenadas'}
            </button>
            <input
              placeholder="URL de la foto del lugar"
              style={estiloInput}
              id="nuevoPuntoFoto"
            />
            
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation(); // 🛡️ ¡Súper escudo! Evita que el clic suba a la actividad
                if (!isAdmin) return lanzarToast('🛑 ¡Acceso denegado! No tienes permisos de administrador. 🔐', 'error');
                
                const nombre = document.getElementById('nuevoPuntoNombre').value;
                const desc = document.getElementById('nuevoPuntoDesc').value;
                const lat = document.getElementById('nuevoPuntoLat').value;
                const lng = document.getElementById('nuevoPuntoLng').value;
                const foto = document.getElementById('nuevoPuntoFoto').value;

                if(!nombre || !lat || !lng) return lanzarToast('¡Oye! Faltan datos (Nombre, Lat y Lng) 📝', 'advertencia');

                try {
                    const datos = {
                      nombre,
                      descripcion: desc,
                      lat: parseFloat(lat),
                      lng: parseFloat(lng),
                      foto: foto || '',
                      color: 'red'
                    };

                    if (editandoPuntoId) {
                      await updateDoc(doc(db, 'puntos_interes_cole', editandoPuntoId), datos);
                      lanzarToast('¡Chincheta actualizada con éxito! 📝📍', 'exito');
                    } else {
                      await addDoc(collection(db, 'puntos_interes_cole'), datos);
                      lanzarToast('¡Chincheta guardada con éxito! 📍', 'exito');
                    }
                    
                    setEditandoPuntoId(null);
                    cargarPuntosInteres();
                    
                    // ✨ ¡ESTA ES LA LÍNEA MÁGICA! 
                    // Te saca del panel y te lleva al catálogo automáticamente
                    setVista('catalogo'); 
                    
                    // Limpiar los campos (por si acaso vuelves luego)
                    document.getElementById('nuevoPuntoNombre').value = '';
                    document.getElementById('nuevoPuntoDesc').value = '';
                    document.getElementById('nuevoPuntoLat').value = '';
                    document.getElementById('nuevoPuntoLng').value = '';
                    document.getElementById('nuevoPuntoFoto').value = '';
                    
                    if (typeof cargarPuntosInteres === 'function') cargarPuntosInteres();
                  } catch (error) {
                    console.error("Error al guardar punto:", error);
                    lanzarToast(`❌ Error al guardar: ${error.message || error}`, "error");
                  }
              }}
              style={{
                padding: '15px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              {editandoPuntoId ? '📝 ACTUALIZAR CHINCHETA' : '🚀 GUARDAR SOLO LA CHINCHETA'}
            </button>
            {/* 🗑️ LISTA PARA BORRAR PUNTOS (Pégalo justo aquí) */}
            <div style={{ 
              marginTop: '25px', 
              paddingTop: '20px', 
              borderTop: '1px solid #cbd5e1' 
            }}>
              <p style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', marginBottom: '10px' }}>
                🗑️ Tus puntos actuales (Toca para editar o borrar):
              </p>
              
              <div style={{ display: 'grid', gap: '8px' }}>
                {puntosInteres.map((p) => (
                  <div key={p.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    backgroundColor: 'white',
                    padding: '10px 15px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#334155' }}>📍 {p.nombre}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditandoPuntoId(p.id);
                          document.getElementById('nuevoPuntoNombre').value = p.nombre;
                          document.getElementById('nuevoPuntoDesc').value = p.descripcion || '';
                          document.getElementById('nuevoPuntoLat').value = p.lat;
                          document.getElementById('nuevoPuntoLng').value = p.lng;
                          document.getElementById('nuevoPuntoFoto').value = p.foto || '';
                          lanzarToast('📝 Chincheta cargada para editar. ¡Modifica los campos arriba! 📍', 'info');
                          
                          const formEl = document.getElementById('nuevoPuntoNombre');
                          if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        style={{
                          backgroundColor: '#dbeafe',
                          color: '#2563eb',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}
                      >
                        EDITAR
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!isAdmin) return lanzarToast('🛑 ¡Acceso denegado! No tienes permisos de administrador. 🔐', 'error');
                           if (confirm(`⚠️ ¿Quieres eliminar permanentemente el punto de interés "${p.nombre}"?\n\nSe borrará de los mapas de todas las familias de forma definitiva.`)) {
                            try {
                              const { deleteDoc, doc } = await import('firebase/firestore');
                              await deleteDoc(doc(db, 'puntos_interes_cole', p.id));
                              lanzarToast('¡Punto borrado! ✨', 'exito');
                              if (editandoPuntoId === p.id) {
                                setEditandoPuntoId(null);
                                document.getElementById('nuevoPuntoNombre').value = '';
                                document.getElementById('nuevoPuntoDesc').value = '';
                                document.getElementById('nuevoPuntoLat').value = '';
                                document.getElementById('nuevoPuntoLng').value = '';
                                document.getElementById('nuevoPuntoFoto').value = '';
                              }
                              cargarPuntosInteres(); // Esto hace que la lista se actualice sola
                            } catch (error) {
                              lanzarToast('No se pudo borrar', 'error');
                            }
                          }
                        }}
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#ef4444',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}
                      >
                        ELIMINAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* 🌟 NOTIFICACIONES TOASTS */}
        <ToastContainer toasts={toasts} />
      </div> // 👈 CIERRA EL CONTENEDOR BLANCO DEL PANEL
    );
  }
  
} // 👈 CIERRA LA FUNCIÓN PAGE


const estiloInput = {
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  fontSize: '1rem',
  width: '100%',
  boxSizing: 'border-box',
};
