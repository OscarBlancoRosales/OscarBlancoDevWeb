import { Component } from '@angular/core';
import { ThrowdownWelcome } from './welcome/throwdown-welcome';
import { ThrowdownList } from './list/throwdown-list';
import { ThrowdownEdit } from './edit/throwdown-edit';
import { ThrowdownRun } from './run/throwdown-run';

export interface ThrowdownStep {
  name: string;
  minutes: number;
  seconds: number;
}

export interface ThrowdownConfig {
  id: string;
  name: string;
  steps: ThrowdownStep[];
  createdAt: number;
}

type Screen = 'welcome' | 'list' | 'edit' | 'timer';

function generateId(): string {
  return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankConfig(): ThrowdownConfig {
  return { id: generateId(), name: '', steps: [], createdAt: Date.now() };
}

@Component({
  selector: 'app-throwdown-timer',
  imports: [ThrowdownWelcome, ThrowdownList, ThrowdownEdit, ThrowdownRun],
  templateUrl: './throwdown-timer.html',
  styleUrl: './throwdown-timer.css',
})
export class ThrowdownTimer {
  screen: Screen = 'welcome';
  editingConfig: ThrowdownConfig = blankConfig();
  activeConfig: ThrowdownConfig = blankConfig();

  onEnter(): void {
    this.screen = 'list';
  }

  onNewConfig(): void {
    this.editingConfig = blankConfig();
    this.screen = 'edit';
  }

  onEditConfig(cfg: ThrowdownConfig): void {
    this.editingConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.screen = 'edit';
  }

  onPlayConfig(cfg: ThrowdownConfig): void {
    if (cfg.steps.length === 0) { return; }
    this.activeConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.screen = 'timer';
  }

  onConfigSaved(cfg: ThrowdownConfig): void {
    this.editingConfig = cfg;
  }

  goToList(): void {
    this.screen = 'list';
  }
}
