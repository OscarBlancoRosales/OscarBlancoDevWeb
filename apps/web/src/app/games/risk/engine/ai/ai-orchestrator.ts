import { GameMap, GameState, PlayerId, TerritoryId } from '../types';
import { playerById } from '../engine';
import { territoriesOf } from '../rules';
import {
  advisorTip,
  botCommentary,
  continentProgress,
  rankedAttacks,
  standings,
  StrategyBias,
  threatMap,
  traitsOf,
} from './bot-brain';
import { AiSettings, ChatMessage, chatWithFallback, extractJson } from './ai-client';
import { ChronicleContext } from './chronicle';

/**
 * Orquestador de la IA.
 *
 * Reparte el trabajo entre dos cerebros:
 *  - el heurístico local, que SIEMPRE decide las jugadas y garantiza que sean legales;
 *  - el modelo de lenguaje (opcional y gratuito), que aporta la voz y la
 *    intención estratégica: a qué territorios apuntar y cuánto arriesgar.
 *
 * Si el modelo falla, tarda o dice tonterías, la partida sigue exactamente igual
 * con el cerebro local. Nunca se bloquea la mesa esperando a una API.
 */

export interface AiTurnPlan {
  /** Mensaje que el bot publica en el chat de la sala. */
  message: string;
  priority: 'atacar' | 'consolidar' | 'expandir';
  bias: StrategyBias;
  source: 'llm' | 'local';
  /** Motivo del respaldo local, si lo hubo. */
  fallbackReason?: string;
}

const PRIORITY_SHIFT: Record<AiTurnPlan['priority'], number> = {
  atacar: -0.12,
  consolidar: 0.12,
  expandir: 0,
};

/** Resumen del tablero en texto, pensado para gastar pocos tokens. */
export function describeBoard(state: GameState, map: GameMap, playerId: PlayerId): string {
  const player = playerById(state, playerId);
  if (!player) return '';
  const nameOf = (id: TerritoryId) => map.territories.find((t) => t.id === id)?.name ?? id;

  const owned = territoriesOf(state, playerId);
  const board = standings(state);
  const progress = continentProgress(state, map, playerId).slice(0, 4);
  const threats = threatMap(state, map, playerId).slice(0, 5);
  const attacks = rankedAttacks(state, map, playerId, player.botProfile).slice(0, 6);

  const lines: string[] = [];
  lines.push(`Mapa: ${map.name}. Ronda ${state.round}. Fase: ${state.phase}.`);
  lines.push(
    `Eres ${player.name} (perfil ${traitsOf(player.botProfile).label}). Tienes ${owned.length} territorios y ${player.reserve} refuerzos por colocar, ${player.cards.length} cartas.`,
  );
  lines.push(
    `Clasificación: ${board
      .map((entry) => `${playerById(state, entry.playerId)?.name} ${entry.territories}t/${entry.armies}e`)
      .join(' · ')}`,
  );
  lines.push(
    `Continentes: ${progress
      .map((c) => `${c.name} ${c.owned}/${c.total} (+${c.bonus})`)
      .join(' · ')}`,
  );
  if (threats.length > 0) {
    lines.push(
      `Fronteras propias en riesgo: ${threats
        .map((t) => `${nameOf(t.id)}[${t.id}] ${t.armies} vs ${t.enemyArmies}`)
        .join(' · ')}`,
    );
  }
  if (attacks.length > 0) {
    lines.push(
      `Ataques posibles: ${attacks
        .map(
          (a) =>
            `${nameOf(a.from)}[${a.from}] -> ${nameOf(a.to)}[${a.to}] ${Math.round(a.odds * 100)}%`,
        )
        .join(' · ')}`,
    );
  }
  return lines.join('\n');
}

const SYSTEM_PROMPT = `Eres un jugador veterano de RISK que comenta su turno en español de España.
Respondes SIEMPRE con un único objeto JSON, sin texto alrededor, con esta forma:
{"mensaje":"<2 o 3 frases con tu plan, con chispa y sin pasarte de largo>","prioridad":"atacar|consolidar|expandir","objetivos":["ID","ID"],"defender":["ID","ID"]}
Los IDs son los códigos entre corchetes del resumen del tablero. "objetivos" son territorios enemigos que quieres atacar y "defender" territorios propios que quieres reforzar.
No inventes IDs que no aparezcan. Máximo 3 en cada lista. El mensaje va dirigido al resto de la mesa.`;

const CHRONICLE_PROMPT = `Eres un corresponsal de guerra que narra la Guerra Civil española de 1936 en español de España.
Te llega una nota con el movimiento y con lo que pasó de verdad en ese sitio. La reescribes como una crónica breve.
Respondes SIEMPRE con un único objeto JSON: {"mensaje":"<2 o 3 frases>"}
Tono sobrio de parte de guerra: hablas de columnas, carreteras, puentes, frentes y abastecimiento.
No glorificas a ningún bando ni insultas a nadie, no inventas cifras de bajas, y no narras represión ni violencia contra civiles.
Si la nota dice que la historia se tuerce (ataca el bando que no lo hizo), cuéntalo como lo que es: una campaña que en la guerra real no ocurrió así.`;

const ADVISOR_PROMPT = `Eres el estratega personal de un jugador de RISK. Hablas en español de España, directo y sin rodeos.
Respondes SIEMPRE con un único objeto JSON: {"mensaje":"<consejo concreto de 2 o 3 frases para este turno>"}
Céntrate en qué hacer AHORA: dónde colocar refuerzos, qué atacar y qué riesgo tiene. Usa los nombres de los territorios, no los códigos.`;

