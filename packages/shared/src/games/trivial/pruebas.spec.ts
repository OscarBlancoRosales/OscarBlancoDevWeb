import { describe, expect, it } from 'vitest';
import { trivialModule } from './index';
import {
  CASTIGO_BOMBA,
  CASTIGO_PULSA,
  PUNTOS_BOMBA,
  PUNTOS_PULSA,
  PUNTOS_RAFAGA,
  RACHA_MAXIMA,
} from './reglas';
import { rondaEn } from './tipos';
import type { Pregunta, TrivialState, TrivialView } from './tipos';
import type { Seat } from '../module';

/**
 * Las pruebas del programa que no son «todos contestan a la vez».
 *
 * El concurso era una sola mecánica con tres formas de puntuar, y se notaba:
 * daba igual la sección, siempre pasaba lo mismo. Estas tres tienen reglas
 * propias, y son las que hacen que el programa tenga secciones de verdad.
 */

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
  { id: 'eva', displayName: 'Eva', isBot: false, connected: true, order: 2 },
];

/** Una pregunta de la prueba que se pida, con la buena siempre en la 1. */
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

/** Una partida empezada con esas preguntas y los tres sentados. */
function empezada(preguntas: readonly Pregunta[]): TrivialState {
  let state = trivialModule.createState(SEATS, { preguntas, semilla: 7 });
  for (const seat of SEATS) {
    state = trivialModule.apply(state, { tipo: 'empezar' }, seat.id, SEATS);
  }
  return state;
}

function responde(state: TrivialState, seat: string, valor: number): TrivialState {
  return trivialModule.apply(state, { tipo: 'responder', valor }, seat, SEATS);
}

function siguiente(state: TrivialState, seat = 'ana'): TrivialState {
  return trivialModule.apply(state, { tipo: 'siguiente' }, seat, SEATS);
}

/** Enciende la mecha, que es lo que hace el servidor con su reloj. */
function encender(state: TrivialState, hasta: number): TrivialState {
  return trivialModule.apply(state, { tipo: 'mecha', hasta }, 'ana', SEATS);
}

function vista(state: TrivialState, seat: string): TrivialView {
  return trivialModule.view(state, seat, SEATS) as TrivialView;
}

const ACIERTO = 1;
const FALLO = 0;

describe('el primero que pulse', () => {
  const UNA = [pregunta('pulsa', 'q1')];

  it('quien acierta primero se lo lleva todo', () => {
    const state = responde(empezada(UNA), 'bea', ACIERTO);
    expect(state.puntos['bea']).toBe(PUNTOS_PULSA);
  });

  /** Si el segundo también cobrara, no habría prisa por pulsar. */
  it('la ronda se cierra en cuanto alguien acierta, sin esperar al resto', () => {
    const state = responde(empezada(UNA), 'bea', ACIERTO);
    expect(state.rondas[0].cerrada).toBe(true);
    expect(state.fase).toBe('resultado');
  });

  /** El castigo se cobra al cerrar la ronda, que es cuando se reparte todo. */
  it('lanzarse y fallar cuesta puntos', () => {
    let state = responde(empezada(UNA), 'ana', FALLO);
    state = siguiente(state);
    expect(state.puntos['ana']).toBe(-CASTIGO_PULSA);
  });

  /** Fallar no cierra la ronda: los demás siguen teniendo su oportunidad. */
  it('quien falla deja la ronda viva para los demás', () => {
    let state = responde(empezada(UNA), 'ana', FALLO);
    expect(state.rondas[0].cerrada).toBe(false);

    state = responde(state, 'bea', ACIERTO);
    expect(state.puntos['bea']).toBe(PUNTOS_PULSA);
  });

  it('acertar después del primero no da nada, pero tampoco quita', () => {
    let state = responde(empezada(UNA), 'ana', FALLO);
    state = responde(state, 'bea', ACIERTO);
    expect(state.puntos['ana']).toBe(-CASTIGO_PULSA);
  });
});

