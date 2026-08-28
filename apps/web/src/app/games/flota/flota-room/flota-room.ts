import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { FlotaBoard } from '../flota-board/flota-board';
import { FlotaRoomService } from '../flota-room.service';
import { paseDe } from '../../pase-guardado';
import {
  COLOCACION_VACIA,
  completa,
  girar,
  poner,
  quitarUltimo,
  siguienteTamano,
  vaciar,
} from '../colocacion';
import { createRng } from '@devweb/shared/engine/rng';
import { flotaAleatoria } from '@devweb/shared/games/flota/bot';
import { tableroVacio } from '@devweb/shared/games/flota/reglas';
import type { Signal } from '@angular/core';
import type { Colocacion } from '../colocacion';
import type { Casilla, FlotaView } from '@devweb/shared/games/flota/tipos';

/**
 * La mesa de Hundir la flota.
 *
 * Se coloca la flota, se dispara y se ve el resultado. Ni una regla vive aquí:
 * lo único que hace esta pantalla es mandar jugadas y pintar lo que vuelve. Si
 * algo no se puede hacer, lo dice el servidor, no un `if` de este fichero.
 */
@Component({
  selector: 'app-flota-room',
  imports: [CommonModule, FlotaBoard, TerminalLayout],
  templateUrl: './flota-room.html',
  styleUrl: './flota-room.css',
})
export class FlotaRoom implements OnInit, OnDestroy {
  /**
   * Se asignan en el constructor y no en la declaración: con inyección por
   * constructor, `this.sala` todavía no existe cuando corren los campos.
   */
  readonly vista: Signal<FlotaView | null>;
  readonly error: Signal<string | null>;

  readonly colocacion = signal<Colocacion>(COLOCACION_VACIA);
  readonly enlaceCopiado = signal(false);
  readonly roomId = signal('');

  readonly tableroVacio = tableroVacio();

  constructor(
    private readonly sala: FlotaRoomService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {
    this.vista = sala.vista;
    this.error = sala.error;
  }

  ngOnInit(): void {
    const sala = this.ruta.snapshot.queryParamMap.get('sala') ?? '';
    const pase = sala ? paseDe(sala) : null;

    // Sin pase no hay asiento, y sin asiento el WebSocket se cierra en el
    // saludo: mejor volver al lobby que enseñar una mesa que no se puede tocar.
    if (!pase) {
      void this.router.navigate(['/juegos/flota'], {
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

  // --- Colocación ---------------------------------------------------------

  get tamanoPendiente(): number | null {
    return siguienteTamano(this.colocacion());
  }

  get flotaCompleta(): boolean {
    return completa(this.colocacion());
  }

  get orientacion(): string {
    return this.colocacion().orientacion === 'horizontal' ? 'horizontal' : 'vertical';
  }

  colocarEn(celda: { fila: number; columna: number }): void {
    this.colocacion.update((actual) => poner(actual, celda.fila, celda.columna));
  }

  girarBarco(): void {
    this.colocacion.update(girar);
  }

  deshacer(): void {
    this.colocacion.update(quitarUltimo);
  }

  vaciarFlota(): void {
    this.colocacion.update(vaciar);
  }

  /** La misma función que usa el bot para colocarse: no hay dos formas de esto. */
  alAzar(): void {
    const barcos = flotaAleatoria(createRng(Date.now()));
    this.colocacion.set({ orientacion: 'horizontal', puestos: barcos });
  }

  desplegar(): void {
    if (!this.flotaCompleta) return;
    this.sala.desplegar(this.colocacion().puestos);
  }

  // --- Combate ------------------------------------------------------------

  get esMiTurno(): boolean {
    const vista = this.vista();
    return vista?.fase === 'combate' && vista.turno === this.sala.miAsiento;
  }

  get miTablero(): readonly (Casilla | null)[] {
    return this.vista()?.tuyo?.recibidos ?? this.tableroVacio;
  }

  get tableroRival(): readonly (Casilla | null)[] {
    return this.vista()?.disparosSobreRival ?? this.tableroVacio;
  }

  disparar(celda: { fila: number; columna: number }): void {
    this.sala.disparar(celda.fila, celda.columna);
  }

  rendirse(): void {
    this.sala.rendirse();
  }

  get heGanado(): boolean {
    return this.vista()?.ganador === this.sala.miAsiento;
  }

  get nombreDelRival(): string {
    const rivalId = this.vista()?.rivalId;
    return this.sala.mesa.find((asiento) => asiento.id === rivalId)?.displayName ?? 'El rival';
  }

  /** Si todavía falta alguien por desplegar su flota. */
  get esperandoAlRival(): boolean {
    const vista = this.vista();
    return (
      vista?.fase === 'colocacion' &&
      vista.desplegados.includes(this.sala.miAsiento) &&
      vista.desplegados.length < 2
    );
  }

  async copiarEnlace(): Promise<void> {
    const enlace = `${location.origin}/juegos/flota?sala=${this.roomId()}`;
    try {
      await navigator.clipboard.writeText(enlace);
      this.enlaceCopiado.set(true);
    } catch {
      // Sin permiso de portapapeles el enlace sigue estando en la barra de
      // direcciones; no merece un aviso de error.
    }
  }

  volver(): void {
    void this.router.navigate(['/juegos/flota']);
  }
}
