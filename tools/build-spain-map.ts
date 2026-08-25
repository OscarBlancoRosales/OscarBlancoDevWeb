/**
 * Convierte la cartografía real de las provincias españolas en datos de tablero.
 *
 * No se ejecuta en el navegador: es una herramienta de desarrollo. Lee un
 * GeoJSON, lo adelgaza hasta lo que se ve en una pantalla, calcula las
 * fronteras y los puntos de etiqueta, y escribe un `.ts` con todo resuelto.
 * En tiempo de ejecución el juego solo carga datos ya masticados.
 *
 *   npm run build:maps
 *
 * Las tres decisiones que se toman aquí:
 *  - Se tiran los islotes: A Coruña trae más de mil anillos y en un tablero no
 *    se ve ninguno.
 *  - Se simplifica sobre la topología compartida, no provincia a provincia, para
 *    que las fronteras comunes encajen exactamente y no queden rendijas.
 *  - Canarias se lleva a un recuadro, como en cualquier mapa de España: si se
 *    dibuja donde está, la península se queda en un tercio de la pantalla.
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
  mergeAdjacency,
  mergeFeatures,
  rebuildAll,
  simplifyTopology,
} from '../src/app/games/risk/engine/geo/topology';
import { labelPointOfMulti } from '../src/app/games/risk/engine/geo/polylabel';
import {
  boundsOfAll,
  fitTransform,
  multiPolygonToPath,
  projectEquirectangular,
  transformMulti,
  mapMultiPolygon,
} from '../src/app/games/risk/engine/geo/project';

// La herramienta se empaqueta a un temporal antes de ejecutarse, así que las
// rutas van contra el directorio del proyecto (de donde lanza npm), no contra
// la ubicación del archivo.
const ROOT = process.cwd();
const CACHE = join(ROOT, '.cache', 'spain-provinces.geojson');
const SOURCE_URL =
  'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson';
const OUTPUT = join(ROOT, 'src/app/games/risk/engine/maps/spain.shapes.ts');
const OUTPUT_REGIONS = join(ROOT, 'src/app/games/risk/engine/maps/spain-regions.shapes.ts');

/** Ancho del tablero en unidades SVG. El alto sale de la proporción real. */
const BOARD_WIDTH = 1000;
/** Tolerancia de simplificación, en unidades de tablero (≈ píxeles). */
const SIMPLIFY_TOLERANCE = 1.1;
/** Paralelo de referencia: el centro de España. */
const REFERENCE_LATITUDE = 40;
/**
 * Hasta qué distancia (en unidades de tablero, ~1 km cada una) se considera que
 * dos provincias se tocan. Las fronteras reales están a 0 y las provincias que
 * solo se acercan, a más de 20: el umbral no es delicado.
 */
const CONTACT_THRESHOLD = 0.75;

/** Código INE de provincia -> identificador de territorio del juego. */
const PROVINCE_IDS: Record<string, string> = {
  '01': 'VI', '02': 'AB', '03': 'AT', '04': 'AM', '05': 'AV', '06': 'BD',
  '07': 'PM', '08': 'BR', '09': 'BU', '10': 'CC', '11': 'CD', '12': 'CS',
  '13': 'CR', '14': 'CO', '15': 'AC', '16': 'CU', '17': 'GI', '18': 'GR',
  '19': 'GU', '20': 'SS', '21': 'HV', '22': 'HU', '23': 'JA', '24': 'LE',
  '25': 'LL', '26': 'RI', '27': 'LU', '28': 'MD', '29': 'MG', '30': 'MU',
  '31': 'NA', '32': 'OU', '33': 'AS', '34': 'PL', '35': 'GC', '36': 'PO',
  '37': 'SL', '38': 'TF', '39': 'CB', '40': 'SG', '41': 'SV', '42': 'SO',
  '43': 'TA', '44': 'TE', '45': 'TO', '46': 'VL', '47': 'VA', '48': 'BI',
  '49': 'ZA', '50': 'ZG', '51': 'CE', '52': 'ML',
};

