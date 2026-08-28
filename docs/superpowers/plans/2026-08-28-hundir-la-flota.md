# Hundir la flota — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir Hundir la flota como tercer juego arbitrado por el servidor, con bot rival, y dejar la tarjeta de `/juegos` en «jugable».

**Architecture:** Un `GameModule` nuevo en `packages/shared/src/games/flota/` con reglas puras y vista por asiento; una pieza de infraestructura genérica —`botAction` en el contrato de juego y un conductor en el servidor— para que los asientos bot jueguen solos; y una pantalla Angular en `apps/web/src/app/games/flota/`.

**Tech Stack:** TypeScript, TypeBox (contratos), Vitest (tests), Fastify + WebSocket (servidor), Angular standalone + signals (web).

**Spec:** `docs/superpowers/specs/2026-08-28-hundir-la-flota-design.md`

## Global Constraints

- `packages/shared` no importa Angular, RxJS, Firebase ni Node, ni nombra `window`/`document`/`localStorage`. Su única dependencia es TypeBox. Lo impide una regla de ESLint.
- Un contrato, no dos: los esquemas se declaran una vez con TypeBox y de ahí salen validación y tipos. Nada de `interface` escrita a mano que duplique un esquema.
- `any` prohibido. En las fronteras entra `unknown` y sale tipado tras pasar por un esquema.
- `apps/server` compila con `noUncheckedIndexedAccess`: todo acceso indexado devuelve `| undefined` y hay que tratarlo.
- Capas en el servidor: `route → service → repository`, sin saltos.
- Comentarios que justifican **por qué**, nunca narran **qué**. Ficheros por debajo de ~300 líneas.
- Tests: Vitest, primero el que falla. Sin red, sin reloj real, sin base de datos en los unitarios. El azar entra por semilla.
- `npm run lint` con el tope de avisos que diga `package.json` (el trinquete solo baja): el código nuevo no añade ni un aviso.
- Mensajes de commit en español, en una línea, contando el porqué del cambio (mira `git log`).

**Comandos:**

```bash
npm run test -w @devweb/shared      # tests del paquete compartido
npm run test -w @devweb/server      # tests del servidor
npm run test -w @devweb/web         # tests de la web
npm run typecheck                   # los cinco proyectos
npm run lint
```

**Orden y worktrees:** las tareas 1–6 no tocan `apps/web` y pueden hacerse ya. Las tareas 7–9 necesitan el cliente HTTP/WebSocket que otra sesión está escribiendo en `apps/web/src/app/api/` sobre la rama `worktree-backend-propio`; antes de empezar la 7 hay que traer esa rama (`git rebase worktree-backend-propio`) y leer `api-client.ts`, `rooms-api.service.ts` y `room-socket.ts` en lugar de escribir un cliente nuevo.

---

## File Structure

```
packages/shared/src/games/flota/
  tipos.ts       tablero, barco, bando, estado, vista, esquemas TypeBox de la acción
  reglas.ts      colocar, disparar, hundir, terminar, puntería — funciones puras
  bot.ts         los tres niveles, deterministas
  index.ts       el GameModule que junta las tres cosas
packages/shared/src/games/module.ts        + botAction opcional
packages/shared/src/contracts/rooms.ts     + 'flota' en GameId
apps/server/src/rooms/registry.ts          + el módulo
apps/server/src/rooms/bots.ts              el conductor de asientos bot
apps/server/src/rooms/actor.ts             llama al conductor tras aplicar
apps/server/src/rooms/service.ts           sienta bots al crear la sala
apps/web/src/app/games/flota/
  flota-room.service.ts    la sala de flota contra la API
  flota-lobby/             crear sala, elegir rival
  flota-board/             una rejilla de 10x10, reutilizada por los dos tableros
  flota-room/              colocación y combate
apps/web/src/app/games/games.ts            la tarjeta pasa a 'listo'
apps/web/src/app/app.routes.ts             las dos rutas nuevas
```

---

### Task 1: El tablero y la flota

**Files:**
- Create: `packages/shared/src/games/flota/tipos.ts`
- Create: `packages/shared/src/games/flota/reglas.ts`
- Test: `packages/shared/src/games/flota/reglas.spec.ts`

**Interfaces:**
- Produces: `LADO = 10`, `TAMANOS_FLOTA = [5,4,3,3,2]`, tipos `Barco`, `Casilla`, `Bando`, `Fase`, `FlotaState`, `Nivel`; funciones `celdasDe(barco)`, `indice(fila, columna)`, `tableroVacio()`, `validarFlota(barcos)`.

- [ ] **Step 1: Escribir los tipos**

`tipos.ts`. El estado no conoce los asientos por adelantado: los bandos nacen cuando alguien despliega, porque el actor construye el estado cuando aún puede faltar el segundo jugador.

```ts
import type { SeatId } from '../module';

export const LADO = 10;
export const TAMANOS_FLOTA = [5, 4, 3, 3, 2] as const;

export type Orientacion = 'horizontal' | 'vertical';
export type Casilla = 'agua' | 'tocado' | 'hundido';
export type Fase = 'colocacion' | 'combate' | 'fin';
export type Nivel = 'novato' | 'marino' | 'almirante';

export interface Barco {
  readonly fila: number;
  readonly columna: number;
  readonly tamano: number;
  readonly orientacion: Orientacion;
}

/**
 * Un bando: su flota y lo que le han disparado.
 *
 * `recibidos` es una rejilla de 100 casillas —`null` es «aquí no ha caído
 * nada»— y no una lista de disparos, porque las dos preguntas que se hacen
 * todo el rato son «¿han disparado ya aquí?» y «¿qué pinto en esta celda?».
 */
export interface Bando {
  readonly barcos: readonly Barco[];
  readonly recibidos: readonly (Casilla | null)[];
}

export interface FlotaState {
  readonly fase: Fase;
  readonly bandos: Readonly<Record<SeatId, Bando>>;
  readonly orden: readonly SeatId[];
  readonly turno: SeatId | null;
  readonly ganador: SeatId | null;
  readonly jugadas: number;
  readonly semilla: number;
  readonly nivelBot: Nivel;
}

export interface Punteria {
  readonly disparos: number;
  readonly aciertos: number;
  readonly porcentaje: number;
}
```

