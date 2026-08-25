import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, rngFor, shuffle } from './rng';

describe('RNG determinista', () => {
  describe('hashSeed', () => {
    it('es estable para la misma entrada', () => {
      expect(hashSeed('abc', 1)).toBe(hashSeed('abc', 1));
    });

    it('distingue el orden de las partes', () => {
      expect(hashSeed('a', 'bc')).not.toBe(hashSeed('ab', 'c'));
    });

    it('devuelve siempre un entero sin signo de 32 bits', () => {
      for (const input of ['x', 'y', 'partida-123', '']) {
        const value = hashSeed(input);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffffff);
      }
    });

    it('cambia con cualquier variación de la entrada', () => {
      expect(hashSeed(1)).not.toBe(hashSeed(2));
      expect(hashSeed('ROOM-1')).not.toBe(hashSeed('ROOM-2'));
    });
  });

  describe('createRng', () => {
    it('la misma semilla produce la misma secuencia', () => {
      const a = createRng(1234);
      const b = createRng(1234);
      const seqA = Array.from({ length: 20 }, () => a.next());
      const seqB = Array.from({ length: 20 }, () => b.next());
      expect(seqA).toEqual(seqB);
    });

    it('semillas distintas producen secuencias distintas', () => {
      const a = Array.from({ length: 10 }, ((r) => () => r.next())(createRng(1)));
      const b = Array.from({ length: 10 }, ((r) => () => r.next())(createRng(2)));
      expect(a).not.toEqual(b);
    });

    it('next() siempre está en [0, 1)', () => {
      const rng = createRng(99);
      for (let i = 0; i < 5000; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('int() respeta los límites incluidos', () => {
      const rng = createRng(7);
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i++) {
        const value = rng.int(3, 7);
        expect(value).toBeGreaterThanOrEqual(3);
        expect(value).toBeLessThanOrEqual(7);
        seen.add(value);
      }
      expect(seen).toEqual(new Set([3, 4, 5, 6, 7]));
    });

    it('int() con rango de un solo valor siempre devuelve ese valor', () => {
      const rng = createRng(5);
      for (let i = 0; i < 50; i++) expect(rng.int(4, 4)).toBe(4);
    });

    it('d6() cubre las seis caras con reparto razonable', () => {
      const rng = createRng(2024);
      const counts = new Map<number, number>();
      const rolls = 60000;
      for (let i = 0; i < rolls; i++) {
        const face = rng.d6();
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(6);
        expect(Number.isInteger(face)).toBe(true);
        counts.set(face, (counts.get(face) ?? 0) + 1);
      }
      expect(counts.size).toBe(6);
      for (const [, count] of counts) {
        // Cada cara debería salir en torno al 16,7 % (margen amplio).
        expect(count / rolls).toBeGreaterThan(0.15);
        expect(count / rolls).toBeLessThan(0.185);
      }
    });
  });

  describe('rngFor', () => {
    it('el mismo momento de partida da la misma tirada', () => {
      expect(rngFor(42, 10, 'AK->NT').d6()).toBe(rngFor(42, 10, 'AK->NT').d6());
    });

    it('acciones distintas dan tiradas independientes', () => {
      const a = Array.from({ length: 6 }, ((r) => () => r.d6())(rngFor(42, 10, 'x')));
      const b = Array.from({ length: 6 }, ((r) => () => r.d6())(rngFor(42, 11, 'x')));
      expect(a).not.toEqual(b);
    });

    it('canales distintos dan tiradas independientes', () => {
      const a = Array.from({ length: 6 }, ((r) => () => r.d6())(rngFor(42, 10, 'AK->NT')));
      const b = Array.from({ length: 6 }, ((r) => () => r.d6())(rngFor(42, 10, 'NT->AK')));
      expect(a).not.toEqual(b);
    });
  });

  describe('shuffle', () => {
    it('no muta el array original', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      shuffle(original, createRng(1));
      expect(original).toEqual(copy);
    });

    it('conserva todos los elementos', () => {
      const items = Array.from({ length: 40 }, (_, i) => i);
      const result = shuffle(items, createRng(9));
      expect([...result].sort((a, b) => a - b)).toEqual(items);
    });

    it('es determinista con la misma semilla', () => {
      const items = Array.from({ length: 30 }, (_, i) => i);
      expect(shuffle(items, createRng(3))).toEqual(shuffle(items, createRng(3)));
    });

    it('realmente reordena', () => {
      const items = Array.from({ length: 50 }, (_, i) => i);
      expect(shuffle(items, createRng(4))).not.toEqual(items);
    });

    it('funciona con listas vacías y de un elemento', () => {
      expect(shuffle([], createRng(1))).toEqual([]);
      expect(shuffle(['solo'], createRng(1))).toEqual(['solo']);
    });
  });
});
