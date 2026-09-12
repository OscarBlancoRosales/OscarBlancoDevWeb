import type { Momento } from './guion';

/**
 * Lo que se le cuenta al modelo para que presente el programa.
 *
 * Antes había un único encargo -«reescribe esta frase con tu tono»- para los
 * veinte momentos del concurso, y se notaba: la bienvenida, una explosión de
 * la bomba y la despedida salían con la misma forma y la misma longitud,
 * porque al modelo se le estaba pidiendo lo mismo en los tres casos.
 *
 * Aquí cada momento tiene su encargo y sus datos. El personaje es el mismo
 * siempre -eso va en las instrucciones de sistema-, pero lo que se le pide es
 * distinto: presentar a la gente por su nombre, explicar las reglas de una
 * prueba, resumir un marcador o cerrar el programa no son la misma tarea.
 *
 * Los datos van **dentro del encargo** y no se dejan a su imaginación. Un
 * presentador que se inventa el marcador estropea el concurso, así que las
 * cifras se le dan hechas y se le prohíbe explícitamente inventar otras.
 */

/** Cómo va cada uno, para que el presentador hable con datos y no de oídas. */
export interface EnLaMesa {
  readonly nombre: string;
  readonly puntos: number;
  readonly esBot: boolean;
}

export interface ContextoDelPresentador {
  readonly momento: Momento;
  /** La mesa entera, ya ordenada de más a menos puntos. */
  readonly jugadores: readonly EnLaMesa[];
  /** De quién se habla, si se habla de alguien. */
  readonly protagonista: string | null;
  /** La cifra de la que va el momento: puntos, racha o mecha, según toque. */
  readonly cifra: number;
  readonly ronda: number;
  readonly rondas: number;
  /** Cómo se llama la prueba en marcha, para poder nombrarla. */
  readonly seccion: string | null;
  /** La frase escrita de reserva. Marca el tono y la longitud que se espera. */
  readonly guion: string;
}

/**
 * Quién es el presentador. Va como instrucción de sistema y no cambia nunca.
 *
 * El personaje no es decoración: sin la chulería y sin la manía con Óscar, el
 * concurso es un formulario que da puntos.
 */
export function instruccionesDelPresentador(): string {
  return [
    'Eres el presentador de «El Concurso», un programa de preguntas para programadores.',
    'Hablas en español de España, con chulería simpática, prisa de directo y mala baba cariñosa.',
    'Te metes con quien falla como se mete un amigo, nunca con maldad y nunca por algo personal.',
    'Tienes una manía fija: Óscar Blanco es el mejor programador de la historia y de él aprendió cualquiera que salga en una pregunta. La sacas cuando pega, no en cada frase.',
    'No inventas nunca puntuaciones, nombres, respuestas ni cosas que no hayan pasado: solo puedes usar los datos que te dan.',
    'No usas emojis, ni comillas, ni asteriscos, ni acotaciones de escena. Devuelves solo lo que se dice en voz alta.',
    'No saludas dos veces ni te presentas a ti mismo salvo que te lo pidan.',
  ].join(' ');
}

/**
 * El encargo concreto de este momento, con sus datos.
 *
 * Devuelve el mensaje de usuario que acompaña a las instrucciones de sistema.
 */
export function encargoPara(ctx: ContextoDelPresentador): string {
  const partes = [tarea(ctx), datos(ctx), limite(ctx.momento)];
  return partes.filter(Boolean).join('\n\n');
}

