import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import { PREGUNTAS_POR_PARTIDA } from '../games/trivial/banco';
import type { FastifyInstance } from 'fastify';
import type { SeatGrant } from '@devweb/shared/contracts/rooms';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const ALTA = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };

describe('salas', () => {
  let app: FastifyInstance;
  let db: Db;
  let token: string;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });

    await app.inject({ method: 'POST', url: '/auth/registro', payload: ALTA });
    db.prepare("UPDATE users SET status = 'active'").run();
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email: ALTA.email, password: ALTA.password },
    });
    token = acceso.json<{ accessToken: string }>().accessToken;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  function crearSala(displayName = 'Óscar') {
    return app.inject({
      method: 'POST',
      url: '/salas',
      headers: { authorization: `Bearer ${token}` },
      payload: { game: 'scrum', name: 'Sprint 42', displayName },
    });
  }

  describe('crear', () => {
    it('sin sesión no se crea, que es lo que evita las salas sin dueño', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/salas',
        payload: { game: 'scrum', name: 'Sprint 42', displayName: 'Nadie' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('con sesión devuelve la sala y el pase del asiento', async () => {
      const response = await crearSala();
      const grant = response.json<SeatGrant>();

      expect(response.statusCode).toBe(201);
      expect(grant.room).toMatchObject({ game: 'scrum', name: 'Sprint 42', status: 'lobby' });
      expect(grant.room.seats).toHaveLength(1);
      expect(grant.seatToken).toBeTruthy();
    });

    it('no se crea una sala de un juego que no existe', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: { game: 'parchis', name: 'Sala', displayName: 'Óscar' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('sienta a los bots pedidos, y solo esos', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          game: 'flota',
          name: 'Contra la maquina',
          displayName: 'Óscar',
          bots: ['Almirante'],
          config: { nivelBot: 'almirante' },
        },
      });
      const grant = response.json<SeatGrant>();

      expect(response.statusCode).toBe(201);
      expect(grant.room.seats).toHaveLength(2);
      expect(grant.room.seats.filter((seat) => seat.isBot)).toMatchObject([
        { displayName: 'Almirante', isBot: true },
      ]);
      // El pase que se devuelve es el de la persona, no el del bot.
      expect(grant.seatId).toBe(grant.room.seats.find((seat) => !seat.isBot)?.id);
    });

    it('no sienta mas bots de los que caben en la sala', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          game: 'flota',
          name: 'Multitud',
          displayName: 'Óscar',
          bots: Array.from({ length: 20 }, (_, i) => `Bot ${i}`),
        },
      });

      expect(response.statusCode).toBe(400);
      expect(db.prepare('SELECT COUNT(*) AS total FROM rooms').get()).toMatchObject({ total: 0 });
    });

    it('una sala de trivial nace con sus preguntas repartidas', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: { game: 'trivial', name: 'Concurso', displayName: 'Óscar' },
      });
      const grant = response.json<SeatGrant>();

      expect(response.statusCode).toBe(201);
      const fila = db
        .prepare('SELECT config_json FROM rooms WHERE id = ?')
        .get(grant.room.id) as { config_json: string };
      const config = JSON.parse(fila.config_json) as { preguntas?: unknown[] };
      expect(config.preguntas).toHaveLength(PREGUNTAS_POR_PARTIDA);
    });

    it('las preguntas del trivial no las elige quien crea la sala', async () => {
      // Mandar las tuyas sería elegir las respuestas que ya te sabes.
      const response = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          game: 'trivial',
          name: 'Con trampa',
          displayName: 'Óscar',
          config: { preguntas: [{ id: 'mia', tipo: 'test', correcta: 0 }] },
        },
      });
      const grant = response.json<SeatGrant>();

      const fila = db
        .prepare('SELECT config_json FROM rooms WHERE id = ?')
        .get(grant.room.id) as { config_json: string };
      const config = JSON.parse(fila.config_json) as { preguntas?: { id: string }[] };
      expect(config.preguntas).toHaveLength(PREGUNTAS_POR_PARTIDA);
      expect(config.preguntas?.some((p) => p.id === 'mia')).toBe(false);
    });

    it('el pase se guarda hasheado, nunca en claro', async () => {
      const grant = (await crearSala()).json<SeatGrant>();

      const fila = db.prepare('SELECT token_hash FROM seats').get() as { token_hash: string };
      expect(fila.token_hash).not.toBe(grant.seatToken);
      expect(fila.token_hash).toHaveLength(64);
    });
  });

  describe('unirse', () => {
    it('un invitado sin cuenta consigue asiento', async () => {
      const grant = (await crearSala()).json<SeatGrant>();

      const response = await app.inject({
        method: 'POST',
        url: `/salas/${grant.room.id}/unirse`,
        payload: { displayName: 'Invitada' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json<SeatGrant>().room.seats).toHaveLength(2);
    });

    it('a una sala que no existe, 404', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/salas/no-existe/unirse',
        payload: { displayName: 'Invitada' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('borrar', () => {
    it('solo quien la creó puede borrarla', async () => {
      const grant = (await crearSala()).json<SeatGrant>();

      await app.inject({ method: 'POST', url: '/auth/registro', payload: { ...ALTA, email: 'otra@example.com' } });
      db.prepare("UPDATE users SET status = 'active'").run();
      const otra = await app.inject({
        method: 'POST',
        url: '/auth/acceso',
        payload: { email: 'otra@example.com', password: ALTA.password },
      });
      const otroToken = otra.json<{ accessToken: string }>().accessToken;

      const response = await app.inject({
        method: 'DELETE',
        url: `/salas/${grant.room.id}`,
        headers: { authorization: `Bearer ${otroToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('la dueña sí, y se lleva por delante los asientos', async () => {
      const grant = (await crearSala()).json<SeatGrant>();

      const response = await app.inject({
        method: 'DELETE',
        url: `/salas/${grant.room.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const asientos = db.prepare('SELECT COUNT(*) AS n FROM seats').get() as { n: number };
      expect(asientos.n).toBe(0);
    });
  });

  describe('listar las mías', () => {
    it('devuelve solo las de quien pregunta', async () => {
      await crearSala();

      const response = await app.inject({
        method: 'GET',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.json<{ rooms: unknown[] }>().rooms).toHaveLength(1);
    });
  });
});
