import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import type { AfterViewInit } from '@angular/core';
import type { PuestoEnAtril } from '../atriles/atriles';

/** Lo que dura el confeti. Pasado esto se para solo, que si no marea. */
const CONFETI_MS = 6_000;
const CUANTOS = 120;

/** Un papelito del confeti. */
interface Papel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  color: string;
}

/**
 * La ceremonia final.
 *
 * Los tres primeros suben al podio y el resto de la mesa queda debajo: un podio
 * que esconde a quien quedó quinto es un podio que ese quinto no quiere mirar.
 */
@Component({
  selector: 'app-podio',
  imports: [],
  templateUrl: './podio.html',
  styleUrl: './podio.css',
})
export class Podio implements AfterViewInit, OnDestroy {
  @Input() clasificacion: readonly PuestoEnAtril[] = [];
  @Output() readonly otra = new EventEmitter<void>();

  @ViewChild('lienzo') lienzo?: ElementRef<HTMLCanvasElement>;

  private animacion = 0;
  private papeles: Papel[] = [];

  /**
   * Los tres primeros, en el orden en que se colocan: plata, oro y bronce.
   *
   * El ganador va en medio y no a la izquierda porque es donde se mira, y
   * porque es como está montado cualquier podio desde hace cien años.
   */
  get cajones(): readonly PuestoEnAtril[] {
    const tres = this.clasificacion.slice(0, 3);
    if (tres.length === 3) return [tres[1], tres[0], tres[2]];
    if (tres.length === 2) return [tres[1], tres[0]];
    return tres;
  }

  /** Del cuarto para abajo. También han jugado. */
  get resto(): readonly PuestoEnAtril[] {
    return this.clasificacion.slice(3);
  }

  puestoDe(uno: PuestoEnAtril): number {
    return this.clasificacion.indexOf(uno) + 1;
  }

  ngAfterViewInit(): void {
    if (this.quietos()) return;
    this.arrancarConfeti();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animacion);
  }

  /** Si han pedido que no se mueva nada, no se mueve nada. */
  private quietos(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      // En algunos contextos de prueba no hay matchMedia. Sin confeti, pues.
      return true;
    }
  }

  private arrancarConfeti(): void {
    const canvas = this.lienzo?.nativeElement;
    const pincel = canvas?.getContext('2d');
    if (!canvas || !pincel) return;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const colores = ['#facc15', '#22c55e', '#38bdf8', '#f472b6', '#f97316'];

    this.papeles = Array.from({ length: CUANTOS }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 1 + Math.random() * 2.4,
      giro: Math.random() * Math.PI,
      color: colores[Math.floor(Math.random() * colores.length)] ?? '#facc15',
    }));

    const hasta = performance.now() + CONFETI_MS;
    const pinta = (): void => {
      pincel.clearRect(0, 0, canvas.width, canvas.height);
      for (const papel of this.papeles) {
        papel.x += papel.vx;
        papel.y += papel.vy;
        papel.giro += 0.05;
        if (papel.y > canvas.height) papel.y = -10;

        pincel.save();
        pincel.translate(papel.x, papel.y);
        pincel.rotate(papel.giro);
        pincel.fillStyle = papel.color;
        pincel.fillRect(-3, -5, 6, 10);
        pincel.restore();
      }
      if (performance.now() < hasta) this.animacion = requestAnimationFrame(pinta);
      else pincel.clearRect(0, 0, canvas.width, canvas.height);
    };
    this.animacion = requestAnimationFrame(pinta);
  }
}
