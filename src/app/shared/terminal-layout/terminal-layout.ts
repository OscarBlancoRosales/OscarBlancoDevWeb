import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { findCommand, navCommands } from '../../console/commands';
import { CommandPalette } from '../command-palette/command-palette';

/**
 * La ventana que envuelve todas las herramientas.
 *
 * Es la misma que la portada -mismo chrome, mismo menú, mismo reloj- para que
 * el sitio se sienta como una sola terminal y no como doce páginas sueltas.
 * El menú sale del registro de comandos, así que una sección nueva aparece
 * aquí sola.
 */
@Component({
  selector: 'app-terminal-layout',
  imports: [CommandPalette],
  templateUrl: './terminal-layout.html',
  styleUrl: './terminal-layout.css',
})
export class TerminalLayout implements OnInit, AfterViewInit, OnDestroy {
  /** Lo que se lee en la barra de título, después de «OBR Terminal». */
  @Input() title = '';
  @Input() showStatusBar = true;

  menuOpen = false;
  paletteOpen = false;
  clock = signal('');

  readonly menuItems = navCommands();

  @ViewChild(CommandPalette) private palette?: CommandPalette;

  private clockTimer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
    public themes: ThemeService,
  ) {}

  ngOnInit(): void {
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 1000);
  }

  ngAfterViewInit(): void {
    // El tema ya está puesto en el <html>; aquí solo hay que repintar por si
    // la herramienta se cargó antes de que el servicio arrancara.
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private tick(): void {
    if (this.destroyed) return;
    const now = new Date();
    const dd = (n: number) => String(n).padStart(2, '0');
    this.clock.set(`${dd(now.getHours())}:${dd(now.getMinutes())}:${dd(now.getSeconds())}`);
  }

  /** Ctrl+K abre la paleta desde cualquier herramienta, como en la portada. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openPalette();
    }
  }

  openPalette(): void {
    this.paletteOpen = true;
    this.cdr.detectChanges();
    this.palette?.focus();
  }

  closePalette(): void {
    this.paletteOpen = false;
  }

  /** Desde una herramienta, elegir en la paleta es viajar. */
  onPick(id: string): void {
    this.paletteOpen = false;
    const cmd = findCommand(id);
    if (cmd?.route) {
      this.router.navigate([cmd.route]);
      return;
    }
    // Lo que no es una sección (help, whoami...) se atiende en la terminal.
    this.router.navigate(['/']);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenuIfOpen(): void {
    if (this.menuOpen) this.menuOpen = false;
  }

  navigate(path: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate([path]);
  }

  /** Volver a la terminal es salir de la herramienta, no cerrar nada. */
  goHome(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/']);
  }
}
