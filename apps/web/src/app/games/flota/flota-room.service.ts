import { Injectable, NgZone, Optional, signal } from '@angular/core';
import { RoomSocket } from '../../api/room-socket';
import { RoomsApiService } from '../../api/rooms-api.service';

export type { PaseDeSala } from '../pase-guardado';
import type { Signal } from '@angular/core';
import type { SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { Barco, FlotaView, Nivel } from '@devweb/shared/games/flota/tipos';
import type { PaseDeSala } from '../pase-guardado';

/** Cómo se llama cada bot en la mesa. */
const NOMBRE_DEL_BOT: Readonly<Record<Nivel, string>> = {
  novato: 'Grumete',
  marino: 'Marino',
  almirante: 'Almirante',
};

/**
 * La sala de Hundir la flota contra el backend propio.
 *
 * No guarda ni una regla: manda jugadas y pinta lo que el servidor devuelve. Es
 * a propósito, y es lo que hace que este juego sea jugable en serio —los barcos
 * del rival no están aquí porque no llegan, y no hay ninguna copia del tablero
 * ajeno que alguien pueda leer desde la consola del navegador.
 */
@Injectable({ providedIn: 'root' })
export class FlotaRoomService {
  private readonly estado = signal<FlotaView | null>(null);
  private readonly rechazo = signal<string | null>(null);

  readonly vista: Signal<FlotaView | null> = this.estado.asReadonly();
  readonly error: Signal<string | null> = this.rechazo.asReadonly();

  private seatId = '';
  private asientos: readonly SeatInfo[] = [];

  private readonly socket: RoomSocket;

  /**
   * El socket es de la sala, no de la aplicación: si nadie da uno, se construye.
   *
   * Este juego se escribió cuando `RoomSocket` era inyectable y venía del
   * inyector raíz. Al juntarlo con el resto pedía un proveedor que ya no
   * existe, y TypeScript no comprueba proveedores: compilaba igual y sólo
   * reventaba al abrir la pantalla, en blanco y con un NG0201 en la consola.
   *
   * El parámetro sigue siendo opcional para que se le pueda dar uno de mentira
   * desde un test sin abrir un WebSocket de verdad.
   */
  constructor(
    private readonly rooms: RoomsApiService,
    zone: NgZone,
    @Optional() socket: RoomSocket | null = null,
  ) {
    this.socket = socket ?? new RoomSocket(zone);
    this.socket.messages$.subscribe((mensaje) => {
      this.recibir(mensaje);
    });
  }

  get miAsiento(): string {
    return this.seatId;
  }

  get mesa(): readonly SeatInfo[] {
    return this.asientos;
  }

  /**
   * Crea la sala. Con `nivelBot`, el rival se sienta en el momento de crearla.
   *
   * La semilla se sortea aquí y viaja en la configuración: es de donde salen
   * tanto la flota del bot como sus disparos, así que dos partidas seguidas
   * contra el mismo nivel no son la misma partida.
   */
  async crear(nombreSala: string, nombreJugador: string, nivelBot: Nivel | null): Promise<PaseDeSala> {
    const grant = await this.rooms.crear({
      game: 'flota',
      name: nombreSala,
      displayName: nombreJugador,
      config: { semilla: semillaNueva(), ...(nivelBot !== null && { nivelBot }) },
      ...(nivelBot !== null && { bots: [NOMBRE_DEL_BOT[nivelBot]] }),
    });

    this.conectar(grant.room.id, grant.seatId, grant.seatToken);
    return { roomId: grant.room.id, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  /** Se sienta en una sala existente. Quien llega por el enlace no necesita cuenta. */
  async unirse(roomId: string, nombreJugador: string): Promise<PaseDeSala> {
    const grant = await this.rooms.unirse(roomId, nombreJugador);
    this.conectar(roomId, grant.seatId, grant.seatToken);
    return { roomId, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  /** Vuelve a una sala con el pase que ya se tenía guardado. */
  reconectar(pase: PaseDeSala): void {
    this.conectar(pase.roomId, pase.seatId, pase.seatToken);
  }

  desplegar(barcos: readonly Barco[]): void {
    this.socket.enviar({ tipo: 'desplegar', barcos });
  }

  disparar(fila: number, columna: number): void {
    this.socket.enviar({ tipo: 'disparar', fila, columna });
  }

  rendirse(): void {
    this.socket.enviar({ tipo: 'rendirse' });
  }

  desconectar(): void {
    this.socket.cerrar();
    this.estado.set(null);
    this.rechazo.set(null);
    this.seatId = '';
    this.asientos = [];
  }

  private conectar(roomId: string, seatId: string, seatToken: string): void {
    this.seatId = seatId;
    this.socket.conectar(roomId, seatToken);
  }

  /**
   * Un estado nuevo borra el rechazo anterior.
   *
   * El servidor manda el estado después de cada jugada aceptada, así que dejar
   * el aviso puesto significaría enseñar «ahí ya has disparado» encima de un
   * disparo que sí ha entrado.
   */
  private recibir(mensaje: ServerMessage): void {
    if (mensaje.tipo === 'rechazada') {
      this.rechazo.set(mensaje.message);
      return;
    }
    if (mensaje.tipo !== 'estado') return;

    this.asientos = mensaje.seats;
    this.rechazo.set(null);
    this.estado.set(mensaje.vista as FlotaView);
  }
}

/**
 * Una semilla por partida.
 *
 * `Math.random` basta: no protege nada —el servidor es quien guarda el secreto—
 * y solo sirve para que dos partidas seguidas no sean calcadas.
 */
function semillaNueva(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
