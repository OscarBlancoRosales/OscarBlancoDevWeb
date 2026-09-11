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
 *
 * Del café y del porro nunca se dice de quién son: son votos como cualquier
 * otro, y cantar el café de alguien es destaparle la carta. Ver `poker-prompts`.
 */

export interface DatosDelDealer {
  readonly quien: string;
  readonly cuantos: number;
  readonly media: number;
  readonly voto: number;
  readonly asunto: string;
}

/**
 * El repertorio, por momento.
 *
 * Cuanto más largo, mejor: esto es lo que se lee siempre que el modelo no
 * llega, y con cuatro frases por momento la mesa se sabía el guion antes de
 * terminar la primera tarea. Las frases con hueco caben en cualquier número:
 * «faltan {cuantos}» vale para uno y para siete, y por eso no hay ninguna que
 * dependa de que el plural cuadre.
 */
const FRASES: Readonly<Record<MomentoDealer, readonly string[]>> = {
  // Todas nombran la tarea: es lo único que la mesa necesita oír al repartir.
  reparte: [
    'Cartas en la mesa. A ver qué se os ocurre con {asunto}.',
    'Venga, {asunto}. Y sed valientes, que luego lo estima el becario.',
    'Nueva mano: {asunto}. Pensadlo bien, que no hay bola extra.',
    'Ahí lo tenéis: {asunto}. El que diga uno que se lo mire.',
    'Sobre el tapete: {asunto}. Y sin mirar al de al lado, que os veo.',
    'Repartiendo. {asunto}. Tenéis todo el tiempo del mundo, pero poco.',
    '{asunto}. Suena fácil. Siempre suenan fáciles.',
    'Atención: {asunto}. El que ya lo haya hecho antes que disimule.',
    'Esto va de {asunto}. Y esta vez sin mirar al techo buscando la respuesta.',
    'Manos a la obra con {asunto}. Yo no opino, yo solo reparto.',
    'Lo siguiente es {asunto}. Poned lo que penséis, no lo que convenga.',
    'Turno de {asunto}. Recordad que esto luego alguien lo tiene que hacer.',
    'Aquí llega {asunto}. Un clásico moderno.',
    'Tarea nueva: {asunto}. Poned la carta, que no muerde.',
    'Sale {asunto}. Que cada uno estime lo suyo, no lo del vecino.',
    'A ver, {asunto}. Y con calma, que las prisas las pongo yo.',
  ],
  primerVoto: [
    'Uno que se moja. Los demás, cuando podáis.',
    'Ya hay carta encima de la mesa. Vamos, que no es un examen.',
    'Bien, {quien}. El resto sigue en la fase de meditación.',
    'Primera carta. {quien} tirando del carro, como siempre.',
    'Alguien ha votado. Un milagro pequeño, pero milagro.',
    '{quien} abre la mano. A ver quién se atreve a seguirle.',
    'Ya tenemos una. Las demás deben de estar en revisión.',
    'Uno dentro. Los otros calculando las consecuencias.',
    '{quien} no se lo ha pensado mucho. Eso me gusta o me preocupa.',
    'Primera carta boca abajo. Esto empieza a parecer una partida.',
    'Gracias, {quien}. Alguien tenía que romper el hielo.',
    'Va cayendo la primera. No está mal para empezar.',
    'Uno ya ha puesto. Los demás en modo contemplativo.',
    '{quien} ha decidido. El resto lo está estudiando con cariño.',
  ],
  faltaGente: [
    'Faltan {cuantos}. No digo nombres, pero los tengo aquí apuntados.',
    'Todavía quedan {cuantos} pensándoselo. Se nota que no pagan ellos.',
    'A ver, {cuantos} sin votar. Yo tengo toda la tarde, ojo.',
    'Quedan {cuantos} por poner carta. Sin prisa, pero sin pausa.',
    'Aún faltan {cuantos}. La mesa espera, y la mesa no perdona.',
    'Van cayendo. Quedan {cuantos}.',
    'Hay {cuantos} todavía en el limbo. Se les está pasando el arroz.',
    'Nos faltan {cuantos}. Y no voy a mirar a nadie, aunque podría.',
    'Quedan {cuantos}. Estoy contando, que lo sepáis.',
    'A falta de {cuantos}, esto ya casi está.',
    'Solo {cuantos} y destapamos. Un empujoncito.',
    'Pendientes: {cuantos}. Ni juzgo ni dejo de juzgar.',
    'Nos quedan {cuantos}. La cosa avanza, despacito.',
    'Siguen faltando {cuantos}. Pero bueno, hay progreso.',
  ],
  espabila: [
    'Que llevamos aquí un rato. {cuantos} sin votar. Espabilad, hombre.',
    'Se me está calentando el cubata esperando. Quedan {cuantos}.',
    '¿Hola? Quedan {cuantos}. Que esto no es una oposición.',
    'Yo aquí, envejeciendo, y {cuantos} sin dar una carta.',
    'Llevo tanto esperando que se me ha deshecho el hielo. Faltan {cuantos}.',
    'Hay {cuantos} pendientes. Os recuerdo que la reunión tiene final.',
    'Esto parece una sala de espera. Faltan {cuantos}.',
    'Venga, que quedan {cuantos}. No os pido el sentido de la vida.',
    'Quedan {cuantos} y el reloj corriendo. Una carta, cualquiera.',
    'Me he leído el periódico entero. Siguen faltando {cuantos}.',
    'Faltan {cuantos}. Poned algo, que rectificar es gratis.',
    'A ver, {cuantos} ahí parados. Esto se vota, no se aprueba en Bruselas.',
    'Sigo esperando a {cuantos}. Y yo cobro por horas.',
    'Quedan {cuantos} sin votar. Un número. Cualquiera. Me conformo.',
    'He visto glaciares moverse más rápido. Faltan {cuantos}.',
    'Con {cuantos} pendientes, esto no avanza. Y yo aquí de pie.',
  ],
  todosListos: [
    'Todos han votado. Se acabó la comedia, vamos a ver qué habéis hecho.',
    'Cartas puestas. Preparaos, que ahora viene lo bueno.',
    'Ya está la mesa. Vamos a destapar esto a ver quién se ha lucido.',
    'Mesa completa. Que empiece el espectáculo.',
    'Todas las cartas abajo. Ahora ya no vale cambiarse.',
    'Listo. A ver si esto se parece a un equipo o a un sorteo.',
    'Ya estamos todos. Momento de la verdad.',
    'Cartas puestas y nadie se ha escapado. Destapamos.',
    'No falta nadie. Vamos a ver el percal.',
    'Mesa cerrada. Lo que hay, hay.',
    'Completo. Ahora venid a explicarme lo que habéis puesto.',
    'Todos dentro. Se levantan las cartas.',
    'Ya no falta ninguno. Esto se destapa.',
    'Mesa al completo. Y yo con ganas de ver esto.',
  ],
  acuerdoTotal: [
    'Todos igual. O lo tenéis clarísimo, o os habéis copiado.',
    'Unanimidad. Qué bonito y qué sospechoso.',
    'Todos el mismo número. Esto o es un equipo o es una secta.',
    'Pleno al mismo número. Tomaos algo, os lo habéis ganado.',
    'Todos coinciden. Con vosotros me quedo sin trabajo.',
    'Acuerdo total. Un momento histórico, y yo aquí para verlo.',
    'Idénticas. Esto no lo veía desde la última reorganización.',
    'El mismo número todos. Da hasta un poco de miedo.',
    'Unanimidad absoluta. O está clarísimo o nadie lo ha leído.',
    'Todas iguales. Apuntadlo, que esto no se repite.',
    'Pleno. Siguiente, que así da gusto.',
    'Coincidencia perfecta. Sospechosamente perfecta.',
    'Ni una discrepancia. Esto huele a que ya lo habíais hablado.',
    'Todos a una. Qué equipo, oye.',
  ],
  consenso: [
    'Pues casi casi. La media va por {media}. Damos esto por bueno.',
    'Vais parecido. {media} de media. Un aplauso moderado.',
    'Acuerdo razonable, {media}. Mira, sin discutir y todo.',
    'Bastante de acuerdo. {media}. Con eso se puede trabajar.',
    'Os movéis en el mismo barrio. Media de {media}.',
    'Media de {media}. No está mal. Ni bien. Está.',
    'Consenso sin sangre. {media} y a otra cosa.',
    'Media de {media} y ninguna discusión. Qué aburrimiento tan agradable.',
    'Casi todos en la misma línea. {media}. Lo firmo.',
    'Un acuerdo decente: {media}. Siguiente tarea.',
    'Media {media}. Hay diferencias, pero de las que no duelen.',
    'Esto ya se parece a un equipo. {media}.',
    'Se entiende la mesa: {media}. Lo damos por hablado.',
    'Media {media} y todos tranquilos. Así se trabaja.',
  ],
  dispersion: [
    'Aquí hay opiniones. Media de {media} y una separación que da miedo.',
    'Esto está repartidillo. {media} de media, pero sin mucha fe.',
    'Ni fu ni fa. {media}. Alguien no ha leído la tarjeta, sospecho.',
    'Media de {media}, pero cada uno por su lado. Hablad un poco.',
    'Hay dispersión. {media} es la media y no representa a nadie.',
    'Números para todos los gustos. Media {media}.',
    'Media de {media}. Una media que no se cree ni ella.',
    'Esto está desperdigado. {media}, por decir algo.',
    'Cada uno ve una cosa distinta. La media dice {media}.',
    'Media {media} y una nube de puntos preciosa. Poneos de acuerdo.',
    'Bastante repartido. {media} de media y poca convicción.',
    'Ni acuerdo ni desacuerdo. {media}. Un empate a nada.',
    'La mesa no termina de verlo igual. {media}.',
    'Media {media}, con matices. Muchos matices.',
  ],
  desacuerdo: [
    'Pero bueno, ¿esto qué es? Media {media} y cada uno a su bola.',
    'Aquí no os habéis leído lo mismo, os lo digo yo. {media} de media, y de milagro.',
    'Vaya cirio. {media} de media, que no significa absolutamente nada.',
    'Esto es un despropósito. La media sale {media} y no sirve para nada.',
    '¿Estamos hablando de la misma tarea? Media {media}, dice.',
    'Media de {media}, sacada de números que no se parecen en nada.',
    'Aquí hay que hablar. {media} no arregla esto.',
    'Un desastre estadístico. {media}. Volved a votar cuando os aclaréis.',
    'Menudo abanico. La media {media} es pura decoración.',
    'No hay quien case esto. Media {media} y una discusión pendiente.',
    'Esto no es una estimación, es una porra. Media {media}.',
    'Cada uno ha entendido una cosa. {media} de media, por poner algo.',
    'Aquí falta una conversación. La media {media} no la sustituye.',
    'Esto no hay por dónde cogerlo. {media}, y con dudas.',
  ],
  // Todas llevan nombre y los dos números: sin eso, pedir cuentas no se entiende.
  elDesviado: [
    '{quien}. Un {voto}. La media es {media}. Explícate, anda.',
    'A ver, {quien}, que has puesto {voto} y la mesa va por {media}. Cuenta, cuenta.',
    '{quien} ha votado {voto}. Los demás, {media}. Que salga y se defienda.',
    'Aquí {quien} con su {voto}, viviendo en otro proyecto. La media es {media}.',
    'Un {voto}, ha dicho {quien}. La mesa dice {media}. Alguien se equivoca y no soy yo.',
    '{quien} va por libre: {voto} contra una media de {media}. Argumenta.',
    'Todos en {media} y {quien} plantando un {voto}. Tiene que haber una razón.',
    'Interesante, {quien}. Un {voto}. La media, {media}. Te escuchamos.',
    '{quien} ve algo que los demás no ven: {voto}, con la media en {media}.',
    'Un {voto} de {quien}. Media {media}. O sabe algo o no ha leído nada.',
    '{quien}, tu {voto} contra el {media} de la mesa. Defiéndelo.',
    'Atención a {quien} y su {voto}. La media, {media}. Que se explique.',
    '{quien} se ha ido de excursión: {voto}. Aquí abajo estamos en {media}.',
    'La mesa en {media} y {quien} en {voto}. Uno de los dos se equivoca.',
    '{quien} ha puesto {voto} donde todos ven {media}. Ilumínanos.',
    'Ojo al {voto} de {quien}, con la mesa en {media}. Esto hay que oírlo.',
  ],
  dosBandos: [
    'Aquí hay dos equipos y ninguno se habla. Esto se arregla hablando.',
    'La mesa está partida en dos. O lo aclaráis o volvemos a votar hasta Navidad.',
    'Dos bandos clarísimos. Uno lo ve fácil y otro ve un marrón. Ponedlo en común.',
    'Dos grupos, dos realidades. Alguien tiene información que el otro no tiene.',
    'Esto está partido por la mitad. Que hable uno de cada lado.',
    'Media mesa dice fácil y media dice imposible. Ahí hay tema.',
    'Dos bloques. Esto no se arregla votando otra vez, se arregla explicándolo.',
    'Hay dos versiones de esta tarea. Escuchemos las dos.',
    'Frente norte y frente sur. Negociad.',
    'La mesa se ha dividido en dos. Alguien ha leído la letra pequeña.',
    'Dos bandos. Uno de los dos tiene razón, y quiero saber cuál.',
    'Partidos en dos. Contadme qué sabe cada grupo.',
    'Aquí hay dos conversaciones distintas. Juntadlas.',
    'Dos grupos enfrentados y un servidor disfrutando. Hablad.',
  ],
  // Anónimas a propósito: el café es un voto, y de quién es no se canta.
  cafe: [
    'Alguien pide café. Muy legítimo. Yo llevo tres.',
    'Café en la mesa. Pausa técnica, que la cabeza no da más.',
    'Hay quien necesita un café. Se entiende, con esta tarea.',
    'Ha salido un café. Traducción: la cabeza ya no da.',
    'Café. Respetable. Todos hemos estado ahí.',
    'Alguien levanta la mano pidiendo cafeína. Concedido.',
    'Un café sobre el tapete. Es una petición de auxilio muy educada.',
    'Café. Nadie estima bien con sueño, así que adelante.',
    'Ha caído un café. Yo no digo nada, pero mirad la hora.',
    'Petición de descanso. El café es la carta más sincera de la baraja.',
    'Café en la mesa. Cinco minutos y volvemos.',
    'Alguien necesita un respiro. Y viendo la tarea, se entiende.',
    'Sale café. La mesa pide tregua.',
    'Un café. No es rendirse, es repostar.',
  ],
  porro: [
    'Ha salido el porro. Traducción: esto no se puede estimar hoy.',
    'Alguien dice que esto es demasiado grande. Y no le falta razón.',
    'Porro sobre la mesa. Eso es «partid esto en trozos, por favor».',
    'Carta de porro. O sea: aquí falta información.',
    'Alguien tira la toalla, y con criterio. Esto no está listo para estimar.',
    'Un porro. Que en esta mesa significa «no tengo ni idea, y es culpa del enunciado».',
    'Ha caído el porro. Alguien está pidiendo que troceéis esto.',
    'Porro. La carta más honesta que existe.',
    'Eso es un «esto no cabe en un sprint». Tomad nota.',
    'Sale el porro. No es pereza, es sentido común.',
    'Alguien dice que así no. Escuchadle antes de seguir.',
    'Porro en la mesa. Volved cuando esto tenga bordes.',
    'Un porro. Señal de que la tarea está sin cocinar.',
    'Ha salido porro. Eso no se estima, eso se parte.',
  ],
  nuevaRonda: [
    'Manos nuevas. Borramos y volvemos a empezar.',
    'Otra vez será. Recojo las cartas y seguimos.',
    'Ronda nueva. A ver si ahora nos entendemos.',
    'Barajo de nuevo. Segunda oportunidad.',
    'Cartas recogidas. Otra mano, y con lo aprendido.',
    'Volvemos a empezar, ahora que ya os habéis escuchado.',
    'Ronda nueva y mesa limpia. Sin rencores.',
    'Reparto otra vez. A ver si hay suerte.',
    'Se repite la jugada. Y esta vez con criterio, espero.',
    'Borrón y cuenta nueva. Cartas fuera.',
    'Otra ronda. La casa invita.',
    'Mesa despejada. Vamos de nuevo.',
    'Recojo y reparto. Que no se diga.',
    'Vuelta a empezar. Esta vez sale.',
  ],
};

/**
 * La frase de ese momento, elegida con el azar de la mesa.
 *
 * `anterior` es la última que se dijo, y sirve para no repetirla dos veces
 * seguidas: elegir al azar con reemplazo repite mucho antes de lo que parece, y
 * la repetición que canta es justo la inmediata.
 */
export function fraseDelDealer(
  momento: MomentoDealer,
  datos: DatosDelDealer,
  rng: Rng,
  anterior?: string,
): string {
  const posibles = FRASES[momento];
  // Se compara ya rellena porque `anterior` viene de la partida, con el nombre
  // y los números puestos: la plantilla a secas nunca coincidiría.
  const frescas = posibles.filter((una) => rellenar(una, datos) !== anterior);
  // Si todas coinciden -un momento con una sola frase- mejor repetirse que
  // quedarse callado.
  const donde = frescas.length > 0 ? frescas : posibles;
  const elegida = donde[rng.int(0, donde.length - 1)] ?? '';
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
