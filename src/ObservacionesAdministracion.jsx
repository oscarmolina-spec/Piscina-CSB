import React, { useEffect, useState } from 'react';
import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase.js';

export default function ObservacionesAdministracion({ alumnoId }) {
  const [mes, setMes] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 7));
  const [texto, setTexto] = useState('');
  const [incluir, setIncluir] = useState(false);
  const [revision, setRevision] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sucio, setSucio] = useState(false);
  useEffect(() => {
    let activo = true;
    setCargando(true); setError(''); setMensaje(''); setTexto(''); setIncluir(false); setSucio(false);
    if (!alumnoId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { setError('Selecciona un mes válido.'); setCargando(false); return; }
    getDocFromServer(doc(db, 'observacionesAdministracion', `${alumnoId}__${mes}`)).then(snap => {
      if (!activo) return;
      const nota = snap.data() || {};
      setTexto(nota.texto || ''); setIncluir(nota.incluir === true); setRevision(nota.revision || 0);
    }).catch(() => { if (activo) setError('No se pudieron cargar las notas. Comprueba la conexión y las reglas de Firebase.'); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [alumnoId, mes]);
  async function guardar() {
    if (cargando || guardando || error) return;
    if (incluir && !texto.trim()) { setMensaje('Escribe la observación que quieres incluir.'); return; }
    setGuardando(true); setMensaje('');
    try {
      const ref = doc(db, 'observacionesAdministracion', `${alumnoId}__${mes}`);
      await runTransaction(db, async transaction => {
        const actual = await transaction.get(ref);
        if ((actual.data()?.revision || 0) !== revision) throw new Error('Otra persona ha cambiado esta nota. Cierra y vuelve a abrir la ficha para cargarla.');
        transaction.set(ref, { alumnoId, mes, texto: texto.trim(), incluir, revision: revision + 1, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
      });
      setTexto(texto.trim()); setRevision(revision + 1); setSucio(false); setMensaje('Observación guardada.');
    } catch (e) { setMensaje(e.code === 'permission-denied' ? 'No se pudo guardar: faltan las reglas actualizadas de Firebase.' : e.message || 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }
  return <section className="border rounded-xl bg-blue-50 p-4 space-y-3" aria-label="Observaciones para Administración">
    <h3 className="font-bold text-blue-950">Observaciones para Administración</h3>
    <p className="text-sm text-slate-600">Privadas para admin y superadmin. No modifican la cuota. Cada mes tiene su propia nota.</p>
    <label className="block text-sm font-bold">Mes
      <input type="month" value={mes} disabled={guardando} onChange={e => { if (!sucio || window.confirm('Hay cambios sin guardar. ¿Cambiar de mes y descartarlos?')) setMes(e.target.value); }} className="block border rounded p-2 mt-1 bg-white" />
    </label>
    {cargando ? <p role="status">Cargando observación…</p> : <>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <label className="block text-sm font-bold">Nota del mes
        <textarea value={texto} maxLength={2000} disabled={!!error || guardando} onChange={e => { setTexto(e.target.value); setSucio(true); setMensaje(''); }} rows={4} placeholder="Ej.: descontar una sesión por cierre de la piscina." className="block w-full border rounded p-2 mt-1 bg-white font-normal" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incluir} disabled={!!error || guardando} onChange={e => { setIncluir(e.target.checked); setSucio(true); setMensaje(''); }} />Incluir en el listado de cobros de este mes</label>
      <button type="button" onClick={guardar} disabled={!!error || guardando || !sucio} className="bg-blue-800 text-white rounded px-4 py-2 disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar observación'}</button>
      {sucio && <p className="text-sm text-amber-800">Cambios pendientes de guardar.</p>}
      <p role="status" className="text-sm">{mensaje}</p>
    </>}
  </section>;
}
