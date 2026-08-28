import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';
import type {
  GameId,
  RoomInfo,
  RoomStatus,
  SeatGrant,
} from '@devweb/shared/contracts/rooms';

@Injectable({ providedIn: 'root' })
export class RoomsApiService {
  constructor(private readonly api: ApiClient) {}

  /** Crear sala exige sesión: sin dueño no hay quien la borre ni quien la reclame. */
  crear(input: {
    game: GameId;
    name: string;
    displayName: string;
    config?: Record<string, unknown>;
  }): Promise<SeatGrant> {
    return this.api.request<SeatGrant>({
      method: 'POST',
      path: '/salas',
      body: {
        game: input.game,
        name: input.name,
        displayName: input.displayName,
        ...(input.config !== undefined && { config: input.config }),
      },
    });
  }

  /** Unirse NO exige sesión: quien llega por un enlace juega como invitado. */
  unirse(roomId: string, displayName: string): Promise<SeatGrant> {
    return this.api.request<SeatGrant>({
      method: 'POST',
      path: `/salas/${encodeURIComponent(roomId)}/unirse`,
      body: { displayName },
    });
  }

  info(roomId: string): Promise<RoomInfo> {
    return this.api.request<RoomInfo>({
      method: 'GET',
      path: `/salas/${encodeURIComponent(roomId)}`,
    });
  }

  mias(): Promise<{ rooms: RoomInfo[] }> {
    return this.api.request<{ rooms: RoomInfo[] }>({ method: 'GET', path: '/salas' });
  }

  /** Sienta un bot. Solo quien creó la sala reparte asientos. */
  anadirAsiento(
    roomId: string,
    seat: { displayName: string; isBot: boolean; meta?: Record<string, unknown> },
  ): Promise<SeatGrant> {
    return this.api.request<SeatGrant>({
      method: 'POST',
      path: `/salas/${encodeURIComponent(roomId)}/asientos`,
      body: {
        displayName: seat.displayName,
        isBot: seat.isBot,
        ...(seat.meta !== undefined && { meta: seat.meta }),
      },
    });
  }

  cambiarAsiento(
    roomId: string,
    seatId: string,
    cambios: { displayName?: string; meta?: Record<string, unknown> },
    seatToken?: string,
  ): Promise<RoomInfo> {
    return this.api.request<RoomInfo>({
      method: 'PATCH',
      path: `/salas/${encodeURIComponent(roomId)}/asientos/${encodeURIComponent(seatId)}`,
      body: cambios,
      ...(seatToken !== undefined && { seatToken }),
    });
  }

  quitarAsiento(roomId: string, seatId: string, seatToken?: string): Promise<RoomInfo> {
    return this.api.request<RoomInfo>({
      method: 'DELETE',
      path: `/salas/${encodeURIComponent(roomId)}/asientos/${encodeURIComponent(seatId)}`,
      ...(seatToken !== undefined && { seatToken }),
    });
  }

  cambiarSala(
    roomId: string,
    cambios: { name?: string; status?: RoomStatus; config?: Record<string, unknown> },
  ): Promise<RoomInfo> {
    return this.api.request<RoomInfo>({
      method: 'PATCH',
      path: `/salas/${encodeURIComponent(roomId)}`,
      body: cambios,
    });
  }

  borrar(roomId: string): Promise<{ ok: true }> {
    return this.api.request<{ ok: true }>({
      method: 'DELETE',
      path: `/salas/${encodeURIComponent(roomId)}`,
    });
  }
}
