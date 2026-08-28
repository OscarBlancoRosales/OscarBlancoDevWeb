import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';
import { formatUuid, makeUuid, UuidVersion } from './uuid';

@Component({
  selector: 'app-uuid-generator',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './uuid-generator.html',
  styleUrl: './uuid-generator.css',
})
export class UuidGenerator implements OnInit {
  uuids: string[] = [];
  amount = 5;
  version: UuidVersion = 'v4';
  uppercase = false;
  noDashes = false;
  braces = false;
  copied = false;
  copiedIndex = -1;

  constructor(
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    this.generate();
  }

  generate(): void {
    const cuantos = Math.max(1, Math.min(100, Number(this.amount) || 1));
    this.uuids = Array.from({ length: cuantos }, () =>
      formatUuid(makeUuid(this.version), {
        uppercase: this.uppercase,
        noDashes: this.noDashes,
        braces: this.braces,
      }),
    );
    this.copiedIndex = -1;
    this.copied = false;
  }

  /** Cambiar cualquier opción regenera: esperar a pulsar un botón sobra. */
  setVersion(version: UuidVersion): void {
    this.version = version;
    this.generate();
  }

  async copySingle(uuid: string, index: number): Promise<void> {
    if (!(await this.toClipboard(uuid))) return;
    this.copiedIndex = index;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.copiedIndex = -1;
      this.cdr.detectChanges();
    }, 1400);
  }

  async copyAll(): Promise<void> {
    if (!this.uuids.length) return;
    if (!(await this.toClipboard(this.uuids.join('\n')))) return;
    this.copied = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.copied = false;
      this.cdr.detectChanges();
    }, 1400);
  }

  private async toClipboard(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer, pero tampoco pasa
      // nada: el valor sigue en pantalla para copiarlo a mano.
      return false;
    }
  }
}
