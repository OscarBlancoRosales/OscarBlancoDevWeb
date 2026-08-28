import type { TSchema } from '@sinclair/typebox';

export type SeatId = string;
export type GameId = 'scrum' | 'risk' | 'flota';

export interface RuleError {
  readonly code: string;
  readonly message: string;
}

export interface Seat {
  readonly id: SeatId;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly connected: boolean;
}

/**
 * Lo que un juego tiene que saber hacer para que el servidor lo arbitre.
 *
 * El servidor no sabe qué es un territorio ni qué es un voto: recibe una acción,
 * pregunta si es legal, la aplica y difunde el resultado. Todo lo que un juego
 * nuevo necesita está aquí dentro, y por eso añadir uno no toca la
 * infraestructura de salas, ni el WebSocket, ni la persistencia.
 *
 * Los tres métodos son **puros**: mismo estado y misma acción, mismo resultado.
 * Es lo que permite reconstruir una partida entera reaplicando su log, y lo que
 * hace que el navegador y el servidor no puedan discrepar.
 */
export interface GameModule<TState, TAction> {
  readonly id: GameId;

  /** El esquema de sus acciones. Lo que no encaje aquí no llega a `validate`. */
  readonly actionSchema: TSchema;

  /**
   * El estado inicial. `config` es lo que se guardó al crear la sala: para
   * RISK, el mapa y la semilla; para el planning poker, nada.
   */
  createState(seats: readonly Seat[], config: Readonly<Record<string, unknown>>): TState;

  /** `null` si la jugada es legal; el motivo si no lo es. */
  validate(state: TState, action: TAction, by: SeatId, seats: readonly Seat[]): RuleError | null;

  apply(state: TState, action: TAction, by: SeatId, seats: readonly Seat[]): TState;

  /**
   * Lo que ve un asiento concreto.
   *
   * Aquí es donde se ocultan los votos antes de revelarlos o las cartas de los
   * demás: lo que este método no devuelve, no sale del servidor. No está
   * cifrado ni escondido en el cliente; sencillamente no se envía.
   */
  view(state: TState, forSeat: SeatId, seats: readonly Seat[]): unknown;

  /** Qué pasa con el estado cuando alguien deja la sala. Por defecto, nada. */
  onSeatLeave?(state: TState, seat: SeatId): TState;
}
