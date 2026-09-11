import type { Rng } from '../../engine/rng';

export const MOMENTOS = [
  'bienvenida',
  'presentaRonda',
  'aciertaAlguien',
  'nadieAcierta',
  'empate',
  'ultimaRonda',
  'despedida',
  // Las cortinillas de cada sección: lo que convierte una tanda de preguntas
  // en un programa con partes.
  'seccionTest',
  'seccionEstimacion',
  'seccionFallo',
  'seccionPulsa',
  'seccionRafaga',
  'seccionBomba',
  // Lo que pasa en el marcador, que es de lo que vive un presentador.
  'lider',
  'remonta',
  'seHunde',
  'pegados',
  'rachaBuena',
  // La bomba
  'pasaLaBomba',
  'explota',
] as const;

export type Momento = (typeof MOMENTOS)[number];

/**
 * Lo que el guion sabe de la partida al elegir una frase.
 *
 * Todo lo que va después de `rondas` es opcional porque el presentador no
 * siempre lo tiene: en la bienvenida no hay marcador todavía, y no se puede
 * hablar de quién va segundo cuando no ha contestado nadie. Una frase que
 * necesite un dato que falta sencillamente no se elige.
 */
export interface DatosDeLaFrase {
  readonly quien: string;
  readonly puntos: number;
  readonly ronda: number;
  readonly rondas: number;
  /** Quién va segundo y quién va último, para poder nombrarlos. */
  readonly segundo?: string;
  readonly ultimo?: string;
  /** Lo que el primero le saca al segundo. */
  readonly diferencia?: number;
  readonly seccion?: string;
  /** Si de quien se habla no hay nadie detrás. */
  readonly esBot?: boolean;
}

/** Lo mismo, ya con los huecos rellenos, para que las condiciones no duden. */
interface Situacion {
  readonly quien: string;
  readonly puntos: number;
  readonly ronda: number;
  readonly rondas: number;
  readonly segundo: string;
  readonly ultimo: string;
  readonly diferencia: number;
  readonly seccion: string;
  readonly esBot: boolean;
  /** Cuántas rondas quedan, contando la que se juega. */
  readonly quedan: number;
  /** Si sabemos quién va segundo y quién último. */
  readonly hayMarcador: boolean;
}

/**
 * Una frase del presentador y cuándo pega.
 *
 * Sin `cuando`, vale siempre. Con `cuando`, solo entra en el sorteo si la
 * partida está como dice: eso es lo que hace que el presentador parezca
 * enterarse de lo que pasa en vez de soltar frases sueltas.
 */
interface Linea {
  readonly texto: string;
  readonly cuando?: (donde: Situacion) => boolean;
}

// --- Las situaciones que se repiten, con nombre ---------------------------

const ARRANCANDO = (d: Situacion): boolean => d.ronda <= 2;
const RECTA_FINAL = (d: Situacion): boolean => d.quedan <= 3;
const PALIZA = (d: Situacion): boolean => d.hayMarcador && d.diferencia >= 300;
const AJUSTADO = (d: Situacion): boolean => d.hayMarcador && d.diferencia <= 60;
const ES_MAQUINA = (d: Situacion): boolean => d.esBot;
const ES_PERSONA = (d: Situacion): boolean => !d.esBot;
const CON_MARCADOR = (d: Situacion): boolean => d.hayMarcador;
const A_CERO = (d: Situacion): boolean => d.puntos === 0;

/**
 * Lo que dice el presentador en cada momento.
 *
 * Es texto escrito y determinista, no generado: sale de la semilla de la
 * partida, es igual para todos los que están en la mesa y funciona sin red.
 *
 * Y son muchas a propósito. Un presentador con tres frases por momento se
 * delata en la quinta ronda, cuando repite; con doce y eligiendo según lo que
 * acaba de pasar, cuesta bastante pillarle. Esa es toda la idea: no hay
 * ninguna IA detrás de esto, y tiene que dar igual.
 *
 * El personaje no es decoración: chulesco, con prisa, y con la manía de que
 * Óscar es el mejor programador de la historia. Quitarle eso es quitarle el
 * juego.
 */
