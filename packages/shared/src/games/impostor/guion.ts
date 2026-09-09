import type { Rng } from '../../engine/rng';
import type { ImpostorState } from './tipos';

/**
 * La voz de la sala.
 *
 * No es un presentador con cara como el del concurso: es la sala misma, que va
 * diciendo en voz alta lo que acaba de pasar. Existe porque un juego de
 * acusarse necesita que alguien marque los tiempos —«se acabaron las pistas»,
 * «la mesa ha hablado»— y si eso lo pone la interfaz, cada uno lo lee cuando le
 * toca repintar. Aquí entra en la partida como una acción más y los ocho leen
 * lo mismo a la vez.
 *
 * El guion está escrito, sin modelos de por medio: son cuatro frases por
 * momento y lo que hace falta es que lleguen siempre, no que sean distintas
 * cada vez.
 */

export type Momento =
  | 'reparto'
  | 'aDebate'
  | 'aVotar'
  | 'empate'
  | 'ultimaPalabra'
  | 'ganaTripulacion'
  | 'ganaImpostor'
  | 'ganaConLaPalabra';

export interface DatosDelMomento {
  /** El nombre de quien protagoniza la frase, si hay alguien. */
  readonly quien: string;
  readonly tema: string;
  readonly palabra: string;
}

const FRASES: Readonly<Record<Momento, readonly string[]>> = {
  reparto: [
    'Palabra repartida. Uno de vosotros está mirando la pantalla con cara rara.',
    'Ya la tenéis todos. Bueno, todos no.',
    'Tema: {tema}. Una palabra cada uno y a callar.',
    'Empieza la ronda. Que nadie se venga arriba con la primera pista.',
  ],
  aDebate: [
    'Se acabaron las pistas. Ahora hablad, que es donde se cae la gente.',
    'Ya está dicho todo lo que se podía decir en una palabra. Ahora, a discutirlo.',
    'Turno de hablar. Preguntad, acusad y mirad quién se pone nervioso.',
    'Tiempo de debate. El que no diga nada también está diciendo algo.',
  ],
  aVotar: [
    'Se acabó el tiempo de hablar. A votar, y sin mirar a nadie.',
    'Fin del debate. Ahora es cuando se pierden las amistades.',
    'Turno de acusar. Que cada uno cargue con lo suyo.',
    'Se cierra la conversación. La mesa decide.',
  ],
  empate: [
    'Empate. Nadie sale, y alguien ahí dentro está respirando muy tranquilo.',
    'No os ponéis de acuerdo. Enhorabuena al impostor.',
    'Empate a votos. La duda también es una respuesta, y esta la ha ganado él.',
    'Nadie se va. Y así es como se pierde una partida.',
  ],
  ultimaPalabra: [
    'Le habéis pillado. Pero le queda una bala: si dice la palabra, gana él.',
    'Es el impostor, sí. Y ahora tiene un tiro. Suerte con eso.',
    'Pillado. Ahora que hable, y que os quiten la sonrisa.',
    'Bien visto. Pero esto no ha acabado: le toca adivinar.',
  ],
  ganaTripulacion: [
    'Fuera {quien}, y era. La palabra era «{palabra}».',
    'Cazado. {quien} era el impostor y la palabra era «{palabra}».',
    'La mesa gana. Era {quien}, y la palabra, «{palabra}».',
    'Se acabó: {quien}. «{palabra}», por si alguien seguía perdido.',
  ],
  ganaConLaPalabra: [
    'La dijo. «{palabra}». Le pillasteis y aun así gana él.',
    'Acertó: «{palabra}». Pillarle no era suficiente y ya lo sabíais.',
    '«{palabra}», dice {quien}. Y se lleva la ronda entera.',
    'Le cazasteis y os la ha quitado en la última palabra: «{palabra}».',
  ],
  ganaImpostor: [
    'Fuera {quien}... que no era. La palabra era «{palabra}».',
    'Habéis echado a {quien} para nada. Era «{palabra}».',
    'Gana el impostor. {quien} se va de vacío y la palabra era «{palabra}».',
    'Mal, muy mal. {quien} era inocente. «{palabra}».',
  ],
};

/**
 * Qué acaba de pasar, comparando el estado de antes con el de ahora.
 *
 * Se mira el cambio y no el estado a secas porque la sala habla de sucesos:
 * «se acabaron las pistas» solo tiene sentido en el instante en que se acaban.
 */
export function momentoDe(
  antes: ImpostorState | null,
  ahora: ImpostorState,
): Momento | null {
  if (!antes) return null;
  if (antes.fase === ahora.fase && antes.desenlace === ahora.desenlace) return null;

  if (ahora.fase === 'debate' && antes.fase === 'pistas') return 'aDebate';
  if (ahora.fase === 'votacion' && antes.fase === 'debate') return 'aVotar';
  if (ahora.fase === 'ultima-palabra') return 'ultimaPalabra';
  if (ahora.fase === 'fin') {
    if (ahora.desenlace === 'tripulacion') return 'ganaTripulacion';
    if (ahora.desenlace === 'impostores') {
      if (ahora.expulsado === null) return 'empate';
      // Pillado y aun así ganador: la revancha, que es su propio final.
      return ahora.intento >= 0 ? 'ganaConLaPalabra' : 'ganaImpostor';
    }
    return null;
  }
  return null;
}

/** La frase de ese momento, con los huecos rellenos. */
export function frasePara(momento: Momento, datos: DatosDelMomento, rng: Rng): string {
  const opciones = FRASES[momento];
  const elegida = opciones[rng.int(0, opciones.length - 1)] ?? '';
  return elegida
    .replaceAll('{quien}', datos.quien)
    .replaceAll('{tema}', datos.tema)
    .replaceAll('{palabra}', datos.palabra);
}
