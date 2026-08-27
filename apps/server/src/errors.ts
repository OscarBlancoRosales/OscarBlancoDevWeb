import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Los códigos son del dominio, no del transporte.
 *
 * El servicio dice `credenciales-invalidas`; que eso sea un 401 y no un 403 lo
 * decide esta capa y solo esta capa. Así el día que la web quiera mostrar un
 * mensaje distinto no hay que adivinarlo a partir de un número.
 */
export type ErrorCode =
  | 'credenciales-invalidas'
  | 'cuenta-sin-verificar'
  | 'email-ya-registrado'
  | 'token-invalido'
  | 'sesion-caducada'
  | 'no-autenticado'
  | 'sin-permiso'
  | 'no-encontrado'
  | 'jugada-ilegal'
  | 'sala-llena'
  | 'peticion-invalida'
  | 'demasiadas-peticiones'
  | 'error-interno';

const STATUS: Record<ErrorCode, number> = {
  'credenciales-invalidas': 401,
  'cuenta-sin-verificar': 403,
  'email-ya-registrado': 409,
  'token-invalido': 400,
  'sesion-caducada': 401,
  'no-autenticado': 401,
  'sin-permiso': 403,
  'no-encontrado': 404,
  'jugada-ilegal': 422,
  'sala-llena': 409,
  'peticion-invalida': 400,
  'demasiadas-peticiones': 429,
  'error-interno': 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export interface ErrorBody {
  readonly code: ErrorCode;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

/**
 * Un fallo inesperado no cuenta nada hacia fuera.
 *
 * El detalle va al log, donde lo lee quien mantiene el servidor; al cliente le
 * llega un código y poco más. Una traza de pila en la respuesta es un mapa del
 * servidor dibujado para quien lo esté atacando.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      const body: ErrorBody = {
        code: error.code,
        message: error.message,
        ...(error.detail !== undefined && { detail: error.detail }),
      };
      void reply.status(error.status).send(body);
      return;
    }

    const validation = asValidationError(error);
    if (validation) {
      void reply.status(400).send({
        code: 'peticion-invalida',
        message: validation,
      } satisfies ErrorBody);
      return;
    }

    if (isRateLimitError(error)) {
      void reply.status(429).send({
        code: 'demasiadas-peticiones',
        message: 'Demasiadas peticiones. Prueba dentro de un rato.',
      } satisfies ErrorBody);
      return;
    }

    request.log.error({ err: error }, 'fallo no controlado');
    void reply.status(500).send({
      code: 'error-interno',
      message: 'Error interno.',
    } satisfies ErrorBody);
  });
}

function asValidationError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { validation?: unknown; message?: unknown };
  if (!Array.isArray(candidate.validation)) return null;
  return typeof candidate.message === 'string' ? candidate.message : 'Petición inválida.';
}

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { statusCode?: unknown }).statusCode === 429;
}
