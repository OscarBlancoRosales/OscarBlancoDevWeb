import { Component, Input } from '@angular/core';

/** Cómo está un concursante en su puesto, ya decidido antes de la plantilla. */
export interface PuestoEnAtril {
  readonly seatId: string;
  readonly nombre: string;
  readonly foto: string;
  readonly puntos: number;
  readonly eresTu: boolean;
  /** Ya ha contestado. Nunca qué: eso no sale del servidor con la ronda abierta. */
  readonly haContestado: boolean;
  /** Lo que ganó en la ronda cerrada. `null` mientras sigue abierta. */
  readonly gano: number | null;
  readonly tieneLaBomba: boolean;
  readonly lidera: boolean;
  /** Ya ha puesto su apuesta en la final. Nunca cuánto. */
  readonly haApostado: boolean;
}

/**
 * La fila de concursantes, cada uno en su atril.
 *
 * Es la diferencia entre un marcador y un concurso: en una lista de nombres no
 * se ve a nadie ponerse nervioso. Aquí el atril se enciende al contestar, se
 * pone verde al acertar, se apaga al fallar y tiembla cuando te toca la bomba,
 * que es exactamente lo que hace que mires a los demás en vez de solo a tu
 * turno.
 */
@Component({
  selector: 'app-atriles',
  imports: [],
  templateUrl: './atriles.html',
  styleUrl: './atriles.css',
})
export class Atriles {
  @Input() puestos: readonly PuestoEnAtril[] = [];

  /** Lo ganado con su signo delante, que es como se lee un marcador. */
  conSigno(gano: number): string {
    return gano > 0 ? `+${gano}` : String(gano);
  }
}
