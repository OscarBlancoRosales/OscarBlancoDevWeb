import { describe, expect, it } from 'vitest';
import {
  AVATARES,
  GESTOS_DEALER,
  MOMENTOS_DEALER,
  avatarPorDefecto,
  avatarPorId,
  fotoDelAvatar,
  fotoDelDealer,
  gestoDelDealer,
  repartirAvatares,
  sitiosEnLaMesa,
} from './poker-reparto';

/**
 * La mesa: quién se sienta y quién la dirige.
 *
 * Dos personas con la misma cara alrededor de una mesa de poker no se
 * distinguen, y el dealer acabaría pidiéndole cuentas a quien no era.
 */

describe('las caras del dealer', () => {
  it('todos los momentos tienen la suya', () => {
    for (const momento of MOMENTOS_DEALER) {
      expect(GESTOS_DEALER, momento).toContain(gestoDelDealer(momento));
    }
  });

  it('sin momento, espera tan tranquilo', () => {
    expect(gestoDelDealer('')).toBe('idle');
    expect(gestoDelDealer('lo-que-sea')).toBe('idle');
  });

  /** La cara tiene que ir con lo que dice, o el personaje no se sostiene. */
  it('mete prisa cabreado y pide explicaciones con sorna', () => {
    expect(gestoDelDealer('espabila')).toBe('angry');
    expect(gestoDelDealer('elDesviado')).toBe('sarcastic');
    expect(gestoDelDealer('acuerdoTotal')).toBe('joy');
    expect(gestoDelDealer('cafe')).toBe('sip');
  });

  it('y usa buena parte del repertorio, no dos caras', () => {
    const usados = new Set(MOMENTOS_DEALER.map((momento) => gestoDelDealer(momento)));
    expect(usados.size).toBeGreaterThanOrEqual(8);
  });

  it('la foto apunta a donde están los ficheros', () => {
    expect(fotoDelDealer('sarcastic')).toBe('/assets/poker/dealer/sarcastic.png');
  });
});

describe('los avatares elegibles', () => {
  it('hay de sobra para una mesa', () => {
    expect(AVATARES.length).toBeGreaterThan(20);
  });

  it('ninguno se repite', () => {
    expect(new Set(AVATARES.map((uno) => uno.id)).size).toBe(AVATARES.length);
  });

  it('todos tienen nombre y grupo', () => {
    for (const uno of AVATARES) {
      expect(uno.nombre.length, uno.id).toBeGreaterThan(1);
      expect(['leyendas', 'iconos'], uno.id).toContain(uno.grupo);
    }
  });

  /** Cada grupo vive en su carpeta, y la ruta tiene que saberlo. */
  it('cada uno apunta a la carpeta de su grupo', () => {
    expect(fotoDelAvatar('turing')).toBe('/assets/poker/legends/turing.png');
    expect(fotoDelAvatar('duck')).toBe('/assets/poker/avatars/duck.png');
  });

  it('se encuentran por su identificador', () => {
    expect(avatarPorId('hopper')?.nombre).toBe('Hopper');
    expect(avatarPorId('inventado')).toBeNull();
    expect(avatarPorId(null)).toBeNull();
  });
});

