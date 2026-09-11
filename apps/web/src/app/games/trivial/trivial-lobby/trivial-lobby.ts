
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { AuthApiService } from '../../../api/auth-api.service';
import { RoomsApiService } from '../../../api/rooms-api.service';
import { TrivialRoomService } from '../trivial-room.service';
import { guardarPase } from '../../pase-guardado';
import { REPARTO, fotoDelPersonaje, personajePorId } from '@devweb/shared/games/trivial/reparto';
import type { Personaje } from '@devweb/shared/games/trivial/reparto';
import type { NivelBot } from '@devweb/shared/games/trivial/tipos';

interface OpcionDeRival {
  readonly id: NivelBot | 'persona';
  readonly nombre: string;
  readonly descripcion: string;
}

const RIVALES: readonly OpcionDeRival[] = [
  {
    id: 'persona',
    nombre: 'Otra gente',
    descripcion: 'Se abre la mesa y se comparte el enlace. Quien entre no necesita cuenta.',
  },
  { id: 'pardillo', nombre: 'Pardillo', descripcion: 'Contesta a lo que salga. Se le gana solo.' },
  { id: 'apanado', nombre: 'Apañado', descripcion: 'Sabe lo justo. Falla lo que fallarías tú.' },
  {
    id: 'sabelotodo',
    nombre: 'Sabelotodo',
    descripcion: 'Se las sabe casi todas y contesta el primero. Duele.',
  },
];

/**
 * Puerta de entrada a El Concurso.
 *
 * Igual que el resto de los juegos: quien tiene cuenta abre la mesa y elige
 * contra quién, y quien llega por un enlace solo pone su nombre.
 */
@Component({
  selector: 'app-trivial-lobby',
  imports: [FormsModule, RouterLink, TerminalLayout],
  templateUrl: './trivial-lobby.html',
  styleUrl: './trivial-lobby.css',
})
export class TrivialLobby implements OnInit, OnDestroy {
  readonly rivales = RIVALES;

  readonly conSesion = signal(false);
  readonly sesionResuelta = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly invitacion = signal('');

  readonly reparto = REPARTO;

  nombreSala = 'Concurso de la retro';
  nombreJugador = '';
  rival: NivelBot | 'persona' = 'apanado';

  /**
   * De dónde salen las preguntas. Se elige al abrir y queda fijado en la sala.
   *
   * No se puede cambiar a mitad de programa a propósito: las preguntas se
   * congelan al crear la sala, que es lo que impide pedir otra tanda porque
   * esta no gustó.
   */
  origen: 'banco' | 'ia' = 'banco';

  /** Si el servidor tiene clave. Sin ella no se ofrece un botón que va a fallar. */
  readonly hayIa = signal(false);
  /** El personaje con el que te sientas. Empieza elegido para no dar pereza. */
  personaje: string = REPARTO[0].id;

  private suscripcion?: Subscription;

  constructor(
    private readonly sala: TrivialRoomService,
    private readonly rooms: RoomsApiService,
    private readonly auth: AuthApiService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.invitacion.set(this.ruta.snapshot.queryParamMap.get('sala') ?? '');

    void this.rooms.hayIa().then((hay) => {
      this.hayIa.set(hay);
    });

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
        this.nombreSala.trim() || 'Concurso de la retro',
        this.nombreJugador.trim() || 'Anfitrión',
        this.rival === 'persona' ? null : this.rival,
        this.personaje,
        this.origen,
      );
      guardarPase(pase);
      await this.router.navigate(['/juegos/trivial/mesa'], { queryParams: { sala: pase.roomId } });
    } catch (error) {
      this.error.set(mensajeDe(error));
    } finally {
      this.trabajando.set(false);
    }
  }

  fotoDe(id: string): string {
    return fotoDelPersonaje(id);
  }

  get elegido(): Personaje | null {
    return personajePorId(this.personaje);
  }

  async unirse(): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');

    try {
      const pase = await this.sala.unirse(
        this.invitacion(),
        this.nombreJugador.trim() || 'Concursante',
        this.personaje,
      );
      guardarPase(pase);
      await this.router.navigate(['/juegos/trivial/mesa'], { queryParams: { sala: pase.roomId } });
    } catch (error) {
      this.error.set(mensajeDe(error));
    } finally {
      this.trabajando.set(false);
    }
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se ha podido abrir la mesa.';
}
