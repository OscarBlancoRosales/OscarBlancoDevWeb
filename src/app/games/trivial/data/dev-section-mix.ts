import { makeBank, stemOf, withStem } from './expand';
import { Question } from './types';

/** Tanda por sección del pack dev: los seis tipos, hechos nuevos. */
const q = makeBank('dev', 'secmix');

function mix(category: string, fact: string, question: Question): Question {
  return withStem(question, stemOf('term', fact));
}

export const DEV_SECTION_MIX: Question[] = [
  mix('lenguajes', 'zig-comptime', q.c('lenguajes', 2, 'En Zig, ¿qué pretenden los «comptime» sobre todo?', ['Ejecutar código en tiempo de compilación', 'Apagar el recolector', 'Forzar el GIL', 'Compilar a COBOL'], 'Ejecutar código en tiempo de compilación')),
  mix('lenguajes', 'rust-borrow-checker', q.tf('lenguajes', 2, 'En Rust, el comprobador de préstamos actúa en tiempo de compilación, no en el de ejecución.', true)),
  mix('lenguajes', 'ecmascript-primitives-7', q.n('lenguajes', 2, '¿Cuántos tipos primitivos lista ECMAScript actual (undefined, null, boolean, number, string, symbol, bigint)?', 7)),
  mix('lenguajes', 'lisp-dialects-odd', q.odd('lenguajes', 2, '¿Cuál NO es un dialecto o descendiente de Lisp?', ['Clojure', 'Scheme', 'Racket', 'Fortran'], 'Fortran')),
  mix('lenguajes', 'repl-loop-order', q.ord('lenguajes', 2, 'Ordena el arranque de un REPL: de leer a imprimir.', ['Leer', 'Evaluar', 'Imprimir', 'Repetir'], ['Leer', 'Evaluar', 'Imprimir', 'Repetir'])),
  mix('lenguajes', 'jit-compiler', q.op('lenguajes', 2, '¿Qué significan las siglas JIT en un compilador?', 'Just-In-Time', ['just in time', 'compilacion just-in-time'])),

  mix('historia', 'visicalc', q.c('historia', 2, '¿Qué máquina de los 70 popularizó la hoja de cálculo en oficinas?', ['VisiCalc', 'Lotus Notes', 'HyperCard', 'dBase II'], 'VisiCalc')),
  mix('historia', 'arpanet-before-web', q.tf('historia', 1, 'ARPANET existía antes de que Tim Berners-Lee propusiera la Web.', true)),
  mix('historia', 'git-first-commit-2005', q.n('historia', 2, '¿En qué año hizo Linus Torvalds el primer commit de Git?', 2005)),
  mix('historia', 'microcomputer-70s-odd', q.odd('historia', 2, '¿Cuál NO es un microordenador de finales de los 70 / principios de los 80?', ['Apple II', 'Commodore PET', 'ZX Spectrum', 'iPhone 3G'], 'iPhone 3G')),
  mix('historia', 'computer-generations-order', q.ord('historia', 2, 'Ordena estas generaciones de computadores de más antigua a más reciente.', ['Válvulas', 'Transistores', 'Circuitos integrados', 'Microprocesadores'], ['Válvulas', 'Transistores', 'Circuitos integrados', 'Microprocesadores'])),
  mix('historia', 'gnu-project', q.op('historia', 2, '¿Cómo se llamaba el proyecto GNU de Richard Stallman para un Unix libre?', 'GNU', ['proyecto GNU', 'GNU project'])),

  mix('web', 'hateoas', q.c('web', 2, '¿Qué describe HATEOAS en una API REST?', ['El cliente sigue enlaces que devuelve el propio recurso', 'Cifrar el body con AES', 'Minificar el HTML', 'Usar solo XML'], 'El cliente sigue enlaces que devuelve el propio recurso')),
  mix('web', 'http2-multiplex', q.tf('web', 2, 'HTTP/2 puede multiplexar varios streams sobre una sola conexión TCP.', true)),
  mix('web', 'rfc-9114-http3', q.n('web', 2, '¿En qué año se publicó el RFC 9114 de HTTP/3?', 2022)),
  mix('web', 'css-display-odd', q.odd('web', 2, '¿Cuál NO es un valor habitual de `display` en CSS?', ['flex', 'grid', 'block', 'inode'], 'inode')),
  mix('web', 'critical-rendering-path', q.ord('web', 2, 'Ordena el critical rendering path simplificado.', ['Parsear HTML', 'Construir el DOM', 'Calcular estilo', 'Pintar'], ['Parsear HTML', 'Construir el DOM', 'Calcular estilo', 'Pintar'])),
  mix('web', 'permissions-policy', q.op('web', 2, '¿Qué cabecera HTTP moderna controla APIs del navegador (cámara, geolocalización) por origen?', 'Permissions-Policy', ['permissions policy', 'feature-policy'])),

  mix('datos', 'sql-serializable', q.c('datos', 2, '¿Qué nivel de aislamiento SQL impide lecturas sucias, no repetibles y fantasma (en el modelo clásico)?', ['Serializable', 'Read uncommitted', 'Read committed', 'Autocommit'], 'Serializable')),
  mix('datos', 'index-slows-insert', q.tf('datos', 2, 'Un índice puede acelerar SELECT y a la vez ralentizar INSERT.', true)),
  mix('datos', 'mysql-port-3306', q.n('datos', 1, '¿Cuál es el puerto TCP por defecto de MySQL / MariaDB?', 3306)),
  mix('datos', 'nosql-odd', q.odd('datos', 2, '¿Cuál NO es un almacén NoSQL típico?', ['MongoDB', 'Redis', 'Cassandra', 'SQLite como motor relacional clásico'], 'SQLite como motor relacional clásico')),
  mix('datos', 'normal-forms-order', q.ord('datos', 2, 'Ordena estas formas normales de menos a más estricta.', ['1NF', '2NF', '3NF', 'BCNF'], ['1NF', '2NF', '3NF', 'BCNF'])),
  mix('datos', 'wal', q.op('datos', 2, '¿Qué significan las siglas WAL en bases de datos?', 'Write-Ahead Logging', ['write ahead log', 'write-ahead log', 'registro write-ahead'])),

  mix('sistemas', 'zombie-process', q.c('sistemas', 2, 'Un proceso zombi en Unix es, groseramente…', ['Uno que ya terminó y espera a que el padre recoja su estado', 'Uno que usa swap', 'Un kernel panic', 'Un hilo de tiempo real'], 'Uno que ya terminó y espera a que el padre recoja su estado')),
  mix('sistemas', 'linux-nice', q.tf('sistemas', 2, 'En Linux, un valor `nice` más alto hace el proceso menos prioritario (más «amable»).', true)),
  mix('sistemas', 'unix-epoch-1970', q.n('sistemas', 1, '¿En qué año empieza el Unix epoch (1 de enero, UTC)?', 1970)),
  mix('sistemas', 'unix-syscall-odd', q.odd('sistemas', 2, '¿Cuál NO es una llamada al sistema Unix clásica?', ['fork', 'exec', 'open', 'npm'], 'npm')),
  mix('sistemas', 'pc-boot-order', q.ord('sistemas', 2, 'Ordena el arranque clásico de un PC.', ['Firmware (UEFI/BIOS)', 'Bootloader', 'Kernel', 'Init / PID 1'], ['Firmware (UEFI/BIOS)', 'Bootloader', 'Kernel', 'Init / PID 1'])),
  mix('sistemas', 'shebang', q.op('sistemas', 1, '¿Cómo se llama la línea `#!` al inicio de un script Unix?', 'shebang', ['hashbang', 'sha-bang', 'sharp-bang'])),

  mix('git', 'rerere', q.c('git', 3, '¿Para qué sirve `git rerere`?', ['Reutilizar resoluciones de conflictos ya hechas', 'Borrar reflog', 'Firmar tags GPG', 'Clonar en bare'], 'Reutilizar resoluciones de conflictos ya hechas')),
  mix('git', 'commit-amend', q.tf('git', 2, '`git commit --amend` puede reescribir el último commit (si aún no se ha publicado, con cuidado).', true)),
  mix('git', 'sha1-hex-40', q.n('git', 2, '¿Cuántos caracteres hexadecimales tiene un hash SHA-1 clásico de Git (sin abreviar)?', 40)),
  mix('git', 'git-object-odd', q.odd('git', 2, '¿Cuál NO es un tipo de objeto de Git?', ['blob', 'tree', 'commit', 'inode'], 'inode')),
  mix('git', 'git-object-order', q.ord('git', 2, 'Ordena estos objetos Git de más «hoja» a más «historia».', ['blob', 'tree', 'commit', 'tag'], ['blob', 'tree', 'commit', 'tag'])),
  mix('git', 'gitkeep', q.op('git', 2, '¿Cómo se llama el archivo vacío que a veces se usa para versionar un directorio vacío?', '.gitkeep', ['gitkeep'])),

  mix('hardware', 'soc', q.c('hardware', 2, 'Un SoC es, groseramente…', ['Un chip que integra CPU y más periféricos en el mismo encapsulado', 'Solo la fuente de alimentación', 'Un tipo de RAID', 'Un bus serie de impresora'], 'Un chip que integra CPU y más periféricos en el mismo encapsulado')),
  mix('hardware', 'ssd-no-platters', q.tf('hardware', 1, 'Un SSD típico no tiene platos giratorios.', true)),
  mix('hardware', 'pcie3-gts', q.n('hardware', 3, '¿Cuántos GT/s por carril declara PCIe 3.0 (la cifra redonda de la especificación)?', 8)),
  mix('hardware', 'cpu-cache-odd', q.odd('hardware', 2, '¿Cuál NO es un nivel de caché de CPU habitual?', ['L1', 'L2', 'L3', 'RAID 6'], 'RAID 6')),
  mix('hardware', 'power-to-os-order', q.ord('hardware', 2, 'Ordena el camino de la corriente hasta ejecutar un programa.', ['Fuente', 'Placa', 'CPU', 'Sistema operativo'], ['Fuente', 'Placa', 'CPU', 'Sistema operativo'])),
  mix('hardware', 'tdp', q.op('hardware', 2, '¿Qué sigla (en inglés) mide el calor máximo de diseño de un procesador?', 'TDP', ['thermal design power', 'potencia de diseño térmico'])),

  mix('algoritmos', 'dynamic-array-amortized', q.c('algoritmos', 2, 'El coste amortizado de un `push` en un array dinámico bien implementado es…', ['O(1) amortizado', 'O(n²)', 'O(n!)', 'O(2^n)'], 'O(1) amortizado')),
  mix('algoritmos', 'stable-sort', q.tf('algoritmos', 2, 'Un algoritmo de ordenación estable conserva el orden relativo de claves iguales.', true)),
  mix('algoritmos', 'binary-heap-arity', q.n('algoritmos', 1, '¿Cuántos hijos tiene, de libro, un nodo de un montículo binario?', 2)),
  mix('algoritmos', 'np-complete-odd', q.odd('algoritmos', 2, '¿Cuál NO es un problema NP-completo clásico de los de libro?', ['SAT', 'Viajante (TSP decisión)', 'Cubierta de vértices', 'Ordenar n enteros con comparación'], 'Ordenar n enteros con comparación')),
  mix('algoritmos', 'dijkstra-steps', q.ord('algoritmos', 2, 'Ordena estos pasos de Dijkstra (versión clásica).', ['Inicializar distancias', 'Extraer el no visitado más cercano', 'Relajar aristas', 'Marcar visitado'], ['Inicializar distancias', 'Extraer el no visitado más cercano', 'Relajar aristas', 'Marcar visitado'])),
  mix('algoritmos', 'greedy', q.op('algoritmos', 2, '¿Cómo se llama la estrategia que elige en cada paso el óptimo local?', 'voraz', ['greedy', 'algoritmo voraz', 'greedy algorithm'])),

  mix('seguridad', 'bcrypt-vs-md5', q.c('seguridad', 2, '¿Qué distingue a bcrypt de MD5 como almacén de contraseñas?', ['Es deliberadamente lento y con salt', 'Es más corto de escribir', 'No usa CPU', 'Es un protocolo HTTP'], 'Es deliberadamente lento y con salt')),
  mix('seguridad', 'tls-encrypts-path', q.tf('seguridad', 2, 'TLS cifra el contenido de la petición HTTP, no solo el nombre de dominio en el SNI de siempre.', true, 'El SNI va en claro en TLS clásico; el path y el body van cifrados tras el handshake.')),
  mix('seguridad', 'aes-256-bits', q.n('seguridad', 1, '¿Cuántos bits tiene la clave de AES-256?', 256)),
  mix('seguridad', 'auth-protocol-odd', q.odd('seguridad', 2, '¿Cuál NO es un protocolo o esquema de autenticación típico?', ['OAuth 2', 'SAML', 'OpenID Connect', 'JPEG'], 'JPEG')),
  mix('seguridad', 'cia-triad-order', q.ord('seguridad', 2, 'Ordena el trío CIA de seguridad de la información en el orden habitual del acrónimo inglés.', ['Confidentiality', 'Integrity', 'Availability'], ['Confidentiality', 'Integrity', 'Availability'])),
  mix('seguridad', 'webauthn', q.op('seguridad', 2, '¿Qué estándar del W3C cubre las passkeys en el navegador?', 'WebAuthn', ['webauthn', 'web authentication'])),

  mix('cultura', 'yak-shaving', q.c('cultura', 2, '«Yak shaving» describe, en jerga, sobre todo…', ['Una cadena de tareas laterales antes de la que importaba', 'Afeitar el CI', 'Minificar CSS', 'Un tipo de rebase'], 'Una cadena de tareas laterales antes de la que importaba')),
  mix('cultura', 'conway-law', q.tf('cultura', 2, 'La ley de Conway relaciona la estructura de comunicación de un equipo con el diseño del sistema que produce.', true)),
  mix('cultura', 'agile-manifesto-signers', q.n('cultura', 2, '¿Cuántas personas firmaron el Manifiesto Ágil de 2001?', 17)),
  mix('cultura', 'license-odd', q.odd('cultura', 2, '¿Cuál NO es una licencia de software habitual?', ['MIT', 'Apache-2.0', 'GPL-3.0', 'JPEG-2000 como licencia de código'], 'JPEG-2000 como licencia de código')),
  mix('cultura', 'pr-cycle-order', q.ord('cultura', 2, 'Ordena el ciclo de una propuesta de cambio en un repo.', ['Issue', 'Pull request', 'Review', 'Merge'], ['Issue', 'Pull request', 'Review', 'Merge'])),
  mix('cultura', 'bikeshedding', q.op('cultura', 2, '¿Cómo se llama (en jerga) discutir el color de la bici en vez del diseño de la central?', 'bikeshedding', ['bike shedding', 'ley de Parkinson de la trivialidad', 'parkinsons law of triviality'])),

  mix('ia', 'lora', q.c('ia', 2, 'LoRA en fine-tuning consiste sobre todo en…', ['Adaptar rangos bajos de matrices en vez de todos los pesos', 'Borrar el dataset', 'Subir la temperatura', 'Comprar más RAM'], 'Adaptar rangos bajos de matrices en vez de todos los pesos')),
  mix('ia', 'nucleus-sampling', q.tf('ia', 2, 'El muestreo nucleus (top-p) recorta el vocabulario a un umbral de probabilidad acumulada.', true)),
  mix('ia', 'gpt2-1-5b', q.n('ia', 2, '¿Cuántos millones de parámetros anunció GPT-2 en su tamaño mayor público original (el de 1,5B se dice 1500 millones)?', 1500, 'El paper habla de 1.5B; 1500 millones.')),
  mix('ia', 'loss-fn-odd', q.odd('ia', 2, '¿Cuál NO es una función de pérdida habitual en deep learning?', ['cross-entropy', 'MSE', 'MAE', 'chmod'], 'chmod')),
  mix('ia', 'rlhf-cycle', q.ord('ia', 2, 'Ordena un ciclo mínimo de RLHF simplificado.', ['Modelo inicial', 'Preferencias humanas', 'Recompensa', 'Ajuste por refuerzo'], ['Modelo inicial', 'Preferencias humanas', 'Recompensa', 'Ajuste por refuerzo'])),
  mix('ia', 'moe', q.op('ia', 2, '¿Qué sigla nombra una red con varias «expertas» de las que solo unas se activan por token?', 'MoE', ['mixture of experts', 'mezcla de expertos'])),
];
