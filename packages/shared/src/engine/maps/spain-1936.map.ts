import type { FactionDef, GameMap, Scenario, SideDef, Territory, TerritoryId } from '../types';
import {
  SPAIN_BOARD_HEIGHT,
  SPAIN_BOARD_WIDTH,
  SPAIN_LAND_ADJACENCY,
  SPAIN_SHAPES,
} from './spain.shapes';
import { SPAIN_PROVINCE_NAMES, SPAIN_SEA_ROUTES, SPAIN_TERRAIN } from './spain.map';

/**
 * España, julio de 1936: el mismo tablero provincial, pero empezando donde
 * empezó de verdad.
 *
 * Es el primer escenario histórico, y la diferencia con los otros mapas no está
 * en el dibujo —la cartografía es exactamente la misma— sino en tres cosas:
 *
 *  - **No se reparte al azar.** El tablero arranca con el reparto real de
 *    provincias de los días siguientes al golpe.
 *  - **Se juega por bandos.** Dos facciones por lado, que no pueden atacarse
 *    entre sí y ganan juntas. Con dos jugadores es uno contra uno; con cuatro,
 *    dos contra dos.
 *  - **Cada facción es alguien concreto**, con su forma de pelear y su discurso.
 *
 * ### Sobre la simplificación
 *
 * Un territorio de RISK tiene un solo dueño, y la realidad de julio del 36 no
 * era tan limpia: en Oviedo y en Granada las capitales quedaron en manos de los
 * sublevados dentro de provincias que no lo estaban, el Alcázar de Toledo
 * aguantó dos meses en zona republicana, Menorca siguió fiel a la República
 * mientras Mallorca no, y media provincia de Huesca la recuperaron las columnas
 * que salieron de Barcelona. Aquí cada provincia se asigna a quien controlaba la
 * mayor parte de ella, y las excepciones se cuentan en la crónica cuando la
 * partida pasa por ahí, que es donde tienen sentido.
 *
 * El reparto sigue el consenso habitual: el golpe triunfó en unas treinta
 * provincias y fracasó en veinte, con la República conservando la mitad
 * oriental, la cornisa cantábrica, Madrid, La Mancha, Badajoz y Andalucía
 * oriental.
 */

// ===== BANDOS Y FACCIONES =====

export const SPAIN_1936_SIDES: SideDef[] = [
  { id: 'republica', name: 'República', color: '#c1121f' },
  { id: 'sublevados', name: 'Sublevados', color: '#f2a541' },
];

export const SPAIN_1936_FACTIONS: FactionDef[] = [
  {
    id: 'ejercito-popular',
    name: 'Ejército Popular',
    side: 'republica',
    color: '#e15554',
    blurb:
      'El Estado republicano rehaciendo un ejército sobre la marcha: guardias de asalto, carabineros y quintas, con la industria y la mayoría de la población detrás.',
  },
  {
    id: 'cnt-fai',
    name: 'Columnas confederadas',
    side: 'republica',
    color: '#000000',
    blurb:
      'Las milicias de la CNT-FAI que salieron de Barcelona hacia Aragón. Ofensivas y voluntariosas, mal armadas y peor mandadas: buenas para tomar, malas para sostener.',
  },
  {
    id: 'ejercito-africa',
    name: 'Ejército de África',
    side: 'sublevados',
    color: '#f4a259',
    blurb:
      'Regulares y Legión, la tropa profesional del Protectorado. La fuerza más eficaz de 1936, siempre que consiga cruzar el Estrecho.',
  },
  {
    id: 'ejercito-norte',
    name: 'Ejército del Norte',
    side: 'sublevados',
    color: '#c98b3a',
    blurb:
      'Mola, los requetés navarros y las guarniciones de Castilla y León. Un bloque compacto que pelea en su terreno y aguanta lo que le echen.',
  },
];

// ===== EL REPARTO DE JULIO DE 1936 =====

/** Provincias donde el golpe triunfó. El resto se quedaron con la República. */
const SUBLEVADAS: TerritoryId[] = [
  // Galicia
  'AC', 'LU', 'OU', 'PO',
  // Castilla y León
  'LE', 'PL', 'BU', 'SO', 'SG', 'VA', 'AV', 'SL', 'ZA',
  // Navarra, Álava y La Rioja
  'NA', 'VI', 'RI',
  // Aragón
  'ZG', 'HU', 'TE',
  // Extremadura alta
  'CC',
  // Andalucía occidental (y Granada, cuya capital cayó el 20 de julio)
  'SV', 'CD', 'HV', 'CO', 'GR',
  // Islas y plazas de África
  'PM', 'GC', 'TF', 'CE', 'ML',
];

/**
 * Con qué facción empieza cada provincia sublevada.
 *
 * El Ejército de África arranca en el Protectorado, Canarias y la cabeza de
 * puente andaluza: su problema es exactamente el que tuvo, cruzar el Estrecho.
 * El resto es de Mola.
 */
const AFRICA: TerritoryId[] = ['CE', 'ML', 'GC', 'TF', 'CD', 'SV', 'HV'];

/**
 * Con qué facción empieza cada provincia republicana.
 *
 * Las columnas confederadas salen de Cataluña y del Levante, que es de donde
 * salieron; el Ejército Popular se queda con Madrid, el centro, el norte y
 * Andalucía oriental.
 */
const CONFEDERALES: TerritoryId[] = ['BR', 'GI', 'LL', 'TA', 'CS', 'VL', 'AT'];

