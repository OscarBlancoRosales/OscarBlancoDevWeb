import { Card, CardSymbol, GameMap, RuleError } from './types';
import { Rng, shuffle } from './rng';

const SYMBOL_CYCLE: CardSymbol[] = ['infantry', 'cavalry', 'artillery'];

/** Símbolos legibles para la interfaz. */
export const CARD_ICON: Record<CardSymbol, string> = {
  infantry: '🪖',
  cavalry: '🐎',
  artillery: '🎯',
  wildcard: '★',
};

export const CARD_LABEL: Record<CardSymbol, string> = {
  infantry: 'Infantería',
  cavalry: 'Caballería',
  artillery: 'Artillería',
  wildcard: 'Comodín',
};

/**
 * Construye el mazo: una carta por territorio repartiendo los tres símbolos
 * en ciclo, más dos comodines. Se baraja de forma determinista.
 */
export function buildDeck(map: GameMap, rng: Rng): Card[] {
  const cards: Card[] = map.territories.map((territory, index) => ({
    id: `card-${territory.id}`,
    territoryId: territory.id,
    symbol: SYMBOL_CYCLE[index % SYMBOL_CYCLE.length],
  }));
  cards.push({ id: 'card-wild-1', territoryId: null, symbol: 'wildcard' });
  cards.push({ id: 'card-wild-2', territoryId: null, symbol: 'wildcard' });
  return shuffle(cards, rng);
}

/** Un trío es válido si los tres símbolos coinciden o son los tres distintos. */
export function isValidSet(cards: readonly Card[]): boolean {
  if (cards.length !== 3) return false;
  const wildcards = cards.filter((c) => c.symbol === 'wildcard').length;
  const real = cards.filter((c) => c.symbol !== 'wildcard');
  // Con dos o más comodines cualquier combinación es válida.
  if (wildcards >= 2) return true;
  if (wildcards === 1) {
    // Con un comodín basta con que los otros dos sean iguales o distintos: siempre vale.
    return real.length === 2;
  }
  const unique = new Set(real.map((c) => c.symbol));
  return unique.size === 1 || unique.size === 3;
}

/**
 * Valor del canje número `tradeCount + 1`.
 * Progresión clásica: 4, 6, 8, 10, 12, 15 y a partir de ahí +5.
 */
export function tradeValue(tradeCount: number, progression: 'classic' | 'fixed' = 'classic'): number {
  if (progression === 'fixed') return 6;
  const ladder = [4, 6, 8, 10, 12, 15];
  if (tradeCount < ladder.length) return ladder[tradeCount];
  return 15 + 5 * (tradeCount - ladder.length + 1);
}

/** Busca el primer trío canjeable de la mano (null si no hay ninguno). */
export function findTradeableSet(hand: readonly Card[]): [Card, Card, Card] | null {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const trio = [hand[i], hand[j], hand[k]];
        if (isValidSet(trio)) return trio as [Card, Card, Card];
      }
    }
  }
  return null;
}

/** Todos los tríos canjeables posibles de una mano. */
export function allTradeableSets(hand: readonly Card[]): Array<[Card, Card, Card]> {
  const out: Array<[Card, Card, Card]> = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const trio = [hand[i], hand[j], hand[k]];
        if (isValidSet(trio)) out.push(trio as [Card, Card, Card]);
      }
    }
  }
  return out;
}

/** Extrae de la mano las cartas indicadas o lanza un RuleError explicativo. */
export function takeCards(hand: readonly Card[], ids: readonly string[]): Card[] {
  const picked: Card[] = [];
  for (const id of ids) {
    const card = hand.find((c) => c.id === id && !picked.includes(c));
    if (!card) throw new RuleError('card-not-in-hand', `No tienes la carta ${id}`);
    picked.push(card);
  }
  return picked;
}
