import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escaparHtml,
  normalizarEmail,
  validarIbanEspanol,
  validarDniNie,
  construirDocumentoMonitor
} from '../src/seguridad.js';

test('escaparHtml neutraliza etiquetas y comillas para prevenir XSS', () => {
  const payload = `<img src=x onerror="alert('xss')"> & "texto"`;
  const escapado = escaparHtml(payload);
  assert.equal(
    escapado,
    '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &quot;texto&quot;'
  );
  assert.equal(escaparHtml(null), '');
  assert.equal(escaparHtml(undefined), '');
});

test('validarIbanEspanol acepta IBAN válidos con o sin espacios y rechaza dígitos erróneos', () => {
  const valido = validarIbanEspanol('es91 2100 0418 4502 0005 1332');
  assert.equal(valido.valido, true);
  assert.equal(valido.normalizado, 'ES9121000418450200051332');

  const otroValido = validarIbanEspanol('ES76-2077-0024-0031-0257-5766');
  assert.equal(otroValido.valido, true);
  assert.equal(otroValido.normalizado, 'ES7620770024003102575766');

  // Un solo dígito cambiado debe fallar Mod-97
  const digitoMal = validarIbanEspanol('ES9121000418450200051333');
  assert.equal(digitoMal.valido, false);
  assert.match(digitoMal.error, /dígito de control/i);

  const corto = validarIbanEspanol('ES912100');
  assert.equal(corto.valido, false);
});

test('validarDniNie valida DNI y NIE españoles con letra de control', () => {
  const dniValido = validarDniNie('12345678-z');
  assert.equal(dniValido.valido, true);
  assert.equal(dniValido.normalizado, '12345678Z');

  const nieValido = validarDniNie('x 1234567 l');
  assert.equal(nieValido.valido, true);
  assert.equal(nieValido.normalizado, 'X1234567L');

  const letraMal = validarDniNie('12345678A');
  assert.equal(letraMal.valido, false);
  assert.match(letraMal.error, /letra de control/i);

  const formatoMal = validarDniNie('ABC123');
  assert.equal(formatoMal.valido, false);
});

test('construirDocumentoMonitor nunca incluye el campo password y normaliza email', () => {
  const doc = construirDocumentoMonitor({
    uid: 'uid-123',
    nombre: '  Manuel García  ',
    email: '  Monitor@SanBuenaventura.org ',
    creadoPor: 'Extraescolares@SanBuenaventura.org',
    fechaAlta: '2026-10-01T10:00:00.000Z',
    password: 'secreto-no-debe-guardarse'
  });

  assert.equal(Object.hasOwn(doc, 'password'), false);
  assert.equal(doc.uid, 'uid-123');
  assert.equal(doc.nombre, 'Manuel García');
  assert.equal(doc.email, 'monitor@sanbuenaventura.org');
  assert.equal(doc.rol, 'monitor');
  assert.deepEqual(doc.gruposAsignados, []);
  assert.equal(normalizarEmail('  Test@CSB.org '), 'test@csb.org');
});
