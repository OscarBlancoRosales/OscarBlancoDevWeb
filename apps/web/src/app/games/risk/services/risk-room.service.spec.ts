import { describe, expect, it } from 'vitest';
import { stripUndefined } from './risk-room.service';
import { seatsToRoster } from './risk-sync';

/**
 * Firebase LANZA si le mandas un `undefined` en cualquier profundidad, y este
 * juego está lleno de campos opcionales. En local no se notaba porque
 * `JSON.stringify` los descarta callando, así que el modo local iba y el online
 * reventaba al empezar la partida.
 */
describe('saneado antes de mandar a Firebase', () => {
  it('quita los undefined del primer nivel', () => {
    expect(stripUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('y también los de dentro, que es lo que fallaba', () => {
    const limpio = stripUndefined({ meta: { name: 'x', bot: undefined } });
    expect(limpio).toEqual({ meta: { name: 'x' } });
    expect('bot' in (limpio.meta as object)).toBe(false);
  });

  it('entra en los arrays', () => {
    const limpio = stripUndefined({ roster: [{ id: 'a', bot: undefined }, { id: 'b', bot: 'cauto' }] });
    expect(limpio).toEqual({ roster: [{ id: 'a' }, { id: 'b', bot: 'cauto' }] });
  });

  it('los arrays siguen siendo arrays', () => {
    const limpio = stripUndefined({ lista: [1, 2, 3] });
    expect(Array.isArray(limpio.lista)).toBe(true);
    expect(limpio.lista).toHaveLength(3);
  });

  it('un hueco en un array se vuelve null y no descoloca el orden', () => {
    const limpio = stripUndefined({ lista: ['a', undefined, 'c'] });
    expect(limpio.lista).toEqual(['a', null, 'c']);
  });

  it('respeta null, cero y cadena vacía', () => {
    expect(stripUndefined({ a: null, b: 0, c: '', d: false })).toEqual({
      a: null,
      b: 0,
      c: '',
      d: false,
    });
  });

  it('no toca lo que no son objetos', () => {
    expect(stripUndefined(5)).toBe(5);
    expect(stripUndefined('hola')).toBe('hola');
    expect(stripUndefined(null)).toBe(null);
  });

  it('LA ALINEACIÓN de una mesa con humanos queda limpia', () => {
    // El caso real: un asiento humano no tiene `botProfile`, y ese undefined
    // dentro del roster hacía que "Empezar la partida" reventara online.
    const roster = seatsToRoster([
      {
        id: 's1',
        name: 'Oscar',
        kind: 'human',
        color: '#fff',
        order: 0,
        seatToken: 'tok',
        connected: true,
        isOwner: true,
      },
      {
        id: 's2',
        name: 'Bot',
        kind: 'bot',
        botProfile: 'cauto',
        color: '#000',
        order: 1,
        seatToken: 'tok2',
        connected: true,
        isOwner: false,
      },
    ] as never);

    expect(roster[0].botProfile).toBeUndefined();
    const limpio = stripUndefined({ roster });
    expect(JSON.stringify(limpio)).not.toContain('undefined');
    expect('botProfile' in (limpio.roster[0] as object)).toBe(false);
    expect(limpio.roster[1].botProfile).toBe('cauto');
  });

  it('ningún undefined sobrevive, mires donde mires', () => {
    const hondo = stripUndefined({
      a: { b: { c: { d: undefined, e: [{ f: undefined, g: 1 }] } } },
    });
    expect(JSON.stringify(hondo)).not.toContain('undefined');
    expect(hondo).toEqual({ a: { b: { c: { e: [{ g: 1 }] } } } });
  });
});
