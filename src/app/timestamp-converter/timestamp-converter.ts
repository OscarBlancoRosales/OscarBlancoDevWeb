import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

interface TimestampFormat {
  label: string;
  value: string;
}

const DOTNET_EPOCH_OFFSET = 621355968000000000n;
const TICKS_PER_MS = 10000n;

@Component({
  selector: 'app-timestamp-converter',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './timestamp-converter.html',
  styleUrl: './timestamp-converter.css'
})
export class TimestampConverter {
  // Picker fields (native date + time inputs)
  pickerDate = '';   // YYYY-MM-DD for <input type="date">
  pickerTime = '';   // HH:mm for <input type="time">

  // Text input conversion
  inputValue = '';
  inputType = 'unix';
  convertedFormats: TimestampFormat[] = [];
  errorMessage = '';
  copiedLabel = '';

  inputTypes = [
    { value: 'unix', label: 'Unix (s)' },
    { value: 'millis', label: 'Millis (ms)' },
    { value: 'ticks', label: '.NET Ticks' },
    { value: 'iso', label: 'ISO 8601' }
  ];

  quickTimestamps = [
    { label: 'Ahora', offset: 0 },
    { label: '-1h', offset: -3600 },
    { label: '-24h', offset: -86400 },
    { label: '-7d', offset: -604800 },
    { label: '-30d', offset: -2592000 },
    { label: '+1h', offset: 3600 },
    { label: '+24h', offset: 86400 },
    { label: '+7d', offset: 604800 }
  ];

  // Picker results
  pickerFormats: TimestampFormat[] = [];

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {
    this.setPickerNow();
  }

  setPickerNow(): void {
    const now = new Date();
    this.pickerDate = this.toDateInputValue(now);
    this.pickerTime = this.toTimeInputValue(now);
    this.convertPicker();
  }

  convertPicker(): void {
    if (!this.pickerDate) {
      this.pickerFormats = [];
      return;
    }
    const time = this.pickerTime || '00:00';
    const date = new Date(this.pickerDate + 'T' + time + ':00');
    if (isNaN(date.getTime())) {
      this.pickerFormats = [];
      return;
    }
    this.pickerFormats = this.buildFormats(date);
  }

  private toDateInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toTimeInputValue(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private formatSpanishDate(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}-${m}-${y} ${h}:${min}`;
  }

  private buildFormats(date: Date): TimestampFormat[] {
    const ms = date.getTime();
    const unix = Math.floor(ms / 1000);
    const ticks = BigInt(ms) * TICKS_PER_MS + DOTNET_EPOCH_OFFSET;
    const iso = date.toISOString();
    const utc = iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    const local = this.formatSpanishDate(date);
    const relative = this.getRelativeTime(date);
    const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' });

    return [
      { label: 'Unix (segundos)', value: unix.toString() },
      { label: 'Millis (Java/JS)', value: ms.toString() },
      { label: '.NET Ticks', value: ticks.toString() },
      { label: 'ISO 8601', value: iso },
      { label: 'UTC', value: utc },
      { label: 'Local (ES)', value: local },
      { label: 'Día', value: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1) },
      { label: 'Relativo', value: relative }
    ];
  }

  convert(): void {
    this.errorMessage = '';
    this.convertedFormats = [];
    if (!this.inputValue.trim()) return;

    try {
      const date = this.parseInput();
      if (!date || isNaN(date.getTime())) {
        this.errorMessage = 'Valor inválido para el formato seleccionado';
        return;
      }
      this.convertedFormats = this.buildFormats(date);
    } catch {
      this.errorMessage = 'Error al convertir. Verifica el formato.';
    }
    this.cdr.detectChanges();
  }

  private parseInput(): Date | null {
    const val = this.inputValue.trim();

    switch (this.inputType) {
      case 'unix': {
        const n = parseInt(val, 10);
        if (isNaN(n)) return null;
        return new Date(n * 1000);
      }
      case 'millis': {
        const n = parseInt(val, 10);
        if (isNaN(n)) return null;
        return new Date(n);
      }
      case 'ticks': {
        try {
          const ticksBig = BigInt(val);
          const msBig = (ticksBig - DOTNET_EPOCH_OFFSET) / TICKS_PER_MS;
          return new Date(Number(msBig));
        } catch {
          return null;
        }
      }
      case 'iso': {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      default:
        return null;
    }
  }

  useQuick(offset: number): void {
    const now = Math.floor(Date.now() / 1000) + offset;
    this.inputType = 'unix';
    this.inputValue = now.toString();
    this.convert();
  }

  onTypeChange(): void {
    this.inputValue = '';
    this.convertedFormats = [];
    this.errorMessage = '';
    this.copiedLabel = '';
  }

  private getRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const abs = Math.abs(diff);
    const future = diff < 0;
    const prefix = future ? 'en ' : 'hace ';

    if (abs < 60000) return future ? 'en unos segundos' : 'hace unos segundos';
    if (abs < 3600000) return prefix + Math.floor(abs / 60000) + ' minutos';
    if (abs < 86400000) return prefix + Math.floor(abs / 3600000) + ' horas';
    if (abs < 2592000000) return prefix + Math.floor(abs / 86400000) + ' días';
    if (abs < 31536000000) return prefix + Math.floor(abs / 2592000000) + ' meses';
    return prefix + Math.floor(abs / 31536000000) + ' años';
  }

  async copyValue(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedLabel = label;
      setTimeout(() => { this.copiedLabel = ''; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    } catch {}
  }

  clear(): void {
    this.inputValue = '';
    this.convertedFormats = [];
    this.errorMessage = '';
    this.copiedLabel = '';
  }
}
