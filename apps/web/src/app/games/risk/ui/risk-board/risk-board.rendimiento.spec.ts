import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RiskBoard } from './risk-board';
import { WORLD_MAP } from '@devweb/shared/engine/maps/world.map';

/**
 * Lo que cuesta mover el mapa.
 *
 * Mover el mapa no cambia ningún dato del juego: ni un dueño, ni una tropa, ni
 * una selección. Sólo cambia dónde se está mirando. Así que Angular no tiene
 * nada que recalcular, y el objetivo es que no recalcule nada.
 *
 * Se mide con el mapa del mundo porque es el más grande que hay: si el coste
 * por territorio se cuela, aquí se nota.
 */
describe('RiskBoard: coste de arrastrar el mapa', () => {
  let fixture: ComponentFixture<RiskBoard>;

  function svg(): SVGSVGElement {
    return fixture.nativeElement.querySelector('svg.board') as SVGSVGElement;
  }

  /** Un arrastre de verdad: bajar, muchos movimientos y soltar. */
  async function arrastrar(pasos: number): Promise<void> {
    const el = svg();
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, clientY: 300, bubbles: true }));
    for (let i = 1; i <= pasos; i++) {
      el.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 400 + i, clientY: 300 + i, bubbles: true }),
      );
    }
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await fixture.whenStable();
  }

  function transformActual(): string {
    const grupo = fixture.nativeElement.querySelector('svg.board > g') as SVGGElement;
    return grupo.getAttribute('transform') ?? '';
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskBoard] }).compileComponents();
    fixture = TestBed.createComponent(RiskBoard);
    fixture.componentRef.setInput('map', WORLD_MAP);
    fixture.detectChanges();
  });

  /**
   * Cómo se detecta un repintado sin espiar a Angular.
   *
   * Se ensucia el componente por la puerta de atrás: se le cambia un campo sin
   * avisar a nadie, de modo que el DOM y el componente dejan de coincidir. Si
   * arrastrar provoca un ciclo de detección de cambios, ese cambio escondido
   * aparecerá en el DOM y lo delatará. Si no lo provoca, el DOM sigue como
   * estaba.
   *
   * Mide la propiedad que importa —¿repinta?— sin depender de cómo esté hecho
   * el componente por dentro, así que sobrevive al refactor.
   */
  function ensuciarEnSecreto(): void {
    fixture.componentInstance.showNames = !fixture.componentInstance.showNames;
  }

  function elDomDelata(): boolean {
    const nombres = fixture.nativeElement.querySelectorAll('svg.board text.badge-name').length;
    return fixture.componentInstance.showNames ? nombres > 0 : nombres === 0;
  }

  it('doscientos movimientos de dedo no provocan ni un repintado', async () => {
    ensuciarEnSecreto();
    await arrastrar(200);
    expect(elDomDelata()).toBe(false);
  });

  it('y aun así el mapa se ha movido: se escribe en el SVG directamente', async () => {
    const antes = transformActual();
    await arrastrar(200);
    const despues = transformActual();
    expect(despues).not.toBe(antes);
    // 200 pasos de un píxel en cada eje desde el origen.
    expect(despues).toContain('translate(200 200)');
  });

  /**
   * Un toque sobre un territorio corta la propagación para que el mapa no lo
   * cuente dos veces. El precio es que el `pointerup` no llega arriba, así que
   * el mapa se queda creyendo que sigue habiendo un dedo apoyado: el siguiente
   * movimiento del ratón lo arrastraría sin que nadie hubiera pulsado nada.
   */
  it('tras tocar un territorio el mapa no se queda enganchado al puntero', async () => {
    const territorio = fixture.nativeElement.querySelector('g.territory') as SVGGElement;
    territorio.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 400, clientY: 300, bubbles: true }),
    );
    territorio.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 400, clientY: 300, bubbles: true }),
    );
    const antes = transformActual();

    svg().dispatchEvent(
      new PointerEvent('pointermove', { clientX: 700, clientY: 600, bubbles: true }),
    );
    await fixture.whenStable();

    expect(transformActual()).toBe(antes);
  });

  it('pulsar sin apenas moverse no mueve el mapa', async () => {
    const antes = transformActual();
    // Cuatro píxeles: lo que tiembla una mano, no un gesto de arrastre.
    await arrastrar(4);
    expect(transformActual()).toBe(antes);
  });
});
