import { Value } from '@sinclair/typebox/value';
import { moverBots } from './bots';
import type { GameModule, RuleError, Seat, SeatId } from '@devweb/shared/games/module';
import type { RoomStatus, SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { RoomRepository } from './repository';

/** Cada cuántas acciones se guarda una foto del estado. */
export const SNAPSHOT_CADA = 40;

export interface Suscriptor {
  readonly seatId: SeatId;
  send(message: ServerMessage): void;
}

export interface RoomActorOptions {
  readonly roomId: string;
  readonly module: GameModule<unknown, unknown>;
  readonly repository: RoomRepository;
  readonly config: Readonly<Record<string, unknown>>;
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
  private readonly config: Readonly<Record<string, unknown>>;
  private readonly suscriptores = new Set<Suscriptor>();

  private state: unknown;
  private seq: number;
  private seats: Seat[] = [];
  private status: RoomStatus = 'lobby';

  /**
   * Si ahora mismo se están moviendo los bots.
   *
   * El conductor juega llamando a `submit`, y `submit` llama al conductor: sin
   * esta bandera, el primer disparo de un bot abriría una ronda de bots dentro
   * de otra hasta reventar la pila.
   */
  private moviendoBots = false;

  constructor(options: RoomActorOptions) {
    this.roomId = options.roomId;
    this.module = options.module;
    this.repository = options.repository;
    this.config = options.config;
    this.now = options.now ?? Date.now;

    const { state, seq } = this.rebuild();
    this.state = state;
    this.seq = seq;
    this.refreshSeats();
  }

  get ultimaSecuencia(): number {
    return this.seq;
  }

  get estado(): unknown {
    return this.state;
  }

  get asientos(): readonly Seat[] {
    return this.seats;
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

    let state = snapshot ? snapshot.state : this.module.createState(seats, this.config);
    let seq = snapshot?.upToSeq ?? 0;

    for (const event of this.repository.listEventsAfter(this.roomId, seq)) {
      state = this.module.apply(state, event.action, event.seatId, seats);
      seq = event.seq;
    }

    return { state, seq };
  }

  private seatsFromDb(): Seat[] {
    return this.repository.listSeats(this.roomId).map((seat) => ({
      id: seat.seatId,
      displayName: seat.displayName,
      isBot: seat.isBot,
      connected: false,
    }));
  }

  refreshSeats(): void {
    const conectados = new Set([...this.suscriptores].map((s) => s.seatId));
    this.seats = this.seatsFromDb().map((seat) => ({ ...seat, connected: conectados.has(seat.id) }));
  }

  setStatus(status: RoomStatus): void {
    this.status = status;
    this.repository.updateRoomStatus(this.roomId, status, this.now());
    this.broadcast();
  }

  /**
   * Alguien entra en la sala.
   *
   * Al entrar también se deja jugar a los bots, y no es un detalle: si el
   * proceso se reinicia con el turno en un bot, nadie volvería a moverlo —la
   * persona no puede jugar porque no es su turno— y la partida se quedaría
   * congelada esperando a quien no tiene a nadie detrás.
   */
  subscribe(suscriptor: Suscriptor): void {
    this.suscriptores.add(suscriptor);
    this.refreshSeats();
    this.broadcast();
    this.dejarJugarALosBots();
  }

  unsubscribe(suscriptor: Suscriptor): void {
    this.suscriptores.delete(suscriptor);
    this.refreshSeats();
    this.broadcast();
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
    this.dejarJugarALosBots();
    return null;
  }

  /**
   * Deja que jueguen los asientos que no tienen a nadie detrás.
   *
   * Va después de difundir el estado a propósito: quien está mirando ve primero
   * su propia jugada y luego la respuesta, en vez de las dos de golpe cuando el
   * bot termina su racha.
   */
  private dejarJugarALosBots(): void {
    if (this.moviendoBots) return;
    this.moviendoBots = true;
    try {
      moverBots(this, this.module);
    } finally {
      this.moviendoBots = false;
    }
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
    if (this.module.onSeatLeave) {
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

  messageFor(seatId: SeatId): ServerMessage {
    return {
      tipo: 'estado',
      seq: this.seq,
      seats: this.seats.map(toSeatInfo),
      status: this.status,
      vista: this.module.view(this.state, seatId, this.seats),
    };
  }

  /** Guarda la foto pendiente antes de descargar la sala de memoria. */
  flush(): void {
    this.repository.saveSnapshot(
      this.roomId,
      { upToSeq: this.seq, state: this.state },
      this.now(),
    );
  }
}

function toSeatInfo(seat: Seat): SeatInfo {
  return {
    id: seat.id,
    displayName: seat.displayName,
    isBot: seat.isBot,
    connected: seat.connected,
  };
}
