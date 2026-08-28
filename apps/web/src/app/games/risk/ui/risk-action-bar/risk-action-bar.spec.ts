import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskActionBar } from './risk-action-bar';

describe('RiskActionBar', () => {
  let fixture: ComponentFixture<RiskActionBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskActionBar] }).compileComponents();
    fixture = TestBed.createComponent(RiskActionBar);
    fixture.componentRef.setInput('phase', 'reinforce');
    fixture.componentRef.setInput('myTurn', true);
    fixture.componentRef.setInput('placedCount', 0);
  });

  /**
   * La reserva y el «terminar fase» se han mudado al bloque de fase: la fase es
   * el control que la cierra. Que no reaparezcan aquí importa, porque dos
   * cuentas de tropas en pantalla a la vez era de donde venía la sensación de
   * «parece que siempre te queda una».
   */
  it('ya no lleva ni la cuenta de la reserva ni el terminar', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-reserve')).toBeNull();
    expect(fixture.nativeElement.querySelector('.bar-end')).toBeNull();
  });

  it('sin nada colocado no ofrece deshacer', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-undo')).toBeNull();
  });

  it('con algo colocado sí, y avisa hacia fuera', () => {
    fixture.componentRef.setInput('placedCount', 3);
    fixture.detectChanges();
    let pedido = false;
    fixture.componentInstance.undo.subscribe(() => (pedido = true));
    fixture.nativeElement.querySelector('.bar-undo').click();
    expect(pedido).toBe(true);
  });

  it('fuera de refuerzos no ofrece deshacer', () => {
    fixture.componentRef.setInput('phase', 'attack');
    fixture.componentRef.setInput('placedCount', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-undo')).toBeNull();
  });

  it('los botones de panel avisan de cuál', () => {
    fixture.detectChanges();
    const pedidos: string[] = [];
    fixture.componentInstance.togglePanel.subscribe((p) => pedidos.push(p));
    fixture.nativeElement.querySelector('.bar-panel-chat').click();
    fixture.nativeElement.querySelector('.bar-panel-historia').click();
    expect(pedidos).toEqual(['chat', 'historia']);
  });

  it('el panel abierto se ve marcado', () => {
    fixture.componentRef.setInput('openPanel', 'chat');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-panel-chat.active')).toBeTruthy();
  });

  it('cuando no es tu turno los paneles siguen a mano: mirar no es jugar', () => {
    fixture.componentRef.setInput('myTurn', false);
    fixture.componentRef.setInput('placedCount', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-undo')).toBeNull();
    expect(fixture.nativeElement.querySelector('.bar-panel-chat')).toBeTruthy();
  });
});
