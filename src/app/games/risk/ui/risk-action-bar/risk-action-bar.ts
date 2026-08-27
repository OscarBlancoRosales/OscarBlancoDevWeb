import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PanelId = 'chat' | 'cartas' | 'historia' | 'ia';

/**
 * Barra de abajo: lo que puedes hacer ahora mismo y cómo abrir los paneles.
 *
 * De presentación pura: no sabe reglas ni habla con la sala. Recibe lo que hay
 * que enseñar y avisa de lo que ha pulsado el jugador.
 *
 * Sólo ofrece tres paneles. Los ajustes de IA se abren desde el engranaje de la
 * barra de arriba, porque se tocan una vez y no cada turno.
 */
@Component({
  selector: 'app-risk-action-bar',
  imports: [CommonModule],
  templateUrl: './risk-action-bar.html',
  styleUrl: './risk-action-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskActionBar {
  @Input() phase = '';
  @Input() phaseLabel = '';
  @Input() myTurn = false;
  @Input() reserveLeft = 0;
  @Input() placedCount = 0;
  @Input() canEndPhase = false;
  @Input() openPanel: PanelId | null = null;
  @Input() cardCount = 0;

  @Output() togglePanel = new EventEmitter<PanelId>();
  @Output() undo = new EventEmitter<boolean>();
  @Output() endPhase = new EventEmitter<void>();
}
