import type { MomentoDealer } from './poker-reparto';

/**
 * Lo que se le cuenta al modelo para que haga de dealer.
 *
 * El personaje va en las instrucciones de sistema y no cambia; lo que cambia
 * es el encargo, que es distinto en cada momento de la mesa. Meter prisa,
 * cantar un resultado y pedirle cuentas a quien ha votado veintiuno cuando el
 * resto votaba tres no son la misma tarea, y pedirlas con el mismo texto es lo
 * que hace que un personaje suene siempre igual.
 *
 * Los datos van dentro del encargo y no se dejan a su imaginación: un dealer
 * que se inventa la media o señala a quien no era estropea la reunión de
 * verdad, porque la gente se lo cree.
 */

/** Cómo va la mesa, para que hable con datos. */
export interface EnLaMesaDePoker {
  readonly nombre: string;
  /** Lo que ha votado, ya legible: un número, «café», «porro» o nada. */
  readonly voto: string;
  readonly haVotado: boolean;
}

export interface ContextoDelDealer {
  readonly momento: MomentoDealer;
  readonly asunto: string;
  readonly mesa: readonly EnLaMesaDePoker[];
  /** De quién se habla, si se habla de alguien. */
  readonly protagonista: string | null;
  /** El voto del protagonista, cuando el momento va de un voto concreto. */
  readonly voto: number;
  readonly media: number;
  readonly mediana: number;
  readonly desviacion: number;
  /** Cuánta gente falta por votar. */
  readonly faltan: number;
  /** Cuánto lleva la mesa esperando, en segundos. */
  readonly segundos: number;
  /** La frase escrita de reserva: marca el tono y la longitud que se espera. */
  readonly guion: string;
}

/**
 * Quién es el dealer. Va como instrucción de sistema y no cambia nunca.
 *
 * El personaje es lo único que hace que una reunión de estimaciones tenga
 * gracia, así que está descrito con detalle: de dónde viene el humor, qué hace
 * y, sobre todo, qué no hace. Sin los límites del final, un modelo con la
 * instrucción de «sé ácido» acaba diciendo cosas desagradables a gente real en
 * su trabajo.
 */
export function instruccionesDelDealer(): string {
  return [
    'Eres el crupier de una mesa de planning poker: melenas, gafas de sol, perilla y un cubata en la mano.',
    'Hablas en español de España con humor manchego: seco, irónico, socarrón, con mala leche cariñosa.',
    'Sueltas las barbaridades con toda la calma del mundo, como si fueran lo más normal.',
    'El tono es el de Muchachada Nui: Joaquín Reyes, Ernesto Sevilla y sobre todo Raúl Cimas.',
    'Frases cortas y planas, sin remate explicado. Lo gracioso es decirlo en serio, no señalarlo.',
    'Metes prisa cuando la gente se duerme y pides explicaciones a quien vota una barbaridad.',
    'Usas expresiones de andar por casa y comparaciones absurdas pero cotidianas: el cubata, la máquina del café, el becario, la reunión de las cinco.',
    // Los límites, que en un personaje así hacen falta y no son un adorno:
    'Nunca insultas de verdad, ni te metes con nadie por su aspecto, su acento, su origen ni nada personal: solo por lo que acaba de votar.',
    'Nunca inventas votos, nombres, medias ni cosas que no hayan pasado. Solo puedes usar los datos que te dan.',
    'Nada de emojis, ni comillas, ni asteriscos, ni acotaciones de escena. Devuelves solo lo que se dice en voz alta.',
  ].join(' ');
}

/** El encargo concreto de este momento, con sus datos. */
export function encargoDelDealer(ctx: ContextoDelDealer): string {
  return [tarea(ctx), datos(ctx), 'Extensión: una o dos frases cortas. Devuelve solo lo que se dice.']
    .filter(Boolean)
    .join('\n\n');
}

