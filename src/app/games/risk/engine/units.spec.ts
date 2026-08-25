import { describe, expect, it } from 'vitest';
import {
  addUnit,
  applyCasualties,
  CASUALTY_ORDER,
  clearUnits,
  fortifyAllowance,
  hasUnit,
  infantryOf,
  specialistCount,
  trimUnits,
  unitCount,
  UNIT_KINDS,
  UNIT_META,
} from './units';
import { applyAction, createGame, DEFAULT_CONFIG, legalActionTypes } from './engine';
import { airReachOf, attackTargets, canAttack } from './rules';
import { approachOf, battleRulesFor } from './terrain';
import { conquestOdds } from './combat';
import { GameMap, GameState, TerritoryState, UnitKind } from './types';
import { TINY_MAP, TEST_PLAYERS, forceTurn, setBoard } from './testing';

/** Mapa de laboratorio con una ruta marítima, para probar flota y desembarco. */
function unitsMap(): GameMap {
  return {
    ...TINY_MAP,
    id: 'tiny-units',
    seaRoutes: [['A1', 'B3']],
    territories: TINY_MAP.territories.map((territory) => ({
      ...territory,
      adjacent:
        territory.id === 'A1'
          ? [...territory.adjacent, 'B3']
          : territory.id === 'B3'
            ? [...territory.adjacent, 'A1']
            : territory.adjacent,
    })),
  };
}

/** Partida avanzada con el tablero puesto a mano. */
function advancedGame(
  board: Parameters<typeof setBoard>[1],
  options: { terrain?: boolean; map?: GameMap } = {},
): { state: GameState; map: GameMap } {
  const map = options.map ?? unitsMap();
  let state = createGame({
    map,
    players: TEST_PLAYERS,
    seed: 4242,
    config: {
      ...DEFAULT_CONFIG,
      advancedUnits: true,
      advancedTerrain: options.terrain ?? false,
    },
  });
  state = setBoard(state, board);
  return { state, map };
}

const territory = (armies: number, units?: Partial<Record<UnitKind, number>>): TerritoryState => ({
  ownerId: 'p1',
  armies,
  ...(units ? { units } : {}),
});

