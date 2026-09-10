import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { SeatId } from '../module';

const SIN_EXTRAS = { additionalProperties: false } as const;

/**
 * Cómo se juega la partida.
 *
 * `clasico` es el juego de toda la vida: al impostor no le dan palabra y tiene
 * que sobrevivir a base de decir cosas que valgan para cualquier cosa.
 *
 * `revancha` es el mismo, pero pillarle no acaba la partida: le queda un
 * disparo. Si acierta la palabra, gana él. Cambia cómo se juega la mesa entera,
 * porque las pistas buenas dejan de ser gratis.
 *
 * `infiltrado` le da una palabra parecida y no le dice que es el impostor. Es
 * el más tramposo de los tres: nadie miente a propósito, y aun así uno de la
 * mesa está hablando de otra cosa.
 */
export type Modo = 'clasico' | 'revancha' | 'infiltrado';

/**
 * Por dónde va la ronda.
 *
 * `debate` es el rato de hablar entre que se acaban las pistas y se vota, y no
 * es un adorno: sin él, la mesa vota sobre cuatro palabras sueltas y el juego
 * se queda en un sorteo. Es donde de verdad se pilla al impostor.
 */
export type Fase =
  | 'sala'
  | 'repartiendo'
  | 'pistas'
  | 'debate'
  | 'votacion'
  | 'ultima-palabra'
  | 'fin';

/** Quién se lleva la ronda. `null` mientras no ha acabado. */
export type Desenlace = 'tripulacion' | 'impostores' | null;

export const MODOS: readonly Modo[] = ['clasico', 'revancha', 'infiltrado'];

/** Cuántos se necesitan para que el juego tenga sentido. */
export const MINIMO_JUGADORES = 3;

/** Cuántas palabras se le ofrecen al impostor pillado en la revancha. */
export const OPCIONES_ULTIMA_PALABRA = 6;

/** Lo que dura el debate por defecto, en segundos. Cero es «sin reloj». */
export const SEGUNDOS_DE_DEBATE = 90;

/** Una pista dicha en su turno. Una palabra, y a callar. */
export interface Pista {
  readonly seatId: SeatId;
  readonly texto: string;
  /** La vuelta en la que se dijo, contando desde cero. */
  readonly ronda: number;
}

export interface ImpostorState {
  readonly fase: Fase;
  readonly modo: Modo;
  readonly temaId: string;

  /**
   * La palabra de la tripulación y la del infiltrado.
   *
   * Vacías hasta que el servidor reparte, y nunca salen enteras hacia la mesa:
   * de aquí a cada pantalla pasan por `view`, que es donde se decide quién ve
   * qué. Están en el estado porque el estado vive en el servidor.
   */
  readonly palabra: string;
  readonly senuelo: string;

  /** Quién juega esta ronda, en el orden en que hablan. */
  readonly orden: readonly SeatId[];
  /** Quiénes son impostores. Esto no sale de aquí hasta el final. */
  readonly impostores: readonly SeatId[];
  /** Quién ha dicho que está listo, mientras se llena la mesa. */
  readonly listos: readonly SeatId[];

  /**
   * Cuánto dura el debate y cuándo se acaba.
   *
   * `debateHasta` es una marca de tiempo del servidor, no del navegador: los
   * relojes de ocho ordenadores no coinciden, y el reloj de la mesa tiene que
   * ser uno. Cero significa que el debate no tiene reloj y lo corta el
   * anfitrión.
   */
  readonly segundosDebate: number;
  readonly debateHasta: number;

  /** Cuántas vueltas de pistas se dan, y por cuál va. */
  readonly vueltas: number;
  readonly vuelta: number;
  /** A quién le toca hablar: su sitio dentro de `orden`. */
  readonly turno: number;
  readonly pistas: readonly Pista[];

  /** A quién ha votado cada uno. Se guarda al votar, se enseña al cerrar. */
  readonly votos: Readonly<Record<SeatId, SeatId>>;
  /** Quién salió votado. `null` si hubo empate o si aún no se ha contado. */
  readonly expulsado: SeatId | null;

  /** Las palabras que se le ofrecen al impostor pillado, y cuál eligió. */
  readonly opciones: readonly string[];
  readonly intento: number;

  readonly desenlace: Desenlace;
  /** Cuántos impostores se pidieron al abrir la sala. Los reparte el servidor. */
  readonly impostoresPedidos: number;
  /**
   * La semilla de la ronda. La sortea el servidor y entra con el reparto.
   *
   * Es de donde sale el azar de los bots, y por eso no puede venir de la
   * configuración de la sala: esa es pública, y con ella se podría calcular a
   * quién va a votar cada bot antes de que vote.
   */
  readonly semilla: number;
  /** Rondas ganadas por cada asiento a lo largo de la sala. */
  readonly marcador: Readonly<Record<SeatId, number>>;
  /** Cuántas rondas se han jugado ya en esta sala. */
  readonly rondasJugadas: number;

  readonly jugadas: number;

  /** Lo último que dijo la sala, y a qué momento corresponde. */
  readonly dice: string;
  readonly momento: string;
}

