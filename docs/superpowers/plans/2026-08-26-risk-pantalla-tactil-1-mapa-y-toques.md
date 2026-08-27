# RISK · Entrega 1: el mapa manda y se juega a toques

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el RISK se juegue tocando el mapa, con el mapa a pantalla completa y todo lo demás flotando encima, igual en móvil que en ordenador.

**Architecture:** El tablero (`risk-board`) aprende a distinguir toque de arrastre y a repetir mientras mantienes pulsado, pero sigue sin saber reglas: recibe un interruptor y avisa hacia fuera. La sala (`risk-room`) agrupa los toques en una sola acción antes de mandarla. La maquetación sale de `risk-room` y se reparte en cuatro componentes de presentación que se pueden montar solos en un test.

**Tech Stack:** Angular 21 sin zonas (`zoneless`), plantillas con `CommonModule`, componentes `OnPush`, tests con Vitest sobre TestBed.

**Spec:** `docs/superpowers/specs/2026-08-26-risk-pantalla-tactil-design.md`

## Global Constraints

- El motor (`src/app/games/risk/engine/**`) **no se toca** en esta entrega. Sigue siendo puro y determinista.
- Angular funciona en modo **zoneless**: toda actualización que venga de un temporizador o de una promesa necesita `ChangeDetectorRef.markForCheck()` explícito.
- En los tests, las entradas de un componente `OnPush` se ponen con `fixture.componentRef.setInput('nombre', valor)`, nunca asignando el campo.
- No se cambia el estado del componente después del primer `detectChanges()` sin `markForCheck()`: en zoneless eso da NG0100.
- Todo el texto de cara al usuario va en español con sus tildes.
- Los 1026 tests existentes tienen que seguir verdes al final de cada tarea.
- Comando de tests: `npm test`. No acepta `--run` ni `--include` (falla). Se ejecuta entero.
- Comando de compilación: `npm run build`.

---

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `ui/risk-board/risk-board.ts` (modificar) | Gestos: toque, arrastre, pulsación larga, repetición |
| `ui/risk-board/risk-board.html` (modificar) | Enganchar los gestos a cada territorio |
| `ui/risk-room/risk-room.ts` (modificar) | Agrupar toques en una acción; abrir y cerrar paneles |
| `ui/risk-hud/risk-hud.ts|html|css` (crear) | Barra superior: ronda, fase, turno, salir |
| `ui/risk-scoreboard/risk-scoreboard.ts|html|css` (crear) | Marcador compacto y plegable |
| `ui/risk-panel/risk-panel.ts|html|css` (crear) | Concha de panel flotante |
| `ui/risk-action-bar/risk-action-bar.ts|html|css` (crear) | Barra inferior: controles de fase y botones de panel |
| `ui/risk-room/risk-room.html` (modificar) | Montaje: mapa al fondo, lo demás encima |
| `ui/risk-room/risk-room.css` (modificar) | Capas, paneles acoplados y hoja inferior |

---

## Task 1: El tablero distingue un toque de un arrastre

Hoy el territorio escucha `(click)`. En un móvil, arrastrar el mapa para moverlo termina en un `click` sobre el territorio donde levantas el dedo: mueves el mapa y colocas una tropa sin querer.

