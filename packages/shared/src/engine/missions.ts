import type { GameMap, GameState, PlayerId } from './types';
import type { Rng } from './rng';
import { continentsOf, territoriesOf } from './rules';

/**
 * Victoria por objetivos.
 *
 * En un tablero grande, conquistarlo entero es una campaña interminable: en las
 * 52 provincias españolas se nota enseguida. Con objetivos, cada jugador tiene
 * una meta propia y la partida se decide cuando alguien la cumple.
 *
 * **Los objetivos son públicos, y es a propósito.** Sin backend no hay forma de
 * guardar un secreto: todos los clientes reproducen el mismo log y calculan el
 * mismo estado, así que cualquiera podría leer el objetivo ajeno abriendo la
 * consola. Antes que fingir un secreto que no existe, se enseñan: saber a qué
 * juega cada uno cambia la partida para bien, porque se puede cortar al que va
 * a ganar.
 *
 * Todo es puro: los objetivos se reparten con el RNG sembrado de la partida, así
 * que salen iguales en todos los clientes y en cualquier reproducción del log.
 */

export type MissionKind = 'continents' | 'territories' | 'eliminate';

export interface Mission {
  kind: MissionKind;
  /** `continents`: continentes que hay que tener enteros. */
  continentIds?: string[];
  /** `territories`: cuántos hay que tener, y con cuántos ejércitos cada uno. */
  count?: number;
  minArmies?: number;
  /** `eliminate`: a quién hay que sacar de la partida. */
  targetPlayerId?: PlayerId;
  /** Texto ya formateado en español. */
  text: string;
}

/**
 * Objetivo de reserva cuando el asignado deja de tener sentido.
 *
 * Pasa con "elimina a fulano" si a fulano lo elimina otro: la regla clásica es
 * que entonces pasas a jugar por número de territorios. Es una función pura del
 * estado, así que todos los clientes cambian de objetivo a la vez.
 */
export function fallbackMission(map: GameMap): Mission {
  const count = Math.max(3, Math.ceil(map.territories.length * 0.6));
  return {
    kind: 'territories',
    count,
    minArmies: 1,
    text: `Controla ${count} territorios`,
  };
}

/** Reparte un objetivo a cada jugador, de forma determinista. */
export function assignMissions(
  state: GameState,
  map: GameMap,
  rng: Rng,
): Record<PlayerId, Mission> {
  const playerIds = state.turnOrder;
  const missions: Record<PlayerId, Mission> = {};

  // Barajamos las plantillas para que dos partidas con la misma semilla y
  // distinta gente no repitan siempre el mismo reparto.
  const pool = buildPool(state, map);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Reparto sin repetir: cada jugador se lleva el primero de la baraja que le
  // sirva (nadie puede tener el objetivo de eliminarse a sí mismo) y que no se
  // haya llevado ya otro.
  const taken = new Set<number>();
  for (const playerId of playerIds) {
    const index = pool.findIndex(
      (mission, i) => !taken.has(i) && mission.targetPlayerId !== playerId,
    );
    if (index === -1) {
      missions[playerId] = fallbackMission(map);
      continue;
    }
    taken.add(index);
    missions[playerId] = pool[index];
  }
  return missions;
}

/** Plantillas posibles para este mapa y esta mesa. */
function buildPool(state: GameState, map: GameMap): Mission[] {
  const pool: Mission[] = [];
  const continents = map.continents;

  // 1. Pares de continentes que se tocan: dos enteros es una meta exigente pero
  //    alcanzable, y obliga a jugar en una dirección concreta.
  const pairs = continentPairs(map);
  for (const [a, b] of pairs) {
    const first = continents.find((c) => c.id === a)!;
    const second = continents.find((c) => c.id === b)!;
    pool.push({
      kind: 'continents',
      continentIds: [a, b],
      text: `Conquista ${first.name} y ${second.name}`,
    });
  }

  // 2. Número de territorios, con y sin exigencia de guarnición.
  const total = map.territories.length;
  pool.push({
    kind: 'territories',
    count: Math.ceil(total * 0.6),
    minArmies: 1,
    text: `Controla ${Math.ceil(total * 0.6)} territorios`,
  });
  pool.push({
    kind: 'territories',
    count: Math.ceil(total * 0.45),
    minArmies: 2,
    text: `Controla ${Math.ceil(total * 0.45)} territorios con 2 ejércitos o más en cada uno`,
  });

  // 3. Eliminar a alguien. Si a esa persona la saca otro, el objetivo cambia
  //    solo al de reserva (ver `activeMission`).
  for (const player of state.players) {
    pool.push({
      kind: 'eliminate',
      targetPlayerId: player.id,
      text: `Elimina a ${player.name}`,
    });
  }

  return pool;
}

