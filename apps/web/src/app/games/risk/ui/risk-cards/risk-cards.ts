import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Una carta ya en palabras, para no meter reglas en una pieza de dibujo. */
export interface CardView {
  id: string;
  icon: string;
  label: string;
  territory: string;
}

/**
 * Las cartas, en la esquina de abajo a la derecha.
 *
 * Plegadas son un abanico diminuto con la cuenta encima. No hay ningún botón
 * en ninguna barra que las abra: se abren tocando las cartas, que es donde uno
 * mira cuando piensa en sus cartas.
 *
 * De presentación pura: no sabe qué trío es válido, se lo dicen.
 */
@Component({
  selector: 'app-risk-cards',
  imports: [CommonModule],
  templateUrl: './risk-cards.html',
  styleUrl: './risk-cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskCards {
  @Input() cards: readonly CardView[] = [];
  @Input() selected: readonly string[] = [];
  @Input() open = false;
  /** Tienes tantas que el reglamento te obliga a canjear antes de seguir. */
  @Input() mustTrade = false;
  /** El trío elegido vale y estamos en el momento de canjearlo. */
  @Input() canTrade = false;

  @Output() toggle = new EventEmitter<void>();
  @Output() pick = new EventEmitter<string>();
  @Output() trade = new EventEmitter<void>();

  isPicked(id: string): boolean {
    return this.selected.includes(id);
  }

  /**
   * Las tres primeras del montón, para el abanico plegado.
   *
   * Dibujar catorce cartas superpuestas en una esquina no dice nada más que
   * dibujar tres, y la cuenta exacta ya va en el número.
   */
  get fan(): readonly CardView[] {
    return this.cards.slice(0, 3);
  }

  trackCard = (_: number, card: CardView) => card.id;
}
