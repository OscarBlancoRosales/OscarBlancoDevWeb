import { Component, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { database } from '../../firebase.config';
import { ref, get, remove } from 'firebase/database';
import { ChangeDetectorRef } from '@angular/core';
import { ThrowdownConfig, ThrowdownStep } from '../throwdown-timer';

@Component({
  selector: 'app-throwdown-list',
  imports: [CommonModule],
  templateUrl: './throwdown-list.html',
  styleUrl: './throwdown-list.css',
})
export class ThrowdownList implements OnInit {
  readonly newConfig = output<void>();
  readonly editConfig = output<ThrowdownConfig>();
  readonly playConfig = output<ThrowdownConfig>();

  configs: ThrowdownConfig[] = [];
  isLoading = true;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    void this.loadConfigs();
  }

  private async loadConfigs(): Promise<void> {
    this.isLoading = true;
    try {
      const snapshot = await get(ref(database, 'throwdown-timer/configs'));
      const raw = snapshot.val() as Record<string, ThrowdownConfig> | null;
      this.configs = raw
        ? Object.values(raw).sort((a, b) => b.createdAt - a.createdAt)
        : [];
    } catch {
      this.configs = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async onDelete(cfg: ThrowdownConfig): Promise<void> {
    try {
      await remove(ref(database, `throwdown-timer/configs/${cfg.id}`));
      this.configs = this.configs.filter(c => c.id !== cfg.id);
    } catch {
      // silent
    } finally {
      this.cdr.detectChanges();
    }
  }

  formatSecs(secs: number): string {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  configTotalSecs(cfg: ThrowdownConfig): number {
    return cfg.steps.reduce((a, s: ThrowdownStep) => a + s.minutes * 60 + s.seconds, 0);
  }
}
