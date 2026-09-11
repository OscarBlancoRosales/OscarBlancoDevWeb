import type { Pregunta } from '@devweb/shared/games/trivial/tipos';

/**
 * Las preguntas de las pruebas que no son «todos contestan a la vez».
 *
 * Viven aquí y no en `banco.ts` porque se reparten distinto: el banco de siempre
 * se baraja entero, y estas se cogen por secciones para montar la escaleta del
 * programa. Como el resto, **no se importan nunca desde `apps/web`**: las
 * respuestas están en el texto.
 *
 * El criterio al escribirlas es la prueba, no la dificultad. En «el primero que
 * pulse» se cobra por lanzarse, así que la pregunta tiene que leerse de un
 * vistazo; en la bomba se contesta con la mecha corriendo, así que va cortísima;
 * y la ráfaga es verdadero o falso, que se responde con el estómago.
 */

/** El primero que pulse: cortas, de las que se saben o no se saben. */
export const PULSA: readonly Pregunta[] = [
  {
    id: 'pulsa-git',
    tipo: 'pulsa',
    enunciado: '¿Qué comando deshace el último commit dejando los cambios en el índice?',
    opciones: ['git reset --hard HEAD~1', 'git reset --soft HEAD~1', 'git revert HEAD', 'git clean -fd'],
    correcta: 1,
    explicacion: '`--soft` mueve la rama y deja todo preparado. `--hard` es el que se lleva el trabajo por delante.',
  },
  {
    id: 'pulsa-http-418',
    tipo: 'pulsa',
    enunciado: '¿Qué es un HTTP 418?',
    opciones: ['Gateway Timeout', 'I am a teapot', 'Payload Too Large', 'Too Many Requests'],
    correcta: 1,
    explicacion: 'Una broma de los April Fools de 1998 que sigue en los servidores de medio mundo.',
  },
  {
    id: 'pulsa-sql-inner',
    tipo: 'pulsa',
    enunciado: '¿Qué devuelve un INNER JOIN cuando no casa ninguna fila?',
    opciones: ['NULL en cada columna', 'Nada, cero filas', 'Todas las de la izquierda', 'Un error'],
    correcta: 1,
    explicacion: 'El que rellena con NULL es el LEFT JOIN. El INNER se queda solo con lo que empareja.',
  },
  {
    id: 'pulsa-css-especificidad',
    tipo: 'pulsa',
    enunciado: '¿Qué gana: un id, veinte clases o un !important en una clase?',
    opciones: ['El id', 'Las veinte clases', 'El !important', 'El que va después'],
    correcta: 2,
    explicacion: '`!important` se salta la especificidad entera. Por eso duele tanto encontrárselo.',
  },
  {
    id: 'pulsa-puerto-https',
    tipo: 'pulsa',
    enunciado: '¿En qué puerto escucha HTTPS por defecto?',
    opciones: ['80', '443', '8080', '22'],
    correcta: 1,
    explicacion: 'El 443. El 22 es SSH, y el 8080 es donde acaba todo lo que levantas en local.',
  },
  {
    id: 'pulsa-big-o-binaria',
    tipo: 'pulsa',
    enunciado: '¿Cuál es el coste de una búsqueda binaria?',
    opciones: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correcta: 1,
    explicacion: 'Cada paso descarta la mitad, así que el número de pasos crece como el logaritmo.',
  },
  {
    id: 'pulsa-utf8-bytes',
    tipo: 'pulsa',
    enunciado: '¿Cuántos bytes ocupa como mucho un carácter en UTF-8?',
    opciones: ['2', '3', '4', '8'],
    correcta: 2,
    explicacion: 'Cuatro. De uno para el ASCII de siempre a cuatro para los emojis.',
  },
  {
    id: 'pulsa-semver',
    tipo: 'pulsa',
    enunciado: 'En semver, ¿qué número sube al romper la compatibilidad?',
    opciones: ['El primero', 'El segundo', 'El tercero', 'Ninguno, se cambia el nombre'],
    correcta: 0,
    explicacion: 'Mayor.menor.parche: romper sube el mayor. Lo demás es una promesa de que no se rompe nada.',
  },
];