interface RawPlan {
  mensaje?: unknown;
  prioridad?: unknown;
  objetivos?: unknown;
  defender?: unknown;
}

/** Valida y limpia lo que responde el modelo. Nada entra sin pasar por aquí. */
export function sanitizePlan(
  raw: unknown,
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
): Omit<AiTurnPlan, 'source'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const plan = raw as RawPlan;

  const message = typeof plan.mensaje === 'string' ? plan.mensaje.trim().slice(0, 400) : '';
  if (!message) return null;

  const validIds = new Set(map.territories.map((t) => t.id));
  const asIds = (value: unknown, wantOwn: boolean): TerritoryId[] => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => validIds.has(item))
      .filter((item) => {
        const isOwn = state.territories[item]?.ownerId === playerId;
        return wantOwn ? isOwn : !isOwn;
      })
      .slice(0, 3);
  };

  const priority: AiTurnPlan['priority'] =
    plan.prioridad === 'atacar' || plan.prioridad === 'consolidar' || plan.prioridad === 'expandir'
      ? plan.prioridad
      : 'expandir';

  return {
    message,
    priority,
    bias: {
      targets: asIds(plan.objetivos, false),
      defend: asIds(plan.defender, true),
      thresholdShift: PRIORITY_SHIFT[priority],
    },
  };
}

/** Plan puramente local: siempre disponible, sin red y sin coste. */
export function localPlan(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  fallbackReason?: string,
): AiTurnPlan {
  const attacks = rankedAttacks(state, map, playerId, playerById(state, playerId)?.botProfile);
  const threats = threatMap(state, map, playerId);
  const best = attacks[0];
  const priority: AiTurnPlan['priority'] = !best
    ? 'consolidar'
    : best.odds >= 0.65
      ? 'atacar'
      : best.odds >= 0.5
        ? 'expandir'
        : 'consolidar';

  return {
    message: botCommentary(state, map, playerId),
    priority,
    bias: {
      targets: attacks.slice(0, 3).map((a) => a.to),
      defend: threats.slice(0, 2).map((t) => t.id),
      thresholdShift: 0,
    },
    source: 'local',
    ...(fallbackReason !== undefined && { fallbackReason }),
  };
}

/**
 * Pide al modelo el plan del turno. Si algo falla, devuelve el plan local.
 * Este método nunca lanza: la partida no puede depender de una API externa.
 */
export async function requestTurnPlan(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  settings: AiSettings,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<AiTurnPlan> {
  if (!settings.enabled) return localPlan(state, map, playerId, 'IA por modelo desactivada');

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: describeBoard(state, map, playerId) },
  ];

  try {
    const { text } = await chatWithFallback(settings, messages, {
      maxTokens: 700,
      ...(options.fetchImpl && { fetchImpl: options.fetchImpl }),
    });
    const parsed = extractJson<RawPlan>(text);
    const clean = sanitizePlan(parsed, map, state, playerId);
    if (!clean) return localPlan(state, map, playerId, 'respuesta del modelo no interpretable');
    return { ...clean, source: 'llm' };
  } catch (error) {
    return localPlan(state, map, playerId, (error as Error)?.message ?? 'error del modelo');
  }
}

/**
 * Crónica de guerra escrita por el modelo, con la local como red de seguridad.
 *
 * Se le da el episodio histórico ya resuelto (quién ataca, desde dónde, y qué
 * pasó de verdad ahí) y se le pide que lo cuente. Si no hay modelo, si está
 * saturado o si contesta algo raro, se usa la línea local, que ya es buena: la
 * partida nunca se queda sin crónica.
 */
export async function requestChronicle(
  _context: ChronicleContext,
  fallback: string,
  settings: AiSettings,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<{ message: string; source: 'llm' | 'local' }> {
  if (!settings.enabled) return { message: fallback, source: 'local' };

  const messages: ChatMessage[] = [
    { role: 'system', content: CHRONICLE_PROMPT },
    { role: 'user', content: fallback },
  ];

  try {
    const { text } = await chatWithFallback(settings, messages, {
      maxTokens: 600,
      ...(options.fetchImpl && { fetchImpl: options.fetchImpl }),
    });
    const parsed = extractJson<{ mensaje?: unknown }>(text);
    const message = typeof parsed?.mensaje === 'string' ? parsed.mensaje.trim() : '';
    if (message.length < 20) return { message: fallback, source: 'local' };
    return { message: message.slice(0, 560), source: 'llm' };
  } catch {
    return { message: fallback, source: 'local' };
  }
}

/** Consejo para el jugador humano. Igual de tolerante a fallos. */
export async function requestAdvice(
  state: GameState,
  map: GameMap,
  playerId: PlayerId,
  settings: AiSettings,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<{ message: string; source: 'llm' | 'local' }> {
  const local = advisorTip(state, map, playerId);
  if (!settings.enabled) return { message: local, source: 'local' };

  const messages: ChatMessage[] = [
    { role: 'system', content: ADVISOR_PROMPT },
    { role: 'user', content: describeBoard(state, map, playerId) },
  ];

  try {
    const { text } = await chatWithFallback(settings, messages, {
      maxTokens: 600,
      ...(options.fetchImpl && { fetchImpl: options.fetchImpl }),
    });
    const parsed = extractJson<{ mensaje?: unknown }>(text);
    const message = typeof parsed?.mensaje === 'string' ? parsed.mensaje.trim() : '';
    if (!message) return { message: local, source: 'local' };
    return { message: message.slice(0, 400), source: 'llm' };
  } catch {
    return { message: local, source: 'local' };
  }
}
