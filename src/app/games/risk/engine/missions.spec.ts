import { describe, expect, it } from 'vitest';
import {
  activeMission,
  fallbackMission,
  isMissionComplete,
  missionProgress,
} from './missions';
import { applyAction, createGame, currentPlayer, DEFAULT_CONFIG } from './engine';
import { decideAction, BOT_PROFILE_IDS } from './ai/bot-brain';
import { GameMap, GameState, PlayerId } from './types';
import { TINY_MAP, forceTurn, setBoard } from './testing';
import { WORLD_MAP } from './maps/world.map';
import { SPAIN_MAP } from './maps/spain.map';

const PLAYERS = [
  { id: 'p1', name: 'Ada', kind: 'human' as const },
  { id: 'p2', name: 'Bram', kind: 'bot' as const },
  { id: 'p3', name: 'Cira', kind: 'bot' as const },
];

function objectivesGame(map: GameMap = TINY_MAP, seed = 2026): GameState {
  return createGame({
    map,
    players: PLAYERS,
    seed,
    config: { ...DEFAULT_CONFIG, victory: 'objectives' },
  });
}

describe('victoria por objetivos', () => {
  describe('reparto', () => {
    it('en el modo clásico no hay objetivos', () => {
      const state = createGame({ map: TINY_MAP, players: PLAYERS, seed: 1 });
      expect(state.missions).toBeUndefined();
      expect(activeMission(state, TINY_MAP, 'p1')).toBeNull();
    });

    it('cada jugador recibe uno', () => {
      const state = objectivesGame();
      expect(Object.keys(state.missions!).sort()).toEqual(['p1', 'p2', 'p3']);
      for (const id of ['p1', 'p2', 'p3']) {
        expect(state.missions![id].text.length).toBeGreaterThan(5);
      }
    });

    it('no se repiten entre jugadores', () => {
      for (const map of [TINY_MAP, WORLD_MAP, SPAIN_MAP]) {
        const state = objectivesGame(map, 77);
        const texts = Object.values(state.missions!).map((m) => m.text);
        expect(new Set(texts).size, map.name).toBe(texts.length);
      }
    });

    it('nadie tiene que eliminarse a sí mismo', () => {
      for (let seed = 1; seed <= 40; seed++) {
        const state = objectivesGame(WORLD_MAP, seed);
        for (const [playerId, mission] of Object.entries(state.missions!)) {
          expect(mission.targetPlayerId, `semilla ${seed}`).not.toBe(playerId);
        }
      }
    });

    it('es determinista: misma semilla, mismos objetivos', () => {
      const a = objectivesGame(WORLD_MAP, 555);
      const b = objectivesGame(WORLD_MAP, 555);
      expect(a.missions).toEqual(b.missions);
    });

    it('semillas distintas dan repartos distintos', () => {
      const texts = new Set<string>();
      for (let seed = 1; seed <= 20; seed++) {
        texts.add(objectivesGame(WORLD_MAP, seed).missions!['p1'].text);
      }
      expect(texts.size).toBeGreaterThan(1);
    });

    it('encender los objetivos no cambia el reparto del tablero', () => {
      // Los objetivos usan un RNG sembrado aparte justo por esto: si comieran
      // tiradas del mismo flujo, dos mesas con la misma semilla empezarían
      // distinto según hubiera objetivos o no.
      const classic = createGame({ map: WORLD_MAP, players: PLAYERS, seed: 909 });
      const withMissions = objectivesGame(WORLD_MAP, 909);
      expect(withMissions.territories).toEqual(classic.territories);
      expect(withMissions.turnOrder).toEqual(classic.turnOrder);
    });

    it('los objetivos se anuncian al empezar', () => {
      const state = objectivesGame();
      const announced = state.events.filter((e) => e.text.startsWith('Objetivo de'));
      expect(announced).toHaveLength(3);
    });

    it('todos los objetivos repartidos son alcanzables en el mapa', () => {
      for (const map of [WORLD_MAP, SPAIN_MAP]) {
        for (let seed = 1; seed <= 15; seed++) {
          const state = objectivesGame(map, seed);
          for (const mission of Object.values(state.missions!)) {
            if (mission.kind === 'territories') {
              expect(mission.count!, map.name).toBeLessThanOrEqual(map.territories.length);
            }
            if (mission.kind === 'continents') {
              for (const id of mission.continentIds!) {
                expect(map.continents.some((c) => c.id === id), `${map.name}: ${id}`).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  describe('objetivo de territorios', () => {
    it('se cumple al llegar al número pedido', () => {
      let state = objectivesGame();
      state.missions = { p1: { kind: 'territories', count: 4, minArmies: 1, text: 'Controla 4' } };
      state = setBoard(state, {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p2', 1],
      });
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(false);
      state = setBoard(state, { B1: ['p1', 1] });
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(true);
    });

    it('la guarnición mínima cuenta', () => {
      let state = objectivesGame();
      state.missions = { p1: { kind: 'territories', count: 3, minArmies: 2, text: 'Controla 3' } };
      // El tablero entero, para no depender de cómo cayera el reparto inicial.
      state = setBoard(state, {
        A1: ['p1', 2],
        A2: ['p1', 2],
        A3: ['p1', 1],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p3', 1],
      });
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(false);
      state = setBoard(state, { A3: ['p1', 2] });
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(true);
    });

    it('el progreso se puede enseñar', () => {
      let state = objectivesGame();
      state.missions = { p1: { kind: 'territories', count: 4, minArmies: 1, text: 'Controla 4' } };
      state = setBoard(state, {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p2', 1],
        B1: ['p2', 1],
        B2: ['p3', 1],
        B3: ['p3', 1],
      });
      expect(missionProgress(state, TINY_MAP, 'p1').detail).toBe('2 de 4');
      expect(missionProgress(state, TINY_MAP, 'p1').done).toBe(false);
    });
  });

  describe('objetivo de continentes', () => {
    it('exige tenerlos enteros', () => {
      let state = objectivesGame();
      state.missions = {
        p1: { kind: 'continents', continentIds: ['alpha'], text: 'Conquista Alfa' },
      };
      state = setBoard(state, { A1: ['p1', 1], A2: ['p1', 1], A3: ['p2', 1] });
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(false);
      state = setBoard(state, { A3: ['p1', 1] });
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(true);
    });

    it('dice qué falta', () => {
      let state = objectivesGame();
      state.missions = {
        p1: { kind: 'continents', continentIds: ['alpha', 'beta'], text: 'Conquista los dos' },
      };
      state = setBoard(state, { A1: ['p1', 1], A2: ['p1', 1], A3: ['p1', 1] });
      expect(missionProgress(state, TINY_MAP, 'p1').detail).toBe('Te falta Beta');
    });
  });

  describe('objetivo de eliminar', () => {
    function boardWith(mission: PlayerId): GameState {
      let state = objectivesGame();
      state.missions = { p1: { kind: 'eliminate', targetPlayerId: mission, text: 'Elimina' } };
      return state;
    }

    it('solo cuenta si lo eliminas tú', () => {
      const state = boardWith('p2');
      const victim = state.players.find((p) => p.id === 'p2')!;

      victim.eliminated = true;
      victim.eliminatedBy = 'p3';
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(false);

      victim.eliminatedBy = 'p1';
      expect(isMissionComplete(state, TINY_MAP, 'p1')).toBe(true);
    });

    it('si se te adelantan pasas al objetivo de reserva', () => {
      const state = boardWith('p2');
      const victim = state.players.find((p) => p.id === 'p2')!;
      victim.eliminated = true;
      victim.eliminatedBy = 'p3';

      const active = activeMission(state, TINY_MAP, 'p1')!;
      expect(active.kind).toBe('territories');
      expect(active).toEqual(fallbackMission(TINY_MAP));
      expect(missionProgress(state, TINY_MAP, 'p1').text).toBe(fallbackMission(TINY_MAP).text);
    });

    it('mientras siga vivo el objetivo no cambia', () => {
      const state = boardWith('p2');
      expect(activeMission(state, TINY_MAP, 'p1')!.kind).toBe('eliminate');
      expect(missionProgress(state, TINY_MAP, 'p1').detail).toBe('Sigue en pie');
    });

    it('un objetivo contra alguien que no existe cae al de reserva', () => {
      const state = boardWith('fantasma');
      expect(activeMission(state, TINY_MAP, 'p1')).toEqual(fallbackMission(TINY_MAP));
    });
  });

  describe('la partida termina al cumplirse', () => {
    it('gana quien cumple, sin barrer el mapa', () => {
      let state = objectivesGame();
      state.missions = {
        p1: { kind: 'continents', continentIds: ['alpha'], text: 'Conquista Alfa' },
        p2: { kind: 'territories', count: 6, minArmies: 1, text: 'Controla 6' },
        p3: { kind: 'territories', count: 6, minArmies: 1, text: 'Controla 6' },
      };
      state = setBoard(state, {
        A1: ['p1', 5],
        A2: ['p1', 5],
        A3: ['p2', 1],
        B1: ['p2', 3],
        B2: ['p3', 3],
        B3: ['p3', 3],
      });
      state = forceTurn(state, 'p1', 'attack');

      let current = state;
      for (let i = 0; i < 60 && current.phase !== 'game-over'; i++) {
        if (current.pendingOccupation) {
          current = applyAction(
            current,
            { type: 'occupy', playerId: 'p1', armies: current.pendingOccupation.minArmies },
            TINY_MAP,
          );
          continue;
        }
        const dice = Math.max(1, Math.min(3, current.territories['A2'].armies - 1));
        current = applyAction(
          current,
          { type: 'attack', playerId: 'p1', from: 'A2', to: 'A3', dice },
          TINY_MAP,
        );
      }
      expect(current.phase).toBe('game-over');
      expect(current.winnerId).toBe('p1');
      // No hace falta tener el mapa entero.
      expect(Object.values(current.territories).filter((t) => t.ownerId === 'p1').length).toBeLessThan(
        TINY_MAP.territories.length,
      );
      expect(current.events.some((e) => e.type === 'win' && e.text.includes('objetivo'))).toBe(true);
    });

    it('la conquista total sigue ganando aunque haya objetivos', () => {
      let state = objectivesGame();
      state.missions = {
        p1: { kind: 'continents', continentIds: ['alpha', 'beta'], text: 'Conquista todo' },
        p2: { kind: 'territories', count: 99, minArmies: 1, text: 'Imposible' },
        p3: { kind: 'territories', count: 99, minArmies: 1, text: 'Imposible' },
      };
      state = setBoard(state, {
        A1: ['p1', 5],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p1', 5],
        B2: ['p1', 30],
        B3: ['p2', 1],
      });
      state = forceTurn(state, 'p1', 'attack');
      let current = state;
      for (let i = 0; i < 60 && current.phase !== 'game-over'; i++) {
        if (current.pendingOccupation) {
          current = applyAction(
            current,
            { type: 'occupy', playerId: 'p1', armies: current.pendingOccupation.minArmies },
            TINY_MAP,
          );
          continue;
        }
        const dice = Math.max(1, Math.min(3, current.territories['B2'].armies - 1));
        current = applyAction(
          current,
          { type: 'attack', playerId: 'p1', from: 'B2', to: 'B3', dice },
          TINY_MAP,
        );
      }
      expect(current.winnerId).toBe('p1');
    });
  });

  describe('partidas completas de bots', () => {
    it('terminan, y antes que por conquista total', () => {
      const map = SPAIN_MAP;
      let shorter = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const withObjectives = selfPlay(map, seed, 'objectives');
        const classic = selfPlay(map, seed, 'conquest');
        expect(withObjectives.finished, `semilla ${seed}`).toBe(true);
        if (withObjectives.round <= classic.round) shorter++;
      }
      // No siempre tiene que ser más corta, pero sí la mayoría de las veces.
      expect(shorter).toBeGreaterThanOrEqual(4);
    }, 60000);

    it('el ganador tiene su objetivo cumplido', () => {
      for (let seed = 10; seed <= 14; seed++) {
        const { state } = selfPlay(WORLD_MAP, seed, 'objectives');
        expect(state.phase).toBe('game-over');
        expect(isMissionComplete(state, WORLD_MAP, state.winnerId!)).toBe(true);
      }
    }, 60000);
  });
});

function selfPlay(map: GameMap, seed: number, victory: 'conquest' | 'objectives') {
  let state = createGame({
    map,
    seed,
    config: { ...DEFAULT_CONFIG, victory },
    players: Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`,
      name: `Bot ${i}`,
      kind: 'bot' as const,
      botProfile: BOT_PROFILE_IDS[i % BOT_PROFILE_IDS.length],
    })),
  });
  let actions = 0;
  while (state.phase !== 'game-over' && actions < 12000) {
    const player = currentPlayer(state);
    if (!player) break;
    const action = decideAction(state, map, player.id);
    if (!action) break;
    state = applyAction(state, action, map);
    actions++;
  }
  return { state, finished: state.phase === 'game-over', round: state.round };
}
