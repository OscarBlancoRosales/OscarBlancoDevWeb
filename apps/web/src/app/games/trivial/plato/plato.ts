import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Escenario3d } from './escenario3d/escenario3d';
import type { Cuadro } from './escenario3d/escenario';

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
  imports: [Escenario3d],
  templateUrl: './plato.html',
  styleUrl: './plato.css',
})
export class Plato {
  @Input() callado = true;

  /** Lo que hay que enseñar en el escenario 3D, si es que se puede pintar. */
  @Input() cuadro: Cuadro = {
    puestos: [],
    tono: '250 204 21',
    golpe: null,
    mirandoA: null,
    sacude: false,
  };

  /**
   * Si el plató está temblando.
   *
   * Va aparte del cuadro porque esto lo pinta el CSS: la cámara 3D ya se
   * sacude por su cuenta, pero quien no tiene WebGL también tiene derecho a
   * enterarse de que acaba de explotar una bomba.
   */
  @Input() sacude = false;
  /** Lo que se lee arriba a la izquierda: «Ronda 7 de 21», o lo que toque. */
  @Input() rotulo = '';

  @Output() readonly alterna = new EventEmitter<void>();
  @Output() readonly sale = new EventEmitter<void>();
}
