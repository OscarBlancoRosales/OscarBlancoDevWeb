import { describe, expect, it } from 'vitest';
import { impostorModule } from './index';
import type { ImpostorAction, ImpostorState, ImpostorView, Modo } from './tipos';
import type { Seat } from '../module';

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
  { id: 'cris', displayName: 'Cris', isBot: false, connected: true, order: 2 },
];

const REPARTO: ImpostorAction = {
  tipo: 'reparte',
  palabra: 'Pizza',
  senuelo: 'Empanada',
  orden: ['ana', 'bea', 'cris'],
  impostores: ['bea'],
  opciones: ['Pizza', 'Empanada', 'Sopa', 'Helado', 'Jamón', 'Café'],
  semilla: 7,
};

function nueva(config: Record<string, unknown> = {}): ImpostorState {
  return impostorModule.createState(SEATS, { tema: 'comida', ...config });
}

function aplicar(state: ImpostorState, action: ImpostorAction, by: string): ImpostorState {
  return impostorModule.apply(state, action, by, SEATS);
}

/** Una ronda con la palabra ya repartida y Bea de impostora. */
function repartida(modo: Modo = 'clasico'): ImpostorState {
  let state = nueva({ modo });
  for (const seat of SEATS) state = aplicar(state, { tipo: 'listo' }, seat.id);
  return aplicar(state, REPARTO, 'ana');
}

/** La misma ronda con las tres pistas dichas: en pleno debate. */
function enDebate(modo: Modo = 'clasico'): ImpostorState {
  let state = repartida(modo);
  for (const seat of state.orden) {
    state = aplicar(state, { tipo: 'pista', texto: 'horno' }, seat);
  }
  return state;
}

/** Y con el debate ya cortado: lista para votar. */
function enVotacion(modo: Modo = 'clasico'): ImpostorState {
  return aplicar(enDebate(modo), { tipo: 'alVoto' }, 'ana');
}

function vistaDe(state: ImpostorState, seat: string): ImpostorView {
  return impostorModule.view(state, seat, SEATS) as ImpostorView;
}

describe('llenar la mesa', () => {
  it('nace esperando en la sala, sin palabra ni impostores', () => {
    const state = nueva();
    expect(state.fase).toBe('sala');
    expect(state.palabra).toBe('');
    expect(state.impostores).toEqual([]);
  });

  it('no reparte hasta que están listos todos los asientos', () => {
    let state = nueva();
    state = aplicar(state, { tipo: 'listo' }, 'ana');
    state = aplicar(state, { tipo: 'listo' }, 'bea');
    expect(state.fase).toBe('sala');

    state = aplicar(state, { tipo: 'listo' }, 'cris');
    expect(state.fase).toBe('repartiendo');
  });

  it('con menos de tres asientos no se reparte aunque estén todos listos', () => {
    const dos: Seat[] = SEATS.slice(0, 2);
    let state = impostorModule.createState(dos, {});
    for (const seat of dos) state = impostorModule.apply(state, { tipo: 'listo' }, seat.id, dos);
    expect(state.fase).toBe('sala');
  });

  it('decir que estás listo dos veces se rechaza', () => {
    const state = aplicar(nueva(), { tipo: 'listo' }, 'ana');
    expect(impostorModule.validate(state, { tipo: 'listo' }, 'ana', SEATS)?.code).toBe('ya-listo');
  });
});

describe('el reparto', () => {
  it('abre el turno de pistas con el orden que le dan', () => {
    const state = repartida();
    expect(state.fase).toBe('pistas');
    expect(state.orden).toEqual(['ana', 'bea', 'cris']);
    expect(state.turno).toBe(0);
  });

  it('la tripulación recibe la palabra y el impostor no', () => {
    const state = repartida();
    expect(vistaDe(state, 'ana').tuPalabra).toBe('Pizza');
    expect(vistaDe(state, 'bea').tuPalabra).toBeNull();
  });

  it('al impostor se le dice que lo es, y a los demás no', () => {
    const state = repartida();
    expect(vistaDe(state, 'bea').eresImpostor).toBe(true);
    expect(vistaDe(state, 'ana').eresImpostor).toBe(false);
  });

  it('en modo infiltrado se reparte la parecida y nadie sabe que lo es', () => {
    const state = repartida('infiltrado');
    expect(vistaDe(state, 'bea').tuPalabra).toBe('Empanada');
    expect(vistaDe(state, 'bea').eresImpostor).toBe(false);
  });

  it('quién es el impostor no sale hacia nadie mientras se juega', () => {
    const state = repartida();
    for (const seat of SEATS) expect(vistaDe(state, seat.id).impostores).toBeNull();
  });

  it('la palabra tampoco sale hacia nadie hasta el final', () => {
    const state = repartida();
    for (const seat of SEATS) expect(vistaDe(state, seat.id).palabra).toBeNull();
  });
});