const FRASES: Readonly<Record<Momento, readonly Linea[]>> = {
  bienvenida: [
    { texto: '¡Buenas noches, gente! {rondas} rondas, cero piedad y un jurado que soy yo. Las preguntas las revisó Óscar, así que si alguna es difícil, es que tú eres normal.' },
    { texto: 'Bienvenidos al concurso donde se viene llorado de casa. {rondas} preguntas. Óscar las contestaría todas dormido, pero le da pereza.' },
    { texto: 'Arrancamos. {rondas} rondas. Recordad: no estáis compitiendo entre vosotros, estáis compitiendo contra el nivel de Óscar, y eso ya lo habéis perdido.' },
    { texto: 'Señoras y señores, {rondas} preguntas por delante. Óscar preparó este concurso en un rato muerto, entre dos despliegues.' },
    { texto: 'Buenas noches. {rondas} rondas, seis pruebas y una final que se apuesta. Poneos cómodos, que luego no hay tiempo.' },
    { texto: 'Empezamos. {rondas} preguntas de las que duelen en la retro. Nadie se ha quejado nunca, porque nadie ha llegado al final con ganas de hablar.' },
    { texto: 'Muy buenas. Esto va de {rondas} rondas y de descubrir en público lo que no sabíais. Vamos allá.' },
    { texto: 'Bienvenidos. {rondas} rondas. El que diga que esto es fácil, que levante la mano y luego que la baje al ver la cuarta.' },
    { texto: 'Arrancamos el programa: {rondas} preguntas, seis secciones y una final a doble o nada. La casa siempre gana, y la casa soy yo.' },
    { texto: 'Buenas noches a todos. {rondas} rondas por delante. Aviso desde ya: aquí no vale buscarlo, las respuestas están en el servidor.' },
    { texto: '¡Empieza el concurso! {rondas} preguntas. Óscar dice que con menos de la mitad no se aprueba. Óscar es duro pero justo.' },
    { texto: 'Bienvenidos otra vez. {rondas} rondas. Y sí, la bomba sigue ahí al final, por si alguien tenía esperanza.' },
  ],

  presentaRonda: [
    { texto: 'Ronda {ronda} de {rondas}. Concentración, que esta la falla mucha gente.' },
    { texto: 'Vamos con la {ronda}. Óscar dice que esta es fácil, pero él dice eso de todas.' },
    { texto: 'Ronda {ronda}. Y no, mirar al techo no la contesta.' },
    { texto: 'La {ronda} de {rondas}. A ver quién se moja.' },
    { texto: 'Seguimos. Ronda {ronda}. Sin prisa pero sin pausa, que es mentira: con prisa.' },
    { texto: 'Ronda {ronda}. Leedla entera, que luego vienen los lloros.' },
    { texto: 'Allá va la {ronda}. Esta la sabe todo el mundo hasta que la lee.' },
    { texto: 'Ronda {ronda} de {rondas}. Silencio en la sala.' },
    { texto: 'Vamos con la {ronda}. Ojo, que parece sencilla.' },
    { texto: 'Aún estamos calentando. Ronda {ronda}.', cuando: ARRANCANDO },
    { texto: 'Ronda {ronda}, todavía con red. Luego ya veremos.', cuando: ARRANCANDO },
    { texto: 'Ronda {ronda}, y quedan {quedan}. Esto se acaba, id espabilando.', cuando: RECTA_FINAL },
    { texto: 'Ronda {ronda}. Quedan {quedan} y el marcador ya no perdona.', cuando: RECTA_FINAL },
    { texto: 'Ronda {ronda}. Con esto tan apretado, cada una vale doble.', cuando: AJUSTADO },
  ],

  aciertaAlguien: [
    { texto: '¡{quien}, correcto! {puntos} puntos. A este ritmo casi llegas al día bueno de Óscar.' },
    { texto: '{quien} lo clava y se lleva {puntos}. Bien. No es nivel Óscar, pero está bien.' },
    { texto: 'Toma ya, {quien}. {puntos} puntos. Óscar estaría orgulloso, si mirara.' },
    { texto: '{quien} acierta y suma {puntos}. Alguien ha estado leyendo.' },
    { texto: 'Correcta, {quien}. {puntos} puntos para la saca.' },
    { texto: 'Ahí está. {quien}, {puntos} puntos y cara de que lo sabía desde el principio.' },
    { texto: '{quien} la borda. {puntos} puntos. Que conste que esa la fallaba yo.' },
    { texto: 'Bien jugado, {quien}: {puntos} puntos. Sin dudar, además.' },
    { texto: '{quien} suma {puntos}. Los demás, tomad nota, que se puede.' },
    { texto: 'Correcto. {puntos} para {quien}, que hoy viene enchufado.' },
    { texto: '{quien} se lleva {puntos} y le mete presión a {segundo}.', cuando: CON_MARCADOR },
    { texto: 'Acierta {quien}: {puntos} puntos. {ultimo}, esto se te está poniendo feo.', cuando: CON_MARCADOR },
    { texto: '{quien} acierta la primera. Buen comienzo: {puntos} puntos.', cuando: ARRANCANDO },
    { texto: '¡{quien}! {puntos} puntos, y en el mejor momento.', cuando: RECTA_FINAL },
    { texto: '{puntos} puntos para {quien} cuando más pesan. Esto cambia cosas.', cuando: RECTA_FINAL },
  ],

  nadieAcierta: [
    { texto: 'Nadie. Ni uno. Óscar la habría contestado antes de terminar de leerla.' },
    { texto: 'Vaya. Silencio absoluto. Esto sí que es trabajo en equipo.' },
    { texto: 'Cero aciertos. Voy a hacer como que no lo he visto.' },
    { texto: 'Nada de nada. Óscar, si estás viendo esto, no juzgues a esta gente.' },
    { texto: 'Ni una. Os juro que la pregunta estaba bien.' },
    { texto: 'Pleno de fallos. Enhorabuena, es más difícil que acertarla.' },
    { texto: 'Nadie la tenía. Tranquilos, esta se falla mucho. Menos Óscar, que no.' },
    { texto: 'Ninguno. Y ahora todos vais a decir que la sabíais.' },
    { texto: 'Cero. Que alguien abra una ventana, que aquí hace falta aire.' },
    { texto: 'Fallo general. Lo bueno es que así nadie se despega.' },
    { texto: 'Nadie acierta y el marcador se queda como estaba. {quien} respira.', cuando: CON_MARCADOR },
    { texto: 'Ni uno. Con lo apretado que está esto, mejor para todos.', cuando: AJUSTADO },
    { texto: 'Nadie. Y a estas alturas, fallar en bloque ya es una decisión.', cuando: RECTA_FINAL },
  ],

  empate: [
    { texto: 'Empate. Qué bonito y qué poco emocionante.' },
    { texto: 'Van igualados. Óscar diría que eso es que la pregunta estaba mal calibrada.' },
    { texto: 'Empatados. Alguien va a tener que arriesgar.' },
    { texto: 'Mismos puntos. Esto se decide en la siguiente, avisados quedáis.' },
    { texto: 'Iguales. Da gusto y da rabia a partes iguales.' },
    { texto: 'Empate técnico y emocional. Seguimos.' },
    { texto: 'Nadie se despega. Así da gusto presentar.' },
    { texto: 'Empate. Que alguien haga algo, por favor.' },
    { texto: 'Igualdad absoluta. {quien} y {segundo}, cara a cara.', cuando: CON_MARCADOR },
    { texto: 'Empatados y quedan {quedan}. Esto va a doler.', cuando: RECTA_FINAL },
  ],

  ultimaRonda: [
    { texto: '¡Última ronda! Aquí se decide todo. Óscar ya sabe quién va a ganar, pero no lo suelta.' },
    { texto: 'Y llegamos a la última. Lo que no sepáis ya, no lo vais a saber.' },
    { texto: 'Última pregunta. Respirad hondo, que esto no es la producción de un viernes.' },
    { texto: '¡La última! Todo lo de antes era para llegar aquí.' },
    { texto: 'Se acaba. Última ronda, y pesa el doble que las otras veinte.' },
    { texto: 'Última. El que se la juegue, que se la juegue ya.' },
    { texto: 'Y hasta aquí hemos llegado: última ronda. A ver quién aguanta.' },
    { texto: 'La última. Óscar dice que la clave está en leerla despacio. Pero no hay tiempo.' },
    { texto: '¡Última ronda! {quien} manda por {diferencia}, pero esto no está cerrado.', cuando: CON_MARCADOR },
    { texto: 'Última, y con {diferencia} de diferencia esto se decide aquí mismo.', cuando: AJUSTADO },
    { texto: 'Última ronda. {quien} lo tiene hecho salvo catástrofe, y me encantan las catástrofes.', cuando: PALIZA },
  ],

  despedida: [
    { texto: '¡Y hasta aquí! Gana {quien} con {puntos} puntos. Un aplauso, y otro para Óscar, que sigue siendo el mejor programador de la historia.' },
    { texto: 'Se acabó. {quien} se lleva el concurso con {puntos}. Segundo puesto para todos los demás y primero, siempre, para Óscar.' },
    { texto: 'Fin del concurso. {quien}, {puntos} puntos, enhorabuena. Óscar dice que lo ha hecho bien, y de Óscar aprendimos todos.' },
    { texto: 'Cerramos. Gana {quien} con {puntos} puntos. Recordad de dónde salió todo esto: de Óscar, el maestro.' },
    { texto: 'Y se acabó el programa. {quien} gana con {puntos}. Óscar lo habría hecho con los ojos cerrados, pero no se lo tengáis en cuenta.' },
    { texto: 'Hasta aquí. Victoria para {quien}, {puntos} puntos. Gracias a todos y gracias a Óscar, que escribió las preguntas y la mitad de internet.' },
    { texto: 'Fin. {quien} se lo lleva con {puntos}. Un aplauso para el ganador y una reverencia para Óscar.' },
    { texto: 'Se cierra el programa. {quien}, {puntos} puntos, campeón. Óscar sonríe desde algún despliegue.' },
    { texto: 'Gana {quien} con {puntos}, y {segundo} se queda a las puertas. Óscar, como siempre, por encima de todos.', cuando: CON_MARCADOR },
    { texto: 'Se acabó: {quien} con {puntos}, {segundo} segundo y {ultimo} cerrando. Gracias a Óscar por las preguntas y por todo lo demás.', cuando: CON_MARCADOR },
  ],

  seccionTest: [
    { texto: 'Sección de preguntas. Cuatro opciones, una buena y tres que parecen buenas.' },
    { texto: 'Vamos con el test clásico. A ver si alguien ha abierto un libro este año.' },
    { texto: 'Test. Como en la carrera, pero sin poder copiar al de al lado.' },
    { texto: 'Empieza el test: cuatro opciones, cien puntos por acertar y más si acertáis pronto.' },
    { texto: 'Sección de test. Las tres malas están puestas con cariño, para que duelan.' },
    { texto: 'Llega el test. Aquí se ve quién lo sabe y quién se acuerda vagamente.' },
    { texto: 'Test clásico. Leed las cuatro antes de lanzaros, que luego pasa lo que pasa.' },
    { texto: 'Cuatro opciones, una buena. Suena fácil dicho así.' },
    { texto: 'Arrancamos con el test, que es la parte amable del programa.', cuando: ARRANCANDO },
    { texto: 'Test, y a estas alturas ya no hay excusas.', cuando: RECTA_FINAL },
  ],

  seccionEstimacion: [
    { texto: 'Ahora, a calcular. No hay opciones: hay que mojarse con un número.' },
    { texto: 'Sección de estimaciones. Aquí no vale sonar convincente, vale acertar.' },
    { texto: 'A ojo. Como cuando dais plazos, pero esto sí se comprueba.' },
    { texto: 'Llega «a ojo»: un número, sin opciones y sin red.' },
    { texto: 'Estimaciones. Cuanto más cerca, más puntos. Clavarlo tiene premio.' },
    { texto: 'Sección de calcular. Óscar estima bien porque Óscar lo sabe, que no es estimar.' },
    { texto: 'A ojo, señores. El que redondee bien, gana.' },
    { texto: 'Ahora se escribe el número. Nada de elegir, nada de sonar seguro.' },
    { texto: 'Estimaciones, y con el marcador así conviene no pasarse de listo.', cuando: AJUSTADO },
    { texto: 'A ojo. {ultimo}, esta es tu oportunidad de arreglar la tarde.', cuando: CON_MARCADOR },
  ],

  seccionFallo: [
    { texto: 'Encontrad el fallo. Uno solo. Está ahí, mirándoos.' },
    { texto: 'Sección de depuración. Como un martes por la mañana, pero cronometrado.' },
    { texto: 'Ahí tenéis el código. Alguien lo escribió y alguien lo aprobó. Buscad.' },
    { texto: 'Llega «encuentra el fallo». Un error, y está a la vista.' },
    { texto: 'Código en pantalla. El fallo existe, os lo prometo.' },
    { texto: 'Sección de leer código ajeno, que es el noventa por ciento del oficio.' },
    { texto: 'A buscar el error. Aquí se tarda más, así que os doy más tiempo. De nada.' },
    { texto: 'Encuentra el fallo. Óscar lo ve desde la puerta, pero él es él.' },
    { texto: 'Depuración en directo. Y sin poder añadir un console.log, que sería trampa.' },
    { texto: 'A leer código. {quien} va sobrado, a ver si esta le baja los humos.', cuando: PALIZA },
  ],

  seccionPulsa: [
    { texto: '¡El primero que pulse! Solo cobra quien se lanza antes, y equivocarse cuesta. Suerte.' },
    { texto: 'Atención: aquí gana el que se moja. El que duda, mira.' },
    { texto: 'Sección de reflejos. Pulsar rápido y mal os va a salir caro.' },
    { texto: 'El primero que pulse. Ciento cincuenta por acertar, cincuenta menos por fallar.' },
    { texto: 'Llega la de los valientes. Solo cobra el primero, así que o sabéis o calláis.' },
    { texto: 'A pulsar. Aquí la duda no se paga: se cobra en contra.' },
    { texto: 'Sección de lanzarse. El que espere a estar seguro, llega tarde.' },
    { texto: 'El primero que pulse, y ojo, que fallar resta de verdad.' },
    { texto: 'A pulsar. {ultimo}, esta es de las que te devuelven al concurso.', cuando: CON_MARCADOR },
    { texto: 'El primero que pulse, y con esto tan igualado, aquí se decide.', cuando: AJUSTADO },
  ],

  seccionRafaga: [
    { texto: '¡Ráfaga! Verdadero o falso, una detrás de otra, y encadenar multiplica.' },
    { texto: 'Llega la ráfaga. Sin pensar, que para pensar ya estaba la sección anterior.' },
    { texto: 'Verdadero o falso a toda leche. El que enlaza, arrasa.' },
    { texto: 'Ráfaga. Diez segundos por pregunta y a tirar de estómago.' },
    { texto: 'Sección de ráfaga: encadenad aciertos y el multiplicador hace el resto.' },
    { texto: 'Verdadero o falso. Aquí no hay medias tintas ni medias respuestas.' },
    { texto: 'Llega lo rápido. Cinco seguidas y os ponéis en cabeza vosotros solos.' },
    { texto: 'Ráfaga, señores. Al que piense mucho se le acaba el tiempo.' },
    { texto: 'Ráfaga. {ultimo}, una racha aquí y vuelves al programa.', cuando: CON_MARCADOR },
    { texto: 'Ráfaga, y con {diferencia} de diferencia esto se puede dar la vuelta en un minuto.', cuando: PALIZA },
  ],

  seccionBomba: [
    { texto: '¡LA BOMBA! Va pasando de mano en mano y explota cuando le da la gana. Que no os pille con ella.' },
    { texto: 'Sección de la bomba. Contestad rápido y pasadla, que quema.' },
    { texto: 'Y llega la bomba. Óscar dice que él nunca la ha perdido. Yo no le he visto jugar, pero le creo.' },
    { texto: 'La bomba. Sesenta por acertar, ciento veinte menos si te estalla. Haced cuentas.' },
    { texto: 'Llega la bomba, que es donde se dan los vuelcos de verdad.' },
    { texto: 'Bomba en la mesa. Contestas y la pasas; dudas y te la comes.' },
    { texto: 'La sección de la bomba. Nadie sabe cuánta mecha queda, y esa es la gracia.' },
    { texto: '¡La bomba! Lo que llevéis ganado se puede ir aquí en dos turnos.' },
    { texto: 'La bomba, y con esto tan ajustado va a decidir el programa.', cuando: AJUSTADO },
    { texto: 'Llega la bomba. {quien} tiene mucho que perder y {ultimo} no tiene nada.', cuando: CON_MARCADOR },
  ],

  lider: [
    { texto: 'Vamos a mirar el marcador: manda {quien} con {puntos}. Todavía se puede arreglar.' },
    { texto: 'Ahí arriba está {quien}, con {puntos} puntos. Los demás, a currárselo.' },
    { texto: 'Marcador: {quien} en cabeza con {puntos}. Óscar diría que va por buen camino.' },
    { texto: 'Repaso: {quien} lidera con {puntos} puntos. Queda programa.' },
    { texto: 'Manda {quien}, {puntos} puntos. Y lo sabe, que es lo que más rabia da.' },
    { texto: 'Primero {quien} con {puntos}. Segundo, {segundo}. Y cerrando, {ultimo}.', cuando: CON_MARCADOR },
    { texto: 'Marcador en mano: {quien} con {puntos}, {segundo} pegado detrás y {ultimo} buscándose la vida.', cuando: CON_MARCADOR },
    { texto: '{quien} manda con {puntos} y le saca {diferencia} a {segundo}. Esto empieza a oler a sentencia.', cuando: PALIZA },
    { texto: 'Ojo al marcador: {quien} va primero pero solo por {diferencia}. Esto no está decidido ni de lejos.', cuando: AJUSTADO },
    { texto: '{quien} arriba con {puntos}, y {diferencia} de colchón. Yo no me confiaría.', cuando: CON_MARCADOR },
    { texto: 'Repaso al marcador y {quien} sigue arriba con {puntos}. {ultimo}, quedan {quedan}.', cuando: CON_MARCADOR },
    { texto: 'Manda una máquina, {quien}, con {puntos}. Qué vergüenza, señores.', cuando: ES_MAQUINA },
  ],

  remonta: [
    { texto: '¡{quien} adelanta! Se pone con {puntos}. Esto ha cambiado.' },
    { texto: 'Ojo, que {quien} se ha colado por delante. {puntos} puntos.' },
    { texto: 'Remontada de {quien}, que se planta en {puntos}. Bien jugado.' },
    { texto: '¡Cambio en cabeza! {quien}, {puntos} puntos. No me lo esperaba.' },
    { texto: '{quien} pasa por encima y se pone con {puntos}. Ahí va eso.' },
    { texto: 'Se da la vuelta la tortilla: {quien} manda con {puntos}.' },
    { texto: '¡{quien} adelanta a {segundo} y se pone con {puntos}!', cuando: CON_MARCADOR },
    { texto: 'Adelantamiento de {quien}. {segundo}, te acaban de pasar por la derecha.', cuando: CON_MARCADOR },
    { texto: '¡Remonta {quien} y lo hace en la recta final! {puntos} puntos.', cuando: RECTA_FINAL },
    { texto: 'Adelanta la máquina. {quien} se pone con {puntos} y yo no sé dónde meterme.', cuando: ES_MAQUINA },
  ],

  seHunde: [
    { texto: '{quien} va con {puntos}. No quiero decir que esté perdido, pero está lejísimos.' },
    { texto: 'Un aplauso para {quien}, que sigue ahí aunque el marcador diga otra cosa.' },
    { texto: 'Y {quien}, con {puntos}. Óscar dice que lo importante es participar. Óscar miente.' },
    { texto: '{quien} anda por {puntos}. Hay tiempo. Poco, pero hay.' },
    { texto: 'Mención especial para {quien}: {puntos} puntos y una dignidad intacta.' },
    { texto: '{quien} se está quedando descolgado con {puntos}. Que alguien le eche una mano.' },
    { texto: 'Pobre {quien}, {puntos} puntos. Esto ya no es un bache, es un socavón.' },
    { texto: '{quien} lleva {puntos}. Le saca {diferencia} el de arriba. Ánimo, campeón.', cuando: CON_MARCADOR },
    { texto: '{quien} a {puntos} y quedan {quedan} rondas. Las matemáticas no ayudan.', cuando: RECTA_FINAL },
    { texto: '{quien} sigue a cero. Cero. Ni por casualidad ha caído una.', cuando: A_CERO },
    { texto: 'La máquina va última con {puntos}. Al menos eso lo hemos ganado hoy.', cuando: ES_MAQUINA },
    { texto: 'Y a {quien} le acompañamos en el sentimiento: {puntos} puntos.', cuando: ES_PERSONA },
  ],

  pegados: [
    { texto: 'Esto está apretadísimo. Cualquiera de vosotros puede ganar esto.' },
    { texto: 'Marcador pegado. Me encanta cuando pasa esto y no lo digo por decir.' },
    { texto: 'Van todos a un palmo. Aquí la siguiente decide.' },
    { texto: 'Nadie se despega. Esto se va a decidir en la final, ya os lo digo.' },
    { texto: 'Qué igualdad, señores. Un acierto y cambia todo.' },
    { texto: 'Esto está para infartos. Y quedan {quedan} rondas.' },
    { texto: 'Marcador de fotografía. {quien} y {segundo} separados por {diferencia}.', cuando: CON_MARCADOR },
    { texto: 'Solo {diferencia} puntos entre el primero y el segundo. Esto no lo escribe nadie.', cuando: CON_MARCADOR },
    { texto: 'Apretadísimo y en la recta final. Que alguien traiga el desfibrilador.', cuando: RECTA_FINAL },
  ],

  rachaBuena: [
    { texto: '¡{quien} lleva {puntos} seguidas! Que alguien la pare.' },
    { texto: '{puntos} aciertos encadenados de {quien}. Esto ya no es suerte.' },
    { texto: 'Racha de {puntos} para {quien}. Nivel Óscar, casi.' },
    { texto: '{quien} no falla una. {puntos} seguidas y subiendo.' },
    { texto: '¡Qué racha! {puntos} de {quien}, y el multiplicador echando humo.' },
    { texto: '{quien} está en modo máquina: {puntos} seguidas.' },
    { texto: 'Van {puntos} encadenadas de {quien}. Esto empieza a ser un problema para los demás.' },
    { texto: '{puntos} seguidas. {quien} se está llevando la sección él solito.' },
    { texto: '{quien} lleva {puntos} y le está sacando {diferencia} al segundo. Se acabó la igualdad.', cuando: CON_MARCADOR },
    { texto: 'La máquina lleva {puntos} seguidas. Alguien humano que haga algo, por favor.', cuando: ES_MAQUINA },
  ],

  pasaLaBomba: [
    { texto: '{quien} la suelta a tiempo. Quedan {puntos} respuestas de mecha.' },
    { texto: 'Bien, {quien}, fuera esa bomba. {puntos} de mecha. Corre.' },
    { texto: 'Pasa la bomba {quien}. Quedan {puntos}. Que empiece el sudor.' },
    { texto: '{quien} se la quita de encima. {puntos} de mecha.' },
    { texto: 'Fuera. {quien} acierta y pasa. Quedan {puntos}.' },
    { texto: 'Bomba entregada. {puntos} de mecha y bajando.' },
    { texto: '{quien} sobrevive. {puntos} respuestas más y explota.' },
    { texto: 'La suelta {quien}. Ojo, {puntos} de mecha, esto se acaba.' },
    { texto: '{quien} la pasa con {puntos} de mecha. Aquí ya es cuestión de suerte.' },
    { texto: 'Pasa {quien}. Queda {puntos}. La siguiente puede ser la última.' },
  ],

  explota: [
    { texto: '¡BOOM! Le estalla a {quien}. Se queda en {puntos}. Una pena, oye.' },
    { texto: 'Se acabó para {quien}: explota en sus manos. {puntos} puntos. Ay.' },
    { texto: '¡Pum! {quien}, {puntos}. Óscar la habría pasado hace tres turnos.' },
    { texto: '¡Explota! Y le pilla a {quien}, que se queda con {puntos}.' },
    { texto: 'Y BOOM. {quien} se come la bomba entera. {puntos} puntos.' },
    { texto: '¡Ahí va! Le revienta a {quien}. {puntos}. Qué mala suerte, o qué mal cálculo.' },
    { texto: 'Estalla. {quien}, {puntos} puntos y la cara de quien no se lo esperaba.' },
    { texto: '¡Se acabó! La bomba elige a {quien}. {puntos} puntos.' },
    { texto: '¡Pum! {quien} a {puntos}. {segundo} no puede disimular la alegría.', cuando: CON_MARCADOR },
    { texto: 'Le estalla a {quien} en la recta final. {puntos}. Esto puede costarle el concurso.', cuando: RECTA_FINAL },
    { texto: 'Explota en las manos de la máquina. {puntos} puntos. Justicia poética.', cuando: ES_MAQUINA },
  ],
};

