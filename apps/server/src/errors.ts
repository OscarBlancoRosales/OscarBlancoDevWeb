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
  // Fastify contesta las rutas desconocidas por su cuenta, con su propia forma
  // de error. Si no se unifica aquí, el cliente tiene que saber distinguir dos
  // formatos distintos según qué haya fallado.
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    void reply.status(404).send({
      code: 'no-encontrado',
      message: `No existe ${request.method} ${request.url}.`,
    } satisfies ErrorBody);
  });

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

    // Fastify rechaza por su cuenta el cuerpo mal formado, el Content-Type que
    // no entiende o el que llega más grande de lo permitido, y lo dice con un
    // statusCode 4xx. Aplanarlo a 500 sería culpar al servidor de lo que ha
    // mandado el cliente, y además esconde el motivo en el log.
    const delCliente = clientStatus(error);
    if (delCliente !== null) {
      void reply.status(delCliente).send({
        code: CODIGO_POR_ESTADO[delCliente] ?? 'peticion-invalida',
        message: mensajeDe(error),
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

const CODIGO_POR_ESTADO: Readonly<Record<number, ErrorCode>> = {
  400: 'peticion-invalida',
  401: 'no-autenticado',
  403: 'sin-permiso',
  404: 'no-encontrado',
  429: 'demasiadas-peticiones',
};

/** El código 4xx que el error ya traía, si traía alguno. */
function clientStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const status = (error as { statusCode?: unknown }).statusCode;
  if (typeof status !== 'number' || status < 400 || status >= 500) return null;
  return status;
}

/**
 * Lo que se le cuenta al cliente sobre su propio error.
 *
 * Los mensajes de Fastify para estos casos hablan de la petición, no de las
 * tripas del servidor, así que se pueden repetir tal cual.
 */
function mensajeDe(error: unknown): string {
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : 'Petición inválida.';
}
