import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { TrivialRoomService } from '../trivial-room.service';
import { paseDe } from '../../pase-guardado';
import type { Signal } from '@angular/core';
import type { TipoPrueba, TrivialView } from '@devweb/shared/games/trivial/tipos';

/** Cómo va la clasificación, ya ordenada y con nombres. */
export interface PuestoEnLaMesa {
  readonly seatId: string;
  readonly nombre: string;
  readonly puntos: number;
  readonly eresTu: boolean;
}

/** Cómo se llama cada prueba en pantalla, y qué pinta tiene. */
interface Seccion {
  readonly nombre: string;
  readonly pista: string;
}

const SECCIONES: Readonly<Record<TipoPrueba, Seccion>> = {
  test: { nombre: 'Test', pista: 'Cuatro opciones, una buena.' },
  estimacion: { nombre: 'A ojo', pista: 'Sin opciones: escribe el número.' },
  fallo: { nombre: 'Encuentra el fallo', pista: 'Está ahí. Míralo bien.' },
  pulsa: { nombre: 'El primero que pulse', pista: 'Solo cobra el primero. Fallar cuesta.' },
  rafaga: { nombre: 'Ráfaga', pista: 'Verdadero o falso. Encadenar multiplica.' },
  bomba: { nombre: 'La bomba', pista: 'Contesta y pásala. Que no te pille.' },
};

/**
 * La mesa del concurso.
 *
 * Pinta lo que manda el servidor, presentador incluido: lo que dice ya viene
 * en la vista, así que los cinco de la mesa leen lo mismo a la vez. No sabe
 * ninguna respuesta hasta que la ronda se cierra, porque hasta entonces no se
 * la mandan.
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

  readonly roomId = signal('');
  readonly enlaceCopiado = signal(false);

  /** Lo que se escribe en una prueba de estimación. */
  estimacion: number | null = null;

  /** Las letras de las opciones, para no calcularlas en la plantilla. */
  readonly letras = ['A', 'B', 'C', 'D'];


  constructor(
    private readonly sala: TrivialRoomService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {
    this.vista = sala.vista;
    this.error = sala.error;
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

  // --- El programa --------------------------------------------------------

  /** Lo que está diciendo el presentador. Viene del servidor, igual para todos. */
  get dice(): string {
    return this.vista()?.dice ?? '';
  }

  /** En qué sección del programa estamos. */
  get seccion(): Seccion | null {
    const tipo = this.vista()?.tipo;
    return tipo ? SECCIONES[tipo] : null;
  }

  get esBomba(): boolean {
    return this.vista()?.tipo === 'bomba';
  }

  get esRafaga(): boolean {
    return this.vista()?.tipo === 'rafaga';
  }

  get esEstimacion(): boolean {
    return this.vista()?.tipo === 'estimacion';
  }

  /** De quién es la bomba ahora mismo, con su nombre. */
  get quienTieneLaBomba(): string {
    const turno = this.vista()?.turno;
    return turno ? this.sala.nombreDe(turno) : '';
  }

  /**
   * Si te toca contestar a ti.
   *
   * En la bomba contesta uno; en el resto, todos. Sin esto, cuatro personas
   * verían los botones activos en una prueba en la que solo juega una.
   */
  get puedesContestar(): boolean {
    const vista = this.vista();
    if (!vista || vista.cerrada) return false;
    return vista.tuTurno && !this.yaContestaste;
  }

  /** Lo que queda de mecha, para pintarlo como una cuenta atrás. */
  get mecha(): number {
    return this.vista()?.mecha ?? 0;
  }

  /** Tu racha en la ráfaga, que es lo que multiplica. */
  get racha(): number {
    return this.vista()?.racha ?? 0;
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

