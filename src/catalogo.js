// ==========================================
// ⚙️ CONFIGURACIÓN GENERAL Y CATÁLOGO OFICIAL CSB
// ==========================================

export const ADMIN_EMAIL = 'extraescolares@sanbuenaventura.org';

// Configuración de aforo para pruebas de nivel (alumnos por hueco de 5 min)
export const CAPACIDAD_POR_HUECO = 2;

// ==========================================
// 🖼️ BANCO DE IMÁGENES (ALOJADAS EN /public/images)
// ==========================================
export const IMG_ESCUDO_BLANCO = '/images/escudo-blanco.png';
export const IMG_ESCUDO_COLOR = '/images/escudo-color.png';
export const IMG_ESCUDO = IMG_ESCUDO_COLOR;
export const IMG_PRINCIPAL = '/images/piscina-principal.jpg';
export const MAPA_IMAGEN_URL = '/images/info-piscina.png';

export const GALERIA = [
  { url: 'https://i.ibb.co/mrJHGscm/Screenshot-2025-05-09-15-04-17.png', fallback: IMG_PRINCIPAL, nombre: 'Vaso/Cristalera', zona: 'Vista General' },
  { url: '/images/galeria-zona-aguas.jpg', nombre: 'Zona de Aguas', zona: 'Vaso' },
  { url: '/images/galeria-duchas.jpg', nombre: 'Duchas interiores', zona: 'Instalaciones' },
  { url: '/images/galeria-vestuario-femenino.jpg', nombre: 'Vestuario Femenino', zona: 'Equipado' },
  { url: '/images/galeria-vestuario-masculino.jpg', nombre: 'Vestuario Masculino', zona: 'Equipado' },
  { url: '/images/galeria-entrada.jpg', nombre: 'Entrada/Hall', zona: 'Entrada Principal' }
];

// ==========================================
// 📚 LISTADO MAESTRO DE CURSOS ESCOLARES
// ==========================================
export const LISTA_CURSOS = [
  { val: 'INF3', label: 'Infantil 3 Años' },
  { val: 'INF4', label: 'Infantil 4 Años' },
  { val: 'INF5', label: 'Infantil 5 Años' },
  { val: '1PRI', label: '1º Primaria' },
  { val: '2PRI', label: '2º Primaria' },
  { val: '3PRI', label: '3º Primaria' },
  { val: '4PRI', label: '4º Primaria' },
  { val: '5PRI', label: '5º Primaria' },
  { val: '6PRI', label: '6º Primaria' },
  { val: '1ESO', label: '1º ESO' },
  { val: '2ESO', label: '2º ESO' },
  { val: '3ESO', label: '3º ESO' },
  { val: '4ESO', label: '4º ESO' },
  { val: '1BACH', label: '1º Bachillerato' },
  { val: '2BACH', label: '2º Bachillerato' },
  { val: 'ADULTO', label: 'Adulto / +16 Años' }
];

