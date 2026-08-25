/**
 * Convierte la cartografía real de las comarcas catalanas en datos de tablero.
 *
 * Misma tubería que los otros mapas: GeoJSON → topología compartida → siluetas
 * simplificadas sin rendijas → fronteras por contacto → punto de etiqueta.
 *
 *   npm run build:maps
 *
 * Lo propio de este mapa:
 *  - Nueve comarcas llegan en dos trozos porque tienen enclaves de verdad: el
 *    más famoso es Llívia, que es de la Cerdanya y está rodeada de Francia.
 *    Todos son manchas de en torno al 1 % del área de su comarca, o sea puntos
 *    que en un tablero no se pueden ni pulsar, así que se tiran igual que se
 *    tiran los islotes en el mapa de España. Es una pena, pero un territorio de
 *    RISK tiene que ser algo que se pueda señalar con el dedo.
 *  - Aquí no hay islas ni recuadros: todas las comarcas se tocan por tierra, así
 *    que el mapa no necesita ninguna ruta marítima.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  MultiPolygon,
  Point2,
  dropTinyHoles,
  dropTinyPolygons,
  ringArea,
} from '../src/app/games/risk/engine/geo/geometry2d';
import {
  adjacencyByContact,
  buildTopology,
  mergeFeatures,
  simplifyTopology,
} from '../src/app/games/risk/engine/geo/topology';
import { labelPointOfMulti } from '../src/app/games/risk/engine/geo/polylabel';
import { contactThresholdFor } from '../src/app/games/risk/engine/geo/contact';
import {
  boundsOfAll,
  fitTransform,
  multiPolygonToPath,
  projectEquirectangular,
  transformMulti,
  mapMultiPolygon,
} from '../src/app/games/risk/engine/geo/project';

const ROOT = process.cwd();
const CACHE = join(ROOT, '.cache', 'catalonia-comarques.geojson');
const SOURCE_URL =
  'https://raw.githubusercontent.com/aariste/GeoJSON-Mapas/master/comarques-compressed.geojson';
const OUTPUT = join(ROOT, 'src/app/games/risk/engine/maps/catalonia.shapes.ts');

/** Ancho del tablero en unidades SVG. El alto sale de la proporción real. */
const BOARD_WIDTH = 1000;
/** Tolerancia de simplificación, en unidades de tablero (≈ píxeles). */
const SIMPLIFY_TOLERANCE = 0.9;
/** Paralelo de referencia: el centro de Cataluña. */
const REFERENCE_LATITUDE = 41.8;
const CONTACT_THRESHOLD = contactThresholdFor(BOARD_WIDTH);
/**
 * Un trozo suelto por debajo de esta fracción del principal es un enclave y se
 * tira. Con el 5 % caen los nueve enclaves catalanes (el mayor no llega al 3 %)
 * y no se lleva por delante ninguna comarca de verdad.
 */
const ENCLAVE_MIN_RATIO = 0.05;

/**
 * Identificador de cada comarca a partir del código del origen.
 *
 * Se usan siglas cortas porque el identificador aparece en el log de acciones de
 * todas las partidas: cuanto más corto, más barata sale la grabación.
 */
const COMARCA_IDS: Record<string, string> = {
  '01': 'ACA', // Alt Camp
  '02': 'AEM', // Alt Empordà
  '03': 'APE', // Alt Penedès
  '04': 'AUR', // Alt Urgell
  '05': 'ARI', // Alta Ribagorça
  '06': 'ANO', // Anoia
  '07': 'BAG', // Bages
  '08': 'BCA', // Baix Camp
  '09': 'BEB', // Baix Ebre
  '10': 'BEM', // Baix Empordà
  '11': 'BLL', // Baix Llobregat
  '12': 'BPE', // Baix Penedès
  '13': 'BCN', // Barcelonès
  '14': 'BER', // Berguedà
  '15': 'CER', // Cerdanya
  '16': 'CBA', // Conca de Barberà
  '17': 'GAR', // Garraf
  '18': 'GRR', // Garrigues
  '19': 'GRX', // Garrotxa
  '20': 'GIR', // Gironès
  '21': 'MAR', // Maresme
  '22': 'MON', // Montsià
  '23': 'NOG', // Noguera
  '24': 'OSO', // Osona
  '25': 'PJU', // Pallars Jussà
  '26': 'PSO', // Pallars Sobirà
  '27': 'PUR', // Pla d'Urgell
  '28': 'PES', // Pla de l'Estany
  '29': 'PRI', // Priorat
  '30': 'REB', // Ribera d'Ebre
  '31': 'RIP', // Ripollès
  '32': 'SEG', // Segarra
  '33': 'SGR', // Segrià
  '34': 'SEL', // Selva
  '35': 'SOL', // Solsonès
  '36': 'TAR', // Tarragonès
  '37': 'TAL', // Terra Alta
  '38': 'URG', // Urgell
  '39': 'ARA', // Val d'Aran
  '40': 'VOC', // Vallès Occidental
  '41': 'VOR', // Vallès Oriental
};

