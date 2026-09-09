import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { Theme, ThemeService } from '../../services/theme.service';
import { DesktopItem, startMenuItems } from '../desktop-items';
import { WindowState } from '../window-manager';

/**
 * La barra de tareas: el menú de inicio, lo que hay abierto y el reloj.
 *
 * Es la pieza que hace que la web se entienda sin leer instrucciones: aunque
 * tengas una herramienta a pantalla completa, desde aquí se ve qué más hay y
 * se vuelve a cualquier sitio.
 */
@Component({
  selector: 'app-taskbar',
  templateUrl: './taskbar.html',
  styleUrl: './taskbar.css',
})
export class Taskbar implements OnInit, OnDestroy {
  @Input() windows: WindowState[] = [];
  @Input() activeId: string | null = null;

  @Output() launch = new EventEmitter<DesktopItem>();
  /** Tocar el botón de una ventana: la trae al frente o la minimiza. */
  @Output() toggled = new EventEmitter<string>();

  menuOpen = false;
  clock = signal('');

  readonly items = startMenuItems();

  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  constructor(
    public i18n: I18nService,
    public themes: ThemeService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
  }

  private tick(): void {
    if (this.destroyed) return;
    const ahora = new Date();
    const dd = (n: number) => String(n).padStart(2, '0');
    this.clock.set(`${dd(ahora.getHours())}:${dd(ahora.getMinutes())}`);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  open(item: DesktopItem): void {
    this.menuOpen = false;
    this.launch.emit(item);
  }

  /** Rueda de temas desde la barra, sin tener que saber el comando. */
  nextTheme(): void {
    const lista = this.themes.listed();
    const i = lista.indexOf(this.themes.current);
    this.themes.set(lista[(i + 1) % lista.length] as Theme);
    this.cdr.detectChanges();
  }

  label(item: DesktopItem): string {
    return this.i18n.t(item.labelKey);
  }
}
