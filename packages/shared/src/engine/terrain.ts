import type { GameConfig, GameMap, Terrain, TerritoryId, TerritoryState } from './types';
import type { BattleRules} from './combat';
import { diceCapsOf } from './combat';
import { hasUnit, unitAssault, unitDefence } from './units';

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
  /** Qué le da a quien DEFIENDE aquí. */
  defence: string;
  /** Qué le da a quien ATACA DESDE aquí. */
  assault: string;
  /** Tinte de la trama que se dibuja sobre la silueta. */
  tint: string;
}

export const TERRAIN_META: Record<Terrain, TerrainMeta> = {
  llanura: {
    id: 'llanura',
    slug: 'llanura',
    name: 'Llanura',
    glyph: '≡',
    defence: 'Terreno abierto: nada a favor.',
    assault: 'Campo de maniobra: se despliega sin estorbos, pero sin sorpresa.',
    tint: '#9ccc65',
  },
  bosque: {
    id: 'bosque',
    slug: 'bosque',
    name: 'Bosque',
    glyph: '♣',
    defence: 'Emboscada en los flancos: +1 al segundo dado del defensor.',
    assault: 'Sales sin que te vean venir: +1 al mejor dado del atacante.',
    tint: '#2e7d32',
  },
  montaña: {
    id: 'montaña',
    slug: 'montana',
    name: 'Montaña',
    glyph: '▲',
    defence: 'Domina la altura: +1 al mejor dado del defensor.',
    assault: 'Bajas con impulso pero en columna: +1 al segundo dado del atacante.',
    tint: '#a1887f',
  },
  desierto: {
    id: 'desierto',
    slug: 'desierto',
    name: 'Desierto',
    glyph: '∴',
    defence: 'Flanco al descubierto: −1 al segundo dado del defensor.',
    assault: 'La aproximación se ve venir: −1 al segundo dado del atacante.',
    tint: '#e0b040',
  },
  costa: {
    id: 'costa',
    slug: 'costa',
    name: 'Costa',
    glyph: '≈',
    defence: 'Playa defendida: +1 al mejor dado contra un desembarco.',
    assault: 'Puerto de partida: por tierra, un frente como otro cualquiera.',
    tint: '#29b6f6',
  },
};

export const TERRAINS = Object.keys(TERRAIN_META) as Terrain[];

/** Terreno de un territorio que no lo declara: llanura, o sea, el clásico. */
export const DEFAULT_TERRAIN: Terrain = 'llanura';

/**
 * Tope de lo que puede desequilibrar UN combate, sumando todo.
 *
 * Es la lección más cara de este diseño. Con el terreno del defensor solo, un
 * paso de dado dejaba el 8 contra 8 entre 0,20 y 0,66: exigente y jugable. Al
 * añadir el terreno del atacante, las tropas de los dos lados y dejar que todo
 * se acumulara, el mismo 8 contra 8 se iba de 0,080 a 0,900: un muro por un lado
 * y un regalo por el otro, justo lo que ya se había descartado antes.
 *
 * Así que el saldo se acota a UN paso de dado. La pareja de terrenos y las
 * tropas siguen decidiendo QUÉ dado se mueve y a favor de quién —que es lo que
 * hace interesante el mapa—, pero ninguna combinación puede ir más allá de lo
 * que ya estaba medido y aceptado.
 */
export const MAX_NET_SHIFT = 1;

/**
 * Lo que el terreno le da a quien DEFIENDE en él.
 *
 * Cada terreno mueve un solo dado y en uno solo. La montaña refuerza la posición
 * principal (el mejor dado); el bosque y el desierto actúan sobre el segundo,
 * que es el que cubre los flancos. Eso tiene una consecuencia que se nota
 * jugando: contra un defensor de un solo ejército, que tira un único dado, el
 * bosque y el desierto no cambian nada. Un bosque vacío no embosca a nadie.
 */
export function terrainDefence(terrain: Terrain, approach: ApproachKind): number[] {
  switch (terrain) {
    case 'bosque':
      return [0, 1];
    case 'montaña':
      return [1];
    case 'desierto':
      return [0, -1];
    case 'costa':
      return approach === 'desembarco' ? [1] : [];
    default:
      return [];
  }
}

/**
 * Lo que el terreno le da a quien ATACA DESDE él.
 *
 * Sin esto el terreno era siempre un impuesto para el atacante, y el mapa se
 * leía en una sola dirección. Con las dos mitades, lo que importa es la PAREJA:
 * salir de un bosque contra una montaña cancela el bono de altura del defensor
 * en el mejor dado, mientras que cruzar un desierto para asaltar un bosque es lo
 * peor que se puede intentar.
 *
 * Un desembarco o un ataque aéreo no heredan nada del terreno de origen: quien
 * cruza el mar o llega volando deja atrás el suelo del que salió.
 */
export function terrainAssault(terrain: Terrain, approach: ApproachKind): number[] {
  if (approach !== 'tierra') return [];
  switch (terrain) {
    case 'bosque':
      return [1];
    case 'montaña':
      return [0, 1];
    case 'desierto':
      return [0, -1];
    default:
      return [];
  }
}

/** Suma dos vectores de bonificación por rango. */
export function addBonus(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return out;
}

