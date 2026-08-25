import { describe, expect, it, vi } from 'vitest';
import {
  AiError,
  AiProvider,
  AiSettings,
  DEFAULT_AI_SETTINGS,
  FREE_MODELS,
  PROVIDER_LABELS,
  PROVIDER_SIGNUP,
  chat,
  clearAiSettings,
  extractJson,
  isFreeModel,
  loadAiSettings,
  saveAiSettings,
} from './ai-client';

/** localStorage de mentira para no depender del navegador. */
function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

function settings(overrides: Partial<AiSettings> = {}): AiSettings {
  return { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'test-key', ...overrides };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('cliente de modelos de lenguaje', () => {
  describe('catálogo', () => {
    it('todos los proveedores tienen etiqueta', () => {
      for (const provider of Object.keys(FREE_MODELS) as Array<keyof typeof FREE_MODELS>) {
        expect(PROVIDER_LABELS[provider]).toBeTruthy();
        expect(PROVIDER_SIGNUP[provider]).toBeDefined();
      }
    });

    it('todos los proveedores ofrecen al menos un modelo', () => {
      for (const models of Object.values(FREE_MODELS)) {
        expect(models.length).toBeGreaterThan(0);
        for (const model of models) {
          expect(model.id).toBeTruthy();
          expect(model.label).toBeTruthy();
          expect(model.note.length).toBeGreaterThan(5);
        }
      }
    });

    it('el modelo por defecto existe en su proveedor', () => {
      const models = FREE_MODELS[DEFAULT_AI_SETTINGS.provider].map((m) => m.id);
      expect(models).toContain(DEFAULT_AI_SETTINGS.model);
    });

    it('la IA por modelo viene desactivada de fábrica', () => {
      expect(DEFAULT_AI_SETTINGS.enabled).toBe(false);
      expect(DEFAULT_AI_SETTINGS.apiKey).toBe('');
    });
  });

  describe('chat', () => {
    it('falla si está desactivada', async () => {
      await expect(chat({ ...DEFAULT_AI_SETTINGS }, [])).rejects.toMatchObject({ code: 'disabled' });
    });

    it('falla si falta la clave', async () => {
      await expect(chat(settings({ apiKey: '' }), [])).rejects.toMatchObject({ code: 'no-key' });
    });

    it('falla si falta la URL base en modo compatible', async () => {
      await expect(
        chat(settings({ provider: 'openai-compatible', baseUrl: '' }), []),
      ).rejects.toMatchObject({ code: 'no-key' });
    });

    it('extrae el texto de una respuesta estilo OpenAI', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ choices: [{ message: { content: 'hola mesa' } }] }),
      );
      const text = await chat(settings(), [{ role: 'user', content: 'x' }], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(text).toBe('hola mesa');
    });

    it('extrae el texto de una respuesta de Gemini', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }),
      );
      const text = await chat(settings({ provider: 'gemini', model: 'gemini-2.0-flash' }), [], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(text).toBe('hola');
    });

    it('usa el endpoint correcto de cada proveedor', async () => {
      const calls: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        calls.push(url);
        return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
      });
      await chat(settings({ provider: 'openrouter' }), [], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      await chat(settings({ provider: 'groq', model: 'llama-3.3-70b-versatile' }), [], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(calls[0]).toContain('openrouter.ai');
      expect(calls[1]).toContain('api.groq.com');
    });

    it('manda la clave en la cabecera de autorización', async () => {
      let headers: Record<string, string> = {};
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        headers = init.headers as Record<string, string>;
        return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
      });
      await chat(settings({ apiKey: 'secreta' }), [], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(headers['Authorization']).toBe('Bearer secreta');
    });

    it('no manda cabecera de autorización a Gemini (va en la URL)', async () => {
      let headers: Record<string, string> = {};
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        headers = init.headers as Record<string, string>;
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
      });
      await chat(settings({ provider: 'gemini', model: 'gemini-2.0-flash' }), [], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(headers['Authorization']).toBeUndefined();
    });

    it('convierte un error HTTP en AiError de red', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ error: 'nope' }, false, 429));
      await expect(
        chat(settings(), [], { fetchImpl: fetchImpl as unknown as typeof fetch }),
      ).rejects.toMatchObject({ code: 'network' });
    });

    it('avisa cuando la respuesta no trae contenido', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ choices: [] }));
      await expect(
        chat(settings(), [], { fetchImpl: fetchImpl as unknown as typeof fetch }),
      ).rejects.toMatchObject({ code: 'bad-response' });
    });

    it('convierte un fallo de red en AiError', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new Error('sin conexión');
      });
      await expect(
        chat(settings(), [], { fetchImpl: fetchImpl as unknown as typeof fetch }),
      ).rejects.toBeInstanceOf(AiError);
    });

    it('trata la cancelación como tiempo agotado', async () => {
      const fetchImpl = vi.fn(async () => {
        const error = new Error('abort');
        error.name = 'AbortError';
        throw error;
      });
      await expect(
        chat(settings(), [], { fetchImpl: fetchImpl as unknown as typeof fetch }),
      ).rejects.toMatchObject({ code: 'timeout' });
    });

    it('el cuerpo de Gemini separa la instrucción de sistema', async () => {
      let body: any = {};
      const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(init.body as string);
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
      });
      await chat(
        settings({ provider: 'gemini', model: 'gemini-2.0-flash' }),
        [
          { role: 'system', content: 'eres un general' },
          { role: 'user', content: 'ataca' },
        ],
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      );
      expect(body.systemInstruction.parts[0].text).toBe('eres un general');
      expect(body.contents).toHaveLength(1);
    });
  });

  describe('extractJson', () => {
    it('lee un JSON pelado', () => {
      expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    });

    it('lee un JSON dentro de un bloque de código', () => {
      expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    });

    it('lee un JSON rodeado de texto', () => {
      expect(extractJson('Claro, aquí va: {"a":3} ¡suerte!')).toEqual({ a: 3 });
    });

    it('devuelve null si no hay JSON', () => {
      expect(extractJson('no hay nada aquí')).toBeNull();
      expect(extractJson('')).toBeNull();
    });

    it('devuelve null si el JSON está roto', () => {
      expect(extractJson('{"a": }')).toBeNull();
    });

    it('soporta objetos anidados', () => {
      expect(extractJson('{"a":{"b":[1,2]}}')).toEqual({ a: { b: [1, 2] } });
    });
  });

  describe('persistencia de la configuración', () => {
    it('devuelve los valores por defecto si no hay nada guardado', () => {
      expect(loadAiSettings(fakeStorage())).toEqual(DEFAULT_AI_SETTINGS);
    });

    it('guarda y recupera', () => {
      const storage = fakeStorage();
      saveAiSettings(settings({ model: 'x' }), storage);
      expect(loadAiSettings(storage).model).toBe('x');
      expect(loadAiSettings(storage).enabled).toBe(true);
    });

    it('completa los campos que falten', () => {
      const storage = fakeStorage();
      storage.setItem('risk_ai_settings', JSON.stringify({ model: 'solo-modelo' }));
      const loaded = loadAiSettings(storage);
      expect(loaded.model).toBe('solo-modelo');
      expect(loaded.provider).toBe(DEFAULT_AI_SETTINGS.provider);
    });

    it('aguanta un JSON corrupto', () => {
      const storage = fakeStorage();
      storage.setItem('risk_ai_settings', '{{{');
      expect(loadAiSettings(storage)).toEqual(DEFAULT_AI_SETTINGS);
    });

    it('permite borrar la configuración', () => {
      const storage = fakeStorage();
      saveAiSettings(settings(), storage);
      clearAiSettings(storage);
      expect(loadAiSettings(storage)).toEqual(DEFAULT_AI_SETTINGS);
    });

    it('funciona sin almacenamiento disponible', () => {
      expect(loadAiSettings(undefined)).toEqual(DEFAULT_AI_SETTINGS);
      expect(() => saveAiSettings(settings(), undefined)).not.toThrow();
      expect(() => clearAiSettings(undefined)).not.toThrow();
    });
  });
});

