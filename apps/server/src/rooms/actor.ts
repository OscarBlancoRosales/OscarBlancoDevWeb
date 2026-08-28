import { Value } from '@sinclair/typebox/value';
import type { GameModule, RuleError, Seat, SeatId } from '@devweb/shared/games/module';
import type {
  ChatEntry,
  ChatKind,
  RoomStatus,
  SeatInfo,
  ServerMessage,
} from '@devweb/shared/contracts/rooms';
import type { RoomRepository } from './repository';

/** Cada cuántas acciones se guarda una foto del estado. */
export const SNAPSHOT_CADA = 40;

/** Cuántos mensajes de chat se mandan al entrar. Los viejos quedan en la base. */
export const CHAT_MAXIMO = 200;

export interface Suscriptor {
  readonly seatId: SeatId;
  send(message: ServerMessage): void;
}

export interface RoomActorOptions {
  readonly roomId: string;
  readonly module: GameModule<unknown, unknown>;
  readonly repository: RoomRepository;
  readonly status?: RoomStatus;
  /** Quién creó la sala. Su asiento es el único que puede hablar como la sala. */
  readonly ownerId?: string | null;
  readonly now?: () => number;
}

/**
 * Una sala viva, en memoria, con el servidor de árbitro.
 *
 * El estado no se guarda en cada jugada: se guarda la jugada. El log es la
 * verdad y el estado es lo que sale de aplicarlo, así que una foto cada cuarenta
 * acciones basta para no tener que reconstruir desde el principio. El camino
 * crítico —recibir una acción y difundir el resultado— nunca espera al disco más
 * de lo que tarda un `INSERT` de una fila.
 *
 * Es genérico a propósito: no sabe si arbitra un planning poker o un RISK. Todo
 * lo que cambia entre un juego y otro está detrás de `GameModule`.
 */
export class RoomActor {
  private readonly roomId: string;
  private readonly module: GameModule<unknown, unknown>;
  private readonly repository: RoomRepository;
  private readonly now: () => number;
  private readonly ownerId: string | null;
  private readonly suscriptores = new Set<Suscriptor>();
  private duenyos = new Set<SeatId>();

  private state: unknown;
  private seq: number;
  private seats: Seat[] = [];
  private status: RoomStatus;

  constructor(options: RoomActorOptions) {
    this.roomId = options.roomId;
    this.module = options.module;
    this.repository = options.repository;
    this.ownerId = options.ownerId ?? null;
    this.now = options.now ?? Date.now;
    this.status = options.status ?? 'lobby';

    const { state, seq } = this.rebuild();
    this.state = state;
    this.seq = seq;
    this.refreshSeats();
  }

  get ultimaSecuencia(): number {
    return this.seq;
  }

  /**
   * Lo que se decidió al montar la sala. Se lee, no se guarda.
   *
   * Entre que la sala se abre y la partida empieza se puede cambiar el mapa o
   * las reglas, y una copia hecha al arrancar el actor repartiría el tablero
   * con lo que había antes.
   */
  private get config(): Readonly<Record<string, unknown>> {
    return this.repository.findRoom(this.roomId)?.config ?? {};
  }

  get estado(): unknown {
    return this.state;
  }

  /**
   * Reconstruye la partida desde la última foto más lo que vino después.
   *
   * Si no hay foto, se aplica el log entero. Que esto sea posible es lo que
   * permite tirar una sala de memoria cuando nadie la usa y recuperarla intacta
   * cuando alguien vuelve.
   */
  private rebuild(): { state: unknown; seq: number } {
    const seats = this.seatsFromDb();
    const snapshot = this.repository.findSnapshot(this.roomId);

    if (!snapshot && this.module.empiezaAlJugar && this.status === 'lobby') {
      return { state: null, seq: 0 };
    }

    let state = snapshot ? snapshot.state : this.module.createState(seats, this.config);
    let seq = snapshot?.upToSeq ?? 0;

    for (const event of this.repository.listEventsAfter(this.roomId, seq)) {
      state = this.module.apply(state, event.action, event.seatId, seats);
      seq = event.seq;
    }

    return { state, seq };
  }

