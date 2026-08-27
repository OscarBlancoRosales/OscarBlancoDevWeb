import { describe, expect, it } from 'vitest';
import {
  adjacencyByContact,
  arcPoints,
  buildTopology,
  groupRingsIntoPolygons,
  mergeAdjacency,
  mergeFeatures,
  rebuildAll,
  rebuildFeature,
  simplifyTopology,
} from './topology';
import { MultiPolygon, Point2, Ring, pointInPolygon, ringArea } from './geometry2d';

/** Rectángulo cerrado (x1,y1)-(x2,y2). */
function box(x1: number, y1: number, x2: number, y2: number): Ring {
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
    [x1, y1],
  ];
}

/** Dos cuadrados pegados por el lado x=10, como dos provincias vecinas. */
function twoNeighbours(): Record<string, MultiPolygon> {
  return {
    izquierda: [[box(0, 0, 10, 10)]],
    derecha: [[box(10, 0, 20, 10)]],
  };
}

/** Frontera con muchos vértices para poder simplificarla. */
function detailedBorder(): Record<string, MultiPolygon> {
  const border: Point2[] = [];
  for (let i = 0; i <= 100; i++) {
    border.push([10 + (i % 2 === 0 ? 0 : 0.01), i / 10]);
  }
  const left: Ring = [[0, 0], ...border, [0, 10], [0, 0]];
  const right: Ring = [[20, 0], [10, 0], ...border.slice(1), [20, 10], [20, 0]];
  return { izquierda: [[left]], derecha: [[right.slice().reverse()]] };
}

