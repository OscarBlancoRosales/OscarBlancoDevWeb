import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';
import type { GameId, RoomInfo, SeatGrant } from '@devweb/shared/contracts/rooms';

@Injectable({ providedIn: 'root' })
export class RoomsApiService {
  constructor(private readonly api: ApiClient) {}

  /** Crear sala exige sesión: sin dueño no hay quien la borre ni quien la reclame. */
  crear(input: {
    game: GameId;
    name: string;
    displayName: string;
    config?: Record<string, unknown>;
    /** Los rivales que no son personas. Se sientan al crear la sala o nunca. */
    bots?: readonly string[];
  }): Promise<SeatGrant> {
    return this.api.request<SeatGrant>({
      method: 'POST',
      path: '/salas',
      body: {
        game: input.game,
        name: input.name,
        displayName: input.displayName,
        ...(input.config !== undefined && { config: input.config }),
        ...(input.bots !== undefined && { bots: input.bots }),
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

  borrar(roomId: string): Promise<{ ok: true }> {
    return this.api.request<{ ok: true }>({
      method: 'DELETE',
      path: `/salas/${encodeURIComponent(roomId)}`,
    });
  }
}