  private seatsFromDb(): Seat[] {
    const filas = this.repository.listSeats(this.roomId);
    this.duenyos = new Set(
      filas.filter((seat) => this.ownerId !== null && seat.userId === this.ownerId).map((seat) => seat.seatId),
    );
    return filas.map((seat) => ({
      id: seat.seatId,
      displayName: seat.displayName,
      isBot: seat.isBot,
      connected: false,
      order: seat.order,
      meta: seat.meta,
    }));
  }

  /** Lo dicho en la sala, para mandarlo entero al que llega. */
  private chat(): ChatEntry[] {
    return this.repository.listChat(this.roomId, CHAT_MAXIMO).map((fila) => ({
      seq: fila.seq,
      authorId: fila.authorId,
      author: fila.author,
      kind: fila.kind,
      text: fila.text,
      at: fila.at,
      ...(fila.origin !== null && { origin: fila.origin }),
    }));
  }

  /**
   * Añade algo al chat y lo reparte.
   *
   * Ni el nombre ni el tipo los pone el cliente: los deduce el servidor del
   * asiento. Si el nombre viniera de fuera, cualquiera podría firmar con el de
   * otro; y si viniera el tipo, cualquiera podría publicar un aviso con la
   * pinta de los que da la sala, que es la voz que la gente se cree.
   *
   * Hablar como la sala solo puede el asiento de quien la creó, que es quien
   * mueve los bots y escribe la crónica.
   */
  decir(seatId: SeatId, texto: string, comoLaSala: boolean, origin?: string): RuleError | null {
    const asiento = this.seats.find((seat) => seat.id === seatId);
    if (!asiento) return { code: 'sin-asiento', message: 'No tienes asiento en esta sala.' };
    if (comoLaSala && !this.duenyos.has(seatId)) {
      return { code: 'no-eres-la-sala', message: 'Solo el anfitrión habla en nombre de la sala.' };
    }

    const kind: ChatKind = comoLaSala ? 'system' : asiento.isBot ? 'bot' : 'player';
    this.repository.appendChat(this.roomId, {
      seq: this.repository.lastChatSeq(this.roomId) + 1,
      authorId: comoLaSala ? 'system' : seatId,
      author: comoLaSala ? 'Sala' : asiento.displayName,
      kind,
      text: texto,
      origin: origin ?? null,
      at: this.now(),
    });
    this.repartirChat();
    return null;
  }

  repartirChat(): void {
    const mensaje: ServerMessage = { tipo: 'chat', entradas: this.chat() };
    for (const suscriptor of this.suscriptores) suscriptor.send(mensaje);
  }

  refreshSeats(): void {
    const conectados = new Set([...this.suscriptores].map((s) => s.seatId));
    this.seats = this.seatsFromDb().map((seat) => ({ ...seat, connected: conectados.has(seat.id) }));
  }

  /**
   * Cambia el estado de la sala y, si con eso empieza la partida, la reparte.
   *
   * El reparto se hace **aquí y una sola vez**, con los asientos que hay en ese
   * momento: es la alineación congelada. Quien llegue después se sienta en una
   * partida ya empezada, y quien se vaya deja sus ejércitos donde estaban.
   */
  setStatus(status: RoomStatus): void {
    this.status = status;
    this.repository.updateRoomStatus(this.roomId, status, this.now());

    if (this.state === null && status === 'playing') {
      this.refreshSeats();
      this.state = this.module.createState(this.seats, this.config);
      this.repository.saveSnapshot(this.roomId, { upToSeq: 0, state: this.state }, this.now());
    }

    this.broadcast();
  }

  subscribe(suscriptor: Suscriptor): void {
    this.suscriptores.add(suscriptor);
    this.refreshSeats();
    this.broadcast();
    // Quien llega a mitad de partida necesita lo que ya se ha hablado, o el
    // chat aparece vacío como si nadie hubiera dicho nada.
    suscriptor.send({ tipo: 'chat', entradas: this.chat() });
  }

  unsubscribe(suscriptor: Suscriptor): void {
    this.suscriptores.delete(suscriptor);
    this.refreshSeats();
    this.broadcast();
  }

  /** Si ese asiento lo mueve un programa y no una persona. */
  esBot(seatId: SeatId): boolean {
    return this.seats.some((seat) => seat.id === seatId && seat.isBot);
  }

  /** Si ese asiento tiene ahora mismo alguien al otro lado. */
  conectado(seatId: SeatId): boolean {
    return [...this.suscriptores].some((suscriptor) => suscriptor.seatId === seatId);
  }

