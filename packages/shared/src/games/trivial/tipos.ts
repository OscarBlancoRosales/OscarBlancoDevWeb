import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { SeatId } from '../module';

const SIN_EXTRAS = { additionalProperties: false } as const;

/** Cuántas opciones tiene una prueba de las que se eligen. */
export const OPCIONES = 4;

export type TipoPrueba = 'test' | 'estimacion' | 'fallo';
export type Fase = 'presentacion' | 'ronda' | 'resultado' | 'fin';
export type NivelBot = 'pardillo' | 'apanado' | 'sabelotodo';

/**
 * Una prueba del concurso.
 *
 * Las tres clases comparten forma —enunciado, opciones y una respuesta— para
 * que el motor no crezca con cada una: lo que cambia es cómo se puntúa y cómo
 * se pinta, no cómo se guarda.
 */
export interface Pregunta {
  readonly id: string;
  readonly tipo: TipoPrueba;
  readonly enunciado: string;
  readonly codigo?: string;
  /** Las cuatro opciones. En una estimación está vacío: se escribe un número. */
  readonly opciones: readonly string[];
  /** El índice bueno en `test` y `fallo`; el número exacto en `estimacion`. */
  readonly correcta: number;
  /**
   * En una estimación, el error a partir del cual ya no se puntúa.
   *
   * Lo declara la pregunta porque solo ella lo sabe: fallar por veinte en un año
   * es fallar, y fallar por veinte en «cuántos bytes ocupa» es bordarlo. Medir
   * el error en proporción a la propia respuesta daría un noventa y nueve por
   * ciento a cualquiera que dijera un año del siglo correcto.
   */
  readonly margen?: number;
  readonly explicacion: string;
}

/**
 * Lo que contestó un asiento.
 *
 * `orden` es el puesto en que llegó su respuesta, y lo escribe el servidor al
 * aplicarla. De ahí sale el bonus por rapidez: un milisegundo medido por el
 * cliente sería un dato que nadie puede desmentir.
 */
export interface Respuesta {
  readonly valor: number;
  readonly orden: number;
}

export interface Ronda {
  readonly pregunta: Pregunta;
  readonly cerrada: boolean;
  readonly respuestas: Readonly<Record<SeatId, Respuesta>>;
}

export interface TrivialState {
  readonly rondas: readonly Ronda[];
  /** En qué ronda va la partida. */
  readonly actual: number;
  readonly puntos: Readonly<Record<SeatId, number>>;
  readonly fase: Fase;
  /** Quién juega, por orden de llegada. El primero abrió la sala. */
  readonly orden: readonly SeatId[];
  readonly jugadas: number;
  readonly semilla: number;
  readonly nivelBot: NivelBot;
}

export const TrivialAction = Type.Union([
  Type.Object({ tipo: Type.Literal('empezar') }, SIN_EXTRAS),
  Type.Object(
    { tipo: Type.Literal('responder'), valor: Type.Integer({ minimum: -1_000_000_000, maximum: 1_000_000_000 }) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('siguiente') }, SIN_EXTRAS),
]);

export type TrivialAction = Static<typeof TrivialAction>;

/** Cómo quedó un asiento en una ronda, una vez cerrada. */
export interface ResultadoDeRonda {
  readonly seatId: SeatId;
  readonly valor: number;
  readonly ganados: number;
}

/**
 * Lo que sale hacia un asiento.
 *
 * Mientras la ronda está abierta, `correcta`, `explicacion` y `resultados` son
 * `null`: no están ocultos en el cliente, es que no se envían. En un concurso
 * entre programadores, la respuesta dentro del bundle es la respuesta a la
 * vista.
 */
export interface TrivialView {
  readonly fase: Fase;
  readonly ronda: number;
  readonly rondas: number;
  readonly tipo: TipoPrueba | null;
  readonly enunciado: string;
  readonly codigo: string | null;
  readonly opciones: readonly string[];
  readonly cerrada: boolean;
  /** Quién ha contestado ya. Nunca qué, mientras la ronda siga abierta. */
  readonly hanRespondido: readonly SeatId[];
  readonly tuRespuesta: number | null;
  readonly puntos: Readonly<Record<SeatId, number>>;
  readonly correcta: number | null;
  readonly explicacion: string | null;
  readonly resultados: readonly ResultadoDeRonda[] | null;
}
