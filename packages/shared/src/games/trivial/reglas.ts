import type { Pregunta, Respuesta, TipoPrueba } from './tipos';
import type { SeatId } from '../module';

export const PUNTOS_ACIERTO = 100;

/**
 * Lo que se lleva por acertar pronto: 50 el primero, 35 el segundo, 20 el
 * tercero y 5 el cuarto. Del quinto en adelante, saber la respuesta ya vale
 * solo lo que vale saberla.
 */
export const BONUS_POR_ORDEN = [50, 35, 20, 5] as const;

/** De propina por clavar una estimación, que tiene mérito. */
export const PROPINA_EXACTA = 20;

/**
 * Lo que se lleva quien se lanza el primero y acierta, y lo que le cuesta
 * lanzarse y fallar.
 *
 * El premio es mayor que el de una pregunta normal y el castigo es real: sin
 * riesgo, «el primero que pulse» es una pregunta de siempre con otro nombre y
 * todo el mundo pulsa a ciegas.
 */
export const PUNTOS_PULSA = 150;
export const CASTIGO_PULSA = 50;

/** Cada acierto seguido de la ráfaga, y el tope al que llega el multiplicador. */
export const PUNTOS_RAFAGA = 40;
export const RACHA_MAXIMA = 5;

/** Acertar con la bomba en la mano, y lo que cuesta que te estalle. */
export const PUNTOS_BOMBA = 60;
export const CASTIGO_BOMBA = 120;

export function aciertaCon(pregunta: Pregunta, valor: number): boolean {
  return valor === pregunta.correcta;
}

/**
 * Lo que se lleva un asiento por su respuesta en esta ronda.
 *
 * En las pruebas de siempre nunca es negativo: restar por fallar enseña a no
 * contestar, y un concurso en el que nadie arriesga se muere solo. Solo restan
 * las dos pruebas que van de arriesgar -«el primero que pulse» y la bomba-, y
 * ahí el castigo es justamente lo que las hace valer la pena.
 */
export function puntosDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  seat: SeatId,
  racha = 0,
  apuesta = 0,
): number {
  const suya = respuestaDe(respuestas, seat);
  if (!suya) return 0;

  if (pregunta.tipo === 'estimacion') return puntosPorCercania(pregunta, suya.valor);

  const acierta = aciertaCon(pregunta, suya.valor);

  // La final no reparte bonus por rapidez: lo que se premia es lo que te
  // jugabas, no lo pronto que lo dijiste. Con bonus sería otra ronda normal.
  if (pregunta.tipo === 'final') return acierta ? apuesta : -apuesta;

  if (pregunta.tipo === 'pulsa') {
    // Solo cobra el primero que acierta; los demás llegan tarde aunque acierten.
    if (!acierta) return -CASTIGO_PULSA;
    return aciertosAntesDe(pregunta, respuestas, suya) === 0 ? PUNTOS_PULSA : 0;
  }

  if (pregunta.tipo === 'rafaga') {
    // El multiplicador es la racha que traías, no la que dejas: acertar la
    // primera vale uno, y la quinta seguida vale cinco.
    return acierta ? PUNTOS_RAFAGA * Math.min(racha + 1, RACHA_MAXIMA) : 0;
  }

  if (pregunta.tipo === 'bomba') {
    return acierta ? PUNTOS_BOMBA : -CASTIGO_BOMBA;
  }

  if (!acierta) return 0;
  return PUNTOS_ACIERTO + (BONUS_POR_ORDEN[aciertosAntesDe(pregunta, respuestas, suya)] ?? 0);
}

/**
 * La respuesta de un asiento, si contestó.
 *
 * `Record<SeatId, Respuesta>` afirma que todo asiento contestó, y no es verdad.
 * Aquí es donde se dice la verdad, y por eso el retorno lleva el `undefined`.
 */
export function respuestaDe(
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  seat: SeatId,
): Respuesta | undefined {
  return respuestas[seat];
}

