import test from 'node:test';
import assert from 'node:assert/strict';
import { planificarBajaFamiliar } from '../src/bajaFamilia.js';
const alumno = { estado: 'inscrito', actividadId: 'chapoteo', actividad: 'Chapoteo', dias: 'Lunes', precio: '45€', fechaAlta: '2026-10-01T12:00:00Z', aforoSlotIds: ['plaza'] };
test('Octubre tramita baja pendiente sin borrar inscripción ni liberar plaza', () => {
 const result = planificarBajaFamiliar(alumno, new Date('2026-10-14T10:00:00Z'));
 assert.equal(result.estado, 'baja_pendiente');
 for (const key of ['actividad','precio','fechaAlta','aforoSlotIds','fechaBaja']) assert.equal(Object.hasOwn(result,key),false);
 assert.equal(result.historialInscripciones[0].fechaAlta,'2026-10-01');
 assert.equal(result.historialInscripciones[0].precio,'45€');
});
test('Inicio futuro en noviembre queda pendiente de revisión, sin cancelar gratis', () => {
 assert.equal(planificarBajaFamiliar({...alumno,fechaAlta:'2026-11-01'},new Date('2026-10-28T10:00:00Z')).estado,'baja_pendiente');
});
test('Diciembre y enero mantienen el curso real y aplican el corte del 25', () => {
 for(const fecha of ['2026-12-14','2027-01-14'])assert.equal(planificarBajaFamiliar(alumno,new Date(fecha+'T12:00:00Z')).estado,'baja_pendiente');
 assert.throws(()=>planificarBajaFamiliar(alumno,new Date('2026-10-26T12:00:00Z')),/PLAZO CERRADO/);
 assert.equal(planificarBajaFamiliar(alumno,new Date('2026-10-25T12:00:00Z')).estado,'baja_pendiente');
});
test('Retirar espera o prueba conserva un registro sin convertirla en inscripción', () => {
 for(const estado of ['lista_espera','prueba_reservada','requiere_prueba']){
 const result=planificarBajaFamiliar({...alumno,estado,historialInscripciones:[{accion:'ANTERIOR'}]},new Date('2026-10-14T12:00:00Z'));
 assert.equal(result.estado,'baja_finalizada');assert.equal(result.historialInscripciones.length,2);assert.equal(result.historialInscripciones[1].estadoAnterior,estado);
 }
});
test('No admite repetición ni borrado de perfiles sin inscripción', () => {
 for(const estado of ['sin_inscripcion','baja_pendiente','baja_finalizada']) assert.throws(()=>planificarBajaFamiliar({...alumno,estado}));
});
test('El corte usa el día de Madrid, también cerca de medianoche',()=>{
 assert.throws(()=>planificarBajaFamiliar(alumno,new Date('2026-10-25T23:30:00Z')),/PLAZO CERRADO/);
});
