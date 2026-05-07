import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { database } from '../firebase.config';
import { ref, set, get } from 'firebase/database';

export interface ThrowdownStep {
  name: string;
  minutes: number;
  seconds: number;
}

type Screen = 'welcome' | 'config' | 'timer';

@Component({
  selector: 'app-throwdown-timer',
  imports: [CommonModule, FormsModule],
  templateUrl: './throwdown-timer.html',
  styleUrl: './throwdown-timer.css',
})
export class ThrowdownTimer implements OnInit, OnDestroy {
  screen: Screen = 'welcome';

  steps: ThrowdownStep[] = [];
  showAddForm = false;
  newStepName = '';
  newStepMinutes = 0;
  newStepSeconds = 0;
  isSaving = false;
  isLoading = true;

  currentStepIndex = 0;
  remainingSeconds = 0;
  timerFinished = false;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  ngOnInit(): void {
    void this.loadConfig();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const snapshot = await get(ref(database, 'throwdown-timer/steps'));
      const data = snapshot.val();
      this.steps = Array.isArray(data) ? (data as ThrowdownStep[]) : [];
    } catch {
      this.steps = [];
    } finally {
      this.isLoading = false;
    }
  }

  enter(): void {
    this.screen = 'config';
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm) {
      this.newStepName = '';
      this.newStepMinutes = 0;
      this.newStepSeconds = 0;
    }
  }

  addStep(): void {
    const name = this.newStepName.trim();
    if (!name) { return; }
    const minutes = Math.max(0, Math.floor(this.newStepMinutes));
    const seconds = Math.max(0, Math.min(59, Math.floor(this.newStepSeconds)));
    if (minutes === 0 && seconds === 0) { return; }
    this.steps = [...this.steps, { name, minutes, seconds }];
    this.showAddForm = false;
  }

  removeStep(index: number): void {
    this.steps = this.steps.filter((_, i) => i !== index);
  }

  async saveConfig(): Promise<void> {
    this.isSaving = true;
    try {
      await set(ref(database, 'throwdown-timer/steps'), this.steps);
    } finally {
      this.isSaving = false;
    }
  }

  startTimer(): void {
    if (this.steps.length === 0) { return; }
    this.currentStepIndex = 0;
    this.timerFinished = false;
    this.screen = 'timer';
    this.startCurrentStep();
  }

  private startCurrentStep(): void {
    const step = this.steps[this.currentStepIndex];
    if (!step) { return; }
    this.remainingSeconds = (step.minutes * 60) + step.seconds;
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        this.onStepFinished();
      }
    }, 1000);
  }

  private onStepFinished(): void {
    this.stopTimer();
    if (this.currentStepIndex < this.steps.length - 1) {
      this.playBeep(880, 0.5);
      this.currentStepIndex++;
      this.startCurrentStep();
    } else {
      this.timerFinished = true;
      this.playCompletionSound();
    }
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  restartTimer(): void {
    this.stopTimer();
    this.timerFinished = false;
    this.currentStepIndex = 0;
    this.startCurrentStep();
  }

  backToConfig(): void {
    this.stopTimer();
    this.screen = 'config';
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  private playBeep(freq: number, duration: number): void {
    try {
      const ctx = this.getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio errors (e.g. autoplay policy)
    }
  }

  private playCompletionSound(): void {
    this.playBeep(1047, 0.5);
    setTimeout(() => { this.playBeep(1047, 0.5); }, 400);
    setTimeout(() => { this.playBeep(1047, 0.5); }, 800);
  }

  get currentStep(): ThrowdownStep | null {
    return this.steps[this.currentStepIndex] ?? null;
  }

  get formattedTime(): string {
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  formatStepDuration(step: ThrowdownStep): string {
    return `${String(step.minutes).padStart(2, '0')}:${String(step.seconds).padStart(2, '0')}`;
  }
}
