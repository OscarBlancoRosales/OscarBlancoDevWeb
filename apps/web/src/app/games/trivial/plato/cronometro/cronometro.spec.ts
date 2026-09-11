import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Cronometro } from './cronometro';

function montar(cierraEn: number, ahora = 10_000, duracionMs = 25_000): HTMLElement {
  const fixture = TestBed.createComponent(Cronometro);
  fixture.componentInstance.cierraEn = cierraEn;
  fixture.componentInstance.duracionMs = duracionMs;
  fixture.componentInstance.ahora = () => ahora;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('el cronómetro', () => {
  it('no se ve si esta ronda no lleva reloj', () => {
    expect(montar(0).querySelector('.barra')).toBeNull();
  });

  it('enseña los segundos que quedan', () => {
    expect(montar(18_000).textContent).toContain('8');
  });

  it('a cero no baja', () => {
    // El servidor cierra la ronda cuando toca; mientras llega su mensaje, la
    // pantalla no puede ponerse a contar en negativo.
    const dom = montar(5_000, 9_000);

    expect(dom.textContent).not.toContain('-');
    expect(dom.textContent).toContain('0');
  });

  it('avisa cuando queda poco', () => {
    expect(montar(12_000).querySelector('.barra')?.classList.contains('apurando')).toBe(true);
  });

  it('y no avisa cuando sobra tiempo', () => {
    expect(montar(30_000).querySelector('.barra')?.classList.contains('apurando')).toBe(false);
  });

  it('la barra se vacía según pasa el tiempo', () => {
    const fixture = TestBed.createComponent(Cronometro);
    fixture.componentInstance.cierraEn = 30_000;
    fixture.componentInstance.duracionMs = 20_000;
    fixture.componentInstance.ahora = () => 20_000;
    fixture.detectChanges();

    expect(fixture.componentInstance.porcentaje).toBe(50);
  });

  it('deja de latir al destruirse', () => {
    // Aquí se abre y se cierra una ronda cada pocos segundos: un intervalo que
    // sobrevive a la sala es una fuga con patas.
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Cronometro);
    fixture.componentInstance.cierraEn = 60_000;
    fixture.detectChanges();
    const antes = vi.getTimerCount();

    fixture.destroy();

    expect(vi.getTimerCount()).toBeLessThan(antes);
    vi.useRealTimers();
  });
});
