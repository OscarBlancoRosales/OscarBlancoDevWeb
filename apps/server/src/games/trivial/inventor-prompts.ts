import { escaletaDe } from './banco';
import type { Tema, TipoPrueba } from '@devweb/shared/games/trivial/tipos';

/**
 * De qué van las preguntas.
 *
 * Se reparten a la fuerza porque a un modelo al que le pides preguntas de
 * programación te da diez de JavaScript. La variedad no sale sola.
 */
/** De qué van las de cultura general, que es el otro juego. */
export const TEMAS_GENERALES: readonly string[] = [
  'geografía',
  'historia',
  'cine y televisión',
  'música',
  'ciencia y naturaleza',
  'deporte',
  'arte y literatura',
  'España',
  'comida y bebida',
  'mitología',
  'inventos y descubrimientos',
  'el cuerpo humano',
];

export const TEMAS: readonly string[] = [
  'redes y protocolos',
  'bases de datos y SQL',
  'CSS y maquetación',
  'sistemas operativos y procesos',
  'control de versiones',
  'seguridad',
  'rendimiento y complejidad',
  'historia de la informática',
  'tipos y lenguajes de programación',
  'concurrencia y paralelismo',
  'HTTP y la web',
  'codificaciones y formatos',
];

/** Qué se le pide en cada prueba. La forma la impone el esquema; esto es el tono. */
export const ENCARGO_POR_PRUEBA: Readonly<Record<TipoPrueba, string>> = {
  test: 'cuatro opciones y una sola buena, de rarezas que se recuerdan. Las tres malas tienen que ser creíbles: si se descartan de un vistazo, la pregunta no vale',
  fallo: 'código de cuatro a ocho líneas NUMERADAS en "codigo", con UN error real. Las cuatro opciones son números de línea ("Línea 3") y el enunciado pregunta dónde está el fallo',
  estimacion: 'un número comprobable, "opciones" vacío, y "margen" con el error a partir del cual ya no se puntúa',
  pulsa: 'corta, de las que se saben o no se saben, con cuatro opciones. Tiene que leerse de un vistazo porque aquí se cobra por lanzarse el primero',
  rafaga: 'una afirmación que sea verdadera o falsa sin medias tintas. "opciones" vacío y "respuesta" exactamente "Verdadero" o "Falso"',
  bomba: 'cortísima, de una línea, con cuatro opciones breves. Se contesta con la mecha corriendo: nada de leer código ni de matices',
  final: 'gorda, de las que se recuerdan al salir, con cuatro opciones. No de dato suelto: de entender algo que casi todo el mundo cree saber',
};

/**
 * El encargo del programa entero, en una sola llamada.
 *
 * Una llamada y no siete: veintiuna preguntas son unos 2.500 tokens de salida y
 * los modelos que usamos admiten mucho más. Siete llamadas serían siete veces
 * la espera y siete veces la cuota, que es justo lo que no sobra.
 *
 * La dificultad se pide por posición en el programa, no dentro de cada sección:
 * lo que tiene que subir es la noche entera.
 */
export function encargoDelPrograma(tema: Tema = 'dev'): string {
  const secciones: string[] = [];
  let ronda = 1;

  for (const seccion of escaletaDe(tema)) {
    const desde = nivelEn(ronda, tema);
    const hasta = nivelEn(ronda + seccion.cuantas - 1, tema);
    secciones.push(
      `- ${seccion.cuantas} de tipo "${seccion.tipo}" (rondas ${ronda}-${ronda + seccion.cuantas - 1}, ` +
        `dificultad ${desde} a ${hasta}): ${ENCARGO_POR_PRUEBA[seccion.tipo]}`,
    );
    ronda += seccion.cuantas;
  }

  const total = ronda - 1;
  const de = tema === 'general' ? 'cultura general' : 'programación';
  const materias = tema === 'general' ? TEMAS_GENERALES : TEMAS;

  return [
    `Escribe las ${total} preguntas de un concurso de ${de}, en este orden exacto:`,
    '',
    secciones.join('\n'),
    '',
    `Temas, repartidos sin repetir más de dos veces: ${materias.join(', ')}.`,
    '',
    'Devuelve SOLO un array JSON con los objetos, sin texto alrededor.',
    'Cada objeto: {"enunciado","opciones","respuesta","explicacion","dificultad"},',
    'más "codigo" en las de tipo fallo y "margen" en las de tipo estimacion.',
    'No añadas ningún campo más: los objetos con campos de sobra se descartan.',
    '',
    '"respuesta" es el TEXTO de la opción correcta, copiado letra a letra de "opciones".',
    'Nunca un número ni una letra de opción: el texto.',
    '"explicacion" dice por qué en una o dos frases, y tiene que ser verdad.',
    '"dificultad" es un entero del 1 al 5.',
  ].join('\n');
}

/**
 * Qué dificultad le toca a la ronda que hace ese número.
 *
 * Del 1 al 5 repartido a lo largo del programa, así que la primera se contesta
 * de memoria y la última muerde. Es el crescendo, y sin él un programa de
 * veintiuna preguntas es una tanda larga.
 */
function nivelEn(ronda: number, tema: Tema = 'dev'): 1 | 2 | 3 | 4 | 5 {
  const total = escaletaDe(tema).reduce((suma, una) => suma + una.cuantas, 0);
  const parte = Math.ceil((ronda / total) * 5);
  return Math.min(5, Math.max(1, parte)) as 1 | 2 | 3 | 4 | 5;
}
