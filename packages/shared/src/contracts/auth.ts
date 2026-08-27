import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

/**
 * El contrato de autenticación, declarado una sola vez.
 *
 * De aquí salen la validación en runtime del servidor y los tipos que usa la
 * web. Una `interface` escrita a mano al otro lado sería una copia, y las copias
 * no se desincronizan el día que se escriben: se desincronizan el día que
 * alguien toca una de las dos con prisa.
 */

export const Email = Type.String({
  format: 'email',
  minLength: 3,
  maxLength: 254,
  description: 'Correo del usuario.',
});

/**
 * Mínimo 12 caracteres y máximo 200.
 *
 * El mínimo es largo a propósito: con Argon2id detrás, la longitud es lo único
 * que de verdad frena un ataque por diccionario. El máximo no es una restricción
 * de seguridad, es una defensa: hashear 100 kB de "contraseña" es un ataque de
 * denegación de servicio gratis.
 */
export const Password = Type.String({ minLength: 12, maxLength: 200 });

export const DisplayName = Type.String({ minLength: 1, maxLength: 40 });

/**
 * Ninguna petición acepta campos que no estén declarados.
 *
 * Sin esto, mandar `{"status": "active"}` junto al alta no da error: el esquema
 * lo ignora y el objeto sigue viaje. Basta con que alguien escriba luego un
 * `insert(...body)` para que eso sea una escalada de privilegios. Rechazarlo en
 * la puerta es más barato que acordarse siempre.
 */
const SIN_EXTRAS = { additionalProperties: false } as const;

export const RegisterRequest = Type.Object(
  {
    email: Email,
    password: Password,
    displayName: DisplayName,
  },
  SIN_EXTRAS,
);

export const LoginRequest = Type.Object(
  {
    email: Email,
    password: Password,
  },
  SIN_EXTRAS,
);

export const VerifyEmailRequest = Type.Object(
  {
    token: Type.String({ minLength: 16, maxLength: 200 }),
  },
  SIN_EXTRAS,
);

export const RequestPasswordResetRequest = Type.Object(
  {
    email: Email,
  },
  SIN_EXTRAS,
);

export const ResetPasswordRequest = Type.Object(
  {
    token: Type.String({ minLength: 16, maxLength: 200 }),
    password: Password,
  },
  SIN_EXTRAS,
);

export const PublicUser = Type.Object({
  id: Type.String(),
  email: Email,
  displayName: DisplayName,
  status: Type.Union([Type.Literal('pending'), Type.Literal('active'), Type.Literal('blocked')]),
});

/**
 * El token de acceso viaja en el cuerpo y vive en memoria del cliente.
 *
 * No se manda en una cookie porque el cliente tiene que poder ponerlo en una
 * cabecera; y no se guarda en localStorage porque cualquier script inyectado lo
 * leería. Diez minutos de vida y a renovar con la cookie de refresco, que sí es
 * HttpOnly y ningún script puede tocar.
 */
export const SessionResponse = Type.Object({
  user: PublicUser,
  accessToken: Type.String(),
  expiresInSeconds: Type.Integer(),
});

export const OkResponse = Type.Object({
  ok: Type.Literal(true),
});

export type RegisterRequest = Static<typeof RegisterRequest>;
export type LoginRequest = Static<typeof LoginRequest>;
export type VerifyEmailRequest = Static<typeof VerifyEmailRequest>;
export type RequestPasswordResetRequest = Static<typeof RequestPasswordResetRequest>;
export type ResetPasswordRequest = Static<typeof ResetPasswordRequest>;
export type PublicUser = Static<typeof PublicUser>;
export type SessionResponse = Static<typeof SessionResponse>;
export type OkResponse = Static<typeof OkResponse>;
