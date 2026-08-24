import { beforeEach, describe, expect, it } from 'vitest';
import { arcBetween, clearRenderCache, renderMap, splitLabel } from './board-render';
import { WORLD_MAP } from './maps/world.map';
import { SPAIN_MAP } from './maps/spain.map';
import { TINY_MAP } from './testing';
import { deriveAdjacency } from './geometry';

describe('preparación del dibujo del tablero', () => {
  beforeEach(() => clearRenderCache());

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
        expect(territory.size).toBeGreaterThan(0);
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
    it('solo dibuja ruta para las adyacencias que no se tocan', () => {
      const rendered = renderMap(WORLD_MAP);
      const hexes: Record<string, [number, number][]> = {};
      for (const t of WORLD_MAP.territories) hexes[t.id] = t.hexes as [number, number][];
      const touching = deriveAdjacency(hexes);

      for (const route of rendered.routes) {
        expect(touching[route.from]).not.toContain(route.to);
      }
    });

    it('cubre todas las adyacencias que no se tocan', () => {
      const rendered = renderMap(WORLD_MAP);
      const hexes: Record<string, [number, number][]> = {};
      for (const t of WORLD_MAP.territories) hexes[t.id] = t.hexes as [number, number][];
      const touching = deriveAdjacency(hexes);

      const expected = new Set<string>();
      for (const territory of WORLD_MAP.territories) {
        for (const other of territory.adjacent) {
          if (touching[territory.id]?.includes(other)) continue;
          const key = territory.id < other ? `${territory.id}|${other}` : `${other}|${territory.id}`;
          expected.add(key);
        }
      }
      const drawn = new Set(
        rendered.routes.map((r) => (r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`)),
      );
      expect(drawn).toEqual(expected);
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