describe('la ráfaga de verdadero o falso', () => {
  const TRES = [pregunta('rafaga', 'r1'), pregunta('rafaga', 'r2'), pregunta('rafaga', 'r3')];

  /** Todos contestan y luego se pasa de ronda, como en una ráfaga de verdad. */
  function rafaga(aciertos: readonly boolean[]): TrivialState {
    let state = empezada(TRES);
    for (const acierta of aciertos) {
      for (const seat of SEATS) {
        state = responde(state, seat.id, acierta && seat.id === 'ana' ? ACIERTO : FALLO);
      }
      state = siguiente(state);
    }
    return state;
  }

  it('el primer acierto vale una vez', () => {
    expect(rafaga([true]).puntos['ana']).toBe(PUNTOS_RAFAGA);
  });

  it('encadenar multiplica', () => {
    // Uno más dos: el segundo acierto seguido vale el doble.
    expect(rafaga([true, true]).puntos['ana']).toBe(PUNTOS_RAFAGA * 3);
  });

  it('fallar rompe la racha y hay que empezar de nuevo', () => {
    const state = rafaga([true, true, false]);
    expect(state.racha['ana']).toBe(0);
  });

  it('y el multiplicador tiene tope', () => {
    let state = empezada([...Array(8)].map((_, i) => pregunta('rafaga', `r${i}`)));
    for (let i = 0; i < 8; i++) {
      for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
      state = siguiente(state);
    }
    // Con tope, los tres últimos aciertos valen lo mismo: RACHA_MAXIMA.
    const sinTope = PUNTOS_RAFAGA * ((8 * 9) / 2);
    const conTope = PUNTOS_RAFAGA * (1 + 2 + 3 + 4 + 5 * 4);
    expect(state.puntos['ana']).toBe(conTope);
    expect(state.puntos['ana']).toBeLessThan(sinTope);
    expect(RACHA_MAXIMA).toBe(5);
    expect(state.racha['ana']).toBe(8);
  });

  /** Una racha es de la sección, no de la partida entera. */
  it('la racha no cruza de una sección a otra', () => {
    let state = empezada([pregunta('rafaga', 'r1'), pregunta('test', 't1')]);
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    expect(state.racha).toEqual({});
  });
});

