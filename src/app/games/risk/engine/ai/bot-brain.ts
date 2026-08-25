import {
  BotProfile,
  GameAction,
  GameMap,
  GameState,
  PlayerId,
  TerritoryId,
  UnitKind,
} from '../types';
import { conquestOdds, maxAttackDice } from '../combat';
import { approachOf, battleRulesFor, terrainOf, TERRAIN_META } from '../terrain';
import { hasUnit, infantryOf, isOpen, UNIT_META } from '../units';
import {
  adjacencyOf,
  areConnected,
  attackTargets,
  borderTerritories,
  interiorTerritories,
  territoriesOf,
} from '../rules';
import { findTradeableSet } from '../cards';
import { mustTrade, playerById } from '../engine';
import { rngFor } from '../rng';

/**
 * Cerebro heurístico local: juega partidas completas sin ninguna API externa.
 *
 * Es la base del sistema de IA. Cuando hay un modelo de lenguaje configurado,
 * este cerebro sigue siendo la red de seguridad: valida, completa y sustituye
 * cualquier jugada que el modelo proponga y no sea legal.
 */

export interface ProfileTraits {
  /** Probabilidad mínima de conquista para lanzarse al ataque. */
  attackThreshold: number;
  /** Cuánto le atrae completar continentes. */
  continentGreed: number;
  /** Cuánto le atrae rematar a un jugador débil. */
  aggression: number;
  /** Cuánto reparte los refuerzos entre varios frentes. */
  spread: number;
  /** Máximo de ataques por turno. */
  maxAttacksPerTurn: number;
  label: string;
  description: string;
}

export const BOT_PROFILES: Record<BotProfile, ProfileTraits> = {
  agresivo: {
    attackThreshold: 0.42,
    continentGreed: 0.15,
    aggression: 0.35,
    spread: 1,
    maxAttacksPerTurn: 26,
    label: 'Agresivo',
    description: 'Ataca a la mínima. Si duda, ataca igual.',
  },
  cauto: {
    attackThreshold: 0.72,
    continentGreed: 0.2,
    aggression: 0.1,
    spread: 3,
    maxAttacksPerTurn: 10,
    label: 'Cauto',
    description: 'Se atrinchera, solo ataca cuando la tirada está de su parte.',
  },
  oportunista: {
    attackThreshold: 0.58,
    continentGreed: 0.25,
    aggression: 0.3,
    spread: 2,
    maxAttacksPerTurn: 18,
    label: 'Oportunista',
    description: 'Busca fronteras flojas y se ceba con el que va perdiendo.',
  },
  expansivo: {
    attackThreshold: 0.52,
    continentGreed: 0.45,
    aggression: 0.15,
    spread: 3,
    maxAttacksPerTurn: 20,
    label: 'Expansivo',
    description: 'Obsesionado con cerrar continentes y cobrar bonificación.',
  },
  vengativo: {
    attackThreshold: 0.5,
    continentGreed: 0.15,
    aggression: 0.4,
    spread: 2,
    maxAttacksPerTurn: 22,
    label: 'Vengativo',
    description: 'Recuerda quién le atacó y va a por él aunque le cueste.',
  },
};

export const BOT_PROFILE_IDS = Object.keys(BOT_PROFILES) as BotProfile[];

export function traitsOf(profile: BotProfile | undefined): ProfileTraits {
  return BOT_PROFILES[profile ?? 'oportunista'];
}

/** Ronda a partir de la cual se considera que la partida se está enquistando. */
const STALEMATE_FROM_ROUND = 12;
/** Cuánto se relaja el umbral por cada ronda de más, y hasta dónde. */
const RELIEF_PER_ROUND = 0.015;
const MAX_RELIEF = 0.6;
/**
 * Por debajo de aquí no baja el listón por mucho que se enquiste la partida.
 *
 * Estaba en 0,20 y se quedó corto al llegar la orografía: atacar 8 contra 8 en
 * montaña da 0,198, o sea justo por debajo, así que los bots no atacaban una
 * montaña NUNCA y se dedicaban a acumular. Medido en 180 partidas por
 * configuración: con el suelo en 0,20 quedaban 6 sin terminar en modo avanzado
 * y 2 en clásico; con 0,06 y el tope de alivio en 0,6, ninguna en clásico y 3
 * en avanzado, y además las partidas clásicas acaban antes (ronda media 40 en
 * vez de 43).
 */
