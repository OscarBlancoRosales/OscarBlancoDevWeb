import { Component, output } from '@angular/core';

@Component({
  selector: 'app-throwdown-welcome',
  imports: [],
  templateUrl: './throwdown-welcome.html',
  styleUrl: './throwdown-welcome.css',
})
export class ThrowdownWelcome {
  readonly enter = output<void>();

  onEnter(): void {
    this.enter.emit();
  }
}
