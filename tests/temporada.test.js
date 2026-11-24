import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerAnioAcademico,
  esPeriodoReserva,
  obtenerInfoInicioInscripcion,
  calcularFechaAlta,
  construirIdSlotPruebaNivel,
  obtenerPermisoNotificaciones
} from '../src/temporada.js';

test('esPeriodoReserva solo se activa de junio a septiembre, no de enero a mayo', () => {
  assert.equal(esPeriodoReserva(new Date(2026, 0, 10)), false); // enero
  assert.equal(esPeriodoReserva(new Date(2026, 2, 15)), false); // marzo
  assert.equal(esPeriodoReserva(new Date(2026, 4, 20)), false); // mayo
  assert.equal(esPeriodoReserva(new Date(2026, 5, 1)), true);   // junio
  assert.equal(esPeriodoReserva(new Date(2026, 8, 30)), true);  // septiembre
  assert.equal(esPeriodoReserva(new Date(2026, 9, 1)), false);  // octubre
  assert.equal(esPeriodoReserva(new Date(2026, 11, 15)), false); // diciembre
});

test('enero a mayo muestran el mes siguiente real y permiten empezar hoy hasta el día 20', () => {
  const marzo10 = new Date(2026, 2, 10, 11, 0, 0);
  const info = obtenerInfoInicioInscripcion(marzo10);
  assert.equal(info.esPeriodoReserva, false);
  assert.equal(info.diaCortePasado, false);
  assert.equal(info.sigMes, 'abril');
  assert.equal(info.tecnicaProximoMes, '2026-04-01');
  assert.equal(info.patronMesPrevision, '2026-04');

  const altaInmediata = calcularFechaAlta('inmediato', marzo10);
  assert.equal(altaInmediata.fechaYMD, '2026-03-10');
  assert.equal(altaInmediata.mesInicio, 'marzo');

  const altaSiguiente = calcularFechaAlta('proximo', marzo10);
  assert.equal(altaSiguiente.fechaYMD, '2026-04-01');
  assert.equal(altaSiguiente.mesInicio, 'abril');

  // Tras el día 20 en diciembre, pasa a enero del año siguiente
  const dic22 = new Date(2026, 11, 22, 10, 0, 0);
  const infoDic = obtenerInfoInicioInscripcion(dic22);
  assert.equal(infoDic.diaCortePasado, true);
  assert.equal(infoDic.sigMes, 'enero');
  assert.equal(infoDic.tecnicaProximoMes, '2027-01-01');
  assert.equal(calcularFechaAlta('inmediato', dic22).fechaYMD, '2027-01-01');
});

test('junio a septiembre fuerzan inicio el 1 de octubre del curso correspondiente', () => {
  const julio5 = new Date(2026, 6, 5, 12, 0, 0);
  const info = obtenerInfoInicioInscripcion(julio5);
  assert.equal(info.esPeriodoReserva, true);
  assert.equal(info.diaCortePasado, true);
  assert.equal(info.sigMes, 'octubre');
  assert.equal(info.tecnicaProximoMes, '2026-10-01');
  assert.equal(info.patronMesPrevision, '2026-10');
  assert.equal(obtenerAnioAcademico(julio5).isoStartDate, '2026-10-01');

  const alta = calcularFechaAlta('inmediato', julio5);
  assert.equal(alta.fechaYMD, '2026-10-01');
  assert.equal(alta.mesInicio, 'octubre');
});

test('construirIdSlotPruebaNivel normaliza fecha y hora y rechaza formatos inválidos', () => {
  assert.equal(construirIdSlotPruebaNivel('2026-06-15', '17:05'), '2026-06-15__17-05');
  assert.equal(construirIdSlotPruebaNivel('2026-09-14', '9:00'), '2026-09-14__09-00');
  assert.throws(() => construirIdSlotPruebaNivel('15/06/2026', '17:05'), /FECHA_PRUEBA_INVALIDA/);
  assert.throws(() => construirIdSlotPruebaNivel('2026-06-15', '1705'), /HORA_PRUEBA_INVALIDA/);
});

test('obtenerPermisoNotificaciones no lanza error cuando Notification no existe (iOS Safari)', () => {
  assert.equal(obtenerPermisoNotificaciones(undefined), 'unsupported');
  assert.equal(obtenerPermisoNotificaciones(null), 'unsupported');
  assert.equal(obtenerPermisoNotificaciones({ permission: 'granted' }), 'granted');
  assert.equal(obtenerPermisoNotificaciones({ permission: 'default' }), 'default');
});