- [ ] **Step 2: Escribir los tests que fallan**

`reglas.spec.ts`. Casos: una flota válida que se toca por un costado, una que se sale, una que solapa, una incompleta y una con tamaños que no son los de la flota.

```ts
import { describe, expect, it } from 'vitest';
import { LADO, type Barco } from './tipos';
import { celdasDe, indice, tableroVacio, validarFlota } from './reglas';

const FLOTA_VALIDA: Barco[] = [
  { fila: 0, columna: 0, tamano: 5, orientacion: 'horizontal' },
  { fila: 1, columna: 0, tamano: 4, orientacion: 'horizontal' },
  { fila: 2, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 3, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 4, columna: 0, tamano: 2, orientacion: 'horizontal' },
];

describe('celdasDe', () => {
  it('recorre el barco hacia la derecha si es horizontal', () => {
    expect(celdasDe({ fila: 2, columna: 3, tamano: 3, orientacion: 'horizontal' })).toEqual([
      { fila: 2, columna: 3 },
      { fila: 2, columna: 4 },
      { fila: 2, columna: 5 },
    ]);
  });

  it('recorre el barco hacia abajo si es vertical', () => {
    expect(celdasDe({ fila: 7, columna: 1, tamano: 2, orientacion: 'vertical' })).toEqual([
      { fila: 7, columna: 1 },
      { fila: 8, columna: 1 },
    ]);
  });
});

describe('validarFlota', () => {
  it('acepta la flota completa', () => {
    expect(validarFlota(FLOTA_VALIDA)).toBeNull();
  });

  it('acepta barcos que se tocan por un costado', () => {
    const pegados = FLOTA_VALIDA.map((barco, i) =>
      i === 1 ? { ...barco, fila: 0, columna: 5 } : barco,
    );
    expect(validarFlota(pegados)).toBeNull();
  });

  it('rechaza un barco que se sale del tablero', () => {
    const fuera = [...FLOTA_VALIDA];
    fuera[0] = { fila: 0, columna: 8, tamano: 5, orientacion: 'horizontal' };
    expect(validarFlota(fuera)?.code).toBe('barco-fuera');
  });

  it('rechaza dos barcos solapados', () => {
    const encima = [...FLOTA_VALIDA];
    encima[1] = { fila: 0, columna: 0, tamano: 4, orientacion: 'horizontal' };
    expect(validarFlota(encima)?.code).toBe('barcos-solapados');
  });

  it('rechaza una flota incompleta', () => {
    expect(validarFlota(FLOTA_VALIDA.slice(0, 4))?.code).toBe('flota-incompleta');
  });

  it('rechaza una flota con tamaños que no son los de la flota', () => {
    const rara = [...FLOTA_VALIDA];
    rara[4] = { fila: 4, columna: 0, tamano: 1, orientacion: 'horizontal' };
    expect(validarFlota(rara)?.code).toBe('flota-incompleta');
  });
});

describe('tableroVacio', () => {
  it('tiene una casilla por celda del tablero, todas sin disparar', () => {
    const tablero = tableroVacio();
    expect(tablero).toHaveLength(LADO * LADO);
    expect(tablero.every((casilla) => casilla === null)).toBe(true);
  });

  it('indexa fila y columna sin cruzarse', () => {
    expect(indice(0, 0)).toBe(0);
    expect(indice(1, 0)).toBe(LADO);
    expect(indice(9, 9)).toBe(LADO * LADO - 1);
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npm run test -w @devweb/shared -- flota`
Expected: FAIL, no existe `./reglas`.

- [ ] **Step 4: Implementar**

`reglas.ts`. La comparación de tamaños se hace ordenando las dos listas: la flota es un multiconjunto, y `3,3` tiene que seguir siendo dos barcos de tres.

```ts
import { LADO, TAMANOS_FLOTA, type Barco, type Casilla } from './tipos';
import type { RuleError } from '../module';

export function indice(fila: number, columna: number): number {
  return fila * LADO + columna;
}

export function tableroVacio(): (Casilla | null)[] {
  return Array.from({ length: LADO * LADO }, () => null);
}

export function celdasDe(barco: Barco): { fila: number; columna: number }[] {
  return Array.from({ length: barco.tamano }, (_, i) =>
    barco.orientacion === 'horizontal'
      ? { fila: barco.fila, columna: barco.columna + i }
      : { fila: barco.fila + i, columna: barco.columna },
  );
}

export function validarFlota(barcos: readonly Barco[]): RuleError | null {
  if (!tamanosCorrectos(barcos)) {
    return { code: 'flota-incompleta', message: 'La flota no es la que toca.' };
  }

  const ocupadas = new Set<number>();
  for (const barco of barcos) {
    for (const celda of celdasDe(barco)) {
      if (celda.fila < 0 || celda.fila >= LADO || celda.columna < 0 || celda.columna >= LADO) {
        return { code: 'barco-fuera', message: 'Ese barco no cabe en el tablero.' };
      }
      const pos = indice(celda.fila, celda.columna);
      if (ocupadas.has(pos)) {
        return { code: 'barcos-solapados', message: 'Dos barcos ocupan la misma casilla.' };
      }
      ocupadas.add(pos);
    }
  }
  return null;
}

function tamanosCorrectos(barcos: readonly Barco[]): boolean {
  const suyos = barcos.map((barco) => barco.tamano).sort((a, b) => b - a);
  const esperados = [...TAMANOS_FLOTA].sort((a, b) => b - a);
  return suyos.length === esperados.length && suyos.every((t, i) => t === esperados[i]);
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `npm run test -w @devweb/shared -- flota`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/games/flota
git commit -m "El tablero de la flota, con sus reglas de colocacion"
```

