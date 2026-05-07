import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { database } from '../firebase.config';
import { ref, set, get, remove } from 'firebase/database';

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

const QUICK_PRESETS = [10, 20, 30, 60, 120, 300];

@Component({
  selector: 'app-throwdown-timer',
  imports: [CommonModule, FormsModule],
  templateUrl: './throwdown-timer.html',
  styleUrl: './throwdown-timer.css',
})
export class ThrowdownTimer implements OnInit, OnDestroy {
  screen: Screen = 'welcome';

  // ── LIST ────────────────────────────────────────────────────────────────
  configs: ThrowdownConfig[] = [];
  isLoadingList = true;

  // ── EDIT ─────────────────────────────────────────────────────────────────
  editConfig: ThrowdownConfig = this.blankConfig();
  showAddForm = false;
  newStepName = '';
  newStepMinutes = 0;
  newStepSeconds = 0;
  isSaving = false;
  saveSuccess = false;

  // ── TIMER ────────────────────────────────────────────────────────────────
  activeConfig: ThrowdownConfig = this.blankConfig();
  currentStepIndex = 0;
  remainingSeconds = 0;
  stepTotalSeconds = 0;
  isRunning = false;
  timerFinished = false;

  // Total elapsed for the "total time" counter
  totalElapsedSeconds = 0;
  totalDurationSeconds = 0;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  constructor(private zone: NgZone) {}

  ngOnInit(): void {
    void this.loadList();
  }

