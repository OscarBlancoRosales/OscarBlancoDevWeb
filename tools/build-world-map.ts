/**
 * Convierte la cartografía mundial en las siluetas de los 42 territorios del RISK.
 *
 * A diferencia de España, aquí los territorios no son unidades administrativas:
 * "EE. UU. Occidental" son diecisiete estados y "Siam" son cinco países. El
 * proceso agrupa los trozos reales (ver `world-territories.ts`), los funde sobre
 * la topología compartida y dibuja el resultado.
 *
 * Las fronteras del juego NO salen de la geografía: son las canónicas del
 * tablero original (`world.adjacency.ts`). Lo que sí se calcula aquí es cuáles
 * de esas adyacencias hay que dibujar como ruta marítima, que son justamente las
 * que sobre el mapa no se tocan.
 *
 *   npm run build:maps
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MultiPolygon, Point2, dropTinyHoles, dropTinyPolygons } from '../packages/shared/src/engine/geo/geometry2d';
import {
  adjacencyByContact,
  buildTopology,
  mergeFeatures,
  rebuildAll,
  simplifyTopology,
} from '../packages/shared/src/engine/geo/topology';
import { labelPointOfMulti } from '../packages/shared/src/engine/geo/polylabel';
import { contactThresholdFor } from '../packages/shared/src/engine/geo/contact';
import {
  boundsOfAll,
  fitTransform,
  mapMultiPolygon,
  multiPolygonToPath,
  projectEquirectangular,
  transformMulti,
} from '../packages/shared/src/engine/geo/project';
import { WORLD_ADJACENCY, WORLD_NAMES } from '../packages/shared/src/engine/maps/world.adjacency';
import {
  EXCLUDED_SUBDIVISIONS,
  RUSSIA_ASIA,
  SPLIT_COUNTRIES,
  WORLD_SOURCES,
} from './world-territories';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'packages/shared/src/engine/maps/world.shapes.ts');
const SOURCES = {
  countries: {
    file: join(ROOT, '.cache', 'ne_50m_admin_0_countries.geojson'),
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
  },
  subdivisions: {
    file: join(ROOT, '.cache', 'ne_50m_admin_1_states_provinces.geojson'),
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',
  },
};

/** Ancho del tablero en unidades SVG. */
const BOARD_WIDTH = 1400;
/** Tolerancia de simplificación, en unidades de tablero. */
const SIMPLIFY_TOLERANCE = 1.6;
/** Paralelo de referencia: un valor medio que no achata demasiado los trópicos. */
const REFERENCE_LATITUDE = 30;
/** Por debajo de esta latitud no hay nada del tablero (y sí mucha Antártida). */
const MIN_LATITUDE = -58;


interface GeoFeature {
  properties: Record<string, string>;
  geometry: { type: string; coordinates: unknown };
}

async function ensure(source: { file: string; url: string }): Promise<string> {
  if (existsSync(source.file)) return readFileSync(source.file, 'utf8');
  console.log(`Descargando ${source.url.split('/').pop()}…`);
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`No se ha podido descargar (${response.status})`);
  const text = await response.text();
  mkdirSync(dirname(source.file), { recursive: true });
  writeFileSync(source.file, text);
  return text;
}

function toMultiPolygon(geometry: GeoFeature['geometry']): MultiPolygon {
  if (geometry.type === 'Polygon') return [geometry.coordinates as Point2[][]];
  return geometry.coordinates as MultiPolygon;
}

