import { describe, expect, it, vi } from 'vitest';
import { coro } from './coro';
import type { RoomActor } from './actor';

/**
 * Varios narradores por el único hueco que tiene la sala.
 *
 * El concurso necesita dos cosas que no son la misma: alguien que hable y
 * alguien que lleve el reloj. Juntarlas en una clase haría imposible probar el
 * reloj sin un modelo de mentira.
 */
const ACTOR = {} as RoomActor;

describe('el coro de narradores', () => {
  it('avisa a todos, y en orden', () => {
    const dichos: string[] = [];
    const juntos = coro(
      { trasJugada: () => dichos.push('regidor') },
      { trasJugada: () => dichos.push('presentador') },
    );

    juntos.trasJugada(ACTOR, null, null);

    expect(dichos).toEqual(['regidor', 'presentador']);
  });

  it('ignora los huecos, que es lo que hay cuando no hay clave de IA', () => {
    const segundo = vi.fn();
    const juntos = coro(null, { trasJugada: segundo });

    juntos.trasJugada(ACTOR, null, null);

    expect(segundo).toHaveBeenCalled();
  });

  it('si uno se cae, los demás siguen', () => {
    // Que el presentador reviente hablando con un modelo no puede dejar a la
    // sala sin cronómetro.
    const segundo = vi.fn();
    const juntos = coro(
      {
        trasJugada: () => {
          throw new Error('me he caído');
        },
      },
      { trasJugada: segundo },
    );

    juntos.trasJugada(ACTOR, null, null);

    expect(segundo).toHaveBeenCalled();
  });

  it('al parar, los para a todos', () => {
    const unoPara = vi.fn();
    const otroPara = vi.fn();
    const juntos = coro(
      { trasJugada: () => undefined, parar: unoPara },
      { trasJugada: () => undefined, parar: otroPara },
    );

    juntos.parar?.();

    expect(unoPara).toHaveBeenCalled();
    expect(otroPara).toHaveBeenCalled();
  });

  it('y a los que no saben pararse, no les pasa nada', () => {
    const juntos = coro({ trasJugada: () => undefined });
    expect(() => juntos.parar?.()).not.toThrow();
  });
});
