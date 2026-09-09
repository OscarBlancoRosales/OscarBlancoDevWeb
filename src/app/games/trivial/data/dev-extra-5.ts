import { makeBank } from './expand';
import { Question } from './types';

/** Tanda equilibrada: una colección deliberada para los seis formatos de partida. */
const q = makeBank('dev', 'extra-5');

export const DEV_EXTRA_5: Question[] = [
  // ===== ELECCIÓN MÚLTIPLE =====
  q.c('web', 1, '¿Qué cabecera HTTP indica el tipo de contenido de la respuesta?', ['Content-Type', 'Accept-Language', 'Origin', 'Referer'], 'Content-Type'),
  q.c('datos', 2, '¿Qué JOIN conserva todas las filas de la tabla izquierda?', ['LEFT JOIN', 'INNER JOIN', 'CROSS JOIN', 'RIGHT JOIN'], 'LEFT JOIN'),
  q.c('git', 1, '¿Qué comando crea una rama nueva y cambia a ella en una sola operación?', ['git switch -c', 'git branch --list', 'git tag -a', 'git remote -v'], 'git switch -c'),
  q.c('algoritmos', 2, '¿Qué estructura usa normalmente una búsqueda en anchura?', ['Una cola', 'Una pila', 'Un heap máximo', 'Una tabla hash'], 'Una cola'),
  q.c('seguridad', 2, '¿Qué principio evita confiar en datos enviados por el cliente?', ['Validación en el servidor', 'Ofuscación del HTML', 'Minificación', 'Compresión gzip'], 'Validación en el servidor'),
  q.c('lenguajes', 2, '¿Qué palabra clave de TypeScript declara una propiedad que puede no existir?', ['?', 'maybe', 'optional', 'nullable'], '?'),
  q.c('sistemas', 2, '¿Qué formato representa habitualmente la imagen de un contenedor?', ['OCI', 'BMP', 'ELF', 'MP3'], 'OCI'),
  q.c('hardware', 1, '¿Qué unidad se usa normalmente para expresar la frecuencia de un procesador?', ['Hertz', 'Byte', 'Voltio', 'Ohmio'], 'Hertz'),
  q.c('ia', 2, '¿Qué métrica se usa habitualmente en clasificación para medir aciertos sobre el total?', ['Accuracy', 'Recall', 'BLEU', 'Perplexity'], 'Accuracy'),
  q.c('cultura', 1, '¿Qué documento suele describir cómo levantar un proyecto localmente?', ['README', 'CHANGELOG', 'LICENSE', 'NOTICE'], 'README'),

  // ===== VERDADERO / FALSO =====
  q.tf('web', 1, 'Una petición HTTP puede tener un cuerpo también cuando usa el método POST.', true),
  q.tf('datos', 2, 'Una clave primaria puede contener valores nulos.', false),
  q.tf('git', 1, 'Un commit de Git identifica su contenido mediante un hash.', true),
  q.tf('algoritmos', 2, 'La búsqueda binaria necesita que los datos estén ordenados.', true),
  q.tf('seguridad', 2, 'Codificar Base64 cifra un secreto y evita que pueda leerse.', false),
  q.tf('lenguajes', 1, 'Una interfaz define necesariamente la implementación completa de sus métodos.', false),
  q.tf('sistemas', 2, 'Un contenedor comparte el kernel del sistema anfitrión.', true),
  q.tf('hardware', 2, 'La memoria RAM pierde su contenido al apagar el equipo.', true),
  q.tf('ia', 2, 'La precisión de un modelo y su utilidad de producto siempre son exactamente lo mismo.', false),
  q.tf('cultura', 1, 'Un changelog registra cambios relevantes entre versiones.', true),

  // ===== NUMÉRICAS =====
  q.n('web', 1, '¿Cuántos bits tiene una dirección IPv4?', 32),
  q.n('datos', 1, '¿Cuántas formas normales existen en la normalización relacional clásica hasta BCNF si contamos 1NF, 2NF y 3NF?', 4),
  q.n('git', 2, '¿Cuántos padres tiene normalmente un commit que es resultado de un merge?', 2),
  q.n('algoritmos', 1, '¿Cuál es la complejidad temporal de acceder por índice a un array?', 1, 'Es tiempo constante, O(1).'),
  q.n('seguridad', 1, '¿Qué puerto TCP usa normalmente SSH?', 22),
  q.n('lenguajes', 2, '¿Cuántos valores distintos puede representar un byte sin signo?', 256),
  q.n('sistemas', 2, '¿Cuántos estados principales tiene un proceso Unix en el modelo simplificado listo, ejecutando o bloqueado?', 3),
  q.n('hardware', 2, '¿Cuántos bits tiene una palabra hexadecimal?', 4),
  q.n('ia', 2, '¿Cuántas dimensiones tiene un escalar?', 0),
  q.n('cultura', 1, '¿Cuántos niveles tiene el modelo clásico de madurez CMMI?', 5),

  // ===== EL INTRUSO =====
  q.odd('web', 1, '¿Cuál NO es un código de estado HTTP?', ['201 Created', '301 Moved Permanently', '418 I\'m a teapot', '999 Imaginary Status'], '999 Imaginary Status'),
  q.odd('datos', 2, '¿Cuál NO es un tipo de índice o estructura de búsqueda?', ['B-tree', 'hash', 'GiST', 'JPEG'], 'JPEG'),
  q.odd('git', 1, '¿Cuál NO es una referencia habitual de Git?', ['HEAD', 'origin/main', 'refs/tags/v1.0', 'localhost:3000'], 'localhost:3000'),
  q.odd('algoritmos', 2, '¿Cuál NO es un algoritmo de ordenación?', ['Merge sort', 'Insertion sort', 'Radix sort', 'Bellman-Ford'], 'Bellman-Ford'),
  q.odd('seguridad', 2, '¿Cuál NO es una propiedad de seguridad?', ['Confidencialidad', 'Integridad', 'Disponibilidad', 'Latencia'], 'Latencia'),
  q.odd('lenguajes', 1, '¿Cuál NO es una palabra reservada de JavaScript?', ['async', 'yield', 'class', 'renderHTML'], 'renderHTML'),
  q.odd('sistemas', 2, '¿Cuál NO es un sistema de archivos?', ['ext4', 'ZFS', 'APFS', 'HTTPS'], 'HTTPS'),
  q.odd('hardware', 1, '¿Cuál NO es una unidad de almacenamiento?', ['KiB', 'MiB', 'GiB', 'GHz'], 'GHz'),
  q.odd('ia', 2, '¿Cuál NO es una tarea habitual de procesamiento de lenguaje natural?', ['Clasificación de texto', 'Traducción automática', 'Reconocimiento de entidades', 'Renderizado de sombras'], 'Renderizado de sombras'),
  q.odd('cultura', 1, '¿Cuál NO suele ser una fase de un ciclo de entrega?', ['Planificar', 'Construir', 'Probar', 'Desmagnetizar'], 'Desmagnetizar'),

  // ===== ORDENAR =====
  q.ord('web', 1, 'Ordena estas capas de una petición web, desde el cliente hasta la aplicación.', ['Navegador', 'DNS', 'TCP', 'HTTP'], ['Navegador', 'DNS', 'TCP', 'HTTP']),
  q.ord('datos', 2, 'Ordena las operaciones SQL de una consulta conceptual.', ['FROM', 'WHERE', 'GROUP BY', 'SELECT'], ['FROM', 'WHERE', 'GROUP BY', 'SELECT']),
  q.ord('git', 1, 'Ordena el flujo habitual para publicar un cambio en Git.', ['Editar', 'git add', 'git commit', 'git push'], ['Editar', 'git add', 'git commit', 'git push']),
  q.ord('algoritmos', 2, 'Ordena de menor a mayor crecimiento asintótico.', ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], ['O(1)', 'O(log n)', 'O(n)', 'O(n²)']),
  q.ord('seguridad', 2, 'Ordena el ciclo básico de gestión de una vulnerabilidad.', ['Detectar', 'Evaluar', 'Corregir', 'Verificar'], ['Detectar', 'Evaluar', 'Corregir', 'Verificar']),
  q.ord('lenguajes', 1, 'Ordena estas fases simplificadas de un compilador.', ['Analizar tokens', 'Construir el AST', 'Comprobar tipos', 'Generar código'], ['Analizar tokens', 'Construir el AST', 'Comprobar tipos', 'Generar código']),
  q.ord('sistemas', 2, 'Ordena el arranque de un servicio en un sistema moderno.', ['Cargar kernel', 'Montar raíz', 'Iniciar servicios', 'Aceptar peticiones'], ['Cargar kernel', 'Montar raíz', 'Iniciar servicios', 'Aceptar peticiones']),
  q.ord('hardware', 2, 'Ordena las unidades de capacidad de menor a mayor.', ['Byte', 'KiB', 'MiB', 'GiB'], ['Byte', 'KiB', 'MiB', 'GiB']),
  q.ord('ia', 2, 'Ordena un flujo mínimo de preparación de datos para entrenar.', ['Recoger datos', 'Limpiar datos', 'Separar train y test', 'Evaluar modelo'], ['Recoger datos', 'Limpiar datos', 'Separar train y test', 'Evaluar modelo']),
  q.ord('cultura', 1, 'Ordena un incidente desde que ocurre hasta que se aprende de él.', ['Detectar', 'Mitigar', 'Resolver', 'Hacer retrospectiva'], ['Detectar', 'Mitigar', 'Resolver', 'Hacer retrospectiva']),

  // ===== RESPUESTA ABIERTA =====
  q.op('web', 1, '¿Cómo se llama el protocolo seguro que sustituye a HTTP usando TLS?', 'HTTPS', ['https', 'HTTP seguro']),
  q.op('datos', 1, '¿Cómo se llama el lenguaje estándar para consultar bases de datos relacionales?', 'SQL', ['sql']),
  q.op('git', 1, '¿Cómo se llama la rama principal que tradicionalmente se crea en un repositorio Git?', 'main', ['master']),
  q.op('algoritmos', 2, '¿Cómo se llama la notación que expresa el crecimiento de un algoritmo?', 'Big O', ['big-o', 'notación O grande', 'O grande']),
  q.op('seguridad', 1, '¿Cómo se llama el proceso de demostrar quién eres ante un sistema?', 'autenticación', ['authentication', 'auth']),
  q.op('lenguajes', 1, '¿Cómo se llama el valor que indica que una variable no tiene ningún objeto?', 'null', ['nulo']),
  q.op('sistemas', 1, '¿Cómo se llama el programa que interpreta los comandos escritos en una terminal?', 'shell', ['intérprete de comandos']),
  q.op('hardware', 1, '¿Cómo se llama la pieza que ejecuta instrucciones y suele llamarse procesador?', 'CPU', ['cpu', 'procesador']),
  q.op('ia', 1, '¿Cómo se llama el conjunto de ejemplos utilizado para ajustar un modelo?', 'dataset', ['datos de entrenamiento', 'conjunto de datos']),
  q.op('cultura', 1, '¿Cómo se llama el archivo que excluye rutas del control de versiones de Git?', '.gitignore', ['gitignore']),
];