**Files:**
- Modify: `src/app/games/risk/ui/risk-board/risk-board.ts`
- Modify: `src/app/games/risk/ui/risk-board/risk-board.html`
- Test: `src/app/games/risk/ui/risk-board/risk-board.spec.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `RiskBoard.TAP_MAX_MOVE: number` (8); métodos públicos `onTerritoryPointerDown(id: TerritoryId, event: PointerEvent): void` y `onTerritoryPointerUp(id: TerritoryId, event: PointerEvent): void`; el `@Output() territoryClick` existente pasa a emitirse solo en un toque de verdad.

- [ ] **Step 1: Escribir el test que falla**

En `risk-board.spec.ts`, dentro del `describe` principal, añade:

```ts
describe('toque contra arrastre', () => {
  function pointer(type: string, x: number, y: number): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  }

  it('un toque limpio avisa del territorio', () => {
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
    component.onTerritoryPointerUp('A2', pointer('pointerup', 102, 101));
    expect(emitidos).toEqual(['A2']);
  });

  it('arrastrar el mapa NO coloca nada', () => {
    // Era el fallo en móvil: mover el mapa terminaba en un clic sobre el
    // territorio donde levantabas el dedo.
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
    component.onPointerMove(pointer('pointermove', 140, 100));
    component.onTerritoryPointerUp('A2', pointer('pointerup', 140, 100));
    expect(emitidos).toEqual([]);
  });

  it('levantar el dedo en otro territorio no cuenta', () => {
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
    component.onTerritoryPointerUp('A3', pointer('pointerup', 101, 100));
    expect(emitidos).toEqual([]);
  });

  it('justo en el umbral todavía es toque', () => {
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
    component.onPointerMove(pointer('pointermove', 100 + component.TAP_MAX_MOVE, 100));
    component.onTerritoryPointerUp('A2', pointer('pointerup', 100 + component.TAP_MAX_MOVE, 100));
    expect(emitidos).toEqual(['A2']);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — `component.onTerritoryPointerDown is not a function`.

- [ ] **Step 3: Implementar en `risk-board.ts`**

Añade los campos junto a los de arrastre que ya existen y los tres métodos. Sustituye el cuerpo de `onTerritoryClick` para que ya no emita.

```ts
  /**
   * Cuánto puede moverse un dedo y seguir contando como toque, en píxeles.
   *
   * Sin este umbral, arrastrar el mapa en el móvil termina en un clic sobre el
   * territorio donde levantas el dedo: mueves el mapa y colocas una tropa sin
   * querer. Ocho píxeles es lo que tiembla una mano, no lo que se mueve un
   * gesto.
   */
  readonly TAP_MAX_MOVE = 8;

  /** Toque en curso: dónde empezó y si ya se ha ido de paseo. */
  private pendingTap: { id: TerritoryId; x: number; y: number; moved: boolean } | null = null;

  onTerritoryPointerDown(id: TerritoryId, event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.pendingTap = { id, x: event.clientX, y: event.clientY, moved: false };
  }

  onTerritoryPointerUp(id: TerritoryId, event: PointerEvent): void {
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (!tap || tap.id !== id || tap.moved) return;
    event.stopPropagation();
    this.territoryClick.emit(id);
  }

  /** Marca el toque como arrastre si se ha alejado del punto de partida. */
  private trackTapMovement(event: PointerEvent): void {
    const tap = this.pendingTap;
    if (!tap) return;
    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    if (Math.hypot(dx, dy) > this.TAP_MAX_MOVE) tap.moved = true;
  }
```

En `onPointerMove`, añade la llamada como PRIMERA línea (antes del `if (!this.dragging) return;`, que si no el seguimiento no corre cuando no se está arrastrando):

```ts
  onPointerMove(event: PointerEvent): void {
    this.trackTapMovement(event);
    if (!this.dragging) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }
```

En `onPointerUp`, olvida el toque pendiente:

```ts
  onPointerUp(): void {
    this.dragging = false;
    this.pendingTap = null;
  }
```

Y deja `onTerritoryClick` sin emitir, porque ahora manda el puntero:

```ts
  /**
   * El clic del navegador ya no coloca nada: manda `onTerritoryPointerUp`.
   *
   * Se mantiene el manejador sólo para frenar la propagación, porque el `click`
   * llega después del `pointerup` y sin pararlo el SVG lo recogería como si
   * fuera un gesto sobre el fondo.
   */
  onTerritoryClick(_id: TerritoryId, event: Event): void {
    event.stopPropagation();
  }
```

- [ ] **Step 4: Enganchar los gestos en `risk-board.html`**

En los DOS grupos que hoy tienen `(click)` (`g.territory` en la línea 61 y `g.army-badge` en la 83), añade los manejadores de puntero junto al clic que ya está:

```html
          (pointerdown)="onTerritoryPointerDown(territory.id, $event)"
          (pointerup)="onTerritoryPointerUp(territory.id, $event)"
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npm test`
Expected: PASS, y los 1026 anteriores siguen verdes.

- [ ] **Step 6: Comprobar que el test sirve**

Deshaz sólo la comprobación `tap.moved` (cambia `if (!tap || tap.id !== id || tap.moved) return;` por `if (!tap || tap.id !== id) return;`), ejecuta `npm test` y confirma que «arrastrar el mapa NO coloca nada» falla. Vuelve a dejarlo bien.

- [ ] **Step 7: Commit**

```bash
git add src/app/games/risk/ui/risk-board/
git commit -m "El tablero distingue un toque de un arrastre

En móvil, arrastrar el mapa terminaba en un clic sobre el territorio donde
levantabas el dedo: movías el mapa y colocabas una tropa sin querer. Ahora
un contacto sólo cuenta como toque si se levanta en el mismo territorio y no
se ha ido más de 8px, que es lo que tiembla una mano."
```

---

## Task 2: Mantener pulsado coloca en cadena

**Files:**
- Modify: `src/app/games/risk/ui/risk-board/risk-board.ts`
- Test: `src/app/games/risk/ui/risk-board/risk-board.spec.ts`

**Interfaces:**
- Consumes: de la Tarea 1, `pendingTap`, `onTerritoryPointerDown`, `onTerritoryPointerUp`, `TAP_MAX_MOVE`.
- Produces: `@Input() repeatOnHold: boolean` (por defecto `false`); constantes públicas `HOLD_FIRST_MS` (400), `HOLD_MIN_MS` (60), `HOLD_STEP_MS` (15), `HOLD_INFO_MS` (500). El tablero sigue sin saber reglas: quien decide si toca repetir es la sala.

- [ ] **Step 1: Escribir el test que falla**

```ts
describe('mantener pulsado', () => {
  function pointer(type: string, x: number, y: number): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('apagado, mantener pulsado no repite', () => {
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
    vi.advanceTimersByTime(3000);
    component.onTerritoryPointerUp('A2', pointer('pointerup', 10, 10));
    expect(emitidos).toEqual(['A2']);
  });

  it('encendido, la primera repetición tarda y luego se acelera', () => {
    fixture.componentRef.setInput('repeatOnHold', true);
    fixture.detectChanges();
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));

    component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
    vi.advanceTimersByTime(component.HOLD_FIRST_MS - 1);
    expect(emitidos, 'ha repetido antes de tiempo').toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitidos).toEqual(['A2']);

    vi.advanceTimersByTime(2000);
    expect(emitidos.length, 'no se acelera').toBeGreaterThan(10);
    expect(emitidos.every((id) => id === 'A2')).toBe(true);
  });

  it('soltar corta la cadena', () => {
    fixture.componentRef.setInput('repeatOnHold', true);
    fixture.detectChanges();
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
    vi.advanceTimersByTime(1000);
    const alSoltar = emitidos.length;
    component.onTerritoryPointerUp('A2', pointer('pointerup', 10, 10));
    vi.advanceTimersByTime(3000);
    // Al soltar cuenta además el toque final, y ni uno más.
    expect(emitidos.length).toBe(alSoltar + 1);
  });

  it('arrastrar corta la cadena y no cuenta el toque final', () => {
    fixture.componentRef.setInput('repeatOnHold', true);
    fixture.detectChanges();
    const emitidos: string[] = [];
    component.territoryClick.subscribe((id) => emitidos.push(id));
    component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
    vi.advanceTimersByTime(600);
    const antes = emitidos.length;
    component.onPointerMove(pointer('pointermove', 200, 10));
    vi.advanceTimersByTime(3000);
    component.onTerritoryPointerUp('A2', pointer('pointerup', 200, 10));
    expect(emitidos.length).toBe(antes);
  });
});
```

Asegúrate de que el fichero importa `afterEach` y `vi` de `vitest`.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — `component.HOLD_FIRST_MS` es `undefined` y no hay repetición.

- [ ] **Step 3: Implementar**

```ts
  /**
   * Repetir mientras se mantiene pulsado.
   *
   * Lo enciende la sala sólo en la fase de refuerzos: es el gesto de los
   * selectores de cantidad de toda la vida, y evita dar treinta toques para
   * colocar treinta tropas. El tablero no sabe qué fase es; recibe el
   * interruptor y ya está.
   */
  @Input() repeatOnHold = false;

  /** Cuánto se espera antes de empezar a repetir. */
  readonly HOLD_FIRST_MS = 400;
  /** Lo más rápido que llega a repetir. */
  readonly HOLD_MIN_MS = 60;
  /** Cuánto se recorta el intervalo en cada vuelta. */
  readonly HOLD_STEP_MS = 15;

  private repeatTimer: ReturnType<typeof setTimeout> | null = null;

  private startRepeat(id: TerritoryId): void {
    this.stopRepeat();
    let delay = 150;
    const tick = () => {
      // Si el dedo se ha ido de paseo, esto era un arrastre: se corta.
      if (!this.pendingTap || this.pendingTap.moved) return this.stopRepeat();
      this.territoryClick.emit(id);
      this.cdr.markForCheck();
      delay = Math.max(this.HOLD_MIN_MS, delay - this.HOLD_STEP_MS);
      this.repeatTimer = setTimeout(tick, delay);
    };
    this.repeatTimer = setTimeout(tick, this.HOLD_FIRST_MS);
  }

  private stopRepeat(): void {
    if (this.repeatTimer) clearTimeout(this.repeatTimer);
    this.repeatTimer = null;
  }
```

`markForCheck` hace falta porque en modo zoneless nada repinta al vencer un temporizador. Añade `ChangeDetectorRef` al constructor si el componente aún no lo tiene:

```ts
  constructor(private cdr: ChangeDetectorRef) {}
```

y añade `ChangeDetectorRef` a los imports de `@angular/core`.

Engancha la repetición en los tres sitios:

```ts
  onTerritoryPointerDown(id: TerritoryId, event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.pendingTap = { id, x: event.clientX, y: event.clientY, moved: false };
    if (this.repeatOnHold) this.startRepeat(id);
  }

  onTerritoryPointerUp(id: TerritoryId, event: PointerEvent): void {
    this.stopRepeat();
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (!tap || tap.id !== id || tap.moved) return;
    event.stopPropagation();
    this.territoryClick.emit(id);
  }

  onPointerUp(): void {
    this.stopRepeat();
    this.dragging = false;
    this.pendingTap = null;
  }
```

Y en `trackTapMovement`, corta la cadena en cuanto se pasa del umbral:

```ts
    if (Math.hypot(dx, dy) > this.TAP_MAX_MOVE) {
      tap.moved = true;
      this.stopRepeat();
    }
```

Añade `ngOnDestroy` para no dejar el temporizador vivo:

```ts
  ngOnDestroy(): void {
    this.stopRepeat();
  }
```

y declara `implements OnDestroy` importando `OnDestroy` de `@angular/core`.

- [ ] **Step 4: Pulsación larga informativa cuando no toca repetir**

En el móvil no hay ratón, así que el cartel flotante que hoy sale al pasar por
encima no sale nunca. Con la repetición apagada, mantener pulsado medio segundo
enseña ese cartel sin seleccionar nada.

Test:

```ts
it('sin repetición, mantener pulsado enseña la ficha del territorio', () => {
  // En móvil no hay ratón: sin esto, el cartel flotante no aparece jamás.
  component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
  vi.advanceTimersByTime(component.HOLD_INFO_MS);
  expect(component.hovered).toBe('A2');
  expect(component.tooltip).toBeTruthy();
});
```

Implementación:

```ts
  /** Cuánto hay que mantener el dedo para que salga la ficha informativa. */
  readonly HOLD_INFO_MS = 500;

  private infoTimer: ReturnType<typeof setTimeout> | null = null;

  private startInfo(id: TerritoryId): void {
    this.stopInfo();
    this.infoTimer = setTimeout(() => {
      if (!this.pendingTap || this.pendingTap.moved) return;
      this.onTerritoryEnter(id);
      this.cdr.markForCheck();
    }, this.HOLD_INFO_MS);
  }

  private stopInfo(): void {
    if (this.infoTimer) clearTimeout(this.infoTimer);
    this.infoTimer = null;
  }
```

En `onTerritoryPointerDown`, elige una cosa o la otra:

```ts
    if (this.repeatOnHold) this.startRepeat(id);
    else this.startInfo(id);
```

Y llama a `stopInfo()` en los mismos tres sitios donde ya llamas a `stopRepeat()`
(`onTerritoryPointerUp`, `onPointerUp`, `trackTapMovement` al pasarse del umbral)
y en `ngOnDestroy`.

- [ ] **Step 5: Ejecutar los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/games/risk/ui/risk-board/
git commit -m "Mantener pulsado coloca en cadena, y si no, informa

Un toque pone una tropa; mantener pulsado empieza a los 400 ms y va
acelerando hasta una cada 60 ms. Soltar o irse de paseo con el dedo corta la
cadena. El tablero sigue sin saber reglas: recibe un interruptor.

Cuando la repetición está apagada, mantener pulsado medio segundo enseña la
ficha del territorio. En móvil no hay ratón, así que el cartel flotante que
sale al pasar por encima no salía nunca."
```

---

## Task 3: La sala agrupa los toques en una sola acción

Doce toques no pueden ser doce escrituras en Firebase ni doce entradas de registro: online se vería a trompicones y el historial quedaría ilegible.

**Files:**
- Modify: `src/app/games/risk/ui/risk-room/risk-room.ts:362-386` (`onTerritoryClick` y la rama `reinforce` de `applyTerritoryClick`)
- Test: `src/app/games/risk/ui/risk-room/risk-room.spec.ts`

**Interfaces:**
- Consumes: de las Tareas 1 y 2, el `territoryClick` del tablero, que ahora puede llegar muchas veces seguidas.
- Produces: `RiskRoom.DEPLOY_FLUSH_MS: number` (350); getter público `reserveLeft: number`; método público `flushDeploy(): Promise<void>`. La barra de acción de la Tarea 6 lee `reserveLeft`, no `me.reserve`.

- [ ] **Step 1: Escribir el test que falla**

Sigue el montaje que ya usa `risk-room.spec.ts` para llegar a la fase de refuerzos con el turno propio. Añade:

```ts
describe('colocar a toques', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('doce toques mandan UNA acción de doce', async () => {
    // Doce acciones serían doce escrituras en Firebase y doce líneas de
    // registro: online iría a trompicones y el historial sería ilegible.
    const enviadas: unknown[] = [];
    vi.spyOn(component['game'], 'play').mockImplementation(async (a) => {
      enviadas.push(a);
    });
    for (let i = 0; i < 12; i++) component.onTerritoryClick(MI_TERRITORIO);
    expect(enviadas, 'ha mandado antes de agrupar').toEqual([]);
    vi.advanceTimersByTime(component.DEPLOY_FLUSH_MS);
    await Promise.resolve();
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0]).toMatchObject({ type: 'deploy', territoryId: MI_TERRITORIO, armies: 12 });
  });

  it('el contador baja en el momento del toque, no al mandar', () => {
    const antes = component.reserveLeft;
    component.onTerritoryClick(MI_TERRITORIO);
    expect(component.reserveLeft).toBe(antes - 1);
  });

  it('cambiar de territorio vuelca lo anterior', async () => {
    const enviadas: unknown[] = [];
    vi.spyOn(component['game'], 'play').mockImplementation(async (a) => {
      enviadas.push(a);
    });
    component.onTerritoryClick(MI_TERRITORIO);
    component.onTerritoryClick(OTRO_TERRITORIO_MIO);
    await Promise.resolve();
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0]).toMatchObject({ territoryId: MI_TERRITORIO, armies: 1 });
  });

  it('no se coloca más de lo que queda en reserva', () => {
    const reserva = component.reserveLeft;
    for (let i = 0; i < reserva + 5; i++) component.onTerritoryClick(MI_TERRITORIO);
    expect(component.reserveLeft).toBe(0);
  });
});
```

Define `MI_TERRITORIO` y `OTRO_TERRITORIO_MIO` con dos territorios del jugador local en el montaje del spec, igual que hacen los tests de refuerzos que ya existen.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — `component.DEPLOY_FLUSH_MS` es `undefined` y cada toque manda su acción.

- [ ] **Step 3: Implementar**

```ts
  /**
   * Cuánto se espera desde el último toque antes de mandar la colocación.
   *
   * Los toques se acumulan y salen en una sola acción. Doce toques serían doce
   * escrituras en Firebase y doce líneas de registro: online iría a
   * trompicones y el historial quedaría ilegible.
   */
  readonly DEPLOY_FLUSH_MS = 350;

  private pendingDeploy: { territoryId: TerritoryId; armies: number } | null = null;
  private deployFlushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Lo que queda por colocar CONTANDO lo que aún no ha salido.
   *
   * La pantalla tiene que responder al dedo aunque la escritura tarde, así que
   * el contador baja en el toque y no cuando la acción llega a la sala.
   */
  get reserveLeft(): number {
    return Math.max(0, (this.me?.reserve ?? 0) - (this.pendingDeploy?.armies ?? 0));
  }

  private queueDeploy(territoryId: TerritoryId): void {
    if (this.reserveLeft <= 0) return;
    if (this.pendingDeploy && this.pendingDeploy.territoryId !== territoryId) {
      void this.flushDeploy();
    }
    this.pendingDeploy = {
      territoryId,
      armies: (this.pendingDeploy?.armies ?? 0) + 1,
    };
    if (this.deployFlushTimer) clearTimeout(this.deployFlushTimer);
    this.deployFlushTimer = setTimeout(() => void this.flushDeploy(), this.DEPLOY_FLUSH_MS);
    this.cdr.markForCheck();
  }

  /** Manda de golpe todo lo acumulado. Se llama sola, y a mano antes de
   *  cualquier otra cosa que dependa de la reserva. */
  async flushDeploy(): Promise<void> {
    if (this.deployFlushTimer) clearTimeout(this.deployFlushTimer);
    this.deployFlushTimer = null;
    const pending = this.pendingDeploy;
    if (!pending) return;
    try {
      await this.send({
        type: 'deploy',
        playerId: this.seatId,
        territoryId: pending.territoryId,
        armies: pending.armies,
      });
    } finally {
      // Se suelta pase lo que pase: si la acción se rechaza, `send` ya deja el
      // aviso en pantalla y el contador tiene que volver a la verdad.
      this.pendingDeploy = null;
      this.cdr.markForCheck();
    }
  }
