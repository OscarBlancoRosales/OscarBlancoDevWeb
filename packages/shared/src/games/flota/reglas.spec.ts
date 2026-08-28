import { describe, expect, it } from 'vitest';
import { LADO } from './tipos';
import { celdasDe, indice, tableroVacio, validarFlota } from './reglas';
import type { Barco } from './tipos';

const FLOTA_VALIDA: Barco[] = [
  { fila: 0, columna: 0, tamano: 5, orientacion: 'horizontal' },
  { fila: 1, columna: 0, tamano: 4, orientacion: 'horizontal' },
  { fila: 2, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 3, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 4, columna: 0, tamano: 2, orientacion: 'horizontal' },
];

describe('celdasDe', () => {
  it('recorre el barco hacia la derecha si es horizontal', () => {
    expect(celdasDe({ fila: 2, columna: 3, tamano: 3, orientacion: 'horizontal' })).toEqual([
      { fila: 2, columna: 3 },
      { fila: 2, columna: 4 },
      { fila: 2, columna: 5 },
    ]);
  });

  it('recorre el barco hacia abajo si es vertical', () => {
    expect(celdasDe({ fila: 7, columna: 1, tamano: 2, orientacion: 'vertical' })).toEqual([
      { fila: 7, columna: 1 },
      { fila: 8, columna: 1 },
    ]);
  });
});

describe('indice', () => {
  it('no cruza las filas con las columnas', () => {
    expect(indice(0, 0)).toBe(0);
    expect(indice(0, 1)).toBe(1);
    expect(indice(1, 0)).toBe(LADO);
    expect(indice(9, 9)).toBe(LADO * LADO - 1);
  });
});

describe('tableroVacio', () => {
  it('tiene una casilla por celda del tablero, todas sin disparar', () => {
    const tablero = tableroVacio();
    expect(tablero).toHaveLength(LADO * LADO);
    expect(tablero.every((casilla) => casilla === null)).toBe(true);
  });
});

describe('validarFlota', () => {
  it('acepta la flota completa', () => {
    expect(validarFlota(FLOTA_VALIDA)).toBeNull();
  });

  it('acepta barcos que se tocan por un costado', () => {
    const pegados = FLOTA_VALIDA.map((barco, i) =>
      i === 1 ? { ...barco, fila: 0, columna: 5 } : barco,
    );
    expect(validarFlota(pegados)).toBeNull();
  });

  it('acepta barcos verticales', () => {
    const derechos = FLOTA_VALIDA.map((barco, i) => ({
      ...barco,
      fila: 0,
      columna: i * 2,
      orientacion: 'vertical' as const,
    }));
    expect(validarFlota(derechos)).toBeNull();
  });

  it('rechaza un barco que se sale por la derecha', () => {
    const fuera = [...FLOTA_VALIDA];
    fuera[0] = { fila: 0, columna: 8, tamano: 5, orientacion: 'horizontal' };
    expect(validarFlota(fuera)?.code).toBe('barco-fuera');
  });

  it('rechaza un barco que se sale por abajo', () => {
    const fuera = [...FLOTA_VALIDA];
    fuera[0] = { fila: 8, columna: 0, tamano: 5, orientacion: 'vertical' };
    expect(validarFlota(fuera)?.code).toBe('barco-fuera');
  });

  it('rechaza dos barcos solapados', () => {
    const encima = [...FLOTA_VALIDA];
    encima[1] = { fila: 0, columna: 0, tamano: 4, orientacion: 'horizontal' };
    expect(validarFlota(encima)?.code).toBe('barcos-solapados');
  });

  it('rechaza una flota incompleta', () => {
    expect(validarFlota(FLOTA_VALIDA.slice(0, 4))?.code).toBe('flota-incompleta');
  });

  it('rechaza una flota con un barco de mas', () => {
    const dobleLancha: Barco = { fila: 6, columna: 0, tamano: 2, orientacion: 'horizontal' };
    expect(validarFlota([...FLOTA_VALIDA, dobleLancha])?.code).toBe('flota-incompleta');
  });

  it('rechaza una flota con tamanos que no son los de la flota', () => {
    const rara = [...FLOTA_VALIDA];
    rara[4] = { fila: 4, columna: 0, tamano: 4, orientacion: 'horizontal' };
    expect(validarFlota(rara)?.code).toBe('flota-incompleta');
  });
});
