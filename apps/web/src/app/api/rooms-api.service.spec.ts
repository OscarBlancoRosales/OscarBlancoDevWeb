import { describe, expect, it, vi } from 'vitest';
import { RoomsApiService } from './rooms-api.service';
import type { ApiClient } from './api-client';

/**
 * Lo que este servicio manda de verdad por el cable.
 *
 * Los juegos prueban contra un doble de `RoomsApiService`, así que comprueban
 * que le pasan la cara elegida y se quedan tan tranquilos. Aquí abajo estaba el
 * agujero: el cuerpo de la petición se arma a mano campo por campo, y lo que no
 * se copie se pierde sin que nadie se entere.
 */

function clienteFalso() {
  const enviado: { method: string; path: string; body?: unknown }[] = [];
  const api = {
    request: vi.fn(async (peticion: { method: string; path: string; body?: unknown }) => {
      enviado.push(peticion);
      return {};
    }),
  } as unknown as ApiClient;
  return { api, enviado };
}

describe('abrir una sala', () => {
  /**
   * El anfitrión elegía su cara y se sentaba con otra.
   *
   * `meta` viajaba en la firma y en el comentario, pero no en el cuerpo: al
   * armarlo se copiaban `config` y `bots` y a este se le olvidó. El asiento
   * quedaba con `meta` vacío y la mesa le repartía una cara por el hash del
   * identificador, o sea una cualquiera de la lista. Solo le pasaba a quien
   * abría la mesa, porque al unirse sí se manda.
   */
  it('lleva al asiento lo que el juego necesite de quien la abre', async () => {
    const { api, enviado } = clienteFalso();

    await new RoomsApiService(api).crear({
      game: 'scrum',
      name: 'Estimando lo de siempre',
      displayName: 'Anfitrión',
      meta: { avatar: 'turing' },
    });

    expect(enviado[0].body).toMatchObject({ meta: { avatar: 'turing' } });
  });

  it('y sin nada que llevar no manda el saco vacío', async () => {
    const { api, enviado } = clienteFalso();

    await new RoomsApiService(api).crear({
      game: 'scrum',
      name: 'Sala',
      displayName: 'Alguien',
    });

    expect(enviado[0].body).not.toHaveProperty('meta');
  });

  it('sin perder lo que ya viajaba', async () => {
    const { api, enviado } = clienteFalso();

    await new RoomsApiService(api).crear({
      game: 'scrum',
      name: 'Sala',
      displayName: 'Alguien',
      meta: { avatar: 'turing' },
      config: { version: 'mesa' },
      bots: ['Bot'],
    });

    expect(enviado[0].body).toMatchObject({
      game: 'scrum',
      name: 'Sala',
      displayName: 'Alguien',
      meta: { avatar: 'turing' },
      config: { version: 'mesa' },
      bots: ['Bot'],
    });
  });
});

describe('sentarse en una sala que ya existe', () => {
  /** Este sí lo mandaba, y es el que hacía creer que el fallo era del juego. */
  it('manda la cara elegida', async () => {
    const { api, enviado } = clienteFalso();

    await new RoomsApiService(api).unirse('sala-1', 'Bea', undefined, { avatar: 'hopper' });

    expect(enviado[0].body).toMatchObject({ meta: { avatar: 'hopper' } });
  });
});
