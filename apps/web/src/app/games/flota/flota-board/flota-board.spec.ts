import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FlotaBoard } from './flota-board';
import { indice, tableroVacio } from '@devweb/shared/games/flota/reglas';

describe('FlotaBoard', () => {
  let fixture: ComponentFixture<FlotaBoard>;
  let board: FlotaBoard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FlotaBoard] }).compileComponents();
    fixture = TestBed.createComponent(FlotaBoard);
    board = fixture.componentInstance;
  });

  it('pinta diez filas de diez casillas', () => {
    expect(board.filas).toHaveLength(10);
    expect(board.filas[0]).toHaveLength(10);
  });

  it('marca las casillas que ocupa un barco propio', () => {
    board.barcos = [{ fila: 1, columna: 2, tamano: 3, orientacion: 'horizontal' }];
    const conBarco = board.filas.flat().filter((celda) => celda.conBarco);

    expect(conBarco.map((celda) => celda.pos)).toEqual([
      indice(1, 2),
      indice(1, 3),
      indice(1, 4),
    ]);
  });

  it('distingue tocado de hundido, que es lo que se pinta de otro color', () => {
    const casillas = tableroVacio();
    casillas[indice(0, 0)] = 'tocado';
    casillas[indice(0, 1)] = 'hundido';
    board.casillas = casillas;

    expect(board.filas[0][0].estado).toBe('tocado');
    expect(board.filas[0][1].estado).toBe('hundido');
  });

  it('sin estar activo no se puede pulsar ninguna casilla', () => {
    board.casillas = tableroVacio();
    expect(board.filas.flat().some((celda) => celda.pulsable)).toBe(false);
  });

  it('activo, solo se pueden pulsar las casillas sin disparar', () => {
    const casillas = tableroVacio();
    casillas[indice(4, 4)] = 'agua';
    board.casillas = casillas;
    board.activo = true;

    expect(board.filas.flat().filter((celda) => celda.pulsable)).toHaveLength(99);
    expect(board.filas[4][4].pulsable).toBe(false);
  });

  it('emite el disparo con la casilla pulsada', () => {
    board.casillas = tableroVacio();
    board.activo = true;
    let emitido: { fila: number; columna: number } | null = null;
    board.disparo.subscribe((tiro) => (emitido = tiro));

    board.pulsar(board.filas[7][3]);

    expect(emitido).toEqual({ fila: 7, columna: 3 });
  });

  it('no emite nada al pulsar donde ya se disparó', () => {
    const casillas = tableroVacio();
    casillas[indice(2, 2)] = 'tocado';
    board.casillas = casillas;
    board.activo = true;
    let emitido = 0;
    board.disparo.subscribe(() => (emitido += 1));

    board.pulsar(board.filas[2][2]);

    expect(emitido).toBe(0);
  });
});