---

### Task 2: Disparar, hundir y terminar

**Files:**
- Modify: `packages/shared/src/games/flota/reglas.ts`
- Test: `packages/shared/src/games/flota/reglas.spec.ts`

**Interfaces:**
- Consumes: `celdasDe`, `indice`, `tableroVacio` de la tarea 1.
- Produces: `barcoEn(barcos, fila, columna): Barco | null`, `disparar(bando, fila, columna): { bando: Bando; resultado: Casilla }`, `flotaHundida(bando): boolean`, `punteria(bando): Punteria`.

- [ ] **Step 1: Escribir los tests que fallan**

El caso que importa es el tercero: al caer la última casilla, **todas** las del barco pasan a `hundido`, porque es lo que la pantalla pinta de otro color.

```ts
import { barcoEn, disparar, flotaHundida, punteria } from './reglas';
import { tableroVacio } from './reglas';
import type { Bando } from './tipos';

const UN_BARCO: Bando = {
  barcos: [{ fila: 0, columna: 0, tamano: 2, orientacion: 'horizontal' }],
  recibidos: tableroVacio(),
};

describe('disparar', () => {
  it('al agua deja la casilla en agua', () => {
    const { resultado, bando } = disparar(UN_BARCO, 5, 5);
    expect(resultado).toBe('agua');
    expect(bando.recibidos[indice(5, 5)]).toBe('agua');
  });

  it('sobre un barco de dos deja tocado mientras le quede casilla', () => {
    const { resultado, bando } = disparar(UN_BARCO, 0, 0);
    expect(resultado).toBe('tocado');
    expect(bando.recibidos[indice(0, 0)]).toBe('tocado');
  });

  it('al caer la ultima casilla marca hundido el barco entero', () => {
    const tocado = disparar(UN_BARCO, 0, 0).bando;
    const { resultado, bando } = disparar(tocado, 0, 1);
    expect(resultado).toBe('hundido');
    expect(bando.recibidos[indice(0, 0)]).toBe('hundido');
    expect(bando.recibidos[indice(0, 1)]).toBe('hundido');
  });

  it('no toca el bando original', () => {
    disparar(UN_BARCO, 0, 0);
    expect(UN_BARCO.recibidos[indice(0, 0)]).toBeNull();
  });
});

describe('flotaHundida', () => {
  it('es falsa mientras quede una casilla en pie', () => {
    expect(flotaHundida(disparar(UN_BARCO, 0, 0).bando)).toBe(false);
  });

  it('es cierta cuando han caido todas', () => {
    const medio = disparar(UN_BARCO, 0, 0).bando;
    expect(flotaHundida(disparar(medio, 0, 1).bando)).toBe(true);
  });
});

describe('punteria', () => {
  it('cuenta los disparos recibidos y cuantos dieron', () => {
    const uno = disparar(UN_BARCO, 0, 0).bando;
    const dos = disparar(uno, 9, 9).bando;
    expect(punteria(dos)).toEqual({ disparos: 2, aciertos: 1, porcentaje: 50 });
  });

  it('sin disparos no divide por cero', () => {
    expect(punteria(UN_BARCO)).toEqual({ disparos: 0, aciertos: 0, porcentaje: 0 });
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm run test -w @devweb/shared -- flota`
Expected: FAIL, `disparar` no está exportada.

- [ ] **Step 3: Implementar**

```ts
export function barcoEn(
  barcos: readonly Barco[],
  fila: number,
  columna: number,
): Barco | null {
  return (
    barcos.find((barco) =>
      celdasDe(barco).some((celda) => celda.fila === fila && celda.columna === columna),
    ) ?? null
  );
}

/**
 * Un disparo sobre un bando, sin tocar el original.
 *
 * El resultado no se decide casilla a casilla sino barco a barco: hasta que no
 * cae la última, todas las tocadas siguen siendo «tocado», y cuando cae, todas
 * pasan a «hundido» a la vez. Es lo que permite leer el tamaño del barco en la
 * rejilla sin que el servidor tenga que decir de cuál se trata.
 */
export function disparar(
  bando: Bando,
  fila: number,
  columna: number,
): { bando: Bando; resultado: Casilla } {
  const recibidos = [...bando.recibidos];
  const barco = barcoEn(bando.barcos, fila, columna);

  if (!barco) {
    recibidos[indice(fila, columna)] = 'agua';
    return { bando: { ...bando, recibidos }, resultado: 'agua' };
  }

  recibidos[indice(fila, columna)] = 'tocado';
  const celdas = celdasDe(barco);
  const hundido = celdas.every((celda) => recibidos[indice(celda.fila, celda.columna)] !== null);
  if (!hundido) {
    return { bando: { ...bando, recibidos }, resultado: 'tocado' };
  }

  for (const celda of celdas) recibidos[indice(celda.fila, celda.columna)] = 'hundido';
  return { bando: { ...bando, recibidos }, resultado: 'hundido' };
}

export function flotaHundida(bando: Bando): boolean {
  return bando.barcos.every((barco) =>
    celdasDe(barco).every((celda) => bando.recibidos[indice(celda.fila, celda.columna)] !== null),
  );
}

export function punteria(bando: Bando): Punteria {
  const caidos = bando.recibidos.filter((casilla) => casilla !== null);
  const aciertos = caidos.filter((casilla) => casilla !== 'agua').length;
  return {
    disparos: caidos.length,
    aciertos,
    porcentaje: caidos.length === 0 ? 0 : Math.round((aciertos / caidos.length) * 100),
  };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm run test -w @devweb/shared -- flota`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/games/flota
