import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MandoDeApuesta } from './apuesta';

function montar(cambios: Partial<MandoDeApuesta> = {}) {
  const fixture = TestBed.createComponent(MandoDeApuesta);
  Object.assign(fixture.componentInstance, { tienes: 420, sonPersonas: 4, ...cambios });
  fixture.detectChanges();
  return fixture;
}

describe('el mando de la apuesta', () => {
  it('no te deja apostar más de lo que llevas', () => {
    const dom = montar().nativeElement as HTMLElement;
    expect(dom.querySelector<HTMLInputElement>('input[type=range]')?.max).toBe('420');
  });

  it('avisa de cuántos han apostado ya, sin decir cuánto', () => {
    const dom = montar({ hanApostado: 2 }).nativeElement as HTMLElement;

    expect(dom.querySelector('.cuantos')?.textContent).toContain('2');
    expect(dom.querySelector('.cuantos')?.textContent).toContain('4');
  });

  it('apuesta lo que se mueve en el deslizador', () => {
    const fixture = montar();
    const dichas: number[] = [];
    fixture.componentInstance.apuesta.subscribe((cuanto) => dichas.push(cuanto));

    // Por el deslizador de verdad y no tocando el campo a mano: es el camino
    // que recorre quien juega.
    const dom = fixture.nativeElement as HTMLElement;
    const rango = dom.querySelector<HTMLInputElement>('input[type=range]');
    if (!rango) throw new Error('no hay deslizador');
    rango.value = '300';
    rango.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    dom.querySelector<HTMLButtonElement>('.apostar')?.click();

    expect(dichas).toEqual([300]);
  });

  it('nunca manda más de lo que hay, aunque le metan mano al deslizador', () => {
    const fixture = montar({ tienes: 100 });
    const dichas: number[] = [];
    fixture.componentInstance.apuesta.subscribe((cuanto) => dichas.push(cuanto));
    fixture.componentInstance.cuanto = 9_999;

    fixture.componentInstance.apostar();

    expect(dichas).toEqual([100]);
  });

  it('los atajos ponen nada, la mitad y todo', () => {
    const fixture = montar({ tienes: 400 });

    fixture.componentInstance.pon(0);
    expect(fixture.componentInstance.cuanto).toBe(0);

    fixture.componentInstance.pon(0.5);
    expect(fixture.componentInstance.cuanto).toBe(200);

    fixture.componentInstance.pon(1);
    expect(fixture.componentInstance.cuanto).toBe(400);
  });

  it('una vez apostado, ya no se toca', () => {
    const dom = montar({ tuApuesta: 300 }).nativeElement as HTMLElement;

    expect(dom.querySelector('.apostar')).toBeNull();
    expect(dom.querySelector('.cifra')?.textContent).toContain('300');
  });

  it('con cero puntos se puede seguir: se apuesta nada', () => {
    // Quedarse seco a mitad de programa no puede dejarte fuera de la final.
    const dom = montar({ tienes: 0 }).nativeElement as HTMLElement;
    expect(dom.querySelector<HTMLButtonElement>('.apostar')?.disabled).toBe(false);
  });
});
