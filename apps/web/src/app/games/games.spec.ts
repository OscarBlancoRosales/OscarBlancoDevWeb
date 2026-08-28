import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Games } from './games';
import { RISK_MAPS } from '@devweb/shared/engine/maps/map-registry';

describe('Games (portada de juegos)', () => {
  let fixture: ComponentFixture<Games>;
  let component: Games;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Games],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Games);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('lista al menos un juego jugable', () => {
    expect(component.games.some((game) => game.status === 'listo')).toBe(true);
  });

  it('el RISK aparece como jugable y apunta a su sala', () => {
    const risk = component.games.find((game) => game.id === 'risk')!;
    expect(risk.status).toBe('listo');
    expect(risk.route).toBe('/juegos/risk');
  });

  it('la flota aparece como jugable y apunta a su lobby', () => {
    const flota = component.games.find((game) => game.id === 'hundir-la-flota');
    expect(flota?.status).toBe('listo');
    expect(flota?.route).toBe('/juegos/flota');
  });

  it('la flota anuncia el rival contra el que se juega', () => {
    const flota = component.games.find((game) => game.id === 'hundir-la-flota');
    expect(flota?.highlights.some((item) => item.toLowerCase().includes('bot'))).toBe(true);
  });

  it('el trivial aparece como jugable y apunta a su lobby', () => {
    const trivial = component.games.find((game) => game.id === 'trivial');
    expect(trivial?.status).toBe('listo');
    expect(trivial?.route).toBe('/juegos/trivial');
  });

  it('el trivial anuncia que las respuestas no estan en el navegador', () => {
    const trivial = component.games.find((game) => game.id === 'trivial');
    expect(
      trivial?.highlights.some((item) => item.toLowerCase().includes('servidor')),
    ).toBe(true);
  });

  it('anuncia los mapas disponibles de verdad', () => {
    const risk = component.games.find((game) => game.id === 'risk')!;
    expect(risk.highlights.some((item) => item.includes(String(RISK_MAPS.length)))).toBe(true);
  });

  it('pinta una tarjeta por juego', () => {
    expect(fixture.nativeElement.querySelectorAll('article.game-card').length).toBe(
      component.games.length,
    );
  });

  it('los juegos en obras tienen el botón desactivado', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button.card-action') as NodeListOf<HTMLButtonElement>,
    );
    const disabled = buttons.filter((button) => button.disabled).length;
    expect(disabled).toBe(component.games.filter((game) => !game.route).length);
  });

  it('navega al pulsar un juego disponible', () => {
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.open(component.games.find((game) => game.id === 'risk')!);
    expect(spy).toHaveBeenCalledWith(['/juegos/risk']);
  });

  it('no navega si el juego aún no está', () => {
    // La tarjeta se fabrica aquí: hoy los tres juegos están terminados, y la
    // regla tiene que seguir probada para el siguiente que entre en obras.
    const enObras = { ...component.games[0], id: 'futuro', route: null, status: 'en-obras' as const };
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.open(enObras);
    expect(spy).not.toHaveBeenCalled();
  });

  it('todas las tarjetas tienen textos en español y datos completos', () => {
    for (const game of component.games) {
      expect(game.name.length).toBeGreaterThan(2);
      expect(game.tagline.length).toBeGreaterThan(5);
      expect(game.description.length).toBeGreaterThan(20);
      expect(game.players).toMatch(/jugador/);
      expect(game.duration).toMatch(/min/);
      expect(game.highlights.length).toBeGreaterThan(0);
    }
  });
});
