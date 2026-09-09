import { expandMap, makeBank } from './expand';
import { Question } from './types';

/** Cuarta tanda del pack developer: conceptos concretos y menos trillados. */
const q = makeBank('dev', 'extra-4');

type Item = readonly [string, string, (1 | 2 | 3)?];

function add(
  category: string,
  items: Item[],
  choice: (subject: string) => string,
  open: (subject: string) => string,
): Question[] {
  return expandMap(q, category, items, choice, open);
}

const WEB: Item[] = [
  ['CORS', 'Cross-Origin Resource Sharing', 2],
  ['CSP', 'Content Security Policy', 2],
  ['HSTS', 'HTTP Strict Transport Security', 2],
  ['ETag', 'Entity Tag', 2],
  ['WebSocket', 'canal bidireccional persistente', 1],
  ['Service Worker', 'script que controla tareas en segundo plano del navegador', 2],
  ['Shadow DOM', 'árbol DOM encapsulado de un componente', 2],
  ['hydration', 'unir HTML renderizado con comportamiento JavaScript', 2],
  ['ARIA', 'Accessible Rich Internet Applications', 2],
  ['SRI', 'Subresource Integrity', 3],
  ['preflight', 'petición OPTIONS previa de CORS', 2],
  ['SameSite', 'atributo de cookie que limita envíos cross-site', 2],
];

const DATA: Item[] = [
  ['ACID', 'atomicidad, consistencia, aislamiento y durabilidad', 1],
  ['MVCC', 'Multi-Version Concurrency Control', 2],
  ['B-tree', 'árbol balanceado habitual para índices', 2],
  ['índice compuesto', 'índice construido con varias columnas', 1],
  ['normalización', 'organizar datos para reducir redundancia', 1],
  ['denormalización', 'duplicar datos de forma controlada para leer más rápido', 2],
  ['OLAP', 'procesamiento analítico en línea', 2],
  ['OLTP', 'procesamiento transaccional en línea', 2],
  ['idempotencia', 'repetir una operación sin cambiar el resultado final', 2],
  ['cursor', 'posición desde la que se recorre un resultado', 1],
  ['upsert', 'insertar o actualizar según exista la fila', 1],
  ['particionado', 'dividir una tabla grande en fragmentos', 2],
];

const SYSTEMS: Item[] = [
  ['PID 1', 'primer proceso del espacio de usuario', 2],
  ['inode', 'estructura que describe un archivo en Unix', 2],
  ['pipe', 'canal de comunicación entre procesos', 1],
  ['señal SIGTERM', 'petición de terminación ordenada de un proceso', 2],
  ['cgroup', 'grupo de control de recursos de Linux', 3],
  ['namespace', 'aislamiento de recursos del kernel', 2],
  ['system call', 'entrada controlada desde usuario al kernel', 1],
  ['swap', 'espacio de disco usado como memoria virtual', 1],
  ['daemon', 'proceso de servicio que corre en segundo plano', 1],
  ['initramfs', 'sistema de archivos inicial de arranque', 3],
  ['load average', 'métrica de trabajo pendiente del sistema', 2],
  ['stdout', 'salida estándar de un proceso', 1],
];

const GIT: Item[] = [
  ['reflog', 'registro local de movimientos de referencias', 2],
  ['bisect', 'búsqueda binaria del commit que introdujo un fallo', 2],
  ['cherry-pick', 'aplicar los cambios de un commit concreto', 2],
  ['squash', 'combinar varios commits en uno', 1],
  ['stash', 'guardar temporalmente cambios sin commit', 1],
  ['rebase interactivo', 'reescribir y ordenar commits localmente', 2],
  ['worktree', 'otra carpeta de trabajo asociada al mismo repositorio', 2],
  ['submodule', 'repositorio Git anidado referenciado por otro', 2],
  ['annotate', 'ver qué commit tocó cada línea', 1],
  ['fast-forward', 'avanzar una rama sin crear merge commit', 1],
  ['hook', 'script ejecutado en un evento de Git', 1],
  ['bare repository', 'repositorio sin árbol de trabajo', 2],
];

