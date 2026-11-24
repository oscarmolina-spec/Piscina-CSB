const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const MAPA_NIE = { X: '0', Y: '1', Z: '2' };

export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caracter]);
}

export function normalizarEmail(valor) {
  return String(valor || '').toLowerCase().trim();
}

export function normalizarIban(valor) {
  return String(valor || '').toUpperCase().replace(/[\s-]+/g, '');
}

export function validarIbanEspanol(valor) {
  const normalizado = normalizarIban(valor);
  if (!/^ES\d{22}$/.test(normalizado)) {
    return {
      valido: false,
      normalizado,
      error: 'IBAN inválido: debe empezar por ES y tener 22 dígitos después.'
    };
  }

  // ISO 7064 Mod-97-10: mover los 4 primeros caracteres al final y convertir letras (A=10..Z=35)
  const reordenado = `${normalizado.slice(4)}${normalizado.slice(0, 4)}`;
  const numerico = reordenado.replace(/[A-Z]/g, (letra) => String(letra.charCodeAt(0) - 55));

  let resto = 0;
  for (let i = 0; i < numerico.length; i += 1) {
    resto = (resto * 10 + Number(numerico[i])) % 97;
  }

  if (resto !== 1) {
    return {
      valido: false,
      normalizado,
      error: 'IBAN inválido: el dígito de control no coincide. Revisa los números de la cuenta.'
    };
  }

  return { valido: true, normalizado };
}

export function normalizarDniNie(valor) {
  return String(valor || '').toUpperCase().replace(/[\s-]+/g, '');
}

export function validarDniNie(valor) {
  const normalizado = normalizarDniNie(valor);
  const esDni = /^\d{8}[A-Z]$/.test(normalizado);
  const esNie = /^[XYZ]\d{7}[A-Z]$/.test(normalizado);

  if (!esDni && !esNie) {
    return {
      valido: false,
      normalizado,
      error: 'DNI/NIE inválido: usa 8 números y letra (DNI) o X/Y/Z + 7 números y letra (NIE).'
    };
  }

  const prefijo = esNie ? `${MAPA_NIE[normalizado[0]]}${normalizado.slice(1, 8)}` : normalizado.slice(0, 8);
  const letraEsperada = LETRAS_DNI[Number(prefijo) % 23];
  const letraRecibida = normalizado[8];

  if (letraRecibida !== letraEsperada) {
    return {
      valido: false,
      normalizado,
      error: 'DNI/NIE inválido: la letra de control no coincide.'
    };
  }

  return { valido: true, normalizado };
}

export function construirDocumentoMonitor({ uid, nombre, email, creadoPor, fechaAlta = new Date().toISOString() }) {
  const nombreLimpio = String(nombre || '').trim();
  const emailLimpio = normalizarEmail(email);
  if (!uid || !nombreLimpio || !emailLimpio) {
    throw new Error('DATOS_MONITOR_INCOMPLETOS');
  }
  return {
    uid: String(uid),
    nombre: nombreLimpio,
    email: emailLimpio,
    rol: 'monitor',
    gruposAsignados: [],
    fechaAlta,
    creadoPor: normalizarEmail(creadoPor)
  };
}
