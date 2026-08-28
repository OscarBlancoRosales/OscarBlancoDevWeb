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
    /**
     * Los rivales que no son personas, por su nombre.
     *
     * Se piden al crear la sala y no después porque un juego que empieza en
     * cuanto está la mesa —la flota arranca al desplegar los dos bandos— no
     * tiene un momento posterior en el que sentar a nadie.
     */
    bots: Type.Optional(Type.Array(DisplayName, { maxItems: 8 })),
  },
  SIN_EXTRAS,
);

export const JoinRoomRequest = Type.Object({ displayName: DisplayName }, SIN_EXTRAS);

export const SeatInfo = Type.Object({
  id: Type.String(),
  displayName: DisplayName,
  isBot: Type.Boolean(),
  connected: Type.Boolean(),
  /**
   * Si este asiento es el de quien creó la sala.
   *
   * Lo dice el servidor, no el cliente. Es lo que decide qué botones se pintan,
   * y tiene que salir del mismo sitio del que salen los permisos: si no, la
   * pantalla acaba ofreciendo cosas que la API va a rechazar.
   */
  isOwner: Type.Boolean(),
  order: Type.Integer(),
  /**
   * Lo que el juego necesita del asiento y las salas no saben interpretar.
   *
   * En RISK son el color, el perfil del bot y quién creó la sala. Va como saco
   * opaco a propósito: una columna por cada cosa que se le ocurra al juego
   * siguiente convertiría la tabla de asientos en un vertedero.
   */
  meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const RoomInfo = Type.Object({
  id: Type.String(),
  game: GameId,
  name: Type.String(),
  status: RoomStatus,
  /** Lo que se decidió antes de empezar: mapa, semilla, reglas de la casa. */
  config: Type.Record(Type.String(), Type.Unknown()),
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

export const AddSeatRequest = Type.Object(
  {
    displayName: DisplayName,
    isBot: Type.Boolean(),
    meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  SIN_EXTRAS,
);

export const UpdateSeatRequest = Type.Object(
  {
    displayName: Type.Optional(DisplayName),
    meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  SIN_EXTRAS,
);

export const UpdateRoomRequest = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    status: Type.Optional(RoomStatus),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  SIN_EXTRAS,
);

export const ChatKind = Type.Union([
  Type.Literal('player'),
  Type.Literal('bot'),
  Type.Literal('system'),
  Type.Literal('advisor'),
]);

export const ChatEntry = Type.Object({
  seq: Type.Integer(),
  authorId: Type.String(),
  author: Type.String(),
  kind: ChatKind,
  text: Type.String(),
  origin: Type.Optional(Type.String()),
  at: Type.Integer(),
  /**
   * Asiento al que va dirigido. Ausente es el canal de todos.
   *
   * El servidor no le manda un privado a quien no es ninguno de los dos
   * extremos, así que esto sólo llega a quien le toca.
   */
  to: Type.Optional(Type.String()),
});

// ---------------------------------------------------------------------------
// Protocolo del WebSocket
// ---------------------------------------------------------------------------

/** Del cliente al servidor: proponer una jugada, o decir algo. */
export const ClientMessage = Type.Union([
  /**
   * Lo primero que se dice al conectar: el pase del asiento.
   *
   * Va aquí y no en la URL porque una URL acaba escrita en el log de nginx y en
   * el de la aplicación, en claro y en disco. Hasta que este mensaje llega, la
   * conexión no recibe nada de la sala.
   */
  Type.Object(
    { tipo: Type.Literal('hola'), pase: Type.String({ minLength: 8, maxLength: 200 }) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('accion'), accion: Type.Unknown() }, SIN_EXTRAS),
  Type.Object(
    {
      tipo: Type.Literal('chat'),
      texto: Type.String({ minLength: 1, maxLength: 600 }),
      /** Quién habla: un asiento de bot al que este cliente está moviendo. */
      comoAsiento: Type.Optional(Type.String({ maxLength: 64 })),
      /**
       * Hablar como la sala y no como un jugador. Solo el anfitrión.
       *
       * El tipo del mensaje no lo elige el cliente: si lo eligiera, cualquiera
       * podría publicar avisos con la pinta de los que da la sala, que es
       * precisamente la voz que la gente se cree.
       */
      comoLaSala: Type.Optional(Type.Boolean()),
      origin: Type.Optional(Type.String({ maxLength: 16 })),
      /**
       * Asiento al que va dirigido. Sin esto, el mensaje es para todos.
       *
       * El servidor comprueba que ese asiento existe en la sala: si no, el
       * mensaje se rechaza en vez de quedarse escrito sin llegar a nadie.
       */
      para: Type.Optional(Type.String({ maxLength: 64 })),
    },
    SIN_EXTRAS,
  ),
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
  Type.Object(
    { tipo: Type.Literal('chat'), entradas: Type.Array(ChatEntry) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('pong') }, SIN_EXTRAS),
]);

export type AddSeatRequest = Static<typeof AddSeatRequest>;
export type UpdateSeatRequest = Static<typeof UpdateSeatRequest>;
export type UpdateRoomRequest = Static<typeof UpdateRoomRequest>;
export type ChatKind = Static<typeof ChatKind>;
export type ChatEntry = Static<typeof ChatEntry>;
export type GameId = Static<typeof GameId>;
export type RoomStatus = Static<typeof RoomStatus>;
export type SeatInfo = Static<typeof SeatInfo>;
export type RoomInfo = Static<typeof RoomInfo>;
export type SeatGrant = Static<typeof SeatGrant>;
export type CreateRoomRequest = Static<typeof CreateRoomRequest>;
export type JoinRoomRequest = Static<typeof JoinRoomRequest>;
export type ClientMessage = Static<typeof ClientMessage>;
export type ServerMessage = Static<typeof ServerMessage>;
