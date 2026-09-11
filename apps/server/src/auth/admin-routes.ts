import { Type } from '@sinclair/typebox';
import {
  AdminRoomList,
  BorrarSalasRequest,
  ChangeStatusRequest,
  CreateInvitationRequest,
  CreatedInvitation,
  InvitationList,
  SalasBorradas,
  UserList,
} from '@devweb/shared/contracts/admin';
import { OkResponse, PublicUser } from '@devweb/shared/contracts/auth';
import type { AdminRoom } from '@devweb/shared/contracts/admin';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { RoomService } from '../rooms/service';
import type { AuthService } from './service';

const UserParams = Type.Object({ userId: Type.String({ minLength: 1, maxLength: 64 }) });
const InvitationParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 64 }) });
const RoomParams = Type.Object({ roomId: Type.String({ minLength: 1, maxLength: 64 }) });
const SeatParams = Type.Object({
  roomId: Type.String({ minLength: 1, maxLength: 64 }),
  seatId: Type.String({ minLength: 1, maxLength: 64 }),
});

/**
 * El panel de quien manda.
 *
 * Todas las rutas van detrás de `requireAdmin`, que comprueba el rol contra la
 * base en cada petición. Y ninguna de ellas asciende a nadie: el rol lo fija la
 * configuración de la máquina al arrancar, así que ni robando una sesión de
 * administrador se puede fabricar otro administrador.
 */
export function adminRoutes(service: AuthService, rooms: RoomService): FastifyPluginCallbackTypebox {
  return (app, _options, done) => {
    app.get(
      '/admin/usuarios',
      { onRequest: app.requireAdmin, schema: { response: { 200: UserList } } },
      async (_request, reply) => {
        await reply.send({ users: service.listarUsuarios() });
      },
    );

    app.patch(
      '/admin/usuarios/:userId',
      {
        onRequest: app.requireAdmin,
        schema: { params: UserParams, body: ChangeStatusRequest, response: { 200: PublicUser } },
      },
      async (request, reply) => {
        await reply.send(service.cambiarEstado(request.params.userId, request.body.status));
      },
    );

    app.delete(
      '/admin/usuarios/:userId',
      { onRequest: app.requireAdmin, schema: { params: UserParams, response: { 200: OkResponse } } },
      async (request, reply) => {
        service.borrarUsuario(request.params.userId);
        await reply.send({ ok: true });
      },
    );

    app.get(
      '/admin/invitaciones',
      { onRequest: app.requireAdmin, schema: { response: { 200: InvitationList } } },
      async (_request, reply) => {
        await reply.send({ invitaciones: service.listarInvitaciones() });
      },
    );

    app.post(
      '/admin/invitaciones',
      {
        onRequest: app.requireAdmin,
        schema: { body: CreateInvitationRequest, response: { 201: CreatedInvitation } },
      },
      async (request, reply) => {
        const invitacion = service.crearInvitacion({
          creadaPor: request.userId,
          nota: request.body.nota,
          diasDeVida: request.body.diasDeVida,
        });
        await reply.status(201).send(invitacion);
      },
    );

    app.delete(
      '/admin/invitaciones/:id',
      {
        onRequest: app.requireAdmin,
        schema: { params: InvitationParams, response: { 200: OkResponse } },
      },
      async (request, reply) => {
        service.revocarInvitacion(request.params.id);
        await reply.send({ ok: true });
      },
    );

    // ===== LAS SALAS =====

    /**
     * Todas las mesas que hay, con quién está sentado en cada una.
     *
     * La configuración no viaja: en el Trivial son las preguntas con sus
     * respuestas, y el panel no necesita saber cómo se juega para cerrar una
     * sala o levantar a alguien.
     */
    app.get(
      '/admin/salas',
      { onRequest: app.requireAdmin, schema: { response: { 200: AdminRoomList } } },
      async (_request, reply) => {
        const porId = new Map(service.listarUsuarios().map((usuario) => [usuario.id, usuario]));

        const salas: AdminRoom[] = rooms.listarTodas().map(({ info, ownerId }) => {
          const usuario = ownerId === null ? undefined : porId.get(ownerId);
          return {
            id: info.id,
            game: info.game,
            name: info.name,
            status: info.status,
            duenyo: usuario
              ? { id: usuario.id, email: usuario.email, displayName: usuario.displayName }
              : null,
            asientos: info.seats.map(({ id, displayName, isBot, connected }) => ({
              id,
              displayName,
              isBot,
              connected,
            })),
            createdAt: info.createdAt,
            updatedAt: info.updatedAt,
          };
        });

        await reply.send({ salas });
      },
    );

    /**
     * El borrado en bloque, antes que el de una sola.
     *
     * Fastify empareja por orden de registro y `/admin/salas` sin parámetro
     * tiene que ganar a `/admin/salas/:roomId`, que si no se comería la ruta.
     */
    app.delete(
      '/admin/salas',
      {
        onRequest: app.requireAdmin,
        schema: { body: BorrarSalasRequest, response: { 200: SalasBorradas } },
      },
      async (request, reply) => {
        await reply.send({ borradas: rooms.borrarVarias(request.body) });
      },
    );

    app.delete(
      '/admin/salas/:roomId',
      { onRequest: app.requireAdmin, schema: { params: RoomParams, response: { 200: OkResponse } } },
      async (request, reply) => {
        rooms.borrarComoAdmin(request.params.roomId);
        await reply.send({ ok: true });
      },
    );

    app.delete(
      '/admin/salas/:roomId/asientos/:seatId',
      { onRequest: app.requireAdmin, schema: { params: SeatParams, response: { 200: OkResponse } } },
      async (request, reply) => {
        rooms.echarComoAdmin(request.params.roomId, request.params.seatId);
        await reply.send({ ok: true });
      },
    );

    done();
  };
}
