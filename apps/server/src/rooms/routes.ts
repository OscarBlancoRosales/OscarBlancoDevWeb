import { Type } from '@sinclair/typebox';
import {
  AddSeatRequest,
  CreateRoomRequest,
  JoinRoomRequest,
  RoomInfo,
  RoomList,
  SeatGrant,
  UpdateRoomRequest,
  UpdateSeatRequest,
} from '@devweb/shared/contracts/rooms';
import { OkResponse } from '@devweb/shared/contracts/auth';
import { userIdFrom } from '../auth/guard';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { RoomService } from './service';

const RoomParams = Type.Object({ roomId: Type.String({ minLength: 1, maxLength: 64 }) });
const SeatParams = Type.Object({
  roomId: Type.String({ minLength: 1, maxLength: 64 }),
  seatId: Type.String({ minLength: 1, maxLength: 64 }),
});

/**
 * El pase del asiento viaja en una cabecera, no en el cuerpo.
 *
 * Así una misma persona puede tener dos salas abiertas en dos pestañas con
 * asientos distintos, cosa que una cookie por dominio no sabe distinguir.
 */
function paseDe(request: { headers: Record<string, unknown> }): string | null {
  const pase = request.headers['x-seat-token'];
  return typeof pase === 'string' && pase.length > 0 ? pase : null;
}

export interface RoomRoutesOptions {
  readonly service: RoomService;
  readonly jwtSecret: string;
}

export function roomRoutes({ service, jwtSecret }: RoomRoutesOptions): FastifyPluginCallbackTypebox {
  return (app, _options, done) => {
    /**
     * Crear sala exige cuenta.
     *
     * Es la única forma de que una sala tenga dueño, y sin dueño nadie puede
     * borrarla ni reclamarla. Las salas fantasma que nadie puede limpiar salen
     * justo de aquí.
     */
    app.post(
      '/salas',
      {
        onRequest: app.requireUser,
        schema: { body: CreateRoomRequest, response: { 201: SeatGrant } },
      },
      async (request, reply) => {
        const grant = service.crear({
          game: request.body.game,
          name: request.body.name,
          displayName: request.body.displayName,
          ownerId: request.userId,
          ...(request.body.config !== undefined && { config: request.body.config }),
          ...(request.body.bots !== undefined && { bots: request.body.bots }),
        });
        await reply.status(201).send(grant);
      },
    );

    app.get(
      '/salas',
      { onRequest: app.requireUser, schema: { response: { 200: RoomList } } },
      async (request, reply) => {
        await reply.send({ rooms: [...service.listarDe(request.userId)] });
      },
    );

    app.get(
      '/salas/:roomId',
      { schema: { params: RoomParams, response: { 200: RoomInfo } } },
      async (request, reply) => {
        await reply.send(service.info(request.params.roomId));
      },
    );

    /**
     * Unirse NO exige cuenta.
     *
     * Quien entra por un enlace de invitación juega como invitado; si además
     * tiene sesión, el asiento queda atado a su usuario y lo recupera desde otro
     * dispositivo.
     */
    app.post(
      '/salas/:roomId/unirse',
      { schema: { params: RoomParams, body: JoinRoomRequest, response: { 201: SeatGrant } } },
      async (request, reply) => {
        const grant = service.unirse(
          request.params.roomId,
          request.body.displayName,
          userIdFrom(request, jwtSecret),
        );
        await reply.status(201).send(grant);
      },
    );

    /** Añadir un bot a la mesa. Solo quien creó la sala reparte los asientos. */
    app.post(
      '/salas/:roomId/asientos',
      {
        onRequest: app.requireUser,
        schema: { params: RoomParams, body: AddSeatRequest, response: { 201: SeatGrant } },
      },
      async (request, reply) => {
        const grant = service.anadirAsiento(request.params.roomId, request.userId, {
          displayName: request.body.displayName,
          isBot: request.body.isBot,
          ...(request.body.meta !== undefined && { meta: request.body.meta }),
        });
        await reply.status(201).send(grant);
      },
    );

    app.patch(
      '/salas/:roomId/asientos/:seatId',
      { schema: { params: SeatParams, body: UpdateSeatRequest, response: { 200: RoomInfo } } },
      async (request, reply) => {
        const sala = service.cambiarAsiento(
          request.params.roomId,
          request.params.seatId,
          { userId: userIdFrom(request, jwtSecret), seatToken: paseDe(request) },
          {
            ...(request.body.displayName !== undefined && { displayName: request.body.displayName }),
            ...(request.body.meta !== undefined && { meta: request.body.meta }),
          },
        );
        await reply.send(sala);
      },
    );

    app.delete(
      '/salas/:roomId/asientos/:seatId',
      { schema: { params: SeatParams, response: { 200: RoomInfo } } },
      async (request, reply) => {
        const sala = service.quitarAsiento(request.params.roomId, request.params.seatId, {
          userId: userIdFrom(request, jwtSecret),
          seatToken: paseDe(request),
        });
        await reply.send(sala);
      },
    );

    app.patch(
      '/salas/:roomId',
      {
        onRequest: app.requireUser,
        schema: { params: RoomParams, body: UpdateRoomRequest, response: { 200: RoomInfo } },
      },
      async (request, reply) => {
        const sala = service.cambiarSala(request.params.roomId, request.userId, {
          ...(request.body.name !== undefined && { name: request.body.name }),
          ...(request.body.status !== undefined && { status: request.body.status }),
          ...(request.body.config !== undefined && { config: request.body.config }),
        });
        await reply.send(sala);
      },
    );

    app.delete(
      '/salas/:roomId',
      {
        onRequest: app.requireUser,
        schema: { params: RoomParams, response: { 200: OkResponse } },
      },
      async (request, reply) => {
        service.borrar(request.params.roomId, request.userId);
        await reply.send({ ok: true });
      },
    );

    done();
  };
}
