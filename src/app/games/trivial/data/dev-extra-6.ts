import { expandMap, makeBank } from './expand';
import { Question } from './types';

/** Sexta tanda: volumen alto, pero repartido de verdad entre todos los formatos. */
const q = makeBank('dev', 'extra-6');
type Item = readonly [string, string, (1 | 2 | 3)?];

const choiceWeb: Item[] = [
  ['HTTP 304', 'Not Modified', 1], ['HTTP 401', 'Unauthorized', 1],
  ['HTTP 403', 'Forbidden', 1], ['HTTP 422', 'Unprocessable Content', 2],
  ['HTTP 429', 'Too Many Requests', 1], ['HTTP 502', 'Bad Gateway', 1],
  ['HTTP 503', 'Service Unavailable', 1], ['HTTP 307', 'Temporary Redirect', 2],
  ['HTTP 206', 'Partial Content', 2], ['HTTP 204', 'No Content', 1],
];
const choiceArchitecture: Item[] = [
  ['hexagonal architecture', 'puertos y adaptadores', 2], ['CQRS', 'separar comandos de consultas', 2],
  ['event sourcing', 'guardar cambios como eventos', 2], ['circuit breaker', 'abrir el circuito tras fallos', 1],
  ['bulkhead', 'aislar recursos para contener fallos', 2], ['sidecar', 'proceso auxiliar junto a un servicio', 2],
  ['saga', 'coordinar una transacción distribuida', 2], ['idempotency key', 'identificar de forma única un reintento', 2],
  ['backpressure', 'frenar al productor cuando el consumidor no llega', 2], ['service mesh', 'capa de comunicación entre servicios', 2],
];

const CHOICE_QUESTIONS: Question[] = [
  ...expandMap(q, 'web', choiceWeb, (subject) => `¿Qué significa el estado ${subject} en HTTP?`),
  ...expandMap(q, 'cultura', choiceArchitecture, (subject) => `En arquitectura de software, ¿qué describe ${subject}?`),
];

const OPEN_ITEMS: Array<readonly [string, string, string[]]> = [
  ['¿Cómo se llama el archivo que define los scripts y dependencias de un proyecto Node?', 'package.json', ['package json']],
  ['¿Qué herramienta suele ejecutar pruebas de navegador con una API moderna?', 'Playwright', ['playwright']],
  ['¿Cómo se llama la técnica de servir contenido desde nodos cercanos al usuario?', 'CDN', ['cdn', 'red de distribución de contenido']],
  ['¿Qué sigla identifica una interfaz de programación de aplicaciones?', 'API', ['api']],
  ['¿Cómo se llama el formato binario de intercambio usado frecuentemente junto a Protocol Buffers?', 'gRPC', ['grpc']],
  ['¿Qué sistema de colas distribuido creó inicialmente LinkedIn?', 'Kafka', ['Apache Kafka', 'kafka']],
  ['¿Cómo se llama el fichero que fija versiones exactas de dependencias npm?', 'package-lock.json', ['package lock', 'package-lock']],
  ['¿Qué herramienta de línea de comandos se usa habitualmente para hacer peticiones HTTP?', 'curl', ['cURL']],
  ['¿Cómo se llama la práctica de liberar cambios pequeños y frecuentes a producción?', 'continuous delivery', ['entrega continua', 'continuous delivery']],
  ['¿Qué sigla representa el objetivo de tiempo máximo para restaurar un servicio?', 'RTO', ['recovery time objective']],
  ['¿Qué sigla representa la pérdida de datos máxima aceptable tras un incidente?', 'RPO', ['recovery point objective']],
  ['¿Cómo se llama el patrón que entrega un objeto reutilizable para crear familias de objetos?', 'factory', ['factory pattern', 'fábrica']],
  ['¿Qué herramienta analiza la cobertura de código de una suite de tests?', 'Istanbul', ['nyc', 'istanbul']],
  ['¿Cómo se llama el protocolo que permite resolver nombres de dominio?', 'DNS', ['dns']],
  ['¿Qué formato legible para máquinas se usa mucho en pipelines de CI?', 'YAML', ['yaml']],
  ['¿Cómo se llama el almacenamiento clave-valor integrado normalmente en un navegador?', 'localStorage', ['local storage']],
  ['¿Qué comando de Docker construye una imagen a partir de un Dockerfile?', 'docker build', ['build']],
  ['¿Cómo se llama la técnica de sustituir una dependencia real por una simulada en un test?', 'mocking', ['mock', 'mocking']],
  ['¿Qué protocolo de mensajería ligero usa publicación y suscripción?', 'MQTT', ['mqtt']],
  ['¿Cómo se llama el proceso de convertir código fuente en código ejecutable?', 'compilación', ['compilacion', 'compilation']],
];

