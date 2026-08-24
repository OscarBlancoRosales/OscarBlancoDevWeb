/**
 * RNG determinista (mulberry32 sobre una semilla derivada).
 *
 * Toda aleatoriedad del motor pasa por aquí y se deriva de
 * (semilla de partida, índice de acción, canal). Así dos clientes que
 * reproducen el mismo log obtienen exactamente los mismos dados.
 */

/** Hash entero de 32 bits estable entre navegadores. */
export function hashSeed(...parts: Array<number | string>): number {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // separador entre partes para que ('a','bc') !== ('ab','c')
    h ^= 0x1f;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  /** Float en [0, 1). */
  next(): number;
  /** Entero en [min, max] ambos incluidos. */
  int(min: number, max: number): number;
  /** Tirada de dado de 6 caras. */
  d6(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    d6: () => 1 + Math.floor(next() * 6),
  };
}

/** RNG para un momento concreto de la partida. */
export function rngFor(seed: number, actionIndex: number, channel: string): Rng {
  return createRng(hashSeed(seed, actionIndex, channel));
}

/** Baraja Fisher-Yates determinista (no muta la entrada). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
