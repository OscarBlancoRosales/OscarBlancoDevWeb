import type { GameMap, Terrain, Territory, TerritoryId } from '../types';
import {
  SPAIN_BOARD_HEIGHT,
  SPAIN_BOARD_WIDTH,
  SPAIN_LAND_ADJACENCY,
  SPAIN_SHAPES,
} from './spain.shapes';

/**
 * España por provincias: 52 territorios agrupados en comunidades autónomas
 * (que aquí hacen de "continentes" y dan bonificación).
 *
 * Las siluetas son cartografía real: `npm run build:maps` descarga los límites
 * provinciales, tira los islotes que en un tablero no se ven, simplifica sobre
 * la topología compartida (para que las fronteras encajen sin rendijas) y
 * calcula el punto de etiqueta de cada provincia. Aquí solo se les pone nombre,
 * comunidad y las conexiones por mar, que la geografía no puede deducir.
 *
 * Las fronteras terrestres NO se declaran a mano: salen del contacto real entre
 * siluetas. Un test las contrasta con las fronteras conocidas.
 */

/** Conexiones marítimas: lo único que el contacto entre siluetas no da. */
export const SPAIN_SEA_ROUTES: [TerritoryId, TerritoryId][] = [
  ['PM', 'VL'],
  ['PM', 'CS'],
  ['PM', 'TA'],
  ['PM', 'BR'],
  ['GC', 'TF'],
  ['GC', 'CD'],
  ['CE', 'CD'],
  ['CE', 'MG'],
  ['CE', 'ML'],
  ['ML', 'MG'],
  ['ML', 'AM'],
];

export const SPAIN_PROVINCE_NAMES: Record<string, string> = {
  AC: 'A Coruña',
  LU: 'Lugo',
  OU: 'Ourense',
  PO: 'Pontevedra',
  AS: 'Asturias',
  CB: 'Cantabria',
  BI: 'Bizkaia',
  SS: 'Gipuzkoa',
  VI: 'Álava',
  NA: 'Navarra',
  RI: 'La Rioja',
  ZG: 'Zaragoza',
  HU: 'Huesca',
  TE: 'Teruel',
  LL: 'Lleida',
  GI: 'Girona',
  BR: 'Barcelona',
  TA: 'Tarragona',
  CS: 'Castellón',
  VL: 'Valencia',
  AT: 'Alicante',
  MU: 'Murcia',
  GU: 'Guadalajara',
  CU: 'Cuenca',
  AB: 'Albacete',
  CR: 'Ciudad Real',
  TO: 'Toledo',
  MD: 'Madrid',
  LE: 'León',
  PL: 'Palencia',
  BU: 'Burgos',
  SO: 'Soria',
  SG: 'Segovia',
  VA: 'Valladolid',
  AV: 'Ávila',
  SL: 'Salamanca',
  ZA: 'Zamora',
  CC: 'Cáceres',
  BD: 'Badajoz',
  HV: 'Huelva',
  SV: 'Sevilla',
  CD: 'Cádiz',
  CO: 'Córdoba',
  JA: 'Jaén',
  GR: 'Granada',
  MG: 'Málaga',
  AM: 'Almería',
  PM: 'Illes Balears',
  GC: 'Las Palmas',
  TF: 'S. C. de Tenerife',
  CE: 'Ceuta',
  ML: 'Melilla',
};

export const SPAIN_COMMUNITIES = [
  { id: 'galicia', name: 'Galicia', bonus: 3, color: '#4d9de0', ids: ['AC', 'LU', 'OU', 'PO'] },
  { id: 'asturias', name: 'Asturias', bonus: 1, color: '#2ec4b6', ids: ['AS'] },
  { id: 'cantabria', name: 'Cantabria', bonus: 1, color: '#5bc0be', ids: ['CB'] },
  { id: 'pais-vasco', name: 'País Vasco', bonus: 2, color: '#e15554', ids: ['BI', 'SS', 'VI'] },
  { id: 'navarra', name: 'Navarra', bonus: 1, color: '#c1121f', ids: ['NA'] },
  { id: 'rioja', name: 'La Rioja', bonus: 1, color: '#9d0208', ids: ['RI'] },
  { id: 'aragon', name: 'Aragón', bonus: 2, color: '#f2a541', ids: ['ZG', 'HU', 'TE'] },
  { id: 'cataluna', name: 'Cataluña', bonus: 3, color: '#f4d35e', ids: ['LL', 'GI', 'BR', 'TA'] },
  {
    id: 'valenciana',
    name: 'C. Valenciana',
    bonus: 2,
    color: '#ee964b',
    ids: ['CS', 'VL', 'AT'],
  },
  { id: 'murcia', name: 'Murcia', bonus: 1, color: '#e8871e', ids: ['MU'] },
  {
    id: 'castilla-leon',
    name: 'Castilla y León',
    bonus: 6,
    color: '#a06cd5',
    ids: ['LE', 'PL', 'BU', 'SO', 'SG', 'VA', 'AV', 'SL', 'ZA'],
  },
  { id: 'madrid', name: 'Madrid', bonus: 1, color: '#ff70a6', ids: ['MD'] },
  {
    id: 'castilla-mancha',
    name: 'Castilla-La Mancha',
    bonus: 3,
    color: '#b56576',
    ids: ['GU', 'CU', 'AB', 'CR', 'TO'],
  },
  { id: 'extremadura', name: 'Extremadura', bonus: 2, color: '#6a994e', ids: ['CC', 'BD'] },
  {
    id: 'andalucia',
    name: 'Andalucía',
    bonus: 5,
    color: '#3ddc84',
    ids: ['HV', 'SV', 'CD', 'CO', 'JA', 'GR', 'MG', 'AM'],
  },
  { id: 'baleares', name: 'Illes Balears', bonus: 1, color: '#00b4d8', ids: ['PM'] },
  { id: 'canarias', name: 'Canarias', bonus: 2, color: '#0096c7', ids: ['GC', 'TF'] },
  { id: 'ceuta-melilla', name: 'Ceuta y Melilla', bonus: 2, color: '#f15bb5', ids: ['CE', 'ML'] },
];

