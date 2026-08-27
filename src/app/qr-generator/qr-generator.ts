import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';
import QRCode from 'qrcode';

type Correction = 'L' | 'M' | 'Q' | 'H';

/** Los formatos que la gente mete en un QR y nunca recuerda cómo se escriben. */
interface Preset {
  id: string;
  label: string;
  plantilla: string;
}

@Component({
  selector: 'app-qr-generator',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.css',
})
export class QrGenerator {
  inputText = '';
  qrDataUrl = '';
  copied = false;
  errorMessage = '';

  size = 400;
  correction: Correction = 'M';
  transparent = false;

  readonly sizes = [200, 400, 800, 1200];
  readonly presets: Preset[] = [
    { id: 'url', label: 'URL', plantilla: 'https://' },
    { id: 'wifi', label: 'WiFi', plantilla: 'WIFI:T:WPA;S:NOMBRE_RED;P:CONTRASENA;;' },
    { id: 'mail', label: 'Email', plantilla: 'mailto:alguien@ejemplo.com?subject=Hola' },
    { id: 'tel', label: 'Tel', plantilla: 'tel:+34600000000' },
    { id: 'sms', label: 'SMS', plantilla: 'SMSTO:+34600000000:Hola' },
    { id: 'geo', label: 'Mapa', plantilla: 'geo:40.4168,-3.7038' },
    { id: 'vcard', label: 'vCard', plantilla: 'BEGIN:VCARD\nVERSION:3.0\nN:Apellidos;Nombre\nTEL:+34600000000\nEMAIL:alguien@ejemplo.com\nEND:VCARD' },
  ];

  /** El temporizador que espera a que dejes de escribir. */
  private pendiente?: ReturnType<typeof setTimeout>;

  constructor(
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
  ) {}

  /** Se dibuja solo mientras escribes; pulsar un botón para verlo sobra. */
  onTextChange(): void {
    if (this.pendiente) clearTimeout(this.pendiente);
    this.pendiente = setTimeout(() => this.generateQR(), 260);
  }

  usePreset(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.inputText = preset.plantilla;
    this.generateQR();
  }

  async generateQR(): Promise<void> {
    const texto = this.inputText.trim();
    if (!texto) {
      this.qrDataUrl = '';
      this.errorMessage = '';
      this.cdr.detectChanges();
      return;
    }

    try {
      this.qrDataUrl = await QRCode.toDataURL(texto, {
        width: Number(this.size),
        margin: 2,
        errorCorrectionLevel: this.correction,
        color: {
          dark: '#000000',
          // Un QR con fondo transparente se puede pegar sobre cualquier cosa.
          light: this.transparent ? '#0000' : '#ffffff',
        },
      });
      this.errorMessage = '';
    } catch {
      // El QR tiene un tope de datos: pasado ese punto no hay versión que valga.
      this.qrDataUrl = '';
      this.errorMessage = this.i18n.t('qr.tooLong');
    }
    this.cdr.detectChanges();
  }

  downloadQR(): void {
    if (!this.qrDataUrl) return;
    const link = document.createElement('a');
    link.href = this.qrDataUrl;
    link.download = `qr-${this.size}.png`;
    link.click();
  }

  async copyQR(): Promise<void> {
    if (!this.qrDataUrl) return;
    try {
      const blob = await (await fetch(this.qrDataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.copied = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 1400);
    } catch {
      // Copiar imágenes no está en todos los navegadores; queda la descarga.
      this.errorMessage = this.i18n.t('qr.copyFailed');
      this.cdr.detectChanges();
    }
  }

  clear(): void {
    this.inputText = '';
    this.qrDataUrl = '';
    this.errorMessage = '';
  }
}
