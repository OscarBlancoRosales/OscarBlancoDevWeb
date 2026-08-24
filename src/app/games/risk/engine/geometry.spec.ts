import { describe, expect, it } from 'vitest';
import {
  deriveAdjacency,
  hexCenter,
  hexCorners,
  hexNeighbors,
  hexesBounds,
  hexesCentroid,
  labelPoint,
  outlineRings,
  parseHexArt,
  roundedRingPath,
  territoryPath,
  type Hex,
} from './geometry';

describe('geometría hexagonal', () => {
  describe('hexCenter', () => {
    it('coloca la celda (0,0) en el origen', () => {
      expect(hexCenter(0, 0, 10)).toEqual({ x: 0, y: 0 });
    });

    it('separa las columnas por el ancho del hexágono', () => {
      const a = hexCenter(0, 0, 10);
      const b = hexCenter(1, 0, 10);
      expect(b.x - a.x).toBeCloseTo(Math.sqrt(3) * 10, 6);
      expect(b.y).toBe(a.y);
    });

    it('separa las filas por 1,5 radios', () => {
      expect(hexCenter(0, 2, 10).y).toBeCloseTo(30, 6);
    });

    it('desplaza media celda las filas impares', () => {
      expect(hexCenter(0, 1, 10).x).toBeCloseTo((Math.sqrt(3) * 10) / 2, 6);
    });
  });

  describe('hexCorners', () => {
    it('devuelve seis esquinas', () => {
      expect(hexCorners(0, 0, 10)).toHaveLength(6);
    });

    it('todas las esquinas están a un radio del centro', () => {
      const center = hexCenter(3, 5, 12);
      for (const corner of hexCorners(3, 5, 12)) {
        expect(Math.hypot(corner.x - center.x, corner.y - center.y)).toBeCloseTo(12, 6);
      }
    });

    it('la primera esquina apunta arriba-derecha (hexágono con punta arriba)', () => {
      const [first] = hexCorners(0, 0, 10);
      expect(first.y).toBeLessThan(0);
      expect(first.x).toBeGreaterThan(0);
    });
  });

  describe('hexNeighbors', () => {
    it('siempre devuelve seis vecinos', () => {
      expect(hexNeighbors(4, 4)).toHaveLength(6);
      expect(hexNeighbors(4, 5)).toHaveLength(6);
    });

    it('la vecindad es simétrica', () => {
      for (const [col, row] of [
        [0, 0],
        [3, 4],
        [7, 5],
        [-2, 3],
      ] as Hex[]) {
        for (const [nc, nr] of hexNeighbors(col, row)) {
          const back = hexNeighbors(nc, nr).some(([bc, br]) => bc === col && br === row);
          expect(back, `(${col},${row}) <-> (${nc},${nr})`).toBe(true);
        }
      }
    });

    it('los vecinos están geométricamente a distancia de un diámetro corto', () => {
      const radius = 10;
      const center = hexCenter(5, 5, radius);
      for (const [nc, nr] of hexNeighbors(5, 5)) {
        const other = hexCenter(nc, nr, radius);
        expect(Math.hypot(other.x - center.x, other.y - center.y)).toBeCloseTo(
          Math.sqrt(3) * radius,
          5,
        );
      }
    });
  });

  describe('outlineRings', () => {
    it('un solo hexágono produce un anillo de 6 lados', () => {
      const rings = outlineRings([[0, 0]], 10);
      expect(rings).toHaveLength(1);
      // El recorrido cierra repitiendo el punto inicial.
      expect(rings[0].length).toBeGreaterThanOrEqual(6);
    });

    it('dos hexágonos vecinos comparten arista y forman un solo contorno', () => {
      const rings = outlineRings(
        [
          [0, 0],
          [1, 0],
        ],
        10,
      );
      expect(rings).toHaveLength(1);
      // 12 aristas menos las 2 compartidas = 10 aristas de borde.
      const unique = new Set(rings[0].map((p) => `${p.x.toFixed(3)}:${p.y.toFixed(3)}`));
      expect(unique.size).toBe(10);
    });

    it('dos hexágonos separados producen dos contornos', () => {
      const rings = outlineRings(
        [
          [0, 0],
          [5, 0],
        ],
        10,
      );
      expect(rings).toHaveLength(2);
    });

    it('un anillo con agujero produce contorno exterior e interior', () => {
      // Corona alrededor de (1,1) usando sus seis vecinos.
      const ring = hexNeighbors(1, 1);
      const rings = outlineRings(ring, 10);
      expect(rings.length).toBe(2);
    });

    it('no devuelve nada si no hay celdas', () => {
      expect(outlineRings([], 10)).toEqual([]);
    });
  });

  describe('centroide y punto de etiqueta', () => {
    it('el centroide de una sola celda es su centro', () => {
      expect(hexesCentroid([[2, 2]], 10)).toEqual(hexCenter(2, 2, 10));
    });

    it('el punto de etiqueta cae siempre sobre una celda del territorio', () => {
      // Forma de "L": el centroide queda fuera, el punto de etiqueta no.
      const hexes: Hex[] = [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ];
      const label = labelPoint(hexes, 10);
      const centers = hexes.map(([c, r]) => hexCenter(c, r, 10));
      expect(centers.some((p) => Math.abs(p.x - label.x) < 1e-6 && Math.abs(p.y - label.y) < 1e-6)).toBe(
        true,
      );
    });

    it('devuelve el origen para un conjunto vacío', () => {
      expect(hexesCentroid([], 10)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('paths SVG', () => {
    it('genera un path cerrado', () => {
      const path = territoryPath([[0, 0]], 10);
      expect(path.startsWith('M')).toBe(true);
      expect(path.trim().endsWith('Z')).toBe(true);
    });

    it('sin redondeo usa solo líneas rectas', () => {
      const path = roundedRingPath(hexCorners(0, 0, 10), 0);
      expect(path).toContain('L');
      expect(path).not.toContain('Q');
    });

    it('con redondeo introduce curvas cuadráticas', () => {
      const path = roundedRingPath(hexCorners(0, 0, 10), 3);
      expect(path).toContain('Q');
    });

    it('ignora anillos degenerados', () => {
      expect(roundedRingPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 2)).toBe('');
    });

    it('no produce NaN en ninguna coordenada', () => {
      const path = territoryPath(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        14,
      );
      expect(path).not.toContain('NaN');
    });
  });

  describe('hexesBounds', () => {
    it('cubre todas las esquinas', () => {
      const bounds = hexesBounds([[0, 0]], 10);
      expect(bounds.width).toBeCloseTo(Math.sqrt(3) * 10, 5);
      expect(bounds.height).toBeCloseTo(20, 5);
    });

    it('aplica el margen pedido', () => {
      const plain = hexesBounds([[0, 0]], 10);
      const padded = hexesBounds([[0, 0]], 10, 5);
      expect(padded.width).toBeCloseTo(plain.width + 10, 5);
    });

    it('devuelve una caja vacía sin celdas', () => {
      expect(hexesBounds([], 10).width).toBe(0);
    });
  });

  describe('parseHexArt', () => {
    it('asigna las celdas por fila y columna', () => {
      const parsed = parseHexArt(['AA AA BB', 'AA .  BB']);
      expect(parsed['AA']).toEqual([
        [0, 0],
        [1, 0],
        [0, 1],
      ]);
      expect(parsed['BB']).toEqual([
        [2, 0],
        [2, 1],
      ]);
    });

    it('ignora el mar en todas sus formas', () => {
      const parsed = parseHexArt(['.  .. -- AA']);
      expect(Object.keys(parsed)).toEqual(['AA']);
      expect(parsed['AA']).toEqual([[3, 0]]);
    });

    it('tolera filas vacías', () => {
      const parsed = parseHexArt(['AA', '', 'AA']);
      expect(parsed['AA']).toEqual([
        [0, 0],
        [0, 2],
      ]);
    });
  });

  describe('deriveAdjacency', () => {
    it('detecta vecindad entre territorios que se tocan', () => {
      const adjacency = deriveAdjacency(parseHexArt(['AA BB CC']));
      expect(adjacency['AA']).toEqual(['BB']);
      expect(adjacency['BB']).toEqual(['AA', 'CC']);
      expect(adjacency['CC']).toEqual(['BB']);
    });

    it('no conecta territorios separados por mar', () => {
      const adjacency = deriveAdjacency(parseHexArt(['AA .  BB']));
      expect(adjacency['AA']).toEqual([]);
      expect(adjacency['BB']).toEqual([]);
    });

    it('siempre produce una relación simétrica', () => {
      const adjacency = deriveAdjacency(parseHexArt(['AA BB', 'CC AA', 'BB CC']));
      for (const [id, neighbours] of Object.entries(adjacency)) {
        for (const other of neighbours) {
          expect(adjacency[other]).toContain(id);
        }
      }
    });

    it('nunca marca un territorio como vecino de sí mismo', () => {
      const adjacency = deriveAdjacency(parseHexArt(['AA AA AA', 'AA AA AA']));
      expect(adjacency['AA']).toEqual([]);
    });
  });
});
