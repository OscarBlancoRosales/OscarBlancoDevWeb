import { Terrain, TerritoryState, UnitCounts, UnitKind } from './types';

/**
 * Tropas especializadas del modo avanzado.
 *
 * Dos decisiones marcan todo lo demás:
 *
 * **Un especialista no es una ficha extra, es una ficha ascendida.** `units` es
 * un desglose de `armies`, nunca un ejército aparte. Así ninguna regla que
 * cuente ejércitos (refuerzos, continentes, eliminación, victoria, cartas) tiene
 * que enterarse de que existen las tropas, y una partida clásica no lleva ni un
 * byte de más.
 *
 * **Un especialista no se mueve.** Se construye donde hace falta y se queda. La
 * alternativa —arrastrarlos al reagrupar o al ocupar— obligaría a decidir cuáles
 * viajan en cada movimiento, y eso ni cabe en la interfaz ni aporta nada al
 * juego. A cambio, construir en la retaguardia no sirve de nada, que es
 * exactamente la tensión que se busca.
 *
 * Todo es puro: mismas entradas, mismas salidas, sin azar ni reloj.
 */

export interface UnitMeta {
  id: UnitKind;
  name: string;
  /** Glifo para el tablero y la leyenda. */
  glyph: string;
  /** Reserva que cuesta ascender una ficha de infantería. */
  cost: number;
  /** Qué hace, en una línea. */
  effect: string;
  color: string;
}

export const UNIT_META: Record<UnitKind, UnitMeta> = {
  caballeria: {
    id: 'caballeria',
    name: 'Caballería',
    glyph: '⇉',
    cost: 2,
    effect: 'Reagrupas dos veces por turno. En campo abierto, +1 al segundo dado atacando.',
    color: '#ffd740',
  },
  blindado: {
    id: 'blindado',
    name: 'Blindados',
    glyph: '■',
    cost: 3,
    effect: 'En terreno abierto, +1 al mejor dado atacando y +1 al segundo defendiendo. En montaña o bosque no maniobran.',
    color: '#ff8a65',
  },
  naval: {
    id: 'naval',
    name: 'Flota',
    glyph: '⚓',
    cost: 3,
    effect: 'Cruzar el mar desde aquí deja de ser un desembarco. Defendiendo, +1 al mejor dado contra quien desembarque.',
    color: '#4fc3f7',
  },
  aereo: {
    id: 'aereo',
    name: 'Aviación',
    glyph: '✈',
    cost: 4,
    effect: 'Alcanza a dos pasos. Sobre terreno despejado, +1 al mejor dado; contra otra aviación, la intercepta.',
    color: '#ce93d8',
  },
};

/**
 * Terrenos donde una máquina puede maniobrar.
 *
 * Es la distinción que hace que tropa y terreno se combinen en vez de sumarse
 * por su cuenta: un blindado en una llanura es otra cosa que el mismo blindado
 * metido en un bosque.
 */
export const OPEN_TERRAIN: Terrain[] = ['llanura', 'desierto', 'costa'];

export function isOpen(terrain: Terrain): boolean {
  return OPEN_TERRAIN.includes(terrain);
}

/**
 * Lo que las tropas del ATACANTE aportan, según desde dónde salen y contra qué.
 *
 * Cada línea depende de la pareja de terrenos, que es justo lo que se pedía: la
 * misma tropa vale mucho o no vale nada según el mapa.
 */
export function unitAssault(
  origin: TerritoryState | undefined,
  fromTerrain: Terrain,
  toTerrain: Terrain,
  approach: 'tierra' | 'desembarco' | 'aereo',
): number[] {
  let bonus: number[] = [];

  // Blindados: solo cuentan por tierra y contra terreno donde puedan entrar.
  if (approach === 'tierra' && hasUnit(origin, 'blindado') && isOpen(toTerrain)) {
    bonus = add(bonus, [1]);
  }
  // Caballería: maniobra. Necesita campo abierto a los dos lados.
  if (
    approach === 'tierra' &&
    hasUnit(origin, 'caballeria') &&
    isOpen(fromTerrain) &&
    isOpen(toTerrain)
  ) {
    bonus = add(bonus, [0, 1]);
  }
  // Aviación: ve el objetivo si está despejado. Sobre bosque o montaña, no.
  if (hasUnit(origin, 'aereo') && isOpen(toTerrain)) {
    bonus = add(bonus, [1]);
  }
  return bonus;
}

