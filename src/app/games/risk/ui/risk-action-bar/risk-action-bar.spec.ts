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

  it('dice qué hacer mientras quedan tropas', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Toca');
  });

  it('cuando no queda nada deja de dar instrucciones', () => {
    fixture.componentRef.setInput('reserveLeft', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-hint')).toBeNull();
  });

  it('sin nada colocado no ofrece deshacer', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-undo')).toBeNull();
  });

  it('con algo colocado sí, y distingue deshacer de empezar de cero', () => {
    fixture.componentRef.setInput('placedCount', 3);
    fixture.detectChanges();
    const pedidos: boolean[] = [];
    fixture.componentInstance.undo.subscribe((todo) => pedidos.push(todo));
    const botones = fixture.nativeElement.querySelectorAll('.bar-undo');
    expect(botones.length).toBe(2);
    botones[0].click();
    botones[1].click();
    expect(pedidos).toEqual([false, true]);
  });

  it('no deja terminar la fase con reserva pendiente', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-end').disabled).toBe(true);
  });

  it('y sí cuando ya se puede', () => {
    fixture.componentRef.setInput('canEndPhase', true);
    fixture.detectChanges();
    let terminado = false;
    fixture.componentInstance.endPhase.subscribe(() => (terminado = true));
    fixture.nativeElement.querySelector('.bar-end').click();
    expect(terminado).toBe(true);
  });

  it('los botones de panel avisan de cuál', () => {
    fixture.detectChanges();
    const pedidos: string[] = [];
    fixture.componentInstance.togglePanel.subscribe((p) => pedidos.push(p));
    fixture.nativeElement.querySelector('.bar-panel-chat').click();
    fixture.nativeElement.querySelector('.bar-panel-cartas').click();
    fixture.nativeElement.querySelector('.bar-panel-historia').click();
    expect(pedidos).toEqual(['chat', 'cartas', 'historia']);
  });

  it('el panel abierto se ve marcado', () => {
    fixture.componentRef.setInput('openPanel', 'chat');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-panel-chat.active')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bar-panel-cartas.active')).toBeNull();
  });

  it('las cartas llevan la cuenta encima', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-badge').textContent.trim()).toBe('2');
  });

  it('cuando no es tu turno no se ofrecen acciones de fase', () => {
    fixture.componentRef.setInput('myTurn', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-end')).toBeNull();
    // Pero el chat y las cartas siguen a mano: mirar no es jugar.
    expect(fixture.nativeElement.querySelector('.bar-panel-chat')).toBeTruthy();
  });

  it('fuera de refuerzos no habla de reserva', () => {
    fixture.componentRef.setInput('phase', 'attack');
    fixture.componentRef.setInput('phaseLabel', 'Ataque');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar-reserve')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Ataque');
  });
});
