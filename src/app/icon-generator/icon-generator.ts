import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';
import JSZip from 'jszip';

interface IconSize {
  name: string;
  width: number;
  height: number;
  scale: number;
  folder?: string;
  idiom?: string;
}

@Component({
  selector: 'app-icon-generator',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './icon-generator.html',
  styleUrl: './icon-generator.css'
})
export class IconGenerator {
  imageLoaded = false;
  imageSrc = '';
  fileName = '';
  generating = false;
  progress = 0;
  progressText = '';
  errorMessage = '';

  private sourceImage: HTMLImageElement | null = null;

  // iOS icon sizes - complete set
  iosIcons: IconSize[] = [
    // iPhone Notification
    { name: 'Icon-20@2x', width: 40, height: 40, scale: 2, idiom: 'iphone' },
    { name: 'Icon-20@3x', width: 60, height: 60, scale: 3, idiom: 'iphone' },
    // iPhone Settings
    { name: 'Icon-29@2x', width: 58, height: 58, scale: 2, idiom: 'iphone' },
    { name: 'Icon-29@3x', width: 87, height: 87, scale: 3, idiom: 'iphone' },
    // iPhone Spotlight
    { name: 'Icon-40@2x', width: 80, height: 80, scale: 2, idiom: 'iphone' },
    { name: 'Icon-40@3x', width: 120, height: 120, scale: 3, idiom: 'iphone' },
    // iPhone App
    { name: 'Icon-60@2x', width: 120, height: 120, scale: 2, idiom: 'iphone' },
    { name: 'Icon-60@3x', width: 180, height: 180, scale: 3, idiom: 'iphone' },
    // iPad Notification
    { name: 'Icon-20', width: 20, height: 20, scale: 1, idiom: 'ipad' },
    { name: 'Icon-20@2x-ipad', width: 40, height: 40, scale: 2, idiom: 'ipad' },
    // iPad Settings
    { name: 'Icon-29', width: 29, height: 29, scale: 1, idiom: 'ipad' },
    { name: 'Icon-29@2x-ipad', width: 58, height: 58, scale: 2, idiom: 'ipad' },
    // iPad Spotlight
    { name: 'Icon-40', width: 40, height: 40, scale: 1, idiom: 'ipad' },
    { name: 'Icon-40@2x-ipad', width: 80, height: 80, scale: 2, idiom: 'ipad' },
    // iPad App
    { name: 'Icon-76', width: 76, height: 76, scale: 1, idiom: 'ipad' },
    { name: 'Icon-76@2x', width: 152, height: 152, scale: 2, idiom: 'ipad' },
    // iPad Pro
    { name: 'Icon-83.5@2x', width: 167, height: 167, scale: 2, idiom: 'ipad' },
    // App Store
    { name: 'Icon-1024', width: 1024, height: 1024, scale: 1, idiom: 'ios-marketing' },
  ];