const HARDWARE: Item[] = [
  ['DMA', 'acceso directo a memoria desde un dispositivo', 2],
  ['MMU', 'unidad de gestión de memoria', 2],
  ['TLB', 'caché de traducciones de direcciones virtuales', 3],
  ['ECC', 'corrección de errores en memoria', 2],
  ['NVMe', 'protocolo de almacenamiento sobre PCI Express', 2],
  ['PCIe', 'bus de expansión serie de alta velocidad', 1],
  ['firmware', 'software persistente de un dispositivo', 1],
  ['IOMMU', 'gestión y aislamiento de accesos DMA', 3],
  ['cache line', 'unidad de transferencia de una caché de CPU', 2],
  ['endianness', 'orden de bytes de una palabra', 2],
  ['IRQ', 'solicitud de interrupción de hardware', 1],
  ['watchdog', 'temporizador que detecta bloqueos', 1],
];

const ALGORITHMS: Item[] = [
  ['A*', 'búsqueda informada con coste y heurística', 2],
  ['Dijkstra', 'camino mínimo con pesos no negativos', 1],
  ['Floyd-Warshall', 'caminos mínimos entre todos los pares', 2],
  ['Union-Find', 'estructura para componentes disjuntos', 2],
  ['topological sort', 'ordenación de un grafo acíclico dirigido', 2],
  ['KMP', 'búsqueda de patrones en texto', 3],
  ['Rabin-Karp', 'búsqueda de patrones mediante hash', 3],
  ['quicksort', 'ordenación por particionado y pivote', 1],
  ['heapsort', 'ordenación basada en un heap', 2],
  ['counting sort', 'ordenación por conteo de claves acotadas', 2],
  ['backtracking', 'explorar decisiones y deshacerlas al fallar', 1],
  ['programación dinámica', 'reutilizar soluciones de subproblemas', 1],
];

const SECURITY: Item[] = [
  ['CSRF', 'falsificación de peticiones entre sitios', 1],
  ['XSS', 'inyección de scripts ejecutables en una página', 1],
  ['SSRF', 'forzar al servidor a realizar peticiones', 2],
  ['mTLS', 'TLS con certificados en cliente y servidor', 2],
  ['nonce', 'valor usado una sola vez', 1],
  ['salt', 'valor aleatorio añadido antes de derivar un hash', 1],
  ['KDF', 'función de derivación de claves', 2],
  ['HMAC', 'código de autenticación basado en hash y secreto', 2],
  ['principio de mínimo privilegio', 'dar solo los permisos necesarios', 1],
  ['defensa en profundidad', 'usar varias capas de controles de seguridad', 2],
  ['CVE', 'identificador público de una vulnerabilidad', 1],
  ['zero-day', 'vulnerabilidad explotable aún sin parche disponible', 2],
];

const LANGUAGES: Item[] = [
  ['closure', 'función que conserva su entorno léxico', 1],
  ['generics', 'parametrización de tipos', 1],
  ['trait', 'conjunto reutilizable de comportamiento o restricciones', 2],
  ['monomorfización', 'generar código especializado para tipos concretos', 3],
  ['pattern matching', 'selección mediante la forma de un valor', 2],
  ['garbage collector', 'gestor automático de memoria no alcanzable', 1],
  ['type narrowing', 'refinar un tipo mediante una comprobación', 2],
  ['memoización', 'guardar resultados de llamadas anteriores', 1],
  ['coroutine', 'unidad cooperativa que puede suspenderse y reanudarse', 2],
  ['RAII', 'gestionar recursos con la vida de un objeto', 2],
  ['inmutabilidad', 'no modificar un valor después de crearlo', 1],
  ['duck typing', 'aceptar un objeto por su comportamiento', 2],
];