const MIN_ATTACK_THRESHOLD = 0.06;

/**
 * Rebaja del listón de ataque cuando la partida se atasca.
 *
 * Sin esto hay un empate estable: si nadie ataca, todos acumulan ejércitos, las
 * probabilidades de conquista bajan para todos y ya nadie vuelve a atacar nunca.
 * Se veía en las mediciones: partidas de 700 rondas sin un solo ganador.
 *
 * La guerra se va calentando: a partir de cierta ronda cada turno que pasa hace
 * a todo el mundo un poco más temerario, hasta que alguien rompe el frente.
 * No es aleatorio ni depende del reloj, así que la partida sigue siendo
 * reproducible.
 */
export function stalemateRelief(round: number): number {
  return Math.min(MAX_RELIEF, Math.max(0, round - STALEMATE_FROM_ROUND) * RELIEF_PER_ROUND);
}

/** Umbral de ataque que aplica de verdad, con perfil, sesgo y atasco. */
export function effectiveAttackThreshold(
  traits: ProfileTraits,
  round: number,
  bias?: StrategyBias,
): number {
  const base = traits.attackThreshold + (bias?.thresholdShift ?? 0);
  return Math.max(MIN_ATTACK_THRESHOLD, base - stalemateRelief(round));
}

// ===== ANÁLISIS DEL TABLERO =====

export interface TerritoryThreat {
  id: TerritoryId;
  armies: number;
  enemyArmies: number;
  enemyCount: number;
  /** Diferencia entre lo que le pueden tirar encima y lo que tiene. */
  pressure: number;
}

/** Presión enemiga sobre cada territorio propio de frontera. */
export function threatMap(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): TerritoryThreat[] {
  return borderTerritories(state, map, playerId)
    .map((id) => {
      const enemies = adjacencyOf(map, id).filter(
        (other) => state.territories[other]?.ownerId !== playerId,
      );
      const armies = state.territories[id].armies;
      const enemyArmies = enemies.reduce(
        (sum, other) => sum + (state.territories[other]?.armies ?? 0),
        0,
      );
      return {
        id,
        armies,
        enemyArmies,
        enemyCount: enemies.length,
        pressure: threatWeight(state, map, playerId, id, enemies) - armies,
      };
    })
    .sort((a, b) => b.pressure - a.pressure);
}

/**
 * Cuánta fuerza enemiga pesa de verdad sobre un territorio.
 *
 * En el clásico es la suma de ejércitos vecinos y ya está. En modo avanzado se
 * pondera cada vecino por lo fácil que le resultaría entrar: doce ejércitos
 * enfrente de una montaña aprietan menos que doce enfrente de un desierto, y
 * doce al otro lado del mar aprietan mucho menos todavía.
 *
 * La ponderación es el cociente entre las probabilidades reales de ese ataque y
 * las que tendría el mismo ataque en llanura, así que en llanura vale 1 y el
 * clásico no cambia. Se apoya en la misma caché de `conquestOdds` que usa el
 * resto de la IA, así que no cuesta nada apreciable.
 */
function threatWeight(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  id: TerritoryId,
  enemies: TerritoryId[],
): number {
  const armies = state.territories[id].armies;
  let total = 0;
  for (const other of enemies) {
    const enemyArmies = state.territories[other]?.armies ?? 0;
    if (enemyArmies <= 0) continue;
    if (!state.config.advancedTerrain) {
      total += enemyArmies;
      continue;
    }
    const plain = conquestOdds(enemyArmies, armies);
    if (plain <= 0) continue;
    const real = conquestOdds(
      enemyArmies,
      armies,
      battleRulesFor(map, state.config, other, id, state.territories[other], state.territories[id]),
    );
    total += enemyArmies * (real / plain);
  }
  return total;
}

export interface ContinentProgress {
  id: string;
  name: string;
  bonus: number;
  owned: number;
  total: number;
  ratio: number;
  missing: TerritoryId[];
}