function tarea(ctx: ContextoDelDealer): string {
  const quien = ctx.protagonista ?? 'alguien';

  switch (ctx.momento) {
    case 'reparte':
      return [
        `Empieza una votación nueva sobre esto: «${ctx.asunto || 'una tarea sin nombre'}».`,
        'Anuncia la mano y mete un comentario sobre la tarea. Corto, que la gente quiere votar.',
      ].join(' ');

    case 'primerVoto':
      return `${quien} ha sido el primero en votar. Reconóceselo y mete prisa al resto, con sorna.`;

    case 'faltaGente':
      return `Faltan ${ctx.faltan} por votar. Comenta la espera con retranca, sin agobiar todavía.`;

    /** El único momento en el que sube el tono: llevamos un rato parados. */
    case 'espabila':
      return [
        `Llevas ${ctx.segundos} segundos esperando y todavía faltan ${ctx.faltan} por votar.`,
        'Métele prisa a la mesa. Aquí sí puedes ponerte pesado, que es lo que toca:',
        'quéjate de lo que estás envejeciendo, del cubata que se calienta, de lo que sea.',
      ].join(' ');

    case 'todosListos':
      return 'Ya han votado todos. Anuncia que se destapan las cartas y mete tensión de casino.';

    case 'acuerdoTotal':
      return [
        `Todos han votado lo mismo: ${ctx.media}.`,
        'Celébralo con sospecha, como si se hubieran copiado.',
      ].join(' ');

    case 'consenso':
      return `La mesa está de acuerdo: media ${ctx.media}, mediana ${ctx.mediana}. Dalo por bueno con retranca.`;

    case 'dispersion':
      return [
        `Los votos están repartidos: media ${ctx.media} y desviación ${ctx.desviacion}.`,
        'Coméntalo como quien ve que aquí no lo tienen claro.',
      ].join(' ');

    case 'desacuerdo':
      return [
        `Esto es un desastre: media ${ctx.media} y desviación ${ctx.desviacion}.`,
        'Cada uno ha votado una cosa distinta. Que se note que te parece increíble.',
      ].join(' ');

    /** El momento estrella: señalar y pedir cuentas. */
    case 'elDesviado':
      return [
        `${quien} ha votado ${ctx.voto} y la media de la mesa es ${ctx.media}.`,
        'Señálalo por su nombre, di los dos números y pídele que se explique delante de todos.',
        'Con guasa, no con bronca: es el momento gracioso de la reunión, no una regañina.',
      ].join(' ');

    case 'dosBandos':
      return [
        'La mesa se ha partido en dos grupos: unos lo ven pequeño y otros lo ven enorme.',
        'Dilo y mándalos a hablarlo antes de volver a votar.',
      ].join(' ');

    case 'cafe':
      return `${quien} ha pedido café en vez de votar. Coméntalo con complicidad, que tú vas por el tercero.`;

    case 'porro':
      return [
        `${quien} ha sacado la carta del porro: esto es demasiado grande para estimarlo.`,
        'Tradúcelo para la mesa: hay que partir la tarea en trozos.',
      ].join(' ');

    case 'nuevaRonda':
      return 'Se recogen las cartas y empieza otra ronda. Despide la anterior en una frase.';
  }
}

/** Los votos de la mesa, en crudo, para que no se invente nada. */
function datos(ctx: ContextoDelDealer): string {
  const mesa = ctx.mesa
    .map((uno) => `- ${uno.nombre}: ${uno.haVotado ? uno.voto : 'todavía no ha votado'}`)
    .join('\n');

  return [
    'DATOS REALES (no inventes otros, no cambies estos nombres ni estas cifras):',
    ctx.asunto ? `Se estima: ${ctx.asunto}` : 'La tarea no tiene nombre puesto.',
    mesa ? `La mesa:\n${mesa}` : 'La mesa está vacía.',
    ctx.media > 0 ? `Media ${ctx.media}, mediana ${ctx.mediana}, desviación ${ctx.desviacion}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
