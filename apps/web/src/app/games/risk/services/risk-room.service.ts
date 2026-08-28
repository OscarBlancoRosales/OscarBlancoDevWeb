import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RoomSocket } from '../../../api/room-socket';
import { RoomsApiService } from '../../../api/rooms-api.service';
import { browserStorage } from '@devweb/shared/platform';
import type { KeyValueStorage } from '@devweb/shared/platform';
import { GameAction, GameConfig, GameState, PlayerKind, BotProfile } from '@devweb/shared/engine/types';
import {
  LOCAL_PREFIX,
  LocalRoomStore,
  isLocalRoomId,
  toChatList,
  toLogList,
  toSeatList,
} from './local-room-store';
import type { RoomInfo, SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';

/**
 * Sala de RISK contra el backend propio.
 *
 * El servidor es el árbitro: recibe las jugadas, las juzga con el mismo motor
 * que el navegador y devuelve el estado ya calculado. El cliente no reproduce
 * nada, solo pinta lo que le llega. De ahí que el log salga siempre vacío y el
 * estado venga entero en `snapshot$`: no hay nada que reconstruir.
 *
 * Lo que se gana respecto a Firebase, además de no depender de nadie:
 *  - las cartas de los rivales no salen del servidor;
 *  - una jugada firmada con el nombre de otro se rechaza en el servidor, no en
 *    la buena voluntad del cliente.
 *
 * Las salas cuyo identificador empieza por LOCAL- siguen viviendo en el propio
 * navegador (ver `local-room-store.ts`): mismo formato de datos, cero red, y
 * ahí sí se reproduce el log en local porque no hay servidor que arbitre.
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
   * En las salas locales es lo que garantiza que la partida sea reproducible.
   * En las de servidor la alineación de verdad la congela el servidor al pasar
   * a `playing`; esta copia solo sirve para la vista previa de la sala de
   * espera, antes de que exista partida.
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
  /** Identidad del ocupante dentro del cliente. Nunca el pase del asiento. */
  seatToken: string;
  color: string;
  order: number;
  joinedAt: number;
  lastSeen: number;
  connected: boolean;
  isOwner: boolean;
  /** Cara elegida en la sala de espera. Viaja en la metainformación del asiento. */
  avatar?: string;
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
  /**
   * A quién va dirigido. Ausente es el canal de todos.
   *
   * Ahora sí es un secreto de verdad: el servidor no le manda un privado a
   * quien no es ninguno de los dos extremos. Cuando esto vivía en Firebase el
   * mensaje viajaba entero a todo el mundo y sólo se escondía al pintarlo.
   */
  to?: string;
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

/** Cada cuántas acciones conviene guardar un snapshot. */
export const SNAPSHOT_EVERY = 40;

/** Dónde se guarda el pase de cada sala. Uno por sala, no uno por navegador. */
const PASES_KEY = 'risk_seat_passes';

/** Cuánto se espera a que el servidor conteste una jugada. */
const ESPERA_MAXIMA_MS = 5000;

@Injectable({ providedIn: 'root' })
export class RiskRoomService {
  private currentRoomId = '';
  private store: LocalRoomStore | null = null;
  private storageHandler: ((event: StorageEvent) => void) | null = null;
  private readonly socket: RoomSocket;

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

  constructor(
    private readonly rooms: RoomsApiService,
    zone: NgZone,
  ) {
    this.socket = new RoomSocket(zone);
    this.socket.messages$.subscribe((mensaje) => {
      this.recibir(mensaje);
    });
  }

  get roomId(): string {
    return this.currentRoomId;
  }

  private get localStore(): LocalRoomStore | null {
    if (this.store) return this.store;
    const storage = browserStorage();
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
    const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff);
    const nombre = options.name.trim() || 'Sala sin nombre';

    if (options.local ?? false) {
      const meta: RoomMeta = {
        id: `${LOCAL_PREFIX}${randomChunk(4)}-${randomChunk(4)}`,
        name: nombre,
        mapId: options.mapId,
        maxPlayers: options.maxPlayers,
        seed,
        status: 'lobby',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerUid: options.ownerUid,
        ownerName: options.ownerName,
        config: options.config,
        inviteCode: randomChunk(6),
        local: true,
      };
      this.localStore?.create(meta);
      return meta;
    }

    const grant = await this.rooms.crear({
      game: 'risk',
      name: nombre,
      displayName: options.ownerName,
      config: {
        mapId: options.mapId,
        seed,
        maxPlayers: options.maxPlayers,
        ownerName: options.ownerName,
        reglas: options.config,
      },
    });
    // Con el asiento, no solo con el pase: crear la sala ya te sienta en ella,
    // y sin recordar cuál es tu silla el siguiente `claimSeat` te sentaría otra vez.
    this.guardarPase(grant.room.id, grant.seatToken, grant.seatId);
    return aMeta(grant.room, options.ownerUid);
  }

  /**
   * Se pone a seguir una sala.
   *
   * En las locales se lee del navegador y se escucha a las otras pestañas. En
   * las de servidor se pide el estado una vez por HTTP —para poder enseñar la
   * sala de espera aunque todavía no tengas asiento— y se abre el WebSocket en
   * cuanto hay pase.
   */
  listenToRoom(roomId: string): void {
    if (this.currentRoomId === roomId) return;
    this.disconnect();
    this.currentRoomId = roomId;

    if (isLocalRoomId(roomId)) {
      this.emitLocal(roomId);
      // Otra pestaña puede estar jugando la misma sala local.
      this.storageHandler = (): void => {
        this.localStore?.invalidate(roomId);
        this.emitLocal(roomId);
      };
      globalThis.addEventListener('storage', this.storageHandler);
      return;
    }

    void this.refrescar(roomId);
    const pase = this.paseDe(roomId);
    if (pase) this.socket.conectar(roomId, pase);
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
    try {
      return aMeta(await this.rooms.info(roomId), '');
    } catch {
      return null;
    }
  }

  listLocalRooms(): RoomSummary[] {
    const salas = this.localStore?.list() ?? [];
    return salas.map((data) => {
      const seats = toSeatList(data);
      return {
        meta: data.meta,
        seatCount: seats.length,
        humanCount: seats.filter((seat) => seat.kind === 'human').length,
      };
    });
  }

  /**
   * Tus salas guardadas.
   *
   * El servidor solo devuelve las tuyas, así que no hace falta filtrar por
   * dueño ni fiarse de un campo que viaja: si están en la lista, son tuyas.
   */
  async listRoomsForOwner(ownerUid: string): Promise<RoomSummary[]> {
    try {
      const { rooms } = await this.rooms.mias();
      return rooms
        .filter((room) => room.game === 'risk')
        .map((room) => {
          const seats = room.seats;
          return {
            meta: aMeta(room, ownerUid),
            seatCount: seats.length,
            humanCount: seats.filter((seat) => !seat.isBot).length,
          };
        });
    } catch {
      return [];
    }
  }

  // ===== ASIENTOS =====

  /**
   * Ocupa un asiento, o recupera el que ya tenías.
   *
   * El pase guardado es lo que permite volver: al recargar la página o al
   * abrir de nuevo una partida guardada, se vuelve al mismo asiento con los
   * mismos ejércitos en vez de aparecer como alguien nuevo.
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
    const nombre = seat.name.trim().slice(0, 24) || 'Jugador';

    if (isLocalRoomId(roomId)) return this.sentarEnLocal(roomId, nombre, seat);

    const pase = this.paseDe(roomId);
    if (pase) {
      const sala = await this.rooms.info(roomId);
      const mio = sala.seats.find((asiento) => asiento.id === this.asientoDe(roomId));
      if (mio) {
        await this.rooms.cambiarAsiento(
          roomId,
          mio.id,
          { displayName: nombre, meta: { ...mio.meta, color: seat.color } },
          pase,
        );
        this.conectar(roomId, pase);
        return mio.id;
      }
    }

    const grant = await this.rooms.unirse(roomId, nombre);
    this.guardarPase(roomId, grant.seatToken, grant.seatId);
    await this.rooms.cambiarAsiento(
      roomId,
      grant.seatId,
      { meta: { color: seat.color, joinedAt: Date.now() } },
      grant.seatToken,
    );
    this.conectar(roomId, grant.seatToken);
    return grant.seatId;
  }

  async addBotSeat(
    roomId: string,
    bot: { name: string; botProfile: BotProfile; color: string },
  ): Promise<string> {
    if (isLocalRoomId(roomId)) {
      const conocidos = toSeatList(this.localStore?.read(roomId) ?? null);
      const seatId = generateSeatId();
      const ahora = Date.now();
      this.localStore?.update(roomId, (data) => {
        data.seats[seatId] = {
          id: seatId,
          name: bot.name,
          kind: 'bot',
          botProfile: bot.botProfile,
          seatToken: `bot:${seatId}`,
          color: bot.color,
          order: conocidos.length,
          joinedAt: ahora,
          lastSeen: ahora,
          connected: true,
          isOwner: false,
        };
      });
      this.emitLocal(roomId);
      return seatId;
    }

    const grant = await this.rooms.anadirAsiento(roomId, {
      displayName: bot.name,
      isBot: true,
      meta: { botProfile: bot.botProfile, color: bot.color, joinedAt: Date.now() },
    });
    return grant.seatId;
  }

  async removeSeat(roomId: string, seatId: string): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        delete data.seats[seatId];
      });
      this.emitLocal(roomId);
      return;
    }
    await this.rooms.quitarAsiento(roomId, seatId, this.paseDe(roomId) ?? undefined);
  }

  /**
   * Cambia lo que se puede cambiar de un asiento.
   *
   * `connected` y `lastSeen` no viajan: en el servidor la presencia es tener el
   * WebSocket abierto, y eso no se puede declarar, solo demostrar.
   */
  async updateSeat(roomId: string, seatId: string, changes: Partial<RoomSeat>): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        const asiento = data.seats[seatId];
        if (asiento) data.seats[seatId] = { ...asiento, ...changes };
      });
      this.emitLocal(roomId);
      return;
    }

    const meta: Record<string, unknown> = {};
    if (changes.color !== undefined) meta['color'] = changes.color;
    if (changes.botProfile !== undefined) meta['botProfile'] = changes.botProfile;
    if (changes.name === undefined && Object.keys(meta).length === 0) return;

    const actual = this.seatsSubject.value.find((asiento) => asiento.id === seatId);
    await this.rooms.cambiarAsiento(
      roomId,
      seatId,
      {
        ...(changes.name !== undefined && { displayName: changes.name }),
        ...(Object.keys(meta).length > 0 && { meta: { ...metaDe(actual), ...meta } }),
      },
      this.paseDe(roomId) ?? undefined,
    );
  }

  /** En las salas de servidor la presencia es la conexión: no hay nada que marcar. */
  async markPresence(roomId: string, seatId: string): Promise<void> {
    if (!isLocalRoomId(roomId)) return;
    await this.updateSeat(roomId, seatId, { lastSeen: Date.now(), connected: true });
  }

  // ===== PARTIDA =====

  async setStatus(roomId: string, status: RoomStatus): Promise<void> {
    await this.updateMeta(roomId, { status });
  }

  async updateMeta(roomId: string, changes: Partial<RoomMeta>): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.update(roomId, (data) => {
        data.meta = { ...data.meta, ...changes };
      });
      this.emitLocal(roomId);
      return;
    }

    const { status, name, ...resto } = changes;
    const config = configDe(this.metaSubject.value, resto);
    await this.rooms.cambiarSala(roomId, {
      ...(name !== undefined && { name }),
      ...(status !== undefined && { status }),
      ...(config !== null && { config }),
    });
    await this.refrescar(roomId);
  }

  /**
   * Manda una jugada y espera a que el servidor conteste.
   *
   * Esperar no es cortesía: quien mueve los bots comprueba si el estado ha
   * avanzado para saber si la jugada entró, y si esto volviera nada más
   * enviarla, siempre parecería rechazada. Da igual si contesta con el estado
   * nuevo o con un rechazo; lo que hace falta es que haya contestado.
   */
  async pushAction(roomId: string, action: GameAction, by: string): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.appendAction(roomId, action, by);
      this.emitLocal(roomId);
      return;
    }
    const antes = this.snapshotSubject.value?.upTo ?? 0;
    this.socket.enviar(action);
    await this.respuestaDelServidor(antes);
  }

  /**
   * Se resuelve cuando el servidor dice algo sobre la jugada, o cuando se
   * acaba la paciencia: si la conexión se ha caído, quien esperaba tiene que
   * poder seguir y volver a intentarlo.
   */
  private respuestaDelServidor(desdeSeq: number): Promise<void> {
    return new Promise((resolve) => {
      const terminar = (): void => {
        clearTimeout(reloj);
        suscripcion.unsubscribe();
        resolve();
      };
      const reloj = setTimeout(terminar, ESPERA_MAXIMA_MS);
      const suscripcion = this.socket.messages$.subscribe((mensaje) => {
        const contesta =
          mensaje.tipo === 'rechazada' || (mensaje.tipo === 'estado' && mensaje.seq > desdeSeq);
        if (contesta) terminar();
      });
    });
  }

  /** Guarda un punto de control. En red lo lleva el servidor, que es quien aplica. */
  async writeSnapshot(roomId: string, upTo: number, state: GameState): Promise<void> {
    if (isLocalRoomId(roomId)) this.localStore?.setSnapshot(roomId, upTo, state);
  }

  // ===== CHAT =====

  /**
   * Dice algo en la sala.
   *
   * Del `entry` que llega solo viaja el texto y de parte de quién: el nombre y
   * el tipo los pone el servidor a partir del asiento, porque si los pusiera el
   * cliente cualquiera podría firmar con el nombre de otro o publicar avisos
   * con la voz de la sala.
   */
  async sendChat(
    roomId: string,
    entry: {
      authorId: string;
      author: string;
      kind: ChatKind;
      text: string;
      origin?: 'llm' | 'local' | undefined;
      /** Asiento al que va dirigido. Sin esto, es para todos. */
      to?: string | undefined;
    },
  ): Promise<void> {
    const text = entry.text.trim().slice(0, 600);
    if (!text) return;

    if (isLocalRoomId(roomId)) {
      this.localStore?.appendChat(roomId, {
        authorId: entry.authorId,
        author: entry.author,
        kind: entry.kind,
        text,
        ts: Date.now(),
        ...(entry.origin !== undefined && { origin: entry.origin }),
        ...(entry.to !== undefined && { to: entry.to }),
      });
      this.emitLocal(roomId);
      return;
    }

    this.socket.decir(text, {
      ...(entry.kind === 'bot' && { comoAsiento: entry.authorId }),
      ...(entry.kind === 'system' && { comoLaSala: true }),
      ...(entry.origin !== undefined && { origin: entry.origin }),
      ...(entry.to !== undefined && { para: entry.to }),
    });
  }

  // ===== MANTENIMIENTO =====

  async deleteRoom(roomId: string): Promise<void> {
    if (isLocalRoomId(roomId)) {
      this.localStore?.delete(roomId);
      if (this.currentRoomId === roomId) this.emitLocal(roomId);
      return;
    }
    await this.rooms.borrar(roomId);
    this.olvidarPase(roomId);
  }

  disconnect(): void {
    this.socket.cerrar();
    if (this.storageHandler) {
      globalThis.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    this.currentRoomId = '';
    this.metaSubject.next(null);
    this.seatsSubject.next([]);
    this.logSubject.next([]);
    this.chatSubject.next([]);
    this.snapshotSubject.next(null);
  }

  private conectar(roomId: string, pase: string): void {
    this.currentRoomId = roomId;
    this.socket.conectar(roomId, pase);
  }

  private async refrescar(roomId: string): Promise<void> {
    try {
      const sala = await this.rooms.info(roomId);
      if (this.currentRoomId !== roomId) return;
      this.metaSubject.next(aMeta(sala, this.metaSubject.value?.ownerUid ?? ''));
      this.seatsSubject.next(sala.seats.map(aSeat));
    } catch {
      // La sala puede no existir todavía o haber caducado el enlace: quien
      // llamó ya trata el meta nulo, y romper aquí dejaría la pantalla en
      // blanco sin decir por qué.
    }
  }

  /**
   * Lo que llega por el socket.
   *
   * El estado viene entero y ya aplicado, así que se entrega como punto de
   * control con el log vacío: no hay nada que reproducir encima.
   */
  private recibir(mensaje: ServerMessage): void {
    if (mensaje.tipo === 'chat') {
      this.chatSubject.next(mensaje.entradas.map(aChat));
      return;
    }
    if (mensaje.tipo !== 'estado') return;

    this.seatsSubject.next(mensaje.seats.map(aSeat));
    const meta = this.metaSubject.value;
    if (meta && meta.status !== mensaje.status) {
      this.metaSubject.next({ ...meta, status: mensaje.status });
    }
    this.snapshotSubject.next(
      mensaje.vista === null
        ? null
        : { upTo: mensaje.seq, state: mensaje.vista as GameState, ts: Date.now() },
    );
  }

  private sentarEnLocal(
    roomId: string,
    nombre: string,
    seat: { seatToken: string; kind?: PlayerKind; botProfile?: BotProfile; color: string; isOwner?: boolean },
  ): string {
    const conocidos = toSeatList(this.localStore?.read(roomId) ?? null);
    const previo = conocidos.find((asiento) => asiento.seatToken === seat.seatToken);
    const seatId = previo?.id ?? generateSeatId();
    const ahora = Date.now();

    this.localStore?.update(roomId, (data) => {
      data.seats[seatId] = {
        id: seatId,
        name: nombre,
        kind: seat.kind ?? 'human',
        ...(seat.botProfile !== undefined && { botProfile: seat.botProfile }),
        seatToken: seat.seatToken,
        color: seat.color,
        order: previo?.order ?? conocidos.length,
        joinedAt: previo?.joinedAt ?? ahora,
        lastSeen: ahora,
        connected: true,
        isOwner: seat.isOwner ?? previo?.isOwner ?? false,
      };
    });
    this.emitLocal(roomId);
    return seatId;
  }

  // ===== PASES =====

  private pases(): Record<string, { seatId: string; seatToken: string }> {
    try {
      const crudo = browserStorage()?.getItem(PASES_KEY);
      return crudo ? (JSON.parse(crudo) as Record<string, { seatId: string; seatToken: string }>) : {};
    } catch {
      return {};
    }
  }

  private guardarPase(roomId: string, seatToken: string, seatId = ''): void {
    const pases = this.pases();
    pases[roomId] = { seatId: seatId || (pases[roomId]?.seatId ?? ''), seatToken };
    browserStorage()?.setItem(PASES_KEY, JSON.stringify(pases));
  }

  private olvidarPase(roomId: string): void {
    const pases = this.pases();
    delete pases[roomId];
    browserStorage()?.setItem(PASES_KEY, JSON.stringify(pases));
  }

  private paseDe(roomId: string): string | null {
    return this.pases()[roomId]?.seatToken ?? null;
  }

  private asientoDe(roomId: string): string {
    return this.pases()[roomId]?.seatId ?? '';
  }
}

