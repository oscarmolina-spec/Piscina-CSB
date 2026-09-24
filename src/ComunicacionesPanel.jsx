import React, { useState } from 'react';
import { addDoc, collection, getDocsFromServer } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { claveGrupo, prepararDestinatarios } from './comunicaciones.js';

const PLANTILLAS = {
  libre: { titulo: '', cuerpo: '' },
  aviso: { titulo: 'Aviso importante de la piscina', cuerpo: 'Estimadas familias:\n\nOs informamos de lo siguiente:\n\n\n\nUn saludo,\nCoordinación de Extraescolares CSB' },
  recordatorio: { titulo: 'Recordatorio de la actividad de piscina', cuerpo: 'Estimadas familias:\n\nOs recordamos que:\n\n\n\nUn saludo,\nCoordinación de Extraescolares CSB' },
  horario: { titulo: 'Información sobre el horario de piscina', cuerpo: 'Estimadas familias:\n\nOs comunicamos la siguiente información sobre el horario:\n\n\n\nUn saludo,\nCoordinación de Extraescolares CSB' }
};
const escaparHtml = texto => String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default function ComunicacionesPanel({ alumnos, padres, userEmail, showToast }) {
  const [alcance, setAlcance] = useState('personas');
  const [ids, setIds] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [actividadId, setActividadId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [plantilla, setPlantilla] = useState('aviso');
  const [titulo, setTitulo] = useState(PLANTILLAS.aviso.titulo);
  const [cuerpo, setCuerpo] = useState(PLANTILLAS.aviso.cuerpo);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const inscritos = alumnos.filter(a => a.estado === 'inscrito');
  const actividades = [...new Map(inscritos.filter(a => a.actividadId).map(a => [a.actividadId, a.actividad || a.actividadId])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const grupos = [...new Map(inscritos.map(a => [claveGrupo(a), `${a.actividad || a.actividadId} · ${a.dias} · ${a.horario}`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const criterio = { alcance, ids, actividadId, grupo };
  const previo = prepararDestinatarios(alumnos, padres, criterio);
  const personas = inscritos.filter(a => `${a.nombre || ''} ${a.actividad || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .includes(busqueda.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  const enviar = async () => {
    if (enviando || !['extraescolares@sanbuenaventura.org', 'extraescolarespiscina@sanbuenaventura.org'].includes(auth.currentUser?.email?.toLowerCase())) return;
    if (!titulo.trim() || !cuerpo.trim()) return showToast('Escribe el asunto y el mensaje.', 'warning');
    if (titulo.length > 160 || cuerpo.length > 10000) return showToast('El asunto o el mensaje es demasiado largo.', 'warning');
    if (previo.alumnosElegidos === 0 || previo.destinatarios.length === 0) return showToast('Selecciona al menos una cuenta inscrita con correo.', 'warning');
    if (previo.sinCorreo.length) return showToast(`Hay ${previo.sinCorreo.length} inscripciones sin correo de cuenta válido. Revisa los datos antes del envío.`, 'error');
    setEnviando(true);
    setResultado(null);
    try {
      // Relee del servidor para evitar usar una lista de inscritos antigua u offline.
      const [fichas, cuentas] = await Promise.all([
        getDocsFromServer(collection(db, 'students')),
        getDocsFromServer(collection(db, 'users'))
      ]);
      const actuales = fichas.docs.map(d => ({ id: d.id, ...d.data() }));
      const usuarios = Object.fromEntries(cuentas.docs.map(d => [d.id, d.data()]));
      const verificado = prepararDestinatarios(actuales, usuarios, criterio);
      const correos = r => r.destinatarios.map(d => d.email).join('|');
      if (verificado.sinCorreo.length || verificado.alumnosElegidos !== previo.alumnosElegidos || correos(verificado) !== correos(previo)) {
        showToast('Las inscripciones o los correos han cambiado. Revisa los destinatarios y vuelve a intentarlo.', 'warning');
        return;
      }
      if (!window.confirm(`¿Solicitar el envío de «${titulo.trim()}» a ${verificado.destinatarios.length} cuentas distintas (${verificado.alumnosElegidos} inscripciones)?\n\nLos correos se enviarán por separado a las cuentas registradas.`)) return;
      const html = `<div style="font-family:sans-serif;line-height:1.6;max-width:650px;color:#243044;white-space:normal">${escaparHtml(cuerpo.trim()).replace(/\n/g, '<br>')}</div>`;
      const enviados = [];
      const fallidos = [];
      for (const destinatario of verificado.destinatarios) {
        try {
          await addDoc(collection(db, 'mail'), { to: [destinatario.email], message: { subject: titulo.trim(), html } });
          enviados.push(destinatario.email);
        } catch (error) {
          console.error('No se pudo solicitar un correo:', error);
          fallidos.push(destinatario.email);
        }
      }
      try {
        await addDoc(collection(db, 'logs'), {
          fecha: Date.now(), accion: 'COMUNICACION_ADMIN', adminEmail: userEmail,
          detalles: `Alcance: ${alcance}. Asunto: ${titulo.trim()}. Solicitudes: ${enviados.length}. Fallidos: ${fallidos.length}.`
        });
      } catch (error) { console.error('No se pudo registrar el envío:', error); }
      setResultado({ enviados, fallidos });
      showToast(fallidos.length ? `Se solicitaron ${enviados.length} correos; ${fallidos.length} fallaron. Revisa el resumen.` :
        `Se solicitaron ${enviados.length} correos. Comprueba la entrega en Firebase.`, fallidos.length ? 'warning' : 'success');
    } catch (error) {
      console.error('No se pudo comprobar la lista de correo:', error);
      showToast('No se pudo consultar el listado actualizado. No se ha solicitado ningún correo.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-7 text-left max-w-5xl mx-auto space-y-6">
    <div><h2 className="text-xl font-black text-blue-900">Comunicaciones por correo</h2>
      <p className="text-sm text-slate-600 mt-1">Solo participan inscripciones con estado inscrito. Cada cuenta recibe un correo, aunque tenga varios hijos.</p></div>
    <fieldset disabled={enviando} className="space-y-4">
      <legend className="font-bold mb-3">1. Destinatarios</legend>
      <div className="flex flex-wrap gap-3">
        {[["personas", "Personas concretas"], ["grupo", "Grupo por día y horario"], ["actividad", "Toda una actividad"], ["todos", "Todos los inscritos"]].map(([valor, texto]) =>
          <label key={valor} className="flex gap-2 items-center text-sm bg-slate-50 border rounded-lg px-3 py-2 cursor-pointer">
            <input type="radio" name="alcanceCorreo" checked={alcance === valor} onChange={() => { setAlcance(valor); setResultado(null); }} />{texto}
          </label>)}
      </div>
      {alcance === 'personas' && <div>
        <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar participante o actividad"
          className="w-full border rounded-lg p-3 mb-2" />
        <div className="border rounded-lg max-h-52 overflow-y-auto p-2 space-y-1">
          {personas.map(a => <label key={a.id} className="flex items-start gap-2 p-2 hover:bg-slate-50 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={ids.includes(a.id)} onChange={e => { setIds(e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id)); setResultado(null); }} />
            <span><strong>{a.nombre}</strong><span className="block text-xs text-slate-500">{a.actividad} · {a.dias} · {a.horario}</span></span>
          </label>)}
        </div>
      </div>}
      {alcance === 'actividad' && <select value={actividadId} onChange={e => { setActividadId(e.target.value); setResultado(null); }} className="w-full border rounded-lg p-3">
        <option value="">Elige actividad</option>{actividades.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
      </select>}
      {alcance === 'grupo' && <select value={grupo} onChange={e => { setGrupo(e.target.value); setResultado(null); }} className="w-full border rounded-lg p-3">
        <option value="">Elige grupo</option>{grupos.map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
      </select>}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
        <strong>Vista previa:</strong> {previo.alumnosElegidos} inscripciones, {previo.destinatarios.length} cuentas distintas.
        {previo.sinCorreo.length > 0 && <p className="text-red-700 mt-2">{previo.sinCorreo.length} inscripciones no tienen correo válido en su cuenta. Se bloquea el envío hasta revisarlas.</p>}
        {previo.destinatarios.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Ver destinatarios</summary>
          <ul className="mt-2 max-h-36 overflow-y-auto">{previo.destinatarios.map(d => <li key={d.email}>{d.email} ({d.alumnos.join(', ')})</li>)}</ul></details>}
      </div>
    </fieldset>
    <fieldset disabled={enviando} className="space-y-3">
      <legend className="font-bold">2. Mensaje</legend>
      <label className="block text-sm font-semibold">Modelo de mensaje
        <select value={plantilla} onChange={e => { const valor = e.target.value; setPlantilla(valor); setTitulo(PLANTILLAS[valor].titulo); setCuerpo(PLANTILLAS[valor].cuerpo); setResultado(null); }} className="block w-full border rounded-lg p-3 mt-1">
          <option value="aviso">Aviso general</option><option value="recordatorio">Recordatorio</option><option value="horario">Información de horarios</option><option value="libre">Mensaje en blanco</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">Asunto
        <input value={titulo} maxLength={160} onChange={e => { setTitulo(e.target.value); setResultado(null); }} className="block w-full border rounded-lg p-3 mt-1" />
      </label>
      <label className="block text-sm font-semibold">Contenido
        <textarea value={cuerpo} maxLength={10000} rows={10} onChange={e => { setCuerpo(e.target.value); setResultado(null); }} className="block w-full border rounded-lg p-3 mt-1" />
      </label>
    </fieldset>
    <button type="button" disabled={enviando || !!resultado || !previo.destinatarios.length || !!previo.sinCorreo.length || !titulo.trim() || !cuerpo.trim()}
      onClick={enviar} className="bg-blue-700 text-white font-bold rounded-lg px-5 py-3 disabled:opacity-50">
      {enviando ? 'Solicitando correos…' : `Revisar y enviar a ${previo.destinatarios.length} cuentas`}
    </button>
    {resultado && <div role="status" className="border rounded-lg p-4 text-sm bg-slate-50">
      <strong>Solicitados: {resultado.enviados.length}. Fallidos: {resultado.fallidos.length}.</strong>
      <p className="mt-1">La entrega final se comprueba en la colección mail de Firebase.</p>
      {resultado.fallidos.length > 0 && <p className="text-red-700 mt-2">Sin solicitud: {resultado.fallidos.join(', ')}. Evita repetir el envío completo porque duplicaría los correos ya solicitados.</p>}
    </div>}
  </section>;
}
