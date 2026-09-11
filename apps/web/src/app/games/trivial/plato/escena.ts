import type { TipoPrueba, TrivialView } from '@devweb/shared/games/trivial/tipos';

/**
 * Los golpes de efecto del programa.
 *
 * No son estados del juego -eso lo lleva el servidor-, son lo que el plató
 * está *contando* ahora mismo: una cortinilla, una revelación, un podio.
 */
export type Golpe = 'arranca' | 'seccion' | 'pregunta' | 'resuelve' | 'apuestas' | 'podio';

/** Un golpe y la prueba a la que pertenece, cuando pertenece a alguna. */
export interface Cambio {
  readonly golpe: Golpe;
  readonly seccion: TipoPrueba | null;
}

/**
 * Cuánto dura cada golpe, en milisegundos.
 *
 * Estos números son la diferencia entre un programa con ritmo y uno que se
 * hace pesado. La cortinilla es la más larga porque para el juego a propósito;
 * lo demás se cuenta en parpadeos.
 *
 * Ninguno se come tiempo de contestar: todos caen en los huecos -al cambiar de
 * sección, al cerrar la ronda- y no encima de la ventana de respuesta, que la
 * mide el reloj del servidor y no perdona.
 */
export const DURACION: Readonly<Record<Golpe, number>> = {
  arranca: 2_600,
  seccion: 3_000,
  pregunta: 600,
  resuelve: 900,
  apuestas: 2_200,
  podio: 4_000,
};

/**
 * Qué golpe pide la vista que acaba de llegar, o `null` si no toca ninguno.
 *
 * Se calcula comparando dos vistas, igual que el presentador decide qué decir
 * comparando dos estados: así es una función pura, se prueba sin navegador y
 * da lo mismo en las cinco pantallas de la mesa.
 *
 * El orden de las comprobaciones es el orden de importancia en un programa: lo
 * que acaba de resolverse manda sobre lo que viene, y el final manda sobre
 * todo.
 */
export function golpeEntre(antes: TrivialView | null, ahora: TrivialView): Cambio | null {
  // Se acabó el programa: por encima de cualquier otra cosa.
  if (ahora.fase === 'fin' && antes?.fase !== 'fin') {
    return { golpe: 'podio', seccion: null };
  }

  // Arranca: de la sala de espera a la primera pregunta.
  if (ahora.fase !== 'presentacion' && (antes === null || antes.fase === 'presentacion')) {
    return { golpe: 'arranca', seccion: ahora.tipo };
  }

  if (ahora.fase === 'apuestas' && antes?.fase !== 'apuestas') {
    return { golpe: 'apuestas', seccion: 'final' };
  }

  // Cambio de prueba: la cortinilla, que es lo que convierte una tanda de
  // preguntas en un programa con partes.
  if (ahora.tipo !== null && ahora.tipo !== antes?.tipo) {
    return { golpe: 'seccion', seccion: ahora.tipo };
  }

  // Se cierra la ronda: revelación.
  if (ahora.cerrada && antes?.cerrada === false) {
    return { golpe: 'resuelve', seccion: ahora.tipo };
  }

  // Pregunta nueva dentro de la misma prueba.
  if (ahora.ronda !== antes?.ronda && !ahora.cerrada) {
    return { golpe: 'pregunta', seccion: ahora.tipo };
  }

  return null;
}

/**
 * Si este golpe se puede saltar tocando la pantalla.
 *
 * Los que paran el juego, sí: en la ronda diecisiete nadie quiere ver otra vez
 * la misma cortinilla. Los que son un parpadeo, no, porque se acaban antes de
 * que te dé tiempo a quererlos saltar.
 */
export function seSalta(golpe: Golpe): boolean {
  return golpe === 'seccion' || golpe === 'arranca' || golpe === 'apuestas';
}
