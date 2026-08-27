import { AppError } from '../errors';
import { isAccessToken, verifyPayload } from './tokens';
import type { FastifyInstance, FastifyRequest, onRequestHookHandler } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Quién hace la petición. Solo tiene valor detrás de `requireUser`. */
    userId: string;
  }
  interface FastifyInstance {
    requireUser: onRequestHookHandler;
  }
}

/**
 * Traduce la cabecera `Authorization` en un usuario, o corta la petición.
 *
 * Va como decorador de la instancia para que una ruta protegida se lea de un
 * vistazo (`onRequest: app.requireUser`) y para que no haya dos formas de
 * comprobar lo mismo repartidas por el código.
 */
export function registerAuthGuard(app: FastifyInstance, secret: string): void {
  app.decorateRequest('userId', '');

  app.decorate('requireUser', function requireUser(request, _reply, done) {
    const userId = userIdFrom(request, secret);
    if (!userId) {
      done(new AppError('no-autenticado', 'Hace falta iniciar sesión.'));
      return;
    }
    request.userId = userId;
    done();
  } satisfies onRequestHookHandler);
}

/** El identificador si el token es válido; `null` si no lo hay o no lo es. */
export function userIdFrom(request: FastifyRequest, secret: string): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;

  const payload = verifyPayload(header.slice('Bearer '.length), secret, isAccessToken);
  return payload?.userId ?? null;
}
