import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { SeatId } from '../module';

const SIN_EXTRAS = { additionalProperties: false } as const;

/** Cuántas opciones tiene una prueba de las que se eligen. */
export const OPCIONES = 4;

/**
 * Las pruebas del programa.
 *
 * `test`, `estimacion` y `fallo` son «todos contestan a la vez». `pulsa` es la
 * misma pregunta pero solo cuenta quien se lanza antes. `rafaga` encadena
 * afirmaciones y premia la racha. `bomba` va por turnos: contesta quien la
 * tiene, y los demás miran.
 */
export type TipoPrueba =
  | 'test'
  | 'estimacion'
  | 'fallo'
  | 'pulsa'
  | 'rafaga'
  | 'bomba'
  // La última del programa: se apuesta antes de verla y se cobra o se paga lo
  // apostado. Es la única que puede dar la vuelta a un marcador entero.
  | 'final';
/**
 * De qué va el programa.
 *
 * Son dos juegos distintos y mezclarlos no es variedad, es incoherencia: nadie
 * quiere que entre «¿qué devuelve typeof null?» y «¿en qué año fue la peste
 * negra?» en la misma tanda. Se elige al abrir la sala y no se mezcla.
 */
export type Tema = 'dev' | 'general';

export type Fase = 'presentacion' | 'ronda' | 'resultado' | 'apuestas' | 'fin';
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
  /**
   * Del 1 al 5. La 1 se contesta de memoria; la 5 la falla casi todo el mundo.
   *
   * Opcional a propósito: el banco escrito a mano no tiene que rellenarlo para
   * que el juego funcione. La pide el modo IA, que encarga las preguntas por
   * posición para que el programa vaya subiendo de la primera a la última.
   */
  readonly dificultad?: 1 | 2 | 3 | 4 | 5;
  /**
   * De qué baraja es. Sin declarar, de programación.
   *
   * El banco nació siendo solo de dev y se queda como estaba: así una pregunta
   * nueva de programación no tiene que acordarse de ponerlo, y una de cultura
   * general sí, que es la que se cuela donde no debe.
   */
  readonly tema?: Tema;
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
  /**
   * Si la mesa la tumbó por estar mal. Entonces no reparte puntos.
   *
   * Solo pasa en el modo de preguntas inventadas: el banco está escrito a mano
   * y revisado, y ahí no se anula nada.
   */
  readonly anulada?: boolean;
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

  /** Aciertos seguidos de cada uno en la ráfaga. Se rompe al fallar. */
  readonly racha: Readonly<Record<SeatId, number>>;

  /** Quién tiene la bomba ahora mismo. Fuera de esa prueba, `null`. */
  readonly turno: SeatId | null;
  /**
   * Respuestas que le quedan a la bomba antes de estallar.
   *
   * Baja con cada acierto y no se reparte por turnos: la gracia es que nadie
   * sabe si le va a tocar a él, que es lo que hace que se conteste con prisa.
   */
  readonly mecha: number;

  /**
   * Cuándo se cierra sola la ronda, en milisegundos de reloj de servidor.
   *
   * Viaja el instante y no los segundos que quedan: es lo único que los cinco
   * navegadores de la mesa pueden compartir, porque cada uno tiene su hora y
   * ninguna coincide. Cero es «esta ronda no lleva reloj».
   */
  readonly cierraEn: number;

  /**
   * Si las preguntas de esta sala las escribió la IA.
   *
   * Se guarda en la partida y no se mira de la configuración cada vez porque
   * decide una regla -si se puede impugnar- y las reglas quedan fijadas al
   * crear la sala.
   */
  readonly inventadas: boolean;

  /** Quién ha dicho que esta pregunta está mal. Se anula por unanimidad. */
  readonly impugnan: readonly SeatId[];

  /**
   * Lo que se juega cada uno en la final.
   *
   * Secreto mientras la fase sigue abierta, igual que las respuestas: lo que no
   * se manda no se puede mirar. Al cerrarse se cantan todas a la vez, que es el
   * momento de la final.
   */
  readonly apuestas: Readonly<Record<SeatId, number>>;

  /**
   * Cuántas veces se ha dicho ya cada momento en este programa.
   *
   * De aquí sale que el presentador no repita frase: el guion recorre todas
   * las suyas antes de volver a la primera. Sorteando cada vez, con doce
   * frases y cuatro usos se repite casi una de cada dos, y una frase repetida
   * delata al guion más que ninguna otra cosa.
   */
  readonly dichos: Readonly<Record<string, number>>;

  /** Lo último que dijo el presentador, para que la mesa lo lea a la vez. */
  readonly dice: string;
  /** El momento del programa al que corresponde esa frase. */
  readonly momento: string;
}

