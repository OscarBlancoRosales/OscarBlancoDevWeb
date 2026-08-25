import { describe, expect, it } from 'vitest';
import {
  deriveGame,
  electHostSeatId,
  initialStateFor,
  rosterToPlayers,
  seatsToPlayers,
  seatsToRoster,
  shouldSnapshot,
} from './risk-sync';
import { LoggedActionEntry, RoomMeta, RoomSeat } from './risk-room.service';
import { DEFAULT_CONFIG, applyAction, currentPlayer } from '../engine/engine';
import { GameAction } from '../engine/types';
import { getMap } from '../engine/maps/map-registry';
import { decideAction } from '../engine/ai/bot-brain';
import { territoriesOf } from '../engine/rules';

const map = getMap('world');

function seat(id: string, order: number, overrides: Partial<RoomSeat> = {}): RoomSeat {
  return {
    id,
    name: id.toUpperCase(),
    kind: 'human',
    seatToken: `token-${id}`,
    color: '#00e676',
    order,
    joinedAt: order,
    lastSeen: 0,
    connected: true,
    isOwner: order === 0,
    ...overrides,
  };
}

function meta(overrides: Partial<RoomMeta> = {}): RoomMeta {
  return {
    id: 'RISK-TEST',
    name: 'Partida',
    mapId: 'world',
    maxPlayers: 4,
    seed: 20260824,
    status: 'playing',
    createdAt: 0,
    updatedAt: 0,
    ownerUid: 'o',
    ownerName: 'O',
    config: DEFAULT_CONFIG,
    inviteCode: 'AAA',
    ...overrides,
  };
}

function entries(actions: GameAction[]): LoggedActionEntry[] {
  return actions.map((action, index) => ({
    key: index.toString().padStart(5, '0'),
    action,
    ts: index,
    by: action.playerId,
  }));
}

const SEATS = [seat('a', 0), seat('b', 1, { kind: 'bot', botProfile: 'agresivo' })];

