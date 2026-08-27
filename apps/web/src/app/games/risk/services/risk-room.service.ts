import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  DataSnapshot,
  equalTo,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { database } from '../../../firebase.config';
import { GameAction, GameConfig, GameState, PlayerKind, BotProfile } from '@devweb/shared/engine/types';
import {
  LOCAL_PREFIX,
  LocalRoomStore,
  isLocalRoomId,
  toChatList,
  toLogList,
  toSeatList,
} from './local-room-store';

/**
 * Sala de RISK sobre Firebase Realtime Database.
 *
 * No hay servidor de juego: el modelo es *lockstep determinista*. Cada cliente
 * escribe sus acciones en un log ordenado y todos reproducen el mismo log con el
 * mismo motor, así que todos llegan al mismo estado sin que nadie mande.
 *
 * Eso trae tres regalos:
 *  - Multijugador real en GitHub Pages, sin backend.
 *  - La partida queda grabada: el log ES la grabación, y se puede revivir entera.
 *  - Reanudar es trivial: se vuelve a reproducir el log (o el último snapshot).
 *
 * Coste: cada acción son unos pocos bytes, así que una partida completa cabe de
 * sobra en la capa gratuita.
 *
 * Las salas cuyo identificador empieza por LOCAL- viven en el propio navegador
 * (ver `local-room-store.ts`). Mismo formato de datos, cero red: sirven para
 * jugar contra los bots sin cuenta y sin depender de que Firebase esté abierto.
 */

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface RoomMeta {
  id: string;
  name: string;
  mapId: string;
  maxPlayers: number;
  seed: number;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  ownerUid: string;
  ownerName: string;
  config: GameConfig;
  /** Semilla de invitación: quien la tenga puede ocupar un asiento libre. */
  inviteCode: string;
  /** true cuando la sala vive solo en este navegador. */
  local?: boolean;
  /**
   * Alineación congelada en el momento de empezar.
   *
   * Es lo que garantiza que la partida sea reproducible: el estado inicial se
   * calcula a partir de esta lista, no de los asientos actuales. Así, aunque
   * después alguien se renombre, se desconecte o se le cambie el color, todos
   * los clientes siguen reconstruyendo exactamente el mismo tablero.
   */
  roster?: RosterEntry[];
}

/** Un jugador tal y como entró en la partida. */
export interface RosterEntry {
  id: string;
  name: string;
  kind: PlayerKind;
  botProfile?: BotProfile;
  color: string;
  seatToken: string;
}

export interface RoomSeat {
  id: string;
  name: string;
  kind: PlayerKind;
  botProfile?: BotProfile;
  /** Identidad persistente del ocupante: uid de Firebase o token local. */
  seatToken: string;
  color: string;
  order: number;
  joinedAt: number;
  lastSeen: number;
  connected: boolean;
  isOwner: boolean;
}

export interface LoggedActionEntry {
  key: string;
  action: GameAction;
  ts: number;
  by: string;
}

export type ChatKind = 'player' | 'bot' | 'system' | 'advisor';

export interface ChatEntry {
  key: string;
  authorId: string;
  author: string;
  kind: ChatKind;
  text: string;
  ts: number;
  /** 'llm' cuando el texto lo ha escrito un modelo de lenguaje. */
  origin?: 'llm' | 'local';
}

export interface RoomSnapshot {
  /** Número de acciones del log ya incorporadas al estado. */
  upTo: number;
  state: GameState;
  ts: number;
}

export interface RoomSummary {
  meta: RoomMeta;
  seatCount: number;
  humanCount: number;
}