const AI: Item[] = [
  ['tokenización', 'dividir texto en unidades que procesa el modelo', 1],
  ['attention', 'ponderar qué partes de la entrada son relevantes', 1],
  ['transformer', 'arquitectura basada principalmente en atención', 1],
  ['fine-tuning', 'ajuste adicional de un modelo preentrenado', 1],
  ['RLHF', 'aprendizaje por refuerzo con feedback humano', 2],
  ['grounding', 'vincular una respuesta a fuentes o contexto verificable', 2],
  ['ventana de contexto', 'cantidad máxima de tokens procesables a la vez', 1],
  ['temperature', 'parámetro que modifica la aleatoriedad del muestreo', 1],
  ['cuantización', 'representar pesos con menor precisión numérica', 2],
  ['distillation', 'entrenar un modelo pequeño a partir de otro mayor', 2],
  ['benchmark', 'prueba comparable para medir un sistema', 1],
  ['data leakage', 'información de evaluación que contamina el entrenamiento', 2],
];

const CULTURE: Item[] = [
  ['RFC', 'Request for Comments', 1],
  ['POSIX', 'estándar de interfaz de sistemas tipo Unix', 2],
  ['W3C', 'organismo de estándares de la Web', 1],
  ['SRE', 'Site Reliability Engineering', 2],
  ['observabilidad', 'inferir el estado interno desde señales externas', 2],
  ['error budget', 'margen aceptable de fallos del nivel de servicio', 2],
  ['blameless postmortem', 'análisis de incidente centrado en aprender', 2],
  ['feature flag', 'interruptor para activar una funcionalidad', 1],
  ['dark launch', 'desplegar una función sin mostrársela aún al usuario', 2],
  ['canary release', 'liberar primero a un subconjunto pequeño', 1],
  ['blue-green deploy', 'alternar entre dos entornos de producción', 2],
  ['technical debt', 'coste futuro de una solución pendiente de mejorar', 1],
];

export const DEV_EXTRA_4: Question[] = [
  ...add('web', WEB, (subject) => `En desarrollo web, ${subject} se refiere a…`, (subject) => `¿Qué significa ${subject} en desarrollo web?`),
  ...add('datos', DATA, (subject) => `En bases de datos, ¿qué describe ${subject}?`, (subject) => `Define ${subject} en el contexto de datos.`),
  ...add('sistemas', SYSTEMS, (subject) => `En sistemas, ¿qué es ${subject}?`, (subject) => `¿Cómo se define ${subject} en sistemas operativos?`),
  ...add('git', GIT, (subject) => `En Git, ¿para qué sirve o qué representa ${subject}?`, (subject) => `Explica brevemente ${subject} en Git.`),
  ...add('hardware', HARDWARE, (subject) => `En hardware, ¿qué significa ${subject}?`, (subject) => `¿Qué función cumple ${subject} en un ordenador?`),
  ...add('algoritmos', ALGORITHMS, (subject) => `¿Qué caracteriza al algoritmo o técnica ${subject}?`, (subject) => `¿Cómo se llama la técnica descrita por ${subject}?`),
  ...add('seguridad', SECURITY, (subject) => `En seguridad, ¿qué describe ${subject}?`, (subject) => `Define el concepto de seguridad ${subject}.`),
  ...add('lenguajes', LANGUAGES, (subject) => `En programación, ¿qué es ${subject}?`, (subject) => `¿Cómo se denomina el concepto ${subject} en programación?`),
  ...add('ia', AI, (subject) => `En inteligencia artificial, ¿qué significa ${subject}?`, (subject) => `Explica qué es ${subject} en IA.`),
  ...add('cultura', CULTURE, (subject) => `En equipos de software, ¿qué describe ${subject}?`, (subject) => `¿Qué significa ${subject} en la cultura de desarrollo?`),
];
