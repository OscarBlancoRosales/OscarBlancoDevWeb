import { describe, expect, it } from 'vitest';
import { MOMENTOS } from './guion';
import {
  GESTOS,
  REPARTO,
  fotoDelPersonaje,
  fotoDelPresentador,
  gestoDe,
  personajePorDefecto,
  personajePorId,
  repartirCaras,
} from './reparto';

/**
 * El reparto del programa.
 *
 * Un presentador que pone la misma cara mientras te felicita y mientras te
 * estalla la bomba no está presentando nada, así que lo que se comprueba aquí
 * es que cada momento tiene su gesto y que las imágenes existen donde se dice.
 */

describe('las caras del presentador', () => {
  it('todos los momentos del programa tienen la suya', () => {
    for (const momento of MOMENTOS) {
      expect(GESTOS, momento).toContain(gestoDe(momento));
    }
  });

  it('sin momento -antes de empezar- se queda quieto', () => {
    expect(gestoDe('')).toBe('idle');
    expect(gestoDe('algo-que-no-existe')).toBe('idle');
  });

  /** Si celebrase una explosión, el personaje se vendría abajo. */
  it('las buenas noticias y los desastres no ponen la misma cara', () => {
    expect(gestoDe('aciertaAlguien')).toBe('yes');
    expect(gestoDe('explota')).toBe('wrong');
    expect(gestoDe('nadieAcierta')).toBe('wrong');
    expect(gestoDe('remonta')).toBe('yes');
  });

  it('y usa toda la baraja, no dos caras', () => {
    const usados = new Set(MOMENTOS.map((momento) => gestoDe(momento)));
    expect(usados.size).toBeGreaterThanOrEqual(4);
  });

  it('la foto apunta a donde están los ficheros', () => {
    expect(fotoDelPresentador('talk')).toBe('/assets/trivial/host/talk.png');
  });
});

describe('el reparto elegible', () => {
  /** Nadie debería quedarse sin poder elegir porque otro haya llegado antes. */
  it('hay más personajes que asientos en una mesa', () => {
    expect(REPARTO.length).toBeGreaterThan(8);
  });

  it('ninguno se repite', () => {
    expect(new Set(REPARTO.map((uno) => uno.id)).size).toBe(REPARTO.length);
  });

  it('todos tienen nombre y una línea que los describe', () => {
    for (const uno of REPARTO) {
      expect(uno.nombre.length, uno.id).toBeGreaterThan(2);
      expect(uno.pinta.length, uno.id).toBeGreaterThan(15);
    }
  });

  it('se encuentran por su identificador', () => {
    expect(personajePorId('bolt')?.nombre).toBe('Bolt');
  });

  it('y uno que no existe no revienta nada', () => {
    expect(personajePorId('inventado')).toBeNull();
    expect(personajePorId(null)).toBeNull();
  });

  it('la foto apunta a donde están los ficheros', () => {
    expect(fotoDelPersonaje('viper')).toBe('/assets/trivial/cast/viper.png');
  });
});

describe('repartir las caras de la mesa', () => {
  /** Dos jugadores con la misma cara se confunden a la primera. */
  it('no se repite ninguna', () => {
    const caras = repartirCaras([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    expect(new Set(Object.values(caras)).size).toBe(4);
  });

  it('lo que cada uno eligió no se lo quita nadie', () => {
    const caras = repartirCaras([
      { id: 'a', personaje: 'bolt' },
      { id: 'b', personaje: 'viper' },
      { id: 'c' },
    ]);
    expect(caras['a']).toBe('bolt');
    expect(caras['b']).toBe('viper');
  });

  /** Si dos piden el mismo, el segundo se lleva otro; nadie se queda sin cara. */
  it('si dos piden el mismo, el segundo se lleva otro', () => {
    const caras = repartirCaras([
      { id: 'a', personaje: 'bolt' },
      { id: 'b', personaje: 'bolt' },
    ]);
    expect(caras['a']).toBe('bolt');
    expect(caras['b']).not.toBe('bolt');
    expect(caras['b']).toBeDefined();
  });

  it('quien no elige coge el suyo si está libre', () => {
    const suyo = personajePorDefecto('solitario').id;
    expect(repartirCaras([{ id: 'solitario' }])['solitario']).toBe(suyo);
  });

  it('todos salen con una cara del reparto de verdad', () => {
    const caras = repartirCaras([{ id: 'a' }, { id: 'b', personaje: 'inventado' }, { id: 'c' }]);
    for (const [quien, cara] of Object.entries(caras)) {
      expect(personajePorId(cara), quien).not.toBeNull();
    }
  });

  it('con la mesa vacía no reparte nada', () => {
    expect(repartirCaras([])).toEqual({});
  });

  /** Con más gente que personajes se repite, y da igual: no caben tantos. */
  it('con más asientos que personajes no se cuelga', () => {
    const muchos = [...Array(REPARTO.length + 3)].map((_uno, i) => ({ id: `seat-${i}` }));
    expect(Object.keys(repartirCaras(muchos))).toHaveLength(muchos.length);
  });
});

describe('a quien no elige', () => {
  /** Cambiar de cara al recargar la página es peor que no tener cara. */
  it('se le da siempre el mismo', () => {
    expect(personajePorDefecto('asiento-1')).toEqual(personajePorDefecto('asiento-1'));
  });

  it('y a asientos distintos, no siempre el mismo', () => {
    const repartidos = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seat) => personajePorDefecto(seat).id),
    );
    expect(repartidos.size).toBeGreaterThan(1);
  });

  it('siempre uno del reparto de verdad', () => {
    for (const seat of ['x', 'yy', 'zzz', 'asiento-largo-de-verdad']) {
      expect(REPARTO, seat).toContain(personajePorDefecto(seat));
    }
  });
});
