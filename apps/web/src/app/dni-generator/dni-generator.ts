import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-dni-generator',
  imports: [CommonModule, TerminalLayout],
  templateUrl: './dni-generator.html',
  styleUrl: './dni-generator.css',
})
export class DniGenerator {
  currentDni: string = '';
  showCopiedMessage = false;
  isGenerating = false;

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {
    // Generar DNI inicial sin delay
    this.currentDni = this.generateRandomDni();
  }

  generateNewDni(): void {
    this.isGenerating = true;
    this.cdr.detectChanges();
    
    // Simular delay para efecto visual
    setTimeout(() => {
      this.currentDni = this.generateRandomDni();
      this.isGenerating = false;
      this.showCopiedMessage = false;
      this.cdr.detectChanges();
    }, 300);
  }

  private generateRandomDni(): string {
    // Generar número aleatorio de 8 dígitos
    const randomNumber = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    
    // Calcular letra de control DNI español
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const remainder = parseInt(randomNumber) % 23;
    const controlLetter = letters[remainder];
    
    return `${randomNumber}${controlLetter}`;
  }

  copyToClipboard(): void {
    if (!this.currentDni) return;
    
    navigator.clipboard.writeText(this.currentDni).then(() => {
      this.showCopiedMessage = true;
      this.cdr.detectChanges();
      
      // Ocultar mensaje después de 2 segundos
      setTimeout(() => {
        this.showCopiedMessage = false;
        this.cdr.detectChanges();
      }, 2000);
    }).catch(err => {
      console.error('Error al copiar:', err);
    });
  }
}
