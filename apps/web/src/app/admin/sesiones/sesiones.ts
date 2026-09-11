import { Component, OnInit, signal } from '@angular/core';
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

  /** Para filtrar la lista: son doscientas y pico. */
  busqueda = '';
  /** Lo que Claude se dice a sí mismo va plegado: ocupa más que lo que dice. */
  readonly verPensamientos = signal(false);

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
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.sesiones();
    return this.sesiones().filter((s) =>
      `${s.titulo} ${s.rama} ${s.proyecto}`.toLowerCase().includes(q),
    );
  }

  async abrir(resumen: ResumenDeSesion): Promise<void> {
    this.error.set('');
    this.abierta.set(null);
    try {
      this.abierta.set(await this.agente.sesion(resumen.id, 0, POR_TANDA));
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No se ha podido abrir.');
    }
  }

  /** Trae el siguiente tramo y lo pega al final, sin perder lo leído. */
  async masTandas(): Promise<void> {
    const actual = this.abierta();
    if (!actual || this.cargandoMas()) return;
    this.cargandoMas.set(true);
    try {
      const siguiente = await this.agente.sesion(actual.resumen.id, actual.tandas.length, POR_TANDA);
      this.abierta.set({ ...siguiente, tandas: [...actual.tandas, ...siguiente.tandas] });
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No se ha podido seguir leyendo.');
    }
    this.cargandoMas.set(false);
  }

  cerrar(): void {
    this.abierta.set(null);
  }

  get quedanPorLeer(): number {
    const actual = this.abierta();
    return actual ? actual.total - actual.tandas.length : 0;
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
}
