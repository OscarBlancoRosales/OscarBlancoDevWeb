import { GameMap, Territory } from '../types';
import { Hex, parseHexArt } from '../geometry';

/**
 * Mapa clásico del mundo: 42 territorios, 6 continentes.
 *
 * El dibujo se define como "arte hexagonal": cada fila del array es una fila
 * del retículo y cada token una celda. Las adyacencias, en cambio, son las
 * canónicas del RISK original y se declaran aparte, porque la corrección de las
 * reglas no debe depender del dibujo. Un test verifica que ambas cosas encajan
 * (sin fronteras falsas) y que la simetría se cumple.
 */
const ART = [
  'AK AK NT NT NT GL GL GL .  .  .  .  .  .  .  .  SB SB YK YK KC KC',
  '.  AK NT NT NT GL GL GL IC IC .  .  .  .  .  UR SB SB YK YK KC KC',
  '.  AB AB ON ON ON QC QC .  IC .  .  .  .  .  UR SB SB IR IR KC KC',
  '.  WU WU WU EU EU EU .  GB SN SN SN UK UK UK UR SB SB IR IR KC KC',
  '.  .  .  CM CM CM .  .  GB GB NE NE NE UK UK UK UR .  MN MN MN JP',
  '.  .  .  .  VE VE VE .  WE WE WE SE SE SE ME AF AF CH CH .  JP JP',
  '.  .  .  .  PU PU BZ BZ .  NF NF NF EG EG ME ME IN CH CH',
  '.  .  .  .  PU PU BZ BZ .  CG NF NF EA EA .  .  IN SM SM',
  '.  .  .  .  .  AG AG BZ .  CG CG CG EA EA MG',
  '.  .  .  .  .  AG AG .  .  .  SF SF SF .  MG .  .  ID ID',
  '.  .  .  .  .  .  .  .  .  .  .  SF SF .  .  .  .  ID ID .  NG NG',
  '.  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  WA WA EE EE',
  '.  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  WA WA EE EE',
];

const HEXES: Record<string, Hex[]> = parseHexArt(ART);

/** Adyacencias canónicas del tablero original (se expanden simétricamente). */
const ADJACENCY: Record<string, string[]> = {
  // América del Norte
  AK: ['NT', 'AB', 'KC'],
  NT: ['AK', 'AB', 'ON', 'GL'],
  GL: ['NT', 'ON', 'QC', 'IC'],
  AB: ['AK', 'NT', 'ON', 'WU'],
  ON: ['NT', 'AB', 'GL', 'QC', 'WU', 'EU'],
  QC: ['GL', 'ON', 'EU'],
  WU: ['AB', 'ON', 'EU', 'CM'],
  EU: ['ON', 'QC', 'WU', 'CM'],
  CM: ['WU', 'EU', 'VE'],
  // América del Sur
  VE: ['CM', 'BZ', 'PU'],
  BZ: ['VE', 'PU', 'AG', 'NF'],
  PU: ['VE', 'BZ', 'AG'],
  AG: ['PU', 'BZ'],
  // Europa
  IC: ['GL', 'GB', 'SN'],
  GB: ['IC', 'SN', 'NE', 'WE'],
  SN: ['IC', 'GB', 'NE', 'UK'],
  NE: ['GB', 'SN', 'UK', 'SE', 'WE'],
  WE: ['GB', 'NE', 'SE', 'NF'],
  SE: ['WE', 'NE', 'UK', 'ME', 'EG', 'NF'],
  UK: ['SN', 'NE', 'SE', 'UR', 'AF', 'ME'],
  // África
  NF: ['BZ', 'WE', 'SE', 'EG', 'EA', 'CG'],
  EG: ['NF', 'SE', 'ME', 'EA'],
  EA: ['EG', 'NF', 'CG', 'SF', 'MG', 'ME'],
  CG: ['NF', 'EA', 'SF'],
  SF: ['CG', 'EA', 'MG'],
  MG: ['SF', 'EA'],
  // Asia
  UR: ['UK', 'SB', 'CH', 'AF'],
  SB: ['UR', 'YK', 'IR', 'MN', 'CH'],
  YK: ['SB', 'IR', 'KC'],
  KC: ['YK', 'IR', 'MN', 'JP', 'AK'],
  IR: ['SB', 'YK', 'KC', 'MN'],
  MN: ['SB', 'IR', 'KC', 'JP', 'CH'],
  JP: ['KC', 'MN'],
  AF: ['UK', 'UR', 'CH', 'IN', 'ME'],
  CH: ['UR', 'SB', 'MN', 'AF', 'IN', 'SM'],
  ME: ['UK', 'SE', 'EG', 'EA', 'AF', 'IN'],
  IN: ['ME', 'AF', 'CH', 'SM'],
  SM: ['IN', 'CH', 'ID'],
  // Oceanía
  ID: ['SM', 'NG', 'WA'],
  NG: ['ID', 'WA', 'EE'],
  WA: ['ID', 'NG', 'EE'],
  EE: ['NG', 'WA'],
};

