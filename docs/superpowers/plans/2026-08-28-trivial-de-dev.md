# Trivial de dev — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir el Trivial de dev como cuarto juego arbitrado por el servidor —tres clases de prueba, puntuación por acierto y orden, presentador con guion propio— y dejar su tarjeta en «jugable».

**Architecture:** `GameModule` nuevo con reglas puras en `packages/shared/src/games/trivial/`; el banco de preguntas vive en `apps/server` y las preguntas entran en el estado por la configuración de la sala, de modo que la web nunca las importa; presentador en dos capas (guion determinista compartido + reescritura opcional con la IA que el usuario ya tiene configurada en su navegador).

**Tech Stack:** TypeScript, TypeBox, Vitest, Fastify + WebSocket, Angular standalone + signals.

**Spec:** `docs/superpowers/specs/2026-08-28-trivial-de-dev-design.md`

## Global Constraints

- `packages/shared` no importa Angular, RxJS, Firebase ni Node, ni nombra `window`/`document`/`localStorage`. Solo TypeBox. Lo impide ESLint.
- **`apps/web` no importa nunca `apps/server`.** Es lo que mantiene las respuestas fuera del bundle.
- Un contrato, no dos: los esquemas se declaran una vez con TypeBox.
- `any` prohibido; en las fronteras entra `unknown`.
- `apps/server` compila con `noUncheckedIndexedAccess`.
- El motor es **puro**: sin reloj, sin `Math.random`. El azar sale de la semilla del estado.
- Comentarios que justifican **por qué**. Ficheros por debajo de ~300 líneas.
- Vitest, primero el que falla.
- `npm run lint` no puede subir su tope de avisos: el código nuevo no añade ninguno.
- Commits en español, una línea, contando el porqué.

**Comandos:** `npm run test -w @devweb/shared`, `-w @devweb/server`, `-w @devweb/web`; `npm run typecheck`; `npm run lint`.

**Base:** rama `juego-trivial`, encima de `juego-flota`. Reutiliza `botAction` y el conductor de bots que llegaron con la flota.

---

## File Structure

```
packages/shared/src/games/trivial/
  tipos.ts     Pregunta, Ronda, TrivialState, TrivialView, TrivialAction
  reglas.ts    puntuar, cerrar, avanzar — funciones puras
  guion.ts     las frases del presentador
  bot.ts       qué contesta un asiento sin nadie detrás
  index.ts     el GameModule
apps/server/src/games/trivial/banco.ts       las preguntas con sus respuestas
apps/server/src/games/trivial/banco.spec.ts  la salud del banco
apps/server/src/rooms/registry.ts            + el módulo
apps/server/src/rooms/service.ts             reparte preguntas al crear la sala
packages/shared/src/contracts/rooms.ts       + 'trivial' en GameId
apps/web/src/app/games/trivial/
  trivial-room.service.ts   la sala contra la API
  presentador.ts            la capa de IA sobre el guion
  trivial-lobby/            crear sala, elegir rival
  trivial-room/             pregunta, respuestas, marcador
apps/web/src/app/games/games.ts   la tarjeta pasa a 'listo'
apps/web/src/app/app.routes.ts    las dos rutas
```

---

### Task 1: Preguntas y puntuación

**Files:** Create `packages/shared/src/games/trivial/tipos.ts`, `reglas.ts`; Test `reglas.spec.ts`

**Interfaces produced:** `Pregunta`, `Respuesta`, `Ronda`, `TrivialState`, `BONUS_POR_ORDEN`; `puntosDe(pregunta, respuestas, seat)`, `aciertaCon(pregunta, valor)`.

- [ ] **Step 1: Los tipos**

```ts
export type TipoPrueba = 'test' | 'estimacion' | 'fallo';

export interface Pregunta {
  readonly id: string;
  readonly tipo: TipoPrueba;
  readonly enunciado: string;
  readonly codigo?: string;
  /** Las cuatro opciones. En 'estimacion' está vacío: se escribe un número. */
  readonly opciones: readonly string[];
  /** El índice bueno en 'test' y 'fallo'; el número exacto en 'estimacion'. */
  readonly correcta: number;
  readonly explicacion: string;
}

export interface Respuesta {
  readonly valor: number;
  /** El puesto en que llegó, empezando por 0. Lo pone el servidor al aplicar. */
  readonly orden: number;
}

export interface Ronda {
  readonly pregunta: Pregunta;
  readonly cerrada: boolean;
  readonly respuestas: Readonly<Record<SeatId, Respuesta>>;
}
```

