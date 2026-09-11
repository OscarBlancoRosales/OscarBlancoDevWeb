import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * El mando de la apuesta de la final.
 *
 * De cero a lo que lleves, con atajos para plantarse, jugarse la mitad o ir a
 * por todas. Enseña cuántos han apostado ya y **nunca cuánto**: eso no sale del
 * servidor hasta que la fase se cierra.
 */
@Component({
  selector: 'app-apuesta',
  imports: [FormsModule],
  templateUrl: './apuesta.html',
  styleUrl: './apuesta.css',
})
export class MandoDeApuesta {
  @Input() tienes = 0;
  @Input() tuApuesta: number | null = null;
  @Input() hanApostado = 0;
  @Input() sonPersonas = 0;

  @Output() readonly apuesta = new EventEmitter<number>();

  /** Lo que hay puesto en el deslizador ahora mismo. */
  cuanto = 0;

  /** Un atajo: nada, la mitad o todo. Apostar es una decisión, no un trámite. */
  pon(parte: number): void {
    this.cuanto = Math.floor(this.tienes * parte);
  }

  apostar(): void {
    this.apuesta.emit(Math.min(Math.max(0, Math.floor(this.cuanto)), this.tienes));
  }
}