describe('repartir las caras de la mesa', () => {
  it('no se repite ninguna', () => {
    const caras = repartirAvatares([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    expect(new Set(Object.values(caras)).size).toBe(4);
  });

  it('lo que cada uno eligió no se lo quita nadie', () => {
    const caras = repartirAvatares([
      { id: 'a', avatar: 'turing' },
      { id: 'b', avatar: 'hopper' },
      { id: 'c' },
    ]);
    expect(caras['a']).toBe('turing');
    expect(caras['b']).toBe('hopper');
  });

  it('si dos piden el mismo, el segundo se lleva otro', () => {
    const caras = repartirAvatares([
      { id: 'a', avatar: 'turing' },
      { id: 'b', avatar: 'turing' },
    ]);
    expect(caras['a']).toBe('turing');
    expect(caras['b']).not.toBe('turing');
  });

  it('todos salen con uno del catálogo de verdad', () => {
    const caras = repartirAvatares([{ id: 'a' }, { id: 'b', avatar: 'inventado' }]);
    for (const [quien, cara] of Object.entries(caras)) {
      expect(avatarPorId(cara), quien).not.toBeNull();
    }
  });

  it('con la mesa vacía no reparte nada', () => {
    expect(repartirAvatares([])).toEqual({});
  });

  /** Cambiar de cara al recargar es peor que no tener cara. */
  it('a quien no elige se le da siempre el mismo', () => {
    expect(avatarPorDefecto('asiento-1')).toEqual(avatarPorDefecto('asiento-1'));
  });
});

describe('los sitios alrededor de la mesa', () => {
  it('hay uno por jugador', () => {
    expect(sitiosEnLaMesa(5)).toHaveLength(5);
  });

  it('sin nadie, ninguno', () => {
    expect(sitiosEnLaMesa(0)).toEqual([]);
  });

  it('con uno solo, no revienta', () => {
    expect(sitiosEnLaMesa(1)).toHaveLength(1);
  });

  /** Si alguien cae fuera de la mesa, se sienta en el aire. */
  it('todos caen dentro de la mesa', () => {
    for (const sitio of sitiosEnLaMesa(8)) {
      expect(sitio.x).toBeGreaterThanOrEqual(0);
      expect(sitio.x).toBeLessThanOrEqual(100);
      expect(sitio.y).toBeGreaterThanOrEqual(0);
      expect(sitio.y).toBeLessThanOrEqual(100);
    }
  });

  it('y no se sientan dos en el mismo sitio', () => {
    const sitios = sitiosEnLaMesa(6).map((uno) => `${uno.x},${uno.y}`);
    expect(new Set(sitios).size).toBe(6);
  });

  /** En una mesa de verdad uno se sienta abajo, no enfrente de sí mismo. */
  it('el primer sitio es el tuyo: abajo y en el centro', () => {
    for (const cuantos of [1, 2, 5, 9]) {
      const tuyo = sitiosEnLaMesa(cuantos)[0];
      expect(tuyo.x, `con ${cuantos}`).toBe(50);
      expect(tuyo.y, `con ${cuantos}`).toBeGreaterThan(80);
    }
  });

  it('el resto da la vuelta en el sentido de las agujas del reloj', () => {
    const [, segundo, , cuarto] = sitiosEnLaMesa(4);
    // Desde abajo se tira hacia la izquierda, se sube y se vuelve por la derecha.
    expect(segundo.x).toBeLessThan(20);
    expect(cuarto.x).toBeGreaterThan(80);
  });

  it('con cuatro, uno queda justo enfrente', () => {
    const enfrente = sitiosEnLaMesa(4)[2];
    expect(enfrente.x).toBe(50);
    expect(enfrente.y).toBeLessThan(20);
  });

  /**
   * Lo que distingue una mesa rectangular de un óvalo: los de un mismo lado
   * caen en línea, no escalonados por la curva. En el óvalo de antes, tres
   * personas por arriba salían a tres alturas distintas.
   */
  it('los lados son rectos, así que los de un lado se alinean', () => {
    const sitios = sitiosEnLaMesa(12);

    const porArriba = sitios.filter((uno) => uno.y < 15);
    expect(porArriba.length).toBeGreaterThanOrEqual(3);
    expect(new Set(porArriba.map((uno) => uno.y)).size, 'todos a la misma altura').toBe(1);

    const porAbajo = sitios.filter((uno) => uno.y > 85);
    expect(porAbajo.length).toBeGreaterThanOrEqual(3);
    expect(new Set(porAbajo.map((uno) => uno.y)).size, 'y los de la base igual').toBe(1);
  });

  /** Repartir por ángulo amontona en las esquinas; por distancia, no. */
  it('quedan repartidos a distancias parecidas', () => {
    const sitios = sitiosEnLaMesa(8);
    const saltos = sitios.map((uno, i) => {
      const siguiente = sitios[(i + 1) % sitios.length];
      return Math.hypot(siguiente.x - uno.x, siguiente.y - uno.y);
    });
    expect(Math.max(...saltos) / Math.min(...saltos)).toBeLessThan(1.35);
  });
});
