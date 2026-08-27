# Backend propio: el servidor pasa a ser el árbitro

Fecha: 2026-08-27

## Por qué

Hoy el backend de DevWeb es Firebase, y el reparto de responsabilidades está
invertido: el cliente decide y la base de datos obedece. Las consecuencias son
concretas, no teóricas.

Las salas de Scrum Poker viven bajo unas reglas que dicen `".read": true` y
`".write": true`. Cualquiera con la consola del navegador abierta lee los votos
ocultos antes del reveal, escribe el voto de otro o borra la sala entera. El
secreto del voto —lo único que hace útil al planning poker— no existe.

Las salas de RISK intentan lo contrario, y por eso `database.rules.json` se ha
convertido en un lenguaje de validación escrito en JSON, con condiciones como
`newData.val() >= data.val() && newData.val() <= (now + 300000)`. El historial
del repositorio deja ver el precio: reglas que cascadeaban y anulaban la
exigencia de sesión, salas fantasma, candados que resultaron ser una bandera del
navegador. Cada regla nueva es un fichero JSON sin tipos, sin tests y sin
posibilidad de depurar. Y aun así el servidor no puede validar una jugada: no
conoce las reglas de RISK, solo sabe que llegó un objeto con la forma correcta.

La credencial de Firebase está escrita en `src/app/firebase.config.ts` y viaja
en el bundle. Es lo normal en Firebase, y precisamente por eso toda la seguridad
tiene que vivir en unas reglas que ya sabemos que no dan más de sí.

El motor de RISK, mientras tanto, son 7.868 líneas de TypeScript puro —cero
imports de Angular, de Firebase o de RxJS— con `applyAction(state, action, map)`
como reductor determinista y 18 ficheros de tests. Ese motor podría estar
arbitrando las partidas en el servidor. Hoy solo corre en el navegador del
jugador, que es justo donde no puede confiarse en él.

## Qué se construye

Un backend propio en una VPS con Ubuntu 26.04: Node 22 + Fastify + SQLite, con
autenticación real, WebSocket para el tiempo real y el servidor como autoridad
de todos los juegos. El motor de RISK se mueve a un paquete compartido y pasa a
ejecutarse en los dos lados, con las mismas reglas y los mismos tests.

## Qué NO se construye

- No se toca la lógica de ningún juego. El motor se mueve, no se reescribe.
- No se rediseña ninguna pantalla. Cambia de dónde vienen los datos, no cómo se
  ven.
- No hay Docker, ni Kubernetes, ni cola de mensajes, ni Redis. Un proceso, un
  fichero de base de datos y un proxy inverso.
- No hay login con Google, GitHub ni OAuth de terceros. Email y contraseña.
- No hay panel de administración. Si hace falta mirar la base de datos, se mira
  con `sqlite3`.
- No se migra nada "por si acaso": Firebase se apaga cuando la última feature
  esté fuera, no antes.

---

## 1. Reglas del proyecto

Se escriben antes que el primer endpoint y las hace cumplir la máquina. Viven en
`docs/estandares.md` y en la configuración; lo que no puede comprobar una
herramienta, no es una regla, es una intención.

### Tipado

Sobre el `strict: true` actual se añade:

```
noUncheckedIndexedAccess     exactOptionalPropertyTypes
noUnusedLocals               noUnusedParameters
verbatimModuleSyntax         noImplicitOverride (ya está)
```

`any` está prohibido por ESLint, sin excepciones silenciosas: si hiciera falta,
se escribe `unknown` y se estrecha validando. En las fronteras del sistema —HTTP,
WebSocket, SQLite, variables de entorno— lo que entra es `unknown` y solo sale
tipado después de pasar por un esquema.

### Un contrato, no dos

Los esquemas se declaran una vez con TypeBox y de ahí salen las tres cosas:
validación en runtime, tipos de TypeScript y la descripción del endpoint. No
existe ninguna `interface` escrita a mano que duplique un esquema, porque las
duplicadas se desincronizan.

### Capas

`route → service → repository`, sin saltos y sin excepciones:

- La **ruta** declara esquema y permisos, y llama a un servicio. No tiene lógica.
- El **servicio** tiene las reglas. No sabe qué es una petición HTTP ni escribe
  SQL.
- El **repositorio** es una interfaz con su implementación SQLite. No sabe nada
  del dominio más allá de sus tablas.

Esto es lo que permite testear un servicio sin levantar base de datos y cambiar
el almacenamiento sin tocar reglas.

### Errores

Un único `AppError` con código de dominio, y un único `errorHandler` que lo
traduce a HTTP en un solo sitio. Nada de `try/catch` que capturan para volver a
lanzar, ni de mensajes de usuario construidos dentro de un servicio —como el
`switch` de `firebase-auth.service.ts`, que se elimina.

### Legibilidad

El código se explica por sus nombres. Un comentario justifica **por qué**, nunca
narra **qué**. El comentario de `settledUser$` en `firebase-auth.service.ts` es
el ejemplo de comentario que sí merece existir: explica una decisión que el
código no puede contar solo.