describe('las pistas', () => {
  it('se habla por turnos y hablar fuera de turno se rechaza', () => {
    const state = repartida();
    expect(impostorModule.validate(state, { tipo: 'pista', texto: 'x' }, 'bea', SEATS)?.code).toBe(
      'no-es-tu-turno',
    );
    expect(impostorModule.validate(state, { tipo: 'pista', texto: 'x' }, 'ana', SEATS)).toBeNull();
  });

  it('el turno avanza y al final de la vuelta se abre el debate', () => {
    const state = enDebate();
    expect(state.fase).toBe('debate');
    expect(state.pistas).toHaveLength(3);
  });

  it('con dos vueltas se da la vuelta entera otra vez antes de votar', () => {
    let state = nueva({ vueltas: 2 });
    for (const seat of SEATS) state = aplicar(state, { tipo: 'listo' }, seat.id);
    state = aplicar(state, REPARTO, 'ana');

    for (const seat of state.orden) state = aplicar(state, { tipo: 'pista', texto: 'a' }, seat);
    expect(state.fase).toBe('pistas');
    expect(state.vuelta).toBe(1);

    for (const seat of state.orden) state = aplicar(state, { tipo: 'pista', texto: 'b' }, seat);
    expect(state.fase).toBe('debate');
    expect(state.pistas).toHaveLength(6);
  });

  it('las pistas dichas las ve la mesa entera', () => {
    let state = repartida();
    state = aplicar(state, { tipo: 'pista', texto: 'horno' }, 'ana');
    expect(vistaDe(state, 'cris').pistas[0]?.texto).toBe('horno');
  });
});

describe('el debate', () => {
  it('entre las pistas y la votación se habla', () => {
    const state = enDebate();
    expect(state.fase).toBe('debate');
    expect(vistaDe(state, 'ana').fase).toBe('debate');
  });

  it('no se vota mientras se debate', () => {
    const state = enDebate();
    expect(
      impostorModule.validate(state, { tipo: 'votar', aQuien: 'bea' }, 'ana', SEATS)?.code,
    ).toBe('aun-no-se-vota');
  });

  it('el reloj lo pone el servidor y llega a la mesa entera', () => {
    const conReloj = aplicar(enDebate(), { tipo: 'debate', hasta: 1_700_000_000_000 }, 'ana');
    expect(vistaDe(conReloj, 'cris').debateHasta).toBe(1_700_000_000_000);
  });

  it('cortar el debate es cosa del anfitrión', () => {
    const state = enDebate();
    expect(impostorModule.validate(state, { tipo: 'alVoto' }, 'bea', SEATS)?.code).toBe(
      'no-eres-el-anfitrion',
    );
    expect(impostorModule.validate(state, { tipo: 'alVoto' }, 'ana', SEATS)).toBeNull();
  });

  it('cortarlo lleva a la votación y apaga el reloj', () => {
    const state = aplicar(enDebate(), { tipo: 'alVoto' }, 'ana');
    expect(state.fase).toBe('votacion');
    expect(state.debateHasta).toBe(0);
  });

  it('se acaba el tiempo y se vota, lo pida alguien o no', () => {
    const state = aplicar(enDebate(), { tipo: 'aVotar' }, 'ana');
    expect(state.fase).toBe('votacion');
  });

  /**
   * El reloj lo cierra un temporizador, y puede saltar cuando la mesa ya ha
   * cortado el debate a mano. Ahí no puede pasar nada.
   */
  it('el aviso de tiempo que llega tarde no toca nada', () => {
    const votando = enVotacion();
    expect(aplicar(votando, { tipo: 'aVotar' }, 'ana')).toBe(votando);
    expect(aplicar(votando, { tipo: 'debate', hasta: 1 }, 'ana')).toBe(votando);
  });

  it('sin segundos configurados no hay reloj que enseñar', () => {
    let state = impostorModule.createState(SEATS, { tema: 'comida', segundosDebate: 0 });
    for (const seat of SEATS) state = aplicar(state, { tipo: 'listo' }, seat.id);
    state = aplicar(state, REPARTO, 'ana');
    expect(vistaDe(state, 'ana').segundosDebate).toBe(0);
  });

  it('los bots no hacen nada mientras se habla', () => {
    expect(impostorModule.botAction?.(enDebate(), 'bea', SEATS)).toBeNull();
  });
});

