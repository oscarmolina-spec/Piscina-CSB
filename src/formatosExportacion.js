// Este módulo y sus dependencias se cargan solo al exportar.
export async function crearExcel(resultado) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Piscina CSB';
  const sheet = workbook.addWorksheet('Listado', { views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' } });
  sheet.addRow(resultado.cabecera);
  for (const row of resultado.datos) sheet.addRow(row.map(v => v ?? ''));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  sheet.getRow(1).height = 32;
  sheet.columns.forEach((column, index) => {
    column.width = [0,4,9,11,14,21,22].includes(index) ? 36 : 21;
    column.alignment = { vertical: 'top', wrapText: true };
  });
  [8,20].forEach(index => { sheet.getColumn(index + 1).numFmt = '0.00" €"'; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: resultado.cabecera.length } };
  const info = workbook.addWorksheet('Información');
  info.columns = [{ width: 100 }];
  info.addRows([[`Piscina CSB · ${resultado.completo ? 'Listado completo' : resultado.mes}`], ['Importes de referencia con la tarifa actual. No se aplican descuentos, devoluciones, atrasos ni prorrateos automáticamente.'], ['Revisar observaciones y avisos antes de tramitar cobros. Cada registro contratado se conserva.'], [`Registros: ${resultado.filas}. Para revisar: ${resultado.revisar}.`]]);
  info.eachRow(row => { row.alignment = { wrapText: true }; row.height = 35; });
  return workbook.xlsx.writeBuffer();
}

export async function crearPDF(resultado, fuenteBase64) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  if (!fuenteBase64) {
    const response = await fetch(new URL('./assets/DejaVuSans.ttf', import.meta.url));
    if (!response.ok) throw new Error('No se pudo cargar la fuente para imprimir.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    fuenteBase64 = btoa(binary);
  }
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addFileToVFS('DejaVuSans.ttf', fuenteBase64);
  pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  pdf.setFont('DejaVu');
  // Se distribuyen todas las columnas en tres bloques; nunca se comprime toda la tabla en una página.
  const bloques = [
    { titulo: 'Actividad y cuota', indices: [0,1,2,3,4,5,6,7,8] },
    { titulo: 'Responsable y datos de cobro', indices: [0,9,10,11,12,13,14,15,16] },
    { titulo: 'Estado, importe y observaciones', indices: [0,17,18,19,20,21,22] }
  ];
  const textoPDF = value => String(value ?? '').replace(/\p{Extended_Pictographic}|\uFE0F/gu, '');
  for (const [i, bloque] of bloques.entries()) {
    if (i) pdf.addPage();
    const columnStyles = {};
    bloque.indices.forEach((index, local) => { columnStyles[local] = { cellWidth: index === 0 ? 42 : index === 22 ? 70 : index === 21 ? 48 : 'auto' }; });
    autoTable(pdf, {
      head: [bloque.indices.map(index => resultado.cabecera[index])],
      body: resultado.datos.map((row, numero) => bloque.indices.map(index => textoPDF(index === 0 ? `${numero + 1}. ${row[index] ?? ''}` : row[index]))),
      startY: 31, margin: { top: 31, bottom: 13, left: 10, right: 10 },
      styles: { font: 'DejaVu', fontStyle: 'normal', fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { font: 'DejaVu', fontStyle: 'normal', fillColor: [30,58,95] },
      columnStyles, rowPageBreak: 'avoid', showHead: 'everyPage',
      didDrawPage: () => {
        pdf.setFont('DejaVu'); pdf.setFontSize(12);
        pdf.text(`Piscina CSB · ${resultado.completo ? 'Listado completo' : resultado.mes} · ${bloque.titulo}`, 10, 10);
        pdf.setFontSize(7.5);
        pdf.text('Importes de referencia. Revisar ajustes y observaciones antes de cobrar. Las notas no modifican la cuota.', 10, 17);
        pdf.text(`${resultado.filas} registros · ${resultado.revisar} para revisar · Mismo orden en todos los bloques`, 10, 23);
      }
    });
  }
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.text(`Página ${i} de ${total}`, 260, 203); }
  return pdf.output('arraybuffer');
}

export async function descargarListado(resultado, formato) {
  const esPDF = formato === 'pdf';
  const contenido = esPDF ? await crearPDF(resultado) : await crearExcel(resultado);
  const tipo = esPDF ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const nombre = resultado.completo ? 'listado_PAGOS_completo' : `borrador_PAGOS_${resultado.mes}`;
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const link = document.createElement('a'); link.href = url; link.download = `${nombre}.${esPDF ? 'pdf' : 'xlsx'}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
