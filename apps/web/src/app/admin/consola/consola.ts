import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenteApiService } from '../../api/agente-api.service';
import { I18nService } from '../../services/i18n.service';
import type { CanalVivo, Conversacion } from '../../api/agente-api.service';

/** Cada cuánto se mira si Claude ha contestado o pide permiso para algo. */
const LATIDO_MS = 2000;

/**
 * Hablar con tu sesión de Claude Code desde la web.
 *
 * Lo que escribes entra en la sesión que tengas abierta en el ordenador, con
 * todo lo que ya tiene delante. Y cuando Claude quiere tocar algo, el permiso
 * llega aquí además de a tu terminal: contesta el primero de los dos.
 *
 * Escribir exige haber emparejado este aparato, y para eso hay que leer un
 * código que solo sale por el terminal del canal. Es la frontera entera: una
 * cookie de administrador robada no basta, porque el dispositivo tiene que
 * haberse presentado una vez delante del ordenador.
 */
@Component({
  selector: 'app-consola',
  imports: [FormsModule],
  templateUrl: './consola.html',
  styleUrl: './consola.css',
})
export class Consola implements OnInit, OnDestroy {
  readonly hayCanal = signal(false);
  readonly emparejado = signal(false);
  readonly esperandoCodigo = signal(false);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly enviando = signal(false);

  readonly conversacion = signal<Conversacion>({ mensajes: [], permisos: [] });

  /**
   * Las sesiones que están escuchando, una por repositorio abierto.
   *
   * Trabajando en dos proyectos a la vez hay dos canales, cada uno en su
   * puerto: aquí se elige a cuál se le habla. El emparejamiento vale para
   * todos, porque la lista de aparatos es una sola.
   */
  readonly canales = signal<readonly CanalVivo[]>([]);
  readonly canal = signal<CanalVivo | null>(null);

  texto = '';
  codigo = '';
  nombre = '';
  /** Dónde buscar el agente. Vacío = en este mismo ordenador. */
  donde = '';

  private latido?: ReturnType<typeof setInterval>;

  constructor(
    private readonly agente: AgenteApiService,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    this.donde = this.agente.donde;
    void this.arrancar();
  }

  /**
   * Desde el móvil, `127.0.0.1` es el móvil: hay que decir por dónde se llega
   * al ordenador. La dirección se guarda por aparato, así que el del
   * escritorio sigue hablando con su propia máquina sin tocar nada.
   */
  async apuntarA(): Promise<void> {
    this.agente.donde = this.donde;
    await this.arrancar();
  }

  ngOnDestroy(): void {
    if (this.latido) clearInterval(this.latido);
  }

  async arrancar(): Promise<void> {
    this.cargando.set(true);
    const encontrados = await this.agente.canales();
    this.canales.set(encontrados);
    this.hayCanal.set(encontrados.length > 0);

    // Si solo hay una sesión escuchando no hay nada que elegir; si hay varias
    // se mantiene la elegida mientras siga viva.
    const sigueViva = encontrados.find((c) => c.puerto === this.canal()?.puerto);
    this.elegir(sigueViva ?? encontrados.at(0) ?? null);

    this.emparejado.set(this.agente.emparejado);
    if (this.hayCanal() && this.emparejado()) await this.refrescar();
    this.cargando.set(false);
    this.vigilar();
  }

  elegir(canal: CanalVivo | null): void {
    this.canal.set(canal);
    if (canal) this.agente.hablarCon(canal.puerto);
  }

  async cambiarDeCanal(canal: CanalVivo): Promise<void> {
    this.elegir(canal);
    this.conversacion.set({ mensajes: [], permisos: [] });
    await this.refrescar();
  }

  /** Mientras la pantalla esté abierta, se mira si hay algo nuevo. */
  private vigilar(): void {
    if (this.latido) clearInterval(this.latido);
    if (!this.hayCanal() || !this.emparejado()) return;
    this.latido = setInterval(() => void this.refrescar(), LATIDO_MS);
  }

  async refrescar(): Promise<void> {
    try {
      this.conversacion.set(await this.agente.conversacion());
      this.error.set('');
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'Se ha perdido el canal.');
      // Si el canal ya no nos reconoce, dejar de insistir cada dos segundos.
      this.emparejado.set(false);
      if (this.latido) clearInterval(this.latido);
    }
  }

  // ===== EMPAREJAR =====

  async pedirCodigo(): Promise<void> {
    this.error.set('');
    try {
      await this.agente.pedirCodigo(this.nombre || 'este navegador');
      this.esperandoCodigo.set(true);
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No se ha podido pedir el código.');
    }
  }

  async emparejar(): Promise<void> {
    this.error.set('');
    try {
      await this.agente.emparejar(this.codigo.trim());
      this.codigo = '';
      this.esperandoCodigo.set(false);
      this.emparejado.set(true);
      await this.refrescar();
      this.vigilar();
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'Ese código no vale.');
    }
  }

  desemparejar(): void {
    this.agente.olvidarEsteDispositivo();
    this.emparejado.set(false);
    if (this.latido) clearInterval(this.latido);
  }

  // ===== HABLAR =====

  async enviar(): Promise<void> {
    const texto = this.texto.trim();
    if (!texto || this.enviando()) return;
    this.enviando.set(true);
    try {
      await this.agente.escribir(texto);
      this.texto = '';
      await this.refrescar();
    } catch (fallo) {
      this.error.set(fallo instanceof Error ? fallo.message : 'No ha llegado.');
    }
    this.enviando.set(false);
  }

  /** Enter manda; Mayúsculas+Enter hace un salto de línea. */
  alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      void this.enviar();
    }
  }

  async decidir(id: string, veredicto: 'allow' | 'deny'): Promise<void> {
    try {
      await this.agente.decidir(id, veredicto);
      await this.refrescar();
    } catch (fallo) {
      // Que ya esté contestado en el terminal es lo normal, no un error.
      this.error.set(fallo instanceof Error ? fallo.message : '');
      await this.refrescar();
    }
  }

  hora(marca: number): string {
    return new Date(marca).toLocaleTimeString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
