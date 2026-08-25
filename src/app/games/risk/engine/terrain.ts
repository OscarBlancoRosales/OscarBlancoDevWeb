import { GameConfig, GameMap, Terrain, TerritoryId, TerritoryState } from './types';
import { BattleRules, diceCapsOf } from './combat';
import { hasUnit } from './units';

/**
 * Orografía: el terreno de cada territorio cambia cómo se pelea por él.
 *
 * Toda la orografía entra al motor por un único sitio: `battleRulesFor` devuelve
 * los topes de dados y la bonificación del defensor de UN ataque concreto, y ese
 * mismo valor lo usan el combate real, el número que ve el jugador en pantalla y
 * la IA para decidir. Si se separaran, la interfaz mentiría y la IA jugaría a
 * ciegas.
 *
 * Sigue siendo puro y determinista: las reglas salen del mapa y de la
 * configuración congelada al empezar, nunca del reloj ni del azar, así que todos
 * los clientes calculan lo mismo reproduciendo el log.
 */

/**
 * Cómo llega el ataque al territorio.
 *
 * `aereo` no es una frontera: es un salto a un territorio que está a dos pasos,
 * que solo puede dar quien tenga aviación (ver `units.ts`).
 */
export type ApproachKind = 'tierra' | 'desembarco' | 'aereo';

export interface TerrainMeta {
  id: Terrain;
  /** Identificador sin acentos, para ids de SVG y clases CSS. */
  slug: string;
  name: string;
  /** Glifo para la leyenda y el tooltip. */
  glyph: string;
  /** Cómo pelea el defensor aquí, en una línea. */
  effect: string;
  /** Tinte de la trama que se dibuja sobre la silueta. */
  tint: string;
}

export const TERRAIN_META: Record<Terrain, TerrainMeta> = {
  llanura: {
    id: 'llanura',
    slug: 'llanura',
    name: 'Llanura',
    glyph: '≡',
    effect: 'Terreno abierto: el combate de siempre.',
    tint: '#9ccc65',
  },
  bosque: {
    id: 'bosque',
    slug: 'bosque',
    name: 'Bosque',
    glyph: '♣',
    effect: 'Emboscada en los flancos: +1 al segundo dado del defensor.',
    tint: '#2e7d32',
  },
  montaña: {
    id: 'montaña',
    slug: 'montana',
    name: 'Montaña',
    glyph: '▲',
    effect: 'Domina la altura: +1 al mejor dado del defensor.',
    tint: '#a1887f',
  },
  desierto: {
    id: 'desierto',
    slug: 'desierto',
    name: 'Desierto',
    glyph: '∴',
    effect: 'Flanco al descubierto: −1 al segundo dado del defensor.',
    tint: '#e0b040',
  },
  costa: {
    id: 'costa',
    slug: 'costa',
    name: 'Costa',
    glyph: '≈',
    effect: 'Por tierra, normal. Playa defendida: +1 al mejor dado contra un desembarco.',
    tint: '#29b6f6',
  },
};

export const TERRAINS = Object.keys(TERRAIN_META) as Terrain[];

/** Terreno de un territorio que no lo declara: llanura, o sea, el clásico. */
export const DEFAULT_TERRAIN: Terrain = 'llanura';

/**
 * Efecto de cada terreno, ya combinado con la forma de llegar.
 *
 * Dos palancas y nada más:
 *
 * - **El desembarco** recorta al atacante a 2 dados, sea cual sea el terreno:
 *   cruzando el mar no se mete toda la fuerza de golpe.
 * - **El terreno** mueve un dado del defensor, y solo uno. La montaña refuerza
 *   la posición principal (el mejor dado); el bosque y el desierto actúan sobre
 *   el segundo, que es el que cubre los flancos. La costa no hace nada por
 *   tierra: su ventaja es contra quien llega por mar.
 *
 * Que el bosque y el desierto vayan al segundo dado tiene una consecuencia que
 * se nota jugando: contra un defensor de un solo ejército, que tira un único
 * dado, no cambian nada. Un bosque vacío no embosca a nadie.
 *
 * Un ataque aéreo se parece a un desembarco en lo que importa: no lleva masa
 * detrás, así que también se queda en 2 dados. Lo que gana es alcance.
 *
 * Medido contra una simulación independiente de 300 000 batallas, un ataque de
 * 10 contra 5 pasa de 0,872 en llanura a 0,958 en desierto, 0,719 en bosque,
 * 0,699 en montaña y 0,394 desembarcando en una costa.
 */
export function terrainRules(terrain: Terrain, approach: ApproachKind): BattleRules {
  const attack = approach === 'tierra' ? 3 : 2;
  const landing = approach === 'desembarco';
  switch (terrain) {
    case 'bosque':
      return { attack, defend: 2, defenceBonus: [0, 1], attackBonus: [] };
    case 'montaña':
      return { attack, defend: 2, defenceBonus: [1], attackBonus: [] };
    case 'desierto':
      return { attack, defend: 2, defenceBonus: [0, -1], attackBonus: [] };
    case 'costa':
      return { attack, defend: 2, defenceBonus: landing ? [1] : [], attackBonus: [] };
    case 'llanura':
    default:
      return { attack, defend: 2, defenceBonus: [], attackBonus: [] };
  }
}

