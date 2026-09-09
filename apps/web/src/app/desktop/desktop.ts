import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Type,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from '../services/i18n.service';
import { ThemeService } from '../services/theme.service';
import { findCommand } from '../console/commands';
import { DesktopItem, DESKTOP_ITEMS } from './desktop-items';
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
  resize,
  restore,
  toggleMaximize,
  WindowState,
} from './window-manager';

/** Lo que se carga dentro de cada ventana, solo cuando hace falta. */
const CONTENT: Record<string, () => Promise<Type<unknown>>> = {
  terminal: () => import('../console/console').then((m) => m.Console),
  'sobre-mi': () => import('../console/console').then((m) => m.Console),
  proyectos: () => import('../console/console').then((m) => m.Console),
  contacto: () => import('../console/console').then((m) => m.Console),
  juegos: () => import('../games/games').then((m) => m.Games),
  poker: () => import('../auth/auth').then((m) => m.Auth),
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
  imports: [CommonModule, DesktopWindow, Taskbar],
  templateUrl: './desktop.html',
  styleUrl: './desktop.css',
})
export class Desktop implements OnInit, OnDestroy {
  state: DesktopState = newDesktop(1200, 800);
  /** El componente ya cargado de cada ventana. */
  loaded: Record<string, Type<unknown>> = {};
  /** El comando que la terminal de esa ventana debe ejecutar al abrirse. */
  runs: Record<string, string> = {};

  readonly items = DESKTOP_ITEMS;
  mobile = false;
  /** El cartel de bienvenida se puede quitar, y no vuelve a molestar. */
  showWelcome = true;

  @ViewChild('area') private area?: ElementRef<HTMLElement>;

  private readonly WELCOME_KEY = 'desk_welcome_off';

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private shell: ShellModeService,
    public i18n: I18nService,
    public themes: ThemeService,
  ) {}

  ngOnInit(): void {
    this.shell.embedded.set(true);
    this.showWelcome = !this.readFlag(this.WELCOME_KEY);
    this.measure();
    this.restoreFromUrl();
  }

  ngOnDestroy(): void {
    // Al salir del escritorio las herramientas vuelven a traer su propia
    // ventana: si no, una ruta suelta se quedaría sin barra de título.
    this.shell.embedded.set(false);
  }

  // ===== TAMAÑO =====

  @HostListener('window:resize')
  onResize(): void {
    this.measure();
  }

  private measure(): void {
    const caja = this.area?.nativeElement;
    const ancho = caja?.clientWidth || window.innerWidth;
    const alto = caja?.clientHeight || window.innerHeight - 44;
    this.mobile = window.innerWidth <= MOBILE_MAX;
    this.state = { ...this.state, area: { width: ancho, height: alto } };
    // Recolocar lo abierto dentro del área nueva, o al girar el móvil se
    // quedarían ventanas fuera de la pantalla y sin forma de recuperarlas.
    for (const w of this.state.windows) {
      this.state = resize(this.state, w.id, this.mobile ? ancho : w.width, this.mobile ? alto : w.height);
      if (this.mobile && !w.maximized) this.state = toggleMaximize(this.state, w.id);
    }
    this.cdr.detectChanges();
  }

  // ===== ABRIR Y CERRAR =====

  async launch(item: DesktopItem): Promise<void> {
    const titulo = this.i18n.t(item.labelKey);

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
    if (this.mobile) {
      const w = this.state.windows.find((v) => v.id === item.id);
      if (w && !w.maximized) this.state = toggleMaximize(this.state, item.id);
    }
    this.syncUrl();
    this.cdr.detectChanges();
  }

  closeWindow(id: string): void {
    this.state = close(this.state, id);
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

  dismissWelcome(): void {
    this.showWelcome = false;
    try {
      localStorage.setItem(this.WELCOME_KEY, '1');
    } catch {
      // Si no hay almacenamiento, el cartel volverá. No es grave.
    }
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
    const abiertas = this.state.windows.map((w) => w.id);
    this.router.navigate([], {
      relativeTo: this.route,
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

  private readFlag(clave: string): boolean {
    try {
      return localStorage.getItem(clave) === '1';
    } catch {
      return false;
    }
  }
}