/**
 * La frase de ese momento.
 *
 * `yaDichas` es cuántas veces se ha usado ya ese momento en este programa, y es
 * lo que impide repetir: el azar decide por dónde se empieza y a partir de ahí
 * se recorren todas antes de volver a la primera. Sorteando cada vez, con doce
 * frases y cuatro usos la probabilidad de repetir pasa del cuarenta por ciento,
 * y una frase repetida delata al guion más que cualquier otra cosa.
 */
export function frasePara(
  momento: Momento,
  datos: DatosDeLaFrase,
  rng: Rng,
  yaDichas = 0,
): string {
  const donde = completar(datos);
  const todas = FRASES[momento];

  // Las que piden una situación concreta van primero; si ninguna pega, quedan
  // las de siempre, que valen para cualquier momento del programa.
  const pegan = todas.filter((linea) => !linea.cuando || linea.cuando(donde));
  const candidatas = pegan.length > 0 ? pegan : todas.filter((linea) => !linea.cuando);

  // Siempre queda alguna: cada momento tiene frases sin condición, que es lo
  // que garantiza que el presentador nunca se quede sin nada que decir.
  const inicio = rng.int(0, candidatas.length - 1);
  const elegida = candidatas[(inicio + yaDichas) % candidatas.length];
  return rellenar(elegida.texto, donde);
}

