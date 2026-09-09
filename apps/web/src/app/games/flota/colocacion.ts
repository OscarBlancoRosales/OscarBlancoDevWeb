import { TAMANOS_FLOTA } from '@devweb/shared/games/flota/tipos';
import { cabe } from '@devweb/shared/games/flota/reglas';
import type { Barco, Orientacion } from '@devweb/shared/games/flota/tipos';

/**
 * La flota a medio poner.
 *
 * El servidor solo entiende flotas enteras, así que este estado intermedio
 * —tres barcos puestos y dos por poner— es cosa de la pantalla y de nadie más.
 * Vive aquí, en funciones puras, y no dentro del componente: así se prueba sin
 * montar Angular y el componente se queda con lo que sí es suyo.
 */
export interface Colocacion {
  readonly puestos: readonly Barco[];
  readonly orientacion: Orientacion;
}

export const COLOCACION_VACIA: Colocacion = { puestos: [], orientacion: 'horizontal' };

/** El tamaño del barco que toca colocar, o `null` si ya están los cinco. */
export function siguienteTamano(colocacion: Colocacion): number | null {
  return TAMANOS_FLOTA[colocacion.puestos.length] ?? null;
}

export function completa(colocacion: Colocacion): boolean {
  return colocacion.puestos.length === TAMANOS_FLOTA.length;
}

export function girar(colocacion: Colocacion): Colocacion {
  return {
    ...colocacion,
    orientacion: colocacion.orientacion === 'horizontal' ? 'vertical' : 'horizontal',
  };
}

/**
 * Pone el barco que toca con la proa en esa casilla.
 *
 * Si no cabe, devuelve la misma colocación: rechazar en silencio es mejor que
 * colocar el barco «casi ahí», que es lo que pasa cuando se recorta la posición
 * para que entre a la fuerza.
 */
export function poner(colocacion: Colocacion, fila: number, columna: number): Colocacion {
  const barco = candidato(colocacion, fila, columna);
  if (!barco || !cabe(barco, colocacion.puestos)) return colocacion;
  return { ...colocacion, puestos: [...colocacion.puestos, barco] };
}

export function quitarUltimo(colocacion: Colocacion): Colocacion {
  return { ...colocacion, puestos: colocacion.puestos.slice(0, -1) };
}

export function vaciar(colocacion: Colocacion): Colocacion {
  return { ...colocacion, puestos: [] };
}

function candidato(colocacion: Colocacion, fila: number, columna: number): Barco | null {
  const tamano = siguienteTamano(colocacion);
  if (tamano === null) return null;
  return { fila, columna, tamano, orientacion: colocacion.orientacion };
}
