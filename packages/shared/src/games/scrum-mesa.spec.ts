import { describe, expect, it } from 'vitest';
import {
  DESVIO_LEVE,
  bandosDe,
  desvioDe,
  elMasDesviado,
  estadisticaDe,
  hayDosBandos,
  numericos,
} from './scrum-mesa';
import type { ScrumVote } from './scrum';
import type { VotoNumerico } from './scrum-mesa';

/**
 * Las cuentas de una votación de planning poker.
 *
 * Esto decide a quién se señala delante de todo el equipo, así que una
 * desviación mal contada no es un fallo de pintado: es pedirle explicaciones a
 * la persona equivocada.
 */

/** Unos votos, escritos como se leen. */
function votos(...valores: number[]): VotoNumerico[] {
  return valores.map((valor, i) => ({ seatId: `seat-${i}`, valor }));
}

describe('qué votos entran en las cuentas', () => {
  it('los números, sí', () => {
    const mesa: Record<string, ScrumVote> = {
      ana: { tipo: 'numero', valor: 5 },
      bea: { tipo: 'numero', valor: 8 },
    };
    expect(numericos(mesa)).toEqual([
      { seatId: 'ana', valor: 5 },
      { seatId: 'bea', valor: 8 },
    ]);
  });

  /** Promediar un café con un ocho da un cuatro que no significa nada. */
  it('el café y el porro, no', () => {
    const mesa: Record<string, ScrumVote> = {
      ana: { tipo: 'numero', valor: 8 },
      bea: { tipo: 'cafe' },
      eva: { tipo: 'porro' },
    };
    expect(numericos(mesa)).toEqual([{ seatId: 'ana', valor: 8 }]);
  });
});

describe('las cuentas de la ronda', () => {
  it('la media y la mediana', () => {
    const stats = estadisticaDe(votos(1, 3, 5, 11));
    expect(stats.media).toBe(5);
    expect(stats.mediana).toBe(4);
  });

  it('la mediana con un número impar de votos es el de en medio', () => {
    expect(estadisticaDe(votos(1, 5, 100)).mediana).toBe(5);
  });

  it('el mínimo y el máximo', () => {
    const stats = estadisticaDe(votos(3, 8, 1));
    expect([stats.minimo, stats.maximo]).toEqual([1, 8]);
  });

  it('y la desviación', () => {
    // Media 5, desviaciones de 2 y 2: la típica es 2.
    expect(estadisticaDe(votos(3, 7)).desviacion).toBe(2);
  });

  it('con todos votando lo mismo, la desviación es cero', () => {
    expect(estadisticaDe(votos(5, 5, 5)).desviacion).toBe(0);
  });

  it('sin votos no revienta', () => {
    const stats = estadisticaDe([]);
    expect(stats.votantes).toBe(0);
    expect(stats.acuerdo).toBe('esperando');
  });

  /** Con un voto la desviación es cero y diría «consenso total»: mentira. */
  it('con un solo voto todavía no se juzga a nadie', () => {
    expect(estadisticaDe(votos(5)).acuerdo).toBe('esperando');
  });

  it('los decimales se cortan en dos, que es lo que se lee', () => {
    expect(estadisticaDe(votos(1, 2)).media).toBe(1.5);
    expect(estadisticaDe(votos(1, 1, 2)).media).toBe(1.33);
  });
});

describe('el grado de acuerdo', () => {
  it('todos igual: acuerdo total', () => {
    expect(estadisticaDe(votos(5, 5, 5)).acuerdo).toBe('total');
  });

  it('cerca: consenso', () => {
    expect(estadisticaDe(votos(5, 6, 5)).acuerdo).toBe('consenso');
  });

  it('repartidos: dispersión', () => {
    expect(estadisticaDe(votos(3, 5, 8)).acuerdo).toBe('dispersion');
  });

  it('a la greña: desacuerdo', () => {
    expect(estadisticaDe(votos(1, 3, 13, 21)).acuerdo).toBe('desacuerdo');
  });
});

describe('quién se ha salido del corro', () => {
  it('el que se aleja de la media', () => {
    const mesa = votos(5, 5, 5, 20);
    const stats = estadisticaDe(mesa);
    expect(desvioDe(20, stats)).toBeGreaterThan(DESVIO_LEVE);
    expect(desvioDe(5, stats)).toBeLessThan(DESVIO_LEVE);
  });

  /** Si los cinco votaron cinco, no hay de qué hablar. */
  it('con la mesa de acuerdo, nadie se desvía', () => {
    expect(desvioDe(5, estadisticaDe(votos(5, 5, 5)))).toBe(0);
  });

  it('se señala al que más se sale', () => {
    const mesa = votos(3, 3, 3, 21);
    const peor = elMasDesviado(mesa, estadisticaDe(mesa));
    expect(peor?.valor).toBe(21);
  });

  /**
   * Con la mesa casi de acuerdo la desviación típica es minúscula, así que un
   * seis frente a dos cincos sale a tres desviaciones y el z-score lo canta
   * como un outlier. Pedirle explicaciones por eso es ridículo.
   */
  it('pero no por un punto de diferencia, por mucho que diga el z-score', () => {
    const mesa = votos(5, 5, 6);
    expect(desvioDe(6, estadisticaDe(mesa))).toBeGreaterThan(DESVIO_LEVE);
    expect(elMasDesviado(mesa, estadisticaDe(mesa))).toBeNull();
  });

  it('y sí cuando la distancia es de verdad', () => {
    const mesa = votos(5, 5, 13);
    expect(elMasDesviado(mesa, estadisticaDe(mesa))?.valor).toBe(13);
  });

  it('con un solo voto no se señala a nadie', () => {
    const mesa = votos(8);
    expect(elMasDesviado(mesa, estadisticaDe(mesa))).toBeNull();
  });
});

describe('cuando la mesa se parte en dos', () => {
  /** Dos formas de entender la tarea, no una duda repartida. */
  it('tres bajos y tres altos son dos bandos', () => {
    const mesa = votos(1, 1, 2, 13, 13, 21);
    expect(hayDosBandos(mesa)).toBe(true);

    const bandos = bandosDe(mesa);
    expect(bandos?.bajos.map((uno) => uno.valor)).toEqual([1, 1, 2]);
    expect(bandos?.altos.map((uno) => uno.valor)).toEqual([13, 13, 21]);
  });

  it('un reparto continuo no son dos bandos', () => {
    expect(hayDosBandos(votos(1, 2, 3, 5, 8))).toBe(false);
  });

  it('con todos de acuerdo, tampoco', () => {
    expect(hayDosBandos(votos(5, 5, 5, 5))).toBe(false);
  });

  it('y con poca gente no se parte la mesa', () => {
    expect(hayDosBandos(votos(1, 21))).toBe(false);
  });
});
