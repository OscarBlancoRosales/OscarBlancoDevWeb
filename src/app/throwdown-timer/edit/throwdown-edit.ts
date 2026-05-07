import { Component, input, output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { database } from '../../firebase.config';
import { ref, set } from 'firebase/database';
import { ThrowdownConfig, ThrowdownStep } from '../throwdown-timer';

const QUICK_PRESETS = [10, 20, 30, 60, 120, 300];

@Component({
  selector: 'app-throwdown-edit',
  imports: [CommonModule, FormsModule],
  templateUrl: './throwdown-edit.html',
  styleUrl: './throwdown-edit.css',
})
export class ThrowdownEdit implements OnInit {
  readonly initialConfig = input.required<ThrowdownConfig>();
  readonly back = output<void>();
  readonly saved = output<ThrowdownConfig>();
  readonly startTimer = output<ThrowdownConfig>();

  editConfig: ThrowdownConfig = this.blank();
  showAddForm = false;
  newStepName = '';
  newStepMinutes = 0;
  newStepSeconds = 0;
  isSaving = false;
  saveSuccess = false;

  dragIndex: number | null = null;
  dragOverIndex: number | null = null;
  private touchDragActive = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.editConfig = JSON.parse(JSON.stringify(this.initialConfig())) as ThrowdownConfig;
  }

  private blank(): ThrowdownConfig {
    return { id: '', name: '', steps: [], createdAt: Date.now() };
  }

  get quickPresets(): number[] { return QUICK_PRESETS; }

  formatSecs(secs: number): string {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  stepTotalSec(step: ThrowdownStep): number {
    return step.minutes * 60 + step.seconds;
  }

  configTotalSecs(): number {
    return this.editConfig.steps.reduce((a, s) => a + this.stepTotalSec(s), 0);
  }

  // ── DRAG & DROP ───────────────────────────────────────────────────────────

  onDragStart(index: number): void {
    this.dragIndex = index;
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.dragIndex !== null) {
      this.dragOverIndex = index;
    }
  }

  onDrop(index: number): void {
    if (this.dragIndex !== null) {
      this.reorder(this.dragIndex, index);
    }
    this.dragIndex = null;
    this.dragOverIndex = null;
  }

  onDragEnd(): void {
    this.dragIndex = null;
    this.dragOverIndex = null;
  }

  onTouchStart(event: TouchEvent, index: number): void {
    event.preventDefault();
    this.touchDragActive = true;
    this.dragIndex = index;
    this.dragOverIndex = index;
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.touchDragActive || this.dragIndex === null) { return; }
    event.preventDefault();
    const touch = event.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest('[data-step-index]');
    if (row) {
      const idx = parseInt(row.getAttribute('data-step-index') ?? '-1', 10);
      if (idx >= 0) {
        this.dragOverIndex = idx;
        this.cdr.detectChanges();
      }
    }
  }

  onTouchEnd(): void {
    if (this.touchDragActive && this.dragIndex !== null && this.dragOverIndex !== null) {
      this.reorder(this.dragIndex, this.dragOverIndex);
    }
    this.touchDragActive = false;
    this.dragIndex = null;
    this.dragOverIndex = null;
    this.cdr.detectChanges();
  }

  private reorder(from: number, to: number): void {
    if (from === to) { return; }
    const steps = [...this.editConfig.steps];
    const [item] = steps.splice(from, 1);
    steps.splice(to, 0, item);
    this.editConfig = { ...this.editConfig, steps };
  }

  // ── EDIT ACTIONS ──────────────────────────────────────────────────────────

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

  async onSave(): Promise<void> {
    const name = this.editConfig.name.trim();
    if (!name || this.editConfig.steps.length === 0) { return; }
    this.isSaving = true;
    this.saveSuccess = false;
    this.cdr.detectChanges();
    try {
      const toSave: ThrowdownConfig = { ...this.editConfig, name };
      await set(ref(database, `throwdown-timer/configs/${toSave.id}`), toSave);
      this.editConfig = toSave;
      this.isSaving = false;
      this.saveSuccess = true;
      this.saved.emit(toSave);
      this.cdr.detectChanges();
      setTimeout(() => {
        this.saveSuccess = false;
        this.cdr.detectChanges();
      }, 2200);
    } catch {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  onStart(): void {
    if (this.editConfig.steps.length === 0) { return; }
    this.startTimer.emit(this.editConfig);
  }
}
