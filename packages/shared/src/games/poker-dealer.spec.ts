import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng';
import { fraseDelDealer } from './poker-dealer';
import { encargoDelDealer, instruccionesDelDealer } from './poker-prompts';
import { MOMENTOS_DEALER } from './poker-reparto';
import type { ContextoDelDealer } from './poker-prompts';

/**
 * El dealer de la mesa: lo que dice escrito, y lo que se le pide al modelo.
 *
 * El personaje es lo único que hace que una reunión de estimaciones tenga
 * gracia, así que lo que se comprueba aquí es que tiene algo que decir en cada
 * momento, que no se repite y que no se le puede ir de las manos.
 */

const DATOS = {
  quien: 'Bea',
  cuantos: 3,
  media: 5.5,
  voto: 21,
  asunto: 'migrar el login a OAuth',
};

describe('el guion escrito', () => {
  it('tiene frase para todos los momentos', () => {
    for (const momento of MOMENTOS_DEALER) {
      const frase = fraseDelDealer(momento, DATOS, createRng(1));
      expect(frase.length, momento).toBeGreaterThan(15);
    }
  });

  /** Si quedara un hueco sin rellenar, se leería «{quien}» en pantalla. */
  it('no deja ningún hueco sin rellenar', () => {
    for (const momento of MOMENTOS_DEALER) {
      for (let semilla = 0; semilla < 20; semilla++) {
        const frase = fraseDelDealer(momento, DATOS, createRng(semilla));
        expect(frase, `${momento}/${semilla}`).not.toContain('{');
      }
    }
  });

  it('el que se ha desviado sale con su nombre y los dos números', () => {
    const frases = [...Array(20)].map((_uno, i) =>
      fraseDelDealer('elDesviado', DATOS, createRng(i)),
    );
    for (const frase of frases) {
      expect(frase).toContain('Bea');
      expect(frase).toContain('21');
      expect(frase).toContain('5.5');
    }
  });

  it('y la tarea se nombra al repartir', () => {
    expect(fraseDelDealer('reparte', DATOS, createRng(3))).toContain('migrar el login a OAuth');
  });

  /** Sin asunto puesto, la frase no puede quedarse coja. */
  it('sin nombre de tarea sigue teniendo sentido', () => {
    const frase = fraseDelDealer('reparte', { ...DATOS, asunto: '' }, createRng(3));
    expect(frase).toContain('esta tarea');
  });

  it('no dice siempre lo mismo', () => {
    const dichas = new Set(
      [...Array(20)].map((_uno, i) => fraseDelDealer('espabila', DATOS, createRng(i))),
    );
    expect(dichas.size).toBeGreaterThan(1);
  });
});

describe('el personaje que se le pide al modelo', () => {
  const prompt = instruccionesDelDealer();

  it('es de humor manchego, con sus referencias', () => {
    expect(prompt).toContain('manchego');
    expect(prompt).toContain('Raúl Cimas');
  });

  /**
   * Un modelo con «sé ácido» y sin límites acaba diciéndole cosas
   * desagradables a gente real en su puesto de trabajo.
   */
  it('tiene prohibido meterse con nadie por lo que es', () => {
    expect(prompt).toContain('Nunca insultas de verdad');
    expect(prompt).toContain('solo por lo que acaba de votar');
  });

  it('y tiene prohibido inventarse los votos', () => {
    expect(prompt).toContain('Nunca inventas votos');
  });

  it('nada de emojis ni acotaciones', () => {
    expect(prompt).toContain('emojis');
    expect(prompt).toContain('acotaciones');
  });
});

describe('el encargo de cada momento', () => {
  function contexto(parcial: Partial<ContextoDelDealer> = {}): ContextoDelDealer {
    return {
      momento: 'reparte',
      asunto: 'migrar el login a OAuth',
      mesa: [
        { nombre: 'Óscar', voto: '5', haVotado: true },
        { nombre: 'Bea', voto: '21', haVotado: true },
        { nombre: 'Eva', voto: '', haVotado: false },
      ],
      protagonista: 'Bea',
      voto: 21,
      media: 5.5,
      mediana: 5,
      desviacion: 7.2,
      faltan: 1,
      segundos: 90,
      guion: 'Una frase de reserva que ya vale por sí sola.',
      ...parcial,
    };
  }

  it('todos los momentos tienen el suyo', () => {
    for (const momento of MOMENTOS_DEALER) {
      expect(encargoDelDealer(contexto({ momento })).length, momento).toBeGreaterThan(80);
    }
  });

  it('y no se repiten entre sí', () => {
    const tareas = MOMENTOS_DEALER.map(
      (momento) => encargoDelDealer(contexto({ momento })).split('\n\n')[0],
    );
    expect(new Set(tareas).size).toBe(MOMENTOS_DEALER.length);
  });

  it('la mesa entera va dentro, con quién ha votado y qué', () => {
    const encargo = encargoDelDealer(contexto());
    expect(encargo).toContain('Óscar: 5');
    expect(encargo).toContain('Bea: 21');
    expect(encargo).toContain('Eva: todavía no ha votado');
  });

  it('las cifras se dan hechas y se prohíbe cambiarlas', () => {
    const encargo = encargoDelDealer(contexto());
    expect(encargo).toContain('DATOS REALES');
    expect(encargo).toContain('no inventes otros');
  });

  /** El momento estrella: señalar por el nombre y con los dos números. */
  it('para pedir cuentas se le dan el nombre y los dos números', () => {
    const encargo = encargoDelDealer(contexto({ momento: 'elDesviado' }));
    expect(encargo).toContain('Bea');
    expect(encargo).toContain('21');
    expect(encargo).toContain('5.5');
    expect(encargo).toContain('se explique');
  });

  it('y para meter prisa, cuánto se lleva esperando y cuántos faltan', () => {
    const encargo = encargoDelDealer(contexto({ momento: 'espabila' }));
    expect(encargo).toContain('90');
    expect(encargo).toContain('1');
    expect(encargo).toContain('prisa');
  });

  it('al repartir se nombra la tarea', () => {
    expect(encargoDelDealer(contexto({ momento: 'reparte' }))).toContain('migrar el login a OAuth');
  });

  it('siempre se le pide corto, que la mesa quiere votar', () => {
    for (const momento of MOMENTOS_DEALER) {
      expect(encargoDelDealer(contexto({ momento })), momento).toContain('una o dos frases');
    }
  });

  it('una mesa vacía no rompe el encargo', () => {
    expect(encargoDelDealer(contexto({ mesa: [] }))).toContain('La mesa está vacía');
  });
});