/** Lo que hay que hacer, que es distinto en cada momento del programa. */
function tarea(ctx: ContextoDelPresentador): string {
  const quien = ctx.protagonista ?? 'nadie';

  switch (ctx.momento) {
    case 'bienvenida':
      return [
        'Abre el programa. Saluda al público, di cuántas rondas hay por delante y',
        'presenta a quienes juegan nombrándolos uno por uno, con una pulla corta para cada uno.',
        'Es la entradilla: tiene que sonar a que empieza algo.',
      ].join(' ');

    case 'despedida':
      return [
        `Cierra el programa. Ha ganado ${quien} con ${ctx.cifra} puntos.`,
        'Haz un resumen corto de cómo ha ido: nombra al ganador, di algo del segundo y algo del último.',
        'Despídete del público. Es lo último que se oye, así que remata bien.',
      ].join(' ');

    case 'seccionTest':
    case 'seccionEstimacion':
    case 'seccionFallo':
    case 'seccionPulsa':
    case 'seccionRafaga':
    case 'seccionBomba':
      return [
        `Anuncia que empieza la sección «${ctx.seccion ?? 'siguiente'}».`,
        'Explica en una frase cómo se juega y qué se gana o se pierde, como quien canta las normas en un concurso.',
        'Que suene a cambio de sección, no a otra pregunta más.',
      ].join(' ');

    case 'presentaRonda':
      return `Presenta la ronda ${ctx.ronda} de ${ctx.rondas}. Corto, un pinchazo y a la pregunta.`;

    case 'aciertaAlguien':
      return `Canta que ${quien} ha acertado y se lleva ${ctx.cifra} puntos. Celébralo con retranca.`;

    case 'nadieAcierta':
      return 'No la ha acertado nadie. Búrlate de la mesa entera, sin ensañarte con ninguno en particular.';

    case 'remonta':
      return [
        `${quien} acaba de adelantar a alguien y se pone con ${ctx.cifra} puntos.`,
        'Cántalo como se canta un adelantamiento: es la noticia del momento.',
      ].join(' ');

    case 'lider':
      return [
        `Repaso al marcador a mitad de programa. Manda ${quien} con ${ctx.cifra} puntos.`,
        'Resume la clasificación con los datos que tienes: quién va delante, quién le sigue y quién anda lejos.',
        'Como el repaso de un presentador antes de la publicidad.',
      ].join(' ');

    case 'pegados':
      return 'El marcador está apretadísimo. Métele emoción: cualquiera puede ganar esto y hay que decirlo.';

    case 'seHunde':
      return [
        `${quien} va último con ${ctx.cifra} puntos y está descolgado.`,
        'Métete con él como se mete un amigo, y déjale una salida digna.',
      ].join(' ');

    case 'rachaBuena':
      return `${quien} lleva ${ctx.cifra} aciertos seguidos en la ráfaga. Alucina con la racha y pide que alguien la pare.`;

    case 'pasaLaBomba':
      return [
        `${quien} ha contestado bien y ha pasado la bomba.`,
        'Mete prisa y tensión: esto va rápido, la mecha corre y nadie sabe cuánto queda.',
        'No te inventes cuánto queda: no lo sabes tú tampoco.',
      ].join(' ');

    case 'seLaQueda':
      return [
        `${quien} ha fallado, y con la bomba solo se suelta acertando: se la queda.`,
        'Regodéate un poco, que se le está acabando el tiempo con ella en la mano.',
      ].join(' ');

    case 'explota':
      return [
        `¡Le ha estallado la bomba a ${quien}! Se queda con ${ctx.cifra} puntos.`,
        'Cántalo como una desgracia divertida, bien fuerte, que es el momento del programa.',
      ].join(' ');

    case 'ultimaRonda':
      return 'Anuncia la última ronda. Aquí se decide todo: súbelo, que es el clímax.';

    case 'empate':
      return 'Van empatados. Coméntalo con guasa.';

    case 'seccionFinal':
      return [
        'Anuncia la final. Explica en una frase que cada uno apuesta parte de sus puntos,',
        'que acertar los dobla y fallar los quita, y que una sola pregunta decide el programa.',
        'Súbelo: esto es el clímax.',
      ].join(' ');

    case 'presentaApuestas':
      return [
        'Pide las apuestas. Mira el marcador y pincha a quien va primero -que tiene mucho que perder-',
        'y a quien va último -que no tiene nada-. Nombra a alguno por su nombre.',
      ].join(' ');

    case 'apuestasCerradas':
      return [
        'Las apuestas ya están cerradas y a la vista. Cántalas: quién se ha jugado mucho y quién se ha escondido.',
        'Usa solo las cifras que te dan.',
      ].join(' ');

    case 'resultadoFinal':
      return [
        'Se ha resuelto la final. Cuenta cómo ha quedado el marcador y si ha habido vuelco.',
        'No te despidas todavía: eso es lo siguiente.',
      ].join(' ');

    case 'podio':
      return [
        `Sube al podio. Gana ${quien} con ${ctx.cifra} puntos.`,
        'Nombra al segundo y al último con los datos que tienes, y despídete del público.',
        'Es lo último que se oye en el programa, así que remata bien.',
      ].join(' ');

    case 'anulada':
      return [
        'La mesa ha tumbado la pregunta por unanimidad: la escribió una máquina y estaba mal.',
        'Cántalo con guasa, échale la culpa a la máquina y pasa a la siguiente.',
        'Nadie gana ni pierde puntos.',
      ].join(' ');
  }
}