/**
 * Acota el saldo del combate a un paso de dado EN CADA DIRECCIÓN.
 *
 * Es la lección más cara de este diseño. Con el terreno del defensor solo, un
 * paso de dado dejaba el 8 contra 8 entre 0,20 y 0,66: exigente y jugable. Al
 * añadir el terreno del atacante y las tropas de los dos lados, y dejar que todo
 * se acumulara, el mismo 8 contra 8 se iba de 0,080 a 0,900: un muro por un lado
 * y un regalo por el otro, justo lo que ya se había descartado antes.
 *
 * El primer arreglo —quedarse solo con el dado decisivo— acotaba bien pero
 * aplastaba la matriz: atacar un bosque desde un bosque salía igual que atacar
 * un desierto desde un bosque, porque la ventaja del defensor se tiraba entera.
 *
 * Así que se acota por separado: como mucho un paso a favor del atacante y como
 * mucho uno a favor del defensor. Un combate puede estar desequilibrado en los
 * dos dados a la vez, uno para cada lado —que es justo lo que pasa en un bosque
 * contra otro bosque—, pero nadie puede acumular dos pasos a su favor.
 *
 * En los empates gana el índice más bajo, que es el mejor dado: determinista, y
 * dos clientes reproduciendo el log llegan al mismo sitio.
 */
export function capNet(net: number[]): number[] {
  const out = new Array(net.length).fill(0);
  for (const sign of [1, -1]) {
    let bestIndex = -1;
    let bestValue = 0;
    net.forEach((value, index) => {
      if (Math.sign(value) !== sign) return;
      if (Math.abs(value) > Math.abs(bestValue)) {
        bestValue = value;
        bestIndex = index;
      }
    });
    if (bestIndex !== -1) out[bestIndex] = sign * Math.min(Math.abs(bestValue), MAX_NET_SHIFT);
  }
  return out;
}

/**
 * Reglas de un combate mirando SOLO al terreno de los dos lados.
 *
 * Es la matriz del mapa en estado puro, sin tropas ni topes de mesa: lo que usan
 * los tests y las herramientas de medida para que midan exactamente lo mismo que
 * juega el motor.
 */
export function terrainPairRules(
  from: Terrain,
  to: Terrain,
  approach: ApproachKind = 'tierra',
): BattleRules {
  const net = capNet(subtract(terrainAssault(from, approach), terrainDefence(to, approach)));
  return {
    attack: approach === 'tierra' ? 3 : 2,
    defend: 2,
    attackBonus: trimTrailingZeros(net.map((value) => Math.max(0, value))),
    defenceBonus: trimTrailingZeros(net.map((value) => Math.max(0, -value))),
  };
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
  pairs: [TerritoryId, TerritoryId][] | undefined,
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
  target?: TerritoryState,
): BattleRules {
  const caps = diceCapsOf(config);
  const withUnits = !!config?.advancedUnits;
  const withTerrain = !!config?.advancedTerrain;
  const approach = approachOf(map, from, to, withUnits ? origin : undefined);

  // Con la orografía apagada el mapa no cambia NADA, tampoco para las tropas:
  // todo cuenta como llanura, así que un blindado maniobra en cualquier sitio.
  const fromTerrain = withTerrain ? terrainOf(map, from) : DEFAULT_TERRAIN;
  const toTerrain = withTerrain ? terrainOf(map, to) : DEFAULT_TERRAIN;

  let attackBonus: number[] = [];
  let defenceBonus: number[] = [];

  if (withTerrain) {
    attackBonus = addBonus(attackBonus, terrainAssault(fromTerrain, approach));
    defenceBonus = addBonus(defenceBonus, terrainDefence(toTerrain, approach));
  }
  if (withUnits) {
    attackBonus = addBonus(attackBonus, unitAssault(origin, fromTerrain, toTerrain, approach));
    defenceBonus = addBonus(defenceBonus, unitDefence(target, toTerrain, approach));
  }

  // Lo que decide el combate es el SALDO, no cada mitad por su cuenta: sumar 1
  // al atacante y 1 al defensor en el mismo dado es exactamente igual que no
  // tocar nada. Se calcula el neto, se acota a un paso, y se reparte otra vez.
  // Como efecto secundario la caché de probabilidades se queda en muy pocas
  // combinaciones distintas.
  const net = capNet(subtract(attackBonus, defenceBonus));
  const finalAttack = net.map((value) => Math.max(0, value));
  const finalDefence = net.map((value) => Math.max(0, -value));

  // Los topes de la mesa mandan sobre todo lo demás. El desembarco y el ataque
  // aéreo recortan al atacante; el alcance aéreo existe aunque la orografía esté
  // apagada, porque es de la tropa y no del terreno.
  const wantsFewerDice = approach !== 'tierra' && (withTerrain || approach === 'aereo');
  const attack = Math.min(wantsFewerDice ? 2 : 3, caps.attack);

  return {
    attack,
    defend: Math.min(2, caps.defend),
    defenceBonus: trimTrailingZeros(finalDefence),
    attackBonus: trimTrailingZeros(finalAttack),
  };
}

function subtract(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push((a[i] ?? 0) - (b[i] ?? 0));
  return out;
}

function trimTrailingZeros(values: number[]): number[] {
  let last = values.length;
  while (last > 0 && values[last - 1] === 0) last--;
  return values.slice(0, last);
}
