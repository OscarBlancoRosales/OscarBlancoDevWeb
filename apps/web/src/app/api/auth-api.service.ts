import { Injectable } from '@angular/core';
import { BehaviorSubject, ReplaySubject } from 'rxjs';
import { ApiClient, ApiError } from './api-client';
import type { Observable } from 'rxjs';
import type { OkResponse, PublicUser, SessionResponse } from '@devweb/shared/contracts/auth';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly usuarioSubject = new BehaviorSubject<PublicUser | null>(null);
  private readonly resueltoSubject = new ReplaySubject<PublicUser | null>(1);

  readonly user$: Observable<PublicUser | null> = this.usuarioSubject.asObservable();

  /**
   * El usuario UNA VEZ se ha comprobado si había sesión guardada.
   *
   * `user$` arranca valiendo null y sigue valiendo null durante el instante en
   * que se pide el token nuevo con la cookie, así que quien se suscriba nada más
   * cargar la página recibe un null que NO significa "no hay sesión", sino
   * "todavía no lo sé". Para encender un botón da igual; para EXPULSAR a alguien
   * es fatal, porque echaría a la calle a quien solo estaba recargando.
   *
   * Este observable no emite hasta que hay respuesta. Úsalo siempre que la
   * decisión sea irreversible para el usuario.
   */
  readonly settledUser$: Observable<PublicUser | null> = this.resueltoSubject.asObservable();

  private restaurando: Promise<void> | null = null;

  constructor(private readonly api: ApiClient) {
    void this.restaurar();
  }

  /** Recupera la sesión guardada, si la hay. Se llama sola al arrancar. */
  async restaurar(): Promise<void> {
    this.restaurando ??= this.hacerRestaurar().finally(() => {
      this.restaurando = null;
    });
    return this.restaurando;
  }

  private async hacerRestaurar(): Promise<void> {
    if (!(await this.api.renovar())) {
      this.publicar(null);
      return;
    }
    try {
      this.publicar(await this.api.request<PublicUser>({ method: 'GET', path: '/auth/yo' }));
    } catch {
      this.publicar(null);
    }
  }

  get usuario(): PublicUser | null {
    return this.usuarioSubject.value;
  }

  async registrar(email: string, password: string, displayName: string): Promise<void> {
    await this.api.request<OkResponse>({
      method: 'POST',
      path: '/auth/registro',
      body: { email, password, displayName },
    });
  }

  async verificar(token: string): Promise<void> {
    await this.api.request<OkResponse>({ method: 'POST', path: '/auth/verificar', body: { token } });
  }

  async entrar(email: string, password: string): Promise<PublicUser> {
    const sesion = await this.api.request<SessionResponse>({
      method: 'POST',
      path: '/auth/acceso',
      body: { email, password },
    });
    this.api.setToken(sesion.accessToken);
    this.publicar(sesion.user);
    return sesion.user;
  }

  /**
   * Cierra la sesión, pase lo que pase por el camino.
   *
   * Si la llamada al servidor falla —sin red, o la sesión ya estaba muerta— la
   * de aquí se cierra igual: quien pulsa "salir" espera quedarse fuera, y
   * dejarle dentro porque el servidor no contestó sería lo contrario.
   */
  async salir(): Promise<void> {
    try {
      await this.api.request<OkResponse>({ method: 'POST', path: '/auth/salir' });
    } catch {
      // Da igual: la sesión local se cierra abajo.
    }
    this.api.setToken(null);
    this.publicar(null);
  }

  async pedirCambioDeContrasena(email: string): Promise<void> {
    await this.api.request<OkResponse>({ method: 'POST', path: '/auth/olvide', body: { email } });
  }

  async cambiarContrasena(token: string, password: string): Promise<void> {
    await this.api.request<OkResponse>({
      method: 'POST',
      path: '/auth/nueva-contrasena',
      body: { token, password },
    });
  }

  /** El mensaje que se le enseña a una persona cuando algo falla. */
  static mensajeDe(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    return 'No se ha podido conectar con el servidor.';
  }

  private publicar(usuario: PublicUser | null): void {
    this.usuarioSubject.next(usuario);
    this.resueltoSubject.next(usuario);
  }
}
