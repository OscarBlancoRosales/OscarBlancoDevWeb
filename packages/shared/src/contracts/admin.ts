import { Type } from '@sinclair/typebox';
import { PublicUser } from './auth';
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
});

export const Invitation = Type.Object({
  id: Type.String(),
  nota: Type.String(),
  creadaEn: Type.Integer(),
  expiraEn: Type.Integer(),
  usadaEn: Type.Union([Type.Integer(), Type.Null()]),
});

export const InvitationList = Type.Object({ invitaciones: Type.Array(Invitation) });

export type UserList = Static<typeof UserList>;
export type ChangeStatusRequest = Static<typeof ChangeStatusRequest>;
export type CreateInvitationRequest = Static<typeof CreateInvitationRequest>;
export type CreatedInvitation = Static<typeof CreatedInvitation>;
export type Invitation = Static<typeof Invitation>;
export type InvitationList = Static<typeof InvitationList>;
