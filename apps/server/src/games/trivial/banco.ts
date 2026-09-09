import { createRng, shuffle } from '@devweb/shared/engine/rng';
import type { Pregunta } from '@devweb/shared/games/trivial/tipos';

/** Cuántas rondas tiene una partida. */
export const PREGUNTAS_POR_PARTIDA = 10;

/**
 * Las preguntas, con sus respuestas.
 *
 * Vive en el servidor y **no se importa nunca desde `apps/web`**. Es el único
 * sitio donde las respuestas no se pueden mirar: en un concurso de programadores,
 * meterlas en el bundle es repartir la chuleta con las preguntas.
 *
 * Ampliarlo es escribir aquí. El formato es lo más tonto posible a propósito,
 * porque diez preguntas nuevas valen más que cualquier refactor de este fichero.
 */
export const BANCO: readonly Pregunta[] = [
  // --- Rarezas del lenguaje -------------------------------------------------
  {
    id: 'js-typeof-null',
    tipo: 'test',
    enunciado: '¿Qué devuelve typeof null en JavaScript?',
    opciones: ['"null"', '"object"', '"undefined"', 'Lanza un TypeError'],
    correcta: 1,
    explicacion:
      'Un fallo de la primera implementación de 1995: los objetos se marcaban con los tres bits bajos a cero y null era el puntero nulo. Arreglarlo rompería media web.',
  },
  {
    id: 'js-suma-arrays',
    tipo: 'test',
    enunciado: '¿Qué imprime esto?',
    codigo: 'console.log([] + {});\nconsole.log({} + []);',
    opciones: [
      '"[object Object]" y "[object Object]"',
      '"[object Object]" y 0',
      '0 y 0',
      'Lanza un TypeError',
    ],
    correcta: 0,
    explicacion:
      'Los dos se convierten a texto: [] es la cadena vacía y {} es "[object Object]". Lo del 0 pasa en la consola del navegador, donde {} al principio se lee como un bloque.',
  },
  {
    id: 'js-sort-numeros',
    tipo: 'test',
    enunciado: '¿Qué devuelve [10, 9, 1].sort()?',
    opciones: ['[1, 9, 10]', '[1, 10, 9]', '[10, 9, 1]', '[9, 10, 1]'],
    correcta: 1,
    explicacion:
      'Sin comparador, sort() ordena como texto: "1" < "10" < "9". Por eso hace falta sort((a, b) => a - b).',
  },
  {
    id: 'js-nan',
    tipo: 'test',
    enunciado: '¿Cuál es el único valor de JavaScript que no es igual a sí mismo?',
    opciones: ['undefined', 'null', 'NaN', '-0'],
    correcta: 2,
    explicacion:
      'NaN !== NaN, como manda IEEE 754. Es lo que hace útil a Number.isNaN, y de ahí sale el truco de detectarlo con x !== x.',
  },
  {
    id: 'js-max-array-vacio',
    tipo: 'test',
    enunciado: '¿Qué devuelve Math.max() sin argumentos?',
    opciones: ['0', 'undefined', 'NaN', '-Infinity'],
    correcta: 3,
    explicacion:
      'Devuelve -Infinity, que es el elemento neutro del máximo. Math.min() sin argumentos devuelve Infinity por lo mismo.',
  },

  // --- Pillar el fallo ------------------------------------------------------
  {
    id: 'fallo-var-bucle',
    tipo: 'fallo',
    enunciado: '¿En qué línea está el error que hace que se impriman tres treses?',
    codigo:
      '1  for (var i = 0; i < 3; i++) {\n2    setTimeout(() => {\n3      console.log(i);\n4    }, 0);\n5  }',
    opciones: ['Línea 1', 'Línea 2', 'Línea 3', 'Línea 4'],
    correcta: 0,
    explicacion:
      'var tiene ámbito de función, así que las tres funciones comparten la misma i, que al ejecutarse ya vale 3. Con let, cada vuelta tiene la suya.',
  },
  {
    id: 'fallo-comparar-flotantes',
    tipo: 'fallo',
    enunciado: '¿Qué línea hace que esto no imprima nunca «igual»?',
    codigo:
      '1  const a = 0.1 + 0.2;\n2  const b = 0.3;\n3  if (a === b) {\n4    console.log("igual");\n5  }',
    opciones: ['Línea 1', 'Línea 2', 'Línea 3', 'Línea 4'],
    correcta: 2,
    explicacion:
      'Comparar flotantes con === es el error: 0.1 + 0.2 da 0.30000000000000004. Se compara la diferencia contra un épsilon.',
  },
  {
    id: 'fallo-await-foreach',
    tipo: 'fallo',
    enunciado: '¿Dónde está el fallo que hace que «listo» salga antes de tiempo?',
    codigo:
      '1  async function todo(ids) {\n2    ids.forEach(async (id) => {\n3      await guardar(id);\n4    });\n5    console.log("listo");\n6  }',
    opciones: ['Línea 1', 'Línea 2', 'Línea 3', 'Línea 5'],
    correcta: 1,
    explicacion:
      'forEach no espera a las funciones async: lanza todas y sigue. Con for...of, o con Promise.all sobre un map, sí se espera.',
  },
  {
    id: 'fallo-mutar-mientras-recorres',
    tipo: 'fallo',
    enunciado: '¿Qué línea hace que se salte elementos?',
    codigo:
      '1  const xs = [1, 2, 3, 4];\n2  for (let i = 0; i < xs.length; i++) {\n3    if (xs[i] % 2 === 0) {\n4      xs.splice(i, 1);\n5    }\n6  }',
    opciones: ['Línea 2', 'Línea 3', 'Línea 4', 'Línea 1'],
    correcta: 2,
    explicacion:
      'Al borrar, todo se desplaza y el índice avanza igual, así que se salta el siguiente. Se recorre al revés, o se usa filter.',
  },
  {
    id: 'fallo-parametro-por-defecto',
    tipo: 'fallo',
    enunciado: '¿Dónde está el error que comparte el array entre llamadas en Python?',
    codigo:
      '1  def anadir(x, destino=[]):\n2      destino.append(x)\n3      return destino\n4  \n5  print(anadir(1), anadir(2))',
    opciones: ['Línea 1', 'Línea 2', 'Línea 3', 'Línea 5'],
    correcta: 0,
    explicacion:
      'El valor por defecto se evalúa una sola vez, al definir la función, así que todas las llamadas comparten la misma lista. Se pone None y se crea dentro.',
  },

  // --- Historia -------------------------------------------------------------
  {
    id: 'hist-primer-bug',
    tipo: 'test',
    enunciado: '¿Qué encontró Grace Hopper pegado en un relé del Mark II en 1947?',
    opciones: ['Una araña', 'Una polilla', 'Una hormiga', 'Un trozo de cinta'],
    correcta: 1,
    explicacion:
      'Una polilla, pegada con cinta en el cuaderno de bitácora con la nota «primer caso real de un bicho encontrado». La palabra bug ya se usaba antes en ingeniería.',
  },
  {
    id: 'hist-c-autor',
    tipo: 'test',
    enunciado: '¿Quién creó el lenguaje C en los laboratorios Bell?',
    opciones: ['Ken Thompson', 'Dennis Ritchie', 'Brian Kernighan', 'Bjarne Stroustrup'],
    correcta: 1,
    explicacion:
      'Dennis Ritchie, sobre 1972, para reescribir Unix. Kernighan escribió el libro con él, y Thompson había hecho antes el lenguaje B.',
  },
  {
    id: 'hist-primer-programa',
    tipo: 'test',
    enunciado:
      '¿Quién escribió el que se considera el primer algoritmo pensado para una máquina?',
    opciones: ['Ada Lovelace', 'Charles Babbage', 'Alan Turing', 'John von Neumann'],
    correcta: 0,
    explicacion:
      'Ada Lovelace, en 1843, en las notas a su traducción de un artículo sobre la máquina analítica de Babbage: un método para calcular números de Bernoulli.',
  },
  {
    id: 'hist-linux-anuncio',
    tipo: 'test',
    enunciado: '¿Cómo describió Linus Torvalds su sistema al anunciarlo en 1991?',
    opciones: [
      '«Un sistema operativo libre para todos»',
      '«Solo un hobby, no será grande ni profesional»',
      '«El futuro de la informática personal»',
      '«Un Unix de verdad, por fin»',
    ],
    correcta: 1,
    explicacion:
      'Lo presentó como un hobby que no sería «grande ni profesional como GNU». Hoy mueve la mayor parte de los servidores del mundo.',
  },
  {
    id: 'hist-www',
    tipo: 'test',
    enunciado: '¿En qué organización se inventó la World Wide Web?',
    opciones: ['El MIT', 'El CERN', 'DARPA', 'Xerox PARC'],
    correcta: 1,
    explicacion:
      'En el CERN, donde Tim Berners-Lee la propuso en 1989 para que los físicos compartieran documentos. Xerox PARC es de donde salió el ratón con ventanas.',
  },

  // --- Herramientas ---------------------------------------------------------
  {
    id: 'git-rebase-vs-merge',
    tipo: 'test',
    enunciado: '¿Qué hace git rebase que no hace git merge?',
    opciones: [
      'Reescribe los commits sobre otra base',
      'Borra la rama de origen',
      'Sube los cambios al remoto',
      'Fusiona sin crear conflictos',
    ],
    correcta: 0,
    explicacion:
      'Rebase reaplica tus commits encima de otra base y les cambia el identificador. Por eso no se rebasa lo que ya han descargado otros.',
  },
  {
    id: 'git-reflog',
    tipo: 'test',
    enunciado: 'Tras un git reset --hard que se llevó tu trabajo, ¿qué te salva?',
    opciones: ['git reflog', 'git fsck --lost-found', 'git revert', 'Nada, se perdió'],
    correcta: 0,
    explicacion:
      'El reflog guarda dónde estuvo HEAD en cada momento, así que el commit sigue ahí aunque ninguna rama lo apunte. Un mes de red de seguridad, por defecto.',
  },
  {
    id: 'http-418',
    tipo: 'test',
    enunciado: '¿Qué significa el código HTTP 418?',
    opciones: [
      'Petición demasiado larga',
      'Soy una tetera',
      'Contenido no aceptable',
      'Se requiere pago',
    ],
    correcta: 1,
    explicacion:
      '«I\'m a teapot», de una broma del día de los inocentes de 1998 sobre un protocolo para cafeteras. Sigue implementado en medio internet por cariño.',
  },
  {
    id: 'http-301-302',
    tipo: 'test',
    enunciado: '¿Cuál es la diferencia entre un 301 y un 302?',
    opciones: [
      'El 301 es permanente y el 302 temporal',
      'El 301 es temporal y el 302 permanente',
      'El 301 conserva el método y el 302 no',
      'No hay diferencia práctica',
    ],
    correcta: 0,
    explicacion:
      'El 301 es permanente y los navegadores lo cachean con ganas: poner uno por error y luego arrepentirse es una tarde muy larga.',
  },
  {
    id: 'sql-inner-left',
    tipo: 'test',
    enunciado: '¿Qué devuelve un LEFT JOIN que no devuelve un INNER JOIN?',
    opciones: [
      'Las filas de la izquierda sin pareja a la derecha',
      'Las filas duplicadas',
      'Las filas ordenadas',
      'Las filas de la derecha sin pareja',
    ],
    correcta: 0,
    explicacion:
      'Conserva todas las de la izquierda y rellena con nulos las que no emparejan. De ahí que un WHERE sobre la tabla derecha lo convierta sin querer en un INNER.',
  },

  // --- Fundamentos ----------------------------------------------------------
  {
    id: 'coste-busqueda-binaria',
    tipo: 'test',
    enunciado: '¿Cuál es el coste de una búsqueda binaria sobre un array ordenado?',
    opciones: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correcta: 1,
    explicacion:
      'Cada paso descarta la mitad, así que son log₂ n comparaciones. En un millón de elementos, veinte.',
  },
  {
    id: 'coste-hash',
    tipo: 'test',
    enunciado: '¿Cuál es el coste del peor caso de buscar en una tabla hash?',
    opciones: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    correcta: 2,
    explicacion:
      'Si todo colisiona en el mismo cubo, se recorre una lista. El O(1) es el caso medio, y hay ataques que fabrican colisiones a propósito.',
  },
  {
    id: 'utf8-bytes',
    tipo: 'test',
    enunciado: '¿Cuántos bytes ocupa como mucho un carácter en UTF-8?',
    opciones: ['2', '3', '4', '6'],
    correcta: 2,
    explicacion:
      'Cuatro, desde que se limitó Unicode a U+10FFFF. La especificación original llegaba a seis, y por eso mucha gente lo recuerda mal.',
  },
  {
    id: 'ascii-a',
    tipo: 'test',
    enunciado: '¿Cuál es el código ASCII de la letra A mayúscula?',
    opciones: ['61', '65', '97', '101'],
    correcta: 1,
    explicacion:
      '65 en decimal, 0x41. La minúscula es 97: exactamente 32 más, que es un solo bit, y de ahí el truco de cambiar mayúsculas con un OR.',
  },
  {
    id: 'tcp-handshake',
    tipo: 'test',
    enunciado: '¿Cuántos mensajes tiene el saludo que abre una conexión TCP?',
    opciones: ['Dos', 'Tres', 'Cuatro', 'Uno'],
    correcta: 1,
    explicacion:
      'Tres: SYN, SYN-ACK y ACK. El cierre, en cambio, son cuatro, porque cada lado cierra su mitad por separado.',
  },

  // --- Estimaciones ---------------------------------------------------------
  {
    id: 'est-git-anio',
    tipo: 'estimacion',
    enunciado: '¿En qué año publicó Linus Torvalds la primera versión de git?',
    opciones: [],
    correcta: 2005,
    margen: 12,
    explicacion:
      'Abril de 2005, y lo escribió en unos días tras perder la licencia de BitKeeper para el kernel.',
  },
  {
    id: 'est-js-dias',
    tipo: 'estimacion',
    enunciado: '¿En cuántos días dicen que Brendan Eich escribió el primer JavaScript?',
    opciones: [],
    correcta: 10,
    margen: 12,
    explicacion:
      'Diez días de mayo de 1995. Explica bastantes cosas del lenguaje, y también lo lejos que ha llegado a pesar de ello.',
  },
  {
    id: 'est-unix-epoch',
    tipo: 'estimacion',
    enunciado: '¿De qué año es el instante cero del tiempo Unix?',
    opciones: [],
    correcta: 1970,
    margen: 15,
    explicacion:
      'El 1 de enero de 1970. Y el 19 de enero de 2038 se acaba lo que cabe en 32 bits con signo, que es el otro efecto 2000.',
  },
  {
    id: 'est-kernel-lineas',
    tipo: 'estimacion',
    enunciado: '¿Cuántos millones de líneas tiene hoy el kernel de Linux, más o menos?',
    opciones: [],
    correcta: 40,
    margen: 25,
    explicacion:
      'Del orden de 40 millones, y más de la mitad son controladores de dispositivos. En 1994, la 1.0 tenía 176.000.',
  },
  {
    id: 'est-puerto-https',
    tipo: 'estimacion',
    enunciado: '¿En qué puerto escucha HTTPS por defecto?',
    opciones: [],
    correcta: 443,
    margen: 200,
    explicacion:
      '443. HTTP es el 80, SSH el 22 y el DNS el 53: los cuatro que uno acaba sabiéndose sin querer.',
  },
  {
    id: 'est-www-anio',
    tipo: 'estimacion',
    enunciado: '¿En qué año propuso Tim Berners-Lee la World Wide Web?',
    opciones: [],
    correcta: 1989,
    margen: 12,
    explicacion:
      'Marzo de 1989, en un documento que su jefe anotó con «vago, pero prometedor». El primer sitio web se publicó en 1991.',
  },
  {
    id: 'est-ipv4-bits',
    tipo: 'estimacion',
    enunciado: '¿Cuántos bits tiene una dirección IPv4?',
    opciones: [],
    correcta: 32,
    margen: 30,
    explicacion:
      '32 bits: unos 4.300 millones de direcciones, que parecían infinitas. IPv6 usa 128.',
  },
  {
    id: 'est-max-safe-integer',
    tipo: 'estimacion',
    enunciado:
      '¿Hasta qué potencia de dos llegan los enteros exactos de JavaScript? (el exponente)',
    opciones: [],
    correcta: 53,
    margen: 20,
    explicacion:
      '2^53 - 1, porque los números son flotantes de doble precisión y la mantisa tiene 53 bits. De ahí que existan BigInt y que los identificadores viajen como texto.',
  },
];

/**
 * Las preguntas de una partida, barajadas.
 *
 * Sale de la semilla de la sala, así que dos partidas distintas no traen la
 * misma tanda y una misma partida se reconstruye igual desde su log.
 */
export function repartir(semilla: number, cuantas = PREGUNTAS_POR_PARTIDA): Pregunta[] {
  return shuffle(BANCO, createRng(semilla)).slice(0, Math.min(cuantas, BANCO.length));
}
