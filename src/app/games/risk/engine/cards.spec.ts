import { describe, expect, it } from 'vitest';
import {
  allTradeableSets,
  buildDeck,
  CARD_ICON,
  CARD_LABEL,
  findTradeableSet,
  isValidSet,
  takeCards,
  tradeValue,
} from './cards';
import { createRng } from './rng';
import { Card, CardSymbol } from './types';
import { TINY_MAP } from './testing';
import { WORLD_MAP } from './maps/world.map';

function card(id: string, symbol: CardSymbol, territoryId: string | null = null): Card {
  return { id, symbol, territoryId };
}

describe('cartas', () => {
  describe('buildDeck', () => {
    it('crea una carta por territorio más dos comodines', () => {
      const deck = buildDeck(WORLD_MAP, createRng(1));
      expect(deck).toHaveLength(WORLD_MAP.territories.length + 2);
    });

    it('incluye exactamente dos comodines', () => {
      const deck = buildDeck(WORLD_MAP, createRng(1));
      expect(deck.filter((c) => c.symbol === 'wildcard')).toHaveLength(2);
    });

    it('reparte los tres símbolos de forma equilibrada', () => {
      const deck = buildDeck(WORLD_MAP, createRng(1));
      const counts: Record<string, number> = {};
      for (const c of deck) counts[c.symbol] = (counts[c.symbol] ?? 0) + 1;
      const values = [counts['infantry'], counts['cavalry'], counts['artillery']];
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    });

    it('cubre todos los territorios del mapa', () => {
      const deck = buildDeck(WORLD_MAP, createRng(3));
      const covered = new Set(deck.map((c) => c.territoryId).filter(Boolean));
      expect(covered.size).toBe(WORLD_MAP.territories.length);
    });

    it('los identificadores de carta son únicos', () => {
      const deck = buildDeck(WORLD_MAP, createRng(3));
      expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
    });

    it('el barajado es determinista', () => {
      expect(buildDeck(TINY_MAP, createRng(9))).toEqual(buildDeck(TINY_MAP, createRng(9)));
    });

    it('semillas distintas barajan distinto', () => {
      expect(buildDeck(WORLD_MAP, createRng(1))).not.toEqual(buildDeck(WORLD_MAP, createRng(2)));
    });
  });

  describe('isValidSet', () => {
    it('acepta tres símbolos iguales', () => {
      expect(
        isValidSet([card('1', 'infantry'), card('2', 'infantry'), card('3', 'infantry')]),
      ).toBe(true);
    });

    it('acepta los tres símbolos distintos', () => {
      expect(
        isValidSet([card('1', 'infantry'), card('2', 'cavalry'), card('3', 'artillery')]),
      ).toBe(true);
    });

    it('rechaza dos iguales y uno distinto', () => {
      expect(
        isValidSet([card('1', 'infantry'), card('2', 'infantry'), card('3', 'cavalry')]),
      ).toBe(false);
    });

    it('un comodín completa cualquier pareja', () => {
      expect(
        isValidSet([card('1', 'infantry'), card('2', 'cavalry'), card('w', 'wildcard')]),
      ).toBe(true);
      expect(
        isValidSet([card('1', 'infantry'), card('2', 'infantry'), card('w', 'wildcard')]),
      ).toBe(true);
    });

    it('dos comodines valen con cualquier tercera', () => {
      expect(
        isValidSet([card('w1', 'wildcard'), card('w2', 'wildcard'), card('3', 'cavalry')]),
      ).toBe(true);
    });

    it('rechaza conjuntos que no son de tres cartas', () => {
      expect(isValidSet([])).toBe(false);
      expect(isValidSet([card('1', 'infantry')])).toBe(false);
      expect(
        isValidSet([
          card('1', 'infantry'),
          card('2', 'infantry'),
          card('3', 'infantry'),
          card('4', 'infantry'),
        ]),
      ).toBe(false);
    });
  });

  describe('tradeValue', () => {
    it('sigue la progresión clásica', () => {
      expect([0, 1, 2, 3, 4, 5].map((n) => tradeValue(n))).toEqual([4, 6, 8, 10, 12, 15]);
    });

    it('a partir del sexto canje sube de cinco en cinco', () => {
      expect(tradeValue(6)).toBe(20);
      expect(tradeValue(7)).toBe(25);
      expect(tradeValue(10)).toBe(40);
    });

    it('es siempre creciente', () => {
      for (let n = 0; n < 20; n++) {
        expect(tradeValue(n + 1)).toBeGreaterThan(tradeValue(n));
      }
    });

    it('la progresión fija siempre vale lo mismo', () => {
      expect(tradeValue(0, 'fixed')).toBe(6);
      expect(tradeValue(9, 'fixed')).toBe(6);
    });
  });

  describe('findTradeableSet', () => {
    it('devuelve null si no hay ningún trío', () => {
      expect(
        findTradeableSet([card('1', 'infantry'), card('2', 'infantry'), card('3', 'cavalry')]),
      ).toBeNull();
    });

    it('devuelve null con menos de tres cartas', () => {
      expect(findTradeableSet([card('1', 'infantry')])).toBeNull();
      expect(findTradeableSet([])).toBeNull();
    });

    it('encuentra el trío de tres iguales', () => {
      const trio = findTradeableSet([
        card('1', 'cavalry'),
        card('2', 'infantry'),
        card('3', 'cavalry'),
        card('4', 'cavalry'),
      ]);
      expect(trio?.map((c) => c.id).sort()).toEqual(['1', '3', '4']);
    });

    it('encuentra el trío de tres distintos', () => {
      const trio = findTradeableSet([
        card('1', 'cavalry'),
        card('2', 'infantry'),
        card('3', 'artillery'),
      ]);
      expect(trio).not.toBeNull();
      expect(isValidSet(trio!)).toBe(true);
    });

    it('lo que devuelve siempre es un trío válido', () => {
      const hand = [
        card('1', 'cavalry'),
        card('2', 'infantry'),
        card('3', 'infantry'),
        card('w', 'wildcard'),
      ];
      expect(isValidSet(findTradeableSet(hand)!)).toBe(true);
    });
  });

  describe('allTradeableSets', () => {
    it('enumera todas las combinaciones válidas', () => {
      const hand = [
        card('1', 'infantry'),
        card('2', 'infantry'),
        card('3', 'infantry'),
        card('4', 'infantry'),
      ];
      expect(allTradeableSets(hand)).toHaveLength(4);
    });

    it('devuelve lista vacía si no hay ninguna', () => {
      expect(
        allTradeableSets([card('1', 'infantry'), card('2', 'infantry'), card('3', 'cavalry')]),
      ).toEqual([]);
    });

    it('todas las combinaciones devueltas son válidas', () => {
      const hand = [
        card('1', 'infantry'),
        card('2', 'cavalry'),
        card('3', 'artillery'),
        card('w', 'wildcard'),
        card('5', 'cavalry'),
      ];
      for (const trio of allTradeableSets(hand)) expect(isValidSet(trio)).toBe(true);
    });
  });

  describe('takeCards', () => {
    it('extrae las cartas pedidas', () => {
      const hand = [card('1', 'infantry'), card('2', 'cavalry')];
      expect(takeCards(hand, ['2', '1']).map((c) => c.id)).toEqual(['2', '1']);
    });

    it('falla si la carta no está en la mano', () => {
      expect(() => takeCards([card('1', 'infantry')], ['9'])).toThrow(/No tienes la carta/);
    });

    it('no permite usar dos veces la misma carta', () => {
      expect(() => takeCards([card('1', 'infantry')], ['1', '1'])).toThrow();
    });
  });

  describe('etiquetas', () => {
    it('todos los símbolos tienen icono y nombre', () => {
      for (const symbol of ['infantry', 'cavalry', 'artillery', 'wildcard'] as CardSymbol[]) {
        expect(CARD_ICON[symbol]).toBeTruthy();
        expect(CARD_LABEL[symbol]).toBeTruthy();
      }
    });
  });
});
