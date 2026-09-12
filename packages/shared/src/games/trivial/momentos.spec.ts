import { describe, expect, it } from 'vitest';
import { comentarioDe, lider } from './momentos';
import { trivialModule } from './index';
import type { Pregunta, TrivialState } from './tipos';
import type { Seat } from '../module';

/**
 * Lo que el presentador decide decir.
 *
 * Antes solo anunciaba la ronda y el acierto: era un rótulo con gracia. Lo que
 * hace que parezca un programa es que se entere de lo que pasa —quién remonta,
 * quién se hunde, a quién le estalla la bomba— y eso se decide aquí.
 */

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
];

function pregunta(tipo: Pregunta['tipo'], id: string): Pregunta {
  return {
    id,
    tipo,
    enunciado: `¿${id}?`,
    opciones: ['no', 'sí', 'quizá', 'nunca'],
    correcta: 1,
    explicacion: 'Porque sí.',
  };
}

function empezada(preguntas: readonly Pregunta[]): TrivialState {
  let state = trivialModule.createState(SEATS, { preguntas, semilla: 3 });
  for (const seat of SEATS) {
    state = trivialModule.apply(state, { tipo: 'empezar' }, seat.id, SEATS);
  }
  return state;
}

function responde(state: TrivialState, seat: string, valor: number): TrivialState {
  return trivialModule.apply(state, { tipo: 'responder', valor }, seat, SEATS);
}

function siguiente(state: TrivialState): TrivialState {
  return trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', SEATS);
}

/** Un estado con el marcador puesto a mano, para no jugar diez rondas. */
function conPuntos(state: TrivialState, puntos: Record<string, number>): TrivialState {
  return { ...state, puntos };
}

const ACIERTO = 1;
const FALLO = 0;
const CUATRO_TEST = [...Array(4)].map((_, i) => pregunta('test', `t${i}`));

describe('cuándo habla el presentador', () => {
  it('da la bienvenida al arrancar', () => {
    const antes = trivialModule.createState(SEATS, { preguntas: CUATRO_TEST, semilla: 3 });
    const ahora = empezada(CUATRO_TEST);
    expect(comentarioDe(antes, ahora)?.momento).toBe('bienvenida');
  });

  /**
   * Al acabar ya no se despide sin más: sube al podio.
   *
   * Es el mismo instante del programa, pero ahora hay ceremonia detrás, y el
   * presentador tiene que nombrar al segundo y al último además del ganador.
   */
  it('sube al podio al acabar', () => {
    let state = empezada([pregunta('test', 't0')]);
    const antes = state;
    state = responde(state, 'ana', ACIERTO);
    state = responde(state, 'bea', ACIERTO);
    state = siguiente(state);
    expect(comentarioDe(antes, state)?.momento).toBe('podio');
  });

  it('y en la despedida dice quién ha ganado', () => {
    let state = empezada([pregunta('test', 't0')]);
    state = responde(state, 'bea', ACIERTO);
    const antes = state;
    state = responde(state, 'ana', FALLO);
    state = siguiente(state);
    expect(comentarioDe(antes, state)?.quien).toBe('bea');
  });

  it('si no ha pasado nada comentable, se calla', () => {
    const state = empezada(CUATRO_TEST);
    expect(comentarioDe(state, state)).toBeNull();
  });
});

describe('lo que comenta de la ronda', () => {
  it('canta el acierto de quien más sumó', () => {
    const antes = empezada(CUATRO_TEST);
    let ahora = responde(antes, 'ana', ACIERTO);
    ahora = responde(ahora, 'bea', FALLO);
    const dicho = comentarioDe(antes, ahora);
    expect(dicho?.momento).toBe('aciertaAlguien');
    expect(dicho?.quien).toBe('ana');
  });

  it('y el silencio cuando no acierta nadie', () => {
    const antes = empezada(CUATRO_TEST);
    let ahora = responde(antes, 'ana', FALLO);
    ahora = responde(ahora, 'bea', FALLO);
    expect(comentarioDe(antes, ahora)?.momento).toBe('nadieAcierta');
  });

  /** Adelantar a alguien es la noticia; sumar de líder ya no sorprende. */
  it('adelantar a alguien se cuenta como remontada, no como acierto', () => {
    const base = empezada(CUATRO_TEST);
    const antes = conPuntos(base, { ana: 0, bea: 100 });
    let ahora = responde(antes, 'ana', ACIERTO);
    ahora = responde(ahora, 'bea', FALLO);
    expect(comentarioDe(antes, ahora)?.momento).toBe('remonta');
  });

  it('sumar sin adelantar a nadie no es remontada', () => {
    const base = empezada(CUATRO_TEST);
    const antes = conPuntos(base, { ana: 500, bea: 0 });
    let ahora = responde(antes, 'ana', ACIERTO);
    ahora = responde(ahora, 'bea', FALLO);
    expect(comentarioDe(antes, ahora)?.momento).toBe('aciertaAlguien');
  });
});

