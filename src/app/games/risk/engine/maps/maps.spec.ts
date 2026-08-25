import { describe, expect, it } from 'vitest';
import { RISK_MAPS, getMap, mapExists } from './map-registry';
import { WORLD_MAP } from './world.map';
import { SPAIN_MAP } from './spain.map';
import { SPAIN_REGIONS_MAP } from './spain-regions.map';
import { isMapConnected } from '../rules';
import { adjacencyByContact } from '../geo/topology';
import { contactThresholdFor } from '../geo/contact';
import { MultiPolygon, Point2, pointInPolygon } from '../geo/geometry2d';
import { GameMap } from '../types';

/** Las rutas marítimas declaradas por el mapa, normalizadas. */
function seaRouteKeys(map: GameMap): Set<string> {
  return new Set(
    (map.seaRoutes ?? []).map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)),
  );
}

describe('registro de mapas', () => {
  it('expone varios mapas jugables', () => {
    expect(RISK_MAPS.length).toBeGreaterThanOrEqual(3);
  });

  it('ofrece partidas de duraciones distintas', () => {
    const sizes = RISK_MAPS.map((map) => map.territories.length).sort((a, b) => a - b);
    expect(sizes[sizes.length - 1] / sizes[0]).toBeGreaterThan(1.5);
  });

  it('los identificadores de mapa son únicos', () => {
    const ids = RISK_MAPS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getMap devuelve el mapa pedido', () => {
    expect(getMap('world').id).toBe('world');
    expect(getMap('spain').id).toBe('spain');
  });

  it('getMap falla con un id desconocido', () => {
    expect(() => getMap('atlantis')).toThrow(/Mapa desconocido/);
  });

  it('mapExists distingue mapas reales de inventados', () => {
    expect(mapExists('world')).toBe(true);
    expect(mapExists('atlantis')).toBe(false);
  });
});

