# El Concurso PRO — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NO se usan subagentes en este repositorio.** Es preferencia expresa del dueño: quiere el paso a paso en la sesión principal. Ignora la recomendación por defecto de `subagent-driven-development`.

**Goal:** Convertir El Concurso en un programa de televisión jugable —plató a pantalla completa con atriles, rótulos de sección, cronómetro del servidor, final a doble o nada y podio— con un presentador que vuelve a hablar por IA y un modo en el que las preguntas las escribe la IA entera.

**Architecture:** El servidor manda el show y el navegador solo pinta. Todo lo que cambia la partida —reloj, apuestas, impugnaciones, frases del presentador— entra por acciones del motor, así que llega a los cinco a la vez y sobrevive a una recarga. El motor (`packages/shared/src/games/trivial`) sigue siendo puro y determinista: las horas y las preguntas entran como datos de acciones o de la configuración de la sala, nunca leyendo el reloj ni la red desde el reducer.

**Tech Stack:** TypeScript estricto, Angular 21 zoneless con señales y `@if`/`@for`, Fastify + WebSocket, TypeBox para todo lo que llega de fuera, vitest para las pruebas.

**Spec:** `docs/superpowers/specs/2026-09-11-concurso-pro-plato-design.md`

## Global Constraints

- **Cero errores y cero avisos.** El lint corre con `--max-warnings 0`. Se arregla la causa, nunca se sube el tope ni se añade un `eslint-disable`.
- **Comandos, desde la raíz del repositorio:**
  - Lint: `npx eslint . --max-warnings 0 --report-unused-disable-directives`
  - Tipos: `npm run typecheck`
  - Pruebas de todo: `npm run test`
  - Pruebas de un paquete: `npx vitest run --root packages/shared <ruta>` · `npx vitest run --root apps/server <ruta>`
  - **Pruebas de la web:** desde `apps/web`, `npx ng test --watch=false --include=<ruta>`. Vitest directo falla ahí con «PlatformLocation needs JIT».
  - Servir la web en local: `npm run start -w @devweb/web` (nunca `ng serve` desde un worktree).
- **Idioma:** todo el código, los comentarios, los identificadores y los mensajes de commit van en español, con acentos. Es la convención de este repositorio; míralo en cualquier fichero antes de escribir.
- **Los comentarios explican el porqué, no el qué.** Mira `packages/shared/src/games/trivial/reglas.ts` para calibrar el tono.
- **Las respuestas no viajan al navegador** mientras la ronda está abierta. Ninguna tarea puede importar `apps/server/src/games/trivial/banco.ts` ni `pruebas.ts` desde `apps/web`.
- **El reducer es puro.** Nada de `Date.now()`, `Math.random()` ni `fetch` dentro de `packages/shared/src/games/trivial/index.ts`. Las horas entran como datos de una acción; el azar sale de `rngFor(semilla, jugadas, sal)`.
- **Un commit por tarea**, con el pie de firma que usa el repositorio:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NptgZcGJY3CkStmpok4Lhx
  ```

---

## Mapa de ficheros

**Se crean:**

| Fichero | De qué se ocupa |
|---|---|
| `packages/shared/src/games/trivial/medida.ts` | Recortar lo que dice el presentador y calcular su presupuesto de tokens |
| `packages/shared/src/games/trivial/medida.spec.ts` | Sus pruebas, con las cifras reales de los logs |
| `apps/server/src/games/trivial/regidor.ts` | El reloj de la sala: abre la cuenta atrás y cierra la ronda al vencer |
| `apps/server/src/games/trivial/regidor.spec.ts` | Sus pruebas |
| `apps/server/src/rooms/coro.ts` | Reparte `trasJugada` entre varios narradores (la sala solo tiene un hueco) |
| `apps/server/src/rooms/coro.spec.ts` | Sus pruebas |
| `apps/server/src/games/trivial/inventor.ts` | Pide a la IA el programa entero y lo valida |
| `apps/server/src/games/trivial/inventor.spec.ts` | Sus pruebas, con dobles: no toca la red |
| `apps/server/src/games/trivial/inventor-prompts.ts` | El encargo de cada prueba y el reparto de temas |
| `apps/web/src/app/games/trivial/plato/plato.ts\|html\|css` | El escenario: fondo, focos, suelo y el botón de silencio |
| `apps/web/src/app/games/trivial/plato/presentador/*` | La figura, el gesto y el bocadillo |
| `apps/web/src/app/games/trivial/plato/atriles/*` | La fila de puestos y sus reacciones |
| `apps/web/src/app/games/trivial/plato/panel-pregunta/*` | Enunciado, código y opciones |
| `apps/web/src/app/games/trivial/plato/rotulo/*` | La cortinilla de sección |
| `apps/web/src/app/games/trivial/plato/cronometro/*` | La barra de cuenta atrás |
| `apps/web/src/app/games/trivial/plato/apuesta/*` | El mando de la apuesta final |
| `apps/web/src/app/games/trivial/plato/podio/*` | La ceremonia y el confeti |
| `apps/web/src/app/games/trivial/plato/sonido.ts` | Los efectos, generados en el navegador |

**Se modifican:**

| Fichero | Qué cambia |
|---|---|
| `packages/shared/src/games/trivial/tipos.ts` | Fase `apuestas`, prueba `final`, `cierraEn`, `apuestas`, `impugnan`, `inventadas`, `dificultad`, acciones nuevas |
| `packages/shared/src/games/trivial/index.ts` | El reducer: reloj, apuestas, impugnación, final |
| `packages/shared/src/games/trivial/reglas.ts` | Lo que se gana y se pierde en la final |
| `packages/shared/src/games/trivial/guion.ts` | Seis momentos nuevos con sus frases escritas |
| `packages/shared/src/games/trivial/momentos.ts` | Detectarlos |
| `packages/shared/src/games/trivial/prompts.ts` | Un encargo **con su medida** por momento |
| `apps/server/src/games/trivial/presentador.ts` | Usa la medida, recorta, y pone plazo por modelo |
| `apps/server/src/games/trivial/banco.ts` | La escaleta se cierra con la final |
| `apps/server/src/games/trivial/pruebas.ts` | El grupo `FINAL` |
| `apps/server/src/rooms/service.ts` | Monta el programa (banco o IA) y compone regidor + presentador |
| `apps/web/src/app/games/trivial/trivial-room.service.ts` | `apostar()` e `impugnar()` |
| `apps/web/src/app/games/trivial/trivial-room/*` | Pasa a ser el director del plató |
| `apps/web/src/app/games/trivial/trivial-lobby/*` | Elegir banco o IA |

---

## Fase A — Que el presentador vuelva a hablar

Va primero porque es el fallo que está en producción ahora mismo, no depende de
nada de lo demás, y se puede desplegar y oír funcionando el mismo día.

### Task 1: La medida de lo que dice el presentador

El fallo de producción, en una frase: le pedimos `maxTokens: 120` —unas 480
letras en español— y rechazamos todo lo que pase de 320. Diez de diez frases
descartadas. Esta tarea crea la pieza que hace imposible esa contradicción:
una sola cifra de la que salen el presupuesto **y** el recorte.

**Files:**
- Create: `packages/shared/src/games/trivial/medida.ts`
- Test: `packages/shared/src/games/trivial/medida.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export function presupuestoDe(largo: number): number`
  - `export function recortar(texto: string, largo: number): string | null`

- [ ] **Step 1: Escribe las pruebas que fallan**

Crea `packages/shared/src/games/trivial/medida.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { presupuestoDe, recortar } from './medida';

describe('el presupuesto de tokens', () => {
  it('da menos tokens a los momentos cortos que a los largos', () => {
    expect(presupuestoDe(90)).toBeLessThan(presupuestoDe(420));
  });

  it('no pide tanto como para escribir el doble de lo que se acepta', () => {
    // El fallo de producción del día 10: 120 tokens dan unas 480 letras y se
    // rechazaba a partir de 320. Un token da unas cuatro letras en español, así
    // que el presupuesto nunca puede dar para mucho más que la medida.
    for (const largo of [90, 140, 240, 320, 420]) {
      expect(presupuestoDe(largo) * 4).toBeLessThan(largo * 2);
    }
  });

  it('siempre deja sitio para una frase, por corta que sea la medida', () => {
    expect(presupuestoDe(1)).toBeGreaterThanOrEqual(16);
  });
});

describe('recortar lo que dice', () => {
  it('deja pasar lo que cabe, tal cual', () => {
    expect(recortar('Ronda cinco. A ver quién se moja.', 140)).toBe(
      'Ronda cinco. A ver quién se moja.',
    );
  });

  it('quita los espacios de los lados', () => {
    expect(recortar('  Vamos allá.  ', 140)).toBe('Vamos allá.');
  });

  it('corta por la última frase entera que quepa', () => {
    const largo = 'Primera frase. Segunda frase. Tercera frase que ya no cabe.';
    expect(recortar(largo, 30)).toBe('Primera frase. Segunda frase.');
  });

  it('vale también con interrogaciones y exclamaciones', () => {
    expect(recortar('¡Toma ya! ¿Quién lo ha dicho? Y se acabó.', 12)).toBe('¡Toma ya!');
  });

  it('devuelve null cuando ni la primera frase cabe', () => {
    // Aquí es donde se cae al guion escrito. No se corta a mitad de palabra:
    // media frase del presentador suena peor que la frase de reserva entera.
    expect(recortar('Una frase larguísima que no cabe de ninguna manera.', 10)).toBeNull();
  });

  it('devuelve null si el modelo no dijo nada aprovechable', () => {
    expect(recortar('   ', 140)).toBeNull();
    expect(recortar('ok', 140)).toBeNull();
  });

  it('salva las respuestas que producción estaba tirando', () => {
    // Las cifras son las de los logs del VPS del 10 de septiembre: 495, 484 y
    // 409 letras, todas descartadas enteras. Con el recorte, de las tres sale
    // algo que se puede enseñar.
    for (const letras of [495, 484, 409]) {
      const frase = 'Vaya nivel, señores. ';
      const largo = frase.repeat(Math.ceil(letras / frase.length)).slice(0, letras);
      const salida = recortar(largo, 320);
      expect(salida).not.toBeNull();
      expect(salida?.length).toBeLessThanOrEqual(320);
      expect(salida?.endsWith('.')).toBe(true);
    }
  });

  it('se quita las comillas y los asteriscos con los que a veces envuelve', () => {
    expect(recortar('"Vamos allá."', 140)).toBe('Vamos allá.');
    expect(recortar('**Vamos allá.**', 140)).toBe('Vamos allá.');
  });
});
```

- [ ] **Step 2: Compruébalo, tiene que fallar**

Run: `npx vitest run --root packages/shared src/games/trivial/medida.spec.ts`
Expected: FAIL — «Failed to resolve import "./medida"».

- [ ] **Step 3: Escribe la pieza**

Crea `packages/shared/src/games/trivial/medida.ts`:

```ts
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

/** Letras que da un token en español, tirando por lo bajo. */
const LETRAS_POR_TOKEN = 4;

/** Lo mínimo que se pide, para que quepa una frase aunque la medida sea corta. */
const SUELO = 16;

/**
 * Los tokens que se le piden para una medida dada.
 *
 * Se divide por tres y no por cuatro a propósito: deja un poco de holgura para
 * que termine la última frase en vez de cortarla a mitad, sin darle cuerda para
 * un discurso.
 */
export function presupuestoDe(largo: number): number {
  return Math.max(SUELO, Math.ceil(largo / 3));
}

/** Lo que hay que quitar de los lados: el modelo envuelve de más. */
const ENVOLTORIOS = /^[\s"'«»*_]+|[\s"'«»*_]+$/g;

/** Por dónde acaba una frase. */
const FIN_DE_FRASE = /[.!?…]/g;

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
 * hay nada aprovechable.
 */
function ultimoFinDeFraseHasta(texto: string, largo: number): number {
  let corte = 0;
  for (const encontrado of texto.slice(0, largo).matchAll(FIN_DE_FRASE)) {
    corte = (encontrado.index ?? 0) + 1;
  }
  return corte;
}
```

- [ ] **Step 4: Que pasen**

Run: `npx vitest run --root packages/shared src/games/trivial/medida.spec.ts`
Expected: PASS, 11 pruebas.

- [ ] **Step 5: Lint y tipos**

Run: `npx eslint packages/shared/src/games/trivial/medida.ts packages/shared/src/games/trivial/medida.spec.ts --max-warnings 0`
Run: `npm run typecheck`
Expected: sin salida, sin avisos.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/games/trivial/medida.ts packages/shared/src/games/trivial/medida.spec.ts
git commit -m "$(cat <<'EOF'
feat(concurso): una sola cifra manda en lo que puede decir el presentador

Le pedíamos 120 tokens -unas 480 letras- y rechazábamos a partir de 320.
Diez de diez frases a la basura y el concurso mudo con la IA funcionando.

De la medida de cada momento salen ahora el presupuesto y el recorte, así que
no se pueden volver a contradecir. Y lo que se pasa se corta por la última
frase entera en vez de tirarse: media frase suena a fallo, pero una frase de
menos no la nota nadie.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NptgZcGJY3CkStmpok4Lhx
EOF
)"
```

---

### Task 2: Un encargo con su medida por cada momento

**Files:**
- Modify: `packages/shared/src/games/trivial/prompts.ts`
- Test: `packages/shared/src/games/trivial/prompts.spec.ts` (ya existe, se amplía)

**Interfaces:**
- Consumes: `Momento` de `./guion`, `ContextoDelPresentador` de este mismo fichero.
- Produces:
  - `export function largoDe(momento: Momento): number`
  - `encargoPara(ctx)` sigue existiendo con la misma firma, pero ahora mete la cifra en el texto.

- [ ] **Step 1: Escribe las pruebas que fallan**

Añade al final de `packages/shared/src/games/trivial/prompts.spec.ts` (respeta los imports que ya tenga el fichero; añade `largoDe` al import de `./prompts` y `MOMENTOS` desde `./guion`):

```ts
describe('cada momento tiene su medida', () => {
  it('todos los momentos declaran una', () => {
    for (const momento of MOMENTOS) {
      expect(largoDe(momento)).toBeGreaterThan(0);
    }
  });

  it('la entradilla puede extenderse y la bomba no', () => {
    // No es un capricho: en la bomba se habla con la mecha corriendo, y una
    // parrafada ahí corta el ritmo de la prueba.
    expect(largoDe('bienvenida')).toBeGreaterThan(largoDe('pasaLaBomba'));
    expect(largoDe('podio')).toBeGreaterThan(largoDe('presentaRonda'));
  });

  it('el encargo le dice la cifra, no un adjetivo', () => {
    const encargo = encargoPara({
      momento: 'explota',
      jugadores: [{ nombre: 'Nova', puntos: 300, esBot: false }],
      protagonista: 'Nova',
      cifra: 180,
      ronda: 7,
      rondas: 21,
      seccion: 'La bomba',
      guion: 'Le ha estallado a Nova.',
    });

    expect(encargo).toContain(String(largoDe('explota')));
    expect(encargo).toMatch(/letras/);
  });
});
```

- [ ] **Step 2: Compruébalo, tiene que fallar**

Run: `npx vitest run --root packages/shared src/games/trivial/prompts.spec.ts`
Expected: FAIL — `largoDe` no está exportado.

- [ ] **Step 3: Cambia `prompts.ts`**

Sustituye la función `limite()` del final del fichero por la tabla de medidas y su acceso, y cambia `encargoPara` para que use la cifra:

```ts
/**
 * Cuánto puede hablar en cada momento, en letras.
 *
 * Esta cifra manda en tres sitios a la vez -lo que se le pide, los tokens que
 * se le dan y por dónde se recorta- y por eso está sola aquí. Cuando había una
 * longitud para los veinte momentos, la entradilla salía igual de larga que un
 * «¡BOOM!», y el presupuesto de tokens daba para el doble de lo que se
 * aceptaba: el concurso estuvo mudo en producción por eso.
 *
 * El criterio es el ritmo del programa, no la importancia del momento: se
 * habla largo cuando el juego está parado -entradilla, repaso, podio- y corto
 * cuando está corriendo.
 */
const LARGOS: Readonly<Record<Momento, number>> = {
  bienvenida: 420,
  presentaRonda: 120,
  aciertaAlguien: 140,
  nadieAcierta: 140,
  empate: 120,
  ultimaRonda: 160,
  despedida: 380,

  seccionTest: 240,
  seccionEstimacion: 240,
  seccionFallo: 240,
  seccionPulsa: 240,
  seccionRafaga: 240,
  seccionBomba: 240,

  lider: 300,
  remonta: 160,
  seHunde: 160,
  pegados: 140,
  rachaBuena: 140,

  pasaLaBomba: 90,
  explota: 120,
};

export function largoDe(momento: Momento): number {
  return LARGOS[momento];
}

/**
 * Cuánto puede hablar, dicho con un número.
 *
 * «Una o dos frases cortas» no es una instrucción: es una opinión. Un modelo
 * la cumple escribiendo cuatrocientas letras y creyendo que ha sido breve.
 */
function limite(momento: Momento): string {
  const largo = largoDe(momento);
  const frases = largo >= 300 ? 'Entre dos y cuatro frases.' : 'Una o dos frases.';
  return `Extensión: como mucho ${largo} letras. ${frases} Devuelve solo lo que se dice en voz alta.`;
}
```

> Nota para quien lo implemente: `LARGOS` se escribe como `Record<Momento, number>` **sin** `Partial`, para que al añadir los momentos de la final en la Task 7 el compilador obligue a darles su medida. Es la red que evita que un momento nuevo entre sin longitud.

- [ ] **Step 4: Que pasen**

Run: `npx vitest run --root packages/shared src/games/trivial/prompts.spec.ts`
Expected: PASS.

- [ ] **Step 5: Lint, tipos y la tanda de shared**

Run: `npx eslint packages/shared --max-warnings 0`
Run: `npm run typecheck`
Run: `npx vitest run --root packages/shared`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/games/trivial/prompts.ts packages/shared/src/games/trivial/prompts.spec.ts
git commit -m "$(cat <<'EOF'
feat(concurso): cada momento del programa declara cuánto puede hablar

Antes había una tarea por momento pero una sola longitud para todos, y puesta
con adjetivos: «una o dos frases cortas». Un modelo cumple eso escribiendo
cuatrocientas letras y creyendo que ha sido breve.

Ahora la medida va en letras y en el encargo. Se habla largo cuando el juego
está parado -entradilla, repaso al marcador, despedida- y corto cuando está
corriendo: noventa letras en la bomba, que ahí se habla con la mecha
encendida.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NptgZcGJY3CkStmpok4Lhx
EOF
)"
```

---

### Task 3: El presentador usa la medida, recorta y da su turno a cada modelo

**Files:**
- Modify: `apps/server/src/games/trivial/presentador.ts`
- Test: `apps/server/src/games/trivial/presentador.spec.ts` (ya existe, se amplía)

**Interfaces:**
- Consumes: `largoDe` (Task 2), `recortar` y `presupuestoDe` (Task 1).
- Produces: nada nuevo hacia fuera. `PresentadorDeSala` mantiene su constructor.

- [ ] **Step 1: Escribe las pruebas que fallan**

Añade a `apps/server/src/games/trivial/presentador.spec.ts`. Reutiliza los
ayudantes que ya tenga el fichero para montar un estado y un actor de mentira;
si no los tiene con estos nombres, adapta los nombres, no la intención:

```ts
describe('lo que el presentador se atreve a decir', () => {
  it('recorta la respuesta larga en vez de tirarla', async () => {
    // Es el caso de producción del 10 de septiembre: 495 letras descartadas
    // enteras, y el presentador mudo con el modelo contestando bien.
    const largo = 'Menudo nivel, señores. '.repeat(30);
    const actor = actorDeMentira();

    const presentador = new PresentadorDeSala(
      ajustes(),
      () => ({ a: 'Nova' }),
      async () => ({ text: largo, model: 'uno' }),
    );
    presentador.trasJugada(actor, antes(), despues());
    await vi.waitFor(() => {
      expect(actor.frases.length).toBe(2);
    });

    const florida = actor.frases[1];
    expect(florida.length).toBeLessThanOrEqual(420);
    expect(florida.endsWith('.')).toBe(true);
  });

  it('se queda con el guion cuando no hay ni una frase aprovechable', async () => {
    const actor = actorDeMentira();
    const presentador = new PresentadorDeSala(
      ajustes(),
      () => ({ a: 'Nova' }),
      async () => ({ text: 'sinpuntoniunafraseenteraquequepaenlamedidadelmomento', model: 'uno' }),
    );
    presentador.trasJugada(actor, antes(), despues());

    // Se le da tiempo de sobra a que llegue una segunda frase que no debe llegar.
    await new Promise((listo) => setTimeout(listo, 20));
    expect(actor.frases.length).toBe(1);
  });

  it('le pide al modelo los tokens que pide la medida del momento', async () => {
    const pedidos: { maxTokens?: number }[] = [];
    const actor = actorDeMentira();
    const presentador = new PresentadorDeSala(
      ajustes(),
      () => ({ a: 'Nova' }),
      async (_ajustes, _mensajes, opciones) => {
        pedidos.push(opciones ?? {});
        return { text: 'Correcto, Nova.', model: 'uno' };
      },
    );
    presentador.trasJugada(actor, antes(), despues());
    await vi.waitFor(() => {
      expect(pedidos.length).toBe(1);
    });

    // Ni el fijo de antes ni tanto como para escribir el doble de lo aceptado.
    expect(pedidos[0].maxTokens).toBe(presupuestoDe(largoDe(momentoEsperado)));
  });

  it('le da su turno a cada modelo, no el presupuesto entero al primero', async () => {
    const plazos: (number | undefined)[] = [];
    const actor = actorDeMentira();
    const presentador = new PresentadorDeSala(
      ajustes(),
      () => ({ a: 'Nova' }),
      async (ajustes) => {
        plazos.push(ajustes.timeoutMs);
        return { text: 'Correcto, Nova.', model: 'uno' };
      },
    );
    presentador.trasJugada(actor, antes(), despues());
    await vi.waitFor(() => {
      expect(plazos.length).toBe(1);
    });

    // Sin esto, el primer modelo lento se come la paciencia entera y los cuatro
    // de reserva no llegan a estrenarse. Le pasaba al crupier y se arregló allí.
    expect(plazos[0]).toBeDefined();
    expect(plazos[0]).toBeLessThan(25_000);
  });
});
```

- [ ] **Step 2: Compruébalo, tiene que fallar**

Run: `npx vitest run --root apps/server src/games/trivial/presentador.spec.ts`
Expected: FAIL — se sigue tirando la respuesta larga y `timeoutMs` no llega.

- [ ] **Step 3: Cambia `presentador.ts`**

Tres cambios. Primero, los plazos, sustituyendo la constante `PACIENCIA_MS` y
borrando `LARGO_MAXIMO`:

```ts
/**
 * Lo que se espera en total antes de darlo por perdido.
 *
 * Mientras tanto la mesa ya está leyendo la frase escrita, así que esperar no
 * cuesta nada.
 */
