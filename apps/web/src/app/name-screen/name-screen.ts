import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthApiService } from '../api/auth-api.service';
import { ScrumRoomService } from '../api/scrum-room.service';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';

@Component({
  selector: 'app-name-screen',
  imports: [CommonModule, ReactiveFormsModule, TerminalLayout],
  templateUrl: './name-screen.html',
  styleUrl: './name-screen.css',
})
export class NameScreen implements OnInit, OnDestroy {
  nameForm: FormGroup;
  isLoading = false;
  showSuccess = false;
  roomId = '';
  inviteCode = '';

  /** Cierto solo con sesión confirmada. Quien crea sala es esta persona. */
  isAdmin = false;

  private sesion?: Subscription;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthApiService,
    private rooms: ScrumRoomService,
    private cdr: ChangeDetectorRef
  ) {
    this.nameForm = this.fb.group({
      playerName: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  isInvited = false;

  /** Lo que se le enseña a la persona si algo falla al crear o entrar. */
  error = '';

  ngOnInit(): void {
    // Verificar si viene por invitación (tiene parámetro room en la URL)
    const roomIdParam = this.route.snapshot.queryParamMap.get('room');
    this.isInvited = !!roomIdParam;

    // Los invitados entran con el enlace, sin cuenta: ese es justo el sentido
    // de invitar. Solo se exige sesión para CREAR sala.
    if (this.isInvited) {
      this.checkInvitation();
      this.generateRoomInfo();
      return;
    }

    // Esperamos a `settledUser$`, no a `user$`: este último vale null mientras
    // se recupera la sesión guardada, y actuar sobre ese null echaría a la
    // calle a quien solo estaba recargando la página.
    this.sesion = this.auth.settledUser$.subscribe((user) => {
      this.isAdmin = !!user;
      if (!user) {
        this.router.navigate(['/auth'], { queryParams: { next: '/name-screen' } });
        return;
      }
      this.generateRoomInfo();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sesion?.unsubscribe();
  }

  get playerName() {
    return this.nameForm.get('playerName');
  }

  /**
   * El enlace de invitación, si ya hay sala a la que invitar.
   *
   * Quien viene invitado trae la sala en la URL. Quien la crea no la tiene
   * hasta que el servidor se la da, porque el identificador lo reparte él: antes
   * se inventaba aquí un `ROOM-xxxx` y la sala nacía sola cuando alguien
   * escribía, y de ahí salían las salas sin dueño que nadie podía borrar.
   */
  private generateRoomInfo(): void {
    this.inviteCode = this.roomId
      ? `${window.location.origin}/scrum-poker?room=${this.roomId}`
      : '';
  }

  private checkInvitation(): void {
    const roomId = this.route.snapshot.queryParamMap.get('room');
    if (roomId) {
      this.roomId = roomId;
      localStorage.setItem('current_room_id', roomId);
      // Limpiar datos de jugador anterior para evitar entrar con nombre de otro
      localStorage.removeItem('player_name');
      // También el pase del asiento: con uno viejo se intentaría volver a
      // una silla de otra sala, y el servidor lo rechazaría sin decir por qué.
      localStorage.removeItem('seat_id');
      localStorage.removeItem('seat_token');
      // Los invitados NO son creadores de la sala
      localStorage.removeItem('is_room_creator');
    }
  }

  async joinRoom(): Promise<void> {
    if (this.nameForm.invalid || this.isLoading) return;

    this.isLoading = true;
    this.error = '';
    const playerName = String(this.nameForm.get('playerName')?.value ?? '');

    try {
      if (!this.roomId) {
        // Quien no viene invitado, crea. Y crear exige sesión, así que el
        // asiento queda atado a su cuenta y la sala tiene dueño.
        const sala = await this.rooms.crear(`Sala de ${playerName}`, playerName);
        this.roomId = sala.roomId;
        localStorage.setItem('seat_id', sala.seatId);
        localStorage.setItem('seat_token', sala.seatToken);
        localStorage.setItem('is_room_creator', 'true');
        this.generateRoomInfo();
      } else {
        // Invitado: el asiento se pide al entrar en la sala, con este nombre.
        localStorage.removeItem('seat_id');
        localStorage.removeItem('seat_token');
      }

      localStorage.setItem('player_name', playerName);
      localStorage.setItem('current_room_id', this.roomId);
      this.showSuccess = true;
      this.cdr.markForCheck();

      setTimeout(() => {
        void this.router.navigate(['/scrum-poker']);
      }, 1000);
    } catch (fallo) {
      this.error = AuthApiService.mensajeDe(fallo);
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  copyInviteLink(): void {
    navigator.clipboard.writeText(this.inviteCode).then(() => {
      // Podríamos mostrar un toast o mensaje temporal
      console.log('Enlace copiado al portapapeles');
    });
  }
}