/** Cómo va cada continente para un jugador: clave para decidir a qué aspirar. */
export function continentProgress(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): ContinentProgress[] {
  return map.continents
    .map((continent) => {
      const missing = continent.territoryIds.filter(
        (id) => state.territories[id]?.ownerId !== playerId,
      );
      const owned = continent.territoryIds.length - missing.length;
      return {
        id: continent.id,
        name: continent.name,
        bonus: continent.bonus,
        owned,
        total: continent.territoryIds.length,
        ratio: owned / continent.territoryIds.length,
        missing,
      };
    })
    .sort((a, b) => b.ratio * b.bonus - a.ratio * a.bonus);
}

/** Clasificación por territorios y ejércitos (la usan la IA y el marcador). */
export function standings(
  state: GameState,
): Array<{ playerId: PlayerId; territories: number; armies: number }> {
  return state.players
    .map((player) => {
      const owned = territoriesOf(state, player.id);
      return {
        playerId: player.id,
        territories: owned.length,
        armies: owned.reduce((sum, id) => sum + state.territories[id].armies, 0),
      };
    })
    .sort((a, b) => b.territories - a.territories || b.armies - a.armies);
}

export interface AttackOption {
  from: TerritoryId;
  to: TerritoryId;
  dice: number;
  odds: number;
  score: number;
  reason: string;
}

/**
 * Inclinación estratégica que puede venir de un modelo de lenguaje.
 * Nunca decide por sí sola: solo mueve la puntuación de las jugadas legales.
 */
export interface StrategyBias {
  /** Territorios enemigos que el modelo quiere atacar. */
  targets?: readonly TerritoryId[];
  /** Territorios propios que el modelo quiere reforzar. */
  defend?: readonly TerritoryId[];
  /** Ajuste del umbral de ataque: negativo = más agresivo. */
  thresholdShift?: number;
}

function biasBoost(bias: StrategyBias | undefined, list: 'targets' | 'defend', id: TerritoryId): number {
  const values = bias?.[list];
  if (!values || values.length === 0) return 0;
  const index = values.indexOf(id);
  if (index === -1) return 0;
  // Los primeros de la lista pesan más que los últimos.
  return 0.3 - Math.min(0.2, index * 0.05);
}

/** Enumera y puntúa todos los ataques legales del jugador. */
export function rankedAttacks(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  profile: BotProfile | undefined = 'oportunista',
  bias?: StrategyBias,
): AttackOption[] {
  const traits = traitsOf(profile);
  const progress = continentProgress(state, map, playerId);
  const board = standings(state);
  const leaderId = board[0]?.playerId;
  const options: AttackOption[] = [];

  for (const from of territoriesOf(state, playerId)) {
    const origin = state.territories[from];
    if (origin.armies < 2) continue;

    // `attackTargets` incluye el alcance aéreo cuando lo hay, así que la IA ve
    // exactamente los mismos objetivos que el jugador.
    for (const to of attackTargets(state, map, from, playerId)) {
      const target = state.territories[to];
      if (!target || target.ownerId === playerId) continue;

      // Las mismas reglas que aplicará el combate, terreno incluido: la IA no
      // debe calcular con otras o atacaría montañas creyéndolas llanuras.
      const rules = battleRulesFor(map, state.config, from, to, origin, target);
      const odds = conquestOdds(origin.armies, target.armies, rules);
      let score = odds;
      const reasons: string[] = [];

      if (state.config.advancedTerrain) {
        const terrain = terrainOf(map, to);
        if (terrain !== 'llanura') reasons.push(TERRAIN_META[terrain].name.toLowerCase());
      }
      if (state.config.advancedUnits && approachOf(map, from, to, origin) === 'aereo') {
        score += 0.1;
        reasons.push('por aire, sin frontera');
      }

      const targetContinent = map.territories.find((t) => t.id === to)?.continentId;
      const continent = progress.find((c) => c.id === targetContinent);
      if (continent) {
        if (continent.missing.length === 1 && continent.missing[0] === to) {
          score += traits.continentGreed + 0.3;
          reasons.push(`cierra ${continent.name}`);
        } else if (continent.ratio >= 0.5) {
          score += traits.continentGreed * continent.ratio;
          reasons.push(`avanza en ${continent.name}`);
        }
      }

      if (target.armies === 1) {
        score += 0.18;
        reasons.push('está casi vacío');
      }
      if (target.ownerId && target.ownerId === leaderId && playerId !== leaderId) {
        score += traits.aggression * 0.5;
        reasons.push('frena al líder');
      }
      const targetOwnerTerritories = target.ownerId
        ? board.find((entry) => entry.playerId === target.ownerId)?.territories ?? 0
        : 0;
      if (target.ownerId && targetOwnerTerritories === 1) {
        score += traits.aggression;
        reasons.push('lo elimina de la partida');
      }

      // Penaliza dejar desguarnecido un frente caliente.
      const otherEnemies = adjacencyOf(map, from).filter(
        (other) => other !== to && state.territories[other]?.ownerId !== playerId,
      );
      if (otherEnemies.length >= 2) {
        score -= 0.08 * otherEnemies.length;
        reasons.push('frente expuesto');
      }

      const steer = biasBoost(bias, 'targets', to);
      if (steer > 0) {
        score += steer;
        reasons.push('objetivo marcado por la IA');
      }

      options.push({
        from,
        to,
        dice: maxAttackDice(origin.armies, rules.attack),
        odds,
        score,
        reason: reasons.join(', ') || 'presión sobre la frontera',
      });
    }
  }

  return options.sort((a, b) => b.score - a.score);
}

