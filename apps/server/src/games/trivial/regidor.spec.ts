import { describe, expect, it, vi } from 'vitest';
import { RegidorDeSala } from './regidor';
import { trivialModule } from '@devweb/shared/games/trivial/index';
import type { Pregunta, TipoPrueba, TrivialState } from '@devweb/shared/games/trivial/tipos';
import type { RoomActor } from '../../rooms/actor';
import type { Seat } from '@devweb/shared/games/module';

/**
 * El reloj del concurso, que corre en el servidor.
 *
 * Es la única hora que comparten los cinco navegadores de la mesa, y además la
 * única que no se para abriendo las herramientas de desarrollo. En un concurso
 * para programadores eso segundo importa tanto como lo primero.
 */

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
];

function preguntaDe(tipo: TipoPrueba): Pregunta {
  return {
    id: `p-${tipo}`,
    tipo,
    enunciado: '¿Sí o no?',
    opciones: ['no', 'sí', 'quizá', 'nunca'],
    correcta: 1,
    explicacion: 'Pues eso.',
  };
}

/** Un actor de mentira que apunta lo que el regidor le manda aplicar. */
function actorFalso() {
  const puestas: { tipo: string; hasta?: number }[] = [];
  const actor = {
    aplicarDelSistema(_seatId: string, accion: unknown) {
      puestas.push(accion as { tipo: string; hasta?: number });
    },
  };
  return { actor: actor as unknown as RoomActor, puestas };
}

/** Una partida empezada cuya ronda en marcha es de la prueba que se diga. */
function enRonda(tipo: TipoPrueba): TrivialState {
  const inicial = trivialModule.createState(SEATS, {
    preguntas: [preguntaDe(tipo)],
    semilla: 7,
  });
  const conAna = trivialModule.apply(inicial, { tipo: 'empezar' }, 'ana', SEATS);
  return trivialModule.apply(conAna, { tipo: 'empezar' }, 'bea', SEATS);
}

/** Una sección de bomba de verdad: dos rondas, para que haya a dónde pasar. */
function enBomba(): TrivialState {
  const preguntas: Pregunta[] = [
    { ...preguntaDe('bomba'), id: 'bomba-1' },
    { ...preguntaDe('bomba'), id: 'bomba-2' },
  ];
  const inicial = trivialModule.createState(SEATS, { preguntas, semilla: 7 });
  const conAna = trivialModule.apply(inicial, { tipo: 'empezar' }, 'ana', SEATS);
  return trivialModule.apply(conAna, { tipo: 'empezar' }, 'bea', SEATS);
}

