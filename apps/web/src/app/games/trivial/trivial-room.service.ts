import { Injectable, signal } from '@angular/core';
import { RoomSocket } from '../../api/room-socket';
import { RoomsApiService } from '../../api/rooms-api.service';
import type { Signal } from '@angular/core';
import type { SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { NivelBot, TrivialView } from '@devweb/shared/games/trivial/tipos';

/** Cómo se llama cada rival de mesa. */
const NOMBRE_DEL_BOT: Readonly<Record<NivelBot, string>> = {
  pardillo: 'Pardillo',
  apanado: 'Apañado',
  sabelotodo: 'Sabelotodo',
};

export interface PaseDeSala {
  readonly roomId: string;
  readonly seatId: string;
  readonly seatToken: string;
}

/**
 * La sala del Trivial contra el backend propio.
 *
 * No sabe ni una respuesta, y ese es el punto: las preguntas llegan sin
 * solución y la solución llega cuando la ronda se cierra. Aquí no hay nada que
 * mirar con las herramientas de desarrollo abiertas.
 */
@Injectable({ providedIn: 'root' })
export class TrivialRoomService {
  private readonly estado = signal<TrivialView | null>(null);
  private readonly rechazo = signal<string | null>(null);

  readonly vista: Signal<TrivialView | null> = this.estado.asReadonly();
  readonly error: Signal<string | null> = this.rechazo.asReadonly();

  private seatId = '';
  private asientos: readonly SeatInfo[] = [];

  constructor(
    private readonly rooms: RoomsApiService,
    private readonly socket: RoomSocket,
  ) {
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
   * Crea la sala. Con `nivelBot`, el rival se sienta al crearla.
   *
   * No se manda semilla ni preguntas: las pone el servidor. Elegir la semilla
   * sería elegir el reparto, y con el reparto conocido las respuestas dejan de
   * estar escondidas.
   */
  async crear(
    nombreSala: string,
    nombreJugador: string,
    nivelBot: NivelBot | null,
  ): Promise<PaseDeSala> {
    const grant = await this.rooms.crear({
      game: 'trivial',
      name: nombreSala,
      displayName: nombreJugador,
      ...(nivelBot !== null && {
        config: { nivelBot },
        bots: [NOMBRE_DEL_BOT[nivelBot]],
      }),
    });

    this.conectar(grant.room.id, grant.seatId, grant.seatToken);
    return { roomId: grant.room.id, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  async unirse(roomId: string, nombreJugador: string): Promise<PaseDeSala> {
    const grant = await this.rooms.unirse(roomId, nombreJugador);
    this.conectar(roomId, grant.seatId, grant.seatToken);
    return { roomId, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  reconectar(pase: PaseDeSala): void {
    this.conectar(pase.roomId, pase.seatId, pase.seatToken);
  }

  empezar(): void {
    this.socket.enviar({ tipo: 'empezar' });
  }

  responder(valor: number): void {
    this.socket.enviar({ tipo: 'responder', valor });
  }

  siguiente(): void {
    this.socket.enviar({ tipo: 'siguiente' });
  }

  desconectar(): void {
    this.socket.cerrar();
    this.estado.set(null);
    this.rechazo.set(null);
    this.seatId = '';
    this.asientos = [];
  }

  /** El nombre de un asiento, para no enseñar identificadores a nadie. */
  nombreDe(seatId: string): string {
    return this.asientos.find((asiento) => asiento.id === seatId)?.displayName ?? 'Alguien';
  }

  private conectar(roomId: string, seatId: string, seatToken: string): void {
    this.seatId = seatId;
    this.socket.conectar(roomId, seatToken);
  }

  private recibir(mensaje: ServerMessage): void {
    if (mensaje.tipo === 'rechazada') {
      this.rechazo.set(mensaje.message);
      return;
    }
    if (mensaje.tipo !== 'estado') return;

    this.asientos = mensaje.seats;
    this.rechazo.set(null);
    this.estado.set(mensaje.vista as TrivialView);
  }
}