  ngOnDestroy(): void {
    this.clearInterval();
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────

  private blankConfig(): ThrowdownConfig {
    return { id: '', name: '', steps: [], createdAt: Date.now() };
  }

  private generateId(): string {
    return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  stepTotalSec(step: ThrowdownStep): number {
    return step.minutes * 60 + step.seconds;
  }

  formatSecs(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  configTotalSecs(cfg: ThrowdownConfig): number {
    return cfg.steps.reduce((a, s) => a + this.stepTotalSec(s), 0);
  }

  // ── LIST ─────────────────────────────────────────────────────────────────

  private async loadList(): Promise<void> {
    this.isLoadingList = true;
    try {
      const snapshot = await get(ref(database, 'throwdown-timer/configs'));
      const raw = snapshot.val() as Record<string, ThrowdownConfig> | null;
      if (raw) {
        this.configs = Object.values(raw).sort((a, b) => b.createdAt - a.createdAt);
      } else {
        this.configs = [];
      }
    } catch {
      this.configs = [];
    } finally {
      this.isLoadingList = false;
    }
  }

  enter(): void {
    this.screen = 'list';
  }

  openCreate(): void {
    this.editConfig = this.blankConfig();
    this.editConfig.id = this.generateId();
    this.showAddForm = false;
    this.screen = 'edit';
  }

  openEdit(cfg: ThrowdownConfig): void {
    this.editConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.showAddForm = false;
    this.screen = 'edit';
  }

  async deleteConfig(cfg: ThrowdownConfig): Promise<void> {
    try {
      await remove(ref(database, `throwdown-timer/configs/${cfg.id}`));
      this.configs = this.configs.filter(c => c.id !== cfg.id);
    } catch {
      // silent
    }
  }

  backToList(): void {
    this.screen = 'list';
  }

  // ── EDIT ─────────────────────────────────────────────────────────────────

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm) {
      this.newStepName = '';
      this.newStepMinutes = 0;
      this.newStepSeconds = 0;
    }
  }

  applyPreset(totalSecs: number): void {
    this.newStepMinutes = Math.floor(totalSecs / 60);
    this.newStepSeconds = totalSecs % 60;
  }

  addStep(): void {
    const name = this.newStepName.trim();
    if (!name) { return; }
    const minutes = Math.max(0, Math.floor(Number(this.newStepMinutes)));
    const seconds = Math.max(0, Math.min(59, Math.floor(Number(this.newStepSeconds))));
    if (minutes === 0 && seconds === 0) { return; }
    this.editConfig = {
      ...this.editConfig,
      steps: [...this.editConfig.steps, { name, minutes, seconds }]
    };
    this.showAddForm = false;
  }

  removeStep(index: number): void {
    this.editConfig = {
      ...this.editConfig,
      steps: this.editConfig.steps.filter((_, i) => i !== index)
    };
  }

  async saveConfig(): Promise<void> {
    const name = this.editConfig.name.trim();
    if (!name || this.editConfig.steps.length === 0) { return; }
    this.isSaving = true;
    this.saveSuccess = false;
    try {
      const toSave: ThrowdownConfig = { ...this.editConfig, name };
      await set(ref(database, `throwdown-timer/configs/${toSave.id}`), toSave);
      // Update local list
      const idx = this.configs.findIndex(c => c.id === toSave.id);
      if (idx >= 0) {
        this.configs = this.configs.map(c => c.id === toSave.id ? toSave : c);
      } else {
        this.configs = [toSave, ...this.configs];
      }
      this.saveSuccess = true;
      setTimeout(() => { this.saveSuccess = false; }, 2000);
    } catch {
      // silent
    } finally {
      this.isSaving = false;
    }
  }

  launchTimer(cfg: ThrowdownConfig): void {
    if (cfg.steps.length === 0) { return; }
    this.activeConfig = JSON.parse(JSON.stringify(cfg)) as ThrowdownConfig;
    this.currentStepIndex = 0;
    this.timerFinished = false;
    this.isRunning = false;
    this.totalElapsedSeconds = 0;
    this.totalDurationSeconds = this.configTotalSecs(this.activeConfig);
    this.loadStep(0);
    this.screen = 'timer';
    this.resumeTimer();
  }

  // ── TIMER ────────────────────────────────────────────────────────────────

  private loadStep(index: number): void {
    const step = this.activeConfig.steps[index];
    if (!step) { return; }
    this.currentStepIndex = index;
    this.stepTotalSeconds = this.stepTotalSec(step);
    this.remainingSeconds = this.stepTotalSeconds;
  }

  resumeTimer(): void {
    if (this.isRunning || this.timerFinished) { return; }
    this.isRunning = true;
    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.remainingSeconds--;
        this.totalElapsedSeconds++;
        if (this.remainingSeconds <= 0) {
          this.advanceStep();
        }
      });
    }, 1000);
  }

  pauseTimer(): void {
    this.isRunning = false;
    this.clearInterval();
  }

  skipStep(): void {
    this.clearInterval();
    this.isRunning = false;
    this.totalElapsedSeconds += this.remainingSeconds;
    this.advanceStep();
  }

  prevStep(): void {
    if (this.currentStepIndex === 0) { return; }
    const wasRunning = this.isRunning;
    this.clearInterval();
    this.isRunning = false;
    // Subtract time already spent on current step
    const spent = this.stepTotalSeconds - this.remainingSeconds;
    this.totalElapsedSeconds = Math.max(0, this.totalElapsedSeconds - spent);
    // Also subtract the full previous step from elapsed, it'll be re-counted
    const prevStep = this.activeConfig.steps[this.currentStepIndex - 1];
    if (prevStep) {
      this.totalElapsedSeconds = Math.max(0, this.totalElapsedSeconds - this.stepTotalSec(prevStep));
    }
    this.loadStep(this.currentStepIndex - 1);
    if (wasRunning) { this.resumeTimer(); }
  }

  private advanceStep(): void {
    this.clearInterval();
    this.isRunning = false;
    if (this.currentStepIndex < this.activeConfig.steps.length - 1) {
      this.playBeep(880, 0.4);
      this.loadStep(this.currentStepIndex + 1);
      this.resumeTimer();
    } else {
      this.remainingSeconds = 0;
      this.timerFinished = true;
      this.totalElapsedSeconds = this.totalDurationSeconds;
      this.playCompletionSound();
    }
  }

  restartTimer(): void {
    this.clearInterval();
    this.isRunning = false;
    this.timerFinished = false;
    this.totalElapsedSeconds = 0;
    this.loadStep(0);
    this.resumeTimer();
  }

  backToListFromTimer(): void {
    this.clearInterval();
    this.isRunning = false;
    this.screen = 'list';
  }

  private clearInterval(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── AUDIO ────────────────────────────────────────────────────────────────

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  private playBeep(freq: number, duration: number): void {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio policy errors
    }
  }

  private playCompletionSound(): void {
    this.playBeep(1047, 0.4);
    setTimeout(() => { this.playBeep(1319, 0.4); }, 350);
    setTimeout(() => { this.playBeep(1568, 0.6); }, 700);
  }

  // ── GETTERS ───────────────────────────────────────────────────────────────

  get quickPresets(): number[] { return QUICK_PRESETS; }

  get currentStep(): ThrowdownStep | null {
    return this.activeConfig.steps[this.currentStepIndex] ?? null;
  }

  get nextStep(): ThrowdownStep | null {
    return this.activeConfig.steps[this.currentStepIndex + 1] ?? null;
  }

  get stepProgress(): number {
    if (this.stepTotalSeconds === 0) { return 0; }
    return ((this.stepTotalSeconds - this.remainingSeconds) / this.stepTotalSeconds) * 100;
  }

  get totalProgress(): number {
    if (this.totalDurationSeconds === 0) { return 0; }
    return (this.totalElapsedSeconds / this.totalDurationSeconds) * 100;
  }

  get formattedRemaining(): string {
    return this.formatSecs(this.remainingSeconds);
  }

  get formattedTotalRemaining(): string {
    return this.formatSecs(Math.max(0, this.totalDurationSeconds - this.totalElapsedSeconds));
  }
}
