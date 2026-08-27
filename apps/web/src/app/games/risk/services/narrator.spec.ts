import { describe, expect, it, beforeEach } from 'vitest';
import { NarratorService, TTS_MODEL, TTS_VOICES } from './narrator';
import { AiSettings, DEFAULT_AI_SETTINGS } from '../engine/ai/ai-client';

function settings(overrides: Partial<AiSettings> = {}): AiSettings {
  return { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'clave', ...overrides };
}

/** Respuesta de audio de mentira, con la cabecera WAV que manda el endpoint. */
function audioResponse(ok = true, status = 200): Response {
  return {
    ok,
    status,
    blob: async () => new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])]),
  } as Response;
}

describe('narrador de la crónica', () => {
  let narrator: NarratorService;
  let calls: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    narrator = new NarratorService();
    calls = [];
    narrator.fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return audioResponse();
    }) as unknown as typeof fetch;
  });

  describe('catálogo de voces', () => {
    it('todas las voces son españolas', () => {
      expect(TTS_VOICES.length).toBeGreaterThan(0);
      for (const voice of TTS_VOICES) {
        // Kokoro nombra las voces con el idioma delante: 'e' es español.
        expect(voice.id.startsWith('e'), voice.id).toBe(true);
        expect(voice.label.length).toBeGreaterThan(4);
      }
    });

    it('no se cuela ninguna voz inglesa', () => {
      for (const voice of TTS_VOICES) {
        expect(voice.id.startsWith('af_'), voice.id).toBe(false);
        expect(voice.id.startsWith('am_'), voice.id).toBe(false);
        expect(voice.id.endsWith('-en'), voice.id).toBe(false);
      }
    });

    it('arranca con una voz válida', () => {
      expect(TTS_VOICES.some((v) => v.id === narrator.voice)).toBe(true);
    });
  });

  describe('cuándo habla y cuándo no', () => {
    it('apagado de fábrica: no dice nada', async () => {
      expect(narrator.enabled).toBe(false);
      await narrator.speak('Cáceres a Badajoz.', settings());
      expect(calls).toHaveLength(0);
    });

    it('encendido, pide la voz al modelo', async () => {
      narrator.toggle();
      await narrator.speak('Cáceres a Badajoz.', settings());
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain('/audio/speech');
      expect(calls[0].body['model']).toBe(TTS_MODEL);
      expect(calls[0].body['voice']).toBe(narrator.voice);
      expect(calls[0].body['input']).toBe('Cáceres a Badajoz.');
    });

    it('sin clave no intenta nada', async () => {
      narrator.toggle();
      await narrator.speak('algo', settings({ apiKey: '' }));
      expect(calls).toHaveLength(0);
    });

    it('con otro proveedor tampoco: la voz es de OpenRouter', async () => {
      narrator.toggle();
      await narrator.speak('algo', settings({ provider: 'groq' }));
      expect(calls).toHaveLength(0);
    });

    it('un texto vacío no gasta una petición', async () => {
      narrator.toggle();
      await narrator.speak('   ', settings());
      expect(calls).toHaveLength(0);
    });

    it('recorta los textos largos antes de mandarlos', async () => {
      narrator.toggle();
      await narrator.speak('a'.repeat(2000), settings());
      expect(String(calls[0].body['input']).length).toBe(600);
    });

    it('manda la clave en la cabecera', async () => {
      narrator.toggle();
      let headers: Record<string, string> = {};
      narrator.fetchImpl = (async (_url: string, init: RequestInit) => {
        headers = init.headers as Record<string, string>;
        return audioResponse();
      }) as unknown as typeof fetch;
      await narrator.speak('hola', settings({ apiKey: 'secreta' }));
      expect(headers['Authorization']).toBe('Bearer secreta');
    });
  });

  describe('no se queda atrás', () => {
    it('si llega una crónica nueva mientras se genera, la vieja se tira', async () => {
      narrator.toggle();
      let resolveFirst: (r: Response) => void = () => {};
      let first = true;
      narrator.fetchImpl = (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        if (first) {
          first = false;
          return new Promise<Response>((resolve) => (resolveFirst = resolve));
        }
        return audioResponse();
      }) as unknown as typeof fetch;

      const slow = narrator.speak('la vieja', settings());
      await narrator.speak('la nueva', settings());
      resolveFirst(audioResponse());
      await slow;

      // Las dos se pidieron, pero la primera se descarta al volver tarde.
      expect(calls.map((c) => c.body['input'])).toEqual(['la vieja', 'la nueva']);
    });

    it('apagarlo invalida lo que estuviera en camino', async () => {
      narrator.toggle();
      await narrator.speak('algo', settings());
      narrator.toggle();
      expect(narrator.enabled).toBe(false);
      await narrator.speak('ya no', settings());
      expect(calls).toHaveLength(1);
    });
  });

  describe('cuando falla', () => {
    it('un error del servidor no rompe nada y deja aviso', async () => {
      narrator.toggle();
      narrator.fetchImpl = (async () => audioResponse(false, 429)) as unknown as typeof fetch;
      await expect(narrator.speak('hola', settings())).resolves.toBeUndefined();
      expect(narrator.lastError).toContain('429');
    });

    it('un fallo de red tampoco', async () => {
      narrator.toggle();
      narrator.fetchImpl = (async () => {
        throw new Error('sin conexión');
      }) as unknown as typeof fetch;
      await expect(narrator.speak('hola', settings())).resolves.toBeUndefined();
      expect(narrator.lastError.length).toBeGreaterThan(0);
    });

    it('tras un fallo, la siguiente vuelve a intentarlo', async () => {
      narrator.toggle();
      let fail = true;
      narrator.fetchImpl = (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        if (fail) {
          fail = false;
          return audioResponse(false, 500);
        }
        return audioResponse();
      }) as unknown as typeof fetch;

      await narrator.speak('una', settings());
      expect(narrator.lastError).toContain('500');
      await narrator.speak('dos', settings());
      expect(calls).toHaveLength(2);
      // La segunda sí se generó: el aviso ya no habla de generación.
      expect(narrator.lastError).not.toContain('generar');
    });
  });
});