const TRUE_FALSE: Array<readonly [string, boolean]> = [
  ['Un navegador puede cachear una respuesta HTTP si sus cabeceras lo permiten.', true],
  ['GraphQL obliga a usar exclusivamente bases de datos gráficas.', false],
  ['Un índice de base de datos puede acelerar lecturas y encarecer escrituras.', true],
  ['Un merge fast-forward crea siempre un commit adicional.', false],
  ['Un contenedor Docker y una máquina virtual son exactamente la misma tecnología.', false],
  ['La latencia mide el tiempo que tarda una operación en completar.', true],
  ['Un test flaky puede pasar o fallar sin cambios en el código.', true],
  ['El patrón Singleton resuelve automáticamente todos los problemas de concurrencia.', false],
  ['Un hash criptográfico está diseñado para ser fácil de invertir.', false],
  ['La compresión puede reducir el tamaño de una respuesta antes de enviarla.', true],
  ['Un esquema de base de datos es siempre inmutable después de crearse.', false],
  ['El garbage collector puede detener temporalmente la ejecución de un programa.', true],
  ['Un proceso hijo hereda necesariamente todos los permisos del proceso padre.', false],
  ['La paginación basada en cursor suele ser estable ante inserciones nuevas.', true],
  ['El polimorfismo permite tratar objetos distintos mediante una interfaz común.', true],
  ['Un lock distribuido elimina por completo la necesidad de diseñar idempotencia.', false],
  ['Un secreto incluido en JavaScript del frontend debe considerarse público.', true],
  ['La serialización convierte una estructura en una representación almacenable o transmisible.', true],
  ['Un DNS privado solo puede resolver nombres en Internet público.', false],
  ['La revisión por pares puede descubrir errores que no detectan los tests.', true],
];

const NUMERIC: Array<readonly [string, number, 1 | 2 | 3, string?]> = [
  ['¿Cuántos bytes tiene una dirección IPv6?', 16, 1],
  ['¿Cuántos bits tiene un valor hexadecimal?', 4, 1],
  ['¿Cuántos lados tiene un paquete TCP en el handshake inicial?', 3, 2],
  ['¿Cuántos niveles tiene normalmente una caché L1, L2 y L3?', 3, 1],
  ['¿Cuántos valores puede representar un nibble?', 16, 1],
  ['¿Cuál es el puerto TCP habitual de PostgreSQL?', 5432, 2],
  ['¿Cuál es el puerto TCP habitual de Redis?', 6379, 2],
  ['¿Cuántos bits tiene un UUID?', 128, 1],
  ['¿Cuántos estados tiene una promesa de JavaScript?', 3, 1],
  ['¿Cuántos principios forman las letras de SOLID?', 5, 1],
  ['¿Cuántos elementos tiene un cuarteto de pruebas AAA: arrange, act, assert y qué?', 4, 2],
  ['¿Cuál es la complejidad de buscar en una tabla hash ideal?', 1, 2, 'En promedio, O(1).'],
  ['¿Cuántos bytes ocupa un entero de 32 bits?', 4, 1],
  ['¿Cuál es el código de estado HTTP de una redirección permanente clásica?', 301, 1],
  ['¿Cuántos componentes tiene una dirección MAC de 48 bits si cada componente es un byte?', 6, 2],
  ['¿Cuántas réplicas mínimas hacen falta para tolerar la caída de una en un conjunto simple?', 3, 2],
  ['¿Cuántos argumentos recibe normalmente una función comparadora de sort en JavaScript?', 2, 2],
  ['¿Cuál es el número de versión mayor de HTTP/2?', 2, 1],
  ['¿Cuántos caracteres hexadecimales tiene un hash SHA-256 expresado en hexadecimal?', 64, 2],
  ['¿Cuántos niveles de acceso clásicos tiene una clase Java?', 4, 2],
];

const ODD: Array<readonly [string, [string, string, string, string], string, 1 | 2 | 3]> = [
  ['protocolos de aplicación', ['HTTP', 'DNS', 'SMTP', 'PCIe'], 'PCIe', 1],
  ['métodos HTTP', ['GET', 'POST', 'PATCH', 'PUSH'], 'PUSH', 1],
  ['bases de datos', ['PostgreSQL', 'SQLite', 'MariaDB', 'Nginx'], 'Nginx', 1],
  ['formatos de datos', ['JSON', 'XML', 'YAML', 'MP4'], 'MP4', 1],
  ['herramientas de build', ['Vite', 'esbuild', 'Webpack', 'Figma'], 'Figma', 1],
  ['estructuras lineales', ['Array', 'Queue', 'Stack', 'Tree'], 'Tree', 1],
  ['algoritmos de grafos', ['Dijkstra', 'Prim', 'Kruskal', 'Quicksort'], 'Quicksort', 2],
  ['sistemas Unix', ['chmod', 'chown', 'grep', 'pip'], 'pip', 1],
  ['cabeceras de seguridad web', ['CSP', 'HSTS', 'X-Frame-Options', 'JPEG'], 'JPEG', 1],
  ['lenguajes tipados estáticamente', ['Rust', 'Kotlin', 'Swift', 'Lua'], 'Lua', 1],
  ['servicios cloud', ['S3', 'Lambda', 'Cloud Functions', 'SQLite'], 'SQLite', 1],
  ['formatos de imagen', ['PNG', 'JPEG', 'WebP', 'WAV'], 'WAV', 1],
  ['métricas de clasificación', ['precision', 'recall', 'F1', 'latencia'], 'latencia', 2],
  ['patrones de diseño', ['Adapter', 'Strategy', 'Observer', 'TCP'], 'TCP', 1],
  ['comandos de Git', ['clone', 'fetch', 'rebase', 'compile'], 'compile', 1],
  ['tipos de testing', ['unitario', 'integración', 'end-to-end', 'compilación'], 'compilación', 1],
  ['sistemas de colas', ['RabbitMQ', 'Kafka', 'SQS', 'PostgreSQL'], 'PostgreSQL', 1],
  ['protocolos de cifrado o transporte', ['TLS', 'IPsec', 'SSH', 'FTP'], 'FTP', 2],
  ['formatos de configuración', ['TOML', 'INI', 'YAML', 'MP3'], 'MP3', 1],
  ['conceptos de memoria', ['heap', 'stack', 'cache', 'endpoint'], 'endpoint', 1],
];

