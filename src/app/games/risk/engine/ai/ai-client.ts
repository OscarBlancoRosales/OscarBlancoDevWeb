/**
 * Cliente de modelos de lenguaje para la IA del juego.
 *
 * Todo ocurre en el navegador: no hay backend. La clave de API la escribe el
 * usuario y se guarda SOLO en su localStorage; nunca viaja a Firebase ni se
 * comparte con el resto de la sala. Si no hay clave, el juego funciona igual
 * con el cerebro heurístico local, que es gratis y no necesita red.
 */

export type AiProvider = 'openrouter' | 'groq' | 'gemini' | 'openai-compatible';

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  apiKey: string;
  model: string;
  /** Solo para 'openai-compatible' (Ollama, LM Studio, un proxy propio...). */
  baseUrl?: string;
  /** Milisegundos antes de rendirse y usar el cerebro local. */
  timeoutMs?: number;
  /**
   * No llamar nunca a un modelo de pago. Encendido por defecto.
   *
   * El modelo se escribe a mano, así que sin esto un dedo torcido factura. Y si
   * algún día se comparte una clave, un modelo de pago la vacía en una tarde.
   */
  freeOnly?: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  provider: 'openrouter',
  apiKey: '',
  model: 'deepseek/deepseek-chat-v3-0324:free',
  timeoutMs: 12000,
  freeOnly: true,
};

export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

/**
 * Modelos con capa gratuita en cada proveedor. Están elegidos por ser gratis
 * y suficientemente buenos para razonar sobre un tablero.
 */
export const FREE_MODELS: Record<AiProvider, ModelOption[]> = {
  openrouter: [
    {
      id: 'deepseek/deepseek-chat-v3-0324:free',
      label: 'DeepSeek V3 (free)',
      note: 'El más listo de los gratuitos. Ideal para estrategia.',
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      label: 'Llama 3.3 70B (free)',
      note: 'Rápido y muy sólido en español.',
    },
    {
      id: 'google/gemma-3-27b-it:free',
      label: 'Gemma 3 27B (free)',
      note: 'Ligero, responde muy rápido.',
    },
    {
      id: 'qwen/qwen3-235b-a22b:free',
      label: 'Qwen3 235B (free)',
      note: 'Buen razonamiento, algo más lento.',
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B',
      note: 'Capa gratuita de Groq. Respuestas casi instantáneas.',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B',
      note: 'El más rápido; suficiente para el chat de la partida.',
    },
  ],
  gemini: [
    {
      id: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      note: 'Capa gratuita de Google AI Studio.',
    },
    {
      id: 'gemini-2.0-flash-lite',
      label: 'Gemini 2.0 Flash Lite',
      note: 'Más cuota gratuita, algo más simple.',
    },
  ],
  'openai-compatible': [
    {
      id: 'llama3.1',
      label: 'Modelo local (Ollama)',
      note: 'Apunta la URL base a tu servidor: gratis y sin límites.',
    },
  ],
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openrouter: 'OpenRouter',
  groq: 'Groq',
  gemini: 'Google AI Studio',
  'openai-compatible': 'Compatible OpenAI / local',
};

export const PROVIDER_SIGNUP: Record<AiProvider, string> = {
  openrouter: 'https://openrouter.ai/keys',
  groq: 'https://console.groq.com/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
  'openai-compatible': '',
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiError extends Error {
  constructor(
    public code: 'no-key' | 'network' | 'timeout' | 'bad-response' | 'disabled' | 'paid-model',
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

function endpointFor(settings: AiSettings): string {
  switch (settings.provider) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    case 'gemini':
      return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        settings.model,
      )}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
    case 'openai-compatible': {
      const base = (settings.baseUrl ?? '').replace(/\/+$/, '');
      return `${base}/chat/completions`;
    }
  }
}

function headersFor(settings: AiSettings): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.provider === 'gemini') return headers;
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] =
      typeof window !== 'undefined' ? window.location.origin : 'https://devweb.local';
    headers['X-Title'] = 'DevWeb Risk';
  }
  return headers;
}

function bodyFor(settings: AiSettings, messages: ChatMessage[], maxTokens: number): string {
  if (settings.provider === 'gemini') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const rest = messages.filter((m) => m.role !== 'system');
    return JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: rest.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens },
    });
  }
  return JSON.stringify({
    model: settings.model,
    messages,
    temperature: 0.85,
    max_tokens: maxTokens,
  });
}

function extractText(settings: AiSettings, payload: unknown): string {
  const data = payload as Record<string, any>;
  if (settings.provider === 'gemini') {
    const text = data?.['candidates']?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === 'string') return text;
    throw new AiError('bad-response', 'Respuesta de Gemini sin texto');
  }
  const text = data?.['choices']?.[0]?.message?.content;
  if (typeof text === 'string') return text;
  throw new AiError('bad-response', 'Respuesta sin contenido');
}

/**
 * ¿Este modelo es gratuito?
 *
 * Tres formas de serlo: estar en la lista de gratuitos del proveedor, llevar el
 * sufijo `:free` que OpenRouter le pone a los suyos, o correr en tu propia
 * máquina (Ollama, LM Studio), donde no hay factura que valga.
 */
export function isFreeModel(provider: AiProvider, model: string): boolean {
  const id = model.trim();
  if (!id) return false;
  if (FREE_MODELS[provider]?.some((option) => option.id === id)) return true;
  if (provider === 'openrouter') return id.endsWith(':free');
  if (provider === 'openai-compatible') return true;
  return false;
}

/** Llama al modelo y devuelve el texto plano de la respuesta. */
export async function chat(
  settings: AiSettings,
  messages: ChatMessage[],
  options: { maxTokens?: number; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  if (!settings.enabled) throw new AiError('disabled', 'La IA por modelo está desactivada');
  if (settings.provider !== 'openai-compatible' && !settings.apiKey) {
    throw new AiError('no-key', 'Falta la clave de API');
  }
  if (settings.provider === 'openai-compatible' && !settings.baseUrl) {
    throw new AiError('no-key', 'Falta la URL base del servidor compatible');
  }
  if (settings.freeOnly !== false && !isFreeModel(settings.provider, settings.model)) {
    throw new AiError(
      'paid-model',
      `"${settings.model}" no es un modelo gratuito. Elige uno de la lista o desactiva la restricción.`,
    );
  }

  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs ?? 12000);

  try {
    const response = await doFetch(endpointFor(settings), {
      method: 'POST',
      headers: headersFor(settings),
      body: bodyFor(settings, messages, options.maxTokens ?? 400),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AiError(
        'network',
        `El proveedor respondió ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`,
      );
    }
    return extractText(settings, await response.json());
  } catch (error) {
    if (error instanceof AiError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new AiError('timeout', 'El modelo ha tardado demasiado');
    }
    throw new AiError('network', (error as Error)?.message ?? 'Error de red');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extrae el primer objeto JSON de una respuesta, tolerando que el modelo lo
 * envuelva en texto o en un bloque de código.
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    const slice = candidate.slice(start, end + 1);
    try {
      return JSON.parse(slice) as T;
    } catch {
      // Sigue probando con el siguiente candidato.
    }
  }
  return null;
}

const STORAGE_KEY = 'risk_ai_settings';

/** Lee la configuración guardada (solo en este navegador). */
export function loadAiSettings(storage: Storage | undefined = safeStorage()): AiSettings {
  if (!storage) return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(
  settings: AiSettings,
  storage: Storage | undefined = safeStorage(),
): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettings(storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
