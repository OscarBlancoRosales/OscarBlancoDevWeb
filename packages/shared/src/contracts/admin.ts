import { Type } from '@sinclair/typebox';
import { PublicUser } from './auth';
import { DisplayName, GameId, RoomStatus } from './rooms';
import type { Static } from '@sinclair/typebox';

const SIN_EXTRAS = { additionalProperties: false } as const;

export const UserList = Type.Object({ users: Type.Array(PublicUser) });

export const ChangeStatusRequest = Type.Object(
  { status: Type.Union([Type.Literal('active'), Type.Literal('blocked')]) },
  SIN_EXTRAS,
);

export const CreateInvitationRequest = Type.Object(
  {
    /** Para acordarse de a quién iba. No lo ve nadie más. */
    nota: Type.String({ maxLength: 120, default: '' }),
    diasDeVida: Type.Integer({ minimum: 1, maximum: 90, default: 7 }),
    /**
     * A quién mandarle el enlace, si se quiere que salga solo.
     *
     * No ata la invitación a esa dirección: el enlace sigue sirviendo para
     * quien lo tenga. Solo evita el paseo de copiarlo y pegarlo en el correo.
     */
    email: Type.Optional(Type.String({ format: 'email', maxLength: 200 })),
  },
  SIN_EXTRAS,
);

/**
 * El enlace sale UNA vez, al crearla.
 *
 * La invitación se guarda hasheada, así que ni el panel ni la base pueden
 * volver a enseñarlo. Si se pierde, se crea otra: es más barato que guardar en
 * claro algo que da de alta a quien lo tenga.
 */
export const CreatedInvitation = Type.Object({
  id: Type.String(),
  enlace: Type.String(),
  expiraEn: Type.Integer(),
  /**
   * A dónde ha salido, o nulo.
   *
   * Nulo tanto si no se pidió mandarlo como si el relay no lo aceptó: en los
   * dos casos el enlace de arriba es lo único que hay, y por eso se enseña
   * siempre. Un correo que no sale no puede llevarse por delante la única
   * copia del enlace.
   */
  enviadoA: Type.Union([Type.String(), Type.Null()]),
});

export const Invitation = Type.Object({
  id: Type.String(),
  nota: Type.String(),
  creadaEn: Type.Integer(),
  expiraEn: Type.Integer(),
  usadaEn: Type.Union([Type.Integer(), Type.Null()]),
});

export const InvitationList = Type.Object({ invitaciones: Type.Array(Invitation) });

/**
 * Una sala vista desde el panel, sin su configuración.
 *
 * `RoomInfo` trae `config`, y en el Trivial eso son las preguntas con sus
 * respuestas: mandarlas aquí sería repartir el examen resuelto a cada listado,
 * además de engordarlo sin motivo. El panel necesita saber qué hay y quién
 * está dentro, no cómo se juega.
 */
export const AdminSeat = Type.Object({
  id: Type.String(),
  displayName: DisplayName,
  isBot: Type.Boolean(),
  connected: Type.Boolean(),
});

export const AdminRoom = Type.Object({
  id: Type.String(),
  game: GameId,
  name: Type.String(),
  status: RoomStatus,
  /** Quién la abrió. Nulo si la cuenta ya no existe. */
  duenyo: Type.Union([
    Type.Object({ id: Type.String(), email: Type.String(), displayName: Type.String() }),
    Type.Null(),
  ]),
  asientos: Type.Array(AdminSeat),
  createdAt: Type.Integer(),
  updatedAt: Type.Integer(),
});

export const AdminRoomList = Type.Object({ salas: Type.Array(AdminRoom) });

/**
 * El borrado en bloque, siempre con filtro.
 *
 * Sin ninguno se lleva todas, que es justo lo que no debe pasar por descuido:
 * por eso la pantalla obliga a confirmar escribiendo, y aquí se deja explícito
 * que un cuerpo vacío significa «todas» y no «ninguna».
 */
export const BorrarSalasRequest = Type.Object(
  {
    juego: Type.Optional(GameId),
    estado: Type.Optional(RoomStatus),
    /** Solo las que nadie ha tocado en tantos días. */
    inactivasDias: Type.Optional(Type.Integer({ minimum: 1, maximum: 365 })),
  },
  SIN_EXTRAS,
);

export const SalasBorradas = Type.Object({ borradas: Type.Integer() });

export type UserList = Static<typeof UserList>;
export type AdminSeat = Static<typeof AdminSeat>;
export type AdminRoom = Static<typeof AdminRoom>;
export type AdminRoomList = Static<typeof AdminRoomList>;
export type BorrarSalasRequest = Static<typeof BorrarSalasRequest>;
export type SalasBorradas = Static<typeof SalasBorradas>;
export type ChangeStatusRequest = Static<typeof ChangeStatusRequest>;
export type CreateInvitationRequest = Static<typeof CreateInvitationRequest>;
export type CreatedInvitation = Static<typeof CreatedInvitation>;
export type Invitation = Static<typeof Invitation>;
export type InvitationList = Static<typeof InvitationList>;
