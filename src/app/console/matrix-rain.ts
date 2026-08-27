import { MATRIX_ALPHABET } from './eggs';

/**
 * La lluvia de la película: columnas de katakana cayendo, con la cabeza más
 * clara que la estela.
 *
 * Vive fuera del componente porque es puro canvas y bucle de animación: aquí
 * no hay estado de Angular que valga.
 */
export class MatrixRain {
  private raf = 0;
  private gotas: number[] = [];
  private ctx: CanvasRenderingContext2D | null = null;
  private ultimo = 0;

  /** Alto de celda en píxeles; también el tamaño de la fuente. */
  private readonly celda = 16;
  /** Fotogramas por segundo: la lluvia original no va a 60. */
  private readonly fps = 24;

  constructor(private canvas: HTMLCanvasElement) {}

  start(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.resize();
    this.ultimo = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Recalcula las columnas cuando cambia el tamaño de la ventana. */
  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const ancho = this.canvas.clientWidth || window.innerWidth;
    const alto = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = ancho * ratio;
    this.canvas.height = alto * ratio;
    this.ctx?.scale(ratio, ratio);

    const columnas = Math.ceil(ancho / this.celda);
    // Cada columna arranca a una altura distinta o la lluvia caería en bloque.
    this.gotas = Array.from({ length: columnas }, () =>
      Math.floor((Math.random() * -alto) / this.celda),
    );
  }

  private frame(tiempo: number): void {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    if (tiempo - this.ultimo < 1000 / this.fps) return;
    this.ultimo = tiempo;
    this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const ancho = this.canvas.clientWidth;
    const alto = this.canvas.clientHeight;

    // Un velo negro en vez de borrar: eso deja la estela que se desvanece.
    ctx.fillStyle = 'rgba(0, 8, 2, 0.09)';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.font = `${this.celda}px "Cascadia Code", Consolas, monospace`;

    this.gotas.forEach((fila, i) => {
      const letra = MATRIX_ALPHABET[Math.floor(Math.random() * MATRIX_ALPHABET.length)];
      const x = i * this.celda;
      const y = fila * this.celda;

      ctx.fillStyle = '#cfffdc';
      ctx.fillText(letra, x, y);
      // La estela: un par de caracteres detrás, ya en verde apagado.
      ctx.fillStyle = 'rgba(0, 255, 90, 0.55)';
      ctx.fillText(letra, x, y - this.celda);

      if (y > alto && Math.random() > 0.975) {
        this.gotas[i] = 0;
      } else {
        this.gotas[i] = fila + 1;
      }
    });
  }
}