/**
 * Territorios del mapa por comunidades: cada uno funde las provincias de una
 * comunidad autónoma. Ceuta y Melilla van sueltas porque comparten comunidad
 * pero están a 380 km la una de la otra, y un territorio tiene que ser una
 * pieza continua.
 */
const REGIONS: Array<{ id: string; provinces: string[] }> = [
  { id: 'galicia', provinces: ['AC', 'LU', 'OU', 'PO'] },
  { id: 'asturias', provinces: ['AS'] },
  { id: 'cantabria', provinces: ['CB'] },
  { id: 'pais-vasco', provinces: ['BI', 'SS', 'VI'] },
  { id: 'navarra', provinces: ['NA'] },
  { id: 'rioja', provinces: ['RI'] },
  { id: 'aragon', provinces: ['ZG', 'HU', 'TE'] },
  { id: 'cataluna', provinces: ['LL', 'GI', 'BR', 'TA'] },
  { id: 'valenciana', provinces: ['CS', 'VL', 'AT'] },
  { id: 'murcia', provinces: ['MU'] },
  { id: 'castilla-leon', provinces: ['LE', 'PL', 'BU', 'SO', 'SG', 'VA', 'AV', 'SL', 'ZA'] },
  { id: 'madrid', provinces: ['MD'] },
  { id: 'castilla-mancha', provinces: ['GU', 'CU', 'AB', 'CR', 'TO'] },
  { id: 'extremadura', provinces: ['CC', 'BD'] },
  { id: 'andalucia', provinces: ['HV', 'SV', 'CD', 'CO', 'JA', 'GR', 'MG', 'AM'] },
  { id: 'baleares', provinces: ['PM'] },
  { id: 'canarias', provinces: ['GC', 'TF'] },
  { id: 'ceuta', provinces: ['CE'] },
  { id: 'melilla', provinces: ['ML'] },
];

/** Canarias, al recuadro. Coordenadas de destino en grados. */
const CANARY_IDS = ['GC', 'TF'];
const CANARY_INSET = { minLon: -11.2, maxLon: -7.6, minLat: 34.6, maxLat: 36.2 };

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

/** Normaliza Polygon y MultiPolygon a un único tipo. */
function toMultiPolygon(geometry: GeoFeature['geometry']): MultiPolygon {
  if (geometry.type === 'Polygon') return [geometry.coordinates as unknown as Point2[][]];
  return geometry.coordinates as unknown as MultiPolygon;
}

/** Lleva un grupo de territorios a una ventana de coordenadas concreta. */
function moveToWindow(
  features: Record<string, MultiPolygon>,
  ids: readonly string[],
  window: { minLon: number; maxLon: number; minLat: number; maxLat: number },
): void {
  const group = ids.map((id) => features[id]).filter(Boolean);
  if (group.length === 0) return;

  const points = group.flat(3) as Point2[];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const scale = Math.min(
    (window.maxLon - window.minLon) / (maxX - minX),
    (window.maxLat - window.minLat) / (maxY - minY),
  );
  const dx = window.minLon - minX * scale;
  const dy = window.minLat - minY * scale;

  for (const id of ids) {
    if (!features[id]) continue;
    features[id] = mapMultiPolygon(features[id], ([x, y]) => [x * scale + dx, y * scale + dy]);
  }
}

