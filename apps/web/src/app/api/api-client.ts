import { Injectable } from '@angular/core';
import { apiBaseUrl } from './api.config';

export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Peticion {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  /**
   * El pase del asiento, para lo que se autoriza por asiento y no por cuenta.
   *
   * Va en una cabecera y no en una cookie porque una persona puede tener dos
   * salas abiertas en dos pestañas con asientos distintos, y una cookie por
   * dominio no sabe distinguirlas.
   */
  readonly seatToken?: string;
  /** Para las llamadas que no deben intentar renovar sesión: el propio refresco. */
  readonly sinRenovar?: boolean;
}

/**
 * El único sitio de la web que habla con la API.
 *
 * El token de acceso vive **en memoria**, no en `localStorage`: cualquier script
 * inyectado en la página puede leer el almacenamiento, y un token robado de ahí
 * sirve hasta que caduque. Lo que sí persiste es la cookie de refresco, que es
 * `HttpOnly` y por tanto ningún script puede tocar. El precio es que al recargar
 * la página hay que pedir un token nuevo, y eso es exactamente lo que hace
 * `renovar()`.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly base = apiBaseUrl();
  private accessToken: string | null = null;

  /**
   * Renovaciones en curso, para no lanzar cinco a la vez.
   *
   * Si tres peticiones caducan al mismo tiempo, las tres verían un 401 y las
   * tres pedirían un token nuevo. Como cada refresco invalida el anterior, la
   * segunda mataría la sesión que acaba de abrir la primera.
   */
  private renovando: Promise<boolean> | null = null;

  get token(): string | null {
    return this.accessToken;
  }

  setToken(token: string | null): void {
    this.accessToken = token;
  }

  async request<T>(peticion: Peticion): Promise<T> {
    const respuesta = await this.enviar(peticion);

    if (respuesta.status === 401 && !peticion.sinRenovar && (await this.renovar())) {
      return this.leer<T>(await this.enviar(peticion));
    }
    return this.leer<T>(respuesta);
  }

  /**
   * Pide un token nuevo con la cookie de refresco.
   *
   * Devuelve si lo consiguió, no lanza: quien llama casi siempre quiere seguir
   * como invitado si no hay sesión, no romperse.
   */
  async renovar(): Promise<boolean> {
    this.renovando ??= this.pedirTokenNuevo().finally(() => {
      this.renovando = null;
    });
    return this.renovando;
  }

  private async pedirTokenNuevo(): Promise<boolean> {
    try {
      const respuesta = await this.enviar({ method: 'POST', path: '/auth/refresco', sinRenovar: true });
      if (!respuesta.ok) {
        this.accessToken = null;
        return false;
      }
      const sesion = (await respuesta.json()) as { accessToken: string };
      this.accessToken = sesion.accessToken;
      return true;
    } catch {
      this.accessToken = null;
      return false;
    }
  }

  private enviar(peticion: Peticion): Promise<Response> {
    const headers: Record<string, string> = {};
    if (peticion.body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (peticion.seatToken) headers['X-Seat-Token'] = peticion.seatToken;

    return fetch(`${this.base}${peticion.path}`, {
      method: peticion.method,
      headers,
      // Sin esto la cookie de refresco no viaja y la sesión se pierde al recargar.
      credentials: 'include',
      ...(peticion.body !== undefined && { body: JSON.stringify(peticion.body) }),
    });
  }

  private async leer<T>(respuesta: Response): Promise<T> {
    const texto = await respuesta.text();
    const cuerpo: unknown = texto ? JSON.parse(texto) : null;

    if (!respuesta.ok) {
      const error = cuerpo as Partial<ApiErrorBody> | null;
      throw new ApiError(
        error?.code ?? 'error-desconocido',
        error?.message ?? 'No se ha podido completar la operación.',
        respuesta.status,
      );
    }
    return cuerpo as T;
  }
}
