import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

/**
 * Un secreto opaco de 256 bits, en base64url.
 *
 * No lleva significado dentro: no es un token firmado ni codifica al usuario. Lo
 * único que puede hacer quien lo intercepte es presentarlo, y para eso está la
 * rotación.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Lo que se guarda en la base es esto, nunca el token.
 *
 * SHA-256 sin sal a propósito: la entrada ya son 256 bits aleatorios, así que no
 * hay diccionario que valga y la sal no aportaría nada. Con esto, una copia
 * robada de la base no permite hacerse pasar por nadie.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Compara en tiempo constante: el tiempo de respuesta no cuenta cuánto acertaste. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

interface Expirable {
  readonly expiresAt: number;
}

/**
 * Firma un dato para que vuelva sin haber sido tocado.
 *
 * No se cifra: lo que va dentro es legible por quien tenga el token, y eso está
 * bien porque son datos que ya conoce (su asiento, su identificador). Lo que la
 * firma garantiza es que no pueda cambiarlos por otros.
 *
 * Sirve tanto para el token de acceso como para el pase de invitado, que son el
 * mismo mecanismo con distinto contenido y distinta caducidad.
 */
export function signPayload(payload: Expirable & Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/**
 * Devuelve el dato si la firma cuadra y no ha caducado; si no, `null`.
 *
 * El `guard` lo comprueba quien llama, porque este módulo no sabe qué forma
 * tiene cada carga: solo sabe de firmas y de relojes.
 */
export function verifyPayload<T extends Expirable>(
  token: string,
  secret: string,
  guard: (value: unknown) => value is T,
  now = Date.now(),
): T | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!tokensMatch(signature, sign(body, secret))) return null;

  const payload = decode(body);
  if (!guard(payload) || payload.expiresAt <= now) return null;
  return payload;
}

export interface AccessTokenPayload extends Expirable {
  readonly userId: string;
}

/**
 * El pase de un invitado a una sala concreta.
 *
 * No hay cuenta detrás, así que el token es la identidad entera. Va atado a una
 * sala y un asiento: sirve para eso y para nada más. Si se filtra, lo peor que
 * puede hacer alguien es sentarse en esa silla hasta que caduque.
 */
export interface SeatTokenPayload extends Expirable {
  readonly roomId: string;
  readonly seatId: string;
}

export function isAccessToken(value: unknown): value is AccessTokenPayload {
  const candidate = asRecord(value);
  return (
    candidate !== null &&
    typeof candidate['userId'] === 'string' &&
    typeof candidate['expiresAt'] === 'number'
  );
}

export function isSeatToken(value: unknown): value is SeatTokenPayload {
  const candidate = asRecord(value);
  return (
    candidate !== null &&
    typeof candidate['roomId'] === 'string' &&
    typeof candidate['seatId'] === 'string' &&
    typeof candidate['expiresAt'] === 'number'
  );
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function decode(body: string): unknown {
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
}
