import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import { REFRESH_COOKIE } from './routes';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
  PUBLIC_WEB_URL: 'https://oscarblancorosales.com',
});

const ALTA = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };

describe('rutas de autenticación', () => {
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

  function post(url: string, payload: unknown, cookie?: string) {
    return app.inject({
      method: 'POST',
      url,
      payload: payload as Record<string, unknown>,
      ...(cookie !== undefined && { headers: { cookie } }),
    });
  }

  /** Activa la cuenta leyendo el token de la base, como haría el enlace del correo. */
  function activar(): void {
    db.prepare("UPDATE users SET status = 'active'").run();
  }

  async function entrar(): Promise<{ accessToken: string; cookie: string }> {
    const response = await post('/auth/acceso', { email: ALTA.email, password: ALTA.password });
    const body = response.json<{ accessToken: string }>();
    const cookie = response.cookies.find((c) => c.name === REFRESH_COOKIE);
    return { accessToken: body.accessToken, cookie: `${REFRESH_COOKIE}=${cookie?.value ?? ''}` };
  }

  describe('registro', () => {
    it('crea la cuenta y devuelve 201', async () => {
      const response = await post('/auth/registro', ALTA);

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ ok: true });
    });

    it('rechaza una contraseña corta antes de llegar al servicio', async () => {
      const response = await post('/auth/registro', { ...ALTA, password: 'corta' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'peticion-invalida' });
    });

    it('rechaza lo que no es un correo', async () => {
      const response = await post('/auth/registro', { ...ALTA, email: 'esto-no-es-un-correo' });

      expect(response.statusCode).toBe(400);
    });

    it('no deja colar campos de más', async () => {
      const response = await post('/auth/registro', { ...ALTA, status: 'active' });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('acceso', () => {
    beforeEach(async () => {
      await post('/auth/registro', ALTA);
    });

    it('sin verificar no entra', async () => {
      const response = await post('/auth/acceso', { email: ALTA.email, password: ALTA.password });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'cuenta-sin-verificar' });
    });

    it('verificada, entrega token de acceso y cookie de refresco', async () => {
      activar();

      const response = await post('/auth/acceso', { email: ALTA.email, password: ALTA.password });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        user: { email: ALTA.email, status: 'active' },
        expiresInSeconds: 600,
      });
      expect(response.json<{ accessToken: string }>().accessToken).toBeTruthy();
    });

    it('la cookie de refresco es HttpOnly y SameSite=Lax', async () => {
      activar();

      const response = await post('/auth/acceso', { email: ALTA.email, password: ALTA.password });
      const cookie = response.cookies.find((c) => c.name === REFRESH_COOKIE);

      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('Lax');
      expect(cookie?.['path']).toBe('/');
    });

    it('el token de refresco no viaja en el cuerpo, solo en la cookie', async () => {
      activar();

      const response = await post('/auth/acceso', { email: ALTA.email, password: ALTA.password });
      const cookie = response.cookies.find((c) => c.name === REFRESH_COOKIE);

      expect(response.body).not.toContain(cookie?.value ?? 'imposible');
    });

    it('con contraseña equivocada devuelve 401', async () => {
      activar();

      const response = await post('/auth/acceso', { email: ALTA.email, password: 'otra-cosa-larga-1' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'credenciales-invalidas' });
    });
  });

  describe('quién soy', () => {
    beforeEach(async () => {
      await post('/auth/registro', ALTA);
      activar();
    });

    it('sin token, 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/auth/yo' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'no-autenticado' });
    });

    it('con un token inventado, 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/yo',
        headers: { authorization: 'Bearer me-lo-invento.firmafalsa' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('con el token bueno, devuelve el usuario sin su hash', async () => {
      const { accessToken } = await entrar();

      const response = await app.inject({
        method: 'GET',
        url: '/auth/yo',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id: expect.any(String) as string,
        email: ALTA.email,
        displayName: 'Óscar',
        status: 'active',
      });
      expect(response.body).not.toContain('argon2');
    });
  });

  describe('refresco y salida', () => {
    beforeEach(async () => {
      await post('/auth/registro', ALTA);
      activar();
    });

    it('sin cookie no renueva', async () => {
      const response = await post('/auth/refresco', {});

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'sesion-caducada' });
    });

    it('con cookie renueva y entrega una cookie distinta', async () => {
      const { cookie } = await entrar();

      const response = await post('/auth/refresco', {}, cookie);
      const nueva = response.cookies.find((c) => c.name === REFRESH_COOKIE);

      expect(response.statusCode).toBe(200);
      expect(`${REFRESH_COOKIE}=${nueva?.value ?? ''}`).not.toBe(cookie);
    });

    it('salir invalida la cookie para siempre', async () => {
      const { cookie } = await entrar();

      await post('/auth/salir', {}, cookie);
      const response = await post('/auth/refresco', {}, cookie);

      expect(response.statusCode).toBe(401);
    });
  });

  describe('límite de intentos', () => {
    it('corta el diccionario en el acceso', async () => {
      await post('/auth/registro', ALTA);
      activar();

      const codigos: number[] = [];
      for (let intento = 0; intento < 14; intento += 1) {
        const response = await post('/auth/acceso', { email: ALTA.email, password: 'mala-mala-mala-1' });
        codigos.push(response.statusCode);
      }

      expect(codigos).toContain(429);
      expect(codigos.filter((codigo) => codigo === 401).length).toBeLessThanOrEqual(10);
    });
  });
});
