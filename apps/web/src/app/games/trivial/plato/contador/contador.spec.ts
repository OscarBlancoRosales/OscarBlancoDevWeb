import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Contador } from './contador';

/**
 * El marcador que sube contando.
 *
 * Ver «340» convertirse en «490» de un fotograma a otro no cuenta nada; verlo
 * subir cuenta que acabas de ganar ciento cincuenta puntos.
 */
function conMovimiento(permitido: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches: !permitido, addEventListener: () => undefined }));
}

function montar(reloj: () => number) {
  const fixture = TestBed.createComponent(Contador);
  fixture.componentInstance.ahora = reloj;
  return fixture;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('el contador', () => {
  it('empieza en cero', () => {
    conMovimiento(false);
    const fixture = montar(() => 0);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe('0');
  });

  it('sin movimiento permitido, pone el número y ya está', () => {
    conMovimiento(false);
    const fixture = montar(() => 0);
    fixture.componentInstance.valor = 340;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe('340');
  });

  it('con movimiento, pasa por valores intermedios antes de llegar', () => {
    conMovimiento(true);
    vi.useFakeTimers();
    let reloj = 0;
    const fixture = montar(() => reloj);

    fixture.componentInstance.valor = 1000;
    fixture.detectChanges();

    reloj = 100;
    vi.advanceTimersByTime(100);
    fixture.detectChanges();
    const medias = fixture.componentInstance.vePintando();

    expect(medias).toBeGreaterThan(0);
    expect(medias).toBeLessThan(1000);
  });

  it('y acaba exactamente en el número, no en uno aproximado', () => {
    conMovimiento(true);
    vi.useFakeTimers();
    let reloj = 0;
    const fixture = montar(() => reloj);

    fixture.componentInstance.valor = 777;
    fixture.detectChanges();
    reloj = 5_000;
    vi.advanceTimersByTime(5_000);

    expect(fixture.componentInstance.vePintando()).toBe(777);
  });

  it('sabe bajar, que en la bomba se resta', () => {
    conMovimiento(true);
    vi.useFakeTimers();
    let reloj = 0;
    const fixture = montar(() => reloj);

    fixture.componentInstance.valor = 500;
    reloj = 5_000;
    vi.advanceTimersByTime(5_000);

    fixture.componentInstance.valor = 380;
    reloj = 10_000;
    vi.advanceTimersByTime(5_000);

    expect(fixture.componentInstance.vePintando()).toBe(380);
  });

  it('no deja el intervalo colgando al destruirse', () => {
    // Hay un contador por atril y una ronda cada pocos segundos: un intervalo
    // que sobrevive es una fuga multiplicada por cinco.
    conMovimiento(true);
    vi.useFakeTimers();
    const fixture = montar(() => 0);
    fixture.componentInstance.valor = 900;
    const vivos = vi.getTimerCount();

    fixture.destroy();

    expect(vi.getTimerCount()).toBeLessThan(vivos);
  });
});