interface GeoFeature {
  properties: Record<string, string>;
  geometry: { type: string; coordinates: number[][][][] | number[][][] };
}

async function ensureSource(): Promise<string> {
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8');
  console.log('Descargando cartografía de origen…');
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`No se ha podido descargar el GeoJSON (${response.status})`);
  const text = await response.text();
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, text);
  return text;
}

/** Área total de una silueta, para comparar trozos entre sí. */
function areaOfMulti(multi: MultiPolygon): number {
  return multi.reduce((sum, polygon) => sum + Math.abs(ringArea(polygon[0] ?? [])), 0);
}

function toMultiPolygon(geometry: GeoFeature['geometry']): MultiPolygon {
  if (geometry.type === 'Polygon') return [geometry.coordinates as unknown as Point2[][]];
  return geometry.coordinates as unknown as MultiPolygon;
}

async function main(): Promise<void> {
  const geojson = JSON.parse(await ensureSource()) as { features: GeoFeature[] };

  // 1. Agrupar los trozos del origen por comarca y quedarse con lo que se ve.
  const grouped: Record<string, MultiPolygon[]> = {};
  const names: Record<string, string> = {};
  for (const feature of geojson.features) {
    const code = feature.properties['comarca'];
    const id = COMARCA_IDS[code];
    if (!id) throw new Error(`Comarca sin identificador asignado: ${code}`);
    names[id] = feature.properties['nom_comar'];

    const cleaned = dropTinyPolygons(toMultiPolygon(feature.geometry), {
      maxPieces: 8,
      minAreaRatio: 0.01,
    }).map((polygon) => dropTinyHoles(polygon, 0.02));
    if (cleaned.length > 0) (grouped[id] ??= []).push(cleaned);
  }

  // Los enclaves (Llívia y compañía) llegan como un trozo aparte diminuto. Se
  // descartan por la misma razón que los islotes: no se pueden pulsar.
  const pieces: Record<string, MultiPolygon> = {};
  const piecesOf: Record<string, string[]> = {};
  const dropped: string[] = [];
  let index = 0;
  for (const [id, group] of Object.entries(grouped)) {
    const areas = group.map(areaOfMulti);
    const largest = Math.max(...areas);
    group.forEach((multi, i) => {
      if (areas[i] < largest * ENCLAVE_MIN_RATIO) {
        dropped.push(`${names[id]} (${Math.round((areas[i] / largest) * 1000) / 10} %)`);
        return;
      }
      const pieceId = `${id}#${index++}`;
      pieces[pieceId] = multi;
      (piecesOf[id] ??= []).push(pieceId);
    });
  }

  const ids = Object.values(COMARCA_IDS).sort();
  const missing = ids.filter((id) => !piecesOf[id]);
  if (missing.length > 0) throw new Error(`Faltan comarcas en el origen: ${missing.join(', ')}`);

  // 2. Proyectar y encajar en el tablero.
  const project = projectEquirectangular(REFERENCE_LATITUDE);
  for (const key of Object.keys(pieces)) {
    pieces[key] = mapMultiPolygon(pieces[key], project);
  }
  const projectedBounds = boundsOfAll(pieces);
  const aspect =
    (projectedBounds.maxY - projectedBounds.minY) / (projectedBounds.maxX - projectedBounds.minX);
  const boardHeight = Math.round(BOARD_WIDTH * aspect);
  const fit = fitTransform(projectedBounds, {
    minX: 0,
    minY: 0,
    maxX: BOARD_WIDTH,
    maxY: boardHeight,
  });
  for (const key of Object.keys(pieces)) {
    pieces[key] = transformMulti(pieces[key], fit);
  }

  // 3. Topología compartida sobre los trozos: así las fronteras entre comarcas
  //    se simplifican una sola vez y siguen encajando.
  const topology = buildTopology(pieces, { quantization: 1e-4 });
  const verticesBefore = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
  const simplified = simplifyTopology(topology, SIMPLIFY_TOLERANCE);
  const verticesAfter = simplified.arcs.reduce((sum, arc) => sum + arc.length, 0);

  // 4. Fundir los trozos de cada comarca (el Barcelonès llega partido en dos).
  const shapes: Record<string, MultiPolygon> = {};
  for (const id of ids) {
    shapes[id] = mergeFeatures(simplified, piecesOf[id]);
    if (shapes[id].length === 0) throw new Error(`${id} (${names[id]}) se ha quedado sin forma`);
  }

  // 5. Fronteras por contacto, como en el resto de mapas: la cartografía real
  //    está llena de uniones en T y por aristas compartidas se perderían.
  const adjacency = adjacencyByContact(shapes, CONTACT_THRESHOLD);

  // 6. Punto de etiqueta: el sitio con más hueco dentro de la pieza mayor.
  const labels: Record<string, Point2> = {};
  for (const id of ids) {
    const [x, y] = labelPointOfMulti(shapes[id], 0.6);
    labels[id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  // 7. Emitir el archivo de datos.
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * Siluetas reales de las comarcas de Cataluña.');
  lines.push(' *');
  lines.push(' * GENERADO POR `npm run build:maps` — no editar a mano.');
  lines.push(` * Origen: ${SOURCE_URL}`);
  lines.push(` * Simplificado sobre topología compartida con tolerancia ${SIMPLIFY_TOLERANCE}.`);
  lines.push(' * Las comarcas que el origen trae partidas por provincia se funden sobre esa');
  lines.push(' * misma topología, así que las fronteras encajan exactamente.');
  lines.push(' */');
  lines.push('');
  lines.push("import { ProvinceShape } from './spain.shapes';");
  lines.push('');
  lines.push(`export const CATALONIA_BOARD_WIDTH = ${BOARD_WIDTH};`);
  lines.push(`export const CATALONIA_BOARD_HEIGHT = ${boardHeight};`);
  lines.push('');
  lines.push('/** Fronteras terrestres, calculadas de las propias siluetas. */');
  lines.push('export const CATALONIA_ADJACENCY: Record<string, string[]> = {');
  for (const id of ids) {
    const neighbours = (adjacency[id] ?? []).slice().sort();
    lines.push(`  ${id}: [${neighbours.map((n) => `'${n}'`).join(', ')}],`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export const CATALONIA_SHAPES: Record<string, ProvinceShape> = {');
  for (const id of ids) {
    lines.push(`  ${id}: {`);
    lines.push(`    path: '${multiPolygonToPath(shapes[id], 1)}',`);
    lines.push(`    label: [${labels[id][0]}, ${labels[id][1]}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  const output = lines.join('\n');
  writeFileSync(OUTPUT, output);

  // 8. Informe e invariantes.
  const totalPieces = Object.values(shapes).reduce((sum, multi) => sum + multi.length, 0);
  const lonely = ids.filter((id) => (adjacency[id] ?? []).length === 0);
  console.log(`Comarcas: ${ids.length} (de ${Object.keys(pieces).length} trozos dibujados)`);
  console.log(`Enclaves descartados: ${dropped.length === 0 ? 'ninguno' : dropped.join(', ')}`);
  console.log(`Vértices: ${verticesBefore} -> ${verticesAfter}`);
  console.log(`Piezas dibujadas: ${totalPieces}`);
  console.log(`Tablero: ${BOARD_WIDTH} x ${boardHeight}`);
  console.log(`Sin vecinos: ${lonely.length === 0 ? 'ninguna' : lonely.join(', ')}`);
  console.log(`Archivo: ${OUTPUT} (${Math.round(output.length / 1024)} kB)`);

  for (const id of ids) {
    const area = shapes[id].reduce((sum, polygon) => sum + ringArea(polygon[0] ?? []), 0);
    if (area <= 0) throw new Error(`${id} (${names[id]}) se ha quedado sin área`);
  }
  if (lonely.length > 0) {
    throw new Error(`Comarcas sin vecinos, el mapa no sería conexo: ${lonely.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