describe('sincronización de la partida', () => {
  describe('seatsToPlayers', () => {
    it('respeta el orden de los asientos', () => {
      const players = seatsToPlayers([seat('b', 1), seat('a', 0)]);
      expect(players.map((p) => p.id)).toEqual(['a', 'b']);
    });

    it('desempata por identificador', () => {
      const players = seatsToPlayers([seat('z', 0), seat('a', 0)]);
      expect(players.map((p) => p.id)).toEqual(['a', 'z']);
    });

    it('arrastra el perfil de los bots', () => {
      const players = seatsToPlayers([seat('b', 0, { kind: 'bot', botProfile: 'cauto' })]);
      expect(players[0].botProfile).toBe('cauto');
    });
  });

  describe('roster', () => {
    it('congela nombre, color y tipo de cada asiento', () => {
      const roster = seatsToRoster(SEATS);
      expect(roster.map((r) => r.id)).toEqual(['a', 'b']);
      expect(roster[1].botProfile).toBe('agresivo');
    });

    it('el roster produce los mismos jugadores que los asientos', () => {
      expect(rosterToPlayers(seatsToRoster(SEATS))).toEqual(seatsToPlayers(SEATS));
    });

    it('el estado inicial usa el roster aunque cambien los asientos', () => {
      const frozen = meta({ roster: seatsToRoster(SEATS) });
      const renamed = [seat('a', 5, { name: 'OTRO NOMBRE' }), seat('b', 0)];
      const before = initialStateFor(frozen, SEATS, map);
      const after = initialStateFor(frozen, renamed, map);
      expect(after.turnOrder).toEqual(before.turnOrder);
      expect(after.territories).toEqual(before.territories);
    });

    it('sin roster el estado sí depende de los asientos', () => {
      const open = meta();
      const a = initialStateFor(open, [seat('a', 0), seat('b', 1)], map);
      const b = initialStateFor(open, [seat('a', 1), seat('b', 0)], map);
      expect(a.turnOrder).not.toEqual(b.turnOrder);
    });
  });

  describe('deriveGame', () => {
    it('devuelve null con menos de dos asientos', () => {
      const derived = deriveGame(meta(), [seat('a', 0)], null, [], map);
      expect(derived.state).toBeNull();
    });

    it('devuelve null sin metadatos', () => {
      expect(deriveGame(null, SEATS, null, [], map).state).toBeNull();
    });

    it('construye el estado inicial cuando no hay log', () => {
      const derived = deriveGame(meta(), SEATS, null, [], map);
      expect(derived.state).not.toBeNull();
      expect(derived.applied).toBe(0);
      expect(derived.rejected).toEqual([]);
    });

    it('aplica el log en orden', () => {
      const start = initialStateFor(meta(), SEATS, map);
      const first = currentPlayer(start)!;
      const target = territoriesOf(start, first.id)[0];
      const derived = deriveGame(
        meta(),
        SEATS,
        null,
        entries([
          { type: 'deploy', playerId: first.id, territoryId: target, armies: first.reserve },
        ]),
        map,
      );
      expect(derived.state!.territories[target].armies).toBe(
        start.territories[target].armies + first.reserve,
      );
      expect(derived.applied).toBe(1);
    });

    it('descarta las acciones ilegales sin romper la partida', () => {
      const derived = deriveGame(
        meta(),
        SEATS,
        null,
        entries([{ type: 'attack', playerId: 'a', from: 'AK', to: 'NT', dice: 3 }]),
        map,
      );
      expect(derived.state).not.toBeNull();
      expect(derived.rejected).toHaveLength(1);
      expect(derived.rejected[0].reason.length).toBeGreaterThan(0);
    });

    it('descarta igual en todos los clientes (es determinista)', () => {
      const log = entries([
        { type: 'attack', playerId: 'b', from: 'AK', to: 'NT', dice: 3 },
        { type: 'end-phase', playerId: 'a' },
      ]);
      const first = deriveGame(meta(), SEATS, null, log, map);
      const second = deriveGame(meta(), SEATS, null, log, map);
      expect(second.state).toEqual(first.state);
      expect(second.rejected.map((r) => r.entry.key)).toEqual(
        first.rejected.map((r) => r.entry.key),
      );
    });

    it('arranca desde el punto de control y aplica solo lo posterior', () => {
      const start = initialStateFor(meta(), SEATS, map);
      const first = currentPlayer(start)!;
      const territory = territoriesOf(start, first.id)[0];
      const action: GameAction = {
        type: 'deploy',
        playerId: first.id,
        territoryId: territory,
        armies: 1,
      };
      const afterOne = applyAction(start, action, map);

      const full = deriveGame(meta(), SEATS, null, entries([action, action]), map);
      const fromSnapshot = deriveGame(
        meta(),
        SEATS,
        { upTo: 1, state: afterOne, ts: 0 },
        entries([action, action]),
        map,
      );
      expect(fromSnapshot.state!.territories).toEqual(full.state!.territories);
    });

    it('tolera un punto de control por delante del log', () => {
      const start = initialStateFor(meta(), SEATS, map);
      const derived = deriveGame(meta(), SEATS, { upTo: 99, state: start, ts: 0 }, [], map);
      expect(derived.state).toEqual(start);
    });

    it('informa del error si el mapa no admite tantos jugadores', () => {
      const many = Array.from({ length: 8 }, (_, i) => seat(`p${i}`, i));
      const derived = deriveGame(meta({ maxPlayers: 8 }), many, null, [], map);
      expect(derived.state).toBeNull();
      expect(derived.error).toContain('máximo');
    });

    it('reproduce una partida completa de bots sin descartar nada', () => {
      const seats = [
        seat('a', 0, { kind: 'bot', botProfile: 'agresivo' }),
        seat('b', 1, { kind: 'bot', botProfile: 'oportunista' }),
      ];
      const roomMeta = meta({ roster: seatsToRoster(seats), seed: 777 });

      // Generamos el log jugando de verdad.
      let state = initialStateFor(roomMeta, seats, map);
      const actions: GameAction[] = [];
      for (let i = 0; i < 4000 && state.phase !== 'game-over'; i++) {
        const player = currentPlayer(state);
        if (!player) break;
        const action = decideAction(state, map, player.id);
        if (!action) break;
        actions.push(action);
        state = applyAction(state, action, map);
      }

      const derived = deriveGame(roomMeta, seats, null, entries(actions), map);
      expect(derived.rejected).toEqual([]);
      expect(derived.state).toEqual(state);
    });
  });

  describe('electHostSeatId', () => {
    it('elige al propietario si está conectado', () => {
      const seats = [seat('a', 0, { isOwner: true }), seat('b', 1)];
      expect(electHostSeatId(seats)).toBe('a');
    });

    it('si el propietario se cae, manda el humano conectado más antiguo', () => {
      const seats = [seat('a', 0, { isOwner: true, connected: false }), seat('b', 1), seat('c', 2)];
      expect(electHostSeatId(seats)).toBe('b');
    });

    it('los bots nunca son anfitriones', () => {
      const seats = [seat('bot', 0, { kind: 'bot' }), seat('b', 1)];
      expect(electHostSeatId(seats)).toBe('b');
    });

    it('sin humanos conectados no hay anfitrión', () => {
      const seats = [seat('a', 0, { connected: false }), seat('bot', 1, { kind: 'bot' })];
      expect(electHostSeatId(seats)).toBeNull();
    });

    it('siempre elige el mismo (todos los clientes coinciden)', () => {
      const seats = [seat('b', 1), seat('a', 0), seat('c', 2)];
      expect(electHostSeatId(seats)).toBe(electHostSeatId([...seats].reverse()));
    });
  });

  describe('shouldSnapshot', () => {
    it('guarda cada N acciones', () => {
      expect(shouldSnapshot(40, 0, 40)).toBe(true);
      expect(shouldSnapshot(39, 0, 40)).toBe(false);
      expect(shouldSnapshot(85, 40, 40)).toBe(true);
    });

    it('no guarda si el intervalo es cero', () => {
      expect(shouldSnapshot(1000, 0, 0)).toBe(false);
    });
  });
});
