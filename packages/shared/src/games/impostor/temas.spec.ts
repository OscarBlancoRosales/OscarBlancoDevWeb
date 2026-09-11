import { describe, expect, it } from 'vitest';
import {
  TEMAS,
  TEMA_MEZCLA,
  nombreDelTema,
  temaPorId,
  terminoDeLaPalabra,
  terminosDe,
} from './temas';
import { ELENCO, caraPorDefecto, caraPorId, repartirCaras } from './caras';

describe('el banco de palabras', () => {
  it('todos los temas traen palabras de sobra para una noche', () => {
    for (const tema of TEMAS) {
      expect(tema.terminos.length, tema.id).toBeGreaterThanOrEqual(100);
    }
  });

  it('fútbol es un mazo y mezcla épocas', () => {
    const futbol = temaPorId('futbol');
    expect(futbol).not.toBeNull();
    const nombres = (futbol?.terminos ?? []).flatMap((uno) => [uno.a, uno.b]).join(' ');
    expect(nombres).toMatch(/Pelé|Maradona|Cruyff|Di Stéfano/);
    expect(nombres).toMatch(/Messi|Haaland|Mbappé|Vinicius|Bellingham/);
  });

  it('famosos no se come a los futbolistas', () => {
    const delFutbol = new Set(
      terminosDe('futbol').flatMap((uno) => [uno.a.toLowerCase(), uno.b.toLowerCase()]),
    );
    for (const uno of terminosDe('famosos')) {
      expect(delFutbol.has(uno.a.toLowerCase()), uno.a).toBe(false);
      expect(delFutbol.has(uno.b.toLowerCase()), uno.b).toBe(false);
    }
  });

  it('varios mazos juntos suman las palabras de cada uno', () => {
    const juntos = terminosDe('futbol,comida');
    expect(juntos.length).toBe(terminosDe('futbol').length + terminosDe('comida').length);
  });

  it('el nombre de varios mazos se lee entero', () => {
    expect(nombreDelTema('futbol,famosos')).toContain(' + ');
  });

  it('no hay dos temas con el mismo identificador', () => {
    expect(new Set(TEMAS.map((tema) => tema.id)).size).toBe(TEMAS.length);
  });

  it('ninguna palabra se repite dentro de su tema', () => {
    for (const tema of TEMAS) {
      const palabras = tema.terminos.flatMap((termino) => [termino.a, termino.b]);
      expect(new Set(palabras).size, tema.id).toBe(palabras.length);
    }
  });

  it('la parecida nunca es la misma palabra', () => {
    for (const tema of TEMAS) {
      for (const termino of tema.terminos) {
        expect(termino.a, tema.id).not.toBe(termino.b);
      }
    }
  });

  it('cada palabra trae tres pistas distintas', () => {
    for (const tema of TEMAS) {
      for (const termino of tema.terminos) {
        expect(new Set(termino.pistas).size, `${tema.id}/${termino.a}`).toBe(3);
      }
    }
  });

  /**
   * Una pista que es la palabra la delata entera, y el juego se acaba en el
   * primer turno.
   */
  it('ninguna palabra se pasa de los cuarenta', () => {
    for (const tema of TEMAS) {
      for (const termino of tema.terminos) {
        expect(termino.a.length, `${tema.id}/${termino.a}`).toBeLessThanOrEqual(40);
        expect(termino.b.length, `${tema.id}/${termino.b}`).toBeLessThanOrEqual(40);
      }
    }
  });

  it('ninguna pista dice la palabra', () => {
    for (const tema of TEMAS) {
      for (const termino of tema.terminos) {
        for (const pista of termino.pistas) {
          expect(pista.toLowerCase(), `${tema.id}/${termino.a}`).not.toBe(termino.a.toLowerCase());
        }
      }
    }
  });

  it('la mezcla junta las palabras de todos los temas', () => {
    const total = TEMAS.reduce((suma, tema) => suma + tema.terminos.length, 0);
    expect(terminosDe(TEMA_MEZCLA)).toHaveLength(total);
  });

  it('un tema que no existe se trata como mezcla al nombrarlo', () => {
    expect(nombreDelTema('lo-que-sea')).toBe('Mezcla');
    expect(temaPorId('lo-que-sea')).toBeNull();
  });

  it('la palabra del infiltrado encuentra su pareja', () => {
    const tema = TEMAS[0];
    const primero = tema.terminos[0];
    expect(terminoDeLaPalabra(tema.id, primero.b)).toEqual(primero);
  });
});

describe('las caras', () => {
  it('no hay dos con el mismo identificador', () => {
    expect(new Set(ELENCO.map((cara) => cara.id)).size).toBe(ELENCO.length);
  });

  it('quien no elige se queda siempre con la misma', () => {
    expect(caraPorDefecto('seat-1')).toEqual(caraPorDefecto('seat-1'));
  });

  it('lo que eligió cada uno no se lo quita nadie', () => {
    const dadas = repartirCaras([
      { id: 'ana', cara: 'troll' },
      { id: 'bea', cara: 'doge' },
    ]);
    expect(dadas).toEqual({ ana: 'troll', bea: 'doge' });
  });

  it('dos que piden la misma no acaban con la misma', () => {
    const dadas = repartirCaras([
      { id: 'ana', cara: 'troll' },
      { id: 'bea', cara: 'troll' },
    ]);
    expect(dadas['ana']).toBe('troll');
    expect(dadas['bea']).not.toBe('troll');
  });

  it('en una mesa llena no se repite ninguna', () => {
    const asientos = Array.from({ length: 16 }, (_, i) => ({ id: `seat-${i}` }));
    const dadas = Object.values(repartirCaras(asientos));
    expect(new Set(dadas).size).toBe(asientos.length);
  });

  it('una cara que no existe no se reparte', () => {
    expect(caraPorId('no-existe')).toBeNull();
  });
});
