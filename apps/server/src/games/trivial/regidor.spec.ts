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

  it('y al salir de la ronda, tampoco', () => {
    vi.useFakeTimers();
    const { actor, puestas } = actorFalso();
    const regidor = new RegidorDeSala(() => 0);
    const abierta = enRonda('rafaga');

    regidor.trasJugada(actor, null, abierta);
    const cerrada = trivialModule.apply(abierta, { tipo: 'tiempo' }, 'ana', SEATS);
    regidor.trasJugada(actor, abierta, cerrada);
    vi.advanceTimersByTime(30_000);

    expect(puestas).toEqual([{ tipo: 'reloj', hasta: 10_000 }]);
    vi.useRealTimers();
  });
});