```

Cambia la rama de refuerzos de `applyTerritoryClick` para que coloque en lugar de sólo seleccionar:

```ts
    if (phase === 'reinforce') {
      if (!this.selectableTerritories.includes(id)) return;
      this.selectedFrom = id;
      this.queueDeploy(id);
      return;
    }
```

Vuelca lo pendiente antes de deshacer y antes de terminar la fase. En `undoDeploy` y en `endPhase`, como primera línea:

```ts
    await this.flushDeploy();
```

Añade `ChangeDetectorRef` al constructor si no está, y limpia el temporizador en `ngOnDestroy`:

```ts
    if (this.deployFlushTimer) clearTimeout(this.deployFlushTimer);
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/games/risk/ui/risk-room/
git commit -m "Los toques se agrupan en una sola colocación

Doce toques mandan una acción de doce, no doce acciones: si no, serían doce
escrituras en Firebase y doce líneas de registro, y online se vería a
trompicones. El contador de reserva baja en el toque, que la pantalla tiene
que responder al dedo aunque la escritura tarde."
```

---

## Task 4: La concha de los paneles flotantes

**Files:**
- Create: `src/app/games/risk/ui/risk-panel/risk-panel.ts`
- Create: `src/app/games/risk/ui/risk-panel/risk-panel.html`
- Create: `src/app/games/risk/ui/risk-panel/risk-panel.css`
- Test: `src/app/games/risk/ui/risk-panel/risk-panel.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: componente `RiskPanel`, selector `app-risk-panel`, `@Input() title: string`, `@Input() open: boolean`, `@Output() close = new EventEmitter<void>()`. El contenido va proyectado con `<ng-content>`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskPanel } from './risk-panel';

