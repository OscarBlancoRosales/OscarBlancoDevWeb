import type { Db } from '../db/index';
import type { GameId, RoomStatus } from '@devweb/shared/contracts/rooms';

export interface RoomRow {
  readonly id: string;
  readonly game: GameId;
  readonly ownerId: string | null;
  readonly name: string;
  readonly status: RoomStatus;
  readonly config: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SeatRow {
  readonly roomId: string;
  readonly seatId: string;
  readonly userId: string | null;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly tokenHash: string;
  readonly order: number;
}

export interface EventRow {
  readonly seq: number;
  readonly seatId: string;
  readonly action: unknown;
  readonly at: number;
}

export interface SnapshotRow {
  readonly upToSeq: number;
  readonly state: unknown;
}

export interface RoomRepository {
  insertRoom(room: RoomRow): void;
  findRoom(id: string): RoomRow | null;
  listRoomsByOwner(ownerId: string): readonly RoomRow[];
  updateRoomStatus(id: string, status: RoomStatus, at: number): void;
  touchRoom(id: string, at: number): void;
  deleteRoom(id: string): void;
  deleteRoomsOlderThan(cutoff: number): number;

  insertSeat(seat: SeatRow): void;
  listSeats(roomId: string): readonly SeatRow[];
  findSeatByToken(roomId: string, tokenHash: string): SeatRow | null;
  deleteSeat(roomId: string, seatId: string): void;

  appendEvent(roomId: string, event: EventRow): void;
  listEventsAfter(roomId: string, seq: number): readonly EventRow[];
  lastSeq(roomId: string): number;

  saveSnapshot(roomId: string, snapshot: SnapshotRow, at: number): void;
  findSnapshot(roomId: string): SnapshotRow | null;
}

interface RoomRecord {
  id: string;
  game: GameId;
  owner_id: string | null;
  name: string;
  status: RoomStatus;
  config_json: string;
  created_at: number;
  updated_at: number;
}

interface SeatRecord {
  room_id: string;
  seat_id: string;
  user_id: string | null;
  display_name: string;
  is_bot: number;
  token_hash: string;
  seat_order: number;
}

interface EventRecord {
  seq: number;
  seat_id: string;
  action_json: string;
  at: number;
}

export function createRoomRepository(db: Db): RoomRepository {
  const s = {
    insertRoom: db.prepare(
      'INSERT INTO rooms (id, game, owner_id, name, status, config_json, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    findRoom: db.prepare('SELECT * FROM rooms WHERE id = ?'),
    listRoomsByOwner: db.prepare('SELECT * FROM rooms WHERE owner_id = ? ORDER BY updated_at DESC'),
    updateRoomStatus: db.prepare('UPDATE rooms SET status = ?, updated_at = ? WHERE id = ?'),
    touchRoom: db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?'),
    deleteRoom: db.prepare('DELETE FROM rooms WHERE id = ?'),
    deleteOld: db.prepare('DELETE FROM rooms WHERE updated_at < ?'),

    insertSeat: db.prepare(
      'INSERT INTO seats (room_id, seat_id, user_id, display_name, is_bot, token_hash, seat_order)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    listSeats: db.prepare('SELECT * FROM seats WHERE room_id = ? ORDER BY seat_order'),
    findSeatByToken: db.prepare('SELECT * FROM seats WHERE room_id = ? AND token_hash = ?'),
    deleteSeat: db.prepare('DELETE FROM seats WHERE room_id = ? AND seat_id = ?'),

    appendEvent: db.prepare(
      'INSERT INTO room_events (room_id, seq, seat_id, action_json, at) VALUES (?, ?, ?, ?, ?)',
    ),
    listEventsAfter: db.prepare(
      'SELECT seq, seat_id, action_json, at FROM room_events WHERE room_id = ? AND seq > ? ORDER BY seq',
    ),
    lastSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM room_events WHERE room_id = ?'),

    saveSnapshot: db.prepare(
      'INSERT INTO room_snapshots (room_id, up_to_seq, state_json, at) VALUES (?, ?, ?, ?)' +
        ' ON CONFLICT (room_id) DO UPDATE SET up_to_seq = excluded.up_to_seq,' +
        ' state_json = excluded.state_json, at = excluded.at',
    ),
    findSnapshot: db.prepare('SELECT up_to_seq, state_json FROM room_snapshots WHERE room_id = ?'),
  };

  return {
    insertRoom(room) {
      s.insertRoom.run(
        room.id,
        room.game,
        room.ownerId,
        room.name,
        room.status,
        JSON.stringify(room.config),
        room.createdAt,
        room.updatedAt,
      );
    },
    findRoom(id) {
      return toRoom(s.findRoom.get(id) as RoomRecord | undefined);
    },
    listRoomsByOwner(ownerId) {
      return (s.listRoomsByOwner.all(ownerId) as RoomRecord[]).flatMap((row) => {
        const room = toRoom(row);
        return room ? [room] : [];
      });
    },
    updateRoomStatus(id, status, at) {
      s.updateRoomStatus.run(status, at, id);
    },
    touchRoom(id, at) {
      s.touchRoom.run(at, id);
    },
    deleteRoom(id) {
      s.deleteRoom.run(id);
    },
    deleteRoomsOlderThan(cutoff) {
      return s.deleteOld.run(cutoff).changes;
    },

    insertSeat(seat) {
      s.insertSeat.run(
        seat.roomId,
        seat.seatId,
        seat.userId,
        seat.displayName,
        seat.isBot ? 1 : 0,
        seat.tokenHash,
        seat.order,
      );
    },
    listSeats(roomId) {
      return (s.listSeats.all(roomId) as SeatRecord[]).map(toSeat);
    },
    findSeatByToken(roomId, tokenHash) {
      const row = s.findSeatByToken.get(roomId, tokenHash) as SeatRecord | undefined;
      return row ? toSeat(row) : null;
    },
    deleteSeat(roomId, seatId) {
      s.deleteSeat.run(roomId, seatId);
    },

    appendEvent(roomId, event) {
      s.appendEvent.run(roomId, event.seq, event.seatId, JSON.stringify(event.action), event.at);
    },
    listEventsAfter(roomId, seq) {
      return (s.listEventsAfter.all(roomId, seq) as EventRecord[]).map((row) => ({
        seq: row.seq,
        seatId: row.seat_id,
        action: JSON.parse(row.action_json) as unknown,
        at: row.at,
      }));
    },
    lastSeq(roomId) {
      return (s.lastSeq.get(roomId) as { seq: number }).seq;
    },

    saveSnapshot(roomId, snapshot, at) {
      s.saveSnapshot.run(roomId, snapshot.upToSeq, JSON.stringify(snapshot.state), at);
    },
    findSnapshot(roomId) {
      const row = s.findSnapshot.get(roomId) as { up_to_seq: number; state_json: string } | undefined;
      if (!row) return null;
      return { upToSeq: row.up_to_seq, state: JSON.parse(row.state_json) as unknown };
    },
  };
}

function toRoom(row: RoomRecord | undefined): RoomRow | null {
  if (!row) return null;
  return {
    id: row.id,
    game: row.game,
    ownerId: row.owner_id,
    name: row.name,
    status: row.status,
    config: JSON.parse(row.config_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSeat(row: SeatRecord): SeatRow {
  return {
    roomId: row.room_id,
    seatId: row.seat_id,
    userId: row.user_id,
    displayName: row.display_name,
    isBot: row.is_bot === 1,
    tokenHash: row.token_hash,
    order: row.seat_order,
  };
}
