import { GameMap, Territory } from '../types';
import { deriveAdjacency, Hex } from '../geometry';
import { SPAIN_COMMUNITIES, SPAIN_PROVINCE_HEXES } from './spain.map';

/**
 * España por comunidades autónomas: 19 territorios.
 *
 * Es el mismo dibujo que el mapa provincial, pero fundiendo las provincias de
 * cada comunidad en un solo territorio. Sale gratis (las celdas ya están
 * trazadas) y cambia por completo el ritmo: en vez de una campaña larga de 52
 * frentes, una partida rápida de media hora.
 *
 * Las comunidades se agrupan en cinco macrozonas que hacen de "continentes".
 */

/**
 * Territorios del mapa: una comunidad autónoma cada uno.
 *
 * Ceuta y Melilla van por separado: comparten comunidad, pero están a 380 km la
 * una de la otra y un territorio de RISK tiene que ser una pieza continua.
 */
interface RegionMeta {
  id: string;
  name: string;
  /** Provincias del mapa provincial cuyas celdas se funden. */
  provinces: string[];
}

const REGIONS: RegionMeta[] = [
  ...SPAIN_COMMUNITIES.filter((community) => community.id !== 'ceuta-melilla').map((community) => ({
    id: community.id,
    name: community.name,
    provinces: community.ids,
  })),
  { id: 'ceuta', name: 'Ceuta', provinces: ['CE'] },
  { id: 'melilla', name: 'Melilla', provinces: ['ML'] },
];

/** Celdas de cada región: la unión de las de sus provincias. */
const HEXES: Record<string, Hex[]> = {};
for (const region of REGIONS) {
  HEXES[region.id] = region.provinces.flatMap((provinceId) => SPAIN_PROVINCE_HEXES[provinceId] ?? []);
}

/** Conexiones marítimas entre comunidades. */
const SEA_ROUTES: Array<[string, string]> = [
  ['baleares', 'valenciana'],
  ['baleares', 'cataluna'],
  ['canarias', 'andalucia'],
  ['ceuta', 'andalucia'],
  ['melilla', 'andalucia'],
  ['ceuta', 'melilla'],
];

interface ZoneMeta {
  id: string;
  name: string;
  bonus: number;
  color: string;
  ids: string[];
}

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

const NAMES: Record<string, string> = {};
for (const region of REGIONS) NAMES[region.id] = region.name;

const LAND_ADJACENCY = deriveAdjacency(HEXES);

const ADJACENCY: Record<string, string[]> = {};
for (const id of Object.keys(NAMES)) ADJACENCY[id] = [...(LAND_ADJACENCY[id] ?? [])];
for (const [a, b] of SEA_ROUTES) {
  if (!ADJACENCY[a].includes(b)) ADJACENCY[a].push(b);
  if (!ADJACENCY[b].includes(a)) ADJACENCY[b].push(a);
}
for (const id of Object.keys(ADJACENCY)) ADJACENCY[id].sort();

const territories: Territory[] = Object.keys(NAMES).map((id) => ({
  id,
  name: NAMES[id],
  continentId: ZONE_OF[id],
  adjacent: ADJACENCY[id],
  hexes: HEXES[id] ?? [],
}));

export const SPAIN_REGIONS_MAP: GameMap = {
  id: 'spain-regions',
  name: 'España por comunidades',
  description:
    'Las comunidades y ciudades autónomas agrupadas en cinco macrozonas. La partida corta: menos frentes y más mordiente.',
  hexRadius: 20,
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