/** Verdadero o falso, para la ráfaga. Se contesta con el estómago. */
export const RAFAGA: readonly Pregunta[] = [
  vof('raf-js-hoisting', 'En JavaScript, `let` también sube al principio del bloque, pero no se puede usar antes.', true,
    'Sube, sí, pero en la «zona muerta temporal»: tocarlo antes de declararlo lanza ReferenceError.'),
  vof('raf-git-rebase', '`git rebase` reescribe la historia.', true,
    'Crea commits nuevos con otro padre. Por eso no se rebasea lo que ya han descargado otros.'),
  vof('raf-http-put', 'PUT es idempotente y POST no.', true,
    'Repetir un PUT deja lo mismo; repetir un POST crea otro. De ahí los pedidos duplicados.'),
  vof('raf-sql-null', 'En SQL, `NULL = NULL` devuelve verdadero.', false,
    'Devuelve NULL, que no es verdadero. Para eso está `IS NULL`.'),
  vof('raf-css-flex', 'En flexbox, `flex: 1` reparte el espacio sobrante a partes iguales.', true,
    'Es el atajo de `flex-grow: 1`. El sobrante, no el ancho: eso lo decide `flex-basis`.'),
  vof('raf-array-sort', '`Array.prototype.sort` ordena una copia y deja el original intacto.', false,
    'Ordena el original y además lo devuelve. La copia la hace `toSorted`, que es de 2023.'),
  vof('raf-tcp-udp', 'UDP garantiza que los paquetes llegan en orden.', false,
    'No garantiza ni que lleguen. El que ordena y reintenta es TCP.'),
  vof('raf-hash-cifrado', 'Un hash se puede descifrar si conoces el algoritmo.', false,
    'Un hash no cifra: tira información. Lo que se hace es probar candidatos, no descifrar.'),
  vof('raf-docker-vm', 'Un contenedor lleva dentro su propio núcleo de sistema operativo.', false,
    'Comparte el del anfitrión. Lo que aísla son los namespaces y los cgroups.'),
  vof('raf-ts-tipos', 'Los tipos de TypeScript existen también en tiempo de ejecución.', false,
    'Se borran al compilar. Por eso hacen falta validadores para lo que llega de fuera.'),
  vof('raf-utf-emoji', 'Un emoji puede ocupar más de una posición al medir la longitud de un texto.', true,
    'Muchos van fuera del plano básico y ocupan dos unidades UTF-16. Y los de familia, bastantes más.'),
  vof('raf-index-lectura', 'Un índice acelera las lecturas y frena las escrituras.', true,
    'Hay que mantenerlo en cada inserción. Por eso indexar todo «por si acaso» sale caro.'),
];

/** La bomba: cortísimas, que se contestan con la mecha corriendo. */
export const BOMBA: readonly Pregunta[] = [
  corta('bomba-array-length', '¿Qué devuelve `[1,2,3].length`?', ['2', '3', '4', 'undefined'], 1,
    'Tres elementos, tres de longitud.'),
  corta('bomba-ls', '¿Qué hace `rm -rf /` sin querer?', ['Nada', 'Lista ficheros', 'Borrarlo todo', 'Reinicia'], 2,
    'Borrarlo todo. Por eso los sistemas modernos piden `--no-preserve-root`.'),
  corta('bomba-json', '¿`JSON.parse("{}")` devuelve...?', ['Un objeto vacío', 'null', 'Una cadena', 'Un error'], 0,
    'Un objeto vacío. `JSON.parse("")` sí es un error.'),
  corta('bomba-bit', '¿Cuántos bits tiene un byte?', ['4', '8', '16', 'Depende'], 1,
    'Ocho, por convenio universal desde hace décadas.'),
  corta('bomba-css-centrar', '¿Qué centra en los dos ejes de un flex?', ['align: center', 'place-items: center', 'center: all', 'text-align: center'], 1,
    '`place-items: center` es el atajo de align y justify a la vez.'),
  corta('bomba-git-stash', '¿Qué guarda `git stash`?', ['Las ramas', 'Los cambios sin comitear', 'El historial', 'Los remotos'], 1,
    'Lo que tienes a medias, para recuperarlo después.'),
  corta('bomba-status-404', '¿Qué significa un 404?', ['Prohibido', 'No encontrado', 'Error del servidor', 'Redirección'], 1,
    'No encontrado. El prohibido es el 403.'),
  corta('bomba-ts-any', '¿Qué apaga el comprobador de tipos?', ['unknown', 'never', 'any', 'void'], 2,
    '`any` se lo traga todo. `unknown` obliga a comprobar antes de usar.'),
  corta('bomba-sql-delete', '¿Qué borra `DELETE FROM tabla` sin WHERE?', ['Nada', 'Una fila', 'Todas', 'La tabla'], 2,
    'Todas las filas. La tabla se la lleva `DROP`.'),
  corta('bomba-npm-ci', '¿Qué respeta el lock exactamente?', ['npm install', 'npm ci', 'npm update', 'npm audit'], 1,
    '`npm ci` instala lo que dice el lock, ni más ni menos.'),
  corta('bomba-primer-indice', '¿Cuál es el primer índice de un array?', ['1', '0', '-1', 'Depende'], 1,
    'Cero, salvo en Lua y en las pesadillas.'),
  corta('bomba-const', '¿`const` impide cambiar el contenido de un objeto?', ['Sí', 'No', 'Solo en strict', 'Solo arrays'], 1,
    'Impide reasignar la variable. El objeto de dentro se toca igual.'),
];

