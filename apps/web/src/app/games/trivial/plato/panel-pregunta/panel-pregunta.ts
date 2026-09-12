import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { seApagan, seEnciende, seExplica } from '../revelacion';
import type { Paso } from '../revelacion';

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

  /**
   * En qué punto va el destape.
   *
   * Con la ronda abierta da igual. Con la ronda cerrada es lo que hace que la
   * respuesta se cuente en vez de aparecer: primero un compás de silencio,
   * luego se enciende la buena, luego se apagan las otras y al final se
   * explica. Por defecto está al final, que es lo que debe ver quien entra en
   * una ronda ya resuelta.
   */
  @Input() paso: Paso = 'listo';

  /** Solo en el modo IA: el banco está escrito a mano y revisado. */
  @Input() sePuedeImpugnar = false;
  @Input() impugnan = 0;
  @Input() hacenFalta = 0;
  @Input() tuImpugnas = false;

  @Output() readonly responde = new EventEmitter<number>();
  @Output() readonly impugna = new EventEmitter<void>();

  readonly letras = LETRAS;

  /** Si esta opción es la buena y ya toca señalarla. */
  esLaBuena(indice: number): boolean {
    return this.cerrada && this.correcta === indice && seEnciende(this.paso);
  }

  /** Si esta opción ya se ha apagado por no ser la buena. */
  estaApagada(indice: number): boolean {
    return this.cerrada && this.correcta !== indice && seApagan(this.paso);
  }

  /** Si ya toca explicar por qué. */
  get seExplica(): boolean {
    return this.cerrada && seExplica(this.paso);
  }

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