/**
 * Terreno declarado de un territorio (llanura si el mapa no dice nada).
 *
 * Indexado por mapa: la IA pregunta esto cientos de veces por turno y un
 * `find` lineal sobre 52 territorios se nota.
 */
export function terrainOf(map: GameMap, id: TerritoryId): Terrain {
  let index = terrainIndex.get(map);
  if (!index) {
    index = {};
    for (const territory of map.territories) {
      index[territory.id] = territory.terrain ?? DEFAULT_TERRAIN;
    }
    terrainIndex.set(map, index);
  }
  return index[id] ?? DEFAULT_TERRAIN;
}

const terrainIndex = new WeakMap<GameMap, Record<TerritoryId, Terrain>>();

/** ¿Esta adyacencia se dibuja suelta, sin fronteras que se toquen? */
export function isSeaRoute(map: GameMap, from: TerritoryId, to: TerritoryId): boolean {
  return indexOf(seaRouteIndex, map, map.seaRoutes).has(routeKey(from, to));
}

/** ¿Se dibuja suelta pero por reglas es tierra firme? */
export function isLandBridge(map: GameMap, from: TerritoryId, to: TerritoryId): boolean {
  return indexOf(landBridgeIndex, map, map.landBridges).has(routeKey(from, to));
}

const seaRouteIndex = new WeakMap<GameMap, Set<string>>();
const landBridgeIndex = new WeakMap<GameMap, Set<string>>();

function indexOf(
  cache: WeakMap<GameMap, Set<string>>,
  map: GameMap,
  pairs: Array<[TerritoryId, TerritoryId]> | undefined,
): Set<string> {
  let index = cache.get(map);
  if (!index) {
    index = new Set((pairs ?? []).map(([a, b]) => routeKey(a, b)));
    cache.set(map, index);
  }
  return index;
}

function routeKey(a: TerritoryId, b: TerritoryId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Cómo llega un ataque de `from` a `to`.
 *
 * Que una conexión se dibuje suelta no basta para que sea un desembarco: los
 * puentes de tierra se dibujan igual porque las siluetas no se tocan, pero se
 * cruzan a pie. Y una flota en el origen convierte el desembarco en un
 * desplazamiento normal: para eso están los barcos.
 *
 * Si los dos territorios ni siquiera son vecinos, el ataque solo puede ser
 * aéreo; quién puede hacerlo lo decide `rules.ts`, aquí solo se nombra.
 */
export function approachOf(
  map: GameMap,
  from: TerritoryId,
  to: TerritoryId,
  origin?: TerritoryState,
): ApproachKind {
  if (!areNeighbours(map, from, to)) return 'aereo';
  if (!isSeaRoute(map, from, to)) return 'tierra';
  if (isLandBridge(map, from, to)) return 'tierra';
  return hasUnit(origin, 'naval') ? 'tierra' : 'desembarco';
}

function areNeighbours(map: GameMap, from: TerritoryId, to: TerritoryId): boolean {
  let index = neighbourIndex.get(map);
  if (!index) {
    index = new Map();
    for (const territory of map.territories) index.set(territory.id, new Set(territory.adjacent));
    neighbourIndex.set(map, index);
  }
  return index.get(from)?.has(to) ?? false;
}

const neighbourIndex = new WeakMap<GameMap, Map<TerritoryId, Set<TerritoryId>>>();

/**
 * Reglas de combate de un ataque concreto.
 *
 * Con el modo avanzado apagado devuelve exactamente lo de siempre, así que las
 * partidas clásicas (y sus grabaciones) no cambian ni un dado.
 */
export function battleRulesFor(
  map: GameMap,
  config:
    | Pick<GameConfig, 'maxAttackDice' | 'maxDefendDice' | 'advancedTerrain' | 'advancedUnits'>
    | null
    | undefined,
  from: TerritoryId,
  to: TerritoryId,
  origin?: TerritoryState,
): BattleRules {
  const caps = diceCapsOf(config);
  const units = config?.advancedUnits ? origin : undefined;
  const approach = approachOf(map, from, to, units);

  // Los blindados empujan igual que la montaña frena: un dado, y solo el mejor.
  // No vuelan: en un ataque aéreo no cuentan.
  const attackBonus =
    config?.advancedUnits && approach === 'tierra' && hasUnit(origin, 'blindado') ? [1] : [];

  if (!config?.advancedTerrain) {
    // Sin orografía no hay desembarcos, pero el alcance aéreo sí existe: es de
    // las tropas, no del terreno.
    const attack = approach === 'aereo' ? Math.min(2, caps.attack) : caps.attack;
    return { ...caps, attack, attackBonus };
  }

  const rules = terrainRules(terrainOf(map, to), approach);
  // Los topes de la mesa siguen mandando: ni el terreno ni las tropas dan más
  // dados de los que la configuración permite.
  return {
    attack: Math.min(rules.attack, caps.attack),
    defend: Math.min(rules.defend, caps.defend),
    defenceBonus: rules.defenceBonus,
    attackBonus,
  };
}
