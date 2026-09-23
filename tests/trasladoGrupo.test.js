import test from 'node:test';
import assert from 'node:assert/strict';
import { planificarTraslado, comprobarAforoTraslado } from '../src/trasladoGrupo.js';

const actividad = {
  id: 'chapoteo', cursos: ['INF3'],
  opciones: [
    { dias: 'Lunes', horario: '16:00-17:00', precio: '45€' },
    { dias: 'Martes', horario: '16:00-17:00', precio: '45€' }
  ]
};
const alumno = {
  estado: 'inscrito', actividadId: 'chapoteo', curso: 'INF3',
  dias: 'Lunes', horario: '16:00-17:00', precio: '45€', aforoSlotIds: ['lunes']
};
const slot = id => ({ id });

test('Chapoteo cambia el día, liberando origen y ocupando destino', () => {
  assert.deepEqual(planificarTraslado(alumno, actividad, actividad.opciones[1], [slot('lunes')], [slot('martes')]), {
    liberar: ['lunes'], reservar: ['martes'], mantener: [], destino: ['martes']
  });
});

test('Un pack conserva el día compartido y solo mueve el otro', () => {
  const pack = { id: 'natacion', cursos: ['1PRI'], opciones: [{ dias: 'Lunes y Miércoles', horario: '16:15', precio: '65€' }] };
  const inscrito = { estado: 'inscrito', actividadId: 'natacion', curso: '1PRI', aforoSlotIds: ['lunes', 'martes'] };
  assert.deepEqual(planificarTraslado(inscrito, pack, pack.opciones[0], [slot('lunes'), slot('martes')], [slot('lunes'), slot('miercoles')]), {
    liberar: ['martes'], reservar: ['miercoles'], mantener: ['lunes'], destino: ['lunes', 'miercoles']
  });
});

test('Rechaza origen desajustado, actividad ajena y baja pendiente', () => {
  assert.throws(() => planificarTraslado({ ...alumno, aforoSlotIds: ['otro'] }, actividad, actividad.opciones[1], [slot('lunes')], [slot('martes')]), /AFORO_ORIGEN_INCONSISTENTE/);
  assert.throws(() => planificarTraslado({ ...alumno, actividadId: 'otra' }, actividad, actividad.opciones[1], [slot('lunes')], [slot('martes')]), /TRASLADO_NO_PERMITIDO/);
  assert.throws(() => planificarTraslado({ ...alumno, estado: 'baja_pendiente' }, actividad, actividad.opciones[1], [slot('lunes')], [slot('martes')]), /TRASLADO_NO_PERMITIDO/);
});

test('Chapoteo no cambia precio ni horario', () => {
  const alterada = { dias: 'Martes', horario: '17:00-18:00', precio: '45€' };
  const act = { ...actividad, opciones: [...actividad.opciones, alterada] };
  assert.throws(() => planificarTraslado(alumno, act, alterada, [slot('lunes')], [slot('martes')]), /CHAPOTEO_SOLO_DIA/);
});

test('Rechaza destinos completos y plazas de origen inconsistentes', () => {
  const plan = { liberar: ['lunes'], reservar: ['martes'] };
  assert.throws(() => comprobarAforoTraslado(plan, new Map([
    ['lunes', { ocupados: 1, maximo: 8 }], ['martes', { ocupados: 8, maximo: 8 }]
  ])), /GRUPO_COMPLETO/);
  assert.throws(() => comprobarAforoTraslado(plan, new Map([
    ['lunes', { ocupados: 0, maximo: 8 }], ['martes', { ocupados: 2, maximo: 8 }]
  ])), /AFORO_ORIGEN_INCONSISTENTE/);
  assert.doesNotThrow(() => comprobarAforoTraslado(plan, new Map([
    ['lunes', { ocupados: 1, maximo: 8 }], ['martes', { ocupados: 2, maximo: 8 }]
  ])));
});
