import { describe, expect, it } from 'vitest';
import type {
  Point2,
  Ring} from './geometry2d';
import {
  boundsOfPoints,
  dropTinyHoles,
  dropTinyPolygons,
  pointInPolygon,
  pointInRing,
  ringArea,
  signedRingArea,
  simplifyLine,
  simplifyRing,
  squaredDistanceToSegment,
} from './geometry2d';

/** Cuadrado cerrado de lado `size` con esquina en (x, y). */
function square(x: number, y: number, size: number): Ring {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];
}

describe('geometría de polígonos', () => {
  describe('área', () => {
    it('calcula el área de un cuadrado', () => {
      expect(ringArea(square(0, 0, 10))).toBe(100);
    });

    it('el signo distingue el sentido de recorrido', () => {
      const clockwise = square(0, 0, 10);
      const counter = clockwise.slice().reverse();
      expect(Math.sign(signedRingArea(clockwise))).toBe(-Math.sign(signedRingArea(counter)));
    });

    it('un anillo degenerado tiene área cero', () => {
      expect(ringArea([[0, 0], [1, 1]])).toBe(0);
      expect(ringArea([])).toBe(0);
    });

    it('funciona con anillos sin cerrar', () => {
      expect(ringArea([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(100);
    });
  });

  describe('boundsOfPoints', () => {
    it('encuentra la caja contenedora', () => {
      expect(boundsOfPoints([[1, 5], [-3, 2], [7, -1]])).toEqual({
        minX: -3,
        minY: -1,
        maxX: 7,
        maxY: 5,
      });
    });

    it('sin puntos devuelve una caja vacía', () => {
      expect(boundsOfPoints([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });
  });

  describe('squaredDistanceToSegment', () => {
    it('mide la perpendicular cuando el pie cae dentro', () => {
      expect(squaredDistanceToSegment([5, 3], [0, 0], [10, 0])).toBe(9);
    });

    it('mide al extremo cuando el pie cae fuera', () => {
      expect(squaredDistanceToSegment([-4, 0], [0, 0], [10, 0])).toBe(16);
      expect(squaredDistanceToSegment([14, 0], [0, 0], [10, 0])).toBe(16);
    });

    it('un segmento degenerado se comporta como un punto', () => {
      expect(squaredDistanceToSegment([3, 4], [0, 0], [0, 0])).toBe(25);
    });
  });

  describe('simplifyLine', () => {
    it('quita los puntos alineados', () => {
      const line: Point2[] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
      expect(simplifyLine(line, 0.1)).toEqual([[0, 0], [4, 0]]);
    });

    it('conserva los vértices que marcan la forma', () => {
      const line: Point2[] = [[0, 0], [1, 0], [2, 5], [3, 0], [4, 0]];
      expect(simplifyLine(line, 1)).toEqual([[0, 0], [2, 5], [4, 0]]);
    });

    it('conserva siempre los extremos', () => {
      const line: Point2[] = [[0, 0], [1, 0.001], [2, 0], [3, 0.002], [9, 0]];
      const simplified = simplifyLine(line, 1);
      expect(simplified[0]).toEqual([0, 0]);
      expect(simplified.at(-1)).toEqual([9, 0]);
    });

    it('con tolerancia cero no toca nada', () => {
      const line: Point2[] = [[0, 0], [1, 0], [2, 0]];
      expect(simplifyLine(line, 0)).toEqual(line);
    });

    it('a mayor tolerancia, menos puntos', () => {
      const line: Point2[] = Array.from({ length: 200 }, (_, i) => [i, Math.sin(i / 8) * 4] as Point2);
      const suave = simplifyLine(line, 0.2).length;
      const bruto = simplifyLine(line, 3).length;
      expect(bruto).toBeLessThan(suave);
      expect(bruto).toBeGreaterThanOrEqual(2);
    });

    it('aguanta contornos de decenas de miles de puntos', () => {
      // Una costa real: muy detallada, pero suave a la escala de la tolerancia.
      const line: Point2[] = Array.from(
        { length: 50000 },
        (_, i) => [i * 0.01, Math.sin(i / 500) * 30 + Math.sin(i / 37) * 0.3] as Point2,
      );
      const started = Date.now();
      const simplified = simplifyLine(line, 1);
      expect(simplified.length).toBeLessThan(line.length / 100);
      expect(Date.now() - started).toBeLessThan(3000);
    });

    it('no desborda la pila ni en el peor caso (todos los vértices cuentan)', () => {
      // Diente de sierra a la escala de la tolerancia: hay que conservarlo entero.
      // Es el caso cuadrático del algoritmo, así que lo probamos a tamaño sensato.
      const line: Point2[] = Array.from({ length: 4000 }, (_, i) => [i, i % 2] as Point2);
      expect(() => simplifyLine(line, 0.1)).not.toThrow();
      expect(simplifyLine(line, 0.1).length).toBeGreaterThan(line.length / 2);
    });
  });

  describe('simplifyRing', () => {
    it('devuelve el anillo cerrado', () => {
      const ring = simplifyRing(square(0, 0, 10), 0.5)!;
      expect(ring[0]).toEqual(ring.at(-1));
    });

    it('mantiene las cuatro esquinas de un cuadrado', () => {
      expect(simplifyRing(square(0, 0, 10), 0.5)).toHaveLength(5);
    });

    it('devuelve null si el anillo se queda en nada', () => {
      expect(simplifyRing([[0, 0], [1, 0], [0, 0]], 10)).toBeNull();
    });
  });

  describe('pointInRing y pointInPolygon', () => {
    const outer = square(0, 0, 10);
    const hole = square(3, 3, 4);

    it('detecta dentro y fuera', () => {
      expect(pointInRing([5, 5], outer)).toBe(true);
      expect(pointInRing([15, 5], outer)).toBe(false);
    });

    it('un agujero deja de contar como interior', () => {
      expect(pointInPolygon([5, 5], [outer])).toBe(true);
      expect(pointInPolygon([5, 5], [outer, hole])).toBe(false);
      expect(pointInPolygon([1, 1], [outer, hole])).toBe(true);
    });

    it('un polígono vacío no contiene nada', () => {
      expect(pointInPolygon([0, 0], [])).toBe(false);
    });
  });

  describe('dropTinyPolygons', () => {
    it('se queda con las piezas grandes y tira los islotes', () => {
      const multi = [
        [square(0, 0, 100)],
        [square(500, 0, 50)],
        [square(900, 0, 1)],
        [square(950, 0, 0.5)],
      ];
      const kept = dropTinyPolygons(multi);
      expect(kept).toHaveLength(2);
    });

    it('nunca deja el territorio sin ninguna pieza', () => {
      const multi = [[square(0, 0, 1)]];
      expect(dropTinyPolygons(multi, { minAreaRatio: 0.9 })).toHaveLength(1);
    });

    it('respeta el máximo de piezas', () => {
      const multi = Array.from({ length: 30 }, (_, i) => [square(i * 20, 0, 10)]);
      expect(dropTinyPolygons(multi, { maxPieces: 5 })).toHaveLength(5);
    });

    it('devuelve vacío si no hay nada', () => {
      expect(dropTinyPolygons([])).toEqual([]);
    });

    it('deja la pieza mayor la primera', () => {
      const multi = [[square(0, 0, 10)], [square(100, 0, 80)]];
      expect(ringArea(dropTinyPolygons(multi)[0][0])).toBe(6400);
    });
  });

  describe('dropTinyHoles', () => {
    it('quita los agujeros insignificantes', () => {
      const polygon = [square(0, 0, 100), square(10, 10, 30), square(80, 80, 0.5)];
      expect(dropTinyHoles(polygon)).toHaveLength(2);
    });

    it('un polígono sin agujeros se queda igual', () => {
      const polygon = [square(0, 0, 10)];
      expect(dropTinyHoles(polygon)).toEqual(polygon);
    });
  });
});
