import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardView, RiskCards } from './risk-cards';

const MANO: CardView[] = [
  { id: 'c1', icon: '⚔', label: 'Infantería', territory: 'Girona' },
  { id: 'c2', icon: '⚔', label: 'Infantería', territory: 'Lleida' },
  { id: 'c3', icon: '🐎', label: 'Caballería', territory: 'Tarragona' },
  { id: 'c4', icon: '🐎', label: 'Caballería', territory: 'Barcelona' },
];

describe('RiskCards', () => {
  let fixture: ComponentFixture<RiskCards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskCards] }).compileComponents();
    fixture = TestBed.createComponent(RiskCards);
    fixture.componentRef.setInput('cards', MANO);
  });

  it('plegado sólo enseña el abanico y la cuenta', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cards-sheet')).toBeNull();
    expect(fixture.nativeElement.querySelector('.fan-count').textContent.trim()).toBe('4');
  });

  /** Tres bastan para que se lea que es un montón; el número dice cuántas. */
  it('el abanico no dibuja más de tres cartas por muchas que tengas', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.fan-card').length).toBe(3);
  });

  it('sin cartas enseña el reverso y ningún número', () => {
    fixture.componentRef.setInput('cards', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fan-card.empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.fan-count')).toBeNull();
  });

  /** El abanico ES el botón: no hay ninguna barra que aloje uno. */
  it('tocar el abanico pide abrir', () => {
    fixture.detectChanges();
    let pedido = false;
    fixture.componentInstance.toggle.subscribe(() => (pedido = true));
    fixture.nativeElement.querySelector('.cards-fan').click();
    expect(pedido).toBe(true);
  });

  it('abierto enseña la mano entera', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.cards-grid .card').length).toBe(4);
  });

  it('elegir una carta avisa con su identificador', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const elegidas: string[] = [];
    fixture.componentInstance.pick.subscribe((id) => elegidas.push(id));
    fixture.nativeElement.querySelectorAll('.cards-grid .card')[2].click();
    expect(elegidas).toEqual(['c3']);
  });

  it('las elegidas se ven elegidas', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('selected', ['c1', 'c3']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.cards-grid .card.picked').length).toBe(2);
  });

  it('no deja canjear un trío que no vale', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cards-trade').disabled).toBe(true);
  });

  it('y sí cuando vale', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('canTrade', true);
    fixture.detectChanges();
    let canjeado = false;
    fixture.componentInstance.trade.subscribe(() => (canjeado = true));
    fixture.nativeElement.querySelector('.cards-trade').click();
    expect(canjeado).toBe(true);
  });

  /**
   * Estar obligado a canjear y no enterarse deja la partida parada sin saber
   * por qué. La esquina tiene que cantarlo sin que haya que abrirla.
   */
  it('cuando el reglamento obliga a canjear, se nota sin abrir nada', () => {
    fixture.componentRef.setInput('mustTrade', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cards-fan.must-trade')).toBeTruthy();
  });
});
