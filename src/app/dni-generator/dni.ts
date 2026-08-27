/**
 * Documentos españoles de mentira, pero bien formados.
 *
 * La letra sale del número por módulo 23 contra una tabla fija. En el NIE la
 * letra inicial cuenta como un dígito más: X vale 0, Y vale 1 y Z vale 2.
 */

export type DocKind = 'dni' | 'nie';

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const PREFIJOS: Record<string, string> = { X: '0', Y: '1', Z: '2' };

/** Recibe el número (con prefijo de NIE si lo lleva) y devuelve su letra. */
export function controlLetter(numero: string): string {
  const limpio = numero.trim().toUpperCase();
  const inicial = PREFIJOS[limpio[0]];
  const digitos = inicial !== undefined ? inicial + limpio.slice(1) : limpio;
  return LETRAS[Number(digitos) % 23];
}

export function makeDocument(kind: DocKind = 'dni'): string {
  if (kind === 'nie') {
    const inicial = 'XYZ'[Math.floor(Math.random() * 3)];
    const numero = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
    return `${inicial}${numero}${controlLetter(inicial + numero)}`;
  }
  const numero = String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0');
  return `${numero}${controlLetter(numero)}`;
}

/** Sirve tanto para DNI como para NIE. */
export function isValidDocument(documento: string): boolean {
  const limpio = documento.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^(\d{8}|[XYZ]\d{7})[A-Z]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  return limpio.slice(-1) === controlLetter(cuerpo);
}
