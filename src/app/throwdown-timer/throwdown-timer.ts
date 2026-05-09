import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { database } from '../firebase.config';
import { ref, get, onValue, remove, Unsubscribe } from 'firebase/database';
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
  countdown: boolean | null;
}

type Screen = 'welcome' | 'list' | 'edit' | 'timer';

function generateId(): string {
  return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankConfig(): ThrowdownConfig {
  return { id: generateId(), name: '', steps: [], createdAt: Date.now(), countdown: null };
}

@Component({
  selector: 'app-throwdown-timer',
  imports: [ThrowdownWelcome, ThrowdownList, ThrowdownEdit, ThrowdownRun],
  templateUrl: './throwdown-timer.html',
  styleUrl: './throwdown-timer.css',
})
export class ThrowdownTimer implements OnInit, OnDestroy {
  screen: Screen = 'welcome';
  editingConfig: ThrowdownConfig = blankConfig();
  activeConfig: ThrowdownConfig = blankConfig();
  configs: ThrowdownConfig[] = [];
  isLoadingConfigs = true;
  loadError = false;

  private readonly popstateHandler = (event: PopStateEvent) => {
    const state = event.state as { throwdownScreen?: string } | null;
    const scr = state?.throwdownScreen as Screen | undefined;
    if (scr === 'welcome' || scr === 'list' || scr === 'edit' || scr === 'timer') {
      this.screen = scr;
      this.cdr.detectChanges();
    }
  };

  private configsUnsubscribe: Unsubscribe | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    window.addEventListener('popstate', this.popstateHandler);
    history.replaceState({ throwdownScreen: 'welcome' }, '', window.location.href);
    this.subscribeConfigs();
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.popstateHandler);
    if (this.configsUnsubscribe) {
      this.configsUnsubscribe();
      this.configsUnsubscribe = null;
    }
    if (window.location.pathname.startsWith('/tomelloso-throwdown-timer')) {
      history.replaceState(null, '', '/tomelloso-throwdown-timer');
    }
  }

  private subscribeConfigs(): void {
    this.isLoadingConfigs = true;
    this.loadError = false;

    void get(ref(database, 'throwdown-timer/configs')).then((snapshot) => {
      const raw = snapshot.val() as Record<string, ThrowdownConfig> | null;
      this.configs = raw
        ? Object.values(raw).sort((a, b) => b.createdAt - a.createdAt)
        : [];
      this.isLoadingConfigs = false;
      this.cdr.detectChanges();
    }).catch(() => {
      this.loadError = true;
      this.configs = [];
      this.isLoadingConfigs = false;
      this.cdr.detectChanges();
    });

    // onValue() only updates configs AFTER get() has finished (isLoadingConfigs === false)
    // This prevents the real-time listener from flashing empty state before get() resolves
    this.configsUnsubscribe = onValue(
      ref(database, 'throwdown-timer/configs'),
      (snapshot) => {
        if (this.isLoadingConfigs) { return; }
        const raw = snapshot.val() as Record<string, ThrowdownConfig> | null;
        this.configs = raw
          ? Object.values(raw).sort((a, b) => b.createdAt - a.createdAt)
          : [];
        this.cdr.detectChanges();
      },
      () => { /* ignore real-time errors, get() already handled initial error */ }
    );
  }

  onEnter(): void {
    this.screen = 'list';
    history.pushState({ throwdownScreen: 'list' }, '', '/tomelloso-throwdown-timer#list');
  }

  onNewConfig(): void {
    this.editingConfig = blankConfig();
    this.screen = 'edit';
    history.pushState({ throwdownScreen: 'edit' }, '', '/tomelloso-throwdown-timer#edit');
  }

  onEditConfig(cfg: ThrowdownConfig): void {
    this.editingConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.screen = 'edit';
    history.pushState({ throwdownScreen: 'edit' }, '', '/tomelloso-throwdown-timer#edit');
  }

  onPlayConfig(cfg: ThrowdownConfig): void {
    if (cfg.steps.length === 0) { return; }
    this.activeConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.screen = 'timer';
    history.pushState({ throwdownScreen: 'timer' }, '', '/tomelloso-throwdown-timer#timer');
  }

  onConfigSaved(cfg: ThrowdownConfig): void {
    this.editingConfig = cfg;
    const idx = this.configs.findIndex(c => c.id === cfg.id);
    if (idx >= 0) {
      this.configs = this.configs.map(c => c.id === cfg.id ? cfg : c);
    } else {
      this.configs = [cfg, ...this.configs];
    }
    this.cdr.detectChanges();
  }

  async onDeleteConfig(cfg: ThrowdownConfig): Promise<void> {
    try {
      await remove(ref(database, `throwdown-timer/configs/${cfg.id}`));
    } catch {
      // silent
    }
    this.configs = this.configs.filter(c => c.id !== cfg.id);
    this.cdr.detectChanges();
  }

  goToList(): void {
    this.screen = 'list';
    history.pushState({ throwdownScreen: 'list' }, '', '/tomelloso-throwdown-timer#list');
  }
}
