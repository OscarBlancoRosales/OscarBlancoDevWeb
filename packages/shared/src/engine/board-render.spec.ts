import { beforeEach, describe, expect, it } from 'vitest';
import { arcBetween, clearRenderCache, renderMap, splitLabel } from './board-render';
import { WORLD_MAP } from './maps/world.map';
import { SPAIN_MAP } from './maps/spain.map';
import { TINY_MAP } from './testing';
import { adjacencyByContact } from './geo/topology';
import { contactThresholdFor } from './geo/contact';
import type { MultiPolygon, Point2 } from './geo/geometry2d';

describe('preparación del dibujo del tablero', () => {
  beforeEach(() => { clearRenderCache(); });

  describe('renderMap', () => {
    it('devuelve un territorio dibujado por cada territorio del mapa', () => {
      const rendered = renderMap(WORLD_MAP);
      expect(rendered.territories).toHaveLength(WORLD_MAP.territories.length);
      expect(Object.keys(rendered.byId)).toHaveLength(WORLD_MAP.territories.length);
    });

    it('cada territorio tiene contorno y etiqueta', () => {
      for (const territory of renderMap(SPAIN_MAP).territories) {
        expect(territory.path.length).toBeGreaterThan(10);
        expect(Number.isFinite(territory.label.x)).toBe(true);
        expect(Number.isFinite(territory.label.y)).toBe(true);
        expect(territory.nameLines.length).toBeGreaterThan(0);
      }
    });

    it('hereda el color del continente', () => {
      const rendered = renderMap(WORLD_MAP);
      const alaska = rendered.byId['AK'];
      const northAmerica = WORLD_MAP.continents.find((c) => c.id === 'na')!;
      expect(alaska.continentColor).toBe(northAmerica.color);
    });

    it('el viewBox cubre todo el mapa', () => {
      const rendered = renderMap(WORLD_MAP);
      const [, , width, height] = rendered.viewBox.split(' ').map(Number);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(width).toBe(rendered.width);
      expect(height).toBe(rendered.height);
    });

    it('cachea el resultado por mapa', () => {
      expect(renderMap(WORLD_MAP)).toBe(renderMap(WORLD_MAP));
    });

    it('clearRenderCache fuerza a recalcular', () => {
      const first = renderMap(WORLD_MAP);
      clearRenderCache();
      expect(renderMap(WORLD_MAP)).not.toBe(first);
    });
  });

  describe('rutas marítimas', () => {
    const routeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    it('dibuja exactamente las conexiones que el mapa declara por mar', () => {
      const rendered = renderMap(WORLD_MAP);
      const declared = new Set((WORLD_MAP.seaRoutes ?? []).map(([a, b]) => routeKey(a, b)));
      const drawn = new Set(rendered.routes.map((route) => routeKey(route.from, route.to)));
      expect(drawn).toEqual(declared);
    });

    it('ninguna ruta une dos territorios que ya se tocan en el dibujo', () => {
      // Si un salto por mar se dibujara entre dos siluetas pegadas, la línea de
      // puntos sobraría y despistaría.
      const shapes = Object.fromEntries(
        WORLD_MAP.territories.map((t) => [t.id, parsePath(t.shape)]),
      );
      const touching = adjacencyByContact(shapes, contactThresholdFor(WORLD_MAP.board.width));
      for (const [a, b] of WORLD_MAP.seaRoutes ?? []) {
        expect(touching[a], `${a} y ${b} ya se tocan: sobra la ruta`).not.toContain(b);
      }
    });

    it('toda adyacencia del tablero se ve: o pegada o con línea de puntos', () => {
      const shapes = Object.fromEntries(
        WORLD_MAP.territories.map((t) => [t.id, parsePath(t.shape)]),
      );
      const touching = adjacencyByContact(shapes, contactThresholdFor(WORLD_MAP.board.width));
      const declared = new Set((WORLD_MAP.seaRoutes ?? []).map(([a, b]) => routeKey(a, b)));
      for (const territory of WORLD_MAP.territories) {
        for (const other of territory.adjacent) {
          const visible =
            (touching[territory.id]?.includes(other) ?? false) ||
            declared.has(routeKey(territory.id, other));
          expect(visible, `${territory.name} -> ${other} no se ve por ningún lado`).toBe(true);
        }
      }
    });

    it('incluye el puente Alaska - Kamchatka', () => {
      const rendered = renderMap(WORLD_MAP);
      const found = rendered.routes.some(
        (route) =>
          (route.from === 'AK' && route.to === 'KC') || (route.from === 'KC' && route.to === 'AK'),
      );
      expect(found).toBe(true);
    });

    it('no repite rutas', () => {
      const rendered = renderMap(SPAIN_MAP);
      const keys = rendered.routes.map((r) => (r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`));
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('en España une las islas y las ciudades autónomas', () => {
      const drawn = new Set(
        renderMap(SPAIN_MAP).routes.map((r) => (r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`)),
      );
      expect(drawn.has('PM|VL')).toBe(true);
      expect(drawn.has('CD|GC')).toBe(true);
      expect(drawn.has('CE|ML')).toBe(true);
    });

    it('cada ruta es un path válido', () => {
      for (const route of renderMap(SPAIN_MAP).routes) {
        expect(route.path.startsWith('M ')).toBe(true);
        expect(route.path).toContain('Q');
        expect(route.path).not.toContain('NaN');
      }
    });
  });

  describe('arcBetween', () => {
    it('empieza y acaba en los puntos dados', () => {
      const path = arcBetween({ x: 0, y: 0 }, { x: 100, y: 0 });
      expect(path.startsWith('M 0 0')).toBe(true);
      expect(path.endsWith('100 0')).toBe(true);
    });

    it('curva hacia un lado', () => {
      const path = arcBetween({ x: 0, y: 0 }, { x: 100, y: 0 });
      const control = path.split('Q')[1].trim().split(' ');
      expect(Number(control[1])).not.toBe(0);
    });

    it('no falla con dos puntos iguales', () => {
      expect(arcBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).not.toContain('NaN');
    });
  });

  describe('splitLabel', () => {
    it('deja los nombres cortos en una línea', () => {
      expect(splitLabel('Egipto')).toEqual(['Egipto']);
      expect(splitLabel('Japón')).toEqual(['Japón']);
    });

    it('parte los nombres largos en dos', () => {
      expect(splitLabel('Territorio del Noroeste')).toHaveLength(2);
    });

    it('equilibra las dos líneas', () => {
      const [first, second] = splitLabel('Australia Occidental');
      expect(first).toBe('Australia');
      expect(second).toBe('Occidental');
    });

    it('no parte una palabra larga sin espacios', () => {
      expect(splitLabel('Constantinopolitano')).toEqual(['Constantinopolitano']);
    });

    it('conserva el nombre completo al unir las líneas', () => {
      for (const territory of SPAIN_MAP.territories) {
        expect(splitLabel(territory.name).join(' ')).toBe(territory.name);
      }
    });
  });

  describe('mapas pequeños', () => {
    it('funciona también con el mapa de laboratorio', () => {
      const rendered = renderMap(TINY_MAP);
      expect(rendered.territories).toHaveLength(6);
      expect(rendered.mapId).toBe('tiny');
    });
  });
});


/** Convierte un `path` de solo M/L/Z en polígonos, para poder medirlos. */
function parsePath(path: string): MultiPolygon {
  const rings: Point2[][] = [];
  for (const chunk of path.split('M').slice(1)) {
    const points = chunk
      .replace(/Z/g, '')
      .split('L')
      .map((pair) => pair.trim().split(/\s+/).map(Number) as Point2)
      .filter((point) => point.length === 2 && point.every(Number.isFinite));
    if (points.length >= 3) rings.push([...points, points[0]]);
  }
  return rings.map((ring) => [ring]);
}