describe('topología compartida', () => {
  describe('buildTopology', () => {
    it('detecta como vecinos a los que comparten frontera', () => {
      const topology = buildTopology(twoNeighbours());
      expect(topology.adjacency['izquierda']).toEqual(['derecha']);
      expect(topology.adjacency['derecha']).toEqual(['izquierda']);
    });

    it('no inventa vecindades entre piezas separadas', () => {
      const topology = buildTopology({
        uno: [[box(0, 0, 10, 10)]],
        otro: [[box(50, 50, 60, 60)]],
      });
      expect(topology.adjacency['uno']).toEqual([]);
      expect(topology.adjacency['otro']).toEqual([]);
    });

    it('la adyacencia es simétrica', () => {
      const topology = buildTopology({
        a: [[box(0, 0, 10, 10)]],
        b: [[box(10, 0, 20, 10)]],
        c: [[box(20, 0, 30, 10)]],
      });
      for (const [id, neighbours] of Object.entries(topology.adjacency)) {
        for (const other of neighbours) {
          expect(topology.adjacency[other]).toContain(id);
        }
      }
      expect(topology.adjacency['b'].sort()).toEqual(['a', 'c']);
    });

    it('guarda la frontera compartida como un solo arco', () => {
      const topology = buildTopology(twoNeighbours());
      const referencedByLeft = new Set(topology.features['izquierda'][0][0].map((r) => (r < 0 ? ~r : r)));
      const referencedByRight = new Set(topology.features['derecha'][0][0].map((r) => (r < 0 ? ~r : r)));
      const shared = [...referencedByLeft].filter((index) => referencedByRight.has(index));
      expect(shared).toHaveLength(1);
    });

    it('el arco compartido se recorre en sentidos opuestos', () => {
      const topology = buildTopology(twoNeighbours());
      const left = topology.features['izquierda'][0][0];
      const right = topology.features['derecha'][0][0];
      const sharedLeft = left.find((r) => right.some((other) => (other < 0 ? ~other : other) === (r < 0 ? ~r : r)))!;
      const sharedRight = right.find((r) => (r < 0 ? ~r : r) === (sharedLeft < 0 ? ~sharedLeft : sharedLeft))!;
      expect(sharedLeft < 0).not.toBe(sharedRight < 0);
    });

    it('junta vértices casi iguales al cuantizar', () => {
      // La frontera de "b" está desplazada una diezmillonésima de grado (1 cm):
      // ruido de coma flotante del origen, no una frontera distinta.
      const shifted: Ring = [
        [10.0000001, 0],
        [20, 0],
        [20, 10],
        [10.0000001, 10],
        [10.0000001, 0],
      ];
      const topology = buildTopology({
        a: [[box(0, 0, 10, 10)]],
        b: [[shifted]],
      });
      expect(topology.adjacency['a']).toEqual(['b']);
      expect(topology.adjacency['b']).toEqual(['a']);
    });

    it('no junta fronteras que de verdad están separadas', () => {
      const apart: Ring = [
        [10.5, 0],
        [20, 0],
        [20, 10],
        [10.5, 10],
        [10.5, 0],
      ];
      const topology = buildTopology({ a: [[box(0, 0, 10, 10)]], b: [[apart]] });
      expect(topology.adjacency['a']).toEqual([]);
    });

    it('una isla suelta produce un anillo de un único arco', () => {
      const topology = buildTopology({ isla: [[box(0, 0, 5, 5)]] });
      expect(topology.features['isla'][0][0]).toHaveLength(1);
    });

    it('conserva los agujeros', () => {
      const topology = buildTopology({
        rosco: [[box(0, 0, 30, 30), box(10, 10, 20, 20)]],
      });
      expect(topology.features['rosco'][0]).toHaveLength(2);
    });
  });

  describe('rebuildFeature', () => {
    it('reconstruye exactamente lo que entró', () => {
      const input = twoNeighbours();
      const topology = buildTopology(input);
      for (const id of Object.keys(input)) {
        const rebuilt = rebuildFeature(topology, id);
        expect(ringArea(rebuilt[0][0])).toBeCloseTo(100, 6);
      }
    });

    it('los anillos reconstruidos vienen cerrados', () => {
      const topology = buildTopology(twoNeighbours());
      for (const multi of Object.values(rebuildAll(topology))) {
        for (const polygon of multi) {
          for (const ring of polygon) {
            expect(ring[0]).toEqual(ring.at(-1));
          }
        }
      }
    });

    it('un territorio desconocido devuelve vacío', () => {
      expect(rebuildFeature(buildTopology(twoNeighbours()), 'fantasma')).toEqual([]);
    });
  });

  describe('simplifyTopology', () => {
    it('reduce el número de vértices', () => {
      const topology = buildTopology(detailedBorder());
      const before = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
      const after = simplifyTopology(topology, 1).arcs.reduce((sum, arc) => sum + arc.length, 0);
      expect(after).toBeLessThan(before);
    });

    it('los vecinos siguen encajando sin rendijas', () => {
      const simplified = simplifyTopology(buildTopology(detailedBorder()), 1);
      const rebuilt = rebuildAll(simplified);

      // La frontera compartida tiene que ser la misma lista de puntos en ambos.
      const left = new Set(rebuilt['izquierda'][0][0].map((p) => `${p[0]},${p[1]}`));
      const right = rebuilt['derecha'][0][0].map((p) => `${p[0]},${p[1]}`);
      const onBorder = right.filter((key) => Number(key.split(',')[0]) >= 9.9 && Number(key.split(',')[0]) <= 10.1);
      expect(onBorder.length).toBeGreaterThan(0);
      for (const key of onBorder) expect(left.has(key)).toBe(true);
    });

    it('nunca deja un arco con menos de dos puntos', () => {
      const simplified = simplifyTopology(buildTopology(twoNeighbours()), 1000);
      for (const arc of simplified.arcs) expect(arc.length).toBeGreaterThanOrEqual(2);
    });

    it('no toca la adyacencia', () => {
      const topology = buildTopology(detailedBorder());
      expect(simplifyTopology(topology, 5).adjacency).toEqual(topology.adjacency);
    });
  });

  describe('arcPoints', () => {
    it('invierte el arco cuando la referencia es negativa', () => {
      const topology = buildTopology(twoNeighbours());
      const forward = arcPoints(topology, 0);
      const backward = arcPoints(topology, ~0);
      expect(backward).toEqual(forward.slice().reverse());
    });
  });

  describe('adjacencyByContact', () => {
    it('detecta vecinos que se tocan sin compartir vértices', () => {
      // Unión en T: "b" tiene un vértice en mitad de la arista de "a", así que
      // no comparten ninguna arista aunque se toquen de verdad.
      const a: Ring = box(0, 0, 10, 10);
      const b: Ring = [
        [10, 0],
        [20, 0],
        [20, 10],
        [10, 10],
        [10, 5],
        [10, 0],
      ];
      const conAristas = buildTopology({ a: [[a]], b: [[b]] }).adjacency;
      const conContacto = adjacencyByContact({ a: [[a]], b: [[b]] }, 0.5);
      expect(conContacto['a']).toEqual(['b']);
      // Y se ve que hacía falta: por aristas puede no detectarse.
      expect(conContacto['a'].length).toBeGreaterThanOrEqual(conAristas['a'].length);
    });

    it('no une lo que está claramente separado', () => {
      const adjacency = adjacencyByContact(
        { a: [[box(0, 0, 10, 10)]], b: [[box(30, 0, 40, 10)]] },
        0.5,
      );
      expect(adjacency['a']).toEqual([]);
    });

    it('respeta el umbral', () => {
      const features = { a: [[box(0, 0, 10, 10)]], b: [[box(11, 0, 20, 10)]] };
      expect(adjacencyByContact(features, 0.5)['a']).toEqual([]);
      expect(adjacencyByContact(features, 2)['a']).toEqual(['b']);
    });

    it('siempre es simétrica', () => {
      const adjacency = adjacencyByContact(
        { a: [[box(0, 0, 10, 10)]], b: [[box(10, 0, 20, 10)]], c: [[box(20, 0, 30, 10)]] },
        0.5,
      );
      for (const [id, neighbours] of Object.entries(adjacency)) {
        for (const other of neighbours) expect(adjacency[other]).toContain(id);
      }
    });
  });

  describe('mergeAdjacency', () => {
    it('une varias fuentes sin repetir', () => {
      const merged = mergeAdjacency({ a: ['b'], b: ['a'] }, { a: ['c'], c: ['a'] });
      expect(merged['a']).toEqual(['b', 'c']);
      expect(merged['c']).toEqual(['a']);
    });

    it('sin fuentes devuelve un mapa vacío', () => {
      expect(mergeAdjacency()).toEqual({});
    });
  });

  describe('mergeFeatures', () => {
    it('funde dos vecinos en una sola pieza', () => {
      const topology = buildTopology(twoNeighbours());
      const merged = mergeFeatures(topology, ['izquierda', 'derecha']);
      expect(merged).toHaveLength(1);
      expect(ringArea(merged[0][0])).toBeCloseTo(200, 4);
    });

    it('la frontera interior desaparece', () => {
      const topology = buildTopology(twoNeighbours());
      const merged = mergeFeatures(topology, ['izquierda', 'derecha']);
      // El punto central del antiguo borde queda dentro de la pieza fundida.
      expect(pointInPolygon([10, 5], merged[0])).toBe(true);
    });

    it('fundir uno solo lo deja igual', () => {
      const topology = buildTopology(twoNeighbours());
      const merged = mergeFeatures(topology, ['izquierda']);
      expect(ringArea(merged[0][0])).toBeCloseTo(100, 4);
    });

    it('las piezas separadas siguen separadas', () => {
      const topology = buildTopology({
        a: [[box(0, 0, 10, 10)]],
        b: [[box(50, 50, 60, 60)]],
      });
      expect(mergeFeatures(topology, ['a', 'b'])).toHaveLength(2);
    });

    it('funde una fila de tres', () => {
      const topology = buildTopology({
        a: [[box(0, 0, 10, 10)]],
        b: [[box(10, 0, 20, 10)]],
        c: [[box(20, 0, 30, 10)]],
      });
      const merged = mergeFeatures(topology, ['a', 'b', 'c']);
      expect(merged).toHaveLength(1);
      expect(ringArea(merged[0][0])).toBeCloseTo(300, 4);
    });

    it('un grupo desconocido no devuelve nada', () => {
      expect(mergeFeatures(buildTopology(twoNeighbours()), ['fantasma'])).toEqual([]);
    });
  });

  describe('groupRingsIntoPolygons', () => {
    it('el anillo contenido pasa a ser agujero', () => {
      const polygons = groupRingsIntoPolygons([box(0, 0, 100, 100), box(30, 30, 60, 60)]);
      expect(polygons).toHaveLength(1);
      expect(polygons[0]).toHaveLength(2);
    });

    it('los anillos sueltos son polígonos distintos', () => {
      expect(groupRingsIntoPolygons([box(0, 0, 10, 10), box(50, 50, 60, 60)])).toHaveLength(2);
    });

    it('sin anillos no hay polígonos', () => {
      expect(groupRingsIntoPolygons([])).toEqual([]);
    });
  });
});