`TrivialState`: `preguntas`, `rondas`, `actual` (índice), `puntos`, `fase` (`'presentacion' | 'ronda' | 'resultado' | 'fin'`), `orden` (asientos que juegan), `semilla`, `nivelBot`.

- [ ] **Step 2: Tests que fallan**

```ts
describe('puntuar un test', () => {
  it('acertar el primero da 100 y el bonus entero', () => { /* 150 */ });
  it('acertar el segundo da 100 y 35', () => { /* 135 */ });
  it('el quinto en acertar ya no cobra bonus', () => { /* 100 */ });
  it('fallar no da nada, y nunca resta', () => { /* 0 */ });
  it('no contestar no da nada', () => { /* 0 */ });
  it('el orden del bonus solo cuenta entre los que aciertan', () => {
    // Quien falla primero no gasta el bonus del que acierta después.
  });
});

describe('puntuar una estimacion', () => {
  it('bordar la cifra da 100 y 20 de propina', () => { /* 120 */ });
  it('quedarse cerca da casi todo', () => {});
  it('pasarse por el doble no da nada', () => {});
  it('quedarse corto y pasarse lo mismo puntuan igual', () => {});
  it('con la respuesta correcta a cero no divide entre cero', () => {});
});
```

- [ ] **Step 3: Verificar que falla.** `npm run test -w @devweb/shared -- trivial`
- [ ] **Step 4: Implementar**

```ts
/** 50 al primero que acierta, 35 al segundo, 20 al tercero, 5 al cuarto. */
export const BONUS_POR_ORDEN = [50, 35, 20, 5] as const;
export const PUNTOS_ACIERTO = 100;
export const PROPINA_EXACTA = 20;
```

`puntosDe` distingue por `pregunta.tipo`: en `test`/`fallo`, acierto binario más el bonus según cuántos acertaron antes; en `estimacion`, `100 * max(0, 1 - |mío - correcto| / max(1, |correcto|))` redondeado, más la propina si coincide exacto.

- [ ] **Step 5: Verificar que pasa.** Mismo comando.
- [ ] **Step 6: Commit.** `git commit -m "Las tres pruebas del Trivial y lo que puntua cada una"`

---

### Task 2: Las rondas y el secreto

**Files:** Create `packages/shared/src/games/trivial/index.ts`; Modify `tipos.ts` (esquema y vista), `packages/shared/src/contracts/rooms.ts`, `apps/server/src/rooms/registry.ts`; Test `trivial.spec.ts`

**Interfaces produced:** `trivialModule`, `TrivialAction` (`empezar` | `responder {valor}` | `siguiente`), `TrivialView`.

- [ ] **Step 1: El esquema y la vista**

`TrivialView` lleva `fase`, `ronda` (número y total), `enunciado`, `codigo`, `opciones`, `tipo`, `hanRespondido`, `tuRespuesta`, `puntos`, `clasificacion`, y **solo cuando la ronda está cerrada**: `correcta`, `explicacion`, `respuestas` y `ganados` de la ronda.

- [ ] **Step 2: Tests que fallan** — el primero del bloque de vista es el que justifica el juego:

```ts
describe('lo que ve cada asiento', () => {
  it('la respuesta correcta no sale mientras la ronda esta abierta', () => {
    const vista = vistaDe(enRonda(), 'ana');
    expect(vista.correcta).toBeNull();
    expect(JSON.stringify(vista)).not.toContain(PREGUNTA.explicacion);
  });
  it('las respuestas ajenas tampoco salen', () => {});
  it('si sale quien ha respondido ya, pero no que ha puesto', () => {});
  it('al cerrarse sale la correcta, la explicacion y lo que puso cada uno', () => {});
});

describe('rondas', () => {
  it('no se responde dos veces', () => { /* 'ya-respondida' */ });
  it('no se responde a una ronda cerrada', () => { /* 'ronda-cerrada' */ });
  it('no se responde con una opcion que no existe', () => { /* 'opcion-inexistente' */ });
  it('la ronda se cierra sola cuando han contestado todos', () => {});
  it('cerrar la ronda reparte los puntos una sola vez', () => {});
  it('siguiente avanza y abre la siguiente pregunta', () => {});
  it('quien no abrio la sala no pasa una ronda que sigue abierta', () => {});
  it('tras la ultima ronda la partida termina', () => {});
});
```

