import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararExportacion, fechaExportacion } from '../src/exportacionMensual.js';
const base={nombre:'Niña Muñoz',estado:'inscrito',actividad:'Chapoteo',actividadId:'chapoteo',dias:'Lunes',horario:'16:00-17:00',fechaAlta:'2026-10-01T12:00:00Z',precio:'45€',parentId:'p'};
const exportar=(alumnos,mes='2026-10',completo=false)=>prepararExportacion(alumnos,{p:{email:'padre@example.com',iban:'ES000123'}},[],mes,completo);
test('Octubre excluye noviembre y noviembre lo incluye',()=>{const a={...base,fechaAlta:'2026-11-01'};assert.equal(exportar([base,a]).filas,1);assert.equal(exportar([base,a],'2026-11').filas,2);});
test('Conserva dos filas del mismo participante que asiste dos días',()=>{const r=exportar([base,{...base,dias:'Viernes'}]);assert.equal(r.filas,2);assert(r.csv.includes('Viernes'));});
test('No usa la fecha de inscripción como inicio y deja importe vacío sin fechaAlta',()=>{const r=exportar([{...base,fechaAlta:null,fechaInscripcion:'2026-10-01'}]);assert.equal(r.filas,1);assert.equal(r.revisar,1);assert(r.csv.includes('"2026-10","","Falta fecha de inicio'));});
test('Fecha de baja es exclusiva: el 1 de noviembre cierra octubre',()=>{const a={...base,estado:'baja_finalizada',fechaBaja:'2026-11-01'};assert.equal(exportar([a]).filas,1);assert.equal(exportar([a],'2026-11').filas,0);});
test('Espera, pruebas y retiradas no entran en el borrador mensual',()=>{const casos=['lista_espera','prueba_reservada','requiere_prueba'].map(estado=>({...base,estado}));casos.push({...base,estado:'baja_finalizada',motivoBaja:'Retirada de solicitud sin inscripción confirmada',fechaBaja:'2026-10-14'});assert.equal(exportar(casos).filas,0);});
test('Lista completa incluye altas futuras y estado sin calcular remesa',()=>{const r=exportar([{...base,fechaAlta:'2026-11-01'}],'2026-10',true);assert.equal(r.filas,1);assert(r.csv.includes('"inscrito","","","",""'));});
test('CSV conserva tildes, ñ, comas, comillas, códigos y evita fórmulas',()=>{const r=exportar([{...base,nombre:'=HYPERLINK("x")',actividad:'Natación, "Infantil"'}]);assert(r.csv.startsWith('\uFEFF'));assert(r.csv.includes("'=HYPERLINK"));assert(r.csv.includes('Natación, ""Infantil""'));assert(r.csv.includes('ES000123'));});
test('Admite cuotas decimales y cero explícito; no inventa cuotas a partir de rangos',()=>{assert(exportar([{...base,precio:'37,50€'}]).csv.includes('"37.5"'));assert(exportar([{...base,precio:0}]).csv.includes('"0"'));assert.equal(exportar([{...base,precio:'45 / 65€'}]).revisar,1);});
test('Valida fechas y año al pasar de diciembre a enero',()=>{assert.equal(fechaExportacion('2026-02-30'),'');assert.equal(exportar([{...base,fechaAlta:'2027-01-01'}],'2026-12').filas,0);assert.equal(exportar([{...base,fechaAlta:'2027-01-01'}],'2027-01').filas,1);assert.throws(()=>exportar([base],'2026-13'));});
test('Notas solo del alumno, mes y casilla marcada; nunca cambian la cuota',()=>{
 const notas=[{alumnoId:'a',mes:'2026-11',texto:'Descontar una sesión',incluir:true},{alumnoId:'a',mes:'2026-10',texto:'Solo octubre',incluir:true},{alumnoId:'a',mes:'2026-11',texto:'Borrador privado',incluir:false},{alumnoId:'b',mes:'2026-11',texto:'Otro alumno',incluir:true}];
 const r=prepararExportacion([{...base,id:'a'}],{},[],'2026-11',false,notas);
 assert.equal(r.datos[0][22],'Descontar una sesión');assert.equal(r.datos[0][20],45);assert.equal(r.revisar,1);assert.equal(r.cabecera.length,r.datos[0].length);
 const diciembre=prepararExportacion([{...base,id:'a'}],{},[],'2026-12',false,notas);assert.equal(diciembre.datos[0][22],'');
});
test('Una baja anterior con ajuste marcado se incluye para revisión, sin cuota inventada',()=>{
 const a={...base,id:'a',estado:'baja_finalizada',fechaBaja:'2026-11-01'};
 const r=prepararExportacion([a],{},[],'2026-11',false,[{alumnoId:'a',mes:'2026-11',texto:'Devolver una sesión de octubre',incluir:true}]);
 assert.equal(r.filas,1);assert.equal(r.datos[0][20],'');assert.equal(r.revisar,1);assert(r.datos[0][21].includes('Fuera del periodo'));
 assert.equal(prepararExportacion([{...a,estado:'lista_espera'}],{},[],'2026-11',false,[{alumnoId:'a',mes:'2026-11',texto:'Prueba',incluir:true}]).filas,0);
});
