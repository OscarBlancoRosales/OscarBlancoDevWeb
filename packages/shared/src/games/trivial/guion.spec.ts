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

/** Que el tipo de momento y la lista no se separen. */
describe('MOMENTOS', () => {
  it('no repite ninguno', () => {
    expect(new Set<Momento>(MOMENTOS).size).toBe(MOMENTOS.length);
  });
});

/**
 * Lo que hace que un guion escrito parezca una IA.
 *
 * No es tener frases: es tener muchas, que peguen con lo que acaba de pasar y
 * que no se repitan. Con tres por momento y elección al azar, en cinco rondas
 * te sale dos veces la misma y la ilusión se cae de golpe.
 */
const MESA = {
  quien: 'Ana',
  puntos: 150,
  ronda: 3,
  rondas: 21,
  segundo: 'Bea',
  ultimo: 'Caco',
  diferencia: 120,
  seccion: 'La bomba',
  esBot: false,
};

describe('la base de mensajes', () => {
  it('tiene de sobra en cada momento, que es de lo que vive esto', () => {
    for (const momento of MOMENTOS) {
      const dichas = new Set(
        Array.from({ length: 60 }, (_, vez) => frasePara(momento, MESA, rngFor(1, 0, 'g'), vez)),
      );
      expect(dichas.size, momento).toBeGreaterThanOrEqual(8);
    }
  });

  it('no repite ninguna hasta haberlas dicho todas', () => {
    // Es la mitad del efecto. Repetir una frase en el mismo programa delata al
    // guion más que cualquier otra cosa.
    const primeras = Array.from({ length: 8 }, (_, vez) =>
      frasePara('aciertaAlguien', MESA, rngFor(4, 0, 'g'), vez),
    );

    expect(new Set(primeras).size).toBe(primeras.length);
  });

  it('se mete con la máquina cuando le toca a la máquina', () => {
    const contraBot = Array.from({ length: 30 }, (_, vez) =>
      frasePara('seHunde', { ...MESA, esBot: true }, rngFor(2, 0, 'g'), vez),
    );
    const contraPersona = Array.from({ length: 30 }, (_, vez) =>
      frasePara('seHunde', { ...MESA, esBot: false }, rngFor(2, 0, 'g'), vez),
    );

    expect(new Set(contraBot)).not.toEqual(new Set(contraPersona));
  });

  it('sabe si la cosa está de paliza o de infarto', () => {
    const paliza = Array.from({ length: 30 }, (_, vez) =>
      frasePara('lider', { ...MESA, diferencia: 600 }, rngFor(2, 0, 'g'), vez),
    );
    const apretado = Array.from({ length: 30 }, (_, vez) =>
      frasePara('lider', { ...MESA, diferencia: 10 }, rngFor(2, 0, 'g'), vez),
    );

    expect(new Set(paliza)).not.toEqual(new Set(apretado));
  });

  it('y si esto acaba de empezar o se está acabando', () => {
    const abriendo = Array.from({ length: 30 }, (_, vez) =>
      frasePara('presentaRonda', { ...MESA, ronda: 1 }, rngFor(2, 0, 'g'), vez),
    );
    const cerrando = Array.from({ length: 30 }, (_, vez) =>
      frasePara('presentaRonda', { ...MESA, ronda: 20 }, rngFor(2, 0, 'g'), vez),
    );

    expect(new Set(abriendo)).not.toEqual(new Set(cerrando));
  });

  it('puede nombrar al segundo y al último, no solo al protagonista', () => {
    const todas = MOMENTOS.flatMap((momento) =>
      Array.from({ length: 20 }, (_, vez) => frasePara(momento, MESA, rngFor(1, 0, 'g'), vez)),
    );

    expect(todas.some((frase) => frase.includes('Bea'))).toBe(true);
    expect(todas.some((frase) => frase.includes('Caco'))).toBe(true);
  });

  it('no deja huecos aunque solo le den lo imprescindible', () => {
    // El presentador puede llamar sin saber quién va segundo: en la bienvenida
    // todavía no hay marcador.
    const pelado = { quien: 'Ana', puntos: 0, ronda: 1, rondas: 21 };

    for (const momento of MOMENTOS) {
      for (let vez = 0; vez < 20; vez += 1) {
        const frase = frasePara(momento, pelado, rngFor(vez, 0, 'g'), vez);
        expect(frase, `${momento}/${vez}`).not.toContain('{');
        expect(frase.length, `${momento}/${vez}`).toBeGreaterThan(10);
      }
    }
  });
});
