import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';
import type {
  AdminRoom,
  AdminRoomList,
  BorrarSalasRequest,
  CreatedInvitation,
  Invitation,
  InvitationList,
  SalasBorradas,
  UserList,
} from '@devweb/shared/contracts/admin';
import type { OkResponse, PublicUser } from '@devweb/shared/contracts/auth';

/**
 * El panel de administración, visto desde la web.
 *
 * No guarda nada: quien manda es el servidor, que vuelve a comprobar el rol en
 * cada una de estas rutas. Si alguien se fabricase un `role: 'admin'` en el
 * cliente solo conseguiría ver la pantalla y recibir un 404 en todo lo demás.
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private readonly api: ApiClient) {}

  async usuarios(): Promise<readonly PublicUser[]> {
    return (await this.api.request<UserList>({ method: 'GET', path: '/admin/usuarios' })).users;
  }

  async cambiarEstado(userId: string, status: 'active' | 'blocked'): Promise<PublicUser> {
    return this.api.request<PublicUser>({
      method: 'PATCH',
      path: `/admin/usuarios/${userId}`,
      body: { status },
    });
  }

  async borrarUsuario(userId: string): Promise<void> {
    await this.api.request<OkResponse>({ method: 'DELETE', path: `/admin/usuarios/${userId}` });
  }

  async invitaciones(): Promise<readonly Invitation[]> {
    return (await this.api.request<InvitationList>({ method: 'GET', path: '/admin/invitaciones' }))
      .invitaciones;
  }

  /** Con `email`, además de devolver el enlace se lo manda a esa dirección. */
  async crearInvitacion(
    nota: string,
    diasDeVida: number,
    email = '',
  ): Promise<CreatedInvitation> {
    return this.api.request<CreatedInvitation>({
      method: 'POST',
      path: '/admin/invitaciones',
      body: { nota, diasDeVida, ...(email.trim() !== '' && { email: email.trim() }) },
    });
  }

  async revocarInvitacion(id: string): Promise<void> {
    await this.api.request<OkResponse>({ method: 'DELETE', path: `/admin/invitaciones/${id}` });
  }

  async salas(): Promise<readonly AdminRoom[]> {
    return (await this.api.request<AdminRoomList>({ method: 'GET', path: '/admin/salas' })).salas;
  }

  async cerrarSala(roomId: string): Promise<void> {
    await this.api.request<OkResponse>({ method: 'DELETE', path: `/admin/salas/${roomId}` });
  }

  async echarAsiento(roomId: string, seatId: string): Promise<void> {
    await this.api.request<OkResponse>({
      method: 'DELETE',
      path: `/admin/salas/${roomId}/asientos/${seatId}`,
    });
  }

  /** Devuelve cuántas se ha llevado por delante. */
  async cerrarSalas(filtro: BorrarSalasRequest): Promise<number> {
    return (
      await this.api.request<SalasBorradas>({ method: 'DELETE', path: '/admin/salas', body: filtro })
    ).borradas;
  }
}
