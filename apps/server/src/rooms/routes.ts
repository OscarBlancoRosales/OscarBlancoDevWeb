import { Type } from '@sinclair/typebox';
import {
  CreateRoomRequest,
  JoinRoomRequest,
  RoomInfo,
  RoomList,
  SeatGrant,
} from '@devweb/shared/contracts/rooms';
import { OkResponse } from '@devweb/shared/contracts/auth';
import { userIdFrom } from '../auth/guard';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { RoomService } from './service';

const RoomParams = Type.Object({ roomId: Type.String({ minLength: 1, maxLength: 64 }) });

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
