import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

/**
 * Lo privado: documentos que solo ve quien manda, o quien tiene un pase.
 *
 * Los ficheros no viven en el repositorio ni en la web publicada: están en una
 * carpeta del servidor y salen de uno en uno, detrás de la sesión de
 * administrador o de un pase recién canjeado. Así, bajarse la web entera no
 * enseña nada.
 */

/** Donde viaja el pase de un invitado (la sesión de administrador va en `Authorization`). */
export const CABECERA_PASE = 'x-pase-privado';

/** La ruta de un documento dentro de la carpeta privada: solo minúsculas, cifras y guiones. */
export const RUTA_PRIVADA = '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*\\.html$';

export const DocumentoPrivado = Type.Object({
  ruta: Type.String({ pattern: RUTA_PRIVADA, maxLength: 200 }),
  /** El `<title>` del fichero, o su nombre si no lo tiene. */
  titulo: Type.String({ maxLength: 300 }),
  /** La carpeta de primer nivel, que agrupa en la lista (documentos, maquetas…). */
  grupo: Type.String({ maxLength: 100 }),
});
export type DocumentoPrivado = Static<typeof DocumentoPrivado>;

export const ListaPrivada = Type.Object({
  documentos: Type.Array(DocumentoPrivado, { maxItems: 500 }),
});
export type ListaPrivada = Static<typeof ListaPrivada>;

export const PedirDocumento = Type.Object({
  ruta: Type.String({ pattern: RUTA_PRIVADA, maxLength: 200 }),
});

/**
 * Una invitación vale una vez durante una hora, o es de grupo: la usan varios
 * durante unos días (como mucho 30) hasta que caduca o quien manda la revoca.
 */
export const TipoInvitacion = Type.Union([Type.Literal('una'), Type.Literal('grupo')]);
export const DIAS_MAXIMOS_GRUPO = 30;

export const CrearInvitacionPrivada = Type.Object({
  tipo: Type.Optional(TipoInvitacion),
  dias: Type.Optional(Type.Integer({ minimum: 1, maximum: DIAS_MAXIMOS_GRUPO })),
  nota: Type.Optional(Type.String({ maxLength: 80 })),
});

/** Una invitación recién hecha: el código solo se ve aquí, una vez. */
export const InvitacionPrivada = Type.Object({
  id: Type.String(),
  codigo: Type.String(),
  caduca: Type.Integer(),
});
export type InvitacionPrivada = Static<typeof InvitacionPrivada>;

/** Lo que se ve de cada invitación en la lista: nunca su código. */
export const InvitacionPrivadaVista = Type.Object({
  id: Type.String(),
  tipo: TipoInvitacion,
  nota: Type.String(),
  creada: Type.Integer(),
  caduca: Type.Integer(),
  canjes: Type.Integer(),
  revocada: Type.Boolean(),
});
export type InvitacionPrivadaVista = Static<typeof InvitacionPrivadaVista>;

export const ListaInvitacionesPrivadas = Type.Object({
  invitaciones: Type.Array(InvitacionPrivadaVista),
});

export const CanjearCodigo = Type.Object({
  codigo: Type.String({ minLength: 6, maxLength: 64 }),
});

/** Lo que da canjear un código: un pase que dura hasta que caduca la invitación. */
export const PasePrivado = Type.Object({
  pase: Type.String(),
  caduca: Type.Integer(),
});
export type PasePrivado = Static<typeof PasePrivado>;
