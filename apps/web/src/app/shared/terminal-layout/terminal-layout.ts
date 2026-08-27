import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-terminal-layout',
  imports: [CommonModule],
  templateUrl: './terminal-layout.html',
  styleUrl: './terminal-layout.css'
})
export class TerminalLayout {
  @Input() title = 'Oscar Blanco — Terminal';
  @Input() showStatusBar = true;

  menuOpen = false;

  constructor(private router: Router, public i18n: I18nService) {}

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenuIfOpen(): void {
    if (this.menuOpen) {
      this.menuOpen = false;
    }
  }

  navigate(path: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate([path]);
  }
}
