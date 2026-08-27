import { Bounds2, MultiPolygon, Point2, boundsOfPoints } from './geometry2d';

/**
 * Paso de coordenadas geográficas a coordenadas de tablero.
 *
 * No buscamos exactitud cartográfica sino que el mapa se reconozca de un
 * vistazo y quepa en la pantalla. Una equirrectangular con el paralelo de
 * referencia bien elegido basta para un país; lo importante es corregir el
 * achatamiento en longitud, porque si no España sale estirada a lo ancho.
 */

export interface Transform2 {
  scale: number;
  dx: number;
  dy: number;
}

export const IDENTITY_TRANSFORM: Transform2 = { scale: 1, dx: 0, dy: 0 };

/**
 * Proyección equirrectangular con paralelo de referencia.
 * La latitud se invierte porque en SVG la Y crece hacia abajo.
 */
export function projectEquirectangular(referenceLatitude: number): (point: Point2) => Point2 {
  const factor = Math.cos((referenceLatitude * Math.PI) / 180);
  return ([lon, lat]) => [lon * factor, -lat];
}

/** Aplica una función punto a punto sobre todo un multipolígono. */
export function mapMultiPolygon(multi: MultiPolygon, fn: (point: Point2) => Point2): MultiPolygon {
  return multi.map((polygon) => polygon.map((ring) => ring.map(fn)));
}

/** Caja que contiene un multipolígono. */
export function boundsOfMulti(multi: MultiPolygon): Bounds2 {
  return boundsOfPoints(multi.flat(2));
}

/** Caja que contiene varios territorios. */
export function boundsOfAll(features: Record<string, MultiPolygon>): Bounds2 {
  return boundsOfPoints(Object.values(features).flat(3) as Point2[]);
}

/** Une dos cajas. */
export function unionBounds(a: Bounds2, b: Bounds2): Bounds2 {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Transformación que mete `bounds` dentro de `target` sin deformar
 * (misma escala en las dos direcciones) y centrado.
 */
export function fitTransform(bounds: Bounds2, target: Bounds2): Transform2 {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const targetWidth = target.maxX - target.minX;
  const targetHeight = target.maxY - target.minY;
  if (width <= 0 || height <= 0) return IDENTITY_TRANSFORM;

  const scale = Math.min(targetWidth / width, targetHeight / height);
  const dx = target.minX + (targetWidth - width * scale) / 2 - bounds.minX * scale;
  const dy = target.minY + (targetHeight - height * scale) / 2 - bounds.minY * scale;
  return { scale, dx, dy };
}

export function applyTransform(point: Point2, transform: Transform2): Point2 {
  return [point[0] * transform.scale + transform.dx, point[1] * transform.scale + transform.dy];
}

export function transformMulti(multi: MultiPolygon, transform: Transform2): MultiPolygon {
  return mapMultiPolygon(multi, (point) => applyTransform(point, transform));
}

/**
 * Coloca un grupo de territorios en su propio recuadro.
 *
 * Es lo que se hace en cualquier mapa de España con Canarias: si se dibujan
 * donde están de verdad, el resto del país se queda en un tercio de la
 * pantalla. Se recortan y se llevan a una esquina.
 */
export function insetFeatures(
  features: Record<string, MultiPolygon>,
  ids: readonly string[],
  target: Bounds2,
): Record<string, MultiPolygon> {
  const group: Record<string, MultiPolygon> = {};
  for (const id of ids) {
    if (features[id]) group[id] = features[id];
  }
  if (Object.keys(group).length === 0) return features;

  const transform = fitTransform(boundsOfAll(group), target);
  const out: Record<string, MultiPolygon> = { ...features };
  for (const id of Object.keys(group)) out[id] = transformMulti(group[id], transform);
  return out;
}

/** Redondea las coordenadas para que el archivo de datos no pese de más. */
export function roundMulti(multi: MultiPolygon, decimals = 1): MultiPolygon {
  const factor = 10 ** decimals;
  return mapMultiPolygon(multi, ([x, y]) => [
    Math.round(x * factor) / factor,
    Math.round(y * factor) / factor,
  ]);
}

/** Convierte un multipolígono en un `path` SVG (regla par-impar para los agujeros). */
export function multiPolygonToPath(multi: MultiPolygon, decimals = 1): string {
  const factor = 10 ** decimals;
  const round = (value: number) => Math.round(value * factor) / factor;
  const parts: string[] = [];

  for (const polygon of multi) {
    for (const ring of polygon) {
      if (ring.length < 3) continue;
      const points = ring.slice(0, -1);
      parts.push(
        `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`,
      );
    }
  }
  return parts.join('');
}