/**
 * ¿Conviene ascender una ficha a especialista antes de repartir refuerzos?
 *
 * La IA construye poco y con criterio, no por acumular: solo si le sobra
 * reserva por encima de lo que necesita para tapar agujeros, y solo donde la
 * tropa hace algo. Devuelve null casi siempre, que es lo correcto.
 */
export function troopToBuild(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  profile: BotProfile | undefined = 'oportunista',
): GameAction | null {
  if (!state.config.advancedUnits) return null;
  const player = playerById(state, playerId);
  if (!player) return null;

  // Con la reserva justa, primero se tapan agujeros: una tropa no defiende un
  // frente por sí sola.
  const traits = traitsOf(profile);
  if (player.reserve < TROOP_RESERVE_FLOOR) return null;

  const options: Array<{ territoryId: TerritoryId; unit: UnitKind; score: number }> = [];
  for (const id of territoriesOf(state, playerId)) {
    const territory = state.territories[id];
    if (infantryOf(territory) < 1) continue;

    for (const unit of TROOP_PRIORITY) {
      const meta = UNIT_META[unit];
      if (player.reserve < meta.cost) continue;
      // Una segunda del mismo tipo en el mismo sitio no aporta nada: los efectos
      // no se acumulan.
      if (hasUnit(territory, unit)) continue;
      const score = troopValue(state, map, playerId, id, unit);
      if (score <= 0) continue;
      options.push({ territoryId: id, unit, score: score + traits.aggression * 0.1 });
    }
  }
  if (options.length === 0) return null;

  options.sort((a, b) => b.score - a.score || (a.territoryId < b.territoryId ? -1 : 1));
  const best = options[0];
  return { type: 'upgrade', playerId, territoryId: best.territoryId, unit: best.unit };
}

/** Por debajo de esta reserva la IA no gasta en tropas: primero, el frente. */
const TROOP_RESERVE_FLOOR = 6;

/** Orden de preferencia cuando varias tropas valen lo mismo. */
const TROOP_PRIORITY: UnitKind[] = ['blindado', 'naval', 'aereo', 'caballeria'];

/**
 * Cuánto vale una tropa concreta en un territorio concreto.
 *
 * Cada una se valora por lo que de verdad hace ahí, no por su coste: los
 * blindados solo sirven si desde ahí se ataca por tierra, la flota solo si hay
 * una ruta marítima que cruzar, y la aviación solo si abre objetivos que la
 * frontera no da.
 */
