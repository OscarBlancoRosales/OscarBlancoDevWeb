import { Type } from '@sinclair/typebox';
import {
  ChangeStatusRequest,
  CreateInvitationRequest,
  CreatedInvitation,
  InvitationList,
  UserList,
} from '@devweb/shared/contracts/admin';
import { OkResponse, PublicUser } from '@devweb/shared/contracts/auth';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AuthService } from './service';

const UserParams = Type.Object({ userId: Type.String({ minLength: 1, maxLength: 64 }) });
const InvitationParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 64 }) });

/**
 * El panel de quien manda.
 *
 * Todas las rutas van detrás de `requireAdmin`, que comprueba el rol contra la
 * base en cada petición. Y ninguna de ellas asciende a nadie: el rol lo fija la
 * configuración de la máquina al arrancar, así que ni robando una sesión de
 * administrador se puede fabricar otro administrador.
 */
export function adminRoutes(service: AuthService): FastifyPluginCallbackTypebox {
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

    done();
  };
}
