import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PanelPregunta } from './panel-pregunta';

function montarFixture(cambios: Partial<PanelPregunta> = {}) {
  const fixture = TestBed.createComponent(PanelPregunta);
  Object.assign(fixture.componentInstance, {
    enunciado: '¿Qué devuelve typeof null?',
    opciones: ['"null"', '"object"'],
    ...cambios,
  });
  fixture.detectChanges();
  return fixture;
}

function montar(cambios: Partial<PanelPregunta> = {}): HTMLElement {
  return montarFixture(cambios).nativeElement as HTMLElement;
}

describe('el panel de la pregunta', () => {
  it('pinta el enunciado y sus opciones con letra', () => {
    const dom = montar();

    expect(dom.textContent).toContain('¿Qué devuelve typeof null?');
    expect(dom.querySelectorAll('.opcion')).toHaveLength(2);
    expect(dom.textContent).toContain('A');
    expect(dom.textContent).toContain('B');
  });

  it('enseña el código cuando lo hay, y no cuando no', () => {
    expect(montar({ codigo: 'const a = 1;' }).querySelector('.codigo')).not.toBeNull();
    expect(montar().querySelector('.codigo')).toBeNull();
  });

  it('avisa de la dificultad cuando la pregunta la trae', () => {
    const dom = montar({ dificultad: 4 });

    expect(dom.querySelector('.dificultad')?.textContent).toContain('4');
    expect(dom.querySelectorAll('.dificultad i')).toHaveLength(4);
    expect(montar({ dificultad: null }).querySelector('.dificultad')).toBeNull();
  });

  it('no deja pulsar cuando no te toca', () => {
    const dom = montar({ puedesContestar: false });
    const botones = dom.querySelectorAll<HTMLButtonElement>('.opcion');

    expect(Array.from(botones).every((boton) => boton.disabled)).toBe(true);
  });

  it('avisa de qué has pulsado', () => {
    const fixture = montarFixture({ puedesContestar: true });
    const dichos: number[] = [];
    fixture.componentInstance.responde.subscribe((cual) => dichos.push(cual));

    const dom = fixture.nativeElement as HTMLElement;
    dom.querySelectorAll<HTMLButtonElement>('.opcion')[1].click();

    expect(dichos).toEqual([1]);
  });

  it('cerrada, marca la buena y la tuya, y explica', () => {
    const dom = montar({
      cerrada: true,
      correcta: 0,
      tuRespuesta: 1,
      explicacion: 'Era la primera.',
    });
    const botones = dom.querySelectorAll('.opcion');

    expect(botones[0].classList.contains('buena')).toBe(true);
    expect(botones[1].classList.contains('tuya')).toBe(true);
    expect(dom.textContent).toContain('Era la primera.');
  });

  it('no marca ninguna buena mientras la ronda sigue abierta', () => {
    // La vista no la trae -el servidor no la manda- y el panel no se la inventa.
    expect(montar({ cerrada: false, correcta: null }).querySelector('.buena')).toBeNull();
  });

  it('en una estimación se escribe el número, no se elige', () => {
    const dom = montar({ esEstimacion: true });

    expect(dom.querySelector('input[type=number]')).not.toBeNull();
    expect(dom.querySelectorAll('.opcion')).toHaveLength(0);
  });

  it('y no manda una estimación vacía', () => {
    const fixture = montarFixture({ esEstimacion: true, puedesContestar: true });
    const dichos: number[] = [];
    fixture.componentInstance.responde.subscribe((cual) => dichos.push(cual));

    fixture.componentInstance.enviarEstimacion();

    expect(dichos).toEqual([]);
  });

  it('solo ofrece impugnar en el modo de preguntas inventadas', () => {
    expect(montar({ sePuedeImpugnar: false }).querySelector('.impugnar')).toBeNull();
    expect(montar({ sePuedeImpugnar: true }).querySelector('.impugnar')).not.toBeNull();
  });

  it('dice cuántos van y cuántos hacen falta para tumbarla', () => {
    const dom = montar({ sePuedeImpugnar: true, impugnan: 2, hacenFalta: 4 });
    const boton = dom.querySelector('.impugnar');

    expect(boton?.textContent).toContain('2');
    expect(boton?.textContent).toContain('4');
  });

  it('no te deja impugnar dos veces', () => {
    const dom = montar({ sePuedeImpugnar: true, tuImpugnas: true });
    expect(dom.querySelector<HTMLButtonElement>('.impugnar')?.disabled).toBe(true);
  });

  it('ni impugnar una ronda ya cerrada', () => {
    expect(montar({ sePuedeImpugnar: true, cerrada: true }).querySelector('.impugnar')).toBeNull();
  });
});