/** Cada uno vota cuando le toca, según este mapa votante → acusado. */
function votarSegun(
  state: ImpostorState,
  aQuien: Readonly<Record<string, string>>,
  asientos: readonly Seat[] = SEATS,
): ImpostorState {
  let actual = state;
  while (actual.fase === 'votacion') {
    const quien = enElSitio(actual.orden, actual.turno);
    const acusado = Object.entries(aQuien).find(([id]) => id === quien)?.[1];
    if (acusado === undefined) {
      throw new Error(`sin voto para ${quien} en ${actual.orden.join(',')}`);
    }
    actual = impostorModule.apply(actual, { tipo: 'votar', aQuien: acusado }, quien, asientos);
  }
  return actual;
}

/** El de ese sitio, o se corta el test: `.at` dice `undefined` y no miente. */
function enElSitio(orden: readonly string[], i: number): string {
  const id = orden.at(i);
  if (id === undefined) throw new Error(`no hay nadie en ${i}`);
  return id;
}

function elOtro(orden: readonly string[], de: string): string {
  const id = orden.find((uno) => uno !== de);
  if (id === undefined) throw new Error(`no hay otro distinto de ${de}`);
  return id;
}

describe('la votación', () => {
  it('se vota por turnos: fuera de turno se rechaza', () => {
    const state = enVotacion();
    const toca = enElSitio(state.orden, state.turno);
    const otro = elOtro(state.orden, toca);
    expect(
      impostorModule.validate(state, { tipo: 'votar', aQuien: toca }, otro, SEATS)?.code,
    ).toBe('no-es-tu-turno');
  });

  it('a quién ha votado cada uno no se sabe hasta que votan todos', () => {
    const state = enVotacion();
    const quien = enElSitio(state.orden, 0);
    const acusado = elOtro(state.orden, quien);
    const siguiente = aplicar(state, { tipo: 'votar', aQuien: acusado }, quien);

    const cris = vistaDe(siguiente, 'cris');
    expect(cris.votos).toBeNull();
    expect(cris.hanVotado).toEqual([quien]);
  });

  it('tu propio voto sí lo ves', () => {
    const state = enVotacion();
    const quien = enElSitio(state.orden, 0);
    const acusado = elOtro(state.orden, quien);
    const siguiente = aplicar(state, { tipo: 'votar', aQuien: acusado }, quien);
    expect(vistaDe(siguiente, quien).tuVoto).toBe(acusado);
  });

  it('votarse a uno mismo se rechaza', () => {
    const state = enVotacion();
    const quien = enElSitio(state.orden, 0);
    expect(
      impostorModule.validate(state, { tipo: 'votar', aQuien: quien }, quien, SEATS)?.code,
    ).toBe('ni-de-broma');
  });

  it('pillar al impostor gana la ronda para la tripulación', () => {
    const state = votarSegun(enVotacion(), { ana: 'bea', cris: 'bea', bea: 'ana' });

    expect(state.fase).toBe('fin');
    expect(state.expulsado).toBe('bea');
    expect(state.desenlace).toBe('tripulacion');
    expect(state.marcador).toEqual({ ana: 1, cris: 1 });
  });

  it('echar a un inocente con tres deja uno contra uno y gana el impostor', () => {
    const state = votarSegun(enVotacion(), { ana: 'cris', bea: 'cris', cris: 'bea' });

    expect(state.desenlace).toBe('impostores');
    expect(state.marcador).toEqual({ bea: 1 });
  });

  it('echar a un inocente con gente de sobra sigue la caza', () => {
    const cuatro: Seat[] = [
      ...SEATS,
      { id: 'dani', displayName: 'Dani', isBot: false, connected: true, order: 3 },
    ];
    const reparto: ImpostorAction = {
      ...REPARTO,
      orden: ['ana', 'bea', 'cris', 'dani'],
    };
    let state = impostorModule.createState(cuatro, { tema: 'comida' });
    for (const seat of cuatro) state = impostorModule.apply(state, { tipo: 'listo' }, seat.id, cuatro);
    state = impostorModule.apply(state, reparto, 'ana', cuatro);
    for (const seat of state.orden) {
      state = impostorModule.apply(state, { tipo: 'pista', texto: 'horno' }, seat, cuatro);
    }
    state = impostorModule.apply(state, { tipo: 'alVoto' }, 'ana', cuatro);
    state = votarSegun(state, { ana: 'dani', bea: 'dani', cris: 'dani', dani: 'ana' }, cuatro);

    expect(state.fase).toBe('pistas');
    expect(state.eliminados).toEqual(['dani']);
    expect(state.orden).not.toContain('dani');
    expect(state.orden).toHaveLength(3);
    expect(state.desenlace).toBeNull();
  });

  it('el empate no echa a nadie y se vuelve a hablar', () => {
    const state = votarSegun(enVotacion(), { ana: 'bea', bea: 'cris', cris: 'ana' });

    expect(state.expulsado).toBeNull();
    expect(state.fase).toBe('pistas');
    expect(state.desenlace).toBeNull();
  });

  it('al acabar se destapan la palabra y los impostores', () => {
    const state = votarSegun(enVotacion(), { ana: 'bea', cris: 'bea', bea: 'ana' });

    const vista = vistaDe(state, 'cris');
    expect(vista.palabra).toBe('Pizza');
    expect(vista.impostores).toEqual(['bea']);
  });
});

