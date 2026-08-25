import { GameMap, TerritoryId } from './types';

/** Punto en coordenadas de pantalla. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Precálculo del dibujo de un mapa.
 *
 * Todo lo que no depende de la partida (contornos, etiquetas, rutas marítimas)
 * se calcula una sola vez por mapa y se cachea: el componente solo pinta.
 */

export interface RenderedTerritory {
  id: TerritoryId;
  name: string;
  /** Nombre partido en una o dos líneas para que quepa en el territorio. */
  nameLines: string[];
  continentId: string;
  continentColor: string;
  path: string;
  label: Point;
}

export interface RenderedRoute {
  from: TerritoryId;
  to: TerritoryId;
  /** Curva suave entre los dos territorios (path SVG). */
  path: string;
}

export interface RenderedMap {
  mapId: string;
  territories: RenderedTerritory[];
  byId: Record<TerritoryId, RenderedTerritory>;
  /** Conexiones que el dibujo no muestra: puentes marítimos. */
  routes: RenderedRoute[];
  viewBox: string;
  width: number;
  height: number;
}

const cache = new Map<string, RenderedMap>();

/** Contorno, etiqueta y rutas de un mapa (memoizado por identificador). */
export function renderMap(map: GameMap): RenderedMap {
  const cached = cache.get(map.id);
  if (cached) return cached;

  const territories: RenderedTerritory[] = map.territories.map((territory) => {
    const continent = map.continents.find((c) => c.id === territory.continentId);
    return {
      id: territory.id,
      name: territory.name,
      nameLines: splitLabel(territory.name),
      continentId: territory.continentId,
      continentColor: continent?.color ?? '#666666',
      path: territory.shape,
      label: { x: territory.labelAnchor[0], y: territory.labelAnchor[1] },
    };
  });

  const byId: Record<TerritoryId, RenderedTerritory> = {};
  for (const territory of territories) byId[territory.id] = territory;

  // Rutas marítimas: las conexiones que el mapa declara como saltos por mar,
  // es decir, las que sobre el dibujo no llegan a tocarse.
  const routes: RenderedRoute[] = [];
  const seen = new Set<string>();
  for (const territory of map.territories) {
    for (const other of territory.adjacent) {
      const key = territory.id < other ? `${territory.id}|${other}` : `${other}|${territory.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isSeaRoute(map, territory.id, other)) continue;
      const a = byId[territory.id]?.label;
      const b = byId[other]?.label;
      if (!a || !b) continue;
      routes.push({ from: territory.id, to: other, path: arcBetween(a, b) });
    }
  }

  const bounds = { minX: 0, minY: 0, width: map.board.width, height: map.board.height };
  const rendered: RenderedMap = {
    mapId: map.id,
    territories,
    byId,
    routes,
    viewBox: `${round(bounds.minX)} ${round(bounds.minY)} ${round(bounds.width)} ${round(bounds.height)}`,
    width: round(bounds.width),
    height: round(bounds.height),
  };
  cache.set(map.id, rendered);
  return rendered;
}

/**
 * Una adyacencia es ruta marítima si el mapa la declara como tal. El dato lo
 * trae el propio mapa, que es quien sabe qué conexiones son fronteras de tierra
 * y cuáles son un salto por mar.
 */
function isSeaRoute(map: GameMap, from: string, to: string): boolean {
  return (map.seaRoutes ?? []).some(
    ([a, b]) => (a === from && b === to) || (a === to && b === from),
  );
}

/**
 * Parte un nombre largo en dos líneas equilibradas.
 * Los nombres de territorio son más anchos que los territorios pequeños, y a una
 * sola línea se pisan unos a otros.
 */
export function splitLabel(name: string, maxSingleLine = 11): string[] {
  if (name.length <= maxSingleLine) return [name];
  const words = name.split(' ');
  if (words.length === 1) return [name];

  // Buscamos el corte que deje las dos líneas lo más parecidas posible.
  let bestIndex = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(' ').length;
    const second = words.slice(i).join(' ').length;
    const diff = Math.abs(first - second);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')];
}

/** Arco suave entre dos puntos: las rutas marítimas se ven mejor curvadas. */
export function arcBetween(a: Point, b: Point): string {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  // Perpendicular normalizada, con curvatura proporcional a la distancia.
  const curve = Math.min(70, distance * 0.16);
  const controlX = midX + (-dy / distance) * curve;
  const controlY = midY + (dx / distance) * curve;
  return `M ${round(a.x)} ${round(a.y)} Q ${round(controlX)} ${round(controlY)} ${round(b.x)} ${round(b.y)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Solo para tests: vacía la caché de mapas dibujados. */
export function clearRenderCache(): void {
  cache.clear();
}
