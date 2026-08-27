import type {
  Bounds2,
  MultiPolygon,
  Point2,
  Ring} from './geometry2d';
import {
  boundsOfPoints,
  pointInRing,
  ringArea,
  simplifyLine,
  squaredDistanceToSegment,
} from './geometry2d';

/**
 * Topología compartida entre territorios, al estilo TopoJSON.
 *
 * El problema que resuelve: si simplificas cada provincia por su cuenta, la
 * frontera común entre dos vecinas se simplifica dos veces y de formas
 * distintas, y aparecen rendijas y solapes en el mapa. Aquí las fronteras se
 * extraen UNA vez como "arcos", se simplifican una vez, y cada territorio se
 * reconstruye a partir de los mismos arcos. Encajan por construcción.
 *
 * De regalo sale la adyacencia exacta: dos territorios son vecinos si comparten
 * un arco. Ya no hace falta declararla a mano ni derivarla de un dibujo.
 */

/**
 * Referencia a un arco. Un índice >= 0 lo recorre hacia delante; uno negativo
 * es `~indice` y lo recorre del revés (mismo convenio que TopoJSON).
 */
export type ArcRef = number;

/** Un territorio: polígonos -> anillos -> referencias de arco. */
export type FeatureArcs = ArcRef[][][];

export interface Topology {
  arcs: Point2[][];
  features: Record<string, FeatureArcs>;
  adjacency: Record<string, string[]>;
}

/** Cuantización por defecto: ~1 m. Suficiente para juntar vértices "casi iguales". */
const DEFAULT_QUANTIZATION = 1e-5;

function quantize(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function pointKey(point: Point2): string {
  return `${point[0]},${point[1]}`;
}

function edgeKey(a: Point2, b: Point2): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Redondea a la rejilla y quita vértices repetidos consecutivos. */
function normalizeRing(ring: Ring, grid: number): Ring | null {
  const out: Point2[] = [];
  for (const [x, y] of ring) {
    const point: Point2 = [quantize(x, grid), quantize(y, grid)];
    const previous = out[out.length - 1];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    out.push(point);
  }
  // Cerramos el anillo y evitamos que el cierre duplique el primer punto.
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) out.pop();
    else break;
  }
  if (out.length < 3) return null;
  out.push(out[0]);
  return out;
}

/**
 * Construye la topología a partir de los territorios en bruto.
 * `features` es `id -> multipolígono` en coordenadas de origen.
 */
export function buildTopology(
  features: Record<string, MultiPolygon>,
  options: { quantization?: number } = {},
): Topology {
  const grid = options.quantization ?? DEFAULT_QUANTIZATION;

  // 1. Normalizar y guardar los anillos por territorio.
  const normalized: Record<string, Ring[][]> = {};
  for (const [id, multi] of Object.entries(features)) {
    const polygons: Ring[][] = [];
    for (const polygon of multi) {
      const rings: Ring[] = [];
      for (const ring of polygon) {
        const clean = normalizeRing(ring, grid);
        if (clean) rings.push(clean);
      }
      if (rings.length > 0) polygons.push(rings);
    }
    normalized[id] = polygons;
  }

  // 2. Quién usa cada arista. Dos territorios que comparten arista son vecinos.
  const edgeOwners = new Map<string, Set<string>>();
  for (const [id, polygons] of Object.entries(normalized)) {
    for (const rings of polygons) {
      for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const key = edgeKey(ring[i], ring[i + 1]);
          let owners = edgeOwners.get(key);
          if (!owners) {
            owners = new Set();
            edgeOwners.set(key, owners);
          }
          owners.add(id);
        }
      }
    }
  }

  const adjacencySets: Record<string, Set<string>> = {};
  for (const id of Object.keys(normalized)) adjacencySets[id] = new Set();
  for (const owners of edgeOwners.values()) {
    if (owners.size < 2) continue;
    const list = Array.from(owners);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        adjacencySets[list[i]].add(list[j]);
        adjacencySets[list[j]].add(list[i]);
      }
    }
  }

  // 3. Partir cada anillo en arcos: un arco es un tramo seguido de aristas que
  //    pertenecen exactamente a los mismos territorios.
  const arcs: Point2[][] = [];
  const arcIndexByKey = new Map<string, number>();
  const featureArcs: Record<string, FeatureArcs> = {};

  const signatureOf = (a: Point2, b: Point2): string => {
    const owners = edgeOwners.get(edgeKey(a, b));
    return owners ? Array.from(owners).sort().join(' ') : '';
  };

  const registerArc = (points: Point2[]): ArcRef => {
    const forward = points.map(pointKey).join(';');
    const existing = arcIndexByKey.get(forward);
    if (existing !== undefined) return existing;

    const backward = points.slice().reverse().map(pointKey).join(';');
    const reversed = arcIndexByKey.get(backward);
    if (reversed !== undefined) return ~reversed;

    const index = arcs.length;
    arcs.push(points);
    arcIndexByKey.set(forward, index);
    return index;
  };

  for (const [id, polygons] of Object.entries(normalized)) {
    const featurePolygons: FeatureArcs = [];
    for (const rings of polygons) {
      const ringRefs: ArcRef[][] = [];
      for (const ring of rings) {
        const edgeCount = ring.length - 1;
        const signatures: string[] = [];
        for (let i = 0; i < edgeCount; i++) signatures.push(signatureOf(ring[i], ring[i + 1]));

        // Puntos de corte: donde cambia el conjunto de dueños.
        const cuts: number[] = [];
        for (let i = 0; i < edgeCount; i++) {
          const previous = signatures[(i - 1 + edgeCount) % edgeCount];
          if (signatures[i] !== previous) cuts.push(i);
        }
        // Anillo entero con un solo dueño: un único arco cerrado.
        if (cuts.length === 0) cuts.push(0);

        const refs: ArcRef[] = [];
        for (let c = 0; c < cuts.length; c++) {
          const start = cuts[c];
          const end = cuts[(c + 1) % cuts.length];
          const points: Point2[] = [ring[start]];
          let i = start;
          do {
            i = (i + 1) % edgeCount;
            points.push(ring[i]);
          } while (i !== end);
          refs.push(registerArc(points));
        }
        ringRefs.push(refs);
      }
      featurePolygons.push(ringRefs);
    }
    featureArcs[id] = featurePolygons;
  }

  const adjacency: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(adjacencySets)) adjacency[id] = Array.from(set).sort();

  return { arcs, features: featureArcs, adjacency };
}