git commit -m "Disparos, hundimientos y punteria de la flota"
```

---

### Task 3: El módulo de juego y el secreto

**Files:**
- Create: `packages/shared/src/games/flota/index.ts`
- Modify: `packages/shared/src/games/flota/tipos.ts` (esquemas y vista)
- Modify: `packages/shared/src/contracts/rooms.ts` (`GameId` gana `'flota'`)
- Modify: `apps/server/src/rooms/registry.ts`
- Test: `packages/shared/src/games/flota/flota.spec.ts`

**Interfaces:**
- Consumes: las reglas de las tareas 1 y 2.
- Produces: `flotaModule: GameModule<FlotaState, FlotaAction>`, `FlotaAction`, `FlotaView`.

- [ ] **Step 1: Añadir los esquemas y la vista a `tipos.ts`**

```ts
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

const SIN_EXTRAS = { additionalProperties: false } as const;
const Coordenada = Type.Integer({ minimum: 0, maximum: LADO - 1 });

export const BarcoSchema = Type.Object(
  {
    fila: Coordenada,
    columna: Coordenada,
    tamano: Type.Integer({ minimum: 2, maximum: 5 }),
    orientacion: Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')]),
  },
  SIN_EXTRAS,
);

export const FlotaAction = Type.Union([
  Type.Object(
    {
      tipo: Type.Literal('desplegar'),
      barcos: Type.Array(BarcoSchema, {
        minItems: TAMANOS_FLOTA.length,
        maxItems: TAMANOS_FLOTA.length,
      }),
    },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('disparar'), fila: Coordenada, columna: Coordenada }, SIN_EXTRAS),
  Type.Object({ tipo: Type.Literal('rendirse') }, SIN_EXTRAS),
]);

export type FlotaAction = Static<typeof FlotaAction>;

/** Lo que sale hacia un asiento. Los barcos ajenos a flote no están aquí. */
export interface FlotaView {
  readonly fase: Fase;
  readonly turno: SeatId | null;
  readonly ganador: SeatId | null;
  readonly esperando: readonly SeatId[];
  readonly tuyo: Bando | null;
  readonly rivalId: SeatId | null;
  /** Tus disparos sobre el rival. Su rejilla, no su flota. */
  readonly disparosSobreRival: readonly (Casilla | null)[];
  /** La flota del rival, solo cuando la partida ha terminado. */
  readonly flotaRival: readonly Barco[] | null;
  readonly punteriaTuya: Punteria | null;
  readonly punteriaRival: Punteria | null;
}
```

`Barco` deja de escribirse a mano: pasa a ser `export type Barco = Static<typeof BarcoSchema>;` — un contrato, no dos. Mueve `BarcoSchema` por encima y borra la `interface Barco` de la tarea 1.

- [ ] **Step 2: Escribir los tests que fallan**

`flota.spec.ts`. El primer test del bloque de vista es el que justifica todo el juego y va con ese nombre.

```ts
import { describe, expect, it } from 'vitest';
import { flotaModule } from './index';
import { tableroVacio, indice } from './reglas';
import type { FlotaState, FlotaView } from './tipos';
import type { Seat } from '../module';

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true },
];

const FLOTA = [
  { fila: 0, columna: 0, tamano: 5, orientacion: 'horizontal' as const },
  { fila: 1, columna: 0, tamano: 4, orientacion: 'horizontal' as const },
  { fila: 2, columna: 0, tamano: 3, orientacion: 'horizontal' as const },
  { fila: 3, columna: 0, tamano: 3, orientacion: 'horizontal' as const },
  { fila: 4, columna: 0, tamano: 2, orientacion: 'horizontal' as const },
];

function conLasDosFlotasPuestas(): FlotaState {
  const inicial = flotaModule.createState(SEATS, { semilla: 7 });
  const una = flotaModule.apply(inicial, { tipo: 'desplegar', barcos: FLOTA }, 'ana', SEATS);
  return flotaModule.apply(una, { tipo: 'desplegar', barcos: FLOTA }, 'bea', SEATS);
}

describe('fases', () => {
  it('empieza en colocacion y sin turno', () => {
    const state = flotaModule.createState(SEATS, {});
    expect(state.fase).toBe('colocacion');
    expect(state.turno).toBeNull();
  });

  it('pasa a combate cuando las dos flotas estan puestas', () => {
    const state = conLasDosFlotasPuestas();
    expect(state.fase).toBe('combate');
    expect(state.turno).toBe('ana');
  });

  it('no deja disparar mientras se coloca', () => {
    const inicial = flotaModule.createState(SEATS, {});
    expect(flotaModule.validate(inicial, { tipo: 'disparar', fila: 0, columna: 0 }, 'ana', SEATS)?.code)
      .toBe('aun-no-se-dispara');
  });

  it('no deja desplegar dos veces', () => {
    const una = flotaModule.apply(
      flotaModule.createState(SEATS, {}),
      { tipo: 'desplegar', barcos: FLOTA },
      'ana',
      SEATS,
    );
    expect(flotaModule.validate(una, { tipo: 'desplegar', barcos: FLOTA }, 'ana', SEATS)?.code)
      .toBe('ya-desplegada');
  });
});

describe('turnos', () => {
  it('acertar da otro disparo', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.apply(state, { tipo: 'disparar', fila: 0, columna: 0 }, 'ana', SEATS);
    expect(tras.turno).toBe('ana');
  });

  it('fallar cede el turno', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.apply(state, { tipo: 'disparar', fila: 9, columna: 9 }, 'ana', SEATS);
    expect(tras.turno).toBe('bea');
  });

  it('no se dispara fuera de turno', () => {
    const state = conLasDosFlotasPuestas();
    expect(flotaModule.validate(state, { tipo: 'disparar', fila: 5, columna: 5 }, 'bea', SEATS)?.code)
      .toBe('no-es-tu-turno');
  });

  it('no se dispara dos veces a la misma casilla', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.apply(state, { tipo: 'disparar', fila: 0, columna: 0 }, 'ana', SEATS);
    expect(flotaModule.validate(tras, { tipo: 'disparar', fila: 0, columna: 0 }, 'ana', SEATS)?.code)
      .toBe('ya-disparado');
  });
});

