import { GameMap, GameState, PlayerId, TerritoryId } from './types';

/** Número de ejércitos iniciales según cuántos jueguen (regla clásica). */
export function startingArmiesFor(playerCount: number): number {
  const table: Record<number, number> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };
  return table[playerCount] ?? Math.max(20, 45 - playerCount * 5);
}

export function territoriesOf(state: GameState, playerId: PlayerId): TerritoryId[] {
  return Object.keys(state.territories).filter((id) => state.territories[id].ownerId === playerId);
}

export function armiesOf(state: GameState, playerId: PlayerId): number {
  return territoriesOf(state, playerId).reduce((sum, id) => sum + state.territories[id].armies, 0);
}

/** Continentes controlados por completo. */
export function continentsOf(state: GameState, map: GameMap, playerId: PlayerId): string[] {
  return map.continents
    .filter((continent) =>
      continent.territoryIds.every((id) => state.territories[id]?.ownerId === playerId),
    )
    .map((continent) => continent.id);
}

/**
 * Refuerzos de la fase de reclutamiento:
 * territorios / 3 (mínimo 3) más la bonificación de cada continente completo.
 */
export function reinforcementsFor(state: GameState, map: GameMap, playerId: PlayerId): number {
  const owned = territoriesOf(state, playerId).length;
  if (owned === 0) return 0;
  const base = Math.max(3, Math.floor(owned / 3));
  const bonus = continentsOf(state, map, playerId).reduce(
    (sum, continentId) => sum + (map.continents.find((c) => c.id === continentId)?.bonus ?? 0),
    0,
  );
  return base + bonus;
}

/** Desglose de refuerzos, para poder explicárselo al jugador en pantalla. */
export function reinforcementBreakdown(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): { base: number; continents: Array<{ id: string; name: string; bonus: number }>; total: number } {
  const owned = territoriesOf(state, playerId).length;
  const base = owned === 0 ? 0 : Math.max(3, Math.floor(owned / 3));
  const continents = continentsOf(state, map, playerId).map((id) => {
    const continent = map.continents.find((c) => c.id === id)!;
    return { id, name: continent.name, bonus: continent.bonus };
  });
  const total = owned === 0 ? 0 : base + continents.reduce((sum, c) => sum + c.bonus, 0);
  return { base, continents, total };
}

/** ¿Se puede atacar `to` desde `from`? (mismo dueño, adyacencia y 2+ ejércitos) */
export function canAttack(
  state: GameState,
  map: GameMap,
  from: TerritoryId,
  to: TerritoryId,
  playerId: PlayerId,
): boolean {
  const origin = state.territories[from];
  const target = state.territories[to];
  if (!origin || !target) return false;
  if (origin.ownerId !== playerId) return false;
  if (target.ownerId === playerId) return false;
  if (origin.armies < 2) return false;
  return adjacencyOf(map, from).includes(to);
}

const adjacencyCache = new WeakMap<GameMap, Record<TerritoryId, TerritoryId[]>>();

/** Adyacencia indexada (se calcula una vez por mapa). */
export function adjacencyOf(map: GameMap, id: TerritoryId): TerritoryId[] {
  let index = adjacencyCache.get(map);
  if (!index) {
    index = {};
    for (const territory of map.territories) index[territory.id] = territory.adjacent;
    adjacencyCache.set(map, index);
  }
  return index[id] ?? [];
}

/**
 * ¿Están `from` y `to` conectados por territorios del mismo jugador?
 * Es la condición de la regla estándar de reagrupación.
 */
export function areConnected(
  state: GameState,
  map: GameMap,
  from: TerritoryId,
  to: TerritoryId,
  playerId: PlayerId,
): boolean {
  if (from === to) return false;
  if (state.territories[from]?.ownerId !== playerId) return false;
  if (state.territories[to]?.ownerId !== playerId) return false;

  const visited = new Set<TerritoryId>([from]);
  const queue: TerritoryId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbour of adjacencyOf(map, current)) {
      if (visited.has(neighbour)) continue;
      if (state.territories[neighbour]?.ownerId !== playerId) continue;
      if (neighbour === to) return true;
      visited.add(neighbour);
      queue.push(neighbour);
    }
  }
  return false;
}

/** Territorios propios desde los que se puede atacar a alguien. */
export function attackSources(state: GameState, map: GameMap, playerId: PlayerId): TerritoryId[] {
  return territoriesOf(state, playerId).filter(
    (id) =>
      state.territories[id].armies >= 2 &&
      adjacencyOf(map, id).some((n) => state.territories[n]?.ownerId !== playerId),
  );
}

/** Objetivos enemigos alcanzables desde un territorio propio. */
export function attackTargets(
  state: GameState,
  map: GameMap,
  from: TerritoryId,
  playerId: PlayerId,
): TerritoryId[] {
  return adjacencyOf(map, from).filter((id) => state.territories[id]?.ownerId !== playerId);
}

/** Territorios propios que tocan a un enemigo (frontera). */
export function borderTerritories(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): TerritoryId[] {
  return territoriesOf(state, playerId).filter((id) =>
    adjacencyOf(map, id).some((n) => state.territories[n]?.ownerId !== playerId),
  );
}

/** Territorios propios rodeados solo por territorios propios (retaguardia). */
export function interiorTerritories(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): TerritoryId[] {
  return territoriesOf(state, playerId).filter((id) =>
    adjacencyOf(map, id).every((n) => state.territories[n]?.ownerId === playerId),
  );
}

/** Jugadores que aún siguen en la partida. */
export function activePlayers(state: GameState) {
  return state.players.filter((p) => !p.eliminated);
}

/** El grafo del mapa es conexo (condición necesaria para que sea jugable). */
export function isMapConnected(map: GameMap): boolean {
  if (map.territories.length === 0) return false;
  const visited = new Set<TerritoryId>([map.territories[0].id]);
  const queue = [map.territories[0].id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbour of adjacencyOf(map, current)) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return visited.size === map.territories.length;
}
