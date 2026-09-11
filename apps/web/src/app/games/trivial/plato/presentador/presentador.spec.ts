import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PresentadorEnPlato } from './presentador';

function montar(dice: string, momento: string): HTMLElement {
  const fixture = TestBed.createComponent(PresentadorEnPlato);
  fixture.componentInstance.dice = dice;
  fixture.componentInstance.momento = momento;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('el presentador en el plató', () => {
  it('pone la cara que toca al momento', () => {
    // El gesto sale del momento y no de la frase: así los cinco de la mesa le
    // ven la misma cara que la frase que están leyendo.
    const dom = montar('Le ha estallado a Nova.', 'explota');
    expect(dom.querySelector('img')?.getAttribute('src')).toContain('wrong.png');
  });

  it('celebra cuando hay que celebrar', () => {
    const dom = montar('¡Correcto!', 'aciertaAlguien');
    expect(dom.querySelector('img')?.getAttribute('src')).toContain('yes.png');
  });

  it('se queda quieto cuando no hay momento', () => {
    expect(montar('', '').querySelector('img')?.getAttribute('src')).toContain('idle.png');
  });

  it('sin nada que decir no saca bocadillo', () => {
    expect(montar('', '').querySelector('.bocadillo')).toBeNull();
  });

  it('y enseña lo que dice cuando dice algo', () => {
    const dom = montar('Vamos con la bomba.', 'seccionBomba');
    expect(dom.querySelector('.bocadillo')?.textContent).toContain('Vamos con la bomba.');
  });

  it('cambia de turno de palabra al cambiar la frase, para que se note', () => {
    // Por setInput y no tocando el campo: es como le llegan las frases de
    // verdad, una detrás de otra, y es lo que hace que la animación se reinicie.
    const fixture = TestBed.createComponent(PresentadorEnPlato);
    fixture.componentRef.setInput('momento', 'presentaRonda');
    fixture.componentRef.setInput('dice', 'Una.');
    fixture.detectChanges();
    const primero = fixture.componentInstance.turnoDePalabra;

    fixture.componentRef.setInput('dice', 'Otra bien distinta.');
    fixture.detectChanges();

    expect(fixture.componentInstance.turnoDePalabra).not.toBe(primero);
    const dom = fixture.nativeElement as HTMLElement;
    expect(dom.querySelector('.bocadillo')?.getAttribute('data-turno')).toContain('presentaRonda');
  });
});
