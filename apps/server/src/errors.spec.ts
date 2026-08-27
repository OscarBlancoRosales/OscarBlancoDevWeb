import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/index';
import type { FastifyInstance } from 'fastify';
import type { Db } from './db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const ALTA = '{"email":"a@example.com","password":"contrasena-larga-1","displayName":"A"}';

describe('los errores del cliente no se convierten en culpa del servidor', () => {
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

  it('un JSON roto es 400, no 500', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": "a@example.com", ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('peticion-invalida');
  });

  it('un Content-Type que no se entiende es culpa del cliente, no del servidor', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      headers: { 'content-type': 'text/plain' },
      payload: ALTA,
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
  });

  it('un cuerpo más grande de lo permitido es 413, no 500', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      headers: { 'content-type': 'application/json' },
      payload: `{"relleno":"${'x'.repeat(400 * 1024)}"}`,
    });

    expect(response.statusCode).toBe(413);
  });

  it('una ruta que no existe es 404 con código de dominio', async () => {
    const response = await app.inject({ method: 'GET', url: '/no-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('no-encontrado');
  });

  it('el cuerpo del error nunca lleva la traza de pila', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });

    expect(response.body).not.toContain('at ');
    expect(response.body).not.toContain('node_modules');
  });
});
