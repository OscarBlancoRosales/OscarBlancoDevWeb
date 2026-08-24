import { GameMap, GameState, GameAction, PlayerId, TerritoryId } from './types';
import { parseHexArt } from './geometry';
import { applyAction, createGame, CreateGameOptions, PlayerSeed } from './engine';

/**
 * Utilidades compartidas por los tests del motor.
 *
 * El mapa de laboratorio es diminuto a propósito: seis territorios y dos
 * continentes permiten comprobar reglas (bonificaciones, cercos, eliminaciones)
 * sin depender del tablero real.
 */
const TINY_ART = ['A1 A2 A3', 'B1 B2 B3'];
const TINY_HEXES = parseHexArt(TINY_ART);

const TINY_ADJACENCY: Record<string, string[]> = {
  A1: ['A2', 'B1'],
  A2: ['A1', 'A3', 'B1', 'B2'],
  A3: ['A2', 'B2', 'B3'],
  B1: ['A1', 'A2', 'B2'],
  B2: ['A2', 'A3', 'B1', 'B3'],
  B3: ['A3', 'B2'],
};

export const TINY_MAP: GameMap = {
  id: 'tiny',
  name: 'Mapa de laboratorio',
  description: 'Mapa mínimo usado por los tests del motor.',
  hexRadius: 20,
  maxPlayers: 3,
  territories: Object.keys(TINY_ADJACENCY).map((id) => ({
    id,
    name: `Territorio ${id}`,
    continentId: id.startsWith('A') ? 'alpha' : 'beta',
    adjacent: TINY_ADJACENCY[id],
    hexes: TINY_HEXES[id] ?? [],
  })),
  continents: [
    { id: 'alpha', name: 'Alfa', bonus: 3, color: '#00e676', territoryIds: ['A1', 'A2', 'A3'] },
    { id: 'beta', name: 'Beta', bonus: 2, color: '#ff5252', territoryIds: ['B1', 'B2', 'B3'] },
  ],
};

export const TEST_PLAYERS: PlayerSeed[] = [
  { id: 'p1', name: 'Ada', kind: 'human' },
  { id: 'p2', name: 'Bram', kind: 'bot', botProfile: 'agresivo' },
];

/** Partida de laboratorio con orden de turno forzado y estable. */
export function makeGame(overrides: Partial<CreateGameOptions> = {}): GameState {
  const state = createGame({
    map: TINY_MAP,
    players: TEST_PLAYERS,
    seed: 12345,
    ...overrides,
  });
  return state;
}

/** Coloca el tablero a mano: dueño y ejércitos por territorio. */
export function setBoard(
  state: GameState,
  board: Record<TerritoryId, [PlayerId | null, number]>,
): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  for (const [territoryId, [ownerId, armies]] of Object.entries(board)) {
    next.territories[territoryId] = { ownerId, armies };
  }
  return next;
}

/** Fuerza el turno de un jugador concreto en una fase concreta. */
export function forceTurn(
  state: GameState,
  playerId: PlayerId,
  phase: GameState['phase'],
  reserve = 0,
): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  next.currentPlayerIndex = next.turnOrder.indexOf(playerId);
  next.phase = phase;
  next.pendingOccupation = null;
  next.fortifiedThisTurn = false;
  const player = next.players.find((p) => p.id === playerId)!;
  player.reserve = reserve;
  return next;
}

/** Aplica una secuencia de acciones seguidas. */
export function applyAll(
  state: GameState,
  actions: GameAction[],
  map: GameMap = TINY_MAP,
): GameState {
  return actions.reduce((current, action) => applyAction(current, action, map), state);
}

/** Captura el error de regla lanzado por una acción (o null si es legal). */
export function ruleErrorOf(
  state: GameState,
  action: GameAction,
  map: GameMap = TINY_MAP,
): string | null {
  try {
    applyAction(state, action, map);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}
