import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskBoard } from './risk-board';
import { WORLD_MAP } from '../../engine/maps/world.map';
import { TINY_MAP, makeGame, setBoard } from '../../engine/testing';
import { GameState } from '../../engine/types';

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

  it('emite el territorio pulsado', () => {
    let emitted: string | null = null;
    component.territoryClick.subscribe((id) => (emitted = id));
    component.onTerritoryClick('A2', new MouseEvent('click'));
    expect(emitted).toBe('A2');
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
