/**
 * El plató en tres dimensiones, sin Angular por medio.
 *
 * Vive aparte del componente a propósito: aquí dentro no hay señales, ni
 * plantillas, ni ciclo de vida. Solo una escena, una cámara y un bucle. Así se
 * puede razonar sobre el escenario sin arrastrar el framework, y el componente
 * se queda con lo suyo: crear esto, darle de comer y soltarlo.
 *
 * Es un **diorama**: el escenario tiene volumen de verdad -suelo, pared, focos
 * y atriles- y los personajes son las caras que ya existen, montadas como
 * cartelas iluminadas. Como un teatro de papel. Da profundidad sin necesitar
 * once modelos que nadie ha hecho.
 */
import type { Golpe } from '../escena';

/** Lo que el escenario necesita saber de cada concursante. */
export interface EnElEscenario {
  readonly seatId: string;
  readonly foto: string;
  /** Encendido: ha contestado. */
  readonly atento: boolean;
  /** Acaba de acertar, de fallar, o ninguna de las dos. */
  readonly acierta: boolean;
  readonly falla: boolean;
  readonly tiembla: boolean;
}

/** Lo que se le manda al escenario en cada repintado. */
export interface Cuadro {
  readonly puestos: readonly EnElEscenario[];
  /** El color de la prueba, en «r g b». Tiñe los focos y la pared. */
  readonly tono: string;
  /** Lo que se está contando, si se está contando algo. */
  readonly golpe: Golpe | null;
  /**
   * El puesto al que la cámara se gira ahora mismo.
   *
   * Es la bomba: cuando cambia de manos, la cámara da un latigazo hacia quien
   * la tiene. En un plató de verdad eso lo hace un realizador, y es lo que
   * hace que mires a esa persona y no a la pregunta.
   */
  readonly mirandoA: string | null;
  /** Si el plató está temblando. La bomba acaba de explotar. */
  readonly sacude: boolean;
}

/**
 * Si este navegador puede con esto.
 *
 * No es «existe WebGL» -existe en el 98 %-, es si se puede crear un contexto
 * aquí y ahora: con la aceleración desactivada o el dispositivo apretado de
 * memoria, la creación falla y hay que quedarse con el escenario de CSS.
 */
export function sePuedePintar(): boolean {
  try {
    const lienzo = document.createElement('canvas');
    return !!(lienzo.getContext('webgl2') ?? lienzo.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Lo que se le pide al navegador como mucho, para no derretir un móvil. */
export const RESOLUCION_MAXIMA = 1.5;

/** Dónde se pone la cámara en reposo, y a dónde mira. */
export const CAMARA_EN_REPOSO = { x: 0, y: 2.6, z: 7.4 } as const;

/**
 * A cuánto se acerca la cámara en cada golpe.
 *
 * Uno es la posición de reposo; menos de uno es acercarse. La cortinilla es la
 * que más se mueve porque es la que para el juego; la revelación se acerca un
 * poco, lo justo para que se note que ha pasado algo.
 */
export const ACERCAMIENTO: Readonly<Record<Golpe, number>> = {
  arranca: 1.35,
  seccion: 0.78,
  pregunta: 0.97,
  resuelve: 0.9,
  apuestas: 0.84,
  podio: 0.72,
};

/** Cuánto se abre la fila de atriles según cuántos haya. */
export function separacionPara(cuantos: number): number {
  if (cuantos <= 1) return 0;
  return Math.min(1.9, 7.6 / cuantos);
}

/** Dónde va cada atril en la fila, centrada en el origen. */
export function sitioDe(indice: number, cuantos: number): number {
  const paso = separacionPara(cuantos);
  return (indice - (cuantos - 1) / 2) * paso;
}

/**
 * Cuánto se aparta el punto de mira hacia el atril al que se gira la cámara.
 *
 * Ni nada ni del todo: si la cámara se planta delante de quien tiene la bomba,
 * la pregunta se va de cuadro y deja de poder contestarse.
 */
export const GIRO_HACIA = 0.55;

/** A dónde mira la cámara cuando se gira hacia un atril que está en `x`. */
export function puntoDeMira(x: number): number {
  return x * GIRO_HACIA;
}

/** Lo que dura la sacudida de la explosión. */
export const LO_QUE_SACUDE = 700;

/** Lo fuerte que sacude a los `ms` de explotar: de golpe, y se va apagando. */
export function fuerzaDeLaSacudida(ms: number): number {
  if (ms < 0 || ms >= LO_QUE_SACUDE) return 0;
  return 1 - ms / LO_QUE_SACUDE;
}

/** Cuánto se mueve la cámara con la sacudida a tope, en metros. */
export const SACUDIDA_MAXIMA = 0.17;
