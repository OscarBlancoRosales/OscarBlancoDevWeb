import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskBoard } from './risk-board';
import { WORLD_MAP } from '@devweb/shared/engine/maps/world.map';
import { TINY_MAP, makeGame, setBoard } from '@devweb/shared/engine/testing';
import { GameState } from '@devweb/shared/engine/types';

describe('RiskBoard', () => {
  let fixture: ComponentFixture<RiskBoard>;
  let component: RiskBoard;
  let state: GameState;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskBoard] }).compileComponents();
    fixture = TestBed.createComponent(RiskBoard);
    component = fixture.componentInstance;
    state = setBoard(makeGame(), {
      A1: ['p1', 5],
      A2: ['p1', 2],
      A3: ['p1', 1],
      B1: ['p2', 3],
      B2: ['p2', 1],
      B3: ['p2', 4],
    });
    component.map = TINY_MAP;
    component.state = state;
    component.myPlayerId = 'p1';
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('prepara el dibujo del mapa recibido', () => {
    expect(component.rendered?.territories).toHaveLength(TINY_MAP.territories.length);
  });

  it('pinta un grupo por territorio', () => {
    const groups = fixture.nativeElement.querySelectorAll('g.territory');
    expect(groups.length).toBe(TINY_MAP.territories.length);
  });

  it('pinta la ficha con el número de ejércitos', () => {
    const texts = Array.from(
      fixture.nativeElement.querySelectorAll('text.badge-text') as NodeListOf<Element>,
    ).map((el) => el.textContent?.trim());
    expect(texts).toContain('5');
    expect(texts).toContain('4');
  });

  it('usa el color del dueño', () => {
    expect(component.ownerColorOf('A1')).toBe(state.players.find((p) => p.id === 'p1')!.color);
  });

  it('usa un gris para los territorios sin dueño', () => {
    component.state = { ...state, territories: { ...state.territories, A1: { ownerId: null, armies: 0 } } };
    expect(component.ownerColorOf('A1')).toBe('#2a2f35');
  });

  it('sabe qué territorios son míos', () => {
    expect(component.isMine('A1')).toBe(true);
    expect(component.isMine('B1')).toBe(false);
  });

  it('marca seleccionables y objetivos', () => {
    component.selectable = ['A1'];
    component.targets = ['B1'];
    expect(component.isSelectable('A1')).toBe(true);
    expect(component.isTarget('B1')).toBe(true);
    expect(component.classesFor(component.rendered!.byId['A1'])['selectable']).toBe(true);
    expect(component.classesFor(component.rendered!.byId['B2'])['dimmed']).toBe(true);
  });

  describe('toque contra arrastre', () => {
    function pointer(type: string, x: number, y: number): PointerEvent {
      return new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
    }

    function escuchar(): string[] {
      const emitidos: string[] = [];
      component.territoryClick.subscribe((id) => emitidos.push(id));
      return emitidos;
    }

    it('un toque limpio avisa del territorio', () => {
      const emitidos = escuchar();
      component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
      component.onTerritoryPointerUp('A2', pointer('pointerup', 102, 101));
      expect(emitidos).toEqual(['A2']);
    });

    it('arrastrar el mapa NO coloca nada', () => {
      // Era el fallo en móvil: mover el mapa terminaba en un clic sobre el
      // territorio donde levantabas el dedo, y te colocaba una tropa.
      const emitidos = escuchar();
      component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
      component.onPointerMove(pointer('pointermove', 140, 100));
      component.onTerritoryPointerUp('A2', pointer('pointerup', 140, 100));
      expect(emitidos).toEqual([]);
    });

    it('levantar el dedo en otro territorio no cuenta', () => {
      const emitidos = escuchar();
      component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
      component.onTerritoryPointerUp('A3', pointer('pointerup', 101, 100));
      expect(emitidos).toEqual([]);
    });

    it('justo en el umbral todavía es toque', () => {
      const emitidos = escuchar();
      component.onTerritoryPointerDown('A2', pointer('pointerdown', 100, 100));
      component.onPointerMove(pointer('pointermove', 100 + component.TAP_MAX_MOVE, 100));
      component.onTerritoryPointerUp('A2', pointer('pointerup', 100 + component.TAP_MAX_MOVE, 100));
      expect(emitidos).toEqual(['A2']);
    });

    describe('mantener pulsado', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('apagado, mantener pulsado no repite', () => {
        const emitidos = escuchar();
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        vi.advanceTimersByTime(3000);
        component.onTerritoryPointerUp('A2', pointer('pointerup', 10, 10));
        expect(emitidos).toEqual(['A2']);
      });

      it('encendido, la primera repetición tarda y luego se acelera', () => {
        fixture.componentRef.setInput('repeatOnHold', true);
        const emitidos = escuchar();

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
        const emitidos = escuchar();
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        vi.advanceTimersByTime(1000);
        const alSoltar = emitidos.length;
        component.onTerritoryPointerUp('A2', pointer('pointerup', 10, 10));
        vi.advanceTimersByTime(3000);
        // Al soltar cuenta además el toque final, y ni uno más.
        expect(emitidos.length).toBe(alSoltar + 1);
      });

      it('irse de paseo con el dedo corta la cadena y no cuenta el toque final', () => {
        fixture.componentRef.setInput('repeatOnHold', true);
        const emitidos = escuchar();
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        vi.advanceTimersByTime(600);
        const antes = emitidos.length;
        expect(antes, 'no había empezado a repetir').toBeGreaterThan(0);
        component.onPointerMove(pointer('pointermove', 200, 10));
        vi.advanceTimersByTime(3000);
        component.onTerritoryPointerUp('A2', pointer('pointerup', 200, 10));
        expect(emitidos.length).toBe(antes);
      });

      it('sin repetición, mantener pulsado enseña la ficha del territorio', () => {
        // En el móvil no hay ratón: sin esto, el cartel flotante que sale al
        // pasar por encima no aparece jamás.
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        vi.advanceTimersByTime(component.HOLD_INFO_MS);
        expect(component.hovered).toBe('A2');
        expect(component.tooltip).toBeTruthy();
      });

      it('con repetición encendida no sale la ficha: estás colocando', () => {
        fixture.componentRef.setInput('repeatOnHold', true);
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        vi.advanceTimersByTime(component.HOLD_INFO_MS);
        expect(component.hovered).toBeNull();
      });
    });

    it('el gesto llega DESDE EL DOM, no sólo llamando a los métodos', () => {
      // Los demás tests de este bloque llaman a los manejadores a mano, así que
      // prueban la lógica pero no el cableado. Éste lanza eventos de puntero
      // de verdad sobre el SVG dibujado: si el enganche de la plantilla se
      // rompe, el juego deja de responder al dedo y sólo se entera aquí.
      const emitidos = escuchar();
      const grupo = fixture.nativeElement.querySelector('g.territory') as SVGGElement;
      expect(grupo, 'no hay territorios dibujados').toBeTruthy();

      const opciones = { bubbles: true, clientX: 50, clientY: 50, button: 0 };
      grupo.dispatchEvent(new PointerEvent('pointerdown', opciones));
      grupo.dispatchEvent(new PointerEvent('pointerup', opciones));

      expect(emitidos).toHaveLength(1);
    });

    describe('el clic como respaldo', () => {
      it('si el gesto de puntero no llegó, el clic coloca igual', () => {
        // En el navegador de verdad hubo casos en que el `pointerup` no llegaba
        // al grupo del SVG y el mapa se quedaba mudo. El clic cierra ese hueco.
        const emitidos = escuchar();
        component.onTerritoryClick('A2', new MouseEvent('click'));
        expect(emitidos).toEqual(['A2']);
      });

      it('pero no duplica cuando el gesto ya ha colocado', () => {
        const emitidos = escuchar();
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        component.onTerritoryPointerUp('A2', pointer('pointerup', 10, 10));
        component.onTerritoryClick('A2', new MouseEvent('click'));
        expect(emitidos).toEqual(['A2']);
      });

      it('y sigue sin colar un arrastre', () => {
        // Lo importante: el respaldo no puede resucitar el fallo del móvil.
        const emitidos = escuchar();
        component.onTerritoryPointerDown('A2', pointer('pointerdown', 10, 10));
        component.onPointerMove(pointer('pointermove', 200, 10));
        component.onTerritoryPointerUp('A2', pointer('pointerup', 200, 10));
        component.onTerritoryClick('A2', new MouseEvent('click'));
        expect(emitidos).toEqual([]);
      });

      it('dos clics seguidos colocan dos', () => {
        const emitidos = escuchar();
        component.onTerritoryClick('A2', new MouseEvent('click'));
        component.onTerritoryClick('A2', new MouseEvent('click'));
        expect(emitidos).toEqual(['A2', 'A2']);
      });
    });
  });

  describe('cartel flotante', () => {
    it('empieza oculto', () => {
      expect(component.tooltip).toBeNull();
    });

    it('aparece al pasar por encima', () => {
      component.onTerritoryEnter('B3');
      expect(component.tooltip?.name).toBe('Territorio B3');
      expect(component.tooltip?.armies).toBe(4);
    });

    it('desaparece al salir', () => {
      component.onTerritoryEnter('B3');
      component.onTerritoryLeave();
      expect(component.tooltip).toBeNull();
    });

    it('mantiene la misma instancia mientras no cambie el hover', () => {
      component.onTerritoryEnter('B3');
      const first = component.tooltip;
      component.onTerritoryEnter('B3');
      expect(component.tooltip).toBe(first);
    });

    it('incluye las probabilidades cuando se apunta a un objetivo', () => {
      component.selected = 'A1';
      component.targets = ['B1'];
      component.onTerritoryEnter('B1');
      expect(component.tooltip?.odds).toBeGreaterThan(0);
      expect(component.tooltip?.odds).toBeLessThan(1);
    });

    it('no calcula probabilidades sin origen seleccionado', () => {
      component.onTerritoryEnter('B1');
      expect(component.tooltip?.odds).toBeNull();
    });

    it('se actualiza cuando cambia el estado', () => {
      component.onTerritoryEnter('B3');
      expect(component.tooltip?.armies).toBe(4);
      component.state = setBoard(state, { B3: ['p2', 9] });
      expect(component.tooltip?.armies).toBe(9);
    });
  });

  describe('orografía', () => {
    /** Un mapa igual que el de laboratorio, pero con terreno declarado. */
    function terrainMap() {
      return {
        ...TINY_MAP,
        id: 'tiny-board-terrain',
        seaRoutes: [['A1', 'B3']] as Array<[string, string]>,
        territories: TINY_MAP.territories.map((territory) => ({
          ...territory,
          terrain:
            territory.id === 'A2'
              ? ('montaña' as const)
              : territory.id === 'B1'
                ? ('llanura' as const)
                : ('bosque' as const),
          adjacent:
            territory.id === 'A1'
              ? [...territory.adjacent, 'B3']
              : territory.id === 'B3'
                ? [...territory.adjacent, 'A1']
                : territory.adjacent,
        })),
      };
    }

    it('sin modo avanzado no marca ningún terreno', () => {
      // setInput marca la vista como sucia: el tablero es OnPush.
      fixture.componentRef.setInput('map', terrainMap());
      fixture.detectChanges();
      expect(component.showTerrain).toBe(false);
      expect(fixture.nativeElement.querySelectorAll('.badge-terrain').length).toBe(0);
    });

    it('con modo avanzado marca cada territorio con terreno', () => {
      fixture.componentRef.setInput('map', terrainMap());
      fixture.componentRef.setInput('showTerrain', true);
      fixture.detectChanges();
      const drawn = fixture.nativeElement.querySelectorAll('.badge-terrain');
      // Los seis territorios menos B1, que es llanura y no se marca.
      expect(drawn.length).toBe(5);
    });

    it('la llanura no lleva glifo', () => {
      component.map = terrainMap();
      component.showTerrain = true;
      const rendered = component.rendered!.byId['B1'];
      expect(component.terrainGlyphOf(rendered)).toBeNull();
    });

    it('cada terreno tiene su glifo y su color', () => {
      component.map = terrainMap();
      component.showTerrain = true;
      expect(component.terrainGlyphOf(component.rendered!.byId['A2'])).toBe('▲');
      expect(component.terrainGlyphOf(component.rendered!.byId['A3'])).toBe('♣');
      expect(component.terrainTintOf(component.rendered!.byId['A2'])).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('el tablero no rellena siluetas con patrones SVG', () => {
      // Rellenar 42 contornos de país con un patrón deja el navegador clavado
      // varios segundos. Si alguien lo reintroduce, que salte aquí.
      fixture.componentRef.setInput('map', terrainMap());
      fixture.componentRef.setInput('showTerrain', true);
      fixture.detectChanges();
      const html: string = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('url(#terr-');
    });

    it('el cartel flotante explica el terreno solo en modo avanzado', () => {
      component.map = terrainMap();
      component.state = state;
      component.onTerritoryEnter('A2');
      expect(component.tooltip?.terrain).toBeNull();

      component.showTerrain = true;
      expect(component.tooltip?.terrain?.name).toBe('Montaña');
      expect(component.tooltip?.terrain?.defence.length).toBeGreaterThan(10);
    });

    it('avisa del desembarco al apuntar cruzando el mar', () => {
      component.map = terrainMap();
      component.state = state;
      component.showTerrain = true;
      component.selected = 'A1';
      component.targets = ['B3', 'B1'];

      component.onTerritoryEnter('B3');
      expect(component.tooltip?.approach).toBe('desembarco');

      component.onTerritoryEnter('B1');
      expect(component.tooltip?.approach).toBe('tierra');
    });

    it('no habla de desembarco si no se está apuntando a nada', () => {
      component.map = terrainMap();
      component.state = state;
      component.showTerrain = true;
      component.onTerritoryEnter('B3');
      expect(component.tooltip?.approach).toBeNull();
    });

    it('la probabilidad que enseña cuenta las DOS mitades del terreno', () => {
      // A1 es bosque y A2 es montaña: salir de un bosque (+1 al mejor del
      // atacante) cancela la altura de la montaña (+1 al mejor del defensor).
      // Ese empate es justo lo que se quiere comprobar: el terreno ya no es un
      // impuesto que solo paga el atacante.
      const map = terrainMap();
      const advanced = { ...state, config: { ...state.config, advancedTerrain: true } };
      component.map = map;
      component.selected = 'A1';
      component.targets = ['A2'];

      component.state = state;
      component.onTerritoryEnter('A2');
      const classic = component.tooltip!.odds!;

      component.state = advanced;
      component.showTerrain = true;
      component.onTerritoryEnter('A2');
      expect(component.tooltip!.odds!).toBeCloseTo(classic, 10);
    });

    it('desde una llanura, la montaña sí frena', () => {
      // B1 es llanura y no aporta nada al atacante, así que la altura de A2
      // pesa entera.
      const map = terrainMap();
      const advanced = { ...state, config: { ...state.config, advancedTerrain: true } };
      component.map = map;
      component.selected = 'B1';
      component.targets = ['A2'];

      component.state = state;
      component.onTerritoryEnter('A2');
      const classic = component.tooltip!.odds!;

      component.state = advanced;
      component.showTerrain = true;
      component.onTerritoryEnter('A2');
      expect(component.tooltip!.odds!).toBeLessThan(classic);
    });

    it('el cartel desglosa el enfrentamiento en palabras', () => {
      const advanced = { ...state, config: { ...state.config, advancedTerrain: true } };
      component.map = terrainMap();
      component.state = advanced;
      component.showTerrain = true;
      component.selected = 'B1';
      component.targets = ['A2'];
      component.onTerritoryEnter('A2');
      expect(component.tooltip!.matchup.join(' ')).toContain('A su favor');
    });

    it('marca todos los terrenos menos la llanura', () => {
      expect(component.markedTerrains.map((meta) => meta.id)).toEqual([
        'bosque',
        'montaña',
        'desierto',
        'costa',
      ]);
    });
  });

  describe('tropas especializadas', () => {
    function advancedState() {
      const advanced: GameState = {
        ...state,
        config: { ...state.config, advancedUnits: true },
        territories: {
          ...state.territories,
          A1: { ownerId: 'p1', armies: 5, units: { blindado: 1, aereo: 1 } },
          B1: { ownerId: 'p2', armies: 3, units: { naval: 2 } },
        },
      };
      return advanced;
    }

    it('sin modo avanzado no dibuja tropas', () => {
      fixture.componentRef.setInput('state', advancedState());
      component.state = { ...advancedState(), config: { ...state.config, advancedUnits: false } };
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.badge-unit').length).toBe(0);
    });

    it('dibuja un glifo por ficha especializada', () => {
      fixture.componentRef.setInput('state', advancedState());
      fixture.detectChanges();
      // 1 blindado + 1 aéreo en A1, 2 navales en B1.
      expect(fixture.nativeElement.querySelectorAll('.badge-unit').length).toBe(4);
    });

    it('las tropas de un territorio salen en el orden del catálogo', () => {
      component.state = advancedState();
      expect(component.unitsOf('A1').map((u) => u.id)).toEqual(['blindado', 'aereo']);
      expect(component.unitsOf('B1').map((u) => u.id)).toEqual(['naval', 'naval']);
      expect(component.unitsOf('A2')).toEqual([]);
    });

    it('reutiliza el mismo array si el territorio no cambia', () => {
      // Si devolviera uno nuevo en cada ciclo, la vista quedaría siempre sucia.
      component.state = advancedState();
      const first = component.unitsOf('A1');
      component.state = { ...advancedState() };
      expect(component.unitsOf('A1')).toBe(first);
    });

    it('un territorio sin tropas siempre devuelve el mismo array vacío', () => {
      component.state = advancedState();
      expect(component.unitsOf('A3')).toBe(component.unitsOf('A2'));
    });

    it('rehace el array cuando cambian las tropas', () => {
      component.state = advancedState();
      const first = component.unitsOf('A1');
      const changed = advancedState();
      changed.territories = {
        ...changed.territories,
        A1: { ownerId: 'p1', armies: 5, units: { blindado: 2, aereo: 1 } },
      };
      component.state = changed;
      expect(component.unitsOf('A1')).not.toBe(first);
      expect(component.unitsOf('A1')).toHaveLength(3);
    });

    it('los glifos se reparten centrados sobre la ficha', () => {
      expect(component.unitOffsetX(0, 1)).toBe(0);
      expect(component.unitOffsetX(0, 2)).toBe(-component.unitOffsetX(1, 2));
      expect(component.unitOffsetX(1, 3)).toBe(0);
    });
  });

  describe('vista', () => {
    it('empieza centrada y sin zoom', () => {
      expect(component.zoom).toBe(1);
      expect(component.transform).toBe('translate(0 0) scale(1)');
    });

    it('acerca y aleja dentro de unos límites', () => {
      for (let i = 0; i < 30; i++) component.zoomIn();
      expect(component.zoom).toBeLessThanOrEqual(4);
      for (let i = 0; i < 60; i++) component.zoomOut();
      expect(component.zoom).toBeGreaterThanOrEqual(0.6);
    });

    it('vuelve al centro', () => {
      component.zoomIn();
      component.panX = 120;
      component.resetView();
      expect(component.zoom).toBe(1);
      expect(component.panX).toBe(0);
    });

    it('arrastra el mapa', () => {
      component.onPointerDown({ button: 0, pointerType: 'mouse', clientX: 0, clientY: 0 } as PointerEvent);
      component.onPointerMove({ clientX: 40, clientY: 25 } as PointerEvent);
      expect(component.panX).toBe(40);
      expect(component.panY).toBe(25);
      component.onPointerUp();
      component.onPointerMove({ clientX: 200, clientY: 200 } as PointerEvent);
      expect(component.panX).toBe(40);
    });

    it('cambiar de mapa recentra la vista', () => {
      component.zoomIn();
      component.map = WORLD_MAP;
      expect(component.zoom).toBe(1);
      expect(component.rendered?.mapId).toBe('world');
    });
  });

  it('funciona sin estado (vista previa vacía)', () => {
    component.state = null;
    fixture.detectChanges();
    expect(component.armiesOf('A1')).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('g.territory').length).toBe(6);
  });

  it('dibuja las rutas marítimas del mapa del mundo', () => {
    // setInput marca la vista como sucia: el tablero es OnPush.
    fixture.componentRef.setInput('map', WORLD_MAP);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('path.route').length).toBeGreaterThan(0);
  });

  it('vuelve a pintar cuando cambian los territorios seleccionables', () => {
    fixture.componentRef.setInput('selectable', ['A1']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('g.territory.selectable').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('g.territory.dimmed').length).toBe(5);
  });
});