/**
 * Simplifica cada arco una sola vez.
 * Como los vecinos comparten el mismo arco, sus contornos siguen encajando
 * exactamente después de simplificar.
 */
export function simplifyTopology(topology: Topology, tolerance: number): Topology {
  return {
    ...topology,
    arcs: topology.arcs.map((arc) => {
      const simplified = simplifyLine(arc, tolerance);
      // Nunca dejamos un arco por debajo de dos puntos: rompería los anillos.
      return simplified.length >= 2 ? simplified : arc.slice(0, 2);
    }),
  };
}

/** Devuelve los puntos de una referencia de arco, ya orientados. */
export function arcPoints(topology: Topology, ref: ArcRef): Point2[] {
  const arc = topology.arcs[ref < 0 ? ~ref : ref];
  return ref < 0 ? arc.slice().reverse() : arc;
}

/** Reconstruye el multipolígono de un territorio a partir de sus arcos. */
export function rebuildFeature(topology: Topology, id: string): MultiPolygon {
  const polygons = topology.features[id] ?? [];
  const out: MultiPolygon = [];

  for (const rings of polygons) {
    const rebuilt: Ring[] = [];
    for (const refs of rings) {
      const ring: Point2[] = [];
      for (const ref of refs) {
        const points = arcPoints(topology, ref);
        // El primer punto de cada arco es el último del anterior.
        for (let i = ring.length === 0 ? 0 : 1; i < points.length; i++) ring.push(points[i]);
      }
      if (ring.length < 3) continue;
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      if (ring.length >= 4) rebuilt.push(ring);
    }
    if (rebuilt.length > 0) out.push(rebuilt);
  }
  return out;
}

/** Reconstruye todos los territorios. */
export function rebuildAll(topology: Topology): Record<string, MultiPolygon> {
  const out: Record<string, MultiPolygon> = {};
  for (const id of Object.keys(topology.features)) out[id] = rebuildFeature(topology, id);
  return out;
}


/**
 * Adyacencia por contacto: dos territorios son vecinos si sus contornos se
 * acercan más que `threshold`.
 *
 * Hace falta además de los arcos compartidos porque la cartografía real está
 * llena de uniones en T: Ávila y Valladolid se tocan de verdad, pero una tiene
 * un vértice en mitad de la arista de la otra, así que no comparten ninguna
 * arista y por aristas parecerían no ser vecinas.
 *
 * El umbral es holgado a propósito: en el mapa de provincias las fronteras
 * reales están a distancia 0 y las provincias que solo se acercan sin tocarse
 * están a más de 20 unidades de tablero. Hay margen de sobra.
 */
