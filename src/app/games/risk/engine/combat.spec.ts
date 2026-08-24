import { describe, expect, it } from 'vitest';
import {
  battleRoundProbabilities,
  conquestOdds,
  maxAttackDice,
  maxDefendDice,
  resolveCombat,
  rollDice,
} from './combat';
import { createRng, Rng } from './rng';

/** RNG de laboratorio: devuelve las caras que le pidamos, en orden. */
function scriptedRng(faces: number[]): Rng {
  let index = 0;
  const nextFace = () => faces[index++ % faces.length];
  return {
    next: () => (nextFace() - 1) / 6,
    int: (min, max) => Math.min(max, min + nextFace() - 1),
    d6: nextFace,
  };
}

describe('combate', () => {
  describe('maxAttackDice', () => {
    it('deja siempre un ejército en el territorio de origen', () => {
      expect(maxAttackDice(1)).toBe(0);
      expect(maxAttackDice(2)).toBe(1);
      expect(maxAttackDice(3)).toBe(2);
      expect(maxAttackDice(4)).toBe(3);
    });

    it('nunca supera el tope de 3 dados', () => {
      expect(maxAttackDice(10)).toBe(3);
      expect(maxAttackDice(99)).toBe(3);
    });

    it('nunca devuelve un número negativo', () => {
      expect(maxAttackDice(0)).toBe(0);
    });

    it('respeta un tope configurable', () => {
      expect(maxAttackDice(10, 2)).toBe(2);
    });
  });

  describe('maxDefendDice', () => {
    it('un ejército defiende con un dado y dos o más con dos', () => {
      expect(maxDefendDice(1)).toBe(1);
      expect(maxDefendDice(2)).toBe(2);
      expect(maxDefendDice(20)).toBe(2);
    });

    it('sin ejércitos no hay dados', () => {
      expect(maxDefendDice(0)).toBe(0);
    });
  });

  describe('rollDice', () => {
    it('devuelve tantos dados como se piden', () => {
      expect(rollDice(3, createRng(1))).toHaveLength(3);
      expect(rollDice(0, createRng(1))).toHaveLength(0);
    });

    it('los devuelve ordenados de mayor a menor', () => {
      const dice = rollDice(3, scriptedRng([2, 6, 4]));
      expect(dice).toEqual([6, 4, 2]);
    });

    it('todas las caras están entre 1 y 6', () => {
      for (const face of rollDice(3, createRng(77))) {
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('resolveCombat', () => {
    it('el atacante gana cuando su dado es mayor', () => {
      // Atacante saca 6, defensor saca 1.
      const result = resolveCombat(2, 1, 1, scriptedRng([6, 1]));
      expect(result.defenderLosses).toBe(1);
      expect(result.attackerLosses).toBe(0);
      expect(result.conquered).toBe(true);
    });

    it('el empate lo gana el defensor', () => {
      const result = resolveCombat(2, 1, 1, scriptedRng([4, 4]));
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(0);
      expect(result.conquered).toBe(false);
    });

    it('compara los dados emparejados de mayor a menor', () => {
      // Atacante 6,5,1 · Defensor 5,2 -> gana el 6 contra el 5 y el 5 empata con... 2
      const result = resolveCombat(4, 2, 3, scriptedRng([6, 5, 1, 5, 2]));
      expect(result.attackerDice).toEqual([6, 5, 1]);
      expect(result.defenderDice).toEqual([5, 2]);
      expect(result.defenderLosses).toBe(2);
      expect(result.attackerLosses).toBe(0);
    });

    it('reparte bajas cuando cada uno gana un dado', () => {
      // Atacante 6,1 · Defensor 3,5 -> ordenados: A[6,1] D[5,3]; 6>5 gana A, 1<3 gana D
      const result = resolveCombat(3, 2, 2, scriptedRng([6, 1, 3, 5]));
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(1);
    });

    it('limita los dados del atacante a los que permite su ejército', () => {
      const result = resolveCombat(2, 2, 3, createRng(5));
      expect(result.attackerDice).toHaveLength(1);
    });

    it('marca la conquista solo si el defensor se queda a cero', () => {
      const notConquered = resolveCombat(4, 3, 3, scriptedRng([6, 6, 6, 1, 1]));
      expect(notConquered.defenderLosses).toBe(2);
      expect(notConquered.conquered).toBe(false);
    });

    it('el total de bajas nunca supera los dados comparados', () => {
      const rng = createRng(31337);
      for (let i = 0; i < 500; i++) {
        const result = resolveCombat(5, 3, 3, rng);
        const compared = Math.min(result.attackerDice.length, result.defenderDice.length);
        expect(result.attackerLosses + result.defenderLosses).toBe(compared);
      }
    });

    it('es reproducible con la misma semilla', () => {
      const a = resolveCombat(5, 4, 3, createRng(123));
      const b = resolveCombat(5, 4, 3, createRng(123));
      expect(a).toEqual(b);
    });
  });

  describe('battleRoundProbabilities', () => {
    const table = battleRoundProbabilities();

    it('cubre todas las combinaciones de dados', () => {
      expect(Object.keys(table).sort()).toEqual(
        ['1v1', '1v2', '2v1', '2v2', '3v1', '3v2'].sort(),
      );
    });

    it('cada distribución suma 1', () => {
      for (const [key, outcomes] of Object.entries(table)) {
        const total = outcomes.reduce((sum, [, , p]) => sum + p, 0);
        expect(total, key).toBeCloseTo(1, 10);
      }
    });

    it('reproduce las probabilidades conocidas de 1 contra 1', () => {
      const outcomes = new Map(table['1v1'].map(([al, dl, p]) => [`${al}:${dl}`, p]));
      // El atacante gana 15 de 36 tiradas.
      expect(outcomes.get('0:1')).toBeCloseTo(15 / 36, 10);
      expect(outcomes.get('1:0')).toBeCloseTo(21 / 36, 10);
    });

    it('reproduce las probabilidades conocidas de 3 contra 2', () => {
      const outcomes = new Map(table['3v2'].map(([al, dl, p]) => [`${al}:${dl}`, p]));
      expect(outcomes.get('0:2')).toBeCloseTo(2890 / 7776, 8);
      expect(outcomes.get('2:0')).toBeCloseTo(2275 / 7776, 8);
      expect(outcomes.get('1:1')).toBeCloseTo(2611 / 7776, 8);
    });

    it('devuelve siempre la misma instancia cacheada', () => {
      expect(battleRoundProbabilities()).toBe(table);
    });
  });

  describe('conquestOdds', () => {
    it('sin excedente de ejércitos no se puede conquistar', () => {
      expect(conquestOdds(1, 1)).toBe(0);
    });

    it('un defensor sin ejércitos ya está conquistado', () => {
      expect(conquestOdds(5, 0)).toBe(1);
    });

    it('crece al aumentar el atacante', () => {
      const small = conquestOdds(3, 3);
      const big = conquestOdds(10, 3);
      expect(big).toBeGreaterThan(small);
    });

    it('decrece al aumentar el defensor', () => {
      expect(conquestOdds(6, 6)).toBeLessThan(conquestOdds(6, 2));
    });

    it('siempre devuelve una probabilidad válida', () => {
      for (let a = 1; a <= 12; a++) {
        for (let d = 1; d <= 12; d++) {
          const odds = conquestOdds(a, d);
          expect(odds).toBeGreaterThanOrEqual(0);
          expect(odds).toBeLessThanOrEqual(1);
        }
      }
    });

    it('coincide con los valores de referencia del juego', () => {
      // Contrastados contra una simulación independiente de 200 000 batallas.
      // Ojo: el argumento son los ejércitos del territorio, uno de los cuales
      // se queda siempre en casa (por eso 4 contra 3 equivale a conquestOdds(5, 3)).
      expect(conquestOdds(3, 1)).toBeCloseTo(0.7548, 2);
      expect(conquestOdds(4, 3)).toBeCloseTo(0.4711, 2);
      expect(conquestOdds(5, 3)).toBeCloseTo(0.6425, 2);
      expect(conquestOdds(11, 10)).toBeCloseTo(0.5664, 2);
    });

    it('concuerda con la simulación con dados reales', () => {
      const rng = createRng(20260824);
      let wins = 0;
      const trials = 4000;
      for (let i = 0; i < trials; i++) {
        let attackers = 8;
        let defenders = 5;
        while (attackers > 1 && defenders > 0) {
          const result = resolveCombat(attackers, defenders, 3, rng);
          attackers -= result.attackerLosses;
          defenders -= result.defenderLosses;
        }
        if (defenders <= 0) wins++;
      }
      expect(wins / trials).toBeCloseTo(conquestOdds(8, 5), 1);
    });
  });
});
