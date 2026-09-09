import { describe, expect, it } from 'vitest';
import { barcoEn, disparar, flotaHundida, indice, punteria, tableroVacio } from './reglas';
import type { Bando } from './tipos';

/** Un bando con un solo barco de dos: lo justo para hundirlo en dos disparos. */
const UN_BARCO: Bando = {
  barcos: [{ fila: 0, columna: 0, tamano: 2, orientacion: 'horizontal' }],
  recibidos: tableroVacio(),
};

describe('barcoEn', () => {
  it('encuentra el barco que ocupa esa casilla', () => {
    expect(barcoEn(UN_BARCO.barcos, 0, 1)?.tamano).toBe(2);
  });

  it('devuelve null donde no hay nada', () => {
    expect(barcoEn(UN_BARCO.barcos, 5, 5)).toBeNull();
  });
});

describe('disparar', () => {
  it('al agua deja la casilla en agua', () => {
    const { resultado, bando } = disparar(UN_BARCO, 5, 5);
    expect(resultado).toBe('agua');
    expect(bando.recibidos[indice(5, 5)]).toBe('agua');
  });

  it('sobre un barco deja tocado mientras le quede casilla', () => {
    const { resultado, bando } = disparar(UN_BARCO, 0, 0);
    expect(resultado).toBe('tocado');
    expect(bando.recibidos[indice(0, 0)]).toBe('tocado');
  });

  it('al caer la ultima casilla marca hundido el barco entero', () => {
    const tocado = disparar(UN_BARCO, 0, 0).bando;
    const { resultado, bando } = disparar(tocado, 0, 1);
    expect(resultado).toBe('hundido');
    expect(bando.recibidos[indice(0, 0)]).toBe('hundido');
    expect(bando.recibidos[indice(0, 1)]).toBe('hundido');
  });

  it('no hunde un barco por los impactos de otro', () => {
    const dos: Bando = {
      barcos: [
        { fila: 0, columna: 0, tamano: 2, orientacion: 'horizontal' },
        { fila: 3, columna: 0, tamano: 2, orientacion: 'horizontal' },
      ],
      recibidos: tableroVacio(),
    };
    const uno = disparar(dos, 0, 0).bando;
    const { resultado } = disparar(uno, 3, 0);
    expect(resultado).toBe('tocado');
  });

  it('no toca el bando original', () => {
    disparar(UN_BARCO, 0, 0);
    expect(UN_BARCO.recibidos[indice(0, 0)]).toBeNull();
  });
});

describe('flotaHundida', () => {
  it('es falsa mientras quede una casilla en pie', () => {
    expect(flotaHundida(disparar(UN_BARCO, 0, 0).bando)).toBe(false);
  });

  it('es cierta cuando han caido todas', () => {
    const medio = disparar(UN_BARCO, 0, 0).bando;
    expect(flotaHundida(disparar(medio, 0, 1).bando)).toBe(true);
  });

  it('no la da por hundida por disparos al agua', () => {
    expect(flotaHundida(disparar(UN_BARCO, 9, 9).bando)).toBe(false);
  });
});

describe('punteria', () => {
  it('cuenta los disparos recibidos y cuantos dieron', () => {
    const uno = disparar(UN_BARCO, 0, 0).bando;
    const dos = disparar(uno, 9, 9).bando;
    expect(punteria(dos)).toEqual({ disparos: 2, aciertos: 1, porcentaje: 50 });
  });

  it('cuenta como acierto la casilla de un barco hundido', () => {
    const uno = disparar(UN_BARCO, 0, 0).bando;
    const dos = disparar(uno, 0, 1).bando;
    expect(punteria(dos)).toEqual({ disparos: 2, aciertos: 2, porcentaje: 100 });
  });

  it('sin disparos no divide por cero', () => {
    expect(punteria(UN_BARCO)).toEqual({ disparos: 0, aciertos: 0, porcentaje: 0 });
  });
});
