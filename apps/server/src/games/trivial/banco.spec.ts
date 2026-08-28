import { describe, expect, it } from 'vitest';
import { BANCO, PREGUNTAS_POR_PARTIDA, repartir } from './banco';
import { OPCIONES } from '@devweb/shared/games/trivial/tipos';

describe('el banco', () => {
  it('tiene de sobra para una partida', () => {
    expect(BANCO.length).toBeGreaterThanOrEqual(PREGUNTAS_POR_PARTIDA * 3);
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

describe('repartir', () => {
  it('da las que se le piden, sin repetir', () => {
    const tanda = repartir(1, 10);
    expect(tanda).toHaveLength(10);
    expect(new Set(tanda.map((pregunta) => pregunta.id)).size).toBe(10);
  });

  it('con la misma semilla da la misma tanda', () => {
    expect(repartir(42, 10)).toEqual(repartir(42, 10));
  });

  it('con semillas distintas no da siempre lo mismo', () => {
    expect(JSON.stringify(repartir(1, 10))).not.toBe(JSON.stringify(repartir(2, 10)));
  });

  it('si se piden mas de las que hay, da todas las que hay', () => {
    expect(repartir(1, BANCO.length + 50)).toHaveLength(BANCO.length);
  });

  it('mezcla clases de prueba en una partida', () => {
    const clases = new Set(repartir(7, PREGUNTAS_POR_PARTIDA).map((pregunta) => pregunta.tipo));
    expect(clases.size).toBeGreaterThan(1);
  });
});
