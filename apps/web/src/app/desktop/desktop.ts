import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Type,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { I18nService } from '../services/i18n.service';
import { ThemeService } from '../services/theme.service';
import { findCommand } from '../console/commands';
import { DesktopItem, DESKTOP_ITEMS, gruposPara, ItemGroup, itemsOf } from './desktop-items';
import { AuthApiService } from '../api/auth-api.service';
import type { PublicUser } from '@devweb/shared/contracts/auth';
import { DesktopWindow } from './desktop-window/desktop-window';
import { ShellModeService } from './shell-mode.service';
import { Taskbar } from './taskbar/taskbar';
import {
  activeWindow,
  close,
  DesktopState,
  focus,
  minimize,
  move,
  newDesktop,
  open,
  refit,
  rename,
  resize,
  restore,
  toggleMaximize,
  WindowState,
} from './window-manager';

/** Lo que se carga dentro de cada ventana, solo cuando hace falta. */
const CONTENT: Record<string, (() => Promise<Type<unknown>>) | undefined> = {
  terminal: () => import('../console/console').then((m) => m.Console),
  'sobre-mi': () => import('../console/console').then((m) => m.Console),
  proyectos: () => import('../console/console').then((m) => m.Console),
  contacto: () => import('../console/console').then((m) => m.Console),
  juegos: () => import('../games/games').then((m) => m.Games),
  poker: () => import('../poker-mesa/elegir/elegir').then((m) => m.ElegirPoker),
  qr: () => import('../qr-generator/qr-generator').then((m) => m.QrGenerator),
  dni: () => import('../dni-generator/dni-generator').then((m) => m.DniGenerator),
  color: () => import('../color-picker/color-picker').then((m) => m.ColorPicker),
  regex: () => import('../regex-tester/regex-tester').then((m) => m.RegexTester),
  base64: () => import('../decoder/decoder').then((m) => m.Decoder),
  format: () => import('../formatter/formatter').then((m) => m.Formatter),
  lorem: () => import('../lorem-generator/lorem-generator').then((m) => m.LoremGenerator),
  timestamp: () =>
    import('../timestamp-converter/timestamp-converter').then((m) => m.TimestampConverter),
  uuid: () => import('../uuid-generator/uuid-generator').then((m) => m.UuidGenerator),
  iconos: () => import('../icon-generator/icon-generator').then((m) => m.IconGenerator),
};

/** Por debajo de esto no hay sitio para ventanas sueltas: se usan a pantalla completa. */
const MOBILE_MAX = 768;

/**
 * El escritorio: la puerta de entrada de la web.
 *
 * La terminal seguía estando bien para quien sabe lo que busca, pero quien
 * llegaba de nuevas no tenía forma de saber que detrás había doce
 * herramientas. Aquí se ven todas de un vistazo, se abren en ventanas y se
 * vuelve a cualquiera desde la barra de abajo.
 */
@Component({
  selector: 'app-desktop',
  imports: [CommonModule, DesktopWindow, RouterOutlet, Taskbar],
  templateUrl: './desktop.html',
  styleUrl: './desktop.css',
})
export class Desktop implements OnInit, AfterViewInit, OnDestroy {
  state: DesktopState = newDesktop(1200, 800);
  /** El componente ya cargado de cada ventana; vacío hasta que se abre. */
  loaded: Record<string, Type<unknown> | undefined> = {};
  /** El comando que la terminal de esa ventana debe ejecutar al abrirse. */
  runs: Record<string, string | undefined> = {};

  readonly items = DESKTOP_ITEMS;
  mobile = false;

  /**
   * Quién está dentro, una vez se sabe de verdad.
   *
   * Sale de `settledUser$` y no de `user$` porque este último vale null
   * mientras se comprueba la sesión guardada: con él, al recargar la página el
   * icono del panel aparecería y se iría medio segundo después.
   */
  usuario: PublicUser | null = null;
  /**
   * La ventana que hospeda la sección de la dirección, si la hay. Es la que
   * lleva dentro el `<router-outlet>`, y por eso manda sobre el contenido
   * que hubiera cargado el icono: no puede haber dos cosas en una ventana.
   */
  routeWin: string | null = null;

  /**
   * La clave de i18n del título de cada ventana, no el título ya traducido:
   * si guardáramos el texto, cambiar de idioma dejaría «Códigos QR» escrito
   * en la barra de tareas de una web que ya está en inglés.
   */
  private titleKeys: Record<string, string | undefined> = {};

  private navegacion?: Subscription;
  private idioma?: Subscription;
  private sesion?: Subscription;

