import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import type { FastifyInstance } from 'fastify';
import type { RoomInfo, SeatGrant, SeatInfo } from '@devweb/shared/contracts/rooms';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const DUENYO = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };
const OTRA = { email: 'ana@example.com', password: 'contraseña-larga-2', displayName: 'Ana' };

describe('los asientos de una mesa', () => {
  let app: FastifyInstance;
  let db: Db;
  let token: string;
  let ajeno: string;
  let sala: SeatGrant;

  async function acceder(alta: typeof DUENYO): Promise<string> {
    await app.inject({ method: 'POST', url: '/auth/registro', payload: alta });
    db.prepare("UPDATE users SET status = 'active'").run();
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email: alta.email, password: alta.password },
    });
    return acceso.json<{ accessToken: string }>().accessToken;
  }

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });

    token = await acceder(DUENYO);
    ajeno = await acceder(OTRA);

    sala = (
      await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: { game: 'risk', name: 'Conquista', displayName: 'Óscar' },
      })
    ).json<SeatGrant>();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  const anadirBot = (autorizacion = `Bearer ${token}`) =>
    app.inject({
      method: 'POST',
      url: `/salas/${sala.room.id}/asientos`,
      headers: { authorization: autorizacion },
      payload: { displayName: 'Bot rojo', isBot: true, meta: { color: 'rojo' } },
    });

  const asiento = (info: RoomInfo, id: string): SeatInfo | undefined =>
    info.seats.find((seat) => seat.id === id);

  describe('añadir', () => {
    it('quien creó la sala sienta bots en su mesa', async () => {
      const response = await anadirBot();
      const grant = response.json<SeatGrant>();

      expect(response.statusCode).toBe(201);
      expect(asiento(grant.room, grant.seatId)).toMatchObject({
        displayName: 'Bot rojo',
        isBot: true,
        order: 1,
        meta: { color: 'rojo' },
      });
    });

    it('otra persona con cuenta no reparte asientos en mesa ajena', async () => {
      const response = await anadirBot(`Bearer ${ajeno}`);

      expect(response.statusCode).toBe(403);
    });

    it('sin sesión tampoco', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/salas/${sala.room.id}/asientos`,
        payload: { displayName: 'Bot', isBot: true },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('cambiar', () => {
    it('cada cual se renombra con su propio pase', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/salas/${sala.room.id}/asientos/${sala.seatId}`,
        headers: { 'x-seat-token': sala.seatToken },
        payload: { displayName: 'Óscar B.', meta: { color: 'azul' } },
      });

      expect(response.statusCode).toBe(200);
      expect(asiento(response.json<RoomInfo>(), sala.seatId)).toMatchObject({
        displayName: 'Óscar B.',
        meta: { color: 'azul' },
      });
    });

    it('el pase de un asiento no da poder sobre el de al lado', async () => {
      const invitada = (
        await app.inject({
          method: 'POST',
          url: `/salas/${sala.room.id}/unirse`,
          payload: { displayName: 'Ana' },
        })
      ).json<SeatGrant>();

      const response = await app.inject({
        method: 'PATCH',
        url: `/salas/${sala.room.id}/asientos/${sala.seatId}`,
        headers: { 'x-seat-token': invitada.seatToken },
        payload: { displayName: 'Me llamo como quiero' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('quien creó la sala sí retoca los asientos de los bots', async () => {
      const bot = (await anadirBot()).json<SeatGrant>();

      const response = await app.inject({
        method: 'PATCH',
        url: `/salas/${sala.room.id}/asientos/${bot.seatId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { meta: { color: 'verde' } },
      });

      expect(asiento(response.json<RoomInfo>(), bot.seatId)?.meta).toEqual({ color: 'verde' });
    });

    it('un asiento que no existe no se cambia', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/salas/${sala.room.id}/asientos/no-existe`,
        headers: { authorization: `Bearer ${token}` },
        payload: { displayName: 'Fantasma' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('quitar', () => {
    it('quien creó la sala levanta a un bot de la mesa', async () => {
      const bot = (await anadirBot()).json<SeatGrant>();

      const response = await app.inject({
        method: 'DELETE',
        url: `/salas/${sala.room.id}/asientos/${bot.seatId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(asiento(response.json<RoomInfo>(), bot.seatId)).toBeUndefined();
    });

    it('nadie levanta a otro de su silla', async () => {
      const invitada = (
        await app.inject({
          method: 'POST',
          url: `/salas/${sala.room.id}/unirse`,
          payload: { displayName: 'Ana' },
        })
      ).json<SeatGrant>();

      const response = await app.inject({
        method: 'DELETE',
        url: `/salas/${sala.room.id}/asientos/${sala.seatId}`,
        headers: { 'x-seat-token': invitada.seatToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('la sala en sí', () => {
    it('quien la creó le cambia el nombre, el estado y la configuración', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/salas/${sala.room.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Conquista II', status: 'playing', config: { mapId: 'spain-regions' } },
      });

      expect(response.json<RoomInfo>()).toMatchObject({
        name: 'Conquista II',
        status: 'playing',
        config: { mapId: 'spain-regions' },
      });
    });

    it('otra persona no', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/salas/${sala.room.id}`,
        headers: { authorization: `Bearer ${ajeno}` },
        payload: { name: 'Mía' },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
