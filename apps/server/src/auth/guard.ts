import { AppError } from '../errors';
import { isAccessToken, verifyPayload } from './tokens';
import type { FastifyInstance, FastifyRequest, onRequestHookHandler } from 'fastify';
import type { UserRow } from './repository';

declare module 'fastify' {
  interface FastifyRequest {
    /** Quién hace la petición. Solo tiene valor detrás de `requireUser`. */
    userId: string;
  }
  interface FastifyInstance {
    requireUser: onRequestHookHandler;
    requireAdmin: onRequestHookHandler;
  }
}

/**
 * Traduce la cabecera `Authorization` en un usuario, o corta la petición.
 *
 * Va como decorador de la instancia para que una ruta protegida se lea de un
 * vistazo (`onRequest: app.requireUser`) y para que no haya dos formas de
 * comprobar lo mismo repartidas por el código.
 */
export function registerAuthGuard(
  app: FastifyInstance,
  secret: string,
  buscarUsuario: (userId: string) => UserRow | null,
): void {
  app.decorateRequest('userId', '');

  /**
   * El identificador si el token vale Y no lo han invalidado.
   *
   * Se mira la cuenta en la base en cada petición, igual que ya se hacía con el
   * rol y por el mismo motivo: revocar algo que solo vive dentro del token no
   * surte efecto hasta que caduca, y en ese rato quien fue echado sigue dentro.
   * Es una lectura por clave primaria contra un SQLite en el mismo proceso.
   */
  const quienLlama = (request: FastifyRequest): UserRow | null => {
    const acceso = accesoDe(request, secret);
    if (!acceso) return null;

    const usuario = buscarUsuario(acceso.userId);
    if (!usuario) return null;
    if ((acceso.emitidoEn ?? 0) < usuario.sessionsInvalidBefore) return null;
    return usuario;
  };

  app.decorate('requireUser', function requireUser(request, _reply, done) {
    const usuario = quienLlama(request);
    if (!usuario) {
      done(new AppError('no-autenticado', 'Hace falta iniciar sesión.'));
      return;
    }
    request.userId = usuario.id;
    done();
  } satisfies onRequestHookHandler);

  /**
   * Además de tener sesión, mandar.
   *
   * El rol se consulta en la base en CADA petición, no se lee del token: si se
   * leyera del token, quitarle el rol a alguien no surtiría efecto hasta que su
   * token caducara, y durante ese rato seguiría administrando.
   */
  app.decorate('requireAdmin', function requireAdmin(request, _reply, done) {
    const usuario = quienLlama(request);
    if (!usuario) {
      done(new AppError('no-autenticado', 'Hace falta iniciar sesión.'));
      return;
    }
    if (usuario.role !== 'admin') {
      // El mismo error que si la ruta no existiera para quien no manda: decir
      // "no eres administrador" confirma que hay un panel al que apuntar.
      done(new AppError('no-encontrado', 'No existe.'));
      return;
    }
    request.userId = usuario.id;
    done();
  } satisfies onRequestHookHandler);
}

/** El identificador si el token es válido; `null` si no lo hay o no lo es. */
export function userIdFrom(request: FastifyRequest, secret: string): string | null {
  return accesoDe(request, secret)?.userId ?? null;
}

function accesoDe(request: FastifyRequest, secret: string) {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;

  return verifyPayload(header.slice('Bearer '.length), secret, isAccessToken);
}
