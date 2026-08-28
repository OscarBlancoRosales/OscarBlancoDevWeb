import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PanelId = 'chat' | 'cartas' | 'historia' | 'ia';

/**
 * Barra de abajo: lo que puedes hacer ahora mismo y cómo abrir los paneles.
 *
 * De presentación pura: no sabe reglas ni habla con la sala. Recibe lo que hay
 * que enseñar y avisa de lo que ha pulsado el jugador.
 *
 * Sólo ofrece tres paneles. Los ajustes de IA se abren desde el engranaje del
 * bloque de fase, porque se tocan una vez y no cada turno.
 *
 * Pieza en retirada: la reserva y el «terminar fase» ya viven en el bloque de
 * fase. Lo que queda desaparecerá cuando el deshacer pase al paso que sale
 * junto al territorio y las cartas y el chat tengan su esquina.
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
  @Input() myTurn = false;
  @Input() placedCount = 0;
  @Input() openPanel: PanelId | null = null;

  @Output() togglePanel = new EventEmitter<PanelId>();
  @Output() undo = new EventEmitter<void>();
}
