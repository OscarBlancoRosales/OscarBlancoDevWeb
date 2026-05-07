import { Component, input, output } from '@angular/core';
import { ThrowdownConfig, ThrowdownStep } from '../throwdown-timer';

@Component({
  selector: 'app-throwdown-list',
  imports: [],
  templateUrl: './throwdown-list.html',
  styleUrl: './throwdown-list.css',
})
export class ThrowdownList {
  readonly configs = input.required<ThrowdownConfig[]>();
  readonly isLoading = input<boolean>(false);
  readonly newConfig = output<void>();
  readonly editConfig = output<ThrowdownConfig>();
  readonly playConfig = output<ThrowdownConfig>();
  readonly deleteConfig = output<ThrowdownConfig>();

  formatSecs(secs: number): string {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  configTotalSecs(cfg: ThrowdownConfig): number {
    return cfg.steps.reduce((a, s: ThrowdownStep) => a + s.minutes * 60 + s.seconds, 0);
  }
}
