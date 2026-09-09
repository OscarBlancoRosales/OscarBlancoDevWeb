import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../api/admin-api.service';
import { AuthApiService } from '../api/auth-api.service';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';
import type { CreatedInvitation, Invitation } from '@devweb/shared/contracts/admin';
import type { PublicUser } from '@devweb/shared/contracts/auth';

const DIAS_POR_DEFECTO = 7;

/**
 * El panel de quien manda: quién hay dentro y a quién se deja entrar.
 *
 * Esta pantalla no decide nada por su cuenta. Comprueba el rol para saber si
 * pintarse, pero cada botón acaba en una ruta que lo vuelve a comprobar contra
 * la base; si alguien llega aquí sin serlo, verá la pantalla de «esto no
 * existe» y ningún dato.
 */
@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink, TerminalLayout],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  readonly usuarios = signal<readonly PublicUser[]>([]);
  readonly invitaciones = signal<readonly Invitation[]>([]);
  readonly cargando = signal(true);
  readonly mando = signal(false);
  readonly error = signal('');

  /** El enlace recién creado. Sale una vez y no se puede volver a pedir. */
  readonly reciente = signal<CreatedInvitation | null>(null);
  readonly copiado = signal(false);

  /**
   * A quién estamos a punto de borrar.
   *
   * El borrado se lleva por delante la cuenta y sus salas, así que pide un
   * segundo clic. Se hace aquí y no con `confirm()` porque el diálogo del
   * navegador bloquea la página entera.
   */
  readonly confirmando = signal('');

  nota = '';
  dias = DIAS_POR_DEFECTO;
  readonly creando = signal(false);

  constructor(
    private readonly admin: AdminApiService,
    private readonly auth: AuthApiService,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    void this.arrancar();
  }

  /** Aparte de `ngOnInit` para poder esperarlo: el ciclo de Angular no espera. */
  async arrancar(): Promise<void> {
    await this.auth.restaurar();
    this.mando.set(this.auth.usuario?.role === 'admin');
    if (this.mando()) await this.refrescar();
    this.cargando.set(false);
  }

  async refrescar(): Promise<void> {
    await this.intentar(async () => {
      this.usuarios.set(await this.admin.usuarios());
      this.invitaciones.set(await this.admin.invitaciones());
    });
  }

  async cambiarEstado(usuario: PublicUser): Promise<void> {
    const status = usuario.status === 'blocked' ? 'active' : 'blocked';
    await this.intentar(async () => {
      await this.admin.cambiarEstado(usuario.id, status);
      this.usuarios.set(await this.admin.usuarios());
    });
  }

  async borrar(usuario: PublicUser): Promise<void> {
    if (this.confirmando() !== usuario.id) {
      this.confirmando.set(usuario.id);
      return;
    }
    this.confirmando.set('');
    await this.intentar(async () => {
      await this.admin.borrarUsuario(usuario.id);
      this.usuarios.set(await this.admin.usuarios());
    });
  }

  async crearInvitacion(): Promise<void> {
    if (this.creando()) return;
    this.creando.set(true);
    this.copiado.set(false);
    await this.intentar(async () => {
      this.reciente.set(await this.admin.crearInvitacion(this.nota, this.dias));
      this.nota = '';
      this.invitaciones.set(await this.admin.invitaciones());
    });
    this.creando.set(false);
  }

  async revocar(invitacion: Invitation): Promise<void> {
    await this.intentar(async () => {
      await this.admin.revocarInvitacion(invitacion.id);
      this.invitaciones.set(await this.admin.invitaciones());
    });
  }

  async copiar(enlace: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(enlace);
      this.copiado.set(true);
    } catch {
      // Sin permiso de portapapeles queda el enlace a la vista para copiarlo a mano.
    }
  }

  fecha(marca: number): string {
    return new Date(marca).toLocaleDateString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  estadoDe(invitacion: Invitation): string {
    if (invitacion.usadaEn !== null) return this.i18n.t('admin.used');
    if (invitacion.expiraEn < Date.now()) return this.i18n.t('admin.expired');
    return this.i18n.t('admin.pending');
  }

  private async intentar(accion: () => Promise<void>): Promise<void> {
    this.error.set('');
    try {
      await accion();
    } catch (fallo) {
      this.error.set(AuthApiService.mensajeDe(fallo));
    }
  }
}