async function main(): Promise<void> {
  const geojson = JSON.parse(await ensureSource()) as { features: GeoFeature[] };

  // 1. De GeoJSON a territorios, quitando islotes y agujeros irrelevantes.
  const features: Record<string, MultiPolygon> = {};
  const names: Record<string, string> = {};
  for (const feature of geojson.features) {
    const code = feature.properties['cod_prov'];
    const id = PROVINCE_IDS[code];
    if (!id) throw new Error(`Provincia sin identificador asignado: ${code}`);
    names[id] = feature.properties['name'];
    const cleaned = dropTinyPolygons(toMultiPolygon(feature.geometry), {
      maxPieces: 14,
      minAreaRatio: 0.006,
    }).map((polygon) => dropTinyHoles(polygon, 0.02));
    features[id] = cleaned;
  }

  const missing = Object.values(PROVINCE_IDS).filter((id) => !features[id]);
  if (missing.length > 0) throw new Error(`Faltan provincias en el origen: ${missing.join(', ')}`);

  // 2. Canarias al recuadro (todavía en grados).
  moveToWindow(features, CANARY_IDS, CANARY_INSET);

  // 3. Proyectar y encajar en el tablero.
  const project = projectEquirectangular(REFERENCE_LATITUDE);
  for (const id of Object.keys(features)) {
    features[id] = mapMultiPolygon(features[id], project);
  }
  const projectedBounds = boundsOfAll(features);
  const aspect =
    (projectedBounds.maxY - projectedBounds.minY) / (projectedBounds.maxX - projectedBounds.minX);
  const boardHeight = Math.round(BOARD_WIDTH * aspect);
  const fit = fitTransform(projectedBounds, {
    minX: 0,
    minY: 0,
    maxX: BOARD_WIDTH,
    maxY: boardHeight,
  });
  for (const id of Object.keys(features)) {
    features[id] = transformMulti(features[id], fit);
  }

  // 4. Topología compartida: fronteras exactas y simplificación sin rendijas.
  const topology = buildTopology(features, { quantization: 1e-4 });
  const verticesBefore = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
  const simplified = simplifyTopology(topology, SIMPLIFY_TOLERANCE);
  const verticesAfter = simplified.arcs.reduce((sum, arc) => sum + arc.length, 0);
  const shapes = rebuildAll(simplified);

  // Las fronteras salen del contacto real entre siluetas, no solo de los arcos
  // compartidos: la cartografía de origen tiene uniones en T que por aristas
  // no se detectarían (Ávila con Valladolid, Badajoz con Toledo...).
  const adjacency = mergeAdjacency(
    simplified.adjacency,
    adjacencyByContact(shapes, CONTACT_THRESHOLD),
  );

  // 5. Punto de etiqueta: el sitio con más hueco dentro de la pieza mayor.
  const labels: Record<string, Point2> = {};
  for (const id of Object.keys(shapes)) {
    const [x, y] = labelPointOfMulti(shapes[id], 0.6);
    labels[id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  // 6. Emitir el archivo de datos.
  const ids = Object.keys(PROVINCE_IDS).map((code) => PROVINCE_IDS[code]).sort();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * Siluetas reales de las provincias españolas.');
  lines.push(' *');
  lines.push(' * GENERADO POR `npm run build:maps` — no editar a mano.');
  lines.push(` * Origen: ${SOURCE_URL}`);
  lines.push(` * Simplificado sobre topología compartida con tolerancia ${SIMPLIFY_TOLERANCE}.`);
  lines.push(' */');
  lines.push('');
  lines.push('export interface ProvinceShape {');
  lines.push('  /** Contorno en coordenadas de tablero, listo para un <path>. */');
  lines.push('  path: string;');
  lines.push('  /** Punto interior donde va la etiqueta. */');
  lines.push('  label: [number, number];');
  lines.push('}');
  lines.push('');
  lines.push(`export const SPAIN_BOARD_WIDTH = ${BOARD_WIDTH};`);
  lines.push(`export const SPAIN_BOARD_HEIGHT = ${boardHeight};`);
  lines.push('');
  lines.push('/** Fronteras terrestres, calculadas de las propias siluetas. */');
  lines.push('export const SPAIN_LAND_ADJACENCY: Record<string, string[]> = {');
  for (const id of ids) {
    const neighbours = (adjacency[id] ?? []).slice().sort();
    lines.push(`  ${id}: [${neighbours.map((n) => `'${n}'`).join(', ')}],`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export const SPAIN_SHAPES: Record<string, ProvinceShape> = {');
  for (const id of ids) {
    const path = multiPolygonToPath(shapes[id], 1);
    lines.push(`  ${id}: {`);
    lines.push(`    path: '${path}',`);
    lines.push(`    label: [${labels[id][0]}, ${labels[id][1]}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  const output = lines.join('\n');
  writeFileSync(OUTPUT, output);

  // ---- Mapa por comunidades: se funden las provincias de cada una ----
  const regionShapes: Record<string, MultiPolygon> = {};
  for (const region of REGIONS) {
    regionShapes[region.id] = mergeFeatures(simplified, region.provinces);
    if (regionShapes[region.id].length === 0) {
      throw new Error(`La región ${region.id} se ha quedado sin forma al fundir`);
    }
  }
  const regionAdjacency = adjacencyByContact(regionShapes, CONTACT_THRESHOLD);

  const regionLines: string[] = [];
  regionLines.push('/**');
  regionLines.push(' * Siluetas de las comunidades autónomas.');
  regionLines.push(' *');
  regionLines.push(' * GENERADO POR `npm run build:maps` — no editar a mano.');
  regionLines.push(' * Se obtienen fundiendo las provincias de cada comunidad sobre la misma');
  regionLines.push(' * topología, así que costas y fronteras coinciden exactamente con las del');
  regionLines.push(' * mapa provincial.');
  regionLines.push(' */');
  regionLines.push('');
  regionLines.push("import { ProvinceShape } from './spain.shapes';");
  regionLines.push('');
  regionLines.push('/** Fronteras terrestres entre comunidades. */');
  regionLines.push('export const SPAIN_REGION_ADJACENCY: Record<string, string[]> = {');
  for (const region of REGIONS) {
    const neighbours = (regionAdjacency[region.id] ?? []).slice().sort();
    regionLines.push(`  '${region.id}': [${neighbours.map((n) => `'${n}'`).join(', ')}],`);
  }
  regionLines.push('};');
  regionLines.push('');
  regionLines.push('export const SPAIN_REGION_SHAPES: Record<string, ProvinceShape> = {');
  for (const region of REGIONS) {
    const [labelX, labelY] = labelPointOfMulti(regionShapes[region.id], 0.6);
    regionLines.push(`  '${region.id}': {`);
    regionLines.push(`    path: '${multiPolygonToPath(regionShapes[region.id], 1)}',`);
    regionLines.push(`    label: [${Math.round(labelX * 10) / 10}, ${Math.round(labelY * 10) / 10}],`);
    regionLines.push('  },');
  }
  regionLines.push('};');
  regionLines.push('');

  const regionOutput = regionLines.join('\n');
  writeFileSync(OUTPUT_REGIONS, regionOutput);

  // 7. Informe para quien lo ejecute.
  const totalPieces = Object.values(shapes).reduce((sum, multi) => sum + multi.length, 0);
  const withoutNeighbours = ids.filter((id) => (adjacency[id] ?? []).length === 0);
  console.log(`Provincias: ${ids.length}`);
  console.log(`Vértices: ${verticesBefore} -> ${verticesAfter}`);
  console.log(`Piezas dibujadas: ${totalPieces}`);
  console.log(`Tablero: ${BOARD_WIDTH} x ${boardHeight}`);
  console.log(`Sin vecinos terrestres (necesitan ruta marítima): ${withoutNeighbours.join(', ')}`);
  console.log(`Archivo: ${OUTPUT} (${Math.round(output.length / 1024)} kB)`);
  console.log(
    `Comunidades: ${REGIONS.length} | piezas ${Object.values(regionShapes).reduce(
      (sum, multi) => sum + multi.length,
      0,
    )} | ${Math.round(regionOutput.length / 1024)} kB`,
  );
  const lonelyRegions = REGIONS.filter((r) => (regionAdjacency[r.id] ?? []).length === 0);
  console.log(`Comunidades sin vecinos terrestres: ${lonelyRegions.map((r) => r.id).join(', ')}`);

  // Comprobación de cordura: nadie puede quedarse sin silueta.
  for (const id of ids) {
    const area = shapes[id].reduce((sum, polygon) => sum + ringArea(polygon[0] ?? []), 0);
    if (area <= 0) throw new Error(`La provincia ${id} (${names[id]}) se ha quedado sin forma`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
