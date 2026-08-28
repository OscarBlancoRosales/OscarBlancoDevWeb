import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommandDef, visibleCommands } from '../../console/commands';
import { I18nService } from '../../services/i18n.service';

/**
 * La paleta de comandos, la misma en la portada y en cada herramienta.
 *
 * Vive aquí y no en la consola porque el objetivo es que desde cualquier
 * pantalla puedas saltar a cualquier otra sin volver atrás primero.
 */
@Component({
  selector: 'app-command-palette',
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.css',
})
export class CommandPalette {
  @Input() open = false;
  /** Se cierra sola: quien la abre decide qué hacer con eso. */
  @Output() closed = new EventEmitter<void>();
  /** El id del comando elegido. Quien escucha decide si navega o lo ejecuta. */
  @Output() picked = new EventEmitter<string>();

  query = '';

  @ViewChild('paletteInput') private box?: ElementRef<HTMLInputElement>;

  constructor(
    public i18n: I18nService,
    private cdr: ChangeDetectorRef,
  ) {}

  get results(): CommandDef[] {
    const q = this.query.trim().toLowerCase();
    const todos = visibleCommands();
    if (!q) return todos;
    const coincide = (cmd: CommandDef) =>
      [cmd.id, ...cmd.aliases, this.i18n.t(cmd.descKey).toLowerCase()].some((texto) =>
        texto.includes(q),
      );
    return todos
      .filter(coincide)
      .sort((a, b) => Number(b.id.startsWith(q)) - Number(a.id.startsWith(q)));
  }

  /**
   * El atributo autofocus solo vale al cargar la página, y esta caja nace
   * después: hay que pintarla y enfocarla a mano.
   */
  focus(): void {
    this.query = '';
    this.cdr.detectChanges();
    this.box?.nativeElement.focus();
  }

  close(): void {
    this.query = '';
    this.closed.emit();
  }

  choose(id: string): void {
    this.picked.emit(id);
    this.close();
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const primero = this.results[0];
      if (primero) this.choose(primero.id);
    }
  }

  describe(cmd: CommandDef): string {
    return this.i18n.t(cmd.descKey);
  }
}
