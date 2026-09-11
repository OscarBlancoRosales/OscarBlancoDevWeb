import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Rotulo, SECCIONES } from './rotulo';
import type { Seccion } from './rotulo';
import type { TipoPrueba } from '@devweb/shared/games/trivial/tipos';

function montar(seccion: Seccion | null) {
  const fixture = TestBed.createComponent(Rotulo);
  fixture.componentInstance.seccion = seccion;
  fixture.detectChanges();
  return fixture;
}

describe('el rótulo de sección', () => {
  it('sin sección no hay rótulo', () => {
    const dom = montar(null).nativeElement as HTMLElement;
    expect(dom.querySelector('.rotulo')).toBeNull();
  });

  it('canta el nombre, cómo se juega y qué se gana', () => {
    const dom = montar(SECCIONES.bomba).nativeElement as HTMLElement;

    expect(dom.textContent).toContain('La bomba');
    expect(dom.textContent).toContain(SECCIONES.bomba.pista);
    expect(dom.textContent).toContain(SECCIONES.bomba.premio);
  });

  it('las seis pruebas y la final tienen el suyo', () => {
    // Sin esto, una prueba nueva entra sin que nadie la anuncie y vuelve a
    // sentirse como una pregunta más.
    const todas: TipoPrueba[] = [
      'test',
      'estimacion',
      'fallo',
      'pulsa',
      'rafaga',
      'bomba',
      'final',
    ];

    for (const tipo of todas) {
      expect(SECCIONES[tipo].nombre.length, tipo).toBeGreaterThan(0);
      expect(SECCIONES[tipo].pista.length, tipo).toBeGreaterThan(0);
      expect(SECCIONES[tipo].premio.length, tipo).toBeGreaterThan(0);
    }
  });

  it('se puede saltar pulsando', () => {
    const fixture = montar(SECCIONES.test);
    let saltado = false;
    fixture.componentInstance.salta.subscribe(() => {
      saltado = true;
    });

    const dom = fixture.nativeElement as HTMLElement;
    dom.querySelector<HTMLButtonElement>('.rotulo')?.click();

    expect(saltado).toBe(true);
  });
});
