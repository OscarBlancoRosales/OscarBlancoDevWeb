/**
 * Geometría del retículo hexagonal.
 *
 * Los mapas se definen como conjuntos de celdas hexagonales (offset odd-r,
 * hexágonos con punta arriba). De ahí derivamos el contorno de cada territorio,
 * su centroide y un path SVG suavizado. Ventajas: los mapas son datos
 * compactos y editables, y el dibujo es consistente entre mapas.
 */

export type Hex = [number, number]; // [col, row]
export interface Point {
  x: number;
  y: number;
}

const SQRT3 = Math.sqrt(3);

/** Centro del hexágono en coordenadas SVG. */
export function hexCenter(col: number, row: number, radius: number): Point {
  const offset = (row & 1) === 0 ? 0 : SQRT3 * radius * 0.5;
  return { x: SQRT3 * radius * col + offset, y: 1.5 * radius * row };
}

/** Las 6 esquinas de un hexágono con punta arriba, en sentido horario. */
export function hexCorners(col: number, row: number, radius: number): Point[] {
  const c = hexCenter(col, row, radius);
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push({ x: c.x + radius * Math.cos(angle), y: c.y + radius * Math.sin(angle) });
  }
  return pts;
}

/** Vecinos de una celda en offset odd-r. */
export function hexNeighbors(col: number, row: number): Hex[] {
  const odd = (row & 1) === 1;
  const dx = odd ? 1 : -1;
  return [
    [col + 1, row],
    [col - 1, row],
    [col, row - 1],
    [col, row + 1],
    [col + dx, row - 1],
    [col + dx, row + 1],
  ];
}

const KEY_PRECISION = 1000;
function key(p: Point): string {
  return `${Math.round(p.x * KEY_PRECISION)}:${Math.round(p.y * KEY_PRECISION)}`;
}

/**
 * Contorno(s) de un conjunto de hexágonos.
 * Devuelve una lista de anillos de puntos (uno por componente conexa / agujero).
 */
