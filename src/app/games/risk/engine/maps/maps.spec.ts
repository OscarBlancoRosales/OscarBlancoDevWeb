import { describe, expect, it } from 'vitest';
import { RISK_MAPS, getMap, mapExists } from './map-registry';
import { WORLD_MAP } from './world.map';
import { SPAIN_MAP } from './spain.map';
import { SPAIN_REGIONS_MAP } from './spain-regions.map';
import { isMapConnected } from '../rules';
import { deriveAdjacency, territoryPath, hexNeighbors } from '../geometry';
import { GameMap } from '../types';

/** Adyacencia derivada del dibujo, para contrastarla con la declarada. */
function drawnAdjacency(map: GameMap): Record<string, string[]> {
  const hexes: Record<string, [number, number][]> = {};
  for (const territory of map.territories) hexes[territory.id] = territory.hexes as [number, number][];
  return deriveAdjacency(hexes);
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
  it('tiene nombre, descripción y radio positivo', () => {
    expect(map.name.length).toBeGreaterThan(0);
    expect(map.description.length).toBeGreaterThan(10);
    expect(map.hexRadius).toBeGreaterThan(0);
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

  it('cada territorio tiene al menos una celda dibujada', () => {
    for (const territory of map.territories) {
      expect(territory.hexes.length, territory.name).toBeGreaterThan(0);
    }
  });

  it('las celdas de cada territorio forman una región conexa', () => {
    for (const territory of map.territories) {
      const cells = new Set(territory.hexes.map(([c, r]) => `${c},${r}`));
      const [start] = territory.hexes;
      const seen = new Set([`${start[0]},${start[1]}`]);
      const queue = [start];
      while (queue.length > 0) {
        const [col, row] = queue.shift()!;
        for (const [nc, nr] of hexNeighbors(col, row)) {
          const cellKey = `${nc},${nr}`;
          if (cells.has(cellKey) && !seen.has(cellKey)) {
            seen.add(cellKey);
            queue.push([nc, nr]);
          }
        }
      }
      expect(seen.size, `${territory.name} está partido en varias islas`).toBe(cells.size);
    }
  });

  it('ninguna celda pertenece a dos territorios', () => {
    const owner = new Map<string, string>();
    for (const territory of map.territories) {
      for (const [col, row] of territory.hexes) {
        const cellKey = `${col},${row}`;
        expect(owner.has(cellKey), `celda ${cellKey} duplicada en ${territory.name}`).toBe(false);
        owner.set(cellKey, territory.id);
      }
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
    for (const continent of map.continents) {
      const members = new Set(continent.territoryIds);
      const [start] = continent.territoryIds;
      const seen = new Set([start]);
      const queue = [start];
      const byId = new Map(map.territories.map((t) => [t.id, t]));
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

  it('todo territorio dibujado como vecino lo es también en las reglas (sin fronteras falsas)', () => {
    const drawn = drawnAdjacency(map);
    const byId = new Map(map.territories.map((t) => [t.id, t]));
    for (const [id, neighbours] of Object.entries(drawn)) {
      for (const other of neighbours) {
        expect(
          byId.get(id)?.adjacent,
          `${byId.get(id)?.name} y ${byId.get(other)?.name} se tocan en el dibujo pero no son vecinos`,
        ).toContain(other);
      }
    }
  });

  it('genera un path SVG válido para cada territorio', () => {
    for (const territory of map.territories) {
      const path = territoryPath(territory.hexes, map.hexRadius);
      expect(path.length, territory.name).toBeGreaterThan(10);
      expect(path).not.toContain('NaN');
      expect(path).not.toContain('undefined');
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

  it('reutiliza el dibujo del mapa provincial', () => {
    const provincesByCommunity = new Map(
      SPAIN_MAP.continents.map((continent) => [continent.id, continent.territoryIds]),
    );
    const galicia = SPAIN_REGIONS_MAP.territories.find((t) => t.id === 'galicia')!;
    const provinceCells = provincesByCommunity
      .get('galicia')!
      .flatMap((id) => SPAIN_MAP.territories.find((t) => t.id === id)!.hexes);
    expect(galicia.hexes).toHaveLength(provinceCells.length);
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
