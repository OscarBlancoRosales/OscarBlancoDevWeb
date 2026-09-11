/**
 * Los temas del Impostor y sus palabras.
 *
 * Cada entrada son dos palabras que se parecen: `a` es la que recibe la
 * tripulación y `b` la que recibe el infiltrado. El banco vive a la vista:
 * lo que hay que esconder no es la lista, es cuál salió.
 */

import { ANIMALES } from './animales';
import { CASA } from './casa';
import { CINE } from './cine';
import { COMIDA } from './comida';
import { DEPORTES } from './deportes';
import { ESPANA } from './espana';
import { FAMOSOS } from './famosos';
import { FUTBOL } from './futbol';
import { INFORMATICA } from './informatica';
import { LUGARES } from './lugares';
import { MUSICA } from './musica';
import { OFICINA } from './oficina';
import { WIKIPEDIA } from './wikipedia';
import type { Tema, Termino } from './tipos';

export type { Tema, Termino } from './tipos';

export const TEMAS: readonly Tema[] = [
  ANIMALES,
  COMIDA,
  CINE,
  OFICINA,
  INFORMATICA,
  DEPORTES,
  LUGARES,
  CASA,
  MUSICA,
  ESPANA,
  FUTBOL,
  FAMOSOS,
  WIKIPEDIA,
];

/** El identificador que significa «que salga de cualquier tema». */
export const TEMA_MEZCLA = 'mezcla';

export function temaPorId(id: string | null | undefined): Tema | null {
  if (!id || id.includes(',')) return null;
  return TEMAS.find((tema) => tema.id === id) ?? null;
}

/**
 * Cómo se llama el tema en pantalla.
 *
 * Varios mazos van juntos con comas (`futbol,famosos`) y se leen enteros.
 */
export function nombreDelTema(id: string): string {
  if (id === TEMA_MEZCLA) return 'Mezcla';
  if (id.includes(',')) {
    const nombres = id
      .split(',')
      .map((uno) => temaPorId(uno.trim())?.nombre)
      .filter((nombre): nombre is string => !!nombre);
    return nombres.length > 0 ? nombres.join(' + ') : 'Mezcla';
  }
  return temaPorId(id)?.nombre ?? 'Mezcla';
}

/** Todas las palabras de un tema, o del banco entero si es la mezcla. */
export function terminosDe(temaId: string): readonly Termino[] {
  if (temaId === TEMA_MEZCLA) return TEMAS.flatMap((tema) => tema.terminos);
  if (temaId.includes(',')) {
    return temaId.split(',').flatMap((id) => terminosDe(id.trim()));
  }
  return temaPorId(temaId)?.terminos ?? [];
}

/**
 * El término al que pertenece una palabra, buscando por los dos lados.
 *
 * Hace falta para el infiltrado: su palabra es la `b`, y sus pistas son las
 * de su pareja.
 */
export function terminoDeLaPalabra(temaId: string, palabra: string): Termino | null {
  return terminosDe(temaId).find((uno) => uno.a === palabra || uno.b === palabra) ?? null;
}
