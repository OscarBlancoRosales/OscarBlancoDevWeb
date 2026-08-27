import type { GameMap, Terrain, Territory, TerritoryId } from '../types';
import { SPAIN_BOARD_HEIGHT, SPAIN_BOARD_WIDTH } from './spain.shapes';
import { SPAIN_REGION_ADJACENCY, SPAIN_REGION_SHAPES } from './spain-regions.shapes';

/**
 * España por comunidades autónomas: 19 territorios.
 *
 * Es la misma cartografía que el mapa provincial, fundiendo las provincias de
 * cada comunidad sobre la misma topología: las costas y las fronteras coinciden
 * exactamente con las del otro mapa, no son dos dibujos distintos.
 *
 * Ceuta y Melilla van sueltas: comparten comunidad pero están a 380 km la una de
 * la otra, y un territorio de RISK tiene que ser una pieza continua.
 *
 * Cambia por completo el ritmo respecto al provincial: en vez de una campaña
 * larga de 52 frentes, una partida corta.
 */

/** Conexiones marítimas entre comunidades. */
export const SPAIN_REGION_SEA_ROUTES: [TerritoryId, TerritoryId][] = [
  ['baleares', 'valenciana'],
  ['baleares', 'cataluna'],
  ['canarias', 'andalucia'],
  ['ceuta', 'andalucia'],
  ['melilla', 'andalucia'],
  ['ceuta', 'melilla'],
];

const NAMES: Record<string, string> = {
  galicia: 'Galicia',
  asturias: 'Asturias',
  cantabria: 'Cantabria',
  'pais-vasco': 'País Vasco',
  navarra: 'Navarra',
  rioja: 'La Rioja',
  aragon: 'Aragón',
  cataluna: 'Cataluña',
  valenciana: 'C. Valenciana',
  murcia: 'Murcia',
  'castilla-leon': 'Castilla y León',
  madrid: 'Madrid',
  'castilla-mancha': 'Castilla-La Mancha',
  extremadura: 'Extremadura',
  andalucia: 'Andalucía',
  baleares: 'Illes Balears',
  canarias: 'Canarias',
  ceuta: 'Ceuta',
  melilla: 'Melilla',
};

/** Orografía dominante de cada comunidad (solo cuenta en modo avanzado). */
const TERRAIN: Record<string, Terrain> = {
  galicia: 'costa',
  asturias: 'montaña',
  cantabria: 'montaña',
  'pais-vasco': 'montaña',
  navarra: 'montaña',
  rioja: 'llanura',
  aragon: 'montaña',
  cataluna: 'costa',
  valenciana: 'costa',
  murcia: 'costa',
  'castilla-leon': 'llanura',
  madrid: 'llanura',
  'castilla-mancha': 'llanura',
  extremadura: 'bosque',
  andalucia: 'montaña',
  baleares: 'costa',
  canarias: 'desierto',
  ceuta: 'costa',
  melilla: 'costa',
};

interface ZoneMeta {
  id: string;
  name: string;
  bonus: number;
  color: string;
  ids: string[];
}

/** Las comunidades se agrupan en macrozonas, que hacen de "continentes". */
const ZONES: ZoneMeta[] = [
  {
    id: 'cantabrica',
    name: 'Cornisa cantábrica',
    bonus: 4,
    color: '#4d9de0',
    ids: ['galicia', 'asturias', 'cantabria', 'pais-vasco'],
  },
  {
    id: 'ebro',
    name: 'Valle del Ebro',
    bonus: 4,
    color: '#f2a541',
    ids: ['navarra', 'rioja', 'aragon', 'cataluna'],
  },
  {
    id: 'levante',
    name: 'Levante',
    bonus: 3,
    color: '#ee964b',
    ids: ['valenciana', 'murcia', 'baleares'],
  },
  {
    id: 'meseta',
    name: 'La meseta',
    bonus: 5,
    color: '#a06cd5',
    ids: ['castilla-leon', 'madrid', 'castilla-mancha', 'extremadura'],
  },
  {
    id: 'sur',
    name: 'Sur y ultramar',
    bonus: 4,
    color: '#3ddc84',
    ids: ['andalucia', 'canarias', 'ceuta', 'melilla'],
  },
];

const ZONE_OF: Record<string, string> = {};
for (const zone of ZONES) {
  for (const id of zone.ids) ZONE_OF[id] = zone.id;
}

const ADJACENCY: Record<string, string[]> = {};
for (const id of Object.keys(NAMES)) ADJACENCY[id] = [...(SPAIN_REGION_ADJACENCY[id] ?? [])];
for (const [a, b] of SPAIN_REGION_SEA_ROUTES) {
  if (!ADJACENCY[a].includes(b)) ADJACENCY[a].push(b);
  if (!ADJACENCY[b].includes(a)) ADJACENCY[b].push(a);
}
for (const id of Object.keys(ADJACENCY)) ADJACENCY[id].sort();

const territories: Territory[] = Object.keys(NAMES).map((id) => ({
  id,
  name: NAMES[id],
  continentId: ZONE_OF[id],
  adjacent: ADJACENCY[id],
  shape: SPAIN_REGION_SHAPES[id].path,
  labelAnchor: SPAIN_REGION_SHAPES[id].label,
  terrain: TERRAIN[id],
}));

export const SPAIN_REGIONS_MAP: GameMap = {
  id: 'spain-regions',
  name: 'España por comunidades',
  description:
    'Las comunidades y ciudades autónomas con sus contornos reales, agrupadas en cinco macrozonas. La partida corta: menos frentes y más mordiente.',
  board: { width: SPAIN_BOARD_WIDTH, height: SPAIN_BOARD_HEIGHT },
  seaRoutes: SPAIN_REGION_SEA_ROUTES,
  maxPlayers: 5,
  territories,
  continents: ZONES.map((zone) => ({
    id: zone.id,
    name: zone.name,
    bonus: zone.bonus,
    color: zone.color,
    territoryIds: zone.ids,
  })),
};