function troopValue(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  id: TerritoryId,
  unit: UnitKind,
): number {
  const territory = state.territories[id];
  const enemies = adjacencyOf(map, id).filter(
    (other) => state.territories[other]?.ownerId !== playerId,
  );

  switch (unit) {
    case 'blindado': {
      // Solo maniobran contra terreno abierto: un tanque enfrente de una sierra
      // no vale nada, y la IA tiene que saberlo igual que lo sabe el combate.
      const usable = enemies.filter(
        (other) =>
          approachOf(map, id, other, territory) === 'tierra' &&
          (!state.config.advancedTerrain || isOpen(terrainOf(map, other))),
      );
      if (usable.length === 0 || territory.armies < 4) return 0;
      // Además defienden aquí mismo si el sitio es abierto.
      const holds = !state.config.advancedTerrain || isOpen(terrainOf(map, id)) ? 0.15 : 0;
      return 0.6 + Math.min(0.3, usable.length * 0.1) + holds;
    }
    case 'naval': {
      const landings = enemies.filter(
        (other) => approachOf(map, id, other, undefined) === 'desembarco',
      );
      if (landings.length === 0 || territory.armies < 4) return 0;
      return 0.7 + Math.min(0.2, landings.length * 0.1);
    }
    case 'aereo': {
      // Vale por dos cosas: abre objetivos que la frontera no da, y empuja
      // contra terreno despejado. Sobre bosque o montaña no ve nada.
      const direct = new Set(adjacencyOf(map, id));
      let reachable = 0;
      let openTargets = 0;
      for (const neighbour of direct) {
        if (!state.config.advancedTerrain || isOpen(terrainOf(map, neighbour))) openTargets++;
        for (const second of adjacencyOf(map, neighbour)) {
          if (second === id || direct.has(second)) continue;
          if (state.territories[second]?.ownerId !== playerId) reachable++;
        }
      }
      if (reachable === 0 || territory.armies < 5) return 0;
      return 0.4 + Math.min(0.25, reachable * 0.05) + Math.min(0.15, openTargets * 0.05);
    }
    case 'caballeria': {
      // Lo principal que da es la segunda reagrupación, y con una basta. Si
      // además está en campo abierto contra campo abierto, empuja.
      const alreadyHas = territoriesOf(state, playerId).some((other) =>
        hasUnit(state.territories[other], 'caballeria'),
      );
      if (alreadyHas) return 0;
      const maneuvers =
        !state.config.advancedTerrain ||
        (isOpen(terrainOf(map, id)) && enemies.some((other) => isOpen(terrainOf(map, other))));
      return (enemies.length === 0 ? 0.5 : 0.2) + (maneuvers ? 0.1 : 0);
    }
    default:
      return 0;
  }
}

/** Reparto de refuerzos: dónde conviene poner los ejércitos y por qué. */
export function reinforcementPlan(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  reserve: number,
  profile: BotProfile | undefined = 'oportunista',
  bias?: StrategyBias,
): Array<{ territoryId: TerritoryId; armies: number; reason: string }> {
  if (reserve <= 0) return [];
  const traits = traitsOf(profile);
  const threats = threatMap(state, map, playerId);
  const progress = continentProgress(state, map, playerId);

  const scored = threats.map((threat) => {
    let score = threat.pressure + threat.enemyCount * 0.5;
    const continentId = map.territories.find((t) => t.id === threat.id)?.continentId;
    const continent = progress.find((c) => c.id === continentId);
    const reasons: string[] = [];
    if (threat.pressure > 0) reasons.push('frontera amenazada');
    if (continent && continent.ratio >= 0.5 && continent.missing.length > 0) {
      score += traits.continentGreed * 6 * continent.ratio;
      reasons.push(`trampolín hacia ${continent.name}`);
    }
    // Un territorio con un solo ejército en frontera es una invitación.
    if (threat.armies === 1) {
      score += 2;
      reasons.push('está solo');
    }
    const steerDefend = biasBoost(bias, 'defend', threat.id) * 20;
    if (steerDefend > 0) {
      score += steerDefend;
      reasons.push('la IA quiere apuntalarlo');
    }
    // Reforzar desde donde se piensa atacar también cuenta.
    const attackSpring = adjacencyOf(map, threat.id).some(
      (id) => biasBoost(bias, 'targets', id) > 0,
    );
    if (attackSpring) {
      score += 6;
      reasons.push('base del próximo ataque');
    }
    return { territoryId: threat.id, score, reason: reasons.join(', ') || 'refuerzo general' };
  });

  if (scored.length === 0) {
    const owned = territoriesOf(state, playerId);
    if (owned.length === 0) return [];
    return [{ territoryId: owned[0], armies: reserve, reason: 'sin fronteras que defender' }];
  }

  scored.sort((a, b) => b.score - a.score);
  const fronts = Math.max(1, Math.min(traits.spread, scored.length));
  const plan: Array<{ territoryId: TerritoryId; armies: number; reason: string }> = [];

  // El primer frente se lleva la mitad; el resto se reparte.
  let remaining = reserve;
  for (let i = 0; i < fronts; i++) {
    const isLast = i === fronts - 1;
    const share = isLast ? remaining : Math.max(1, Math.round(reserve / (i === 0 ? 2 : fronts)));
    const armies = Math.min(remaining, share);
    if (armies <= 0) break;
    plan.push({ territoryId: scored[i].territoryId, armies, reason: scored[i].reason });
    remaining -= armies;
  }
  if (remaining > 0 && plan.length > 0) plan[0].armies += remaining;
  return plan;
}