const ORDERS: Array<readonly [string, string[], 1 | 2 | 3]> = [
  ['Ordena una petición DNS simple.', ['Escribir dominio', 'Consultar caché', 'Preguntar al servidor', 'Recibir respuesta'], 1],
  ['Ordena el ciclo de vida de una issue.', ['Abrir', 'Triar', 'Asignar', 'Cerrar'], 1],
  ['Ordena las capas de una imagen Docker.', ['Base', 'Dependencias', 'Código', 'Configuración'], 2],
  ['Ordena una transacción típica.', ['Begin', 'Leer o escribir', 'Commit', 'Confirmar resultado'], 1],
  ['Ordena las fases de un test automatizado.', ['Preparar fixture', 'Ejecutar acción', 'Comprobar resultado', 'Limpiar'], 1],
  ['Ordena la resolución de una dependencia.', ['Leer manifest', 'Resolver versión', 'Descargar paquete', 'Ejecutar instalación'], 2],
  ['Ordena una compilación TypeScript simplificada.', ['Leer tsconfig', 'Analizar tipos', 'Emitir JavaScript', 'Ejecutar JavaScript'], 2],
  ['Ordena la propagación de un evento.', ['Origen', 'Broker', 'Consumidor', 'Confirmación'], 2],
  ['Ordena la respuesta ante un error 500.', ['Detectar', 'Registrar contexto', 'Mitigar', 'Investigar causa'], 1],
  ['Ordena la lectura de una variable en caché.', ['Comprobar caché', 'Encontrar hit o miss', 'Consultar origen', 'Guardar resultado'], 2],
  ['Ordena la revisión de un pull request.', ['Abrir PR', 'Revisar', 'Corregir comentarios', 'Integrar'], 1],
  ['Ordena la autenticación con sesión.', ['Enviar credenciales', 'Validar identidad', 'Crear sesión', 'Usar cookie'], 1],
  ['Ordena un despliegue blue-green.', ['Preparar entorno nuevo', 'Desplegar versión', 'Probar entorno', 'Cambiar tráfico'], 2],
  ['Ordena el procesamiento de un formulario.', ['Recibir datos', 'Validar', 'Persistir', 'Responder'], 1],
  ['Ordena un pipeline de datos.', ['Ingerir', 'Transformar', 'Cargar', 'Consultar'], 2],
  ['Ordena la creación de una clave pública.', ['Elegir parámetros', 'Generar secreto', 'Derivar clave pública', 'Publicar clave'], 3],
  ['Ordena una migración de esquema segura.', ['Añadir columna', 'Desplegar código compatible', 'Migrar datos', 'Eliminar legado'], 3],
  ['Ordena la depuración con un breakpoint.', ['Reproducir', 'Pausar', 'Inspeccionar', 'Corregir'], 1],
  ['Ordena la gestión de un secreto.', ['Crear', 'Guardar en vault', 'Inyectar en runtime', 'Rotar'], 2],
  ['Ordena la entrega de una notificación.', ['Crear evento', 'Encolar', 'Procesar', 'Entregar'], 1],
];

export const DEV_EXTRA_6: Question[] = [
  ...CHOICE_QUESTIONS,
  ...OPEN_ITEMS.map(([prompt, answer, accept], index) => q.op(index % 2 ? 'cultura' : 'sistemas', (index % 3 + 1) as 1 | 2 | 3, prompt, answer, accept)),
  ...TRUE_FALSE.map(([prompt, truth], index) => q.tf(['web', 'datos', 'git', 'seguridad', 'lenguajes'][index % 5], (index % 3 + 1) as 1 | 2 | 3, prompt, truth)),
  ...NUMERIC.map(([prompt, answer, difficulty, explain]) => q.n('datos', difficulty, prompt, answer, explain)),
  ...ODD.map(([subject, options, answer, difficulty], index) => q.odd(index % 2 ? 'lenguajes' : 'web', difficulty, `¿Cuál no pertenece al grupo de ${subject}?`, options, answer)),
  ...ORDERS.map(([prompt, options, difficulty], index) => q.ord(index % 2 ? 'sistemas' : 'algoritmos', difficulty, prompt, [...options].reverse(), options)),
];
