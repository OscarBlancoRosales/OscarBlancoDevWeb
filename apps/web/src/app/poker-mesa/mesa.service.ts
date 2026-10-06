import { Injectable, NgZone, computed, signal } from '@angular/core';
import { RoomSocket } from '../api/room-socket';
import { RoomsApiService } from '../api/rooms-api.service';
import {
  avatarPorDefecto,
  avatarPorId,
  repartirAvatares,
} from '@devweb/shared/games/poker-reparto';
import type { Signal } from '@angular/core';
import type { ChatEntry, SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { ScrumView, ScrumVote } from '@devweb/shared/games/scrum';

/** Un mensaje de alguien, ya listo para pintarse como bocadillo. */
export interface Bocadillo {
  readonly seq: number;
  readonly seatId: string;
  readonly texto: string;
  readonly at: number;
}

/** Cuánto se queda un bocadillo en pantalla antes de desvanecerse. */
export const BOCADILLO_MS = 7000;

/**
 * La mesa de planning poker, versión de sobremesa.
 *
 * Habla el mismo idioma que la versión clásica -es el mismo juego en el
 * servidor, las mismas acciones y la misma vista- pero no traduce nada a la
 * forma antigua: la pantalla nueva quiere la vista cruda, los asientos con sus
 * avatares y el chat, que es lo que hace que aquello parezca una mesa.
 */
@Injectable({ providedIn: 'root' })
export class MesaService {
  private readonly _vista = signal<ScrumView | null>(null);
  private readonly _mesa = signal<readonly SeatInfo[]>([]);
  private readonly _chat = signal<readonly ChatEntry[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly vista: Signal<ScrumView | null> = this._vista.asReadonly();
  readonly mesa: Signal<readonly SeatInfo[]> = this._mesa.asReadonly();
  readonly chat: Signal<readonly ChatEntry[]> = this._chat.asReadonly();
  readonly error: Signal<string | null> = this._error.asReadonly();

  private seatId = '';
  private readonly socket: RoomSocket;

  constructor(
    private readonly rooms: RoomsApiService,
    zone: NgZone,
  ) {
    this.socket = new RoomSocket(zone);
    this.socket.messages$.subscribe((mensaje) => {
      this.recibir(mensaje);
    });
  }

  get miAsiento(): string {
    return this.seatId;
  }

  /**
   * Abre una mesa nueva.
   *
   * La versión queda escrita en la configuración de la sala, no en el enlace:
   * quien entre después se sienta en la misma mesa que quien la abrió, y el
   * crupier solo aparece en esta.
   */
  async crear(
    nombreSala: string,
    nombreJugador: string,
    avatar: string,
  ): Promise<{ roomId: string; seatId: string; seatToken: string }> {
    const grant = await this.rooms.crear({
      game: 'scrum',
      name: nombreSala,
      displayName: nombreJugador,
      meta: { avatar },
      config: { version: 'mesa' },
    });
    this.conectar(grant.room.id, grant.seatId, grant.seatToken);
    return { roomId: grant.room.id, seatId: grant.seatId, seatToken: grant.seatToken };
  }

  /** Se sienta en una mesa que ya existe. No hace falta cuenta. */
  async unirse(
    roomId: string,
    nombreJugador: string,
    avatar: string,
  ): Promise<{ seatId: string; seatToken: string }> {
    const grant = await this.rooms.unirse(roomId, nombreJugador, undefined, { avatar });
    this.conectar(roomId, grant.seatId, grant.seatToken);
    return { seatId: grant.seatId, seatToken: grant.seatToken };
  }

  reconectar(roomId: string, seatId: string, seatToken: string): void {
    this.conectar(roomId, seatId, seatToken);
  }

  // --- Lo que se puede hacer en la mesa ---------------------------------

  votar(voto: ScrumVote): void {
    this.socket.enviar({ tipo: 'votar', voto });
  }

  retirarVoto(): void {
    this.socket.enviar({ tipo: 'retirar-voto' });
  }

  revelar(): void {
    this.socket.enviar({ tipo: 'revelar' });
  }

  nuevaRonda(asunto?: string): void {
    this.socket.enviar({ tipo: 'nueva-ronda', ...(asunto ? { asunto } : {}) });
  }

  decir(texto: string): void {
    const limpio = texto.trim();
    if (limpio) this.socket.decir(limpio);
  }

  desconectar(): void {
    this.socket.cerrar();
    this._vista.set(null);
    this._mesa.set([]);
    this._chat.set([]);
    this.seatId = '';
  }

  // --- Quién es quién ----------------------------------------------------

  nombreDe(seatId: string): string {
    return this._mesa().find((uno) => uno.id === seatId)?.displayName ?? 'Alguien';
  }

  /**
   * Las caras de la mesa, repartidas **una sola vez** por composición.
   *
   * Antes esto se calculaba dentro de `avatarDe`, o sea una vez por cada
   * pregunta: dos por jugador en cada repintado, y la pantalla se repinta cada
   * segundo para que caigan los bocadillos. Que la identidad de alguien se
   * vuelva a decidir cada vez que se pinta es justo lo que hace que parezca
   * que un clic lo cambia todo.
   */
  private readonly caras = computed(() => carasDeLaMesa(this._mesa()));

  /**
   * El avatar de cada asiento, repartido sin repetir.
   *
   * Se reparte sobre la mesa entera y no asiento a asiento: dos personas con
   * la misma cara alrededor de una mesa de poker no se distinguen, y el
   * crupier acabaría pidiéndole cuentas a quien no era.
   *
   * Y si por lo que sea no hay reparto para ese asiento, manda **lo que eligió**,
   * que está guardado en su asiento desde que se sentó. Lo de antes era
   * inventarle una cara con el hash de su identificador, y así es como a quien
   * sí había elegido le salía de pronto otra sin haber tocado nada.
   */
  avatarDe(seatId: string): string {
    return this.caras()[seatId] ?? caraSuelta(this._mesa(), seatId);
  }

  /**
   * Lo último que ha dicho cada uno, si fue hace poco.
   *
   * Los bocadillos son de una mesa, no de un historial: enseñar el mensaje de
   * hace diez minutos encima de la cabeza de alguien no es un chat, es un
   * cartel. Pasado el rato, se cae solo.
   */
  bocadillos(ahora: number = Date.now()): Record<string, Bocadillo> {
    const ultimos: Record<string, Bocadillo> = {};
    for (const entrada of this._chat()) {
      if (entrada.kind !== 'player') continue;
      if (ahora - entrada.at > BOCADILLO_MS) continue;
      ultimos[entrada.authorId] = {
        seq: entrada.seq,
        seatId: entrada.authorId,
        texto: entrada.text,
        at: entrada.at,
      };
    }
    return ultimos;
  }

  private conectar(roomId: string, seatId: string, seatToken: string): void {
    this.seatId = seatId;
    this._error.set(null);
    this.socket.conectar(roomId, seatToken);
  }

  private recibir(mensaje: ServerMessage): void {
    if (mensaje.tipo === 'chat') {
      // Se acumulan por número de orden y no a pelo: al conectar llega el
      // historial entero, y sumarlo al que ya había repetía cada frase.
      const porSeq = new Map(this._chat().map((entrada) => [entrada.seq, entrada]));
      for (const entrada of mensaje.entradas) porSeq.set(entrada.seq, entrada);
      this._chat.set([...porSeq.values()].sort((uno, otro) => uno.seq - otro.seq).slice(-80));
      return;
    }
    if (mensaje.tipo === 'rechazada') {
      this._error.set(mensaje.message);
      return;
    }
    if (mensaje.tipo !== 'estado') return;

    this._mesa.set(mensaje.seats);
    if (mensaje.vista) this._vista.set(mensaje.vista as ScrumView);
  }
}

/** La cara que eligió ese asiento, si eligió alguna. */
function elegido(asiento: SeatInfo | undefined): string | undefined {
  const avatar = asiento?.meta?.['avatar'];
  return typeof avatar === 'string' ? avatar : undefined;
}

/**
 * Las caras de toda la mesa, repartidas sin que se repita ninguna.
 *
 * Está aquí fuera y exportada porque es la regla, no un detalle del servicio:
 * los juegos se prueban contra un doble de `MesaService`, y un doble que
 * devuelve la cara correcta no prueba nada de esto. Así hay dónde atornillarla.
 */
export function carasDeLaMesa(mesa: readonly SeatInfo[]): Record<string, string> {
  return repartirAvatares(mesa.map((uno) => ({ id: uno.id, avatar: elegido(uno) })));
}

/**
 * La cara de alguien que no sale en el reparto.
 *
 * Pasa mientras la mesa todavía no ha llegado del servidor. Manda lo que
 * eligió, que viaja en su asiento desde que se sentó: inventarle una con el
 * hash de su identificador es exactamente cómo a quien sí había elegido le
 * aparecía otra cara sin haber tocado nada.
 */
export function caraSuelta(mesa: readonly SeatInfo[], seatId: string): string {
  const suyo = mesa.find((uno) => uno.id === seatId);
  return avatarPorId(elegido(suyo))?.id ?? avatarPorDefecto(seatId).id;
}
