import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePrecioAMilicentimos,
  parsePrecioACentimos,
  extraerDiasSemana,
  contarDiasOperativos,
  calcularRentabilidadMensual
} from '../src/rentabilidad.js';
import { OFERTA_ACTIVIDADES } from '../src/catalogo.js';

test('parsePrecioAMilicentimos y parsePrecioACentimos normalizan formatos con euro y decimales', () => {
  assert.equal(parsePrecioAMilicentimos('45€'), 4500000);
  assert.equal(parsePrecioACentimos('65,00€'), 6500);
  assert.equal(parsePrecioAMilicentimos(14.5), 1450000);
  assert.equal(parsePrecioACentimos(''), 0);
});

test('extraerDiasSemana reconoce packs y días sueltos', () => {
  assert.deepEqual(extraerDiasSemana('[PACK 2 DÍAS] Lunes y Miércoles'), ['lunes', 'miercoles']);
  assert.deepEqual(extraerDiasSemana('L-V'), ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
});

test('contarDiasOperativos descuenta fines de semana y festivos', () => {
  const sinFestivos = contarDiasOperativos(9, 2026, []);
  const conFestivo = contarDiasOperativos(9, 2026, ['2026-10-12']);
  assert.equal(conFestivo.totalDiasOperativos, sinFestivos.totalDiasOperativos - 1);
  assert.equal(conFestivo.conteoPorDia.lunes, sinFestivos.conteoPorDia.lunes - 1);
});

test('calcularRentabilidadMensual concilia ingresos confirmados sin descuadres', () => {
  const alumnos = Array.from({ length: 6 }, (_, i) => ({
    id: `al-${i}`,
    nombre: `Alumno ${i}`,
    actividadId: 'chapoteo',
    actividad: OFERTA_ACTIVIDADES[0].nombre,
    dias: 'Lunes',
    horario: '16:00-17:00',
    precio: '45€',
    curso: 'INF4',
    estado: 'inscrito',
    validadoAdmin: true,
    fechaAlta: '2026-10-01'
  }));
  const res = calcularRentabilidadMensual({
    alumnos,
    mesIndex: 9,
    anio: 2026,
    catalog: OFERTA_ACTIVIDADES
  });
  assert.equal(res.alumnosConfirmadosCount, 6);
  assert.equal(res.ingresoConfirmadoTotalCentimos, 27000);
  assert.equal(res.conciliacionIngresosCorrecta, true);
  assert.equal(res.sesionesViablesCount, 1);
});
