/**
 * Identificadores únicos, sin depender de nadie.
 *
 * El v4 es azar puro. El v7 lleva la hora por delante, así que ordenar una
 * lista de v7 como texto es ordenarla por cuándo se crearon: por eso sirve de
 * clave primaria sin fragmentar el índice, y el v4 no.
 */

export type UuidVersion = 'v4' | 'v7';

export interface UuidFormat {
  uppercase?: boolean;
  noDashes?: boolean;
  /** Entre llaves, como los espera C#. */
  braces?: boolean;
}

/** Bytes al azar, del navegador si se puede. */
function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Coloca los guiones donde manda el estándar. */
function canonical(sinGuiones: string): string {
  return [
    sinGuiones.slice(0, 8),
    sinGuiones.slice(8, 12),
    sinGuiones.slice(12, 16),
    sinGuiones.slice(16, 20),
    sinGuiones.slice(20, 32),
  ].join('-');
}

/** `now` se puede fijar para poder probar el orden de los v7. */
export function makeUuid(version: UuidVersion = 'v4', now = Date.now()): string {
  const bytes = randomBytes(16);

  if (version === 'v7') {
    // Los seis primeros bytes son la hora en milisegundos, de mayor a menor.
    const ms = BigInt(Math.floor(now));
    for (let i = 0; i < 6; i++) {
      bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
    }
  }

  // Versión en el nibble alto del byte 6, y variante RFC en el byte 8.
  bytes[6] = (bytes[6] & 0x0f) | (version === 'v7' ? 0x70 : 0x40);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return canonical(hex(bytes));
}

export function formatUuid(uuid: string, opciones: UuidFormat): string {
  let salida = uuid;
  if (opciones.noDashes) salida = salida.replace(/-/g, '');
  if (opciones.uppercase) salida = salida.toUpperCase();
  if (opciones.braces) salida = `{${salida}}`;
  return salida;
}
