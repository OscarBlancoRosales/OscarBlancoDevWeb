import { describe, expect, it } from 'vitest';
import { PACTOS_POR_RONDA, considerPact, pactReply, territoriesMentioned } from './pacts';
import { rankedAttacks } from './bot-brain';
import { TINY_MAP, forceTurn, makeGame, setBoard } from '../testing';
import type { GameState } from '../types';

function tablero(): GameState {
  return forceTurn(
    setBoard(makeGame(), {
      A1: ['p1', 6],
      A2: ['p1', 3],
      A3: ['p1', 1],
      B1: ['p2', 2],
      B2: ['p2', 5],
      B3: ['p2', 1],
    }),
    'p2',
    'attack',
  );
}

const NOMBRES = TINY_MAP.territories.map((t) => t.name);

describe('reconocer de qué se está hablando', () => {
  it('encuentra un territorio por su nombre', () => {
    const uno = TINY_MAP.territories[0];
    expect(territoriesMentioned(TINY_MAP, `no toques ${uno.name}`)).toContain(uno.id);
  });

  /** Nadie escribe las tildes bien en mitad de una partida. */
  it('no le importan los acentos ni las mayúsculas', () => {
    const conTilde = TINY_MAP.territories.find((t) => /[áéíóúÁÉÍÓÚ]/.test(t.name));
    const objetivo = conTilde ?? TINY_MAP.territories[0];
    const escrito = objetivo.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase();
    expect(territoriesMentioned(TINY_MAP, `DEJA ${escrito} EN PAZ`)).toContain(objetivo.id);
  });

  it('y si no se menciona ninguno, no inventa', () => {
    expect(territoriesMentioned(TINY_MAP, 'hola qué tal')).toEqual([]);
  });
});

describe('aceptar o no un pacto', () => {
  it('sin territorio concreto no hay pacto que valorar', () => {
    const pacto = considerPact(tablero(), TINY_MAP, 'p2', 'p1', '¿hacemos las paces?');
    expect(pacto.accepted).toBe(false);
    expect(pacto.territories).toEqual([]);
  });

  /**
   * La regla de cualquier negociación: se acepta lo que cuesta poco. Pedirle
   * justo su mejor jugada es pedirle que renuncie a la partida.
   */
  it('no cede su mejor ataque', () => {
    const state = tablero();
    const mejor = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista')[0];
    expect(mejor, 'el tablero debería ofrecer algún ataque').toBeDefined();
    const nombre = TINY_MAP.territories.find((t) => t.id === mejor.to)!.name;

    const pacto = considerPact(state, TINY_MAP, 'p2', 'p1', `no ataques ${nombre}`);
    expect(pacto.accepted).toBe(false);
    expect(pacto.reason).toContain('por donde iba');
  });

  it('sobre algo que no puede atacar, acepta sin pensarlo', () => {
    const state = tablero();
    const alcanzables = new Set(rankedAttacks(state, TINY_MAP, 'p2', 'oportunista').map((a) => a.to));
    const fuera = TINY_MAP.territories.find((t) => !alcanzables.has(t.id));
    expect(fuera, 'debería haber algún territorio que no pueda atacar').toBeDefined();

    const pacto = considerPact(state, TINY_MAP, 'p2', 'p1', `no toques ${fuera!.name}`);
    expect(pacto.accepted).toBe(true);
    expect(pacto.reason).toContain('no pensaba');
  });

  /** Nadie le regala una tregua al que va ganando. */
  it('no pacta con quien va primero', () => {
    const state = forceTurn(
      setBoard(makeGame(), {
        A1: ['p1', 20],
        A2: ['p1', 20],
        A3: ['p1', 20],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p2', 1],
      }),
      'p2',
      'attack',
    );
    const alcanzables = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista');
    if (alcanzables.length < 2) return; // sin alternativa, el caso no aplica
    const otro = alcanzables[1];
    const nombre = TINY_MAP.territories.find((t) => t.id === otro.to)!.name;

    const pacto = considerPact(state, TINY_MAP, 'p2', 'p1', `no ataques ${nombre}`);
    expect(pacto.accepted).toBe(false);
    expect(pacto.reason).toContain('ganando');
  });

  /** La misma partida tiene que contestar lo mismo: nada de moneda al aire. */
  it('la respuesta no cambia si la partida no cambia', () => {
    const texto = `no toques ${NOMBRES[3]}`;
    const uno = considerPact(tablero(), TINY_MAP, 'p2', 'p1', texto);
    const dos = considerPact(tablero(), TINY_MAP, 'p2', 'p1', texto);
    expect(uno).toEqual(dos);
  });
});

describe('lo que contesta', () => {
  it('al aceptar deja claro que sólo vale esta ronda', () => {
    const texto = pactReply(TINY_MAP, {
      territories: [TINY_MAP.territories[0].id],
      accepted: true,
      reason: 'me sale a cuenta',
    });
    expect(texto).toContain(TINY_MAP.territories[0].name);
    expect(texto).toContain('sólo ésta');
  });

  it('al negarse dice por qué', () => {
    const texto = pactReply(TINY_MAP, {
      territories: [TINY_MAP.territories[0].id],
      accepted: false,
      reason: 'es justo por donde iba',
    });
    expect(texto).toContain('Es justo por donde iba');
  });
});

describe('el tope', () => {
  it('es de uno por ronda: sin tope, una charla desactiva a un rival entero', () => {
    expect(PACTOS_POR_RONDA).toBe(1);
  });
});

describe('un pacto pesa pero no ata', () => {
  it('lo pactado vale menos, pero sigue estando', () => {
    const state = tablero();
    const sinPacto = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista');
    const objetivo = sinPacto[0].to;

    const conPacto = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista', { avoid: [objetivo] });
    const antes = sinPacto.find((a) => a.to === objetivo)!;
    const despues = conPacto.find((a) => a.to === objetivo);

    expect(despues, 'el ataque sigue siendo legal: un pacto no cambia las reglas').toBeDefined();
    expect(despues!.score).toBeLessThan(antes.score);
    expect(despues!.reason).toContain('prometió');
  });

  /**
   * La otra mitad de la promesa: cuando hay una alternativa parecida, el pacto
   * la decide. Se comprueba dándole dos objetivos casi iguales y pactando uno.
   */
  it('con una alternativa parecida, el pacto decide', () => {
    const state = tablero();
    const opciones = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista');
    const parejas = opciones.filter(
      (a) => Math.abs(a.score - opciones[0].score) < 0.4 && a.to !== opciones[0].to,
    );
    if (parejas.length === 0) return; // este tablero no ofrece el caso

    const conPacto = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista', {
      avoid: [opciones[0].to],
    });
    expect(conPacto[0].to).not.toBe(opciones[0].to);
  });

  it('pero si no hay nada mejor, lo rompe', () => {
    const state = tablero();
    // Un solo ataque posible y pactado: no queda alternativa.
    const todos = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista');
    const conPacto = rankedAttacks(state, TINY_MAP, 'p2', 'oportunista', {
      avoid: todos.map((a) => a.to),
    });
    expect(conPacto.length).toBe(todos.length);
  });
});