const PACIENCIA_MS = 25_000;

/**
 * Lo que se le da a cada modelo por separado. Tres caben en la paciencia.
 *
 * Sin esto, el primero que va lento se come el presupuesto entero y la cadena
 * de reserva no llega a usarse: cinco modelos configurados y ninguno probado.
 */
const PLAZO_POR_MODELO_MS = 8_000;
```

Segundo, `florear` recibe la medida y la usa para todo:

```ts
  private async florear(contexto: ContextoDelPresentador): Promise<string | null> {
    if (!this.ajustes?.enabled) return null;

    const largo = largoDe(contexto.momento);
    const mensajes: ChatMessage[] = [
      { role: 'system', content: instruccionesDelPresentador() },
      { role: 'user', content: encargoPara(contexto) },
    ];

    try {
      const respuesta = await Promise.race([
        this.modelo(
          { ...this.ajustes, timeoutMs: PLAZO_POR_MODELO_MS },
          mensajes,
          { maxTokens: presupuestoDe(largo) },
        ),
        seAgota(),
      ]);

      // Recortar y no tirar. Una frase de más no puede dejar mudo al
      // presentador: era exactamente lo que pasaba en producción.
      const enseñable = recortar(respuesta.text, largo);
      if (enseñable) return enseñable;

      this.avisar(`el modelo no dijo ni una frase entera que quepa en ${largo} letras`);
      return null;
    } catch (fallo) {
      this.avisar(fallo instanceof Error ? fallo.message : 'el modelo falló sin decir por qué');
      return null;
    }
  }
```

Tercero, borra la función `aceptable()` del final del fichero —ya no la usa
nadie— y añade los imports:

```ts
import { presupuestoDe, recortar } from '@devweb/shared/games/trivial/medida';
import { encargoPara, instruccionesDelPresentador, largoDe } from '@devweb/shared/games/trivial/prompts';
```

- [ ] **Step 4: Que pasen**

Run: `npx vitest run --root apps/server src/games/trivial/presentador.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verificación completa y despliegue**

```bash
npx eslint . --max-warnings 0 --report-unused-disable-directives
npm run typecheck
npm run test
```
Expected: cero avisos, todo verde.

- [ ] **Step 6: Commit y push**

```bash
git add apps/server/src/games/trivial/presentador.ts apps/server/src/games/trivial/presentador.spec.ts
git commit -m "$(cat <<'EOF'
fix(concurso): el presentador vuelve a hablar

Llevaba mudo en producción desde el día 10 y no era culpa de la IA: el modelo
contestaba y nosotros tirábamos lo que decía. Diez de diez frases descartadas
por pasarse de 320 letras, con un presupuesto de 120 tokens que da para 480.

Ahora la medida del momento manda en el presupuesto y en el recorte, y lo que
se pasa se corta por la última frase entera. De propina, plazo por modelo
-ocho segundos- para que la cadena de reserva llegue a usarse: el mismo
arreglo que se le hizo al crupier y que aquí no se aplicó.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NptgZcGJY3CkStmpok4Lhx
EOF
)"
git push origin HEAD
```

- [ ] **Step 7: Compruébalo en producción**

Espera al despliegue y mira los logs:

```bash
ssh -i ~/.ssh/devweb_deploy ubuntu@57.129.143.230 \
  "sudo systemctl show devweb-api -p ActiveEnterTimestamp --value; \
   sudo journalctl -u devweb-api --since '10 min ago' --no-pager \
     | grep -i presentador | tail -20"
```

Expected: ninguna línea de «no dijo ni una frase entera». Abre una sala en
`https://oscarblancorosales.com/juegos/trivial`, juega tres rondas y comprueba
que las frases **cambian de tono** entre una y otra: si todas suenan a la
plantilla escrita, la IA sigue sin entrar y hay que volver a los logs antes de
seguir con el plan.

---

## Fase B — El motor: reloj, final e impugnación

El motor es puro y determinista y tiene que seguir siéndolo. Las horas entran
como dato de una acción; el azar sale de la semilla. Si algo de esta fase te
pide llamar a `Date.now()` dentro de `index.ts`, la solución es otra.

### Task 4: El reloj entra en la partida

**Files:**
- Modify: `packages/shared/src/games/trivial/tipos.ts`
- Modify: `packages/shared/src/games/trivial/index.ts`
- Modify: `packages/shared/src/games/trivial/reglas.ts`
- Test: `packages/shared/src/games/trivial/trivial.spec.ts` (ya existe, se amplía)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `TrivialState.cierraEn: number` — instante de cierre en ms, `0` si esta ronda no lleva reloj.
  - `TrivialView.cierraEn: number`.
  - Acciones de sistema `{ tipo: 'reloj'; hasta: number }` y `{ tipo: 'tiempo' }`.
  - `export const SEGUNDOS_POR_PRUEBA: Readonly<Record<TipoPrueba, number>>` en `reglas.ts`.

- [ ] **Step 1: Escribe las pruebas que fallan**

Añade a `packages/shared/src/games/trivial/trivial.spec.ts`. Reutiliza el
ayudante que el fichero ya tenga para montar una partida; si se llama de otra
forma, usa el suyo.

```ts
describe('el reloj de la ronda', () => {
  it('la sala guarda cuándo se cierra y lo manda en la vista', () => {
    const empezada = partidaEmpezada();
    const conReloj = trivialModule.apply(empezada, { tipo: 'reloj', hasta: 1_700 }, 'a', asientos);

    expect(conReloj.cierraEn).toBe(1_700);
    expect(vistaDe(conReloj, 'a').cierraEn).toBe(1_700);
  });

  it('al vencer, la ronda se cierra sola', () => {
    const empezada = partidaEmpezada();
    const vencida = trivialModule.apply(empezada, { tipo: 'tiempo' }, 'a', asientos);

    expect(vencida.fase).toBe('resultado');
    expect(vistaDe(vencida, 'a').cerrada).toBe(true);
  });

  it('quien no contestó a tiempo no suma, pero tampoco pierde', () => {
    const empezada = partidaEmpezada();
    const vencida = trivialModule.apply(empezada, { tipo: 'tiempo' }, 'a', asientos);

    expect(vencida.puntos['a'] ?? 0).toBe(0);
  });

  it('el tiempo que llega tarde no rompe nada y no se apunta', () => {
    // Que el temporizador salte cuando la mesa ya ha cerrado la ronda a mano no
    // es la excepción: es lo normal. Devolver el mismo objeto es la señal de
    // que no hay nada que escribir en el registro de la partida.
    const empezada = partidaEmpezada();
    const cerrada = trivialModule.apply(empezada, { tipo: 'tiempo' }, 'a', asientos);
    const otraVez = trivialModule.apply(cerrada, { tipo: 'tiempo' }, 'a', asientos);

    expect(otraVez).toBe(cerrada);
  });

  it('al pasar de ronda, el reloj se apaga hasta que lo pongan otra vez', () => {
    // Lo pone el regidor desde el servidor, con la hora de verdad. Si se
    // quedara el de la ronda anterior, la nueva nacería vencida.
    const empezada = partidaEmpezada();
    const conReloj = trivialModule.apply(empezada, { tipo: 'reloj', hasta: 1_700 }, 'a', asientos);
    const siguiente = trivialModule.apply(conReloj, { tipo: 'siguiente' }, 'a', asientos);

    expect(siguiente.cierraEn).toBe(0);
  });

  it('con la bomba en la mano, no contestar es que te estalle', () => {
    // Sin esto, la jugada ganadora en la bomba es quedarse quieto: se pierde la
    // mecha pero no los 120 puntos del castigo, que es justo lo que la prueba
    // cobra por fallar.
    const conBomba = partidaEnLaBomba();
    const tenia = conBomba.turno ?? 'a';
    const antes = conBomba.puntos[tenia] ?? 0;

    const vencida = trivialModule.apply(conBomba, { tipo: 'tiempo' }, 'a', asientos);

    expect(vencida.puntos[tenia]).toBeLessThan(antes);
  });
});
```

> `partidaEnLaBomba()`: monta una partida cuya ronda actual sea de tipo
> `bomba`, empezada y con `turno` puesto. Si el fichero de pruebas no tiene ya
> un ayudante así, escríbelo junto a los demás siguiendo su estilo.

- [ ] **Step 2: Compruébalo, tiene que fallar**

Run: `npx vitest run --root packages/shared src/games/trivial/trivial.spec.ts`
Expected: FAIL — las acciones `reloj` y `tiempo` no existen en el esquema.

- [ ] **Step 3: Amplía `tipos.ts`**

En `TrivialState`, junto a `mecha`:

```ts
  /**
   * Cuándo se cierra sola la ronda, en milisegundos de reloj de servidor.
   *
   * Viaja el instante y no los segundos que quedan: es lo único que los cinco
   * navegadores de la mesa pueden compartir, porque cada uno tiene su hora y
   * ninguna coincide. Cero es «esta ronda no lleva reloj».
   */
  readonly cierraEn: number;
```

En `TrivialView`, junto a `mecha`:

```ts
  /** Cuándo se cierra la ronda. Cero mientras no haya reloj puesto. */
  readonly cierraEn: number;
```

Y en `TrivialAction`, dos miembros más de la unión:

```ts
  // Las pone el servidor: la hora de cierre la decide él, porque es el único
  // reloj que la mesa comparte.
  Type.Object(
    { tipo: Type.Literal('reloj'), hasta: Type.Integer({ minimum: 0 }) },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('tiempo') }, SIN_EXTRAS),
```

- [ ] **Step 4: Los segundos de cada prueba, en `reglas.ts`**

Al final de `reglas.ts`:

```ts
/**
 * Lo que dura cada prueba, en segundos.
 *
 * No es el mismo número para todas porque no cuesta lo mismo: en «encuentra el
 * fallo» hay que leer código y en la ráfaga se contesta con el estómago. La
 * prisa es parte de la prueba, así que estos números son reglas del juego y
 * no una preferencia de la pantalla.
 */
export const SEGUNDOS_POR_PRUEBA: Readonly<Record<TipoPrueba, number>> = {
  test: 25,
  fallo: 40,
  estimacion: 30,
  pulsa: 15,
  rafaga: 10,
  bomba: 12,
};
```

(El `final` de esta tabla lo añade la Task 6; ahora mismo `TipoPrueba` todavía
no lo tiene, así que el `Record` compila con los seis de hoy.)

- [ ] **Step 5: El reducer**

En `createState`, junto a `mecha: 0`, añade `cierraEn: 0`.

En `apply`, dos casos nuevos:

```ts
      case 'reloj':
        return { ...state, jugadas, cierraEn: action.hasta };

      case 'tiempo': {
        const ronda = rondaActual(state);
        // Una ronda ya cerrada no se vuelve a cerrar. Devolver el mismo objeto
        // es lo que hace que esta jugada no se escriba en el registro: el
        // temporizador salta muchas veces sobre rondas que la mesa ya cortó.
        if (!ronda || ronda.cerrada || state.fase !== 'ronda') return state;
        return { ...cerrar(state, conLaBombaPerdida(state, ronda)), jugadas };
      }
```

En el caso `siguiente`, el estado que se devuelve al entrar en la ronda nueva
lleva `cierraEn: 0`:

```ts
        return {
          ...conBomba(cerrada, siguiente),
          jugadas,
          actual: siguiente,
          fase: 'ronda',
          cierraEn: 0,
        };
```

En `view`, junto a `mecha`, añade `cierraEn: state.cierraEn`.

Y al final del fichero, junto a las demás funciones de apoyo:

```ts
/** El valor que se apunta por quien no llegó a contestar. Nunca acierta. */
const NO_CONTESTO = -1;

/**
 * La bomba de quien no contestó a tiempo, ya estallada.
 *
 * Fuera de la bomba, dejar de contestar solo cuesta los puntos que no se ganan.
 * Con la bomba en la mano es distinto: si no contestar saliera gratis, la
 * jugada ganadora sería quedarse quieto y ahorrarse el castigo, que es
 * exactamente lo que la prueba cobra por fallar.
 */
function conLaBombaPerdida(state: TrivialState, ronda: Ronda): Ronda {
  if (ronda.pregunta.tipo !== 'bomba' || !state.turno) return ronda;
  if (respuestaDe(ronda.respuestas, state.turno)) return ronda;

  return {
    ...ronda,
    respuestas: {
      ...ronda.respuestas,
      [state.turno]: { valor: NO_CONTESTO, orden: Object.keys(ronda.respuestas).length },
    },
  };
}
```

Declara además las dos acciones como de sistema:

```ts
  // La voz del presentador y el reloj los pone el servidor. Si los pudiera
  // mandar un cliente, cualquiera hablaría por boca del presentador al resto de
  // la mesa, o se daría a sí mismo todo el tiempo del mundo.
  accionesDeSistema: ['presenta', 'reloj', 'tiempo'],
```

- [ ] **Step 6: Que pasen**

Run: `npx vitest run --root packages/shared src/games/trivial`
Expected: PASS. Si alguna prueba antigua se queja de que le falta `cierraEn` en
un estado montado a mano, añádeselo: es un campo nuevo obligatorio.

- [ ] **Step 7: Lint, tipos y commit**

```
npx eslint packages/shared --max-warnings 0
npm run typecheck
git add packages/shared/src/games/trivial
git commit
```

Mensaje del commit:

```
feat(concurso): la ronda lleva reloj y se cierra sola

Viaja el instante de cierre y no los segundos que quedan, que es lo único que
los cinco navegadores de la mesa comparten: cada uno tiene su hora y ninguna
coincide. La hora la pone el servidor como dato de una acción, así que el
reducer sigue sin mirar ningún reloj y la partida se reconstruye desde su log.

El tiempo que llega tarde a una ronda ya cerrada devuelve el mismo estado, con
lo que no se escribe: el temporizador salta a menudo sobre rondas que la mesa
acaba de cortar a mano.

Y con la bomba en la mano, no contestar es que te estalle. Si saliera gratis,
la jugada ganadora sería quedarse quieto.
```

---

### Task 5: El regidor pone el reloj en marcha

La sala tiene **un solo hueco** de narrador, y ahora hacen falta dos cosas: uno
que hable y otro que lleve el reloj. Son responsabilidades distintas y van en
clases distintas, así que hace falta algo mínimo que reparta los avisos.

**Files:**
- Create: `apps/server/src/rooms/coro.ts`
- Create: `apps/server/src/rooms/coro.spec.ts`
- Create: `apps/server/src/games/trivial/regidor.ts`
- Create: `apps/server/src/games/trivial/regidor.spec.ts`
- Modify: `apps/server/src/rooms/service.ts` (función `narradorPara`)

**Interfaces:**
- Consumes: `SEGUNDOS_POR_PRUEBA` (Task 4), `Narrador` y `RoomActor` de `../../rooms/actor`.
- Produces:
  - `export function coro(...narradores: readonly (Narrador | null)[]): Narrador`
  - `export class RegidorDeSala implements Narrador`, constructor `(ahora: () => number = Date.now)`

- [ ] **Step 1: Las pruebas del coro**

Crea `apps/server/src/rooms/coro.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { coro } from './coro';
import type { RoomActor } from './actor';

const ACTOR = {} as RoomActor;

describe('el coro de narradores', () => {
  it('avisa a todos, en orden', () => {
    const dichos: string[] = [];
    const juntos = coro(
      { trasJugada: () => dichos.push('regidor') },
      { trasJugada: () => dichos.push('presentador') },
    );

    juntos.trasJugada(ACTOR, null, null);

    expect(dichos).toEqual(['regidor', 'presentador']);
  });

  it('ignora los huecos, que es lo que hay cuando no hay clave de IA', () => {
    const juntos = coro(null, { trasJugada: () => undefined });
    expect(() => { juntos.trasJugada(ACTOR, null, null); }).not.toThrow();
  });

  it('si uno se cae, los demás siguen', () => {
    // Que el presentador reviente no puede dejar la sala sin reloj.
    const segundo = vi.fn();
    const juntos = coro(
      { trasJugada: () => { throw new Error('me he caído'); } },
      { trasJugada: segundo },
    );

    juntos.trasJugada(ACTOR, null, null);

    expect(segundo).toHaveBeenCalled();
  });

  it('al parar, los para a todos', () => {
    const parar = vi.fn();
    coro({ trasJugada: () => undefined, parar }).parar?.();
    expect(parar).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Compruébalo, tiene que fallar**

Run: `npx vitest run --root apps/server src/rooms/coro.spec.ts`
Expected: FAIL — no existe `./coro`.

- [ ] **Step 3: Escribe el coro**

Crea `apps/server/src/rooms/coro.ts`:

```ts
import type { Narrador, RoomActor } from './actor';

/**
 * Varios narradores por el único hueco que tiene la sala.
 *
 * El concurso necesita dos cosas a la vez que no son la misma: alguien que
 * hable -el presentador, que llama a un modelo y tarda- y alguien que lleve el
 * reloj -el regidor, que no habla con nadie-. Meterlas en una clase las
 * ataría: no se podría probar el reloj sin un modelo de mentira, ni apagar la
 * IA sin quedarse sin cronómetro.
 *
 * Si uno se cae, los demás siguen. Que el presentador reviente al hablar con
 * un modelo no puede dejar la sala sin cronómetro.
 */