Un fichero que pasa de ~300 líneas es una señal de que hace más de una cosa. No
es un límite automático, es una pregunta obligatoria.

### Tests

Vitest, el mismo que ya usa el proyecto. TDD: primero la prueba que falla. Los
unitarios no tocan red, reloj real ni base de datos; el tiempo y el azar entran
por parámetro, como ya hace `cleanOldRooms(ownerUid, now = Date.now())`.

### Herramientas

ESLint flat config con `typescript-eslint` en `strictTypeChecked`, el Prettier
que ya está configurado en `package.json`, y CI que falla si falla el lint, los
tipos o los tests. Sin verde no se mezcla.

---

## 2. Estructura del repositorio

npm workspaces, que ya vienen con el `npm@11.6.2` declarado. Sin herramientas
nuevas.

```
DevWeb/
├─ apps/
│  ├─ web/                 Angular 21 (movido desde la raíz, sin cambios)
│  └─ server/              Fastify
├─ packages/
│  └─ shared/              dominio puro, sin dependencias de runtime
│     ├─ engine/           motor de RISK, movido tal cual con sus 18 specs
│     ├─ games/            módulos de juego (scrum poker, risk, futuros)
│     └─ contracts/        esquemas TypeBox de la API y del protocolo WS
├─ infra/                  scripts de aprovisionamiento de la VPS
└─ package.json            raíz: workspaces y scripts, nada más
```

`packages/shared` no importa Angular ni módulos de Node. Es la condición que lo
mantiene consumible por los dos lados, y se comprueba con una regla de ESLint,
no con disciplina.

El movimiento de Angular a `apps/web` toca `angular.json`, los `tsconfig` y la
ruta de artefacto de `.github/workflows/deploy.yml`. Se hace en la fase 0, con
los 36 ficheros de tests verdes antes y después, y sin ningún cambio de
comportamiento.

---

## 3. Juegos enchufables

Un solo tipo describe qué es un juego para el servidor:

```ts
interface GameModule<TState, TAction> {
  readonly id: GameId;
  createState(config: RoomConfig): TState;
  validate(state: TState, action: TAction, by: SeatId): Result<void, RuleError>;
  apply(state: TState, action: TAction): TState;
  view(state: TState, forSeat: SeatId): unknown;
}
```

Un único `RoomActor` genérico gobierna todas las salas: recibe una acción por
WebSocket, comprueba que el asiento existe y está vivo, pregunta `validate`,
aplica, persiste y difunde. Scrum Poker y RISK son dos implementaciones de esa
interfaz, no dos servidores. Un juego nuevo es un módulo más y no toca
infraestructura.

`view()` es la pieza que hoy no existe y que arregla el agujero del Scrum Poker:
mientras los votos están ocultos, el estado que sale hacia cada asiento no
contiene los votos ajenos. No están cifrados ni escondidos en el cliente: no se
envían.

Para RISK, `validate` y `apply` son `legalActionTypes` y `applyAction` del motor
compartido. El servidor rechaza la jugada ilegal porque conoce las reglas, no
porque una condición en JSON haya adivinado su forma.

### Estado y persistencia

Cada sala activa vive en memoria dentro de su `RoomActor`. SQLite recibe el log
append-only por lotes y un snapshot cada 40 acciones, reutilizando el
`SNAPSHOT_EVERY = 40` que ya está en `risk-room.service.ts`. El camino crítico
del WebSocket nunca espera al disco.

Una sala sin conexiones abiertas se descarga de memoria tras un margen de
inactividad y se reconstruye desde el último snapshot más las acciones
posteriores. Reconectar es enviar «voy por la acción N» y recibir el delta, que
es como ya funciona el cliente de RISK.

---

## 4. Modelo de datos

SQLite en fichero, modo WAL, con claves foráneas activadas. Las tablas de salas
no saben de ningún juego concreto.

```
users(id, email, password_hash, display_name, status, created_at)
email_tokens(token_hash, user_id, purpose, expires_at, used_at)
sessions(token_hash, user_id, family_id, expires_at, revoked_at, ip, user_agent)
rooms(id, game, owner_id, name, status, config_json, created_at, updated_at)
seats(room_id, seat_id, user_id, display_name, is_bot, token_hash, connected_at)
room_events(room_id, seq, seat_id, action_json, at)
room_snapshots(room_id, up_to_seq, state_json, at)
kv(namespace, key, owner_id, value_json, updated_at)
```

`room_events` es append-only y `(room_id, seq)` es su clave: el log es la verdad
y el snapshot es una caché. `kv` recoge lo que hoy cuelga de
`throwdown-timer/configs` y sirve para lo que venga con esa misma forma.

Las migraciones son ficheros SQL numerados que se aplican al arrancar dentro de
una transacción, y el número aplicado se guarda en la propia base. Sin ORM.

Copia de seguridad: `sqlite3 .backup` diario —consistente en caliente—, con
retención de siete días. Restaurar es copiar un fichero de vuelta.

---

## 5. Autenticación

