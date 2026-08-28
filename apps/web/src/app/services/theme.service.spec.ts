import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { THEMES, ThemeService } from './theme.service';

/**
 * El tema dejó de ser cosa de la consola: lo pinta todo el sitio. Vive en un
 * servicio y se cuelga del <html>, así que cualquier pantalla lo hereda sin
 * tener que enterarse de nada.
 */
describe('el tema del sitio', () => {
  let theme: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
    theme = TestBed.inject(ThemeService);
  });

  it('arranca con el verde de la casa', () => {
    expect(theme.current).toBe('dev');
  });

  it('cambiarlo lo cuelga del documento, para que llegue a todas las pantallas', () => {
    theme.set('ice');
    expect(document.documentElement.getAttribute('data-theme')).toBe('ice');
  });

  it('y se acuerda al volver', () => {
    theme.set('amber');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ThemeService).current).toBe('amber');
  });

  it('un tema inventado no se aplica', () => {
    expect(theme.set('purpurina' as never)).toBe(false);
    expect(theme.current).toBe('dev');
  });

  it('un valor corrupto en el almacenamiento no rompe el arranque', () => {
    localStorage.setItem('console_theme', '{"esto":"no es un tema"}');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ThemeService).current).toBe('dev');
  });

  it('la lista pública no enseña el tema secreto', () => {
    expect(theme.listed()).not.toContain('vaporwave');
    expect(THEMES).toContain('vaporwave');
  });

  it('pero si ya lo tienes puesto, se ve en la lista', () => {
    theme.set('vaporwave');
    expect(theme.listed()).toContain('vaporwave');
  });

  it('avisa a quien esté escuchando cuando cambia', () => {
    let avisos = 0;
    const sub = theme.change$.subscribe(() => avisos++);
    theme.set('matrix');
    sub.unsubscribe();
    expect(avisos).toBe(1);
  });
});