describe('final', () => {
  it('gana quien hunde la flota entera', () => {
    let state = conLasDosFlotasPuestas();
    for (const barco of FLOTA) {
      for (let i = 0; i < barco.tamano; i++) {
        state = flotaModule.apply(
          state,
          { tipo: 'disparar', fila: barco.fila, columna: barco.columna + i },
          'ana',
          SEATS,
        );
      }
    }
    expect(state.fase).toBe('fin');
    expect(state.ganador).toBe('ana');
  });

  it('rendirse da la partida al otro', () => {
    const state = flotaModule.apply(conLasDosFlotasPuestas(), { tipo: 'rendirse' }, 'ana', SEATS);
    expect(state.fase).toBe('fin');
    expect(state.ganador).toBe('bea');
  });
});

describe('lo que ve cada asiento', () => {
  it('los barcos a flote del rival no salen del servidor', () => {
    const state = conLasDosFlotasPuestas();
    const vista = flotaModule.view(state, 'ana', SEATS) as FlotaView;

    expect(vista.flotaRival).toBeNull();
    expect(JSON.stringify(vista)).not.toContain('"tamano"');
    expect(vista.tuyo?.barcos).toHaveLength(FLOTA.length);
  });

  it('el rival ve sus impactos pero no de donde salen', () => {
    const state = flotaModule.apply(
      conLasDosFlotasPuestas(),
      { tipo: 'disparar', fila: 0, columna: 0 },
      'ana',
      SEATS,
    );
    const vista = flotaModule.view(state, 'ana', SEATS) as FlotaView;
    expect(vista.disparosSobreRival[indice(0, 0)]).toBe('tocado');
    expect(vista.disparosSobreRival[indice(9, 9)]).toBeNull();
  });

  it('al terminar se abren las dos flotas y la punteria', () => {
    const state = flotaModule.apply(conLasDosFlotasPuestas(), { tipo: 'rendirse' }, 'bea', SEATS);
    const vista = flotaModule.view(state, 'ana', SEATS) as FlotaView;
    expect(vista.flotaRival).toHaveLength(FLOTA.length);
    expect(vista.punteriaTuya).not.toBeNull();
  });
});
```

`vista.tuyo?.barcos` obliga a que `tuyo` sea `Bando | null`; un espectador sin bando lo recibe a `null`.

- [ ] **Step 3: Verificar que falla**

Run: `npm run test -w @devweb/shared -- flota`
Expected: FAIL, no existe `./index`.

- [ ] **Step 4: Implementar el módulo**

`index.ts`. Las claves de `bandos` no se recorren para saber quién es el rival: para eso está `orden`, que además fija quién abre.

```ts
export const flotaModule: GameModule<FlotaState, FlotaAction> = {
  id: 'flota',
  actionSchema: FlotaAction,

  createState(_seats, config) {
    return {
      fase: 'colocacion',
      bandos: {},
      orden: [],
      turno: null,
      ganador: null,
      jugadas: 0,
      semilla: typeof config['semilla'] === 'number' ? config['semilla'] : 1,
      nivelBot: esNivel(config['nivelBot']) ? config['nivelBot'] : 'marino',
    };
  },

  validate(state, action, by) { /* ver abajo */ },
  apply(state, action, by) { /* ver abajo */ },
  view(state, forSeat) { /* ver abajo */ },
  onSeatLeave(state) { return state; },
};
```

`validate`, con un código por motivo:

- `desplegar`: `fase !== 'colocacion'` → `ya-no-se-coloca`; ya tiene bando → `ya-desplegada`; ya hay dos bandos → `mesa-completa`; y si no, lo que diga `validarFlota`.
- `disparar`: `fase !== 'combate'` → `aun-no-se-dispara`; `state.turno !== by` → `no-es-tu-turno`; sin rival → `sin-rival`; casilla ya disparada en el bando del rival → `ya-disparado`.
- `rendirse`: `fase === 'fin'` → `partida-terminada`; sin bando → `no-juegas`.

`apply` incrementa siempre `jugadas` —de ahí sale el azar del bot— y:

- `desplegar`: añade el bando y el asiento a `orden`; si ya hay dos, `fase: 'combate'` y `turno: orden[0]`.
- `disparar`: aplica `disparar()` sobre el bando del rival; si acierta, el turno se queda; si no, pasa al otro. Si `flotaHundida(rival)`, `fase: 'fin'` y `ganador: by`.
- `rendirse`: `fase: 'fin'`, `ganador` el otro asiento de `orden`.

`view` es donde vive el secreto:

```ts
view(state, forSeat) {
  const tuyo = state.bandos[forSeat] ?? null;
  const rivalId = state.orden.find((id) => id !== forSeat) ?? null;
  const rival = rivalId ? state.bandos[rivalId] : undefined;
  const terminada = state.fase === 'fin';

  return {
    fase: state.fase,
    turno: state.turno,
    ganador: state.ganador,
    esperando: state.orden.filter((id) => !(id in state.bandos)),
    tuyo,
    rivalId,
    // Los disparos que yo he hecho son los que el rival ha recibido. Su flota
    // no viaja: viaja la rejilla de lo que ya sé de ella.
    disparosSobreRival: rival ? rival.recibidos : tableroVacio(),
    flotaRival: terminada && rival ? rival.barcos : null,
    punteriaTuya: terminada && rival ? punteria(rival) : null,
    punteriaRival: terminada && tuyo ? punteria(tuyo) : null,
  } satisfies FlotaView;
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `npm run test -w @devweb/shared -- flota`
Expected: PASS.

- [ ] **Step 6: Enchufarlo**

`contracts/rooms.ts`: `GameId` pasa a `Type.Union([Type.Literal('scrum'), Type.Literal('risk'), Type.Literal('flota')])`.
`apps/server/src/rooms/registry.ts`: `flota: flotaModule as GameModule<unknown, unknown>` en `JUEGOS`.

- [ ] **Step 7: Comprobar el conjunto**

Run: `npm run test -w @devweb/shared && npm run test -w @devweb/server && npm run typecheck`
Expected: PASS. El servidor tiene `noUncheckedIndexedAccess`: los accesos a `state.bandos[id]` y a `recibidos[i]` devuelven `| undefined` y hay que tratarlos, no silenciarlos con `!`.

- [ ] **Step 8: Commit**

```bash
git add packages/shared apps/server
git commit -m "La flota entra en el servidor, y los barcos del rival no salen de el"
```

---

### Task 4: El bot

**Files:**
- Create: `packages/shared/src/games/flota/bot.ts`
- Modify: `packages/shared/src/games/module.ts` (`botAction` opcional)
- Modify: `packages/shared/src/games/flota/index.ts` (implementarlo)
- Test: `packages/shared/src/games/flota/bot.spec.ts`

**Interfaces:**
- Consumes: `rngFor` de `../../engine/rng`, las reglas y el módulo.
- Produces: `flotaAleatoria(rng): Barco[]`, `siguienteDisparo(rejilla, nivel, rng): { fila, columna }`; `GameModule.botAction?(state, seat, seats): TAction | null`.

- [ ] **Step 1: Añadir `botAction` al contrato de juego**

`module.ts`, junto a `onSeatLeave`:

```ts
  /**
   * Qué haría ahora un asiento sin nadie detrás, o `null` si no le toca.
   *
   * Es puro como los demás: un bot se prueba sin servidor y sin red, y una
   * partida con bots se reconstruye desde su log igual que cualquier otra. El
   * azar sale del estado, nunca de `Math.random`.
   */
  botAction?(state: TState, seat: SeatId, seats: readonly Seat[]): TAction | null;
```

- [ ] **Step 2: Escribir los tests que fallan**

```ts
import { describe, expect, it } from 'vitest';
import { rngFor } from '../../engine/rng';
import { flotaAleatoria, siguienteDisparo } from './bot';
import { indice, tableroVacio, validarFlota } from './reglas';

describe('flotaAleatoria', () => {
  it('coloca una flota legal', () => {
    for (let semilla = 0; semilla < 50; semilla++) {
      expect(validarFlota(flotaAleatoria(rngFor(semilla, 0, 'flota')))).toBeNull();
    }
  });

  it('con la misma semilla coloca la misma flota', () => {
    expect(flotaAleatoria(rngFor(3, 0, 'flota'))).toEqual(flotaAleatoria(rngFor(3, 0, 'flota')));
  });
});

describe('siguienteDisparo', () => {
  it('nunca repite una casilla ya disparada', () => {
    const rejilla = tableroVacio();
    for (let i = 0; i < rejilla.length - 1; i++) rejilla[i] = 'agua';
    const tiro = siguienteDisparo(rejilla, 'novato', rngFor(1, 0, 'flota'));
    expect(indice(tiro.fila, tiro.columna)).toBe(rejilla.length - 1);
  });

  it('el marino remata junto a un impacto sin hundir', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 4)] = 'tocado';
    const tiro = siguienteDisparo(rejilla, 'marino', rngFor(1, 0, 'flota'));
    const contiguas = [
      indice(3, 4),
      indice(5, 4),
      indice(4, 3),
      indice(4, 5),
    ];
    expect(contiguas).toContain(indice(tiro.fila, tiro.columna));
  });

  it('el marino ignora un barco ya hundido', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 4)] = 'hundido';
    const tiro = siguienteDisparo(rejilla, 'marino', rngFor(1, 0, 'flota'));
    expect([indice(3, 4), indice(5, 4), indice(4, 3), indice(4, 5)]).not.toContain(
      indice(tiro.fila, tiro.columna),
    );
  });

  it('el almirante caza solo en una paridad', () => {
    for (let semilla = 0; semilla < 30; semilla++) {
      const tiro = siguienteDisparo(tableroVacio(), 'almirante', rngFor(semilla, 0, 'flota'));
      expect((tiro.fila + tiro.columna) % 2).toBe(0);
    }
  });

  it('el almirante abandona la paridad para rematar', () => {
    const rejilla = tableroVacio();
    rejilla[indice(4, 3)] = 'tocado';
    const tiro = siguienteDisparo(rejilla, 'almirante', rngFor(1, 0, 'flota'));
    expect([indice(3, 3), indice(5, 3), indice(4, 2), indice(4, 4)]).toContain(
      indice(tiro.fila, tiro.columna),
    );
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npm run test -w @devweb/shared -- flota`
Expected: FAIL, no existe `./bot`.

- [ ] **Step 4: Implementar el bot**

`bot.ts`. La colocación aleatoria reintenta: con 5 barcos en 100 casillas la probabilidad de no encontrar hueco es despreciable, pero un tope evita un bucle infinito si algún día cambia la flota.

```ts
const INTENTOS_POR_BARCO = 200;

export function flotaAleatoria(rng: Rng): Barco[] {
  const puestos: Barco[] = [];
  for (const tamano of TAMANOS_FLOTA) {
    for (let intento = 0; intento < INTENTOS_POR_BARCO; intento++) {
      const orientacion = rng.next() < 0.5 ? 'horizontal' : 'vertical';
      const barco: Barco = {
        tamano,
        orientacion,
        fila: rng.int(0, orientacion === 'vertical' ? LADO - tamano : LADO - 1),
        columna: rng.int(0, orientacion === 'horizontal' ? LADO - tamano : LADO - 1),
      };
      if (validarFlota([...puestos, barco].concat(restoPara(puestos.length + 1)) ) === null) { /* ver nota */ }
      if (cabe(barco, puestos)) {
        puestos.push(barco);
        break;
      }
    }
  }
  return puestos;
}
```

Nota: `validarFlota` exige la flota completa, así que la colocación parcial se comprueba con un `cabe(barco, puestos)` propio —dentro del tablero y sin solapar— y la flota final se valida entera al terminar. Escribe `cabe` y borra la línea de `validarFlota` de arriba; está en el plan para dejar claro por qué no vale reutilizarla tal cual.

```ts
function cabe(barco: Barco, puestos: readonly Barco[]): boolean {
  const ocupadas = new Set(
    puestos.flatMap((otro) => celdasDe(otro).map((c) => indice(c.fila, c.columna))),
  );
  return celdasDe(barco).every(
    (c) =>
      c.fila >= 0 &&
      c.fila < LADO &&
      c.columna >= 0 &&
      c.columna < LADO &&
      !ocupadas.has(indice(c.fila, c.columna)),
  );
}

/**
 * A dónde dispara el bot.
 *
 * Dos modos, y el orden importa: si hay un barco tocado y sin hundir, rematarlo
 * es siempre mejor que cualquier tiro nuevo, así que el rastreo va primero y la
 * paridad del almirante solo se aplica cuando no hay nada que rematar.
 */
export function siguienteDisparo(
  rejilla: readonly (Casilla | null)[],
  nivel: Nivel,
  rng: Rng,
): { fila: number; columna: number } {
  if (nivel !== 'novato') {
    const remate = contiguasATocado(rejilla);
    if (remate.length > 0) return celda(elegir(remate, rng));
  }

  const libres = rejilla.flatMap((casilla, i) => (casilla === null ? [i] : []));
  const candidatas =
    nivel === 'almirante' ? conParidad(libres) : libres;

  return celda(elegir(candidatas.length > 0 ? candidatas : libres, rng));
}
```

`contiguasATocado` recorre las casillas en estado `tocado` —nunca `hundido`— y devuelve sus vecinas de arriba, abajo, izquierda y derecha que sigan sin disparar. `conParidad` se queda con los índices cuya `(fila + columna) % 2 === 0`. `elegir` usa `rng.int(0, n - 1)`.

- [ ] **Step 5: Implementar `botAction` en el módulo**

En `index.ts`:

```ts
  botAction(state, seat) {
    const rng = rngFor(state.semilla, state.jugadas, `flota:${seat}`);

    if (state.fase === 'colocacion' && !(seat in state.bandos)) {
      return { tipo: 'desplegar', barcos: flotaAleatoria(rng) };
    }
    if (state.fase !== 'combate' || state.turno !== seat) return null;

    const rivalId = state.orden.find((id) => id !== seat);
    const rival = rivalId ? state.bandos[rivalId] : undefined;
    if (!rival) return null;

    const { fila, columna } = siguienteDisparo(rival.recibidos, state.nivelBot, rng);
    return { tipo: 'disparar', fila, columna };
  },
```

- [ ] **Step 6: Verificar que pasa**

Run: `npm run test -w @devweb/shared -- flota`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "Tres niveles de bot para la flota, y un contrato para que el servidor los mueva"
```

---

### Task 5: El conductor de bots

**Files:**
- Create: `apps/server/src/rooms/bots.ts`
- Modify: `apps/server/src/rooms/actor.ts`
- Test: `apps/server/src/rooms/bots.spec.ts`

**Interfaces:**
- Consumes: `GameModule.botAction`, `RoomActor.submit`.
- Produces: `moverBots(actor, seats, tope?): number` — cuántas jugadas de bot se aplicaron.

- [ ] **Step 1: Escribir el test que falla**

Con un módulo de mentira, para probar el conductor y no un juego. Mira `apps/server/src/rooms/rooms.spec.ts` para el arranque de repositorio en memoria que ya usan los tests de salas y reutilízalo.

```ts
describe('moverBots', () => {
  it('juega por el asiento bot hasta que deja de tener jugada', () => { /* módulo que responde 3 veces y luego null */ });
  it('no toca los asientos de personas', () => { /* botAction devuelve jugada para un humano: no se aplica */ });
  it('para en el tope aunque el modulo siga pidiendo jugar', () => { /* botAction infinito, tope 10 => 10 */ });
  it('para si el modulo rechaza su propia jugada', () => { /* validate devuelve error => no bucle */ });
  it('no hace nada si el juego no tiene bots', () => { /* módulo sin botAction => 0 */ });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm run test -w @devweb/server -- bots`
Expected: FAIL, no existe `./bots`.

- [ ] **Step 3: Implementar**

```ts
/** Un bot que encadena más jugadas que esto no está jugando: está girando. */
export const TOPE_JUGADAS_SEGUIDAS = 200;

export function moverBots(
  actor: RoomActor,
  module: GameModule<unknown, unknown>,
  seats: readonly Seat[],
  tope = TOPE_JUGADAS_SEGUIDAS,
): number { /* bucle: por cada asiento bot, pedir jugada, submit, contar; parar al primer rechazo o cuando nadie tenga jugada */ }
```

Las jugadas del bot entran por `actor.submit`, el mismo camino que las de una persona: mismo esquema, misma validación, mismo log. Un bot no es un asiento de confianza.

- [ ] **Step 4: Engancharlo en el actor**

En `RoomActor.submit`, después del `broadcast()` final. El actor gana la llamada y ninguna regla: el bucle vive en `bots.ts`. Ojo con la reentrada — `moverBots` llama a `submit`, así que la llamada va detrás de una bandera que impide que un bot dispare otra ronda de bots.

- [ ] **Step 5: Verificar**

Run: `npm run test -w @devweb/server`
Expected: PASS, incluidos los tests de salas que ya existían.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "El servidor ya sabe mover a quien no tiene a nadie detras"
```

---

### Task 6: Sentar bots al crear la sala

**Files:**
- Modify: `packages/shared/src/contracts/rooms.ts` (`CreateRoomRequest` gana `bots`)
- Modify: `apps/server/src/rooms/service.ts`
- Test: `apps/server/src/rooms/rooms.spec.ts`

**Interfaces:**
- Produces: `CreateRoomRequest.bots?: { displayName: string }[]`; `RoomService.crear` los sienta con `isBot: true`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
it('sienta los bots pedidos al crear la sala', () => { /* crear con bots: [{displayName:'Almirante'}] => 2 asientos, uno isBot */ });
it('no acepta mas bots que asientos caben', () => { /* > maxSeats => AppError */ });
it('sin bots, la sala nace con un solo asiento', () => { /* comportamiento de hoy, intacto */ });
```

- [ ] **Step 2: Verificar que falla**

Run: `npm run test -w @devweb/server -- rooms`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`sentar()` gana un parámetro `isBot` (por defecto `false`, que es lo que hacen todas las llamadas de hoy). Un asiento bot no necesita pase —nadie se va a conectar con él—, así que su `tokenHash` es un token generado y descartado: la columna no admite nulos y un pase que no existe fuera del proceso no lo puede usar nadie.

- [ ] **Step 4: Verificar**

Run: `npm run test -w @devweb/server && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/server
git commit -m "Una sala puede nacer con rivales que no son personas"
```

---

### Task 7: La sala de flota en la web

**Precondición:** `git rebase worktree-backend-propio` para traer `apps/web/src/app/api/`. Lee `api-client.ts`, `rooms-api.service.ts` y `room-socket.ts` y úsalos; no escribas un cliente nuevo. Mira `scrum-room.service.ts` como ejemplo de servicio de sala ya migrado.

**Files:**
- Create: `apps/web/src/app/games/flota/flota-room.service.ts`
- Test: `apps/web/src/app/games/flota/flota-room.service.spec.ts`

**Interfaces:**
- Produces: señales `vista`, `conectado`, `error`; métodos `entrar(roomId, seatToken)`, `desplegar(barcos)`, `disparar(fila, columna)`, `rendirse()`, `salir()`.

- [ ] **Step 1: Test que falla** — con un doble del socket: al llegar un mensaje `estado`, `vista()` lo refleja; al llegar `rechazada`, `error()` lo cuenta y `vista()` no cambia.
- [ ] **Step 2: Verificar que falla.** Run: `npm run test -w @devweb/web -- flota`
- [ ] **Step 3: Implementar** el servicio sobre `room-socket.ts`, con `FlotaView` importado por `import type` desde `@devweb/shared`.
- [ ] **Step 4: Verificar.** Run: `npm run test -w @devweb/web -- flota`
- [ ] **Step 5: Commit.** `git commit -m "La web habla con la sala de flota"`

---

### Task 8: Las pantallas

**Files:**
- Create: `apps/web/src/app/games/flota/flota-board/` (rejilla reutilizable), `flota-lobby/`, `flota-room/`
- Modify: `apps/web/src/app/app.routes.ts`

- [ ] **Step 1: La rejilla** — componente tonto: recibe `celdas`, `barcos` (o `null`), si es pulsable, y emite `(disparo)`. Los dos tableros son el mismo componente con distinta entrada. Test: pintar `hundido` en otro color que `tocado`, y no emitir en una celda ya disparada.
- [ ] **Step 2: El lobby** — crear sala, elegir rival (persona con enlace, o bot con nivel), entrar. Estética de `risk-lobby`.
- [ ] **Step 3: La colocación** — los cinco barcos, rotar, flota aleatoria, enviar cuando esté completa. La aleatoria del cliente puede usar `flotaAleatoria` del paquete compartido: es la misma función que usa el bot.
- [ ] **Step 4: El combate y el final** — dos tableros, de quién es el turno, y al acabar las dos flotas y la puntería.
- [ ] **Step 5: Rutas** — `juegos/flota` y `juegos/flota/mesa`, con `loadComponent` como las de RISK.
- [ ] **Step 6: Verificar.** Run: `npm run test -w @devweb/web && npm run typecheck && npm run lint`
- [ ] **Step 7: Commit.** `git commit -m "Hundir la flota, en pantalla"`

---

### Task 9: La tarjeta deja de decir «en obras»

**Files:**
- Modify: `apps/web/src/app/games/games.ts`
- Test: `apps/web/src/app/games/games.spec.ts`

- [ ] **Step 1: Test que falla** — la tarjeta `hundir-la-flota` tiene `status: 'listo'` y `route: '/juegos/flota'`.
- [ ] **Step 2: Verificar que falla.** Run: `npm run test -w @devweb/web -- games`
- [ ] **Step 3: Implementar** — cambiar la tarjeta y sus `highlights`: los tres niveles de bot, el tablero de 10×10 y la puntería final.
- [ ] **Step 4: Verificar todo.** Run: `npm run test && npm run typecheck && npm run lint`
- [ ] **Step 5: Commit.** `git commit -m "La flota ya se juega"`

---

## Self-Review

**Cobertura de la spec:** reglas §1 → tareas 1–3; secreto §2 → tarea 3 (test con nombre propio); bots §3 → tareas 4–6; pantalla §4 → tareas 7–9; ficheros §5 → File Structure; tests §6 → repartidos por tarea; riesgos §7 → tope en la tarea 5, y el bot que no hace de anfitrión no cambia nada, así que no tiene tarea.

**Sin placeholders:** los pasos de la tarea 5 y de la 6 describen los tests por su nombre en vez de escribirlos enteros porque dependen del arranque de repositorio en memoria que ya existe en `rooms.spec.ts`; el paso remite a ese fichero. Las tareas 7–9 llevan menos código porque su interfaz —el cliente de API— la está escribiendo otra rama y hay que leerla antes, cosa que la precondición dice explícitamente.

**Tipos:** `Barco` sale de `BarcoSchema` a partir de la tarea 3 y la 1 crea la `interface` que la 3 sustituye; el paso lo dice. `Casilla`, `Bando`, `FlotaState`, `FlotaView`, `Nivel` y `Punteria` se usan con el mismo nombre en todas las tareas. `siguienteDisparo` y `flotaAleatoria` conservan su firma entre la tarea 4 y la 8.
