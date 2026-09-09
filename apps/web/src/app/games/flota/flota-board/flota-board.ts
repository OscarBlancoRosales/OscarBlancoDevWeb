import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LADO } from '@devweb/shared/games/flota/tipos';
import { celdasDe, indice } from '@devweb/shared/games/flota/reglas';
import type { Barco, Casilla } from '@devweb/shared/games/flota/tipos';

/** Lo que se pinta en una casilla, ya decidido antes de llegar a la plantilla. */
export interface CeldaPintada {
  readonly pos: number;
  readonly fila: number;
  readonly columna: number;
  readonly estado: Casilla | null;
  readonly conBarco: boolean;
  readonly pulsable: boolean;
}

const LETRAS = 'ABCDEFGHIJ'.split('');

/**
 * Una rejilla de diez por diez.
 *
 * La misma para los dos tableros de la partida: el tuyo enseña tus barcos y los
 * impactos recibidos, y el del rival, solo dónde has disparado. La diferencia
 * está entera en lo que se le pasa, no en lo que hace.
 */
@Component({
  selector: 'app-flota-board',
  imports: [CommonModule],
  templateUrl: './flota-board.html',
  styleUrl: './flota-board.css',
})
export class FlotaBoard {
  /** Qué ha caído en cada casilla. `null` es «aquí no ha disparado nadie». */
  @Input() casillas: readonly (Casilla | null)[] = [];

  /** Los barcos que se ven. En el tablero del rival, ninguno hasta el final. */
  @Input() barcos: readonly Barco[] = [];

  /** Si se puede disparar aquí. El tablero propio nunca lo es. */
  @Input() activo = false;

  @Input() titulo = '';

  @Output() readonly disparo = new EventEmitter<{ fila: number; columna: number }>();

  readonly letras = LETRAS;
  readonly numeros = Array.from({ length: LADO }, (_, i) => i + 1);

  get filas(): CeldaPintada[][] {
    const conBarco = new Set(
      this.barcos.flatMap((barco) =>
        celdasDe(barco).map((celda) => indice(celda.fila, celda.columna)),
      ),
    );

    return Array.from({ length: LADO }, (_, fila) =>
      Array.from({ length: LADO }, (_, columna) => {
        const pos = indice(fila, columna);
        const estado = this.casillas[pos] ?? null;
        return {
          pos,
          fila,
          columna,
          estado,
          conBarco: conBarco.has(pos),
          // Repetir un disparo es una jugada ilegal, así que la casilla ya
          // gastada deja de responder aquí en vez de ir a por un rechazo.
          pulsable: this.activo && estado === null,
        };
      }),
    );
  }

  pulsar(celda: CeldaPintada): void {
    if (!celda.pulsable) return;
    this.disparo.emit({ fila: celda.fila, columna: celda.columna });
  }
}
