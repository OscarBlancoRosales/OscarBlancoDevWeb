import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Atriles } from './atriles';
import type { PuestoEnAtril } from './atriles';

/**
 * La fila de concursantes.
 *
 * Lo que se comprueba aquí es que el atril cuenta lo que hay que contar y calla
 * lo que hay que callar: se ve que alguien ha contestado, nunca qué.
 */
function puesto(cambios: Partial<PuestoEnAtril> = {}): PuestoEnAtril {
  return {
    seatId: 'a',
    nombre: 'Nova',
    foto: '/assets/trivial/cast/nova.png',
    puntos: 340,
    eresTu: false,
    haContestado: false,
    gano: null,
    tieneLaBomba: false,
    lidera: false,
    haApostado: false,
    ...cambios,
  };
}

function montar(puestos: readonly PuestoEnAtril[]): HTMLElement {
  const fixture = TestBed.createComponent(Atriles);
  fixture.componentInstance.puestos = puestos;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('los atriles', () => {
  it('pone a cada uno en su puesto, con su cara y sus puntos', () => {
    const dom = montar([puesto(), puesto({ seatId: 'b', nombre: 'Sage', puntos: 180 })]);

    expect(dom.querySelectorAll('.atril')).toHaveLength(2);
    expect(dom.textContent).toContain('Nova');
    expect(dom.textContent).toContain('340');
    expect(dom.querySelector('img')?.getAttribute('src')).toContain('nova.png');
  });

  it('enciende el atril de quien ya ha contestado', () => {
    const dom = montar([puesto({ haContestado: true })]);
    expect(dom.querySelector('.atril')?.classList.contains('contestado')).toBe(true);
  });

  it('pero no dice qué ha contestado', () => {
    // La respuesta de los demás no se enseña hasta que la ronda se cierra, y
    // aquí no llega: el atril no tiene por dónde filtrarla.
    const dom = montar([puesto({ haContestado: true })]);
    expect(dom.textContent).not.toMatch(/\b[ABCD]\b/);
  });

  it('marca el acierto y el fallo cuando la ronda se cierra', () => {
    const dom = montar([
      puesto({ seatId: 'a', gano: 150 }),
      puesto({ seatId: 'b', gano: 0 }),
      puesto({ seatId: 'c', gano: -120 }),
    ]);
    const atriles = dom.querySelectorAll('.atril');

    expect(atriles[0].classList.contains('acierta')).toBe(true);
    expect(atriles[1].classList.contains('acierta')).toBe(false);
    expect(atriles[1].classList.contains('falla')).toBe(false);
    expect(atriles[2].classList.contains('falla')).toBe(true);
  });

  it('enseña lo ganado o perdido con su signo', () => {
    const dom = montar([puesto({ gano: 150 }), puesto({ seatId: 'b', gano: -120 })]);

    expect(dom.textContent).toContain('+150');
    expect(dom.textContent).toContain('-120');
  });

  it('y no enseña un cero, que no es noticia', () => {
    expect(montar([puesto({ gano: 0 })]).querySelector('.gano')).toBeNull();
  });

  it('señala a quien tiene la bomba', () => {
    const dom = montar([puesto({ tieneLaBomba: true })]);
    expect(dom.querySelector('.atril')?.classList.contains('con-bomba')).toBe(true);
  });

  it('le pone corona al que va primero y marca el tuyo', () => {
    const dom = montar([puesto({ lidera: true }), puesto({ seatId: 'b', eresTu: true })]);
    const atriles = dom.querySelectorAll('.atril');

    expect(atriles[0].classList.contains('lidera')).toBe(true);
    expect(atriles[0].querySelector('.corona')).not.toBeNull();
    expect(atriles[1].classList.contains('tu')).toBe(true);
  });

  it('avisa de quién ya ha apostado, sin decir cuánto', () => {
    const dom = montar([puesto({ haApostado: true, puntos: 500 })]);

    expect(dom.querySelector('.apostado')).not.toBeNull();
    // Los 500 son sus puntos, no su apuesta: esa no llega aquí.
    expect(dom.querySelector('.apostado')?.textContent).not.toContain('500');
  });

  it('sin nadie sentado no pinta nada y no revienta', () => {
    expect(montar([]).querySelectorAll('.atril')).toHaveLength(0);
  });
});
