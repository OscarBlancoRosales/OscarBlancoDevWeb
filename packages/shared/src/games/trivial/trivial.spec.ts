import { describe, expect, it } from 'vitest';
import { trivialModule } from './index';
import { BONUS_POR_ORDEN, PUNTOS_ACIERTO } from './reglas';
import type { Pregunta, TrivialState, TrivialView } from './tipos';
import type { Seat } from '../module';

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
];

const PREGUNTAS: Pregunta[] = [
  {
    id: 'p1',
    tipo: 'test',
    enunciado: '¿Qué devuelve typeof null?',
    opciones: ['"null"', '"object"', '"undefined"', 'lanza'],
    correcta: 1,
    explicacion: 'Un error de la primera implementación, ya imposible de arreglar.',
  },
  {
    id: 'p2',
    tipo: 'estimacion',
    enunciado: '¿De qué año es git?',
    opciones: [],
    correcta: 2005,
    margen: 20,
    explicacion: 'Abril de 2005.',
  },
];

function nueva(preguntas: readonly Pregunta[] = PREGUNTAS): TrivialState {
  return trivialModule.createState(SEATS, { preguntas, semilla: 7 });
}

/** Una partida ya empezada, con los dos jugadores sentados y la ronda abierta. */
function enRonda(): TrivialState {
  const inicial = nueva();
  const conAna = trivialModule.apply(inicial, { tipo: 'empezar' }, 'ana', SEATS);
  return trivialModule.apply(conAna, { tipo: 'empezar' }, 'bea', SEATS);
}

/** Las dos rondas jugadas de principio a fin, contestando siempre lo mismo. */
function partidaEntera(): TrivialState {
  let state = enRonda();
  for (const _pregunta of PREGUNTAS) {
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
    state = trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', SEATS);
  }
  return state;
}

function vistaDe(state: TrivialState, seat: string): TrivialView {
  return trivialModule.view(state, seat, SEATS) as TrivialView;
}

describe('empezar', () => {
  it('nace en la presentacion, sin rondas jugadas', () => {
    const state = nueva();
    expect(state.fase).toBe('presentacion');
    expect(state.actual).toBe(0);
  });

  it('se sienta a la mesa quien dice que empieza', () => {
    const state = trivialModule.apply(nueva(), { tipo: 'empezar' }, 'ana', SEATS);
    expect(state.orden).toEqual(['ana']);
  });

  it('la primera ronda se abre cuando estan todos', () => {
    expect(enRonda().fase).toBe('ronda');
  });

  it('no se responde antes de empezar', () => {
    expect(
      trivialModule.validate(nueva(), { tipo: 'responder', valor: 1 }, 'ana', SEATS)?.code,
    ).toBe('aun-no-hay-pregunta');
  });

  it('sin preguntas la partida no arranca', () => {
    const vacia = trivialModule.createState(SEATS, { preguntas: [] });
    expect(trivialModule.validate(vacia, { tipo: 'empezar' }, 'ana', SEATS)?.code).toBe(
      'sin-preguntas',
    );
  });
});

describe('responder', () => {
  it('no se responde dos veces', () => {
    const state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    expect(
      trivialModule.validate(state, { tipo: 'responder', valor: 2 }, 'ana', SEATS)?.code,
    ).toBe('ya-respondida');
  });

  it('no se responde con una opcion que no existe', () => {
    expect(
      trivialModule.validate(enRonda(), { tipo: 'responder', valor: 9 }, 'ana', SEATS)?.code,
    ).toBe('opcion-inexistente');
  });

  it('en una estimacion vale cualquier numero', () => {
    let state = enRonda();
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
    state = trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', SEATS);

    expect(trivialModule.validate(state, { tipo: 'responder', valor: 1998 }, 'ana', SEATS)).toBeNull();
  });

  it('quien no esta en la mesa no responde', () => {
    expect(
      trivialModule.validate(enRonda(), { tipo: 'responder', valor: 1 }, 'cris', SEATS)?.code,
    ).toBe('no-juegas');
  });

  it('la ronda se cierra sola cuando han contestado todos', () => {
    let state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    expect(state.rondas[0]?.cerrada).toBe(false);

    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'bea', SEATS);
    expect(state.rondas[0]?.cerrada).toBe(true);
    expect(state.fase).toBe('resultado');
  });

  it('al cerrarse reparte los puntos, y solo una vez', () => {
    let state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'bea', SEATS);

    expect(state.puntos['ana']).toBe(PUNTOS_ACIERTO + BONUS_POR_ORDEN[0]);
    expect(state.puntos['bea']).toBe(0);

    const tras = trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', SEATS);
    expect(tras.puntos['ana']).toBe(PUNTOS_ACIERTO + BONUS_POR_ORDEN[0]);
  });

  it('no se responde a una ronda cerrada', () => {
    let state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'bea', SEATS);

    expect(
      trivialModule.validate(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS)?.code,
    ).toBe('ronda-cerrada');
  });
});

