import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

const SIN_EXTRAS = { additionalProperties: false } as const;

export const GameId = Type.Union([
  Type.Literal('scrum'),
  Type.Literal('risk'),
  Type.Literal('flota'),
]);
export const RoomStatus = Type.Union([
  Type.Literal('lobby'),
  Type.Literal('playing'),
  Type.Literal('paused'),
  Type.Literal('finished'),
]);

export const DisplayName = Type.String({ minLength: 1, maxLength: 40 });

export const CreateRoomRequest = Type.Object(
  {
    game: GameId,
    name: Type.String({ minLength: 1, maxLength: 80 }),
    displayName: DisplayName,
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  SIN_EXTRAS,
);

export const JoinRoomRequest = Type.Object({ displayName: DisplayName }, SIN_EXTRAS);

export const SeatInfo = Type.Object({
  id: Type.String(),
  displayName: DisplayName,
  isBot: Type.Boolean(),
  connected: Type.Boolean(),
});

export const RoomInfo = Type.Object({
  id: Type.String(),
  game: GameId,
  name: Type.String(),
  status: RoomStatus,
  seats: Type.Array(SeatInfo),
  createdAt: Type.Integer(),
  updatedAt: Type.Integer(),
});

/**
 * El pase del asiento va en el cuerpo, no en una cookie.
 *
 * Una persona puede tener abiertas dos salas a la vez, o la misma sala en dos
 * pestañas con asientos distintos. Una cookie por dominio no sabe distinguirlas.
 */
export const SeatGrant = Type.Object({
  room: RoomInfo,
  seatId: Type.String(),
  seatToken: Type.String(),
});

export const RoomList = Type.Object({ rooms: Type.Array(RoomInfo) });

// ---------------------------------------------------------------------------
// Protocolo del WebSocket
// ---------------------------------------------------------------------------

/** Del cliente al servidor. Lo único que puede hacer es proponer una jugada. */
export const ClientMessage = Type.Union([
  Type.Object({ tipo: Type.Literal('accion'), accion: Type.Unknown() }, SIN_EXTRAS),
  Type.Object({ tipo: Type.Literal('ping') }, SIN_EXTRAS),
]);

/**
 * Del servidor al cliente.
 *
 * `seq` es el número de la última acción aplicada. El cliente que se reconecta
 * lo compara con el suyo: si hay hueco, ya sabe que se perdió algo y el estado
 * completo que acompaña a este mensaje lo pone al día de una vez.
 */
export const ServerMessage = Type.Union([
  Type.Object(
    {
      tipo: Type.Literal('estado'),
      seq: Type.Integer(),
      seats: Type.Array(SeatInfo),
      status: RoomStatus,
      vista: Type.Unknown(),
    },
    SIN_EXTRAS,
  ),
  Type.Object(
    { tipo: Type.Literal('rechazada'), code: Type.String(), message: Type.String() },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('pong') }, SIN_EXTRAS),
]);

export type GameId = Static<typeof GameId>;
export type RoomStatus = Static<typeof RoomStatus>;
export type SeatInfo = Static<typeof SeatInfo>;
export type RoomInfo = Static<typeof RoomInfo>;
export type SeatGrant = Static<typeof SeatGrant>;
export type CreateRoomRequest = Static<typeof CreateRoomRequest>;
export type JoinRoomRequest = Static<typeof JoinRoomRequest>;
export type ClientMessage = Static<typeof ClientMessage>;
export type ServerMessage = Static<typeof ServerMessage>;
