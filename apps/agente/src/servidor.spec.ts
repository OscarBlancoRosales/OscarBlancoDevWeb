import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Almacen } from './almacen';
import { construirAgente } from './servidor';
import type { FastifyInstance } from 'fastify';
import type { ListaDeSesiones, Sesion } from '@devweb/shared/contracts/sesiones';

describe('el agente que corre en tu máquina', () => {
  let app: FastifyInstance;
  let raiz = '';

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'agente-'));
    await mkdir(join(raiz, 'C--git'), { recursive: true });
    await writeFile(
      join(raiz, 'C--git', 'una.jsonl'),
      [
        JSON.stringify({ type: 'ai-title', aiTitle: 'Una sesión' }),
        JSON.stringify({
          type: 'user',
          uuid: 'u1',
          timestamp: '2026-09-10T10:00:00.000Z',
          gitBranch: 'main',
          message: { role: 'user', content: 'hola' },
        }),
      ].join('\n'),
    );
    app = await construirAgente({ almacen: new Almacen(raiz) });
  });

  afterEach(async () => {
    await app.close();
    await rm(raiz, { recursive: true, force: true });
  });

  it('dice quién es, para que la web sepa que está', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/salud' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ agente: string }>().agente).toBe('devweb');
  });

  it('lista lo que hay', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/sesiones' });

    expect(respuesta.json<ListaDeSesiones>().sesiones[0].titulo).toBe('Una sesión');
  });

  it('y abre una por su identificador', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/sesiones/una' });

    expect(respuesta.json<Sesion>().tandas[0].partes[0]).toEqual({
      clase: 'texto',
      texto: 'hola',
    });
  });

  it('una sesión que no existe es un 404', async () => {
    expect((await app.inject({ method: 'GET', url: '/sesiones/nada' })).statusCode).toBe(404);
  });

  /**
   * Cualquier página que abras en el navegador puede llamar a este puerto. Lo
   * que hay detrás es el historial de todo lo que trabajas, así que la lista de
   * quién puede pedirlo es explícita y corta.
   */
  it('solo contesta a la web de casa', async () => {
    const deCasa = await app.inject({
      method: 'GET',
      url: '/sesiones',
      headers: { origin: 'https://oscarblancorosales.com' },
    });
    const deFuera = await app.inject({
      method: 'GET',
      url: '/sesiones',
      headers: { origin: 'https://otra-cualquiera.example' },
    });

    expect(deCasa.headers['access-control-allow-origin']).toBe('https://oscarblancorosales.com');
    expect(deFuera.headers['access-control-allow-origin']).toBeUndefined();
  });

  /** Solo lee. Escribir es el paso siguiente y trae sus propias preguntas. */
  it('no acepta que le manden nada', async () => {
    const respuesta = await app.inject({ method: 'POST', url: '/sesiones', payload: { x: 1 } });

    expect(respuesta.statusCode).toBe(404);
  });
});