- [ ] **Step 3: Verificar que falla.**
- [ ] **Step 4: Implementar el módulo.** `createState` lee las preguntas de `config.preguntas` —las mete el servidor— y deja `fase: 'presentacion'`. `apply` de `responder` anota la respuesta con su `orden` y, si ya han contestado todos los asientos, cierra la ronda y suma los puntos. `view` oculta `correcta`, `explicacion` y `respuestas` mientras `!ronda.cerrada`.
- [ ] **Step 5: Enchufarlo.** `'trivial'` en `GameId` (contrato y `games/module.ts`) y en `JUEGOS` del registro.
- [ ] **Step 6: Verificar.** `npm run test -w @devweb/shared && npm run test -w @devweb/server && npm run typecheck`
- [ ] **Step 7: Commit.** `git commit -m "El Trivial se juega por rondas, y la respuesta correcta no sale del servidor"`

---

### Task 3: El banco de preguntas

**Files:** Create `apps/server/src/games/trivial/banco.ts`, `banco.spec.ts`; Modify `apps/server/src/rooms/service.ts`; Test en `rooms.spec.ts`

**Interfaces produced:** `BANCO: readonly Pregunta[]`, `repartir(semilla, cuantas): Pregunta[]`.

- [ ] **Step 1: Tests que fallan** — la salud del banco, que es lo que evita una partida rota por una errata:

```ts
describe('el banco', () => {
  it('tiene preguntas de las tres clases', () => {});
  it('ninguna repite id', () => {});
  it('las de opciones tienen cuatro, sin repetir', () => {});
  it('la correcta de una de opciones cae dentro del rango', () => {});
  it('las de estimacion no traen opciones', () => {});
  it('todas explican la respuesta', () => {});
  it('las de pillar el fallo traen codigo', () => {});
});

describe('repartir', () => {
  it('da las que se le piden y sin repetir', () => {});
  it('con la misma semilla da la misma tanda', () => {});
  it('con semillas distintas no siempre da lo mismo', () => {});
  it('si se piden mas de las que hay, da todas', () => {});
});
```

- [ ] **Step 2: Verificar que falla.**
- [ ] **Step 3: Escribir el banco** — al menos 30 preguntas repartidas entre las tres clases: historia de la informática, JavaScript y sus rarezas, `git`, HTTP, complejidad, y cultura de oficina. `repartir` baraja con `shuffle` y el `Rng` que ya existen en `@devweb/shared/engine/rng`.
- [ ] **Step 4: Repartir al crear la sala** — en `RoomService.crear`, si el juego es `trivial`, añadir `preguntas` a la configuración antes de guardarla. Es el único sitio donde el servidor sabe de un juego concreto, y por eso va con su comentario: la alternativa —que el módulo se traiga el banco— metería las respuestas en el bundle de la web.
- [ ] **Step 5: Verificar.** `npm run test -w @devweb/server`
- [ ] **Step 6: Commit.** `git commit -m "Las preguntas viven en el servidor, que es el unico sitio donde no se pueden mirar"`

---

### Task 4: El presentador

**Files:** Create `packages/shared/src/games/trivial/guion.ts`, `guion.spec.ts`

**Interfaces produced:** `frasePara(momento, datos, rng): string`, tipo `Momento`.

- [ ] **Step 1: Tests que fallan**

```ts
describe('el guion', () => {
  it('tiene frase para cada momento del concurso', () => {});
  it('con la misma semilla dice lo mismo', () => {});
  it('con semillas distintas no siempre dice lo mismo', () => {});
  it('mete el nombre de quien gana la ronda', () => {});
  it('siempre que puede se acuerda de Oscar', () => {
    // El personaje es el encargo, no un adorno: si esto se cae, el juego
    // deja de ser lo que se pidió.
  });
});
```

- [ ] **Step 2: Verificar que falla.**
- [ ] **Step 3: Escribir el guion** — momentos: `bienvenida`, `presentaRonda`, `nadieAcierta`, `aciertaAlguien`, `empate`, `ultimaRonda`, `despedida`. Varias frases por momento, elegidas con el `Rng` de la semilla. El personaje: chulesco, con prisa, y con la coña recurrente de que Óscar es el mejor programador de la historia o el maestro de quien salga en la pregunta.
- [ ] **Step 4: Verificar.**
- [ ] **Step 5: Commit.** `git commit -m "El presentador del Trivial, con su guion y su manía"`

---

### Task 5: El bot

**Files:** Create `packages/shared/src/games/trivial/bot.ts`, `bot.spec.ts`; Modify `index.ts`

