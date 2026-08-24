import { describe, expect, it } from 'vitest';
import {
  activePlayers,
  adjacencyOf,
  areConnected,
  armiesOf,
  attackSources,
  attackTargets,
  borderTerritories,
  canAttack,
  continentsOf,
  interiorTerritories,
  isMapConnected,
  reinforcementBreakdown,
  reinforcementsFor,
  startingArmiesFor,
  territoriesOf,
} from './rules';
import { GameMap } from './types';
import { TINY_MAP, makeGame, setBoard } from './testing';
import { createGame } from './engine';
import { WORLD_MAP } from './maps/world.map';

/** Tablero de referencia: p1 tiene todo Alfa, p2 todo Beta. */
function splitBoard() {
  return setBoard(makeGame(), {
    A1: ['p1', 3],
    A2: ['p1', 5],
    A3: ['p1', 1],
    B1: ['p2', 2],
    B2: ['p2', 4],
    B3: ['p2', 1],
  });
}

describe('reglas', () => {
  describe('startingArmiesFor', () => {
    it('usa la tabla clásica', () => {
      expect(startingArmiesFor(2)).toBe(40);
      expect(startingArmiesFor(3)).toBe(35);
      expect(startingArmiesFor(4)).toBe(30);
      expect(startingArmiesFor(5)).toBe(25);
      expect(startingArmiesFor(6)).toBe(20);
    });

    it('decrece al añadir jugadores', () => {
      for (let n = 2; n < 6; n++) {
        expect(startingArmiesFor(n)).toBeGreaterThan(startingArmiesFor(n + 1));
      }
    });

    it('devuelve un valor razonable fuera de la tabla', () => {
      expect(startingArmiesFor(9)).toBeGreaterThanOrEqual(20);
    });
  });

  describe('territoriesOf y armiesOf', () => {
    it('cuenta los territorios de cada jugador', () => {
      const state = splitBoard();
      expect(territoriesOf(state, 'p1').sort()).toEqual(['A1', 'A2', 'A3']);
      expect(territoriesOf(state, 'p2').sort()).toEqual(['B1', 'B2', 'B3']);
    });

    it('suma los ejércitos', () => {
      const state = splitBoard();
      expect(armiesOf(state, 'p1')).toBe(9);
      expect(armiesOf(state, 'p2')).toBe(7);
    });

    it('devuelve vacío para un jugador sin territorios', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 1],
        B2: ['p1', 1],
        B3: ['p1', 1],
      });
      expect(territoriesOf(state, 'p2')).toEqual([]);
      expect(armiesOf(state, 'p2')).toBe(0);
    });
  });

  describe('continentsOf', () => {
    it('reconoce los continentes completos', () => {
      const state = splitBoard();
      expect(continentsOf(state, TINY_MAP, 'p1')).toEqual(['alpha']);
      expect(continentsOf(state, TINY_MAP, 'p2')).toEqual(['beta']);
    });

    it('no cuenta continentes incompletos', () => {
      const state = setBoard(splitBoard(), { A3: ['p2', 1] });
      expect(continentsOf(state, TINY_MAP, 'p1')).toEqual([]);
    });
  });

  describe('reinforcementsFor', () => {
    it('da el mínimo de 3 con pocos territorios', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p2', 1],
        A3: ['p2', 1],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p2', 1],
      });
      expect(reinforcementsFor(state, TINY_MAP, 'p1')).toBe(3);
    });

    it('suma la bonificación del continente completo', () => {
      const state = splitBoard();
      // 3 territorios -> max(3, 1) = 3, más 3 de Alfa
      expect(reinforcementsFor(state, TINY_MAP, 'p1')).toBe(6);
      expect(reinforcementsFor(state, TINY_MAP, 'p2')).toBe(5);
    });

    it('da 0 a quien no tiene nada', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 1],
        B2: ['p1', 1],
        B3: ['p1', 1],
      });
      expect(reinforcementsFor(state, TINY_MAP, 'p2')).toBe(0);
    });

    it('escala con el número de territorios', () => {
      const world = createGame({
        map: WORLD_MAP,
        seed: 1,
        players: [
          { id: 'p1', name: 'A', kind: 'bot' },
          { id: 'p2', name: 'B', kind: 'bot' },
        ],
      });
      const many: Record<string, [string, number]> = {};
      for (const territory of WORLD_MAP.territories) many[territory.id] = ['p2', 1];
      // 12 territorios sueltos de continentes distintos: sin bonificación.
      const spread = ['AK', 'BZ', 'IC', 'NF', 'UR', 'ID', 'QC', 'AG', 'GB', 'EG', 'JP', 'NG'];
      for (const id of spread) many[id] = ['p1', 1];
      const state = setBoard(world, many as never);
      const breakdown = reinforcementBreakdown(state, WORLD_MAP, 'p1');
      expect(breakdown.base).toBe(4);
      expect(breakdown.continents).toEqual([]);
      expect(reinforcementsFor(state, WORLD_MAP, 'p1')).toBe(4);
    });
  });

  describe('reinforcementBreakdown', () => {
    it('explica de dónde sale cada ejército', () => {
      const breakdown = reinforcementBreakdown(splitBoard(), TINY_MAP, 'p1');
      expect(breakdown.base).toBe(3);
      expect(breakdown.continents).toEqual([{ id: 'alpha', name: 'Alfa', bonus: 3 }]);
      expect(breakdown.total).toBe(6);
    });

    it('el total coincide siempre con reinforcementsFor', () => {
      const state = splitBoard();
      for (const playerId of ['p1', 'p2']) {
        expect(reinforcementBreakdown(state, TINY_MAP, playerId).total).toBe(
          reinforcementsFor(state, TINY_MAP, playerId),
        );
      }
    });
  });

  describe('canAttack', () => {
    const state = splitBoard();

    it('permite atacar a un vecino enemigo con 2 o más ejércitos', () => {
      expect(canAttack(state, TINY_MAP, 'A1', 'B1', 'p1')).toBe(true);
    });

    it('no permite atacar con un solo ejército', () => {
      expect(canAttack(state, TINY_MAP, 'A3', 'B3', 'p1')).toBe(false);
    });

    it('no permite atacar a los tuyos', () => {
      expect(canAttack(state, TINY_MAP, 'A1', 'A2', 'p1')).toBe(false);
    });

    it('no permite atacar desde territorio ajeno', () => {
      expect(canAttack(state, TINY_MAP, 'B1', 'A1', 'p1')).toBe(false);
    });

    it('no permite atacar a territorios no adyacentes', () => {
      expect(canAttack(state, TINY_MAP, 'A1', 'B3', 'p1')).toBe(false);
    });

    it('devuelve false con territorios inexistentes', () => {
      expect(canAttack(state, TINY_MAP, 'ZZ', 'B1', 'p1')).toBe(false);
      expect(canAttack(state, TINY_MAP, 'A1', 'ZZ', 'p1')).toBe(false);
    });
  });

  describe('areConnected', () => {
    it('reconoce el camino directo', () => {
      expect(areConnected(splitBoard(), TINY_MAP, 'A1', 'A2', 'p1')).toBe(true);
    });

    it('reconoce el camino con escalas', () => {
      expect(areConnected(splitBoard(), TINY_MAP, 'A1', 'A3', 'p1')).toBe(true);
    });

    it('no conecta a través de territorio enemigo', () => {
      const state = setBoard(splitBoard(), { A2: ['p2', 1] });
      expect(areConnected(state, TINY_MAP, 'A1', 'A3', 'p1')).toBe(false);
    });

    it('un territorio no está conectado consigo mismo', () => {
      expect(areConnected(splitBoard(), TINY_MAP, 'A1', 'A1', 'p1')).toBe(false);
    });

    it('exige que ambos extremos sean del jugador', () => {
      expect(areConnected(splitBoard(), TINY_MAP, 'A1', 'B1', 'p1')).toBe(false);
      expect(areConnected(splitBoard(), TINY_MAP, 'B1', 'A1', 'p1')).toBe(false);
    });
  });

  describe('fronteras e interior', () => {
    it('todo es frontera cuando los continentes están enfrentados', () => {
      const state = splitBoard();
      expect(borderTerritories(state, TINY_MAP, 'p1').sort()).toEqual(['A1', 'A2', 'A3']);
      expect(interiorTerritories(state, TINY_MAP, 'p1')).toEqual([]);
    });

    it('distingue interior de frontera', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 1],
        B2: ['p1', 1],
        B3: ['p2', 1],
      });
      expect(interiorTerritories(state, TINY_MAP, 'p1')).toContain('A1');
      expect(borderTerritories(state, TINY_MAP, 'p1')).toContain('A3');
    });

    it('frontera e interior son conjuntos complementarios', () => {
      const state = splitBoard();
      const owned = territoriesOf(state, 'p1').sort();
      const combined = [
        ...borderTerritories(state, TINY_MAP, 'p1'),
        ...interiorTerritories(state, TINY_MAP, 'p1'),
      ].sort();
      expect(combined).toEqual(owned);
    });
  });

  describe('attackSources y attackTargets', () => {
    it('solo lista orígenes con 2 o más ejércitos y enemigos al lado', () => {
      const state = splitBoard();
      expect(attackSources(state, TINY_MAP, 'p1').sort()).toEqual(['A1', 'A2']);
    });

    it('lista los objetivos enemigos alcanzables', () => {
      const state = splitBoard();
      expect(attackTargets(state, TINY_MAP, 'A1', 'p1').sort()).toEqual(['B1']);
      expect(attackTargets(state, TINY_MAP, 'A2', 'p1').sort()).toEqual(['B1', 'B2']);
    });

    it('cada objetivo es atacable de verdad', () => {
      const state = splitBoard();
      for (const from of attackSources(state, TINY_MAP, 'p1')) {
        for (const to of attackTargets(state, TINY_MAP, from, 'p1')) {
          expect(canAttack(state, TINY_MAP, from, to, 'p1')).toBe(true);
        }
      }
    });
  });

  describe('adjacencyOf', () => {
    it('devuelve la adyacencia declarada', () => {
      expect(adjacencyOf(TINY_MAP, 'A1').sort()).toEqual(['A2', 'B1']);
    });

    it('devuelve vacío para un territorio desconocido', () => {
      expect(adjacencyOf(TINY_MAP, 'ZZ')).toEqual([]);
    });

    it('cachea el índice por mapa', () => {
      expect(adjacencyOf(WORLD_MAP, 'AK')).toBe(adjacencyOf(WORLD_MAP, 'AK'));
    });
  });

  describe('activePlayers', () => {
    it('excluye a los eliminados', () => {
      const state = makeGame();
      state.players[1].eliminated = true;
      expect(activePlayers(state).map((p) => p.id)).toEqual(['p1']);
    });
  });

  describe('isMapConnected', () => {
    it('acepta los mapas reales', () => {
      expect(isMapConnected(WORLD_MAP)).toBe(true);
      expect(isMapConnected(TINY_MAP)).toBe(true);
    });

    it('rechaza un mapa con una isla suelta', () => {
      const broken: GameMap = {
        ...TINY_MAP,
        territories: [
          ...TINY_MAP.territories,
          {
            id: 'ISLA',
            name: 'Isla',
            continentId: 'alpha',
            adjacent: [],
            hexes: [[9, 9]],
          },
        ],
      };
      expect(isMapConnected(broken)).toBe(false);
    });

    it('rechaza un mapa sin territorios', () => {
      expect(isMapConnected({ ...TINY_MAP, territories: [] })).toBe(false);
    });
  });
});
