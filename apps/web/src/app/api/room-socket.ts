import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { apiSocketUrl } from './api.config';
import type { Observable } from 'rxjs';
import type { ServerMessage } from '@devweb/shared/contracts/rooms';

export type EstadoConexion = 'cerrada' | 'conectando' | 'abierta';

/** Espera antes de reintentar, en milisegundos. Crece y se detiene en 15 s. */
const ESPERAS = [500, 1000, 2000, 5000, 10000, 15000] as const;

/**
 * La conexión con una sala.
 *
 * Reconecta sola: un WebSocket se cae por cualquier cosa —el móvil cambia de
 * wifi a datos, el portátil se suspende, el proxy corta una conexión ociosa— y
 * ninguna de esas es motivo para echar a nadie de la partida. Al volver, el
 * servidor manda el estado completo, así que no hay nada que reconciliar a mano.
 */
@Injectable({ providedIn: 'root' })
export class RoomSocket {
  private socket: WebSocket | null = null;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private intentos = 0;
  private cerradoAProposito = false;
  private destino: { roomId: string; seatToken: string } | null = null;

  private readonly mensajes = new Subject<ServerMessage>();
  private readonly estado = new BehaviorSubject<EstadoConexion>('cerrada');

  readonly messages$: Observable<ServerMessage> = this.mensajes.asObservable();
  readonly estado$: Observable<EstadoConexion> = this.estado.asObservable();

  constructor(private readonly zone: NgZone) {}

  conectar(roomId: string, seatToken: string): void {
    this.cerrar();
    this.cerradoAProposito = false;
    this.destino = { roomId, seatToken };
    this.abrir();
  }

  /** Manda una jugada. Si no hay conexión, se pierde: el servidor es la verdad. */
  enviar(accion: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ tipo: 'accion', accion }));
    }
  }

  cerrar(): void {
    this.cerradoAProposito = true;
    if (this.reintento) {
      clearTimeout(this.reintento);
      this.reintento = null;
    }
    this.socket?.close();
    this.socket = null;
    this.destino = null;
    this.estado.next('cerrada');
  }

  private abrir(): void {
    if (!this.destino) return;
    const { roomId, seatToken } = this.destino;

    const url = `${apiSocketUrl()}/ws?sala=${encodeURIComponent(roomId)}&pase=${encodeURIComponent(seatToken)}`;
    this.estado.next('conectando');

    // Fuera de la zona de Angular: un WebSocket activo dispararía detección de
    // cambios en cada mensaje, y en una partida eso es constante. Lo que hace
    // falta repintar se vuelve a meter en la zona al recibirlo.
    const socket = this.zone.runOutsideAngular(() => new WebSocket(url));
    this.socket = socket;

    socket.onopen = (): void => {
      this.intentos = 0;
      this.zone.run(() => {
        this.estado.next('abierta');
      });
    };

    socket.onmessage = (evento: MessageEvent<string>): void => {
      const mensaje = this.leer(evento.data);
      if (mensaje) {
        this.zone.run(() => {
          this.mensajes.next(mensaje);
        });
      }
    };

    socket.onclose = (evento: CloseEvent): void => {
      this.zone.run(() => {
        this.estado.next('cerrada');
      });
      // 4401 y 4404 los manda el servidor cuando el pase no vale o la sala no
      // existe. Reintentar eso es insistir en algo que no va a cambiar.
      if (this.cerradoAProposito || evento.code === 4401 || evento.code === 4404) return;
      this.programarReintento();
    };

    socket.onerror = (): void => {
      socket.close();
    };
  }

  private programarReintento(): void {
    const espera = ESPERAS[Math.min(this.intentos, ESPERAS.length - 1)] ?? 15000;
    this.intentos += 1;
    this.reintento = setTimeout(() => {
      this.reintento = null;
      this.abrir();
    }, espera);
  }

  private leer(datos: string): ServerMessage | null {
    try {
      return JSON.parse(datos) as ServerMessage;
    } catch {
      return null;
    }
  }
}