  // Android icon sizes - legacy + adaptive
  androidIcons: IconSize[] = [
    { name: 'ic_launcher', width: 48, height: 48, scale: 1, folder: 'mipmap-mdpi' },
    { name: 'ic_launcher', width: 72, height: 72, scale: 1, folder: 'mipmap-hdpi' },
    { name: 'ic_launcher', width: 96, height: 96, scale: 1, folder: 'mipmap-xhdpi' },
    { name: 'ic_launcher', width: 144, height: 144, scale: 1, folder: 'mipmap-xxhdpi' },
    { name: 'ic_launcher', width: 192, height: 192, scale: 1, folder: 'mipmap-xxxhdpi' },
    // Round icons
    { name: 'ic_launcher_round', width: 48, height: 48, scale: 1, folder: 'mipmap-mdpi' },
    { name: 'ic_launcher_round', width: 72, height: 72, scale: 1, folder: 'mipmap-hdpi' },
    { name: 'ic_launcher_round', width: 96, height: 96, scale: 1, folder: 'mipmap-xhdpi' },
    { name: 'ic_launcher_round', width: 144, height: 144, scale: 1, folder: 'mipmap-xxhdpi' },
    { name: 'ic_launcher_round', width: 192, height: 192, scale: 1, folder: 'mipmap-xxxhdpi' },
    // Adaptive foreground (108dp with safe zone)
    { name: 'ic_launcher_foreground', width: 108, height: 108, scale: 1, folder: 'mipmap-mdpi' },
    { name: 'ic_launcher_foreground', width: 162, height: 162, scale: 1, folder: 'mipmap-hdpi' },
    { name: 'ic_launcher_foreground', width: 216, height: 216, scale: 1, folder: 'mipmap-xhdpi' },
    { name: 'ic_launcher_foreground', width: 324, height: 324, scale: 1, folder: 'mipmap-xxhdpi' },
    { name: 'ic_launcher_foreground', width: 432, height: 432, scale: 1, folder: 'mipmap-xxxhdpi' },
    // Play Store
    { name: 'playstore-icon', width: 512, height: 512, scale: 1, folder: '' },
  ];

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Selecciona un archivo de imagen válido (PNG, JPG, SVG...)';
      return;
    }

    this.fileName = file.name;
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.sourceImage = img;
        this.imageSrc = img.src;
        this.imageLoaded = true;
        this.cdr.detectChanges();
      };
      img.onerror = () => {
        this.errorMessage = 'No se pudo cargar la imagen';
        this.cdr.detectChanges();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files?.length) {
      const fakeEvent = { target: { files: event.dataTransfer.files } } as unknown as Event;
      this.onFileSelected(fakeEvent);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private resizeImage(width: number, height: number, round = false): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.sourceImage) { reject('No image'); return; }

      // Progressive downscale for quality: halve dimensions step by step
      let srcW = this.sourceImage.naturalWidth;
      let srcH = this.sourceImage.naturalHeight;

      // Start with the source image drawn onto a temp canvas
      let current = document.createElement('canvas');
      current.width = srcW;
      current.height = srcH;
      let ctx = current.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.sourceImage, 0, 0, srcW, srcH);

      // Step down by halves until we're within 2x of target
      while (srcW / 2 > width && srcH / 2 > height) {
        const halfW = Math.round(srcW / 2);
        const halfH = Math.round(srcH / 2);
        const step = document.createElement('canvas');
        step.width = halfW;
        step.height = halfH;
        const stepCtx = step.getContext('2d')!;
        stepCtx.imageSmoothingEnabled = true;
        stepCtx.imageSmoothingQuality = 'high';
        stepCtx.drawImage(current, 0, 0, halfW, halfH);
        current = step;
        srcW = halfW;
        srcH = halfH;
      }

      // Final resize to exact target
      const final = document.createElement('canvas');
      final.width = width;
      final.height = height;
      const finalCtx = final.getContext('2d')!;
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';

      if (round) {
        finalCtx.beginPath();
        finalCtx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
        finalCtx.closePath();
        finalCtx.clip();
      }

      finalCtx.drawImage(current, 0, 0, width, height);
      final.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('Failed to create blob');
      }, 'image/png');
    });
  }

  private buildContentsJson(): string {
    const images: any[] = [];

    // Map base sizes to their properties
    const sizeMap: { base: number; idioms: { idiom: string; scales: number[] }[] }[] = [
      { base: 20, idioms: [
        { idiom: 'iphone', scales: [2, 3] },
        { idiom: 'ipad', scales: [1, 2] }
      ]},
      { base: 29, idioms: [
        { idiom: 'iphone', scales: [2, 3] },
        { idiom: 'ipad', scales: [1, 2] }
      ]},
      { base: 40, idioms: [
        { idiom: 'iphone', scales: [2, 3] },
        { idiom: 'ipad', scales: [1, 2] }
      ]},
      { base: 60, idioms: [
        { idiom: 'iphone', scales: [2, 3] }
      ]},
      { base: 76, idioms: [
        { idiom: 'ipad', scales: [1, 2] }
      ]},
      { base: 83.5, idioms: [
        { idiom: 'ipad', scales: [2] }
      ]},
      { base: 1024, idioms: [
        { idiom: 'ios-marketing', scales: [1] }
      ]}
    ];

    for (const entry of sizeMap) {
      for (const idiomEntry of entry.idioms) {
        for (const scale of idiomEntry.scales) {
          const px = Math.round(entry.base * scale);
          let filename: string;
          if (entry.base === 1024) {
            filename = 'Icon-1024.png';
          } else if (idiomEntry.idiom === 'ipad' && scale > 1) {
            filename = `Icon-${entry.base}@${scale}x-ipad.png`;
          } else if (scale === 1) {
            filename = `Icon-${entry.base}.png`;
          } else {
            filename = `Icon-${entry.base}@${scale}x.png`;
          }

          images.push({
            filename,
            idiom: idiomEntry.idiom,
            scale: `${scale}x`,
            size: `${entry.base}x${entry.base}`
          });
        }
      }
    }

    return JSON.stringify({
      images: images.map(img => ({
        filename: img.filename,
        idiom: img.idiom,
        scale: img.scale,
        size: img.size
      })),
      info: {
        author: 'icon-generator',
        version: 1
      }
    }, null, 2);
  }

  async generateAll(): Promise<void> {
    if (!this.sourceImage) return;
    this.generating = true;
    this.progress = 0;
    this.progressText = 'Preparando...';
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const zip = new JSZip();
      const iosFolder = zip.folder('ios')!.folder('AppIcon.appiconset')!;
      const androidFolder = zip.folder('android')!;

      const totalIcons = this.iosIcons.length + this.androidIcons.length;
      let done = 0;

      // Generate iOS icons
      const iosGenerated = new Set<string>();
      for (const icon of this.iosIcons) {
        const filename = icon.name + '.png';
        if (!iosGenerated.has(filename)) {
          this.progressText = `iOS: ${filename} (${icon.width}x${icon.height})`;
          const blob = await this.resizeImage(icon.width, icon.height);
          iosFolder.file(filename, blob);
          iosGenerated.add(filename);
        }
        done++;
        this.progress = Math.round((done / totalIcons) * 100);
        this.cdr.detectChanges();
      }

      // Add Contents.json
      iosFolder.file('Contents.json', this.buildContentsJson());

      // Generate Android icons
      for (const icon of this.androidIcons) {
        const isRound = icon.name.includes('round');
        const filename = icon.name + '.png';

        if (icon.folder) {
          const folder = androidFolder.folder(icon.folder)!;
          this.progressText = `Android: ${icon.folder}/${filename} (${icon.width}x${icon.height})`;
          const blob = await this.resizeImage(icon.width, icon.height, isRound);
          folder.file(filename, blob);
        } else {
          this.progressText = `Android: ${filename} (${icon.width}x${icon.height})`;
          const blob = await this.resizeImage(icon.width, icon.height);
          androidFolder.file(filename, blob);
        }

        done++;
        this.progress = Math.round((done / totalIcons) * 100);
        this.cdr.detectChanges();
      }

      // Generate ZIP
      this.progressText = 'Comprimiendo ZIP...';
      this.cdr.detectChanges();

      const content = await zip.generateAsync({ type: 'blob' });

      // Download
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'app-icons.zip';
      a.click();
      URL.revokeObjectURL(url);

      this.progressText = 'Descarga completada';
      this.progress = 100;
    } catch (err: any) {
      this.errorMessage = 'Error al generar: ' + (err.message || err);
    } finally {
      this.generating = false;
      this.cdr.detectChanges();
    }
  }

  async generateIOS(): Promise<void> {
    if (!this.sourceImage) return;
    this.generating = true;
    this.progress = 0;
    this.progressText = 'Generando iOS...';
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const zip = new JSZip();
      const iosFolder = zip.folder('AppIcon.appiconset')!;
      const iosGenerated = new Set<string>();
      let done = 0;

      for (const icon of this.iosIcons) {
        const filename = icon.name + '.png';
        if (!iosGenerated.has(filename)) {
          this.progressText = `${filename} (${icon.width}x${icon.height})`;
          const blob = await this.resizeImage(icon.width, icon.height);
          iosFolder.file(filename, blob);
          iosGenerated.add(filename);
        }
        done++;
        this.progress = Math.round((done / this.iosIcons.length) * 100);
        this.cdr.detectChanges();
      }

      iosFolder.file('Contents.json', this.buildContentsJson());

      this.progressText = 'Comprimiendo...';
      this.cdr.detectChanges();
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ios-icons.zip';
      a.click();
      URL.revokeObjectURL(url);

      this.progressText = 'Descarga completada';
      this.progress = 100;
    } catch (err: any) {
      this.errorMessage = 'Error: ' + (err.message || err);
    } finally {
      this.generating = false;
      this.cdr.detectChanges();
    }
  }

  async generateAndroid(): Promise<void> {
    if (!this.sourceImage) return;
    this.generating = true;
    this.progress = 0;
    this.progressText = 'Generando Android...';
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const zip = new JSZip();
      let done = 0;

      for (const icon of this.androidIcons) {
        const isRound = icon.name.includes('round');
        const filename = icon.name + '.png';

        if (icon.folder) {
          const folder = zip.folder(icon.folder)!;
          this.progressText = `${icon.folder}/${filename} (${icon.width}x${icon.height})`;
          const blob = await this.resizeImage(icon.width, icon.height, isRound);
          folder.file(filename, blob);
        } else {
          this.progressText = `${filename} (${icon.width}x${icon.height})`;
          const blob = await this.resizeImage(icon.width, icon.height);
          zip.file(filename, blob);
        }

        done++;
        this.progress = Math.round((done / this.androidIcons.length) * 100);
        this.cdr.detectChanges();
      }

      this.progressText = 'Comprimiendo...';
      this.cdr.detectChanges();
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'android-icons.zip';
      a.click();
      URL.revokeObjectURL(url);

      this.progressText = 'Descarga completada';
      this.progress = 100;
    } catch (err: any) {
      this.errorMessage = 'Error: ' + (err.message || err);
    } finally {
      this.generating = false;
      this.cdr.detectChanges();
    }
  }

  get iosSummary(): string[] {
    const sizes = new Set<string>();
    for (const icon of this.iosIcons) {
      sizes.add(`${icon.width}x${icon.height}`);
    }
    return Array.from(sizes);
  }

  get androidSummary(): string[] {
    const items: string[] = [];
    const folders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
    for (const f of folders) {
      const icons = this.androidIcons.filter(i => i.folder === f);
      if (icons.length) {
        items.push(`${f}: ${icons.map(i => i.width + 'px').join(', ')}`);
      }
    }
    const store = this.androidIcons.find(i => !i.folder);
    if (store) items.push(`Play Store: ${store.width}px`);
    return items;
  }

  clear(): void {
    this.imageLoaded = false;
    this.imageSrc = '';
    this.fileName = '';
    this.sourceImage = null;
    this.generating = false;
    this.progress = 0;
    this.progressText = '';
    this.errorMessage = '';
  }
}
