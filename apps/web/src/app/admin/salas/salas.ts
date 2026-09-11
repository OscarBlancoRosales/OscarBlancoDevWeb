import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../api/admin-api.service';
import { AuthApiService } from '../../api/auth-api.service';
import { I18nService } from '../../services/i18n.service';
import type { AdminRoom, AdminSeat } from '@devweb/shared/contracts/admin';
import type { GameId, RoomStatus } from '@devweb/shared/contracts/rooms';

/** Lo que hay que escribir para el borrado en bloque. */
export const PALABRA_PARA_BORRAR = 'BORRAR';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Los juegos y los estados, para los desplegables. En el orden de siempre. */
const JUEGOS: readonly GameId[] = ['scrum', 'risk', 'flota', 'trivial', 'impostor'];
const ESTADOS: readonly RoomStatus[] = ['lobby', 'playing', 'paused', 'finished'];

const COLOR_DEL_ESTADO: Readonly<Record<RoomStatus, string>> = {
  lobby: 'badge--warn',
  playing: 'badge--vivo',
  paused: 'badge--warn',
  finished: '',
};

/**
 * Las mesas abiertas y qué hacer con ellas.
 *
 * Cerrar una sala ajena y levantar a alguien de su asiento son las dos cosas
 * que ninguna otra pantalla puede hacer: en el juego solo manda quien abrió la
 * mesa. Aquí no se pregunta de quién es, y por eso todo lo de abajo acaba en
 * una ruta detrás de `requireAdmin`.
 *
 * Los filtros son señales y no campos sueltos porque de ellos cuelga la cuenta
 * que enseña el botón de borrar en bloque: sin zonas, un campo normal cambia
 * sin que nadie recalcule nada, y el botón diría un número viejo.
 */
@Component({
  selector: 'app-salas',
  imports: [FormsModule],
  templateUrl: './salas.html',
  styleUrl: './salas.css',
})
export class Salas implements OnInit {
  readonly JUEGOS = JUEGOS;
  readonly ESTADOS = ESTADOS;
  readonly PALABRA = PALABRA_PARA_BORRAR;

  readonly salas = signal<readonly AdminRoom[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  /** Qué sala tiene el desplegable de asientos abierto. */
  readonly abierta = signal('');
  /** Qué sala espera un segundo clic para cerrarse. */
  readonly confirmando = signal('');

  readonly juego = signal<GameId | ''>('');
  readonly estado = signal<RoomStatus | ''>('');
  readonly inactivasDias = signal<number | null>(null);
  readonly busqueda = signal('');
  readonly palabra = signal('');

  readonly filtradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.salas().filter((sala) => this.encaja(sala) && this.contiene(sala, texto));
  });

  /**
   * Las que se llevaría el borrado en bloque.
   *
   * Se cuenta aquí y no en el servidor porque el listado ya está delante: pedir
   * la cuenta por separado abriría un hueco entre lo que dice el botón y lo que
   * acaba pasando. La búsqueda por texto no cuenta, que esa no viaja al filtro.
   */
  readonly enElFiltro = computed(() => this.salas().filter((sala) => this.encaja(sala)).length);

  readonly abiertas = computed(
    () => this.salas().filter((sala) => sala.status !== 'finished').length,
  );
  readonly jugando = computed(() => this.salas().filter((sala) => sala.status === 'playing').length);
  readonly conectados = computed(() =>
    this.salas().reduce(
      (total, sala) => total + sala.asientos.filter((asiento) => asiento.connected).length,
      0,
    ),
  );

  readonly puedeBorrarEnBloque = computed(
    () => this.palabra().trim().toUpperCase() === PALABRA_PARA_BORRAR && this.enElFiltro() > 0,
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
      this.salas.set(await this.admin.salas());
    });
    this.cargando.set(false);
  }

  desplegar(sala: AdminRoom): void {
    this.abierta.set(this.abierta() === sala.id ? '' : sala.id);
  }

  async cerrar(sala: AdminRoom): Promise<void> {
    if (this.confirmando() !== sala.id) {
      this.confirmando.set(sala.id);
      return;
    }
    this.confirmando.set('');
    await this.intentar(async () => {
      await this.admin.cerrarSala(sala.id);
      this.salas.set(await this.admin.salas());
    });
  }

  async echar(sala: AdminRoom, asiento: AdminSeat): Promise<void> {
    await this.intentar(async () => {
      await this.admin.echarAsiento(sala.id, asiento.id);
      this.salas.set(await this.admin.salas());
    });
  }

  async cerrarEnBloque(): Promise<void> {
    if (!this.puedeBorrarEnBloque()) return;
    this.palabra.set('');
    await this.intentar(async () => {
      const juego = this.juego();
      const estado = this.estado();
      const dias = this.inactivasDias();
      await this.admin.cerrarSalas({
        ...(juego !== '' && { juego }),
        ...(estado !== '' && { estado }),
        ...(dias !== null && { inactivasDias: dias }),
      });
      this.salas.set(await this.admin.salas());
    });
  }

  personas(sala: AdminRoom): number {
    return sala.asientos.filter((asiento) => !asiento.isBot).length;
  }

  conectadosEn(sala: AdminRoom): number {
    return sala.asientos.filter((asiento) => asiento.connected).length;
  }

  claseDe(estado: RoomStatus): string {
    return COLOR_DEL_ESTADO[estado];
  }

  cuando(marca: number): string {
    return new Date(marca).toLocaleString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private encaja(sala: AdminRoom): boolean {
    const juego = this.juego();
    const estado = this.estado();
    const dias = this.inactivasDias();

    if (juego !== '' && sala.game !== juego) return false;
    if (estado !== '' && sala.status !== estado) return false;
    if (dias !== null && sala.updatedAt >= Date.now() - dias * DIA_MS) return false;
    return true;
  }

  private contiene(sala: AdminRoom, texto: string): boolean {
    if (texto === '') return true;
    const donde = [sala.name, sala.game, sala.duenyo?.email ?? '', sala.duenyo?.displayName ?? '']
      .join(' ')
      .toLowerCase();
    return donde.includes(texto);
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
