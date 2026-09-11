import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenteApiService } from '../../api/agente-api.service';
import { I18nService } from '../../services/i18n.service';
import type { Conversacion } from '../../api/agente-api.service';

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

  texto = '';
  codigo = '';
  nombre = '';

  private latido?: ReturnType<typeof setInterval>;

  constructor(
    private readonly agente: AgenteApiService,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    void this.arrancar();
  }

  ngOnDestroy(): void {
    if (this.latido) clearInterval(this.latido);
  }

  async arrancar(): Promise<void> {
    this.cargando.set(true);
    const estado = await this.agente.estado();
    this.hayCanal.set(estado.canal);
    this.emparejado.set(this.agente.emparejado);
    if (this.hayCanal() && this.emparejado()) await this.refrescar();
    this.cargando.set(false);
    this.vigilar();
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
