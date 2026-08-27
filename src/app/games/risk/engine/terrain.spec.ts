import { describe, expect, it } from 'vitest';
import {
  approachOf,
  battleRulesFor,
  DEFAULT_TERRAIN,
  isLandBridge,
  isSeaRoute,
  terrainOf,
  terrainAssault,
  terrainDefence,
  terrainPairRules,
  addBonus,
  capNet,
  MAX_NET_SHIFT,
  TERRAINS,
  TERRAIN_META,
} from './terrain';
import { conquestOdds, CLASSIC_RULES, resolveCombat } from './combat';
import { createRng } from './rng';
import { applyAction, createGame, DEFAULT_CONFIG } from './engine';
import { GameMap, Terrain } from './types';
import { RISK_MAPS } from './maps/map-registry';
import { TINY_MAP, TEST_PLAYERS, forceTurn, setBoard } from './testing';

/**
 * Un mapa de laboratorio con orografía: dos territorios por tierra y uno al que
 * solo se llega por mar, para poder probar el desembarco.
 */
function terrainMap(terrains: Partial<Record<string, Terrain>>): GameMap {
  return {
    ...TINY_MAP,
    id: `tiny-terrain-${Object.entries(terrains).map(([k, v]) => `${k}${v}`).join('-')}`,
    seaRoutes: [['A1', 'B3']],
    territories: TINY_MAP.territories.map((territory) => ({
      ...territory,
      ...(terrains[territory.id] !== undefined && { terrain: terrains[territory.id] }),
      adjacent:
        territory.id === 'A1'
          ? [...territory.adjacent, 'B3']
          : territory.id === 'B3'
            ? [...territory.adjacent, 'A1']
            : territory.adjacent,
    })),
  };
}

