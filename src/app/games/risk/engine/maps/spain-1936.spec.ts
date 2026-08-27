import { describe, expect, it } from 'vitest';
import {
  SPAIN_1936_FACTIONS,
  SPAIN_1936_MAP,
  SPAIN_1936_SCENARIO,
  SPAIN_1936_SIDES,
} from './spain-1936.map';
import { SPAIN_MAP } from './spain.map';
import { applyAction, createGame, currentPlayer } from '../engine';
import {
  areAllies,
  borderTerritories,
  canAttack,
  interiorTerritories,
  isEnemy,
  territoriesOf,
} from '../rules';
import { decideAction, BOT_PROFILE_IDS, threatMap } from '../ai/bot-brain';
import { chronicleFor, CHRONICLE_EVENTS, hasChronicle } from '../ai/chronicle';
import { createRng } from '../rng';
import { GameState } from '../types';

function seats(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Jugador ${i}`,
    kind: 'bot' as const,
    botProfile: BOT_PROFILE_IDS[i % BOT_PROFILE_IDS.length],
  }));
}

function scenarioGame(players = 4, seed = 1936): GameState {
  return createGame({ map: SPAIN_1936_MAP, players: seats(players), seed });
}

describe('España 1936', () => {
  describe('el escenario', () => {
    it('usa exactamente la misma cartografía que el mapa provincial', () => {
      expect(SPAIN_1936_MAP.territories).toHaveLength(SPAIN_MAP.territories.length);
      for (const territory of SPAIN_1936_MAP.territories) {
        const original = SPAIN_MAP.territories.find((t) => t.id === territory.id)!;
        expect(territory.shape, territory.id).toBe(original.shape);
        expect(territory.labelAnchor, territory.id).toEqual(original.labelAnchor);
        expect(territory.terrain, territory.id).toBe(original.terrain);
      }
    });

    it('declara dos bandos y dos facciones en cada uno', () => {
      expect(SPAIN_1936_SIDES).toHaveLength(2);
      for (const side of SPAIN_1936_SIDES) {
        const own = SPAIN_1936_FACTIONS.filter((f) => f.side === side.id);
        expect(own, side.name).toHaveLength(2);
      }
    });

    it('cada facción pertenece a un bando declarado y se explica', () => {
      const ids = new Set(SPAIN_1936_SIDES.map((s) => s.id));
      for (const faction of SPAIN_1936_FACTIONS) {
        expect(ids.has(faction.side), faction.name).toBe(true);
        expect(faction.blurb.length).toBeGreaterThan(40);
        expect(faction.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('despliega las 52 provincias, ninguna vacía', () => {
      const deployed = Object.keys(SPAIN_1936_SCENARIO.deployment);
      expect(deployed).toHaveLength(52);
      for (const [id, slot] of Object.entries(SPAIN_1936_SCENARIO.deployment)) {
        expect(slot.armies, id).toBeGreaterThanOrEqual(2);
        expect(SPAIN_1936_FACTIONS.some((f) => f.id === slot.faction), id).toBe(true);
      }
    });

    it('el reparto es el de julio del 36: unas 30 provincias sublevadas', () => {
      const rebels = Object.values(SPAIN_1936_SCENARIO.deployment).filter((slot) =>
        SPAIN_1936_FACTIONS.find((f) => f.id === slot.faction && f.side === 'sublevados'),
      ).length;
      // El consenso habitual es "triunfó en unas treinta y fracasó en veinte".
      expect(rebels).toBeGreaterThanOrEqual(28);
      expect(rebels).toBeLessThanOrEqual(32);
    });

    it('las plazas que importan están donde estaban', () => {
      const side = (id: string) => {
        const faction = SPAIN_1936_SCENARIO.deployment[id].faction;
        return SPAIN_1936_FACTIONS.find((f) => f.id === faction)!.side;
      };
      // República
      for (const id of ['MD', 'BR', 'VL', 'BI', 'AS', 'BD', 'JA', 'AB']) {
        expect(side(id), id).toBe('republica');
      }
      // Sublevados
      for (const id of ['SV', 'CD', 'ZG', 'BU', 'NA', 'CC', 'CE', 'ML', 'AC']) {
        expect(side(id), id).toBe('sublevados');
      }
    });

    it('Madrid y Barcelona empiezan mejor guarnecidas que una provincia cualquiera', () => {
      expect(SPAIN_1936_SCENARIO.deployment['MD'].armies).toBeGreaterThan(
        SPAIN_1936_SCENARIO.deployment['CU'].armies,
      );
      expect(SPAIN_1936_SCENARIO.deployment['BR'].armies).toBeGreaterThan(
        SPAIN_1936_SCENARIO.deployment['CU'].armies,
      );
    });

    it('el Ejército de África empieza al otro lado del Estrecho', () => {
      for (const id of ['CE', 'ML']) {
        expect(SPAIN_1936_SCENARIO.deployment[id].faction, id).toBe('ejercito-africa');
      }
    });
  });

  describe('al empezar la partida', () => {
    const sideOf = (state: GameState) =>
      Object.fromEntries(
        Object.entries(state.territories).map(([id, t]) => [
          id,
          state.players.find((p) => p.id === t.ownerId)!.side,
        ]),
      );

    it('reparte al azar: cada semilla parte España por otro sitio', () => {
      // Antes el reparto era el histórico y era siempre el mismo. Como juego no
      // se sostenía: los sublevados salían con 30 provincias y tres regiones
      // enteras, o sea 15 refuerzos por turno contra 7 desde la primera ronda.
      // Medido en autopartidas, ganaban 91 de cada 100 a dos y 100 de cada 100
      // a cuatro. El ambiente lo ponen las facciones y la crónica; el tablero
      // se sortea.
      expect(sideOf(scenarioGame(4, 1))).not.toEqual(sideOf(scenarioGame(4, 999)));
    });

    it('pero los dos frentes miden lo mismo', () => {
      // Lo que no puede pasar es que el azar reparta 30 contra 22, que es de
      // donde salía la paliza.
      for (let seed = 1; seed <= 40; seed++) {
        const state = scenarioGame(4, seed);
        const porBando = new Map<string, number>();
        for (const t of Object.values(state.territories)) {
          const side = state.players.find((p) => p.id === t.ownerId)!.side!;
          porBando.set(side, (porBando.get(side) ?? 0) + 1);
        }
        const tamaños = [...porBando.values()];
        expect(Math.max(...tamaños) - Math.min(...tamaños), `semilla ${seed}`).toBeLessThanOrEqual(1);
      }
    });

    it('y con la misma semilla sale exactamente el mismo reparto', () => {
      // El multijugador sin servidor depende de esto: dos mesas con la misma
      // semilla tienen que empezar idénticas o el registro de acciones no
      // reproduce la partida.
      expect(sideOf(scenarioGame(4, 7))).toEqual(sideOf(scenarioGame(4, 7)));
    });

    it('nadie empieza sin territorios', () => {
      const state = scenarioGame(4);
      for (const player of state.players) {
        expect(territoriesOf(state, player.id).length, player.name).toBeGreaterThan(0);
      }
    });

    it('reparte las facciones alternando bandos', () => {
      const state = scenarioGame(4);
      const sides = state.players.map((p) => p.side);
      expect(new Set(sides).size).toBe(2);
      expect(sides.filter((s) => s === 'republica')).toHaveLength(2);
      expect(sides.filter((s) => s === 'sublevados')).toHaveLength(2);
    });

    it('con dos jugadores es uno contra uno, y el tablero sigue completo', () => {
      const state = scenarioGame(2);
      expect(new Set(state.players.map((p) => p.side)).size).toBe(2);
      const sinDueño = Object.values(state.territories).filter((t) => !t.ownerId);
      expect(sinDueño).toHaveLength(0);
    });

    it('cada jugador toma el color de su facción', () => {
      const state = scenarioGame(4);
      for (const player of state.players) {
        const faction = SPAIN_1936_FACTIONS.find((f) => f.id === player.factionId)!;
        expect(player.color, player.name).toBe(faction.color);
      }
    });

    it('anuncia el escenario en los eventos', () => {
      const state = scenarioGame(4);
      expect(state.events.some((e) => e.text.includes('Julio de 1936'))).toBe(true);
    });

    it('empieza directamente en refuerzos, sin fase de reparto', () => {
      expect(scenarioGame(4).phase).toBe('reinforce');
    });
  });

  describe('los del mismo bando van juntos', () => {
    it('se reconocen como aliados', () => {
      const state = scenarioGame(4);
      const [a, b] = state.players.filter((p) => p.side === 'republica');
      expect(areAllies(state, a.id, b.id)).toBe(true);
      const enemy = state.players.find((p) => p.side === 'sublevados')!;
      expect(areAllies(state, a.id, enemy.id)).toBe(false);
    });

    it('no se pueden atacar entre sí', () => {
      const state = scenarioGame(4);
      const [a, b] = state.players.filter((p) => p.side === 'republica');
      const mine = territoriesOf(state, a.id);
      const allied = territoriesOf(state, b.id);
      const pair = mine
        .flatMap((from) =>
          SPAIN_1936_MAP.territories
            .find((t) => t.id === from)!
            .adjacent.filter((to) => allied.includes(to))
            .map((to) => [from, to] as const),
        )
        .find(Boolean);
      expect(pair, 'los dos aliados deberían compartir alguna frontera').toBeDefined();
      const [from, to] = pair!;
      state.territories[from].armies = 10;
      expect(canAttack(state, SPAIN_1936_MAP, from, to, a.id)).toBe(false);
      expect(isEnemy(state, a.id, to)).toBe(false);
    });

    it('los del otro bando sí son objetivo', () => {
      const state = scenarioGame(4);
      const republicano = state.players.find((p) => p.side === 'republica')!;
      const enemigo = state.players.find((p) => p.side === 'sublevados')!;
      const suyo = territoriesOf(state, enemigo.id)[0];
      expect(isEnemy(state, republicano.id, suyo)).toBe(true);
    });
  });

  describe('la guerra la gana un bando entero', () => {
    it('gana el bando sin que nadie tenga que quedarse el mapa entero', () => {
      // Lo que distingue a un escenario por bandos: el ganador comparte el
      // tablero con su aliado y aun así la guerra se acaba.
      const base = scenarioGame(4);
      const republicanos = base.players.filter((p) => p.side === 'republica');
      const sublevados = base.players.filter((p) => p.side === 'sublevados');
      const ultimo = sublevados[0];

      // Todo para la República menos una provincia, que se queda el enemigo.
      let state: GameState = JSON.parse(JSON.stringify(base));
      const ids = Object.keys(state.territories);
      ids.forEach((id, index) => {
        state.territories[id] = {
          ownerId: republicanos[index % republicanos.length].id,
          armies: 2,
        };
      });
      state.territories['CE'] = { ownerId: ultimo.id, armies: 1 };
      // Ojo: hay que marcarlos en la COPIA, no en el estado del que salió.
      for (const player of state.players) {
        if (player.side === 'sublevados' && player.id !== ultimo.id) player.eliminated = true;
      }

      // Y se la quitan desde una provincia vecina.
      const atacante = state.territories['CD'].ownerId!;
      state.territories['CD'] = { ownerId: atacante, armies: 40 };
      state.currentPlayerIndex = state.turnOrder.indexOf(atacante);
      state.phase = 'attack';
      state.pendingOccupation = null;

      for (let i = 0; i < 40 && state.phase !== 'game-over'; i++) {
        if (state.pendingOccupation) {
          state = applyAction(
            state,
            { type: 'occupy', playerId: atacante, armies: state.pendingOccupation.minArmies },
            SPAIN_1936_MAP,
          );
          continue;
        }
        const dice = Math.max(1, Math.min(3, state.territories['CD'].armies - 1));
        state = applyAction(
          state,
          { type: 'attack', playerId: atacante, from: 'CD', to: 'CE', dice },
          SPAIN_1936_MAP,
        );
      }

      expect(state.phase).toBe('game-over');
      const winner = state.players.find((p) => p.id === state.winnerId)!;
      expect(winner.side).toBe('republica');
      // Nadie tiene las 52: la ha ganado el bando.
      expect(territoriesOf(state, winner.id).length).toBeLessThan(
        SPAIN_1936_MAP.territories.length,
      );
      expect(state.events.some((e) => e.type === 'win' && e.text.includes('República'))).toBe(true);
    });

    it('una partida de bots termina', () => {
      let state = scenarioGame(4, 7);
      let actions = 0;
      while (state.phase !== 'game-over' && actions < 12000) {
        const player = currentPlayer(state);
        if (!player) break;
        const action = decideAction(state, SPAIN_1936_MAP, player.id);
        if (!action) break;
        state = applyAction(state, action, SPAIN_1936_MAP);
        actions++;
      }
      expect(state.phase).toBe('game-over');
      // Y el que gana pertenece a un bando, no está solo.
      const winner = state.players.find((p) => p.id === state.winnerId)!;
      expect(winner.side).toBeTruthy();
    }, 60000);
  });

  describe('los aliados no son frontera', () => {
    it('un territorio que solo toca al aliado es retaguardia, no frente', () => {
      const state = scenarioGame(4);
      const [a, b] = state.players.filter((p) => p.side === 'republica');
      const border = borderTerritories(state, SPAIN_1936_MAP, a.id);
      const interior = interiorTerritories(state, SPAIN_1936_MAP, a.id);

      // Ninguno de los que cuentan como frontera toca solo a aliados.
      for (const id of border) {
        const neighbours = SPAIN_1936_MAP.territories.find((t) => t.id === id)!.adjacent;
        expect(neighbours.some((n) => isEnemy(state, a.id, n)), id).toBe(true);
      }
      // Y frontera e interior no se solapan ni dejan huecos.
      expect(new Set([...border, ...interior]).size).toBe(
        territoriesOf(state, a.id).length,
      );
      expect(border.some((id) => interior.includes(id))).toBe(false);
      expect(b.side).toBe(a.side);
    });

    it('la presión del mapa de amenazas solo cuenta enemigos', () => {
      const state = scenarioGame(4);
      const republicano = state.players.find((p) => p.side === 'republica')!;
      for (const threat of threatMap(state, SPAIN_1936_MAP, republicano.id)) {
        const neighbours = SPAIN_1936_MAP.territories.find((t) => t.id === threat.id)!.adjacent;
        const enemyArmies = neighbours
          .filter((n) => isEnemy(state, republicano.id, n))
          .reduce((sum, n) => sum + state.territories[n].armies, 0);
        expect(threat.enemyArmies, threat.id).toBe(enemyArmies);
      }
    });

    it('una partida de bots a cuatro no se enquista', () => {
      // Antes de tratar bien a los aliados, 13 de cada 20 partidas de 2 contra 2
      // se quedaban sin terminar: los bots amontonaban refuerzos mirándose entre
      // ellos en vez de al enemigo.
      let sinTerminar = 0;
      for (const seed of [1000, 1137, 1274, 1411, 1548]) {
        let state = scenarioGame(4, seed);
        let actions = 0;
        while (state.phase !== 'game-over' && actions < 20000) {
          const player = currentPlayer(state);
          if (!player) break;
          const action = decideAction(state, SPAIN_1936_MAP, player.id);
          if (!action) break;
          state = applyAction(state, action, SPAIN_1936_MAP);
          actions++;
        }
        if (state.phase !== 'game-over') sinTerminar++;
      }
      expect(sinTerminar).toBe(0);
    }, 60000);
  });

  describe('crónica de guerra', () => {
    const rng = () => createRng(1);

    it('solo la tienen los escenarios', () => {
      expect(hasChronicle(SPAIN_1936_MAP)).toBe(true);
      expect(hasChronicle(SPAIN_MAP)).toBe(false);
      const state = scenarioGame(4);
      expect(
        chronicleFor(
          { map: SPAIN_MAP, state, playerId: state.players[0].id, from: 'CC', to: 'BD' },
          rng(),
        ),
      ).toBeNull();
    });

    it('cuenta el episodio real cuando lo intenta quien lo hizo', () => {
      const state = scenarioGame(4);
      const sublevado = state.players.find((p) => p.side === 'sublevados')!;
      const line = chronicleFor(
        { map: SPAIN_1936_MAP, state, playerId: sublevado.id, from: 'CC', to: 'BD' },
        rng(),
      )!;
      expect(line).toContain('Badajoz');
      expect(line).toContain('Yagüe');
    });

    it('cuenta la historia al revés cuando lo intenta el otro bando', () => {
      const state = scenarioGame(4);
      const republicano = state.players.find((p) => p.side === 'republica')!;
      const line = chronicleFor(
        { map: SPAIN_1936_MAP, state, playerId: republicano.id, from: 'CC', to: 'BD' },
        rng(),
      )!;
      expect(line).toContain('Extremadura aguanta');
    });

    it('el Estrecho solo se cuenta si se cruza el Estrecho', () => {
      const state = scenarioGame(4);
      const sublevado = state.players.find((p) => p.side === 'sublevados')!;
      const cruzando = chronicleFor(
        { map: SPAIN_1936_MAP, state, playerId: sublevado.id, from: 'CE', to: 'CD' },
        rng(),
      )!;
      expect(cruzando).toContain('Estrecho');

      const porTierra = chronicleFor(
        { map: SPAIN_1936_MAP, state, playerId: sublevado.id, from: 'SV', to: 'CD' },
        rng(),
      )!;
      expect(porTierra).not.toContain('Estrecho');
    });

    it('siempre dice de dónde a dónde', () => {
      const state = scenarioGame(4);
      const player = state.players[0];
      for (const territory of SPAIN_1936_MAP.territories) {
        for (const other of territory.adjacent.slice(0, 2)) {
          const line = chronicleFor(
            { map: SPAIN_1936_MAP, state, playerId: player.id, from: territory.id, to: other },
            rng(),
          )!;
          expect(line, `${territory.id}->${other}`).toContain('→');
          expect(line.length).toBeGreaterThan(20);
        }
      }
    });

    it('ninguna línea se pasa del tope del chat', () => {
      const state = scenarioGame(4);
      for (const player of state.players) {
        for (const territory of SPAIN_1936_MAP.territories) {
          for (const other of territory.adjacent) {
            const line = chronicleFor(
              { map: SPAIN_1936_MAP, state, playerId: player.id, from: territory.id, to: other },
              rng(),
            )!;
            expect(line.length, `${territory.id}->${other}`).toBeLessThanOrEqual(600);
          }
        }
      }
    });

    it('es determinista: mismo ataque, mismo texto', () => {
      const state = scenarioGame(4);
      const player = state.players[0];
      const args = { map: SPAIN_1936_MAP, state, playerId: player.id, from: 'MD', to: 'TO' };
      expect(chronicleFor(args, createRng(5))).toBe(chronicleFor(args, createRng(5)));
    });

    it('los episodios apuntan a provincias que existen', () => {
      const ids = new Set(SPAIN_1936_MAP.territories.map((t) => t.id));
      for (const event of CHRONICLE_EVENTS) {
        for (const id of event.to) expect(ids.has(id), `to ${id}`).toBe(true);
        for (const id of event.from ?? []) expect(ids.has(id), `from ${id}`).toBe(true);
        expect(event.asItWas.length).toBeGreaterThan(60);
        expect(event.asItMightHave.length).toBeGreaterThan(40);
      }
    });
  });
});