describe('solo modelos gratuitos', () => {
  it('acepta los de la lista de cada proveedor', () => {
    for (const provider of Object.keys(FREE_MODELS) as AiProvider[]) {
      for (const option of FREE_MODELS[provider]) {
        expect(isFreeModel(provider, option.id), `${provider}/${option.id}`).toBe(true);
      }
    }
  });

  it('acepta cualquier modelo con el sufijo :free de OpenRouter', () => {
    expect(isFreeModel('openrouter', 'algo/nuevo:free')).toBe(true);
    expect(isFreeModel('openrouter', ' algo/nuevo:free ')).toBe(true);
  });

  it('rechaza los de pago', () => {
    expect(isFreeModel('openrouter', 'openai/gpt-4o')).toBe(false);
    expect(isFreeModel('openrouter', 'anthropic/claude-opus-4')).toBe(false);
    expect(isFreeModel('groq', 'algo-que-no-esta')).toBe(false);
    expect(isFreeModel('openrouter', '')).toBe(false);
  });

  it('un servidor propio no cuesta dinero, así que vale cualquiera', () => {
    expect(isFreeModel('openai-compatible', 'llama3.2')).toBe(true);
  });

  it('la restricción viene puesta de fábrica', () => {
    expect(DEFAULT_AI_SETTINGS.freeOnly).toBe(true);
    expect(isFreeModel(DEFAULT_AI_SETTINGS.provider, DEFAULT_AI_SETTINGS.model)).toBe(true);
  });

  it('no se llama a un modelo de pago: ni se envía la petición', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;

    await expect(
      chat(
        { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'x', model: 'openai/gpt-4o' },
        [{ role: 'user', content: 'hola' }],
        { fetchImpl },
      ),
    ).rejects.toThrow(/no es un modelo gratuito/);
    expect(called).toBe(false);
  });

  it('quien quiera pagar puede, pero tiene que decirlo a propósito', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await chat(
      {
        ...DEFAULT_AI_SETTINGS,
        enabled: true,
        apiKey: 'x',
        model: 'openai/gpt-4o',
        freeOnly: false,
      },
      [{ role: 'user', content: 'hola' }],
      { fetchImpl },
    );
    expect(called).toBe(true);
  });
});
