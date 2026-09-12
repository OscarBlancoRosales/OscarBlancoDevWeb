import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../api/admin-api.service';
import { AuthApiService } from '../../api/auth-api.service';
import { I18nService } from '../../services/i18n.service';
import type { Acceso } from '@devweb/shared/contracts/admin';

/**
 * Quién está dentro, desde dónde, y cómo echarlo.
 *
 * Una fila es un aparato, no una sesión de la base: cada renovación escribe una
 * fila nueva con la misma familia, así que un mes de uso son cientos y con eso
 * no se administra nada. Lo que se reconoce es «mi portátil».
 *
 * Cerrar un aparato revoca su cadena de refrescos. Forzar relogin va más lejos
 * y se lleva también el acceso ya firmado: sin eso, quien acabas de echar
 * seguiría trabajando hasta que su token caducara.
 */
@Component({
  selector: 'app-accesos',
  imports: [FormsModule],
  templateUrl: './accesos.html',
  styleUrl: './accesos.css',
})
export class Accesos implements OnInit {
  readonly accesos = signal<readonly Acceso[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  readonly busqueda = signal('');
  readonly soloVivos = signal(true);
  /** Qué acceso enseña el user-agent entero. */
  readonly desplegado = signal('');
  /** A quién se está a punto de echar de todas partes. */
  readonly confirmando = signal('');

  readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.accesos().filter((uno) => {
      if (this.soloVivos() && !this.vivo(uno)) return false;
      if (texto === '') return true;
      return `${uno.usuario.email} ${uno.usuario.displayName} ${uno.aparato} ${uno.ip}`
        .toLowerCase()
        .includes(texto);
    });
  });

  readonly dentro = computed(() => this.accesos().filter((uno) => this.vivo(uno)).length);
  readonly personas = computed(
    () => new Set(this.accesos().filter((uno) => this.vivo(uno)).map((uno) => uno.usuario.id)).size,
  );
  readonly sitios = computed(
    () =>
      new Set(
        this.accesos()
          .filter((uno) => this.vivo(uno) && uno.ip !== '')
          .map((uno) => uno.ip),
      ).size,
  );

  constructor(
    private readonly admin: AdminApiService,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    void this.refrescar();
  }

  async refrescar(): Promise<void> {
    this.cargando.set(true);
    await this.intentar(async () => {
      this.accesos.set(await this.admin.accesos());
    });
    this.cargando.set(false);
  }

  /** Dentro de verdad: ni revocado, ni echado, ni caducado. */
  vivo(acceso: Acceso): boolean {
    return !acceso.revocada && !acceso.fueraDelTodo && acceso.expiraEn > Date.now();
  }

  estadoDe(acceso: Acceso): string {
    if (acceso.fueraDelTodo) return this.i18n.t('acc.echado');
    if (acceso.revocada) return this.i18n.t('acc.cerrada');
    if (acceso.expiraEn <= Date.now()) return this.i18n.t('acc.caducada');
    return this.i18n.t('acc.dentro');
  }

  claseDe(acceso: Acceso): string {
    if (acceso.fueraDelTodo) return 'badge--error';
    if (this.vivo(acceso)) return 'badge--vivo';
    return '';
  }

  desplegar(acceso: Acceso): void {
    this.desplegado.set(this.desplegado() === acceso.id ? '' : acceso.id);
  }

  async cerrar(acceso: Acceso): Promise<void> {
    await this.intentar(async () => {
      await this.admin.cerrarAcceso(acceso.id);
      this.accesos.set(await this.admin.accesos());
    });
  }

  /**
   * Echar a alguien de todas partes pide un segundo clic.
   *
   * Se lleva por delante todos sus aparatos a la vez, incluido el móvil que
   * tenga a mano, y eso no se deshace: hay que volver a entrar.
   */
  async forzarRelogin(acceso: Acceso): Promise<void> {
    if (this.confirmando() !== acceso.usuario.id) {
      this.confirmando.set(acceso.usuario.id);
      return;
    }
    this.confirmando.set('');
    await this.intentar(async () => {
      await this.admin.forzarRelogin(acceso.usuario.id);
      this.accesos.set(await this.admin.accesos());
    });
  }

  cuando(marca: number): string {
    return new Date(marca).toLocaleString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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