export function adjacencyByContact(
  features: Record<string, MultiPolygon>,
  threshold: number,
): Record<string, string[]> {
  const ids = Object.keys(features);
  const thresholdSquared = threshold * threshold;

  const points: Record<string, Point2[]> = {};
  const bounds: Record<string, Bounds2> = {};
  for (const id of ids) {
    points[id] = features[id].flat(2);
    bounds[id] = boundsOfPoints(points[id]);
  }

  const result: Record<string, Set<string>> = {};
  for (const id of ids) result[id] = new Set();

  const boxesApart = (a: Bounds2, b: Bounds2): boolean =>
    a.minX - b.maxX > threshold ||
    b.minX - a.maxX > threshold ||
    a.minY - b.maxY > threshold ||
    b.minY - a.maxY > threshold;

  const touches = (a: string, b: string): boolean => {
    for (const polygon of features[b]) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length - 1; i++) {
          for (const point of points[a]) {
            if (squaredDistanceToSegment(point, ring[i], ring[i + 1]) <= thresholdSquared) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      // Descarte rápido por caja: la inmensa mayoría de pares ni se rozan.
      if (boxesApart(bounds[a], bounds[b])) continue;
      if (touches(a, b) || touches(b, a)) {
        result[a].add(b);
        result[b].add(a);
      }
    }
  }

  const out: Record<string, string[]> = {};
  for (const id of ids) out[id] = Array.from(result[id]).sort();
  return out;
}

/**
 * Funde varios territorios en uno solo (disolución).
 *
 * Se apoya en los arcos: dentro del grupo, una frontera interior aparece dos
 * veces (una por cada lado), y el contorno exterior solo una. Basta con quedarse
 * con los arcos usados una única vez y encadenarlos. No hace falta ninguna
 * operación booleana de polígonos, que es donde suelen aparecer los artefactos.
 *
 * Es lo que permite construir el mapa por comunidades a partir del provincial,
 * y lo que hará falta para agrupar estados y países en los territorios del mapa
 * del mundo.
 */
export function mergeFeatures(topology: Topology, ids: readonly string[]): MultiPolygon {
  const usage = new Map<number, number>();
  const refs: ArcRef[] = [];

  for (const id of ids) {
    for (const rings of topology.features[id] ?? []) {
      for (const ring of rings) {
        for (const ref of ring) {
          const index = ref < 0 ? ~ref : ref;
          usage.set(index, (usage.get(index) ?? 0) + 1);
          refs.push(ref);
        }
      }
    }
  }

  const boundary = refs.filter((ref) => usage.get(ref < 0 ? ~ref : ref) === 1);
  if (boundary.length === 0) return [];

  // Encadenamos los arcos de borde por sus extremos hasta cerrar cada anillo.
  const byStart = new Map<string, ArcRef[]>();
  const endpointKey = (point: Point2) => `${point[0]},${point[1]}`;
  for (const ref of boundary) {
    const points = arcPoints(topology, ref);
    const key = endpointKey(points[0]);
    if (!byStart.has(key)) byStart.set(key, []);
    byStart.get(key)!.push(ref);
  }

  const used = new Set<ArcRef>();
  const rings: Ring[] = [];

  for (const startRef of boundary) {
    if (used.has(startRef)) continue;
    const ring: Point2[] = [];
    let ref: ArcRef | undefined = startRef;
    // Tope defensivo: nunca hay más pasos que arcos de borde.
    for (let guard = 0; ref !== undefined && guard <= boundary.length; guard++) {
      used.add(ref);
      const points = arcPoints(topology, ref);
      for (let i = ring.length === 0 ? 0 : 1; i < points.length; i++) ring.push(points[i]);

      const candidates = byStart.get(endpointKey(points[points.length - 1])) ?? [];
      ref = candidates.find((candidate) => !used.has(candidate));
      if (ring.length > 2) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) break;
      }
    }

    if (ring.length < 3) continue;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    if (ring.length >= 4) rings.push(ring);
  }

  return groupRingsIntoPolygons(rings);
}

/**
 * Reparte anillos sueltos en polígonos: cada anillo contenido dentro de otro
 * pasa a ser agujero suyo; el resto son contornos exteriores.
 */
export function groupRingsIntoPolygons(rings: readonly Ring[]): MultiPolygon {
  const sorted = [...rings].sort((a, b) => ringArea(b) - ringArea(a));
  const polygons: MultiPolygon = [];

  for (const ring of sorted) {
    const container = polygons.find((polygon) => pointInRing(ring[0], polygon[0]));
    if (container) container.push(ring);
    else polygons.push([ring]);
  }
  return polygons;
}

/** Une dos mapas de adyacencia. */
export function mergeAdjacency(
  ...sources: Record<string, string[]>[]
): Record<string, string[]> {
  const merged: Record<string, Set<string>> = {};
  for (const source of sources) {
    for (const [id, neighbours] of Object.entries(source)) {
      if (!merged[id]) merged[id] = new Set();
      for (const other of neighbours) merged[id].add(other);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(merged)) out[id] = Array.from(set).sort();
  return out;
}