/**
 * Los datos que faltan, puestos por defecto.
 *
 * `hayMarcador` es la pieza importante: dice si se puede hablar de quién va
 * segundo. Sin él, la bienvenida acabaría nombrando a un «alguien» que no
 * existe, que es peor que no nombrar a nadie.
 */
function completar(datos: DatosDeLaFrase): Situacion {
  return {
    quien: datos.quien,
    puntos: datos.puntos,
    ronda: datos.ronda,
    rondas: datos.rondas,
    segundo: datos.segundo ?? '',
    ultimo: datos.ultimo ?? '',
    diferencia: datos.diferencia ?? 0,
    seccion: datos.seccion ?? '',
    esBot: datos.esBot ?? false,
    quedan: Math.max(0, datos.rondas - datos.ronda),
    hayMarcador: !!datos.segundo && !!datos.ultimo,
  };
}

function rellenar(plantilla: string, donde: Situacion): string {
  return plantilla
    .replaceAll('{quien}', donde.quien)
    .replaceAll('{puntos}', String(donde.puntos))
    .replaceAll('{ronda}', String(donde.ronda))
    .replaceAll('{rondas}', String(donde.rondas))
    .replaceAll('{segundo}', donde.segundo)
    .replaceAll('{ultimo}', donde.ultimo)
    .replaceAll('{diferencia}', String(donde.diferencia))
    .replaceAll('{seccion}', donde.seccion)
    .replaceAll('{quedan}', String(donde.quedan));
}
