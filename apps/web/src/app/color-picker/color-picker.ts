import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-color-picker',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.css'
})
export class ColorPicker {
  hexInput = '#00ff00';
  r = 0; g = 255; b = 0;
  h = 120; s = 100; l = 50;
  copied = false;
  palette: string[] = [];

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {
    this.generatePalette();
  }

  onHexChange(): void {
    const hex = this.hexInput.replace('#', '');
    if (hex.length !== 6) return;
    this.r = parseInt(hex.substring(0, 2), 16);
    this.g = parseInt(hex.substring(2, 4), 16);
    this.b = parseInt(hex.substring(4, 6), 16);
    this.rgbToHsl();
    this.generatePalette();
  }

  onRgbChange(): void {
    this.r = Math.max(0, Math.min(255, this.r || 0));
    this.g = Math.max(0, Math.min(255, this.g || 0));
    this.b = Math.max(0, Math.min(255, this.b || 0));
    this.hexInput = '#' + [this.r, this.g, this.b].map(c => c.toString(16).padStart(2, '0')).join('');
    this.rgbToHsl();
    this.generatePalette();
  }

  onHslChange(): void {
    this.h = Math.max(0, Math.min(360, this.h || 0));
    this.s = Math.max(0, Math.min(100, this.s || 0));
    this.l = Math.max(0, Math.min(100, this.l || 0));
    this.hslToRgb();
    this.hexInput = '#' + [this.r, this.g, this.b].map(c => c.toString(16).padStart(2, '0')).join('');
    this.generatePalette();
  }

  onPickerChange(event: Event): void {
    this.hexInput = (event.target as HTMLInputElement).value;
    this.onHexChange();
  }

  private rgbToHsl(): void {
    const r = this.r / 255, g = this.g / 255, b = this.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    this.h = Math.round(h * 360);
    this.s = Math.round(s * 100);
    this.l = Math.round(l * 100);
  }

  private hslToRgb(): void {
    const h = this.h / 360, s = this.s / 100, l = this.l / 100;
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    this.r = Math.round(r * 255);
    this.g = Math.round(g * 255);
    this.b = Math.round(b * 255);
  }

  generatePalette(): void {
    this.palette = [];
    for (let i = 10; i <= 90; i += 10) {
      const hex = this.hslToHex(this.h, this.s, i);
      this.palette.push(hex);
    }
  }

  private hslToHex(h: number, s: number, l: number): string {
    const hNorm = h / 360, sNorm = s / 100, lNorm = l / 100;
    let r: number, g: number, b: number;
    if (sNorm === 0) {
      r = g = b = lNorm;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;
      r = hue2rgb(p, q, hNorm + 1 / 3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1 / 3);
    }
    return '#' + [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
      .map(c => c.toString(16).padStart(2, '0')).join('');
  }

  get rgbString(): string {
    return `rgb(${this.r}, ${this.g}, ${this.b})`;
  }

  get hslString(): string {
    return `hsl(${this.h}, ${this.s}%, ${this.l}%)`;
  }

  async copyValue(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    } catch {}
  }

  randomColor(): void {
    this.r = Math.floor(Math.random() * 256);
    this.g = Math.floor(Math.random() * 256);
    this.b = Math.floor(Math.random() * 256);
    this.onRgbChange();
  }
}
