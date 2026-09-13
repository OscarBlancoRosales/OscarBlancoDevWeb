import { describe, expect, it } from 'vitest';
import { fichaDeMesa, haceCuanto } from './mesas-vivas';
import type { RoomInfo } from '@devweb/shared/contracts/rooms';

const AHORA = 1_000_000_000_000;

function sala(parcial: Partial<RoomInfo> = {}): RoomInfo {
  return {
    id: 'sala-1',
    game: 'impostor',
    name: 'Aquí miente alguien',
    status: 'lobby',
    config: {},
    seats: [],
    createdAt: AHORA,
    updatedAt: AHORA,
    ...parcial,
  };
}

describe('la ficha de una mesa viva', () => {
  it('dice quién está dentro y que hay gente activa', () => {
    const ficha = fichaDeMesa(
      sala({
        status: 'playing',
        seats: [
          { id: 'a', displayName: 'Ana', isBot: false, connected: true, isOwner: true, order: 0 },
          { id: 'b', displayName: 'Bea', isBot: false, connected: false, isOwner: false, order: 1 },
          { id: 'bot', displayName: 'Doge', isBot: true, connected: true, isOwner: false, order: 2 },
        ],
      }),
      AHORA,
    );
    expect(ficha.nombre).toBe('Aquí miente alguien');
    expect(ficha.estado).toBe('En juego');
    expect(ficha.gente).toContain('Ana');
    expect(ficha.gente).not.toContain('Bea');
    expect(ficha.gente).toContain('1 dentro');
    expect(ficha.gente).toContain('1 bot');
    expect(ficha.actividad).toBe('Hay gente activa');
  });

  it('si no hay nadie, dice cuánto lleva inactiva', () => {
    const ficha = fichaDeMesa(
      sala({
        updatedAt: AHORA - 10 * 60 * 1000,
        seats: [
          { id: 'a', displayName: 'Ana', isBot: false, connected: false, isOwner: true, order: 0 },
        ],
      }),
      AHORA,
    );
    expect(ficha.gente).toContain('Nadie conectado');
    expect(ficha.actividad).toBe('Inactiva hace 10 min');
  });
});

describe('hace cuánto', () => {
  it('habla en minutos, horas y días', () => {
    expect(haceCuanto(AHORA - 20_000, AHORA)).toBe('ahora mismo');
    expect(haceCuanto(AHORA - 3 * 60 * 1000, AHORA)).toBe('hace 3 min');
    expect(haceCuanto(AHORA - 5 * 3600 * 1000, AHORA)).toBe('hace 5 h');
    expect(haceCuanto(AHORA - 3 * 86400 * 1000, AHORA)).toBe('hace 3 días');
  });
});
