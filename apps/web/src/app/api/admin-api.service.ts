import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';
import type {
  CreatedInvitation,
  Invitation,
  InvitationList,
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

  async crearInvitacion(nota: string, diasDeVida: number): Promise<CreatedInvitation> {
    return this.api.request<CreatedInvitation>({
      method: 'POST',
      path: '/admin/invitaciones',
      body: { nota, diasDeVida },
    });
  }

  async revocarInvitacion(id: string): Promise<void> {
    await this.api.request<OkResponse>({ method: 'DELETE', path: `/admin/invitaciones/${id}` });
  }
}
