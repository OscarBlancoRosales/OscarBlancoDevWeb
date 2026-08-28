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

  it('enseña territorios y ejércitos', () => {
    fixture.detectChanges();
    const primera = fixture.nativeElement.querySelector('.score-row').textContent;
    expect(primera).toContain('12');
    expect(primera).toContain('30');
  });

  it('plegado deja sólo los colores', () => {
    // Está siempre encima del mapa: tiene que poder encogerse sin desaparecer.
    fixture.detectChanges();
    // Por el botón, no llamando a `toggle()` a pelo: en OnPush una asignación
    // suelta no repinta, y el test estaría probando algo que el usuario no hace.
    fixture.nativeElement.querySelector('.score-toggle').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.score-name').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.score-dot').length).toBe(3);
  });

  it('se pliega y se despliega con el mismo botón', () => {
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('.score-toggle');
    boton.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed).toBe(true);
    boton.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.score-name').length).toBe(3);
  });
});
