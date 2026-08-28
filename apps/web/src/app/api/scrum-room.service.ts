import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RoomSocket } from './room-socket';
import { RoomsApiService } from './rooms-api.service';
import type { Observable } from 'rxjs';
import type { SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { ScrumView, ScrumVote } from '@devweb/shared/games/scrum';

/**
 * Un jugador tal y como lo espera la pantalla de Scrum Poker.
 *
 * La forma es la que tenía con Firebase a propósito: la pantalla lleva cuatrocientas
 * líneas de estadística —desviaciones, agrupaciones, consenso— que funcionan y
 * están probadas. Cambiar de dónde vienen los datos no es motivo para reescribirlas.
 */
export interface Player {
  id: string;
  name: string;
  currentVote: number;
  hasVoted: boolean;
  isCurrentPlayer?: boolean;
  voteBreakdown: { numbers: number; coffee: number; joint: number };
}

export interface RoomData {
  players: Record<string, Player>;
  showVotes: boolean;
}

const SIN_VOTO = { numbers: 0, coffee: 0, joint: 0 } as const;

/**
 * La sala de Scrum Poker contra el backend propio.
 *
 * Traduce en las dos direcciones: los votos de la pantalla se convierten en
 * acciones del juego, y la vista que manda el servidor se convierte en la forma
 * que la pantalla ya sabe pintar.
 *
 * Lo que cambia de verdad respecto a Firebase no se ve aquí: **mientras la ronda
 * no esté revelada, los votos de los demás no llegan**. Antes llegaban todos y
 * el cliente los ocultaba, así que bastaba abrir la consola para verlos.
 */
@Injectable({ providedIn: 'root' })
export class ScrumRoomService {
  private readonly datos = new BehaviorSubject<RoomData | null>(null);
  readonly roomData$: Observable<RoomData | null> = this.datos.asObservable();

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

  /** Crea la sala. Exige sesión: sin dueño no hay quien la borre. */
  async crear(
    nombreSala: string,
    nombreJugador: string,
  ): Promise<{ roomId: string; seatId: string; seatToken: string }> {
    const grant = await this.rooms.crear({
      game: 'scrum',
      name: nombreSala,
      displayName: nombreJugador,
    });
    this.conectar(grant.room.id, grant.seatId, grant.seatToken);
    return { roomId: grant.room.id, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  /** Se sienta en una sala existente. No hace falta cuenta. */
  async unirse(
    roomId: string,
    nombreJugador: string,
  ): Promise<{ seatId: string; seatToken: string }> {
    const grant = await this.rooms.unirse(roomId, nombreJugador);
    this.conectar(roomId, grant.seatId, grant.seatToken);
    return { seatId: grant.seatId, seatToken: grant.seatToken };
  }

  /** Vuelve a una sala con el pase que ya se tenía guardado. */
  reconectar(roomId: string, seatId: string, seatToken: string): void {
    this.conectar(roomId, seatId, seatToken);
  }

  votar(numeros: number, cafe: number, porro: number): void {
    if (cafe > 0) {
      this.socket.enviar({ tipo: 'votar', voto: { tipo: 'cafe' } });
      return;
    }
    if (porro > 0) {
      this.socket.enviar({ tipo: 'votar', voto: { tipo: 'porro' } });
      return;
    }
    this.socket.enviar({ tipo: 'votar', voto: { tipo: 'numero', valor: numeros } });
  }

  retirarVoto(): void {
    this.socket.enviar({ tipo: 'retirar-voto' });
  }

  revelar(): void {
    this.socket.enviar({ tipo: 'revelar' });
  }

  nuevaRonda(): void {
    this.socket.enviar({ tipo: 'nueva-ronda' });
  }

  desconectar(): void {
    this.socket.cerrar();
    this.datos.next(null);
    this.seatId = '';
    this.asientos = [];
  }

  private conectar(roomId: string, seatId: string, seatToken: string): void {
    this.seatId = seatId;
    this.socket.conectar(roomId, seatToken);
  }

  private recibir(mensaje: ServerMessage): void {
    if (mensaje.tipo !== 'estado') return;

    this.asientos = mensaje.seats;
    const vista = mensaje.vista as ScrumView;
    const votados = new Set(vista.hanVotado);

    const players: Record<string, Player> = {};
    for (const asiento of this.asientos) {
      players[asiento.id] = {
        id: asiento.id,
        name: asiento.displayName,
        hasVoted: votados.has(asiento.id),
        ...desglosar(vista.votos[asiento.id]),
      };
    }

    this.datos.next({ players, showVotes: vista.revelado });
  }
}

/**
 * Traduce el voto del dominio a lo que la pantalla sabe pintar.
 *
 * Cuando no hay voto puede ser por dos motivos distintos —no ha votado, o ha
 * votado y todavía no se ve— y aquí no se distinguen a propósito: el desglose
 * queda a cero en los dos casos, y quién ha votado lo dice `hasVoted`, que sale
 * de una lista aparte.
 */
function desglosar(voto: ScrumVote | undefined): Pick<Player, 'currentVote' | 'voteBreakdown'> {
  if (!voto) return { currentVote: 0, voteBreakdown: { ...SIN_VOTO } };

  switch (voto.tipo) {
    case 'numero':
      return { currentVote: voto.valor, voteBreakdown: { ...SIN_VOTO, numbers: voto.valor } };
    case 'cafe':
      return { currentVote: 0, voteBreakdown: { ...SIN_VOTO, coffee: 1 } };
    case 'porro':
      return { currentVote: 0, voteBreakdown: { ...SIN_VOTO, joint: 1 } };
  }
}
