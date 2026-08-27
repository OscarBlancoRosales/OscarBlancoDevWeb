import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { GameModule, RuleError, Seat, SeatId } from './module';

/**
 * Planning poker.
 *
 * La baraja son los números de Fibonacci más las dos cartas que todo el mundo
 * usa: el café ("necesito un descanso") y el porro ("esto es demasiado grande
 * para estimarlo hoy").
 */
export const CARTAS_NUMERICAS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const;

export const ScrumVote = Type.Union([
  Type.Object({ tipo: Type.Literal('numero'), valor: Type.Integer() }, { additionalProperties: false }),
  Type.Object({ tipo: Type.Literal('cafe') }, { additionalProperties: false }),
  Type.Object({ tipo: Type.Literal('porro') }, { additionalProperties: false }),
]);

export const ScrumAction = Type.Union([
  Type.Object({ tipo: Type.Literal('votar'), voto: ScrumVote }, { additionalProperties: false }),
  Type.Object({ tipo: Type.Literal('retirar-voto') }, { additionalProperties: false }),
  Type.Object({ tipo: Type.Literal('revelar') }, { additionalProperties: false }),
  Type.Object({ tipo: Type.Literal('nueva-ronda'), asunto: Type.Optional(Type.String({ maxLength: 200 })) }, { additionalProperties: false }),
]);

export type ScrumVote = Static<typeof ScrumVote>;
export type ScrumAction = Static<typeof ScrumAction>;

export interface ScrumState {
  readonly asunto: string;
  readonly revelado: boolean;
  readonly votos: Readonly<Record<SeatId, ScrumVote>>;
  readonly ronda: number;
}

/** Lo que sale hacia un asiento concreto. */
export interface ScrumView {
  readonly asunto: string;
  readonly revelado: boolean;
  readonly ronda: number;
  /** Quién ha votado ya. Nunca qué ha votado, mientras siga oculto. */
  readonly hanVotado: readonly SeatId[];
  /** Los votos: los de todos si está revelado, y si no, solo el tuyo. */
  readonly votos: Readonly<Record<SeatId, ScrumVote>>;
  readonly resumen: ScrumResumen | null;
}

export interface ScrumResumen {
  readonly media: number | null;
  readonly mediana: number | null;
  readonly acuerdo: boolean;
  readonly cafes: number;
  readonly porros: number;
}

const NO_VOTA: RuleError = { code: 'ronda-revelada', message: 'La ronda ya está revelada.' };

export const scrumModule: GameModule<ScrumState, ScrumAction> = {
  id: 'scrum',
  actionSchema: ScrumAction,

  createState() {
    return { asunto: '', revelado: false, votos: {}, ronda: 1 };
  },

  validate(state, action, _by, seats) {
    switch (action.tipo) {
      case 'votar':
        if (state.revelado) return NO_VOTA;
        if (action.voto.tipo === 'numero' && !esCartaDeLaBaraja(action.voto.valor)) {
          return { code: 'carta-inexistente', message: 'Esa carta no está en la baraja.' };
        }
        return null;

      case 'retirar-voto':
        return state.revelado ? NO_VOTA : null;

      case 'revelar':
        if (state.revelado) {
          return { code: 'ya-revelada', message: 'La ronda ya estaba revelada.' };
        }
        // Revelar cero votos no informa de nada y borra el trabajo de la ronda.
        if (Object.keys(state.votos).length === 0) {
          return { code: 'sin-votos', message: 'Todavía no ha votado nadie.' };
        }
        return sinAsientosHumanos(seats);

      case 'nueva-ronda':
        return sinAsientosHumanos(seats);
    }
  },

  apply(state, action, by) {
    switch (action.tipo) {
      case 'votar':
        return { ...state, votos: { ...state.votos, [by]: action.voto } };

      case 'retirar-voto':
        return { ...state, votos: sinVotoDe(state.votos, by) };

      case 'revelar':
        return { ...state, revelado: true };

      case 'nueva-ronda':
        return {
          asunto: action.asunto ?? '',
          revelado: false,
          votos: {},
          ronda: state.ronda + 1,
        };
    }
  },

  /**
   * Mientras la ronda no esté revelada, los votos ajenos no salen de aquí.
   *
   * Es la diferencia entre "el cliente no los pinta" y "el cliente no los tiene".
   * Lo primero se salta con la consola del navegador abierta; lo segundo, no.
   */
  view(state, forSeat) {
    const propio = votoDe(state.votos, forSeat);
    return {
      asunto: state.asunto,
      revelado: state.revelado,
      ronda: state.ronda,
      hanVotado: Object.keys(state.votos),
      votos: state.revelado ? state.votos : propio ? { [forSeat]: propio } : {},
      resumen: state.revelado ? resumir(state.votos) : null,
    } satisfies ScrumView;
  },

  /**
   * Quien se va se lleva su voto.
   *
   * Dejarlo contaría en la media de una persona que ya no está en la sala, y
   * bloquearía el "han votado todos" para siempre.
   */
  onSeatLeave(state, seat) {
    if (!(seat in state.votos)) return state;
    return { ...state, votos: sinVotoDe(state.votos, seat) };
  },
};