/** Mejor reagrupación: de la retaguardia más gorda al frente más caliente. */
export function fortifyPlan(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): { from: TerritoryId; to: TerritoryId; armies: number; reason: string } | null {
  const threats = threatMap(state, map, playerId);
  if (threats.length === 0) return null;

  const interior = interiorTerritories(state, map, playerId)
    .filter((id) => state.territories[id].armies > 1)
    .sort((a, b) => state.territories[b].armies - state.territories[a].armies);

  const destination = threats[0];

  for (const from of interior) {
    if (from === destination.id) continue;
    if (!areConnected(state, map, from, destination.id, playerId)) continue;
    const armies = state.territories[from].armies - 1;
    if (armies <= 0) continue;
    return {
      from,
      to: destination.id,
      armies,
      reason: 'trae la retaguardia al frente',
    };
  }

  // Si no hay retaguardia, saca tropas de la frontera más tranquila.
  const calm = [...threats].reverse().find(
    (candidate) =>
      candidate.id !== destination.id &&
      candidate.armies > 2 &&
      candidate.pressure < destination.pressure - 2 &&
      areConnected(state, map, candidate.id, destination.id, playerId),
  );
  if (calm) {
    return {
      from: calm.id,
      to: destination.id,
      armies: Math.max(1, Math.floor((calm.armies - 1) / 2)),
      reason: 'reequilibra los frentes',
    };
  }
  return null;
}

/** Cuántos ejércitos dejar atrás al ocupar una conquista. */
export function occupyAmount(
  state: GameState,
  map: GameMap,
  from: TerritoryId,
  to: TerritoryId,
  playerId: PlayerId,
  minArmies: number,
): number {
  const available = state.territories[from].armies - 1;
  const originStillBorders = adjacencyOf(map, from).some(
    (id) => id !== to && state.territories[id]?.ownerId !== playerId,
  );
  // Si la retaguardia queda a salvo, se lleva todo; si no, deja guarnición.
  const desired = originStillBorders ? Math.ceil(available / 2) : available;
  return Math.max(minArmies, Math.min(available, Math.max(1, desired)));
}

/** Cuántos ataques lleva el jugador en el turno actual. */
export function attacksThisTurn(state: GameState, playerId: PlayerId): number {
  let count = 0;
  for (let i = state.events.length - 1; i >= 0; i--) {
    const event = state.events[i];
    if (event.type === 'turn') break;
    if (event.type === 'attack' && event.playerId === playerId) count++;
  }
  return count;
}

/**
 * Decide la siguiente acción del bot. Devuelve null si no hay nada que hacer
 * (nunca debería pasar: siempre queda al menos terminar la fase).
 */