describe('RiskPanel', () => {
  let fixture: ComponentFixture<RiskPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskPanel] }).compileComponents();
    fixture = TestBed.createComponent(RiskPanel);
    fixture.componentRef.setInput('title', 'Chat');
  });

  it('cerrado no pinta nada', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.panel-shell')).toBeNull();
  });

  it('abierto enseña el título', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.panel-title').textContent.trim()).toBe('Chat');
  });

  it('el aspa avisa de que hay que cerrar', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let cerrado = false;
    fixture.componentInstance.close.subscribe(() => (cerrado = true));
    fixture.nativeElement.querySelector('.panel-close').click();
    expect(cerrado).toBe(true);
  });

  it('tocar el fondo también cierra', () => {
    // En móvil el panel tapa el mapa: tocar fuera es la salida natural.
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let cerrado = false;
    fixture.componentInstance.close.subscribe(() => (cerrado = true));
    fixture.nativeElement.querySelector('.panel-backdrop').click();
    expect(cerrado).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — no existe `./risk-panel`.

- [ ] **Step 3: Crear el componente**

`risk-panel.ts`:

```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Concha de un panel flotante sobre el mapa.
 *
 * No sabe qué lleva dentro: pone el marco, el título, el aspa y el fondo
 * oscurecido, y avisa cuando hay que cerrar. Así el chat, las cartas y la
 * historia comparten comportamiento sin repetirlo tres veces.
 */
@Component({
  selector: 'app-risk-panel',
  imports: [CommonModule],
  templateUrl: './risk-panel.html',
  styleUrl: './risk-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskPanel {
  @Input({ required: true }) title = '';
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
}
```

`risk-panel.html`:

```html
<ng-container *ngIf="open">
  <!-- El fondo sólo estorba en móvil, donde el panel tapa el mapa. En
       ordenador el CSS lo deja transparente y sin capturar toques. -->
  <div class="panel-backdrop" (click)="close.emit()"></div>
  <section class="panel-shell">
    <header class="panel-head">
      <span class="panel-title">{{ title }}</span>
      <button class="panel-close" type="button" (click)="close.emit()" aria-label="Cerrar">✕</button>
    </header>
    <div class="panel-body">
      <ng-content></ng-content>
    </div>
  </section>
</ng-container>
```

`risk-panel.css`: acoplado a la derecha por encima de 1100px, hoja inferior por debajo.

```css
.panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 30;
}

.panel-shell {
  position: absolute;
  right: 12px;
  top: 64px;
  bottom: 84px;
  width: 320px;
  display: flex;
  flex-direction: column;
  background: rgba(8, 18, 14, 0.94);
  border: 1px solid rgba(0, 255, 140, 0.25);
  border-radius: 10px;
  z-index: 31;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 255, 140, 0.18);
}

.panel-title { font-weight: 600; }

.panel-close {
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
}

@media (min-width: 1101px) {
  /* En ordenador el panel flota al lado y NO tapa el mapa: el fondo estorba. */
  .panel-backdrop { display: none; }
}

@media (max-width: 1100px) {
  /* Hoja que sube desde abajo, sin llegar a comerse el mapa entero. */
  .panel-shell {
    right: 0;
    left: 0;
    top: auto;
    bottom: 0;
    width: auto;
    max-height: 65vh;
    border-radius: 12px 12px 0 0;
  }
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/games/risk/ui/risk-panel/
git commit -m "Concha común para los paneles flotantes del mapa

Marco, título, aspa y fondo oscurecido en un solo sitio, para que el chat,
las cartas y la historia no repitan el mismo comportamiento tres veces. En
ordenador se acopla a la derecha; por debajo de 1100px sube desde abajo."
```

---

## Task 5: Marcador compacto y barra superior

**Files:**
- Create: `src/app/games/risk/ui/risk-scoreboard/risk-scoreboard.{ts,html,css}`
- Create: `src/app/games/risk/ui/risk-hud/risk-hud.{ts,html,css}`
- Test: `src/app/games/risk/ui/risk-scoreboard/risk-scoreboard.spec.ts`
- Test: `src/app/games/risk/ui/risk-hud/risk-hud.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `RiskScoreboard`, selector `app-risk-scoreboard`. `@Input() rows: ScoreRow[]`, `@Input() currentId: string`. Tipo exportado `ScoreRow = { id: string; name: string; color: string; territories: number; armies: number; eliminated: boolean }`. Estado interno `collapsed: boolean` con método `toggle(): void`.
  - `RiskHud`, selector `app-risk-hud`. `@Input() roundLabel: string`, `@Input() phaseLabel: string`, `@Input() turnLabel: string`, `@Input() myTurn: boolean`, `@Output() leave = new EventEmitter<void>()`, `@Output() settings = new EventEmitter<void>()`.

- [ ] **Step 1: Escribir los tests que fallan**

`risk-scoreboard.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskScoreboard, ScoreRow } from './risk-scoreboard';

const FILAS: ScoreRow[] = [
  { id: 'p1', name: 'Óscar', color: '#00e676', territories: 12, armies: 30, eliminated: false },
  { id: 'p2', name: 'Bot 1', color: '#ff5252', territories: 9, armies: 21, eliminated: false },
  { id: 'p3', name: 'Bot 2', color: '#40c4ff', territories: 0, armies: 0, eliminated: true },
];

describe('RiskScoreboard', () => {
  let fixture: ComponentFixture<RiskScoreboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskScoreboard] }).compileComponents();
    fixture = TestBed.createComponent(RiskScoreboard);
    fixture.componentRef.setInput('rows', FILAS);
    fixture.componentRef.setInput('currentId', 'p1');
  });

  it('pinta una línea por jugador', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.score-row').length).toBe(3);
  });

  it('marca de quién es el turno', () => {
    fixture.detectChanges();
    const marcada = fixture.nativeElement.querySelector('.score-row.current');
    expect(marcada.textContent).toContain('Óscar');
  });

  it('marca a los eliminados', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.score-row.out').length).toBe(1);
  });

  it('plegado deja sólo los colores', () => {
    // Está siempre encima del mapa: tiene que poder encogerse.
    fixture.componentInstance.collapsed = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.score-name').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.score-dot').length).toBe(3);
  });
});
```

`risk-hud.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskHud } from './risk-hud';