describe('orografía', () => {
  describe('catálogo de terrenos', () => {
    it('los cinco terrenos tienen ficha completa', () => {
      expect(TERRAINS).toEqual(['llanura', 'bosque', 'montaña', 'desierto', 'costa']);
      for (const terrain of TERRAINS) {
        const meta = TERRAIN_META[terrain];
        expect(meta.id).toBe(terrain);
        expect(meta.name.length).toBeGreaterThan(0);
        expect(meta.glyph.length).toBeGreaterThan(0);
        expect(meta.defence.length).toBeGreaterThan(10);
        expect(meta.assault.length).toBeGreaterThan(10);
        expect(meta.tint).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('cada terreno tiene un glifo y un tinte distintos', () => {
      const glyphs = TERRAINS.map((t) => TERRAIN_META[t].glyph);
      const tints = TERRAINS.map((t) => TERRAIN_META[t].tint);
      expect(new Set(glyphs).size).toBe(TERRAINS.length);
      expect(new Set(tints).size).toBe(TERRAINS.length);
    });

    it('el terreno por defecto es la llanura, o sea el juego clásico', () => {
      expect(DEFAULT_TERRAIN).toBe('llanura');
      expect(terrainDefence('llanura', 'tierra')).toEqual([]);
      expect(terrainAssault('llanura', 'tierra')).toEqual([]);
      expect(CLASSIC_RULES.defenceBonus).toEqual([]);
    });
  });

  describe('el terreno tiene dos mitades', () => {
    it('la llanura no toca nada, ni defendiendo ni atacando', () => {
      expect(terrainDefence('llanura', 'tierra')).toEqual([]);
      expect(terrainAssault('llanura', 'tierra')).toEqual([]);
    });

    it('defendiendo: la montaña refuerza el mejor dado', () => {
      expect(terrainDefence('montaña', 'tierra')).toEqual([1]);
    });

    it('defendiendo: el bosque refuerza el segundo, no el mejor', () => {
      expect(terrainDefence('bosque', 'tierra')).toEqual([0, 1]);
    });

    it('defendiendo: el desierto penaliza el segundo', () => {
      expect(terrainDefence('desierto', 'tierra')).toEqual([0, -1]);
    });

    it('defendiendo: la costa solo vale contra un desembarco', () => {
      expect(terrainDefence('costa', 'tierra')).toEqual([]);
      expect(terrainDefence('costa', 'desembarco')).toEqual([1]);
    });

    it('atacando: salir de un bosque da sorpresa en el mejor dado', () => {
      expect(terrainAssault('bosque', 'tierra')).toEqual([1]);
    });

    it('atacando: bajar de una montaña empuja el segundo dado', () => {
      expect(terrainAssault('montaña', 'tierra')).toEqual([0, 1]);
    });

    it('atacando: cruzar un desierto se ve venir', () => {
      expect(terrainAssault('desierto', 'tierra')).toEqual([0, -1]);
    });

    it('quien cruza el mar o llega volando deja atrás el suelo del que salió', () => {
      for (const terrain of TERRAINS) {
        expect(terrainAssault(terrain, 'desembarco'), terrain).toEqual([]);
        expect(terrainAssault(terrain, 'aereo'), terrain).toEqual([]);
      }
    });

    it('cada mitad mueve como mucho un dado, y como mucho en uno', () => {
      for (const terrain of TERRAINS) {
        for (const approach of ['tierra', 'desembarco', 'aereo'] as const) {
          for (const bonus of [
            terrainDefence(terrain, approach),
            terrainAssault(terrain, approach),
          ]) {
            expect(bonus.filter((value: number) => value !== 0).length).toBeLessThanOrEqual(1);
            for (const value of bonus) expect(Math.abs(value)).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });

  describe('suma de bonificaciones', () => {
    it('suma elemento a elemento', () => {
      expect(addBonus([1], [0, 1])).toEqual([1, 1]);
      expect(addBonus([0, 1], [0, -1])).toEqual([0, 0]);
    });

    it('el acotado deja un paso en cada dirección, no más', () => {
      expect(capNet([5])).toEqual([MAX_NET_SHIFT]);
      expect(capNet([-5])).toEqual([-MAX_NET_SHIFT]);
      // Dos a favor del mismo lado: solo cuenta uno.
      expect(capNet([1, 1])).toEqual([1, 0]);
      // Uno para cada lado: los dos se quedan.
      expect(capNet([1, -1])).toEqual([1, -1]);
    });

    it('el vector vacío es el elemento neutro', () => {
      expect(addBonus([], [1, -1])).toEqual([1, -1]);
      expect(addBonus([1, -1], [])).toEqual([1, -1]);
    });
  });

  describe('lo que cuenta es la pareja de terrenos', () => {
    const odds = (from: Terrain, to: Terrain) => conquestOdds(8, 8, terrainPairRules(from, to));
    const classic = conquestOdds(8, 8);

    it('salir de un bosque cancela la altura de la montaña', () => {
      // Los dos empujan el MEJOR dado, uno por lado: se anulan del todo.
      expect(odds('bosque', 'montaña')).toBeCloseTo(classic, 10);
      expect(terrainPairRules('bosque', 'montaña').attackBonus).toEqual([]);
      expect(terrainPairRules('bosque', 'montaña').defenceBonus).toEqual([]);
    });

    it('lo más caro es asaltar una montaña sin nada que lo compense', () => {
      expect(odds('llanura', 'montaña')).toBeCloseTo(0.199, 2);
      expect(odds('desierto', 'montaña')).toBeCloseTo(0.199, 2);
    });

    it('lo más barato es salir de un bosque contra terreno despejado', () => {
      expect(odds('bosque', 'costa')).toBeCloseTo(0.763, 2);
      expect(odds('bosque', 'desierto')).toBeCloseTo(0.763, 2);
    });

    it('el mismo objetivo se paga distinto según de dónde salgas', () => {
      expect(odds('bosque', 'llanura')).toBeGreaterThan(odds('llanura', 'llanura'));
      expect(odds('desierto', 'llanura')).toBeLessThan(odds('llanura', 'llanura'));
    });

    it('el mismo origen rinde distinto según a dónde ataques', () => {
      expect(odds('llanura', 'desierto')).toBeGreaterThan(odds('llanura', 'llanura'));
      expect(odds('llanura', 'montaña')).toBeLessThan(odds('llanura', 'llanura'));
    });

    it('un bosque contra otro bosque no se aplana', () => {
      // Cada lado se lleva un dado: el atacante el mejor, el defensor el
      // segundo. No puede salir lo mismo que atacar campo abierto.
      expect(terrainPairRules('bosque', 'bosque').attackBonus).toEqual([1]);
      expect(terrainPairRules('bosque', 'bosque').defenceBonus).toEqual([0, 1]);
      expect(odds('bosque', 'bosque')).not.toBeCloseTo(odds('bosque', 'desierto'), 3);
    });

    it('atacar de llanura a llanura es exactamente el juego clásico', () => {
      for (let a = 2; a <= 15; a++) {
        for (let d = 1; d <= 10; d++) {
          expect(conquestOdds(a, d, terrainPairRules('llanura', 'llanura'))).toBe(
            conquestOdds(a, d),
          );
        }
      }
    });

    it('nadie puede acumular dos pasos a su favor', () => {
      for (const from of TERRAINS) {
        for (const to of TERRAINS) {
          const rules = terrainPairRules(from, to);
          const label = `${from} -> ${to}`;
          expect((rules.attackBonus ?? []).reduce((s, v) => s + v, 0), label).toBeLessThanOrEqual(1);
          expect((rules.defenceBonus ?? []).reduce((s, v) => s + v, 0), label).toBeLessThanOrEqual(
            1,
          );
        }
      }
    });

    it('ninguna pareja se va de madre', () => {
      // Con las dos mitades sumando hay que comprobar que el peor y el mejor
      // caso siguen en la banda que ya se había medido y aceptado.
      for (const from of TERRAINS) {
        for (const to of TERRAINS) {
          const value = odds(from, to);
          expect(value, `${from} -> ${to}`).toBeGreaterThanOrEqual(0.19);
          expect(value, `${from} -> ${to}`).toBeLessThanOrEqual(0.77);
        }
      }
    });
  });

  describe('probabilidades reales', () => {
    // Contrastadas contra una simulación independiente de 300 000 batallas por
    // caso (misma metodología que las de referencia del combate clásico).
    // Atacando desde llanura, que es la referencia: el origen no aporta nada.
    const rulesOf = (terrain: Terrain, approach: 'tierra' | 'desembarco' = 'tierra') => ({
      attack: approach === 'tierra' ? 3 : 2,
      defend: 2,
      defenceBonus: terrainDefence(terrain, approach),
      attackBonus: [],
    });

    it('un ataque de 10 contra 5 se paga distinto según dónde caiga', () => {
      expect(conquestOdds(10, 5, rulesOf('llanura'))).toBeCloseTo(0.872, 2);
      expect(conquestOdds(10, 5, rulesOf('desierto'))).toBeCloseTo(0.958, 2);
      expect(conquestOdds(10, 5, rulesOf('bosque'))).toBeCloseTo(0.719, 2);
      expect(conquestOdds(10, 5, rulesOf('montaña'))).toBeCloseTo(0.699, 2);
      expect(conquestOdds(10, 5, rulesOf('costa', 'desembarco'))).toBeCloseTo(0.394, 2);
    });

    it('con fuerzas parejas la diferencia es enorme', () => {
      expect(conquestOdds(8, 8, rulesOf('llanura'))).toBeCloseTo(0.446, 2);
      expect(conquestOdds(8, 8, rulesOf('desierto'))).toBeCloseTo(0.655, 2);
      expect(conquestOdds(8, 8, rulesOf('bosque'))).toBeCloseTo(0.236, 2);
      expect(conquestOdds(8, 8, rulesOf('montaña'))).toBeCloseTo(0.198, 2);
      expect(conquestOdds(8, 8, rulesOf('costa', 'desembarco'))).toBeCloseTo(0.05, 2);
    });

    it('la escala de dificultad es la que dice la ficha de cada terreno', () => {
      const odds = (terrain: Terrain, approach: 'tierra' | 'desembarco' = 'tierra') =>
        conquestOdds(12, 6, rulesOf(terrain, approach));
      expect(odds('desierto')).toBeGreaterThan(odds('llanura'));
      expect(odds('llanura')).toBeGreaterThan(odds('bosque'));
      expect(odds('bosque')).toBeGreaterThan(odds('montaña'));
      expect(odds('montaña')).toBeGreaterThan(odds('costa', 'desembarco'));
    });

    it('la costa por tierra se pelea exactamente como una llanura', () => {
      for (let a = 2; a <= 20; a++) {
        for (let d = 1; d <= 12; d++) {
          expect(conquestOdds(a, d, rulesOf('costa'))).toBe(conquestOdds(a, d, rulesOf('llanura')));
        }
      }
    });

    it('contra un solo defensor el bosque y el desierto no cambian nada', () => {
      // Solo tira un dado, así que el segundo dado (que es el que tocan) no existe.
      for (let a = 2; a <= 15; a++) {
        expect(conquestOdds(a, 1, rulesOf('bosque'))).toBe(conquestOdds(a, 1, rulesOf('llanura')));
        expect(conquestOdds(a, 1, rulesOf('desierto'))).toBe(conquestOdds(a, 1, rulesOf('llanura')));
      }
    });

    it('la montaña sí frena a un defensor solo', () => {
      expect(conquestOdds(3, 1, rulesOf('montaña'))).toBeLessThan(conquestOdds(3, 1, rulesOf('llanura')));
    });

    it('las probabilidades siguen siendo probabilidades en todos los terrenos', () => {
      for (const terrain of TERRAINS) {
        for (const approach of ['tierra', 'desembarco'] as const) {
          for (let a = 1; a <= 15; a++) {
            for (let d = 1; d <= 15; d++) {
              const odds = conquestOdds(a, d, rulesOf(terrain, approach));
              expect(odds).toBeGreaterThanOrEqual(0);
              expect(odds).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    });

    it('concuerda con los dados de verdad', () => {
      // El mismo contraste que en el combate clásico, pero en montaña.
      const rules = rulesOf('montaña');
      const rng = createRng(20260825);
      let wins = 0;
      const trials = 4000;
      for (let i = 0; i < trials; i++) {
        let attackers = 10;
        let defenders = 5;
        while (attackers > 1 && defenders > 0) {
          const result = resolveCombat(attackers, defenders, 3, rng, rules);
          attackers -= result.attackerLosses;
          defenders -= result.defenderLosses;
        }
        if (defenders <= 0) wins++;
      }
      expect(wins / trials).toBeCloseTo(conquestOdds(10, 5, rules), 1);
    });
  });

  describe('resolveCombat con bonificación', () => {
    it('los dados que se enseñan son los tirados, no los bonificados', () => {
      const rng = createRng(7);
      const result = resolveCombat(5, 3, 3, rng, { attack: 3, defend: 2, defenceBonus: [1] });
      for (const die of [...result.attackerDice, ...result.defenderDice]) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
      }
    });

    it('cada pareja resuelta produce exactamente una baja', () => {
      const rng = createRng(99);
      for (let i = 0; i < 200; i++) {
        const result = resolveCombat(6, 4, 3, rng, { attack: 3, defend: 2, defenceBonus: [1, -1] });
        expect(result.attackerLosses + result.defenderLosses).toBe(2);
      }
    });

    it('una bonificación imposible de superar hace que el defensor no pierda nunca', () => {
      const rng = createRng(4);
      for (let i = 0; i < 100; i++) {
        const result = resolveCombat(6, 4, 3, rng, { attack: 3, defend: 2, defenceBonus: [6, 6] });
        expect(result.defenderLosses).toBe(0);
      }
    });

    it('los ceros de cola no cambian el resultado', () => {
      const a = conquestOdds(9, 5, { attack: 3, defend: 2, defenceBonus: [1] });
      const b = conquestOdds(9, 5, { attack: 3, defend: 2, defenceBonus: [1, 0] });
      expect(a).toBe(b);
    });
  });

  describe('lectura del mapa', () => {
    it('un territorio sin terreno declarado es llanura', () => {
      expect(terrainOf(TINY_MAP, 'A1')).toBe('llanura');
      expect(terrainOf(TINY_MAP, 'no-existe')).toBe('llanura');
    });

    it('lee el terreno que declara el mapa', () => {
      const map = terrainMap({ A1: 'montaña', B2: 'desierto' });
      expect(terrainOf(map, 'A1')).toBe('montaña');
      expect(terrainOf(map, 'B2')).toBe('desierto');
      expect(terrainOf(map, 'A2')).toBe('llanura');
    });

    it('reconoce las rutas marítimas en los dos sentidos', () => {
      const map = terrainMap({});
      expect(isSeaRoute(map, 'A1', 'B3')).toBe(true);
      expect(isSeaRoute(map, 'B3', 'A1')).toBe(true);
      expect(isSeaRoute(map, 'A1', 'A2')).toBe(false);
    });

    it('distingue llegar por tierra de desembarcar', () => {
      const map = terrainMap({});
      expect(approachOf(map, 'A1', 'A2')).toBe('tierra');
      expect(approachOf(map, 'A1', 'B3')).toBe('desembarco');
    });
  });

  describe('battleRulesFor', () => {
    const map = terrainMap({ A2: 'montaña', B3: 'costa' });

    it('sin modo avanzado devuelve exactamente lo clásico', () => {
      expect(battleRulesFor(map, DEFAULT_CONFIG, 'A1', 'A2')).toEqual({
        attack: 3,
        defend: 2,
        defenceBonus: [],
        attackBonus: [],
      });
      expect(battleRulesFor(map, DEFAULT_CONFIG, 'A1', 'B3')).toEqual({
        attack: 3,
        defend: 2,
        defenceBonus: [],
        attackBonus: [],
      });
    });

    it('sin configuración devuelve lo clásico', () => {
      expect(battleRulesFor(map, null, 'A1', 'A2')).toEqual(CLASSIC_RULES);
      expect(battleRulesFor(map, undefined, 'A1', 'A2')).toEqual(CLASSIC_RULES);
    });

    it('con modo avanzado aplica el terreno del territorio ATACADO', () => {
      const config = { ...DEFAULT_CONFIG, advancedTerrain: true };
      expect(battleRulesFor(map, config, 'A1', 'A2').defenceBonus).toEqual([1]);
      // Al revés no: A1 es llanura.
      expect(battleRulesFor(map, config, 'A2', 'A1').defenceBonus).toEqual([]);
    });

    it('con modo avanzado el desembarco recorta los dados del atacante', () => {
      const config = { ...DEFAULT_CONFIG, advancedTerrain: true };
      expect(battleRulesFor(map, config, 'A1', 'B3')).toEqual({
        attack: 2,
        defend: 2,
        defenceBonus: [1],
        attackBonus: [],
      });
    });

    it('los topes de la mesa siguen mandando sobre el terreno', () => {
      const config = { ...DEFAULT_CONFIG, advancedTerrain: true, maxAttackDice: 2, maxDefendDice: 1 };
      const rules = battleRulesFor(map, config, 'A1', 'A2');
      expect(rules.attack).toBe(2);
      expect(rules.defend).toBe(1);
    });
  });

  describe('integración con el motor', () => {
    function attackOnce(advancedTerrain: boolean, seed: number) {
      const map = terrainMap({ A2: 'montaña' });
      let state = createGame({
        map,
        players: TEST_PLAYERS,
        seed,
        config: { ...DEFAULT_CONFIG, advancedTerrain },
      });
      state = setBoard(state, { A1: ['p1', 20], A2: ['p2', 8] });
      state = forceTurn(state, 'p1', 'attack');
      return applyAction(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'A2', dice: 3 }, map);
    }

    it('el modo avanzado cambia de verdad el resultado del combate', () => {
      // Mismo estado, misma semilla, mismos dados: lo único que cambia es quién
      // gana las parejas.
      let differed = false;
      for (let seed = 1; seed <= 40 && !differed; seed++) {
        const classic = attackOnce(false, seed).lastCombat!;
        const advanced = attackOnce(true, seed).lastCombat!;
        expect(advanced.attackerDice).toEqual(classic.attackerDice);
        expect(advanced.defenderDice).toEqual(classic.defenderDice);
        if (advanced.defenderLosses !== classic.defenderLosses) differed = true;
      }
      expect(differed).toBe(true);
    });

    it('en montaña el defensor aguanta más a lo largo de muchas partidas', () => {
      let classicLosses = 0;
      let advancedLosses = 0;
      for (let seed = 1; seed <= 200; seed++) {
        classicLosses += attackOnce(false, seed).lastCombat!.defenderLosses;
        advancedLosses += attackOnce(true, seed).lastCombat!.defenderLosses;
      }
      expect(advancedLosses).toBeLessThan(classicLosses);
    });

    it('el desembarco limita los dados que se pueden pedir', () => {
      const map = terrainMap({ B3: 'costa' });
      let state = createGame({
        map,
        players: TEST_PLAYERS,
        seed: 3,
        config: { ...DEFAULT_CONFIG, advancedTerrain: true },
      });
      state = setBoard(state, { A1: ['p1', 10], B3: ['p2', 4] });
      state = forceTurn(state, 'p1', 'attack');
      expect(() =>
        applyAction(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B3', dice: 3 }, map),
      ).toThrow(/entre 1 y 2 dados/);
      expect(() =>
        applyAction(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B3', dice: 2 }, map),
      ).not.toThrow();
    });

    it('sin modo avanzado se pueden pedir 3 dados también por mar', () => {
      const map = terrainMap({ B3: 'costa' });
      let state = createGame({ map, players: TEST_PLAYERS, seed: 3 });
      state = setBoard(state, { A1: ['p1', 10], B3: ['p2', 4] });
      state = forceTurn(state, 'p1', 'attack');
      expect(() =>
        applyAction(state, { type: 'attack', playerId: 'p1', from: 'A1', to: 'B3', dice: 3 }, map),
      ).not.toThrow();
    });

    it('el modo avanzado se congela en la configuración de la partida', () => {
      const map = terrainMap({ A2: 'montaña' });
      const state = createGame({
        map,
        players: TEST_PLAYERS,
        seed: 1,
        config: { ...DEFAULT_CONFIG, advancedTerrain: true },
      });
      expect(state.config.advancedTerrain).toBe(true);
      // Y el clásico sigue siendo el valor por defecto.
      expect(DEFAULT_CONFIG.advancedTerrain).toBe(false);
    });
  });

  describe('los mapas del registro declaran su orografía', () => {
    it.each(RISK_MAPS.map((map) => [map.name, map] as const))('%s', (_name, map) => {
      for (const territory of map.territories) {
        expect(territory.terrain, territory.name).toBeDefined();
        expect(TERRAINS, territory.name).toContain(territory.terrain);
      }
    });

    it.each(RISK_MAPS.map((map) => [map.name, map] as const))(
      '%s usa al menos tres terrenos distintos',
      (_name, map) => {
        const used = new Set(map.territories.map((t) => t.terrain));
        expect(used.size).toBeGreaterThanOrEqual(3);
      },
    );

    it.each(RISK_MAPS.map((map) => [map.name, map] as const))(
      '%s no es mayoritariamente un solo terreno',
      (_name, map) => {
        const counts = new Map<string, number>();
        for (const territory of map.territories) {
          counts.set(territory.terrain!, (counts.get(territory.terrain!) ?? 0) + 1);
        }
        const most = Math.max(...counts.values());
        expect(most / map.territories.length).toBeLessThan(0.5);
      },
    );

    it('todo puente de tierra es una conexión suelta declarada', () => {
      for (const map of RISK_MAPS) {
        for (const [a, b] of map.landBridges ?? []) {
          expect(isSeaRoute(map, a, b), `${map.name}: ${a}-${b}`).toBe(true);
        }
      }
    });

    it('todo puente de tierra une territorios que son vecinos', () => {
      for (const map of RISK_MAPS) {
        const byId = new Map(map.territories.map((t) => [t.id, t]));
        for (const [a, b] of map.landBridges ?? []) {
          expect(byId.get(a)?.adjacent, `${map.name}: ${a}-${b}`).toContain(b);
          expect(byId.get(b)?.adjacent, `${map.name}: ${b}-${a}`).toContain(a);
        }
      }
    });

    it('cruzar un puente de tierra no es un desembarco', () => {
      for (const map of RISK_MAPS) {
        for (const [a, b] of map.landBridges ?? []) {
          expect(approachOf(map, a, b), `${map.name}: ${a}-${b}`).toBe('tierra');
          expect(approachOf(map, b, a), `${map.name}: ${b}-${a}`).toBe('tierra');
        }
      }
    });

    it('el resto de conexiones sueltas sí son desembarcos', () => {
      let landings = 0;
      for (const map of RISK_MAPS) {
        for (const [a, b] of map.seaRoutes ?? []) {
          if (isLandBridge(map, a, b)) continue;
          expect(approachOf(map, a, b), `${map.name}: ${a}-${b}`).toBe('desembarco');
          landings++;
        }
      }
      expect(landings).toBeGreaterThan(20);
    });

    it('los mapas de España no tienen puentes de tierra: todo lo suelto es mar', () => {
      for (const map of RISK_MAPS.filter((m) => m.id.startsWith('spain'))) {
        expect(map.landBridges ?? [], map.name).toEqual([]);
      }
    });
  });
});
