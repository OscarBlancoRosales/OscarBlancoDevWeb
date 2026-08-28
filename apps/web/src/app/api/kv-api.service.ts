import { Injectable } from '@angular/core';
import { ApiClient } from './api-client';

export interface EntradaGuardada<T> {
  readonly key: string;
  readonly value: T;
  readonly updatedAt: number;
  /** Si quien pregunta puede reescribirla o borrarla. */
  readonly propia: boolean;
}

/**
 * El almacén de configuraciones compartidas.
 *
 * Sustituye a lo que colgaba de `throwdown-timer/configs` en Firebase, donde las
 * reglas decían `.write: true`: cualquiera con la consola abierta podía
 * reescribir la configuración de otro o borrarlas todas.
 */
@Injectable({ providedIn: 'root' })
export class KvApiService {
  constructor(private readonly api: ApiClient) {}

  listar<T>(namespace: string): Promise<{ entries: EntradaGuardada<T>[] }> {
    return this.api.request<{ entries: EntradaGuardada<T>[] }>({
      method: 'GET',
      path: `/kv/${encodeURIComponent(namespace)}`,
    });
  }

  leer<T>(namespace: string, key: string): Promise<EntradaGuardada<T>> {
    return this.api.request<EntradaGuardada<T>>({
      method: 'GET',
      path: `/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    });
  }

  guardar(namespace: string, key: string, value: unknown): Promise<{ ok: true }> {
    return this.api.request<{ ok: true }>({
      method: 'PUT',
      path: `/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
      body: { value },
    });
  }

  borrar(namespace: string, key: string): Promise<{ ok: true }> {
    return this.api.request<{ ok: true }>({
      method: 'DELETE',
      path: `/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    });
  }
}