describe('RiskHud', () => {
  let fixture: ComponentFixture<RiskHud>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskHud] }).compileComponents();
    fixture = TestBed.createComponent(RiskHud);
    fixture.componentRef.setInput('roundLabel', 'Ronda 3');
    fixture.componentRef.setInput('phaseLabel', 'Refuerzos');
    fixture.componentRef.setInput('turnLabel', 'Turno de Óscar');
    fixture.componentRef.setInput('myTurn', true);
  });

  it('enseña ronda, fase y turno', () => {
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Ronda 3');
    expect(texto).toContain('Refuerzos');
    expect(texto).toContain('Turno de Óscar');
  });

  it('se distingue cuando te toca', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud.my-turn')).toBeTruthy();
  });

  it('salir avisa hacia fuera', () => {
    fixture.detectChanges();
    let salido = false;
    fixture.componentInstance.leave.subscribe(() => (salido = true));
    fixture.nativeElement.querySelector('.hud-leave').click();
    expect(salido).toBe(true);
  });

  it('el engranaje abre los ajustes', () => {
    // Los ajustes de IA son hoy una pestaña del panel lateral; al quitar la
    // columna necesitan puerta propia.
    fixture.detectChanges();
    let pedido = false;
    fixture.componentInstance.settings.subscribe(() => (pedido = true));
    fixture.nativeElement.querySelector('.hud-settings').click();
    expect(pedido).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `npm test`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Crear el marcador**

`risk-scoreboard.ts`:

```ts
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ScoreRow {
  id: string;
  name: string;
  color: string;
  territories: number;
  armies: number;
  eliminated: boolean;
}

/**
 * Marcador compacto, siempre encima del mapa.
 *
 * No es un panel: saber quién va ganando es información de un vistazo, no algo
 * que uno vaya a abrir y cerrar cada turno. Por eso está fijo y, si estorba, se
 * pliega a sólo colores en vez de desaparecer.
 */
@Component({
  selector: 'app-risk-scoreboard',
  imports: [CommonModule],
  templateUrl: './risk-scoreboard.html',
  styleUrl: './risk-scoreboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskScoreboard {
  @Input({ required: true }) rows: readonly ScoreRow[] = [];
  @Input() currentId = '';

  collapsed = false;

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  trackRow = (_: number, row: ScoreRow) => row.id;
}
```

`risk-scoreboard.html`:

```html
<div class="scoreboard" [class.collapsed]="collapsed">
  <button class="score-toggle" type="button" (click)="toggle()"
          [attr.aria-label]="collapsed ? 'Desplegar marcador' : 'Plegar marcador'">
    {{ collapsed ? '▸' : '▾' }}
  </button>
  <div
    class="score-row"
    *ngFor="let row of rows; trackBy: trackRow"
    [class.current]="row.id === currentId"
    [class.out]="row.eliminated"
  >
    <span class="score-dot" [style.background]="row.color"></span>
    <ng-container *ngIf="!collapsed">
      <span class="score-name">{{ row.name }}</span>
      <span class="score-num">{{ row.territories }}</span>
      <span class="score-num muted">{{ row.armies }}</span>
    </ng-container>
  </div>
</div>
```

`risk-scoreboard.css`:

```css
.scoreboard {
  position: absolute;
  top: 60px;
  left: 12px;
  z-index: 20;
  background: rgba(8, 18, 14, 0.88);
  border: 1px solid rgba(0, 255, 140, 0.22);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  min-width: 0;
}

.score-toggle {
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 0 0 4px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.score-row.current { font-weight: 700; }
.score-row.out { opacity: 0.4; text-decoration: line-through; }

.score-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.score-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

.score-num { min-width: 22px; text-align: right; }
.muted { opacity: 0.6; }
```

- [ ] **Step 4: Crear la barra superior**

`risk-hud.ts`:

```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Barra de arriba: en qué punto va la partida y cómo salir. */
@Component({
  selector: 'app-risk-hud',
  imports: [CommonModule],
  templateUrl: './risk-hud.html',
  styleUrl: './risk-hud.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskHud {
  @Input() roundLabel = '';
  @Input() phaseLabel = '';
  @Input() turnLabel = '';
  @Input() myTurn = false;
  @Output() leave = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();
}
```

`risk-hud.html`:

```html
<header class="hud" [class.my-turn]="myTurn">
  <button class="hud-leave" type="button" (click)="leave.emit()">◀ Salir</button>
  <span class="hud-round">{{ roundLabel }}</span>
  <span class="hud-phase">{{ phaseLabel }}</span>
  <span class="hud-turn">{{ turnLabel }}</span>
  <button class="hud-settings" type="button" (click)="settings.emit()" aria-label="Ajustes">⚙</button>
</header>
```

`risk-hud.css`:

```css
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: linear-gradient(rgba(4, 10, 8, 0.92), rgba(4, 10, 8, 0));
  font-size: 13px;
}

.hud.my-turn .hud-turn {
  color: #00e676;
  font-weight: 700;
}

.hud-leave {
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 4px 6px;
}

.hud-turn {
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-settings {
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  /* 44px: lo mínimo para que un dedo acierte sin pelearse. */
  min-width: 44px;
  min-height: 44px;
}
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/games/risk/ui/risk-scoreboard/ src/app/games/risk/ui/risk-hud/
git commit -m "Marcador compacto y barra superior, como piezas sueltas

El marcador no es un panel: saber quién va ganando es información de un
vistazo, así que está fijo sobre el mapa y se pliega a sólo colores si
estorba. Los dos son de presentación pura y se montan solos en un test, que
es lo que hoy no se puede hacer con risk-room."
```

---

## Task 6: La barra de acción

**Files:**
- Create: `src/app/games/risk/ui/risk-action-bar/risk-action-bar.{ts,html,css}`
- Test: `src/app/games/risk/ui/risk-action-bar/risk-action-bar.spec.ts`

**Interfaces:**
- Consumes: de la Tarea 3, el valor de `reserveLeft` llega por `@Input() reserveLeft`.
- Produces: `RiskActionBar`, selector `app-risk-action-bar`. Entradas: `phase: string`, `phaseLabel: string`, `myTurn: boolean`, `reserveLeft: number`, `placedCount: number`, `canEndPhase: boolean`, `openPanel: PanelId | null`, `cardCount: number`. Tipo exportado `PanelId = 'chat' | 'cartas' | 'historia' | 'ia'`. La barra sólo ofrece los tres primeros: los ajustes se abren desde el engranaje de la barra superior, porque se tocan una vez y no cada turno. Salidas: `togglePanel = new EventEmitter<PanelId>()`, `undo = new EventEmitter<boolean>()`, `endPhase = new EventEmitter<void>()`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskActionBar } from './risk-action-bar';

describe('RiskActionBar', () => {
  let fixture: ComponentFixture<RiskActionBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskActionBar] }).compileComponents();
    fixture = TestBed.createComponent(RiskActionBar);
    fixture.componentRef.setInput('phase', 'reinforce');
    fixture.componentRef.setInput('phaseLabel', 'Refuerzos');
    fixture.componentRef.setInput('myTurn', true);
    fixture.componentRef.setInput('reserveLeft', 5);
    fixture.componentRef.setInput('placedCount', 0);
    fixture.componentRef.setInput('canEndPhase', false);
    fixture.componentRef.setInput('cardCount', 2);
  });

  it('canta cuántas tropas quedan', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-reserve').textContent).toContain('5');
  });

  it('dice qué hacer cuando quedan tropas por colocar', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Toca');
  });

  it('sin nada colocado no ofrece deshacer', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-undo')).toBeNull();
  });

  it('con algo colocado sí', () => {
    fixture.componentRef.setInput('placedCount', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-undo')).toBeTruthy();
  });

  it('no deja terminar la fase con reserva pendiente', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-end').disabled).toBe(true);
  });

  it('los botones de panel avisan de cuál', () => {
    fixture.detectChanges();
    const pedidos: string[] = [];
    fixture.componentInstance.togglePanel.subscribe((p) => pedidos.push(p));
    fixture.nativeElement.querySelector('.bar-panel-chat').click();
    fixture.nativeElement.querySelector('.bar-panel-cartas').click();
    expect(pedidos).toEqual(['chat', 'cartas']);
  });

  it('cuando no es tu turno no se ofrecen acciones de fase', () => {
    fixture.componentRef.setInput('myTurn', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-end')).toBeNull();
    // Pero el chat y las cartas siguen a mano: mirar no es jugar.
    expect(fixture.nativeElement.querySelector('.bar-panel-chat')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — no existe `./risk-action-bar`.

- [ ] **Step 3: Implementar**

`risk-action-bar.ts`:

```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PanelId = 'chat' | 'cartas' | 'historia' | 'ia';

/**
 * Barra de abajo: lo que puedes hacer ahora mismo y cómo abrir los paneles.
 *
 * Es de presentación pura: no sabe reglas ni habla con la sala. Recibe lo que
 * hay que enseñar y avisa de lo que ha pulsado el jugador.
 */
@Component({
  selector: 'app-risk-action-bar',
  imports: [CommonModule],
  templateUrl: './risk-action-bar.html',
  styleUrl: './risk-action-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskActionBar {
  @Input() phase = '';
  @Input() phaseLabel = '';
  @Input() myTurn = false;
  @Input() reserveLeft = 0;
  @Input() placedCount = 0;
  @Input() canEndPhase = false;
  @Input() openPanel: PanelId | null = null;
  @Input() cardCount = 0;

  @Output() togglePanel = new EventEmitter<PanelId>();
  @Output() undo = new EventEmitter<boolean>();
  @Output() endPhase = new EventEmitter<void>();
}
```

`risk-action-bar.html`:

```html
<div class="bar" [class.my-turn]="myTurn">
  <ng-container *ngIf="myTurn">
    <span class="bar-phase">{{ phaseLabel }}</span>

    <ng-container *ngIf="phase === 'reinforce'">
      <span class="bar-reserve" [class.spent]="reserveLeft === 0">
        Quedan {{ reserveLeft }}
      </span>
      <span class="bar-hint" *ngIf="reserveLeft > 0">
        Toca tus territorios · mantén pulsado para varias
      </span>
      <button class="bar-undo" type="button" *ngIf="placedCount > 0" (click)="undo.emit(false)">
        ↶ Deshacer
      </button>
      <button class="bar-undo" type="button" *ngIf="placedCount > 0" (click)="undo.emit(true)">
        ↺ Empezar de cero
      </button>
    </ng-container>

    <button class="bar-end" type="button" [disabled]="!canEndPhase" (click)="endPhase.emit()">
      Terminar →
    </button>
  </ng-container>

  <!-- Mirar no es jugar: los paneles están siempre, toque o no toque. -->
  <div class="bar-panels">
    <button
      class="bar-panel bar-panel-cartas"
      type="button"
      [class.active]="openPanel === 'cartas'"
      (click)="togglePanel.emit('cartas')"
    >
      🂠 <span class="bar-badge" *ngIf="cardCount > 0">{{ cardCount }}</span>
    </button>
    <button
      class="bar-panel bar-panel-chat"
      type="button"
      [class.active]="openPanel === 'chat'"
      (click)="togglePanel.emit('chat')"
    >
      💬
    </button>
    <button
      class="bar-panel bar-panel-historia"
      type="button"
      [class.active]="openPanel === 'historia'"
      (click)="togglePanel.emit('historia')"
    >
      📜
    </button>
  </div>
</div>
```

`risk-action-bar.css`:

```css
.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 22;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(rgba(4, 10, 8, 0), rgba(4, 10, 8, 0.92) 40%);
  font-size: 13px;
}

.bar.my-turn { border-top: 1px solid rgba(0, 255, 140, 0.35); }

.bar-reserve {
  font-size: 16px;
  font-weight: 700;
  color: #00e676;
}

.bar-reserve.spent { color: inherit; opacity: 0.5; }

.bar-hint { opacity: 0.7; }

.bar-panels { margin-left: auto; display: flex; gap: 6px; }

.bar-panel {
  position: relative;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(0, 255, 140, 0.25);
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  font-size: 17px;
  /* 44px es el mínimo para que un dedo acierte sin pelearse. */
  min-width: 44px;
  min-height: 44px;
}

.bar-panel.active { border-color: #00e676; background: rgba(0, 255, 140, 0.15); }

.bar-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  font-weight: 700;
}

.bar-undo,
.bar-end {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(0, 255, 140, 0.25);
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  min-height: 40px;
  padding: 0 12px;
}

.bar-end:disabled { opacity: 0.4; cursor: default; }

@media (max-width: 640px) {
  .bar-hint { display: none; }
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/games/risk/ui/risk-action-bar/
git commit -m "Barra de acción: lo que puedes hacer ahora y los paneles

Los botones de panel miden 44px de lado, que es lo mínimo para que un dedo
acierte sin pelearse. El chat y las cartas están siempre a mano aunque no sea
tu turno: mirar no es jugar."
```

---

## Task 7: Montar la pantalla nueva

**Files:**
- Modify: `src/app/games/risk/ui/risk-room/risk-room.html:163-656` (el bloque `section.game`)
- Modify: `src/app/games/risk/ui/risk-room/risk-room.ts` (importar los componentes nuevos, exponer los datos que piden, estado del panel abierto)
- Modify: `src/app/games/risk/ui/risk-room/risk-room.css:1177-1240` (sustituir el apilado por capas)
- Test: `src/app/games/risk/ui/risk-room/risk-room.spec.ts`

**Interfaces:**
- Consumes: `RiskHud`, `RiskScoreboard` (+ `ScoreRow`), `RiskPanel`, `RiskActionBar` (+ `PanelId`), y de la Tarea 3 `reserveLeft` y `flushDeploy`.
- Produces: en `RiskRoom`, `openPanel: PanelId | null`, `togglePanel(id: PanelId): void`, getters `scoreRows: ScoreRow[]`, `repeatOnHold: boolean`, `turnLabel: string`, `currentPlayerId: string`.
- Ojo con los nombres reales, que no son los que uno supondría: salir de la sala
  es `leave()`, no `leaveRoom()`; el jugador de turno es el getter `active`
  (devuelve `PlayerState | undefined`), y de ahí salen `turnLabel` y
  `currentPlayerId`. `phaseLabel`, `placedCount`, `canEndPhase()`, `myCards`,
  `advancedTerrain`, `selectableTerritories`, `targetTerritories`, `isMyTurn`,
  `undoDeploy()` y `endPhase()` ya existen tal cual.

- [ ] **Step 1: Escribir el test que falla**

```ts
describe('pantalla nueva', () => {
  it('el mapa está siempre, y la barra y el marcador encima', () => {
    expect(fixture.nativeElement.querySelector('app-risk-board')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-risk-hud')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-risk-scoreboard')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-risk-action-bar')).toBeTruthy();
  });

  it('empieza sin ningún panel abierto: el mapa se ve entero', () => {
    expect(component.openPanel).toBeNull();
    expect(fixture.nativeElement.querySelector('.panel-shell')).toBeNull();
  });

  it('abre un panel y cierra el anterior', () => {
    // Dos paneles a la vez taparían el mapa, que es lo que se quería evitar.
    component.togglePanel('chat');
    fixture.detectChanges();
    expect(component.openPanel).toBe('chat');
    component.togglePanel('cartas');
    fixture.detectChanges();
    expect(component.openPanel).toBe('cartas');
    expect(fixture.nativeElement.querySelectorAll('.panel-shell').length).toBe(1);
  });

  it('volver a pulsar el mismo lo cierra', () => {
    component.togglePanel('chat');
    component.togglePanel('chat');
    expect(component.openPanel).toBeNull();
  });

  it('el marcador lleva una fila por jugador', () => {
    expect(component.scoreRows.length).toBe(component.state!.players.length);
    expect(component.scoreRows[0].name).toBe(component.state!.players[0].name);
  });

  it('la repetición sólo se ofrece en refuerzos y en tu turno', () => {
    expect(component.repeatOnHold).toBe(component.isMyTurn && component.state!.phase === 'reinforce');
  });

  it('el panel se cierra solo cuando llega tu turno', () => {
    // Si no, te llega el turno con el mapa tapado por el chat y no te enteras.
    component.togglePanel('chat');
    component.onMyTurnStarted();
    expect(component.openPanel).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — `component.togglePanel is not a function` y no hay `app-risk-hud`.

- [ ] **Step 3: Implementar en `risk-room.ts`**

Añade a los `imports` del decorador `RiskHud`, `RiskScoreboard`, `RiskPanel` y `RiskActionBar`, y al componente:

```ts
  /** Panel abierto, si hay alguno. Sólo uno: dos taparían el mapa. */
  openPanel: PanelId | null = null;

  togglePanel(id: PanelId): void {
    this.openPanel = this.openPanel === id ? null : id;
  }

  /** Filas del marcador, en el orden de turno. */
  get scoreRows(): ScoreRow[] {
    const state = this.state;
    if (!state) return [];
    return state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      territories: territoriesOf(state, player.id).length,
      armies: armiesOf(state, player.id),
      eliminated: player.eliminated,
    }));
  }

  /**
   * Mantener pulsado sólo coloca tropas en refuerzos y cuando te toca.
   *
   * Fuera de ahí, mantener el dedo sobre un territorio no debe hacer nada: el
   * tablero no sabe de fases, así que la decisión se toma aquí.
   */
  get repeatOnHold(): boolean {
    return this.isMyTurn && this.state?.phase === 'reinforce';
  }

  /** Quién mueve ahora, para marcarlo en el marcador. */
  get currentPlayerId(): string {
    return this.active?.id ?? '';
  }

  /** Frase de turno para la barra de arriba. */
  get turnLabel(): string {
    if (!this.active) return '';
    return this.isMyTurn ? 'Te toca' : `Turno de ${this.active.name}`;
  }

  /**
   * Al llegar tu turno se cierra el panel que estuviera abierto.
   *
   * Con el mapa tapado por el chat, el turno te llega y no te enteras.
   */
  onMyTurnStarted(): void {
    this.openPanel = null;
    this.cdr.markForCheck();
  }
```

Llama a `onMyTurnStarted()` desde donde la sala ya detecta que ha cambiado el
turno: en `recomputeSelection()`, comparando el `currentPlayerId` con el de la
vuelta anterior y disparando sólo cuando pasa a ser el tuyo.

Importa `territoriesOf` y `armiesOf` desde `../../engine/rules` (ninguno de los
dos está importado hoy en este fichero), y los tipos `PanelId` y `ScoreRow` de
los componentes nuevos.

- [ ] **Step 4: Montar la plantilla**

Sustituye el contenido de `section.game` por las capas. El mapa va primero y ocupa el hueco entero; lo demás flota encima:

```html
    <section class="game" *ngIf="inGame && state">
      <app-risk-board
        class="board-layer"
        [map]="map!"
        [state]="state"
        [selected]="selectedFrom"
        [selectable]="selectableTerritories"
        [targets]="targetTerritories"
        [myPlayerId]="seatId"
        [showTerrain]="advancedTerrain"
        [repeatOnHold]="repeatOnHold"
        (territoryClick)="onTerritoryClick($event)"
      ></app-risk-board>

      <app-risk-hud
        [roundLabel]="'Ronda ' + state.round"
        [phaseLabel]="phaseLabel"
        [turnLabel]="turnLabel"
        [myTurn]="isMyTurn"
        (leave)="leave()"
        (settings)="togglePanel('ia')"
      ></app-risk-hud>

      <app-risk-scoreboard [rows]="scoreRows" [currentId]="currentPlayerId"></app-risk-scoreboard>

      <app-risk-panel title="Chat" [open]="openPanel === 'chat'" (close)="openPanel = null">
        <!-- Contenido tal cual de risk-room.html:490-521 (el interior del
             div.panel de la pestaña 'chat', sin el div envolvente). -->
      </app-risk-panel>

      <app-risk-panel title="Cartas" [open]="openPanel === 'cartas'" (close)="openPanel = null">
        <!-- Interior de risk-room.html:534-565 -->
      </app-risk-panel>

      <app-risk-panel title="Historia" [open]="openPanel === 'historia'" (close)="openPanel = null">
        <!-- Interior de risk-room.html:524-531 (la pestaña 'eventos') -->
      </app-risk-panel>

      <app-risk-panel title="Ajustes de IA" [open]="openPanel === 'ia'" (close)="openPanel = null">
        <!-- Interior de risk-room.html:568-644 -->
      </app-risk-panel>

      <app-risk-action-bar
        [phase]="state.phase"
        [phaseLabel]="phaseLabel"
        [myTurn]="isMyTurn"
        [reserveLeft]="reserveLeft"
        [placedCount]="placedCount"
        [canEndPhase]="canEndPhase()"
        [openPanel]="openPanel"
        [cardCount]="myCards.length"
        (togglePanel)="togglePanel($event)"
        (undo)="undoDeploy($event)"
        (endPhase)="endPhase()"
      ></app-risk-action-bar>

      <p class="error floating" *ngIf="errorMessage">{{ errorMessage }}</p>
    </section>
```

El contenido se **mueve tal cual**: mismos bindings, mismos manejadores. Lo
único que desaparece es el `<aside class="side-column">` con sus pestañas
(risk-room.html:478-488 y el `</aside>` de la 646) y el campo `panel` del
componente, que lo sustituye `openPanel`.

Dos cosas que esta entrega NO hace, a propósito:

- **El chat y las cartas no se convierten todavía en componentes propios**
  (`risk-chat`, `risk-cards`). Aquí sólo se mudan de sitio. Se extraen en la
  entrega 2, cuando el chat gane el destinatario y haya algo que probar por
  separado; extraerlos ahora sería mover el mismo HTML dos veces.
- **Las hojas de ataque y reagrupar** se quedan como están, movidas dentro de
  `section.game` como capa flotante con `class="sheet-layer"`. Anclarlas junto
  al territorio objetivo es trabajo de la entrega 2.

`phaseLabel` ya existe. `turnLabel` y `currentPlayerId` los acabas de crear en el
paso anterior.

- [ ] **Step 5: Sustituir el apilado por capas en `risk-room.css`**

Reemplaza la regla `.game` y el bloque `@media (max-width: 1024px)` que hoy apila:

```css
/*
 * El mapa es el fondo y ocupa todo. Antes esto eran tres columnas y, por
 * debajo de 1024px, un scroll donde el mapa quedaba a 320px de alto y la barra
 * de acción a medio kilómetro del territorio que estabas mirando.
 */
.game {
  position: relative;
  display: block;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.board-layer {
  position: absolute;
  inset: 0;
  display: block;
}

.room {
  height: 100dvh;
  overflow: hidden;
}

.error.floating {
  position: absolute;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  z-index: 40;
  margin: 0;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(60, 0, 0, 0.9);
}
```

`100dvh` y no `100vh`: en el móvil la barra del navegador aparece y desaparece, y con `100vh` la barra de acción queda debajo del borde de la pantalla.

Borra las reglas de `.players-column`, `.side-column` y `.board-column`, y el bloque `@media (max-width: 1024px)` que las apilaba.

- [ ] **Step 6: Ejecutar los tests y compilar**

Run: `npm test`
Expected: PASS, incluidos los 1026 anteriores. Los tests viejos que buscaran `.side-column` o `.players-column` hay que reescribirlos apuntando al panel correspondiente: son los mismos datos en otro sitio.

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/games/risk/ui/
git commit -m "El mapa a pantalla completa y todo lo demás flotando encima

Antes eran tres columnas y, por debajo de 1024px, un scroll donde el mapa
quedaba a 320px de alto y la barra de acción a medio kilómetro del territorio
que estabas mirando. En un móvil no se jugaba.

Ahora el mapa ocupa el fondo entero; barra arriba, barra abajo, marcador
compacto fijo, y chat, cartas e historia como paneles flotantes de uno en uno.
La altura va en dvh y no en vh: con vh, la barra del navegador del móvil deja
la barra de acción por debajo del borde de la pantalla."
```

---

## Comprobación final de la entrega

- [ ] `npm test` — 1026 anteriores más los nuevos, todos verdes.
- [ ] `npm run build` — sin errores.
- [ ] A mano en el navegador, a 390px de ancho: se ve el mapa entero, se coloca tocando, mantener pulsado acelera, arrastrar el mapa no coloca nada, y los paneles suben desde abajo y se cierran tocando fuera.
