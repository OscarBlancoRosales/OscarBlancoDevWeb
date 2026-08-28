import { describe, expect, it } from 'vitest';
import { formatUuid, makeUuid } from './uuid';

const CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('generar identificadores', () => {
  it('el v4 tiene la forma de siempre', () => {
    expect(makeUuid('v4')).toMatch(CANONICO);
  });

  it('y dice que es de la versión 4', () => {
    expect(makeUuid('v4')[14]).toBe('4');
  });

  it('dos seguidos no se repiten', () => {
    expect(makeUuid('v4')).not.toBe(makeUuid('v4'));
  });

  it('el v7 también tiene la forma canónica', () => {
    expect(makeUuid('v7')).toMatch(CANONICO);
  });

  it('y dice que es de la versión 7', () => {
    expect(makeUuid('v7')[14]).toBe('7');
  });

  /**
   * La gracia del v7 es esa: al llevar la hora delante, ordenar la lista de
   * texto es ordenarla por cuándo se creó. Por eso sirve como clave primaria
   * sin fragmentar el índice.
   */
  it('los v7 salen en orden creciente, que es para lo que valen', () => {
    const primero = makeUuid('v7', 1_700_000_000_000);
    const segundo = makeUuid('v7', 1_700_000_001_000);
    expect(segundo > primero).toBe(true);
  });

  it('dos v7 del mismo milisegundo siguen siendo distintos', () => {
    const a = makeUuid('v7', 1_700_000_000_000);
    const b = makeUuid('v7', 1_700_000_000_000);
    expect(a).not.toBe(b);
  });

  it('ambas versiones llevan la marca de variante', () => {
    for (const v of ['v4', 'v7'] as const) {
      expect(['8', '9', 'a', 'b'], v).toContain(makeUuid(v)[19]);
    }
  });
});

describe('darles formato', () => {
  const ejemplo = '0189d6e2-1c4a-7f3b-9c1d-2e5a7b9c1d3f';

  it('sin opciones se queda como está', () => {
    expect(formatUuid(ejemplo, {})).toBe(ejemplo);
  });

  it('en mayúsculas', () => {
    expect(formatUuid(ejemplo, { uppercase: true })).toBe(ejemplo.toUpperCase());
  });

  it('sin guiones', () => {
    const plano = formatUuid(ejemplo, { noDashes: true });
    expect(plano).not.toContain('-');
    expect(plano.length).toBe(32);
  });

  it('entre llaves, como lo pide C#', () => {
    expect(formatUuid(ejemplo, { braces: true })).toBe(`{${ejemplo}}`);
  });

  it('las opciones se combinan', () => {
    const todo = formatUuid(ejemplo, { uppercase: true, noDashes: true, braces: true });
    expect(todo).toBe(`{${ejemplo.replace(/-/g, '').toUpperCase()}}`);
  });
});
