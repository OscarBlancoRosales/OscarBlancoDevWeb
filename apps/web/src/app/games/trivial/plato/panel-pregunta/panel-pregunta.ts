import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Las letras de las opciones, para no calcularlas en la plantilla. */
const LETRAS = ['A', 'B', 'C', 'D'];

/**
 * La pregunta y sus opciones.
 *
 * No sabe nada de la sala: recibe lo que hay que pintar y avisa de lo que se
 * pulsa. La respuesta buena solo se marca con la ronda cerrada, porque hasta
 * entonces el servidor no la manda y este panel no se la inventa.
 */
@Component({
  selector: 'app-panel-pregunta',
  imports: [FormsModule],
  templateUrl: './panel-pregunta.html',
  styleUrl: './panel-pregunta.css',
})
export class PanelPregunta {
  @Input() enunciado = '';
  @Input() codigo: string | null = null;
  @Input() opciones: readonly string[] = [];
  @Input() dificultad: number | null = null;
  @Input() esEstimacion = false;
  @Input() puedesContestar = false;
  @Input() cerrada = false;
  @Input() correcta: number | null = null;
  @Input() tuRespuesta: number | null = null;
  @Input() explicacion: string | null = null;

  /** Solo en el modo IA: el banco está escrito a mano y revisado. */
  @Input() sePuedeImpugnar = false;
  @Input() impugnan = 0;
  @Input() hacenFalta = 0;
  @Input() tuImpugnas = false;

  @Output() readonly responde = new EventEmitter<number>();
  @Output() readonly impugna = new EventEmitter<void>();

  readonly letras = LETRAS;

  /** Lo que se escribe en una prueba de estimación. */
  estimacion: number | null = null;

  /** Los chiles de la dificultad, para no contar en la plantilla. */
  get chiles(): readonly number[] {
    return Array.from({ length: this.dificultad ?? 0 }, (_, i) => i);
  }

  enviarEstimacion(): void {
    if (this.estimacion === null) return;
    this.responde.emit(Math.round(this.estimacion));
    this.estimacion = null;
  }
}
