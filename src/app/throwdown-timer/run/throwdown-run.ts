import { Component, input, output, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThrowdownConfig, ThrowdownStep } from '../throwdown-timer';

@Component({
  selector: 'app-throwdown-run',
  imports: [CommonModule],
  templateUrl: './throwdown-run.html',
  styleUrl: './throwdown-run.css',
})
export class ThrowdownRun implements OnInit, OnDestroy {
  readonly config = input.required<ThrowdownConfig>();
  readonly back = output<void>();

  currentStepIndex = 0;
  remainingSeconds = 0;
  stepTotalSeconds = 0;
  isRunning = false;
  timerFinished = false;
  totalElapsedSeconds = 0;
  totalDurationSeconds = 0;
  isMuted = false;
  readyToStart = true;
  isPreCountdown = false;
  preCountdownValue = 10;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private preCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private completionBuffer: AudioBuffer | null = null;
  private whistleBuffer: AudioBuffer | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.totalDurationSeconds = this.configTotalSecs(this.config());
    this.loadStep(0);
    // Don't auto-start: wait for explicit tap so iOS audio context can be unlocked
  }

  ngOnDestroy(): void {
    this.clearPreCountdown();
    this.clearInterval();
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  formatSecs(secs: number): string {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private stepSecs(step: ThrowdownStep): number {
    return step.minutes * 60 + step.seconds;
  }

  stepTotalSec(step: ThrowdownStep): number {
    return this.stepSecs(step);
  }

  private configTotalSecs(cfg: ThrowdownConfig): number {
    return cfg.steps.reduce((a, s) => a + this.stepSecs(s), 0);
  }

  // ── STATE ─────────────────────────────────────────────────────────────────

  get currentStep(): ThrowdownStep | null {
    return this.config().steps[this.currentStepIndex] ?? null;
  }

  get nextStep(): ThrowdownStep | null {
    return this.config().steps[this.currentStepIndex + 1] ?? null;
  }

  get stepProgress(): number {
    if (this.stepTotalSeconds === 0) { return 0; }
    return ((this.stepTotalSeconds - this.remainingSeconds) / this.stepTotalSeconds) * 100;
  }

  get totalProgress(): number {
    if (this.totalDurationSeconds === 0) { return 0; }
    return (this.totalElapsedSeconds / this.totalDurationSeconds) * 100;
  }

  get isCountingDown(): boolean {
    return this.isRunning && this.remainingSeconds > 0 && this.remainingSeconds <= 3;
  }

  get formattedRemaining(): string {
    return this.formatSecs(this.remainingSeconds);
  }

  get formattedTotalRemaining(): string {
    return this.formatSecs(Math.max(0, this.totalDurationSeconds - this.totalElapsedSeconds));
  }

  // ── TIMER ─────────────────────────────────────────────────────────────────

  private loadStep(index: number): void {
    const step = this.config().steps[index];
    if (!step) { return; }
    this.currentStepIndex = index;
    this.stepTotalSeconds = this.stepSecs(step);
    this.remainingSeconds = this.stepTotalSeconds;
  }

  resume(): void {
    if (this.isRunning || this.timerFinished) { return; }
    this.unlockAudio();
    this.isRunning = true;
    this.cdr.detectChanges();
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      this.totalElapsedSeconds++;
      if (this.remainingSeconds > 0 && this.remainingSeconds <= 3) {
        this.playCountdownPip(this.remainingSeconds === 1);
      }
      if (this.remainingSeconds <= 0) {
        this.advance();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  pause(): void {
    this.unlockAudio();
    this.isRunning = false;
    this.clearInterval();
    this.cdr.detectChanges();
  }

  skip(): void {
    this.unlockAudio();
    this.clearInterval();
    this.isRunning = false;
    this.totalElapsedSeconds += this.remainingSeconds;
    this.advance();
  }

  prev(): void {
    this.unlockAudio();
    if (this.currentStepIndex === 0) { return; }
    const wasRunning = this.isRunning;
    this.clearInterval();
    this.isRunning = false;
    const spent = this.stepTotalSeconds - this.remainingSeconds;
    this.totalElapsedSeconds = Math.max(0, this.totalElapsedSeconds - spent);
    const prevStep = this.config().steps[this.currentStepIndex - 1];
    if (prevStep) {
      this.totalElapsedSeconds = Math.max(0, this.totalElapsedSeconds - this.stepSecs(prevStep));
    }
    this.loadStep(this.currentStepIndex - 1);
    if (wasRunning) { this.resume(); } else { this.cdr.detectChanges(); }
  }

  restart(): void {
    this.unlockAudio();
    this.clearInterval();
    this.clearPreCountdown();
    this.isRunning = false;
    this.timerFinished = false;
    this.isPreCountdown = false;
    this.totalElapsedSeconds = 0;
    this.loadStep(0);
    this.readyToStart = true;
    this.cdr.detectChanges();
  }

  startTimer(): void {
    this.readyToStart = false;
    this.unlockAudio();
    void this.preloadCompletionAudio();
    void this.preloadWhistleAudio();
    this.beginPreCountdown();
  }

  private beginPreCountdown(): void {
    this.clearPreCountdown();
    this.preCountdownValue = 10;
    this.isPreCountdown = true;
    this.cdr.detectChanges();
    this.preCountdownInterval = setInterval(() => {
      this.preCountdownValue--;
      if (this.preCountdownValue > 0 && this.preCountdownValue <= 3) {
        this.playCountdownPip(this.preCountdownValue === 1);
      }
      if (this.preCountdownValue <= 0) {
        this.clearPreCountdown();
        this.isPreCountdown = false;
        this.playStepWhistle();
        this.resume();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private clearPreCountdown(): void {
    if (this.preCountdownInterval !== null) {
      clearInterval(this.preCountdownInterval);
      this.preCountdownInterval = null;
    }
  }

  private advance(): void {
    this.clearInterval();
    this.isRunning = false;
    if (this.currentStepIndex < this.config().steps.length - 1) {
      this.playStepWhistle();
      this.loadStep(this.currentStepIndex + 1);
      this.resume();
    } else {
      this.remainingSeconds = 0;
      this.timerFinished = true;
      this.totalElapsedSeconds = this.totalDurationSeconds;
      this.playCompletion();
      this.cdr.detectChanges();
    }
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.unlockAudio();
    this.cdr.detectChanges();
  }

  private unlockAudio(): void {
    try {
      const ctx = this.getAudioCtx();
      void ctx.resume();
      // iOS requires playing an actual buffer (even silent) within the gesture
      // to fully unlock the AudioContext — resume() alone is not enough
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore
    }
  }

  private clearInterval(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── AUDIO ─────────────────────────────────────────────────────────────────

  private getAudioCtx(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  private playStepWhistle(): void {
    if (this.isMuted) { return; }
    try {
      const ctx = this.getAudioCtx();
      if (this.whistleBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = this.whistleBuffer;
        source.connect(ctx.destination);
        source.start(ctx.currentTime);
      } else {
        // Fallback synth whistle if MP3 not loaded
        [0, 0.30].forEach(offset => {
          const osc     = ctx.createOscillator();
          const lfo     = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const gain    = ctx.createGain();
          const t       = ctx.currentTime + offset;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2600, t);
          osc.frequency.linearRampToValueAtTime(2900, t + 0.02);
          lfo.type = 'sine';
          lfo.frequency.value = 20;
          lfoGain.gain.value = 35;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.38, t + 0.015);
          gain.gain.setValueAtTime(0.38, t + 0.14);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          lfo.start(t); lfo.stop(t + 0.23);
          osc.start(t); osc.stop(t + 0.23);
        });
      }
    } catch {
      // Ignore audio policy errors
    }
  }

  private playCountdownPip(isLast: boolean): void {
    if (this.isMuted) { return; }
    try {
      const ctx  = this.getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = isLast ? 1047 : 880;
      const dur  = isLast ? 0.55 : 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.38, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Ignore audio policy errors
    }
  }

  private async preloadWhistleAudio(): Promise<void> {
    try {
      const ctx      = this.getAudioCtx();
      const response = await fetch('/referee%20whistle.mp3');
      const buffer   = await response.arrayBuffer();
      this.whistleBuffer = await ctx.decodeAudioData(buffer);
    } catch {
      // Ignore — fallback to synth if unavailable
    }
  }

  private async preloadCompletionAudio(): Promise<void> {
    try {
      const ctx      = this.getAudioCtx();
      const response = await fetch('/trompeta%20final.mp3');
      const buffer   = await response.arrayBuffer();
      this.completionBuffer = await ctx.decodeAudioData(buffer);
    } catch {
      // Ignore — fallback to synth if unavailable
    }
  }

  private playCompletion(): void {
    if (this.isMuted) { return; }
    try {
      const ctx = this.getAudioCtx();
      if (this.completionBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = this.completionBuffer;
        source.connect(ctx.destination);
        source.start(ctx.currentTime);
      } else {
        // Fallback synth horn if MP3 not loaded
        const freqs = [233, 466, 700, 932];
        const vols  = [0.38, 0.22, 0.13, 0.07];
        const start = ctx.currentTime;
        freqs.forEach((freq, i) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(vols[i], start + 0.03);
          gain.gain.setValueAtTime(vols[i], start + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.0);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 1.0);
        });
      }
    } catch {
      // Ignore audio policy errors
    }
  }
}
