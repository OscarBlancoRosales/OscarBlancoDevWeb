import { describe, expect, it } from 'vitest';
import { BANCO, ESCALETA, RONDAS_POR_PROGRAMA, repartir } from './banco';
import { BOMBA, PULSA, RAFAGA } from './pruebas';
import { OPCIONES } from '@devweb/shared/games/trivial/tipos';

describe('el banco', () => {
  it('tiene de sobra para una partida', () => {
    expect(BANCO.length).toBeGreaterThanOrEqual(RONDAS_POR_PROGRAMA);
  });

  it('tiene preguntas de las tres clases', () => {
    const clases = new Set(BANCO.map((pregunta) => pregunta.tipo));
    expect([...clases].sort()).toEqual(['estimacion', 'fallo', 'test']);
  });

  it('ninguna repite identificador', () => {
    expect(new Set(BANCO.map((pregunta) => pregunta.id)).size).toBe(BANCO.length);
  });

  it('las de opciones traen cuatro, y ninguna repetida', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo !== 'estimacion')) {
      expect(pregunta.opciones, pregunta.id).toHaveLength(OPCIONES);
      expect(new Set(pregunta.opciones).size, pregunta.id).toBe(OPCIONES);
    }
  });

  it('la respuesta de una de opciones cae dentro del rango', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo !== 'estimacion')) {
      expect(pregunta.correcta, pregunta.id).toBeGreaterThanOrEqual(0);
      expect(pregunta.correcta, pregunta.id).toBeLessThan(OPCIONES);
    }
  });

  it('las de pillar el fallo traen el codigo donde mirar', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo === 'fallo')) {
      expect(pregunta.codigo, pregunta.id).toBeTruthy();
    }
  });

  it('las de estimacion no traen opciones, y si su margen', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo === 'estimacion')) {
      expect(pregunta.opciones, pregunta.id).toHaveLength(0);
      expect(pregunta.margen, pregunta.id).toBeGreaterThan(0);
    }
  });

  it('todas explican la respuesta, que es la mitad de la gracia', () => {
    for (const pregunta of BANCO) {
      expect(pregunta.explicacion.length, pregunta.id).toBeGreaterThan(15);
      expect(pregunta.enunciado.length, pregunta.id).toBeGreaterThan(10);
    }
  });
});

describe('la escaleta del programa', () => {
  it('reparte sin repetir ninguna', () => {
    const tanda = repartir(1);
    expect(new Set(tanda.map((pregunta) => pregunta.id)).size).toBe(tanda.length);
  });

  it('con la misma semilla da el mismo programa', () => {
    expect(repartir(42)).toEqual(repartir(42));
  });

  it('con semillas distintas cambian las preguntas', () => {
    expect(JSON.stringify(repartir(1))).not.toBe(JSON.stringify(repartir(2)));
  });

  /**
   * Un programa que cambia de forma cada noche no es un programa: la apertura,
   * la subida y el cierre van siempre en el mismo sitio.
   */
  it('pero el orden de las secciones es siempre el mismo', () => {
    const seccionesDe = (semilla: number) => {
      const tipos = repartir(semilla).map((pregunta) => pregunta.tipo);
      return tipos.filter((tipo, i) => tipo !== tipos[i - 1]);
    };
    expect(seccionesDe(1)).toEqual(seccionesDe(999));
  });

  it('sigue la escaleta que está escrita', () => {
    const tanda = repartir(3);
    let desde = 0;
    for (const seccion of ESCALETA) {
      const tramo = tanda.slice(desde, desde + seccion.cuantas);
      expect(tramo.length, seccion.tipo).toBe(seccion.cuantas);
      for (const pregunta of tramo) expect(pregunta.tipo, pregunta.id).toBe(seccion.tipo);
      desde += seccion.cuantas;
    }
    expect(tanda).toHaveLength(desde);
  });

  it('están las seis pruebas, que es de lo que va el programa', () => {
    const clases = new Set(repartir(7).map((pregunta) => pregunta.tipo));
    expect(clases).toEqual(new Set(['test', 'pulsa', 'rafaga', 'fallo', 'estimacion', 'bomba']));
  });

  /** Sin preguntas de sobra, dos partidas seguidas traen lo mismo. */
  it('hay más preguntas de las que caben en una partida', () => {
    for (const seccion of ESCALETA) {
      const hay = [...BANCO, ...PULSA, ...RAFAGA, ...BOMBA].filter(
        (una) => una.tipo === seccion.tipo,
      );
      expect(hay.length, seccion.tipo).toBeGreaterThan(seccion.cuantas);
    }
  });

  it('la bomba cierra el programa, que es donde están los vuelcos', () => {
    expect(repartir(5).at(-1)?.tipo).toBe('bomba');
  });
});

describe('las preguntas de las pruebas nuevas', () => {
  const nuevas = [...PULSA, ...RAFAGA, ...BOMBA];

  it('todas explican la respuesta', () => {
    for (const pregunta of nuevas) {
      expect(pregunta.explicacion.length, pregunta.id).toBeGreaterThan(15);
    }
  });

  it('la correcta siempre existe entre las opciones', () => {
    for (const pregunta of nuevas) {
      expect(pregunta.correcta, pregunta.id).toBeGreaterThanOrEqual(0);
      expect(pregunta.correcta, pregunta.id).toBeLessThan(pregunta.opciones.length);
    }
  });

  it('la ráfaga es de verdadero o falso, no de cuatro opciones', () => {
    for (const pregunta of RAFAGA) {
      expect(pregunta.opciones, pregunta.id).toEqual(['Verdadero', 'Falso']);
    }
  });

  /** Con la mecha corriendo no da tiempo a leerse un párrafo. */
  it('las de la bomba se leen de un vistazo', () => {
    for (const pregunta of BOMBA) {
      expect(pregunta.enunciado.length, pregunta.id).toBeLessThan(70);
    }
  });

  it('ninguna se repite con otra', () => {
    const todas = [...BANCO, ...nuevas];
    expect(new Set(todas.map((una) => una.id)).size).toBe(todas.length);
  });
});
