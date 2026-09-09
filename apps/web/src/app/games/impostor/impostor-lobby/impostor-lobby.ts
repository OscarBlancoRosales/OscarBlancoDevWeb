import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { AuthApiService } from '../../../api/auth-api.service';
import { ImpostorRoomService } from '../impostor-room.service';
import { guardarPase } from '../../pase-guardado';
import { ELENCO, caraPorId, fotoDeLaCara } from '@devweb/shared/games/impostor/caras';
import { TEMAS, TEMA_MEZCLA } from '@devweb/shared/games/impostor/temas';
import type { Cara } from '@devweb/shared/games/impostor/caras';
import { SEGUNDOS_DE_DEBATE } from '@devweb/shared/games/impostor/tipos';
import type { Modo } from '@devweb/shared/games/impostor/tipos';

interface OpcionDeModo {
  readonly id: Modo;
  readonly nombre: string;
  readonly descripcion: string;
}

const MODOS: readonly OpcionDeModo[] = [
  {
    id: 'clasico',
    nombre: 'Clásico',
    descripcion:
      'Al impostor no le dan palabra. Si le pilláis, gana la mesa; si echáis a un inocente, gana él.',
  },
  {
    id: 'revancha',
    nombre: 'La última palabra',
    descripcion:
      'Igual que el clásico, pero pillarle no basta: le queda un disparo. Si acierta la palabra, gana él.',
  },
  {
    id: 'infiltrado',
    nombre: 'Infiltrado',
    descripcion:
      'Al impostor le dan una palabra parecida y no le dicen que lo es. Nadie miente a propósito y aun así uno sobra.',
  },
];

/**
 * Puerta de entrada al Impostor.
 *
 * Igual que el resto de los juegos: quien tiene cuenta abre la mesa y decide
 * las reglas, y quien llega por el enlace solo pone su nombre y su cara.
 */
@Component({
  selector: 'app-impostor-lobby',
  imports: [CommonModule, FormsModule, RouterLink, TerminalLayout],
  templateUrl: './impostor-lobby.html',
  styleUrl: './impostor-lobby.css',
})
export class ImpostorLobby implements OnInit, OnDestroy {
  readonly modos = MODOS;
  readonly temas = TEMAS;
  readonly elenco = ELENCO;
  readonly mezcla = TEMA_MEZCLA;

  readonly conSesion = signal(false);
  readonly sesionResuelta = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly invitacion = signal('');

  nombreSala = 'Aquí miente alguien';
  nombreJugador = '';
  tema = TEMA_MEZCLA;
  modo: Modo = 'clasico';
  vueltas: 1 | 2 = 1;
  impostores: 1 | 2 = 1;
  /** Lo que se deja hablar antes de votar. Cero es «hasta que yo diga». */
  segundosDebate = SEGUNDOS_DE_DEBATE;
  /** Cuántos asientos rellena la casa. Con menos de tres no hay juego. */
  bots = 2;
  /** La cara con la que te sientas. Empieza elegida para no dar pereza. */
  cara: string = ELENCO[0]?.id ?? 'troll';

  private suscripcion?: Subscription;

  constructor(
    private readonly sala: ImpostorRoomService,
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

  fotoDe(id: string): string {
    return fotoDeLaCara(id);
  }

  get elegida(): Cara | null {
    return caraPorId(this.cara);
  }

  /** Dos impostores en una mesa corta es media mesa mintiendo. */
  get cabenDos(): boolean {
    return this.bots + 1 >= 6;
  }

  async crear(): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');

    try {
      const pase = await this.sala.crear(
        this.nombreSala.trim() || 'Aquí miente alguien',
        this.nombreJugador.trim() || 'Anfitrión',
        {
          tema: this.tema,
          modo: this.modo,
          vueltas: this.vueltas,
          impostores: this.cabenDos ? this.impostores : 1,
          segundosDebate: this.segundosDebate,
          bots: this.bots,
        },
        this.cara,
      );
      guardarPase(pase);
      await this.router.navigate(['/juegos/impostor/mesa'], {
        queryParams: { sala: pase.roomId },
      });
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
        this.cara,
      );
      guardarPase(pase);
      await this.router.navigate(['/juegos/impostor/mesa'], {
        queryParams: { sala: pase.roomId },
      });
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
