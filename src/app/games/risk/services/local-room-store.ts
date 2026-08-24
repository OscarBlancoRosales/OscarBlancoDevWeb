import { GameAction, GameState } from '../engine/types';
import { ChatEntry, LoggedActionEntry, RoomMeta, RoomSeat, RoomSnapshot } from './risk-room.service';

/**
 * Sala local, guardada en el propio navegador.
 *
 * Sirve para dos cosas muy concretas:
 *  - jugar contra los bots sin depender de Firebase (y sin cuenta);
 *  - poder desplegar en GitHub Pages algo jugable aunque la base de datos no
 *    esté configurada.
 *
 * Usa exactamente la misma forma de datos que la sala en la nube, así que el
 * resto de la aplicación no nota la diferencia: mismo log de acciones, mismos
 * snapshots y, por tanto, las mismas partidas grabadas y reanudables.
 */

export const LOCAL_PREFIX = 'LOCAL-';
const STORAGE_PREFIX = 'risk_local_room_';
const INDEX_KEY = 'risk_local_rooms';

export interface LocalRoomData {
  meta: RoomMeta;
  seats: Record<string, RoomSeat>;
  log: Record<string, { action: GameAction; ts: number; by: string }>;
  chat: Record<string, Omit<ChatEntry, 'key'>>;
  snapshot: RoomSnapshot | null;
}

export function isLocalRoomId(roomId: string): boolean {
  return roomId.startsWith(LOCAL_PREFIX);
}

/** Clave secuencial y ordenable alfabéticamente, como las de Firebase. */
export function sequentialKey(index: number): string {
  return index.toString(36).padStart(10, '0');
}

export class LocalRoomStore {
  /**
   * Copia en memoria de cada sala.
   *
   * Sin ella, cada jugada obligaba a parsear y volver a serializar la sala
   * entera (log + snapshot) varias veces: con los bots jugando seguido eso
   * acaba comiéndose el hilo principal. La memoria manda; localStorage es solo
   * la copia persistente.
   */
  private cache = new Map<string, LocalRoomData>();

  constructor(private storage: Storage) {}

  private keyFor(roomId: string): string {
    return `${STORAGE_PREFIX}${roomId}`;
  }

  read(roomId: string): LocalRoomData | null {
    const cached = this.cache.get(roomId);
    if (cached) return cached;
    try {
      const raw = this.storage.getItem(this.keyFor(roomId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocalRoomData;
      parsed.seats = parsed.seats ?? {};
      parsed.log = parsed.log ?? {};
      parsed.chat = parsed.chat ?? {};
      parsed.snapshot = parsed.snapshot ?? null;
      this.cache.set(roomId, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  /** Olvida la copia en memoria (otra pestaña ha tocado la sala). */
  invalidate(roomId?: string): void {
    if (roomId) this.cache.delete(roomId);
    else this.cache.clear();
  }

  write(roomId: string, data: LocalRoomData): void {
    this.cache.set(roomId, data);
    this.storage.setItem(this.keyFor(roomId), JSON.stringify(data));
    this.index(roomId);
  }

  /** Modifica la sala de forma atómica y devuelve el resultado. */
  update(roomId: string, mutate: (data: LocalRoomData) => void): LocalRoomData | null {
    const data = this.read(roomId);
    if (!data) return null;
    mutate(data);
    data.meta.updatedAt = Date.now();
    this.write(roomId, data);
    return data;
  }

  create(meta: RoomMeta): LocalRoomData {
    const data: LocalRoomData = { meta, seats: {}, log: {}, chat: {}, snapshot: null };
    this.write(meta.id, data);
    return data;
  }

  delete(roomId: string): void {
    this.cache.delete(roomId);
    this.storage.removeItem(this.keyFor(roomId));
    const ids = this.listIds().filter((id) => id !== roomId);
    this.storage.setItem(INDEX_KEY, JSON.stringify(ids));
  }

  listIds(): string[] {
    try {
      const raw = this.storage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  list(): LocalRoomData[] {
    return this.listIds()
      .map((id) => this.read(id))
      .filter((room): room is LocalRoomData => room !== null)
      .sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
  }

  appendAction(roomId: string, action: GameAction, by: string): void {
    this.update(roomId, (data) => {
      const key = sequentialKey(Object.keys(data.log).length);
      data.log[key] = { action, by, ts: Date.now() };
    });
  }

  appendChat(roomId: string, entry: Omit<ChatEntry, 'key'>): void {
    this.update(roomId, (data) => {
      const key = sequentialKey(Object.keys(data.chat).length);
      data.chat[key] = entry;
    });
  }

  setSnapshot(roomId: string, upTo: number, state: GameState): void {
    this.update(roomId, (data) => {
      data.snapshot = { upTo, state, ts: Date.now() };
    });
  }

  private index(roomId: string): void {
    const ids = this.listIds();
    if (!ids.includes(roomId)) {
      ids.push(roomId);
      this.storage.setItem(INDEX_KEY, JSON.stringify(ids));
    }
  }
}

/** Convierte el almacén local al formato de listas que consume la interfaz. */
export function toSeatList(data: LocalRoomData | null): RoomSeat[] {
  if (!data) return [];
  return Object.values(data.seats).sort((a, b) => a.order - b.order || a.joinedAt - b.joinedAt);
}

export function toLogList(data: LocalRoomData | null): LoggedActionEntry[] {
  if (!data) return [];
  return Object.entries(data.log)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => ({ key, action: entry.action, ts: entry.ts, by: entry.by }));
}

export function toChatList(data: LocalRoomData | null): ChatEntry[] {
  if (!data) return [];
  return Object.entries(data.chat)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => ({ key, ...entry }));
}
