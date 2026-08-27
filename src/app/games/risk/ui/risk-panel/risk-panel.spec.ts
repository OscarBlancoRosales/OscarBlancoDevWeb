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

  it('el contenido de dentro se pinta tal cual', () => {
    // La concha no sabe qué lleva: chat, cartas o historia son lo mismo aquí.
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.panel-body')).toBeTruthy();
  });
});
