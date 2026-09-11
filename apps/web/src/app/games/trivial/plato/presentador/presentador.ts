import { Component, Input } from '@angular/core';
import { fotoDelPresentador, gestoDe } from '@devweb/shared/games/trivial/reparto';

/**
 * El presentador, con su cara y su bocadillo.
 *
 * Lo que dice y la cara que pone los manda el servidor, así que los cinco de la
 * mesa leen lo mismo a la vez. El gesto sale del momento del programa y no de
 * la frase: un presentador que pone la misma cara felicitándote que viéndote
 * estallar la bomba no está presentando nada.
 */
@Component({
  selector: 'app-presentador',
  imports: [],
  templateUrl: './presentador.html',
  styleUrl: './presentador.css',
})
export class PresentadorEnPlato {
  @Input() dice = '';
  @Input() momento = '';

  get cara(): string {
    return fotoDelPresentador(gestoDe(this.momento));
  }

  /** Para que el bocadillo se reinicie -y se note- cada vez que cambia. */
  get turnoDePalabra(): string {
    return `${this.momento}:${this.dice.length}`;
  }
}
