import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';
import { DocKind, makeDocument } from './dni';

@Component({
  selector: 'app-dni-generator',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './dni-generator.html',
  styleUrl: './dni-generator.css',
})
export class DniGenerator implements OnInit {
  items: string[] = [];
  kind: DocKind = 'dni';
  amount = 5;
  copiedAll = false;
  copiedIndex = -1;

  constructor(
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    this.generate();
  }

  generate(): void {
    const cuantos = Math.max(1, Math.min(50, Number(this.amount) || 1));
    this.items = Array.from({ length: cuantos }, () => makeDocument(this.kind));
    this.copiedIndex = -1;
    this.copiedAll = false;
  }

  setKind(kind: DocKind): void {
    this.kind = kind;
    this.generate();
  }

  async copyOne(valor: string, index: number): Promise<void> {
    if (!(await this.toClipboard(valor))) return;
    this.copiedIndex = index;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.copiedIndex = -1;
      this.cdr.detectChanges();
    }, 1400);
  }

  async copyAll(): Promise<void> {
    if (!this.items.length) return;
    if (!(await this.toClipboard(this.items.join('\n')))) return;
    this.copiedAll = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.copiedAll = false;
      this.cdr.detectChanges();
    }, 1400);
  }

  private async toClipboard(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Sin permiso de portapapeles el valor sigue en pantalla: no es grave.
      return false;
    }
  }
}
