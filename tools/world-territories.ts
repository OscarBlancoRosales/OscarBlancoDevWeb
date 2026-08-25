/**
 * Qué trozos del mundo real forma cada territorio del RISK.
 *
 * Los territorios del tablero clásico no son países: "EE. UU. Occidental" son
 * diecisiete estados, "Siam" son cinco países y "Ucrania" se come media Rusia.
 * Esta tabla es el puente entre el atlas y el juego.
 *
 * - `countries`: códigos ISO A3 de Natural Earth (admin-0).
 * - `subdivisions`: nombres de subdivisión (admin-1), para los cuatro países que
 *   el tablero parte en varios territorios.
 *
 * Los países que aparecen en `SPLIT_COUNTRIES` se excluyen de admin-0: sus
 * trozos entran solo por `subdivisions`, o se solaparían consigo mismos.
 */

export interface TerritorySources {
  countries?: string[];
  subdivisions?: string[];
}

/** Países que el tablero reparte entre varios territorios. */
export const SPLIT_COUNTRIES = ['USA', 'CAN', 'AUS', 'RUS'];

export const WORLD_SOURCES: Record<string, TerritorySources> = {
  // ===== AMÉRICA DEL NORTE =====
  AK: { subdivisions: ['Alaska'] },
  NT: { subdivisions: ['Northwest Territories', 'Nunavut', 'Yukon'] },
  GL: { countries: ['GRL'] },
  AB: { subdivisions: ['Alberta', 'British Columbia', 'Saskatchewan'] },
  ON: { subdivisions: ['Ontario', 'Manitoba'] },
  QC: {
    subdivisions: [
      'Québec',
      'Newfoundland and Labrador',
      'New Brunswick',
      'Nova Scotia',
      'Prince Edward Island',
    ],
  },
  WU: {
    subdivisions: [
      'Washington', 'Oregon', 'California', 'Idaho', 'Nevada', 'Utah', 'Arizona',
      'Montana', 'Wyoming', 'Colorado', 'New Mexico', 'North Dakota', 'South Dakota',
      'Nebraska', 'Kansas', 'Oklahoma', 'Texas',
    ],
  },
  EU: {
    subdivisions: [
      'Minnesota', 'Iowa', 'Missouri', 'Arkansas', 'Louisiana', 'Wisconsin', 'Illinois',
      'Mississippi', 'Alabama', 'Tennessee', 'Kentucky', 'Indiana', 'Michigan', 'Ohio',
      'West Virginia', 'Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida',
      'Pennsylvania', 'New York', 'New Jersey', 'Delaware', 'Maryland',
      'District of Columbia', 'Connecticut', 'Rhode Island', 'Massachusetts', 'Vermont',
      'New Hampshire', 'Maine',
    ],
  },
  CM: { countries: ['MEX', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN'] },

  // ===== AMÉRICA DEL SUR =====
  VE: { countries: ['VEN', 'COL', 'ECU', 'GUY', 'SUR'] },
  BZ: { countries: ['BRA'] },
  PU: { countries: ['PER', 'BOL'] },
  AG: { countries: ['ARG', 'CHL', 'URY', 'PRY'] },

  // ===== EUROPA =====
  IC: { countries: ['ISL'] },
  GB: { countries: ['GBR', 'IRL'] },
  SN: { countries: ['NOR', 'SWE', 'FIN', 'DNK'] },
  NE: { countries: ['DEU', 'POL', 'CZE', 'SVK', 'AUT', 'HUN', 'CHE', 'NLD', 'BEL', 'LUX', 'LIE'] },
  WE: { countries: ['FRA', 'ESP', 'PRT', 'AND', 'MCO'] },
  SE: {
    countries: [
      'ITA', 'SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'ALB', 'MKD', 'KOS', 'GRC', 'BGR', 'ROU',
      'MLT', 'SMR', 'VAT',
    ],
  },
  UK: {
    countries: ['UKR', 'BLR', 'MDA', 'EST', 'LVA', 'LTU'],
    // Rusia europea: todo lo que no está asignado a Urales, Siberia, Yakutsk,
    // Irkutsk o Kamchatka (ver RUSSIA_ASIA).
    subdivisions: [],
  },

  // ===== ÁFRICA =====
  NF: {
    countries: [
      'MAR', 'ESH', 'DZA', 'TUN', 'LBY', 'MRT', 'MLI', 'NER', 'SEN', 'GMB', 'GNB', 'GIN',
      'SLE', 'LBR', 'CIV', 'BFA', 'GHA', 'TGO', 'BEN', 'NGA', 'TCD', 'CMR',
    ],
  },
  EG: { countries: ['EGY'] },
  EA: { countries: ['SDN', 'SDS', 'SSD', 'ETH', 'ERI', 'DJI', 'SOM', 'KEN', 'UGA', 'TZA', 'RWA', 'BDI'] },
  CG: { countries: ['COD', 'COG', 'CAF', 'GAB', 'GNQ', 'AGO', 'ZMB', 'STP'] },
  SF: { countries: ['ZAF', 'NAM', 'BWA', 'ZWE', 'MOZ', 'MWI', 'LSO', 'SWZ'] },
  MG: { countries: ['MDG'] },

  // ===== ASIA =====
  UR: {
    subdivisions: [
      'Sverdlovsk', 'Chelyabinsk', 'Kurgan', "Tyumen'", 'Khanty-Mansiy', 'Yamal-Nenets',
      "Perm'", 'Bashkortostan', 'Orenburg', 'Komi', 'Nenets', 'Udmurt', 'Kirov',
    ],
  },
  SB: {
    subdivisions: [
      'Krasnoyarsk', 'Tomsk', 'Novosibirsk', 'Omsk', 'Kemerovo', 'Altay', 'Gorno-Altay',
      'Khakass', 'Tuva',
    ],
  },
  YK: { subdivisions: ['Sakha (Yakutia)'] },
  IR: { subdivisions: ['Irkutsk', 'Buryat', 'Chita', 'Amur'] },
  KC: {
    subdivisions: [
      'Kamchatka', 'Chukchi Autonomous Okrug', 'Maga Buryatdan', 'Khabarovsk',
      "Primor'ye", 'Sakhalin', 'Yevrey',
    ],
  },
  MN: { countries: ['MNG'] },
  JP: { countries: ['JPN', 'KOR', 'PRK'] },
  AF: { countries: ['AFG', 'TKM', 'UZB', 'TJK', 'KGZ', 'KAZ'] },
  CH: { countries: ['CHN', 'TWN'] },
  ME: {
    countries: [
      'TUR', 'SYR', 'LBN', 'ISR', 'PSE', 'JOR', 'IRQ', 'SAU', 'YEM', 'OMN', 'ARE', 'QAT',
      'BHR', 'KWT', 'IRN', 'GEO', 'ARM', 'AZE', 'CYP',
    ],
  },
  IN: { countries: ['IND', 'PAK', 'NPL', 'BTN', 'BGD', 'LKA'] },
  SM: { countries: ['THA', 'MMR', 'LAO', 'KHM', 'VNM', 'MYS', 'SGP'] },

  // ===== OCEANÍA =====
  ID: { countries: ['IDN', 'BRN', 'TLS', 'PHL'] },
  NG: { countries: ['PNG', 'SLB', 'VUT', 'FJI', 'NCL'] },
  WA: { subdivisions: ['Western Australia', 'Northern Territory', 'South Australia'] },
  EE: {
    countries: ['NZL'],
    subdivisions: [
      'Queensland', 'New South Wales', 'Victoria', 'Tasmania',
      'Australian Capital Territory', 'Jervis Bay Territory',
    ],
  },
};

/** Subdivisiones rusas que el tablero asigna a Asia. El resto van a Ucrania. */
export const RUSSIA_ASIA = new Set(
  [
    ...(WORLD_SOURCES['UR'].subdivisions ?? []),
    ...(WORLD_SOURCES['SB'].subdivisions ?? []),
    ...(WORLD_SOURCES['YK'].subdivisions ?? []),
    ...(WORLD_SOURCES['IR'].subdivisions ?? []),
    ...(WORLD_SOURCES['KC'].subdivisions ?? []),
  ],
);

/**
 * Trozos que se dejan fuera a propósito.
 *
 * Kaliningrad es un exclave metido entre Polonia y Lituania: dibujarlo dejaría
 * una mancha suelta lejísimos del resto de su territorio. Hawái no existe en el
 * tablero clásico.
 *
 * Crimea sí se dibuja: en este tablero, Ucrania y la Rusia europea son el mismo
 * territorio, así que incluirla es solo cerrar la costa del mar Negro. Dejarla
 * fuera abría un boquete en el mapa.
 */
export const EXCLUDED_SUBDIVISIONS = new Set(['Kaliningrad', 'Hawaii']);
