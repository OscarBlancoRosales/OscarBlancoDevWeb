import { describe, expect, it } from 'vitest';
import { sitiosEnElOvalo } from './sitios';

describe('los sitios de la mesa', () => {
  it('el primero queda abajo en el centro', () => {
    const sitios = sitiosEnElOvalo(4);
    expect(sitios).toHaveLength(4);
    expect(sitios[0].x).toBeCloseTo(50, 5);
    expect(sitios[0].y).toBeGreaterThan(70);
  });

  it('no se sale del paño', () => {
    for (const sitio of sitiosEnElOvalo(8)) {
      expect(sitio.x).toBeGreaterThan(5);
      expect(sitio.x).toBeLessThan(95);
      expect(sitio.y).toBeGreaterThan(5);
      expect(sitio.y).toBeLessThan(95);
    }
  });

  it('una mesa vacía no sienta a nadie', () => {
    expect(sitiosEnElOvalo(0)).toEqual([]);
  });
});
