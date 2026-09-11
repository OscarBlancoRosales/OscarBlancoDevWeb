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

function vistaDe(state: TrivialState, seat: string, asientos: readonly Seat[] = SEATS): TrivialView {
  return trivialModule.view(state, seat, asientos) as TrivialView;
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

/** Una partida que llega a la final con puntos repartidos para poder apostar. */
function hastaLaFinal(): TrivialState {
  const conFinal: Pregunta[] = [
    PREGUNTAS[0],
    {
      id: 'f1',
      tipo: 'final',
      enunciado: '¿Por qué "👨‍👩‍👧".length devuelve 8?',
      opciones: ['Cuenta bytes', 'Son tres emojis unidos y algunos ocupan dos', 'Está mal formado', 'Siempre son potencias de dos'],
      correcta: 1,
      explicacion: 'Tres personas fuera del plano básico más dos uniones invisibles.',
    },
  ];
  const inicial = trivialModule.createState(SEATS, { preguntas: conFinal, semilla: 7 });
  let state = trivialModule.apply(inicial, { tipo: 'empezar' }, 'ana', SEATS);
  state = trivialModule.apply(state, { tipo: 'empezar' }, 'bea', SEATS);
  // Las dos aciertan la primera, así que llegan a la final con puntos.
  state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
  state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
  return state;
}

/** Ya en la fase de apuestas, con la pregunta de la final por jugar. */
function apostando(): TrivialState {
  return trivialModule.apply(hastaLaFinal(), { tipo: 'siguiente' }, 'ana', SEATS);
}

describe('la final a doble o nada', () => {
  it('a la final se entra apostando, no contestando', () => {
    expect(apostando().fase).toBe('apuestas');
  });

  it('nadie ve lo que apuestan los demás hasta que se cierra', () => {
    // La misma regla que la respuesta correcta: lo que no se manda, no se puede
    // mirar con las herramientas de desarrollo abiertas.
    const conApuesta = trivialModule.apply(apostando(), { tipo: 'apostar', cuanto: 50 }, 'bea', SEATS);
    const vista = vistaDe(conApuesta, 'ana');

    expect(vista.hanApostado).toContain('bea');
    expect(vista.apuestas).toBeNull();
  });

  it('pero tú sí ves la tuya', () => {
    const conApuesta = trivialModule.apply(apostando(), { tipo: 'apostar', cuanto: 50 }, 'bea', SEATS);
    expect(vistaDe(conApuesta, 'bea').tuApuesta).toBe(50);
  });

  it('no puedes apostar más de lo que llevas', () => {
    const enJuego = apostando();
    const sobran = (enJuego.puntos['bea'] ?? 0) + 1;

    expect(trivialModule.validate(enJuego, { tipo: 'apostar', cuanto: sobran }, 'bea', SEATS))
      .toMatchObject({ code: 'no-tienes-tanto' });
  });

  it('ni apostar dos veces', () => {
    const conApuesta = trivialModule.apply(apostando(), { tipo: 'apostar', cuanto: 10 }, 'bea', SEATS);

    expect(trivialModule.validate(conApuesta, { tipo: 'apostar', cuanto: 20 }, 'bea', SEATS))
      .toMatchObject({ code: 'ya-apostaste' });
  });

  it('ni contestar mientras se apuesta', () => {
    expect(trivialModule.validate(apostando(), { tipo: 'responder', valor: 1 }, 'ana', SEATS))
      .toMatchObject({ code: 'aun-se-apuesta' });
  });

  it('cuando han apostado todos, se cantan y se juega la pregunta', () => {
    let state = apostando();
    for (const quien of state.orden) {
      state = trivialModule.apply(state, { tipo: 'apostar', cuanto: 50 }, quien, SEATS);
    }

    expect(state.fase).toBe('ronda');
    expect(vistaDe(state, 'ana').apuestas).not.toBeNull();
  });

  it('quien no apuesta a tiempo se planta', () => {
    // Cero es una apuesta: no perder nada. Bloquear la final esperando a
    // alguien que se ha ido a por un café es peor que darle un cero.
    const vencida = trivialModule.apply(apostando(), { tipo: 'tiempo' }, 'ana', SEATS);

    expect(vencida.fase).toBe('ronda');
    expect(vencida.apuestas['ana'] ?? 0).toBe(0);
  });

  it('acertar te lleva lo que te jugabas', () => {
    let state = apostando();
    const tenia = state.puntos['ana'] ?? 0;
    state = trivialModule.apply(state, { tipo: 'apostar', cuanto: 100 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'tiempo' }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);

    expect(state.puntos['ana']).toBe(tenia + 100);
  });

  it('y fallar te lo quita, pero te deja a cero y no en rojo', () => {
    // No hace falta ningún suelo: la apuesta ya está topada por lo que llevas.
    let state = apostando();
    const todo = state.puntos['ana'] ?? 0;
    state = trivialModule.apply(state, { tipo: 'apostar', cuanto: todo }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'tiempo' }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);

    expect(state.puntos['ana']).toBe(0);
  });

  it('acertar el primero no vale más que acertar el último', () => {
    // En una apuesta, correr no es la gracia: lo que se premia es lo que te
    // jugabas. Un bonus por rapidez aquí la convertiría en otra ronda normal.
    let state = apostando();
    state = trivialModule.apply(state, { tipo: 'apostar', cuanto: 100 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'apostar', cuanto: 100 }, 'bea', SEATS);
    const antes = { ...state.puntos };
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);

    expect(state.puntos['ana'] - (antes['ana'] ?? 0)).toBe(
      state.puntos['bea'] - (antes['bea'] ?? 0),
    );
  });

  it('un bot apuesta solo, que si no la final no arranca', () => {
    const conBot = apostando();
    const jugada = trivialModule.botAction?.(conBot, 'bea', SEATS);

    expect(jugada).toMatchObject({ tipo: 'apostar' });
  });
});

