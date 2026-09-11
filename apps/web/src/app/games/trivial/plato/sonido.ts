import { Injectable, signal } from '@angular/core';
import type { Signal } from '@angular/core';

export type Efecto = 'rotulo' | 'pulsa' | 'acierta' | 'falla' | 'tictac' | 'fanfarria';

/** Dónde se recuerda si quiere sonido. Uno solo, y de este navegador. */
const RECUERDO = 'concurso:sonido';

/** Cada efecto: notas en hercios, cuánto dura cada una y con qué onda. */
const EFECTOS: Readonly<Record<Efecto, { notas: readonly number[]; paso: number; onda: OscillatorType }>> = {
  // Un golpe de rótulo, grave y corto.
  rotulo: { notas: [180, 240, 320], paso: 0.09, onda: 'sawtooth' },
  pulsa: { notas: [880], paso: 0.04, onda: 'square' },
  acierta: { notas: [660, 880, 1320], paso: 0.08, onda: 'sine' },
  // El trombón de toda la vida: dos notas bajando.
  falla: { notas: [220, 160], paso: 0.16, onda: 'sawtooth' },
  tictac: { notas: [1200], paso: 0.03, onda: 'square' },
  fanfarria: { notas: [523, 659, 784, 1046], paso: 0.12, onda: 'triangle' },
};

/**
 * Los efectos del plató, generados en el navegador.
 *
 * Con osciladores y no con ficheros: son seis pitidos, y descargar megas de MP3
 * para esto sería cobrarle a quien entra el precio de una canción.
 *
 * **Arranca callado**, y el contexto de audio no se crea hasta que alguien pide
 * sonido: lo exigen las políticas de reproducción automática de los navegadores
 * y, además, una web que empieza a pitar sola es una pestaña que se cierra.
 */
@Injectable({ providedIn: 'root' })
export class Sonido {
  private readonly silencio = signal(arrancaCallado());
  readonly callado: Signal<boolean> = this.silencio.asReadonly();

  private contexto: AudioContext | null = null;

  /**
   * De dónde sale el contexto de audio.
   *
   * Es un campo y no una dependencia inyectada porque una función no es un
   * token válido para el inyector. Las pruebas lo sustituyen.
   */
  crear: () => AudioContext | null = contextoDelNavegador;

  alternar(): void {
    const callado = !this.silencio();
    this.silencio.set(callado);
    this.recordar(callado);
    if (!callado) this.suena('pulsa');
  }

  /**
   * Pita, si hay permiso y hay con qué.
   *
   * No lanza nunca: hay navegadores y contextos -las pruebas, sin ir más lejos-
   * donde no existe la API de audio, y quedarse sin sonido no puede tumbar una
   * partida.
   */
  suena(efecto: Efecto): void {
    if (this.silencio()) return;

    try {
      const audio = this.contexto ?? this.crear();
      this.contexto = audio;
      if (!audio) return;

      const receta = EFECTOS[efecto];
      let cuando = audio.currentTime;

      for (const nota of receta.notas) {
        const oscilador = audio.createOscillator();
        const volumen = audio.createGain();
        oscilador.type = receta.onda;
        oscilador.frequency.value = nota;
        volumen.gain.setValueAtTime(0.0001, cuando);
        volumen.gain.exponentialRampToValueAtTime(0.12, cuando + 0.01);
        volumen.gain.exponentialRampToValueAtTime(0.0001, cuando + receta.paso);
        oscilador.connect(volumen).connect(audio.destination);
        oscilador.start(cuando);
        oscilador.stop(cuando + receta.paso);
        cuando += receta.paso;
      }
    } catch {
      // Sin audio se juega igual. No merece ni un aviso.
    }
  }

  private recordar(callado: boolean): void {
    try {
      localStorage.setItem(RECUERDO, callado ? 'no' : 'si');
    } catch {
      // Si no se puede guardar, la próxima vez arranca callado. Aceptable.
    }
  }
}

/**
 * Si arranca callado, que es lo normal.
 *
 * Solo suena si en algún momento se pidió sonido en este navegador. Una web que
 * empieza a pitar sola es una pestaña que se cierra.
 */
function arrancaCallado(): boolean {
  try {
    return localStorage.getItem(RECUERDO) !== 'si';
  } catch {
    // En una ventana privada leer esto puede tirar excepción.
    return true;
  }
}

/** El contexto de audio del navegador, o nada si aquí no existe. */
function contextoDelNavegador(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}