/** Parejas de continentes que comparten frontera. */
function continentPairs(map: GameMap): [string, string][] {
  const continentOf = new Map(map.territories.map((t) => [t.id, t.continentId]));
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  for (const territory of map.territories) {
    for (const other of territory.adjacent) {
      const a = territory.continentId;
      const b = continentOf.get(other);
      if (!b || a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(a < b ? [a, b] : [b, a]);
    }
  }
  return pairs;
}

/**
 * Objetivo que de verdad está jugando alguien ahora mismo.
 *
 * Si le tocó eliminar a quien ya está fuera por mano ajena (o a sí mismo, que no
 * puede pasar pero más vale cubrirlo), juega el de reserva.
 */
export function activeMission(state: GameState, map: GameMap, playerId: PlayerId): Mission | null {
  const mission = state.missions?.[playerId];
  if (!mission) return null;
  if (mission.kind !== 'eliminate') return mission;

  const target = state.players.find((p) => p.id === mission.targetPlayerId);
  if (!target) return fallbackMission(map);
  if (target.id === playerId) return fallbackMission(map);
  // Si sigue vivo, el objetivo vale; si lo eliminó este jugador, también.
  if (!target.eliminated) return mission;
  return target.eliminatedBy === playerId ? mission : fallbackMission(map);
}

/** ¿Está cumplido el objetivo de este jugador? */
export function isMissionComplete(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): boolean {
  const mission = activeMission(state, map, playerId);
  if (!mission) return false;

  switch (mission.kind) {
    case 'continents': {
      const owned = new Set(continentsOf(state, map, playerId));
      return (mission.continentIds ?? []).every((id) => owned.has(id));
    }
    case 'territories': {
      const minArmies = mission.minArmies ?? 1;
      const held = territoriesOf(state, playerId).filter(
        (id) => state.territories[id].armies >= minArmies,
      );
      return held.length >= (mission.count ?? Infinity);
    }
    case 'eliminate': {
      const target = state.players.find((p) => p.id === mission.targetPlayerId);
      return !!target && target.eliminated && target.eliminatedBy === playerId;
    }
    default:
      return false;
  }
}

/** Cuánto le falta, para enseñarlo en pantalla. */
export function missionProgress(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): { text: string; done: boolean; detail: string } {
  const mission = activeMission(state, map, playerId);
  if (!mission) return { text: '', done: false, detail: '' };
  const done = isMissionComplete(state, map, playerId);

  switch (mission.kind) {
    case 'continents': {
      const owned = new Set(continentsOf(state, map, playerId));
      const missing = (mission.continentIds ?? []).filter((id) => !owned.has(id));
      const names = missing.map((id) => map.continents.find((c) => c.id === id)?.name ?? id);
      return {
        text: mission.text,
        done,
        detail: done ? 'Cumplido' : `Te falta ${names.join(' y ')}`,
      };
    }
    case 'territories': {
      const minArmies = mission.minArmies ?? 1;
      const held = territoriesOf(state, playerId).filter(
        (id) => state.territories[id].armies >= minArmies,
      ).length;
      return {
        text: mission.text,
        done,
        detail: `${held} de ${mission.count ?? 0}`,
      };
    }
    case 'eliminate': {
      const target = state.players.find((p) => p.id === mission.targetPlayerId);
      return {
        text: mission.text,
        done,
        detail: done ? 'Cumplido' : target?.eliminated ? 'Se te adelantaron' : 'Sigue en pie',
      };
    }
    default:
      return { text: mission.text, done, detail: '' };
  }
}
