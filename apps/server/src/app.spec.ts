import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/index';
import type { Db } from './db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

describe('el servidor', () => {
  let app: FastifyInstance;
  let db: Db;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('responde al health con la base viva', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', database: true });
  });

  it('devuelve 503 si la base ha dejado de responder', async () => {
    db.close();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'degradado', database: false });
  });

  it('permite el origen de la lista blanca', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://oscarblancorosales.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://oscarblancorosales.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('no refleja un origen que no está en la lista', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://sitio-de-otro.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('pone las cabeceras de seguridad de helmet', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('contesta un 404 del dominio, no la respuesta por defecto de Fastify', async () => {
    const response = await app.inject({ method: 'GET', url: '/no-existe' });

    expect(response.statusCode).toBe(404);
  });
});