describe.each(RISK_MAPS.map((map) => [map.name, map] as const))('mapa: %s', (_name, map) => {
  it('tiene nombre, descripción y lienzo', () => {
    expect(map.name.length).toBeGreaterThan(0);
    expect(map.description.length).toBeGreaterThan(10);
    expect(map.board.width).toBeGreaterThan(0);
    expect(map.board.height).toBeGreaterThan(0);
  });

  it('admite entre 2 y 6 jugadores', () => {
    expect(map.maxPlayers).toBeGreaterThanOrEqual(2);
    expect(map.maxPlayers).toBeLessThanOrEqual(6);
  });

  it('los identificadores de territorio son únicos', () => {
    const ids = map.territories.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los nombres de territorio son únicos y no están vacíos', () => {
    const names = map.territories.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.trim().length).toBeGreaterThan(0);
  });

  it('cada territorio trae silueta y punto de etiqueta dentro del lienzo', () => {
    for (const territory of map.territories) {
      expect(territory.shape.length, territory.name).toBeGreaterThan(10);
      const [x, y] = territory.labelAnchor;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(map.board.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(map.board.height);
    }
  });

  it('las siluetas son paths cerrados y sin valores raros', () => {
    for (const territory of map.territories) {
      const path = territory.shape;
      expect(path.startsWith('M'), territory.name).toBe(true);
      expect(path.endsWith('Z'), territory.name).toBe(true);
      expect(path).not.toContain('NaN');
      expect(path).not.toContain('undefined');
      // Cada trozo dibujado abre con M y cierra con Z.
      expect((path.match(/M/g) ?? []).length).toBe((path.match(/Z/g) ?? []).length);
    }
  });

  it('la adyacencia es simétrica', () => {
    const byId = new Map(map.territories.map((t) => [t.id, t]));
    for (const territory of map.territories) {
      for (const other of territory.adjacent) {
        expect(byId.get(other)?.adjacent, `${territory.id} -> ${other}`).toContain(territory.id);
      }
    }
  });

  it('ningún territorio es vecino de sí mismo', () => {
    for (const territory of map.territories) {
      expect(territory.adjacent).not.toContain(territory.id);
    }
  });

  it('no hay vecinos repetidos', () => {
    for (const territory of map.territories) {
      expect(new Set(territory.adjacent).size).toBe(territory.adjacent.length);
    }
  });

  it('todas las adyacencias apuntan a territorios existentes', () => {
    const ids = new Set(map.territories.map((t) => t.id));
    for (const territory of map.territories) {
      for (const other of territory.adjacent) {
        expect(ids.has(other), `${territory.id} -> ${other}`).toBe(true);
      }
    }
  });

  it('todo territorio tiene al menos un vecino', () => {
    for (const territory of map.territories) {
      expect(territory.adjacent.length, territory.name).toBeGreaterThan(0);
    }
  });

  it('el grafo del mapa es conexo', () => {
    expect(isMapConnected(map)).toBe(true);
  });

  it('cada territorio pertenece a un continente declarado', () => {
    const continentIds = new Set(map.continents.map((c) => c.id));
    for (const territory of map.territories) {
      expect(continentIds.has(territory.continentId), territory.name).toBe(true);
    }
  });

  it('los continentes listan exactamente sus territorios', () => {
    for (const continent of map.continents) {
      const expected = map.territories
        .filter((t) => t.continentId === continent.id)
        .map((t) => t.id)
        .sort();
      expect([...continent.territoryIds].sort()).toEqual(expected);
    }
  });

  it('cada continente tiene bonificación positiva y color hexadecimal', () => {
    for (const continent of map.continents) {
      expect(continent.bonus).toBeGreaterThan(0);
      expect(continent.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('cada continente es internamente conexo', () => {
    const byId = new Map(map.territories.map((t) => [t.id, t]));
    for (const continent of map.continents) {
      const members = new Set(continent.territoryIds);
      const [start] = continent.territoryIds;
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const other of byId.get(current)?.adjacent ?? []) {
          if (members.has(other) && !seen.has(other)) {
            seen.add(other);
            queue.push(other);
          }
        }
      }
      expect(seen.size, `${continent.name} no es conexo`).toBe(members.size);
    }
  });

  it('toda adyacencia es frontera de tierra o ruta marítima declarada', () => {
    const routes = seaRouteKeys(map);
    const land = adjacencyByContact(
      Object.fromEntries(map.territories.map((t) => [t.id, parsePath(t.shape)])),
      contactThresholdFor(map.board.width),
    );
    for (const territory of map.territories) {
      for (const other of territory.adjacent) {
        const key = territory.id < other ? `${territory.id}|${other}` : `${other}|${territory.id}`;
        const touching = land[territory.id]?.includes(other) ?? false;
        expect(
          touching || routes.has(key),
          `${territory.name} y ${map.territories.find((t) => t.id === other)?.name} ni se tocan ni tienen ruta marítima`,
        ).toBe(true);
      }
    }
  });

  it('las rutas marítimas declaradas existen como adyacencia', () => {
    const byId = new Map(map.territories.map((t) => [t.id, t]));
    for (const [a, b] of map.seaRoutes ?? []) {
      expect(byId.get(a)?.adjacent, `${a} -> ${b}`).toContain(b);
      expect(byId.get(b)?.adjacent, `${b} -> ${a}`).toContain(a);
    }
  });

  it('con el máximo de jugadores cada uno recibe al menos 3 territorios', () => {
    expect(Math.floor(map.territories.length / map.maxPlayers)).toBeGreaterThanOrEqual(3);
  });
});

describe('mapa del mundo', () => {
  it('tiene los 42 territorios clásicos', () => {
    expect(WORLD_MAP.territories).toHaveLength(42);
  });

  it('tiene los 6 continentes clásicos con sus bonificaciones', () => {
    const bonuses = Object.fromEntries(WORLD_MAP.continents.map((c) => [c.id, c.bonus]));
    expect(bonuses).toEqual({ na: 5, sa: 2, eu: 5, af: 3, as: 7, oc: 2 });
  });

  it('reparte los territorios como el tablero original', () => {
    const counts = Object.fromEntries(
      WORLD_MAP.continents.map((c) => [c.id, c.territoryIds.length]),
    );
    expect(counts).toEqual({ na: 9, sa: 4, eu: 7, af: 6, as: 12, oc: 4 });
  });

  it('mantiene las conexiones marítimas emblemáticas', () => {
    const byId = new Map(WORLD_MAP.territories.map((t) => [t.id, t]));
    expect(byId.get('AK')!.adjacent).toContain('KC'); // Alaska - Kamchatka
    expect(byId.get('BZ')!.adjacent).toContain('NF'); // Brasil - África del Norte
    expect(byId.get('SM')!.adjacent).toContain('ID'); // Siam - Indonesia
    expect(byId.get('GL')!.adjacent).toContain('IC'); // Groenlandia - Islandia
    expect(byId.get('WE')!.adjacent).toContain('NF'); // Europa Occidental - África del Norte
  });

  it('respeta las adyacencias canónicas más disputadas', () => {
    const byId = new Map(WORLD_MAP.territories.map((t) => [t.id, t]));
    expect([...byId.get('SE')!.adjacent].sort()).toEqual(
      ['EG', 'ME', 'NE', 'NF', 'UK', 'WE'].sort(),
    );
    expect([...byId.get('EE')!.adjacent].sort()).toEqual(['NG', 'WA'].sort());
    expect([...byId.get('JP')!.adjacent].sort()).toEqual(['KC', 'MN'].sort());
    expect([...byId.get('AG')!.adjacent].sort()).toEqual(['BZ', 'PU'].sort());
  });

  it('Oceanía solo es accesible por Siam (cuello de botella clásico)', () => {
    const oceania = new Set(WORLD_MAP.continents.find((c) => c.id === 'oc')!.territoryIds);
    const entrances = WORLD_MAP.territories
      .filter((t) => oceania.has(t.id))
      .flatMap((t) => t.adjacent)
      .filter((id) => !oceania.has(id));
    expect(new Set(entrances)).toEqual(new Set(['SM']));
  });

  it('América del Sur solo conecta con América Central y África del Norte', () => {
    const sa = new Set(WORLD_MAP.continents.find((c) => c.id === 'sa')!.territoryIds);
    const entrances = WORLD_MAP.territories
      .filter((t) => sa.has(t.id))
      .flatMap((t) => t.adjacent)
      .filter((id) => !sa.has(id));
    expect(new Set(entrances)).toEqual(new Set(['CM', 'NF']));
  });
});

describe('mapa de España', () => {
  it('tiene las 52 provincias', () => {
    expect(SPAIN_MAP.territories).toHaveLength(52);
  });

  it('agrupa por comunidad autónoma', () => {
    expect(SPAIN_MAP.continents).toHaveLength(18);
    const andalucia = SPAIN_MAP.continents.find((c) => c.id === 'andalucia')!;
    expect(andalucia.territoryIds).toHaveLength(8);
    const castillaLeon = SPAIN_MAP.continents.find((c) => c.id === 'castilla-leon')!;
    expect(castillaLeon.territoryIds).toHaveLength(9);
  });

  it('respeta fronteras reales conocidas', () => {
    const byId = new Map(SPAIN_MAP.territories.map((t) => [t.id, t]));
    const pairs: Array<[string, string]> = [
      ['MD', 'TO'],
      ['MD', 'GU'],
      ['MD', 'AV'],
      ['MD', 'SG'],
      ['MD', 'CU'],
      ['CD', 'MG'],
      ['SV', 'CO'],
      ['GR', 'AM'],
      ['BR', 'GI'],
      ['ZG', 'HU'],
      ['AC', 'LU'],
      ['AS', 'LE'],
      ['VA', 'PL'],
      ['CC', 'BD'],
      ['VL', 'AT'],
      ['MU', 'AM'],
      ['NA', 'RI'],
      ['BI', 'SS'],
    ];
    for (const [a, b] of pairs) {
      expect(byId.get(a)!.adjacent, `${a} debería lindar con ${b}`).toContain(b);
      expect(byId.get(b)!.adjacent, `${b} debería lindar con ${a}`).toContain(a);
    }
  });

  it('Madrid es una comunidad de una sola provincia', () => {
    const madrid = SPAIN_MAP.continents.find((c) => c.id === 'madrid')!;
    expect(madrid.territoryIds).toEqual(['MD']);
    expect(madrid.bonus).toBe(1);
  });

  it('las islas y las ciudades autónomas están conectadas por mar', () => {
    const byId = new Map(SPAIN_MAP.territories.map((t) => [t.id, t]));
    expect(byId.get('PM')!.adjacent.length).toBeGreaterThan(0);
    expect(byId.get('TF')!.adjacent).toContain('GC');
    expect(byId.get('CE')!.adjacent).toContain('CD');
    expect(byId.get('ML')!.adjacent).toContain('AM');
  });

  it('ninguna provincia queda aislada del resto del mapa', () => {
    expect(isMapConnected(SPAIN_MAP)).toBe(true);
  });
});

describe('mapa de España por comunidades', () => {
  it('tiene las 17 comunidades más Ceuta y Melilla por separado', () => {
    expect(SPAIN_REGIONS_MAP.territories).toHaveLength(19);
    const ids = SPAIN_REGIONS_MAP.territories.map((t) => t.id);
    expect(ids).toContain('ceuta');
    expect(ids).toContain('melilla');
    expect(ids).not.toContain('ceuta-melilla');
  });

  it('agrupa en cinco macrozonas', () => {
    expect(SPAIN_REGIONS_MAP.continents).toHaveLength(5);
  });

  it('comparte lienzo con el mapa provincial', () => {
    expect(SPAIN_REGIONS_MAP.board).toEqual(SPAIN_MAP.board);
  });

  it('cada provincia cae dentro de su comunidad', () => {
    // Es la comprobación de que la fusión de siluetas es coherente con el mapa
    // provincial y no un dibujo distinto: el punto de etiqueta de cada
    // provincia tiene que caer dentro de la silueta de su comunidad.
    const regionOf = new Map<string, string>();
    for (const continent of SPAIN_MAP.continents) {
      for (const id of continent.territoryIds) {
        // Ceuta y Melilla van sueltas en el mapa por comunidades.
        regionOf.set(id, continent.id === 'ceuta-melilla' ? id.toLowerCase() : continent.id);
      }
    }
    const regionShapes = new Map(
      SPAIN_REGIONS_MAP.territories.map((t) => [t.id, parsePath(t.shape)]),
    );
    const nombres: Record<string, string> = { ce: 'ceuta', ml: 'melilla' };

    let comprobadas = 0;
    for (const province of SPAIN_MAP.territories) {
      const regionId = nombres[regionOf.get(province.id)!] ?? regionOf.get(province.id)!;
      const shape = regionShapes.get(regionId);
      expect(shape, `sin silueta para ${regionId}`).toBeDefined();
      const point = province.labelAnchor;
      const inside = shape!.some((polygon) => pointInPolygon(point, polygon));
      expect(inside, `${province.name} debería caer dentro de ${regionId}`).toBe(true);
      comprobadas++;
    }
    expect(comprobadas).toBe(52);
  });

  it('es bastante más corto que el provincial', () => {
    expect(SPAIN_REGIONS_MAP.territories.length).toBeLessThan(SPAIN_MAP.territories.length / 2);
  });

  it('mantiene las fronteras entre comunidades vecinas', () => {
    const byId = new Map(SPAIN_REGIONS_MAP.territories.map((t) => [t.id, t]));
    const pairs: Array<[string, string]> = [
      ['galicia', 'asturias'],
      ['madrid', 'castilla-mancha'],
      ['madrid', 'castilla-leon'],
      ['cataluna', 'aragon'],
      ['andalucia', 'extremadura'],
      ['murcia', 'valenciana'],
      ['pais-vasco', 'navarra'],
      ['rioja', 'aragon'],
    ];
    for (const [a, b] of pairs) {
      expect(byId.get(a)!.adjacent, `${a} debería lindar con ${b}`).toContain(b);
    }
  });

  it('las islas y las ciudades autónomas siguen conectadas', () => {
    const byId = new Map(SPAIN_REGIONS_MAP.territories.map((t) => [t.id, t]));
    expect(byId.get('baleares')!.adjacent).toContain('valenciana');
    expect(byId.get('canarias')!.adjacent).toContain('andalucia');
    expect(byId.get('ceuta')!.adjacent).toContain('melilla');
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
    if (points.length >= 3) {
      rings.push([...points, points[0]]);
    }
  }
  return rings.map((ring) => [ring]);
}
