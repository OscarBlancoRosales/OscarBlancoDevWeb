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

  it('salir avisa hacia fuera', () => {
    fixture.detectChanges();
    let salido = false;
    fixture.componentInstance.leave.subscribe(() => (salido = true));
    fixture.nativeElement.querySelector('.hud-leave').click();
    expect(salido).toBe(true);
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
