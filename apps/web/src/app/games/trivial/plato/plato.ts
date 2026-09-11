import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * El escenario: fondo, focos y suelo.
 *
 * Sale del marco de terminal del resto del sitio y ocupa la pantalla entera. No
 * es capricho: un plató es lo contrario de una terminal -focos, color,
 * profundidad- y meterlo dentro de una cabecera verde le quita justo el sitio y
 * el aire que necesita para impresionar.
 *
 * No sabe nada del juego. Pone el decorado y el botón de silencio; lo que va
 * encima lo decide el director.
 */
@Component({
  selector: 'app-plato',
  imports: [],
  templateUrl: './plato.html',
  styleUrl: './plato.css',
})
export class Plato {
  @Input() callado = true;
  /** Lo que se lee arriba a la izquierda: «Ronda 7 de 21», o lo que toque. */
  @Input() rotulo = '';

  @Output() readonly alterna = new EventEmitter<void>();
  @Output() readonly sale = new EventEmitter<void>();
}
