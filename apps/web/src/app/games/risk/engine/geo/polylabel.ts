import { Bounds2, Point2, Polygon, boundsOfPoints, pointInPolygon, squaredDistanceToSegment } from './geometry2d';

/**
 * Polo de inaccesibilidad: el punto más "interior" de un polígono.
 *
 * Hace falta para las etiquetas. El centroide vale para formas convexas, pero
 * en una silueta real se sale fuera con facilidad (Galicia con las rías, la
 * bahía de Cádiz), y una etiqueta flotando en el mar queda fatal. Este punto,
 * en cambio, siempre cae dentro y además es el sitio con más hueco alrededor.
 *
 * Es el algoritmo de Mapbox: se cubre el polígono con celdas, se explora
 * primero la más prometedora y se va subdividiendo hasta la precisión pedida.
 */

interface Cell {
  x: number;
  y: number;
  /** Media diagonal de la celda. */
  h: number;
  /** Distancia del centro de la celda al borde (negativa si está fuera). */
  distance: number;
  /** Cota superior de la distancia alcanzable dentro de la celda. */
  potential: number;
}

/** Distancia con signo de un punto al polígono: positiva dentro, negativa fuera. */
export function signedDistanceToPolygon(point: Point2, polygon: Polygon): number {
  let minSquared = Infinity;
  for (const ring of polygon) {
    for (let i = 0; i < ring.length - 1; i++) {
      const distance = squaredDistanceToSegment(point, ring[i], ring[i + 1]);
      if (distance < minSquared) minSquared = distance;
    }
  }
  if (!Number.isFinite(minSquared)) return 0;
  const distance = Math.sqrt(minSquared);
  return pointInPolygon(point, polygon) ? distance : -distance;
}

function makeCell(x: number, y: number, h: number, polygon: Polygon): Cell {
  const distance = signedDistanceToPolygon([x, y], polygon);
  return { x, y, h, distance, potential: distance + h * Math.SQRT2 };
}

/** Montículo binario por "potencial": siempre sale primero la celda más prometedora. */
class MaxHeap {
  private items: Cell[] = [];

  get size(): number {
    return this.items.length;
  }

  push(cell: Cell): void {
    this.items.push(cell);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].potential >= this.items[i].potential) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): Cell | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let best = i;
        if (left < this.items.length && this.items[left].potential > this.items[best].potential) {
          best = left;
        }
        if (right < this.items.length && this.items[right].potential > this.items[best].potential) {
          best = right;
        }
        if (best === i) break;
        [this.items[best], this.items[i]] = [this.items[i], this.items[best]];
        i = best;
      }
    }
    return top;
  }
}

/** Centroide del anillo exterior; se usa como primer candidato. */
function centroidOf(polygon: Polygon, bounds: Bounds2): Cell {
  const ring = polygon[0] ?? [];
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = xi * yj - xj * yi;
    area += cross;
    x += (xi + xj) * cross;
    y += (yi + yj) * cross;
  }
  if (area === 0) {
    return makeCell((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0, polygon);
  }
  return makeCell(x / (area * 3), y / (area * 3), 0, polygon);
}

/**
 * Devuelve el punto más interior del polígono.
 * `precision` está en las mismas unidades que las coordenadas.
 */
export function poleOfInaccessibility(polygon: Polygon, precision = 1): Point2 {
  const outer = polygon[0];
  if (!outer || outer.length < 3) return [0, 0];

  const bounds = boundsOfPoints(outer);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [bounds.minX, bounds.minY];

  const heap = new MaxHeap();
  let h = cellSize / 2;

  // Rejilla inicial que cubre todo el polígono.
  for (let x = bounds.minX; x < bounds.maxX; x += cellSize) {
    for (let y = bounds.minY; y < bounds.maxY; y += cellSize) {
      heap.push(makeCell(x + h, y + h, h, polygon));
    }
  }

  let best = centroidOf(polygon, bounds);
  const bboxCell = makeCell((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0, polygon);
  if (bboxCell.distance > best.distance) best = bboxCell;

  // Tope defensivo: sin él, una precisión absurda podría no terminar nunca.
  let guard = 0;
  while (heap.size > 0 && guard++ < 200000) {
    const cell = heap.pop()!;
    if (cell.distance > best.distance) best = cell;
    // Si ni en el mejor de los casos mejora, no merece la pena partirla.
    if (cell.potential - best.distance <= precision) continue;

    h = cell.h / 2;
    heap.push(makeCell(cell.x - h, cell.y - h, h, polygon));
    heap.push(makeCell(cell.x + h, cell.y - h, h, polygon));
    heap.push(makeCell(cell.x - h, cell.y + h, h, polygon));
    heap.push(makeCell(cell.x + h, cell.y + h, h, polygon));
  }

  return [best.x, best.y];
}

/**
 * Punto de etiqueta de un territorio con varias piezas: se elige el polo del
 * trozo más grande (una isla pequeña no debe robarle la etiqueta a la península).
 */
export function labelPointOfMulti(multi: readonly Polygon[], precision = 1): Point2 {
  if (multi.length === 0) return [0, 0];
  let best: Polygon = multi[0];
  let bestArea = -Infinity;
  for (const polygon of multi) {
    const bounds = boundsOfPoints(polygon[0] ?? []);
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  return poleOfInaccessibility(best, precision);
}