describe('pasar de ronda', () => {
  it('abre la siguiente pregunta', () => {
    let state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'bea', SEATS);
    state = trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', SEATS);

    expect(state.actual).toBe(1);
    expect(state.fase).toBe('ronda');
    expect(state.rondas[1]?.pregunta.id).toBe('p2');
  });

  it('quien no abrio la sala no fuerza una ronda que sigue abierta', () => {
    expect(trivialModule.validate(enRonda(), { tipo: 'siguiente' }, 'bea', SEATS)?.code).toBe(
      'ronda-en-marcha',
    );
  });

  it('quien abrio la sala si puede pasar de quien no contesta', () => {
    const state = trivialModule.apply(enRonda(), { tipo: 'siguiente' }, 'ana', SEATS);
    expect(state.rondas[0]?.cerrada).toBe(true);
  });

  it('tras la ultima ronda la partida termina', () => {
    expect(partidaEntera().fase).toBe('fin');
  });

  it('acabada la partida ya no se pasa de ronda', () => {
    const state = partidaEntera();
    expect(trivialModule.validate(state, { tipo: 'siguiente' }, 'ana', SEATS)?.code).toBe(
      'partida-terminada',
    );
  });
});

describe('lo que ve cada asiento', () => {
  it('la respuesta correcta no sale mientras la ronda esta abierta', () => {
    const vista = vistaDe(enRonda(), 'ana');

    expect(vista.correcta).toBeNull();
    expect(vista.explicacion).toBeNull();
    expect(JSON.stringify(vista)).not.toContain(PREGUNTAS[0]?.explicacion ?? '');
  });

  it('las respuestas ajenas tampoco salen', () => {
    const state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 3 }, 'bea', SEATS);
    const vista = vistaDe(state, 'ana');

    expect(vista.hanRespondido).toEqual(['bea']);
    expect(vista.resultados).toBeNull();
    expect(vista.tuRespuesta).toBeNull();
  });

  it('la tuya si la ves, para saber que se envio', () => {
    const state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 3 }, 'ana', SEATS);
    expect(vistaDe(state, 'ana').tuRespuesta).toBe(3);
  });

  it('al cerrarse sale la correcta, la explicacion y lo que puso cada uno', () => {
    let state = trivialModule.apply(enRonda(), { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'bea', SEATS);
    const vista = vistaDe(state, 'ana');

    expect(vista.correcta).toBe(1);
    expect(vista.explicacion).toBe(PREGUNTAS[0]?.explicacion);
    expect(vista.resultados).toHaveLength(2);
    expect(vista.resultados?.find((r) => r.seatId === 'bea')?.valor).toBe(0);
  });

  it('en la presentacion todavia no hay enunciado que enseñar', () => {
    const vista = vistaDe(nueva(), 'ana');
    expect(vista.fase).toBe('presentacion');
    expect(vista.enunciado).toBe('');
    expect(vista.correcta).toBeNull();
  });

  it('cuenta por que ronda va la partida', () => {
    const vista = vistaDe(enRonda(), 'ana');
    expect(vista.ronda).toBe(1);
    expect(vista.rondas).toBe(PREGUNTAS.length);
  });
});

describe('lo que hace un asiento sin nadie detras', () => {
  const CON_BOT: Seat[] = [
    { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
    { id: 'maquina', displayName: 'Sabelotodo', isBot: true, connected: false, order: 1 },
  ];

  function conBot(): TrivialState {
    return trivialModule.createState(CON_BOT, {
      preguntas: PREGUNTAS,
      semilla: 3,
      nivelBot: 'sabelotodo',
    });
  }

  it('se sienta a la mesa en cuanto empieza el concurso', () => {
    expect(trivialModule.botAction?.(conBot(), 'maquina', CON_BOT)).toEqual({ tipo: 'empezar' });
  });

  it('no se sienta dos veces', () => {
    const sentado = trivialModule.apply(conBot(), { tipo: 'empezar' }, 'maquina', CON_BOT);
    expect(trivialModule.botAction?.(sentado, 'maquina', CON_BOT)).toBeNull();
  });

  it('contesta algo legal cuando hay pregunta', () => {
    let state = trivialModule.apply(conBot(), { tipo: 'empezar' }, 'maquina', CON_BOT);
    state = trivialModule.apply(state, { tipo: 'empezar' }, 'ana', CON_BOT);

    const jugada = trivialModule.botAction?.(state, 'maquina', CON_BOT);
    expect(jugada?.tipo).toBe('responder');
    expect(jugada && trivialModule.validate(state, jugada, 'maquina', CON_BOT)).toBeNull();
  });

  it('no contesta dos veces la misma ronda', () => {
    let state = trivialModule.apply(conBot(), { tipo: 'empezar' }, 'maquina', CON_BOT);
    state = trivialModule.apply(state, { tipo: 'empezar' }, 'ana', CON_BOT);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'maquina', CON_BOT);

    expect(trivialModule.botAction?.(state, 'maquina', CON_BOT)).toBeNull();
  });

  it('nunca pasa de ronda por su cuenta', () => {
    let state = trivialModule.apply(conBot(), { tipo: 'empezar' }, 'maquina', CON_BOT);
    state = trivialModule.apply(state, { tipo: 'empezar' }, 'ana', CON_BOT);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'maquina', CON_BOT);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', CON_BOT);

    expect(trivialModule.botAction?.(state, 'maquina', CON_BOT)).toBeNull();
  });
});

