import { GameMap, Terrain, Territory } from '../types';
import {
  CATALONIA_ADJACENCY,
  CATALONIA_BOARD_HEIGHT,
  CATALONIA_BOARD_WIDTH,
  CATALONIA_SHAPES,
} from './catalonia.shapes';

/**
 * Comarcas de Cataluña: 41 territorios agrupados en los siete ámbitos
 * funcionales territoriales, que aquí hacen de "continentes".
 *
 * Es la respuesta al problema de ritmo de las comarcas. Las ~370 comarcas de
 * toda España darían un tablero imposible de terminar; una comunidad sola da 41
 * territorios, justo el tamaño del tablero clásico del mundo, con la diferencia
 * de que aquí todo son fronteras de tierra y no hay un solo salto por mar: la
 * partida es un empujón continuo de frentes, sin puentes que cortar.
 *
 * La cartografía es real y sale de `npm run build:maps`, por la misma tubería
 * que el resto de mapas. Las fronteras NO se declaran a mano: salen del contacto
 * entre siluetas.
 */

export const CATALONIA_COMARCA_NAMES: Record<string, string> = {
  ACA: 'Alt Camp',
  AEM: 'Alt Empordà',
  APE: 'Alt Penedès',
  AUR: 'Alt Urgell',
  ARI: 'Alta Ribagorça',
  ANO: 'Anoia',
  BAG: 'Bages',
  BCA: 'Baix Camp',
  BEB: 'Baix Ebre',
  BEM: 'Baix Empordà',
  BLL: 'Baix Llobregat',
  BPE: 'Baix Penedès',
  BCN: 'Barcelonès',
  BER: 'Berguedà',
  CER: 'Cerdanya',
  CBA: 'Conca de Barberà',
  GAR: 'Garraf',
  GRR: 'Garrigues',
  GRX: 'Garrotxa',
  GIR: 'Gironès',
  MAR: 'Maresme',
  MON: 'Montsià',
  NOG: 'Noguera',
  OSO: 'Osona',
  PJU: 'Pallars Jussà',
  PSO: 'Pallars Sobirà',
  PUR: "Pla d'Urgell",
  PES: "Pla de l'Estany",
  PRI: 'Priorat',
  REB: "Ribera d'Ebre",
  RIP: 'Ripollès',
  SEG: 'Segarra',
  SGR: 'Segrià',
  SEL: 'Selva',
  SOL: 'Solsonès',
  TAR: 'Tarragonès',
  TAL: 'Terra Alta',
  URG: 'Urgell',
  ARA: "Val d'Aran",
  VOC: 'Vallès Occidental',
  VOR: 'Vallès Oriental',
};

/**
 * Los siete ámbitos funcionales territoriales (división de 2010).
 *
 * Se usa esta y no la de 2017 porque la de 2017 saca el Penedès de tres ámbitos
 * distintos, y un "continente" de RISK tiene que ser una pieza contigua.
 */
export const CATALONIA_AMBITS = [
  {
    id: 'metropolita',
    name: 'Àmbit Metropolità',
    bonus: 5,
    color: '#e15554',
    ids: ['APE', 'BLL', 'BCN', 'GAR', 'MAR', 'VOC', 'VOR'],
  },
  {
    id: 'gironines',
    name: 'Comarques Gironines',
    bonus: 5,
    color: '#4d9de0',
    ids: ['AEM', 'BEM', 'GRX', 'GIR', 'PES', 'RIP', 'SEL'],
  },
  {
    id: 'camp',
    name: 'Camp de Tarragona',
    bonus: 4,
    color: '#f2a541',
    ids: ['ACA', 'BCA', 'BPE', 'CBA', 'PRI', 'TAR'],
  },
  {
    id: 'ebre',
    name: "Terres de l'Ebre",
    bonus: 2,
    color: '#3ddc84',
    ids: ['BEB', 'MON', 'REB', 'TAL'],
  },
  {
    id: 'ponent',
    name: 'Ponent',
    bonus: 4,
    color: '#f4d35e',
    ids: ['GRR', 'NOG', 'PUR', 'SEG', 'SGR', 'URG'],
  },
  {
    id: 'centrals',
    name: 'Comarques Centrals',
    bonus: 3,
    color: '#a06cd5',
    ids: ['ANO', 'BAG', 'BER', 'OSO', 'SOL'],
  },
  {
    id: 'pirineu',
    name: 'Alt Pirineu i Aran',
    bonus: 4,
    color: '#00b4d8',
    ids: ['AUR', 'ARI', 'CER', 'PJU', 'PSO', 'ARA'],
  },
];

/** Orografía de cada comarca (solo cuenta en modo avanzado). */
const TERRAIN: Record<string, Terrain> = {
  ACA: 'llanura',
  AEM: 'costa',
  APE: 'llanura',
  AUR: 'montaña',
  ARI: 'montaña',
  ANO: 'bosque',
  BAG: 'llanura',
  BCA: 'costa',
  BEB: 'costa',
  BEM: 'costa',
  BLL: 'llanura',
  BPE: 'costa',
  BCN: 'costa',
  BER: 'montaña',
  CER: 'montaña',
  CBA: 'bosque',
  GAR: 'costa',
  GRR: 'desierto',
  GRX: 'bosque',
  GIR: 'llanura',
  MAR: 'costa',
  MON: 'costa',
  NOG: 'llanura',
  OSO: 'bosque',
  PJU: 'montaña',
  PSO: 'montaña',
  PUR: 'llanura',
  PES: 'llanura',
  PRI: 'montaña',
  REB: 'desierto',
  RIP: 'montaña',
  SEG: 'llanura',
  SGR: 'desierto',
  SEL: 'bosque',
  SOL: 'montaña',
  TAR: 'costa',
  TAL: 'desierto',
  URG: 'llanura',
  ARA: 'montaña',
  VOC: 'llanura',
  VOR: 'bosque',
};

const AMBIT_OF: Record<string, string> = {};
for (const ambit of CATALONIA_AMBITS) {
  for (const id of ambit.ids) AMBIT_OF[id] = ambit.id;
}

const territories: Territory[] = Object.keys(CATALONIA_COMARCA_NAMES).map((id) => ({
  id,
  name: CATALONIA_COMARCA_NAMES[id],
  continentId: AMBIT_OF[id],
  adjacent: [...(CATALONIA_ADJACENCY[id] ?? [])].sort(),
  shape: CATALONIA_SHAPES[id].path,
  labelAnchor: CATALONIA_SHAPES[id].label,
  terrain: TERRAIN[id],
}));

export const CATALONIA_MAP: GameMap = {
  id: 'catalonia',
  name: 'Cataluña por comarcas',
  description:
    'Las 41 comarcas con sus límites reales, agrupadas en los siete ámbitos. Todo son fronteras de tierra: ni un solo salto por mar, así que no hay dónde esconderse.',
  board: { width: CATALONIA_BOARD_WIDTH, height: CATALONIA_BOARD_HEIGHT },
  maxPlayers: 6,
  territories,
  continents: CATALONIA_AMBITS.map((ambit) => ({
    id: ambit.id,
    name: ambit.name,
    bonus: ambit.bonus,
    color: ambit.color,
    territoryIds: ambit.ids,
  })),
};
