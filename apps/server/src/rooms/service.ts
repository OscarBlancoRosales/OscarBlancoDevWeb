import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { generateToken, hashToken } from '../auth/tokens';
import { RoomActor } from './actor';
import { repartir } from '../games/trivial/banco';
import { inventar } from '../games/trivial/inventor';
import { PresentadorDeSala, nombresDe } from '../games/trivial/presentador';
import { RegidorDeSala } from '../games/trivial/regidor';
import { coro } from './coro';
import { VozDeLaSala } from '../games/impostor/voz';
import { DealerDeMesa } from '../games/poker/dealer';
import type { AiSettings } from '@devweb/shared/engine/ai/ai-client';
import type { Tema } from '@devweb/shared/games/trivial/tipos';
import { moduleFor } from './registry';
import type {
  GameId,
  RoomInfo,
  RoomStatus,
  SeatGrant,
  SeatInfo,
} from '@devweb/shared/contracts/rooms';
import type { Narrador } from './actor';
import type { RoomRepository, RoomRow } from './repository';

const DIA = 24 * 60 * 60 * 1000;

/** Una sala sin tocar durante 30 días se borra sola. */
export const CADUCIDAD_SALAS_MS = 30 * DIA;

/** Cuánto se conserva una sala en memoria después de que se vaya el último. */
export const MARGEN_DESCARGA_MS = 60 * 1000;

/**
 * Una sala y de quién es.
 *
 * `RoomInfo` no lleva dueño porque a los jugadores no les hace falta: saben si
 * el asiento es suyo por `isOwner`. El panel sí necesita ponerle cara y correo,
 * y eso solo se puede cruzar con el id de la cuenta.
 */
export interface SalaConDuenyo {
  readonly info: RoomInfo;
  readonly ownerId: string | null;
}

export interface RoomServiceOptions {
  readonly repository: RoomRepository;
  readonly maxSeats?: number;
  readonly now?: () => number;
  /** Con qué modelo habla el presentador del concurso. Sin esto, solo guion. */
  readonly ia?: AiSettings | null;
  /** Dónde se apuntan los problemas que no rompen nada pero hay que saber. */
  readonly avisar?: (mensaje: string) => void;
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

  private readonly ia: AiSettings | null;
  private readonly avisar: (mensaje: string) => void;

  constructor(options: RoomServiceOptions) {
    this.repository = options.repository;
    this.maxSeats = options.maxSeats ?? 16;
    this.now = options.now ?? Date.now;
    this.ia = options.ia ?? null;
    this.avisar =
      options.avisar ??
      ((mensaje) => {
        console.warn(mensaje);
      });
  }

  async crear(input: {
    game: GameId;
    name: string;
    displayName: string;
    ownerId: string;
    /** Lo que el juego necesite del asiento de quien abre la mesa. */
    meta?: Record<string, unknown>;
    config?: Record<string, unknown>;
    bots?: readonly string[];
  }): Promise<SeatGrant> {
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
      config: await conLoQueElJuegoNecesite(input.game, input.config ?? {}, this.ia, (motivo) => {
        this.avisar(`El inventor de preguntas: ${motivo}`);
      }),
      createdAt: at,
      updatedAt: at,
    };
    this.repository.insertRoom(room);

