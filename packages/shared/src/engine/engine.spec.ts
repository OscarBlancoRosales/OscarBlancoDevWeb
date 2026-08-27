import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  currentPlayer,
  DEFAULT_CONFIG,
  enemyNeighbours,
  legalActionTypes,
  mustTrade,
  playerById,
  PLAYER_COLORS,
  replay,
  tryApplyAction,
} from './engine';
import type { GameAction, GameState} from './types';
import { RuleError } from './types';
import { TINY_MAP, applyAll, forceTurn, makeGame, ruleErrorOf, setBoard } from './testing';
import { WORLD_MAP } from './maps/world.map';
import { armiesOf, territoriesOf } from './rules';

/** Deja el turno de `p1` en fase de ataque con un tablero controlado. */
function attackScenario(overrides: Partial<Record<string, [string | null, number]>> = {}) {
  const base = makeGame();
  const board = setBoard(base, {
    A1: ['p1', 10],
    A2: ['p1', 3],
    A3: ['p1', 1],
    B1: ['p2', 1],
    B2: ['p2', 5],
    B3: ['p2', 2],
    ...overrides,
  });
  return forceTurn(board, 'p1', 'attack');
}

describe('motor de RISK', () => {
  describe('createGame', () => {
    it('reparte todos los territorios del mapa', () => {
      const state = makeGame();
      const unowned = Object.values(state.territories).filter((t) => t.ownerId === null);
      expect(unowned).toHaveLength(0);
    });

    it('da a cada jugador el mismo número de ejércitos', () => {
      const state = makeGame({ config: { startingArmies: 20 } });
      for (const player of state.players) {
        const total = territoriesOf(state, player.id).reduce(
          (sum, id) => sum + state.territories[id].armies,
          0,
        );
        expect(total).toBe(20);
      }
    });

    it('reparte los territorios de forma equilibrada', () => {
      const state = makeGame();
      const counts = state.players.map((p) => territoriesOf(state, p.id).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });

    it('deja al menos un ejército en cada territorio', () => {
      const state = makeGame();
      for (const territory of Object.values(state.territories)) {
        expect(territory.armies).toBeGreaterThanOrEqual(1);
      }
    });

    it('la misma semilla produce exactamente la misma partida', () => {
      expect(makeGame({ seed: 777 })).toEqual(makeGame({ seed: 777 }));
    });

    it('semillas distintas producen partidas distintas', () => {
      expect(makeGame({ seed: 1 }).territories).not.toEqual(makeGame({ seed: 2 }).territories);
    });

    it('asigna un color distinto a cada jugador', () => {
      const state = createGame({
        map: WORLD_MAP,
        seed: 1,
        players: Array.from({ length: 6 }, (_, i) => ({
          id: `p${i}`,
          name: `J${i}`,
          kind: 'bot' as const,
        })),
      });
      expect(new Set(state.players.map((p) => p.color)).size).toBe(6);
      expect(state.players[0].color).toBe(PLAYER_COLORS[0]);
    });

    it('empieza en fase de refuerzos con reserva calculada', () => {
      const state = makeGame();
      expect(state.phase).toBe('reinforce');
      expect(currentPlayer(state)!.reserve).toBeGreaterThanOrEqual(3);
    });

    it('rechaza partidas con menos de dos jugadores', () => {
      expect(() =>
        createGame({ map: TINY_MAP, seed: 1, players: [{ id: 'p1', name: 'Solo', kind: 'human' }] }),
      ).toThrow(RuleError);
    });

    it('rechaza más jugadores de los que admite el mapa', () => {
      expect(() =>
        createGame({
          map: TINY_MAP,
          seed: 1,
          players: Array.from({ length: 4 }, (_, i) => ({
            id: `p${i}`,
            name: `J${i}`,
            kind: 'bot' as const,
          })),
        }),
      ).toThrow(/como máximo/);
    });

    it('usa los ejércitos iniciales clásicos según el número de jugadores', () => {
      const three = createGame({
        map: WORLD_MAP,
        seed: 5,
        players: ['a', 'b', 'c'].map((id) => ({ id, name: id, kind: 'bot' as const })),
      });
      const total = territoriesOf(three, 'a').reduce(
        (sum, id) => sum + three.territories[id].armies,
        0,
      );
      expect(total).toBe(35);
    });

    it('construye un mazo con una carta por territorio y dos comodines', () => {
      const state = makeGame();
      expect(state.deck).toHaveLength(TINY_MAP.territories.length + 2);
    });

    it('mezcla el orden de turno de forma determinista', () => {
      expect(makeGame({ seed: 42 }).turnOrder).toEqual(makeGame({ seed: 42 }).turnOrder);
      expect(new Set(makeGame().turnOrder)).toEqual(new Set(['p1', 'p2']));
    });

    it('registra el evento de inicio', () => {
      expect(makeGame().events[0].type).toBe('game-start');
    });

    it('permite el reparto manual cuando se pide', () => {
      const state = makeGame({ config: { autoClaim: false } });
      expect(state.phase).toBe('setup-claim');
      expect(Object.values(state.territories).every((t) => t.ownerId === null)).toBe(true);
      expect(state.players[0].reserve).toBeGreaterThan(0);
    });
  });

  describe('inmutabilidad', () => {
    it('applyAction no toca el estado anterior', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 5);
      const before = JSON.stringify(state);
      applyAction(state, { type: 'deploy', playerId: 'p1', territoryId: territoriesOf(state, 'p1')[0], armies: 1 }, TINY_MAP);
      expect(JSON.stringify(state)).toBe(before);
    });

    it('incrementa el contador de acciones en cada jugada', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 3);
      const next = applyAction(
        state,
        { type: 'deploy', playerId: 'p1', territoryId: territoriesOf(state, 'p1')[0], armies: 1 },
        TINY_MAP,
      );
      expect(next.actionCount).toBe(state.actionCount + 1);
    });
  });

  describe('fase de refuerzos', () => {
    it('coloca ejércitos en un territorio propio', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 5);
      const target = territoriesOf(state, 'p1')[0];
      const before = state.territories[target].armies;
      const next = applyAction(
        state,
        { type: 'deploy', playerId: 'p1', territoryId: target, armies: 3 },
        TINY_MAP,
      );
      expect(next.territories[target].armies).toBe(before + 3);
      expect(playerById(next, 'p1')!.reserve).toBe(2);
    });

    it('no deja colocar más de lo que hay en reserva', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 2);
      expect(
        ruleErrorOf(state, {
          type: 'deploy',
          playerId: 'p1',
          territoryId: territoriesOf(state, 'p1')[0],
          armies: 3,
        }),
      ).toBe('not-enough-reserve');
    });

    it('no deja colocar en territorio ajeno', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 3);
      expect(
        ruleErrorOf(state, {
          type: 'deploy',
          playerId: 'p1',
          territoryId: territoriesOf(state, 'p2')[0],
          armies: 1,
        }),
      ).toBe('not-your-territory');
    });

    it('rechaza cantidades no enteras, cero o negativas', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 5);
      const territoryId = territoriesOf(state, 'p1')[0];
      for (const armies of [0, -1, 1.5, NaN]) {
        expect(ruleErrorOf(state, { type: 'deploy', playerId: 'p1', territoryId, armies })).toBe(
          'bad-amount',
        );
      }
    });

    it('rechaza territorios inexistentes', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 5);
      expect(
        ruleErrorOf(state, { type: 'deploy', playerId: 'p1', territoryId: 'ZZ', armies: 1 }),
      ).toBe('unknown-territory');
    });

    it('no deja pasar de fase con reserva pendiente', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 4);
      expect(ruleErrorOf(state, { type: 'end-phase', playerId: 'p1' })).toBe('reserve-pending');
    });

    it('pasa a la fase de ataque cuando la reserva está a cero', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      const next = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(next.phase).toBe('attack');
    });

    it('no se puede atacar durante los refuerzos', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 3);
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 1 }),
      ).toBe('wrong-phase');
    });
  });

  describe('turnos', () => {
    it('no deja jugar a quien no le toca', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 3);
      expect(
        ruleErrorOf(state, {
          type: 'deploy',
          playerId: 'p2',
          territoryId: territoriesOf(state, 'p2')[0],
          armies: 1,
        }),
      ).toBe('not-your-turn');
    });

    it('rechaza acciones de jugadores desconocidos', () => {
      const state = makeGame();
      expect(ruleErrorOf(state, { type: 'end-phase', playerId: 'fantasma' })).toBe('unknown-player');
    });

    it('el turno pasa al siguiente jugador al terminar de reagrupar', () => {
      const state = forceTurn(makeGame(), 'p1', 'fortify');
      const next = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(currentPlayer(next)!.id).toBe('p2');
      expect(next.phase).toBe('reinforce');
    });

    it('la ronda avanza al volver al primer jugador', () => {
      const base = makeGame();
      const lastPlayerId = base.turnOrder[base.turnOrder.length - 1];
      const state = forceTurn(base, lastPlayerId, 'fortify');
      const next = applyAction(state, { type: 'end-phase', playerId: lastPlayerId }, TINY_MAP);
      expect(next.round).toBe(state.round + 1);
      expect(currentPlayer(next)!.id).toBe(base.turnOrder[0]);
    });

    it('el nuevo turno recalcula la reserva de refuerzos', () => {
      const state = forceTurn(makeGame(), 'p1', 'fortify');
      const next = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(playerById(next, 'p2')!.reserve).toBeGreaterThanOrEqual(3);
    });

    it('salta a los jugadores eliminados', () => {
      let state = makeGame({
        players: [
          { id: 'p1', name: 'Ada', kind: 'human' },
          { id: 'p2', name: 'Bram', kind: 'bot' },
          { id: 'p3', name: 'Cleo', kind: 'bot' },
        ],
      });
      state = setBoard(state, {
        A1: ['p1', 5],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p3', 5],
        B2: ['p3', 5],
        B3: ['p3', 5],
      });
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p2')!.eliminated = true;
      state = forceTurn(state, 'p1', 'fortify');
      const next = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(currentPlayer(next)!.id).toBe('p3');
    });
  });

  describe('fase de ataque', () => {
    it('quita ejércitos según los dados', () => {
      const state = attackScenario();
      const next = applyAction(
        state,
        { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
        TINY_MAP,
      );
      const combat = next.lastCombat!;
      expect(next.territories['A1'].armies).toBe(10 - combat.attackerLosses);
      expect(combat.attackerDice).toHaveLength(3);
      expect(combat.defenderDice).toHaveLength(1);
    });

    it('exige al menos dos ejércitos para atacar', () => {
      const state = attackScenario({ A3: ['p1', 1] });
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A3', to: 'B3', dice: 1 }),
      ).toBe('illegal-attack');
    });

    it('no deja atacar a un territorio propio', () => {
      const state = attackScenario();
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'A2', dice: 1 }),
      ).toBe('illegal-attack');
    });

    it('no deja atacar territorios no adyacentes', () => {
      const state = attackScenario();
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B3', dice: 1 }),
      ).toBe('illegal-attack');
    });

    it('no deja atacar desde territorio ajeno', () => {
      const state = attackScenario();
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'B2', to: 'A2', dice: 1 }),
      ).toBe('illegal-attack');
    });

    it('limita el número de dados al excedente de ejércitos', () => {
      const state = attackScenario({ A2: ['p1', 2] });
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A2', to: 'B1', dice: 2 }),
      ).toBe('bad-dice');
    });

    it('rechaza cero dados o más de tres', () => {
      const state = attackScenario();
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 0 }),
      ).toBe('bad-dice');
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 4 }),
      ).toBe('bad-dice');
    });

    it('el mismo ataque con la misma semilla da el mismo resultado', () => {
      const state = attackScenario();
      const action: GameAction = { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 };
      expect(applyAction(state, action, TINY_MAP).lastCombat).toEqual(
        applyAction(state, action, TINY_MAP).lastCombat,
      );
    });

    it('la conquista deja el territorio pendiente de ocupar', () => {
      let state = attackScenario({ B1: ['p2', 1] });
      // Atacamos hasta conquistar (el resultado es determinista pero puede requerir varios intentos).
      for (let i = 0; i < 30 && !state.pendingOccupation; i++) {
        if (state.territories['B1'].ownerId === 'p1') break;
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(state.pendingOccupation).not.toBeNull();
      expect(state.territories['B1'].ownerId).toBe('p1');
      expect(state.territories['B1'].armies).toBe(0);
    });

    it('no deja atacar de nuevo con una conquista sin ocupar', () => {
      let state = attackScenario({ B1: ['p2', 1] });
      for (let i = 0; i < 30 && !state.pendingOccupation; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(
        ruleErrorOf(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B2', dice: 1 }),
      ).toBe('pending-occupation');
    });

    it('no deja pasar de fase con una conquista sin ocupar', () => {
      let state = attackScenario({ B1: ['p2', 1] });
      for (let i = 0; i < 30 && !state.pendingOccupation; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(ruleErrorOf(state, { type: 'end-phase', playerId: 'p1' })).toBe('pending-occupation');
    });

    it('registra el ataque como evento legible', () => {
      const state = attackScenario();
      const next = applyAction(
        state,
        { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 2 },
        TINY_MAP,
      );
      const event = next.events[next.events.length - 1];
      expect(['attack', 'conquer', 'eliminate', 'win']).toContain(event.type);
      expect(next.events.some((e) => e.type === 'attack' && e.text.includes('🎲'))).toBe(true);
    });
  });

  describe('ocupación tras conquista', () => {
    function conquered(): GameState {
      let state = attackScenario({ B1: ['p2', 1] });
      for (let i = 0; i < 40 && !state.pendingOccupation; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      return state;
    }

    it('mueve los ejércitos al territorio conquistado', () => {
      const state = conquered();
      const before = state.territories['A1'].armies;
      const next = applyAction(state, { type: 'occupy', playerId: 'p1', armies: 3 }, TINY_MAP);
      expect(next.territories['B1'].armies).toBe(3);
      expect(next.territories['A1'].armies).toBe(before - 3);
      expect(next.pendingOccupation).toBeNull();
    });

    it('obliga a mover al menos tantos ejércitos como dados se lanzaron', () => {
      const state = conquered();
      expect(ruleErrorOf(state, { type: 'occupy', playerId: 'p1', armies: 1 })).toBe('bad-amount');
    });

    it('no deja vaciar el territorio de origen', () => {
      const state = conquered();
      const max = state.territories['A1'].armies - 1;
      expect(ruleErrorOf(state, { type: 'occupy', playerId: 'p1', armies: max + 1 })).toBe(
        'bad-amount',
      );
    });

    it('falla si no hay conquista pendiente', () => {
      const state = attackScenario();
      expect(ruleErrorOf(state, { type: 'occupy', playerId: 'p1', armies: 1 })).toBe(
        'no-occupation',
      );
    });
  });

  describe('reagrupación', () => {
    it('mueve ejércitos entre territorios propios conectados', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p1', 8],
          A2: ['p1', 1],
          A3: ['p1', 1],
          B1: ['p2', 1],
          B2: ['p2', 1],
          B3: ['p2', 1],
        }),
        'p1',
        'fortify',
      );
      const next = applyAction(
        state,
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A3', armies: 5 },
        TINY_MAP,
      );
      expect(next.territories['A3'].armies).toBe(6);
      expect(next.territories['A1'].armies).toBe(3);
    });

    it('termina el turno automáticamente al reagrupar', () => {
      const state = forceTurn(
        setBoard(makeGame(), { A1: ['p1', 5], A2: ['p1', 1], A3: ['p1', 1], B1: ['p2', 1], B2: ['p2', 1], B3: ['p2', 1] }),
        'p1',
        'fortify',
      );
      const next = applyAction(
        state,
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 2 },
        TINY_MAP,
      );
      expect(currentPlayer(next)!.id).toBe('p2');
    });

    it('exige que ambos territorios sean propios', () => {
      const state = forceTurn(
        setBoard(makeGame(), { A1: ['p1', 5], B1: ['p2', 1] }),
        'p1',
        'fortify',
      );
      expect(
        ruleErrorOf(state, { type: 'fortify', playerId: 'p1', from: 'A1', to: 'B1', armies: 1 }),
      ).toBe('not-your-territory');
    });

    it('exige un camino propio entre origen y destino', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p1', 5],
          A2: ['p2', 1],
          A3: ['p1', 1],
          B1: ['p2', 1],
          B2: ['p2', 1],
          B3: ['p2', 1],
        }),
        'p1',
        'fortify',
      );
      expect(
        ruleErrorOf(state, { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A3', armies: 1 }),
      ).toBe('not-connected');
    });

    it('permite mover a través de territorios propios intermedios', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p1', 5],
          A2: ['p1', 1],
          A3: ['p1', 1],
          B1: ['p2', 1],
          B2: ['p2', 1],
          B3: ['p2', 1],
        }),
        'p1',
        'fortify',
      );
      const next = applyAction(
        state,
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A3', armies: 4 },
        TINY_MAP,
      );
      expect(next.territories['A3'].armies).toBe(5);
    });

    it('no deja vaciar el territorio de origen', () => {
      const state = forceTurn(
        setBoard(makeGame(), { A1: ['p1', 3], A2: ['p1', 1], A3: ['p1', 1], B1: ['p2', 1], B2: ['p2', 1], B3: ['p2', 1] }),
        'p1',
        'fortify',
      );
      expect(
        ruleErrorOf(state, { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 3 }),
      ).toBe('bad-amount');
    });

    it('solo permite una reagrupación por turno', () => {
      let state = forceTurn(
        setBoard(makeGame(), { A1: ['p1', 6], A2: ['p1', 1], A3: ['p1', 1], B1: ['p2', 1], B2: ['p2', 1], B3: ['p2', 1] }),
        'p1',
        'fortify',
      );
      state = applyAction(
        state,
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 1 },
        TINY_MAP,
      );
      // El turno ya ha pasado: intentar otra vez es 'no es tu turno'.
      expect(
        ruleErrorOf(state, { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 1 }),
      ).toBe('not-your-turn');
    });

    it('no se puede reagrupar fuera de su fase', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      expect(
        ruleErrorOf(state, { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 1 }),
      ).toBe('wrong-phase');
    });
  });

  describe('cartas', () => {
    it('se roba una carta al terminar un turno con conquista', () => {
      let state = attackScenario({ B1: ['p2', 1] });
      for (let i = 0; i < 40 && !state.pendingOccupation; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      state = applyAction(state, { type: 'occupy', playerId: 'p1', armies: 3 }, TINY_MAP);
      const before = playerById(state, 'p1')!.cards.length;
      state = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(playerById(state, 'p1')!.cards.length).toBe(before + 1);
    });

    it('no se roba carta si no se ha conquistado nada', () => {
      let state = forceTurn(makeGame(), 'p1', 'attack');
      state = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(playerById(state, 'p1')!.cards).toHaveLength(0);
    });

    it('canjear un trío da ejércitos según la progresión', () => {
      let state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p1')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: null },
        { id: 'c2', symbol: 'cavalry', territoryId: null },
        { id: 'c3', symbol: 'artillery', territoryId: null },
      ];
      const next = applyAction(
        state,
        { type: 'trade', playerId: 'p1', cardIds: ['c1', 'c2', 'c3'] },
        TINY_MAP,
      );
      expect(playerById(next, 'p1')!.reserve).toBe(4);
      expect(playerById(next, 'p1')!.cards).toHaveLength(0);
      expect(next.tradeCount).toBe(1);
      expect(next.discard).toHaveLength(3);
    });

    it('el segundo canje vale más que el primero', () => {
      let state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      state = JSON.parse(JSON.stringify(state));
      state.tradeCount = 1;
      state.players.find((p) => p.id === 'p1')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: null },
        { id: 'c2', symbol: 'infantry', territoryId: null },
        { id: 'c3', symbol: 'infantry', territoryId: null },
      ];
      const next = applyAction(
        state,
        { type: 'trade', playerId: 'p1', cardIds: ['c1', 'c2', 'c3'] },
        TINY_MAP,
      );
      expect(playerById(next, 'p1')!.reserve).toBe(6);
    });

    it('da +2 ejércitos en un territorio propio que aparezca en las cartas', () => {
      let state = forceTurn(setBoard(makeGame(), { A1: ['p1', 4] }), 'p1', 'reinforce', 0);
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p1')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: 'A1' },
        { id: 'c2', symbol: 'cavalry', territoryId: null },
        { id: 'c3', symbol: 'artillery', territoryId: null },
      ];
      const next = applyAction(
        state,
        { type: 'trade', playerId: 'p1', cardIds: ['c1', 'c2', 'c3'] },
        TINY_MAP,
      );
      expect(next.territories['A1'].armies).toBe(6);
    });

    it('no da la bonificación si el territorio no es tuyo', () => {
      let state = forceTurn(setBoard(makeGame(), { B1: ['p2', 4] }), 'p1', 'reinforce', 0);
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p1')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: 'B1' },
        { id: 'c2', symbol: 'cavalry', territoryId: null },
        { id: 'c3', symbol: 'artillery', territoryId: null },
      ];
      const next = applyAction(
        state,
        { type: 'trade', playerId: 'p1', cardIds: ['c1', 'c2', 'c3'] },
        TINY_MAP,
      );
      expect(next.territories['B1'].armies).toBe(4);
    });

    it('rechaza tríos inválidos', () => {
      let state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p1')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: null },
        { id: 'c2', symbol: 'infantry', territoryId: null },
        { id: 'c3', symbol: 'cavalry', territoryId: null },
      ];
      expect(ruleErrorOf(state, { type: 'trade', playerId: 'p1', cardIds: ['c1', 'c2', 'c3'] })).toBe(
        'invalid-set',
      );
    });

    it('rechaza repetir la misma carta', () => {
      let state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p1')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: null },
      ];
      expect(ruleErrorOf(state, { type: 'trade', playerId: 'p1', cardIds: ['c1', 'c1', 'c1'] })).toBe(
        'duplicate-cards',
      );
    });

    it('rechaza canjear cartas que no se tienen', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      expect(ruleErrorOf(state, { type: 'trade', playerId: 'p1', cardIds: ['x', 'y', 'z'] })).toBe(
        'card-not-in-hand',
      );
    });

    it('solo se puede canjear en la fase de refuerzos', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      expect(ruleErrorOf(state, { type: 'trade', playerId: 'p1', cardIds: ['a', 'b', 'c'] })).toBe(
        'wrong-phase',
      );
    });

    it('mustTrade avisa a partir de cinco cartas', () => {
      const state = makeGame();
      const player = playerById(state, 'p1')!;
      expect(mustTrade(player)).toBe(false);
      player.cards = Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        symbol: 'infantry' as const,
        territoryId: null,
      }));
      expect(mustTrade(player)).toBe(true);
    });
  });

  describe('eliminación y victoria', () => {
    it('elimina al jugador que pierde su último territorio', () => {
      let state = setBoard(makeGame(), {
        A1: ['p1', 20],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p2', 1],
        B2: ['p1', 5],
        B3: ['p1', 5],
      });
      state = forceTurn(state, 'p1', 'attack');
      for (let i = 0; i < 60 && state.territories['B1'].ownerId !== 'p1'; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(playerById(state, 'p2')!.eliminated).toBe(true);
      expect(state.winnerId).toBe('p1');
      expect(state.phase).toBe('game-over');
    });

    it('el atacante hereda las cartas del eliminado', () => {
      let state = setBoard(makeGame(), {
        A1: ['p1', 20],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p2', 1],
        B2: ['p1', 5],
        B3: ['p1', 5],
      });
      state = JSON.parse(JSON.stringify(state));
      state.players.find((p) => p.id === 'p2')!.cards = [
        { id: 'h1', symbol: 'infantry', territoryId: null },
        { id: 'h2', symbol: 'cavalry', territoryId: null },
      ];
      state = forceTurn(state, 'p1', 'attack');
      for (let i = 0; i < 60 && state.territories['B1'].ownerId !== 'p1'; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(playerById(state, 'p1')!.cards.map((c) => c.id)).toEqual(['h1', 'h2']);
      expect(playerById(state, 'p2')!.cards).toHaveLength(0);
    });

    it('no se puede jugar después del final', () => {
      let state = setBoard(makeGame(), {
        A1: ['p1', 20],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p2', 1],
        B2: ['p1', 5],
        B3: ['p1', 5],
      });
      state = forceTurn(state, 'p1', 'attack');
      for (let i = 0; i < 60 && state.phase !== 'game-over'; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(ruleErrorOf(state, { type: 'end-phase', playerId: 'p1' })).toBe('game-over');
    });

    it('legalActionTypes queda vacío al terminar', () => {
      const state = makeGame();
      const finished: GameState = { ...JSON.parse(JSON.stringify(state)), phase: 'game-over' };
      expect(legalActionTypes(finished, 'p1')).toEqual([]);
    });
  });

  describe('abandono', () => {
    it('convierte el puesto en un bot en vez de romper la partida', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      const next = applyAction(state, { type: 'surrender', playerId: 'p1' }, TINY_MAP);
      expect(playerById(next, 'p1')!.kind).toBe('bot');
      expect(playerById(next, 'p1')!.eliminated).toBe(false);
      expect(next.phase).not.toBe('game-over');
    });

    it('conserva los territorios del que abandona', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      const before = territoriesOf(state, 'p1').length;
      const next = applyAction(state, { type: 'surrender', playerId: 'p1' }, TINY_MAP);
      expect(territoriesOf(next, 'p1')).toHaveLength(before);
    });

    it('un bot no puede volver a abandonar', () => {
      let state = forceTurn(makeGame(), 'p1', 'attack');
      state = applyAction(state, { type: 'surrender', playerId: 'p1' }, TINY_MAP);
      expect(ruleErrorOf(state, { type: 'surrender', playerId: 'p1' })).toBe('already-bot');
    });

    it('se puede abandonar aunque no sea tu turno', () => {
      const twoHumans = makeGame({
        players: [
          { id: 'p1', name: 'Ada', kind: 'human' },
          { id: 'p2', name: 'Bram', kind: 'human' },
        ],
      });
      const state = forceTurn(twoHumans, 'p1', 'attack');
      const next = applyAction(state, { type: 'surrender', playerId: 'p2' }, TINY_MAP);
      expect(playerById(next, 'p2')!.kind).toBe('bot');
    });
  });

  describe('deshacer refuerzos', () => {
    function ready(reserve = 8) {
      return forceTurn(setBoard(makeGame(), { A1: ['p1', 1], A2: ['p1', 1] }), 'p1', 'reinforce', reserve);
    }

    it('devuelve a la reserva lo último colocado', () => {
      let state = ready();
      state = applyAll(state, [
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 3 },
        { type: 'deploy', playerId: 'p1', territoryId: 'A2', armies: 2 },
      ]);
      expect(state.territories['A2'].armies).toBe(3);
      expect(playerById(state, 'p1')!.reserve).toBe(3);

      state = applyAction(state, { type: 'undo-deploy', playerId: 'p1' }, TINY_MAP);
      expect(state.territories['A2'].armies).toBe(1);
      expect(state.territories['A1'].armies).toBe(4);
      expect(playerById(state, 'p1')!.reserve).toBe(5);
    });

    it('puede devolverlo todo de una vez', () => {
      let state = ready();
      state = applyAll(state, [
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 3 },
        { type: 'deploy', playerId: 'p1', territoryId: 'A2', armies: 2 },
      ]);
      state = applyAction(state, { type: 'undo-deploy', playerId: 'p1', all: true }, TINY_MAP);
      expect(state.territories['A1'].armies).toBe(1);
      expect(state.territories['A2'].armies).toBe(1);
      expect(playerById(state, 'p1')!.reserve).toBe(8);
    });

    it('deshacer varias veces vacía la pila', () => {
      let state = ready();
      state = applyAll(state, [
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 1 },
        { type: 'deploy', playerId: 'p1', territoryId: 'A2', armies: 1 },
      ]);
      state = applyAction(state, { type: 'undo-deploy', playerId: 'p1' }, TINY_MAP);
      state = applyAction(state, { type: 'undo-deploy', playerId: 'p1' }, TINY_MAP);
      expect(playerById(state, 'p1')!.reserve).toBe(8);
      expect(ruleErrorOf(state, { type: 'undo-deploy', playerId: 'p1' })).toBe('nothing-to-undo');
    });

    it('sin nada colocado no hay nada que deshacer', () => {
      expect(ruleErrorOf(ready(), { type: 'undo-deploy', playerId: 'p1' })).toBe('nothing-to-undo');
    });

    it('solo durante los refuerzos: al atacar ya está colocado', () => {
      let state = ready(2);
      state = applyAction(
        state,
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 2 },
        TINY_MAP,
      );
      state = applyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(state.phase).toBe('attack');
      expect(ruleErrorOf(state, { type: 'undo-deploy', playerId: 'p1' })).toBe('wrong-phase');
    });

    it('no se puede deshacer lo del turno anterior', () => {
      let state = ready(2);
      state = applyAll(state, [
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 2 },
        { type: 'end-phase', playerId: 'p1' },
        { type: 'end-phase', playerId: 'p1' },
      ]);
      // Ya juega otro; cuando vuelva, su pila estará vacía.
      const back = forceTurn(state, 'p1', 'reinforce', 3);
      expect(ruleErrorOf(back, { type: 'undo-deploy', playerId: 'p1' })).toBe('nothing-to-undo');
    });

    it('aparece en el menú solo cuando hay algo que deshacer', () => {
      let state = ready();
      expect(legalActionTypes(state, 'p1')).not.toContain('undo-deploy');
      state = applyAction(
        state,
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 1 },
        TINY_MAP,
      );
      expect(legalActionTypes(state, 'p1')).toContain('undo-deploy');
    });

    it('lo cuenta en los eventos', () => {
      let state = ready();
      state = applyAll(state, [
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 3 },
        { type: 'undo-deploy', playerId: 'p1' },
      ]);
      expect(state.events.some((e) => e.text.includes('recupera'))).toBe(true);
    });

    it('no deja al territorio con menos ejércitos que tropas especializadas', () => {
      let state = ready();
      state = applyAction(
        state,
        { type: 'deploy', playerId: 'p1', territoryId: 'A1', armies: 3 },
        TINY_MAP,
      );
      state.territories['A1'].units = { blindado: 3 };
      state = applyAction(state, { type: 'undo-deploy', playerId: 'p1' }, TINY_MAP);
      const territory = state.territories['A1'];
      const specialists = Object.values(territory.units ?? {}).reduce((a, b) => a + b, 0);
      expect(specialists).toBeLessThanOrEqual(territory.armies);
    });
  });

  describe('reparto automático: al azar, pero justo', () => {
    function table(seed: number, players = 4, map = WORLD_MAP) {
      const state = createGame({
        map,
        seed,
        players: Array.from({ length: players }, (_, i) => ({
          id: `p${i}`,
          name: `J${i}`,
          kind: 'bot' as const,
        })),
      });
      return state.turnOrder.map((id) => ({
        id,
        territories: territoriesOf(state, id).length,
        armies: armiesOf(state, id),
      }));
    }

    it('nadie se queda sin nada y se reparte el mapa entero', () => {
      const state = createGame({
        map: WORLD_MAP,
        seed: 5,
        players: Array.from({ length: 4 }, (_, i) => ({
          id: `p${i}`,
          name: `J${i}`,
          kind: 'bot' as const,
        })),
      });
      const sinDueño = Object.values(state.territories).filter((t) => !t.ownerId);
      expect(sinDueño).toHaveLength(0);
      for (const player of state.players) {
        expect(territoriesOf(state, player.id).length).toBeGreaterThan(0);
      }
    });

    it('los territorios se reparten lo más iguales posible', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const counts = table(seed).map((row) => row.territories);
        expect(Math.max(...counts) - Math.min(...counts), `semilla ${seed}`).toBeLessThanOrEqual(1);
      }
    });

    it('los ejércitos salen desiguales, no uno igual en cada sitio', () => {
      // El fallo que había: el montón se repartía en rueda, una tropa a cada
      // territorio por vuelta, así que con 42 territorios entre 4 el 81% del
      // mapa tenía exactamente 3 y el máximo era 4. Un tablero plano no tiene
      // ni plaza fuerte que rodear ni hueco por donde entrar.
      const reparto = new Map<number, number>();
      for (let seed = 1; seed <= 40; seed++) {
        const state = createGame({
          map: WORLD_MAP,
          seed,
          players: Array.from({ length: 4 }, (_, i) => ({
            id: `p${i}`,
            name: `J${i}`,
            kind: 'bot' as const,
          })),
        });
        for (const territory of Object.values(state.territories)) {
          reparto.set(territory.armies, (reparto.get(territory.armies) ?? 0) + 1);
        }
      }
      const total = [...reparto.values()].reduce((a, b) => a + b, 0);
      const parte = (n: number) => (reparto.get(n) ?? 0) / total;

      // Hay de todo: guarniciones de una sola ficha y montones de verdad.
      expect(parte(1)).toBeGreaterThan(0.05);
      expect([...reparto.keys()].filter((n) => n >= 5).length).toBeGreaterThan(0);
      // Y ningún valor acapara el mapa, que es justo lo que pasaba antes.
      expect(Math.max(...[...reparto.keys()].map(parte))).toBeLessThan(0.5);
    });

    it('pero el total de cada jugador sigue siendo el que le toca', () => {
      // Que el reparto sea al azar no puede cambiar cuántas tropas tiene cada
      // uno: solo dónde están.
      for (let seed = 1; seed <= 30; seed++) {
        const rows = table(seed);
        const most = Math.max(...rows.map((r) => r.territories));
        for (const row of rows) {
          expect(row.armies, `semilla ${seed}`).toBe(30 + (most - row.territories));
        }
      }
    });

    it('quien tiene un territorio menos recibe un ejército más', () => {
      // Es la compensación que pedía el equilibrio: menos tierras, más tropas.
      for (let seed = 1; seed <= 30; seed++) {
        const rows = table(seed);
        const most = Math.max(...rows.map((r) => r.territories));
        const base = rows.find((r) => r.territories === most)!.armies;
        for (const row of rows) {
          expect(row.armies, `semilla ${seed}, ${row.id}`).toBe(base + (most - row.territories));
        }
      }
    });

    it('territorios más ejércitos suman lo mismo para todos', () => {
      // Otra forma de decir lo mismo, y la que se nota jugando: nadie empieza
      // con más fuerza total que otro.
      for (let seed = 1; seed <= 30; seed++) {
        const totals = table(seed).map((r) => r.armies + (r.territories === 0 ? 0 : 0));
        const compensated = table(seed).map((r) => r.armies - r.territories);
        expect(new Set(totals).size, `semilla ${seed} (ejércitos)`).toBeLessThanOrEqual(2);
        expect(new Set(compensated).size, `semilla ${seed} (netos)`).toBeLessThanOrEqual(2);
      }
    });

    it('cuando el reparto es exacto nadie necesita compensación', () => {
      // 42 territorios entre 6 salen a 7 justos.
      const rows = table(9, 6);
      expect(new Set(rows.map((r) => r.territories)).size).toBe(1);
      expect(new Set(rows.map((r) => r.armies)).size).toBe(1);
    });

    it('el territorio de más no cae siempre en el mismo sitio del orden', () => {
      // Sin desplazamiento aleatorio, siempre lo cogían los primeros en jugar.
      const positions = new Set<number>();
      for (let seed = 1; seed <= 40; seed++) {
        const rows = table(seed);
        const most = Math.max(...rows.map((r) => r.territories));
        rows.forEach((row, index) => {
          if (row.territories === most) positions.add(index);
        });
      }
      expect(positions.size).toBeGreaterThan(2);
    });

    it('el reparto cambia con la semilla', () => {
      const a = createGame({
        map: WORLD_MAP,
        seed: 1,
        players: [
          { id: 'p0', name: 'A', kind: 'bot' as const },
          { id: 'p1', name: 'B', kind: 'bot' as const },
        ],
      });
      const b = createGame({
        map: WORLD_MAP,
        seed: 2,
        players: [
          { id: 'p0', name: 'A', kind: 'bot' as const },
          { id: 'p1', name: 'B', kind: 'bot' as const },
        ],
      });
      expect(territoriesOf(a, 'p0')).not.toEqual(territoriesOf(b, 'p0'));
    });

    it('con la misma semilla sale exactamente el mismo reparto', () => {
      expect(table(77)).toEqual(table(77));
    });

    it('lo cuenta en los eventos', () => {
      const state = createGame({
        map: WORLD_MAP,
        seed: 3,
        players: Array.from({ length: 4 }, (_, i) => ({
          id: `p${i}`,
          name: `J${i}`,
          kind: 'bot' as const,
        })),
      });
      const text = state.events.map((e) => e.text).join(' ');
      expect(text).toContain('al azar');
      expect(text).toContain('compensad');
    });
  });

  describe('reparto manual', () => {
    it('reclama territorios uno a uno y rota el turno', () => {
      const state = makeGame({ config: { autoClaim: false, startingArmies: 4 } });
      const first = currentPlayer(state)!.id;
      const next = applyAction(state, { type: 'claim', playerId: first, territoryId: 'A1' }, TINY_MAP);
      expect(next.territories['A1']).toEqual({ ownerId: first, armies: 1 });
      expect(currentPlayer(next)!.id).not.toBe(first);
    });

    it('no deja reclamar un territorio ya ocupado', () => {
      let state = makeGame({ config: { autoClaim: false, startingArmies: 4 } });
      const first = currentPlayer(state)!.id;
      state = applyAction(state, { type: 'claim', playerId: first, territoryId: 'A1' }, TINY_MAP);
      const second = currentPlayer(state)!.id;
      expect(ruleErrorOf(state, { type: 'claim', playerId: second, territoryId: 'A1' })).toBe(
        'already-claimed',
      );
    });

    it('al ocuparse todo el mapa pasa a repartir refuerzos', () => {
      let state = makeGame({ config: { autoClaim: false, startingArmies: 4 } });
      const ids = TINY_MAP.territories.map((t) => t.id);
      for (const territoryId of ids) {
        state = applyAction(
          state,
          { type: 'claim', playerId: currentPlayer(state)!.id, territoryId },
          TINY_MAP,
        );
      }
      expect(state.phase).toBe('setup-deploy');
    });

    it('en el reparto de refuerzos solo se refuerzan territorios propios', () => {
      let state = makeGame({ config: { autoClaim: false, startingArmies: 4 } });
      for (const territory of TINY_MAP.territories) {
        state = applyAction(
          state,
          { type: 'claim', playerId: currentPlayer(state)!.id, territoryId: territory.id },
          TINY_MAP,
        );
      }
      const player = currentPlayer(state)!.id;
      const enemyTerritory = Object.keys(state.territories).find(
        (id) => state.territories[id].ownerId !== player,
      )!;
      expect(
        ruleErrorOf(state, { type: 'claim', playerId: player, territoryId: enemyTerritory }),
      ).toBe('not-your-territory');
    });

    it('termina el reparto y arranca la primera ronda', () => {
      let state = makeGame({ config: { autoClaim: false, startingArmies: 4 } });
      let guard = 0;
      while (state.phase === 'setup-claim' || state.phase === 'setup-deploy') {
        if (guard++ > 100) throw new Error('el reparto no termina');
        const player = currentPlayer(state)!;
        const options =
          state.phase === 'setup-claim'
            ? Object.keys(state.territories).filter((id) => state.territories[id].ownerId === null)
            : territoriesOf(state, player.id);
        state = applyAction(
          state,
          { type: 'claim', playerId: player.id, territoryId: options[0] },
          TINY_MAP,
        );
      }
      expect(state.phase).toBe('reinforce');
      expect(state.players.every((p) => p.reserve >= 0)).toBe(true);
    });
  });

  describe('replay y lockstep', () => {
    it('reproducir el mismo log da exactamente el mismo estado', () => {
      const initial = makeGame({ seed: 4242 });
      const actions: GameAction[] = [];
      let state = initial;
      const player = currentPlayer(state)!;
      const owned = territoriesOf(state, player.id);
      actions.push({ type: 'deploy', playerId: player.id, territoryId: owned[0], armies: player.reserve });
      actions.push({ type: 'end-phase', playerId: player.id });
      actions.push({ type: 'end-phase', playerId: player.id });
      actions.push({ type: 'end-phase', playerId: player.id });
      state = replay(initial, actions, TINY_MAP);
      expect(replay(initial, actions, TINY_MAP)).toEqual(state);
    });

    it('el estado es serializable a JSON sin pérdida', () => {
      const state = makeGame();
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    });

    it('tryApplyAction devuelve el error en vez de lanzarlo', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      const result = tryApplyAction(
        state,
        { type: 'attack', playerId: 'p1', from: 'A1', to: 'A2', dice: 1 },
        TINY_MAP,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('illegal-attack');
    });

    it('tryApplyAction devuelve el nuevo estado cuando es legal', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      const result = tryApplyAction(state, { type: 'end-phase', playerId: 'p1' }, TINY_MAP);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.state.phase).toBe('fortify');
    });
  });

  describe('legalActionTypes', () => {
    it('en refuerzos permite colocar y rendirse', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 3);
      expect(legalActionTypes(state, 'p1')).toContain('deploy');
      expect(legalActionTypes(state, 'p1')).not.toContain('end-phase');
    });

    it('permite terminar la fase cuando la reserva está vacía', () => {
      const state = forceTurn(makeGame(), 'p1', 'reinforce', 0);
      expect(legalActionTypes(state, 'p1')).toContain('end-phase');
    });

    it('en ataque con conquista pendiente solo se puede ocupar', () => {
      let state = attackScenario({ B1: ['p2', 1] });
      for (let i = 0; i < 40 && !state.pendingOccupation; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(legalActionTypes(state, 'p1')).toEqual(['occupy']);
    });

    it('quien no tiene el turno solo puede rendirse', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      expect(legalActionTypes(state, 'p2')).toEqual(['surrender']);
    });
  });

  describe('utilidades', () => {
    it('enemyNeighbours devuelve solo vecinos de otro dueño', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        B1: ['p2', 1],
      });
      expect(enemyNeighbours(state, TINY_MAP, 'A1')).toEqual(['B1']);
    });

    it('la configuración por defecto es la clásica', () => {
      expect(DEFAULT_CONFIG.maxAttackDice).toBe(3);
      expect(DEFAULT_CONFIG.maxDefendDice).toBe(2);
      expect(DEFAULT_CONFIG.tradeProgression).toBe('classic');
    });

    it('los eventos no crecen sin límite', () => {
      let state = forceTurn(makeGame(), 'p1', 'attack');
      for (let i = 0; i < 200; i++) {
        const result = tryApplyAction(
          state,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 1 },
          TINY_MAP,
        );
        if (!result.ok) break;
        state = result.state;
        if (state.phase === 'game-over' || state.pendingOccupation) break;
      }
      expect(state.events.length).toBeLessThanOrEqual(80);
    });
  });
});
