import test from 'node:test';
import assert from 'node:assert/strict';
import { claveGrupo, prepararDestinatarios } from '../src/comunicaciones.js';

const alumnos = [
  { id: '1', nombre: 'Ana', parentId: 'p', estado: 'inscrito', actividadId: 'chapoteo', dias: 'Martes', horario: '16:00' },
  { id: '2', nombre: 'Luis', parentId: 'p', estado: 'inscrito', actividadId: 'natacion', dias: 'Jueves', horario: '17:30' },
  { id: '3', nombre: 'Eva', parentId: 'q', estado: 'lista_espera', actividadId: 'chapoteo', dias: 'Martes', horario: '16:00' },
  { id: '4', nombre: 'Juan', parentId: 'r', estado: 'baja_pendiente', actividadId: 'chapoteo', dias: 'Martes', horario: '16:00' },
  { id: '5', nombre: 'Sol', parentId: 's', estado: 'inscrito', actividadId: 'chapoteo', dias: 'Martes', horario: '16:00' }
];
const usuarios = { p: { email: ' Familia@ejemplo.es ' }, q: { email: 'espera@ejemplo.es' }, r: { email: 'baja@ejemplo.es' }, s: { email: '' } };

test('Envío general excluye espera y bajas, y deduplica hermanos por cuenta', () => {
  const resultado = prepararDestinatarios(alumnos, usuarios, { alcance: 'todos' });
  assert.equal(resultado.alumnosElegidos, 3);
  assert.deepEqual(resultado.destinatarios, [{ email: 'familia@ejemplo.es', alumnos: ['Ana', 'Luis'] }]);
  assert.deepEqual(resultado.sinCorreo, ['Sol']);
});

test('El grupo es actividad, día y horario exactos', () => {
  const resultado = prepararDestinatarios(alumnos, usuarios, { alcance: 'grupo', grupo: claveGrupo(alumnos[0]) });
  assert.equal(resultado.alumnosElegidos, 2);
  assert.deepEqual(resultado.destinatarios.map(d => d.email), ['familia@ejemplo.es']);
});

test('Permite seleccionar personas o una actividad completa sin incluir esperas', () => {
  assert.equal(prepararDestinatarios(alumnos, usuarios, { alcance: 'personas', ids: ['2', '3'] }).alumnosElegidos, 1);
  assert.equal(prepararDestinatarios(alumnos, usuarios, { alcance: 'actividad', actividadId: 'chapoteo' }).alumnosElegidos, 2);
});