/**
 * Orografía de cada provincia (solo cuenta en modo avanzado).
 *
 * Es una decisión de diseño, no un cálculo: una provincia real tiene de todo, y
 * aquí hay que elegir el rasgo que manda. Asturias es montaña aunque tenga
 * costa, y Almería es desierto aunque tenga playa. Lo que se busca es que el
 * tablero se lea de un vistazo y que cada zona se defienda distinto.
 */
export const SPAIN_TERRAIN: Record<string, Terrain> = {
  AC: 'costa',
  LU: 'montaña',
  OU: 'montaña',
  PO: 'costa',
  AS: 'montaña',
  CB: 'montaña',
  BI: 'costa',
  SS: 'montaña',
  VI: 'llanura',
  NA: 'montaña',
  RI: 'llanura',
  ZG: 'llanura',
  HU: 'montaña',
  TE: 'montaña',
  LL: 'montaña',
  GI: 'costa',
  BR: 'costa',
  TA: 'costa',
  CS: 'costa',
  VL: 'costa',
  AT: 'costa',
  MU: 'costa',
  GU: 'montaña',
  CU: 'montaña',
  AB: 'llanura',
  CR: 'llanura',
  TO: 'llanura',
  MD: 'llanura',
  LE: 'montaña',
  PL: 'llanura',
  BU: 'llanura',
  SO: 'bosque',
  SG: 'bosque',
  VA: 'llanura',
  AV: 'montaña',
  SL: 'llanura',
  ZA: 'llanura',
  CC: 'bosque',
  BD: 'llanura',
  HV: 'bosque',
  SV: 'llanura',
  CD: 'costa',
  CO: 'llanura',
  JA: 'montaña',
  GR: 'montaña',
  MG: 'costa',
  AM: 'desierto',
  PM: 'costa',
  GC: 'desierto',
  TF: 'montaña',
  CE: 'costa',
  ML: 'costa',
};

const CONTINENT_OF: Record<string, string> = {};
for (const meta of SPAIN_COMMUNITIES) {
  for (const id of meta.ids) CONTINENT_OF[id] = meta.id;
}

/** Fronteras terrestres (de la cartografía) más las conexiones por mar. */
const ADJACENCY: Record<string, string[]> = {};
for (const id of Object.keys(SPAIN_PROVINCE_NAMES)) {
  ADJACENCY[id] = [...(SPAIN_LAND_ADJACENCY[id] ?? [])];
}
for (const [a, b] of SPAIN_SEA_ROUTES) {
  if (!ADJACENCY[a].includes(b)) ADJACENCY[a].push(b);
  if (!ADJACENCY[b].includes(a)) ADJACENCY[b].push(a);
}
for (const id of Object.keys(ADJACENCY)) ADJACENCY[id].sort();

const territories: Territory[] = Object.keys(SPAIN_PROVINCE_NAMES).map((id) => ({
  id,
  name: SPAIN_PROVINCE_NAMES[id],
  continentId: CONTINENT_OF[id],
  adjacent: ADJACENCY[id],
  shape: SPAIN_SHAPES[id].path,
  labelAnchor: SPAIN_SHAPES[id].label,
  terrain: SPAIN_TERRAIN[id],
}));

export const SPAIN_MAP: GameMap = {
  id: 'spain',
  name: 'España por provincias',
  description:
    'Las 52 provincias españolas con sus fronteras reales, agrupadas por comunidad autónoma. Partidas largas y muy territoriales.',
  board: { width: SPAIN_BOARD_WIDTH, height: SPAIN_BOARD_HEIGHT },
  seaRoutes: SPAIN_SEA_ROUTES,
  maxPlayers: 6,
  territories,
  continents: SPAIN_COMMUNITIES.map((meta) => ({
    id: meta.id,
    name: meta.name,
    bonus: meta.bonus,
    color: meta.color,
    territoryIds: meta.ids,
  })),
};