**Contraseñas**: Argon2id vía `@node-rs/argon2`, que trae binario precompilado y
evita instalar un toolchain de compilación en la VPS.

**Sesión**: access token JWT de 10 minutos que el cliente mantiene solo en
memoria, y refresh token opaco en cookie `HttpOnly; Secure; SameSite=Lax;
Domain=.oscarblancorosales.com`. Como `api.oscarblancorosales.com` y la web son
el mismo *site*, no hace falta `SameSite=None`: es la configuración más estricta
que permite este despliegue.

**Rotación con detección de reuso**: cada refresh emite un token nuevo e invalida
el anterior. Si reaparece uno ya gastado, se revoca la familia entera y todas sus
sesiones. Es lo que convierte un token robado en una sesión muerta en cuanto el
legítimo vuelve a usarse.

**Verificación por correo**: registro abierto; la cuenta nace en estado
`pending` y solo pasa a `active` con un token de un solo uso, guardado hasheado y
válido 24 horas. El envío va tras una interfaz `Mailer` con implementación SMTP
(Nodemailer) contra un relay externo de tier gratuito. Correo propio desde una IP
de VPS nueva termina en spam, y Postfix sería un servicio más que mantener y
parchear.

**Invitados**: quien entra por un enlace de invitación recibe un token de asiento
firmado y de vida corta, ligado a una sala y un asiento. Juega sin cuenta y no
puede tocar ninguna otra sala. Es lo que el flujo actual hace de hecho, pero sin
garantía.

**Defensas**: rate limit por IP y por cuenta en login, registro, reenvío de
correo y reset; respuestas idénticas ante email existente e inexistente para no
filtrar quién está registrado; CORS con lista blanca explícita de orígenes;
cabeceras por `@fastify/helmet`; y cuerpo de petición con tamaño máximo.

---

## 6. La VPS

Sin Docker: un proceso, un servicio y un proxy. Todo el aprovisionamiento son
scripts idempotentes versionados en `infra/`, no pasos hechos a mano.

**Base**: usuario sin privilegios, acceso SSH solo por clave, root deshabilitado,
`ufw` abierto en 22/80/443 y nada más, `fail2ban` y `unattended-upgrades`.

**nginx** como proxy inverso: TLS de Let's Encrypt con renovación automática,
`proxy_pass` a `127.0.0.1:3000` y la cabecera `Upgrade` para el WebSocket. El
proceso de Node no escucha nunca en una interfaz pública.

**systemd** con el hardening puesto: `NoNewPrivileges`, `ProtectSystem=strict`,
`PrivateTmp`, `MemoryMax`, `Restart=always`. La base de datos en
`/var/lib/devweb/`, escribible solo por el usuario del servicio.

**Despliegue**: GitHub Actions compila el servidor, lo sube por SSH y reinicia el
servicio. El Angular sigue publicándose en GitHub Pages, exactamente como hoy.

**Salud**: un endpoint `/health` que comprueba proceso y base de datos, y logs
estructurados en JSON por el logger que Fastify ya trae.

---

## 7. Fases

Cada fase deja el proyecto entero funcionando y desplegable. Ninguna deja el
sitio a medias entre dos backends.

| # | Qué | Terminada cuando |
|---|-----|------------------|
| 0 | Reglas, monorepo y extracción de `shared` | Los 36 specs pasan, la web se despliega igual, cero cambios de comportamiento |
| 1 | VPS, nginx, TLS, systemd, `/health` | `https://api.oscarblancorosales.com/health` responde y el despliegue automático funciona |
| 2 | Autenticación completa | Registro, verificación, login, refresh con rotación, logout y reset, con tests |
| 3 | Núcleo de salas, WebSocket y Scrum Poker | Se juega una partida entera contra el backend propio, y los votos ocultos no salen del servidor |
| 4 | RISK con servidor autoritativo | Se juega una partida entera, el servidor rechaza jugadas ilegales y `database.rules.json` desaparece |
| 5 | Throwdown y apagado de Firebase | `firebase` fuera de `package.json` y credenciales revocadas |

El orden no es negociable en un punto: la fase 0 va primera porque mover el
motor con los tests verdes es barato ahora y caro cuando haya un servidor
dependiendo de él.

---

## 8. Riesgos asumidos

**Un solo servidor, sin réplica.** Si la VPS cae, los juegos online caen; el
portfolio y las herramientas siguen en Pages. Es aceptable para lo que es, y la
copia diaria acota la pérdida. Escalar a más de un proceso exigiría sacar el
estado de las salas a un almacén compartido: no se hace ahora y no se diseña
para ello por adelantado.

**Dependencia de un relay SMTP externo.** Si el proveedor falla, no se pueden
verificar cuentas nuevas. Las cuentas ya activas siguen entrando sin problema, y
la interfaz `Mailer` permite cambiar de proveedor sin tocar el dominio.

**El motor compartido acopla web y servidor.** Un cambio de reglas obliga a
desplegar los dos. Es exactamente el acoplamiento que se busca: la alternativa
—dos motores— es la que produce partidas que divergen.
