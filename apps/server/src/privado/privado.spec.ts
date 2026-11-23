import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import { invitacionDePrueba } from '../auth/testing';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';

const JEFE = { email: 'jefe@example.com', password: 'contraseña-larga-1', displayName: 'Jefe' };
const OTRA = { email: 'otra@example.com', password: 'contraseña-larga-2', displayName: 'Ana' };

describe('lo privado', () => {
  let app: FastifyInstance;
  let db: Db;
  let carpeta: string;
  let jefe: string;
  let otra: string;

  async function alta(quien: typeof JEFE): Promise<void> {
    await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { ...quien, invitacion: invitacionDePrueba(db) },
    });
  }

  async function entrar(quien: typeof JEFE): Promise<string> {
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email: quien.email, password: quien.password },
    });
    return acceso.json<{ accessToken: string }>().accessToken;
  }

  const como = (token: string) => ({ authorization: `Bearer ${token}` });

  async function invitar(): Promise<string> {
    const r = await app.inject({ method: 'POST', url: '/privado/invitaciones', headers: como(jefe) });
    return r.json<{ codigo: string }>().codigo;
  }

  beforeEach(async () => {
    carpeta = mkdtempSync(join(tmpdir(), 'privado-'));
    mkdirSync(join(carpeta, 'documentos'));
    writeFileSync(
      join(carpeta, 'documentos', '01-presentacion.html'),
      '<!doctype html><title>La presentación</title><p>hola</p>',
    );
    writeFileSync(join(carpeta, 'notas.txt'), 'esto no se lista');
    writeFileSync(join(carpeta, '..', 'fuera.html'), '<title>fuera</title>');

    const config = loadConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'x'.repeat(48),
      CORS_ORIGINS: 'https://oscarblancorosales.com',
      ADMIN_EMAILS: JEFE.email,
      PRIVADO_DIR: carpeta,
    });
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });
    await alta(JEFE);
    await alta(OTRA);
    db.prepare("UPDATE users SET status = 'active'").run();
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(JEFE.email);
    jefe = await entrar(JEFE);
    otra = await entrar(OTRA);
  });

  afterEach(async () => {
    await app.close();
    db.close();
    rmSync(carpeta, { recursive: true, force: true });
  });

  it('sin sesión no se ve nada, y para quien no manda la sección no existe', async () => {
    expect((await app.inject({ url: '/privado' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/privado', headers: como(otra) })).statusCode).toBe(404);
    const doc = await app.inject({
      url: '/privado/documento?ruta=documentos/01-presentacion.html',
      headers: como(otra),
    });
    expect(doc.statusCode).toBe(404);
  });

  it('el administrador ve la lista (solo los .html) y cada documento', async () => {
    const lista = await app.inject({ url: '/privado', headers: como(jefe) });
    expect(lista.json()).toEqual({
      documentos: [
        { ruta: 'documentos/01-presentacion.html', titulo: 'La presentación', grupo: 'documentos' },
      ],
    });
    const doc = await app.inject({
      url: '/privado/documento?ruta=documentos/01-presentacion.html',
      headers: como(jefe),
    });
    expect(doc.statusCode).toBe(200);
    expect(doc.headers['content-type']).toContain('text/html');
    expect(doc.headers['cache-control']).toBe('no-store');
    expect(doc.body).toContain('<p>hola</p>');
  });

  it('no se sale de la carpeta', async () => {
    for (const ruta of ['../fuera.html', '..%2Ffuera.html', 'documentos/../../fuera.html']) {
      const r = await app.inject({ url: `/privado/documento?ruta=${ruta}`, headers: como(jefe) });
      expect(r.statusCode).not.toBe(200);
    }
  });

  it('solo el administrador invita', async () => {
    const r = await app.inject({ method: 'POST', url: '/privado/invitaciones', headers: como(otra) });
    expect(r.statusCode).toBe(404);
  });

  it('un código vale una vez y da un pase que solo sirve para leer', async () => {
    const codigo = await invitar();
    const canje = await app.inject({ method: 'POST', url: '/privado/canjear', payload: { codigo } });
    expect(canje.statusCode).toBe(200);
    const { pase } = canje.json<{ pase: string }>();

    const lista = await app.inject({ url: '/privado', headers: { 'x-pase-privado': pase } });
    expect(lista.statusCode).toBe(200);
    const otraVez = await app.inject({ method: 'POST', url: '/privado/canjear', payload: { codigo } });
    expect(otraVez.statusCode).toBe(403);

    const invitarConPase = await app.inject({
      method: 'POST',
      url: '/privado/invitaciones',
      headers: { 'x-pase-privado': pase },
    });
    expect(invitarConPase.statusCode).toBe(401);
  });

  it('un código caducado no se canjea, y un pase manipulado no entra', async () => {
    const codigo = await invitar();
    db.prepare('UPDATE invitaciones_privado SET caduca = 1').run();
    const canje = await app.inject({ method: 'POST', url: '/privado/canjear', payload: { codigo } });
    expect(canje.statusCode).toBe(403);

    const falso = Buffer.from(JSON.stringify({ tipo: 'pase-privado', expiresAt: 9e15 })).toString(
      'base64url',
    );
    const r = await app.inject({ url: '/privado', headers: { 'x-pase-privado': `${falso}.firma` } });
    expect(r.statusCode).toBe(401);
  });
});
