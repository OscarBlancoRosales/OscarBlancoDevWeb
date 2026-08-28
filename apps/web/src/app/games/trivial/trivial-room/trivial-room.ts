import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { TrivialRoomService } from '../trivial-room.service';
import { Presentador } from '../presentador';
import { paseDe } from '../../pase-guardado';
import type { Signal } from '@angular/core';
import type { Momento } from '@devweb/shared/games/trivial/guion';
import type { TrivialView } from '@devweb/shared/games/trivial/tipos';

/** Cómo va la clasificación, ya ordenada y con nombres. */
export interface PuestoEnLaMesa {
  readonly seatId: string;
  readonly nombre: string;
  readonly puntos: number;
  readonly eresTu: boolean;
}

/**
 * La mesa del concurso.
 *
 * Pinta lo que manda el servidor y le da voz al presentador. No sabe ninguna
 * respuesta hasta que la ronda se cierra, porque hasta entonces no se la
 * mandan.
 */
@Component({
  selector: 'app-trivial-room',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './trivial-room.html',
  styleUrl: './trivial-room.css',
})
export class TrivialRoom implements OnInit, OnDestroy {
  readonly vista: Signal<TrivialView | null>;
  readonly error: Signal<string | null>;

  readonly frase = signal('');
  readonly roomId = signal('');
  readonly enlaceCopiado = signal(false);

  /** Lo que se escribe en una prueba de estimación. */
  estimacion: number | null = null;

  /** Las letras de las opciones, para no calcularlas en la plantilla. */
  readonly letras = ['A', 'B', 'C', 'D'];

  private readonly presentador = new Presentador();
  private semilla = 1;
  private ultimoMomento = '';

  constructor(
    private readonly sala: TrivialRoomService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {
    this.vista = sala.vista;
    this.error = sala.error;

    // El presentador habla cuando cambia el momento, no cuando se repinta la
    // pantalla: colgado del ciclo de detección de cambios, pediría una frase
    // nueva al modelo varias veces por segundo.
    effect(() => {
      this.hablarSiCambioElMomento(this.vista());
    });
  }

  ngOnInit(): void {
    const sala = this.ruta.snapshot.queryParamMap.get('sala') ?? '';
    const pase = sala ? paseDe(sala) : null;

    if (!pase) {
      void this.router.navigate(['/juegos/trivial'], {
        ...(sala && { queryParams: { sala } }),
      });
      return;
    }

    this.roomId.set(sala);
    // La semilla de lo que dice el presentador sale del identificador de la
    // sala: así todos los de la mesa oyen la misma frase sin que el servidor
    // tenga que mandarla.
    this.semilla = numeroDe(sala);
    this.sala.reconectar(pase);
  }

  ngOnDestroy(): void {
    this.sala.desconectar();
  }

  // --- El concurso --------------------------------------------------------

  empezar(): void {
    this.sala.empezar();
  }

  responder(opcion: number): void {
    this.sala.responder(opcion);
  }

  responderEstimacion(): void {
    if (this.estimacion === null) return;
    this.sala.responder(Math.round(this.estimacion));
    this.estimacion = null;
  }

  siguiente(): void {
    this.sala.siguiente();
  }

  get yaContestaste(): boolean {
    return this.vista()?.hanRespondido.includes(this.sala.miAsiento) ?? false;
  }

  get esperandoAlResto(): boolean {
    const vista = this.vista();
    return vista?.cerrada === false && this.yaContestaste;
  }

  nombreDe(seatId: string): string {
    return this.sala.nombreDe(seatId);
  }

  /** La clasificación, de más a menos puntos. */
  get clasificacion(): PuestoEnLaMesa[] {
    const vista = this.vista();
    if (!vista) return [];

    return Object.entries(vista.puntos)
      .map(([seatId, puntos]) => ({
        seatId,
        nombre: this.sala.nombreDe(seatId),
        puntos,
        eresTu: seatId === this.sala.miAsiento,
      }))
      .sort((uno, otro) => otro.puntos - uno.puntos);
  }

  get ganador(): PuestoEnLaMesa | null {
    return this.clasificacion.at(0) ?? null;
  }

  /** Si esa opción fue la respuesta correcta, una vez cerrada la ronda. */
  esLaBuena(opcion: number): boolean {
    return this.vista()?.correcta === opcion;
  }

  /** Si esa opción fue la que tú marcaste. */
  esLaTuya(opcion: number): boolean {
    return this.vista()?.tuRespuesta === opcion;
  }

  private hablarSiCambioElMomento(vista: TrivialView | null): void {
    if (!vista) return;

    const momento = momentoDe(vista);
    const clave = `${momento}:${vista.ronda}:${String(vista.cerrada)}`;
    if (clave === this.ultimoMomento) return;
    this.ultimoMomento = clave;

    const lider = this.clasificacion.at(0);
    void this.presentador
      .decir(
        momento,
        {
          quien: lider?.nombre ?? 'nadie',
          puntos: lider?.puntos ?? 0,
          ronda: vista.ronda,
          rondas: vista.rondas,
        },
        this.semilla,
      )
      .then((dicho) => {
        this.frase.set(dicho);
      });
  }

  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/juegos/trivial?sala=${this.roomId()}`,
      );
      this.enlaceCopiado.set(true);
    } catch {
      // Sin permiso de portapapeles el enlace sigue en la barra de direcciones.
    }
  }

  volver(): void {
    void this.router.navigate(['/juegos/trivial']);
  }
}

/** En qué momento del concurso estamos, para saber qué toca decir. */
function momentoDe(vista: TrivialView): Momento {
  if (vista.fase === 'presentacion') return 'bienvenida';
  if (vista.fase === 'fin') return 'despedida';

  if (vista.cerrada) {
    const acertaron = vista.resultados?.some((resultado) => resultado.ganados > 0) ?? false;
    return acertaron ? 'aciertaAlguien' : 'nadieAcierta';
  }

  return vista.ronda === vista.rondas ? 'ultimaRonda' : 'presentaRonda';
}

/** Un número estable a partir del identificador de la sala. */
function numeroDe(sala: string): number {
  let hash = 0;
  for (const letra of sala) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  return hash;
}
