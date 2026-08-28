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

  it('y cuando no', () => {
    fixture.componentRef.setInput('myTurn', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud.my-turn')).toBeNull();
  });

  it('avisa de quién está pensando', () => {
    // Sin esto, un bot que tarda parece una partida colgada.
    fixture.componentRef.setInput('thinking', 'Bot 1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud-thinking').textContent).toContain('Bot 1');
  });

  it('y no dice nada cuando no piensa nadie', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hud-thinking')).toBeNull();
  });

  it('salir avisa hacia fuera', () => {
    fixture.detectChanges();
    let salido = false;
    fixture.componentInstance.leave.subscribe(() => (salido = true));
    fixture.nativeElement.querySelector('.hud-leave').click();
    expect(salido).toBe(true);
  });

  /**
   * La fase es también el control que la termina.
   *
   * No hay ningún botón «Terminar» viviendo en una esquina propia: lo que te
   * dice en qué fase estás es lo que la cierra. Así no hace falta una barra
   * abajo para alojar la acción más frecuente del turno.
   */
  describe('terminar la fase', () => {
    it('mientras no se puede, la fase es sólo texto', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button.hud-phase')).toBeNull();
      expect(fixture.nativeElement.querySelector('.hud-phase').textContent).toContain('Refuerzos');
    });

    it('cuando se puede, la propia fase se vuelve pulsable', () => {
      fixture.componentRef.setInput('canEndPhase', true);
      fixture.detectChanges();
      const boton = fixture.nativeElement.querySelector('button.hud-phase');
      expect(boton.textContent).toContain('Refuerzos');
      expect(boton.textContent).toContain('Terminar');
      let terminado = false;
      fixture.componentInstance.endPhase.subscribe(() => (terminado = true));
      boton.click();
      expect(terminado).toBe(true);
    });

    it('no ofrece terminar cuando no es tu turno', () => {
      fixture.componentRef.setInput('canEndPhase', true);
      fixture.componentRef.setInput('myTurn', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button.hud-phase')).toBeNull();
    });
  });

  describe('la reserva y el volver a empezar', () => {
    it('canta cuántas tropas quedan', () => {
      fixture.componentRef.setInput('reserveLeft', 3);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.hud-reserve').textContent).toContain('3');
    });

    it('y calla cuando no queda ninguna', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.hud-reserve')).toBeNull();
    });

    /**
     * Deshacer una tropa suelta NO vive aquí: es el `−` que sale junto al
     * territorio. Aquí sólo está el «empezar de cero», que se usa una vez cada
     * muchas partidas y no merece más sitio que un icono.
     */
    it('sin nada colocado no ofrece empezar de cero', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.hud-reset')).toBeNull();
    });

    it('con algo colocado sí, y avisa hacia fuera', () => {
      fixture.componentRef.setInput('placedCount', 2);
      fixture.detectChanges();
      let pedido = false;
      fixture.componentInstance.resetPlacements.subscribe(() => (pedido = true));
      fixture.nativeElement.querySelector('.hud-reset').click();
      expect(pedido).toBe(true);
    });
  });

  it('el engranaje abre los ajustes', () => {
    // Los ajustes de IA eran una pestaña del panel lateral; al quitar la
    // columna necesitan puerta propia.
    fixture.detectChanges();
    let pedido = false;
    fixture.componentInstance.settings.subscribe(() => (pedido = true));
    fixture.nativeElement.querySelector('.hud-settings').click();
    expect(pedido).toBe(true);
  });
});
