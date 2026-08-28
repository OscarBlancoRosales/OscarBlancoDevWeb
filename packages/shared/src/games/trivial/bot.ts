import type { NivelBot, Pregunta } from './tipos';
import type { Rng } from '../../engine/rng';

/**
 * Cada cuánto acierta cada nivel, de cero a uno.
 *
 * El sabelotodo no llega al 1 a propósito: un rival que nunca falla no es un
 * rival, es un muro, y contra un muro no se juega otra partida.
 */
export const ACIERTOS_POR_NIVEL: Readonly<Record<NivelBot, number>> = {
  pardillo: 0.3,
  apanado: 0.65,
  sabelotodo: 0.9,
};

/** Cuánto se desvía cada nivel en una estimación, en tanto por uno del margen. */
const DESVIO_POR_NIVEL: Readonly<Record<NivelBot, number>> = {
  pardillo: 2.5,
  apanado: 1,
  sabelotodo: 0.3,
};

/**
 * Lo que contesta un asiento sin nadie detrás.
 *
 * El bot conoce la respuesta porque corre en el servidor, que es el único sitio
 * donde está. No hace falta que la adivine: hace falta que falle a propósito lo
 * que le toca fallar, y ahí es donde vive su nivel.
 */
export function respuestaDelBot(pregunta: Pregunta, nivel: NivelBot, rng: Rng): number {
  return pregunta.tipo === 'estimacion'
    ? estimacion(pregunta, nivel, rng)
    : opcion(pregunta, nivel, rng);
}

function opcion(pregunta: Pregunta, nivel: NivelBot, rng: Rng): number {
  if (rng.next() < ACIERTOS_POR_NIVEL[nivel]) return pregunta.correcta;

  // Cuando falla, falla de verdad: elige entre las que no son la buena, y no
  // entre todas. Si no, un tercio de sus fallos acertaría de rebote y los
  // niveles dejarían de distinguirse.
  const fallos = pregunta.opciones
    .map((_opcion, indice) => indice)
    .filter((indice) => indice !== pregunta.correcta);

  return fallos[rng.int(0, fallos.length - 1)] ?? pregunta.correcta;
}

/**
 * Una estimación cercana, pero no clavada.
 *
 * El desvío se mide sobre el margen de la pregunta, que es la escala en la que
 * esa pregunta considera que se falla. Sobre la respuesta misma, un bot listo
 * en «¿cuántos bits tiene una IP?» diría siempre 32 o 31.
 */
function estimacion(pregunta: Pregunta, nivel: NivelBot, rng: Rng): number {
  const escala = Math.max(1, pregunta.margen ?? Math.abs(pregunta.correcta) / 10);
  const desvio = escala * DESVIO_POR_NIVEL[nivel] * (rng.next() * 2 - 1);
  return Math.round(pregunta.correcta + desvio);
}
