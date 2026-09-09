import { describe, expect, it } from 'vitest';
import { barajar, sortear } from './sorteo';
import { OPCIONES_ULTIMA_PALABRA } from '@devweb/shared/games/impostor/tipos';
import { terminosDe } from '@devweb/shared/games/impostor/temas';
import type { Azar } from './sorteo';

const MESA = ['ana', 'bea', 'cris', 'dani'];

/** Un azar que siempre elige el primero: hace el sorteo previsible en el test. */
const primero: Azar = (min) => min;

/** Y otro que va soltando lo que le digan, para colocar el sorteo a mano. */
function guionado(valores: readonly number[]): Azar {
  let i = 0;
  return (min, max) => {
    const dado = valores[i++] ?? min;
    return Math.min(Math.max(dado, min), max - 1);
  };
}

describe('el sorteo de la ronda', () => {
  it('no reparte en una mesa de menos de tres', () => {
    expect(sortear({ jugadores: ['ana', 'bea'], temaId: 'comida', impostoresPedidos: 1 })).toBeNull();
  });

  it('reparte a todos los que se sientan, sin dejarse a nadie', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'comida', impostoresPedidos: 1, azar: primero });
    expect(new Set(reparto?.orden)).toEqual(new Set(MESA));
  });

  it('la palabra y la parecida salen del tema pedido', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'comida', impostoresPedidos: 1, azar: primero });
    const comida = terminosDe('comida');
    expect(comida.some((uno) => uno.a === reparto?.palabra && uno.b === reparto.senuelo)).toBe(true);
  });

  it('un tema que no existe cae en la mezcla en vez de dejar la mesa sin palabra', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'ni-idea', impostoresPedidos: 1, azar: primero });
    expect(reparto?.palabra.length).toBeGreaterThan(0);
  });

  it('en una mesa de cuatro hay un impostor aunque se pidan dos', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'comida', impostoresPedidos: 2, azar: primero });
    expect(reparto?.impostores).toHaveLength(1);
  });

  it('a partir de seis sí se sientan los dos que se piden', () => {
    const seis = [...MESA, 'eva', 'fran'];
    const reparto = sortear({ jugadores: seis, temaId: 'comida', impostoresPedidos: 2, azar: primero });
    expect(reparto?.impostores).toHaveLength(2);
    expect(new Set(reparto?.impostores).size).toBe(2);
  });

  it('los impostores son gente que está en la mesa', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'comida', impostoresPedidos: 1, azar: guionado([2, 1, 0, 3]) });
    for (const uno of reparto?.impostores ?? []) expect(MESA).toContain(uno);
  });

  it('el disparo ofrece seis palabras, con la buena y la parecida entre ellas', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'comida', impostoresPedidos: 1, azar: primero });
    expect(reparto?.opciones).toHaveLength(OPCIONES_ULTIMA_PALABRA);
    expect(reparto?.opciones).toContain(reparto?.palabra);
    expect(reparto?.opciones).toContain(reparto?.senuelo);
    expect(new Set(reparto?.opciones).size).toBe(OPCIONES_ULTIMA_PALABRA);
  });

  /**
   * Si la semilla saliera de la sala, se podría calcular a quién va a votar
   * cada bot antes de que vote. Sale de aquí, y aquí no mira nadie.
   */
  it('trae una semilla propia para el azar de la ronda', () => {
    const reparto = sortear({ jugadores: MESA, temaId: 'comida', impostoresPedidos: 1, azar: guionado([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12345]) });
    expect(reparto?.semilla).toBeGreaterThanOrEqual(0);
  });

  it('dos sorteos seguidos no dan siempre lo mismo', () => {
    const uno = sortear({ jugadores: MESA, temaId: 'mezcla', impostoresPedidos: 1 });
    const otros = Array.from({ length: 12 }, () =>
      sortear({ jugadores: MESA, temaId: 'mezcla', impostoresPedidos: 1 }),
    );
    expect(otros.some((otro) => otro?.palabra !== uno?.palabra)).toBe(true);
  });
});

describe('barajar', () => {
  it('no toca la lista que le dan', () => {
    const original = [1, 2, 3];
    barajar(original, primero);
    expect(original).toEqual([1, 2, 3]);
  });

  it('devuelve los mismos elementos', () => {
    expect(new Set(barajar([1, 2, 3, 4], guionado([2, 0, 1])))).toEqual(new Set([1, 2, 3, 4]));
  });
});
