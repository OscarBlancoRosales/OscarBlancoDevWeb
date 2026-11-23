import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiError } from '../api/api-client';
import { AuthApiService } from '../api/auth-api.service';
import { PrivadoApiService } from '../api/privado-api.service';
import { I18nService } from '../services/i18n.service';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import type {
  DocumentoPrivado,
  InvitacionPrivada,
  InvitacionPrivadaVista,
} from '@devweb/shared/contracts/privado';

const CLAVE_PASE = 'devweb.pase-privado';

/**
 * Los enlaces de un documento a otro («02-til.html») no funcionan dentro de un
 * `srcdoc`: este trozo los intercepta y le pide a la página que abra el otro.
 * El documento va en un iframe sin `allow-same-origin`, así que no puede tocar
 * nada de la web: solo mandar este mensaje.
 */
const ENLACES = `<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';if(/^[^:?#]+\\.html(#.*)?$/.test(h)){e.preventDefault();parent.postMessage({privadoAbrir:h.split('#')[0]},'*');}},true);</script>`;

interface Grupo {
  readonly nombre: string;
  readonly documentos: readonly DocumentoPrivado[];
}

/**
 * Lo privado: la presentación, los documentos y las maquetas.
 *
 * Quien administra lo ve todo y puede invitar; un invitado entra con un código
 * de un solo uso y ve lo mismo durante la hora que dura. Cualquier otro ve lo
 * mismo que contesta el servidor: que aquí no hay nada.
 */
@Component({
  selector: 'app-privado',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './privado.html',
  styleUrl: './privado.css',
})
export class Privado implements OnInit, OnDestroy {
  @ViewChild('visor') visor?: ElementRef<HTMLIFrameElement>;
  @ViewChild('marco') marco?: ElementRef<HTMLElement>;

  readonly cargando = signal(true);
  readonly mando = signal(false);
  readonly pase = signal<string | null>(null);
  readonly documentos = signal<readonly DocumentoPrivado[]>([]);
  readonly abierto = signal<DocumentoPrivado | null>(null);
  readonly html = signal('');
  readonly error = signal('');
  readonly invitacion = signal<InvitacionPrivada | null>(null);
  readonly copiado = signal(false);
  readonly enlaces = signal<readonly InvitacionPrivadaVista[]>([]);
  readonly vivos = computed(() =>
    this.enlaces().filter((i) => !i.revocada && i.caduca > Date.now()),
  );
  codigo = '';

  readonly dentro = computed(() => this.mando() || this.pase() !== null);
  readonly grupos = computed<readonly Grupo[]>(() => {
    const porGrupo = new Map<string, DocumentoPrivado[]>();
    for (const d of this.documentos()) {
      porGrupo.set(d.grupo, [...(porGrupo.get(d.grupo) ?? []), d]);
    }
    return [...porGrupo].map(([nombre, documentos]) => ({ nombre, documentos }));
  });
  readonly enlace = computed(() => {
    const inv = this.invitacion();
    return inv === null ? '' : `${location.origin}/privado?codigo=${encodeURIComponent(inv.codigo)}`;
  });

  private readonly alMensaje = (evento: MessageEvent): void => {
    if (evento.source !== this.visor?.nativeElement.contentWindow) return;
    const pedido: unknown = (evento.data as { privadoAbrir?: unknown } | null)?.privadoAbrir;
    const actual = this.abierto();
    if (typeof pedido !== 'string' || actual === null) return;
    const ruta = new URL(pedido, `https://x/${actual.ruta}`).pathname.slice(1);
    const destino = this.documentos().find((d) => d.ruta === ruta);
    if (destino) void this.abrir(destino);
  };

  constructor(
    private readonly privado: PrivadoApiService,
    private readonly auth: AuthApiService,
    private readonly ruta: ActivatedRoute,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    window.addEventListener('message', this.alMensaje);
    void this.arrancar();
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.alMensaje);
  }

  async arrancar(): Promise<void> {
    await this.auth.restaurar();
    this.mando.set(this.auth.usuario?.role === 'admin');
    this.pase.set(this.paseGuardado());
    const codigo = this.ruta.snapshot.queryParamMap.get('codigo');
    if (!this.mando() && codigo) {
      this.codigo = codigo;
      await this.canjear();
    } else if (this.dentro()) {
      await this.cargarLista();
    }
    if (this.mando()) await this.intentar(() => this.cargarEnlaces());
    this.cargando.set(false);
  }

  async canjear(): Promise<void> {
    await this.intentar(async () => {
      const { pase, caduca } = await this.privado.canjear(this.codigo.trim());
      this.guardarPase(pase, caduca);
      this.pase.set(pase);
      await this.cargarLista();
    });
  }

  async abrir(documento: DocumentoPrivado): Promise<void> {
    await this.intentar(async () => {
      const html = await this.privado.documento(documento.ruta, this.paseParaPedir());
      this.abierto.set(documento);
      this.html.set(html + ENLACES);
    });
  }

  /** Sin argumentos, para una persona y una hora; con ellos, un enlace que comparten varios. */
  async invitar(grupo?: { dias: number; nota: string }): Promise<void> {
    await this.intentar(async () => {
      this.copiado.set(false);
      this.invitacion.set(await this.privado.invitar(grupo));
      await this.cargarEnlaces();
    });
  }

  async revocar(id: string): Promise<void> {
    await this.intentar(async () => {
      await this.privado.revocar(id);
      if (this.invitacion()?.id === id) this.invitacion.set(null);
      await this.cargarEnlaces();
    });
  }

  private async cargarEnlaces(): Promise<void> {
    this.enlaces.set(await this.privado.invitaciones());
  }

  async copiar(): Promise<void> {
    await navigator.clipboard.writeText(this.enlace());
    this.copiado.set(true);
  }

  pantallaCompleta(): void {
    void this.marco?.nativeElement.requestFullscreen();
  }

  dia(ms: number): string {
    return new Date(ms).toLocaleString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  hora(ms: number): string {
    return new Date(ms).toLocaleTimeString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async cargarLista(): Promise<void> {
    await this.intentar(async () => {
      const lista = await this.privado.lista(this.paseParaPedir());
      this.documentos.set(lista);
      const [primero] = lista;
      if (this.abierto() === null && lista.length > 0) await this.abrir(primero);
    });
  }

  /** Quien administra va con su sesión; el pase solo cuando no la hay. */
  private paseParaPedir(): string | null {
    return this.mando() ? null : this.pase();
  }

  private paseGuardado(): string | null {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(CLAVE_PASE) ?? 'null') as {
        pase: string;
        caduca: number;
      } | null;
      return guardado !== null && guardado.caduca > Date.now() ? guardado.pase : null;
    } catch {
      return null;
    }
  }

  // En la sesión de la pestaña y no más: recargar no gasta el código, pero
  // cerrar la pestaña lo olvida, y el servidor lo deja de aceptar a la hora igual.
  private guardarPase(pase: string, caduca: number): void {
    try {
      sessionStorage.setItem(CLAVE_PASE, JSON.stringify({ pase, caduca }));
    } catch {
      // Sin almacenamiento, el pase vive mientras la página esté abierta.
    }
  }

  private async intentar(accion: () => Promise<void>): Promise<void> {
    this.error.set('');
    try {
      await accion();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && this.pase() !== null) {
        this.pase.set(null);
        sessionStorage.removeItem(CLAVE_PASE);
      }
      this.error.set(e instanceof ApiError ? e.message : this.i18n.t('privado.error'));
    }
  }
}
