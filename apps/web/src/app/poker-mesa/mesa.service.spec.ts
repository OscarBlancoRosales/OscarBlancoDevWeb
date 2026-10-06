import { describe, expect, it } from 'vitest';
import { carasDeLaMesa, caraSuelta } from './mesa.service';
import { avatarPorDefecto } from '@devweb/shared/games/poker-reparto';
import type { SeatInfo } from '@devweb/shared/contracts/rooms';

/**
 * Las caras de la mesa.
 *
 * La cara que eliges es un hecho: viaja en tu asiento desde que te sientas y
 * está guardada en la base. Lo que se prueba aquí es que la pantalla **no se
 * la invente nunca**, porque eso es lo que hacía que a quien sí había elegido
 * le apareciera otra cara de repente, sin haber tocado nada.
 *
 * Y se prueba aquí, en el servicio, y no en la pantalla: la mesa se prueba
 * contra un doble de este servicio, y un doble que devuelve la cara correcta
 * no prueba nada de esto. El fallo vivía justo en la capa que nadie miraba.
 */

function asiento(id: string, avatar?: string): SeatInfo {
  return {
    id,
    displayName: id,
    isBot: false,
    connected: true,
    isOwner: false,
    order: 0,
    ...(avatar !== undefined && { meta: { avatar } }),
  };
}

describe('las caras de la mesa', () => {
  it('cada uno sale con la que eligió', () => {
    const caras = carasDeLaMesa([asiento('yo', 'turing'), asiento('bea', 'hopper')]);

    expect(caras['yo']).toBe('turing');
    expect(caras['bea']).toBe('hopper');
  });

  it('y no se le repite a nadie', () => {
    const caras = carasDeLaMesa([asiento('a'), asiento('b'), asiento('c'), asiento('d')]);

    expect(new Set(Object.values(caras)).size).toBe(4);
  });

  /** El fallo que se veía: entra alguien y tú eres otro. */
  it('la tuya no cambia porque entre o salga gente', () => {
    const solos = carasDeLaMesa([asiento('yo', 'turing')]);
    const llenos = carasDeLaMesa([
      asiento('yo', 'turing'),
      asiento('bea', 'linus'),
      asiento('eva'),
      asiento('bot'),
    ]);

    expect(llenos['yo']).toBe(solos['yo']);
  });

  it('ni porque otro pida la misma', () => {
    // Pasa de verdad: dos pestañas, una reconexión con asiento nuevo, o dos
    // personas eligiendo a la vez.
    const caras = carasDeLaMesa([asiento('otro', 'turing'), asiento('yo', 'turing')]);

    expect(caras['otro']).toBe('turing');
    // Quien pierde el desempate se lleva la de al lado, no una cualquiera.
    expect(caras['yo']).toBe('hopper');
  });

  it('un avatar que ya no existe en el catálogo no tumba el reparto', () => {
    const caras = carasDeLaMesa([asiento('yo', 'un-avatar-de-hace-dos-versiones')]);

    expect(caras['yo']).toBeTruthy();
  });

  it('con la mesa vacía no reparte nada', () => {
    expect(carasDeLaMesa([])).toEqual({});
  });
});

describe('la cara de quien no sale en el reparto', () => {
  it('es la que eligió, aunque la mesa no haya llegado todavía', () => {
    // Aquí estaba el agujero: sin reparto se le daba la del hash de su
    // identificador, o sea una cualquiera, pisando lo que había elegido.
    expect(caraSuelta([asiento('yo', 'wizard')], 'yo')).toBe('wizard');
  });

  it('y solo si no eligió nada se le da una por su asiento', () => {
    expect(caraSuelta([asiento('yo')], 'yo')).toBe(avatarPorDefecto('yo').id);
  });

  it('a quien no está en la mesa también, que algo hay que pintar', () => {
    expect(caraSuelta([], 'fantasma')).toBe(avatarPorDefecto('fantasma').id);
  });
});
