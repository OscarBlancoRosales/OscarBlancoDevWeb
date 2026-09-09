import type { Rng } from '../engine/rng';
import type { MomentoDealer } from './poker-reparto';

/**
 * Lo que suelta el dealer de la mesa.
 *
 * Dos capas, como el presentador del concurso: este guion está escrito y
 * funciona sin red, y la IA lo reescribe cuando hay clave. El orden importa —
 * la frase existe antes de llamar a nadie, así que un modelo caído no deja la
 * mesa muda.
 *
 * El personaje es de humor manchego: seco, irónico, con mala leche cariñosa y
 * esa cosa de decir barbaridades con toda la calma del mundo. No insulta de
 * verdad y no se mete con nadie por lo que es, solo por lo que acaba de votar.
 */

export interface DatosDelDealer {
  readonly quien: string;
  readonly cuantos: number;
  readonly media: number;
  readonly voto: number;
  readonly asunto: string;
}

const FRASES: Readonly<Record<MomentoDealer, readonly string[]>> = {
  reparte: [
    'Cartas en la mesa. A ver qué se os ocurre con {asunto}.',
    'Venga, {asunto}. Y sed valientes, que luego lo estima el becario.',
    'Nueva mano: {asunto}. Pensadlo bien, que no hay bola extra.',
    'Ahí lo tenéis: {asunto}. El que diga uno que se lo mire.',
  ],
  primerVoto: [
    'Uno que se moja. Los demás, cuando podáis.',
    'Ya hay carta encima de la mesa. Vamos, que no es un examen.',
    'Bien, {quien}. El resto sigue en la fase de meditación.',
  ],
  faltaGente: [
    'Faltan {cuantos}. No digo nombres, pero los tengo aquí apuntados.',
    'Todavía quedan {cuantos} pensándoselo. Se nota que no pagan ellos.',
    'A ver, {cuantos} sin votar. Yo tengo toda la tarde, ojo.',
  ],
  espabila: [
    'Que llevamos aquí un rato. {cuantos} sin votar. Espabilad, hombre.',
    'Se me está calentando el cubata esperando a {cuantos} personas.',
    '¿Hola? Quedan {cuantos}. Que esto no es una oposición.',
    'Yo aquí, envejeciendo, y {cuantos} sin dar una carta.',
  ],
  todosListos: [
    'Todos han votado. Se acabó la comedia, vamos a ver qué habéis hecho.',
    'Cartas puestas. Preparaos, que ahora viene lo bueno.',
    'Ya está la mesa. Vamos a destapar esto a ver quién se ha lucido.',
  ],
  acuerdoTotal: [
    'Todos igual. O lo tenéis clarísimo, o os habéis copiado.',
    'Unanimidad. Qué bonito y qué sospechoso.',
    'Todos el mismo número. Esto o es un equipo o es una secta.',
  ],
  consenso: [
    'Pues casi casi. La media va por {media}. Damos esto por bueno.',
    'Vais parecido. {media} de media. Un aplauso moderado.',
    'Acuerdo razonable, {media}. Mira, sin discutir y todo.',
  ],
  dispersion: [
    'Aquí hay opiniones. Media de {media} y una separación que da miedo.',
    'Esto está repartidillo. {media} de media, pero sin mucha fe.',
    'Ni fu ni fa. {media}. Alguien no ha leído la tarjeta, sospecho.',
  ],
  desacuerdo: [
    'Pero bueno, ¿esto qué es? Media {media} y cada uno a su bola.',
    'Aquí no os habéis leído lo mismo, os lo digo yo. {media} de media, y de milagro.',
    'Vaya cirio. {media} de media, que no significa absolutamente nada.',
  ],
  elDesviado: [
    '{quien}. Un {voto}. La media es {media}. Explícate, anda.',
    'A ver, {quien}, que has puesto {voto} y la mesa va por {media}. Cuenta, cuenta.',
    '{quien} ha votado {voto}. Los demás, {media}. Que salga y se defienda.',
    'Aquí {quien} con su {voto}, viviendo en otro proyecto. La media es {media}.',
  ],
  dosBandos: [
    'Aquí hay dos equipos y ninguno se habla. Esto se arregla hablando.',
    'La mesa está partida en dos. O lo aclaráis o volvemos a votar hasta Navidad.',
    'Dos bandos clarísimos. Uno lo ve fácil y otro ve un marrón. Ponedlo en común.',
  ],
  cafe: [
    'Alguien pide café. Muy legítimo. Yo llevo tres.',
    'Café en la mesa. Pausa técnica, que la cabeza no da más.',
    'Hay quien necesita un café. Se entiende, con esta tarea.',
  ],
  porro: [
    'Ha salido el porro. Traducción: esto no se puede estimar hoy.',
    'Alguien dice que esto es demasiado grande. Y no le falta razón.',
    'Porro sobre la mesa. Eso es «partid esto en trozos, por favor».',
  ],
  nuevaRonda: [
    'Manos nuevas. Borramos y volvemos a empezar.',
    'Otra vez será. Recojo las cartas y seguimos.',
    'Ronda nueva. A ver si ahora nos entendemos.',
  ],
};

/** La frase de ese momento, elegida con el azar de la mesa. */
export function fraseDelDealer(
  momento: MomentoDealer,
  datos: DatosDelDealer,
  rng: Rng,
): string {
  const posibles = FRASES[momento];
  const elegida = posibles[rng.int(0, posibles.length - 1)] ?? '';
  return rellenar(elegida, datos);
}

function rellenar(plantilla: string, datos: DatosDelDealer): string {
  return plantilla
    .replaceAll('{quien}', datos.quien)
    .replaceAll('{cuantos}', String(datos.cuantos))
    .replaceAll('{media}', String(datos.media))
    .replaceAll('{voto}', String(datos.voto))
    .replaceAll('{asunto}', datos.asunto || 'esta tarea');
}
