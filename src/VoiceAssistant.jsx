import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 🎙️ COMPONENTE ASISTENTE DE VOZ CSB (CASTELLANO es-ES)
// ==========================================
export default function VoiceAssistant({ showToast }) {
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

    window.speechSynthesis.cancel();

    const textoLimpio = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/•/g, '. ')
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(textoLimpio);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = voicesList.length > 0 ? voicesList : window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter((v) => v.lang.startsWith('es'));

    const vozNatural =
      spanishVoices.find(
        (v) =>
          (v.lang === 'es-ES' || v.lang === 'es_ES') &&
          (v.name.includes('Natural') ||
            v.name.includes('Enhanced') ||
            v.name.includes('Online') ||
            v.name.includes('Neural') ||
            v.name.includes('Alvaro') ||
            v.name.includes('Elvira') ||
            v.name.includes('Google') ||
            v.name.includes('Monica') ||
            v.name.includes('Jorge') ||
            v.name.includes('Helena'))
      ) ||
      spanishVoices.find(
        (v) =>
          v.name.includes('Natural') ||
          v.name.includes('Enhanced') ||
          v.name.includes('Online') ||
          v.name.includes('Neural')
      ) ||
      spanishVoices.find((v) => v.lang === 'es-ES' || v.lang === 'es_ES') ||
      spanishVoices[0];

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
    } else if (typeof showToast === 'function') {
      showToast('⚠️ Tu navegador no soporta entrada de voz directa. Puedes escribir en el chat.', 'warning');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  const responderPregunta = (query) => {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (q.includes('aquagym') || q.includes('agua gym') || q.includes('gimnasia acuatic')) {
      return '💧 **Aquagym (+16 años)**:\n• Horarios: Lunes y Miércoles o Martes y Jueves de 17:30 a 18:15.\n• Precios: Pack 2 días a 50€/mes o 1 día suelto a 37€/mes.\n• No requiere prueba de nivel previa.';
    }

    if (q.includes('horario') || q.includes('dias') || q.includes('turnos') || q.includes('cuando')) {
      if (q.includes('chapoteo') || q.includes('infantil') || q.includes('peque')) {
        return '👶 **Chapoteo (Infantil 3-5 años)**:\nDe Lunes a Viernes a las 16:00 (duración 45 min). Mínimo 2 días a la semana.';
      }
      if (q.includes('primaria')) {
        return '🏊 **Natación Primaria**:\n• Turno salida del cole: 16:15 a 17:15.\n• Turno de tarde: 17:30 a 18:00 (30 min). Packs L/X o M/J, o días sueltos.';
      }
      if (q.includes('waterpolo')) {
        return '🤽‍♂️ **Waterpolo (3º-6º Primaria)**:\nDe Lunes a Viernes de 17:30 a 18:30 (1 hora). Pack 2 días a 60€/mes o 1 día suelto a 45€/mes.';
      }
      if (q.includes('eso') || q.includes('bach') || q.includes('adolescent')) {
        return '🎓 **ESO y Bachillerato**:\nLunes y Miércoles de 18:30 a 19:00 o Viernes al mediodía de 14:15 a 15:00.';
      }
      if (q.includes('adulto')) {
        return '👨‍👩‍👧 **Adultos**:\nLunes, Miércoles y Viernes a las 18:00 o Martes y Jueves a las 18:30.';
      }
      if (q.includes('nado libre') || q.includes('libre')) {
        return '⏱️ **Nado Libre Independiente**:\nDe Lunes a Viernes de 18:30 a 19:00. 35€/mes pack 2 días o 25€/mes 1 día suelto.';
      }
      return '📅 **Resumen de Horarios principales**:\n• Chapoteo: 16:00h\n• Primaria: 16:15h y 17:30h\n• Waterpolo: 17:30h\n• Aquagym: 17:30h (L/X y M/J)\n• Adultos: 18:00h y 18:30h\n• ESO/Bach: 18:30h (Viernes 14:15h)\n¿De qué actividad deseas saber más?';
    }

    if (q.includes('precio') || q.includes('cuota') || q.includes('cuanto cuesta') || q.includes('vale') || q.includes('tarifa') || q.includes('descuento')) {
      return '💰 **Tarifas Oficiales de Piscina**:\n• **Packs de 2 días/semana**: 50€/mes (Aquagym, Adultos, Primaria tarde), 60€/mes (Waterpolo) o 65€/mes (Primaria 16:15).\n• **1 día suelto/semana**: 37€/mes (Aquagym, Adultos, Primaria) o 45€/mes (Waterpolo / Primaria 16:15).\nTodos los cobros son mensuales.';
    }

    if (q.includes('gorro') || q.includes('chancla') || q.includes('ropa') || q.includes('llevar') || q.includes('material') || q.includes('norma') || q.includes('calzado') || q.includes('vestuar')) {
      if (q.includes('vestuar') || q.includes('padre') || q.includes('acceso') || q.includes('acompan')) {
        return '🚪 **Acceso a Vestuarios**:\nLas familias solo pueden acceder al vestuario para ayudar a cambiarse en **Chapoteo** e **Infantil/1º-3º Primaria**. En el resto de edades los alumnos acceden de forma autónoma.';
      }
      return '🧢 **Material y Normativa Obligatoria**:\n1. Gorro de natación (silicona o tela).\n2. Chancletas de agua de uso exclusivo para vestuarios.\n3. Bañador deportivo y toalla/albornoz.\n⛔ **Prohibido estricto**: Calzado de calle en la zona de playa de la piscina.';
    }

    if (q.includes('prueba') || q.includes('nivel') || q.includes('evalua') || q.includes('cita')) {
      return '🧪 **Pruebas de Nivel**:\n• **Obligatorias previa inscripción**: Primaria (1º-6º) y ESO/Bachillerato.\n• **No requieren prueba**: Chapoteo, Aquagym, Waterpolo, Adultos y Nado Libre.\nPuedes reservar tu cita de prueba de nivel directamente desde el botón azul del inicio.';
    }

    if (q.includes('baja') || q.includes('cancelar') || q.includes('reserva') || q.includes('octubre')) {
      if (q.includes('baja') || q.includes('cancelar')) {
        return '📋 **Gestión de Bajas**:\nLas bajas deben tramitarse antes del **día 25 del mes anterior** desde el panel familiar de la web para no cargar el recibo del mes siguiente.';
      }
      return '📆 **Renovaciones de Octubre**:\nLas plazas confirmadas se mantienen reservadas automáticamente para el inicio de curso escolar el 1 de Octubre.';
    }

    if (q.includes('donde') || q.includes('direccion') || q.includes('ubicacion') || q.includes('colegio') || q.includes('contacto') || q.includes('telefono')) {
      return '📍 **Colegio San Buenaventura CSB**:\nCalle de El Greco, 16, 28011 Madrid. Las clases de natación se realizan en el vaso de la piscina cubierta del colegio.';
    }

    return '😊 Puedo ayudarte con cualquier información de la piscina. ¿Te gustaría saber sobre **horarios**, **precios**, **normativa de gorros/chancletas** o **pruebas de nivel**?';
  };

  const handleUserQuery = (queryText) => {
    if (!queryText || !queryText.trim()) return;

    const userMessage = { sender: 'user', text: queryText.trim() };
    const botResponseText = responderPregunta(queryText);
    const botMessage = { sender: 'bot', text: botResponseText };

    setChatHistory((prev) => [...prev, userMessage, botMessage]);
    setInputText('');
    setTranscript('');

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
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
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
