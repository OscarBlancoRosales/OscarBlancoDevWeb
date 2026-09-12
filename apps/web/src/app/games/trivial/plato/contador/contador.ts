import { Component, Input, OnDestroy, signal } from '@angular/core';

/** Lo que tarda en subir del número viejo al nuevo. */
const SUBIDA_MS = 700;

/** Cada cuánto se repinta mientras sube. Sesenta por segundo es de sobra. */
const PASO_MS = 16;

/**
 * Un número que sube contando en vez de cambiar de golpe.
 *
 * Es un detalle tonto y cambia mucho: ver «340» convertirse en «490» de un
 * fotograma a otro no cuenta nada, y verlo subir cuenta que acabas de ganar
 * ciento cincuenta puntos. Los marcadores de la tele llevan haciéndolo desde
 * siempre por este motivo.
 *
 * Si han pedido que no se mueva nada, se pone el número y ya está.
 */
@Component({
  selector: 'app-contador',
  imports: [],
  template: '{{ vePintando() }}',
  styles: ':host { font-variant-numeric: tabular-nums; }',
})
export class Contador implements OnDestroy {
  private readonly mostrado = signal(0);
  private subida: ReturnType<typeof setInterval> | null = null;
  private desde = 0;
  private hasta = 0;
  private arrancoEn = 0;

  /** El reloj, inyectable para poder probar la subida sin esperarla. */
  @Input() ahora: () => number = () => performance.now();

  @Input()
  set valor(nuevo: number) {
    if (nuevo === this.hasta && this.subida) return;

    this.desde = this.mostrado();
    this.hasta = nuevo;

    if (this.quietos() || this.desde === nuevo) {
      this.parar();
      this.mostrado.set(nuevo);
      return;
    }

    this.arrancoEn = this.ahora();
    this.parar();
    this.subida = setInterval(() => {
      this.pinta();
    }, PASO_MS);
    this.pinta();
  }

  ngOnDestroy(): void {
    this.parar();
  }

  vePintando(): number {
    return this.mostrado();
  }

  /**
   * Un paso de la subida.
   *
   * Frena al final -la raíz cuadrada del avance- porque un número que sube a
   * velocidad constante y se para en seco parece un contador de kilómetros, no
   * un marcador.
   */
  private pinta(): void {
    const ido = Math.min(1, (this.ahora() - this.arrancoEn) / SUBIDA_MS);
    const suave = Math.sqrt(ido);
    this.mostrado.set(Math.round(this.desde + (this.hasta - this.desde) * suave));

    if (ido >= 1) {
      this.parar();
      this.mostrado.set(this.hasta);
    }
  }

  private parar(): void {
    if (this.subida) clearInterval(this.subida);
    this.subida = null;
  }

  private quietos(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      // En contextos sin matchMedia -las pruebas, sin ir más lejos- no se anima.
      return true;
    }
  }
}