export function coro(...narradores: readonly (Narrador | null)[]): Narrador {
  const vivos = narradores.filter((uno): uno is Narrador => uno !== null);

  return {
    trasJugada(actor: RoomActor, antes: unknown, ahora: unknown): void {
      for (const uno of vivos) {
        try {
          uno.trasJugada(actor, antes, ahora);
        } catch {
          // Ninguno puede llevarse por delante a los que van detrás.
        }
      }
    },

    parar(): void {
      for (const uno of vivos) {
        try {
          uno.parar?.();
        } catch {
          // Al descargar la sala ya da igual: lo que importa es soltarlos todos.
        }
      }
    },
  };
}
```

- [ ] **Step 4: Que pasen**

Run: `npx vitest run --root apps/server src/rooms/coro.spec.ts`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Las pruebas del regidor**

Crea `apps/server/src/games/trivial/regidor.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { RegidorDeSala } from './regidor';
import type { RoomActor } from '../../rooms/actor';
import type { TrivialState } from '@devweb/shared/games/trivial/tipos';

function actorDeMentira(): RoomActor & { puestas: unknown[] } {
  const puestas: unknown[] = [];
  return {
    puestas,
    aplicarDelSistema: (_asiento: string, accion: unknown) => { puestas.push(accion); },
  } as unknown as RoomActor & { puestas: unknown[] };
}

function enRonda(tipo: string, cierraEn = 0): TrivialState {
  return {
    rondas: [
      {
        pregunta: { id: 'p', tipo, enunciado: '', opciones: [], correcta: 0, explicacion: '' },
        cerrada: false,
        respuestas: {},
      },
    ],
    actual: 0,
    puntos: {},
    fase: 'ronda',
    orden: ['a'],
    jugadas: 1,
    semilla: 1,
    nivelBot: 'apanado',
    racha: {},
    turno: null,
    mecha: 0,
    cierraEn,
    dice: '',
    momento: '',
  } as unknown as TrivialState;
}