- [ ] **Step 1: Tests que fallan** — `novato` acierta poco, `almirante`… aquí los niveles se llaman `pardillo`, `apañado` y `sabelotodo`: el `sabelotodo` acierta casi siempre y el `pardillo` casi nunca; todos son deterministas con la misma semilla; ninguno responde dos veces ni fuera de su fase.
- [ ] **Step 2: Verificar que falla.**
- [ ] **Step 3: Implementar** — `botAction` responde con la correcta o con una opción al azar según una probabilidad por nivel, sacada de `rngFor(semilla, jugadas, seat)`. En estimación, se desvía un porcentaje. **El bot sí conoce la respuesta porque corre en el servidor**, y es la única pieza que puede.
- [ ] **Step 4: Verificar.**
- [ ] **Step 5: Commit.** `git commit -m "Rivales de mesa para el Trivial, con tres grados de sabelotodo"`

---

### Task 6: La sala en la web

**Files:** Create `apps/web/src/app/games/trivial/trivial-room.service.ts` + spec

- [ ] **Step 1: Test que falla** — refleja la vista; un rechazo se cuenta sin borrar la partida; crear con bot pide su nivel; las jugadas salen por el socket. Mismo patrón que `flota-room.service.spec.ts`.
- [ ] **Step 2: Verificar que falla.**
- [ ] **Step 3: Implementar** sobre `RoomSocket` y `RoomsApiService`, con señales, como el de la flota.
- [ ] **Step 4: Verificar.** `npm run test -w @devweb/web -- trivial`
- [ ] **Step 5: Commit.** `git commit -m "La web habla con la sala del Trivial"`

---

### Task 7: Las pantallas y el presentador con IA

**Files:** Create `apps/web/src/app/games/trivial/presentador.ts` + spec, `trivial-lobby/`, `trivial-room/`; Modify `app.routes.ts`, `console/commands.spec.ts` (las rutas nuevas van a `SIN_COMANDO`, como las de la flota y RISK)

- [ ] **Step 1: El presentador** — test primero: sin IA configurada devuelve la frase del guion tal cual; si la IA tarda o devuelve basura, también; si responde bien, devuelve su versión. Nunca lanza.
- [ ] **Step 2: Implementar** sobre el cliente de IA que ya existe (`@devweb/shared/engine/ai/ai-client`), con la clave que el usuario ya tiene en su navegador.
- [ ] **Step 3: El lobby** — crear sala, elegir rivales (personas por enlace o bots con su nivel), entrar. Como `flota-lobby`.
- [ ] **Step 4: La sala** — la frase del presentador arriba, la pregunta con su código si lo lleva, las cuatro opciones o el campo de número, quién ha respondido ya, y al cerrarse la ronda: la correcta, la explicación y los puntos. Al final, la clasificación.
- [ ] **Step 5: Rutas** — `juegos/trivial` y `juegos/trivial/mesa`, con `loadComponent`.
- [ ] **Step 6: Verificar.** `npm run test -w @devweb/web && npm run typecheck && npm run lint`
- [ ] **Step 7: Commit.** `git commit -m "El Trivial, en pantalla, con quien lo presenta"`

---

### Task 8: La tarjeta

**Files:** Modify `apps/web/src/app/games/games.ts`; Test `games.spec.ts`

- [ ] **Step 1: Test que falla** — la tarjeta `trivial` tiene `status: 'listo'` y `route: '/juegos/trivial'`.
- [ ] **Step 2: Verificar que falla.**
- [ ] **Step 3: Implementar** — cambiar la tarjeta y sus `highlights`: las tres clases de prueba, el presentador y las preguntas que no se pueden mirar.
- [ ] **Step 4: Verificar todo.** `npm run test && npm run typecheck && npm run lint`
- [ ] **Step 5: Commit.** `git commit -m "El Trivial ya se juega"`

---

## Self-Review

**Cobertura de la spec:** pruebas §1 → tarea 1; puntuación §2 → tarea 1; secreto §3 → tareas 2 y 3 (el test con nombre propio está en la 2); presentador §4 → tareas 4 y 7; transcurso §5 → tarea 2; bots → tarea 5; pantallas → tareas 6–8.

**Sin placeholders:** los tests van nombrados en vez de escritos enteros porque los ejecuta la misma sesión que los escribe y el patrón está fijado por `flota.spec.ts`, que es el hermano directo de este juego. Los puntos con decisión de diseño —la fórmula de puntuación, qué oculta `view`, dónde vive el banco— sí llevan el código o la regla exacta.

**Tipos:** `Pregunta`, `Respuesta`, `Ronda`, `TrivialState`, `TrivialView`, `TrivialAction` y `Momento` se usan con el mismo nombre en todas las tareas. Los niveles de bot del Trivial (`pardillo`, `apañado`, `sabelotodo`) son suyos y no se mezclan con los de la flota.