// ==========================================
// 🏊 CATÁLOGO OFICIAL DE ACTIVIDADES
// ==========================================
export const OFERTA_ACTIVIDADES = [
  {
    id: 'chapoteo',
    nombre: '🚼 Chapoteo "Infantil" (16:00-17:00)',
    cursos: ['INF3', 'INF4', 'INF5'],
    requierePrueba: false,
    diasResumen: 'L-V',
    precioResumen: '45€',
    alumnosMax: 16,
    minAlumnos: 5,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Iniciación y familiarización con el medio acuático. El monitor está dentro del agua para mayor seguridad y confianza.\n\n⬇️ HORARIOS ⬇️\n• 1 día/sem (45€): Lunes a Viernes (16:00-17:00).',
    aviso: 'Plazas limitadas por estricto orden de inscripción.',
    opciones: [
      { dias: 'Lunes', horario: '16:00-17:00', precio: '45€' },
      { dias: 'Martes', horario: '16:00-17:00', precio: '45€' },
      { dias: 'Miércoles', horario: '16:00-17:00', precio: '45€' },
      { dias: 'Jueves', horario: '16:00-17:00', precio: '45€' },
      { dias: 'Viernes', horario: '16:00-17:00', precio: '45€' }
    ]
  },
  {
    id: 'primaria_1615',
    nombre: '🏅 Natación Primaria (16:15-17:15)',
    cursos: ['1PRI', '2PRI', '3PRI', '4PRI', '5PRI', '6PRI'],
    requierePrueba: true,
    diasResumen: 'L-V',
    precioResumen: '45€ / 65€',
    alumnosMax: 12,
    minAlumnos: 6,
    requiereMonitor: true,
    callesNecesarias: 1,
    segmentosFisicos: [
      {
        id: 'primaria_1615_1a3',
        nombre: 'Primaria 16:15 — 1.º a 3.º',
        cursos: ['1PRI', '2PRI', '3PRI'],
        minAlumnos: 6,
        alumnosMax: 12,
        callesNecesarias: 1,
        requiereMonitor: true
      },
      {
        id: 'primaria_1615_4a6',
        nombre: 'Primaria 16:15 — 4.º a 6.º',
        cursos: ['4PRI', '5PRI', '6PRI'],
        minAlumnos: 6,
        alumnosMax: 12,
        callesNecesarias: 1,
        requiereMonitor: true
      }
    ],
    descripcion: 'Desarrollo de estilos y técnica. Se divide en subgrupos por nivel. Ideal para perfeccionar la natación.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (65€): L/X o M/J.\n⭐ DÍA SUELTO (45€): L, M, X, J o V.',
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '16:15-17:15', precio: '65€' },
      { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '16:15-17:15', precio: '65€' },
      { dias: '[1 DÍA] Lunes', horario: '16:15-17:15', precio: '45€' },
      { dias: '[1 DÍA] Martes', horario: '16:15-17:15', precio: '45€' },
      { dias: '[1 DÍA] Miércoles', horario: '16:15-17:15', precio: '45€' },
      { dias: '[1 DÍA] Jueves', horario: '16:15-17:15', precio: '45€' },
      { dias: '[1 DÍA] Viernes', horario: '16:15-17:15', precio: '45€' }
    ]
  },
  {
    id: 'primaria_123_tarde',
    nombre: '🐟 Natación 1º-3º Prim (17:30-18:00)',
    cursos: ['1PRI', '2PRI', '3PRI'],
    requierePrueba: true,
    diasResumen: 'L-V',
    precioResumen: '37€ / 50€',
    alumnosMax: 8,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Sesiones breves, dinámicas y muy seguras para avanzar en autonomía acuática. Grupos reducidos.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Cualquier día.',
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '17:30-18:00', precio: '50€' },
      { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '17:30-18:00', precio: '50€' },
      { dias: '[1 DÍA] Lunes', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Martes', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Miércoles', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Jueves', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Viernes', horario: '17:30-18:00', precio: '37€' }
    ]
  },
  {
    id: 'primaria_456_tarde',
    nombre: '🏊 Natación 4º-6º Prim (17:30-18:00)',
    cursos: ['4PRI', '5PRI', '6PRI'],
    requierePrueba: true,
    diasResumen: 'L-V',
    precioResumen: '37€ / 50€',
    alumnosMax: 8,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Para quienes quieren seguir mejorando técnica y condición física. Ideal como complemento a otras actividades deportivas.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€).\n⭐ DÍA SUELTO (37€).',
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes (30m) y Miércoles (30m)', horario: '17:30-18:00', precio: '50€' },
      { dias: '[PACK 2 DÍAS] Martes (30m) y Jueves (30m)', horario: '17:30-18:00', precio: '50€' },
      { dias: '[1 DÍA] Lunes', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Martes', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Miércoles', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Jueves', horario: '17:30-18:00', precio: '37€' },
      { dias: '[1 DÍA] Viernes', horario: '17:30-18:00', precio: '37€' }
    ]
  },
  {
    id: 'waterpolo',
    nombre: '🤽‍♂️ Waterpolo 3º-6º Prim (17:30-18:30)',
    cursos: ['3PRI', '4PRI', '5PRI', '6PRI'],
    requierePrueba: false,
    diasResumen: 'L-V',
    precioResumen: '45€ / 60€',
    alumnosMax: 12,
    minAlumnos: 7,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Iniciación al waterpolo. Deporte de equipo, balón y natación. Fomenta el compañerismo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (60€): L/X o M/J.\n⭐ DÍA SUELTO (45€): L, M, X, J o V.',
    aviso: 'Deporte de equipo con plazas limitadas por grupo.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '17:30-18:30', precio: '60€' },
      { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '17:30-18:30', precio: '60€' },
      { dias: '[1 DÍA] Lunes', horario: '17:30-18:30', precio: '45€' },
      { dias: '[1 DÍA] Martes', horario: '17:30-18:30', precio: '45€' },
      { dias: '[1 DÍA] Miércoles', horario: '17:30-18:30', precio: '45€' },
      { dias: '[1 DÍA] Jueves', horario: '17:30-18:30', precio: '45€' },
      { dias: '[1 DÍA] Viernes', horario: '17:30-18:30', precio: '45€' }
    ]
  },
  {
    id: 'aquagym',
    nombre: '💧 Aquagym "+16 años" (17:30-18:15)',
    cursos: ['ADULTO', '1BACH', '2BACH'],
    requierePrueba: false,
    diasResumen: 'L-J',
    precioResumen: '37€ / 50€',
    alumnosMax: 12,
    minAlumnos: 5,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Actividad de bajo impacto ideal para mantenerse en forma sin sobrecargar articulaciones. Mejora la movilidad y el tono muscular.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Lunes, Martes, Miércoles o Jueves.',
    aviso: 'Actividad recomendada para todos los niveles físicos.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '17:30-18:15', precio: '50€' },
      { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '17:30-18:15', precio: '50€' },
      { dias: '[1 DÍA] Lunes', horario: '17:30-18:15', precio: '37€' },
      { dias: '[1 DÍA] Martes', horario: '17:30-18:15', precio: '37€' },
      { dias: '[1 DÍA] Miércoles', horario: '17:30-18:15', precio: '37€' },
      { dias: '[1 DÍA] Jueves', horario: '17:30-18:15', precio: '37€' }
    ]
  },
  {
    id: 'adultos',
    nombre: '👨‍👩‍👧 Adultos (L-X-V 18:00-18:30) (M-J 18:30-19:00)',
    cursos: ['ADULTO'],
    requierePrueba: false,
    diasResumen: 'L-V',
    precioResumen: '37€ / 50€',
    alumnosMax: 10,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Clases para adultos que quieran mantenerse activos o mejorar su estilo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): L/X o M/J.\n⭐ DÍA SUELTO (37€): Cualquier día.\n(Horarios variables según el día).',
    aviso: 'Plazas asignadas por estricto orden de inscripción.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:00-18:30', precio: '50€' },
      { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '18:30-19:00', precio: '50€' },
      { dias: '[1 DÍA] Lunes', horario: '18:00-18:30', precio: '37€' },
      { dias: '[1 DÍA] Martes', horario: '18:30-19:00', precio: '37€' },
      { dias: '[1 DÍA] Miércoles', horario: '18:00-18:30', precio: '37€' },
      { dias: '[1 DÍA] Jueves', horario: '18:30-19:00', precio: '37€' },
      { dias: '[1 DÍA] Viernes', horario: '18:00-18:30', precio: '37€' }
    ]
  },
  {
    id: 'eso_bach',
    nombre: '🎓 ESO/Bach (L-X 18:30-19:00) (V 14:15-15:00)',
    cursos: ['1ESO', '2ESO', '3ESO', '4ESO', '1BACH', '2BACH'],
    requierePrueba: true,
    diasResumen: 'L/X o V',
    precioResumen: '37€ / 50€',
    alumnosMax: 10,
    minAlumnos: 4,
    requiereMonitor: true,
    callesNecesarias: 1,
    descripcion: 'Sesiones específicas para adolescentes, con técnica, mantenimiento o preparación física.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (50€): Tardes.\n⭐ DÍA SUELTO (37€): Tarde o Mediodía.',
    aviso: 'Plazas limitadas por nivel y estricto orden de inscripción.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:30-19:00', precio: '50€' },
      { dias: '[1 DÍA] Lunes', horario: '18:30-19:00', precio: '37€' },
      { dias: '[1 DÍA] Miércoles', horario: '18:30-19:00', precio: '37€' },
      { dias: '[1 DÍA] Viernes', horario: '14:15-15:00', precio: '37€' }
    ]
  },
  {
    id: 'nado_libre',
    nombre: '🏊‍♂️ Nado Libre ">16 años" (18:30-19:00)',
    cursos: ['ADULTO', '1BACH', '2BACH'],
    requierePrueba: false,
    diasResumen: 'L-V',
    precioResumen: '25€ / 35€',
    alumnosMax: 10,
    minAlumnos: 2,
    requiereMonitor: false,
    callesNecesarias: 1,
    descripcion: 'Uso de calle para entrenamiento personal sin monitor. Ideal para quienes buscan nadar a su propio ritmo.\n\n⬇️ ELIGE TU OPCIÓN ⬇️\n⭐ PACK 2 DÍAS (35€): L/X o M/J.\n⭐ DÍA SUELTO (25€): Cualquier día de la semana.',
    aviso: 'Uso exclusivo de calle para nado continuo sin monitor.',
    opciones: [
      { dias: '[PACK 2 DÍAS] Lunes y Miércoles', horario: '18:30-19:00', precio: '35€' },
      { dias: '[PACK 2 DÍAS] Martes y Jueves', horario: '18:30-19:00', precio: '35€' },
      { dias: '[1 DÍA] Lunes', horario: '18:30-19:00', precio: '25€' },
      { dias: '[1 DÍA] Martes', horario: '18:30-19:00', precio: '25€' },
      { dias: '[1 DÍA] Miércoles', horario: '18:30-19:00', precio: '25€' },
      { dias: '[1 DÍA] Jueves', horario: '18:30-19:00', precio: '25€' },
      { dias: '[1 DÍA] Viernes', horario: '18:30-19:00', precio: '25€' }
    ]
  }
];
