import { describe, expect, it } from 'vitest';
import { BONUS_POR_ORDEN, PUNTOS_ACIERTO, aciertaCon, puntosDe, repartoDe } from './reglas';
import type { Pregunta, Respuesta } from './tipos';

const TEST: Pregunta = {
  id: 't1',
  tipo: 'test',
  enunciado: '¿Qué devuelve typeof null?',
  opciones: ['"null"', '"object"', '"undefined"', 'lanza'],
  correcta: 1,
  explicacion: 'Un fallo de la primera implementación que ya no se puede arreglar.',
};

const ESTIMACION: Pregunta = {
  id: 'e1',
  tipo: 'estimacion',
  enunciado: '¿En qué año salió la primera versión de git?',
  opciones: [],
  correcta: 2005,
  margen: 20,
  explicacion: 'Abril de 2005, en dos semanas.',
};

function respuestas(entradas: Record<string, [valor: number, orden: number]>): Record<string, Respuesta> {
  return Object.fromEntries(
    Object.entries(entradas).map(([seat, [valor, orden]]) => [seat, { valor, orden }]),
  );
}

describe('aciertaCon', () => {
  it('en un test, acierta quien señala la opcion buena', () => {
    expect(aciertaCon(TEST, 1)).toBe(true);
    expect(aciertaCon(TEST, 0)).toBe(false);
  });

  it('en una estimacion, solo la cifra exacta cuenta como acierto', () => {
    expect(aciertaCon(ESTIMACION, 2005)).toBe(true);
    expect(aciertaCon(ESTIMACION, 2006)).toBe(false);
  });
});

describe('puntuar un test', () => {
  it('acertar el primero da los cien y el bonus entero', () => {
    const dadas = respuestas({ ana: [1, 0] });
    expect(puntosDe(TEST, dadas, 'ana')).toBe(PUNTOS_ACIERTO + BONUS_POR_ORDEN[0]);
  });

  it('acertar el segundo da los cien y algo menos', () => {
    const dadas = respuestas({ ana: [1, 0], bea: [1, 1] });
    expect(puntosDe(TEST, dadas, 'bea')).toBe(PUNTOS_ACIERTO + BONUS_POR_ORDEN[1]);
  });

  it('el quinto en acertar ya no cobra bonus', () => {
    const dadas = respuestas({ a: [1, 0], b: [1, 1], c: [1, 2], d: [1, 3], e: [1, 4] });
    expect(puntosDe(TEST, dadas, 'e')).toBe(PUNTOS_ACIERTO);
  });

  it('fallar no da nada, y nunca resta', () => {
    const dadas = respuestas({ ana: [0, 0] });
    expect(puntosDe(TEST, dadas, 'ana')).toBe(0);
  });

  it('no contestar no da nada', () => {
    expect(puntosDe(TEST, respuestas({ ana: [1, 0] }), 'bea')).toBe(0);
  });

  it('quien falla antes no le gasta el bonus a quien acierta despues', () => {
    // Bea contesta la segunda, pero es la primera que acierta: se lleva el
    // bonus entero. El bonus premia acertar pronto, no pulsar pronto.
    const dadas = respuestas({ ana: [0, 0], bea: [1, 1] });
    expect(puntosDe(TEST, dadas, 'bea')).toBe(PUNTOS_ACIERTO + BONUS_POR_ORDEN[0]);
  });
});

describe('puntuar una estimacion', () => {
  it('bordar la cifra da los cien y la propina', () => {
    expect(puntosDe(ESTIMACION, respuestas({ ana: [2005, 0] }), 'ana')).toBe(120);
  });

  it('quedarse cerca da casi todo, pero no todo', () => {
    // Un año de error sobre un margen de veinte: se pierde la veinteava parte.
    expect(puntosDe(ESTIMACION, respuestas({ ana: [2006, 0] }), 'ana')).toBe(95);
  });

  it('cuanto mas lejos, menos', () => {
    const cerca = puntosDe(ESTIMACION, respuestas({ ana: [2006, 0] }), 'ana');
    const lejos = puntosDe(ESTIMACION, respuestas({ ana: [2015, 0] }), 'ana');
    expect(lejos).toBeLessThan(cerca);
    expect(lejos).toBeGreaterThan(0);
  });

  it('quedarse corto y pasarse lo mismo puntuan igual', () => {
    const corto = puntosDe(ESTIMACION, respuestas({ ana: [1905, 0] }), 'ana');
    const largo = puntosDe(ESTIMACION, respuestas({ ana: [2105, 0] }), 'ana');
    expect(corto).toBe(largo);
  });

  it('salirse del margen no da nada', () => {
    expect(puntosDe(ESTIMACION, respuestas({ ana: [2030, 0] }), 'ana')).toBe(0);
  });

  it('sin margen declarado se mide contra la propia respuesta', () => {
    const sinMargen: Pregunta = { ...ESTIMACION, margen: undefined };
    expect(puntosDe(sinMargen, respuestas({ ana: [4010, 0] }), 'ana')).toBe(0);
    expect(puntosDe(sinMargen, respuestas({ ana: [2006, 0] }), 'ana')).toBe(100);
  });

  it('en las estimaciones no hay bonus por orden', () => {
    const dadas = respuestas({ ana: [2005, 0], bea: [2005, 1] });
    expect(puntosDe(ESTIMACION, dadas, 'ana')).toBe(puntosDe(ESTIMACION, dadas, 'bea'));
  });

  it('con la respuesta correcta a cero no divide entre cero', () => {
    const cero: Pregunta = { ...ESTIMACION, correcta: 0, margen: undefined };
    expect(puntosDe(cero, respuestas({ ana: [0, 0] }), 'ana')).toBe(120);
    expect(puntosDe(cero, respuestas({ ana: [50, 0] }), 'ana')).toBe(0);
  });
});

describe('repartoDe', () => {
  it('da los puntos de todos los que contestaron', () => {
    const dadas = respuestas({ ana: [1, 0], bea: [0, 1] });
    expect(repartoDe(TEST, dadas)).toEqual({
      ana: PUNTOS_ACIERTO + BONUS_POR_ORDEN[0],
      bea: 0,
    });
  });

  it('sin respuestas no reparte nada', () => {
    expect(repartoDe(TEST, {})).toEqual({});
  });
});
