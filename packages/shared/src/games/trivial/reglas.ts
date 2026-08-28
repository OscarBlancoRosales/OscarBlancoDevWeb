import type { Pregunta, Respuesta } from './tipos';
import type { SeatId } from '../module';

export const PUNTOS_ACIERTO = 100;

/**
 * Lo que se lleva por acertar pronto: 50 el primero, 35 el segundo, 20 el
 * tercero y 5 el cuarto. Del quinto en adelante, saber la respuesta ya vale
 * solo lo que vale saberla.
 */
export const BONUS_POR_ORDEN = [50, 35, 20, 5] as const;

/** De propina por clavar una estimación, que tiene mérito. */
export const PROPINA_EXACTA = 20;

export function aciertaCon(pregunta: Pregunta, valor: number): boolean {
  return valor === pregunta.correcta;
}

/**
 * Lo que se lleva un asiento por su respuesta en esta ronda.
 *
 * Nunca es negativo. Restar por fallar enseña a no contestar, y un concurso en
 * el que nadie arriesga se muere solo.
 */
export function puntosDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  seat: SeatId,
): number {
  const suya = respuestaDe(respuestas, seat);
  if (!suya) return 0;

  if (pregunta.tipo === 'estimacion') return puntosPorCercania(pregunta, suya.valor);
  if (!aciertaCon(pregunta, suya.valor)) return 0;

  return PUNTOS_ACIERTO + (BONUS_POR_ORDEN[aciertosAntesDe(pregunta, respuestas, suya)] ?? 0);
}

/**
 * La respuesta de un asiento, si contestó.
 *
 * `Record<SeatId, Respuesta>` afirma que todo asiento contestó, y no es verdad.
 * Aquí es donde se dice la verdad, y por eso el retorno lleva el `undefined`.
 */
export function respuestaDe(
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  seat: SeatId,
): Respuesta | undefined {
  return respuestas[seat];
}

/** Lo que gana cada uno en la ronda, de una vez. */
export function repartoDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
): Record<SeatId, number> {
  return Object.fromEntries(
    Object.keys(respuestas).map((seat) => [seat, puntosDe(pregunta, respuestas, seat)]),
  );
}

/**
 * Cuántos acertaron antes que él.
 *
 * Se cuentan los aciertos y no las respuestas: quien contesta rápido una
 * barbaridad no le quita el bonus al que acierta después. El premio es por
 * acertar pronto, no por pulsar pronto.
 */
function aciertosAntesDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  suya: Respuesta,
): number {
  return Object.values(respuestas).filter(
    (otra) => otra.orden < suya.orden && aciertaCon(pregunta, otra.valor),
  ).length;
}

/**
 * Lo que vale una estimación según lo cerca que se quede.
 *
 * El margen lo pone la pregunta, y por eso puede discriminar: en un año, veinte
 * de error es fallar; en «cuántos millones de líneas», veinte es clavarlo. Sin
 * margen declarado se cae en la proporción sobre la propia respuesta, que sirve
 * de red pero es mucho más generosa.
 */
function puntosPorCercania(pregunta: Pregunta, valor: number): number {
  const error = Math.abs(valor - pregunta.correcta);
  if (error === 0) return PUNTOS_ACIERTO + PROPINA_EXACTA;

  const margen = Math.max(1, pregunta.margen ?? Math.abs(pregunta.correcta));
  return Math.max(0, Math.round(PUNTOS_ACIERTO * (1 - error / margen)));
}