const ROOMS_PATH = 'riskRooms';
/** Cada cuántas acciones conviene guardar un snapshot. */
export const SNAPSHOT_EVERY = 40;
/** Las salas se limpian pasado un mes sin tocarlas. */
export const ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class RiskRoomService {
  private listeners: Array<() => void> = [];
  private currentRoomId = '';
  private store: LocalRoomStore | null = null;
  private storageHandler: ((event: StorageEvent) => void) | null = null;

  private metaSubject = new BehaviorSubject<RoomMeta | null>(null);
  private seatsSubject = new BehaviorSubject<RoomSeat[]>([]);
  private logSubject = new BehaviorSubject<LoggedActionEntry[]>([]);
  private chatSubject = new BehaviorSubject<ChatEntry[]>([]);
  private snapshotSubject = new BehaviorSubject<RoomSnapshot | null>(null);

  readonly meta$: Observable<RoomMeta | null> = this.metaSubject.asObservable();
  readonly seats$: Observable<RoomSeat[]> = this.seatsSubject.asObservable();
  readonly log$: Observable<LoggedActionEntry[]> = this.logSubject.asObservable();
  readonly chat$: Observable<ChatEntry[]> = this.chatSubject.asObservable();
  readonly snapshot$: Observable<RoomSnapshot | null> = this.snapshotSubject.asObservable();

  get roomId(): string {
    return this.currentRoomId;
  }

  private get localStore(): LocalRoomStore | null {
    if (this.store) return this.store;
    const storage = safeStorage();
    if (!storage) return null;
    this.store = new LocalRoomStore(storage);
    return this.store;
  }

  // ===== CREAR Y CONFIGURAR =====

  /** Crea una sala nueva y devuelve sus datos. */
  async createRoom(options: {
    name: string;
    mapId: string;
    maxPlayers: number;
    ownerUid: string;
    ownerName: string;
    config: GameConfig;
    seed?: number;
    local?: boolean;
  }): Promise<RoomMeta> {
    const local = options.local ?? false;
    const id = generateRoomId(local);
    const now = Date.now();
    const meta: RoomMeta = {
      id,
      name: options.name.trim() || 'Sala sin nombre',
      mapId: options.mapId,
      maxPlayers: options.maxPlayers,
      seed: options.seed ?? Math.floor(Math.random() * 0xffffffff),
      status: 'lobby',
      createdAt: now,
      updatedAt: now,
      ownerUid: options.ownerUid,
      ownerName: options.ownerName,
      config: options.config,
      inviteCode: generateInviteCode(),
      local,
    };

    if (local) {
      this.localStore?.create(meta);
      return meta;
    }
    await set(ref(database, `${ROOMS_PATH}/${id}/meta`), meta);
    return meta;
  }

  /** Se suscribe a todos los nodos de una sala. */
  listenToRoom(roomId: string): void {
    if (this.currentRoomId === roomId && (this.listeners.length > 0 || this.storageHandler)) return;
    this.disconnect();
    this.currentRoomId = roomId;

    if (isLocalRoomId(roomId)) {
      this.emitLocal(roomId);
      // Otra pestaña puede estar jugando la misma sala local.
      this.storageHandler = () => {
        this.localStore?.invalidate(roomId);
        this.emitLocal(roomId);
      };
      window.addEventListener('storage', this.storageHandler);
      return;
    }

    this.listeners.push(
      onValue(ref(database, `${ROOMS_PATH}/${roomId}/meta`), (snapshot) => {
        this.metaSubject.next((snapshot.val() as RoomMeta | null) ?? null);
      }),
      onValue(ref(database, `${ROOMS_PATH}/${roomId}/seats`), (snapshot) => {
        this.seatsSubject.next(mapSeats(snapshot));
      }),
      onValue(ref(database, `${ROOMS_PATH}/${roomId}/log`), (snapshot) => {
        this.logSubject.next(mapLog(snapshot));
      }),
      onValue(ref(database, `${ROOMS_PATH}/${roomId}/chat`), (snapshot) => {
        this.chatSubject.next(mapChat(snapshot));
      }),
      onValue(ref(database, `${ROOMS_PATH}/${roomId}/snapshot`), (snapshot) => {
        this.snapshotSubject.next((snapshot.val() as RoomSnapshot | null) ?? null);
      }),
    );
  }

  /** Vuelca a los observables el contenido actual de una sala local. */
  private emitLocal(roomId: string): void {
    const data = this.localStore?.read(roomId) ?? null;
    this.metaSubject.next(data?.meta ?? null);
    this.seatsSubject.next(toSeatList(data));
    this.logSubject.next(toLogList(data));
    this.chatSubject.next(toChatList(data));
    this.snapshotSubject.next(data?.snapshot ?? null);
  }

  /** Lee una sala una sola vez (para comprobar invitaciones). */
  async fetchMeta(roomId: string): Promise<RoomMeta | null> {
    if (isLocalRoomId(roomId)) return this.localStore?.read(roomId)?.meta ?? null;
    return new Promise((resolve) => {
      onValue(
        ref(database, `${ROOMS_PATH}/${roomId}/meta`),
        (snapshot) => resolve((snapshot.val() as RoomMeta | null) ?? null),
        { onlyOnce: true },
      );
    });
  }

  /** Salas guardadas en este navegador. */
  listLocalRooms(): RoomSummary[] {
    return (this.localStore?.list() ?? []).map((room) => {
      const seats = Object.values(room.seats);
      return {
        meta: room.meta,
        seatCount: seats.length,
        humanCount: seats.filter((seat) => seat.kind === 'human').length,
      };
    });
  }

  /** Salas creadas por un administrador, para poder retomarlas. */
  async listRoomsForOwner(ownerUid: string): Promise<RoomSummary[]> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (rooms: RoomSummary[]) => {
        if (settled) return;
        settled = true;
        resolve(rooms);
      };
      // Si Firebase no responde (reglas cerradas, sin red...) no dejamos la
      // pantalla colgada: devolvemos lo que haya.
      const timer = setTimeout(() => finish([]), 6000);

      // Se pregunta SOLO por las salas propias, no se descarga la base entera y
      // se filtra aquí: las reglas de seguridad únicamente aceptan esta consulta
      // exacta, y además así no se bajan los logs de partidas ajenas.
      onValue(
        query(ref(database, ROOMS_PATH), orderByChild('meta/ownerUid'), equalTo(ownerUid)),
        (snapshot) => {
          clearTimeout(timer);
          const rooms = (snapshot.val() as Record<string, any> | null) ?? {};
          const summaries: RoomSummary[] = Object.values(rooms)
            .filter((room) => room?.meta?.ownerUid === ownerUid)
            .map((room) => {
              const seats = Object.values((room.seats ?? {}) as Record<string, RoomSeat>);
              return {
                meta: room.meta as RoomMeta,
                seatCount: seats.length,
                humanCount: seats.filter((seat) => seat.kind === 'human').length,
              };
            })
            .sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
          finish(summaries);
        },
        () => {
          clearTimeout(timer);
          finish([]);
        },
        { onlyOnce: true },
      );
    });
  }

  // ===== ASIENTOS =====

  /**
   * Ocupa un asiento. Si el token ya tenía uno reservado, lo recupera: así, al
   * volver a una partida guardada, cada persona vuelve a sus ejércitos.
   */
  async claimSeat(
    roomId: string,
    seat: {
      name: string;
      seatToken: string;
      kind?: PlayerKind;
      botProfile?: BotProfile;
      color: string;
      isOwner?: boolean;
    },
  ): Promise<string> {
    const known = isLocalRoomId(roomId)
      ? toSeatList(this.localStore?.read(roomId) ?? null)
      : this.seatsSubject.value;
    const existing = known.find((s) => s.seatToken === seat.seatToken);
    const seatId = existing?.id ?? generateSeatId();
    const order = existing?.order ?? known.length;
    const now = Date.now();

    const payload: RoomSeat = {
      id: seatId,
      name: seat.name.trim().slice(0, 24) || 'Jugador',
      kind: seat.kind ?? 'human',
      ...(seat.botProfile !== undefined && { botProfile: seat.botProfile }),
      seatToken: seat.seatToken,
      color: seat.color,
      order,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
      connected: true,
      isOwner: seat.isOwner ?? existing?.isOwner ?? false,
    };

    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        data.seats[seatId] = stripUndefined(payload);
      });
      this.emitLocal(roomId);
      return seatId;
    }

    const seatRef = ref(database, `${ROOMS_PATH}/${roomId}/seats/${seatId}`);
    await set(seatRef, stripUndefined(payload));
    // Al cerrar la pestaña el asiento se marca desconectado, pero no se borra:
    // la partida guardada debe respetar a quien la estaba jugando.
    onDisconnect(ref(database, `${ROOMS_PATH}/${roomId}/seats/${seatId}/connected`)).set(false);
    await this.touch(roomId);
    return seatId;
  }

  async addBotSeat(
    roomId: string,
    bot: { name: string; botProfile: BotProfile; color: string },
  ): Promise<string> {
    const known = isLocalRoomId(roomId)
      ? toSeatList(this.localStore?.read(roomId) ?? null)
      : this.seatsSubject.value;
    const seatId = generateSeatId();
    const now = Date.now();
    const payload: RoomSeat = {
      id: seatId,
      name: bot.name,
      kind: 'bot',
      botProfile: bot.botProfile,
      seatToken: `bot:${seatId}`,
      color: bot.color,
      order: known.length,
      joinedAt: now,
      lastSeen: now,
      connected: true,
      isOwner: false,
    };

    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        data.seats[seatId] = stripUndefined(payload);
      });
      this.emitLocal(roomId);
      return seatId;
    }

    await set(ref(database, `${ROOMS_PATH}/${roomId}/seats/${seatId}`), stripUndefined(payload));
    await this.touch(roomId);
    return seatId;
  }

  async removeSeat(roomId: string, seatId: string): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        delete data.seats[seatId];
      });
      this.emitLocal(roomId);
      return;
    }
    await remove(ref(database, `${ROOMS_PATH}/${roomId}/seats/${seatId}`));
    await this.touch(roomId);
  }

  async updateSeat(roomId: string, seatId: string, changes: Partial<RoomSeat>): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        if (data.seats[seatId]) {
          data.seats[seatId] = { ...data.seats[seatId], ...stripUndefined(changes) };
        }
      });
      this.emitLocal(roomId);
      return;
    }
    await update(ref(database, `${ROOMS_PATH}/${roomId}/seats/${seatId}`), stripUndefined(changes));
    await this.touch(roomId);
  }

  async markPresence(roomId: string, seatId: string): Promise<void> {
    await this.updateSeat(roomId, seatId, { lastSeen: Date.now(), connected: true });
  }

  // ===== PARTIDA =====

  async setStatus(roomId: string, status: RoomStatus): Promise<void> {
    await this.updateMeta(roomId, { status });
  }

  async updateMeta(roomId: string, changes: Partial<RoomMeta>): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        data.meta = { ...data.meta, ...stripUndefined(changes) };
      });
      this.emitLocal(roomId);
      return;
    }
    await update(ref(database, `${ROOMS_PATH}/${roomId}/meta`), {
      ...stripUndefined(changes),
      updatedAt: Date.now(),
    });
  }

  /** Añade una acción al log. El orden lo fija la clave que genera Firebase. */
  async pushAction(roomId: string, action: GameAction, by: string): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.appendAction(roomId, action, by);
      this.emitLocal(roomId);
      return;
    }
    await push(
      ref(database, `${ROOMS_PATH}/${roomId}/log`),
      // `ts` se deja fuera del saneado: es un marcador del servidor, no un dato.
      { ...stripUndefined({ action, by }), ts: serverTimestamp() },
    );
    await this.touch(roomId);
  }

  /** Guarda un punto de control para no tener que reproducir el log entero. */
  async writeSnapshot(roomId: string, upTo: number, state: GameState): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.setSnapshot(roomId, upTo, state);
      return;
    }
    await set(
      ref(database, `${ROOMS_PATH}/${roomId}/snapshot`),
      // El estado va lleno de campos opcionales; sin limpiar, el SDK lanza.
      stripUndefined({ upTo, state, ts: Date.now() }),
    );
  }

  // ===== CHAT =====

  async sendChat(
    roomId: string,
    entry: { authorId: string; author: string; kind: ChatKind; text: string; origin?: 'llm' | 'local' },
  ): Promise<void> {
    const text = entry.text.trim().slice(0, 600);
    if (!text) return;
    const payload = stripUndefined({
      authorId: entry.authorId,
      author: entry.author,
      kind: entry.kind,
      text,
      origin: entry.origin,
      ts: Date.now(),
    });

    if (isLocalRoomId(roomId)) {
      this.localStore?.appendChat(roomId, payload as Omit<ChatEntry, 'key'>);
      this.emitLocal(roomId);
      return;
    }
    await push(ref(database, `${ROOMS_PATH}/${roomId}/chat`), payload);
  }

  // ===== MANTENIMIENTO =====

  async deleteRoom(roomId: string): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.delete(roomId);
      if (this.currentRoomId === roomId) this.emitLocal(roomId);
      return;
    }
    await remove(ref(database, `${ROOMS_PATH}/${roomId}`));
  }

  /**
   * Borra tus salas abandonadas para no engordar la base gratuita.
   *
   * Solo las tuyas: la base ya no deja listar las de nadie más, y borrar la
   * partida de otro tampoco sería asunto tuyo.
   */
  async cleanOldRooms(ownerUid: string, now = Date.now()): Promise<number> {
    return new Promise((resolve) => {
      onValue(
        query(ref(database, ROOMS_PATH), orderByChild('meta/ownerUid'), equalTo(ownerUid)),
        async (snapshot) => {
          const rooms = (snapshot.val() as Record<string, any> | null) ?? {};
          let removed = 0;
          for (const [roomId, room] of Object.entries(rooms)) {
            const updatedAt = room?.meta?.updatedAt ?? room?.meta?.createdAt ?? 0;
            if (updatedAt && now - updatedAt > ROOM_TTL_MS) {
              await remove(ref(database, `${ROOMS_PATH}/${roomId}`));
              removed++;
            }
          }
          resolve(removed);
        },
        () => resolve(0),
        { onlyOnce: true },
      );
    });
  }

  private async touch(roomId: string): Promise<void> {
    await update(ref(database, `${ROOMS_PATH}/${roomId}/meta`), { updatedAt: Date.now() });
  }

  disconnect(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    this.currentRoomId = '';
    this.metaSubject.next(null);
    this.seatsSubject.next([]);
    this.logSubject.next([]);
    this.chatSubject.next([]);
    this.snapshotSubject.next(null);
  }
}

