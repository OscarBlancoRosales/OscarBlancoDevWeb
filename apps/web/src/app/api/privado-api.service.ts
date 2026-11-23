import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';
import type {
  DocumentoPrivado,
  InvitacionPrivada,
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

  invitar(): Promise<InvitacionPrivada> {
    return this.api.request<InvitacionPrivada>({ method: 'POST', path: '/privado/invitaciones' });
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
