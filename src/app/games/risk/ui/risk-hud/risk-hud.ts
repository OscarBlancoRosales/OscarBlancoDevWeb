import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Barra de arriba: en qué punto va la partida, y cómo salir o ajustar. */
@Component({
  selector: 'app-risk-hud',
  imports: [CommonModule],
  templateUrl: './risk-hud.html',
  styleUrl: './risk-hud.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskHud {
  @Input() roundLabel = '';
  @Input() phaseLabel = '';
  @Input() turnLabel = '';
  @Input() myTurn = false;
  @Output() leave = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();
}
