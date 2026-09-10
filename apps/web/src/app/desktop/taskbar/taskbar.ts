import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { I18nService, Lang } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { DesktopItem, searchItems } from '../desktop-items';
import type { PublicUser } from '@devweb/shared/contracts/auth';
import { WindowState } from '../window-manager';

/**
 * La barra de tareas: inicio, buscador, lo que hay abierto y la bandeja.
 *
 * Es la pieza que hace que la web se entienda sin leer instrucciones: aunque
 * tengas una herramienta a pantalla completa, desde aquí se ve qué más hay, se
 * busca por nombre y se cambia el idioma o el color sin saber ningún comando.
 */
@Component({
  selector: 'app-taskbar',
  templateUrl: './taskbar.html',
  styleUrl: './taskbar.css',
})
export class Taskbar implements OnInit, OnDestroy {
  @Input() windows: WindowState[] = [];
  @Input() activeId: string | null = null;
  /** Quién está dentro, para el pie del menú. Null si no hay sesión. */
  @Input() usuario: PublicUser | null = null;

  @Output() launch = new EventEmitter<DesktopItem>();
  /** Tocar el botón de una ventana: la trae al frente o la minimiza. */
  @Output() toggled = new EventEmitter<string>();
  @Output() entrar = new EventEmitter<void>();
  @Output() salir = new EventEmitter<void>();

  menuOpen = false;
  query = '';
  clock = signal('');
  today = signal('');

  @ViewChild('search') private search?: ElementRef<HTMLInputElement>;

  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  constructor(
    public i18n: I18nService,
    public themes: ThemeService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.tick();
    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
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
    this.today.set(`${dd(ahora.getDate())}/${dd(ahora.getMonth() + 1)}/${ahora.getFullYear()}`);
  }

  /** Si quien mira administra: decide qué se le ofrece, no qué puede hacer. */
  get esAdmin(): boolean {
    return this.usuario?.role === 'admin';
  }

  /** Lo que se ofrece: todo, o lo que casa con lo que estás buscando. */
  get results(): DesktopItem[] {
    return searchItems(this.query, (clave) => this.i18n.t(clave), this.esAdmin);
  }

  /**
   * El pie del menú es donde vive la sesión, como en cualquier escritorio.
   *
   * Sin sesión invita a entrar; con ella enseña de quién es y ofrece salir. No
   * hay icono en el fondo a propósito: quien pasa por la web no tiene por qué
   * ver una puerta que no le sirve.
   */
  entrarEnLaCuenta(): void {
    this.closeMenu();
    this.entrar.emit();
  }

  salirDeLaCuenta(): void {
    this.closeMenu();
    this.salir.emit();
  }

  openMenu(): void {
    this.menuOpen = true;
    this.query = '';
    this.cdr.detectChanges();
    this.search?.nativeElement.focus();
  }

  toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.query = '';
  }

  open(item: DesktopItem): void {
    this.closeMenu();
    this.launch.emit(item);
  }

  /** Enter abre lo primero de la lista, como en cualquier buscador. */
  onSearchKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const encontrados = this.results;
      if (encontrados.length) this.open(encontrados[0]);
    }
  }

  onSearchInput(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
  }

  /** Rueda de temas desde la barra, sin tener que saber el comando. */
  nextTheme(): void {
    const lista = this.themes.listed();
    const i = lista.indexOf(this.themes.current);
    this.themes.set(lista[(i + 1) % lista.length]);
    this.cdr.detectChanges();
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
    this.cdr.detectChanges();
  }

  label(item: DesktopItem): string {
    return this.i18n.t(item.labelKey);
  }
}
