import { describe, expect, it } from 'vitest';
import { rngFor } from '../../engine/rng';
import { flotaAleatoria, siguienteDisparo } from './bot';
import { indice, tableroVacio, validarFlota } from './reglas';

const CONTIGUAS_A_44 = [indice(3, 4), indice(5, 4), indice(4, 3), indice(4, 5)];

describe('flotaAleatoria', () => {
  it('coloca siempre una flota legal', () => {
    for (let semilla = 0; semilla < 100; semilla++) {
      expect(validarFlota(flotaAleatoria(rngFor(semilla, 0, 'flota')))).toBeNull();
    }
  });

  it('con la misma semilla coloca la misma flota', () => {
    expect(flotaAleatoria(rngFor(3, 0, 'flota'))).toEqual(flotaAleatoria(rngFor(3, 0, 'flota')));
  });

  it('con semillas distintas no siempre coloca lo mismo', () => {
    const unas = JSON.stringify(flotaAleatoria(rngFor(1, 0, 'flota')));
    const otras = JSON.stringify(flotaAleatoria(rngFor(2, 0, 'flota')));
    expect(unas).not.toBe(otras);
  });
});

describe('siguienteDisparo', () => {
  it('nunca repite una casilla ya disparada', () => {
    const rejilla = tableroVacio();
    for (let casilla = 0; casilla < rejilla.length - 1; casilla++) rejilla[casilla] = 'agua';
    const tiro = siguienteDisparo(rejilla, 'novato', rngFor(1, 0, 'flota'));
    expect(indice(tiro.fila, tiro.columna)).toBe(rejilla.length - 1);
  });

  it('es determinista con la misma semilla', () => {
    const uno = siguienteDisparo(tableroVacio(), 'marino', rngFor(9, 3, 'flota'));
    const dos = siguienteDisparo(tableroVacio(), 'marino', rngFor(9, 3, 'flota'));
    expect(uno).toEqual(dos);
  });

  it('el novato no remata: dispara donde sea', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 4)] = 'tocado';
    // Con cien semillas, un bot que rastreara caería siempre en las contiguas.
    const tiros = Array.from({ length: 100 }, (_, semilla) =>
      indice(...coordenadas(siguienteDisparo(rejilla, 'novato', rngFor(semilla, 0, 'flota')))),
    );
    expect(tiros.some((tiro) => !CONTIGUAS_A_44.includes(tiro))).toBe(true);
  });

  it('el marino remata junto a un impacto sin hundir', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 4)] = 'tocado';
    const tiro = siguienteDisparo(rejilla, 'marino', rngFor(1, 0, 'flota'));
    expect(CONTIGUAS_A_44).toContain(indice(tiro.fila, tiro.columna));
  });

  it('el marino no remata sobre una casilla ya disparada', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 4)] = 'tocado';
    rejilla[indice(3, 4)] = 'agua';
    rejilla[indice(5, 4)] = 'agua';
    for (let semilla = 0; semilla < 20; semilla++) {
      const tiro = siguienteDisparo(rejilla, 'marino', rngFor(semilla, 0, 'flota'));
      expect([indice(4, 3), indice(4, 5)]).toContain(indice(tiro.fila, tiro.columna));
    }
  });

  it('el marino ignora un barco ya hundido', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 4)] = 'hundido';
    const tiro = siguienteDisparo(rejilla, 'marino', rngFor(1, 0, 'flota'));
    expect(CONTIGUAS_A_44).not.toContain(indice(tiro.fila, tiro.columna));
  });

  it('el almirante caza solo en una paridad', () => {
    for (let semilla = 0; semilla < 50; semilla++) {
      const tiro = siguienteDisparo(tableroVacio(), 'almirante', rngFor(semilla, 0, 'flota'));
      expect((tiro.fila + tiro.columna) % 2).toBe(0);
    }
  });

  it('el almirante abandona la paridad para rematar', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 3)] = 'tocado';
    const tiro = siguienteDisparo(rejilla, 'almirante', rngFor(1, 0, 'flota'));
    expect([indice(3, 3), indice(5, 3), indice(4, 2), indice(4, 4)]).toContain(
      indice(tiro.fila, tiro.columna),
    );
  });

  it('el almirante vuelve a disparar cuando su paridad se agota', () => {
    const rejilla = tableroVacio();
    for (let casilla = 0; casilla < rejilla.length; casilla++) {
      const fila = Math.floor(casilla / 10);
      if ((fila + (casilla % 10)) % 2 === 0) rejilla[casilla] = 'agua';
    }
    const tiro = siguienteDisparo(rejilla, 'almirante', rngFor(1, 0, 'flota'));
    expect(rejilla[indice(tiro.fila, tiro.columna)]).toBeNull();
  });
});

function coordenadas(tiro: { fila: number; columna: number }): [number, number] {
  return [tiro.fila, tiro.columna];
}
