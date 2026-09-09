import { Injectable, signal } from '@angular/core';

/**
 * Dice si lo que se está pintando va dentro de una ventana del escritorio.
 *
 * Hace falta porque cada herramienta trae su propia concha por dentro
 * (`app-terminal-layout`), y desde fuera no se le puede pasar una entrada.
 * Con esto la concha se entera sola y no dibuja un segundo marco dentro del
 * primero.
 *
 * Es un interruptor global a propósito: dentro del escritorio va embebido
 * todo, y en una ruta suelta no va embebido nada.
 */
@Injectable({ providedIn: 'root' })
export class ShellModeService {
  readonly embedded = signal(false);
}
