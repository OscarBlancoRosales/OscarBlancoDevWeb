import { GameMap, Terrain, Territory, TerritoryId } from '../types';
import {
  WORLD_ADJACENCY,
  WORLD_CONTINENT_META,
  WORLD_CONTINENT_OF,
  WORLD_NAMES,
} from './world.adjacency';
import {
  WORLD_BOARD_HEIGHT,
  WORLD_BOARD_WIDTH,
  WORLD_SEA_ROUTES,
  WORLD_SHAPES,
} from './world.shapes';

/**
 * Mapa clásico del mundo: 42 territorios, 6 continentes.
 *
 * Las siluetas son cartografía real (Natural Earth), pero los territorios no son
 * países: "EE. UU. Occidental" son diecisiete estados y "Siam" son cinco países.
 * `npm run build:maps` agrupa los trozos reales según `tools/world-territories.ts`
 * y los funde sobre la topología compartida.
 *
 * Las adyacencias son las canónicas del tablero original y NO se derivan de la
 * geografía: el RISK une Alaska con Kamchatka y separa cosas que en el atlas se
 * tocan. Aquí manda el juego. Lo que sí se calcula es cuáles de esas conexiones
 * hay que dibujar como línea de puntos, que son las que sobre el mapa no llegan
 * a tocarse.
 */

/**
 * Orografía de cada territorio (solo cuenta en modo avanzado).
 *
 * Un territorio del RISK abarca países enteros, así que aquí manda el rasgo que
 * define la zona en el tablero: los Andes en Perú, la taiga en Siberia, el
 * Sáhara en África del Norte, el Gobi en Mongolia.
 */
const TERRAIN: Record<string, Terrain> = {
  AK: 'montaña',
  NT: 'llanura',
  GL: 'desierto',
  AB: 'llanura',
  ON: 'bosque',
  QC: 'bosque',
  WU: 'montaña',
  EU: 'llanura',
  CM: 'bosque',
  VE: 'llanura',
  BZ: 'bosque',
  PU: 'montaña',
  AG: 'llanura',
  IC: 'montaña',
  GB: 'costa',
  SN: 'montaña',
  NE: 'llanura',
  WE: 'costa',
  SE: 'montaña',
  UK: 'llanura',
  NF: 'desierto',
  EG: 'desierto',
  EA: 'montaña',
  CG: 'bosque',
  SF: 'llanura',
  MG: 'costa',
  UR: 'montaña',
  SB: 'bosque',
  YK: 'bosque',
  IR: 'bosque',
  KC: 'montaña',
  MN: 'desierto',
  JP: 'costa',
  AF: 'montaña',
  CH: 'llanura',
  ME: 'desierto',
  IN: 'llanura',
  SM: 'bosque',
  ID: 'costa',
  NG: 'bosque',
  WA: 'desierto',
  EE: 'costa',
};

/**
 * Conexiones que se dibujan sueltas pero se cruzan a pie.
 *
 * El tablero clásico une estos tres pares por tierra, pero los países que
 * forman cada territorio no llegan a tocarse: entre China y los Urales está
 * Kazajistán (que aquí es Afganistán), entre Kamchatka y Mongolia está Siberia,
 * y México toca Texas, que cae en EE. UU. Occidental y no en el Oriental.
 * Se pintan de puntos como el resto, pero atacar por ellas no es un desembarco.
 */
export const WORLD_LAND_BRIDGES: Array<[TerritoryId, TerritoryId]> = [
  ['CH', 'UR'],
  ['KC', 'MN'],
  ['CM', 'EU'],
];

const territories: Territory[] = Object.keys(WORLD_NAMES).map((id) => ({
  id,
  name: WORLD_NAMES[id],
  continentId: WORLD_CONTINENT_OF[id],
  adjacent: WORLD_ADJACENCY[id] ?? [],
  shape: WORLD_SHAPES[id].path,
  labelAnchor: WORLD_SHAPES[id].label,
  terrain: TERRAIN[id],
}));

export const WORLD_MAP: GameMap = {
  id: 'world',
  name: 'Todo el mundo',
  description: 'El tablero clásico: 42 territorios y 6 continentes. La partida completa de siempre.',
  board: { width: WORLD_BOARD_WIDTH, height: WORLD_BOARD_HEIGHT },
  seaRoutes: WORLD_SEA_ROUTES as Array<[TerritoryId, TerritoryId]>,
  landBridges: WORLD_LAND_BRIDGES,
  maxPlayers: 6,
  territories,
  continents: WORLD_CONTINENT_META.map((meta) => ({
    ...meta,
    territoryIds: territories.filter((t) => t.continentId === meta.id).map((t) => t.id),
  })),
};