describe('tropas especializadas', () => {
  describe('catálogo', () => {
    it('define las cuatro tropas con ficha completa', () => {
      expect(UNIT_KINDS).toEqual(['caballeria', 'blindado', 'naval', 'aereo']);
      for (const kind of UNIT_KINDS) {
        const meta = UNIT_META[kind];
        expect(meta.id).toBe(kind);
        expect(meta.name.length).toBeGreaterThan(2);
        expect(meta.glyph.length).toBeGreaterThan(0);
        expect(meta.cost).toBeGreaterThan(0);
        expect(meta.effect.length).toBeGreaterThan(10);
        expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('cada tropa tiene glifo y color propios', () => {
      expect(new Set(UNIT_KINDS.map((k) => UNIT_META[k].glyph)).size).toBe(UNIT_KINDS.length);
      expect(new Set(UNIT_KINDS.map((k) => UNIT_META[k].color)).size).toBe(UNIT_KINDS.length);
    });

    it('el orden de bajas cubre todas las tropas y es fijo', () => {
      expect([...CASUALTY_ORDER].sort()).toEqual([...UNIT_KINDS].sort());
      expect(CASUALTY_ORDER).toEqual(['caballeria', 'blindado', 'naval', 'aereo']);
    });
  });

  describe('un especialista es una ficha ascendida, no una ficha extra', () => {
    it('la infantería es lo que queda al descontar especialistas', () => {
      expect(infantryOf(territory(5))).toBe(5);
      expect(infantryOf(territory(5, { blindado: 2 }))).toBe(3);
      expect(infantryOf(territory(5, { blindado: 2, naval: 3 }))).toBe(0);
    });

    it('nunca cuenta infantería negativa', () => {
      expect(infantryOf(territory(1, { blindado: 3 }))).toBe(0);
    });

    it('cuenta especialistas y consulta por tipo', () => {
      const t = territory(6, { blindado: 2, aereo: 1 });
      expect(specialistCount(t.units)).toBe(3);
      expect(unitCount(t, 'blindado')).toBe(2);
      expect(unitCount(t, 'naval')).toBe(0);
      expect(hasUnit(t, 'aereo')).toBe(true);
      expect(hasUnit(t, 'naval')).toBe(false);
      expect(hasUnit(undefined, 'naval')).toBe(false);
      expect(specialistCount(undefined)).toBe(0);
    });

    it('ascender no cambia el número de fichas', () => {
      const t = territory(4);
      addUnit(t, 'blindado');
      expect(t.armies).toBe(4);
      expect(infantryOf(t)).toBe(3);
    });
  });

  describe('bajas', () => {
    it('la infantería cae primero', () => {
      const t = territory(5, { blindado: 2 });
      applyCasualties(t, 2);
      expect(t.armies).toBe(3);
      expect(unitCount(t, 'blindado')).toBe(2);
      expect(infantryOf(t)).toBe(1);
    });

    it('cuando se acaba la infantería caen los especialistas, en orden', () => {
      const t = territory(4, { caballeria: 1, blindado: 1, aereo: 1 });
      applyCasualties(t, 2); // se lleva la infantería y la caballería
      expect(t.armies).toBe(2);
      expect(hasUnit(t, 'caballeria')).toBe(false);
      expect(hasUnit(t, 'blindado')).toBe(true);
      expect(hasUnit(t, 'aereo')).toBe(true);
    });

    it('un territorio arrasado se queda sin tropas', () => {
      const t = territory(3, { blindado: 2, aereo: 1 });
      applyCasualties(t, 3);
      expect(t.armies).toBe(0);
      expect(t.units).toBeUndefined();
    });

    it('nunca deja más especialistas que fichas', () => {
      const t = territory(6, { blindado: 2, naval: 2, aereo: 2 });
      applyCasualties(t, 3);
      expect(specialistCount(t.units)).toBeLessThanOrEqual(t.armies);
    });

    it('trimUnits borra el desglose cuando ya no queda ninguno', () => {
      const t = territory(0, { blindado: 1 });
      trimUnits(t);
      expect(t.units).toBeUndefined();
    });

    it('clearUnits vacía el territorio de especialistas', () => {
      const t = territory(5, { naval: 2 });
      clearUnits(t);
      expect(t.units).toBeUndefined();
      expect(infantryOf(t)).toBe(5);
    });
  });

  describe('ascender tropas', () => {
    it('cuesta reserva y no añade ejércitos', () => {
      const { state, map } = advancedGame({ A1: ['p1', 5] });
      const before = state.territories['A1'].armies;
      const next = applyAction(
        forceTurn(state, 'p1', 'reinforce', 9),
        { type: 'upgrade', playerId: 'p1', territoryId: 'A1', unit: 'blindado' },
        map,
      );
      expect(next.territories['A1'].armies).toBe(before);
      expect(unitCount(next.territories['A1'], 'blindado')).toBe(1);
      expect(next.players.find((p) => p.id === 'p1')!.reserve).toBe(9 - UNIT_META.blindado.cost);
    });

    it('sin modo avanzado la acción no existe', () => {
      const map = unitsMap();
      let state = createGame({ map, players: TEST_PLAYERS, seed: 1 });
      state = setBoard(state, { A1: ['p1', 5] });
      state = forceTurn(state, 'p1', 'reinforce', 9);
      expect(() =>
        applyAction(state, { type: 'upgrade', playerId: 'p1', territoryId: 'A1', unit: 'blindado' }, map),
      ).toThrow(/tropas especializadas/);
    });

    it('no se puede ascender sin reserva suficiente', () => {
      const { state, map } = advancedGame({ A1: ['p1', 5] });
      expect(() =>
        applyAction(
          forceTurn(state, 'p1', 'reinforce', 1),
          { type: 'upgrade', playerId: 'p1', territoryId: 'A1', unit: 'aereo' },
          map,
        ),
      ).toThrow(/cuesta/);
    });

    it('no se puede ascender en territorio ajeno', () => {
      const { state, map } = advancedGame({ A1: ['p1', 5], B1: ['p2', 5] });
      expect(() =>
        applyAction(
          forceTurn(state, 'p1', 'reinforce', 9),
          { type: 'upgrade', playerId: 'p1', territoryId: 'B1', unit: 'blindado' },
          map,
        ),
      ).toThrow(/no es tuyo/);
    });

    it('no se puede ascender si no queda infantería', () => {
      const { state, map } = advancedGame({ A1: ['p1', 2] });
      let ready = forceTurn(state, 'p1', 'reinforce', 20);
      ready.territories['A1'].units = { blindado: 2 };
      expect(() =>
        applyAction(ready, { type: 'upgrade', playerId: 'p1', territoryId: 'A1', unit: 'naval' }, map),
      ).toThrow(/infantería/);
    });

    it('solo en la fase de refuerzos', () => {
      const { state, map } = advancedGame({ A1: ['p1', 5], B1: ['p2', 2] });
      expect(() =>
        applyAction(
          forceTurn(state, 'p1', 'attack', 9),
          { type: 'upgrade', playerId: 'p1', territoryId: 'A1', unit: 'blindado' },
          map,
        ),
      ).toThrow(/refuerzos/);
    });

    it('aparece en el menú de acciones legales cuando toca', () => {
      const { state } = advancedGame({ A1: ['p1', 5] });
      const rich = forceTurn(state, 'p1', 'reinforce', 9);
      expect(legalActionTypes(rich, 'p1')).toContain('upgrade');

      const poor = forceTurn(state, 'p1', 'reinforce', 1);
      expect(legalActionTypes(poor, 'p1')).not.toContain('upgrade');
    });

    it('en una partida clásica nunca aparece en el menú', () => {
      const map = unitsMap();
      let state = createGame({ map, players: TEST_PLAYERS, seed: 1 });
      state = setBoard(state, { A1: ['p1', 5] });
      expect(legalActionTypes(forceTurn(state, 'p1', 'reinforce', 20), 'p1')).not.toContain('upgrade');
    });
  });

  describe('blindados', () => {
    it('dan +1 al mejor dado atacando por tierra', () => {
      const { state, map } = advancedGame({ A1: ['p1', 8, ], A2: ['p2', 4] });
      state.territories['A1'].units = { blindado: 1 };
      const rules = battleRulesFor(map, state.config, 'A1', 'A2', state.territories['A1']);
      expect(rules.attackBonus).toEqual([1]);
    });

    it('no vuelan: en un ataque aéreo no aportan nada', () => {
      const { state, map } = advancedGame({ A1: ['p1', 8], B2: ['p2', 4] });
      // B2 no es vecino de A1 en el mapa de laboratorio: solo se llega volando.
      state.territories['A1'].units = { aereo: 1 };
      expect(approachOf(map, 'A1', 'B2', state.territories['A1'])).toBe('aereo');
      const soloAvion = battleRulesFor(map, state.config, 'A1', 'B2', state.territories['A1']);

      // Sumarle blindados no cambia nada: los tanques no van en el avión.
      state.territories['A1'].units = { aereo: 1, blindado: 1 };
      const conTanques = battleRulesFor(map, state.config, 'A1', 'B2', state.territories['A1']);
      expect(conTanques.attackBonus).toEqual(soloAvion.attackBonus);
    });

    it('en montaña o bosque tampoco maniobran', () => {
      const map = {
        ...unitsMap(),
        id: 'tiny-units-monte',
        territories: unitsMap().territories.map((t) =>
          t.id === 'A2' ? { ...t, terrain: 'montaña' as const } : t,
        ),
      };
      const { state } = advancedGame({ A1: ['p1', 8], A2: ['p2', 4] }, { map, terrain: true });
      state.territories['A1'].units = { blindado: 1 };
      expect(battleRulesFor(map, state.config, 'A1', 'A2', state.territories['A1']).attackBonus).toEqual(
        [],
      );
    });

    it('defendiendo en abierto son una barrera, en monte no', () => {
      const abierto = advancedGame({ A1: ['p1', 8], A2: ['p2', 4] }, { terrain: true });
      abierto.state.territories['A2'].units = { blindado: 1 };
      expect(
        battleRulesFor(
          abierto.map,
          abierto.state.config,
          'A1',
          'A2',
          abierto.state.territories['A1'],
          abierto.state.territories['A2'],
        ).defenceBonus,
      ).toEqual([0, 1]);

      const monte = {
        ...unitsMap(),
        id: 'tiny-units-monte-def',
        territories: unitsMap().territories.map((t) =>
          t.id === 'A2' ? { ...t, terrain: 'montaña' as const } : t,
        ),
      };
      const enMonte = advancedGame({ A1: ['p1', 8], A2: ['p2', 4] }, { map: monte, terrain: true });
      enMonte.state.territories['A2'].units = { blindado: 1 };
      const bonus = battleRulesFor(
        monte,
        enMonte.state.config,
        'A1',
        'A2',
        enMonte.state.territories['A1'],
        enMonte.state.territories['A2'],
      ).defenceBonus;
      // Solo queda lo del terreno (montaña: +1 al mejor); el blindado no suma.
      expect(bonus).toEqual([1]);
    });

    it('mejoran de verdad las probabilidades', () => {
      const { state, map } = advancedGame({ A1: ['p1', 10], A2: ['p2', 5] });
      const plain = battleRulesFor(map, state.config, 'A1', 'A2', state.territories['A1']);
      state.territories['A1'].units = { blindado: 1 };
      const armoured = battleRulesFor(map, state.config, 'A1', 'A2', state.territories['A1']);
      expect(conquestOdds(10, 5, armoured)).toBeGreaterThan(conquestOdds(10, 5, plain));
    });

    it('sin modo avanzado no hacen nada', () => {
      const map = unitsMap();
      let state = createGame({ map, players: TEST_PLAYERS, seed: 1 });
      state = setBoard(state, { A1: ['p1', 8], A2: ['p2', 4] });
      state.territories['A1'].units = { blindado: 1 };
      expect(battleRulesFor(map, state.config, 'A1', 'A2', state.territories['A1']).attackBonus).toEqual(
        [],
      );
    });
  });

  describe('flota', () => {
    it('convierte el desembarco en un paso normal', () => {
      const { state, map } = advancedGame({ A1: ['p1', 8], B3: ['p2', 4] }, { terrain: true });
      expect(approachOf(map, 'A1', 'B3', state.territories['A1'])).toBe('desembarco');
      state.territories['A1'].units = { naval: 1 };
      expect(approachOf(map, 'A1', 'B3', state.territories['A1'])).toBe('tierra');
    });

    it('devuelve el tercer dado al que cruza el mar', () => {
      const { state, map } = advancedGame({ A1: ['p1', 8], B3: ['p2', 4] }, { terrain: true });
      expect(battleRulesFor(map, state.config, 'A1', 'B3', state.territories['A1']).attack).toBe(2);
      state.territories['A1'].units = { naval: 1 };
      expect(battleRulesFor(map, state.config, 'A1', 'B3', state.territories['A1']).attack).toBe(3);
    });

    it('la flota del defensor no le devuelve el dado al atacante', () => {
      const { state, map } = advancedGame({ A1: ['p1', 8], B3: ['p2', 4] }, { terrain: true });
      state.territories['B3'].units = { naval: 1 };
      expect(battleRulesFor(map, state.config, 'A1', 'B3', state.territories['A1']).attack).toBe(2);
    });

    it('la flota del defensor bate la playa del que desembarca', () => {
      const { state, map } = advancedGame({ A1: ['p1', 8], B3: ['p2', 4] }, { terrain: true });
      const sinFlota = battleRulesFor(
        map,
        state.config,
        'A1',
        'B3',
        state.territories['A1'],
        state.territories['B3'],
      ).defenceBonus;
      state.territories['B3'].units = { naval: 1 };
      const conFlota = battleRulesFor(
        map,
        state.config,
        'A1',
        'B3',
        state.territories['A1'],
        state.territories['B3'],
      ).defenceBonus;
      expect(conFlota?.[0] ?? 0).toBeGreaterThan(sinFlota?.[0] ?? 0);
    });
  });

  describe('aviación', () => {
    it('alcanza los vecinos de sus vecinos, no los propios vecinos', () => {
      const { state, map } = advancedGame({ A1: ['p1', 6], A3: ['p2', 2], B3: ['p2', 2] });
      state.territories['A1'].units = { aereo: 1 };
      const reach = airReachOf(state, map, 'A1');
      expect(reach).toContain('A3');
      expect(reach).not.toContain('A2'); // vecino directo
      expect(reach).not.toContain('A1');
    });

    it('sin aviación no alcanza nada', () => {
      const { state, map } = advancedGame({ A1: ['p1', 6] });
      expect(airReachOf(state, map, 'A1')).toEqual([]);
    });

    it('sin modo avanzado no alcanza nada aunque haya aviación', () => {
      const map = unitsMap();
      let state = createGame({ map, players: TEST_PLAYERS, seed: 1 });
      state = setBoard(state, { A1: ['p1', 6] });
      state.territories['A1'].units = { aereo: 1 };
      expect(airReachOf(state, map, 'A1')).toEqual([]);
    });

    it('permite atacar sin frontera', () => {
      const { state, map } = advancedGame({ A1: ['p1', 6], A3: ['p2', 2] });
      expect(canAttack(state, map, 'A1', 'A3', 'p1')).toBe(false);
      state.territories['A1'].units = { aereo: 1 };
      expect(canAttack(state, map, 'A1', 'A3', 'p1')).toBe(true);
      expect(attackTargets(state, map, 'A1', 'p1')).toContain('A3');
    });

    it('el ataque aéreo se queda en 2 dados', () => {
      const { state, map } = advancedGame({ A1: ['p1', 10], A3: ['p2', 3] });
      state.territories['A1'].units = { aereo: 1 };
      expect(battleRulesFor(map, state.config, 'A1', 'A3', state.territories['A1']).attack).toBe(2);
      expect(() =>
        applyAction(
          forceTurn(state, 'p1', 'attack'),
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'A3', dice: 3 },
          map,
        ),
      ).toThrow(/entre 1 y 2 dados/);
    });

    it('un ataque aéreo conquista igual que cualquier otro', () => {
      const { state, map } = advancedGame({ A1: ['p1', 30], A3: ['p2', 1] });
      state.territories['A1'].units = { aereo: 1 };
      let current = forceTurn(state, 'p1', 'attack');
      for (let i = 0; i < 30 && current.territories['A3'].ownerId !== 'p1'; i++) {
        if (current.pendingOccupation) break;
        current = applyAction(
          current,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'A3', dice: 2 },
          map,
        );
      }
      expect(current.territories['A3'].ownerId).toBe('p1');
    });
  });

  describe('caballería', () => {
    it('sin ella solo se reagrupa una vez', () => {
      expect(fortifyAllowance(false)).toBe(1);
      const { state, map } = advancedGame({ A1: ['p1', 6], A2: ['p1', 3] });
      const after = applyAction(
        forceTurn(state, 'p1', 'fortify'),
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 2 },
        map,
      );
      // Sin caballería la reagrupación cierra el turno, como siempre.
      expect(after.phase).not.toBe('fortify');
    });

    it('con ella se puede reagrupar dos veces y el turno no se cierra a la primera', () => {
      expect(fortifyAllowance(true)).toBe(2);
      const { state, map } = advancedGame({ A1: ['p1', 6], A2: ['p1', 3], A3: ['p1', 3] });
      state.territories['A1'].units = { caballeria: 1 };
      const first = applyAction(
        forceTurn(state, 'p1', 'fortify'),
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 2 },
        map,
      );
      expect(first.phase).toBe('fortify');
      expect(legalActionTypes(first, 'p1')).toContain('fortify');

      const second = applyAction(
        first,
        { type: 'fortify', playerId: 'p1', from: 'A2', to: 'A3', armies: 1 },
        map,
      );
      expect(second.phase).not.toBe('fortify');
    });

    it('agotado el cupo, otra reagrupación se rechaza', () => {
      // El cupo se lleva en el estado, así que se comprueba en el límite: con
      // caballería son dos, sin ella una.
      const { state, map } = advancedGame({ A1: ['p1', 8], A2: ['p1', 3] });
      const withCavalry = forceTurn(state, 'p1', 'fortify');
      withCavalry.territories['A1'].units = { caballeria: 1 };
      withCavalry.fortifyCount = 2;
      expect(() =>
        applyAction(
          withCavalry,
          { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 1 },
          map,
        ),
      ).toThrow(/reagrupaciones/);

      const withoutCavalry = forceTurn(state, 'p1', 'fortify');
      withoutCavalry.fortifyCount = 1;
      expect(() =>
        applyAction(
          withoutCavalry,
          { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 1 },
          map,
        ),
      ).toThrow(/reagrupaciones/);
    });

    it('la caballería del jugador vale esté donde esté', () => {
      // El cupo es del jugador, no del territorio desde el que se mueve.
      const { state, map } = advancedGame({ A1: ['p1', 6], A2: ['p1', 3], A3: ['p1', 3] });
      state.territories['A3'].units = { caballeria: 1 };
      const first = applyAction(
        forceTurn(state, 'p1', 'fortify'),
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 2 },
        map,
      );
      expect(first.phase).toBe('fortify');
    });

    it('una partida vieja sin contador se lee del booleano', () => {
      const { state, map } = advancedGame({ A1: ['p1', 6], A2: ['p1', 3] });
      const legacy = forceTurn(state, 'p1', 'fortify');
      delete legacy.fortifyCount;
      legacy.fortifiedThisTurn = true;
      expect(() =>
        applyAction(legacy, { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 1 }, map),
      ).toThrow(/reagrupaciones/);
    });
  });

  describe('los especialistas no viajan', () => {
    it('se quedan cuando el ejército reagrupa', () => {
      const { state, map } = advancedGame({ A1: ['p1', 6], A2: ['p1', 3] });
      state.territories['A1'].units = { blindado: 1 };
      const after = applyAction(
        forceTurn(state, 'p1', 'fortify'),
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 3 },
        map,
      );
      expect(unitCount(after.territories['A1'], 'blindado')).toBe(1);
      expect(after.territories['A2'].units).toBeUndefined();
    });

    it('se recortan si el territorio se queda con menos fichas que tropas', () => {
      const { state, map } = advancedGame({ A1: ['p1', 5], A2: ['p1', 1] });
      state.territories['A1'].units = { blindado: 2, naval: 2 };
      const after = applyAction(
        forceTurn(state, 'p1', 'fortify'),
        { type: 'fortify', playerId: 'p1', from: 'A1', to: 'A2', armies: 4 },
        map,
      );
      expect(after.territories['A1'].armies).toBe(1);
      expect(specialistCount(after.territories['A1'].units)).toBeLessThanOrEqual(1);
    });

    it('el territorio conquistado pierde las tropas del que lo defendía', () => {
      const { state, map } = advancedGame({ A1: ['p1', 30], A2: ['p2', 1] });
      state.territories['A2'].units = { blindado: 1 };
      let current = forceTurn(state, 'p1', 'attack');
      for (let i = 0; i < 30 && !current.pendingOccupation; i++) {
        current = applyAction(
          current,
          { type: 'attack', playerId: 'p1', from: 'A1', to: 'A2', dice: 3 },
          map,
        );
      }
      expect(current.territories['A2'].ownerId).toBe('p1');
      expect(current.territories['A2'].units).toBeUndefined();
    });
  });

  describe('invariante: nunca más tropas que fichas', () => {
    it('se mantiene a lo largo de una partida entera de bots', async () => {
      const { decideAction } = await import('./ai/bot-brain');
      const { currentPlayer } = await import('./engine');
      const map = unitsMap();
      let state = createGame({
        map,
        seed: 77,
        players: [
          { id: 'p1', name: 'Ada', kind: 'bot', botProfile: 'agresivo' },
          { id: 'p2', name: 'Bram', kind: 'bot', botProfile: 'cauto' },
        ],
        config: { ...DEFAULT_CONFIG, advancedUnits: true, advancedTerrain: true },
      });
      let actions = 0;
      while (state.phase !== 'game-over' && actions < 3000) {
        const player = currentPlayer(state);
        if (!player) break;
        const action = decideAction(state, map, player.id);
        if (!action) break;
        state = applyAction(state, action, map);
        actions++;
        for (const [id, t] of Object.entries(state.territories)) {
          expect(specialistCount(t.units), `${id} en la acción ${actions}`).toBeLessThanOrEqual(
            t.armies,
          );
        }
      }
      expect(state.phase).toBe('game-over');
    }, 30000);
  });
});