/** Lo que gana cada uno en la ronda, de una vez. */
export function repartoDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  rachas: Readonly<Record<SeatId, number>> = {},
  apuestas: Readonly<Record<SeatId, number>> = {},
): Record<SeatId, number> {
  return Object.fromEntries(
    Object.keys(respuestas).map((seat) => [
      seat,
      puntosDe(pregunta, respuestas, seat, rachas[seat] ?? 0, apuestas[seat] ?? 0),
    ]),
  );
}

/**
 * Cuántos acertaron antes que él.
 *
 * Se cuentan los aciertos y no las respuestas: quien contesta rápido una
 * barbaridad no le quita el bonus al que acierta después. El premio es por
 * acertar pronto, no por pulsar pronto.
 */
function aciertosAntesDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  suya: Respuesta,
): number {
  return Object.values(respuestas).filter(
    (otra) => otra.orden < suya.orden && aciertaCon(pregunta, otra.valor),
  ).length;
}

/**
 * Lo que vale una estimación según lo cerca que se quede.
 *
 * El margen lo pone la pregunta, y por eso puede discriminar: en un año, veinte
 * de error es fallar; en «cuántos millones de líneas», veinte es clavarlo. Sin
 * margen declarado se cae en la proporción sobre la propia respuesta, que sirve
 * de red pero es mucho más generosa.
 */
function puntosPorCercania(pregunta: Pregunta, valor: number): number {
  const error = Math.abs(valor - pregunta.correcta);
  if (error === 0) return PUNTOS_ACIERTO + PROPINA_EXACTA;

  const margen = Math.max(1, pregunta.margen ?? Math.abs(pregunta.correcta));
  return Math.max(0, Math.round(PUNTOS_ACIERTO * (1 - error / margen)));
}

/**
 * Lo que dura cada prueba, en segundos.
 *
 * No es el mismo número para todas porque no cuesta lo mismo: en «encuentra el
 * fallo» hay que leer código y en la ráfaga se contesta con el estómago. La
 * prisa es parte de la prueba, así que estos números son reglas del juego y no
 * una preferencia de la pantalla.
 */
export const SEGUNDOS_POR_PRUEBA: Readonly<Record<TipoPrueba, number>> = {
  test: 25,
  fallo: 40,
  estimacion: 30,
  pulsa: 15,
  rafaga: 10,
  bomba: 12,
  // Con todo en juego se piensa, así que algo más que una pregunta normal.
  final: 30,
};

/**
 * Lo que se da para apostar en la final.
 *
 * Más que cualquier pregunta: aquí no se está contestando, se está decidiendo
 * cuánto del programa entero te juegas, y esa cuenta la hace todo el mundo
 * mirando el marcador.
 */
export const SEGUNDOS_PARA_APOSTAR = 45;

/**
 * Lo que se espera antes de pasar sola a la ronda siguiente. Cero: no pasa.
 *
 * Hay dos clases de prueba y este número es lo que las separa. Unas van de
 * saber: se contesta, se lee por qué, y se sigue cuando la mesa quiera. Otras
 * van de ritmo -reflejos, racha, mecha corriendo- y en esas el botón de
 * «siguiente» es el enemigo: deja que quien va con la bomba en la mano se tome
 * todo el tiempo del mundo justo cuando la gracia es no tenerlo, y convierte
 * una ráfaga en una tanda de preguntas con pausas.
 *
 * Tres segundos es lo que cuesta ver quién ha acertado y a quién le cae
 * encima. En la ráfaga, medio menos: ahí es que no dé tiempo ni a respirar.
 */
export const SEGUNDOS_PARA_PASAR: Readonly<Record<TipoPrueba, number>> = {
  test: 0,
  fallo: 0,
  estimacion: 0,
  // Va de reflejos: se cierra en cuanto alguien acierta, y pararla ahí a
  // esperar un clic apaga justo lo que la hace rápida.
  pulsa: 3,
  // Es una ráfaga. Un botón entre disparo y disparo no es una ráfaga.
  rafaga: 2.5,
  bomba: 3,
  // La última pregunta del programa: de ahí se sale al podio, no a otra ronda.
  final: 0,
};