/**
 * La ronda que hay en esa posición, si la hay.
 *
 * `rondas[i]` se tipa como si siempre hubiera algo, y no es verdad: pasada la
 * última no hay nada. Este acceso lo dice, y así el `?.` de quien lo use es
 * necesario en vez de sobrar.
 */
export function rondaEn(state: TrivialState, i: number): Ronda | undefined {
  return state.rondas.at(i);
}

export const TrivialAction = Type.Union([
  Type.Object({ tipo: Type.Literal('empezar') }, SIN_EXTRAS),
  Type.Object(
    { tipo: Type.Literal('responder'), valor: Type.Integer({ minimum: -1_000_000_000, maximum: 1_000_000_000 }) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('siguiente') }, SIN_EXTRAS),
  // Las pone el servidor: la hora de cierre la decide él porque es el único
  // reloj que la mesa comparte, y porque un cronómetro que corre en el
  // navegador es un cronómetro que se para con las devtools abiertas.
  Type.Object(
    { tipo: Type.Literal('reloj'), hasta: Type.Integer({ minimum: 0 }) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('tiempo') }, SIN_EXTRAS),
  Type.Object(
    { tipo: Type.Literal('apostar'), cuanto: Type.Integer({ minimum: 0, maximum: 1_000_000 }) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('impugnar') }, SIN_EXTRAS),
  // La dice el servidor, no una persona: es la voz del presentador entrando
  // en la partida para que todos la lean a la vez.
  Type.Object(
    {
      tipo: Type.Literal('presenta'),
      momento: Type.String({ minLength: 1, maxLength: 40 }),
      frase: Type.String({ minLength: 1, maxLength: 400 }),
    },
    SIN_EXTRAS,
  ),
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
  /** Del 1 al 5, cuando la pregunta la declara. Un crescendo que no se ve, no existe. */
  readonly dificultad: number | null;
  readonly opciones: readonly string[];
  readonly cerrada: boolean;
  /** Quién ha contestado ya. Nunca qué, mientras la ronda siga abierta. */
  readonly hanRespondido: readonly SeatId[];
  readonly tuRespuesta: number | null;
  readonly puntos: Readonly<Record<SeatId, number>>;
  readonly correcta: number | null;
  readonly explicacion: string | null;
  readonly resultados: readonly ResultadoDeRonda[] | null;

  /** Quién tiene la bomba, y cuánto le queda. Fuera de la bomba, `null` y 0. */
  readonly turno: SeatId | null;
  readonly mecha: number;
  /** Cuándo se cierra la ronda. Cero mientras no haya reloj puesto. */
  readonly cierraEn: number;
  /** Quién ha apostado ya. Nunca cuánto, mientras la fase siga abierta. */
  readonly hanApostado: readonly SeatId[];
  readonly tuApuesta: number | null;
  /** Todas las apuestas, cuando ya se pueden cantar. Antes, `null`. */
  readonly apuestas: Readonly<Record<SeatId, number>> | null;
  /** Si en esta sala se puede impugnar, que es solo en el modo IA. */
  readonly inventadas: boolean;
  /** Cuántos han impugnado y cuántos hacen falta. Nunca quiénes. */
  readonly impugnan: number;
  readonly hacenFalta: number;
  readonly tuImpugnas: boolean;
  /** Si te toca a ti contestar. En las demás pruebas contestan todos. */
  readonly tuTurno: boolean;

  /** Aciertos seguidos en la ráfaga, para pintar el multiplicador. */
  readonly racha: number;

  /** Lo que está diciendo el presentador, y en qué momento del programa. */
  readonly dice: string;
  readonly momento: string;
}
