import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const CONFIGURACION = { rondas: 5, trabajo: 40, descanso: 20 };

describe('almacén de configuraciones', () => {
  let app: FastifyInstance;
  let db: Db;
  let mio: string;
  let ajeno: string;

  async function cuenta(email: string): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { email, password: 'contraseña-larga-1', displayName: 'Alguien' },
    });
    db.prepare("UPDATE users SET status = 'active' WHERE email = ?").run(email);
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email, password: 'contraseña-larga-1' },
    });
    return acceso.json<{ accessToken: string }>().accessToken;
  }

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });
    mio = await cuenta('oscar@example.com');
    ajeno = await cuenta('otra@example.com');
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  const guardar = (token: string, valor: unknown = CONFIGURACION) =>
    app.inject({
      method: 'PUT',
      url: '/kv/throwdown/mi-tabata',
      headers: { authorization: `Bearer ${token}` },
      payload: { value: valor },
    });

  it('sin sesión no se guarda nada', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/kv/throwdown/mi-tabata',
      payload: { value: CONFIGURACION },
    });

    expect(response.statusCode).toBe(401);
  });

  it('con sesión se guarda y se lee sin sesión, que es lo que permite compartir el enlace', async () => {
    await guardar(mio);

    const response = await app.inject({ method: 'GET', url: '/kv/throwdown/mi-tabata' });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ value: unknown }>().value).toEqual(CONFIGURACION);
  });

  it('nadie puede reescribir lo de otro', async () => {
    await guardar(mio);

    const response = await guardar(ajeno, { rondas: 999 });

    expect(response.statusCode).toBe(403);
    const leida = await app.inject({ method: 'GET', url: '/kv/throwdown/mi-tabata' });
    expect(leida.json<{ value: unknown }>().value).toEqual(CONFIGURACION);
  });

  it('ni borrar lo de otro', async () => {
    await guardar(mio);

    const response = await app.inject({
      method: 'DELETE',
      url: '/kv/throwdown/mi-tabata',
      headers: { authorization: `Bearer ${ajeno}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('el dueño sí puede reescribir lo suyo', async () => {
    await guardar(mio);

    const response = await guardar(mio, { rondas: 8 });

    expect(response.statusCode).toBe(200);
    const leida = await app.inject({ method: 'GET', url: '/kv/throwdown/mi-tabata' });
    expect(leida.json<{ value: { rondas: number } }>().value.rondas).toBe(8);
  });

  it('la lista es compartida: se ve lo de todos, marcado por dueño', async () => {
    // Una tanda de temporizadores de un evento la mira todo el equipo. Partir
    // la lista por dueños la convertiría en varias privadas que no se ven.
    await guardar(mio);
    await app.inject({
      method: 'PUT',
      url: '/kv/throwdown/otra-cosa',
      headers: { authorization: `Bearer ${ajeno}` },
      payload: { value: { rondas: 1 } },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/kv/throwdown',
      headers: { authorization: `Bearer ${mio}` },
    });

    const entries = response.json<{ entries: { key: string; propia: boolean }[] }>().entries;
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.key === 'mi-tabata')?.propia).toBe(true);
    expect(entries.find((e) => e.key === 'otra-cosa')?.propia).toBe(false);
  });

  it('sin sesión no se lista nada', async () => {
    await guardar(mio);

    const response = await app.inject({ method: 'GET', url: '/kv/throwdown' });

    expect(response.statusCode).toBe(401);
  });

  it('una clave que no existe es un 404, no un 200 con nada', async () => {
    const response = await app.inject({ method: 'GET', url: '/kv/throwdown/no-existe' });

    expect(response.statusCode).toBe(404);
  });

  it('las claves raras se rechazan antes de tocar la base', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/kv/throwdown/Con Mayúsculas Y Espacios',
      headers: { authorization: `Bearer ${mio}` },
      payload: { value: {} },
    });

    expect(response.statusCode).toBe(400);
  });
});
