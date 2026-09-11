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
  /**
   * Si sigue en la mesa.
   *
   * Un asiento se queda cuando su dueño cierra la pestaña, así que sin esto el
   * crupier se pasa la ronda metiéndole prisa a gente que ya no está y diciendo
   * que faltan tres cuando en la sala hay uno.
   */
  readonly presente: boolean;
}

export interface ContextoDelDealer {
  readonly momento: MomentoDealer;
  readonly asunto: string;
  readonly mesa: readonly EnLaMesaDePoker[];
  /**
   * Si las cartas ya están boca arriba.
   *
   * Es el interruptor que decide qué se le cuenta al modelo. Con las cartas
   * boca abajo no ve un solo voto, y por eso no puede decirlos: un crupier que
   * canta lo que has puesto antes de destapar arruina la ronda, y como corre en
   * el servidor es el único de la mesa que podría hacerlo.
   */
  readonly revelado: boolean;
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
    'Mientras las cartas estén boca abajo no sabes lo que ha votado nadie, y no lo dices ni lo insinúas: lo que hay debajo de una carta boca abajo no se canta.',
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

    /*
     * El café y el porro se comentan **sin decir de quién son**.
     *
     * Son votos, y las cartas siguen boca abajo: decir que el café es de Rosa
     * es destapar la carta de Rosa. La broma del café funciona igual de bien
     * en abstracto, que es como la cuenta el guion escrito de toda la vida.
     */
    case 'cafe':
      return [
        'Alguien acaba de pedir café en vez de votar, pero no sabes quién y no lo puedes decir.',
        'Coméntalo en general, con complicidad, que tú vas por el tercero.',
      ].join(' ');

    case 'porro':
      return [
        'Alguien ha sacado la carta del porro: esto es demasiado grande para estimarlo.',
        'No sabes quién ha sido ni lo puedes decir.',
        'Tradúcelo para la mesa: hay que partir la tarea en trozos.',
      ].join(' ');

    case 'nuevaRonda':
      return 'Se recogen las cartas y empieza otra ronda. Despide la anterior en una frase.';
  }
}

/**
 * Lo que el crupier puede saber en este momento de la mano.
 *
 * Dos bloques distintos y no uno con recortes, porque son dos situaciones
 * distintas: con las cartas boca abajo lo único que hay sobre la mesa es quién
 * ha puesto y quién no; al destapar, la mesa entera. Antes iba siempre el mismo
 * bloque con todos los votos dentro, y de ahí salía el crupier cantando lo que
 * habías puesto media ronda antes de que se viera.
 */
function datos(ctx: ContextoDelDealer): string {
  return ctx.revelado ? datosDestapada(ctx) : datosEnJuego(ctx);
}

/**
 * Con las cartas boca abajo: quién ha puesto, quién falta, y nada más.
 *
 * Los dos grupos van con nombres **y con su cuenta**. La cuenta no es un
 * adorno: sin ella el modelo se lía contando nombres y acaba diciendo que
 * faltan tres cuando falta uno.
 */
function datosEnJuego(ctx: ContextoDelDealer): string {
  const enLaMesa = ctx.mesa.filter((uno) => uno.presente);
  const puestos = enLaMesa.filter((uno) => uno.haVotado).map((uno) => uno.nombre);
  const faltan = enLaMesa.filter((uno) => !uno.haVotado).map((uno) => uno.nombre);
  const idos = ctx.mesa.filter((uno) => !uno.presente).map((uno) => uno.nombre);

  return [
    'ESTADO: la mano está en juego. Las cartas siguen boca abajo.',
    ctx.asunto ? `Se estima: ${ctx.asunto}` : 'La tarea no tiene nombre puesto.',
    puestos.length > 0
      ? `Ya han puesto (${puestos.length} de ${enLaMesa.length}): ${puestos.join(', ')}.`
      : 'Todavía no ha puesto nadie.',
    faltan.length > 0
      ? `Faltan ${faltan.length} por poner: ${faltan.join(', ')}.`
      : 'No falta nadie por poner.',
    idos.length > 0 ? `Ya no están en la mesa: ${idos.join(', ')}. No les metas prisa.` : '',
    recuentoDeCartasRaras(ctx),
    'NO SABES lo que ha votado nadie: las cartas están boca abajo y eso no se ve hasta que se destapan. No digas números de nadie, ni los insinúes, ni te los inventes.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * La broma de los cafés, que sí se puede contar.
 *
 * Cuántos hay es un dato de la mesa y no de nadie en concreto... salvo cuando
 * lo es: si de los que han puesto **todos** pidieron café, decir cuántos hay es
 * decir lo que ha votado cada uno. En ese caso el crupier se calla.
 */
function recuentoDeCartasRaras(ctx: ContextoDelDealer): string {
  const puestos = ctx.mesa.filter((uno) => uno.presente && uno.haVotado);
  const cafes = puestos.filter((uno) => uno.voto.startsWith('café')).length;
  const porros = puestos.filter((uno) => uno.voto.startsWith('porro')).length;

  const delata = (cuantos: number): boolean =>
    cuantos === 0 || puestos.length < 2 || cuantos >= puestos.length;

  const trozos = [
    delata(cafes) ? '' : `${cafes} ${cafes === 1 ? 'café' : 'cafés'}`,
    delata(porros) ? '' : `${porros} ${porros === 1 ? 'porro' : 'porros'}`,
  ].filter(Boolean);

  return trozos.length > 0
    ? `Sobre la mesa hay ${trozos.join(' y ')}, pero no sabes de quién ni lo puedes decir.`
    : '';
}

/** Ya destapada: la mesa entera, para que no se invente nada. */
function datosDestapada(ctx: ContextoDelDealer): string {
  const mesa = ctx.mesa
    .map((uno) => `- ${uno.nombre}: ${uno.haVotado ? uno.voto : 'no votó'}`)
    .join('\n');

  return [
    'ESTADO: las cartas están destapadas. Ya se puede hablar de lo que ha votado cada uno.',
    'DATOS REALES (no inventes otros, no cambies estos nombres ni estas cifras):',
    ctx.asunto ? `Se estima: ${ctx.asunto}` : 'La tarea no tiene nombre puesto.',
    mesa ? `La mesa:\n${mesa}` : 'La mesa está vacía.',
    ctx.media > 0 ? `Media ${ctx.media}, mediana ${ctx.mediana}, desviación ${ctx.desviacion}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