/**
 * El voto de un asiento, si lo hay.
 *
 * `Record<SeatId, ScrumVote>` afirma que todo asiento tiene voto, y no es
 * verdad: quien no ha votado no tiene entrada. Esta función es donde se dice
 * la verdad, y por eso su tipo de retorno lleva el `undefined`.
 */
function votoDe(
  votos: Readonly<Record<SeatId, ScrumVote>>,
  seat: SeatId,
): ScrumVote | undefined {
  return votos[seat];
}

/** Los mismos votos menos el de ese asiento. Sin tocar el original. */
function sinVotoDe(
  votos: Readonly<Record<SeatId, ScrumVote>>,
  seat: SeatId,
): Record<SeatId, ScrumVote> {
  return Object.fromEntries(Object.entries(votos).filter(([id]) => id !== seat));
}

function esCartaDeLaBaraja(valor: number): boolean {
  return (CARTAS_NUMERICAS as readonly number[]).includes(valor);
}

function sinAsientosHumanos(seats: readonly Seat[]): RuleError | null {
  return seats.some((seat) => !seat.isBot)
    ? null
    : { code: 'sala-vacia', message: 'No hay nadie en la sala.' };
}

/**
 * El resumen de la ronda.
 *
 * Solo cuentan las cartas numéricas: el café y el porro no son estimaciones, y
 * meterlos como ceros hundiría la media justo cuando alguien está diciendo que
 * no se puede estimar.
 */
export function resumir(votos: Readonly<Record<SeatId, ScrumVote>>): ScrumResumen {
  const emitidos = Object.values(votos);
  const numeros = emitidos
    .filter((voto): voto is Extract<ScrumVote, { tipo: 'numero' }> => voto.tipo === 'numero')
    .map((voto) => voto.valor)
    .sort((a, b) => a - b);

  return {
    media: numeros.length > 0 ? media(numeros) : null,
    mediana: numeros.length > 0 ? mediana(numeros) : null,
    acuerdo: numeros.length > 0 && numeros[0] === numeros[numeros.length - 1],
    cafes: emitidos.filter((voto) => voto.tipo === 'cafe').length,
    porros: emitidos.filter((voto) => voto.tipo === 'porro').length,
  };
}

function media(ordenados: readonly number[]): number {
  const total = ordenados.reduce((suma, valor) => suma + valor, 0);
  return Math.round((total / ordenados.length) * 100) / 100;
}

function mediana(ordenados: readonly number[]): number {
  const mitad = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[mitad] ?? 0;
  return ((ordenados[mitad - 1] ?? 0) + (ordenados[mitad] ?? 0)) / 2;
}
