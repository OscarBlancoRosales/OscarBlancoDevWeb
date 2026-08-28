import { describe, expect, it } from 'vitest';
import { riskModule } from './risk';
import type { RiskView } from './risk';
import type { GameAction, GameState } from '../engine/types';
import type { Seat } from './module';

const ANA: Seat = { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 };
const LUIS: Seat = { id: 'luis', displayName: 'Luis', isBot: false, connected: true, order: 1 };
const MESA = [ANA, LUIS];
const CONFIG = { mapId: 'spain-regions', seed: 7 };

function partida(): GameState {
  return riskModule.createState(MESA, CONFIG);
}

function vista(state: GameState, seat: string): RiskView {
  return riskModule.view(state, seat, MESA) as RiskView;
}

describe('RISK como juego de sala', () => {
  it('crea la partida con un jugador por asiento', () => {
    const state = partida();

    expect(state.players.map((p) => p.id)).toEqual(['ana', 'luis']);
    expect(state.mapId).toBe('spain-regions');
  });

  it('la semilla de la sala manda: la misma da la misma partida', () => {
    expect(partida()).toEqual(partida());
  });

  it('otra semilla da otra partida', () => {
    const otra = riskModule.createState(MESA, { mapId: 'spain-regions', seed: 99 });

    expect(otra.territories).not.toEqual(partida().territories);
  });
});

describe('nadie juega en nombre de otro', () => {
  it('mandar la jugada del rival cuando le toca a él se rechaza', () => {
    const state = partida();
    const enTurno = state.turnOrder[state.currentPlayerIndex] ?? '';
    const elOtro = state.turnOrder.find((id) => id !== enTurno) ?? '';

    // El motor diría que sí: a `enTurno` le toca. Lo que no puede ver es que
    // quien ha mandado el mensaje es el otro.
    const error = riskModule.validate(
      state,
      { type: 'end-phase', playerId: enTurno },
      elOtro,
      MESA,
    );

    expect(error?.code).toBe('no-eres-tu');
  });

  it('firmar con el asiento propio pasa el filtro de identidad', () => {
    const state = partida();
    const enTurno = state.turnOrder[state.currentPlayerIndex] ?? '';

    const error = riskModule.validate(
      state,
      { type: 'end-phase', playerId: enTurno },
      enTurno,
      MESA,
    );

    expect(error?.code).not.toBe('no-eres-tu');
  });

  it('a un bot sí se le mueve desde otro asiento: alguien tiene que pensarlo', () => {
    const BOT: Seat = { id: 'bot', displayName: 'Bot', isBot: true, connected: false, order: 2 };
    const mesa = [ANA, LUIS, BOT];
    const state = riskModule.createState(mesa, CONFIG);

    const error = riskModule.validate(state, { type: 'end-phase', playerId: 'bot' }, 'ana', mesa);

    expect(error?.code).not.toBe('no-eres-tu');
  });

  it('y el turno lo sigue comprobando el motor, no este módulo', () => {
    const state = partida();
    const enTurno = state.turnOrder[state.currentPlayerIndex] ?? '';
    const elOtro = state.turnOrder.find((id) => id !== enTurno) ?? '';

    const error = riskModule.validate(
      state,
      { type: 'end-phase', playerId: elOtro },
      elOtro,
      MESA,
    );

    expect(error?.code).toBe('not-your-turn');
  });
});

describe('las reglas del motor llegan tal cual', () => {
  it('una jugada ilegal se rechaza con el código del motor', () => {
    const state = partida();
    const enTurno = state.turnOrder[state.currentPlayerIndex] ?? '';

    const error = riskModule.validate(
      state,
      { type: 'attack', playerId: enTurno, from: 'no-existe', to: 'tampoco', dice: 3 },
      enTurno,
      MESA,
    );

    expect(error).not.toBeNull();
    expect(error?.message).toBeTruthy();
  });

  it('validar no cambia el estado, aunque aplique por dentro', () => {
    const state = partida();
    const antes = structuredClone(state);
    const enTurno = state.turnOrder[state.currentPlayerIndex] ?? '';

    riskModule.validate(state, { type: 'end-phase', playerId: enTurno }, enTurno, MESA);

    expect(state).toEqual(antes);
  });

  it('aplicar dos veces lo mismo da lo mismo: el azar vive dentro del estado', () => {
    const state = partida();
    const enTurno = state.turnOrder[state.currentPlayerIndex] ?? '';
    const suyo = Object.entries(state.territories).find(([, t]) => t.ownerId === enTurno)?.[0] ?? '';
    const reclamar: GameAction = { type: 'deploy', playerId: enTurno, territoryId: suyo, armies: 1 };

    expect(riskModule.validate(state, reclamar, enTurno, MESA)).toBeNull();

    const primera = riskModule.apply(state, reclamar, enTurno, MESA);
    const segunda = riskModule.apply(state, reclamar, enTurno, MESA);

    expect(primera).toEqual(segunda);
  });
});

describe('la mano ajena no sale del servidor', () => {
  it('las cartas propias se ven; las de otro, solo se cuentan', () => {
    const state = partida();
    const conCartas: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'luis'
          ? { ...player, cards: [{ id: 'c1', symbol: 'infantry', territoryId: 'AN' }] }
          : player,
      ),
    };

    const loQueVeAna = vista(conCartas, 'ana');
    const luis = loQueVeAna.players.find((p) => p.id === 'luis');
    const ana = loQueVeAna.players.find((p) => p.id === 'ana');

    expect(luis?.cards).toBeNull();
    expect(luis?.cardCount).toBe(1);
    expect(ana?.cards).toEqual([]);
  });

  it('la mano de un bot sí se ve: alguien tiene que jugarla', () => {
    const BOT: Seat = { id: 'bot', displayName: 'Bot', isBot: true, connected: false, order: 2 };
    const mesa = [ANA, BOT];
    const state = riskModule.createState(mesa, CONFIG);
    const conCartas: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 'bot' ? { ...player, cards: [{ id: 'c1', territoryId: 't', symbol: 'infantry' as const }] } : player,
      ),
    };

    const view = riskModule.view(conCartas, 'ana', mesa) as RiskView;

    expect(view.players.find((player) => player.id === 'bot')?.cards).toHaveLength(1);
  });

  it('el mazo se cuenta, no se enseña', () => {
    const state = partida();

    const view = vista(state, 'ana');

    expect(view.deckSize).toBe(state.deck.length);
    expect(view).not.toHaveProperty('deck');
  });

  it('el pase del asiento nunca viaja dentro del jugador', () => {
    const conPase: GameState = {
      ...partida(),
      players: partida().players.map((player) => ({ ...player, seatToken: 'secreto' })),
    };

    const serializado = JSON.stringify(vista(conPase, 'ana'));

    expect(serializado).not.toContain('secreto');
  });
});

describe('irse de la mesa', () => {
  it('no cambia la partida: cerrar la pestaña no es rendirse', () => {
    const state = partida();

    expect(riskModule.onSeatLeave?.(state, 'ana')).toEqual(state);
  });
});