export function outlineRings(hexes: readonly Hex[], radius: number): Point[][] {
  // 1. Recolectar aristas; las compartidas por dos celdas son interiores.
  const edges = new Map<string, { a: Point; b: Point; count: number }>();
  for (const [col, row] of hexes) {
    const corners = hexCorners(col, row, radius);
    for (let i = 0; i < 6; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 6];
      const ka = key(a);
      const kb = key(b);
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const found = edges.get(id);
      if (found) {
        found.count++;
      } else {
        edges.set(id, { a, b, count: 1 });
      }
    }
  }

  // 2. Construir grafo con las aristas de borde.
  const adjacency = new Map<string, Point[]>();
  const nodes = new Map<string, Point>();
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    const ka = key(edge.a);
    const kb = key(edge.b);
    nodes.set(ka, edge.a);
    nodes.set(kb, edge.b);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka)!.push(edge.b);
    adjacency.get(kb)!.push(edge.a);
  }

  // 3. Recorrer los anillos encadenando aristas de borde.
  const visitedEdges = new Set<string>();
  const edgeId = (a: Point, b: Point) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  const rings: Point[][] = [];
  for (const startKey of adjacency.keys()) {
    const start = nodes.get(startKey)!;
    for (const firstNext of adjacency.get(startKey)!) {
      if (visitedEdges.has(edgeId(start, firstNext))) continue;

      const ring: Point[] = [start];
      let prev = start;
      let current = firstNext;
      visitedEdges.add(edgeId(prev, current));

      // Guarda defensiva: nunca hay más pasos que aristas.
      for (let guard = 0; guard < edges.size * 2 + 8; guard++) {
        ring.push(current);
        const options = adjacency.get(key(current)) ?? [];
        let nextPoint: Point | null = null;
        for (const candidate of options) {
          if (key(candidate) === key(prev)) continue;
          if (visitedEdges.has(edgeId(current, candidate))) continue;
          nextPoint = candidate;
          break;
        }
        if (!nextPoint) break;
        visitedEdges.add(edgeId(current, nextPoint));
        prev = current;
        current = nextPoint;
        if (key(current) === startKey) break;
      }
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}

/** Centroide del conjunto de celdas (media de centros). */
export function hexesCentroid(hexes: readonly Hex[], radius: number): Point {
  if (hexes.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const [col, row] of hexes) {
    const c = hexCenter(col, row, radius);
    x += c.x;
    y += c.y;
  }
  return { x: x / hexes.length, y: y / hexes.length };
}

/**
 * Punto de etiqueta: el centro del hexágono más cercano al centroide,
 * de forma que la etiqueta siempre cae dentro del territorio aunque sea cóncavo.
 */
export function labelPoint(hexes: readonly Hex[], radius: number): Point {
  const centroid = hexesCentroid(hexes, radius);
  let best: Point = centroid;
  let bestDist = Infinity;
  for (const [col, row] of hexes) {
    const c = hexCenter(col, row, radius);
    const dist = (c.x - centroid.x) ** 2 + (c.y - centroid.y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/** Convierte un anillo en un path SVG con las esquinas redondeadas. */
export function roundedRingPath(ring: readonly Point[], cornerRadius: number): string {
  const pts = ring.slice();
  // El recorrido cierra repitiendo el primer punto: lo quitamos.
  if (
    pts.length > 1 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 1e-6 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 1e-6
  ) {
    pts.pop();
  }
  if (pts.length < 3) return '';
  if (cornerRadius <= 0) {
    return `M ${pts.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' L ')} Z`;
  }

  const parts: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];

    const lenPrev = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
    const lenNext = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
    const tPrev = Math.min(0.5, cornerRadius / lenPrev);
    const tNext = Math.min(0.5, cornerRadius / lenNext);

    const inPoint = lerp(cur, prev, tPrev);
    const outPoint = lerp(cur, next, tNext);

    if (i === 0) parts.push(`M ${fmt(inPoint.x)} ${fmt(inPoint.y)}`);
    else parts.push(`L ${fmt(inPoint.x)} ${fmt(inPoint.y)}`);
    parts.push(`Q ${fmt(cur.x)} ${fmt(cur.y)} ${fmt(outPoint.x)} ${fmt(outPoint.y)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Path SVG completo de un territorio (todos sus anillos). */
export function territoryPath(hexes: readonly Hex[], radius: number, cornerRadius = 3): string {
  return outlineRings(hexes, radius)
    .map((ring) => roundedRingPath(ring, cornerRadius))
    .filter(Boolean)
    .join(' ');
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/** Caja contenedora de un conjunto de celdas, con margen. */
export function hexesBounds(hexes: readonly Hex[], radius: number, padding = 0): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [col, row] of hexes) {
    for (const corner of hexCorners(col, row, radius)) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Parsea un mapa en formato "arte ASCII" a celdas por territorio.
 * Cada fila es una línea, cada token una celda; "." y ".." son mar.
 */
export function parseHexArt(rows: readonly string[]): Record<string, Hex[]> {
  const result: Record<string, Hex[]> = {};
  rows.forEach((row, rowIndex) => {
    const tokens = row.trim().length === 0 ? [] : row.trim().split(/\s+/);
    tokens.forEach((token, colIndex) => {
      if (token === '.' || token === '..' || token === '--') return;
      if (!result[token]) result[token] = [];
      result[token].push([colIndex, rowIndex]);
    });
  });
  return result;
}

/**
 * Deriva las adyacencias a partir del dibujo: dos territorios son vecinos si
 * comparten al menos una arista de hexágono. Se usa en mapas donde el dibujo es
 * la fuente de verdad geográfica (p. ej. España por provincias).
 */
export function deriveAdjacency(
  hexesByTerritory: Record<string, readonly Hex[]>,
): Record<string, string[]> {
  const owner = new Map<string, string>();
  for (const [id, hexes] of Object.entries(hexesByTerritory)) {
    for (const [col, row] of hexes) owner.set(`${col},${row}`, id);
  }
  const result: Record<string, Set<string>> = {};
  for (const id of Object.keys(hexesByTerritory)) result[id] = new Set();
  for (const [id, hexes] of Object.entries(hexesByTerritory)) {
    for (const [col, row] of hexes) {
      for (const [nc, nr] of hexNeighbors(col, row)) {
        const other = owner.get(`${nc},${nr}`);
        if (other && other !== id) {
          result[id].add(other);
          result[other].add(id);
        }
      }
    }
  }
  const out: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(result)) out[id] = Array.from(set).sort();
  return out;
}
