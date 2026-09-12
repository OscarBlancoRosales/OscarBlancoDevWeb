import { Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';
import { sePuedePintar } from './escenario';
import type { AfterViewInit } from '@angular/core';
import type { Cuadro } from './escenario';
import type { Diorama } from './diorama';

/**
 * El plató 3D, enchufado a Angular.
 *
 * Tres cuidados, y los tres por el móvil:
 *
 * **Se carga aparte.** Three.js son unos ciento cincuenta kilobytes, y no se
 * descargan hasta que hace falta: quien entra al lóbby no paga por un plató
 * que a lo mejor no llega a ver.
 *
 * **Se para cuando no se ve.** Un bucle de sesenta cuadros por segundo en una
 * pestaña de fondo es batería tirada.
 *
 * **Y si algo falla, no pasa nada.** Sin WebGL, con la aceleración apagada o
 * con el movimiento desactivado, este componente no pinta y se queda el
 * escenario de CSS, que por eso merece la pena tenerlo bien.
 */
@Component({
  selector: 'app-escenario3d',
  imports: [],
  template: '<canvas #lienzo [class.vivo]="pintando()"></canvas>',
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      opacity: 0;
      transition: opacity 600ms ease;
    }
    canvas.vivo {
      opacity: 1;
    }
  `,
})
export class Escenario3d implements AfterViewInit, OnDestroy {
  @ViewChild('lienzo') lienzo?: ElementRef<HTMLCanvasElement>;

  readonly pintando = signal(false);

  private diorama: Diorama | null = null;
  private ultimo: Cuadro | null = null;
  private mirando?: ResizeObserver;

  @Input()
  set cuadro(nuevo: Cuadro) {
    this.ultimo = nuevo;
    this.diorama?.mostrar(nuevo);
  }

  ngAfterViewInit(): void {
    void this.montar();
  }

  /** Carga el paquete y monta el plató. Aparte, porque `ngAfterViewInit` no
   *  puede devolver una promesa sin que nadie la espere. */
  private async montar(): Promise<void> {
    const lienzo = this.lienzo?.nativeElement;
    if (!lienzo || !sePuedePintar() || this.quietos()) return;

    try {
      // Aquí, y no arriba: así el paquete no entra en el bundle de quien nunca
      // llega a jugar.
      const { Diorama } = await import('./diorama');
      this.diorama = new Diorama(lienzo);
      if (this.ultimo) this.diorama.mostrar(this.ultimo);
      this.diorama.arrancar();
      this.pintando.set(true);
      this.vigilarTamano(lienzo);
      document.addEventListener('visibilitychange', this.alCambiarDeVista);
    } catch {
      // Si el plató no se puede montar, se juega igual con el de CSS. No hay
      // nada que avisar a nadie: el juego no ha perdido ni una función.
      this.diorama = null;
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.alCambiarDeVista);
    this.mirando?.disconnect();
    this.diorama?.soltar();
    this.diorama = null;
  }

  /** Con la pestaña de fondo no se pinta: es batería tirada. */
  private readonly alCambiarDeVista = (): void => {
    if (document.hidden) this.diorama?.parar();
    else this.diorama?.arrancar();
  };

  private vigilarTamano(lienzo: HTMLCanvasElement): void {
    try {
      this.mirando = new ResizeObserver(() => {
        this.diorama?.redimensionar();
      });
      this.mirando.observe(lienzo);
    } catch {
      // Sin ResizeObserver se pinta al tamaño de entrada y se queda así.
    }
  }

  private quietos(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  }
}
