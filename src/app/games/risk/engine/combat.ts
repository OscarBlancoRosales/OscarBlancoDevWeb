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
 *
 * `defenceBonus` y `attackBonus` son vectores por rango: el elemento `i` se suma
 * al i-ésimo mejor dado de ese bando antes de comparar esa pareja. Se suma DESPUÉS de
 * ordenar, así que los dados se emparejan de mayor a menor igual que en la mesa;
 * lo que cambia es quién gana cada pareja. Los dados que se guardan y se enseñan
 * son los realmente tirados, no los bonificados: el jugador tiene que ver lo que
 * salió.
 */
export function resolveCombat(
  attackingArmies: number,
  defendingArmies: number,
  attackDiceCount: number,
  rng: Rng,
  rules: BattleRules = CLASSIC_RULES,
): CombatResult {
  const attackerCount = Math.min(attackDiceCount, maxAttackDice(attackingArmies, rules.attack));
  const defenderCount = maxDefendDice(defendingArmies, rules.defend);
  const defence = rules.defenceBonus ?? [];
  const offence = rules.attackBonus ?? [];

  const attackerDice = rollDice(attackerCount, rng);
  const defenderDice = rollDice(defenderCount, rng);

  let attackerLosses = 0;
  let defenderLosses = 0;
  const comparisons = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < comparisons; i++) {
    if (attackerDice[i] + (offence[i] ?? 0) > defenderDice[i] + (defence[i] ?? 0)) defenderLosses++;
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

/**
 * Cómo se pelea una batalla concreta: topes de dados y ventaja del defensor.
 *
 * Los topes son de la mesa; las bonificaciones las ponen el terreno y las tropas
 * (ver `terrain.ts` y `units.ts`). Son vectores por rango, no números sueltos,
 * porque no afectan igual a todos los dados: la montaña refuerza la posición
 * principal (`[1]`, solo el mejor dado) y el bosque esconde los flancos
 * (`[0, 1]`, solo el segundo). Un valor negativo penaliza. Lo que falte cuenta
 * como 0.
 */
export interface BattleRules {
  attack: number;
  defend: number;
  defenceBonus?: number[];
  attackBonus?: number[];
}

/** Nombre viejo de lo mismo, cuando solo importaban los topes. */
export type DiceCaps = BattleRules;

export const CLASSIC_RULES: BattleRules = {
  attack: 3,
  defend: 2,
  defenceBonus: [],
  attackBonus: [],
};
export const CLASSIC_CAPS = CLASSIC_RULES;

/** Topes de dados que aplican en una partida concreta. */
export function diceCapsOf(config: {
  maxAttackDice?: number;
  maxDefendDice?: number;
} | null | undefined): BattleRules {
  return {
    attack: config?.maxAttackDice ?? CLASSIC_RULES.attack,
    defend: config?.maxDefendDice ?? CLASSIC_RULES.defend,
    defenceBonus: [],
    attackBonus: [],
  };
}

/** Clave de caché de unas reglas. Dos reglas iguales comparten tabla. */
function rulesKey(rules: BattleRules): string {
  return `${rules.attack}v${rules.defend}:${trimZeros(rules.defenceBonus)}:${trimZeros(rules.attackBonus)}`;
}

/** Los ceros de cola no cambian nada, así que no deben partir la caché. */
function trimZeros(bonus: number[] | undefined): string {
  const values = bonus ?? [];
  let last = values.length;
  while (last > 0 && values[last - 1] === 0) last--;
  return values.slice(0, last).join(',');
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
 * Recibe las reglas de ESA batalla (topes de la mesa ya combinados con el
 * terreno del territorio atacado) porque es EL MISMO número que ve el jugador
 * antes de atacar y el que usa la IA para decidir: si el combate real usara unas
 * reglas y esta función otras, la interfaz mentiría y la IA jugaría a ciegas.
 */
export function conquestOdds(
  attackingArmies: number,
  defendingArmies: number,
  rules: BattleRules = CLASSIC_RULES,
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
  const capsKey = rulesKey(rules);

  const probs = battleRoundProbabilities(rules);

  const win = (a: number, d: number): number => {
    if (d <= 0) return 1;
    if (a <= 0) return 0;
    const memoKey = `${capsKey}:${a}:${d}`;
    const cached = memo.get(memoKey);
    if (cached !== undefined) return cached;

    const attackDice = Math.min(rules.attack, a);
    const defendDice = Math.min(rules.defend, d);
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
 * Una tabla por combinación de reglas (la clásica 3v2 se calcula una sola vez).
 */
export function battleRoundProbabilities(rules: BattleRules = CLASSIC_RULES): RoundTable {
  const key = rulesKey(rules);
  const cached = cachedTables.get(key);
  if (cached) return cached;

  const defence = rules.defenceBonus ?? [];
  const offence = rules.attackBonus ?? [];
  const table: RoundTable = {};
  for (let a = 1; a <= rules.attack; a++) {
    for (let d = 1; d <= rules.defend; d++) {
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
            if (as[i] + (offence[i] ?? 0) > ds[i] + (defence[i] ?? 0)) defenderLosses++;
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