// ===== TRADUCCIÓN (pura, testeable sin red) =====

/**
 * La sala del servidor con la forma que espera la pantalla.
 *
 * Todo lo que el servidor no interpreta —mapa, semilla, reglas de la casa,
 * invitación— viaja dentro de `config`, que para él es una caja cerrada.
 */
export function aMeta(room: RoomInfo, ownerUid: string): RoomMeta {
  const config = room.config;
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    mapId: texto(config['mapId']) || 'world',
    maxPlayers: numero(config['maxPlayers']) ?? 6,
    seed: numero(config['seed']) ?? 1,
    ownerUid,
    ownerName: texto(config['ownerName']),
    config: (config['reglas'] ?? {}) as GameConfig,
    inviteCode: room.id,
    ...(Array.isArray(config['roster']) && { roster: config['roster'] as RosterEntry[] }),
  };
}

export function aSeat(seat: SeatInfo): RoomSeat {
  const meta = seat.meta ?? {};
  return {
    id: seat.id,
    name: seat.displayName,
    kind: seat.isBot ? 'bot' : 'human',
    ...(typeof meta['botProfile'] === 'string' && { botProfile: meta['botProfile'] as BotProfile }),
    ...(typeof meta['avatar'] === 'string' && { avatar: meta['avatar'] }),
    // La identidad del ocupante dentro del cliente es el propio asiento: el
    // pase no viaja a los demás, que es justo lo que antes sí pasaba.
    seatToken: seat.id,
    color: texto(meta['color']),
    order: seat.order,
    joinedAt: numero(meta['joinedAt']) ?? 0,
    lastSeen: 0,
    connected: seat.connected,
    isOwner: seat.isOwner,
  };
}