describe('la bomba', () => {
  const CUATRO = [...Array(4)].map((_, i) => pregunta('bomba', `b${i}`));

  /** Entra en la sección de la bomba: hay que pasar de la primera ronda. */
  function conBombaEnMarcha(preguntas: readonly Pregunta[] = CUATRO): TrivialState {
    return empezada([pregunta('test', 't0'), ...preguntas]);
  }

  it('al empezar la sección la bomba es del primero', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);
    expect(state.turno).toBe('ana');
  });

  it('cuánto queda de mecha no sale en la vista de nadie', () => {
    // Es la regla entera de la prueba. Si el número viajara, quien abriera las
    // devtools sabría cuándo soltarla, y entonces esto no es una bomba.
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);
    state = encender(state, 60_000);

    expect(JSON.stringify(vista(state, 'ana'))).not.toContain('60000');
    expect(vista(state, 'ana').cierraEn).toBe(0);
  });

  it('solo contesta quien la tiene', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    const fuera = trivialModule.validate(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
    expect(fuera?.code).toBe('no-es-tu-turno');
    expect(trivialModule.validate(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS)).toBeNull();
  });

  it('acertar es la única forma de soltarla', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    state = responde(state, 'ana', ACIERTO);
    state = siguiente(state);

    expect(state.turno).toBe('bea');
    expect(state.puntos['ana']).toBeGreaterThanOrEqual(PUNTOS_BOMBA);
  });

  it('y fallar te la deja en la mano', () => {
    // Esto es lo que la convierte en una patata caliente. Antes fallar restaba
    // puntos y la pasaba igual, así que salía casi lo mismo contestar bien que
    // mal: te quitabas el problema de encima de las dos maneras.
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);
    state = encender(state, 60_000);

    state = responde(state, 'ana', FALLO);
    state = siguiente(state);

    expect(state.turno).toBe('ana');
  });

  it('fallar no resta: lo que cuesta puntos es que te estalle', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);
    const antes = state.puntos['ana'] ?? 0;

    state = responde(state, 'ana', FALLO);

    expect(state.puntos['ana'] ?? 0).toBe(antes);
  });

  /**
   * Que la bomba avance sola es parte de la prueba, no una comodidad.
   *
   * Tener que darle a «siguiente» entre pase y pase le regala a quien la tiene
   * todo el tiempo del mundo justo cuando la gracia es no tenerlo, y además
   * deja la mecha corriendo en manos de quien más tarde en pulsar.
   */
  it('una vez resuelta, pasa sola en cuanto se acaba el rato', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    const antes = state.actual;
    state = responde(state, 'ana', ACIERTO);
    state = trivialModule.apply(state, { tipo: 'tiempo' }, 'ana', SEATS);

    expect(state.actual).toBe(antes + 1);
    expect(state.turno).toBe('bea');
  });

  it('y ese mismo rato, fuera de la bomba, no adelanta nada', () => {
    // En las demás pruebas se lee la explicación y se sigue cuando la mesa
    // quiera: el reloj solo sirve para cerrar la ronda, no para saltársela.
    let state = conBombaEnMarcha([pregunta('test', 't1')]);
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);

    const cerrada = state.actual;
    state = trivialModule.apply(state, { tipo: 'tiempo' }, 'ana', SEATS);

    expect(state.actual).toBe(cerrada);
  });

  it('la ronda se cierra sin esperar a los demás: los demás miran', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    state = responde(state, 'ana', ACIERTO);
    expect(state.rondas[1].cerrada).toBe(true);
  });

  /**
   * La mecha.
   *
   * Es tiempo, no turnos, y estalla en las manos de quien la tenga en ese
   * momento. Da igual lo que estuviera contestando: importa que se le acabó el
   * tiempo con ella encima. Eso es una bomba; lo de antes era un examen con
   * penalización.
   */
  describe('la mecha', () => {
    /** Con la bomba en marcha y encendida, en manos de Ana. */
    function encendida(): TrivialState {
      let state = conBombaEnMarcha();
      for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
      return encender(siguiente(state), 60_000);
    }

    it('estalla en quien la tenga, conteste o no', () => {
      const state = encendida();
      const antes = state.puntos['ana'] ?? 0;
      const reventada = trivialModule.apply(state, { tipo: 'estalla' }, 'ana', SEATS);

      expect(reventada.puntos['ana']).toBe(antes - CASTIGO_BOMBA);
      expect(rondaEn(reventada, reventada.actual)?.cerrada).toBe(true);
    });

    it('y se apaga al estallar, para que se encienda otra', () => {
      const reventada = trivialModule.apply(encendida(), { tipo: 'estalla' }, 'ana', SEATS);

      expect(reventada.revienta).toBe(0);
    });

    it('tras estallar empieza el siguiente, que bastante ha tenido', () => {
      let state = trivialModule.apply(encendida(), { tipo: 'estalla' }, 'ana', SEATS);
      state = siguiente(state);

      expect(state.turno).toBe('bea');
    });

    it('encenderla otra vez no la alarga', () => {
      // La mecha corre por debajo de las rondas. Si cada pregunta la
      // reiniciara, no se acabaría nunca y no habría bomba.
      const state = encender(encendida(), 999_000);

      expect(state.revienta).toBe(60_000);
    });

    it('no estalla dos veces la misma ronda', () => {
      const una = trivialModule.apply(encendida(), { tipo: 'estalla' }, 'ana', SEATS);
      const otra = trivialModule.apply(una, { tipo: 'estalla' }, 'ana', SEATS);

      expect(otra.puntos['ana']).toBe(una.puntos['ana']);
    });
  });

  it('fuera de la bomba no hay turno de nadie', () => {
    let state = empezada([pregunta('bomba', 'b0'), pregunta('test', 't1')]);
    state = responde(state, 'ana', ACIERTO);
    state = siguiente(state);
    expect(state.turno).toBeNull();
    expect(state.revienta).toBe(0);
  });

  it('cada uno ve si le toca a él', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    expect(vista(state, 'ana').tuTurno).toBe(true);
    expect(vista(state, 'bea').tuTurno).toBe(false);
    expect(vista(state, 'bea').turno).toBe('ana');
  });
});

describe('la voz del presentador', () => {
  const UNA = [pregunta('test', 'q1')];

  it('lo que dice llega igual a toda la mesa', () => {
    const state = trivialModule.apply(
      empezada(UNA),
      { tipo: 'presenta', momento: 'bienvenida', frase: 'Buenas noches, gente.' },
      'ana',
      SEATS,
    );
    for (const seat of SEATS) {
      expect(vista(state, seat.id).dice, seat.id).toBe('Buenas noches, gente.');
    }
  });

  it('y se sabe de qué momento del programa habla', () => {
    const state = trivialModule.apply(
      empezada(UNA),
      { tipo: 'presenta', momento: 'despedida', frase: 'Se acabó.' },
      'ana',
      SEATS,
    );
    expect(vista(state, 'ana').momento).toBe('despedida');
  });

  /** Hablar no puede cambiar el concurso: el presentador presenta, no juega. */
  it('hablar no toca ni el marcador ni la ronda', () => {
    const antes = empezada(UNA);
    const despues = trivialModule.apply(
      antes,
      { tipo: 'presenta', momento: 'bienvenida', frase: 'Hola.' },
      'ana',
      SEATS,
    );
    expect(despues.puntos).toEqual(antes.puntos);
    expect(despues.actual).toBe(antes.actual);
    expect(despues.fase).toBe(antes.fase);
  });
});
