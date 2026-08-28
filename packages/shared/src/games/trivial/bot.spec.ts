import { describe, expect, it } from 'vitest';
import { ACIERTOS_POR_NIVEL, respuestaDelBot } from './bot';
import { rngFor } from '../../engine/rng';
import type { Pregunta } from './tipos';

const TEST: Pregunta = {
  id: 't1',
  tipo: 'test',
  enunciado: '¿Qué devuelve typeof null?',
  opciones: ['"null"', '"object"', '"undefined"', 'lanza'],
  correcta: 1,
  explicacion: 'El fallo más viejo del lenguaje.',
};

const ESTIMACION: Pregunta = {
  id: 'e1',
  tipo: 'estimacion',
  enunciado: '¿De qué año es git?',
  opciones: [],
  correcta: 2005,
  margen: 20,
  explicacion: 'De 2005.',
};

/** Cuántas de cien contesta bien ese nivel. */
function aciertosDe(nivel: 'pardillo' | 'apanado' | 'sabelotodo'): number {
  return Array.from({ length: 100 }, (_, semilla) =>
    respuestaDelBot(TEST, nivel, rngFor(semilla, 0, 'bot')),
  ).filter((valor) => valor === TEST.correcta).length;
}

describe('respuestaDelBot', () => {
  it('siempre contesta algo que existe', () => {
    for (let semilla = 0; semilla < 60; semilla++) {
      const valor = respuestaDelBot(TEST, 'apanado', rngFor(semilla, 0, 'bot'));
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(TEST.opciones.length);
    }
  });

  it('con la misma semilla contesta lo mismo', () => {
    expect(respuestaDelBot(TEST, 'apanado', rngFor(4, 0, 'bot'))).toBe(
      respuestaDelBot(TEST, 'apanado', rngFor(4, 0, 'bot')),
    );
  });

  it('el sabelotodo acierta casi siempre', () => {
    expect(aciertosDe('sabelotodo')).toBeGreaterThan(80);
  });

  it('el apanado acierta mas que falla, pero no siempre', () => {
    const aciertos = aciertosDe('apanado');
    expect(aciertos).toBeGreaterThan(45);
    expect(aciertos).toBeLessThan(85);
  });

  it('el pardillo va a lo que salga', () => {
    expect(aciertosDe('pardillo')).toBeLessThan(50);
  });

  it('cada nivel acierta mas que el anterior', () => {
    expect(aciertosDe('pardillo')).toBeLessThan(aciertosDe('apanado'));
    expect(aciertosDe('apanado')).toBeLessThan(aciertosDe('sabelotodo'));
  });

  it('los niveles declarados coinciden con lo que se mide', () => {
    expect(ACIERTOS_POR_NIVEL.pardillo).toBeLessThan(ACIERTOS_POR_NIVEL.apanado);
    expect(ACIERTOS_POR_NIVEL.apanado).toBeLessThan(ACIERTOS_POR_NIVEL.sabelotodo);
  });

  it('en una estimacion se acerca sin bordarla siempre', () => {
    const dichas = Array.from({ length: 40 }, (_, semilla) =>
      respuestaDelBot(ESTIMACION, 'apanado', rngFor(semilla, 0, 'bot')),
    );
    expect(dichas.every((valor) => Math.abs(valor - 2005) < 2005)).toBe(true);
    expect(new Set(dichas).size).toBeGreaterThan(1);
  });

  it('el sabelotodo se acerca mas que el pardillo en las estimaciones', () => {
    const error = (nivel: 'pardillo' | 'sabelotodo'): number =>
      Array.from({ length: 60 }, (_, semilla) =>
        Math.abs(respuestaDelBot(ESTIMACION, nivel, rngFor(semilla, 0, 'bot')) - 2005),
      ).reduce((suma, e) => suma + e, 0);

    expect(error('sabelotodo')).toBeLessThan(error('pardillo'));
  });

  it('en una estimacion siempre contesta un entero', () => {
    for (let semilla = 0; semilla < 40; semilla++) {
      const valor = respuestaDelBot(ESTIMACION, 'sabelotodo', rngFor(semilla, 0, 'bot'));
      expect(Number.isInteger(valor), String(semilla)).toBe(true);
    }
  });
});
