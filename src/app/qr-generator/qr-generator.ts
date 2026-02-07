import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-generator',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.css'
})
export class QrGenerator {
  inputText = '';
  qrDataUrl = '';
  isGenerating = false;
  copied = false;
  errorMessage = '';

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  async generateQR(): Promise<void> {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Introduce un texto o URL';
      return;
    }

    this.isGenerating = true;
    this.errorMessage = '';

    try {
      this.qrDataUrl = await QRCode.toDataURL(this.inputText.trim(), {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
      this.cdr.detectChanges();
    } catch (err) {
      this.errorMessage = 'Error al generar el QR';
    } finally {
      this.isGenerating = false;
      this.cdr.detectChanges();
    }
  }

  downloadQR(): void {
    if (!this.qrDataUrl) return;
    const link = document.createElement('a');
    link.href = this.qrDataUrl;
    link.download = 'qr-code.png';
    link.click();
  }

  async copyQR(): Promise<void> {
    if (!this.qrDataUrl) return;
    try {
      const response = await fetch(this.qrDataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    } catch {
      this.errorMessage = 'No se pudo copiar la imagen';
      this.cdr.detectChanges();
    }
  }

  clear(): void {
    this.inputText = '';
    this.qrDataUrl = '';
    this.errorMessage = '';
    this.copied = false;
  }
}
