import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { crearExcel } from '../src/formatosExportacion.js';
import { prepararExportacion } from '../src/exportacionMensual.js';
test('XLSX real conserva filas, notas, tildes, IBAN y texto sin ejecutar fórmulas',async()=>{
 const r=prepararExportacion([{id:'a',nombre:'=SUM(1,2)',estado:'inscrito',fechaAlta:'2026-10-01',precio:'45€',parentId:'p'},{id:'b',nombre:'Niña Muñoz',estado:'inscrito',fechaAlta:'2026-10-01',precio:'45€',parentId:'p'}],{p:{cp:'00123',iban:'ES000123',email:'test@example.com'}},[],'2026-11',false,[{alumnoId:'a',mes:'2026-11',texto:'Descontar un día',incluir:true}]);
 const buffer=await crearExcel(r);assert.equal(Buffer.from(buffer).subarray(0,2).toString(),'PK');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);const sheet=workbook.getWorksheet('Listado');
 assert.equal(sheet.rowCount,3);assert.equal(sheet.getCell('A2').value,'=SUM(1,2)');assert.equal(sheet.getCell('A2').type,ExcelJS.ValueType.String);
 assert.equal(sheet.getCell('A3').value,'Niña Muñoz');assert.equal(sheet.getCell('M2').value,'00123');assert.equal(sheet.getCell('P2').value,'ES000123');assert.equal(sheet.getCell('U2').value,45);assert.equal(sheet.getCell('W2').value,'Descontar un día');
 assert.deepEqual(sheet.getRow(1).values.slice(1),r.cabecera);
});
