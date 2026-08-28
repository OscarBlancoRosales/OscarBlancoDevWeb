import { BotProfile } from '@devweb/shared/engine/types';

/**
 * Los comandantes que puede elegir una persona.
 *
 * Viven en la web y no en `packages/shared` a propósito: son retratos y frases,
 * no reglas. El motor no sabe ni tiene por qué saber qué cara tiene nadie.
 *
 * El nombre y la frase salen del retrato, no del nombre del fichero: quien
 * elige está mirando la cara, y lo que lea debajo tiene que cuadrar con ella.
 */
export interface Commander {
  id: string;
  name: string;
  /** Una línea que le da carácter. Es lo que hace que elegir signifique algo. */
  tagline: string;
  portrait: string;
}

export const COMMANDERS: readonly Commander[] = [
  {
    id: 'hierro',
    name: 'Coronel Hierro',
    tagline: 'Perdió el ojo en una trinchera y no lo ha echado de menos.',
    portrait: 'assets/risk/commanders/hierro.png',
  },
  {
    id: 'marea',
    name: 'Almirante Marea',
    tagline: 'Nunca ha perdido una costa. Tampoco ha visitado el interior.',
    portrait: 'assets/risk/commanders/marea.png',
  },
  {
    id: 'fantasma',
    name: 'Fantasma',
    tagline: 'Nadie recuerda haberle visto llegar a ninguna parte.',
    portrait: 'assets/risk/commanders/fantasma.png',
  },
  {
    id: 'sol',
    name: 'Viejo Sol',
    tagline: 'Cuarenta años de desierto y sigue sin quitarse la gorra.',
    portrait: 'assets/risk/commanders/sol.png',
  },
  {
    id: 'forja',
    name: 'Forja',
    tagline: 'Si no se puede cruzar, lo vuela y luego lo reconstruye.',
    portrait: 'assets/risk/commanders/forja.png',
  },
  {
    id: 'vanguardia',
    name: 'Vanguardia',
    tagline: 'Llega la primera y se va la última. Siempre.',
    portrait: 'assets/risk/commanders/vanguardia.png',
  },
];

export const COMMANDER_IDS: readonly string[] = COMMANDERS.map((c) => c.id);

/**
 * El retrato de un bot sale de su perfil, no se elige.
 *
 * Hay uno por cada perfil, y por eso el bot agresivo tiene cara de bot agresivo:
 * el jugador reconoce contra quién juega antes de leer una sola palabra.
 */
export function botPortrait(profile: BotProfile | undefined): string {
  return `assets/risk/bots/${profile ?? 'oportunista'}.png`;
}

export function commanderById(id: string | undefined): Commander | undefined {
  return COMMANDERS.find((commander) => commander.id === id);
}

/**
 * El retrato de un asiento: su comandante si lo eligió, el de su perfil si es
 * un bot, y si no, uno de los que queden libres.
 */
export function portraitFor(
  seat: { avatar?: string | undefined; kind: 'human' | 'bot'; botProfile?: BotProfile } | undefined,
  fallbackIndex: number,
): string {
  if (seat?.kind === 'bot') return botPortrait(seat.botProfile);
  const elegido = commanderById(seat?.avatar);
  if (elegido) return elegido.portrait;
  return COMMANDERS[fallbackIndex % COMMANDERS.length]!.portrait;
}
