import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TerminalLayout } from '../../shared/terminal-layout/terminal-layout';
import { RoomsApiService } from '../../api/rooms-api.service';

/**
 * En qué Scrum Poker quieres entrar.
 *
 * Son el mismo juego por dentro -las mismas cartas, los mismos votos y las
 * mismas cuentas- pintados de dos maneras.
 *
 * La versión se decide **al abrir la mesa**, y quien llega invitado no la
 * elige: se le lleva a la que abrió quien invita. Una mesa en la que cada uno
 * ve una pantalla distinta no es una mesa compartida, y además el crupier solo
 * existe en una de las dos.
 */
@Component({
  selector: 'app-elegir-poker',
  imports: [TerminalLayout],
  templateUrl: './elegir.html',
  styleUrl: './elegir.css',
})
export class ElegirPoker implements OnInit {
  /** La sala a la que te han invitado, si vienes de un enlace. */
  readonly invitacion = signal('');
  /** Mientras se mira a qué versión pertenece esa sala. */
  readonly mirando = signal(false);

  constructor(
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
    private readonly rooms: RoomsApiService,
  ) {}

  ngOnInit(): void {
    const params = this.ruta.snapshot.queryParamMap;
    // Las dos versiones nombran distinto su parámetro, y los enlaces viejos
    // andan por ahí: se admiten los dos.
    const sala = params.get('sala') ?? params.get('room') ?? '';
    this.invitacion.set(sala);
    if (sala) void this.llevarALaSuya(sala);
  }

  clasica(): void {
    void this.router.navigate(['/name-screen'], this.con('room'));
  }

  mesa(): void {
    void this.router.navigate(['/scrum-poker/entrar'], this.con('sala'));
  }

  /**
   * Manda a quien llega invitado a la versión de esa sala.
   *
   * Si no se puede averiguar -sala borrada, servidor caído- se le deja elegir:
   * más vale una pantalla de más que un callejón sin salida.
   */
  private async llevarALaSuya(sala: string): Promise<void> {
    this.mirando.set(true);
    try {
      const info = await this.rooms.info(sala);
      if (info.config['version'] === 'mesa') {
        this.mesa();
      } else {
        this.clasica();
      }
    } catch {
      this.mirando.set(false);
    }
  }

  private con(nombre: 'sala' | 'room'): { queryParams?: Record<string, string> } {
    const sala = this.invitacion();
    return sala ? { queryParams: { [nombre]: sala } } : {};
  }
}