// ===== AYUDAS PURAS (testeables sin Firebase) =====

export function mapSeats(snapshot: DataSnapshot | { val(): unknown }): RoomSeat[] {
  const value = (snapshot.val() as Record<string, RoomSeat> | null) ?? {};
  return Object.values(value).sort((a, b) => a.order - b.order || a.joinedAt - b.joinedAt);
}

export function mapLog(snapshot: DataSnapshot | { val(): unknown }): LoggedActionEntry[] {
  const value = (snapshot.val() as Record<string, any> | null) ?? {};
  return Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => ({
      key,
      action: entry.action as GameAction,
      ts: typeof entry.ts === 'number' ? entry.ts : 0,
      by: entry.by ?? '',
    }));
}

export function mapChat(snapshot: DataSnapshot | { val(): unknown }): ChatEntry[] {
  const value = (snapshot.val() as Record<string, any> | null) ?? {};
  return Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => ({
      key,
      authorId: entry.authorId ?? '',
      author: entry.author ?? '',
      kind: (entry.kind as ChatKind) ?? 'system',
      text: entry.text ?? '',
      ts: entry.ts ?? 0,
      origin: entry.origin,
    }));
}

/** Firebase rechaza `undefined`: hay que limpiarlo antes de escribir. */
/**
 * Quita los `undefined` a cualquier profundidad, antes de mandar nada a Firebase.
 *
 * El SDK LANZA EXCEPCIÓN si el valor contiene un `undefined` en cualquier sitio,
 * y esto es un juego lleno de campos opcionales: `botProfile` no existe en un
 * jugador humano, `units` solo aparece en modo avanzado, `missions` solo con
 * objetivos... La versión anterior solo miraba el primer nivel, así que empezar
 * una partida online reventaba al mandar la alineación, porque cada humano
 * llevaba dentro un `botProfile: undefined`.
 *
 * Y no se veía en local: allí se guarda con `JSON.stringify`, que descarta los
 * `undefined` sin decir nada. Por eso el modo local iba y el online no.
 *
 * Los arrays se conservan como arrays; un elemento `undefined` pasa a `null`
 * para no descolocar los índices, de los que depende el orden de la mesa.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefined(item))) as unknown as T;
  }
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item !== undefined) out[key] = stripUndefined(item);
  }
  return out as T;
}

export function generateRoomId(local = false): string {
  const body = `${randomChunk(4)}-${randomChunk(4)}`;
  return local ? `${LOCAL_PREFIX}${body}` : `RISK-${body}`;
}

export function generateSeatId(): string {
  return `seat-${randomChunk(6).toLowerCase()}`;
}

export function generateInviteCode(): string {
  return randomChunk(6);
}

/** Token estable por navegador: permite volver a tu asiento sin cuenta. */
export function localSeatToken(storage: Storage | undefined = safeStorage()): string {
  const key = 'risk_seat_token';
  if (!storage) return `anon-${randomChunk(8).toLowerCase()}`;
  const existing = storage.getItem(key);
  if (existing) return existing;
  const token = `guest-${randomChunk(10).toLowerCase()}`;
  storage.setItem(key, token);
  return token;
}

function randomChunk(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i++) values[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[values[i] % alphabet.length];
  return out;
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
