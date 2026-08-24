import { CombatResult } from './types';
import { Rng } from './rng';

/** Dados que puede lanzar el atacante: uno por ejército excedente, máximo 3. */
export function maxAttackDice(attackingArmies: number, cap = 3): number {
  return Math.max(0, Math.min(cap, attackingArmies - 1));
}

/** Dados del defensor: uno por ejército, máximo 2. */
export function maxDefendDice(defendingArmies: number, cap = 2): number {
  return Math.max(0, Math.min(cap, defendingArmies));
}

/** Tirada de N dados, ordenada de mayor a menor (como en la mesa). */
export function rollDice(count: number, rng: Rng): number[] {
  const dice: number[] = [];
  for (let i = 0; i < count; i++) dice.push(rng.d6());
  return dice.sort((a, b) => b - a);
}

/**
 * Resuelve una batalla comparando los dados emparejados de mayor a menor.
 * El empate lo gana siempre el defensor (regla clásica).
 */
export function resolveCombat(
  attackingArmies: number,
  defendingArmies: number,
  attackDiceCount: number,
  rng: Rng,
  caps: { attack: number; defend: number } = { attack: 3, defend: 2 },
): CombatResult {
  const attackerCount = Math.min(attackDiceCount, maxAttackDice(attackingArmies, caps.attack));
  const defenderCount = maxDefendDice(defendingArmies, caps.defend);

  const attackerDice = rollDice(attackerCount, rng);
  const defenderDice = rollDice(defenderCount, rng);

  let attackerLosses = 0;
  let defenderLosses = 0;
  const comparisons = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < comparisons; i++) {
    if (attackerDice[i] > defenderDice[i]) defenderLosses++;
    else attackerLosses++;
  }

  return {
    attackerDice,
    defenderDice,
    attackerLosses,
    defenderLosses,
    conquered: defendingArmies - defenderLosses <= 0,
  };
}

/** Topes de dados de una mesa. Los clásicos son 3 y 2. */
export interface DiceCaps {
  attack: number;
  defend: number;
}

export const CLASSIC_CAPS: DiceCaps = { attack: 3, defend: 2 };

/** Topes de dados que aplican en una partida concreta. */
export function diceCapsOf(config: {
  maxAttackDice?: number;
  maxDefendDice?: number;
} | null | undefined): DiceCaps {
  return {
    attack: config?.maxAttackDice ?? CLASSIC_CAPS.attack,
    defend: config?.maxDefendDice ?? CLASSIC_CAPS.defend,
  };
}

/**
 * Por encima de este tamaño de ejército la probabilidad solo depende de la
 * proporción, así que escalamos ambos lados. Además mantiene acotada la caché:
 * en partidas largas los ejércitos crecen mucho y, sin este tope, la tabla de
 * memoización se dispararía.
 */
const ODDS_SCALE_CAP = 60;

/**
 * Probabilidad de que el atacante acabe conquistando, resolviendo la cadena de
 * Markov de la batalla hasta el final.
 *
 * Recibe los topes de dados de la mesa porque es EL MISMO número que ve el
 * jugador antes de atacar y el que usa la IA para decidir: si el combate real
 * usara unos topes y esta función otros, la interfaz mentiría y la IA jugaría a
 * ciegas. Cuando el terreno modifique el combate, entrará por aquí.
 */
export function conquestOdds(
  attackingArmies: number,
  defendingArmies: number,
  caps: DiceCaps = CLASSIC_CAPS,
): number {
  let attackers = attackingArmies - 1; // uno se queda siempre en casa
  let defenders = defendingArmies;
  if (attackers <= 0) return 0;
  if (defenders <= 0) return 1;

  if (attackers > ODDS_SCALE_CAP || defenders > ODDS_SCALE_CAP) {
    const factor = ODDS_SCALE_CAP / Math.max(attackers, defenders);
    attackers = Math.max(1, Math.round(attackers * factor));
    defenders = Math.max(1, Math.round(defenders * factor));
  }

  // La caché es global y no se invalida nunca: es una función pura de
  // (topes, a, d), y la IA la consulta cientos de veces por turno.
  const memo = oddsCache;
  const capsKey = `${caps.attack}v${caps.defend}`;

  const probs = battleRoundProbabilities(caps);

  const win = (a: number, d: number): number => {
    if (d <= 0) return 1;
    if (a <= 0) return 0;
    const memoKey = `${capsKey}:${a}:${d}`;
    const cached = memo.get(memoKey);
    if (cached !== undefined) return cached;

    const attackDice = Math.min(caps.attack, a);
    const defendDice = Math.min(caps.defend, d);
    const table = probs[`${attackDice}v${defendDice}`];

    let total = 0;
    for (const [attackerLosses, defenderLosses, p] of table) {
      total += p * win(a - attackerLosses, d - defenderLosses);
    }
    memo.set(memoKey, total);
    return total;
  };

  return win(attackers, defenders);
}

/** memo[`topes:a:d`] = probabilidad de que el atacante acabe conquistando. */
const oddsCache = new Map<string, number>();

type RoundTable = Record<string, Array<[number, number, number]>>;
const cachedTables = new Map<string, RoundTable>();

/**
 * Distribución exacta de bajas por ronda, enumerando todas las tiradas.
 * Una tabla por combinación de topes (la clásica 3v2 se calcula una sola vez).
 */
export function battleRoundProbabilities(caps: DiceCaps = CLASSIC_CAPS): RoundTable {
  const key = `${caps.attack}v${caps.defend}`;
  const cached = cachedTables.get(key);
  if (cached) return cached;

  const table: RoundTable = {};
  for (let a = 1; a <= caps.attack; a++) {
    for (let d = 1; d <= caps.defend; d++) {
      const counts = new Map<string, number>();
      let totalOutcomes = 0;
      const attackRolls = enumerateRolls(a);
      const defendRolls = enumerateRolls(d);
      for (const ar of attackRolls) {
        for (const dr of defendRolls) {
          const as = ar.slice().sort((x, y) => y - x);
          const ds = dr.slice().sort((x, y) => y - x);
          let attackerLosses = 0;
          let defenderLosses = 0;
          for (let i = 0; i < Math.min(a, d); i++) {
            if (as[i] > ds[i]) defenderLosses++;
            else attackerLosses++;
          }
          const outcomeKey = `${attackerLosses}:${defenderLosses}`;
          counts.set(outcomeKey, (counts.get(outcomeKey) ?? 0) + 1);
          totalOutcomes++;
        }
      }
      table[`${a}v${d}`] = Array.from(counts.entries()).map(([outcomeKey, count]) => {
        const [al, dl] = outcomeKey.split(':').map(Number);
        return [al, dl, count / totalOutcomes] as [number, number, number];
      });
    }
  }
  cachedTables.set(key, table);
  return table;
}

function enumerateRolls(count: number): number[][] {
  if (count === 0) return [[]];
  const rest = enumerateRolls(count - 1);
  const out: number[][] = [];
  for (let face = 1; face <= 6; face++) {
    for (const tail of rest) out.push([face, ...tail]);
  }
  return out;
}
