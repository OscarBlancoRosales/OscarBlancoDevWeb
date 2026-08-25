/**
 * Datos del tablero clásico del mundo: nombres, continentes y adyacencias.
 *
 * Está separado del mapa porque lo consumen dos sitios: el juego y la
 * herramienta que genera las siluetas (`npm run build:maps`), que necesita
 * saber qué territorios deberían tocarse para decidir cuáles son rutas
 * marítimas.
 *
 * Las adyacencias son las canónicas del tablero original y NO se derivan de la
 * geografía: el RISK une Alaska con Kamchatka y Brasil con África del Norte, y
 * separa cosas que en el mapa real se tocan. Aquí manda el juego, no el atlas.
 */

export const WORLD_ADJACENCY_RAW: Record<string, string[]> = {
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
}

export const WORLD_NAMES: Record<string, string> = {
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
}

export const WORLD_CONTINENT_OF: Record<string, string> = {
  AK: 'na', NT: 'na', GL: 'na', AB: 'na', ON: 'na', QC: 'na', WU: 'na', EU: 'na', CM: 'na',
  VE: 'sa', BZ: 'sa', PU: 'sa', AG: 'sa',
  IC: 'eu', GB: 'eu', SN: 'eu', NE: 'eu', WE: 'eu', SE: 'eu', UK: 'eu',
  NF: 'af', EG: 'af', EA: 'af', CG: 'af', SF: 'af', MG: 'af',
  UR: 'as', SB: 'as', YK: 'as', KC: 'as', IR: 'as', MN: 'as', JP: 'as',
  AF: 'as', CH: 'as', ME: 'as', IN: 'as', SM: 'as',
  ID: 'oc', NG: 'oc', WA: 'oc', EE: 'oc',
}

export const WORLD_CONTINENT_META = [
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

/** Adyacencia canónica, ya simétrica. */
export const WORLD_ADJACENCY = symmetrize(WORLD_ADJACENCY_RAW);
