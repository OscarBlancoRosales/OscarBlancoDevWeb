import { GameMap, Territory, TerritoryId } from '../types';
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

const territories: Territory[] = Object.keys(WORLD_NAMES).map((id) => ({
  id,
  name: WORLD_NAMES[id],
  continentId: WORLD_CONTINENT_OF[id],
  adjacent: WORLD_ADJACENCY[id] ?? [],
  shape: WORLD_SHAPES[id].path,
  labelAnchor: WORLD_SHAPES[id].label,
}));

export const WORLD_MAP: GameMap = {
  id: 'world',
  name: 'Todo el mundo',
  description: 'El tablero clásico: 42 territorios y 6 continentes. La partida completa de siempre.',
  board: { width: WORLD_BOARD_WIDTH, height: WORLD_BOARD_HEIGHT },
  seaRoutes: WORLD_SEA_ROUTES as Array<[TerritoryId, TerritoryId]>,
  maxPlayers: 6,
  territories,
  continents: WORLD_CONTINENT_META.map((meta) => ({
    ...meta,
    territoryIds: territories.filter((t) => t.continentId === meta.id).map((t) => t.id),
  })),
};
