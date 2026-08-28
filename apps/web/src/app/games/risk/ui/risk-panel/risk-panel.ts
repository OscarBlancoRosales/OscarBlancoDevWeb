import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Concha de un panel flotante sobre el mapa.
 *
 * No sabe qué lleva dentro: pone el marco, el título, el aspa y el fondo
 * oscurecido, y avisa cuando hay que cerrar. Así el chat, las cartas y la
 * historia comparten comportamiento sin repetirlo tres veces.
 */
@Component({
  selector: 'app-risk-panel',
  imports: [CommonModule],
  templateUrl: './risk-panel.html',
  styleUrl: './risk-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskPanel {
  @Input({ required: true }) title = '';
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
}
