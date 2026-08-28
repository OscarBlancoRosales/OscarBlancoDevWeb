import { randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { generateToken, hashToken } from '../auth/tokens';
import { RoomActor } from './actor';
import { moduleFor } from './registry';
import type { RoomInfo, SeatGrant, GameId } from '@devweb/shared/contracts/rooms';
import type { RoomRepository, RoomRow } from './repository';

const DIA = 24 * 60 * 60 * 1000;

/** Una sala sin tocar durante 30 días se borra sola. */
export const CADUCIDAD_SALAS_MS = 30 * DIA;

/** Cuánto se conserva una sala en memoria después de que se vaya el último. */
export const MARGEN_DESCARGA_MS = 60 * 1000;

export interface RoomServiceOptions {
  readonly repository: RoomRepository;
  readonly maxSeats?: number;
  readonly now?: () => number;
}

/**
 * Las salas vivas y lo que se puede hacer con ellas.
 *
 * Guarda en memoria un `RoomActor` por sala en uso y lo descarga cuando se va el
 * último. Reconstruirla es volver a aplicar su log sobre la última foto, así que
 * descargarla no pierde nada: solo libera memoria.
 */
export class RoomService {
  private readonly repository: RoomRepository;
  private readonly maxSeats: number;
  private readonly now: () => number;
  private readonly actores = new Map<string, RoomActor>();
  private readonly descargas = new Map<string, ReturnType<typeof setTimeout>>();

  /** Salas cuya última foto no se pudo guardar al apagar. Solo para diagnóstico. */
  readonly fallosAlCerrar: string[] = [];

  constructor(options: RoomServiceOptions) {
    this.repository = options.repository;
    this.maxSeats = options.maxSeats ?? 16;
    this.now = options.now ?? Date.now;
  }

  crear(input: {
    game: GameId;
    name: string;
    displayName: string;
    ownerId: string;
    config?: Record<string, unknown>;
    bots?: readonly string[];
  }): SeatGrant {
    if (!moduleFor(input.game)) {
      throw new AppError('no-encontrado', 'Ese juego no existe.');
    }

    const bots = input.bots ?? [];
    // Se comprueba antes de insertar nada: una sala a medio sentar sería una
    // sala que hay que limpiar a mano.
    if (bots.length + 1 > this.maxSeats) {
      throw new AppError('sala-llena', 'No caben tantos jugadores en una sala.');
    }

    const at = this.now();
    const room: RoomRow = {
      id: randomUUID(),
      game: input.game,
      ownerId: input.ownerId,
      name: input.name.trim(),
      status: 'lobby',
      config: input.config ?? {},
      createdAt: at,
      updatedAt: at,
    };
    this.repository.insertRoom(room);

    const grant = this.sentar(room, input.displayName, input.ownerId);
    for (const nombre of bots) this.sentar(room, nombre, null, true);

    // El pase que sale de aquí es el de la persona: los asientos de los bots se
    // devuelven en la sala, pero su pase no sale del proceso porque nadie se va
    // a conectar con él.
    return { ...grant, room: this.toInfo(this.buscar(room.id)) };
  }

  /**
   * Sienta a alguien en una sala existente.
   *
   * Quien llega por un enlace de invitación no necesita cuenta: se le da un
   * asiento y un pase para ese asiento, y con eso juega. El pase no vale para
   * ninguna otra sala.
   */
  unirse(roomId: string, displayName: string, userId: string | null): SeatGrant {
    const room = this.buscar(roomId);

    if (this.repository.listSeats(roomId).length >= this.maxSeats) {
      throw new AppError('sala-llena', 'La sala está completa.');
    }
    if (room.status === 'finished') {
      throw new AppError('sin-permiso', 'Esta partida ya ha terminado.');
    }

    return this.sentar(room, displayName, userId);
  }

  info(roomId: string): RoomInfo {
    return this.toInfo(this.buscar(roomId));
  }

  listarDe(ownerId: string): readonly RoomInfo[] {
    return this.repository.listRoomsByOwner(ownerId).map((room) => this.toInfo(room));
  }

  borrar(roomId: string, userId: string): void {
    const room = this.buscar(roomId);
    if (room.ownerId !== userId) {
      throw new AppError('sin-permiso', 'Solo quien creó la sala puede borrarla.');
    }
    this.actores.get(roomId)?.flush();
    this.olvidar(roomId);
    this.repository.deleteRoom(roomId);
  }

  /** Devuelve el asiento al que corresponde un pase, o `null` si no vale. */
  asientoDe(roomId: string, seatToken: string): string | null {
    return this.repository.findSeatByToken(roomId, hashToken(seatToken))?.seatId ?? null;
  }

  /**
   * El actor de una sala, creándolo si hacía falta.
   *
   * Reconstruir una sala cuesta lo que cuesta reaplicar su log desde la última
   * foto, así que se cancela cualquier descarga pendiente antes de decidir que
   * hay que reconstruirla.
   */
  actor(roomId: string): RoomActor {
    const pendiente = this.descargas.get(roomId);
    if (pendiente) {
      clearTimeout(pendiente);
      this.descargas.delete(roomId);
    }

    const existente = this.actores.get(roomId);
    if (existente) return existente;

    const room = this.buscar(roomId);
    const module = moduleFor(room.game);
    if (!module) throw new AppError('no-encontrado', 'Ese juego ya no está disponible.');

    const actor = new RoomActor({
      roomId,
      module,
      repository: this.repository,
      config: room.config,
      now: this.now,
    });
    this.actores.set(roomId, actor);
    return actor;
  }

  /**
   * Programa la descarga de una sala que se ha quedado sin nadie.
   *
   * El margen existe porque recargar la página es irse y volver en dos segundos:
   * descargar al instante haría reconstruir la partida en cada F5.
   */
  programarDescarga(roomId: string, margenMs = MARGEN_DESCARGA_MS): void {
    const actor = this.actores.get(roomId);
    if (!actor?.vacia || this.descargas.has(roomId)) return;

    const timer = setTimeout(() => {
      this.descargas.delete(roomId);
      const vigente = this.actores.get(roomId);
      if (vigente?.vacia) {
        vigente.flush();
        this.actores.delete(roomId);
      }
    }, margenMs);

    timer.unref();
    this.descargas.set(roomId, timer);
  }

  /** Borra las salas que nadie ha tocado en un mes. */
  limpiarViejas(): number {
    return this.repository.deleteRoomsOlderThan(this.now() - CADUCIDAD_SALAS_MS);
  }

  /** Suelta los temporizadores para que el proceso pueda terminar. */
  cerrar(): void {
    for (const timer of this.descargas.values()) clearTimeout(timer);
    this.descargas.clear();

    // Se intenta guardar la foto de cada sala, pero apagarse no puede fallar por
    // no conseguirlo: el log ya está en disco y la partida se reconstruye igual.
    for (const [roomId, actor] of this.actores) {
      try {
        actor.flush();
      } catch {
        this.fallosAlCerrar.push(roomId);
      }
    }
    this.actores.clear();
  }

  private olvidar(roomId: string): void {
    const pendiente = this.descargas.get(roomId);
    if (pendiente) clearTimeout(pendiente);
    this.descargas.delete(roomId);
    this.actores.delete(roomId);
  }

  private sentar(
    room: RoomRow,
    displayName: string,
    userId: string | null,
    isBot = false,
  ): SeatGrant {
    const seatId = randomUUID();
    const seatToken = generateToken();

    this.repository.insertSeat({
      roomId: room.id,
      seatId,
      userId,
      displayName: displayName.trim(),
      isBot,
      tokenHash: hashToken(seatToken),
      order: this.repository.listSeats(room.id).length,
    });

    this.actores.get(room.id)?.refreshSeats();
    this.actores.get(room.id)?.broadcast();

    return { room: this.toInfo(this.buscar(room.id)), seatId, seatToken };
  }

  private buscar(roomId: string): RoomRow {
    const room = this.repository.findRoom(roomId);
    if (!room) throw new AppError('no-encontrado', 'Esa sala no existe.');
    return room;
  }

  private toInfo(room: RoomRow): RoomInfo {
    const conectados = this.actores.get(room.id);
    return {
      id: room.id,
      game: room.game,
      name: room.name,
      status: room.status,
      seats: this.repository.listSeats(room.id).map((seat) => ({
        id: seat.seatId,
        displayName: seat.displayName,
        isBot: seat.isBot,
        connected: conectados?.conectado(seat.seatId) ?? false,
      })),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}
