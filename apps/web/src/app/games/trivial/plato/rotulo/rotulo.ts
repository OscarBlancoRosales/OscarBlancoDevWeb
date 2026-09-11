import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { TipoPrueba } from '@devweb/shared/games/trivial/tipos';

/** Cómo se llama una prueba en pantalla, cómo se juega y qué se gana. */
export interface Seccion {
  readonly nombre: string;
  readonly pista: string;
  /** Lo que se gana y lo que se pierde. Cantar las normas es media cortinilla. */
  readonly premio: string;
}

/**
 * El nombre de cada prueba y sus normas.
 *
 * Vive aquí y no en la sala porque el rótulo es quien las canta, y porque
 * enseñar lo que se gana y lo que cuesta fallar es justo lo que convierte una
 * pregunta más en una sección del programa.
 */
export const SECCIONES: Readonly<Record<TipoPrueba, Seccion>> = {
  test: {
    nombre: 'Test',
    pista: 'Cuatro opciones, una buena.',
    premio: 'Acertar +100 · Acertar pronto, más',
  },
  estimacion: {
    nombre: 'A ojo',
    pista: 'Sin opciones: escribe el número.',
    premio: 'Cuanto más cerca, más · Clavarlo, +20',
  },
  fallo: {
    nombre: 'Encuentra el fallo',
    pista: 'Está ahí. Míralo bien.',
    premio: 'Acertar +100',
  },
  pulsa: {
    nombre: 'El primero que pulse',
    pista: 'Solo cobra el primero que acierta.',
    premio: 'Acertar +150 · Fallar −50',
  },
  rafaga: {
    nombre: 'Ráfaga',
    pista: 'Verdadero o falso. Encadenar multiplica.',
    premio: 'Hasta ×5',
  },
  bomba: {
    nombre: 'La bomba',
    pista: 'Contesta y pásala. Que no te pille.',
    premio: 'Acertar +60 · Estallar −120',
  },
  final: {
    nombre: 'La final',
    pista: 'Apuesta lo que llevas. Una pregunta decide.',
    premio: 'Doble o nada',
  },
};

/**
 * La cortinilla que anuncia una sección.
 *
 * Las seis pruebas ya se jugaban; lo que no había era quien las anunciara, y
 * por eso veinte rondas se sentían como veinte preguntas seguidas en vez de
 * como un programa con partes.
 */
@Component({
  selector: 'app-rotulo',
  imports: [],
  templateUrl: './rotulo.html',
  styleUrl: './rotulo.css',
})
export class Rotulo {
  @Input() seccion: Seccion | null = null;

  /** Se puede saltar: al tercer programa uno ya se las sabe. */
  @Output() readonly salta = new EventEmitter<void>();
}
