import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WindowState } from '../window-manager';

/** Lo que se está arrastrando ahora mismo, y desde dónde. */
interface Drag {
  kind: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
}

/**
 * Una ventana del escritorio: marco, barra de título y lo que le metan dentro.
 *
 * No decide nada por su cuenta -no sabe dónde está ni quién manda-: avisa de
 * lo que hace el ratón y el escritorio, que es quien lleva el estado, contesta
 * con la posición nueva.
 */
@Component({
  selector: 'app-desktop-window',
  templateUrl: './desktop-window.html',
  styleUrl: './desktop-window.css',
})
export class DesktopWindow {
  @Input({ required: true }) win!: WindowState;
  /** La de delante se pinta distinta: hay que ver cuál tiene el mando. */
  @Input() active = false;

  @Output() focused = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() minimized = new EventEmitter<void>();
  @Output() maximized = new EventEmitter<void>();
  /** Posición nueva mientras se arrastra. */
  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();

  private drag: Drag | null = null;

  onPointerDown(event: PointerEvent, kind: Drag['kind']): void {
    // Con el botón derecho o secundario no se arrastra nada.
    if (event.button !== 0) return;
    if (this.win.maximized && kind === 'move') return;

    event.preventDefault();
    this.focused.emit();
    this.drag = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: this.win.x,
      originY: this.win.y,
      originW: this.win.width,
      originH: this.win.height,
    };
    // Capturar el puntero: si el ratón se sale de la ventana, el arrastre
    // sigue siendo nuestro y no se queda a medias.
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.kind === 'move') {
      this.moved.emit({ x: drag.originX + dx, y: drag.originY + dy });
    } else {
      this.resized.emit({ width: drag.originW + dx, height: drag.originH + dy });
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId !== event.pointerId) return;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.drag = null;
  }

  /** Doble toque en la barra: maximiza y restaura, como en cualquier sistema. */
  onTitleDoubleClick(): void {
    this.maximized.emit();
  }

  /** El teclado también mueve la ventana, para quien no use ratón. */
  onTitleKeydown(event: KeyboardEvent): void {
    const paso = event.shiftKey ? 40 : 12;
    const saltos: Record<string, [number, number]> = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    };
    const salto = saltos[event.key];
    if (!salto) return;
    event.preventDefault();
    this.moved.emit({ x: this.win.x + salto[0], y: this.win.y + salto[1] });
  }
}