describe('la revancha', () => {
  /** La ronda con Bea pillada y el disparo abierto. */
  function pillada(): ImpostorState {
    return votarSegun(enVotacion('revancha'), { ana: 'bea', cris: 'bea', bea: 'ana' });
  }

  it('pillar al impostor no acaba la ronda: le abre el disparo', () => {
    const state = pillada();
    expect(state.fase).toBe('ultima-palabra');
    expect(state.desenlace).toBeNull();
    expect(vistaDe(state, 'bea').tuDisparo).toBe(true);
    expect(vistaDe(state, 'ana').tuDisparo).toBe(false);
  });

  it('las opciones solo se enseñan cuando hay disparo', () => {
    expect(vistaDe(repartida('revancha'), 'bea').opciones).toEqual([]);
    expect(vistaDe(pillada(), 'bea').opciones).toHaveLength(6);
  });

  it('si acierta la palabra gana él aunque le hayan pillado', () => {
    const state = aplicar(pillada(), { tipo: 'adivinar', opcion: 0 }, 'bea');
    expect(state.fase).toBe('fin');
    expect(state.desenlace).toBe('impostores');
    expect(state.marcador).toEqual({ bea: 1 });
  });

  it('si falla, la tripulación se queda la ronda', () => {
    const state = aplicar(pillada(), { tipo: 'adivinar', opcion: 1 }, 'bea');
    expect(state.desenlace).toBe('tripulacion');
    expect(state.marcador).toEqual({ ana: 1, cris: 1 });
  });

  it('el disparo no lo puede hacer otro', () => {
    const state = pillada();
    expect(
      impostorModule.validate(state, { tipo: 'adivinar', opcion: 0 }, 'ana', SEATS)?.code,
    ).toBe('no-es-tu-disparo');
  });

  it('en el modo clásico pillarle acaba la ronda y no hay disparo', () => {
    const state = votarSegun(enVotacion('clasico'), { ana: 'bea', cris: 'bea', bea: 'ana' });
    expect(state.fase).toBe('fin');
  });
});

