import { Injectable } from '@angular/core';
import { AiSettings } from '../engine/ai/ai-client';

/**
 * Narrador de la crónica de guerra: voz de verdad, generada por un modelo.
 *
 * ### Cómo se eligió el modelo
 *
 * OpenRouter tiene un endpoint de voz compatible con OpenAI
 * (`/api/v1/audio/speech`) que no aparece en el catálogo de `/models`, así que
 * hubo que descubrirlo a mano. De los que responden:
 *
 * - `flux-tts:free` funciona y devuelve WAV, pero **todas sus voces terminan en
 *   `-en`**: son inglesas. Leerían "Cáceres" y "Guadiana" con acento inglés.
 * - `kokoro-82m` **sí tiene voces en español** (`ef_dora`, `em_alex`,
 *   `em_santa`), devuelve WAV de 24 kHz y no consume saldo: tras generar varias
 *   pruebas, el gasto de la cuenta seguía en cero.
 *
 * Por eso el narrador es Kokoro. La voz del navegador se descartó a propósito:
 * suena a sintetizador de sistema y para esto era peor que no tener voz.
 *
 * ### Por qué se descarta lo atrasado
 *
 * Una crónica va detrás de cada ataque, y en una partida rápida se encadenan
 * varios por turno. Si se encolaran, la voz acabaría minutos por detrás del
 * tablero contando una batalla que ya terminó. Así que solo se narra la última:
 * si llega una línea nueva mientras suena otra, la nueva gana.
 */

/** Modelo de voz. Sin sufijo `:free`, pero no cobra: comprobado contra la API. */
export const TTS_MODEL = 'kokoro-82m';

export interface NarratorVoice {
  id: string;
  label: string;
}

/**
 * Voces en español de Kokoro.
 *
 * La convención del modelo es que la primera letra es el idioma (`e` = español)
 * y la segunda el género. Las inglesas (`af_`, `am_`…) se dejan fuera: leerían
 * el español con acento.
 */
export const TTS_VOICES: NarratorVoice[] = [
  { id: 'em_alex', label: 'Álex — voz masculina' },
  { id: 'em_santa', label: 'Santa — masculina, más grave' },
  { id: 'ef_dora', label: 'Dora — voz femenina' },
];

@Injectable({ providedIn: 'root' })
export class NarratorService {
  /** Apagado de fábrica: nadie quiere que le hable una web sin pedirlo. */
  enabled = false;
  voice = TTS_VOICES[0].id;

  /** Última línea pedida. Si cambia mientras se genera, la anterior se tira. */
  private pending = 0;
  private current: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  lastError = '';

  /**
   * Se puede sustituir en los tests, que es la única razón de que sea un campo
   * y no una llamada directa a `fetch`.
   */
  fetchImpl: typeof fetch = globalThis.fetch?.bind(globalThis);

  /**
   * Narra una línea. No espera a nada ni rompe nada si falla.
   *
   * Devuelve la promesa solo para poder esperarla en los tests; el juego la
   * lanza y sigue.
   */
  async speak(text: string, settings: AiSettings): Promise<void> {
    if (!this.enabled) return;
    const clean = text.trim();
    if (!clean) return;
    if (settings.provider !== 'openrouter' || !settings.apiKey) return;

    const ticket = ++this.pending;
    try {
      const response = await this.fetchImpl('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: clean.slice(0, 600),
          voice: this.voice,
        }),
      });
      if (!response.ok) {
        this.lastError = `La voz no ha respondido (${response.status}).`;
        return;
      }
      // Mientras se generaba ha llegado otra crónica: esta ya no interesa.
      if (ticket !== this.pending) return;

      const blob = await response.blob();
      this.lastError = '';
      // Reproducir se aísla aparte: si falla el altavoz, el problema no es que
      // no se haya podido generar la voz, y decir lo contrario despista.
      this.play(blob);
    } catch {
      this.lastError = 'No se ha podido generar la voz.';
    }
  }

  private play(blob: Blob): void {
    this.stop();
    if (typeof URL === 'undefined' || typeof Audio === 'undefined') return;
    try {
      // El endpoint anuncia `audio/pcm` pero manda un WAV completo (cabecera
      // RIFF), así que el navegador lo reproduce tal cual.
      this.currentUrl = URL.createObjectURL(new Blob([blob], { type: 'audio/wav' }));
      this.current = new Audio(this.currentUrl);
      void this.current.play().catch(() => {
        // Algunos navegadores exigen un gesto del usuario antes de sonar.
        this.lastError = 'El navegador ha bloqueado el audio hasta que interactúes con la página.';
      });
    } catch {
      this.lastError = 'Este navegador no ha podido reproducir el audio.';
    }
  }

  /** Calla y suelta lo que estuviera sonando. */
  stop(): void {
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
    if (this.currentUrl && typeof URL !== 'undefined') {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.pending++;
      this.stop();
    }
  }
}
