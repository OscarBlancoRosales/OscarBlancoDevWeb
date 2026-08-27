import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  imports: [CommonModule],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
})
export class Menu implements OnInit {
  showMenu = false;
  menuOpen = false;
  isAuthenticated = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Verificar si el usuario está autenticado
    this.isAuthenticated = this.checkAuthentication();
    // Mostrar menú siempre
    this.showMenu = true;
  }
  
  private checkAuthentication(): boolean {
    return localStorage.getItem('auth_token') !== null;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenuIfOpen(): void {
    if (this.menuOpen) {
      this.menuOpen = false;
    }
  }

  navigateToConsole(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate(['/']);
  }

  navigateToScrumPoker(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate(['/auth']);
  }

  navigateToDniGenerator(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate(['/dni-generator']);
  }

  navigateToQrGenerator(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate(['/qr-generator']);
  }

  navigateToDecoder(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate(['/decoder']);
  }

  navigateToFormatter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate(['/formatter']);
  }

  clearSession(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    localStorage.clear();
    alert('Sesión limpiada. Ahora deberás hacer login para acceder a Scrum Poker.');
  }
}
