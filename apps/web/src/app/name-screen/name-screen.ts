import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { FirebaseAuthService } from '../firebase-auth.service';
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

  /** Cierto solo con sesión de Firebase confirmada. Quien crea sala es esta persona. */
  isAdmin = false;

  private sesion?: Subscription;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private auth: FirebaseAuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.nameForm = this.fb.group({
      playerName: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  isInvited = false;

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
    // Firebase restaura la sesión guardada, y actuar sobre ese null echaría a
    // la calle a quien solo estaba recargando la página.
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

  private generateRoomInfo(): void {
    // Si ya tenemos roomId (de la invitación o de una emisión anterior de la
    // sesión), usarlo. Firebase reemite al refrescar el testigo, y sin esta
    // salida la sala cambiaría de número bajo los pies del que ya la repartió.
    if (this.roomId) {
      this.inviteCode = this.generateInviteCode();
      return;
    }

    // Admin siempre crea una nueva sala
    if (this.isAdmin) {
      this.roomId = this.generateRoomId();
      localStorage.setItem('current_room_id', this.roomId);
      // Marcar que este usuario es el creador de la sala
      localStorage.setItem('is_room_creator', 'true');
    }

    // Generar código de invitación
    this.inviteCode = this.generateInviteCode();
  }

  private generateRoomId(): string {
    return 'ROOM-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  private generateInviteCode(): string {
    return window.location.origin + '/scrum-poker?room=' + this.roomId;
  }

  private checkInvitation(): void {
    const roomId = this.route.snapshot.queryParamMap.get('room');
    if (roomId) {
      this.roomId = roomId;
      localStorage.setItem('current_room_id', roomId);
      // Limpiar datos de jugador anterior para evitar entrar con nombre de otro
      localStorage.removeItem('player_name');
      localStorage.removeItem('player_id');
      // Los invitados NO son creadores de la sala
      localStorage.removeItem('is_room_creator');
    }
  }

  joinRoom(): void {
    if (this.nameForm.invalid) {
      return;
    }

    this.isLoading = true;
    const playerName = this.nameForm.get('playerName')?.value;

    // Guardar nombre del jugador y roomId
    localStorage.setItem('player_name', playerName);
    localStorage.setItem('current_room_id', this.roomId);
    // Limpiar playerId anterior para que se genere uno nuevo
    localStorage.removeItem('player_id');
    
    this.showSuccess = true;
    
    // Redirigir a la sala Scrum Poker
    setTimeout(() => {
      this.router.navigate(['/scrum-poker']);
    }, 1000);
    
    this.isLoading = false;
  }

  copyInviteLink(): void {
    navigator.clipboard.writeText(this.inviteCode).then(() => {
      // Podríamos mostrar un toast o mensaje temporal
      console.log('Enlace copiado al portapapeles');
    });
  }
}
