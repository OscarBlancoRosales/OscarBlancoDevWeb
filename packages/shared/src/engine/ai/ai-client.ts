/**
 * Cliente de modelos de lenguaje para la IA del juego.
 *
 * Todo ocurre en el navegador: no hay backend. La clave de API la escribe el
 * usuario y se guarda SOLO en su localStorage; nunca viaja a Firebase ni se
 * comparte con el resto de la sala. Si no hay clave, el juego funciona igual
 * con el cerebro heurístico local, que es gratis y no necesita red.
 */

import { browserStorage, currentOrigin } from '../../platform';
import type { KeyValueStorage } from '../../platform';

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
  model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
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
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      label: 'Nemotron 3 Ultra (free)',
      note: 'El mejor con diferencia: JSON limpio en ~380 ms y el español más natural.',
    },
    {
      id: 'nvidia/nemotron-3-super-120b-a12b:free',
      label: 'Nemotron 3 Super (free)',
      note: 'Casi tan rápido y algo más sobrio. Buena reserva del Ultra.',
    },
    {
      id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      label: 'Nemotron 3 Nano Omni (free)',
      note: 'El ligero que sí cumple: rápido y sin salirse del guion.',
    },
    {
      id: 'dots-studio/dots-3-note-preview:free',
      label: 'Dots3-Note Preview (free)',
      note: 'Correcto, algo más lento y se le cuela alguna palabra en inglés.',
    },
    {
      id: 'z-ai/glm-5.2:free',
      label: 'GLM 5.2 (free)',
      note: 'Bueno cuando responde, pero se satura a menudo.',
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
    public code: 'no-key' | 'network' | 'timeout' | 'bad-response' | 'disabled' | 'paid-model' | 'rate-limited' | 'unavailable',
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
      currentOrigin('https://devweb.local');
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
    // Los modelos de razonamiento gratuitos (los Nemotron, MiniMax, GLM…)
    // piensan en voz alta ANTES de contestar, y ese monólogo se come el
    // presupuesto de tokens: medido, se gastaban los 320 razonando y devolvían
    // texto cortado sin el JSON, así que la partida caía siempre al cerebro
    // local sin decir por qué. Excluyendo el razonamiento contestan en menos de
    // 400 ms con el JSON limpio.
    ...(settings.provider === 'openrouter' ? { reasoning: { exclude: true } } : {}),
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
 * Modelos a los que recurrir, en orden, cuando el elegido no contesta.
 *
 * Los gratuitos se saturan: midiendo la lista entera, GLM 5.2, Gemma 4, Laguna
 * XS y LFM devolvieron 429 o 503 en la misma tanda en que los Nemotron
 * contestaban en menos de 400 ms. Sin una cadena de reserva, un 429 dejaba la
 * mesa sin comentarios de IA y sin explicar por qué.
 */
export const FALLBACK_CHAIN: Record<AiProvider, string[]> = {
  openrouter: [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'dots-studio/dots-3-note-preview:free',
  ],
  groq: [],
  gemini: [],
  'openai-compatible': [],
};

/** ¿Merece la pena reintentar con otro modelo? */
export function isRetryable(error: unknown): boolean {
  const code = (error as AiError)?.code;
  return code === 'rate-limited' || code === 'unavailable';
}

/**
 * Llama al modelo elegido y, si está saturado, va bajando por la cadena.
 *
 * Devuelve también con qué modelo se ha contestado, que es lo que permite
 * enseñarlo en la mesa en vez de dejar al jugador adivinando.
 */
export async function chatWithFallback(
  settings: AiSettings,
  messages: ChatMessage[],
  options: { maxTokens?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ text: string; model: string }> {
  const chain = [settings.model, ...(FALLBACK_CHAIN[settings.provider] ?? [])].filter(
    (model, index, all) => model && all.indexOf(model) === index,
  );

  let lastError: unknown = new AiError('bad-response', 'Sin modelos que probar');
  for (const model of chain) {
    if (settings.freeOnly !== false && !isFreeModel(settings.provider, model)) continue;
    try {
      const text = await chat({ ...settings, model }, messages, options);
      return { text, model };
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
    }
  }
  throw lastError;
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
  const timeout = setTimeout(() => { controller.abort(); }, settings.timeoutMs ?? 12000);

  try {
    const response = await doFetch(endpointFor(settings), {
      method: 'POST',
      headers: headersFor(settings),
      body: bodyFor(settings, messages, options.maxTokens ?? 400),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new AiError('rate-limited', 'El modelo está saturado ahora mismo');
    }
    if (response.status === 503 || response.status === 502) {
      throw new AiError('unavailable', 'El modelo no está disponible ahora mismo');
    }
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
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
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
/**
 * Clave de la casa: la que se despliega con la aplicación.
 *
 * ### Léelo antes de usarla
 *
 * Esto es una web estática. Cualquier clave que viaje con ella **es pública**:
 * se lee abriendo las herramientas del navegador. No hay forma de esconderla, y
 * este archivo no la esconde: lo único que hace es mantenerla **fuera del
 * repositorio**, que es lo que de verdad importa, porque el historial de git es
 * para siempre y se puede buscar.
 *
 * Por eso el fichero `public/ai-key.json` está en `.gitignore` y solo se
 * distribuye la plantilla vacía. Quien despliegue pone la suya.
 *
 * Y por eso conviene que sea una clave de capa gratuita y con límite de gasto:
 * lo peor que puede pasar entonces es que alguien agote el cupo de peticiones,
 * no que llegue una factura.
 */
export interface BundledKeys {
  openrouter?: string;
  groq?: string;
  gemini?: string;
}

let bundledCache: BundledKeys | null = null;

/** Lee la clave de la casa, si el despliegue trae una. Se pide una sola vez. */
const BUNDLED_PROVIDERS = ['openrouter', 'groq', 'gemini'] as const;

export async function fetchBundledKeys(
  fetchImpl: typeof fetch | undefined = globalThis.fetch,
): Promise<BundledKeys> {
  if (bundledCache) return bundledCache;
  if (!fetchImpl) return (bundledCache = {});
  try {
    const response = await fetchImpl('ai-key.json', { cache: 'no-store' });
    if (!response.ok) return (bundledCache = {});
    const parsed = (await response.json()) as BundledKeys | null;
    const keys: BundledKeys = {};
    for (const provider of BUNDLED_PROVIDERS) {
      const value = parsed?.[provider];
      if (typeof value === 'string') keys[provider] = value.trim();
    }
    bundledCache = keys;
    return keys;
  } catch {
    return (bundledCache = {});
  }
}

/** Solo para tests: olvida lo leído. */
export function clearBundledCache(): void {
  bundledCache = null;
}

/**
 * Rellena la clave con la de la casa cuando el jugador no ha puesto la suya.
 *
 * La clave del jugador SIEMPRE gana: si alguien se ha molestado en escribir la
 * suya, no se la pisamos. Y la IA solo se enciende sola si el jugador todavía no
 * había tocado los ajustes; en cuanto los guarda, manda él.
 */
export function withBundledKey(
  settings: AiSettings,
  bundled: BundledKeys,
  options: { untouched?: boolean } = {},
): AiSettings {
  if (settings.apiKey) return settings;
  const key = bundled[settings.provider as keyof BundledKeys];
  if (!key) return settings;
  return {
    ...settings,
    apiKey: key,
    enabled: options.untouched ? true : settings.enabled,
  };
}

/** ¿El jugador ha guardado alguna vez sus ajustes de IA? */
export function hasStoredAiSettings(storage: KeyValueStorage | undefined = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadAiSettings(storage: KeyValueStorage | undefined = browserStorage()): AiSettings {
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
  storage: KeyValueStorage | undefined = browserStorage(),
): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettings(storage: KeyValueStorage | undefined = browserStorage()): void {
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