export function decideAction(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  bias?: StrategyBias,
): GameAction | null {
  const player = playerById(state, playerId);
  if (!player || player.eliminated) return null;
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) return null;
  if (state.phase === 'game-over') return null;

  const profile = player.botProfile ?? 'oportunista';
  const traits = traitsOf(profile);

  if (state.phase === 'setup-claim' || state.phase === 'setup-deploy') {
    return decideSetup(state, map, playerId);
  }

  if (state.phase === 'reinforce') {
    if (player.cards.length >= 3) {
      const shouldTrade = mustTrade(player) || player.cards.length >= 4 || state.tradeCount < 3;
      const trio = findTradeableSet(player.cards);
      if (shouldTrade && trio) {
        return {
          type: 'trade',
          playerId,
          cardIds: [trio[0].id, trio[1].id, trio[2].id],
        };
      }
    }
    if (player.reserve > 0) {
      const troop = troopToBuild(state, map, playerId, profile);
      if (troop) return troop;
      const plan = reinforcementPlan(state, map, playerId, player.reserve, profile, bias);
      if (plan.length > 0) {
        return { type: 'deploy', playerId, territoryId: plan[0].territoryId, armies: plan[0].armies };
      }
      const owned = territoriesOf(state, playerId);
      if (owned.length > 0) {
        return { type: 'deploy', playerId, territoryId: owned[0], armies: player.reserve };
      }
    }
    return { type: 'end-phase', playerId };
  }

  if (state.phase === 'attack') {
    if (state.pendingOccupation) {
      const { from, to, minArmies } = state.pendingOccupation;
      return {
        type: 'occupy',
        playerId,
        armies: occupyAmount(state, map, from, to, playerId, minArmies),
      };
    }
    if (attacksThisTurn(state, playerId) >= traits.maxAttacksPerTurn) {
      return { type: 'end-phase', playerId };
    }
    const options = rankedAttacks(state, map, playerId, profile, bias);
    const best = options[0];
    const threshold = effectiveAttackThreshold(traits, state.round, bias);
    if (best && best.odds >= threshold) {
      return { type: 'attack', playerId, from: best.from, to: best.to, dice: best.dice };
    }
    return { type: 'end-phase', playerId };
  }

  if (state.phase === 'fortify') {
    if (!state.fortifiedThisTurn) {
      const plan = fortifyPlan(state, map, playerId);
      if (plan) {
        return { type: 'fortify', playerId, from: plan.from, to: plan.to, armies: plan.armies };
      }
    }
    return { type: 'end-phase', playerId };
  }

  return { type: 'end-phase', playerId };
}

function decideSetup(state: GameState, map: GameMap, playerId: PlayerId): GameAction {
  if (state.phase === 'setup-claim') {
    const free = map.territories.filter((t) => state.territories[t.id].ownerId === null);
    const progress = continentProgress(state, map, playerId);
    const best = free
      .map((territory) => {
        const continent = progress.find((c) => c.id === territory.continentId);
        const neighboursOwned = adjacencyOf(map, territory.id).filter(
          (id) => state.territories[id]?.ownerId === playerId,
        ).length;
        const smallContinentBonus = continent ? (continent.bonus / continent.total) * 2 : 0;
        return { id: territory.id, score: neighboursOwned + smallContinentBonus };
      })
      .sort((a, b) => b.score - a.score)[0];
    return { type: 'claim', playerId, territoryId: best?.id ?? free[0].id };
  }

  const threats = threatMap(state, map, playerId);
  const owned = territoriesOf(state, playerId);
  const target = threats[0]?.id ?? owned[0];
  return { type: 'claim', playerId, territoryId: target };
}

// ===== VOZ DE LA IA (mensajes de chat sin depender de ningún modelo) =====

const OPENERS: Record<BotProfile, string[]> = {
  agresivo: ['A por todas.', 'Nada de esperar.', 'Hoy se rompe algo.'],
  cauto: ['Con calma.', 'Primero mirar, luego mover.', 'No conviene precipitarse.'],
  oportunista: ['Vamos a ver quién está flojo.', 'Huele a hueco.', 'Aquí hay negocio.'],
  expansivo: ['Toca cerrar continente.', 'Quiero la bonificación.', 'Un poco más y es mío.'],
  vengativo: ['No se me ha olvidado lo del turno pasado.', 'Hoy toca devolverla.', 'Tengo lista.'],
};

