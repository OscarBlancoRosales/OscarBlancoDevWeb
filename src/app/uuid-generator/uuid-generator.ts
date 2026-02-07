import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-uuid-generator',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './uuid-generator.html',
  styleUrl: './uuid-generator.css'
})
export class UuidGenerator implements OnInit {
  uuids: string[] = [];
  amount = 1;
  uppercase = false;
  noDashes = false;
  copied = false;
  copiedIndex = -1;

  constructor(private cdr: ChangeDetectorRef, public i18n: I18nService) {}

  ngOnInit(): void {
    this.generate();
  }

  generate(): void {
    const count = Math.max(1, Math.min(100, this.amount || 1));
    this.uuids = [];
    for (let i = 0; i < count; i++) {
      let uuid = this.generateV4();
      if (this.noDashes) uuid = uuid.replace(/-/g, '');
      if (this.uppercase) uuid = uuid.toUpperCase();
      this.uuids.push(uuid);
    }
    this.copiedIndex = -1;
    this.copied = false;
  }

  private generateV4(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async copySingle(uuid: string, index: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(uuid);
      this.copiedIndex = index;
      setTimeout(() => { this.copiedIndex = -1; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    } catch {}
  }

  async copyAll(): Promise<void> {
    if (!this.uuids.length) return;
    try {
      await navigator.clipboard.writeText(this.uuids.join('\n'));
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    } catch {}
  }
}
