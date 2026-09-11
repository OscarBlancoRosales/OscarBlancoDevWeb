/**
 * Cuánto puede hablar el presentador, y qué se hace con lo que se pasa.
 *
 * Existe por un fallo concreto: se le pedían 120 tokens -unas 480 letras en
 * español- y se rechazaba todo lo que pasara de 320. Diez de diez frases a la
 * basura, y el concurso mudo en producción con la IA funcionando perfectamente.
 *
 * La cura es que haya **una sola cifra**: la medida del momento. De ella sale
 * el presupuesto que se le pide al modelo y por ella se recorta lo que
 * devuelve. Mientras las dos salgan de aquí, no se pueden volver a contradecir.
 */

/** Lo mínimo que se pide, para que quepa una frase aunque la medida sea corta. */
const SUELO = 16;

/**
 * Los tokens que se le piden para una medida dada.
 *
 * Se divide por tres y no por cuatro -que es lo que da un token en español- a
 * propósito: deja un poco de holgura para que termine la última frase en vez de
 * cortarla a mitad, sin darle cuerda para un discurso.
 */
export function presupuestoDe(largo: number): number {
  return Math.max(SUELO, Math.ceil(largo / 3));
}

/** Lo que hay que quitar de los lados: el modelo envuelve de más. */
const ENVOLTORIOS = /^[\s"'«»*_]+|[\s"'«»*_]+$/g;

/** Por dónde acaba una frase. */
const FIN_DE_FRASE = new Set(['.', '!', '?', '…']);

/** Menos de esto no es una frase, es un ruido. */
const MINIMO_UTIL = 5;

/**
 * Lo que se puede enseñar de lo que ha dicho, o `null` si no hay nada.
 *
 * Se corta por frases enteras y nunca a mitad de palabra: media frase del
 * presentador suena a fallo, y la frase escrita de reserva suena bien. Cuando
 * esto devuelve `null`, quien llama se queda con el guion.
 */
export function recortar(texto: string, largo: number): string | null {
  const limpio = texto.replace(ENVOLTORIOS, '');
  if (limpio.length <= MINIMO_UTIL) return null;
  if (limpio.length <= largo) return limpio;

  const corte = ultimoFinDeFraseHasta(limpio, largo);
  return corte > 0 ? limpio.slice(0, corte).trimEnd() : null;
}

/**
 * Dónde acaba la última frase que cabe entera.
 *
 * Devuelve 0 si no acaba ninguna dentro del límite, que es la señal de que no
 * hay nada aprovechable. Se recorre por letras y no por posiciones para que un
 * emoji, que ocupa dos, no parta el corte por la mitad.
 */
function ultimoFinDeFraseHasta(texto: string, largo: number): number {
  let corte = 0;
  let donde = 0;

  for (const letra of texto.slice(0, largo)) {
    donde += letra.length;
    if (FIN_DE_FRASE.has(letra)) corte = donde;
  }

  return corte;
}
