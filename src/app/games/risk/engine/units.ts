import { TerritoryState, UnitCounts, UnitKind } from './types';

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
    effect: 'Te deja reagrupar dos veces en el turno.',
    color: '#ffd740',
  },
  blindado: {
    id: 'blindado',
    name: 'Blindados',
    glyph: '■',
    cost: 3,
    effect: 'Atacando por tierra desde aquí, +1 al mejor dado.',
    color: '#ff8a65',
  },
  naval: {
    id: 'naval',
    name: 'Flota',
    glyph: '⚓',
    cost: 3,
    effect: 'Cruzar el mar desde aquí deja de ser un desembarco.',
    color: '#4fc3f7',
  },
  aereo: {
    id: 'aereo',
    name: 'Aviación',
    glyph: '✈',
    cost: 4,
    effect: 'Alcanza territorios a dos pasos, saltándose la frontera.',
    color: '#ce93d8',
  },
};

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
