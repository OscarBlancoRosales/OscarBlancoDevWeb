import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cribarPases, guardarPase, paseDe, pasesGuardados } from './pase-guardado';

describe('los pases de sala', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda y recupera un pase', () => {
    guardarPase({ roomId: 'sala-1', seatId: 'yo', seatToken: 'pase' });
    expect(paseDe('sala-1')).toEqual({ roomId: 'sala-1', seatId: 'yo', seatToken: 'pase' });
  });

  it('no ofrece mesas que el servidor ya no tiene', async () => {
    guardarPase({ roomId: 'viva', seatId: 'a', seatToken: '1' });
    guardarPase({ roomId: 'muerta', seatId: 'b', seatToken: '2' });
    const vive = vi.fn(async (id: string) => id === 'viva');

    const vivos = await cribarPases(pasesGuardados(), vive);

    expect(vivos.map((uno) => uno.roomId)).toEqual(['viva']);
    expect(paseDe('muerta')).toBeNull();
    expect(paseDe('viva')).not.toBeNull();
  });

  it('una sala que responde que no, también se olvida', async () => {
    guardarPase({ roomId: 'acabada', seatId: 'a', seatToken: '1' });
    const vivos = await cribarPases(pasesGuardados(), async () => false);
    expect(vivos).toEqual([]);
    expect(paseDe('acabada')).toBeNull();
  });
});