describe('el regidor', () => {
  it('pone el reloj al abrirse una ronda, con los segundos de esa prueba', () => {
    const { actor, puestas } = actorFalso();

    new RegidorDeSala(() => 1_000).trasJugada(actor, null, enRonda('rafaga'));

    // La ráfaga son diez segundos: se contesta con el estómago.
    expect(puestas).toEqual([{ tipo: 'reloj', hasta: 11_000 }]);
  });

  it('le da más tiempo a la de leer código que a la de reflejos', () => {
    const conCodigo = actorFalso();
    const conPrisa = actorFalso();

    new RegidorDeSala(() => 0).trasJugada(conCodigo.actor, null, enRonda('fallo'));
    new RegidorDeSala(() => 0).trasJugada(conPrisa.actor, null, enRonda('pulsa'));

    expect(conCodigo.puestas[0].hasta).toBeGreaterThan(conPrisa.puestas[0].hasta ?? 0);
  });

  it('no vuelve a ponerlo si esa ronda ya lo tiene', () => {
    // Al narrador se le avisa en CADA jugada, respuestas incluidas. Sin esta
    // guarda, contestar alargaría la ronda, que es lo contrario de un reloj.
    const { actor, puestas } = actorFalso();
    const regidor = new RegidorDeSala(() => 1_000);
    const abierta = enRonda('test');

    regidor.trasJugada(actor, null, abierta);
    const conReloj = trivialModule.apply(abierta, { tipo: 'reloj', hasta: 26_000 }, 'ana', SEATS);
    regidor.trasJugada(actor, abierta, conReloj);

    expect(puestas).toHaveLength(1);
  });

  it('al vencer, manda el tiempo', () => {
    vi.useFakeTimers();
    const { actor, puestas } = actorFalso();

    new RegidorDeSala(() => 0).trasJugada(actor, null, enRonda('rafaga'));
    vi.advanceTimersByTime(10_000);

    expect(puestas.at(-1)).toEqual({ tipo: 'tiempo' });
    vi.useRealTimers();
  });

  it('con la ronda ya cerrada, ni reloj ni nada', () => {
    const { actor, puestas } = actorFalso();
    const cerrada = trivialModule.apply(enRonda('test'), { tipo: 'tiempo' }, 'ana', SEATS);

    new RegidorDeSala(() => 0).trasJugada(actor, null, cerrada);

    expect(puestas).toEqual([]);
  });

  it('al soltarse la sala, el temporizador no queda colgando', () => {
    // Aquí se abre y se cierra una ronda cada pocos segundos: un temporizador
    // que sobrevive a la sala es una fuga con patas.
    vi.useFakeTimers();
    const { actor, puestas } = actorFalso();
    const regidor = new RegidorDeSala(() => 0);

    regidor.trasJugada(actor, null, enRonda('rafaga'));
    regidor.parar();
    vi.advanceTimersByTime(30_000);

    expect(puestas).toEqual([{ tipo: 'reloj', hasta: 10_000 }]);
    vi.useRealTimers();
  });

  /**
   * La bomba.
   *
   * Es la única prueba que avanza sola, y tiene que ser así: quien la tiene
   * contesta, se ve a quién le cae encima y sigue. Pararlo ahí a esperar un
   * clic le da todo el tiempo del mundo al que la tiene justo cuando la gracia
   * es no tenerlo.
   */
  it('la ráfaga también pasa sola, y más rápido que la bomba', () => {
    // Un botón entre disparo y disparo no es una ráfaga.
    vi.useFakeTimers();
    const { actor, puestas } = actorFalso();
    const abierta = enRonda('rafaga');
    const cerrada = trivialModule.apply(abierta, { tipo: 'tiempo' }, 'ana', SEATS);

    new RegidorDeSala(() => 0).trasJugada(actor, abierta, cerrada);
    vi.advanceTimersByTime(2_500);

    expect(puestas).toEqual([{ tipo: 'tiempo' }]);
    vi.useRealTimers();
  });

  it('pero las de leer y pensar esperan a la mesa', () => {
    // En «encuentra el fallo» hay una explicación que merece leerse, y la
    // lee cada uno a su ritmo.
    vi.useFakeTimers();
    const { actor, puestas } = actorFalso();
    const abierta = enRonda('fallo');
    const cerrada = trivialModule.apply(abierta, { tipo: 'tiempo' }, 'ana', SEATS);

    new RegidorDeSala(() => 0).trasJugada(actor, abierta, cerrada);
    vi.advanceTimersByTime(60_000);

    expect(puestas).toEqual([]);
    vi.useRealTimers();
  });

  describe('la bomba', () => {
    /** El estado tras contestar quien la tiene, que cierra la ronda al vuelo. */
    function contestada(): { antes: TrivialState; ahora: TrivialState } {
      const antes = enBomba();
      const quien = antes.turno ?? 'ana';
      return {
        antes,
        ahora: trivialModule.apply(antes, { tipo: 'responder', valor: 1 }, quien, SEATS),
      };
    }

    it('pasa sola, sin que nadie pulse nada', () => {
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();
      const { antes, ahora } = contestada();

      new RegidorDeSala(
        () => 0,
        () => 0,
      ).trasJugada(actor, antes, ahora);
      vi.advanceTimersByTime(3_000);

      // Enciende la mecha -sigue habiendo bomba en pantalla- y pasa de ronda.
      expect(puestas.filter((una) => una.tipo === 'tiempo')).toEqual([{ tipo: 'tiempo' }]);
      vi.useRealTimers();
    });

    it('enciende la mecha al entrar en la sección', () => {
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();

      // Con el dado a cero, la mecha dura lo mínimo: dieciocho segundos.
      new RegidorDeSala(
        () => 1_000,
        () => 0,
      ).trasJugada(actor, null, enBomba());

      expect(puestas).toContainEqual({ tipo: 'mecha', hasta: 19_000 });
      vi.useRealTimers();
    });

    it('pero no antes de empezar, que ahí todavía está entrando gente', () => {
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();
      const sinEmpezar = trivialModule.createState(SEATS, {
        preguntas: [{ ...preguntaDe('bomba'), id: 'bomba-1' }],
        semilla: 7,
      });

      new RegidorDeSala(
        () => 0,
        () => 0,
      ).trasJugada(actor, null, sinEmpezar);
      vi.advanceTimersByTime(60_000);

      expect(puestas).toEqual([]);
      vi.useRealTimers();
    });

    it('y cuánto dura no es siempre lo mismo', () => {
      // Si todas duraran parecido, a la tercera bomba la mesa sabría contar, y
      // contar es justo lo que aquí no se puede poder hacer.
      vi.useFakeTimers();
      const corta = actorFalso();
      const larga = actorFalso();

      new RegidorDeSala(
        () => 0,
        () => 0,
      ).trasJugada(corta.actor, null, enBomba());
      new RegidorDeSala(
        () => 0,
        () => 1,
      ).trasJugada(larga.actor, null, enBomba());

      const deCorta = corta.puestas.find((una) => una.tipo === 'mecha')?.hasta ?? 0;
      const deLarga = larga.puestas.find((una) => una.tipo === 'mecha')?.hasta ?? 0;

      expect(deLarga).toBeGreaterThan(deCorta * 2);
      vi.useRealTimers();
    });

    it('al acabarse, estalla', () => {
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();

      new RegidorDeSala(
        () => 0,
        () => 0,
      ).trasJugada(actor, null, enBomba());
      vi.advanceTimersByTime(18_000);

      expect(puestas.at(-1)).toEqual({ tipo: 'estalla' });
      vi.useRealTimers();
    });

    it('y no se reinicia con cada pregunta', () => {
      // La mecha corre por debajo de las rondas. Si cada pregunta la volviera
      // a encender, no se acabaría nunca y no habría bomba.
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();
      const regidor = new RegidorDeSala(
        () => 0,
        () => 0,
      );
      const { antes, ahora } = contestada();

      regidor.trasJugada(actor, null, antes);
      regidor.trasJugada(actor, antes, ahora);

      expect(puestas.filter((una) => una.tipo === 'mecha')).toHaveLength(1);
      vi.useRealTimers();
    });

    it('al salir de la bomba se apaga', () => {
      // Una mecha que sobrevive a su sección estallaría en mitad de la final.
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();
      const regidor = new RegidorDeSala(
        () => 0,
        () => 0,
      );
      const enBomba_ = enBomba();

      regidor.trasJugada(actor, null, enBomba_);
      regidor.trasJugada(actor, enBomba_, enRonda('test'));
      vi.advanceTimersByTime(60_000);

      expect(puestas.filter((una) => una.tipo === 'estalla')).toHaveLength(0);
      vi.useRealTimers();
    });

    it('y ese tiempo es el que hace avanzar la ronda', () => {
      const { ahora } = contestada();
      const pasada = trivialModule.apply(ahora, { tipo: 'tiempo' }, 'ana', SEATS);

      expect(pasada.actual).toBe(ahora.actual + 1);
      expect(pasada.turno).not.toBe(ahora.turno);
    });

    it('no espera a que venza la cuenta de la ronda que ya está resuelta', () => {
      // Quien contesta en dos segundos deja viva una cuenta atrás de doce. Si
      // esa cuenta mandara, la bomba pasaría diez segundos tarde.
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();
      const regidor = new RegidorDeSala(
        () => 0,
        () => 0,
      );
      const { antes, ahora } = contestada();

      regidor.trasJugada(actor, null, antes);
      regidor.trasJugada(actor, antes, ahora);
      vi.advanceTimersByTime(3_000);

      expect(puestas.at(-1)).toEqual({ tipo: 'tiempo' });
      expect(puestas.filter((una) => una.tipo === 'tiempo')).toHaveLength(1);
      vi.useRealTimers();
    });

    it('y por muchas veces que se le avise, pasa una sola vez', () => {
      // Al narrador se le llama en cada jugada: sin guarda, cada una pondría
      // otro pase y la sección entera se iría de golpe.
      vi.useFakeTimers();
      const { actor, puestas } = actorFalso();
      const regidor = new RegidorDeSala(() => 0);
      const { antes, ahora } = contestada();

      regidor.trasJugada(actor, antes, ahora);
      regidor.trasJugada(actor, ahora, ahora);
      regidor.trasJugada(actor, ahora, ahora);
      vi.advanceTimersByTime(3_000);

      expect(puestas.filter((una) => una.tipo === 'tiempo')).toHaveLength(1);
      vi.useRealTimers();
    });
  });

  it('y al salir de la ronda, tampoco', () => {
    // Con una prueba de las que esperan a la mesa: en las de ritmo lo que
    // viene detrás no es silencio, es el pase a la ronda siguiente.
    vi.useFakeTimers();
    const { actor, puestas } = actorFalso();
    const regidor = new RegidorDeSala(() => 0);
    const abierta = enRonda('test');

    regidor.trasJugada(actor, null, abierta);
    const cerrada = trivialModule.apply(abierta, { tipo: 'tiempo' }, 'ana', SEATS);
    regidor.trasJugada(actor, abierta, cerrada);
    vi.advanceTimersByTime(60_000);

    expect(puestas).toEqual([{ tipo: 'reloj', hasta: 25_000 }]);
    vi.useRealTimers();
  });
});