/** Lo que la sala reparte al empezar una ronda. Lo manda el servidor. */
export const Reparto = Type.Object(
  {
    tipo: Type.Literal('reparte'),
    palabra: Type.String({ minLength: 1, maxLength: 40 }),
    senuelo: Type.String({ minLength: 1, maxLength: 40 }),
    orden: Type.Array(Type.String({ maxLength: 64 }), { minItems: 1, maxItems: 16 }),
    impostores: Type.Array(Type.String({ maxLength: 64 }), { minItems: 1, maxItems: 4 }),
    opciones: Type.Array(Type.String({ maxLength: 40 }), { maxItems: 12 }),
    semilla: Type.Integer({ minimum: 0, maximum: 2147483647 }),
  },
  SIN_EXTRAS,
);

export const ImpostorAction = Type.Union([
  /** Me siento a esta ronda. Cuando lo dicen todos, la sala reparte. */
  Type.Object({ tipo: Type.Literal('listo') }, SIN_EXTRAS),
  /** Mi pista, en mi turno. Una palabra: el juego se rompe si se explaya. */
  Type.Object(
    { tipo: Type.Literal('pista'), texto: Type.String({ minLength: 1, maxLength: 40 }) },
    SIN_EXTRAS,
  ),
  Type.Object(
    { tipo: Type.Literal('votar'), aQuien: Type.String({ minLength: 1, maxLength: 64 }) },
    SIN_EXTRAS,
  ),
  /** El disparo del impostor pillado, en el modo que se lo concede. */
  Type.Object(
    { tipo: Type.Literal('adivinar'), opcion: Type.Integer({ minimum: 0, maximum: 11 }) },
    SIN_EXTRAS,
  ),
  /** Cortar el debate y pasar a votar. La pide quien abrió la sala. */
  Type.Object({ tipo: Type.Literal('alVoto') }, SIN_EXTRAS),
  /** Otra ronda con la misma gente. La pide quien abrió la sala. */
  Type.Object({ tipo: Type.Literal('otra') }, SIN_EXTRAS),

  // Las de aquí abajo las pone el servidor. Ver `accionesDeSistema`.
  Reparto,
  /** Abre el reloj del debate con la hora del servidor. */
  Type.Object(
    { tipo: Type.Literal('debate'), hasta: Type.Integer({ minimum: 0 }) },
    SIN_EXTRAS,
  ),
  /** Se acabó el tiempo de hablar. */
  Type.Object({ tipo: Type.Literal('aVotar') }, SIN_EXTRAS),
  Type.Object(
    {
      tipo: Type.Literal('narra'),
      momento: Type.String({ minLength: 1, maxLength: 40 }),
      frase: Type.String({ minLength: 1, maxLength: 400 }),
    },
    SIN_EXTRAS,
  ),
]);

export type ImpostorAction = Static<typeof ImpostorAction>;
export type Reparto = Static<typeof Reparto>;

/**
 * Lo que sale hacia un asiento concreto.
 *
 * Aquí es donde vive el secreto entero del juego. La palabra sale solo hacia
 * quien tiene derecho a saberla, y quién es el impostor no sale hacia nadie
 * hasta que la ronda termina. No están escondidos en el cliente: es que no se
 * envían, que es la única forma de esconder algo en un navegador.
 */
export interface ImpostorView {
  readonly fase: Fase;
  readonly modo: Modo;
  /** El tema, que sí es público: sin él nadie puede ni inventarse una pista. */
  readonly tema: string;

  /** Tu palabra. `null` si eres el impostor de un modo que no te da ninguna. */
  readonly tuPalabra: string | null;
  /**
   * Si tú eres impostor.
   *
   * En `infiltrado` es siempre `false` hasta el final, y no es un descuido: ahí
   * la gracia es que el infiltrado tampoco lo sabe.
   */
  readonly eresImpostor: boolean;

  readonly orden: readonly SeatId[];
  readonly listos: readonly SeatId[];
  readonly vuelta: number;
  readonly vueltas: number;
  /** Cuándo se acaba el debate, en hora del servidor. Cero, sin reloj. */
  readonly debateHasta: number;
  readonly segundosDebate: number;
  /** A quién le toca hablar, y si eres tú. */
  readonly turno: SeatId | null;
  readonly tuTurno: boolean;
  readonly pistas: readonly Pista[];

  /** Quién ha votado ya. Nunca a quién, mientras la votación siga abierta. */
  readonly hanVotado: readonly SeatId[];
  readonly tuVoto: SeatId | null;
  /** El recuento entero, solo cuando la votación se cierra. */
  readonly votos: Readonly<Record<SeatId, SeatId>> | null;
  readonly expulsado: SeatId | null;

  /** Las palabras del disparo final. Vacío fuera de ese momento. */
  readonly opciones: readonly string[];
  readonly intento: number;
  /** Si el disparo final es tuyo. */
  readonly tuDisparo: boolean;

  /** La palabra y los impostores, ya destapados. `null` antes de tiempo. */
  readonly palabra: string | null;
  readonly impostores: readonly SeatId[] | null;
  readonly desenlace: Desenlace;

  readonly marcador: Readonly<Record<SeatId, number>>;
  readonly rondasJugadas: number;

  readonly dice: string;
  readonly momento: string;
}

/** A quién le toca hablar ahora mismo, o `null` si no toca hablar a nadie. */
export function aQuienLeToca(state: ImpostorState): SeatId | null {
  if (state.fase !== 'pistas') return null;
  return state.orden[state.turno] ?? null;
}
