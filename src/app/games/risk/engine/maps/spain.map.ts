import { GameMap, Territory } from '../types';
import { deriveAdjacency, Hex, parseHexArt } from '../geometry';

/**
 * España por provincias: 52 territorios agrupados en comunidades autónomas
 * (que aquí hacen de "continentes" y dan bonificación).
 *
 * A diferencia del mapa del mundo, aquí las fronteras terrestres se derivan del
 * propio dibujo: el retículo está trazado con la posición real de cada provincia,
 * así que lo que se toca en pantalla es exactamente lo que se puede atacar. No
 * hay fronteras invisibles ni fronteras dibujadas por las que no se pueda pasar.
 * Las conexiones marítimas (islas, Ceuta y Melilla) se declaran aparte.
 */
const ART = [
  '.  AC AC AS AS AS CB CB BI SS',
  'AC AC LU LU AS AS CB BI BI SS NA',
  'PO AC LU LU LE LE CB BU VI VI NA HU',
  'PO PO OU OU LE LE PL BU BU RI NA HU HU',
  '.  OU OU ZA LE VA PL BU BU SO ZG ZG HU LL',
  '.  .  ZA ZA ZA VA VA SG SO SO ZG ZG LL LL GI',
  '.  .  SL SL SL SL AV SG GU GU ZG TE TA BR GI',
  '.  .  SL SL CC AV AV MD GU GU TE TE TA TA',
  '.  .  CC CC CC TO MD MD CU CU TE CS CS',
  '.  BD CC CC TO TO TO CU CU CU VL CS .  PM PM',
  '.  BD BD BD BD CR CR CR AB VL VL .  .  PM',
  '.  HV BD CO CR CR JA AB AB AT AT',
  '.  HV SV SV CO CO JA GR MU MU',
  '.  CD CD MG MG GR GR GR AM',
  '.  .  CD MG .  GR .  .  AM',
  '',
  'TF TF GC GC .  .  CE .  ML',
];

/** Celdas de cada provincia. Se reutilizan para el mapa por comunidades. */
export const SPAIN_PROVINCE_HEXES: Record<string, Hex[]> = parseHexArt(ART);
const HEXES = SPAIN_PROVINCE_HEXES;

/** Conexiones marítimas que el dibujo no puede expresar. */
const SEA_ROUTES: Array<[string, string]> = [
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

const CONTINENT_OF: Record<string, string> = {};
for (const meta of SPAIN_COMMUNITIES) {
  for (const id of meta.ids) CONTINENT_OF[id] = meta.id;
}

const LAND_ADJACENCY = deriveAdjacency(HEXES);

const ADJACENCY: Record<string, string[]> = {};
for (const id of Object.keys(SPAIN_PROVINCE_NAMES)) {
  ADJACENCY[id] = [...(LAND_ADJACENCY[id] ?? [])];
}
for (const [a, b] of SEA_ROUTES) {
  if (!ADJACENCY[a].includes(b)) ADJACENCY[a].push(b);
  if (!ADJACENCY[b].includes(a)) ADJACENCY[b].push(a);
}
for (const id of Object.keys(ADJACENCY)) ADJACENCY[id].sort();

const territories: Territory[] = Object.keys(SPAIN_PROVINCE_NAMES).map((id) => ({
  id,
  name: SPAIN_PROVINCE_NAMES[id],
  continentId: CONTINENT_OF[id],
  adjacent: ADJACENCY[id],
  hexes: HEXES[id] ?? [],
}));

export const SPAIN_MAP: GameMap = {
  id: 'spain',
  name: 'España por provincias',
  description:
    'Las 52 provincias españolas agrupadas por comunidad autónoma. Partidas largas y muy territoriales.',
  hexRadius: 20,
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