  get vacia(): boolean {
    return this.suscriptores.size === 0;
  }

  /**
   * Recibe una jugada, la juzga y, si es legal, la aplica.
   *
   * El orden importa: primero la forma (¿es siquiera una acción de este juego?),
   * luego el asiento (¿existe quien dice ser?), y solo entonces las reglas. Un
   * mensaje deforme no debe llegar nunca a la lógica del juego.
   */
  submit(seatId: SeatId, accion: unknown): RuleError | null {
    if (!Value.Check(this.module.actionSchema, accion)) {
      return { code: 'accion-desconocida', message: 'Esa acción no existe en este juego.' };
    }
    if (!this.seats.some((seat) => seat.id === seatId)) {
      return { code: 'sin-asiento', message: 'No tienes asiento en esta sala.' };
    }
    if (this.state === null) {
      return { code: 'sin-empezar', message: 'La partida todavía no ha empezado.' };
    }

    const rechazo = this.juzgar(accion, seatId);
    if (rechazo) return rechazo;

    // `validate` acaba de decir que sí, así que esto no debería lanzar. Si lo
    // hace, es un fallo del módulo y no de quien juega: se rechaza la jugada y
    // la sala sigue en pie. Dejarlo salir tumbaría el proceso entero.
    let siguiente: unknown;
    try {
      siguiente = this.module.apply(this.state, accion, seatId, this.seats);
    } catch {
      return { code: 'jugada-imposible', message: 'No se ha podido aplicar esa jugada.' };
    }

    this.state = siguiente;
    this.seq += 1;

    const at = this.now();
    this.repository.appendEvent(this.roomId, { seq: this.seq, seatId, action: accion, at });
    this.repository.touchRoom(this.roomId, at);

    if (this.seq % SNAPSHOT_CADA === 0) {
      this.repository.saveSnapshot(this.roomId, { upToSeq: this.seq, state: this.state }, at);
    }

    this.broadcast();
    return null;
  }

  /**
   * Le pregunta al juego si la jugada vale.
   *
   * Un módulo puede decir que no de dos maneras: devolviendo el motivo, o
   * lanzando. El motor de RISK lanza `RuleError`, así que aquí se recogen las
   * dos y se traducen a lo mismo.
   */
  private juzgar(accion: unknown, seatId: SeatId): RuleError | null {
    try {
      return this.module.validate(this.state, accion, seatId, this.seats);
    } catch (error) {
      return {
        code: 'jugada-ilegal',
        message: error instanceof Error ? error.message : 'Jugada ilegal.',
      };
    }
  }

  /** Saca a alguien de la mesa y deja que el juego decida qué hacer con lo suyo. */
  removeSeat(seatId: SeatId): void {
    this.repository.deleteSeat(this.roomId, seatId);
    if (this.state !== null && this.module.onSeatLeave) {
      this.state = this.module.onSeatLeave(this.state, seatId);
    }
    this.refreshSeats();
    this.broadcast();
  }

  /**
   * Manda a cada asiento lo que le corresponde ver, y solo eso.
   *
   * Es un mensaje por suscriptor y no uno para todos, porque `view` puede
   * devolver cosas distintas a cada uno. Ahí es donde vive el secreto del voto.
   */
  broadcast(): void {
    for (const suscriptor of this.suscriptores) {
      suscriptor.send(this.messageFor(suscriptor.seatId));
    }
  }

  private toSeatInfo(seat: Seat): SeatInfo {
    return {
      id: seat.id,
      displayName: seat.displayName,
      isBot: seat.isBot,
      connected: seat.connected,
      isOwner: this.duenyos.has(seat.id),
      order: seat.order,
      ...(seat.meta !== undefined && { meta: seat.meta }),
    };
  }

  messageFor(seatId: SeatId): ServerMessage {
    return {
      tipo: 'estado',
      seq: this.seq,
      seats: this.seats.map((seat) => this.toSeatInfo(seat)),
      status: this.status,
      vista: this.state === null ? null : this.module.view(this.state, seatId, this.seats),
    };
  }

  /** Guarda la foto pendiente antes de descargar la sala de memoria. */
  flush(): void {
    if (this.state === null) return;
    this.repository.saveSnapshot(
      this.roomId,
      { upToSeq: this.seq, state: this.state },
      this.now(),
    );
  }
}
