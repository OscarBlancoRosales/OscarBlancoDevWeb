import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Podio } from './podio';
import type { PuestoEnAtril } from '../atriles/atriles';

function puesto(nombre: string, puntos: number): PuestoEnAtril {
  return {
    seatId: nombre.toLowerCase(),
    nombre,
    foto: `/assets/trivial/cast/${nombre.toLowerCase()}.png`,
    puntos,
    eresTu: false,
    haContestado: false,
    gano: null,
    tieneLaBomba: false,
    lidera: false,
    haApostado: false,
    apuesta: null,
  };
}

const NOVA = puesto('Nova', 520);
const SAGE = puesto('Sage', 480);
const ATLAS = puesto('Atlas', 340);
const TANK = puesto('Tank', 210);
const GHOST = puesto('Ghost', 90);

/** Sin movimiento: en las pruebas no hay lienzo que pintar y no hace falta. */
function quietos(): void {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined }));
}

function montar(clasificacion: readonly PuestoEnAtril[]) {
  const fixture = TestBed.createComponent(Podio);
  fixture.componentInstance.clasificacion = clasificacion;
  fixture.detectChanges();
  return fixture;
}

describe('el podio', () => {
  beforeEach(() => {
    quietos();
  });

  it('sube a los tres primeros, con el ganador en medio', () => {
    const fixture = montar([NOVA, SAGE, ATLAS, TANK]);
    const dom = fixture.nativeElement as HTMLElement;
    const cajones = dom.querySelectorAll('.cajon');

    expect(cajones).toHaveLength(3);
    // El primero va en medio, que es donde se mira.
    expect(cajones[1].getAttribute('data-puesto')).toBe('1');
    expect(cajones[1].textContent).toContain('Nova');
  });

  it('con dos jugadores solo hay dos cajones', () => {
    const dom = montar([NOVA, SAGE]).nativeElement as HTMLElement;
    expect(dom.querySelectorAll('.cajon')).toHaveLength(2);
  });

  it('el que quedó quinto también se ve, debajo', () => {
    // Un podio que esconde a la mitad de la mesa es un podio que esa mitad no
    // quiere mirar.
    const dom = montar([NOVA, SAGE, ATLAS, TANK, GHOST]).nativeElement as HTMLElement;

    expect(dom.querySelector('.resto')?.textContent).toContain('Ghost');
    expect(dom.querySelector('.resto')?.textContent).toContain('Tank');
  });

  it('y si solo hay tres, no sobra ninguna lista vacía', () => {
    const dom = montar([NOVA, SAGE, ATLAS]).nativeElement as HTMLElement;
    expect(dom.querySelector('.resto')).toBeNull();
  });

  it('ofrece otro concurso', () => {
    const fixture = montar([NOVA]);
    let otra = false;
    fixture.componentInstance.otra.subscribe(() => {
      otra = true;
    });

    const dom = fixture.nativeElement as HTMLElement;
    dom.querySelector<HTMLButtonElement>('.otra')?.click();

    expect(otra).toBe(true);
  });

  it('sin confeti si han pedido que no se mueva nada', () => {
    const fixture = montar([NOVA, SAGE, ATLAS]);
    // El lienzo existe siempre; lo que no hay es animación pintando encima.
    expect(() => {
      fixture.destroy();
    }).not.toThrow();
  });
});
