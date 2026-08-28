import { describe, expect, it } from 'vitest';
import { MOMENTOS, frasePara } from './guion';
import { rngFor } from '../../engine/rng';
import type { Momento } from './guion';

const DATOS = { quien: 'Ana', puntos: 150, ronda: 3, rondas: 10 };

describe('el guion', () => {
  it('tiene frase para cada momento del concurso', () => {
    for (const momento of MOMENTOS) {
      const frase = frasePara(momento, DATOS, rngFor(1, 0, 'guion'));
      expect(frase.length, momento).toBeGreaterThan(10);
    }
  });

  it('con la misma semilla dice lo mismo', () => {
    expect(frasePara('bienvenida', DATOS, rngFor(5, 0, 'guion'))).toBe(
      frasePara('bienvenida', DATOS, rngFor(5, 0, 'guion')),
    );
  });

  it('no dice siempre lo mismo', () => {
    const dichas = new Set(
      Array.from({ length: 40 }, (_, semilla) =>
        frasePara('aciertaAlguien', DATOS, rngFor(semilla, 0, 'guion')),
      ),
    );
    expect(dichas.size).toBeGreaterThan(1);
  });

  it('nombra a quien gana la ronda', () => {
    const frase = frasePara('aciertaAlguien', DATOS, rngFor(3, 0, 'guion'));
    expect(frase).toContain('Ana');
  });

  it('no deja huecos sin rellenar en ninguna frase', () => {
    for (const momento of MOMENTOS) {
      for (let semilla = 0; semilla < 40; semilla++) {
        const frase = frasePara(momento, DATOS, rngFor(semilla, 0, 'guion'));
        expect(frase, `${momento}/${semilla}`).not.toContain('{');
      }
    }
  });

  it('se acuerda de Oscar mas de una vez por concurso', () => {
    // El personaje es el encargo, no un adorno. Si esto se cae, el juego deja
    // de ser lo que se pidió y pasa a ser un cuestionario con botones.
    const dichas = MOMENTOS.flatMap((momento) =>
      Array.from({ length: 20 }, (_, semilla) =>
        frasePara(momento, DATOS, rngFor(semilla, 0, 'guion')),
      ),
    );
    const conOscar = dichas.filter((frase) => frase.includes('Óscar'));
    expect(conOscar.length / dichas.length).toBeGreaterThan(0.15);
  });

  it('en la despedida siempre se acuerda de Oscar', () => {
    for (let semilla = 0; semilla < 20; semilla++) {
      expect(frasePara('despedida', DATOS, rngFor(semilla, 0, 'guion'))).toContain('Óscar');
    }
  });
});

describe('el prompt para la IA', () => {
  it('lleva el personaje dentro, no solo la frase', async () => {
    const { instruccionesDelPresentador } = await import('./guion');
    const prompt = instruccionesDelPresentador();
    expect(prompt).toContain('Óscar');
    expect(prompt.length).toBeGreaterThan(100);
  });
});

/** Que el tipo de momento y la lista no se separen. */
describe('MOMENTOS', () => {
  it('no repite ninguno', () => {
    expect(new Set<Momento>(MOMENTOS).size).toBe(MOMENTOS.length);
  });
});
