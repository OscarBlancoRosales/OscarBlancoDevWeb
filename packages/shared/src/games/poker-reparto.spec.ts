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

  /** Si alguien cae fuera del óvalo, se sienta en el aire. */
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

  /** El hueco de abajo en medio es el tuyo: uno no se ve a sí mismo enfrente. */
  it('deja libre el centro de abajo, que es donde estás tú', () => {
    const enMiSitio = sitiosEnLaMesa(6).filter((uno) => uno.y > 78 && uno.x > 35 && uno.x < 65);
    expect(enMiSitio).toHaveLength(0);
  });

  it('y se reparten a los lados y por arriba', () => {
    const sitios = sitiosEnLaMesa(5);
    expect(sitios[0].x).toBeLessThan(30);
    expect(sitios[sitios.length - 1].x).toBeGreaterThan(70);
    expect(Math.min(...sitios.map((uno) => uno.y))).toBeLessThan(25);
  });
});
