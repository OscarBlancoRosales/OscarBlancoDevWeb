import { describe, expect, it } from 'vitest';
import {
  applyTransform,
  boundsOfAll,
  boundsOfMulti,
  fitTransform,
  insetFeatures,
  mapMultiPolygon,
  multiPolygonToPath,
  projectEquirectangular,
  roundMulti,
  transformMulti,
  unionBounds,
} from './project';
import { MultiPolygon, Point2, Ring, boundsOfPoints } from './geometry2d';

function square(x: number, y: number, size: number): Ring {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];
}

describe('proyección al tablero', () => {
  describe('projectEquirectangular', () => {
    it('invierte la latitud (en pantalla la Y crece hacia abajo)', () => {
      const project = projectEquirectangular(40);
      const norte = project([0, 43]);
      const sur = project([0, 36]);
      expect(norte[1]).toBeLessThan(sur[1]);
    });

    it('encoge la longitud según el paralelo, para no estirar el mapa', () => {
      const project = projectEquirectangular(60);
      const [x] = project([10, 60]);
      expect(x).toBeCloseTo(10 * Math.cos((60 * Math.PI) / 180), 6);
    });

    it('en el ecuador no encoge nada', () => {
      expect(projectEquirectangular(0)([10, 0])[0]).toBeCloseTo(10, 6);
    });
  });

  describe('fitTransform', () => {
    const source = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const target = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    it('escala hasta tocar el lado más ajustado', () => {
      expect(fitTransform(source, target).scale).toBe(10);
    });

    it('no deforma: la misma escala en las dos direcciones', () => {
      const transform = fitTransform(source, target);
      const a = applyTransform([0, 0], transform);
      const b = applyTransform([100, 50], transform);
      expect((b[0] - a[0]) / 100).toBeCloseTo((b[1] - a[1]) / 50, 6);
    });

    it('centra lo que sobra', () => {
      const transform = fitTransform(source, target);
      const top = applyTransform([0, 0], transform)[1];
      const bottom = applyTransform([0, 50], transform)[1];
      expect(top).toBeCloseTo(1000 - bottom, 6);
    });

    it('el resultado cabe dentro del destino', () => {
      const transform = fitTransform(source, target);
      const corners: Point2[] = [
        [source.minX, source.minY],
        [source.maxX, source.maxY],
      ].map((point) => applyTransform(point as Point2, transform));
      for (const [x, y] of corners) {
        expect(x).toBeGreaterThanOrEqual(target.minX - 1e-9);
        expect(x).toBeLessThanOrEqual(target.maxX + 1e-9);
        expect(y).toBeGreaterThanOrEqual(target.minY - 1e-9);
        expect(y).toBeLessThanOrEqual(target.maxY + 1e-9);
      }
    });

    it('con una caja degenerada devuelve la identidad', () => {
      const transform = fitTransform({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, target);
      expect(transform).toEqual({ scale: 1, dx: 0, dy: 0 });
    });
  });

  describe('transformaciones sobre polígonos', () => {
    const multi: MultiPolygon = [[square(0, 0, 10)]];

    it('mapMultiPolygon respeta la estructura', () => {
      const doubled = mapMultiPolygon(multi, ([x, y]) => [x * 2, y * 2]);
      expect(doubled).toHaveLength(1);
      expect(doubled[0]).toHaveLength(1);
      expect(doubled[0][0]).toHaveLength(5);
      expect(doubled[0][0][2]).toEqual([20, 20]);
    });

    it('boundsOfMulti mide todo el conjunto', () => {
      expect(boundsOfMulti(multi)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    });

    it('boundsOfAll junta varios territorios', () => {
      expect(boundsOfAll({ a: multi, b: [[square(100, 100, 10)]] })).toEqual({
        minX: 0,
        minY: 0,
        maxX: 110,
        maxY: 110,
      });
    });

    it('unionBounds junta cajas', () => {
      expect(
        unionBounds({ minX: 0, minY: 0, maxX: 5, maxY: 5 }, { minX: -3, minY: 2, maxX: 4, maxY: 9 }),
      ).toEqual({ minX: -3, minY: 0, maxX: 5, maxY: 9 });
    });

    it('transformMulti aplica escala y desplazamiento', () => {
      const moved = transformMulti(multi, { scale: 2, dx: 5, dy: -1 });
      expect(moved[0][0][0]).toEqual([5, -1]);
    });

    it('roundMulti recorta decimales', () => {
      const rounded = roundMulti([[[[1.234, 5.678]]]] as MultiPolygon, 1);
      expect(rounded[0][0][0]).toEqual([1.2, 5.7]);
    });
  });

  describe('insetFeatures', () => {
    const features: Record<string, MultiPolygon> = {
      peninsula: [[square(0, 0, 100)]],
      islaLejana: [[square(900, 900, 40)]],
    };

    it('lleva el grupo indicado al recuadro', () => {
      const result = insetFeatures(features, ['islaLejana'], {
        minX: 0,
        minY: 200,
        maxX: 50,
        maxY: 250,
      });
      const bounds = boundsOfMulti(result['islaLejana']);
      expect(bounds.minX).toBeGreaterThanOrEqual(-1e-9);
      expect(bounds.maxX).toBeLessThanOrEqual(50 + 1e-9);
      expect(bounds.minY).toBeGreaterThanOrEqual(200 - 1e-9);
      expect(bounds.maxY).toBeLessThanOrEqual(250 + 1e-9);
    });

    it('no toca a los demás', () => {
      const result = insetFeatures(features, ['islaLejana'], {
        minX: 0,
        minY: 200,
        maxX: 50,
        maxY: 250,
      });
      expect(result['peninsula']).toEqual(features['peninsula']);
    });

    it('si el grupo no existe, devuelve todo igual', () => {
      expect(insetFeatures(features, ['fantasma'], { minX: 0, minY: 0, maxX: 1, maxY: 1 })).toBe(
        features,
      );
    });
  });

  describe('multiPolygonToPath', () => {
    it('abre con M y cierra con Z cada anillo', () => {
      const path = multiPolygonToPath([[square(0, 0, 10)]]);
      expect(path.startsWith('M')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
      expect((path.match(/M/g) ?? []).length).toBe(1);
    });

    it('dibuja un trozo por anillo, agujeros incluidos', () => {
      const path = multiPolygonToPath([[square(0, 0, 100), square(30, 30, 20)]]);
      expect((path.match(/M/g) ?? []).length).toBe(2);
      expect((path.match(/Z/g) ?? []).length).toBe(2);
    });

    it('no repite el punto de cierre', () => {
      const path = multiPolygonToPath([[square(0, 0, 10)]]);
      expect((path.match(/L/g) ?? []).length).toBe(3);
    });

    it('descarta anillos degenerados', () => {
      expect(multiPolygonToPath([[[[0, 0], [1, 1]]]] as MultiPolygon)).toBe('');
    });

    it('redondea las coordenadas', () => {
      const path = multiPolygonToPath([[[[1.23456, 2.34567], [3, 4], [5, 6], [1.23456, 2.34567]]]], 1);
      expect(path).toContain('1.2 2.3');
      expect(path).not.toContain('1.23456');
    });
  });
});