/** Lo que las tropas del DEFENSOR aportan, según dónde están y cómo les llegan. */
export function unitDefence(
  target: TerritoryState | undefined,
  terrain: Terrain,
  approach: 'tierra' | 'desembarco' | 'aereo',
): number[] {
  let bonus: number[] = [];

  // Blindados atrincherados: en abierto son una barrera; en monte, chatarra.
  if (hasUnit(target, 'blindado') && isOpen(terrain)) {
    bonus = add(bonus, [0, 1]);
  }
  // La flota bate la playa de quien intenta desembarcar.
  if (approach === 'desembarco' && hasUnit(target, 'naval')) {
    bonus = add(bonus, [1]);
  }
  // Caza interceptor: la aviación se defiende de la aviación.
  if (approach === 'aereo' && hasUnit(target, 'aereo')) {
    bonus = add(bonus, [1]);
  }
  return bonus;
}

function add(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return out;
}

export const UNIT_KINDS = Object.keys(UNIT_META) as UnitKind[];

/**
 * Orden en que caen los especialistas cuando ya no queda infantería.
 *
 * Fijo y documentado: si dependiera del azar o del orden de un objeto, dos
 * clientes podrían reconstruir estados distintos del mismo log.
 */
export const CASUALTY_ORDER: UnitKind[] = ['caballeria', 'blindado', 'naval', 'aereo'];

/** Cuántos especialistas hay en total en un territorio. */
export function specialistCount(units: UnitCounts | undefined): number {
  if (!units) return 0;
  let total = 0;
  for (const kind of UNIT_KINDS) total += units[kind] ?? 0;
  return total;
}

/** Fichas de infantería: las que no son de ninguna especialidad. */
export function infantryOf(territory: TerritoryState): number {
  return Math.max(0, territory.armies - specialistCount(territory.units));
}

/** ¿Hay al menos una ficha de esa especialidad? */
export function hasUnit(territory: TerritoryState | undefined, kind: UnitKind): boolean {
  return (territory?.units?.[kind] ?? 0) > 0;
}

/** Cuántas de esa especialidad. */
export function unitCount(territory: TerritoryState | undefined, kind: UnitKind): number {
  return territory?.units?.[kind] ?? 0;
}

/**
 * Quita bajas de un territorio respetando el orden: primero la infantería y,
 * cuando se acaba, los especialistas por `CASUALTY_ORDER`.
 *
 * Muta el territorio, como el resto del reductor, que trabaja sobre una copia.
 */
export function applyCasualties(territory: TerritoryState, losses: number): void {
  territory.armies = Math.max(0, territory.armies - losses);
  trimUnits(territory);
}

/**
 * Recorta especialistas hasta que quepan en `armies`.
 *
 * Se llama después de cualquier cosa que baje el número de fichas (bajas,
 * ocupación, reagrupación). Sin esto un territorio podría acabar con más
 * blindados que ejércitos.
 */
export function trimUnits(territory: TerritoryState): void {
  if (!territory.units) return;
  let excess = specialistCount(territory.units) - territory.armies;
  if (excess <= 0) {
    if (specialistCount(territory.units) === 0) delete territory.units;
    return;
  }
  for (const kind of CASUALTY_ORDER) {
    if (excess <= 0) break;
    const have = territory.units[kind] ?? 0;
    if (have <= 0) continue;
    const removed = Math.min(have, excess);
    const left = have - removed;
    if (left > 0) territory.units[kind] = left;
    else delete territory.units[kind];
    excess -= removed;
  }
  if (specialistCount(territory.units) === 0) delete territory.units;
}

/** Añade un especialista ascendiendo una ficha que ya estaba. */
export function addUnit(territory: TerritoryState, kind: UnitKind): void {
  territory.units = { ...(territory.units ?? {}) };
  territory.units[kind] = (territory.units[kind] ?? 0) + 1;
}

/** Borra todos los especialistas (el territorio ha caído). */
export function clearUnits(territory: TerritoryState): void {
  delete territory.units;
}

/** Cuántas reagrupaciones puede hacer quien tenga esta caballería. */
export function fortifyAllowance(hasCavalry: boolean): number {
  return hasCavalry ? 2 : 1;
}
