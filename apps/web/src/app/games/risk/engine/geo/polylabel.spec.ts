import { describe, expect, it } from 'vitest';
import { labelPointOfMulti, poleOfInaccessibility, signedDistanceToPolygon } from './polylabel';
import { Point2, Polygon, Ring, pointInPolygon } from './geometry2d';

function square(x: number, y: number, size: number): Ring {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];
}

/** Forma de "C": el centroide cae en el hueco, fuera del polígono. */
function crescent(): Polygon {
  return [
    [
      [0, 0],
      [100, 0],
      [100, 30],
      [30, 30],
      [30, 70],
      [100, 70],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
  ];
}

describe('polo de inaccesibilidad', () => {
  describe('signedDistanceToPolygon', () => {
    it('es positiva dentro y negativa fuera', () => {
      const polygon = [square(0, 0, 100)];
      expect(signedDistanceToPolygon([50, 50], polygon)).toBeCloseTo(50, 6);
      expect(signedDistanceToPolygon([-10, 50], polygon)).toBeCloseTo(-10, 6);
    });

    it('mide cero justo en el borde', () => {
      expect(signedDistanceToPolygon([0, 50], [square(0, 0, 100)])).toBeCloseTo(0, 6);
    });

    it('un agujero deja el punto fuera', () => {
      const polygon = [square(0, 0, 100), square(40, 40, 20)];
      expect(signedDistanceToPolygon([50, 50], polygon)).toBeLessThan(0);
    });

    it('con un polígono vacío devuelve cero', () => {
      expect(signedDistanceToPolygon([0, 0], [])).toBe(0);
    });
  });

  describe('poleOfInaccessibility', () => {
    it('en un cuadrado cae en el centro', () => {
      const [x, y] = poleOfInaccessibility([square(0, 0, 100)], 0.5);
      expect(x).toBeCloseTo(50, 0);
      expect(y).toBeCloseTo(50, 0);
    });

    it('siempre cae dentro, aunque la forma sea cóncava', () => {
      const polygon = crescent();
      const point = poleOfInaccessibility(polygon, 0.5);
      expect(pointInPolygon(point, polygon)).toBe(true);
    });

    it('en la forma cóncava NO cae en el centroide, que está fuera', () => {
      const polygon = crescent();
      // El centro de la caja está en el hueco de la "C".
      expect(pointInPolygon([50, 50], polygon)).toBe(false);
      const point = poleOfInaccessibility(polygon, 0.5);
      expect(point).not.toEqual([50, 50]);
    });

    it('esquiva los agujeros', () => {
      const polygon = [square(0, 0, 100), square(30, 30, 40)];
      const point = poleOfInaccessibility(polygon, 0.5);
      expect(pointInPolygon(point, polygon)).toBe(true);
    });

    it('busca el sitio con más hueco alrededor', () => {
      // Pasillo estrecho a la izquierda, sala ancha a la derecha.
      const polygon: Polygon = [
        [
          [0, 45],
          [60, 45],
          [60, 0],
          [140, 0],
          [140, 100],
          [60, 100],
          [60, 55],
          [0, 55],
          [0, 45],
        ],
      ];
      const [x] = poleOfInaccessibility(polygon, 0.5);
      expect(x).toBeGreaterThan(60);
    });

    it('es determinista', () => {
      expect(poleOfInaccessibility(crescent(), 0.5)).toEqual(poleOfInaccessibility(crescent(), 0.5));
    });

    it('aguanta polígonos degenerados', () => {
      expect(poleOfInaccessibility([], 1)).toEqual([0, 0]);
      expect(poleOfInaccessibility([[[5, 5], [5, 5], [5, 5]]], 1)).toEqual([5, 5]);
    });
  });

  describe('labelPointOfMulti', () => {
    it('elige la pieza más grande, no la islita', () => {
      const peninsula = [square(0, 0, 100)];
      const island = [square(500, 500, 5)];
      const [x, y] = labelPointOfMulti([peninsula, island], 0.5);
      expect(x).toBeLessThan(200);
      expect(y).toBeLessThan(200);
    });

    it('el punto cae dentro de la pieza elegida', () => {
      const multi = [crescent(), [square(500, 500, 10)]];
      const point = labelPointOfMulti(multi, 0.5) as Point2;
      expect(multi.some((polygon) => pointInPolygon(point, polygon))).toBe(true);
    });

    it('sin piezas devuelve el origen', () => {
      expect(labelPointOfMulti([], 1)).toEqual([0, 0]);
    });
  });
});
