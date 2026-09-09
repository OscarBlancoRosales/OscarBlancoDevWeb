/**
 * Banco de preguntas del Trivial / Buzz.
 *
 * Cada pregunta es de un tipo de prueba. El presentador (y más adelante el
 * motor) no tiene que saber de informática ni de cine: lee `type` y pinta
 * lo que toque.
 *
 * Tipos, los de siempre en este género:
 *  - `choice`     — cuatro opciones, una correcta (Buzz clásico)
 *  - `truefalse`  — verdadero o falso
 *  - `numeric`    — año o cifra; `tolerance` si vale acercarse
 *  - `odd`        — ¿cuál no pinta con los demás?
 *  - `order`      — ordena (cronológico o lógico); `answer` es el orden bueno
 *  - `open`       — respuesta corta; `accept` son variantes que también valen
 */

export type QuestionPack = 'dev' | 'general';

export type QuestionType = 'choice' | 'truefalse' | 'numeric' | 'odd' | 'order' | 'open';

export type Difficulty = 1 | 2 | 3;

export interface Question {
  /** Único en todo el banco. `pack-categoria-000`. */
  id: string;
  pack: QuestionPack;
  category: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  /** Opciones a mostrar. En `order` es la lista desordenada. */
  options?: string[];
  /**
   * Correcta: texto de la opción, `Verdadero`/`Falso`, número, array ordenado
   * o respuesta corta.
   */
  answer: string | number | string[];
  /** Otras formas de aceptar en `open` (sin tildes da igual: se normaliza). */
  accept?: string[];
  /** En `numeric`, cuánto se puede fallar. 0 = exacto. */
  tolerance?: number;
  /** Lo que suelta el presentador después. */
  explain?: string;
  /**
   * Hecho canónico (`capital:italia`, `lang:python`).
   * Un mismo stem no puede salir en dos modos (test y abierta, p. ej.).
   */
  stem?: string;
}

export const DEV_CATEGORIES = [
  'lenguajes',
  'historia',
  'web',
  'datos',
  'sistemas',
  'git',
  'hardware',
  'algoritmos',
  'seguridad',
  'cultura',
  'ia',
] as const;

export const GENERAL_CATEGORIES = [
  'geografia',
  'historia',
  'ciencia',
  'arte',
  'cine',
  'musica',
  'deporte',
  'television',
  'gastronomia',
  'naturaleza',
  'espana',
] as const;
