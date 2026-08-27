/**
 * Geometría de polígonos en el plano.
 *
 * Es la base para pasar de cartografía real (GeoJSON) a siluetas de tablero:
 * medir anillos, tirar los islotes que solo ensucian, y simplificar contornos
 * sin deformarlos. Todo son funciones puras sobre arrays de puntos, así que se
 * puede probar entera sin datos reales.
 */

/** Punto en el plano. En datos de origen es [longitud, latitud]. */
export type Point2 = [number, number];

/** Anillo cerrado. El primer punto y el último coinciden. */
export type Ring = Point2[];

/** Polígono: contorno exterior seguido de sus agujeros. */
export type Polygon = Ring[];

/** Conjunto de polígonos que forman un territorio (islas incluidas). */
export type MultiPolygon = Polygon[];

export interface Bounds2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Área con signo del anillo (fórmula del cordón de zapato).
 * Positiva en sentido antihorario, negativa en horario.
 */
export function signedRingArea(ring: Ring): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  // Si el anillo no viniera cerrado, cerramos el último tramo a mano.
  const [lastX, lastY] = ring[ring.length - 1];
  const [firstX, firstY] = ring[0];
  if (lastX !== firstX || lastY !== firstY) {
    sum += lastX * firstY - firstX * lastY;
  }
  return sum / 2;
}

/** Área del anillo, siempre positiva. */
export function ringArea(ring: Ring): number {
  return Math.abs(signedRingArea(ring));
}

export function boundsOfPoints(points: readonly Point2[]): Bounds2 {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Distancia al cuadrado de un punto al segmento ab (evita raíces innecesarias). */
export function squaredDistanceToSegment(point: Point2, a: Point2, b: Point2): number {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

/**
 * Simplificación de Douglas-Peucker.
 *
 * Conserva SIEMPRE el primer y el último punto: es justo lo que permite
 * simplificar una frontera compartida una sola vez y que las dos provincias
 * que la comparten sigan encajando sin dejar rendijas.
 *
 * Coste: lineal-logarítmico con datos reales, cuadrático en el peor caso (que
 * es cuando hay que conservar casi todos los vértices, o sea, cuando la
 * tolerancia se ha quedado por debajo del detalle del propio contorno).
 */
export function simplifyLine(points: readonly Point2[], tolerance: number): Point2[] {
  if (points.length <= 2 || tolerance <= 0) return points.slice();

  const toleranceSquared = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Pila explícita en vez de recursión: hay tramos con miles de puntos.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = squaredDistanceToSegment(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > toleranceSquared) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: Point2[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

/**
 * Simplifica un anillo cerrado sin abrirlo.
 * Se simplifica la parte abierta y se vuelve a cerrar; si se queda en menos de
 * un triángulo, se devuelve null (el anillo ha dejado de tener sentido).
 */
export function simplifyRing(ring: Ring, tolerance: number): Ring | null {
  if (ring.length < 4) return ring.length >= 4 ? ring.slice() : null;
  const open = ring.slice(0, -1);
  const simplified = simplifyLine(open, tolerance);
  if (simplified.length < 3) return null;
  return [...simplified, simplified[0]];
}

/** ¿El punto cae dentro del anillo? (cruce de rayos) */
export function pointInRing(point: Point2, ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** ¿El punto cae dentro del polígono, contando los agujeros? */
export function pointInPolygon(point: Point2, polygon: Polygon): boolean {
  if (polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(point, polygon[i])) return false;
  }
  return true;
}

/**
 * Descarta los polígonos minúsculos de un territorio.
 *
 * La cartografía real de A Coruña trae más de mil anillos: casi todos son rocas
 * de un par de metros que en un tablero no se ven y solo pesan. Nos quedamos
 * con los mayores y con los que superen una fracción del principal.
 */
export function dropTinyPolygons(
  multi: MultiPolygon,
  options: { maxPieces?: number; minAreaRatio?: number } = {},
): MultiPolygon {
  const maxPieces = options.maxPieces ?? 12;
  const minAreaRatio = options.minAreaRatio ?? 0.004;
  if (multi.length === 0) return [];

  const measured = multi
    .map((polygon) => ({ polygon, area: ringArea(polygon[0] ?? []) }))
    .sort((a, b) => b.area - a.area);

  const biggest = measured[0].area || 1;
  const kept = measured
    .filter((item, index) => index === 0 || item.area / biggest >= minAreaRatio)
    .slice(0, maxPieces)
    .map((item) => item.polygon);

  return kept.length > 0 ? kept : [measured[0].polygon];
}

/** Quita también los agujeros irrelevantes de cada polígono. */
export function dropTinyHoles(polygon: Polygon, minAreaRatio = 0.01): Polygon {
  if (polygon.length <= 1) return polygon;
  const outerArea = ringArea(polygon[0]) || 1;
  return [polygon[0], ...polygon.slice(1).filter((hole) => ringArea(hole) / outerArea >= minAreaRatio)];
}