describe('otra ronda', () => {
  function acabada(): ImpostorState {
    return votarSegun(enVotacion(), { ana: 'bea', cris: 'bea', bea: 'ana' });
  }

  it('solo la pide el anfitrión, y solo con la ronda acabada', () => {
    const state = acabada();
    expect(impostorModule.validate(state, { tipo: 'otra' }, 'bea', SEATS)?.code).toBe(
      'no-eres-el-anfitrion',
    );
    expect(impostorModule.validate(state, { tipo: 'otra' }, 'ana', SEATS)).toBeNull();
    expect(impostorModule.validate(repartida(), { tipo: 'otra' }, 'ana', SEATS)?.code).toBe(
      'ronda-en-marcha',
    );
  });

  it('vuelve a esperar reparto y conserva el marcador', () => {
    const state = aplicar(acabada(), { tipo: 'otra' }, 'ana');
    expect(state.fase).toBe('repartiendo');
    expect(state.marcador).toEqual({ ana: 1, cris: 1 });
    expect(state.rondasJugadas).toBe(1);
  });
});

describe('quien se va', () => {
  it('sale del orden y la ronda sigue con los que quedan', () => {
    let state = repartida();
    state = aplicar(state, { tipo: 'pista', texto: 'horno' }, 'ana');
    const sinBea = impostorModule.onSeatLeave?.(state, 'bea') ?? state;

    expect(sinBea.orden).toEqual(['ana', 'cris']);
    expect(sinBea.turno).toBeLessThan(sinBea.orden.length);
  });

  it('si se va el impostor pillado, no se espera un disparo que no va a llegar', () => {
    let state = enVotacion('revancha');
    state = aplicar(state, { tipo: 'votar', aQuien: 'bea' }, 'ana');
    state = aplicar(state, { tipo: 'votar', aQuien: 'bea' }, 'cris');
    state = aplicar(state, { tipo: 'votar', aQuien: 'ana' }, 'bea');

    const sinBea = impostorModule.onSeatLeave?.(state, 'bea') ?? state;
    expect(sinBea.fase).toBe('fin');
    expect(sinBea.desenlace).toBe('tripulacion');
  });

  it('si la mesa se queda corta, la ronda se corta sin ganador', () => {
    let state = repartida();
    state = impostorModule.onSeatLeave?.(state, 'bea') ?? state;
    expect(state.fase).toBe('fin');
    expect(state.desenlace).toBeNull();
  });
});

describe('los bots', () => {
  const CON_BOT: Seat[] = [
    { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
    { id: 'bot', displayName: 'Bot', isBot: true, connected: true, order: 1 },
    { id: 'cris', displayName: 'Cris', isBot: false, connected: true, order: 2 },
  ];

  it('se sientan solos mientras la mesa se llena', () => {
    const state = impostorModule.createState(CON_BOT, {});
    expect(impostorModule.botAction?.(state, 'bot', CON_BOT)).toEqual({ tipo: 'listo' });
  });

  it('hablan cuando les toca y solo cuando les toca', () => {
    const state = repartida();
    expect(impostorModule.botAction?.(state, 'bea', SEATS)).toBeNull();
    const suya = impostorModule.botAction?.(state, 'ana', SEATS);
    expect(suya?.tipo).toBe('pista');
  });

  it('el impostor no dice ninguna pista de la palabra buena', () => {
    let state = repartida();
    // Bea es la impostora: le toca hablar la segunda.
    state = aplicar(state, { tipo: 'pista', texto: 'algo' }, 'ana');
    const suya = impostorModule.botAction?.(state, 'bea', SEATS);

    expect(suya?.tipo).toBe('pista');
    expect(['reparto', 'horno', 'porción']).not.toContain(
      suya?.tipo === 'pista' ? suya.texto : '',
    );
  });

  it('votan a alguien que no son ellos mismos', () => {
    const state = enVotacion();
    const quien = enElSitio(state.orden, state.turno);
    const voto = impostorModule.botAction?.(state, quien, SEATS);
    expect(voto?.tipo).toBe('votar');
    expect(voto?.tipo === 'votar' ? voto.aQuien : '').not.toBe(quien);
    expect(impostorModule.botAction?.(state, elOtro(state.orden, quien), SEATS)).toBeNull();
  });
});
