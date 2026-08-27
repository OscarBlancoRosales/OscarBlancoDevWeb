import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import type { FastifyInstance } from 'fastify';
import type { RiskView } from '@devweb/shared/games/risk';
import type { SeatGrant } from '@devweb/shared/contracts/rooms';
import type { Db } from '../db/index';
import { createRoomRepository } from './repository';
import { RoomService } from './service';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const ALTA = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };

describe('una sala de RISK', () => {
  let app: FastifyInstance;
  let db: Db;
  let rooms: RoomService;
  let anfitrion: SeatGrant;
  let invitada: SeatGrant;

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
    const token = acceso.json<{ accessToken: string }>().accessToken;

    anfitrion = (
      await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          game: 'risk',
          name: 'Partida del jueves',
          displayName: 'Óscar',
          config: { mapId: 'spain-regions', seed: 7 },
        },
      })
    ).json<SeatGrant>();

    invitada = (
      await app.inject({
        method: 'POST',
        url: `/salas/${anfitrion.room.id}/unirse`,
        payload: { displayName: 'Ana' },
      })
    ).json<SeatGrant>();

    // El actor se crea con los dos asientos ya sentados, como al abrir el WebSocket.
    rooms = new RoomService({ repository: createRoomRepository(db) });
  });

  afterEach(async () => {
    rooms.cerrar();
    await app.close();
    db.close();
  });

  const vistaDe = (seat: string): RiskView => {
    const mensaje = rooms.actor(anfitrion.room.id).messageFor(seat);
    if (mensaje.tipo !== 'estado') throw new Error('Se esperaba un estado');
    return mensaje.vista as RiskView;
  };

  it('reparte el mapa que pidió la sala, con un jugador por asiento', () => {
    const vista = vistaDe(anfitrion.seatId);

    expect(vista.mapId).toBe('spain-regions');
    expect(vista.players.map((p) => p.name).sort()).toEqual(['Ana', 'Óscar']);
  });

  it('la semilla de la sala manda: reconstruirla da la misma partida', () => {
    const primera = vistaDe(anfitrion.seatId);
    rooms.cerrar();

    const otra = new RoomService({ repository: createRoomRepository(db) });
    const mensaje = otra.actor(anfitrion.room.id).messageFor(anfitrion.seatId);
    otra.cerrar();

    expect(mensaje.tipo === 'estado' ? mensaje.vista : null).toEqual(primera);
  });

  it('nadie juega el turno de otro, aunque le toque a ese otro', () => {
    const actor = rooms.actor(anfitrion.room.id);
    const vista = vistaDe(anfitrion.seatId);
    const enTurno = vista.turnOrder[vista.currentPlayerIndex] ?? '';
    const elOtro = vista.turnOrder.find((id) => id !== enTurno) ?? '';

    const rechazo = actor.submit(elOtro, { type: 'end-phase', playerId: enTurno });

    expect(rechazo?.code).toBe('no-eres-tu');
  });

  it('una jugada legal se aplica y queda en el log', () => {
    const actor = rooms.actor(anfitrion.room.id);
    const vista = vistaDe(anfitrion.seatId);
    const enTurno = vista.turnOrder[vista.currentPlayerIndex] ?? '';
    const suyo = Object.entries(vista.territories).find(([, t]) => t.ownerId === enTurno)?.[0] ?? '';

    const rechazo = actor.submit(enTurno, {
      type: 'deploy',
      playerId: enTurno,
      territoryId: suyo,
      armies: 1,
    });

    expect(rechazo).toBeNull();
    expect(actor.ultimaSecuencia).toBe(1);

    const eventos = db.prepare('SELECT COUNT(*) AS n FROM room_events').get() as { n: number };
    expect(eventos.n).toBe(1);
  });

  it('una jugada ilegal se rechaza con el motivo del motor y no toca el estado', () => {
    const actor = rooms.actor(anfitrion.room.id);
    const enTurno = vistaDe(anfitrion.seatId).turnOrder[0] ?? '';

    const rechazo = actor.submit(enTurno, {
      type: 'attack',
      playerId: enTurno,
      from: 'no-existe',
      to: 'tampoco',
      dice: 3,
    });

    expect(rechazo).not.toBeNull();
    expect(actor.ultimaSecuencia).toBe(0);
  });

  it('un mensaje sin playerId no llega ni a las reglas', () => {
    const actor = rooms.actor(anfitrion.room.id);

    const rechazo = actor.submit(anfitrion.seatId, { type: 'end-phase' });

    expect(rechazo?.code).toBe('accion-desconocida');
  });

  it('la mano de la rival no viaja en el mensaje', () => {
    const paraOscar = vistaDe(anfitrion.seatId);

    const ana = paraOscar.players.find((p) => p.id === invitada.seatId);
    const oscar = paraOscar.players.find((p) => p.id === anfitrion.seatId);

    expect(ana?.cards).toBeNull();
    expect(oscar?.cards).not.toBeNull();
  });

  it('la partida se reconstruye desde el log tras descargar la sala', () => {
    const actor = rooms.actor(anfitrion.room.id);
    const vista = vistaDe(anfitrion.seatId);
    const enTurno = vista.turnOrder[vista.currentPlayerIndex] ?? '';
    const suyo = Object.entries(vista.territories).find(([, t]) => t.ownerId === enTurno)?.[0] ?? '';
    actor.submit(enTurno, { type: 'deploy', playerId: enTurno, territoryId: suyo, armies: 1 });
    const despues = vistaDe(anfitrion.seatId);
    rooms.cerrar();

    const otra = new RoomService({ repository: createRoomRepository(db) });
    const recuperado = otra.actor(anfitrion.room.id);
    const mensaje = recuperado.messageFor(anfitrion.seatId);
    otra.cerrar();

    expect(recuperado.ultimaSecuencia).toBe(1);
    expect(mensaje.tipo === 'estado' ? mensaje.vista : null).toEqual(despues);
  });
});
