import { Injectable, NgZone, Optional, computed, signal } from '@angular/core';
import { RoomSocket } from '../../api/room-socket';
import { RoomsApiService } from '../../api/rooms-api.service';
import { caraPorDefecto, repartirCaras } from '@devweb/shared/games/impostor/caras';
import type { Signal } from '@angular/core';
import type { EstadoConexion } from '../../api/room-socket';
import type { ChatEntry, RoomInfo, SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { ImpostorView, Modo } from '@devweb/shared/games/impostor/tipos';
import type { PaseDeSala } from '../pase-guardado';

/**
 * Los rivales de mesa, con su cara.
 *
 * Van con nombre y cara emparejados porque un bot que se llama Doge y enseña
 * otra cara despista a la mesa entera: en este juego se acusa señalando, y se
 * señala a la cara, no al nombre.
 */
const BOTS: readonly { readonly cara: string; readonly nombre: string }[] = [
  { cara: 'doge', nombre: 'Doge' },
  { cara: 'cheems', nombre: 'Cheems' },
  { cara: 'wojak', nombre: 'Wojak' },
  { cara: 'chad', nombre: 'Chad' },
  { cara: 'stonks', nombre: 'Stonks' },
  { cara: 'npc', nombre: 'NPC' },
  { cara: 'troll', nombre: 'Troll' },
  { cara: 'floppa', nombre: 'Floppa' },
];

export interface AjustesDeSala {
  readonly tema: string;
  readonly modo: Modo;
  readonly vueltas: 1 | 2;
  readonly impostores: 1 | 2;
  /** Segundos de debate antes de votar. Cero, sin reloj: corta el anfitrión. */
  readonly segundosDebate: number;
  /** Cuántos asientos ocupan bots. Se sientan al crear la sala o nunca. */
  readonly bots: number;
}

/**
 * La sala del Impostor contra el backend propio.
 *
 * No sabe la palabra si a este asiento no le toca saberla, y ese es el juego
 * entero: el impostor recibe un `tuPalabra` nulo porque el servidor no se lo
 * manda, no porque la pantalla se lo esconda. Con las herramientas de
 * desarrollo abiertas se ve exactamente lo mismo.
 */
@Injectable({ providedIn: 'root' })
export class ImpostorRoomService {
  private readonly estado = signal<ImpostorView | null>(null);
  private readonly rechazo = signal<string | null>(null);
  private readonly conversacion = signal<readonly ChatEntry[]>([]);
  private readonly asientos = signal<readonly SeatInfo[]>([]);
  private readonly conexion = signal<EstadoConexion>('cerrada');

  readonly vista: Signal<ImpostorView | null> = this.estado.asReadonly();
  readonly error: Signal<string | null> = this.rechazo.asReadonly();
  readonly chat: Signal<readonly ChatEntry[]> = this.conversacion.asReadonly();
  readonly mesa: Signal<readonly SeatInfo[]> = this.asientos.asReadonly();

  /**
   * Si la sala está escuchando ahora mismo.
   *
   * Una jugada mandada con el socket cerrado se pierde sin decir nada, y eso en
   * pantalla es un botón que no hace nada. Con esto se puede apagar el botón
   * mientras se conecta, que es la verdad.
   */
  readonly conectado = computed(() => this.conexion() === 'abierta');

  private seatId = '';

  private readonly socket: RoomSocket;

  constructor(
    private readonly rooms: RoomsApiService,
    zone: NgZone,
    @Optional() socket: RoomSocket | null = null,
  ) {
    this.socket = socket ?? new RoomSocket(zone);
    this.socket.messages$.subscribe((mensaje) => {
      this.recibir(mensaje);
    });
    this.socket.estado$.subscribe((estado) => {
      this.conexion.set(estado);
    });
  }

  get miAsiento(): string {
    return this.seatId;
  }

  async crear(
    nombreSala: string,
    nombreJugador: string,
    ajustes: AjustesDeSala,
    cara: string | null = null,
  ): Promise<PaseDeSala> {
    const grant = await this.rooms.crear({
      game: 'impostor',
      name: nombreSala,
      displayName: nombreJugador,
      ...(cara && { meta: { cara } }),
      config: {
        tema: ajustes.tema,
        modo: ajustes.modo,
        vueltas: ajustes.vueltas,
        impostores: ajustes.impostores,
        segundosDebate: ajustes.segundosDebate,
      },
      ...(ajustes.bots > 0 && { bots: BOTS.slice(0, ajustes.bots).map((bot) => bot.nombre) }),
    });

    await this.ponerCaraALosBots(grant.room);
    this.conectar(grant.room.id, grant.seatId, grant.seatToken);
    return { roomId: grant.room.id, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  /**
   * Le pone a cada bot la cara de su nombre.
   *
   * Va en una segunda llamada porque los bots se sientan al crear la sala y ahí
   * no hay dónde meterles nada suyo. Si falla, la mesa se abre igual: se
   * quedarían con una cara cualquiera, que es feo pero no impide jugar.
   */
  private async ponerCaraALosBots(sala: RoomInfo): Promise<void> {
    const caraDe = new Map(BOTS.map((bot) => [bot.nombre, bot.cara]));
    const cambios = sala.seats.flatMap((asiento) => {
      const cara = asiento.isBot ? caraDe.get(asiento.displayName) : undefined;
      return cara ? [this.rooms.cambiarAsiento(sala.id, asiento.id, { meta: { cara } })] : [];
    });

    try {
      await Promise.all(cambios);
    } catch {
      // Una cara mal repartida no puede impedir que se abra la mesa.
    }
  }

  async unirse(
    roomId: string,
    nombreJugador: string,
    cara: string | null = null,
  ): Promise<PaseDeSala> {
    const grant = await this.rooms.unirse(roomId, nombreJugador, cara ? { cara } : null);
    this.conectar(roomId, grant.seatId, grant.seatToken);
    return { roomId, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  reconectar(pase: PaseDeSala): void {
    this.conectar(pase.roomId, pase.seatId, pase.seatToken);
  }

  // --- Las jugadas ---------------------------------------------------------

  listo(): void {
    this.socket.enviar({ tipo: 'listo' });
  }

  pista(texto: string): void {
    const limpia = texto.trim().slice(0, 40);
    if (limpia) this.socket.enviar({ tipo: 'pista', texto: limpia });
  }

  votar(aQuien: string): void {
    this.socket.enviar({ tipo: 'votar', aQuien });
  }

  adivinar(opcion: number): void {
    this.socket.enviar({ tipo: 'adivinar', opcion });
  }

  /** Cortar el debate y pasar a votar. Solo el anfitrión. */
  alVoto(): void {
    this.socket.enviar({ tipo: 'alVoto' });
  }

  otraRonda(): void {
    this.socket.enviar({ tipo: 'otra' });
  }

  /** Hablar en el canal de todos. En este juego, media partida. */
  decir(texto: string): void {
    const limpio = texto.trim();
    if (limpio) this.socket.decir(limpio);
  }

  desconectar(): void {
    this.socket.cerrar();
    this.estado.set(null);
    this.rechazo.set(null);
    this.conversacion.set([]);
    this.asientos.set([]);
    this.seatId = '';
  }

  // --- La mesa -------------------------------------------------------------

  nombreDe(seatId: string): string {
    return this.asientos().find((asiento) => asiento.id === seatId)?.displayName ?? 'Alguien';
  }

  esBot(seatId: string): boolean {
    return this.asientos().find((asiento) => asiento.id === seatId)?.isBot ?? false;
  }

  /**
   * La cara de ese asiento: la que eligió, o una libre.
   *
   * Se reparte mirando la mesa entera y no asiento a asiento: dos jugadores con
   * la misma cara harían imposible lo único que se hace en este juego, que es
   * señalar a alguien y decir que ha sido él.
   */
  caraDe(seatId: string): string {
    const caras = repartirCaras(
      this.asientos().map((uno) => ({
        id: uno.id,
        cara: typeof uno.meta?.['cara'] === 'string' ? uno.meta['cara'] : undefined,
      })),
    );
    return caras[seatId] ?? caraPorDefecto(seatId).id;
  }

  private conectar(roomId: string, seatId: string, seatToken: string): void {
    this.seatId = seatId;
    this.socket.conectar(roomId, seatToken);
  }

  private recibir(mensaje: ServerMessage): void {
    if (mensaje.tipo === 'chat') {
      this.conversacion.set(mensaje.entradas);
      return;
    }
    // Un «no» del servidor se dice, no se traga: si no, mandas una jugada y en
    // pantalla no pasa nada, que es la peor forma de enterarse de un error.
    if (mensaje.tipo === 'rechazada') {
      this.rechazo.set(mensaje.message);
      return;
    }
    if (mensaje.tipo !== 'estado') return;

    this.asientos.set(mensaje.seats);
    this.rechazo.set(null);
    this.estado.set(mensaje.vista as ImpostorView);
  }
}