describe('el regidor', () => {
  it('pone el reloj al abrirse una ronda, con los segundos de esa prueba', () => {
    const actor = actorDeMentira();
    new RegidorDeSala(() => 1_000).trasJugada(actor, null, enRonda('rafaga'));

    // La ráfaga son diez segundos: se contesta con el estómago.
    expect(actor.puestas).toEqual([{ tipo: 'reloj', hasta: 11_000 }]);
  });

  it('le da más tiempo a la de leer código que a la de reflejos', () => {
    const conCodigo = actorDeMentira();
    const conPrisa = actorDeMentira();
    new RegidorDeSala(() => 0).trasJugada(conCodigo, null, enRonda('fallo'));
    new RegidorDeSala(() => 0).trasJugada(conPrisa, null, enRonda('pulsa'));

    const hastaCodigo = (conCodigo.puestas[0] as { hasta: number }).hasta;
    const hastaPrisa = (conPrisa.puestas[0] as { hasta: number }).hasta;
    expect(hastaCodigo).toBeGreaterThan(hastaPrisa);
  });

  it('no vuelve a ponerlo si esa ronda ya lo tiene', () => {
    // Cada respuesta de la mesa avisa al narrador. Sin esta guarda, contestar
    // alargaría la ronda, que es lo contrario de un cronómetro.
    const actor = actorDeMentira();
    new RegidorDeSala(() => 1_000).trasJugada(actor, null, enRonda('test', 5_000));

    expect(actor.puestas).toEqual([]);
  });

  it('al vencer, manda el tiempo', () => {
    vi.useFakeTimers();
    const actor = actorDeMentira();
    const regidor = new RegidorDeSala(() => 0);
    regidor.trasJugada(actor, null, enRonda('rafaga'));

    vi.advanceTimersByTime(10_000);

    expect(actor.puestas.at(-1)).toEqual({ tipo: 'tiempo' });
    vi.useRealTimers();
  });

  it('al soltarse la sala, el temporizador no queda colgando', () => {
    vi.useFakeTimers();
    const actor = actorDeMentira();
    const regidor = new RegidorDeSala(() => 0);
    regidor.trasJugada(actor, null, enRonda('rafaga'));

    regidor.parar();
    vi.advanceTimersByTime(30_000);

    expect(actor.puestas).toEqual([{ tipo: 'reloj', hasta: 10_000 }]);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 6: Compruébalo, tiene que fallar**

Run: `npx vitest run --root apps/server src/games/trivial/regidor.spec.ts`
Expected: FAIL — no existe `./regidor`.

- [ ] **Step 7: Escribe el regidor**

Crea `apps/server/src/games/trivial/regidor.ts`:

```ts
import { SEGUNDOS_POR_PRUEBA } from '@devweb/shared/games/trivial/reglas';
import { rondaEn } from '@devweb/shared/games/trivial/tipos';
import type { TrivialState } from '@devweb/shared/games/trivial/tipos';
import type { Narrador, RoomActor } from '../../rooms/actor';

/**
 * El reloj del concurso.
 *
 * La hora la pone el servidor porque es la única que comparten los cinco
 * navegadores de la mesa. Y la pone aquí, y no en el navegador, porque este es
 * un concurso para programadores: un cronómetro que corre en el cliente es un
 * cronómetro que se para con las herramientas de desarrollo abiertas.
 *
 * No habla. De hablar se encarga el presentador, y los dos entran en la sala
 * por el mismo hueco gracias al coro.
 */
export class RegidorDeSala implements Narrador {
  /** El temporizador de la ronda en marcha. Uno por sala, que es lo que es esto. */
  private reloj: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ahora: () => number = Date.now) {}

  trasJugada(actor: RoomActor, _antes: unknown, ahora: unknown): void {
    const state = ahora as TrivialState | null;
    if (!state) return;

    if (state.fase !== 'ronda') {
      this.pararElReloj();
      return;
    }

    this.abrirLaCuentaAtras(actor, state);
  }

  parar(): void {
    this.pararElReloj();
  }

  /**
   * Arranca la cuenta atrás de esta ronda, si no la tiene ya.
   *
   * La guarda del `cierraEn` no es defensiva por gusto: al narrador se le avisa
   * en **cada** jugada, respuestas incluidas, y sin ella cada persona que
   * contestara alargaría la ronda. Un cronómetro que se estira al usarlo no es
   * un cronómetro.
   */
  private abrirLaCuentaAtras(actor: RoomActor, state: TrivialState): void {
    const ronda = rondaEn(state, state.actual);
    if (!ronda || ronda.cerrada) return;
    if (state.cierraEn !== 0 || this.reloj) return;

    const segundos = SEGUNDOS_POR_PRUEBA[ronda.pregunta.tipo];
    if (!segundos) return;

    const milisegundos = segundos * 1000;
    const locutor = state.orden[0] ?? 'sala';
    actor.aplicarDelSistema(locutor, { tipo: 'reloj', hasta: this.ahora() + milisegundos });

    this.reloj = setTimeout(() => {
      this.reloj = null;
      actor.aplicarDelSistema(locutor, { tipo: 'tiempo' });
    }, milisegundos);
    this.reloj.unref();
  }

  private pararElReloj(): void {
    if (!this.reloj) return;
    clearTimeout(this.reloj);
    this.reloj = null;
  }
}
```

- [ ] **Step 8: Engánchalo en la sala**

En `apps/server/src/rooms/service.ts`, en `narradorPara`, envuelve lo que
devuelve hoy para el trivial:

```ts
      return coro(
        new RegidorDeSala(),
        new PresentadorDeSala(/* … los argumentos que ya pasaba … */),
      );
```

Con sus imports:

```ts
import { coro } from './coro';
import { RegidorDeSala } from '../games/trivial/regidor';
```

> Ojo: el presentador se construye solo si hay ajustes de IA, pero **el regidor
> siempre**. Una sala sin clave de IA sigue teniendo cronómetro. Si el código
> actual devuelve `null` cuando no hay `ia`, cámbialo para que devuelva el coro
> con el regidor solo.

- [ ] **Step 9: Toda la tanda del servidor**

Run: `npx vitest run --root apps/server`
Run: `npx eslint apps/server --max-warnings 0`
Run: `npm run typecheck`
Expected: verde. Si alguna prueba de salas esperaba que el narrador fuera
`null` sin IA, actualízala: ahora hay regidor siempre y eso es lo correcto.

- [ ] **Step 10: Commit**

Mensaje:

```
feat(concurso): un regidor lleva el reloj de la sala

El cronómetro corre en el servidor, que es la única hora que los cinco
navegadores comparten, y además la única que no se para abriendo las
herramientas de desarrollo. En un concurso para programadores eso importa.

Va en su propia clase y no dentro del presentador: son dos trabajos distintos,
y juntos no se podría probar el reloj sin un modelo de mentira ni apagar la IA
sin quedarse sin cronómetro. Como la sala solo tiene un hueco de narrador, un
coro mínimo reparte los avisos entre los dos. Si uno se cae, el otro sigue.
```

---

### Task 6: La final a doble o nada

**Files:**
- Modify: `packages/shared/src/games/trivial/tipos.ts`
- Modify: `packages/shared/src/games/trivial/reglas.ts`
- Modify: `packages/shared/src/games/trivial/index.ts`
- Modify: `apps/server/src/games/trivial/pruebas.ts`
- Modify: `apps/server/src/games/trivial/banco.ts`
- Test: `packages/shared/src/games/trivial/reglas.spec.ts`, `trivial.spec.ts`

**Interfaces:**
- Consumes: el reloj de la Task 4.
- Produces:
  - `Fase` incluye `'apuestas'`; `TipoPrueba` incluye `'final'`.
  - `TrivialState.apuestas: Readonly<Record<SeatId, number>>`.
  - Acción `{ tipo: 'apostar'; cuanto: number }`.
  - `TrivialView.tuApuesta: number | null`, `hanApostado: readonly SeatId[]`, `apuestas: Readonly<Record<SeatId, number>> | null`.
  - `puntosDe(pregunta, respuestas, seat, racha, apuesta)` — quinto parámetro, con `0` por defecto.
  - `export const FINAL: readonly Pregunta[]` en `pruebas.ts`.

- [ ] **Step 1: Las pruebas de las reglas**

Añade a `packages/shared/src/games/trivial/reglas.spec.ts`:

```ts
describe('la final, a doble o nada', () => {
  const final: Pregunta = {
    id: 'final-1',
    tipo: 'final',
    enunciado: '¿En qué año se publicó el primer navegador con pestañas?',
    opciones: ['1994', '1997', '2001', '2003'],
    correcta: 1,
    explicacion: 'InternetWorks, en 1997. Tardaron seis años en copiarlo.',
  };

  it('acertar te lleva lo que te jugabas', () => {
    const puntos = puntosDe(final, { a: { valor: 1, orden: 0 } }, 'a', 0, 300);
    expect(puntos).toBe(300);
  });

  it('fallar te lo quita', () => {
    const puntos = puntosDe(final, { a: { valor: 0, orden: 0 } }, 'a', 0, 300);
    expect(puntos).toBe(-300);
  });

  it('no apostar nada no mueve el marcador', () => {
    // Plantarse es una jugada legítima, y la única razonable si vas primero.
    expect(puntosDe(final, { a: { valor: 0, orden: 0 } }, 'a', 0, 0)).toBe(0);
    expect(puntosDe(final, { a: { valor: 1, orden: 0 } }, 'a', 0, 0)).toBe(0);
  });

  it('acertar el primero no vale más que acertar el último', () => {
    // En una apuesta, correr no es la gracia: lo que se premia es lo que te
    // jugabas. Repartir bonus por rapidez aquí convertiría la final en otra
    // ronda de siempre.
    const respuestas = { a: { valor: 1, orden: 0 }, b: { valor: 1, orden: 1 } };
    expect(puntosDe(final, respuestas, 'a', 0, 100)).toBe(puntosDe(final, respuestas, 'b', 0, 100));
  });
});
```

- [ ] **Step 2: Las pruebas del motor**

Añade a `packages/shared/src/games/trivial/trivial.spec.ts`:

```ts
describe('la fase de apuestas', () => {
  it('al llegar la final, primero se apuesta', () => {
    const enLaFinal = partidaAntesDeLaFinal();
    const entrando = trivialModule.apply(enLaFinal, { tipo: 'siguiente' }, 'a', asientos);

    expect(entrando.fase).toBe('apuestas');
  });

  it('nadie ve lo que apuestan los demás hasta que se cierra', () => {
    // Es la misma regla que la respuesta correcta: lo que no se manda, no se
    // puede mirar con las herramientas de desarrollo.
    const apostando = enFaseDeApuestas();
    const conApuesta = trivialModule.apply(apostando, { tipo: 'apostar', cuanto: 300 }, 'b', asientos);
    const vista = vistaDe(conApuesta, 'a');

    expect(vista.hanApostado).toContain('b');
    expect(vista.apuestas).toBeNull();
  });

  it('tú sí ves la tuya', () => {
    const apostando = enFaseDeApuestas();
    const conApuesta = trivialModule.apply(apostando, { tipo: 'apostar', cuanto: 300 }, 'b', asientos);

    expect(vistaDe(conApuesta, 'b').tuApuesta).toBe(300);
  });

  it('no puedes apostar más de lo que llevas', () => {
    const apostando = enFaseDeApuestas();
    const sobran = (apostando.puntos['b'] ?? 0) + 1;

    expect(trivialModule.validate(apostando, { tipo: 'apostar', cuanto: sobran }, 'b', asientos))
      .toEqual({ code: 'no-tienes-tanto', message: expect.any(String) });
  });

  it('cuando han apostado todos, se juega la pregunta', () => {
    let estado = enFaseDeApuestas();
    for (const quien of estado.orden) {
      estado = trivialModule.apply(estado, { tipo: 'apostar', cuanto: 50 }, quien, asientos);
    }

    expect(estado.fase).toBe('ronda');
    expect(vistaDe(estado, 'a').apuestas).not.toBeNull();
  });

  it('quien no apuesta a tiempo se planta', () => {
    // Cero es una apuesta: no perder nada. Es preferible a bloquear la final
    // esperando a alguien que se ha ido a por un café.
    const apostando = enFaseDeApuestas();
    const vencida = trivialModule.apply(apostando, { tipo: 'tiempo' }, 'a', asientos);

    expect(vencida.fase).toBe('ronda');
    expect(vencida.apuestas['a'] ?? 0).toBe(0);
  });

  it('nadie acaba el concurso en negativo', () => {
    let estado = enFaseDeApuestas();
    const todo = estado.puntos['a'] ?? 0;
    estado = trivialModule.apply(estado, { tipo: 'apostar', cuanto: todo }, 'a', asientos);
    estado = trivialModule.apply(estado, { tipo: 'tiempo' }, 'a', asientos);
    estado = trivialModule.apply(estado, { tipo: 'responder', valor: 3 }, 'a', asientos);

    expect(estado.puntos['a']).toBeGreaterThanOrEqual(0);
  });
});
```

> `partidaAntesDeLaFinal()` y `enFaseDeApuestas()`: ayudantes nuevos, al lado
> de los que ya tenga el fichero. El primero deja la partida en la ronda
> anterior a una de tipo `final`; el segundo, ya en `fase: 'apuestas'` con
> puntos repartidos para poder apostar de verdad.

- [ ] **Step 3: Compruébalo, tienen que fallar**

Run: `npx vitest run --root packages/shared src/games/trivial`
Expected: FAIL — no existe el tipo `final` ni la acción `apostar`.

- [ ] **Step 4: Los tipos**

En `tipos.ts`:

```ts
export type TipoPrueba = 'test' | 'estimacion' | 'fallo' | 'pulsa' | 'rafaga' | 'bomba' | 'final';
export type Fase = 'presentacion' | 'ronda' | 'resultado' | 'apuestas' | 'fin';
```

En `TrivialState`:

```ts
  /**
   * Lo que se juega cada uno en la final.
   *
   * Secreto mientras la fase sigue abierta, igual que las respuestas: lo que no
   * se manda no se puede mirar. Al cerrarse se cantan todas a la vez, que es el
   * momento de la final.
   */
  readonly apuestas: Readonly<Record<SeatId, number>>;
```

En `TrivialView`:

```ts
  /** Quién ha apostado ya. Nunca cuánto, mientras la fase siga abierta. */
  readonly hanApostado: readonly SeatId[];
  readonly tuApuesta: number | null;
  /** Todas las apuestas, cuando ya se pueden cantar. Antes, `null`. */
  readonly apuestas: Readonly<Record<SeatId, number>> | null;
```

En `TrivialAction`:

```ts
  Type.Object(
    { tipo: Type.Literal('apostar'), cuanto: Type.Integer({ minimum: 0, maximum: 1_000_000 }) },
    SIN_EXTRAS,
  ),
```

- [ ] **Step 5: Las reglas**

En `reglas.ts`, añade `final: 30` a `SEGUNDOS_POR_PRUEBA` —y la fase de
apostar, que no es una prueba, se resuelve con su propia constante:

```ts
/**
 * Lo que se da para apostar en la final.
 *
 * Más que cualquier pregunta: aquí no se está contestando, se está decidiendo
 * cuánto del programa entero te juegas, y esa cuenta la hace todo el mundo
 * mirando el marcador.
 */
export const SEGUNDOS_PARA_APOSTAR = 45;
```

Y en `puntosDe`, un parámetro más y su caso:

```ts
export function puntosDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  seat: SeatId,
  racha = 0,
  apuesta = 0,
): number {
  const suya = respuestaDe(respuestas, seat);
  if (!suya) return 0;

  if (pregunta.tipo === 'estimacion') return puntosPorCercania(pregunta, suya.valor);

  const acierta = aciertaCon(pregunta, suya.valor);

  // La final no reparte bonus por rapidez: lo que se premia es lo que te
  // jugabas, no lo pronto que lo dijiste.
  if (pregunta.tipo === 'final') return acierta ? apuesta : -apuesta;

  // … el resto, igual que estaba …
}
```

`repartoDe` necesita las apuestas para poder pasárselas:

```ts
export function repartoDe(
  pregunta: Pregunta,
  respuestas: Readonly<Record<SeatId, Respuesta>>,
  rachas: Readonly<Record<SeatId, number>> = {},
  apuestas: Readonly<Record<SeatId, number>> = {},
): Record<SeatId, number> {
  return Object.fromEntries(
    Object.keys(respuestas).map((seat) => [
      seat,
      puntosDe(pregunta, respuestas, seat, rachas[seat] ?? 0, apuestas[seat] ?? 0),
    ]),
  );
}
```

- [ ] **Step 6: El reducer**

`createState`: añade `apuestas: {}`.

`validate`, caso nuevo:

```ts
      case 'apostar': {
        if (state.fase !== 'apuestas') {
          return { code: 'no-toca-apostar', message: 'Todavía no se apuesta.' };
        }
        if (!state.orden.includes(by)) {
          return { code: 'no-juegas', message: 'No estás jugando este concurso.' };
        }
        if (by in state.apuestas) {
          return { code: 'ya-apostaste', message: 'Ya has puesto lo tuyo.' };
        }
        // Apostar lo que no se tiene acabaría el concurso en negativo, y un
        // marcador con números rojos no lo entiende nadie.
        return action.cuanto <= (state.puntos[by] ?? 0)
          ? null
          : { code: 'no-tienes-tanto', message: 'No llevas tantos puntos.' };
      }
```

Los casos `responder` y `siguiente` tienen que tolerar la fase nueva: en
`responder`, la guarda `state.fase === 'presentacion'` se queda igual, pero
añade delante `if (state.fase === 'apuestas') return { code: 'aun-se-apuesta', message: 'Primero se apuesta.' };`.

`apply`, caso nuevo y cierre de la fase:

```ts
      case 'apostar': {
        const apuestas = { ...state.apuestas, [by]: action.cuanto };
        const faltan = state.orden.filter((seat) => !(seat in apuestas));
        return {
          ...state,
          jugadas,
          apuestas,
          // Cuando han apostado todos se cantan y se juega la pregunta.
          fase: faltan.length === 0 ? 'ronda' : 'apuestas',
          cierraEn: faltan.length === 0 ? 0 : state.cierraEn,
        };
      }
```

En el caso `tiempo`, antes de mirar la ronda:

```ts
        // Vencido el plazo de apostar, quien no puso nada se planta. Bloquear
        // la final esperando a alguien que se ha ido es peor que darle un cero.
        if (state.fase === 'apuestas') {
          return { ...state, jugadas, fase: 'ronda', cierraEn: 0 };
        }
```

En el caso `siguiente`, la ronda que entra decide la fase:

```ts
        const entra = rondaEn(cerrada, siguiente)?.pregunta.tipo;
        return {
          ...conBomba(cerrada, siguiente),
          jugadas,
          actual: siguiente,
          // A la final se entra apostando, no contestando.
          fase: entra === 'final' ? 'apuestas' : 'ronda',
          cierraEn: 0,
        };
```

En `cerrar`, pásale las apuestas al reparto y pon un suelo al marcador:

```ts
function cerrar(state: TrivialState, ronda: Ronda): TrivialState {
  const ganados = repartoDe(ronda.pregunta, ronda.respuestas, state.racha, state.apuestas);
  const puntos = { ...state.puntos };
  for (const [seat, suma] of Object.entries(ganados)) {
    // Nadie acaba el concurso debiendo puntos: un marcador en rojo no lo
    // entiende nadie y no cambia quién gana.
    puntos[seat] = Math.max(0, (puntos[seat] ?? 0) + suma);
  }
  // … el resto igual …
}
```

Y `resultadosDe` también pasa las apuestas a `repartoDe`.

En `view`:

```ts
      hanApostado: Object.keys(state.apuestas),
      tuApuesta: state.apuestas[forSeat] ?? null,
      // Se cantan cuando ya no se puede apostar. Antes no salen de aquí.
      apuestas: state.fase === 'apuestas' ? null : state.apuestas,
```

`botAction`: en fase `apuestas`, un bot apuesta una parte fija de lo suyo para
no bloquear la final:

```ts
    if (state.fase === 'apuestas') {
      if (seat in state.apuestas) return null;
      // Un tercio: ni se planta ni se lo juega todo. Un bot que apostara al azar
      // ganaría o perdería el concurso por sorteo.
      return { tipo: 'apostar', cuanto: Math.floor((state.puntos[seat] ?? 0) / 3) };
    }
```

- [ ] **Step 7: La pregunta de la final**

En `apps/server/src/games/trivial/pruebas.ts`, un grupo nuevo:

```ts
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
      'Porque son tres emojis unidos por dos caracteres invisibles, y algunos ocupan dos posiciones',
      'Porque el emoji está mal formado',
      'Porque length siempre devuelve potencias de dos',
    ],
    correcta: 1,
    explicacion:
      'Son tres emojis de persona unidos por dos ZWJ. Cada persona va fuera del plano básico y ocupa dos unidades UTF-16: 3×2 + 2 = 8.',
  },
  {
    id: 'final-indices',
    tipo: 'final',
    enunciado: 'Una consulta con índice tarda más que sin él. ¿Qué explicación es la más probable?',
    opciones: [
      'El índice está corrupto',
      'La consulta devuelve casi toda la tabla, y saltar del índice a cada fila sale más caro que leerla entera',
      'Los índices solo aceleran las escrituras',
      'Falta un ORDER BY',
    ],
    correcta: 1,
    explicacion:
      'Es el caso clásico: con poca selectividad, el salto índice-tabla fila a fila cuesta más que un recorrido secuencial. Por eso el planificador a veces ignora el índice a propósito.',
  },
  {
    id: 'final-git-rebase',
    tipo: 'final',
    enunciado: 'Rebaseas una rama que ya habían descargado otros. ¿Qué pasa exactamente?',
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
    enunciado: 'Un despliegue rompe la web solo para quien ya la había visitado. ¿Por dónde se empieza a mirar?',
    opciones: [
      'Por la base de datos',
      'Por la caché: un HTML viejo pidiendo ficheros con nombres que ya no existen',
      'Por el certificado',
      'Por el DNS',
    ],
    correcta: 1,
    explicacion:
      'Es el síntoma de libro: el visitante nuevo se lo trae todo fresco y el que vuelve arrastra un índice cacheado que apunta a bundles borrados.',
  },
];
```

En `banco.ts`, mete `FINAL` en `todas()` y cierra la escaleta:

```ts
export const ESCALETA: readonly { tipo: TipoPrueba; cuantas: number }[] = [
  { tipo: 'test', cuantas: 3 },
  { tipo: 'pulsa', cuantas: 2 },
  { tipo: 'rafaga', cuantas: 5 },
  { tipo: 'fallo', cuantas: 2 },
  { tipo: 'estimacion', cuantas: 2 },
  { tipo: 'bomba', cuantas: 6 },
  // Y se cierra apostando. Va la última porque es la única que puede dar la
  // vuelta al marcador entero, y eso solo tiene gracia al final.
  { tipo: 'final', cuantas: 1 },
];
```

- [ ] **Step 8: Que pasen**

Run: `npx vitest run --root packages/shared src/games/trivial`
Run: `npx vitest run --root apps/server src/games/trivial`
Expected: PASS. Las pruebas antiguas que cuenten 20 rondas ahora cuentan 21:
actualiza el número, no la escaleta.

- [ ] **Step 9: Lint, tipos y commit**

Mensaje:

```
feat(concurso): el programa se cierra con una final a doble o nada

Todos apuestan en secreto parte de lo que llevan y luego va una pregunta:
aciertas y te lo llevas, fallas y lo pierdes. Nadie puede apostar más de lo que
tiene, así que nadie acaba en negativo, y plantarse con cero es una jugada
legítima -la única razonable si vas primero-.

Las apuestas no salen del servidor hasta que la fase se cierra, por la misma
razón por la que no sale la respuesta correcta: lo que no se manda no se puede
mirar. Y no hay bonus por rapidez: en una apuesta, correr no es la gracia.

Quien no apuesta a tiempo se planta. Bloquear la final esperando a alguien que
se ha ido a por un café es peor que darle un cero.
```

---

### Task 7: El presentador aprende a hablar de la final

**Files:**
- Modify: `packages/shared/src/games/trivial/guion.ts`
- Modify: `packages/shared/src/games/trivial/momentos.ts`
- Modify: `packages/shared/src/games/trivial/prompts.ts`
- Modify: `packages/shared/src/games/trivial/reparto.ts`
- Test: `packages/shared/src/games/trivial/momentos.spec.ts`, `guion.spec.ts`

**Interfaces:**
- Consumes: la fase `apuestas` y el tipo `final` (Task 6).
- Produces: `MOMENTOS` incluye `seccionFinal`, `presentaApuestas`, `apuestasCerradas`, `resultadoFinal`, `podio` y `anulada`.

Los cinco primeros son de la final; `anulada` lo usa la Task 8 y se añade aquí
porque `MOMENTOS`, `FRASES`, `LARGOS` y `GESTO_POR_MOMENTO` son `Record`
completos: tocarlos una vez sola es menos trabajo y menos riesgo que dos.

- [ ] **Step 1: Las pruebas**

En `momentos.spec.ts`:

```ts
describe('los momentos de la final', () => {
  it('al entrar en la final, la presenta', () => {
    const comentario = comentarioDe(antesDeLaFinal(), entrandoEnLaFinal());
    expect(comentario?.momento).toBe('seccionFinal');
  });

  it('con la fase de apuestas abierta, pide que apuesten', () => {
    const comentario = comentarioDe(entrandoEnLaFinal(), apostando());
    expect(comentario?.momento).toBe('presentaApuestas');
  });

  it('cerradas las apuestas, las canta', () => {
    const comentario = comentarioDe(apostando(), apuestasCantadas());
    expect(comentario?.momento).toBe('apuestasCerradas');
  });

  it('resuelta la final, cuenta el vuelco antes de despedirse', () => {
    const comentario = comentarioDe(apuestasCantadas(), finalResuelta());
    expect(comentario?.momento).toBe('resultadoFinal');
  });

  it('al acabarse el concurso, va al podio', () => {
    const comentario = comentarioDe(finalResuelta(), acabada());
    expect(comentario?.momento).toBe('podio');
  });
});
```

En `guion.spec.ts`:

```ts
it('todos los momentos tienen frase escrita', () => {
  // El guion es la red: si un momento se queda sin frase, un modelo caído deja
  // al presentador mudo justo en ese trozo del programa.
  for (const momento of MOMENTOS) {
    expect(frasePara(momento, DATOS, rngFijo()).length).toBeGreaterThan(10);
  }
});
```

- [ ] **Step 2: Compruébalo, tienen que fallar**

Run: `npx vitest run --root packages/shared src/games/trivial`
Expected: FAIL — los momentos nuevos no existen.

- [ ] **Step 3: Los momentos nuevos**

En `guion.ts`, amplía `MOMENTOS`:

```ts
  // La final, que es un bloque aparte del programa: se presenta, se apuesta,
  // se cantan las apuestas, se resuelve y se sube al podio.
  'seccionFinal',
  'presentaApuestas',
  'apuestasCerradas',
  'resultadoFinal',
  'podio',
  // Cuando la mesa tumba una pregunta inventada por la IA.
  'anulada',
```

Y sus frases en `FRASES`:

```ts
  seccionFinal: [
    '¡Y llegamos a la final! Aquí se apuesta lo que llevéis y una sola pregunta decide el programa. Óscar dice que él apostaría todo. Óscar no juega.',
    'Última parte. Se apuesta, se contesta, y el que se equivoque se va a casa con lo puesto.',
    'La final. Lo de antes eran puntos; esto son los puntos de verdad.',
  ],
  presentaApuestas: [
    'Venga, ¿cuánto os jugáis? Y que nadie se haga el valiente y luego apueste doce.',
    'Apuestas sobre la mesa. Lo que pongáis se dobla o se va, así de simple.',
    'A ver esas apuestas. Recordad que plantarse también es una decisión, y normalmente la de los cobardes.',
  ],
  apuestasCerradas: [
    'Cerradas las apuestas. Ahí están, a la vista. Ahora ya no se puede cambiar de opinión.',
    'Todo puesto. Que conste que lo habéis decidido vosotros.',
    'Apuestas hechas. Alguien va a arrepentirse en diez segundos.',
  ],
  resultadoFinal: [
    'Y con eso se acabó la final. Menudo vuelco, señores.',
    'Ahí queda la cosa. Unos se lo llevan y otros se lo dejan.',
    'Se cierra la final. Óscar la habría acertado, pero Óscar tampoco habría apostado tan poco.',
  ],
  podio: [
    'Y el ganador es {quien}, con {puntos} puntos. Un aplauso. Y otro para Óscar, que sigue siendo el mejor programador de la historia.',
    'Se sube al podio {quien}, {puntos} puntos. Enhorabuena, y a los demás, que hay otro programa la semana que viene.',
    'Gana {quien} con {puntos}. Óscar dice que lo ha hecho bien, y de Óscar aprendimos todos.',
  ],
  anulada: [
    'Anulada. Esa pregunta la escribió una máquina, así que a mí no me miréis. Cero para todos y a la siguiente.',
    'Pregunta retirada por acuerdo unánime. Una máquina la escribió y una máquina se equivocó, que para eso las hicimos a nuestra imagen.',
    'Fuera esa. Ha votado toda la mesa y toda la mesa no se equivoca. La máquina sí.',
  ],
```

En `prompts.ts`, sus medidas en `LARGOS` y sus encargos en `tarea()`:

```ts
  seccionFinal: 280,
  presentaApuestas: 260,
  apuestasCerradas: 200,
  resultadoFinal: 300,
  podio: 380,
  anulada: 160,
```

```ts
    case 'seccionFinal':
      return [
        'Anuncia la final. Explica en una frase que cada uno apuesta parte de sus puntos,',
        'que acertar los dobla y fallar los quita, y que una sola pregunta decide el programa.',
        'Súbelo: esto es el clímax.',
      ].join(' ');

    case 'presentaApuestas':
      return [
        'Pide las apuestas. Mira el marcador y pincha a quien va primero -que tiene mucho que perder-',
        'y a quien va último -que no tiene nada-. Nombra a alguno por su nombre.',
      ].join(' ');

    case 'apuestasCerradas':
      return [
        'Las apuestas ya están cerradas y a la vista. Cántalas: quién se ha jugado mucho y quién se ha escondido.',
        'Usa solo las cifras que te dan.',
      ].join(' ');

    case 'resultadoFinal':
      return [
        `Se ha resuelto la final. Cuenta cómo ha quedado el marcador y si ha habido vuelco.`,
        'No te despidas todavía: eso es lo siguiente.',
      ].join(' ');

    case 'podio':
      return [
        `Sube al podio. Gana ${quien} con ${ctx.cifra} puntos.`,
        'Nombra al segundo y al último con los datos que tienes, y despídete del público.',
        'Es lo último que se oye en el programa, así que remata bien.',
      ].join(' ');

    case 'anulada':
      return [
        'La mesa ha tumbado la pregunta por unanimidad: la escribió una máquina y estaba mal.',
        'Cántalo con guasa, échale la culpa a la máquina y pasa a la siguiente. Nadie gana ni pierde puntos.',
      ].join(' ');
```

En `reparto.ts`, sus gestos en `GESTO_POR_MOMENTO`:

```ts
  seccionFinal: 'talk2',
  presentaApuestas: 'talk2',
  apuestasCerradas: 'think',
  resultadoFinal: 'yes',
  podio: 'yes',
  anulada: 'wrong',
```

- [ ] **Step 4: Detectarlos en `momentos.ts`**

En `seccionDe`, añade `case 'final': return 'seccionFinal';`.

Y en `comentarioDe`, antes de las comprobaciones que ya hay:

```ts
  // El final del programa manda sobre todo, y ahora tiene dos partes: el
  // resultado de la final y la ceremonia.
  if (ahora.fase === 'fin' && antes.fase !== 'fin') {
    const [quien, puntos] = lider(ahora);
    return { momento: 'podio', quien, puntos };
  }

  // Se abre la fase de apuestas.
  if (ahora.fase === 'apuestas' && antes.fase !== 'apuestas') {
    return { momento: 'presentaApuestas', quien: null, puntos: 0 };
  }

  // Se cierran: de apostar se pasa a contestar.
  if (antes.fase === 'apuestas' && ahora.fase === 'ronda') {
    return { momento: 'apuestasCerradas', quien: null, puntos: 0 };
  }
```

Y en `trasLaRonda`, al principio:

```ts
  if (tipo === 'final') {
    const [quien, puntos] = lider(ahora);
    return { momento: 'resultadoFinal', quien, puntos };
  }
```

> El `despedida` de hoy pasa a llamarse `podio` en el detector, pero **no se
> borra**: sigue en `MOMENTOS` con sus frases, porque una partida vieja
> reconstruida desde su log puede tener ese momento escrito en el estado.

- [ ] **Step 5: Que pasen, lint, tipos, commit**

Run: `npx vitest run --root packages/shared`
Run: `npx eslint packages/shared --max-warnings 0 && npm run typecheck`

Mensaje del commit:

```
feat(concurso): el presentador sabe llevar la final

Seis momentos nuevos con su frase escrita, su medida y su gesto: presentar la
final, pedir las apuestas, cantarlas, contar el vuelco, subir al podio y
anular una pregunta que la mesa ha tumbado.

Las cuatro tablas que describen a un momento -frases, medida, gesto y
detección- son Record completos a propósito: el compilador no deja añadir uno
a medias, y un momento sin frase escrita deja al presentador mudo justo ahí en
cuanto el modelo falle.
```

---

### Task 8: Impugnar una pregunta que la IA se ha inventado mal

**Files:**
- Modify: `packages/shared/src/games/trivial/tipos.ts`
- Modify: `packages/shared/src/games/trivial/index.ts`
- Test: `packages/shared/src/games/trivial/trivial.spec.ts`

**Interfaces:**
- Consumes: `Seat.isBot` de `../module`, que `apply` y `validate` ya reciben.
- Produces:
  - `TrivialState.inventadas: boolean` — sale de `config['origen'] === 'ia'`.
  - `TrivialState.impugnan: readonly SeatId[]`.
  - Acción `{ tipo: 'impugnar' }`.
  - `TrivialView.inventadas: boolean`, `impugnan: number`, `hacenFalta: number`, `tuImpugnas: boolean`.

- [ ] **Step 1: Las pruebas**

```ts
describe('impugnar una pregunta inventada', () => {
  it('hace falta que le den todas las personas de la mesa', () => {
    // Por unanimidad y no por mayoría: con mayoría, quien no se sabe la
    // respuesta impugna para no perder puntos y el botón deja de arreglar
    // preguntas malas para ser una jugada más.
    let estado = partidaInventada(['a', 'b', 'c']);
    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'a', asientos3);
    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'b', asientos3);

    expect(estado.fase).toBe('ronda');

    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'c', asientos3);

    expect(estado.fase).toBe('resultado');
  });

  it('anulada, nadie gana ni pierde puntos', () => {
    let estado = partidaInventada(['a', 'b']);
    estado = trivialModule.apply(estado, { tipo: 'responder', valor: 0 }, 'a', asientos2);
    const antes = { ...estado.puntos };

    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'a', asientos2);
    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'b', asientos2);

    expect(estado.puntos).toEqual(antes);
  });

  it('los bots no votan', () => {
    // Un bot no sabe si la pregunta está mal, y esperar su voto sería esperar
    // para siempre.
    let estado = partidaInventada(['a', 'bot']);
    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'a', asientosConBot);

    expect(estado.fase).toBe('resultado');
  });

  it('en el modo del banco no se puede impugnar', () => {
    // El banco está escrito a mano y revisado. Abrir ahí la puerta a anular
    // rondas es invitar a usarla para no perder puntos.
    const delBanco = partidaEmpezada();
    expect(trivialModule.validate(delBanco, { tipo: 'impugnar' }, 'a', asientos))
      .toEqual({ code: 'no-se-impugna', message: expect.any(String) });
  });

  it('no se impugna dos veces', () => {
    let estado = partidaInventada(['a', 'b']);
    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'a', asientos2);

    expect(trivialModule.validate(estado, { tipo: 'impugnar' }, 'a', asientos2))
      .toEqual({ code: 'ya-impugnaste', message: expect.any(String) });
  });

  it('la mesa ve cuántos van y cuántos hacen falta, no quién', () => {
    let estado = partidaInventada(['a', 'b', 'c']);
    estado = trivialModule.apply(estado, { tipo: 'impugnar' }, 'a', asientos3);
    const vista = vistaDe(estado, 'b');

    expect(vista.impugnan).toBe(1);
    expect(vista.hacenFalta).toBe(3);
    expect(vista.tuImpugnas).toBe(false);
  });
});
```

- [ ] **Step 2: Compruébalo, tienen que fallar**

Run: `npx vitest run --root packages/shared src/games/trivial/trivial.spec.ts`
Expected: FAIL — no existe la acción `impugnar`.

- [ ] **Step 3: Tipos**

En `TrivialState`:

```ts
  /**
   * Si las preguntas de esta sala las escribió la IA.
   *
   * Se guarda en la partida y no se mira de la configuración cada vez porque
   * decide una regla -si se puede impugnar- y las reglas tienen que quedar
   * fijadas al crear la sala.
   */
  readonly inventadas: boolean;

  /** Quién ha dicho que esta pregunta está mal. Se anula por unanimidad. */
  readonly impugnan: readonly SeatId[];
```

En `TrivialView`:

```ts
  /** Si se puede impugnar en esta sala, que es solo en el modo IA. */
  readonly inventadas: boolean;
  /** Cuántos han impugnado y cuántos hacen falta. Nunca quiénes. */
  readonly impugnan: number;
  readonly hacenFalta: number;
  readonly tuImpugnas: boolean;
```

En `TrivialAction`: `Type.Object({ tipo: Type.Literal('impugnar') }, SIN_EXTRAS),`

- [ ] **Step 4: El reducer**

`createState`: `inventadas: config['origen'] === 'ia'`, `impugnan: []`.

`validate`:

```ts
      case 'impugnar': {
        if (!state.inventadas) {
          return { code: 'no-se-impugna', message: 'Estas preguntas están revisadas.' };
        }
        const ronda = rondaActual(state);
        if (!ronda || ronda.cerrada || state.fase !== 'ronda') {
          return { code: 'ronda-cerrada', message: 'Esa ronda ya se cerró.' };
        }
        if (!state.orden.includes(by)) {
          return { code: 'no-juegas', message: 'No estás jugando este concurso.' };
        }
        return state.impugnan.includes(by)
          ? { code: 'ya-impugnaste', message: 'Ya has dicho que está mal.' }
          : null;
      }
```

`apply`:

```ts
      case 'impugnar': {
        const impugnan = [...state.impugnan, by];
        const personas = state.orden.filter((seat) => !esBot(seats, seat));

        // Por unanimidad de las personas. Los bots no opinan: no saben si la
        // pregunta está mal, y esperar su voto sería esperar para siempre.
        if (personas.some((seat) => !impugnan.includes(seat))) {
          return { ...state, jugadas, impugnan };
        }
        return { ...anular(state), jugadas, impugnan };
      }
```

Y al final del fichero:

```ts
function esBot(seats: readonly Seat[], seat: SeatId): boolean {
  return seats.find((asiento) => asiento.id === seat)?.isBot ?? false;
}

/**
 * Cierra la ronda sin repartir nada.
 *
 * No es lo mismo que cerrarla: una pregunta anulada no la ha fallado nadie, así
 * que el marcador se queda exactamente como estaba. Lo que sí se conserva son
 * las respuestas, para que se pueda ver quién había contestado qué.
 */
function anular(state: TrivialState): TrivialState {
  const ronda = rondaActual(state);
  if (!ronda) return state;

  return {
    ...conRondaActual(state, { ...ronda, cerrada: true, anulada: true }),
    fase: 'resultado',
    cierraEn: 0,
  };
}
```

`Ronda` gana un campo:

```ts
  /** Si la mesa la tumbó por estar mal. Entonces no reparte puntos. */
  readonly anulada?: boolean;
```

Y `resultadosDe` devuelve ceros cuando la ronda está anulada:

```ts
function resultadosDe(state: TrivialState, ronda: Ronda): ResultadoDeRonda[] {
  const ganados = ronda.anulada
    ? {}
    : repartoDe(ronda.pregunta, ronda.respuestas, state.racha, state.apuestas);
  // … igual que antes …
}
```

`view`:

```ts
      inventadas: state.inventadas,
      impugnan: state.impugnan.length,
      hacenFalta: state.orden.filter((seat) => !esBot(seats, seat)).length,
      tuImpugnas: state.impugnan.includes(forSeat),
```

> `view` recibe `seats` como tercer parámetro y hoy no lo usa. Añádelo a la
> firma: `view(state, forSeat, seats)`.

En `siguiente`, limpia `impugnan: []` al entrar en la ronda nueva.

- [ ] **Step 5: Que pasen, lint, tipos, commit**

Mensaje:

```
feat(concurso): la mesa puede tumbar una pregunta que la IA se inventó mal

Por unanimidad de las personas, no por mayoría: con mayoría, quien no se sabe
la respuesta impugna para no perder puntos y el botón deja de arreglar
preguntas malas para ser una jugada más. Teniendo que darle todos, nadie la
anula por interés propio.

Los bots no votan -no saben si está mal, y esperar su voto sería esperar para
siempre- y en el modo del banco la acción se rechaza: esas preguntas están
escritas a mano y revisadas.

Anulada, el marcador se queda exactamente como estaba.
```

---

### Task 9: La dificultad se ve

**Files:**
- Modify: `packages/shared/src/games/trivial/tipos.ts`
- Modify: `packages/shared/src/games/trivial/index.ts`
- Test: `packages/shared/src/games/trivial/trivial.spec.ts`

**Interfaces:**
- Produces: `Pregunta.dificultad?: 1 | 2 | 3 | 4 | 5` y `TrivialView.dificultad: number | null`.

- [ ] **Step 1: La prueba**

```ts
describe('la dificultad', () => {
  it('viaja en la vista cuando la pregunta la trae', () => {
    const conNivel = partidaConDificultad(4);
    expect(vistaDe(conNivel, 'a').dificultad).toBe(4);
  });

  it('es null cuando la pregunta no la declara', () => {
    // El banco escrito a mano no la rellena, y no pasa nada: el crescendo es
    // cosa del modo IA, que sí la pide por posición.
    expect(vistaDe(partidaEmpezada(), 'a').dificultad).toBeNull();
  });

  it('no se enseña antes de empezar', () => {
    expect(vistaDe(partidaSinEmpezar(), 'a').dificultad).toBeNull();
  });
});
```

- [ ] **Step 2: Falla, implementa, pasa**

En `tipos.ts`, dentro de `Pregunta`:

```ts
  /**
   * Del 1 al 5. La 1 se contesta de memoria; la 5 la falla casi todo el mundo.
   *
   * Opcional a propósito: el banco escrito a mano no tiene que rellenarlo para
   * que el juego funcione. Lo pide el modo IA, que la encarga por posición para
   * que el programa vaya subiendo.
   */
  readonly dificultad?: 1 | 2 | 3 | 4 | 5;
```

En `TrivialView`: `readonly dificultad: number | null;`

En `view`: `dificultad: (state.fase !== 'presentacion' ? pregunta?.dificultad : undefined) ?? null,`

- [ ] **Step 3: Lint, tipos, tanda entera y commit**

Run: `npm run test`
Mensaje:

```
feat(concurso): las preguntas pueden declarar su dificultad

Del 1 al 5, y opcional: el banco escrito a mano no la rellena y no le hace
falta. La pide el modo IA, que encarga las preguntas por posición para que el
programa vaya subiendo de la primera a la vigesimoprimera.

Viaja en la vista para poder pintarla. Un crescendo que no se ve no existe.
```

---

## Fase C — El plató

Siete piezas pequeñas y un director. Ninguna sabe de WebSocket ni de la sala:
todas reciben datos ya masticados y emiten eventos, que es lo que permite
probarlas de una en una.

**El patrón del repositorio**, que aquí se sigue sin inventar nada: mira
`apps/web/src/app/games/flota/flota-board/flota-board.ts`. Entradas con
`@Input()`, salidas con `@Output() readonly x = new EventEmitter<…>()`, y una
interfaz «ya decidido antes de llegar a la plantilla» para no calcular en el
HTML.

**Cómo se prueban:** desde `apps/web`, `npx ng test --watch=false --include=<ruta>`.
Vitest directo falla ahí con «PlatformLocation needs JIT».

**Sobre el aspecto:** lo que se puede probar es qué se pinta y cuándo. Si está
guapo no lo dice ninguna prueba: eso se mira en local y luego en producción, y
es la Task 21.

### Task 10: Los atriles

Es el cambio que más se nota: el marcador deja de ser una lista y pasa a ser la
gente.

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/atriles/atriles.ts|html|css`
- Test: `apps/web/src/app/games/trivial/plato/atriles/atriles.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PuestoEnAtril {
    readonly seatId: string;
    readonly nombre: string;
    readonly foto: string;
    readonly puntos: number;
    readonly eresTu: boolean;
    /** Ya ha contestado. Nunca qué: eso no lo manda el servidor. */
    readonly haContestado: boolean;
    /** Lo que ganó en la ronda cerrada. `null` mientras sigue abierta. */
    readonly gano: number | null;
    readonly tieneLaBomba: boolean;
    readonly lidera: boolean;
  }
  ```
  `export class Atriles` con `@Input() puestos: readonly PuestoEnAtril[]`.

- [ ] **Step 1: Las pruebas**

Crea `atriles.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Atriles } from './atriles';
import type { PuestoEnAtril } from './atriles';

function puesto(cambios: Partial<PuestoEnAtril> = {}): PuestoEnAtril {
  return {
    seatId: 'a',
    nombre: 'Nova',
    foto: '/assets/trivial/cast/nova.png',
    puntos: 340,
    eresTu: false,
    haContestado: false,
    gano: null,
    tieneLaBomba: false,
    lidera: false,
    ...cambios,
  };
}

function montar(puestos: readonly PuestoEnAtril[]): HTMLElement {
  const fixture = TestBed.createComponent(Atriles);
  fixture.componentInstance.puestos = puestos;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('los atriles', () => {
  it('pone a cada uno en su puesto, con su cara y sus puntos', () => {
    const dom = montar([puesto(), puesto({ seatId: 'b', nombre: 'Sage', puntos: 180 })]);

    expect(dom.querySelectorAll('.atril').length).toBe(2);
    expect(dom.textContent).toContain('Nova');
    expect(dom.textContent).toContain('340');
    expect(dom.querySelector('img')?.getAttribute('src')).toContain('nova.png');
  });

  it('enciende el atril de quien ya ha contestado', () => {
    const dom = montar([puesto({ haContestado: true })]);
    expect(dom.querySelector('.atril')?.classList.contains('contestado')).toBe(true);
  });

  it('no dice qué ha contestado, solo que ya está', () => {
    // La respuesta de los demás no se enseña hasta que la ronda se cierra, y
    // aquí no llega: el atril no tiene por dónde filtrarla.
    const dom = montar([puesto({ haContestado: true })]);
    expect(dom.textContent).not.toMatch(/[ABCD]\b/);
  });

  it('marca el acierto y el fallo cuando la ronda se cierra', () => {
    const dom = montar([
      puesto({ seatId: 'a', gano: 150 }),
      puesto({ seatId: 'b', gano: 0 }),
      puesto({ seatId: 'c', gano: -120 }),
    ]);
    const atriles = dom.querySelectorAll('.atril');

    expect(atriles[0].classList.contains('acierta')).toBe(true);
    expect(atriles[1].classList.contains('acierta')).toBe(false);
    expect(atriles[2].classList.contains('falla')).toBe(true);
  });

  it('enseña lo que se ha ganado o perdido, con su signo', () => {
    const dom = montar([puesto({ gano: 150 }), puesto({ seatId: 'b', gano: -120 })]);
    expect(dom.textContent).toContain('+150');
    expect(dom.textContent).toContain('-120');
  });

  it('señala a quien tiene la bomba', () => {
    const dom = montar([puesto({ tieneLaBomba: true })]);
    expect(dom.querySelector('.atril')?.classList.contains('con-bomba')).toBe(true);
  });

  it('le pone corona al que va primero y marca el tuyo', () => {
    const dom = montar([puesto({ lidera: true }), puesto({ seatId: 'b', eresTu: true })]);
    const atriles = dom.querySelectorAll('.atril');

    expect(atriles[0].classList.contains('lidera')).toBe(true);
    expect(atriles[1].classList.contains('tu')).toBe(true);
  });

  it('sin nadie sentado no pinta nada y no revienta', () => {
    expect(montar([]).querySelectorAll('.atril').length).toBe(0);
  });
});
```

- [ ] **Step 2: Compruébalo, tiene que fallar**

Run (desde `apps/web`): `npx ng test --watch=false --include=src/app/games/trivial/plato/atriles/atriles.spec.ts`
Expected: FAIL — no existe `./atriles`.

- [ ] **Step 3: El componente**

`atriles.ts`:

```ts
import { Component, Input } from '@angular/core';

/** Cómo está un concursante en su puesto, ya decidido antes de la plantilla. */
export interface PuestoEnAtril {
  readonly seatId: string;
  readonly nombre: string;
  readonly foto: string;
  readonly puntos: number;
  readonly eresTu: boolean;
  /** Ya ha contestado. Nunca qué: eso no sale del servidor con la ronda abierta. */
  readonly haContestado: boolean;
  /** Lo que ganó en la ronda cerrada. `null` mientras sigue abierta. */
  readonly gano: number | null;
  readonly tieneLaBomba: boolean;
  readonly lidera: boolean;
}

/**
 * La fila de concursantes, cada uno en su atril.
 *
 * Es la diferencia entre un marcador y un concurso: en una lista de nombres no
 * se ve a nadie ponerse nervioso. Aquí el atril se enciende al contestar, se
 * pone verde al acertar, se apaga al fallar y tiembla cuando te toca la bomba,
 * que es exactamente lo que hace que mires a los demás en vez de a tu turno.
 */
@Component({
  selector: 'app-atriles',
  imports: [],
  templateUrl: './atriles.html',
  styleUrl: './atriles.css',
})
export class Atriles {
  @Input() puestos: readonly PuestoEnAtril[] = [];

  /** Lo ganado con su signo delante, que es como se lee un marcador. */
  conSigno(gano: number): string {
    return gano > 0 ? `+${gano}` : String(gano);
  }
}
```

`atriles.html`:

```html
<ol class="fila">
  @for (puesto of puestos; track puesto.seatId) {
    <li
      class="atril"
      [class.tu]="puesto.eresTu"
      [class.contestado]="puesto.haContestado"
      [class.acierta]="puesto.gano !== null && puesto.gano > 0"
      [class.falla]="puesto.gano !== null && puesto.gano < 0"
      [class.con-bomba]="puesto.tieneLaBomba"
      [class.lidera]="puesto.lidera"
    >
      @if (puesto.lidera) {
        <span class="corona" aria-label="Va primero">♛</span>
      }
      <img class="cara" [src]="puesto.foto" [alt]="puesto.nombre" loading="lazy" />
      <span class="nombre">{{ puesto.nombre }}</span>
      <span class="puntos">{{ puesto.puntos }}</span>
      @if (puesto.gano !== null && puesto.gano !== 0) {
        <span class="gano">{{ conSigno(puesto.gano) }}</span>
      }
    </li>
  }
</ol>
```

`atriles.css` — lo importante, y el resto a tu gusto mientras cumpla esto:

```css
/* Los atriles se reparten el ancho y se quedan abajo, como en un plató: la
   gente está delante del escenario, no en una columna al lado. */
.fila {
  display: flex;
  justify-content: center;
  gap: clamp(0.4rem, 2vw, 1.5rem);
  align-items: flex-end;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atril {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  flex: 0 1 9rem;
  transition: transform 220ms ease, filter 220ms ease;
}

/* Contestar se nota sin decir qué se ha contestado. */
.atril.contestado { filter: brightness(1.35); }
.atril.acierta { transform: translateY(-0.6rem); }
.atril.falla { filter: brightness(0.45) grayscale(0.6); transform: translateY(0.3rem); }
.atril.con-bomba { animation: tiembla 260ms infinite; }
.atril.tu .nombre { text-decoration: underline; }

@keyframes tiembla {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

/* Quien pidió que no se mueva nada, que no se le mueva nada. */
@media (prefers-reduced-motion: reduce) {
  .atril { transition: none; }
  .atril.con-bomba { animation: none; outline: 2px solid currentColor; }
}

/* En el móvil, dos filas antes que atriles de un centímetro. */
@media (max-width: 560px) {
  .fila { flex-wrap: wrap; }
  .atril { flex: 0 1 5.5rem; }
}
```

- [ ] **Step 4: Que pasen**

Run (desde `apps/web`): `npx ng test --watch=false --include=src/app/games/trivial/plato/atriles/atriles.spec.ts`
Expected: PASS, 8 pruebas.

- [ ] **Step 5: Commit**

```
feat(concurso): los concursantes salen en sus atriles

El marcador deja de ser una lista y pasa a ser la gente. El atril se enciende
al contestar -sin decir qué, que eso no sale del servidor-, se pone verde al
acertar, se apaga al fallar y tiembla cuando te toca la bomba.

En una lista de nombres no se ve a nadie ponerse nervioso, y en un concurso
eso es la mitad del juego.
```

---

### Task 11: El presentador y su bocadillo

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/presentador/presentador.ts|html|css`
- Test: `…/presentador.spec.ts`

**Interfaces:**
- Consumes: `fotoDelPresentador` y `gestoDe` de `@devweb/shared/games/trivial/reparto`.
- Produces: `export class PresentadorEnPlato` con `@Input() dice: string`, `@Input() momento: string`.

- [ ] **Step 1: Las pruebas**

```ts
describe('el presentador en el plató', () => {
  it('pone la cara que toca al momento', () => {
    // El gesto sale del momento y no de la frase: así los cinco de la mesa le
    // ven la misma cara que la frase que están leyendo.
    const dom = montar({ dice: 'Le ha estallado a Nova.', momento: 'explota' });
    expect(dom.querySelector('img')?.getAttribute('src')).toContain('wrong.png');
  });

  it('se queda quieto cuando no hay momento', () => {
    const dom = montar({ dice: '', momento: '' });
    expect(dom.querySelector('img')?.getAttribute('src')).toContain('idle.png');
  });

  it('sin nada que decir no saca bocadillo', () => {
    const dom = montar({ dice: '', momento: '' });
    expect(dom.querySelector('.bocadillo')).toBeNull();
  });

  it('enseña lo que dice', () => {
    const dom = montar({ dice: 'Vamos con la bomba.', momento: 'seccionBomba' });
    expect(dom.querySelector('.bocadillo')?.textContent).toContain('Vamos con la bomba.');
  });

  it('cambia de turno de palabra al cambiar la frase, para que se note', () => {
    const fixture = TestBed.createComponent(PresentadorEnPlato);
    fixture.componentInstance.dice = 'Una.';
    fixture.componentInstance.momento = 'presentaRonda';
    fixture.detectChanges();
    const primero = fixture.componentInstance.turnoDePalabra;

    fixture.componentInstance.dice = 'Otra distinta.';
    fixture.detectChanges();

    expect(fixture.componentInstance.turnoDePalabra).not.toBe(primero);
  });
});
```

- [ ] **Step 2: Falla**

Run (desde `apps/web`): `npx ng test --watch=false --include=src/app/games/trivial/plato/presentador/presentador.spec.ts`

- [ ] **Step 3: El componente**

```ts
import { Component, Input } from '@angular/core';
import { fotoDelPresentador, gestoDe } from '@devweb/shared/games/trivial/reparto';

/**
 * El presentador, con su cara y su bocadillo.
 *
 * Lo que dice y la cara que pone los manda el servidor, así que los cinco de la
 * mesa leen lo mismo a la vez. El gesto sale del momento del programa y no de
 * la frase: un presentador que pone la misma cara felicitándote que viéndote
 * estallar la bomba no está presentando nada.
 */
@Component({
  selector: 'app-presentador',
  imports: [],
  templateUrl: './presentador.html',
  styleUrl: './presentador.css',
})
export class PresentadorEnPlato {
  @Input() dice = '';
  @Input() momento = '';

  get cara(): string {
    return fotoDelPresentador(gestoDe(this.momento));
  }

  /** Para que el bocadillo se reinicie -y se note- cada vez que cambia. */
  get turnoDePalabra(): string {
    return `${this.momento}:${this.dice.length}`;
  }
}
```

`presentador.html`:

```html
<div class="presentador" [class.callado]="!dice">
  <img class="host" [src]="cara" alt="El presentador del concurso" decoding="async" />
  @if (dice) {
    <blockquote class="bocadillo" [attr.data-turno]="turnoDePalabra">
      <span class="quien">EL PRESENTADOR</span>
      <p>{{ dice }}</p>
    </blockquote>
  }
</div>
```

El CSS puede partir del que ya existe en `trivial-room.css` para `.plato`,
`.host` y `.bocadillo`: múdalo aquí en vez de reescribirlo. Añade que el
bocadillo entre con una animación corta atada a `data-turno`, para que una
frase nueva se note aunque se parezca a la anterior.

- [ ] **Step 4: Pasa, y commit**

```
feat(concurso): el presentador sale del fichero de la sala

Su cara y su bocadillo en su propia pieza, con el gesto saliendo del momento
del programa y no de la frase. Se puede probar solo, que era imposible cuando
vivía dentro de una plantilla de doscientas líneas.
```

---

### Task 12: El panel de la pregunta

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/panel-pregunta/panel-pregunta.ts|html|css`
- Test: `…/panel-pregunta.spec.ts`

**Interfaces:**
- Produces: `export class PanelPregunta` con
  ```ts
  @Input() enunciado = '';
  @Input() codigo: string | null = null;
  @Input() opciones: readonly string[] = [];
  @Input() dificultad: number | null = null;
  @Input() puedesContestar = false;
  @Input() cerrada = false;
  @Input() correcta: number | null = null;
  @Input() tuRespuesta: number | null = null;
  @Input() explicacion: string | null = null;
  @Input() sePuedeImpugnar = false;
  @Input() impugnan = 0;
  @Input() hacenFalta = 0;
  @Input() tuImpugnas = false;
  @Output() readonly responde = new EventEmitter<number>();
  @Output() readonly impugna = new EventEmitter<void>();
  ```

- [ ] **Step 1: Las pruebas**

```ts
describe('el panel de la pregunta', () => {
  it('pinta el enunciado y sus opciones con letra', () => {
    const dom = montar({ enunciado: '¿Qué devuelve typeof null?', opciones: ['"null"', '"object"'] });

    expect(dom.textContent).toContain('¿Qué devuelve typeof null?');
    expect(dom.querySelectorAll('.opcion').length).toBe(2);
    expect(dom.textContent).toContain('A');
    expect(dom.textContent).toContain('B');
  });

  it('enseña el código cuando lo hay, y no cuando no', () => {
    expect(montar({ codigo: 'const a = 1;' }).querySelector('.codigo')).not.toBeNull();
    expect(montar({}).querySelector('.codigo')).toBeNull();
  });

  it('avisa de la dificultad cuando la pregunta la trae', () => {
    expect(montar({ dificultad: 4 }).querySelector('.dificultad')?.textContent).toContain('4');
    expect(montar({ dificultad: null }).querySelector('.dificultad')).toBeNull();
  });

  it('no deja pulsar cuando no te toca', () => {
    const dom = montar({ opciones: ['una', 'otra'], puedesContestar: false });
    const botones = dom.querySelectorAll<HTMLButtonElement>('.opcion');
    expect(Array.from(botones).every((boton) => boton.disabled)).toBe(true);
  });

  it('avisa de qué has pulsado', () => {
    const fixture = montarFixture({ opciones: ['una', 'otra'], puedesContestar: true });
    const dichos: number[] = [];
    fixture.componentInstance.responde.subscribe((cual: number) => dichos.push(cual));

    fixture.nativeElement.querySelectorAll('.opcion')[1].click();

    expect(dichos).toEqual([1]);
  });

  it('cerrada, marca la buena y la tuya, y explica', () => {
    const dom = montar({
      opciones: ['una', 'otra'],
      cerrada: true,
      correcta: 0,
      tuRespuesta: 1,
      explicacion: 'Era la primera.',
    });
    const botones = dom.querySelectorAll('.opcion');

    expect(botones[0].classList.contains('buena')).toBe(true);
    expect(botones[1].classList.contains('tuya')).toBe(true);
    expect(dom.textContent).toContain('Era la primera.');
  });

  it('no enseña la respuesta buena mientras la ronda sigue abierta', () => {
    // La vista no la trae -el servidor no la manda- y el panel no se la inventa.
    const dom = montar({ opciones: ['una', 'otra'], cerrada: false, correcta: null });
    expect(dom.querySelector('.buena')).toBeNull();
  });

  it('solo ofrece impugnar en el modo de preguntas inventadas', () => {
    expect(montar({ sePuedeImpugnar: false }).querySelector('.impugnar')).toBeNull();
    expect(montar({ sePuedeImpugnar: true }).querySelector('.impugnar')).not.toBeNull();
  });

  it('dice cuántos van y cuántos hacen falta para tumbarla', () => {
    const dom = montar({ sePuedeImpugnar: true, impugnan: 2, hacenFalta: 4 });
    expect(dom.querySelector('.impugnar')?.textContent).toContain('2');
    expect(dom.querySelector('.impugnar')?.textContent).toContain('4');
  });

  it('no te deja impugnar dos veces', () => {
    const dom = montar({ sePuedeImpugnar: true, tuImpugnas: true });
    expect(dom.querySelector<HTMLButtonElement>('.impugnar')?.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Falla, escribe, pasa**

La plantilla, en lo esencial:

```html
<header class="enunciado">
  @if (dificultad !== null) {
    <span class="dificultad" [attr.data-nivel]="dificultad">
      Dificultad {{ dificultad }} de 5
    </span>
  }
  <h1>{{ enunciado }}</h1>
</header>

@if (codigo) {
  <pre class="codigo"><code>{{ codigo }}</code></pre>
}

<ul class="opciones">
  @for (opcion of opciones; track $index) {
    <li>
      <button
        type="button"
        class="opcion"
        [class.buena]="cerrada && correcta === $index"
        [class.tuya]="tuRespuesta === $index"
        [disabled]="!puedesContestar"
        (click)="responde.emit($index)"
      >
        <span class="letra">{{ letras[$index] }}</span>
        <span class="texto">{{ opcion }}</span>
      </button>
    </li>
  }
</ul>

@if (cerrada && explicacion) {
  <p class="explicacion">{{ explicacion }}</p>
}

<!-- Solo en el modo IA: el banco está escrito a mano y revisado. Y por
     unanimidad, que si bastara la mayoría se usaría para no perder puntos. -->
@if (sePuedeImpugnar && !cerrada) {
  <button type="button" class="impugnar" [disabled]="tuImpugnas" (click)="impugna.emit()">
    ⚑ Esta está mal ({{ impugnan }}/{{ hacenFalta }})
  </button>
}
```

Con `readonly letras = ['A', 'B', 'C', 'D'];` en la clase.

- [ ] **Step 3: Commit**

```
feat(concurso): el panel de la pregunta, en su propia pieza

Enunciado, código, opciones con su letra, la solución cuando la ronda se
cierra y el botón de impugnar del modo IA. No sabe nada de la sala: recibe lo
que hay que pintar y avisa de lo que se pulsa.

La respuesta buena solo se marca con la ronda cerrada, porque hasta entonces
el servidor no la manda y el panel no se la inventa.
```

---

### Task 13: El cronómetro

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/cronometro/cronometro.ts|html|css`
- Test: `…/cronometro.spec.ts`

**Interfaces:**
- Produces: `export class Cronometro` con `@Input() cierraEn = 0;` y `@Input() ahora: () => number = Date.now;`

El `ahora` inyectable no es un capricho de diseño: es lo que permite probar el
cronómetro sin esperar diez segundos de verdad.

- [ ] **Step 1: Las pruebas**

```ts
describe('el cronómetro', () => {
  it('no se ve si esta ronda no lleva reloj', () => {
    expect(montar({ cierraEn: 0 }).querySelector('.barra')).toBeNull();
  });

  it('enseña los segundos que quedan', () => {
    const dom = montar({ cierraEn: 18_000, ahora: () => 10_000 });
    expect(dom.textContent).toContain('8');
  });

  it('a cero no baja', () => {
    // El servidor cierra la ronda cuando toca; mientras llega su mensaje, la
    // pantalla no puede ponerse a contar en negativo.
    const dom = montar({ cierraEn: 5_000, ahora: () => 9_000 });
    expect(dom.textContent).not.toContain('-');
    expect(dom.textContent).toContain('0');
  });

  it('avisa cuando queda poco', () => {
    const dom = montar({ cierraEn: 12_000, ahora: () => 10_000 });
    expect(dom.querySelector('.barra')?.classList.contains('apurando')).toBe(true);
  });

  it('no avisa cuando sobra tiempo', () => {
    const dom = montar({ cierraEn: 30_000, ahora: () => 10_000 });
    expect(dom.querySelector('.barra')?.classList.contains('apurando')).toBe(false);
  });

  it('deja de latir al destruirse', () => {
    // Un intervalo que sigue vivo después de cerrar la sala es una fuga, y
    // aquí se abre y se cierra una ronda cada pocos segundos.
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Cronometro);
    fixture.componentInstance.cierraEn = 60_000;
    fixture.detectChanges();
    fixture.destroy();

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Falla, escribe, pasa**

```ts
import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';

/** Cuando queda menos que esto, la cuenta atrás se pone nerviosa. */
const APURANDO_MS = 5_000;

/**
 * La cuenta atrás de la ronda.
 *
 * Lo que llega del servidor es **el instante en que se cierra**, no los
 * segundos que quedan: cada navegador tiene su hora y ninguna coincide, así que
 * restar contra un instante común es lo único que hace que los cinco vean lo
 * mismo. Aquí solo se dibuja; quien cierra la ronda es el servidor.
 */
@Component({
  selector: 'app-cronometro',
  imports: [],
  templateUrl: './cronometro.html',
  styleUrl: './cronometro.css',
})
export class Cronometro implements OnInit, OnDestroy {
  @Input() cierraEn = 0;
  /** Inyectable para poder probar el paso del tiempo sin esperarlo. */
  @Input() ahora: () => number = Date.now;

  readonly late = signal(0);
  private latido?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.latido = setInterval(() => {
      this.late.update((cuantos) => cuantos + 1);
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.latido) clearInterval(this.latido);
  }

  /** Los segundos que quedan, nunca por debajo de cero. */
  get quedan(): number {
    this.late();
    if (this.cierraEn === 0) return 0;
    return Math.max(0, Math.ceil((this.cierraEn - this.ahora()) / 1000));
  }

  get apurando(): boolean {
    return this.cierraEn !== 0 && this.cierraEn - this.ahora() <= APURANDO_MS;
  }
}
```

`cronometro.html`:

```html
@if (cierraEn !== 0) {
  <div class="barra" [class.apurando]="apurando" role="timer" [attr.aria-label]="quedan + ' segundos'">
    <span class="marca">{{ quedan }}</span>
  </div>
}
```

> El `this.late()` dentro del getter es lo que ata el redibujado al latido en
> una aplicación sin zonas: sin esa lectura, la señal cambia y nadie se entera.

- [ ] **Step 3: Commit**

```
feat(concurso): la cuenta atrás en pantalla

Del servidor llega el instante en que se cierra la ronda, no los segundos que
quedan: cada navegador tiene su hora y ninguna coincide, así que restar contra
un instante común es lo único que hace que los cinco vean el mismo número.

El «ahora» es inyectable para poder probar el paso del tiempo sin esperarlo, y
el intervalo se suelta al destruirse: aquí se abre y se cierra una ronda cada
pocos segundos.
```

---

### Task 14: El rótulo de sección

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/rotulo/rotulo.ts|html|css`
- Test: `…/rotulo.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Seccion {
    readonly nombre: string;
    readonly pista: string;
    readonly premio: string;
  }
  export const SECCIONES: Readonly<Record<TipoPrueba, Seccion>>;
  export class Rotulo  // @Input() seccion: Seccion | null; @Output() readonly salta
  ```

`SECCIONES` se muda aquí desde `trivial-room.ts`, que ya la tiene casi entera,
y gana el `premio` —lo que se gana y se pierde— porque cantar las normas es la
mitad de lo que hace que una sección se note como sección.

- [ ] **Step 1: Las pruebas**

```ts
describe('el rótulo de sección', () => {
  it('sin sección no hay rótulo', () => {
    expect(montar({ seccion: null }).querySelector('.rotulo')).toBeNull();
  });

  it('canta el nombre, cómo se juega y qué se gana', () => {
    const dom = montar({ seccion: SECCIONES.bomba });

    expect(dom.textContent).toContain('La bomba');
    expect(dom.textContent).toContain(SECCIONES.bomba.pista);
    expect(dom.textContent).toContain(SECCIONES.bomba.premio);
  });

  it('las seis pruebas y la final tienen su rótulo', () => {
    // Sin esto, una prueba nueva entra sin que nadie la anuncie y vuelve a
    // sentirse como una pregunta más.
    for (const tipo of ['test', 'estimacion', 'fallo', 'pulsa', 'rafaga', 'bomba', 'final'] as const) {
      expect(SECCIONES[tipo].nombre.length).toBeGreaterThan(0);
      expect(SECCIONES[tipo].premio.length).toBeGreaterThan(0);
    }
  });

  it('se puede saltar pulsando', () => {
    const fixture = montarFixture({ seccion: SECCIONES.test });
    let saltado = false;
    fixture.componentInstance.salta.subscribe(() => { saltado = true; });

    fixture.nativeElement.querySelector('.rotulo').click();

    expect(saltado).toBe(true);
  });
});
```

- [ ] **Step 2: Falla, escribe, pasa**

```ts
/** Cómo se llama cada prueba en pantalla, cómo se juega y qué se gana. */
export const SECCIONES: Readonly<Record<TipoPrueba, Seccion>> = {
  test: { nombre: 'Test', pista: 'Cuatro opciones, una buena.', premio: 'Acertar +100 · Acertar pronto, más' },
  estimacion: { nombre: 'A ojo', pista: 'Sin opciones: escribe el número.', premio: 'Cuanto más cerca, más' },
  fallo: { nombre: 'Encuentra el fallo', pista: 'Está ahí. Míralo bien.', premio: 'Acertar +100' },
  pulsa: { nombre: 'El primero que pulse', pista: 'Solo cobra el primero.', premio: 'Acertar +150 · Fallar −50' },
  rafaga: { nombre: 'Ráfaga', pista: 'Verdadero o falso. Encadenar multiplica.', premio: 'Hasta ×5' },
  bomba: { nombre: 'La bomba', pista: 'Contesta y pásala. Que no te pille.', premio: 'Acertar +60 · Estallar −120' },
  final: { nombre: 'La final', pista: 'Apuesta lo que llevas. Una pregunta decide.', premio: 'Doble o nada' },
};
```

El rótulo ocupa la pantalla, con `position: fixed` y fondo casi opaco, y se va
al pulsar o cuando el director lo quita. Respeta `prefers-reduced-motion`: sin
animación de entrada, aparece y ya está.

- [ ] **Step 3: Commit**

```
feat(concurso): cada prueba se anuncia con su rótulo

Las seis pruebas ya se jugaban; lo que no había era quien las anunciara, y por
eso veinte rondas se sentían como veinte preguntas seguidas en vez de como un
programa con partes.

El rótulo canta el nombre, cómo se juega y qué se gana o se pierde. Se puede
saltar pulsando, que al tercer programa ya se las sabe uno.
```

---

### Task 15: La apuesta de la final

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/apuesta/apuesta.ts|html|css`
- Test: `…/apuesta.spec.ts`

**Interfaces:**
- Produces: `export class MandoDeApuesta` con `@Input() tienes = 0; @Input() tuApuesta: number | null = null; @Input() hanApostado = 0; @Input() sonPersonas = 0;` y `@Output() readonly apuesta = new EventEmitter<number>();`

- [ ] **Step 1: Las pruebas**

```ts
describe('el mando de la apuesta', () => {
  it('no te deja apostar más de lo que llevas', () => {
    const dom = montar({ tienes: 420 });
    expect(dom.querySelector<HTMLInputElement>('input[type=range]')?.max).toBe('420');
  });

  it('avisa de cuántos han apostado ya, sin decir cuánto', () => {
    const dom = montar({ tienes: 420, hanApostado: 2, sonPersonas: 4 });

    expect(dom.textContent).toContain('2');
    expect(dom.textContent).toContain('4');
    // Lo de los demás no llega aquí: el servidor no lo manda hasta que cierra.
  });

  it('apuesta lo elegido', () => {
    const fixture = montarFixture({ tienes: 420 });
    const dichas: number[] = [];
    fixture.componentInstance.apuesta.subscribe((cuanto: number) => dichas.push(cuanto));
    fixture.componentInstance.cuanto = 300;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.apostar').click();

    expect(dichas).toEqual([300]);
  });

  it('una vez apostado, ya no se toca', () => {
    const dom = montar({ tienes: 420, tuApuesta: 300 });

    expect(dom.querySelector<HTMLButtonElement>('.apostar')).toBeNull();
    expect(dom.textContent).toContain('300');
  });

  it('con cero puntos se puede seguir: se apuesta nada', () => {
    // Quedarse a cero a mitad de programa no puede dejarte fuera de la final.
    const dom = montar({ tienes: 0 });
    expect(dom.querySelector<HTMLButtonElement>('.apostar')?.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Falla, escribe, pasa**

Deslizador de 0 a `tienes`, con atajos de «nada», «la mitad» y «todo», el
número bien grande y un botón de apostar. Ya apostado, se sustituye por lo
puesto y el recuento de quién falta.

- [ ] **Step 3: Commit**

```
feat(concurso): el mando de la apuesta de la final

De cero a lo que lleves, con atajos para plantarse, jugarse la mitad o ir a
por todas. Enseña cuántos han apostado ya y nunca cuánto: eso no sale del
servidor hasta que la fase se cierra.

Con cero puntos también se apuesta -nada-, porque quedarse seco a mitad de
programa no puede dejarte fuera de la final.
```

---

### Task 16: El podio

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/podio/podio.ts|html|css`
- Test: `…/podio.spec.ts`

**Interfaces:**
- Produces: `export class Podio` con `@Input() clasificacion: readonly PuestoEnAtril[] = [];` y `@Output() readonly otra = new EventEmitter<void>();`

- [ ] **Step 1: Las pruebas**

```ts
describe('el podio', () => {
  it('sube a los tres primeros en su sitio', () => {
    const dom = montar([primero, segundo, tercero, cuarto]);
    const cajones = dom.querySelectorAll('.cajon');

    expect(cajones.length).toBe(3);
    expect(cajones[0].classList.contains('oro')).toBe(true);
  });

  it('con dos jugadores solo hay dos cajones', () => {
    expect(montar([primero, segundo]).querySelectorAll('.cajon').length).toBe(2);
  });

  it('el que quedó quinto también se ve, debajo', () => {
    // Un podio que esconde a la mitad de la mesa es un podio que la mitad de la
    // mesa no quiere mirar.
    const dom = montar([primero, segundo, tercero, cuarto, quinto]);
    expect(dom.querySelector('.resto')?.textContent).toContain(quinto.nombre);
  });

  it('ofrece otro concurso', () => {
    const fixture = montarFixture([primero]);
    let otra = false;
    fixture.componentInstance.otra.subscribe(() => { otra = true; });

    fixture.nativeElement.querySelector('.otra').click();

    expect(otra).toBe(true);
  });

  it('sin confeti si han pedido que no se mueva nada', () => {
    conPreferencia('(prefers-reduced-motion: reduce)', true);
    expect(montar([primero]).querySelector('canvas')).toBeNull();
  });
});
```

> `conPreferencia(consulta, valor)`: un doble de `window.matchMedia` en el
> `beforeEach`. Si el repositorio ya tiene uno, reutilízalo.

- [ ] **Step 2: Falla, escribe, pasa**

El confeti va en un `<canvas>` con `requestAnimationFrame`, se para solo a los
seis segundos y no se dibuja si `matchMedia('(prefers-reduced-motion: reduce)')`
dice que no. El bucle se cancela en `ngOnDestroy`.

- [ ] **Step 3: Commit**

```
feat(concurso): el podio, con su confeti

Los tres primeros suben por orden y el resto de la mesa queda debajo: un podio
que esconde a quien quedó quinto es un podio que ese quinto no quiere mirar.

El confeti se para solo y no se dibuja si han pedido que no se mueva nada.
```

---

### Task 17: El escenario y el director

Aquí se junta todo. `trivial-room` deja de pintar y pasa a decidir qué está en
pantalla; el escenario pone el fondo, los focos y el silencio.

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/plato.ts|html|css`
- Modify: `apps/web/src/app/games/trivial/trivial-room/trivial-room.ts|html|css`
- Modify: `apps/web/src/app/games/trivial/trivial-room.service.ts`
- Test: `apps/web/src/app/games/trivial/trivial-room/trivial-room.spec.ts`

**Interfaces:**
- Consumes: todas las piezas de las Tasks 10-16.
- Produces: `TrivialRoomService.apostar(cuanto: number): void` e `impugnar(): void`.

- [ ] **Step 1: Las dos acciones nuevas en el servicio**

```ts
  apostar(cuanto: number): void {
    this.socket.enviar({ tipo: 'apostar', cuanto });
  }

  impugnar(): void {
    this.socket.enviar({ tipo: 'impugnar' });
  }
```

- [ ] **Step 2: Las pruebas del director**

```ts
describe('el director del plató', () => {
  it('antes de empezar, ni atriles ni pregunta', () => {
    const dom = montar({ fase: 'presentacion' });

    expect(dom.querySelector('app-panel-pregunta')).toBeNull();
    expect(dom.querySelector('app-atriles')).toBeNull();
  });

  it('en ronda enseña la pregunta, los atriles y el reloj', () => {
    const dom = montar({ fase: 'ronda', cierraEn: 99_000 });

    expect(dom.querySelector('app-panel-pregunta')).not.toBeNull();
    expect(dom.querySelector('app-atriles')).not.toBeNull();
    expect(dom.querySelector('app-cronometro')).not.toBeNull();
  });

  it('en apuestas enseña el mando y esconde la pregunta', () => {
    // Ver la pregunta antes de apostar sería apostar sobre seguro.
    const dom = montar({ fase: 'apuestas' });

    expect(dom.querySelector('app-apuesta')).not.toBeNull();
    expect(dom.querySelector('app-panel-pregunta')).toBeNull();
  });

  it('al acabar, el podio', () => {
    const dom = montar({ fase: 'fin' });

    expect(dom.querySelector('app-podio')).not.toBeNull();
    expect(dom.querySelector('app-panel-pregunta')).toBeNull();
  });

  it('el rótulo entra al cambiar de sección y no en cada pregunta', () => {
    const fixture = montarFixture({ fase: 'ronda', tipo: 'test' });
    expect(fixture.nativeElement.querySelector('app-rotulo')).not.toBeNull();

    pasarA(fixture, { fase: 'ronda', tipo: 'test' });
    expect(fixture.nativeElement.querySelector('app-rotulo')).toBeNull();

    pasarA(fixture, { fase: 'ronda', tipo: 'bomba' });
    expect(fixture.nativeElement.querySelector('app-rotulo')).not.toBeNull();
  });

  it('el atril de quien tiene la bomba lo sabe', () => {
    const fixture = montarFixture({ fase: 'ronda', tipo: 'bomba', turno: 'b' });
    const atriles = fixture.debugElement.query(By.directive(Atriles)).componentInstance as Atriles;

    expect(atriles.puestos.find((uno) => uno.seatId === 'b')?.tieneLaBomba).toBe(true);
  });

  it('impugnar llega al servicio', () => {
    const fixture = montarFixture({ fase: 'ronda', inventadas: true });
    fixture.nativeElement.querySelector('.impugnar').click();

    expect(servicio.impugnado).toBe(1);
  });
});
```

- [ ] **Step 3: El escenario**

`plato.ts` es el marco: fondo, focos, suelo, el botón de silencio y
`<ng-content>`. Nada de lógica de juego.

```html
<section class="escenario">
  <div class="focos" aria-hidden="true"></div>
  <button type="button" class="silencio" [attr.aria-pressed]="callado" (click)="alterna.emit()">
    {{ callado ? '♪̸' : '♪' }}
  </button>
  <div class="tablas">
    <ng-content />
  </div>
</section>
```

El CSS tiene que sacar el concurso del marco terminal: `position: fixed;
inset: 0;` sobre el resto, fondo oscuro con un degradado de foco detrás del
presentador, y `--suelo` como banda inferior donde se apoyan los atriles. En
`trivial-room.html` desaparece `<app-terminal-layout>`.

> A 400 px de ancho: los atriles pasan a dos filas (ya lo hace su CSS), el
> presentador encoge y el bocadillo se pone encima de la pregunta en vez de al
> lado. Compruébalo antes de dar la tarea por buena.

- [ ] **Step 4: El director**

`trivial-room.ts` se queda con: la suscripción a la vista, el cálculo de
`puestos` para los atriles, qué sección entra —comparando el tipo de la ronda
anterior con el de la actual, para que el rótulo salga al cambiar de sección y
no en cada pregunta—, y el reenvío de las acciones al servicio. Todo lo que
hoy es pintura se borra de su plantilla: ya vive en las piezas.

- [ ] **Step 5: Verificación**

Run (desde `apps/web`): `npx ng test --watch=false --include=src/app/games/trivial/**`
Run: `npx eslint . --max-warnings 0 --report-unused-disable-directives`
Run: `npm run typecheck && npm run test`

- [ ] **Step 6: Míralo con los ojos**

```
npm run start -w @devweb/web
```

Abre `http://localhost:4200/juegos/trivial`, crea una sala contra el Sabelotodo
y juega un programa entero. Comprueba: el rótulo entra en cada sección y no en
cada pregunta; el cronómetro baja y la ronda se cierra sola al llegar a cero;
los atriles reaccionan; la final pide apuesta antes de enseñar la pregunta; el
podio sale con los tres primeros. Estréchalo a 400 px y repásalo.

- [ ] **Step 7: Commit**

```
feat(concurso): el plató

El concurso sale del marco terminal y ocupa la pantalla: escenario con focos,
presentador arriba, pregunta en medio y los concursantes en sus atriles abajo.

La sala pasa de pintarlo todo a dirigir: mira la vista y decide qué pieza está
en pantalla. Lo que antes eran doscientas líneas de plantilla y quinientas de
CSS haciendo de todo son ahora siete piezas que se prueban de una en una.
```

---

## Fase D — El modo con las preguntas inventadas

Va después del plató por dos razones: se apoya en el presentador ya arreglado
—misma cadena de modelos, mismos plazos— y hasta que el plató no está en pie no
se puede ver si una pregunta inventada luce como una del banco.

### Task 18: Recoger el JSON sin fiarse de él

La forma se puede garantizar. La verdad no. Esta tarea hace lo primero y asume
lo segundo.

**Files:**
- Create: `apps/server/src/games/trivial/inventor-esquema.ts`
- Test: `apps/server/src/games/trivial/inventor-esquema.spec.ts`

**Interfaces:**
- Produces:
  - `export const PreguntaInventada` (esquema TypeBox)
  - `export function aPregunta(tipo: TipoPrueba, cruda: unknown, id: string, rng: Rng): Pregunta | null`

- [ ] **Step 1: Las pruebas**

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '@devweb/shared/engine/rng';
import { aPregunta } from './inventor-esquema';

const RNG = () => createRng(7);

const BUENA = {
  enunciado: '¿Qué puerto usa HTTPS por defecto?',
  opciones: ['80', '443', '8080', '22'],
  respuesta: '443',
  explicacion: 'El 443. El 22 es SSH y el 8080 es donde acaba todo lo que levantas en local.',
  dificultad: 2,
};

describe('recoger una pregunta inventada', () => {
  it('convierte la respuesta escrita en el índice que le toca', () => {
    // Se le pide escrita y no numerada porque los modelos cuentan fatal: dicen
    // «la 2» queriendo decir la tercera, o cuentan desde uno.
    const pregunta = aPregunta('test', BUENA, 'ia-1', RNG());

    expect(pregunta).not.toBeNull();
    expect(pregunta?.opciones[pregunta.correcta]).toBe('443');
  });

  it('baraja las opciones', () => {
    // Un modelo pone la buena la primera mucho más de lo que el azar permite.
    // Contar sin leer no puede ser una estrategia ganadora.
    const ordenes = new Set<string>();
    for (let semilla = 0; semilla < 20; semilla += 1) {
      const pregunta = aPregunta('test', BUENA, 'ia-1', createRng(semilla));
      if (pregunta) ordenes.add(pregunta.opciones.join('|'));
    }

    expect(ordenes.size).toBeGreaterThan(1);
  });

  it('tira la pregunta si la respuesta no está entre las opciones', () => {
    const pregunta = aPregunta('test', { ...BUENA, respuesta: '8443' }, 'ia-1', RNG());
    expect(pregunta).toBeNull();
  });

  it('perdona la letra y las comillas con las que a veces la envuelve', () => {
    expect(aPregunta('test', { ...BUENA, respuesta: 'B) 443' }, 'ia-1', RNG())).not.toBeNull();
    expect(aPregunta('test', { ...BUENA, respuesta: '"443"' }, 'ia-1', RNG())).not.toBeNull();
    expect(aPregunta('test', { ...BUENA, respuesta: ' 443 ' }, 'ia-1', RNG())).not.toBeNull();
  });

  it('tira la que tiene dos opciones iguales', () => {
    // Con dos iguales, cuál es la buena deja de tener respuesta.
    const repetida = { ...BUENA, opciones: ['443', '443', '80', '22'] };
    expect(aPregunta('test', repetida, 'ia-1', RNG())).toBeNull();
  });

  it('exige cuatro opciones en las pruebas que son de cuatro', () => {
    expect(aPregunta('test', { ...BUENA, opciones: ['443', '80'] }, 'ia-1', RNG())).toBeNull();
  });

  it('en la ráfaga impone verdadero o falso', () => {
    const vof = { ...BUENA, opciones: [], respuesta: 'Verdadero', enunciado: 'PUT es idempotente.' };
    const pregunta = aPregunta('rafaga', vof, 'ia-1', RNG());

    expect(pregunta?.opciones).toEqual(['Verdadero', 'Falso']);
    expect(pregunta?.correcta).toBe(0);
  });

  it('en la ráfaga no baraja: verdadero va siempre primero', () => {
    // Que el sitio del «verdadero» cambie entre preguntas de una ráfaga que se
    // contesta en diez segundos es una crueldad, no una dificultad.
    for (let semilla = 0; semilla < 10; semilla += 1) {
      const pregunta = aPregunta('rafaga', { ...BUENA, opciones: [], respuesta: 'Falso' }, 'x', createRng(semilla));
      expect(pregunta?.opciones[0]).toBe('Verdadero');
      expect(pregunta?.correcta).toBe(1);
    }
  });

  it('en la estimación la respuesta es un número y hace falta el margen', () => {
    const conMargen = {
      enunciado: '¿En qué año salió la primera versión de Git?',
      opciones: [],
      respuesta: '2005',
      margen: 6,
      explicacion: 'Lo escribió Linus en abril de 2005, en dos semanas.',
      dificultad: 3,
    };

    expect(aPregunta('estimacion', conMargen, 'ia-1', RNG())?.correcta).toBe(2005);
    expect(aPregunta('estimacion', { ...conMargen, margen: undefined }, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('estimacion', { ...conMargen, respuesta: 'muchos' }, 'ia-1', RNG())).toBeNull();
  });

  it('tira lo que no encaja en el esquema', () => {
    expect(aPregunta('test', null, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('test', { enunciado: 'corta' }, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('test', { ...BUENA, dificultad: 11 }, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('test', { ...BUENA, explicacion: '' }, 'ia-1', RNG())).toBeNull();
  });

  it('conserva la dificultad y el tipo que se le pidió', () => {
    const pregunta = aPregunta('pulsa', BUENA, 'ia-7', RNG());

    expect(pregunta?.tipo).toBe('pulsa');
    expect(pregunta?.dificultad).toBe(2);
    expect(pregunta?.id).toBe('ia-7');
  });
});
```

- [ ] **Step 2: Falla**

Run: `npx vitest run --root apps/server src/games/trivial/inventor-esquema.spec.ts`

- [ ] **Step 3: Escribe el esquema y la conversión**

`inventor-esquema.ts`, en lo esencial:

```ts
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { shuffle } from '@devweb/shared/engine/rng';
import { OPCIONES } from '@devweb/shared/games/trivial/tipos';
import type { Static } from '@sinclair/typebox';
import type { Rng } from '@devweb/shared/engine/rng';
import type { Pregunta, TipoPrueba } from '@devweb/shared/games/trivial/tipos';

/**
 * La forma en que se le pide una pregunta al modelo.
 *
 * Dos decisiones que deciden cuántas sobreviven:
 *
 * `respuesta` va **escrita**, no numerada. Los modelos cuentan fatal -dicen «la
 * 2» queriendo decir la tercera, o cuentan desde uno- y en cambio aciertan al
 * escribir cuál es. El índice lo sacamos nosotros buscándola.
 *
 * Y las opciones las barajamos aquí. Un modelo pone la buena la primera mucho
 * más de lo que el azar permitiría, y contar sin leer no puede ser una
 * estrategia ganadora.
 */
export const PreguntaInventada = Type.Object(
  {
    enunciado: Type.String({ minLength: 10, maxLength: 300 }),
    codigo: Type.Optional(Type.String({ maxLength: 600 })),
    opciones: Type.Array(Type.String({ minLength: 1, maxLength: 140 }), { maxItems: 4 }),
    respuesta: Type.String({ minLength: 1, maxLength: 140 }),
    explicacion: Type.String({ minLength: 10, maxLength: 400 }),
    dificultad: Type.Integer({ minimum: 1, maximum: 5 }),
    /** Solo en las estimaciones: el error a partir del cual ya no se puntúa. */
    margen: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export type PreguntaInventada = Static<typeof PreguntaInventada>;

/** Las dos únicas opciones de la ráfaga. No las decide el modelo. */
const VERDADERO_O_FALSO = ['Verdadero', 'Falso'] as const;

/**
 * Una pregunta de verdad a partir de lo que devolvió el modelo, o `null`.
 *
 * `null` no es una excepción: es lo normal unas cuantas veces por programa. Lo
 * que devuelva null lo rellena el banco, así que una sala nunca se queda con
 * menos rondas de las que tiene que tener.
 */
export function aPregunta(
  tipo: TipoPrueba,
  cruda: unknown,
  id: string,
  rng: Rng,
): Pregunta | null {
  if (!Value.Check(PreguntaInventada, cruda)) return null;

  const base = {
    id,
    tipo,
    enunciado: cruda.enunciado.trim(),
    explicacion: cruda.explicacion.trim(),
    dificultad: cruda.dificultad as 1 | 2 | 3 | 4 | 5,
    ...(cruda.codigo ? { codigo: cruda.codigo } : {}),
  };

  if (tipo === 'estimacion') return estimacion(base, cruda);
  if (tipo === 'rafaga') return verdaderoOFalso(base, cruda);
  return deOpciones(base, cruda, rng);
}

function estimacion(base: Omit<Pregunta, 'opciones' | 'correcta'>, cruda: PreguntaInventada): Pregunta | null {
  const numero = Number(cruda.respuesta.replace(/[^\d.,-]/g, '').replace(',', '.'));
  // Sin margen no se puede puntuar con justicia: fallar por veinte en un año es
  // fallar, y fallar por veinte en «cuántos millones de líneas» es bordarlo.
  if (!Number.isFinite(numero) || !cruda.margen) return null;

  return { ...base, opciones: [], correcta: Math.round(numero), margen: cruda.margen };
}

function verdaderoOFalso(base: Omit<Pregunta, 'opciones' | 'correcta'>, cruda: PreguntaInventada): Pregunta | null {
  const dicha = normalizar(cruda.respuesta);
  const cual = VERDADERO_O_FALSO.findIndex((una) => normalizar(una) === dicha);
  if (cual < 0) return null;

  // No se barajan. Que el sitio del «verdadero» cambie en una prueba que se
  // contesta en diez segundos es una crueldad, no una dificultad.
  return { ...base, opciones: [...VERDADERO_O_FALSO], correcta: cual };
}

function deOpciones(
  base: Omit<Pregunta, 'opciones' | 'correcta'>,
  cruda: PreguntaInventada,
  rng: Rng,
): Pregunta | null {
  if (cruda.opciones.length !== OPCIONES) return null;

  const limpias = cruda.opciones.map((una) => una.trim());
  const normalizadas = limpias.map(normalizar);
  // Con dos opciones iguales, «cuál es la buena» deja de tener respuesta.
  if (new Set(normalizadas).size !== limpias.length) return null;

  const dicha = normalizar(cruda.respuesta);
  if (!normalizadas.includes(dicha)) return null;

  const barajadas = shuffle(limpias, rng);
  return {
    ...base,
    opciones: barajadas,
    correcta: barajadas.findIndex((una) => normalizar(una) === dicha),
  };
}

/**
 * La forma en que se comparan dos respuestas.
 *
 * El modelo envuelve: contesta «B) 443», «"443"» o « 443 » queriendo decir lo
 * mismo. Tirar la pregunta por eso sería tirar preguntas buenas por la
 * puntuación.
 */
function normalizar(texto: string): string {
  return texto
    .trim()
    .replace(/^[a-dA-D][).:-]\s*/, '')
    .replace(/^["'«»*]+|["'«»*]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
```

- [ ] **Step 4: Pasa, lint, tipos, commit**

```
feat(concurso): recoger las preguntas de la IA sin fiarse de ellas

La respuesta se pide escrita y no numerada, porque los modelos cuentan fatal:
dicen «la 2» queriendo decir la tercera. El índice lo sacamos buscándola, y de
paso barajamos las opciones, que un modelo pone la buena la primera mucho más
de lo que el azar permitiría.

Lo que no encaja se tira y devuelve null, que no es una excepción: es lo normal
unas cuantas veces por programa. Rellenarlo es cosa del que llame.
```

---

### Task 19: Encargar el programa entero

**Files:**
- Create: `apps/server/src/games/trivial/inventor-prompts.ts`
- Create: `apps/server/src/games/trivial/inventor.ts`
- Test: `apps/server/src/games/trivial/inventor.spec.ts`

**Interfaces:**
- Consumes: `aPregunta` (Task 18), `ESCALETA` y `repartir` de `./banco`, `chatWithFallback`.
- Produces:
  ```ts
  export async function inventar(opciones: {
    ajustes: AiSettings;
    semilla: number;
    modelo?: typeof chatWithFallback;
    plazoMs?: number;
    avisar?: (motivo: string) => void;
  }): Promise<Pregunta[]>
  ```

- [ ] **Step 1: Las pruebas**

```ts
describe('inventar el programa', () => {
  it('devuelve el programa entero aunque el modelo no conteste nada útil', () => {
    // Es la regla que no se puede romper: una sala con menos rondas de las que
    // toca es peor que una sala con preguntas del banco.
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: async () => ({ text: 'lo siento, no puedo ayudarte con eso', model: 'x' }),
    });

    expect(programa.length).toBe(RONDAS_POR_PROGRAMA);
  });

  it('mantiene la escaleta: mismas pruebas y en el mismo orden', () => {
    const programa = await inventar({ ajustes: AJUSTES, semilla: 1, modelo: modeloBueno() });
    const tipos = programa.map((una) => una.tipo);

    let desde = 0;
    for (const seccion of ESCALETA) {
      const tramo = tipos.slice(desde, desde + seccion.cuantas);
      expect(tramo.every((tipo) => tipo === seccion.tipo)).toBe(true);
      desde += seccion.cuantas;
    }
  });

  it('usa las que valen y rellena con el banco las que no', () => {
    const programa = await inventar({ ajustes: AJUSTES, semilla: 1, modelo: modeloAMedias() });

    expect(programa.some((una) => una.id.startsWith('ia-'))).toBe(true);
    expect(programa.some((una) => !una.id.startsWith('ia-'))).toBe(true);
    expect(programa.length).toBe(RONDAS_POR_PROGRAMA);
  });

  it('una llamada por sección, no una por pregunta', () => {
    // Veintiuna llamadas a un modelo gratuito son varios minutos de espera.
    const llamadas: string[] = [];
    await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: async (_a, mensajes) => {
        llamadas.push(String(mensajes.at(-1)?.content ?? ''));
        return { text: '[]', model: 'x' };
      },
    });

    expect(llamadas.length).toBe(ESCALETA.length);
  });

  it('la dificultad sube de la primera ronda a la última', () => {
    const programa = await inventar({ ajustes: AJUSTES, semilla: 1, modelo: modeloBueno() });
    const conNivel = programa.filter((una) => una.dificultad !== undefined);

    expect(conNivel.at(0)?.dificultad).toBeLessThan(conNivel.at(-1)?.dificultad ?? 0);
  });

  it('no espera para siempre: vencido el plazo, tira del banco', () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      plazoMs: 20,
      modelo: () => new Promise(() => undefined),
    });

    expect(programa.length).toBe(RONDAS_POR_PROGRAMA);
    expect(programa.every((una) => !una.id.startsWith('ia-'))).toBe(true);
  });

  it('sobrevive a un JSON roto', () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: async () => ({ text: '[{"enunciado": "a medio esc', model: 'x' }),
    });

    expect(programa.length).toBe(RONDAS_POR_PROGRAMA);
  });

  it('saca el JSON aunque venga envuelto en un bloque de código', () => {
    // Casi todos lo envuelven en ```json por mucho que se les pida que no.
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: async () => ({ text: '```json\n' + JSON.stringify([UNA_BUENA]) + '\n```', model: 'x' }),
    });

    expect(programa.some((una) => una.id.startsWith('ia-'))).toBe(true);
  });

  it('deja constancia de lo que se cayó, para poder diagnosticarlo', () => {
    const avisos: string[] = [];
    await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: async () => ({ text: 'nada', model: 'x' }),
      avisar: (motivo) => avisos.push(motivo),
    });

    expect(avisos.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Falla**

Run: `npx vitest run --root apps/server src/games/trivial/inventor.spec.ts`

- [ ] **Step 3: Los encargos de cada prueba**

`inventor-prompts.ts`: un encargo por tipo de prueba, en la misma línea que los
del presentador, más el reparto de temas:

```ts
/**
 * De qué van las preguntas.
 *
 * Se reparten a la fuerza porque a un modelo al que le pides preguntas de
 * programación te da diez de JavaScript. La variedad no sale sola.
 */
export const TEMAS: readonly string[] = [
  'redes y protocolos',
  'bases de datos y SQL',
  'CSS y maquetación',
  'sistemas operativos y procesos',
  'control de versiones',
  'seguridad',
  'rendimiento y complejidad',
  'historia de la informática',
  'tipos y lenguajes',
  'concurrencia',
];

/** Qué se le pide en cada prueba. La forma la impone el esquema; el tono, esto. */
export const ENCARGO_POR_PRUEBA: Readonly<Record<TipoPrueba, string>> = {
  test: 'Cuatro opciones y una sola buena, de rarezas que se recuerdan. Las tres malas tienen que ser creíbles: si se descartan de un vistazo, la pregunta no vale.',
  fallo: 'Código corto -entre cuatro y ocho líneas numeradas- con UN error real, y las opciones son las líneas. El código va en "codigo" y el enunciado pregunta en qué línea está.',
  estimacion: 'Un número comprobable y su margen de error en "margen". Sin opciones: se contesta escribiendo la cifra.',
  pulsa: 'Corta, de las que se saben o no se saben. Tiene que leerse de un vistazo, porque aquí se cobra por lanzarse el primero.',
  rafaga: 'Una afirmación que sea verdadera o falsa sin medias tintas. Sin opciones: las pone el programa.',
  bomba: 'Cortísima, de una línea. Se contesta con la mecha corriendo, así que nada de leer código ni de matices.',
  final: 'Gorda, de las que se recuerdan al salir. No de dato suelto: de entender algo que casi todo el mundo cree saber.',
};
```

Y el encargo completo, con la forma y los niveles pedidos:

```ts
export function encargoDeSeccion(opciones: {
  tipo: TipoPrueba;
  cuantas: number;
  temas: readonly string[];
  desde: number;
  hasta: number;
}): string {
  return [
    `Escribe ${opciones.cuantas} preguntas para la prueba «${opciones.tipo}» de un concurso de programación.`,
    ENCARGO_POR_PRUEBA[opciones.tipo],
    `Temas, uno por pregunta y sin repetir: ${opciones.temas.join(', ')}.`,
    `Dificultad de ${opciones.desde} a ${opciones.hasta}, subiendo.`,
    '',
    'Devuelve SOLO un array JSON, sin texto alrededor y sin bloque de código.',
    'Cada elemento: {"enunciado", "opciones", "respuesta", "explicacion", "dificultad"}',
    'y "codigo" y "margen" solo donde hagan falta.',
    '',
    '"respuesta" es el TEXTO de la opción correcta, copiado exactamente de "opciones".',
    'No pongas números ni letras de opción: el texto.',
    'La explicación dice por qué, en una o dos frases, y tiene que ser verdad.',
  ].join('\n');
}
```

- [ ] **Step 4: El inventor**

`inventor.ts` orquesta: una llamada por sección **en paralelo**, con plazo
global; cada respuesta se parsea, se valida pregunta a pregunta con `aPregunta`
y lo que falte se rellena del banco por tipo.

Lo importante que tiene que quedar en el código y en sus comentarios:

- **Una llamada por sección, no por pregunta.** Veintiuna llamadas a un modelo
  gratuito son varios minutos de espera.
- **Plazo global** (`plazoMs`, 60 s por defecto): vencido, se juega con lo que
  haya llegado y el resto del banco.
- **El JSON viene envuelto.** Casi todos lo meten en un bloque de código por
  mucho que se les pida que no: se busca el primer `[` y el último `]` antes de
  parsear, y si eso falla, esa sección entera cae al banco.
- **Se rellena por tipo**, no por posición: si de las seis de la bomba solo
  valen dos, las otras cuatro son bombas del banco y la escaleta no se mueve.
- **La dificultad sube por posición en el programa**, no dentro de cada
  sección: `desde`/`hasta` se calculan con el sitio que ocupa la sección en la
  escaleta.
- **La semilla manda en el barajado**, para que la partida se reconstruya igual.

- [ ] **Step 5: Pasa, lint, tipos, commit**

```
feat(concurso): la IA escribe el programa entero

Una llamada por prueba, en paralelo, con su encargo: a la ráfaga se le piden
verdaderos o falsos sin medias tintas, a «encuentra el fallo» código con un
error real y en qué línea, a la bomba cortísimas. Los temas se reparten a la
fuerza, porque si le pides preguntas de programación te da diez de JavaScript.

La dificultad se encarga por posición, así que la ronda 1 entra blanda y la 21
muerde.

Lo que no valida cae al banco, pregunta a pregunta y por tipo, de modo que la
escaleta no se mueve. Vencido el plazo se juega con lo que haya llegado. Nunca
se abre una sala con menos de veintiuna rondas jugables.
```

---

### Task 20: Elegir el modo y montar la sala

**Files:**
- Modify: `apps/server/src/rooms/service.ts`
- Modify: `apps/web/src/app/games/trivial/trivial-room.service.ts`
- Modify: `apps/web/src/app/games/trivial/trivial-lobby/trivial-lobby.ts|html|css`
- Test: `apps/server/src/rooms/*.spec.ts`, `apps/web/.../trivial-lobby.spec.ts`

**Interfaces:**
- Consumes: `inventar` (Task 19), `/health` (ya existe y ya dice `ia.configurada`).
- Produces: `config.origen: 'banco' | 'ia'` en la sala; `TrivialRoomService.crear(..., origen)`.

- [ ] **Step 1: El servidor monta el programa**

`conLoQueElJuegoNecesite` pasa a `async` y decide de dónde salen:

```ts
/**
 * Añade a la configuración lo que el juego necesita y el cliente no puede poner.
 *
 * Es el único sitio por el que entran las preguntas a una sala, y por eso el
 * modo IA cabe aquí sin tocar nada más: lo que cambia es de dónde salen, no
 * dónde viven. Siguen congeladas en la sala al crearla, que es lo que mantiene
 * la partida reconstruible desde su log e impide pedir otra tanda a mitad de
 * programa porque esta no gustó.
 */
async function conLoQueElJuegoNecesite(
  game: GameId,
  config: Record<string, unknown>,
  ia: AiSettings | null,
): Promise<Record<string, unknown>> {
  if (game !== 'trivial') return config;

  const semilla = randomInt(0, 2 ** 31);
  const quiereIa = config['origen'] === 'ia' && ia?.enabled;
  const preguntas = quiereIa ? await inventar({ ajustes: ia, semilla }) : repartir(semilla);

  return { ...config, semilla, origen: quiereIa ? 'ia' : 'banco', preguntas };
}
```

`crear` en `RoomService` pasa a esperarla. Comprueba si ya era `async`: si no,
hay que propagarlo hasta la ruta HTTP, que sí lo es.

> `origen` se normaliza aquí a propósito: si alguien pide `ia` sin que el
> servidor tenga clave, la sala sale del banco **y lo dice**, en vez de abrir
> una sala que promete lo que no puede dar.

- [ ] **Step 2: Las pruebas del servidor**

```ts
it('sin clave de IA, la sala del modo IA sale del banco y lo dice', async () => {
  const servicio = servicioSinIa();
  const sala = await servicio.crear({ game: 'trivial', config: { origen: 'ia' }, /* … */ });

  expect(sala.room.config['origen']).toBe('banco');
  expect((sala.room.config['preguntas'] as unknown[]).length).toBe(RONDAS_POR_PROGRAMA);
});

it('la semilla no la elige quien crea la sala', async () => {
  // Ya estaba probado y sigue valiendo: elegir la semilla sería elegir el
  // reparto, y con el reparto conocido las respuestas dejan de estar
  // escondidas.
  const sala = await servicio.crear({ game: 'trivial', config: { semilla: 42 }, /* … */ });
  expect(sala.room.config['semilla']).not.toBe(42);
});
```

- [ ] **Step 3: El lóbby**

En `trivial-lobby.ts`:

```ts
  /** De dónde salen las preguntas. Se elige al abrir y queda fijado en la sala. */
  origen: 'banco' | 'ia' = 'banco';

  /** Si el servidor tiene clave. Sin ella no se ofrece un botón que va a fallar. */
  readonly hayIa = signal(false);
```

Se resuelve pidiendo `/health` en `ngOnInit` y leyendo `ia.configurada`. En la
plantilla, un grupo de radios junto a «contra quién»:

```html
<fieldset class="origen">
  <legend>Preguntas</legend>
  <label class="opcion" [class.elegido]="origen === 'banco'">
    <input type="radio" name="origen" value="banco" [(ngModel)]="origen" />
    <span class="nombre">Del banco</span>
    <span class="descripcion">Escritas a mano y revisadas.</span>
  </label>
  @if (hayIa()) {
    <label class="opcion" [class.elegido]="origen === 'ia'">
      <input type="radio" name="origen" value="ia" [(ngModel)]="origen" />
      <span class="nombre">Inventadas por la IA</span>
      <span class="descripcion">
        Un programa escrito en el momento, con la dificultad subiendo.
        Experimental: alguna saldrá mal, y para eso está el botón de impugnar.
      </span>
    </label>
  } @else {
    <p class="explicacion">
      El modo de preguntas inventadas necesita una clave de IA configurada en el
      servidor. Ahora mismo no la hay.
    </p>
  }
</fieldset>
```

Y el botón de abrir, mientras se monta el programa:

```html
{{ trabajando() ? (origen === 'ia' ? 'Escribiendo el programa…' : 'Abriendo…') : 'Abrir la mesa' }}
```

> No hace falta una pantalla de carga aparte: crear la sala ya es **una** espera
> HTTP, y el modo IA lo único que hace es alargarla. Montar un estado de sala
> «generando» sería inventar una máquina de estados para no cambiar un texto.

- [ ] **Step 4: Las pruebas del lóbby**

```ts
it('no ofrece el modo IA si el servidor no tiene clave', async () => {
  const dom = await montar({ ia: { configurada: false } });
  expect(dom.textContent).toContain('necesita una clave de IA');
  expect(dom.querySelector('input[value=ia]')).toBeNull();
});

it('lo ofrece cuando sí la hay, avisando de que es experimental', async () => {
  const dom = await montar({ ia: { configurada: true } });

  expect(dom.querySelector('input[value=ia]')).not.toBeNull();
  expect(dom.textContent).toContain('Experimental');
});

it('manda el origen elegido al crear', async () => {
  const fixture = await montarFixture({ ia: { configurada: true } });
  fixture.componentInstance.origen = 'ia';

  await fixture.componentInstance.crear();

  expect(sala.creadaCon.origen).toBe('ia');
});

it('mientras monta el programa, lo dice', async () => {
  // Veinte segundos de botón «Abriendo…» sin más parecen un cuelgue.
  const fixture = await montarFixture({ ia: { configurada: true } });
  fixture.componentInstance.origen = 'ia';
  const abriendo = fixture.componentInstance.crear();
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Escribiendo el programa');
  await abriendo;
});
```

- [ ] **Step 5: Verificación entera y commit**

```
feat(concurso): se puede jugar con preguntas inventadas por la IA

Se elige al abrir la sala y queda congelado en ella. Entra por el único sitio
por el que ya entraban las preguntas -el servidor, al crear la sala-, así que
la partida se sigue reconstruyendo desde su log y nadie puede pedir otra tanda
a mitad de programa porque esta no le gustó.

Sin clave en el servidor el modo no se ofrece, y si alguien lo pide igualmente,
la sala sale del banco y lo dice: es mejor que abrir una sala que promete lo
que no puede dar.
```

---

## Fase E — El sonido y el cierre

### Task 21: Los efectos

**Files:**
- Create: `apps/web/src/app/games/trivial/plato/sonido.ts`
- Create: `apps/web/src/app/games/trivial/plato/sonido.spec.ts`
- Modify: `apps/web/src/app/games/trivial/trivial-room/trivial-room.ts`, `plato/plato.ts`

**Interfaces:**
- Produces: `export class Sonido` (servicio) con `suena(efecto: Efecto): void`, `callado: Signal<boolean>`, `alternar(): void`, y `export type Efecto = 'rotulo' | 'pulsa' | 'acierta' | 'falla' | 'tictac' | 'fanfarria'`.

- [ ] **Step 1: Las pruebas**

```ts
describe('el sonido', () => {
  it('arranca callado', () => {
    // Una web que empieza a pitar sola es una pestaña que se cierra.
    expect(new Sonido(audioDeMentira()).callado()).toBe(true);
  });

  it('callado no suena', () => {
    const audio = audioDeMentira();
    new Sonido(audio).suena('acierta');
    expect(audio.sonados).toEqual([]);
  });

  it('al quitarle el silencio, suena', () => {
    const audio = audioDeMentira();
    const sonido = new Sonido(audio);
    sonido.alternar();
    sonido.suena('acierta');

    expect(audio.sonados.length).toBe(1);
  });

  it('recuerda la elección entre partidas', () => {
    const audio = audioDeMentira();
    new Sonido(audio).alternar();

    expect(new Sonido(audio).callado()).toBe(false);
  });

  it('sin API de audio no revienta, simplemente no suena', () => {
    // Hay navegadores y contextos -pruebas incluidas- sin AudioContext.
    const sonido = new Sonido(null);
    sonido.alternar();

    expect(() => { sonido.suena('fanfarria'); }).not.toThrow();
  });
});
```

- [ ] **Step 2: Falla, escribe, pasa**

Los efectos se generan con osciladores: nada de descargar megas de MP3 para seis
pitidos. El `AudioContext` se crea **al quitar el silencio** y no antes, que es
lo que exige la política de reproducción automática de los navegadores. La
elección se guarda en `localStorage`, envuelta en `try/catch` porque en una
ventana privada tirar excepción.

- [ ] **Step 3: Engánchalo**

El director llama a `suena()` cuando cambia la vista: `rotulo` al entrar una
sección, `pulsa` al contestar, `acierta`/`falla` al cerrarse la ronda según lo
tuyo, `fanfarria` en el podio. El botón de silencio vive en el escenario.

- [ ] **Step 4: Commit**

```
feat(concurso): el plató suena

Seis efectos generados con osciladores en el navegador: rótulo, pulsación,
acierto, fallo, tic-tac y fanfarria. Nada de descargar megas de MP3 para seis
pitidos.

Arranca callado y el contexto de audio no se crea hasta que se pide sonido: lo
exigen las políticas de reproducción automática, y además una web que empieza a
pitar sola es una pestaña que se cierra.
```

---

### Task 22: Verificación y despliegue

- [ ] **Step 1: Todo, de una vez**

```
npx eslint . --max-warnings 0 --report-unused-disable-directives
npm run typecheck
npm run test
```
Expected: cero avisos y toda la tanda en verde. Si el lint se queja, se arregla
la causa: no se sube el tope ni se añade un `eslint-disable`.

- [ ] **Step 2: Un programa entero en local, de los dos modos**

```
npm run start -w @devweb/web
```

Con el banco y con la IA, jugando hasta el podio. La lista de comprobación:

- Los rótulos entran al cambiar de sección, no en cada pregunta.
- El cronómetro baja y la ronda se cierra sola al llegar a cero.
- Con la bomba en la mano, dejar pasar el tiempo te la hace estallar.
- Los atriles reaccionan: encendido al contestar, verde al acertar, apagado al fallar.
- La final pide la apuesta **antes** de enseñar la pregunta, y nadie ve la de los demás hasta que se cierra.
- El podio sube a los tres primeros y el resto se ve debajo.
- En el modo IA sale el botón de impugnar y hacen falta todas las personas.
- En el modo del banco **no** sale.
- A 400 px de ancho se sigue jugando.
- El presentador cambia de tono entre frases: si suenan todas a plantilla, la IA no está entrando.

- [ ] **Step 3: Push y despliegue**

```
git push origin HEAD
```

- [ ] **Step 4: Compruébalo en producción**

```
ssh -i ~/.ssh/devweb_deploy ubuntu@57.129.143.230 \
  "sudo systemctl show devweb-api -p ActiveEnterTimestamp --value; \
   sudo journalctl -u devweb-api --since '15 min ago' --no-pager \
     | grep -iE 'presentador|inventor' | tail -30"
```

Y en `https://oscarblancorosales.com/juegos/trivial`, un programa de los dos
modos. Lo que hay que ver en los logs: ninguna línea de «no dijo ni una frase
entera», y del inventor, como mucho avisos sueltos de preguntas caídas —que son
normales— pero no secciones enteras.

- [ ] **Step 5: Cuéntaselo al dueño**

Queda **pendiente de su decisión, no tuya**: `AI_MODEL` en `/etc/devweb/api.env`
sigue apuntando a `deepseek/deepseek-chat-v3-0324:free`, que dejó de ser
gratuito. La cadena de reserva lo salva, pero quema una llamada muerta por
frase y por sección. Recuérdaselo; no lo cambies tú.

---

## Autorrevisión del plan

**Cobertura de la spec**, sección a sección:

| Spec | Tareas |
|---|---|
| El presentador mudo (diagnóstico) | 1, 2, 3 |
| 1. El plató | 10-17 |
| 2. Los rótulos | 14, 17 |
| 3. El cronómetro | 4, 5, 13 |
| 4. La final a doble o nada | 6, 7, 15 |
| 5. El podio | 16 |
| 6. Encargo y medida por momento | 1, 2, 3, 7 |
| 7. El modo IA | 18, 19, 20 |
| 7. La impugnación | 8, 12 |
| 7. La dificultad en crescendo | 9, 12, 19 |
| 8. El sonido | 21 |
| 9. Cómo se prueba | en cada tarea |
| 10. Riesgos (móvil, confeti, plazos) | 10, 16, 17, 19 |
| 11. Por dónde se empieza | el orden de las fases |

**Consistencia de nombres**, comprobada de punta a punta: `cierraEn`,
`apuestas`, `impugnan`, `inventadas`, `dificultad`, `anulada` se declaran en la
Task 4/6/8/9 y se consumen con ese mismo nombre en 13, 15, 12 y 17.
`presupuestoDe` y `recortar` (Task 1) se usan en la 3. `aPregunta` (18) en la
19. `SEGUNDOS_POR_PRUEBA` (4) en la 5. `PuestoEnAtril` (10) en la 16 y la 17.

**Lo que este plan deja fuera a propósito**, y está dicho en la spec: no se
comprueba que las respuestas inventadas sean **verdad** —no se puede—, no hay
voz hablada, y no se toca `AI_MODEL` del VPS.
