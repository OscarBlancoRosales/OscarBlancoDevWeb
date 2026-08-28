import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ScoreRow {
  id: string;
  name: string;
  color: string;
  territories: number;
  armies: number;
  eliminated: boolean;
}

/**
 * Marcador compacto, siempre encima del mapa.
 *
 * No es un panel a propósito: saber quién va ganando es información de un
 * vistazo, no algo que uno vaya a abrir y cerrar cada turno. Por eso está fijo
 * y, si estorba, se pliega a sólo colores en vez de desaparecer.
 */
@Component({
  selector: 'app-risk-scoreboard',
  imports: [CommonModule],
  templateUrl: './risk-scoreboard.html',
  styleUrl: './risk-scoreboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskScoreboard {
  @Input({ required: true }) rows: readonly ScoreRow[] = [];
  @Input() currentId = '';

  collapsed = false;

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  trackRow = (_: number, row: ScoreRow) => row.id;
}