describe('las cortinillas de sección', () => {
  it('avisa al entrar en cada prueba nueva', () => {
    const esperado: [Pregunta['tipo'], string][] = [
      ['pulsa', 'seccionPulsa'],
      ['rafaga', 'seccionRafaga'],
      ['bomba', 'seccionBomba'],
      ['estimacion', 'seccionEstimacion'],
      ['fallo', 'seccionFallo'],
    ];

    for (const [tipo, momento] of esperado) {
      let state = empezada([pregunta('test', 't0'), pregunta(tipo, 'x1')]);
      const antes = { ...state };
      state = responde(state, 'ana', ACIERTO);
      state = responde(state, 'bea', ACIERTO);
      state = siguiente(state);
      expect(comentarioDe({ ...antes, fase: 'resultado' }, state)?.momento, tipo).toBe(momento);
    }
  });

  /** Dos preguntas seguidas del mismo tipo son la misma sección. */
  it('no repite la cortinilla dentro de la misma sección', () => {
    let state = empezada([pregunta('test', 't0'), pregunta('test', 't1'), pregunta('test', 't2')]);
    const antes = { ...state, fase: 'resultado' as const };
    state = responde(state, 'ana', ACIERTO);
    state = responde(state, 'bea', ACIERTO);
    state = siguiente(state);
    expect(comentarioDe(antes, state)?.momento).not.toBe('seccionTest');
  });
});

describe('lo que comenta del marcador', () => {
  /** A mitad de programa toca repaso: es lo que hace cualquier presentador. */
  it('a mitad de programa repasa el marcador', () => {
    let state = empezada(CUATRO_TEST);
    state = conPuntos(state, { ana: 400, bea: 0 });
    const antes = { ...state, fase: 'resultado' as const };
    state = { ...state, actual: 2, fase: 'ronda' };
    const dicho = comentarioDe(antes, state);
    expect(dicho?.momento).toBe('lider');
    expect(dicho?.quien).toBe('ana');
  });

  it('y si van pegados, lo dice en vez de nombrar líder', () => {
    let state = empezada(CUATRO_TEST);
    state = conPuntos(state, { ana: 100, bea: 90 });
    const antes = { ...state, fase: 'resultado' as const };
    state = { ...state, actual: 2, fase: 'ronda' };
    expect(comentarioDe(antes, state)?.momento).toBe('pegados');
  });

  it('se mete con quien va muy descolgado', () => {
    let state = empezada([...CUATRO_TEST, ...CUATRO_TEST]);
    state = conPuntos(state, { ana: 600, bea: 0 });
    const antes = { ...state, fase: 'resultado' as const };
    state = { ...state, actual: 1, fase: 'ronda' };
    const dicho = comentarioDe(antes, state);
    expect(dicho?.momento).toBe('seHunde');
    expect(dicho?.quien).toBe('bea');
  });

  it('avisa de la última ronda', () => {
    let state = empezada(CUATRO_TEST);
    const antes = { ...state, fase: 'resultado' as const };
    state = { ...state, actual: 3, fase: 'ronda' };
    expect(comentarioDe(antes, state)?.momento).toBe('ultimaRonda');
  });
});

describe('lo que comenta de la bomba', () => {
  const CON_BOMBA = [pregunta('test', 't0'), pregunta('bomba', 'b1'), pregunta('bomba', 'b2')];

  /** Lleva la partida hasta tener la bomba en la mano de Ana. */
  function conLaBombaEnAna(): TrivialState {
    let state = empezada(CON_BOMBA);
    state = responde(state, 'ana', ACIERTO);
    state = responde(state, 'bea', ACIERTO);
    return siguiente(state);
  }

  it('celebra que se pase a tiempo', () => {
    const antes = conLaBombaEnAna();
    const ahora = responde(antes, 'ana', ACIERTO);
    const dicho = comentarioDe(antes, ahora);
    expect(dicho?.momento).toBe('pasaLaBomba');
    expect(dicho?.quien).toBe('ana');
  });

  it('se regodea cuando se falla y no se suelta', () => {
    // Fallar ya no la estalla: te la deja en la mano, que es peor.
    const antes = conLaBombaEnAna();
    const ahora = responde(antes, 'ana', FALLO);
    const dicho = comentarioDe(antes, ahora);

    expect(dicho?.momento).toBe('seLaQueda');
    expect(dicho?.quien).toBe('ana');
  });

  it('y canta la explosión con nombre y apellidos', () => {
    // La bomba estalla porque se acaba la mecha, no porque se falle. Por eso
    // la ronda se cierra sin que quien la tenía haya llegado a contestar.
    const antes = conLaBombaEnAna();
    const ahora = trivialModule.apply(antes, { tipo: 'estalla' }, 'ana', SEATS);
    const dicho = comentarioDe(antes, ahora);

    expect(dicho?.momento).toBe('explota');
    expect(dicho?.quien).toBe('ana');
  });
});

describe('quién va ganando', () => {
  it('sin partida no hay líder', () => {
    const state = trivialModule.createState(SEATS, { preguntas: CUATRO_TEST, semilla: 3 });
    expect(lider(state)).toEqual([null, 0]);
  });

  it('con marcador, el de más puntos', () => {
    const state = conPuntos(empezada(CUATRO_TEST), { ana: 10, bea: 90 });
    expect(lider(state)).toEqual(['bea', 90]);
  });
});
