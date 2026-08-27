import {
  LoginRequest,
  OkResponse,
  PublicUser,
  RegisterRequest,
  RequestPasswordResetRequest,
  ResetPasswordRequest,
  SessionResponse,
  VerifyEmailRequest,
} from '@devweb/shared/contracts/auth';
import { AppError } from '../errors';
import { signPayload } from './tokens';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { AuthService, ClientInfo, IssuedSession } from './service';

export const REFRESH_COOKIE = 'devweb_refresh';

/**
 * Un intento fallido cada pocos segundos por IP.
 *
 * Es holgado para una persona que se equivoca de contraseña y asfixiante para
 * quien prueba un diccionario. El límite global del servidor no sirve aquí:
 * 300 intentos de acceso por minuto son 300 oportunidades.
 */
const LIMITE_SENSIBLE = { max: 10, timeWindow: '5 minutes' } as const;

export interface AuthRoutesOptions {
  readonly service: AuthService;
  readonly config: Config;
}

export function authRoutes({ service, config }: AuthRoutesOptions): FastifyPluginCallbackTypebox {
  return (app, _options, done) => {
    const responder = async (reply: FastifyReply, session: IssuedSession): Promise<void> => {
      await reply.setCookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(config)).send({
        user: session.user,
        accessToken: accessTokenFor(session.user.id, config),
        expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
      });
    };

    app.post(
      '/auth/registro',
      {
        config: { rateLimit: LIMITE_SENSIBLE },
        schema: { body: RegisterRequest, response: { 201: OkResponse } },
      },
      async (request, reply) => {
        await service.register(request.body);
        await reply.status(201).send({ ok: true });
      },
    );

    app.post(
      '/auth/verificar',
      { schema: { body: VerifyEmailRequest, response: { 200: OkResponse } } },
      async (request, reply) => {
        service.verifyEmail(request.body.token);
        await reply.send({ ok: true });
      },
    );

    app.post(
      '/auth/acceso',
      {
        config: { rateLimit: LIMITE_SENSIBLE },
        schema: { body: LoginRequest, response: { 200: SessionResponse } },
      },
      async (request, reply) => {
        await responder(reply, await service.login(request.body, clientOf(request)));
      },
    );

    app.post(
      '/auth/refresco',
      { schema: { response: { 200: SessionResponse } } },
      async (request, reply) => {
        const token = request.cookies[REFRESH_COOKIE];
        if (!token) throw new AppError('sesion-caducada', 'Vuelve a iniciar sesión.');
        await responder(reply, service.refresh(token, clientOf(request)));
      },
    );

    app.post('/auth/salir', { schema: { response: { 200: OkResponse } } }, async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) service.logout(token);
      await reply.clearCookie(REFRESH_COOKIE, cookieOptions(config)).send({ ok: true });
    });

    app.post(
      '/auth/olvide',
      {
        config: { rateLimit: LIMITE_SENSIBLE },
        schema: { body: RequestPasswordResetRequest, response: { 200: OkResponse } },
      },
      async (request, reply) => {
        await service.requestPasswordReset(request.body.email);
        await reply.send({ ok: true });
      },
    );

    app.post(
      '/auth/nueva-contrasena',
      {
        config: { rateLimit: LIMITE_SENSIBLE },
        schema: { body: ResetPasswordRequest, response: { 200: OkResponse } },
      },
      async (request, reply) => {
        await service.resetPassword(request.body.token, request.body.password);
        await reply.send({ ok: true });
      },
    );

    app.get(
      '/auth/yo',
      { onRequest: app.requireUser, schema: { response: { 200: PublicUser } } },
      async (request, reply) => {
        await reply.send(service.currentUser(request.userId));
      },
    );

    done();
  };
}

function accessTokenFor(userId: string, config: Config): string {
  return signPayload(
    { userId, expiresAt: Date.now() + config.ACCESS_TOKEN_TTL_SECONDS * 1000 },
    config.JWT_SECRET,
  );
}

/**
 * `SameSite=Lax` basta porque la web y la API son el mismo *site*.
 *
 * `oscarblancorosales.com` y `api.oscarblancorosales.com` comparten dominio
 * registrable, así que el navegador no considera la petición entre sitios y no
 * hace falta `SameSite=None`, que es lo que abre la puerta al CSRF.
 */
function cookieOptions(config: Config): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
  domain?: string;
} {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    ...(config.COOKIE_DOMAIN !== '' && { domain: config.COOKIE_DOMAIN }),
  };
}

function clientOf(request: FastifyRequest): ClientInfo {
  return {
    ip: request.ip,
    userAgent: request.headers['user-agent'] ?? null,
  };
}
