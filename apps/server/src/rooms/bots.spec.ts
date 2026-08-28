import { describe, expect, it } from 'vitest';
import { Type } from '@sinclair/typebox';
import { TOPE_JUGADAS_SEGUIDAS, moverBots } from './bots';
import type { GameModule, RuleError, Seat, SeatId } from '@devweb/shared/games/module';
import type { MesaArbitrada } from './bots';

const PERSONA: Seat = { id: 'persona', displayName: 'Óscar', isBot: false, connected: true, order: 0 };
const MAQUINA: Seat = { id: 'maquina', displayName: 'Bot', isBot: true, connected: false, order: 1 };
const ASIENTOS: Seat[] = [PERSONA, MAQUINA];

/** Una mesa de mentira: apunta lo que se le somete y no toca disco. */
function mesa(
  asientos: readonly Seat[] = ASIENTOS,
  rechazo: RuleError | null = null,
): MesaArbitrada & { jugadas: { seatId: SeatId; accion: unknown }[] } {
  return {
    asientos,
    estado: {},
    jugadas: [],
    submit(seatId, accion) {
      this.jugadas.push({ seatId, accion });
      return rechazo;
    },
  };
}

/** Un juego que responde con `veces` jugadas para un bot y luego se calla. */
function juego(veces: number): GameModule<unknown, unknown> {
  let quedan = veces;
  return {
    id: 'flota',
    actionSchema: Type.Unknown(),
    createState: () => ({}),
    validate: () => null,
    apply: (state) => state,
    view: (state) => state,
    botAction: () => (quedan-- > 0 ? { tipo: 'jugada' } : null),
  };
}

/** Un juego que le da una sola jugada a cada bot, y nunca una segunda. */
function unaJugadaPorBot(): GameModule<unknown, unknown> {
  const movidos = new Set<SeatId>();
  return {
    ...SIN_BOTS,
    botAction: (_state, seat) => {
      if (movidos.has(seat)) return null;
      movidos.add(seat);
      return { tipo: 'jugada' };
    },
  };
}

const SIN_BOTS: GameModule<unknown, unknown> = {
  id: 'scrum',
  actionSchema: Type.Unknown(),
  createState: () => ({}),
  validate: () => null,
  apply: (state) => state,
  view: (state) => state,
};

describe('moverBots', () => {
  it('juega por el asiento bot hasta que deja de tener jugada', () => {
    const partida = mesa();
    expect(moverBots(partida, juego(3))).toBe(3);
    expect(partida.jugadas).toHaveLength(3);
    expect(partida.jugadas.every((jugada) => jugada.seatId === 'maquina')).toBe(true);
  });

  it('no juega por las personas aunque el juego proponga jugada', () => {
    const soloPersonas = mesa([PERSONA]);
    expect(moverBots(soloPersonas, juego(5))).toBe(0);
    expect(soloPersonas.jugadas).toHaveLength(0);
  });

  it('no hace nada si el juego no tiene bots', () => {
    const partida = mesa();
    expect(moverBots(partida, SIN_BOTS)).toBe(0);
    expect(partida.jugadas).toHaveLength(0);
  });

  it('para en el tope aunque el juego siga pidiendo jugar', () => {
    const partida = mesa();
    expect(moverBots(partida, juego(Number.MAX_SAFE_INTEGER), 10)).toBe(10);
  });

  it('el tope por defecto acota una partida que no acaba nunca', () => {
    const partida = mesa();
    expect(moverBots(partida, juego(Number.MAX_SAFE_INTEGER))).toBe(TOPE_JUGADAS_SEGUIDAS);
  });

  it('para en seco si la mesa rechaza la jugada del bot', () => {
    const partida = mesa(ASIENTOS, { code: 'ilegal', message: 'No.' });
    expect(moverBots(partida, juego(5))).toBe(0);
    // La jugada rechazada se intentó una vez y no se reintenta: un bot que
    // propone lo ilegal lo volvería a proponer, y eso es un bucle.
    expect(partida.jugadas).toHaveLength(1);
  });

  it('mueve a varios bots en la misma pasada', () => {
    const dosBots = mesa([
      PERSONA,
      { id: 'uno', displayName: 'Uno', isBot: true, connected: false, order: 1 },
      { id: 'otro', displayName: 'Otro', isBot: true, connected: false, order: 2 },
    ]);
    moverBots(dosBots, unaJugadaPorBot());
    expect(new Set(dosBots.jugadas.map((jugada) => jugada.seatId))).toEqual(
      new Set(['uno', 'otro']),
    );
  });
});
