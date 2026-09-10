import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TerminalLayout } from '../../shared/terminal-layout/terminal-layout';
import { AuthApiService } from '../../api/auth-api.service';
import { MesaService } from '../mesa.service';
import { guardarPaseDeMesa } from '../mesa/mesa';
import { RoomsApiService } from '../../api/rooms-api.service';
import { AVATARES, avatarPorId, fotoDelAvatar } from '@devweb/shared/games/poker-reparto';
import type { AvatarDeMesa } from '@devweb/shared/games/poker-reparto';

/**
 * La puerta de la mesa de poker.
 *
 * Aquí se pone el nombre y se elige la cara **antes** de sentarse, como en
 * cualquier juego de mesa: entrar y luego buscar dónde se cambia el avatar es
 * lo que hace que nadie lo cambie nunca.
 */
@Component({
  selector: 'app-entrar-mesa',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './entrar.html',
  styleUrl: './entrar.css',
})
export class EntrarEnLaMesa implements OnInit, OnDestroy {
  readonly leyendas = AVATARES.filter((uno) => uno.grupo === 'leyendas');
  readonly iconos = AVATARES.filter((uno) => uno.grupo === 'iconos');

  readonly conSesion = signal(false);
  readonly sesionResuelta = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly invitacion = signal('');
  /** Los que ya tiene alguien sentado. No se pueden coger. */
  readonly cogidos = signal<readonly string[]>([]);

  nombreSala = 'Estimando lo de siempre';
  nombreJugador = '';
  avatar = AVATARES[0].id;

  private sesion?: Subscription;

  constructor(
    private readonly sala: MesaService,
    private readonly auth: AuthApiService,
    private readonly rooms: RoomsApiService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const sala = this.ruta.snapshot.queryParamMap.get('sala') ?? '';
    this.invitacion.set(sala);
    this.sesion = this.auth.settledUser$.subscribe((user) => {
      this.conSesion.set(!!user);
      this.sesionResuelta.set(true);
    });
    if (sala) void this.mirarQuienHay(sala);
  }

  /**
   * Qué caras están cogidas ya en esa mesa.
   *
   * Repartir por detrás al que llega tarde no basta: eligiendo a ciegas te
   * llevas una sorpresa al sentarte. Aquí se ven cogidas y no se pueden pulsar.
   */
  private async mirarQuienHay(sala: string): Promise<void> {
    try {
      const info = await this.rooms.info(sala);
      const puestos = info.seats
        .map((asiento) => asiento.meta?.['avatar'])
        .filter((avatar): avatar is string => typeof avatar === 'string');
      this.cogidos.set(puestos);
      if (puestos.includes(this.avatar)) this.avatar = this.primeroLibre();
    } catch {
      // Si no se puede mirar, se elige a ciegas y el reparto lo arregla luego.
    }
  }

  estaCogido(id: string): boolean {
    return this.cogidos().includes(id);
  }

  private primeroLibre(): string {
    return AVATARES.find((uno) => !this.estaCogido(uno.id))?.id ?? AVATARES[0].id;
  }

  ngOnDestroy(): void {
    this.sesion?.unsubscribe();
  }

  fotoDe(id: string): string {
    return fotoDelAvatar(id);
  }

  get elegido(): AvatarDeMesa | null {
    return avatarPorId(this.avatar);
  }

  async crear(): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');

    try {
      const pase = await this.sala.crear(
        this.nombreSala.trim() || 'Estimando lo de siempre',
        this.nombreJugador.trim() || 'Anfitrión',
        this.avatar,
      );
      guardarPaseDeMesa(pase);
      await this.router.navigate(['/scrum-poker/mesa'], { queryParams: { sala: pase.roomId } });
    } catch (fallo) {
      this.error.set(AuthApiService.mensajeDe(fallo));
    } finally {
      this.trabajando.set(false);
    }
  }

  async unirse(): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');

    try {
      const roomId = this.invitacion();
      const pase = await this.sala.unirse(
        roomId,
        this.nombreJugador.trim() || 'Invitado',
        this.avatar,
      );
      guardarPaseDeMesa({ roomId, ...pase });
      await this.router.navigate(['/scrum-poker/mesa'], { queryParams: { sala: roomId } });
    } catch (fallo) {
      this.error.set(AuthApiService.mensajeDe(fallo));
    } finally {
      this.trabajando.set(false);
    }
  }

  volver(): void {
    void this.router.navigate(['/scrum-poker']);
  }
}
