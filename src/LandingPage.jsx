import React, { useState, useEffect } from 'react';
import {
  IMG_ESCUDO_BLANCO,
  IMG_ESCUDO_COLOR,
  IMG_PRINCIPAL,
  MAPA_IMAGEN_URL,
  GALERIA,
  OFERTA_ACTIVIDADES
} from './catalogo.js';

// ==========================================
// 🏠 LANDING PAGE (VERSIÓN COMPLETA Y DETALLADA)
// ==========================================
export default function LandingPage({ setView, showToast }) {
  const [tab, setTab] = useState('actividades');
  const [filtroEtapa, setFiltroEtapa] = useState('todos');
  const [highlightedActId, setHighlightedActId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const actId = params.get('act');
    if (actId) {
      const actExists = OFERTA_ACTIVIDADES.some((a) => a.id === actId);
      if (actExists) {
        setTab('actividades');
        setFiltroEtapa('todos');
        setHighlightedActId(actId);

        setTimeout(() => {
          const el = document.getElementById(`card-${actId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);

        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('act');
          window.history.replaceState({}, '', url.pathname + url.search);
        }, 1500);

        setTimeout(() => {
          setHighlightedActId(null);
        }, 4000);
      }
    }
  }, []);

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
        headerGrad: 'from-slate-600/90 to-slate-800/90',
        badgeText: '⏱️ Nado Libre Independiente',
        btnBg: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-800 hover:text-white',
        btnHover: 'group-hover:bg-slate-800 group-hover:text-white border-slate-200',
        shadowGlow: 'hover:shadow-slate-900/10 hover:border-slate-300',
        priceColor: 'from-slate-700 to-slate-500'
      };
    }
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
          <img src={IMG_PRINCIPAL} className="w-full h-full object-cover z-0" alt="Piscina Colegio San Buenaventura" />
        </div>
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <img src={IMG_ESCUDO_BLANCO} className="h-20 md:h-28 mx-auto mb-6 drop-shadow-2xl object-contain max-w-[85vw]" alt="Escudo Colegio San Buenaventura" />
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black mb-4 text-white leading-tight [text-shadow:_2px_2px_0_#2563eb,_-2px_-2px_0_#2563eb,_2px_-2px_0_#2563eb,_-2px_2px_0_#2563eb,_0_4px_6px_rgba(0,0,0,0.3)]">
            Natación colegio <br />
            <span className="tracking-tight">San Buenaventura</span>
          </h1>

          <p className="text-xl md:text-2xl font-light mb-2 drop-shadow-sm opacity-90">
            Deporte, salud y educación en el agua
          </p>
          <p className="text-xs md:text-sm italic text-gray-200 mb-8 max-w-2xl border-t border-white/30 pt-2">
            &ldquo;Estas actividades tienen carácter voluntario, no discriminatorio y no lucrativo&rdquo;
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
          {['actividades', 'info', 'instalaciones', 'tutorial'].map((t) => (
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
          {/* 📹 REPRODUCTOR DEL VIDEOTUTORIAL DE INSCRIPCIÓN */}
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

              <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <video
                  src="https://firebasestorage.googleapis.com/v0/b/piscina-sanbuenaventura.firebasestorage.app/o/Inscripci%C3%B3n%20piscina.mp4?alt=media&token=5e916f7d-52b0-4a1c-90cb-a969bd7836fd"
                  controls
                  preload="metadata"
                  className="w-full rounded-2xl shadow-inner border border-gray-100"
                  poster={IMG_PRINCIPAL}
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-xs text-blue-900 font-medium max-w-xl mx-auto">
                💡 <strong>¿Tienes alguna duda extra?</strong> Si tras ver el vídeo sigues necesitando ayuda, puedes acudir a la pestaña de &ldquo;Información&rdquo; para ver los teléfonos de contacto. ¡Al agua patos!
              </div>
            </div>
          )}

          {/* VISTA ACTIVIDADES */}
          {tab === 'actividades' && (
            <div className="flex flex-col animate-fade-in w-full">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 text-center">
                Navegación Rápida
              </p>

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
                      ${
                        filtroEtapa === boton.id
                          ? `${boton.color} text-white shadow-lg ring-4 ring-offset-2 ring-opacity-50`
                          : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
                      }`}
                  >
                    {boton.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-center justify-items-center">
                {OFERTA_ACTIVIDADES.filter((act) => {
                  if (filtroEtapa === 'todos') return true;
                  if (filtroEtapa === 'infantil') return act.cursos.some((c) => c.includes('INF'));
                  if (filtroEtapa === 'primaria') return act.cursos.some((c) => c.includes('PRI'));
                  if (filtroEtapa === 'secundaria') return act.cursos.some((c) => c.includes('ESO') || c.includes('BACH'));
                  if (filtroEtapa === 'adultos') return act.cursos.includes('ADULTO');
                  return true;
                }).map((act) => {
                  const theme = getThemeByActivity(act);
                  return (
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
                      <div className={`bg-gradient-to-br ${theme.headerGrad} p-5 relative text-left`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-white/10">
                            {theme.badgeText}
                          </span>
                        </div>
                        <h3 className="text-white font-black text-lg pr-8 uppercase tracking-tight leading-tight">{act.nombre}</h3>

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

                        {act.aviso && (
                          <div className="bg-amber-400/10 border border-amber-200/50 p-3 rounded-xl text-xs text-amber-900 mb-4 font-semibold flex gap-2 text-left backdrop-blur-sm">
                            <span>⚠️</span>
                            <span>{act.aviso}</span>
                          </div>
                        )}

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
                                    url: urlCompartir
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

          {/* VISTA INFO */}
          {tab === 'info' && (
            <div className="space-y-10 animate-fade-in">
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-sm mb-10 max-w-4xl mx-auto">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 text-center">
                  Navegación Rápida
                </p>

                <div className="flex flex-col gap-4">
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
                  <img src={MAPA_IMAGEN_URL} loading="lazy" className="max-h-[500px] object-contain rounded shadow-sm" alt="Mapa de accesos a la piscina" />
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">Acceso por el portón azul al final del patio.</p>
              </div>

              {/* MATERIAL NECESARIO */}
              <div id="material" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden my-8 scroll-mt-20">
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎒</span>
                    <div>
                      <h3 className="font-black uppercase tracking-wider text-sm">Equipamiento</h3>
                      <p className="text-blue-100 text-[10px] font-medium opacity-90">REQUERIDO PARA CADA CLASE</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {[
                    { icon: '🩲', label: 'Bañador', desc: 'Deportivo' },
                    { icon: '🧣', label: 'Toalla', desc: 'O Albornoz' },
                    { icon: '🥽', label: 'Gafas', desc: 'Ajustadas' },
                    { icon: '🧢', label: 'Gorro', desc: 'Silicona/Lycra' },
                    { icon: '🩴', label: 'Chanclas', desc: 'Goma' }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="group p-4 rounded-2xl border border-gray-50 bg-gray-50/30 hover:bg-blue-50 hover:border-blue-100 transition-all duration-300 flex flex-col items-center shadow-sm hover:shadow-md"
                    >
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform duration-300 mb-3">
                        {item.icon}
                      </div>
                      <span className="font-black text-gray-800 text-[11px] uppercase tracking-wide">{item.label}</span>
                      <span className="text-[9px] text-gray-400 font-bold group-hover:text-blue-500 transition-colors uppercase mt-1">
                        {item.desc}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 p-3 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    ✨ Recuerda ducharte antes de entrar al agua
                  </p>
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

              {/* GESTIÓN DE ALTAS Y BAJAS */}
              <div id="normativa" className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden my-10 scroll-mt-20">
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

                  <div className="relative pl-8 border-l-2 border-blue-500">
                    <div className="absolute -left-[11px] top-0 w-5 h-5 bg-blue-600 rounded-full border-4 border-white shadow-sm"></div>
                    <h4 className="font-black text-slate-900 text-xl uppercase tracking-tight">Altas y Mensualidades</h4>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Política de Pago</span>
                        <p className="text-slate-800 text-base font-bold mt-2 leading-relaxed">
                          Las incorporaciones con el mes ya iniciado requieren el abono de la <span className="text-blue-700 underline decoration-2 underline-offset-4">mensualidad completa</span>.
                        </p>
                      </div>
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Aviso de Prorrateos</span>
                        <p className="text-slate-800 text-base font-bold mt-2 leading-relaxed">
                          No se realizan descuentos ni devoluciones por días sueltos o falta de asistencia.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-4 bg-gray-50/50"></div>
              </div>

              {/* PREGUNTAS FRECUENTES */}
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
                  <div>
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 text-left">📍 Accesos y Recogidas</h4>
                    <div className="space-y-3">
                      {[
                        {
                          q: '¿Dónde se recoge a los alumnos al finalizar la clase?',
                          a: 'La recogida se realiza en la puerta de las instalaciones de la piscina. Podrá acceder por el Portón Azul hasta las 18:30. A partir de esa hora, el acceso se realizará exclusivamente por la puerta del parking.'
                        },
                        {
                          q: '¿Por dónde entran y salen los alumnos a partir de las 18:30?',
                          a: 'El acceso principal al colegio se cierra. La entrada y salida se realiza exclusivamente por la puerta que está al final del parking del colegio. Pueden encontrar un mapa en la parte superior de esta sección.'
                        },
                        {
                          q: '¿Cómo es la recogida de los alumnos de Infantil?',
                          a: 'Para los alumnos de Infantil que terminan su clase, los monitores los recogen directamente en su clase.'
                        },
                        {
                          q: '¿Pueden entrar los padres a los vestuarios?',
                          a: 'Siguiendo la normativa de autonomía y seguridad, el acceso de adultos a vestuarios está limitado. Los alumnos de Primaria deben cambiarse solos para fomentar su independencia. En Infantil, se permite asistencia mínima si es estrictamente necesario.'
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

                  <div>
                    <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-3 text-left">💳 Inscripciones y Pagos</h4>
                    <div className="space-y-3">
                      {[
                        {
                          q: '¿Cómo me doy de baja en la actividad?',
                          a: 'Las bajas deben comunicarse antes del día 25 del mes anterior al que se desea hacer efectiva la baja. La baja se tramita desde el área privada de cada usuario.'
                        },
                        {
                          q: '¿Qué pasa si devuelvo un recibo mensual?',
                          a: 'La devolución de un recibo genera gastos bancarios que deberán ser abonados por la familia. Si el impago persiste, el alumno perderá la plaza automáticamente.'
                        },
                        {
                          q: '¿Hay que pagar matrícula cada año?',
                          a: 'No, no hay matrícula.'
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

                  <div>
                    <h4 className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-3 text-left">🏊‍♂️ Sobre las Clases</h4>
                    <div className="space-y-3">
                      {[
                        {
                          q: '¿Cuál es el número máximo de alumnos por grupo y qué horarios hay disponibles?',
                          a: "Puedes consultar el detalle actualizado de horarios, días de clase y ratios de alumnos por monitor en la sección de 'Actividades' al principio de esta página. Allí encontrarás la información específica para cada nivel y edad."
                        },
                        {
                          q: '¿A qué temperatura está el agua de la piscina?',
                          a: 'Nuestras instalaciones son de uso deportivo, por lo que el agua se mantiene en el rango óptimo recomendado para la actividad física: entre 27°C y 28°C. Esta temperatura garantiza el confort térmico del alumno durante el ejercicio, evitando tanto el sobrecalentamiento como la fatiga prematura.'
                        },
                        {
                          q: '¿Necesito hacer prueba de nivel si soy nuevo?',
                          a: 'Sí, todos los alumnos nuevos (de actividades que lo requieran) deben realizar una prueba de nivel previa para asignarles el grupo que mejor se adapte a su habilidad actual y asegurar su aprendizaje.'
                        },
                        {
                          q: '¿Qué material debe traer el alumno siempre?',
                          a: 'Bañador, gorro de silicona o lycra, gafas de natación, chanclas y toalla o albornoz. Todo marcado con el nombre del alumno a ser posible.'
                        },
                        {
                          q: '¿Puedo cambiar de horario a mitad de curso?',
                          a: 'Solo si hay plazas disponibles en el nivel correspondiente del nuevo horario solicitado. Deberá consultarse con el coordinador de la actividad.'
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

              {/* CONTACTO Y UBICACIÓN */}
              <div id="contacto" className="grid md:grid-cols-2 gap-6 pt-4 scroll-mt-20">
                <div className="bg-white border-l-4 border-blue-600 rounded-xl p-6 shadow-md hover:shadow-lg transition">
                  <h3 className="text-xl font-black text-blue-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">📞 Contacto y Redes</h3>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 w-12 h-12 flex items-center justify-center rounded-full text-xl shadow-sm">☎️</div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Secretaría General</p>
                        <a href="tel:915267161" className="text-2xl font-black text-blue-700 hover:text-blue-900 transition">
                          915 26 71 61
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <a
                        href="https://www.sanbuenaventura.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 transition shadow-sm group"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">🌐</span>
                        <span className="text-[10px] font-black text-gray-600 uppercase">Web Colegio</span>
                      </a>

                      <a
                        href="https://www.instagram.com/cs_buenaventura"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition shadow-sm group w-full"
                        onClick={() => {
                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                          if (isMobile) {
                            window.location.href = 'instagram://user?username=cs_buenaventura';
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:scale-110 transition-transform">
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

                <div className="bg-white border-l-4 border-green-600 rounded-xl p-6 shadow-md hover:shadow-lg transition flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black text-green-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">📍 Ubicación</h3>
                    <div className="flex items-start gap-4 mb-6">
                      <div className="bg-green-100 w-12 h-12 flex items-center justify-center rounded-xl text-2xl shadow-sm shrink-0">🏫</div>
                      <div>
                        <p className="font-black text-gray-900 uppercase text-sm tracking-tight">Colegio San Buenaventura</p>
                        <p className="text-base font-medium text-gray-600 mt-1 leading-relaxed">
                          C. de El Greco, 16,<br />
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

          {/* VISTA INSTALACIONES */}
          {tab === 'instalaciones' && (
            <div className="flex flex-col animate-fade-in w-full space-y-12">
              <div className="flex flex-col w-full">
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

                <div className="flex justify-start items-center gap-4 mt-6 px-4 py-3 bg-blue-50/30 rounded-2xl border border-blue-100/50 max-w-fit mr-auto">
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
              </div>

              <div className="w-full">
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-px bg-slate-100 flex-1"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Explora la instalación</p>
                  <div className="h-px bg-slate-100 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {GALERIA.map((foto, index) => (
                    <div key={index} className="group flex flex-col">
                      <div className="overflow-hidden rounded-[24px] shadow-sm border border-gray-100 bg-gray-50 aspect-[4/3]">
                        <img
                          src={foto.url}
                          loading="lazy"
                          onError={(e) => {
                            if (foto.fallback && e.currentTarget.src !== foto.fallback) {
                              e.currentTarget.src = foto.fallback;
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                          alt={foto.nombre}
                        />
                      </div>
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

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-8 mt-12 w-full border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={IMG_ESCUDO_COLOR}
              className="h-12 w-auto brightness-0 invert opacity-90 transition-opacity hover:opacity-100"
              alt="CSB"
            />
            <div className="h-8 w-[1px] bg-gray-700 hidden md:block"></div>
          </div>

          <div className="text-center md:text-left flex-1 md:ml-6">
            <p className="text-sm font-medium text-gray-400 tracking-[0.1em]">
              © {new Date().getFullYear()} <span className="text-white font-black uppercase ml-1">Colegio San Buenaventura</span> — Natación
            </p>
            <p className="text-xs text-gray-500 mt-1">Calle de El Greco, 16, 28011 Madrid</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Madrid</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
