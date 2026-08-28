import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Bloque de fase: en qué punto va la partida, y el control que la cierra.
 *
 * No es una barra. Vive en la esquina de arriba a la izquierda y ocupa lo que
 * ocupan tres líneas de texto, porque el centro de la pantalla es del mapa y
 * cualquier cosa que lo cruce de lado a lado le quita sitio siempre.
 *
 * Y la fase es también el botón que la termina: lo que te dice dónde estás es
 * lo que te saca de ahí. Es lo que permite que no exista una botonera fija en
 * ningún borde.
 */
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
  /**
   * Quién está pensando ahora mismo, si hay alguien.
   *
   * Vivía en el banner de turno de la columna que se ha eliminado. Sin esto, un
   * bot que tarda parece una partida colgada.
   */
  @Input() thinking = '';
  /** Tropas por colocar. Sólo existe mientras quede alguna. */
  @Input() reserveLeft = 0;
  /** En cuántos territorios has puesto algo esta fase. */
  @Input() placedCount = 0;
  @Input() canEndPhase = false;

  @Output() leave = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();
  @Output() endPhase = new EventEmitter<void>();
  @Output() resetPlacements = new EventEmitter<void>();
}
