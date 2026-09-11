import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenteApiService } from '../../api/agente-api.service';
import { I18nService } from '../../services/i18n.service';
import type { ResumenDeSesion, Sesion, Tanda } from '@devweb/shared/contracts/sesiones';

/** Cuántas tandas se piden de una vez. Las hay de cinco mil. */
const POR_TANDA = 60;

/**
 * Tus sesiones de Claude Code, leídas de tu propio disco.
 *
 * Las escribe Claude Code en `~/.claude/projects` y las sirve el agente que
 * corre en tu máquina; aquí solo se pintan. Si el agente no está, esta
 * pantalla lo dice y explica cómo abrirlo, en vez de quedarse en blanco.
 *
 * Se lee como un chat: la sesión se abre por el final, lo último abajo, y «ver
 * lo de antes» va añadiendo por arriba sin mover lo que estabas leyendo.
 */
@Component({
  selector: 'app-sesiones',
  imports: [FormsModule],
  templateUrl: './sesiones.html',
  styleUrl: './sesiones.css',
})
export class Sesiones implements OnInit {
  readonly hayAgente = signal(false);
  readonly cargando = signal(true);
  readonly error = signal('');

  readonly sesiones = signal<readonly ResumenDeSesion[]>([]);
  readonly abierta = signal<Sesion | null>(null);
  readonly cargandoMas = signal(false);

  /**
   * Por dónde empieza el tramo que se tiene delante.
   *
   * Lo lleva la pantalla y no se lee de la respuesta a propósito: el agente
   * corre en tu máquina y se actualiza cuando haces `pull`, así que uno viejo
   * contesta sin este dato —o rechaza lo que no entiende— y esto tiene que
   * seguir funcionando igual. Quien pide un tramo ya sabe cuál pidió.
   */
  private readonly desde = signal(0);

  /** Para filtrar la lista: son doscientas y pico. */
  readonly busqueda = signal('');
  /** Lo que Claude se dice a sí mismo va plegado: ocupa más que lo que dice. */
  readonly verPensamientos = signal(false);

  @ViewChild('hilo') hilo?: ElementRef<HTMLElement>;

  constructor(
    private readonly agente: AgenteApiService,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    void this.arrancar();
  }

  async arrancar(): Promise<void> {
    this.cargando.set(true);
    this.hayAgente.set(await this.agente.disponible());
    if (this.hayAgente()) await this.recargar();
    this.cargando.set(false);
  }

  async recargar(): Promise<void> {
    this.error.set('');
    try {
      this.sesiones.set(await this.agente.sesiones());
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No se ha podido leer.');
    }
  }

  /** Las que casan con lo que estás buscando: por título, rama o proyecto. */
  get listadas(): readonly ResumenDeSesion[] {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.sesiones();
    return this.sesiones().filter((s) =>
      `${s.titulo} ${s.rama} ${s.proyecto}`.toLowerCase().includes(q),
    );
  }

  esLaAbierta(sesion: ResumenDeSesion): boolean {
    return this.abierta()?.resumen.id === sesion.id;
  }

  /**
   * Abre por el final, que es lo último dicho.
   *
   * El corte se calcula aquí con las tandas que ya trae el resumen, en vez de
   * pedirle al agente que entienda un «dame el final»: así vale igual contra
   * un agente de hace dos semanas.
   */
  async abrir(resumen: ResumenDeSesion): Promise<void> {
    this.error.set('');
    this.abierta.set(null);
    const principio = Math.max(0, resumen.tandas - POR_TANDA);

    try {
      this.abierta.set(await this.agente.sesion(resumen.id, principio, POR_TANDA));
      this.desde.set(principio);
      this.alFinal();
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No se ha podido abrir.');
    }
  }

  /**
   * Trae el tramo anterior y lo pega por arriba.
   *
   * Se guarda cuánto medía el hilo antes de crecer y se recoloca el desliz por
   * esa diferencia: sin eso, cargar lo de antes empuja hacia abajo lo que
   * estabas leyendo y pierdes el sitio.
   */
  async masTandas(): Promise<void> {
    const actual = this.abierta();
    if (!actual || this.cargandoMas() || this.desde() === 0) return;

    this.cargandoMas.set(true);
    const caja = this.hilo?.nativeElement;
    const altoAntes = caja?.scrollHeight ?? 0;

    try {
      const hasta = this.desde();
      const principio = Math.max(0, hasta - POR_TANDA);
      const anterior = await this.agente.sesion(actual.resumen.id, principio, hasta - principio);
      this.abierta.set({ ...anterior, tandas: [...anterior.tandas, ...actual.tandas] });
      this.desde.set(principio);

      if (caja) {
        requestAnimationFrame(() => {
          caja.scrollTop += caja.scrollHeight - altoAntes;
        });
      }
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No se ha podido seguir leyendo.');
    }
    this.cargandoMas.set(false);
  }

  cerrar(): void {
    this.abierta.set(null);
  }

  /** Cuántas quedan por leer hacia atrás. Hacia adelante ya no queda nada. */
  get quedanPorLeer(): number {
    return this.desde();
  }

  /** Las tandas que se pintan, según si quieres ver lo que piensa. */
  tandasVisibles(sesion: Sesion): readonly Tanda[] {
    if (this.verPensamientos()) return sesion.tandas;
    return sesion.tandas
      .map((tanda) => ({ ...tanda, partes: tanda.partes.filter((p) => p.clase !== 'pensamiento') }))
      .filter((tanda) => tanda.partes.length > 0);
  }

  fecha(marca: number): string {
    if (!marca) return '';
    return new Date(marca).toLocaleString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  tamano(bytes: number): string {
    if (bytes > 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  }

  trackSesion = (_: number, sesion: ResumenDeSesion): string => sesion.id;
  trackTanda = (indice: number, tanda: Tanda): string => `${indice}:${tanda.id}`;

  /** Lo último dicho es lo primero que se quiere ver. */
  private alFinal(): void {
    requestAnimationFrame(() => {
      const caja = this.hilo?.nativeElement;
      if (caja) caja.scrollTop = caja.scrollHeight;
    });
  }
}