const NAMES: Record<string, string> = {
  AK: 'Alaska',
  NT: 'Territorio del Noroeste',
  GL: 'Groenlandia',
  AB: 'Alberta',
  ON: 'Ontario',
  QC: 'Quebec',
  WU: 'EE. UU. Occidental',
  EU: 'EE. UU. Oriental',
  CM: 'América Central',
  VE: 'Venezuela',
  BZ: 'Brasil',
  PU: 'Perú',
  AG: 'Argentina',
  IC: 'Islandia',
  GB: 'Gran Bretaña',
  SN: 'Escandinavia',
  NE: 'Europa del Norte',
  WE: 'Europa Occidental',
  SE: 'Europa del Sur',
  UK: 'Ucrania',
  NF: 'África del Norte',
  EG: 'Egipto',
  EA: 'África Oriental',
  CG: 'Congo',
  SF: 'Sudáfrica',
  MG: 'Madagascar',
  UR: 'Urales',
  SB: 'Siberia',
  YK: 'Yakutsk',
  KC: 'Kamchatka',
  IR: 'Irkutsk',
  MN: 'Mongolia',
  JP: 'Japón',
  AF: 'Afganistán',
  CH: 'China',
  ME: 'Oriente Medio',
  IN: 'India',
  SM: 'Siam',
  ID: 'Indonesia',
  NG: 'Nueva Guinea',
  WA: 'Australia Occidental',
  EE: 'Australia Oriental',
};

const CONTINENT_OF: Record<string, string> = {
  AK: 'na', NT: 'na', GL: 'na', AB: 'na', ON: 'na', QC: 'na', WU: 'na', EU: 'na', CM: 'na',
  VE: 'sa', BZ: 'sa', PU: 'sa', AG: 'sa',
  IC: 'eu', GB: 'eu', SN: 'eu', NE: 'eu', WE: 'eu', SE: 'eu', UK: 'eu',
  NF: 'af', EG: 'af', EA: 'af', CG: 'af', SF: 'af', MG: 'af',
  UR: 'as', SB: 'as', YK: 'as', KC: 'as', IR: 'as', MN: 'as', JP: 'as',
  AF: 'as', CH: 'as', ME: 'as', IN: 'as', SM: 'as',
  ID: 'oc', NG: 'oc', WA: 'oc', EE: 'oc',
};

const CONTINENT_META = [
  { id: 'na', name: 'América del Norte', bonus: 5, color: '#f2a541' },
  { id: 'sa', name: 'América del Sur', bonus: 2, color: '#3ddc84' },
  { id: 'eu', name: 'Europa', bonus: 5, color: '#4d9de0' },
  { id: 'af', name: 'África', bonus: 3, color: '#e15554' },
  { id: 'as', name: 'Asia', bonus: 7, color: '#a06cd5' },
  { id: 'oc', name: 'Oceanía', bonus: 2, color: '#f15bb5' },
];

/** Cierra la adyacencia para que siempre sea simétrica. */
function symmetrize(input: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const id of Object.keys(input)) out[id] = new Set(input[id]);
  for (const [id, neighbours] of Object.entries(input)) {
    for (const other of neighbours) {
      if (!out[other]) out[other] = new Set();
      out[other].add(id);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(out)) result[id] = Array.from(set).sort();
  return result;
}

const SYMMETRIC = symmetrize(ADJACENCY);

const territories: Territory[] = Object.keys(NAMES).map((id) => ({
  id,
  name: NAMES[id],
  continentId: CONTINENT_OF[id],
  adjacent: SYMMETRIC[id] ?? [],
  hexes: HEXES[id] ?? [],
}));

export const WORLD_MAP: GameMap = {
  id: 'world',
  name: 'Todo el mundo',
  description: 'El tablero clásico: 42 territorios y 6 continentes. La partida completa de siempre.',
  hexRadius: 22,
  maxPlayers: 6,
  territories,
  continents: CONTINENT_META.map((meta) => ({
    ...meta,
    territoryIds: territories.filter((t) => t.continentId === meta.id).map((t) => t.id),
  })),
};