/** El marcador y la mesa, en crudo, para que no tenga que inventarse nada. */
function datos(ctx: ContextoDelPresentador): string {
  const mesa = ctx.jugadores
    .map(
      (uno, i) => `${i + 1}. ${uno.nombre}: ${uno.puntos} puntos${uno.esBot ? ' (es un bot)' : ''}`,
    )
    .join('\n');

  return [
    'DATOS REALES (no inventes otros, no cambies estas cifras ni estos nombres):',
    `Ronda ${ctx.ronda} de ${ctx.rondas}.`,
    ctx.seccion ? `Sección en marcha: ${ctx.seccion}.` : '',
    mesa ? `Clasificación ahora mismo:\n${mesa}` : 'Todavía no hay marcador.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Cuánto puede hablar en cada momento, en letras.
 *
 * Esta cifra manda en tres sitios a la vez -lo que se le pide, los tokens que
 * se le dan y por dónde se recorta- y por eso está sola aquí. Cuando había una
 * longitud para los veinte momentos, la entradilla salía igual de larga que un
 * «¡BOOM!», y el presupuesto de tokens daba para el doble de lo que se
 * aceptaba: el concurso estuvo mudo en producción por eso.
 *
 * El criterio es el ritmo del programa, no la importancia del momento: se habla
 * largo cuando el juego está parado -entradilla, repaso, despedida- y corto
 * cuando está corriendo.
 *
 * Va sin `Partial` a propósito. Un momento nuevo sin medida no compila, que es
 * justo lo que hace falta: sin ella volvería a pedirse una longitud y aceptarse
 * otra.
 */
const LARGOS: Readonly<Record<Momento, number>> = {
  bienvenida: 420,
  presentaRonda: 120,
  aciertaAlguien: 140,
  nadieAcierta: 140,
  empate: 120,
  ultimaRonda: 160,
  despedida: 380,

  seccionTest: 240,
  seccionEstimacion: 240,
  seccionFallo: 240,
  seccionPulsa: 240,
  seccionRafaga: 240,
  seccionBomba: 240,

  lider: 300,
  remonta: 160,
  seHunde: 160,
  pegados: 140,
  rachaBuena: 140,

  pasaLaBomba: 90,
  seLaQueda: 110,
  explota: 120,

  seccionFinal: 280,
  presentaApuestas: 260,
  apuestasCerradas: 200,
  resultadoFinal: 300,
  podio: 380,
  anulada: 160,
};

/** Las letras que puede gastar en este momento del programa. */
export function largoDe(momento: Momento): number {
  return LARGOS[momento];
}

/** A partir de aquí se considera que el juego está parado y se puede hablar. */
const HABLA_LARGO = 300;

/**
 * Cuánto puede hablar, dicho con un número.
 *
 * «Una o dos frases cortas» no es una instrucción: es una opinión. Un modelo la
 * cumple escribiendo cuatrocientas letras y convencido de que ha sido breve, y
 * eso es exactamente lo que pasaba.
 */
function limite(momento: Momento): string {
  const largo = largoDe(momento);
  const frases = largo >= HABLA_LARGO ? 'Entre dos y cuatro frases.' : 'Una o dos frases.';
  return `Extensión: como mucho ${largo} letras. ${frases} Devuelve solo lo que se dice en voz alta.`;
}