async function main(): Promise<void> {
  const countries = JSON.parse(await ensure(SOURCES.countries)) as { features: GeoFeature[] };
  const subdivisions = JSON.parse(await ensure(SOURCES.subdivisions)) as { features: GeoFeature[] };

  // 1. Unidades de origen. Los países que el tablero parte entran solo por sus
  //    subdivisiones; si no, se solaparían consigo mismos.
  const units: Record<string, MultiPolygon> = {};
  const split = new Set(SPLIT_COUNTRIES);

  for (const feature of countries.features) {
    const iso = feature.properties['ADM0_A3'];
    if (!iso || split.has(iso)) continue;
    units[`iso:${iso}`] = toMultiPolygon(feature.geometry);
  }
  for (const feature of subdivisions.features) {
    const name = feature.properties['name'];
    if (!name || EXCLUDED_SUBDIVISIONS.has(name)) continue;
    if (!split.has(feature.properties['adm0_a3'])) continue;
    units[`sub:${name}`] = toMultiPolygon(feature.geometry);
  }

  // 2. Qué unidades componen cada territorio.
  const russianEuropean = subdivisions.features
    .filter((feature) => feature.properties['adm0_a3'] === 'RUS')
    .map((feature) => feature.properties['name'])
    .filter((name) => name && !RUSSIA_ASIA.has(name) && !EXCLUDED_SUBDIVISIONS.has(name));

  const unitsOf: Record<string, string[]> = {};
  for (const [territory, sources] of Object.entries(WORLD_SOURCES)) {
    const keys = [
      ...(sources.countries ?? []).map((iso) => `iso:${iso}`),
      ...(sources.subdivisions ?? []).map((name) => `sub:${name}`),
    ];
    if (territory === 'UK') keys.push(...russianEuropean.map((name) => `sub:${name}`));
    unitsOf[territory] = keys.filter((key) => {
      if (units[key]) return true;
      // Los códigos que no existen en esta edición de Natural Earth se avisan
      // pero no rompen la generación (hay alias y territorios discutidos).
      return false;
    });
  }

  const missing = Object.keys(WORLD_NAMES).filter((id) => (unitsOf[id] ?? []).length === 0);
  if (missing.length > 0) throw new Error(`Territorios sin geometría: ${missing.join(', ')}`);

  const declared = new Set(Object.values(unitsOf).flat());
  const unused = Object.keys(units).filter((key) => !declared.has(key));

  // 3. Fundir cada territorio sobre la topología de las unidades de origen.
  const sourceTopology = buildTopology(units, { quantization: 1e-4 });
  const merged: Record<string, MultiPolygon> = {};
  for (const id of Object.keys(WORLD_NAMES)) {
    const shape = mergeFeatures(sourceTopology, unitsOf[id]);
    merged[id] = dropTinyPolygons(shape, { maxPieces: 10, minAreaRatio: 0.01 }).map((polygon) =>
      dropTinyHoles(polygon, 0.02),
    );
    if (merged[id].length === 0) throw new Error(`${id} se ha quedado sin forma al fundir`);
  }

  // 4. Recortar el hemisferio sur vacío y proyectar.
  const project = projectEquirectangular(REFERENCE_LATITUDE);
  const projected: Record<string, MultiPolygon> = {};
  for (const id of Object.keys(merged)) {
    projected[id] = mapMultiPolygon(merged[id], ([lon, lat]) =>
      project([lon, Math.max(lat, MIN_LATITUDE)]),
    );
  }

  const bounds = boundsOfAll(projected);
  const aspect = (bounds.maxY - bounds.minY) / (bounds.maxX - bounds.minX);
  const boardHeight = Math.round(BOARD_WIDTH * aspect);
  const fit = fitTransform(bounds, { minX: 0, minY: 0, maxX: BOARD_WIDTH, maxY: boardHeight });
  const board: Record<string, MultiPolygon> = {};
  for (const id of Object.keys(projected)) board[id] = transformMulti(projected[id], fit);

  // 5. Simplificar sobre la topología de los territorios ya fundidos.
  const topology = buildTopology(board, { quantization: 1e-3 });
  const before = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
  const simplified = simplifyTopology(topology, SIMPLIFY_TOLERANCE);
  const after = simplified.arcs.reduce((sum, arc) => sum + arc.length, 0);
  const shapes = rebuildAll(simplified);

  // 6. Rutas marítimas: las adyacencias del tablero que sobre el mapa no se tocan.
  const touching = adjacencyByContact(shapes, contactThresholdFor(BOARD_WIDTH));
  const seaRoutes: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [id, neighbours] of Object.entries(WORLD_ADJACENCY)) {
    for (const other of neighbours) {
      const key = id < other ? `${id}|${other}` : `${other}|${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!touching[id]?.includes(other)) seaRoutes.push(id < other ? [id, other] : [other, id]);
    }
  }
  seaRoutes.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  // 7. Emitir.
  const ids = Object.keys(WORLD_NAMES).sort();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * Siluetas de los territorios del tablero del mundo.');
  lines.push(' *');
  lines.push(' * GENERADO POR `npm run build:maps` — no editar a mano.');
  lines.push(' * Origen: Natural Earth 1:50m (dominio público), agrupado según');
  lines.push(' * `tools/world-territories.ts`.');
  lines.push(' */');
  lines.push('');
  lines.push("import type { ProvinceShape } from './spain.shapes';");
  lines.push('');
  lines.push(`export const WORLD_BOARD_WIDTH = ${BOARD_WIDTH};`);
  lines.push(`export const WORLD_BOARD_HEIGHT = ${boardHeight};`);
  lines.push('');
  lines.push('/** Adyacencias del tablero que hay que dibujar como salto por mar. */');
  lines.push('export const WORLD_SEA_ROUTES: Array<[string, string]> = [');
  for (const [a, b] of seaRoutes) lines.push(`  ['${a}', '${b}'],`);
  lines.push('];');
  lines.push('');
  lines.push('export const WORLD_SHAPES: Record<string, ProvinceShape> = {');
  for (const id of ids) {
    const [labelX, labelY] = labelPointOfMulti(shapes[id], 0.8);
    lines.push(`  ${id}: {`);
    lines.push(`    path: '${multiPolygonToPath(shapes[id], 1)}',`);
    lines.push(`    label: [${Math.round(labelX * 10) / 10}, ${Math.round(labelY * 10) / 10}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  const output = lines.join('\n');
  writeFileSync(OUTPUT, output);

  // 8. Informe.
  console.log(`Territorios: ${ids.length}`);
  console.log(`Vértices: ${before} -> ${after}`);
  console.log(`Piezas dibujadas: ${Object.values(shapes).reduce((s, m) => s + m.length, 0)}`);
  console.log(`Tablero: ${BOARD_WIDTH} x ${boardHeight}`);
  console.log(`Rutas marítimas: ${seaRoutes.length} de ${seen.size} adyacencias`);
  console.log(`   ${seaRoutes.map(([a, b]) => `${a}-${b}`).join(', ')}`);
  if (unused.length > 0) {
    console.log(`Unidades del atlas sin asignar (${unused.length}): ${unused.slice(0, 25).join(' ')}${unused.length > 25 ? '…' : ''}`);
  }
  console.log(`Archivo: ${OUTPUT} (${Math.round(output.length / 1024)} kB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