/** Una partida con la bomba en marcha: hay turno repartido y mecha encendida. */
function enLaBomba(): TrivialState {
  const conBomba: Pregunta[] = [
    PREGUNTAS[0],
    {
      id: 'b1',
      tipo: 'bomba',
      enunciado: '¿Cuántos bits tiene un byte?',
      opciones: ['4', '8', '16', 'depende'],
      correcta: 1,
      explicacion: 'Ocho, por convenio universal.',
    },
  ];
  const inicial = trivialModule.createState(SEATS, { preguntas: conBomba, semilla: 7 });
  let state = trivialModule.apply(inicial, { tipo: 'empezar' }, 'ana', SEATS);
  state = trivialModule.apply(state, { tipo: 'empezar' }, 'bea', SEATS);
  // Al entrar en la sección se reparte la bomba y se enciende la mecha.
  return trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', SEATS);
}

describe('el reloj de la ronda', () => {
  it('la sala guarda cuándo se cierra y lo manda en la vista', () => {
    const conReloj = trivialModule.apply(enRonda(), { tipo: 'reloj', hasta: 1_700 }, 'ana', SEATS);

    expect(conReloj.cierraEn).toBe(1_700);
    expect(vistaDe(conReloj, 'ana').cierraEn).toBe(1_700);
  });

  it('al vencer, la ronda se cierra sola', () => {
    const vencida = trivialModule.apply(enRonda(), { tipo: 'tiempo' }, 'ana', SEATS);

    expect(vencida.fase).toBe('resultado');
    expect(vistaDe(vencida, 'ana').cerrada).toBe(true);
  });

  it('quien no contestó a tiempo no suma, pero tampoco pierde', () => {
    const vencida = trivialModule.apply(enRonda(), { tipo: 'tiempo' }, 'ana', SEATS);

    expect(vencida.puntos['ana'] ?? 0).toBe(0);
    expect(vencida.puntos['bea'] ?? 0).toBe(0);
  });

  it('el tiempo que llega tarde no rompe nada y no se apunta', () => {
    // Que el temporizador salte cuando la mesa ya ha cerrado la ronda a mano no
    // es la excepción: es lo normal. Devolver el mismo objeto es la señal de
    // que no hay nada que escribir en el registro de la partida.
    const cerrada = trivialModule.apply(enRonda(), { tipo: 'tiempo' }, 'ana', SEATS);
    const otraVez = trivialModule.apply(cerrada, { tipo: 'tiempo' }, 'ana', SEATS);

    expect(otraVez).toBe(cerrada);
  });

  it('al pasar de ronda, el reloj se apaga hasta que lo pongan otra vez', () => {
    // Lo pone el regidor desde el servidor, con la hora de verdad. Si se
    // quedara el de la ronda anterior, la nueva nacería vencida.
    const conReloj = trivialModule.apply(enRonda(), { tipo: 'reloj', hasta: 1_700 }, 'ana', SEATS);
    const siguiente = trivialModule.apply(conReloj, { tipo: 'siguiente' }, 'ana', SEATS);

    expect(siguiente.cierraEn).toBe(0);
  });

  it('con la bomba en la mano, no contestar es que te estalle', () => {
    // Sin esto, la jugada ganadora en la bomba es quedarse quieto: se pierde la
    // mecha pero no los puntos del castigo, que es justo lo que la prueba cobra
    // por fallar.
    const conBomba = enLaBomba();
    const tenia = conBomba.turno ?? 'ana';
    const antes = conBomba.puntos[tenia] ?? 0;

    const vencida = trivialModule.apply(conBomba, { tipo: 'tiempo' }, 'ana', SEATS);

    expect(vencida.puntos[tenia]).toBeLessThan(antes);
  });

  it('y a quien no la tenía no le cuesta nada', () => {
    const conBomba = enLaBomba();
    const mirando = conBomba.orden.find((seat) => seat !== conBomba.turno) ?? 'bea';

    const vencida = trivialModule.apply(conBomba, { tipo: 'tiempo' }, 'ana', SEATS);

    expect(vencida.puntos[mirando] ?? 0).toBe(0);
  });
});
