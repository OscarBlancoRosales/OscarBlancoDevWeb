import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';

/** Cuando queda menos que esto, la cuenta atrás se pone nerviosa. */
const APURANDO_MS = 5_000;

/** Cada cuánto se redibuja. Cinco veces por segundo basta y no calienta nada. */
const LATIDO_MS = 200;

/**
 * La cuenta atrás de la ronda.
 *
 * Lo que llega del servidor es **el instante en que se cierra**, no los
 * segundos que quedan: cada navegador tiene su hora y ninguna coincide, así que
 * restar contra un instante común es lo único que hace que los cinco vean el
 * mismo número. Aquí solo se dibuja; quien cierra la ronda es el servidor.
 */
@Component({
  selector: 'app-cronometro',
  imports: [],
  templateUrl: './cronometro.html',
  styleUrl: './cronometro.css',
})
export class Cronometro implements OnInit, OnDestroy {
  @Input() cierraEn = 0;
  /** Cuánto duraba entera, para poder pintar la barra. */
  @Input() duracionMs = 0;
  /** Inyectable para poder probar el paso del tiempo sin esperarlo. */
  @Input() ahora: () => number = Date.now;

  private readonly late = signal(0);
  private latido?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.latido = setInterval(() => {
      this.late.update((cuantos) => cuantos + 1);
    }, LATIDO_MS);
  }

  ngOnDestroy(): void {
    if (this.latido) clearInterval(this.latido);
  }

  /** Los segundos que quedan, nunca por debajo de cero. */
  get quedan(): number {
    // Leer la señal es lo que ata el redibujado al latido en una aplicación
    // sin zonas: sin esta lectura, el reloj cambia y nadie se entera.
    this.late();
    if (this.cierraEn === 0) return 0;
    return Math.max(0, Math.ceil((this.cierraEn - this.ahora()) / 1000));
  }

  get apurando(): boolean {
    this.late();
    return this.cierraEn !== 0 && this.cierraEn - this.ahora() <= APURANDO_MS;
  }

  /** Lo que queda de barra, de 0 a 100. */
  get porcentaje(): number {
    this.late();
    if (this.cierraEn === 0 || this.duracionMs <= 0) return 0;
    const restante = this.cierraEn - this.ahora();
    return Math.min(100, Math.max(0, (restante / this.duracionMs) * 100));
  }
}