  @ViewChild('area') private area?: ElementRef<HTMLElement>;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private shell: ShellModeService,
    private auth: AuthApiService,
    public i18n: I18nService,
    public themes: ThemeService,
  ) {}

  /** Si quien mira administra. Decide qué se pinta, nunca qué se puede hacer. */
  get esAdmin(): boolean {
    return this.usuario?.role === 'admin';
  }

  get groups(): { id: ItemGroup; labelKey: string }[] {
    return gruposPara(this.esAdmin);
  }

  ngOnInit(): void {
    this.shell.embedded.set(true);
    this.measure();
    this.restoreFromUrl();
    this.syncRouteWindow();
    // La sección puede cambiar sin que el escritorio se destruya: de la
    // pantalla de nombre a la mesa de poker, por ejemplo.
    this.navegacion = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncRouteWindow();
      });
    this.idioma = this.i18n.langChange$.subscribe(() => {
      this.retitle();
    });
    // Sin zone.js nadie repinta al volver la respuesta: hay que avisar.
    this.sesion = this.auth.settledUser$.subscribe((usuario) => {
      this.usuario = usuario;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  /** Abre la ventana de acceso. Es la misma pantalla de siempre. */
  entrar(): void {
    void this.router.navigate(['/auth']);
  }

  async salir(): Promise<void> {
    await this.auth.salir();
    // El panel se cierra con la sesión: dejarlo abierto enseñaría datos de
    // una sesión que ya no existe hasta que alguien lo cerrase a mano.
    if (this.state.windows.some((w) => w.id === 'admin')) this.closeWindow('admin');
    this.cdr.detectChanges();
  }

  /** Vuelve a traducir el nombre de todo lo que hay abierto. */
  private retitle(): void {
    for (const w of this.state.windows) {
      const clave = this.titleKeys[w.id];
      if (clave) this.state = rename(this.state, w.id, this.i18n.t(clave));
    }
    this.cdr.detectChanges();
  }

  /**
   * En `ngOnInit` el hueco todavía no existe, así que la primera medida sale
   * de `window`. Aquí ya está pintado y se mide de verdad: sin esto, una
   * sección abierta desde un enlace se quedaba sin llegar a los bordes.
   */
  ngAfterViewInit(): void {
    this.measure();
  }

  ngOnDestroy(): void {
    this.navegacion?.unsubscribe();
    this.idioma?.unsubscribe();
    this.sesion?.unsubscribe();
    // Al salir del escritorio las herramientas vuelven a traer su propia
    // ventana: si no, una ruta suelta se quedaría sin barra de título.
    this.shell.embedded.set(false);
  }

  // ===== LA SECCIÓN DE LA DIRECCIÓN =====

  /**
   * Abre en una ventana lo que pida la dirección, y la deja a pantalla
   * completa: quien llega por un enlace compartido viene a eso, no a mirar
   * el escritorio. Pero lo tiene detrás, con su barra, para saber dónde está
   * y poder seguir.
   */
  private syncRouteWindow(): void {
    const hijo = this.route.firstChild;
    const datos = hijo?.snapshot.data ?? {};
    const id = typeof datos['win'] === 'string' ? datos['win'] : null;

    if (this.routeWin && this.routeWin !== id) {
      this.state = close(this.state, this.routeWin);
    }
    this.routeWin = id;
    if (!id) {
      this.cdr.detectChanges();
      return;
    }

    // El título sale del icono si la sección tiene uno; si no, de la clave
    // que traiga la ruta, para que también cambie al cambiar de idioma.
    const item = DESKTOP_ITEMS.find((i) => i.id === id);
    const suya: unknown = datos['titleKey'];
    const clave = item ? item.labelKey : typeof suya === 'string' ? suya : undefined;
    this.titleKeys[id] = clave;
    const titulo = clave
      ? this.i18n.t(clave)
      : typeof datos['title'] === 'string'
        ? datos['title']
        : id;

    this.state = open(this.state, id, titulo);
    this.maximizeIfNeeded(id);
    this.cdr.detectChanges();
  }

  // ===== TAMAÑO =====

  @HostListener('window:resize')
  onResize(): void {
    this.measure();
  }

  private measure(): void {
    const caja = this.area?.nativeElement;
    const ancho = caja?.clientWidth ?? window.innerWidth;
    const alto = caja?.clientHeight ?? window.innerHeight - 44;
    this.mobile = window.innerWidth <= MOBILE_MAX;
    // Recolocar lo abierto dentro del área nueva, o al girar el móvil se
    // quedarían ventanas fuera de la pantalla y sin forma de recuperarlas.
    this.state = refit(this.state, ancho, alto);
    if (this.mobile) {
      for (const w of this.state.windows) this.maximizeIfNeeded(w.id);
    }
    this.cdr.detectChanges();
  }

  // ===== ABRIR Y CERRAR =====

  async launch(item: DesktopItem): Promise<void> {
    const titulo = this.i18n.t(item.labelKey);
    this.titleKeys[item.id] = item.labelKey;

    // Si esa ventana ya la lleva la dirección, se trae al frente y ya está:
    // montarle otro contenido dejaría dos cosas en la misma ventana.
    if (item.id === this.routeWin) {
      this.state = restore(this.state, item.id);
      this.cdr.detectChanges();
      return;
    }

    if (!this.loaded[item.id]) {
      const cargar = CONTENT[item.id];
      if (!cargar) return;
      this.loaded[item.id] = await cargar();
    }
    if (item.run) this.runs[item.id] = item.run;

    this.state = open(this.state, item.id, titulo, {
      ...(item.width ? { width: item.width } : {}),
      ...(item.height ? { height: item.height } : {}),
    });
    // En el móvil una ventana suelta no se puede ni agarrar: siempre entera.
    if (this.mobile) this.maximizeIfNeeded(item.id);
    this.syncUrl();
    this.cdr.detectChanges();
  }

  /** La deja a pantalla completa, si no lo estaba ya. */
  private maximizeIfNeeded(id: string): void {
    const w = this.state.windows.find((v) => v.id === id);
    if (w && !w.maximized) this.state = toggleMaximize(this.state, id);
  }

  closeWindow(id: string): void {
    this.state = close(this.state, id);
    // Cerrar la ventana de una sección es salir de ella: si la dirección
    // siguiera apuntando ahí, al recargar volvería a abrirse sola.
    if (id === this.routeWin) {
      this.routeWin = null;
      // Sin arrastrar lo que traía la sección -el código de la sala, por
      // ejemplo-, pero conservando las ventanas que sigan abiertas.
      const quedan = this.state.windows.map((w) => w.id);
      void this.router.navigate(['/'], {
        queryParams: { abre: quedan.length ? quedan.join(',') : null },
      });
      return;
    }
    this.syncUrl();
  }

  focusWindow(id: string): void {
    this.state = focus(this.state, id);
  }

  minimizeWindow(id: string): void {
    this.state = minimize(this.state, id);
  }

  maximizeWindow(id: string): void {
    this.state = toggleMaximize(this.state, id);
  }

  moveWindow(id: string, pos: { x: number; y: number }): void {
    this.state = move(this.state, id, pos.x, pos.y);
  }

  resizeWindow(id: string, size: { width: number; height: number }): void {
    this.state = resize(this.state, id, size.width, size.height);
  }

  /** Desde la barra: si es la de delante se aparta, y si no, se trae. */
  toggleFromTaskbar(id: string): void {
    const w = this.state.windows.find((v) => v.id === id);
    if (!w) return;
    if (w.minimized) {
      this.state = restore(this.state, id);
    } else if (this.active?.id === id) {
      this.state = minimize(this.state, id);
    } else {
      this.state = focus(this.state, id);
    }
  }

  get active(): WindowState | null {
    return activeWindow(this.state);
  }

  /** Las entradas de la consola de cada ventana, para que arranque escribiendo. */
  inputsFor(id: string): Record<string, unknown> {
    const run = this.runs[id];
    return run ? { initialCommand: run } : {};
  }

  /** Los iconos de una zona, para pintarlas por separado. */
  itemsOf(group: ItemGroup): DesktopItem[] {
    return itemsOf(group, this.esAdmin);
  }

  label(item: DesktopItem): string {
    return this.i18n.t(item.labelKey);
  }

  /** Lo que se lee al pasar por encima: la descripción larga del comando. */
  hint(item: DesktopItem): string {
    const cmd = item.command ? findCommand(item.command) : undefined;
    if (cmd) return this.i18n.t(cmd.descKey);
    return this.i18n.t(item.labelKey);
  }

  // ===== LA URL =====

  /**
   * Lo abierto se guarda en la dirección, así que se puede compartir el
   * escritorio tal y como lo tienes montado.
   */
  private syncUrl(): void {
    const abiertas = this.state.windows.filter((w) => w.id !== this.routeWin).map((w) => w.id);
    // Relativo a la sección abierta, si la hay: navegar relativo al
    // escritorio nos sacaría de ella al abrir cualquier otra ventana.
    void this.router.navigate([], {
      relativeTo: this.route.firstChild ?? this.route,
      queryParams: { abre: abiertas.length ? abiertas.join(',') : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private restoreFromUrl(): void {
    const abre = this.route.snapshot.queryParamMap.get('abre');
    if (!abre) return;
    for (const id of abre.split(',').filter(Boolean)) {
      const item = DESKTOP_ITEMS.find((i) => i.id === id);
      if (item) void this.launch(item);
    }
  }
}