/** Ejércitos iniciales: más donde hubo más fuerza, y las plazas fuertes marcadas. */
const GARRISONS: Record<TerritoryId, number> = {
  MD: 5, // Madrid, el objetivo de toda la guerra
  BR: 5, // Barcelona, donde el golpe se rompió en la calle
  SV: 4, // Sevilla, la cabeza de puente de Queipo
  ZG: 4, // Zaragoza
  BU: 4, // Burgos, cuartel general de la Junta
  NA: 4, // Navarra, la cantera de requetés
  CE: 3,
  ML: 3,
  VL: 3,
  BI: 3, // Bilbao y su cinturón industrial
  AS: 3,
  VA: 3,
  CD: 3,
};

const DEFAULT_GARRISON = 2;

function factionOf(id: TerritoryId): string {
  if (SUBLEVADAS.includes(id)) {
    return AFRICA.includes(id) ? 'ejercito-africa' : 'ejercito-norte';
  }
  return CONFEDERALES.includes(id) ? 'cnt-fai' : 'ejercito-popular';
}

const deployment: Scenario['deployment'] = {};
for (const id of Object.keys(SPAIN_PROVINCE_NAMES)) {
  deployment[id] = { faction: factionOf(id), armies: GARRISONS[id] ?? DEFAULT_GARRISON };
}

export const SPAIN_1936_SCENARIO: Scenario = {
  sides: SPAIN_1936_SIDES,
  factions: SPAIN_1936_FACTIONS,
  deployment,
  intro:
    'Julio de 1936. El golpe ha triunfado en unas treinta provincias y ha fracasado en el resto. ' +
    'Nadie ha ganado y nadie ha perdido: España se ha partido en dos y empieza una guerra que ' +
    'ninguno de los dos bandos esperaba tener que pelear.',
};

// ===== FRENTES (hacen de continentes) =====

/**
 * Los "continentes" del escenario son los frentes de la guerra, no las
 * comunidades autónomas: es la división que tiene sentido en 1936 y la que hace
 * que cerrar una zona valga la pena.
 */
export const SPAIN_1936_FRONTS = [
  {
    id: 'frente-norte',
    name: 'Frente del Norte',
    bonus: 4,
    color: '#4d9de0',
    ids: ['AS', 'CB', 'BI', 'SS', 'VI', 'NA', 'RI', 'BU', 'PL', 'LE'],
  },
  {
    id: 'frente-galicia',
    name: 'Galicia y el Occidente',
    bonus: 3,
    color: '#2ec4b6',
    ids: ['AC', 'LU', 'OU', 'PO', 'ZA', 'SL', 'VA'],
  },
  {
    id: 'frente-aragon',
    name: 'Frente de Aragón',
    bonus: 4,
    color: '#f2a541',
    ids: ['ZG', 'HU', 'TE', 'LL', 'GI', 'BR', 'TA'],
  },
  {
    id: 'frente-levante',
    name: 'Levante',
    bonus: 3,
    color: '#ee964b',
    ids: ['CS', 'VL', 'AT', 'MU', 'PM'],
  },
  {
    id: 'frente-centro',
    name: 'Frente del Centro',
    bonus: 5,
    color: '#a06cd5',
    ids: ['MD', 'TO', 'GU', 'CU', 'SG', 'AV', 'SO'],
  },
  {
    id: 'frente-extremadura',
    name: 'Extremadura y La Mancha',
    bonus: 3,
    color: '#6a994e',
    ids: ['CC', 'BD', 'CR', 'AB'],
  },
  {
    id: 'frente-sur',
    name: 'Frente del Sur',
    bonus: 4,
    color: '#3ddc84',
    ids: ['SV', 'CD', 'HV', 'CO', 'JA', 'GR', 'MG', 'AM'],
  },
  {
    id: 'protectorado',
    name: 'Protectorado',
    bonus: 1,
    color: '#f15bb5',
    ids: ['CE', 'ML'],
  },
  {
    id: 'canarias',
    name: 'Canarias',
    bonus: 1,
    color: '#0096c7',
    ids: ['GC', 'TF'],
  },
];

const FRONT_OF: Record<string, string> = {};
for (const front of SPAIN_1936_FRONTS) {
  for (const id of front.ids) FRONT_OF[id] = front.id;
}

/** Fronteras terrestres de la cartografía, más las conexiones por mar. */
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
  continentId: FRONT_OF[id],
  adjacent: ADJACENCY[id],
  shape: SPAIN_SHAPES[id].path,
  labelAnchor: SPAIN_SHAPES[id].label,
  terrain: SPAIN_TERRAIN[id],
}));

export const SPAIN_1936_MAP: GameMap = {
  id: 'spain-1936',
  name: 'España 1936',
  description:
    'Escenario histórico: el tablero arranca con el reparto real de provincias de julio del 36. Dos bandos, dos facciones cada uno, y una crónica de guerra que va contando la campaña.',
  board: { width: SPAIN_BOARD_WIDTH, height: SPAIN_BOARD_HEIGHT },
  seaRoutes: SPAIN_SEA_ROUTES,
  maxPlayers: 4,
  territories,
  continents: SPAIN_1936_FRONTS.map((front) => ({
    id: front.id,
    name: front.name,
    bonus: front.bonus,
    color: front.color,
    territoryIds: front.ids,
  })),
  scenario: SPAIN_1936_SCENARIO,
};
