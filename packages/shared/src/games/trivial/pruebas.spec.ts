import { describe, expect, it } from 'vitest';
import { mechaInicial, trivialModule } from './index';
import {
  CASTIGO_BOMBA,
  CASTIGO_PULSA,
  PUNTOS_BOMBA,
  PUNTOS_PULSA,
  PUNTOS_RAFAGA,
  RACHA_MAXIMA,
} from './reglas';
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

  it('la mecha da para más de una vuelta, para que no se sepa a quién le toca', () => {
    expect(mechaInicial(SEATS.length)).toBeGreaterThan(SEATS.length);
  });

  it('solo contesta quien la tiene', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    const fuera = trivialModule.validate(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
    expect(fuera?.code).toBe('no-es-tu-turno');
    expect(trivialModule.validate(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS)).toBeNull();
  });

  it('acertar la pasa al siguiente y gasta mecha', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);
    const mecha = state.mecha;

    state = responde(state, 'ana', ACIERTO);
    state = siguiente(state);

    expect(state.turno).toBe('bea');
    expect(state.mecha).toBe(mecha - 1);
    expect(state.puntos['ana']).toBeGreaterThanOrEqual(PUNTOS_BOMBA);
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

  it('fallar te la estalla en la mano', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    const antes = state.puntos['ana'] ?? 0;
    state = siguiente(state);

    state = responde(state, 'ana', FALLO);
    expect(state.puntos['ana']).toBe(antes - CASTIGO_BOMBA);
    expect(state.mecha).toBe(0);
  });

  /** Que estalle una vez no acaba la sección: se enciende otra. */
  it('tras estallar se enciende una mecha nueva', () => {
    let state = conBombaEnMarcha();
    for (const seat of SEATS) state = responde(state, seat.id, ACIERTO);
    state = siguiente(state);

    state = responde(state, 'ana', FALLO);
    state = siguiente(state);
    expect(state.mecha).toBe(mechaInicial(SEATS.length));
  });

  it('fuera de la bomba no hay turno de nadie', () => {
    let state = empezada([pregunta('bomba', 'b0'), pregunta('test', 't1')]);
    state = responde(state, 'ana', ACIERTO);
    state = siguiente(state);
    expect(state.turno).toBeNull();
    expect(state.mecha).toBe(0);
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
