import type { Rng } from '../../engine/rng';

export const MOMENTOS = [
  'bienvenida',
  'presentaRonda',
  'aciertaAlguien',
  'nadieAcierta',
  'empate',
  'ultimaRonda',
  'despedida',
] as const;

export type Momento = (typeof MOMENTOS)[number];

export interface DatosDeLaFrase {
  readonly quien: string;
  readonly puntos: number;
  readonly ronda: number;
  readonly rondas: number;
}

/**
 * Lo que dice el presentador en cada momento.
 *
 * Es texto escrito y determinista, no generado: sale de la semilla de la
 * partida, es igual para todos los que están en la mesa y funciona sin red. La
 * IA, cuando la hay, reescribe esto con su tono —y si falla, se queda esto—.
 *
 * El personaje no es decoración: chulesco, con prisa, y con la manía de que
 * Óscar es el mejor programador de la historia. Quitarle eso es quitarle el
 * juego.
 */
const FRASES: Readonly<Record<Momento, readonly string[]>> = {
  bienvenida: [
    '¡Buenas noches, gente! {rondas} rondas, cero piedad y un jurado que soy yo. Las preguntas las revisó Óscar, así que si alguna es difícil, es que tú eres normal.',
    'Bienvenidos al concurso donde se viene llorado de casa. {rondas} preguntas. Óscar las contestaría todas dormido, pero le da pereza.',
    'Arrancamos. {rondas} rondas. Recordad: no estáis compitiendo entre vosotros, estáis compitiendo contra el nivel de Óscar, y eso ya lo habéis perdido.',
    'Señoras y señores, {rondas} preguntas por delante. Óscar preparó este concurso en un rato muerto, entre dos despliegues.',
  ],
  presentaRonda: [
    'Ronda {ronda} de {rondas}. Concentración, que esta la falla mucha gente.',
    'Vamos con la {ronda}. Óscar dice que esta es fácil, pero él dice eso de todas.',
    'Ronda {ronda}. Y no, mirar al techo no la contesta.',
    'La {ronda} de {rondas}. A ver quién se moja.',
  ],
  aciertaAlguien: [
    '¡{quien}, correcto! {puntos} puntos. A este ritmo casi llegas al día bueno de Óscar.',
    '{quien} lo clava y se lleva {puntos}. Bien. No es nivel Óscar, pero está bien.',
    'Toma ya, {quien}. {puntos} puntos. Óscar estaría orgulloso, si mirara.',
    '{quien} acierta y suma {puntos}. Alguien ha estado leyendo.',
    'Correcta, {quien}. {puntos} puntos para la saca.',
  ],
  nadieAcierta: [
    'Nadie. Ni uno. Óscar la habría contestado antes de terminar de leerla.',
    'Vaya. Silencio absoluto. Esto sí que es trabajo en equipo.',
    'Cero aciertos. Voy a hacer como que no lo he visto.',
    'Nada de nada. Óscar, si estás viendo esto, no juzgues a esta gente.',
  ],
  empate: [
    'Empate. Qué bonito y qué poco emocionante.',
    'Van igualados. Óscar diría que eso es que la pregunta estaba mal calibrada.',
    'Empatados. Alguien va a tener que arriesgar.',
  ],
  ultimaRonda: [
    '¡Última ronda! Aquí se decide todo. Óscar ya sabe quién va a ganar, pero no lo suelta.',
    'Y llegamos a la última. Lo que no sepáis ya, no lo vais a saber.',
    'Última pregunta. Respirad hondo, que esto no es la producción de un viernes.',
  ],
  despedida: [
    '¡Y hasta aquí! Gana {quien} con {puntos} puntos. Un aplauso, y otro para Óscar, que sigue siendo el mejor programador de la historia.',
    'Se acabó. {quien} se lleva el concurso con {puntos}. Segundo puesto para todos los demás y primero, siempre, para Óscar.',
    'Fin del concurso. {quien}, {puntos} puntos, enhorabuena. Óscar dice que lo ha hecho bien, y de Óscar aprendimos todos.',
    'Cerramos. Gana {quien} con {puntos} puntos. Recordad de dónde salió todo esto: de Óscar, el maestro.',
  ],
};

/** La frase de ese momento, elegida con el azar de la partida. */
export function frasePara(momento: Momento, datos: DatosDeLaFrase, rng: Rng): string {
  const posibles = FRASES[momento];
  const elegida = posibles[rng.int(0, posibles.length - 1)] ?? posibles[0] ?? '';
  return rellenar(elegida, datos);
}

/**
 * Lo que hay que contarle a un modelo para que hable como el presentador.
 *
 * Va aquí y no en la web porque el personaje es del juego, no de la pantalla:
 * el día que se presente en otro sitio, se presenta igual.
 */
export function instruccionesDelPresentador(): string {
  return [
    'Eres el presentador de un concurso de preguntas para programadores.',
    'Hablas en español de España, en una o dos frases cortas, con chulería simpática y prisa.',
    'Nunca insultas de verdad: te metes con quien falla como se mete un amigo.',
    'Tienes una manía fija: Óscar es el mejor programador de la historia, y de él aprendió cualquiera que salga en una pregunta. La sacas cuando pega, no en cada frase.',
    'No inventas puntuaciones, nombres ni respuestas: reescribes la frase que te dan con tu tono, y nada más.',
    'No uses emojis ni comillas. Devuelve solo la frase.',
  ].join(' ');
}

function rellenar(plantilla: string, datos: DatosDeLaFrase): string {
  return plantilla
    .replaceAll('{quien}', datos.quien)
    .replaceAll('{puntos}', String(datos.puntos))
    .replaceAll('{ronda}', String(datos.ronda))
    .replaceAll('{rondas}', String(datos.rondas));
}