export function aChat(entrada: {
  seq: number;
  authorId: string;
  author: string;
  kind: ChatKind;
  text: string;
  at: number;
  origin?: string;
  to?: string | null;
}): ChatEntry {
  return {
    key: entrada.seq.toString(36).padStart(10, '0'),
    authorId: entrada.authorId,
    author: entrada.author,
    kind: entrada.kind,
    text: entrada.text,
    ts: entrada.at,
    ...(entrada.origin === 'llm' || entrada.origin === 'local' ? { origin: entrada.origin } : {}),
    ...(typeof entrada.to === 'string' && entrada.to ? { to: entrada.to } : {}),
  };
}

/**
 * La configuración que hay que reescribir entera al cambiar algo.
 *
 * El servidor guarda `config` como un todo, así que un cambio parcial obliga a
 * mandar lo que ya había. Devuelve `null` cuando no hay nada que tocar.
 */
function configDe(
  meta: RoomMeta | null,
  cambios: Partial<RoomMeta>,
): Record<string, unknown> | null {
  if (!meta || Object.keys(cambios).length === 0) return null;
  const fusionado = { ...meta, ...cambios };
  return {
    mapId: fusionado.mapId,
    seed: fusionado.seed,
    maxPlayers: fusionado.maxPlayers,
    ownerName: fusionado.ownerName,
    reglas: fusionado.config,
    ...(fusionado.roster !== undefined && { roster: fusionado.roster }),
  };
}

function metaDe(seat: RoomSeat | undefined): Record<string, unknown> {
  if (!seat) return {};
  return {
    color: seat.color,
    joinedAt: seat.joinedAt,
    ...(seat.botProfile !== undefined && { botProfile: seat.botProfile }),
  };
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' ? valor : null;
}

export function generateSeatId(): string {
  return `seat-${randomChunk(6).toLowerCase()}`;
}

/** Token estable por navegador: permite volver a tu asiento sin cuenta. */
export function localSeatToken(storage: KeyValueStorage | undefined = browserStorage()): string {
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