    const grant = this.sentar(room, input.displayName, input.ownerId, {
      ...(input.meta && { meta: input.meta }),
    });
    for (const nombre of bots) this.sentar(room, nombre, null, { isBot: true });

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
  unirse(
    roomId: string,
    displayName: string,
    userId: string | null,
    meta?: Readonly<Record<string, unknown>>,
  ): SeatGrant {
    const room = this.buscar(roomId);

    if (this.repository.listSeats(roomId).length >= this.maxSeats) {
      throw new AppError('sala-llena', 'La sala está completa.');
    }
    if (room.status === 'finished') {
      throw new AppError('sin-permiso', 'Esta partida ya ha terminado.');
    }

    return this.sentar(room, displayName, userId, { ...(meta && { meta }) });
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

  /**
   * Se lleva por delante todas las salas de alguien.
   *
   * Se usa al borrar una cuenta. La clave foránea de `rooms` deja el dueño en
   * nulo en vez de borrar, y eso dejaría salas que nadie puede administrar ni
   * cerrar; borrarlas aquí, además, descarga de memoria las que estén vivas.
   */
  borrarLasDe(ownerId: string): number {
    const salas = this.repository.listRoomsByOwner(ownerId);
    for (const sala of salas) {
      this.olvidar(sala.id);
      this.repository.deleteRoom(sala.id);
    }
    return salas.length;
  }

  // ===== EL PANEL: lo de abajo no pregunta de quién es la sala =====

  /**
   * Todas las salas que hay, para quien manda.
   *
   * El resto del servicio solo sabe listar las de un dueño, que es lo correcto
   * para jugar: nadie tiene por qué ver las mesas de los demás. El panel es la
   * excepción, y por eso el corte está aquí y no en el repositorio.
   */
  listarTodas(): readonly SalaConDuenyo[] {
    return this.repository
      .listAllRooms()
      .map((room) => ({ info: this.toInfo(room), ownerId: room.ownerId }));
  }

  /**
   * Cierra y borra una sala sin preguntar de quién es.
   *
   * `borrar` exige ser el dueño, que es lo que protege a unos jugadores de
   * otros. Esto se salta esa comprobación a propósito y por eso vive detrás de
   * `requireAdmin`: quien manda tiene que poder cerrar una mesa abandonada
   * aunque la abriera otro.
   */
  borrarComoAdmin(roomId: string): void {
    const sala = this.repository.findRoom(roomId);
    if (!sala) throw new AppError('no-encontrado', 'Esa sala no existe.');

    this.echarATodos(roomId, 'sala-cerrada');
    this.actores.get(roomId)?.flush();
    this.olvidar(roomId);
    this.repository.deleteRoom(roomId);
  }

  /** Levanta a alguien de su asiento sin preguntar de quién es la sala. */
  echarComoAdmin(roomId: string, seatId: string): RoomInfo {
    const sala = this.repository.findRoom(roomId);
    if (!sala) throw new AppError('no-encontrado', 'Esa sala no existe.');
    if (!this.repository.findSeat(roomId, seatId)) {
      throw new AppError('no-encontrado', 'Ese asiento no existe.');
    }

    const actor = this.actores.get(roomId);
    if (actor) actor.removeSeat(seatId, 'expulsado');
    else this.repository.deleteSeat(roomId, seatId);

    this.repository.touchRoom(roomId, this.now());
    return this.info(roomId);
  }

  /**
   * Borra en bloque lo que encaje con el filtro. Devuelve cuántas cayeron.
   *
   * Un filtro vacío son todas, y eso es una decisión de quien llama: aquí no se
   * inventa una red de seguridad que el panel ya pone pidiendo confirmación.
   */
  borrarVarias(filtro: {
    juego?: GameId;
    estado?: RoomStatus;
    inactivasDias?: number;
  }): number {
    const limite =
      filtro.inactivasDias === undefined ? null : this.now() - filtro.inactivasDias * DIA;

    const condenadas = this.repository.listAllRooms().filter((sala) => {
      if (filtro.juego !== undefined && sala.game !== filtro.juego) return false;
      if (filtro.estado !== undefined && sala.status !== filtro.estado) return false;
      if (limite !== null && sala.updatedAt >= limite) return false;
      return true;
    });

    for (const sala of condenadas) this.borrarComoAdmin(sala.id);
    return condenadas.length;
  }

  /** Suelta a todo el mundo antes de que la sala deje de existir. */
  private echarATodos(roomId: string, motivo: string): void {
    const actor = this.actores.get(roomId);
    if (!actor) return;
    for (const seat of this.repository.listSeats(roomId)) {
      actor.expulsar(seat.seatId, motivo);
    }
  }

  /** Devuelve el asiento al que corresponde un pase, o `null` si no vale. */
  asientoDe(roomId: string, seatToken: string): string | null {
    return this.repository.findSeatByToken(roomId, hashToken(seatToken))?.seatId ?? null;
  }

  /**
   * Añade un asiento de bot. Solo quien creó la sala.
   *
   * Devuelve el pase igual que un asiento humano, aunque nadie lo vaya a usar
   * para conectarse: es lo que permite que la sala trate a todos los asientos
   * de la misma forma.
   */
  anadirAsiento(
    roomId: string,
    userId: string,
    input: { displayName: string; isBot: boolean; meta?: Readonly<Record<string, unknown>> },
  ): SeatGrant {
    const room = this.exigirDuenyo(roomId, userId);
    if (this.repository.listSeats(roomId).length >= this.maxSeats) {
      throw new AppError('sala-llena', 'La sala está completa.');
    }
    return this.sentar(room, input.displayName, null, {
      isBot: input.isBot,
      ...(input.meta !== undefined && { meta: input.meta }),
    });
  }

  /**
   * Cambia el nombre o los datos de juego de un asiento.
   *
   * Puede hacerlo quien ocupa ese asiento —para renombrarse o cambiar de
   * color— y quien creó la sala, que es quien coloca a los bots.
   */
  cambiarAsiento(
    roomId: string,
    seatId: string,
    quien: { userId: string | null; seatToken: string | null },
    cambios: { displayName?: string; meta?: Readonly<Record<string, unknown>> },
  ): RoomInfo {
    const room = this.buscar(roomId);
    if (!this.repository.findSeat(roomId, seatId)) {
      throw new AppError('no-encontrado', 'Ese asiento no existe.');
    }
    if (!this.puedeTocarElAsiento(room, seatId, quien)) {
      throw new AppError('sin-permiso', 'Ese asiento no es tuyo.');
    }

    this.repository.updateSeat(roomId, seatId, cambios);
    this.repository.touchRoom(roomId, this.now());
    this.refrescar(roomId);
    return this.info(roomId);
  }

  quitarAsiento(
    roomId: string,
    seatId: string,
    quien: { userId: string | null; seatToken: string | null },
  ): RoomInfo {
    const room = this.buscar(roomId);
    if (!this.puedeTocarElAsiento(room, seatId, quien)) {
      throw new AppError('sin-permiso', 'Ese asiento no es tuyo.');
    }

    const actor = this.actores.get(roomId);
    if (actor) {
      actor.removeSeat(seatId);
    } else {
      this.repository.deleteSeat(roomId, seatId);
    }
    this.repository.touchRoom(roomId, this.now());
    return this.info(roomId);
  }

  /** Cambia lo que se puede cambiar de una sala. Solo quien la creó. */
  cambiarSala(
    roomId: string,
    userId: string,
    cambios: { name?: string; status?: RoomStatus; config?: Readonly<Record<string, unknown>> },
  ): RoomInfo {
    this.exigirDuenyo(roomId, userId);
    const at = this.now();

    const { status, ...resto } = cambios;
    if (Object.keys(resto).length > 0) this.repository.updateRoom(roomId, resto, at);
    if (status !== undefined) {
      const actor = this.actores.get(roomId);
      if (actor) actor.setStatus(status);
      else this.repository.updateRoomStatus(roomId, status, at);
    }

    this.refrescar(roomId);
    return this.info(roomId);
  }

  /** Que la sala viva, si la hay en memoria, se entere de que cambiaron los asientos. */
  private refrescar(roomId: string): void {
    const actor = this.actores.get(roomId);
    if (!actor) return;
    actor.refreshSeats();
    actor.broadcast();
  }

  private exigirDuenyo(roomId: string, userId: string): RoomRow {
    const room = this.buscar(roomId);
    if (room.ownerId !== userId) {
      throw new AppError('sin-permiso', 'Solo quien creó la sala puede hacer eso.');
    }
    return room;
  }

  /**
   * Quién puede tocar un asiento: su ocupante o quien creó la sala.
   *
   * El pase se comprueba contra el asiento concreto, no contra la sala: tener
   * un asiento no da derecho sobre los demás.
   */
  private puedeTocarElAsiento(
    room: RoomRow,
    seatId: string,
    quien: { userId: string | null; seatToken: string | null },
  ): boolean {
    if (quien.userId !== null && room.ownerId === quien.userId) return true;
    if (quien.seatToken === null) return false;
    return this.repository.findSeatByToken(room.id, hashToken(quien.seatToken))?.seatId === seatId;
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
      status: room.status,
      ownerId: room.ownerId,
      now: this.now,
      narrador: this.narradorPara(room.game, roomId),
    });
    this.actores.set(roomId, actor);
    return actor;
  }

  /**
   * El presentador, para las salas que lo tienen.
   *
   * Los nombres se leen de la base en cada frase y no se copian al crear el
   * actor: en una sala se entra y se sale, y un presentador que llame a la
   * gente por el nombre de quien había al abrir la mesa da más pena que gracia.
   */
  private narradorPara(game: GameId, roomId: string): Narrador | null {
    // El Impostor no tiene presentador: tiene una sala que habla, y que además
    // es quien reparte la palabra. Ver `VozDeLaSala`.
    if (game === 'impostor') {
      return new VozDeLaSala(() => nombresDe(this.repository.listSeats(roomId)));
    }
    if (game === 'scrum') {
      // Solo la mesa de poker tiene crupier. La versión clásica se queda como
      // estaba: quien la abre no quiere a nadie metiéndole prisa.
      if (this.repository.findRoom(roomId)?.config['version'] !== 'mesa') return null;
      return new DealerDeMesa(
        this.ia,
        {
          nombres: () => nombresDe(this.repository.listSeats(roomId)),
          humanos: () =>
            this.repository
              .listSeats(roomId)
              .filter((asiento) => !asiento.isBot)
              .map((asiento) => asiento.seatId),
        },
        undefined,
        (motivo) => {
          this.avisar(`El crupier no pudo hablar con el modelo: ${motivo}`);
        },
      );
    }
    if (game !== 'trivial') return null;
    // Dos trabajos distintos por el mismo hueco: el regidor lleva el reloj y el
    // presentador habla. El regidor va SIEMPRE, tenga o no clave de IA: una
    // sala sin modelo sigue necesitando cronómetro.
    return coro(
      new RegidorDeSala(),
      new PresentadorDeSala(
        this.ia,
        () => nombresDe(this.repository.listSeats(roomId)),
        undefined,
        () =>
          new Set(
            this.repository
              .listSeats(roomId)
              .filter((asiento) => asiento.isBot)
              .map((asiento) => asiento.seatId),
          ),
        (motivo) => {
          this.avisar(`El presentador no pudo hablar con el modelo: ${motivo}`);
        },
      ),
    );
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
    extra: { isBot?: boolean; meta?: Readonly<Record<string, unknown>> } = {},
  ): SeatGrant {
    const seatId = randomUUID();
    const seatToken = generateToken();

    this.repository.insertSeat({
      roomId: room.id,
      seatId,
      userId,
      displayName: displayName.trim(),
      isBot: extra.isBot ?? false,
      tokenHash: hashToken(seatToken),
      order: this.repository.listSeats(room.id).length,
      meta: extra.meta ?? {},
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
      config: sinLaChuleta(room.config),
      seats: this.repository.listSeats(room.id).map(
        (seat): SeatInfo => ({
          id: seat.seatId,
          displayName: seat.displayName,
          isBot: seat.isBot,
          connected: conectados?.conectado(seat.seatId) ?? false,
          isOwner: room.ownerId !== null && seat.userId === room.ownerId,
          order: seat.order,
          meta: seat.meta,
        }),
      ),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}

/**
 * La configuración de la sala, menos lo que no puede salir de aquí.
 *
 * Las preguntas del concurso se guardan en la sala para que la partida se
 * reconstruya desde su log, pero llevan la respuesta marcada dentro. Devolver
 * la configuración entera por HTTP era repartir el examen resuelto a cualquiera
 * con sesión, que es exactamente lo que este juego existe para impedir.
 *
 * Se quita aquí, en el único sitio por el que una sala sale hacia fuera, y no
 * en cada ruta: una ruta nueva que se olvide de quitarlo volvería a abrirlo.
 */
function sinLaChuleta(config: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { preguntas: _preguntas, ...resto } = config;
  return resto;
}

/**
 * Añade a la configuración lo que el juego necesita y el cliente no puede poner.
 *
 * Hoy son las preguntas del Trivial, y por eso este es el único sitio del
 * servicio que sabe de un juego concreto. La alternativa —que el módulo se
 * trajera el banco— metería las respuestas en el bundle de la web, que es
 * exactamente lo que este juego no puede permitirse.
 *
 * Se sobreescriben **las preguntas y la semilla**, y lo segundo importa tanto
 * como lo primero: si la semilla la eligiera quien crea la sala, el reparto
 * sería reproducible a voluntad —una partida para apuntar las respuestas, otra
 * con la misma semilla para ganarla— y esconder el banco no habría servido de
 * nada. Por eso sale de `randomInt`, y no del reloj: dos salas creadas en el
 * mismo milisegundo traerían la misma tanda.
 */
async function conLoQueElJuegoNecesite(
  game: GameId,
  config: Record<string, unknown>,
  ia: AiSettings | null,
  avisar: (motivo: string) => void,
): Promise<Record<string, unknown>> {
  if (game !== 'trivial') return config;

  const semilla = randomInt(0, 2 ** 31);
  // De qué va el programa. Se elige al abrir y queda fijado: mezclar dev con
  // cultura general en la misma tanda no es variedad, es incoherencia.
  const tema: Tema = config['tema'] === 'general' ? 'general' : 'dev';
  // El modo IA entra por aquí y por ningún otro sitio: lo que cambia es de
  // dónde salen las preguntas, no dónde viven. Siguen congeladas en la sala al
  // crearla, que es lo que mantiene la partida reconstruible desde su log e
  // impide pedir otra tanda a mitad de programa porque esta no gustó.
  const conIa = config['origen'] === 'ia' && ia !== null;
  const preguntas = conIa
    ? await inventar({ ajustes: ia, semilla, tema, avisar })
    : repartir(semilla, tema);

  // El origen se normaliza aquí: si alguien pide IA sin que el servidor tenga
  // clave, la sala sale del banco **y lo dice**, en vez de prometer lo que no
  // puede dar.
  return { ...config, semilla, tema, origen: conIa ? 'ia' : 'banco', preguntas };
}
