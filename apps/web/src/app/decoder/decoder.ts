import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

type Mode = 'base64' | 'url' | 'html' | 'jwt' | 'hex' | 'binary' | 'md5hash' | 'unicode';
type Direction = 'encode' | 'decode';

@Component({
  selector: 'app-decoder',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './decoder.html',
  styleUrl: './decoder.css'
})
export class Decoder {
  inputText = '';
  outputText = '';
  mode: Mode = 'base64';
  direction: Direction = 'encode';
  copied = false;
  errorMessage = '';

  modes: { value: Mode; label: string }[] = [
    { value: 'base64', label: 'Base64' },
    { value: 'url', label: 'URL Encode' },
    { value: 'html', label: 'HTML Entities' },
    { value: 'hex', label: 'Hex' },
    { value: 'binary', label: 'Binary' },
    { value: 'unicode', label: 'Unicode Escape' },
    { value: 'jwt', label: 'JWT Decode' }
  ];

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  process(): void {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Introduce un texto';
      this.outputText = '';
      return;
    }

    this.errorMessage = '';

    try {
      if (this.direction === 'encode') {
        this.outputText = this.encode(this.inputText);
      } else {
        this.outputText = this.decode(this.inputText);
      }
    } catch {
      this.errorMessage = 'Error al procesar. Verifica que el input sea válido.';
      this.outputText = '';
    }
    this.cdr.detectChanges();
  }

  private encode(text: string): string {
    switch (this.mode) {
      case 'base64':
        return btoa(unescape(encodeURIComponent(text)));
      case 'url':
        return encodeURIComponent(text);
      case 'html':
        return text.replace(/[&<>"']/g, (char) => {
          const entities: Record<string, string> = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
          };
          return entities[char] || char;
        });
      case 'hex':
        return Array.from(text).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
      case 'binary':
        return Array.from(text).map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      case 'unicode':
        return Array.from(text).map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      case 'jwt':
        this.errorMessage = 'JWT solo soporta decodificación';
        return '';
      default:
        return text;
    }
  }

  private decode(text: string): string {
    switch (this.mode) {
      case 'base64':
        return decodeURIComponent(escape(atob(text.trim())));
      case 'url':
        return decodeURIComponent(text);
      case 'html':
        const doc = new DOMParser().parseFromString(text, 'text/html');
        return doc.body.textContent || '';
      case 'hex':
        return text.trim().split(/\s+/).map(h => String.fromCharCode(parseInt(h, 16))).join('');
      case 'binary':
        return text.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('');
      case 'unicode':
        return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      case 'jwt':
        return this.decodeJWT(text.trim());
      default:
        return text;
    }
  }

  private decodeJWT(token: string): string {
    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('JWT inválido');
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    return JSON.stringify({ header, payload }, null, 2);
  }

  async copyOutput(): Promise<void> {
    if (!this.outputText) return;
    try {
      await navigator.clipboard.writeText(this.outputText);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    } catch {
      this.errorMessage = 'No se pudo copiar';
      this.cdr.detectChanges();
    }
  }

  async copyInput(): Promise<void> {
    if (!this.inputText) return;
    try {
      await navigator.clipboard.writeText(this.inputText);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    } catch {
      this.errorMessage = 'No se pudo copiar';
      this.cdr.detectChanges();
    }
  }

  clear(): void {
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
    this.copied = false;
  }

  onModeChange(): void {
    if (this.mode === 'jwt') {
      this.direction = 'decode';
    }
    this.inputText = '';
    this.outputText = '';
    this.errorMessage = '';
    this.copied = false;
  }
}
