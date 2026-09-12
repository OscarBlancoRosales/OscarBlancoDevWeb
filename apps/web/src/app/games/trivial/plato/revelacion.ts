/**
 * Cómo se destapa una respuesta, y cómo se cantan las apuestas.
 *
 * En un concurso de verdad nadie enseña la solución a la vez que la pregunta:
 * hay un compás de silencio, se enciende la buena, se apagan las demás y solo
 * entonces se explica. Ese medio segundo de espera es lo que convierte un
 * marcador que cambia en un momento.
 *
 * Todo esto son números y una función: aquí no hay ni Angular ni relojes. El
 * componente pone el `setTimeout`; este módulo solo dice qué toca en cada
 * instante, y por eso se prueba sin navegador.
 */

/** En qué punto del destape va la ronda cerrada. */
export type Paso = 'silencio' | 'enciende' | 'apaga' | 'listo';

interface Tramo {
  readonly paso: Paso;
  readonly enMs: number;
}

/**
 * El guion del destape, en milisegundos desde que la ronda se cierra.
 *
 * Los tiempos están medidos para que se lea: menos de trescientos y el ojo no
 * llega a ver que ha pasado algo; más de dos segundos y en la ronda quince ya
 * estás deseando que acabe.
 */
export const REVELACION: readonly Tramo[] = [
  { paso: 'silencio', enMs: 0 },
  { paso: 'enciende', enMs: 460 },
  { paso: 'apaga', enMs: 980 },
  { paso: 'listo', enMs: 1_500 },
];

/** Lo que tarda el destape entero. */
export const LO_QUE_DURA = REVELACION[REVELACION.length - 1].enMs;

/** A los cuántos milisegundos del cierre empieza este paso. */
export function cuandoEmpieza(paso: Paso): number {
  return REVELACION.find((tramo) => tramo.paso === paso)?.enMs ?? 0;
}

/** En qué paso va el destape a los `ms` de cerrarse la ronda. */
export function pasoEn(ms: number): Paso {
  let paso: Paso = 'silencio';
  for (const tramo of REVELACION) {
    if (ms >= tramo.enMs) paso = tramo.paso;
  }
  return paso;
}

/** Si ya se puede señalar cuál era la buena. */
export function seEnciende(paso: Paso): boolean {
  return paso !== 'silencio';
}

/** Si ya se apagan las que no eran, y reaccionan los atriles. */
export function seApagan(paso: Paso): boolean {
  return paso === 'apaga' || paso === 'listo';
}

/**
 * Si ya toca explicar y ofrecer la siguiente ronda.
 *
 * Va al final a propósito: el botón de seguir apareciendo antes de que se vea
 * la respuesta es la forma más rápida de que nadie se entere de nada.
 */
export function seExplica(paso: Paso): boolean {
  return paso === 'listo';
}

/**
 * Lo que se espera entre una apuesta y la siguiente al cantarlas.
 *
 * Que se destapen a la vez es un número; que se destapen de una en una es un
 * programa. Es el único sitio donde el plató se permite alargar algo, y solo
 * pasa una vez, en la final.
 */
export const CADA_APUESTA = 650;

/**
 * En qué turno se canta la apuesta de quien va en la posición `indice`.
 *
 * De último a primero, que es el orden que tiene intriga: cuando le llega el
 * turno al que va ganando, ya se sabe cuánto tiene que jugarse para no perder.
 */
export function turnoDeCantar(indice: number, cuantos: number): number {
  return cuantos - 1 - indice;
}
