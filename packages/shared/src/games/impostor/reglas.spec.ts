import { describe, expect, it } from 'vitest';
import {
  aciertaElDisparo,
  desenlaceDeLaVotacion,
  ganadoresDe,
  hanVotadoTodos,
  impostoresQueCaben,
  marcadorTras,
  masVotado,
  palabraPara,
  recuento,
} from './reglas';
import { frasePara, momentoDe } from './guion';
import { createRng } from '../../engine/rng';
import type { ImpostorState } from './tipos';

const BASE: ImpostorState = {
  fase: 'votacion',
  modo: 'clasico',
  temaId: 'comida',
  palabra: 'Pizza',
  senuelo: 'Empanada',
  orden: ['ana', 'bea', 'cris'],
  impostores: ['bea'],
  listos: ['ana', 'bea', 'cris'],
  vueltas: 1,
  vuelta: 0,
  segundosDebate: 90,
  debateHasta: 0,
  turno: 0,
  pistas: [],
  votos: {},
  expulsado: null,
  opciones: ['Sopa', 'Pizza', 'Café'],
  intento: -1,
  desenlace: null,
  impostoresPedidos: 1,
  semilla: 1,
  marcador: {},
  rondasJugadas: 0,
  jugadas: 0,
  dice: '',
  momento: '',
};

describe('contar los votos', () => {
  it('suma los votos de cada uno', () => {
    expect(recuento({ ana: 'bea', cris: 'bea', bea: 'ana' })).toEqual({ bea: 2, ana: 1 });
  });

  it('el más votado sale cuando lo es él solo', () => {
    expect(masVotado({ ana: 'bea', cris: 'bea', bea: 'ana' })).toBe('bea');
  });

  it('con empate no sale nadie', () => {
    expect(masVotado({ ana: 'bea', bea: 'cris', cris: 'ana' })).toBeNull();
  });

  it('sin votos tampoco sale nadie', () => {
    expect(masVotado({})).toBeNull();
  });

  it('la votación no se cierra hasta que votan todos los que juegan', () => {
    expect(hanVotadoTodos({ ...BASE, votos: { ana: 'bea' } })).toBe(false);
    expect(hanVotadoTodos({ ...BASE, votos: { ana: 'bea', bea: 'ana', cris: 'bea' } })).toBe(true);
  });
});

describe('quién gana', () => {
  it('echar al impostor gana la ronda para la mesa', () => {
    expect(desenlaceDeLaVotacion(BASE, 'bea')).toBe('tripulacion');
  });

  it('echar a un inocente la gana el impostor', () => {
    expect(desenlaceDeLaVotacion(BASE, 'ana')).toBe('impostores');
  });

  it('no echar a nadie también la gana el impostor', () => {
    expect(desenlaceDeLaVotacion(BASE, null)).toBe('impostores');
  });

  it('en la revancha pillarle no cierra nada todavía', () => {
    expect(desenlaceDeLaVotacion({ ...BASE, modo: 'revancha' }, 'bea')).toBeNull();
  });

  it('el punto va a la tripulación entera, impostores aparte', () => {
    expect(ganadoresDe(BASE, 'tripulacion')).toEqual(['ana', 'cris']);
    expect(ganadoresDe(BASE, 'impostores')).toEqual(['bea']);
    expect(ganadoresDe(BASE, null)).toEqual([]);
  });

  it('el marcador se suma sobre lo que ya había', () => {
    const previo = { ...BASE, marcador: { ana: 2 } };
    expect(marcadorTras(previo, 'tripulacion')).toEqual({ ana: 3, cris: 1 });
  });
});

describe('el disparo del impostor', () => {
  it('acierta solo con la palabra buena', () => {
    expect(aciertaElDisparo(BASE, 1)).toBe(true);
    expect(aciertaElDisparo(BASE, 0)).toBe(false);
  });

  it('una opción que no existe no acierta', () => {
    expect(aciertaElDisparo(BASE, 9)).toBe(false);
  });
});

describe('cuántos impostores caben', () => {
  it('en una mesa corta, siempre uno', () => {
    expect(impostoresQueCaben(4, 2)).toBe(1);
    expect(impostoresQueCaben(5, 2)).toBe(1);
  });

  it('a partir de seis se pueden sentar dos, si se piden', () => {
    expect(impostoresQueCaben(6, 2)).toBe(2);
    expect(impostoresQueCaben(8, 1)).toBe(1);
  });
});

describe('a quién le toca qué palabra', () => {
  it('la tripulación recibe la buena en cualquier modo', () => {
    expect(palabraPara('clasico', false, 'Pizza', 'Empanada')).toBe('Pizza');
    expect(palabraPara('infiltrado', false, 'Pizza', 'Empanada')).toBe('Pizza');
  });

  it('el impostor del clásico no recibe ninguna', () => {
    expect(palabraPara('clasico', true, 'Pizza', 'Empanada')).toBeNull();
    expect(palabraPara('revancha', true, 'Pizza', 'Empanada')).toBeNull();
  });

  it('el infiltrado recibe la parecida', () => {
    expect(palabraPara('infiltrado', true, 'Pizza', 'Empanada')).toBe('Empanada');
  });
});

describe('la voz de la sala', () => {
  const rng = createRng(3);

  it('no dice nada si no ha cambiado nada', () => {
    expect(momentoDe(BASE, BASE)).toBeNull();
  });

  it('abre el debate cuando se acaban las pistas', () => {
    expect(momentoDe({ ...BASE, fase: 'pistas' }, { ...BASE, fase: 'debate' })).toBe('aDebate');
  });

  it('y llama a votar cuando se acaba el debate', () => {
    expect(momentoDe({ ...BASE, fase: 'debate' }, BASE)).toBe('aVotar');
  });

  it('distingue el empate de la victoria del impostor', () => {
    const empate: ImpostorState = { ...BASE, fase: 'fin', desenlace: 'impostores' };
    expect(momentoDe(BASE, empate)).toBe('empate');

    const echado: ImpostorState = { ...empate, expulsado: 'ana' };
    expect(momentoDe(BASE, echado)).toBe('ganaImpostor');
  });

  it('la revancha ganada tiene frase propia', () => {
    const acertada: ImpostorState = {
      ...BASE,
      fase: 'fin',
      desenlace: 'impostores',
      expulsado: 'bea',
      intento: 1,
    };
    expect(momentoDe({ ...BASE, fase: 'ultima-palabra' }, acertada)).toBe('ganaConLaPalabra');
  });

  it('rellena los huecos de la frase', () => {
    const frase = frasePara(
      'ganaTripulacion',
      { quien: 'Bea', tema: 'Comida', palabra: 'Pizza' },
      rng,
    );
    expect(frase).toContain('Pizza');
    expect(frase).not.toContain('{');
  });
});