/** Comentario de estrategia del bot, coherente con lo que va a hacer. */
export function botCommentary(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
): string {
  const player = playerById(state, playerId);
  if (!player) return '';
  const profile = player.botProfile ?? 'oportunista';
  const rng = rngFor(state.seed, state.actionCount, `chat-${playerId}`);
  const opener = OPENERS[profile][rng.int(0, OPENERS[profile].length - 1)];

  const progress = continentProgress(state, map, playerId);
  const bestContinent = progress.find((c) => c.missing.length > 0 && c.ratio >= 0.5);
  const attacks = rankedAttacks(state, map, playerId, profile);
  const best = attacks[0];
  const threats = threatMap(state, map, playerId);
  const worst = threats[0];

  const parts: string[] = [opener];

  if (bestContinent) {
    const missingNames = bestContinent.missing
      .slice(0, 2)
      .map((id) => map.territories.find((t) => t.id === id)?.name ?? id)
      .join(' y ');
    parts.push(`Me falta ${missingNames} para cerrar ${bestContinent.name} (+${bestContinent.bonus}).`);
  }

  if (best && best.odds >= effectiveAttackThreshold(traitsOf(profile), state.round)) {
    const fromName = map.territories.find((t) => t.id === best.from)?.name ?? best.from;
    const toName = map.territories.find((t) => t.id === best.to)?.name ?? best.to;
    parts.push(
      `Voy desde ${fromName} contra ${toName}: ${Math.round(best.odds * 100)} % y ${best.reason}.`,
    );
  } else if (best) {
    parts.push(`Ninguna tirada me convence hoy (la mejor está al ${Math.round(best.odds * 100)} %).`);
  }

  if (worst && worst.pressure > 3) {
    const name = map.territories.find((t) => t.id === worst.id)?.name ?? worst.id;
    parts.push(`Y ojo con ${name}, que la tengo con ${worst.armies} contra ${worst.enemyArmies}.`);
  }

  return parts.join(' ');
}

/** Consejo para el jugador humano, con el mismo análisis que usan los bots. */
export function advisorTip(state: GameState, map: GameMap, playerId: PlayerId): string {
  const player = playerById(state, playerId);
  if (!player) return '';

  const progress = continentProgress(state, map, playerId);
  const attacks = rankedAttacks(state, map, playerId, 'oportunista');
  const threats = threatMap(state, map, playerId);
  const board = standings(state);
  const leader = board[0];
  const parts: string[] = [];

  if (state.phase === 'reinforce') {
    const plan = reinforcementPlan(state, map, playerId, Math.max(player.reserve, 1), 'oportunista');
    if (plan.length > 0) {
      const name = map.territories.find((t) => t.id === plan[0].territoryId)?.name;
      parts.push(`Yo pondría el grueso en ${name}: ${plan[0].reason}.`);
    }
    if (player.cards.length >= 3) {
      parts.push(
        player.cards.length >= 5
          ? 'Tienes 5 cartas: estás obligado a canjear antes de seguir.'
          : 'Tienes trío disponible; canjearlo ahora te da margen para atacar.',
      );
    }
  }

  if (state.phase === 'attack') {
    const good = attacks.filter((option) => option.odds >= 0.6).slice(0, 2);
    if (good.length > 0) {
      parts.push(
        good
          .map((option) => {
            const fromName = map.territories.find((t) => t.id === option.from)?.name;
            const toName = map.territories.find((t) => t.id === option.to)?.name;
            return `${fromName} → ${toName} (${Math.round(option.odds * 100)} %, ${option.reason})`;
          })
          .join(' · '),
      );
    } else {
      parts.push('No hay ataques con buena pinta: mejor consolidar y esperar refuerzos.');
    }
  }

  if (state.phase === 'fortify') {
    const plan = fortifyPlan(state, map, playerId);
    if (plan) {
      const fromName = map.territories.find((t) => t.id === plan.from)?.name;
      const toName = map.territories.find((t) => t.id === plan.to)?.name;
      parts.push(`Reagruparía ${plan.armies} de ${fromName} a ${toName}: ${plan.reason}.`);
    } else {
      parts.push('No hay ninguna reagrupación clara; puedes cerrar el turno.');
    }
  }

  const nearContinent = progress.find((c) => c.missing.length === 1);
  if (nearContinent) {
    const name = map.territories.find((t) => t.id === nearContinent.missing[0])?.name;
    parts.push(`Te falta ${name} para cobrar +${nearContinent.bonus} por ${nearContinent.name}.`);
  }

  if (leader && leader.playerId !== playerId && leader.territories > 0) {
    const leaderName = playerById(state, leader.playerId)?.name;
    parts.push(`${leaderName} va primero con ${leader.territories} territorios: vigílalo.`);
  }

  const danger = threats[0];
  if (danger && danger.pressure > 4) {
    const name = map.territories.find((t) => t.id === danger.id)?.name;
    parts.push(`Tu punto débil es ${name} (${danger.armies} contra ${danger.enemyArmies}).`);
  }

  return parts.join(' ');
}
