import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';
import type {
  DocumentoPrivado,
  InvitacionPrivada,
  InvitacionPrivadaVista,
  ListaPrivada,
  PasePrivado,
} from '@devweb/shared/contracts/privado';

/**
 * Lo privado, visto desde la web.
 *
 * Con sesión de administrador va como cualquier otra llamada; un invitado lleva
 * en cambio su pase, que solo abre esta carpeta y caduca con su invitación.
 */
@Injectable({ providedIn: 'root' })
export class PrivadoApiService {
  constructor(private readonly api: ApiClient) {}

  async lista(pase: string | null): Promise<readonly DocumentoPrivado[]> {
    const lista = await this.api.request<ListaPrivada>({
      method: 'GET',
      path: '/privado',
      ...(pase !== null && { pasePrivado: pase }),
    });
    return lista.documentos;
  }

  documento(ruta: string, pase: string | null): Promise<string> {
    return this.api.requestTexto({
      method: 'GET',
      path: `/privado/documento?ruta=${encodeURIComponent(ruta)}`,
      ...(pase !== null && { pasePrivado: pase }),
    });
  }

  /** Sin nada, una que vale una vez durante una hora; de grupo, la usan varios unos días. */
  invitar(grupo?: { dias: number; nota: string }): Promise<InvitacionPrivada> {
    return this.api.request<InvitacionPrivada>({
      method: 'POST',
      path: '/privado/invitaciones',
      body: grupo ? { tipo: 'grupo', ...grupo } : {},
    });
  }

  async invitaciones(): Promise<readonly InvitacionPrivadaVista[]> {
    const r = await this.api.request<{ invitaciones: InvitacionPrivadaVista[] }>({
      method: 'GET',
      path: '/privado/invitaciones',
    });
    return r.invitaciones;
  }

  async revocar(id: string): Promise<void> {
    await this.api.request({ method: 'DELETE', path: `/privado/invitaciones/${encodeURIComponent(id)}` });
  }

  canjear(codigo: string): Promise<PasePrivado> {
    return this.api.request<PasePrivado>({
      method: 'POST',
      path: '/privado/canjear',
      body: { codigo },
      sinRenovar: true,
    });
  }
}
