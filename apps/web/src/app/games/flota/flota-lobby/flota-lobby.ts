import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { AuthApiService } from '../../../api/auth-api.service';
import { FlotaRoomService } from '../flota-room.service';
import { guardarPase } from '../pase-guardado';
import type { Nivel } from '@devweb/shared/games/flota/tipos';

interface OpcionDeRival {
  readonly id: Nivel | 'persona';
  readonly nombre: string;
  readonly descripcion: string;
}

const RIVALES: readonly OpcionDeRival[] = [
  {
    id: 'persona',
    nombre: 'Otra persona',
    descripcion: 'Se crea la sala y se comparte el enlace. Quien entre no necesita cuenta.',
  },
  { id: 'novato', nombre: 'Grumete', descripcion: 'Dispara donde le da. Se le gana casi solo.' },
  { id: 'marino', nombre: 'Marino', descripcion: 'En cuanto te toca un barco, va a rematarlo.' },
  {
    id: 'almirante',
    nombre: 'Almirante',
    descripcion: 'Barre el tablero en damero y remata sin fallar. Duele.',
  },
];

/**
 * Puerta de entrada a Hundir la flota.
 *
 * Dos caminos, como en el resto de los juegos: quien tiene cuenta crea la mesa
 * y elige rival, y quien llega por un enlace solo pone su nombre.
 */
@Component({
  selector: 'app-flota-lobby',
  imports: [CommonModule, FormsModule, RouterLink, TerminalLayout],
  templateUrl: './flota-lobby.html',
  styleUrl: './flota-lobby.css',
})
export class FlotaLobby implements OnInit, OnDestroy {
  readonly rivales = RIVALES;

  readonly conSesion = signal(false);
  readonly sesionResuelta = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');

  /** La sala a la que se invita, si se ha llegado por un enlace. */
  readonly invitacion = signal('');

  nombreSala = 'Mesa de guerra';
  nombreJugador = '';
  rival: Nivel | 'persona' = 'marino';

  private suscripcion?: Subscription;

  constructor(
    private readonly sala: FlotaRoomService,
    private readonly auth: AuthApiService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.invitacion.set(this.ruta.snapshot.queryParamMap.get('sala') ?? '');

    this.suscripcion = this.auth.settledUser$.subscribe((usuario) => {
      this.conSesion.set(usuario !== null);
      this.sesionResuelta.set(true);
      if (usuario && !this.nombreJugador) this.nombreJugador = usuario.displayName;
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  async crear(): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');

    try {
      const pase = await this.sala.crear(
        this.nombreSala.trim() || 'Mesa de guerra',
        this.nombreJugador.trim() || 'Anfitrión',
        this.rival === 'persona' ? null : this.rival,
      );
      guardarPase(pase);
      await this.router.navigate(['/juegos/flota/mesa'], { queryParams: { sala: pase.roomId } });
    } catch (error) {
      this.error.set(mensajeDe(error));
    } finally {
      this.trabajando.set(false);
    }
  }

  async unirse(): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');

    try {
      const pase = await this.sala.unirse(
        this.invitacion(),
        this.nombreJugador.trim() || 'Invitado',
      );
      guardarPase(pase);
      await this.router.navigate(['/juegos/flota/mesa'], { queryParams: { sala: pase.roomId } });
    } catch (error) {
      this.error.set(mensajeDe(error));
    } finally {
      this.trabajando.set(false);
    }
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se ha podido abrir la sala.';
}