const CON_BOT: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bot', displayName: 'Sabelotodo', isBot: true, connected: true, order: 1 },
];

const TRES: Seat[] = [
  ...SEATS,
  { id: 'caco', displayName: 'Caco', isBot: false, connected: true, order: 2 },
];

/** Una partida del modo IA, empezada, con la primera pregunta abierta. */
function inventada(asientos: readonly Seat[] = SEATS): TrivialState {
  const inicial = trivialModule.createState(asientos, {
    preguntas: PREGUNTAS,
    semilla: 7,
    origen: 'ia',
  });
  let state = inicial;
  for (const asiento of asientos) {
    state = trivialModule.apply(state, { tipo: 'empezar' }, asiento.id, asientos);
  }
  return state;
}

describe('impugnar una pregunta que la IA se inventó mal', () => {
  it('hace falta que le den todas las personas de la mesa', () => {
    // Por unanimidad y no por mayoría: con mayoría, quien no se sabe la
    // respuesta impugna para no perder puntos, y el botón deja de arreglar
    // preguntas malas para ser una jugada más.
    let state = inventada(TRES);
    state = trivialModule.apply(state, { tipo: 'impugnar' }, 'ana', TRES);
    state = trivialModule.apply(state, { tipo: 'impugnar' }, 'bea', TRES);

    expect(state.fase).toBe('ronda');

    state = trivialModule.apply(state, { tipo: 'impugnar' }, 'caco', TRES);

    expect(state.fase).toBe('resultado');
  });

  it('anulada, el marcador se queda exactamente como estaba', () => {
    let state = inventada();
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
    const antes = { ...state.puntos };

    state = trivialModule.apply(state, { tipo: 'impugnar' }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'impugnar' }, 'bea', SEATS);

    expect(state.puntos).toEqual(antes);
    expect(vistaDe(state, 'ana').resultados?.every((uno) => uno.ganados === 0)).toBe(true);
  });

  it('los bots no votan', () => {
    // Un bot no sabe si la pregunta está mal, y esperar su voto sería esperar
    // para siempre.
    const state = trivialModule.apply(inventada(CON_BOT), { tipo: 'impugnar' }, 'ana', CON_BOT);
    expect(state.fase).toBe('resultado');
  });

  it('en el modo del banco no se puede impugnar', () => {
    // El banco está escrito a mano y revisado. Abrir ahí la puerta a anular
    // rondas es invitar a usarla para no perder puntos.
    expect(trivialModule.validate(enRonda(), { tipo: 'impugnar' }, 'ana', SEATS))
      .toMatchObject({ code: 'no-se-impugna' });
  });

  it('no se impugna dos veces', () => {
    const state = trivialModule.apply(inventada(TRES), { tipo: 'impugnar' }, 'ana', TRES);

    expect(trivialModule.validate(state, { tipo: 'impugnar' }, 'ana', TRES))
      .toMatchObject({ code: 'ya-impugnaste' });
  });

  it('ni con la ronda ya cerrada', () => {
    const cerrada = trivialModule.apply(inventada(), { tipo: 'tiempo' }, 'ana', SEATS);

    expect(trivialModule.validate(cerrada, { tipo: 'impugnar' }, 'ana', SEATS))
      .toMatchObject({ code: 'ronda-cerrada' });
  });

  it('la mesa ve cuántos van y cuántos hacen falta, no quiénes', () => {
    const state = trivialModule.apply(inventada(TRES), { tipo: 'impugnar' }, 'ana', TRES);
    const vista = vistaDe(state, 'bea', TRES);

    expect(vista.impugnan).toBe(1);
    expect(vista.hacenFalta).toBe(3);
    expect(vista.tuImpugnas).toBe(false);
    expect(vista.inventadas).toBe(true);
  });

  it('y al pasar de ronda se olvida lo votado', () => {
    let state = trivialModule.apply(inventada(TRES), { tipo: 'impugnar' }, 'ana', TRES);
    state = trivialModule.apply(state, { tipo: 'tiempo' }, 'ana', TRES);
    state = trivialModule.apply(state, { tipo: 'siguiente' }, 'ana', TRES);

    expect(state.impugnan).toEqual([]);
  });
});

describe('la dificultad', () => {
  it('viaja en la vista cuando la pregunta la trae', () => {
    const conNivel: Pregunta[] = [{ ...PREGUNTAS[0], dificultad: 4 }];
    const inicial = trivialModule.createState(SEATS, { preguntas: conNivel, semilla: 7 });
    let state = trivialModule.apply(inicial, { tipo: 'empezar' }, 'ana', SEATS);
    state = trivialModule.apply(state, { tipo: 'empezar' }, 'bea', SEATS);

    expect(vistaDe(state, 'ana').dificultad).toBe(4);
  });

  it('y es null cuando la pregunta no la declara', () => {
    // El banco escrito a mano no la rellena, y no pasa nada: el crescendo es
    // cosa del modo IA, que sí la encarga por posición.
    expect(vistaDe(enRonda(), 'ana').dificultad).toBeNull();
  });

  it('no se enseña antes de empezar', () => {
    const conNivel: Pregunta[] = [{ ...PREGUNTAS[0], dificultad: 5 }];
    const sinEmpezar = trivialModule.createState(SEATS, { preguntas: conNivel, semilla: 7 });

    expect(vistaDe(sinEmpezar, 'ana').dificultad).toBeNull();
  });
});
