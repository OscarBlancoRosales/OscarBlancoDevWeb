import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';

@Component({
  selector: 'app-name-screen',
  imports: [CommonModule, ReactiveFormsModule, TerminalLayout],
  templateUrl: './name-screen.html',
  styleUrl: './name-screen.css',
})
export class NameScreen implements OnInit {
  nameForm: FormGroup;
  isLoading = false;
  showSuccess = false;
  roomId = '';
  inviteCode = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
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
    
    // Si NO es invitado Y NO está autenticado, redirigir a login
    if (!this.isInvited && !this.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }

    // Verificar si viene por invitación primero
    this.checkInvitation();
    
    // Generar o obtener ID de sala
    this.generateRoomInfo();
  }

  get playerName() {
    return this.nameForm.get('playerName');
  }

  private generateRoomInfo(): void {
    // Si ya tenemos roomId de la invitación, usarlo
    if (this.roomId) {
      this.inviteCode = this.generateInviteCode();
      return;
    }
    
    // Admin siempre crea una nueva sala
    if (this.isAuthenticated()) {
      this.roomId = this.generateRoomId();
      localStorage.setItem('current_room_id', this.roomId);
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

  private isAuthenticated(): boolean {
    return localStorage.getItem('auth_token') !== null;
  }
}