/** Una de verdadero o falso, que siempre tiene la misma forma. */
function vof(id: string, enunciado: string, verdadero: boolean, explicacion: string): Pregunta {
  return {
    id,
    tipo: 'rafaga',
    enunciado,
    opciones: ['Verdadero', 'Falso'],
    correcta: verdadero ? 0 : 1,
    explicacion,
  };
}

/** Una de la bomba: cuatro opciones y una explicación de una línea. */
function corta(
  id: string,
  enunciado: string,
  opciones: string[],
  correcta: number,
  explicacion: string,
): Pregunta {
  return { id, tipo: 'bomba', enunciado, opciones, correcta, explicacion };
}

/**
 * La final: gordas, de las que se recuerdan al salir.
 *
 * Aquí se está jugando el programa entero, así que no valen las de un vistazo:
 * una final que se resuelve en dos segundos no es una final. Tampoco valen las
 * de dato suelto -no se trata de saberse un número-, sino las de entender algo
 * que casi todo el mundo cree saber.
 */
export const FINAL: readonly Pregunta[] = [
  {
    id: 'final-utf16',
    tipo: 'final',
    enunciado: '¿Por qué "👨‍👩‍👧".length devuelve 8 en JavaScript?',
    opciones: [
      'Porque cuenta bytes y no caracteres',
      'Porque son tres emojis unidos por dos caracteres invisibles, y cada persona ocupa dos posiciones',
      'Porque el emoji está mal formado',
      'Porque length siempre devuelve potencias de dos',
    ],
    correcta: 1,
    explicacion:
      'Son tres emojis de persona unidos por dos ZWJ. Cada persona va fuera del plano básico y ocupa dos unidades UTF-16: 3x2 + 2 = 8.',
  },
  {
    id: 'final-indices',
    tipo: 'final',
    enunciado: 'Una consulta con índice tarda más que sin él. ¿Cuál es la explicación más probable?',
    opciones: [
      'El índice está corrupto',
      'La consulta devuelve casi toda la tabla, y saltar del índice a cada fila sale más caro que leerla entera',
      'Los índices solo aceleran las escrituras',
      'Falta un ORDER BY',
    ],
    correcta: 1,
    explicacion:
      'Es el caso clásico: con poca selectividad, el salto del índice a la tabla fila a fila cuesta más que un recorrido secuencial. Por eso el planificador a veces ignora el índice a propósito.',
  },
  {
    id: 'final-git-rebase',
    tipo: 'final',
    enunciado: 'Rebaseas una rama que ya se habían descargado otros. ¿Qué pasa exactamente?',
    opciones: [
      'No pasa nada, git lo arregla solo',
      'Los commits nuevos tienen otro identificador, así que a los demás les aparecen duplicados al mezclar',
      'Se borra el historial de todos',
      'Git rechaza el rebase',
    ],
    correcta: 1,
    explicacion:
      'Rebase no mueve commits: crea otros con el mismo contenido y distinto padre, y por tanto distinto hash. Quien tuviera los viejos acaba con las dos versiones.',
  },
  {
    id: 'final-cache',
    tipo: 'final',
    enunciado: 'Un despliegue rompe la web solo para quien ya la había visitado antes. ¿Por dónde se empieza a mirar?',
    opciones: [
      'Por la base de datos',
      'Por la caché: un HTML viejo pidiendo ficheros con nombres que ya no existen',
      'Por el certificado',
      'Por el DNS',
    ],
    correcta: 1,
    explicacion:
      'Es el síntoma de libro: el visitante nuevo se lo trae todo fresco y el que vuelve arrastra un índice cacheado que apunta a bundles ya borrados.',
  },
  {
    id: 'final-float',
    tipo: 'final',
    enunciado: 'Sumas 0.1 diez veces y comparas con 1. ¿Por qué falla?',
    opciones: [
      'Porque JavaScript redondea mal a propósito',
      'Porque 0.1 no se puede representar exacto en binario, y cada suma arrastra el error',
      'Porque hay que usar enteros siempre',
      'Porque el compilador optimiza la suma',
    ],
    correcta: 1,
    explicacion:
      'IEEE 754 guarda 0.1 como la fracción binaria más cercana, que no es exacta. Diez sumas acumulan el error y dan 0.9999999999999999.',
  },
];
