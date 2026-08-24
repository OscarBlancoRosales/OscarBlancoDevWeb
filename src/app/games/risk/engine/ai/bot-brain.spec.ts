import { describe, expect, it } from 'vitest';
import {
  advisorTip,
  attacksThisTurn,
  botCommentary,
  BOT_PROFILES,
  BOT_PROFILE_IDS,
  continentProgress,
  decideAction,
  fortifyPlan,
  occupyAmount,
  rankedAttacks,
  reinforcementPlan,
  standings,
  threatMap,
  traitsOf,
} from './bot-brain';
import { applyAction, createGame, currentPlayer, playerById } from '../engine';
import { GameState } from '../types';
import { TINY_MAP, forceTurn, makeGame, setBoard } from '../testing';
import { WORLD_MAP } from '../maps/world.map';
import { SPAIN_MAP } from '../maps/spain.map';
import { SPAIN_REGIONS_MAP } from '../maps/spain-regions.map';
import { territoriesOf } from '../rules';

/** Juega una partida entera solo con bots y devuelve el resultado. */
function selfPlay(
  map = TINY_MAP,
  playerCount = 2,
  seed = 99,
  maxActions = 6000,
): { state: GameState; actions: number; finished: boolean } {
  let state = createGame({
    map,
    seed,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i}`,
      name: `Bot ${i}`,
      kind: 'bot' as const,
      botProfile: BOT_PROFILE_IDS[i % BOT_PROFILE_IDS.length],
    })),
  });

  let actions = 0;
  while (state.phase !== 'game-over' && actions < maxActions) {
    const player = currentPlayer(state);
    if (!player) break;
    const action = decideAction(state, map, player.id);
    if (!action) break;
    state = applyAction(state, action, map);
    actions++;
  }
  return { state, actions, finished: state.phase === 'game-over' };
}

describe('cerebro heurístico de la IA', () => {
  describe('perfiles', () => {
    it('define los cinco perfiles', () => {
      expect(BOT_PROFILE_IDS).toHaveLength(5);
      expect(BOT_PROFILE_IDS).toContain('agresivo');
      expect(BOT_PROFILE_IDS).toContain('cauto');
    });

    it('cada perfil tiene etiqueta y descripción en español', () => {
      for (const id of BOT_PROFILE_IDS) {
        expect(BOT_PROFILES[id].label.length).toBeGreaterThan(2);
        expect(BOT_PROFILES[id].description.length).toBeGreaterThan(10);
      }
    });

    it('el agresivo ataca con peores probabilidades que el cauto', () => {
      expect(BOT_PROFILES.agresivo.attackThreshold).toBeLessThan(
        BOT_PROFILES.cauto.attackThreshold,
      );
    });

    it('los umbrales están en un rango razonable', () => {
      for (const id of BOT_PROFILE_IDS) {
        expect(BOT_PROFILES[id].attackThreshold).toBeGreaterThan(0.3);
        expect(BOT_PROFILES[id].attackThreshold).toBeLessThan(0.9);
        expect(BOT_PROFILES[id].maxAttacksPerTurn).toBeGreaterThan(0);
      }
    });

    it('traitsOf usa el perfil oportunista por defecto', () => {
      expect(traitsOf(undefined)).toBe(BOT_PROFILES.oportunista);
    });
  });

  describe('threatMap', () => {
    it('solo incluye territorios de frontera', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 3],
        A2: ['p1', 3],
        A3: ['p1', 3],
        B1: ['p2', 5],
        B2: ['p2', 5],
        B3: ['p2', 5],
      });
      const threats = threatMap(state, TINY_MAP, 'p1');
      expect(threats.map((t) => t.id).sort()).toEqual(['A1', 'A2', 'A3']);
    });

    it('ordena por presión descendente', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 10],
        A2: ['p1', 1],
        A3: ['p1', 5],
        B1: ['p2', 4],
        B2: ['p2', 9],
        B3: ['p2', 2],
      });
      const threats = threatMap(state, TINY_MAP, 'p1');
      for (let i = 1; i < threats.length; i++) {
        expect(threats[i - 1].pressure).toBeGreaterThanOrEqual(threats[i].pressure);
      }
    });

    it('calcula bien los ejércitos enemigos adyacentes', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 2],
        A2: ['p1', 2],
        A3: ['p1', 2],
        B1: ['p2', 7],
        B2: ['p2', 3],
        B3: ['p2', 1],
      });
      const a1 = threatMap(state, TINY_MAP, 'p1').find((t) => t.id === 'A1')!;
      expect(a1.enemyArmies).toBe(7);
      expect(a1.enemyCount).toBe(1);
      expect(a1.pressure).toBe(5);
    });

    it('devuelve lista vacía si no hay fronteras', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 1],
        B2: ['p1', 1],
        B3: ['p1', 1],
      });
      expect(threatMap(state, TINY_MAP, 'p1')).toEqual([]);
    });
  });

  describe('continentProgress', () => {
    it('mide lo que falta para cerrar cada continente', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p2', 1],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p2', 1],
      });
      const alpha = continentProgress(state, TINY_MAP, 'p1').find((c) => c.id === 'alpha')!;
      expect(alpha.owned).toBe(2);
      expect(alpha.total).toBe(3);
      expect(alpha.missing).toEqual(['A3']);
      expect(alpha.ratio).toBeCloseTo(2 / 3, 5);
    });

    it('marca los continentes completos sin territorios que falten', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p2', 1],
      });
      const alpha = continentProgress(state, TINY_MAP, 'p1').find((c) => c.id === 'alpha')!;
      expect(alpha.missing).toEqual([]);
      expect(alpha.ratio).toBe(1);
    });

    it('funciona con el mapa grande sin romperse', () => {
      const state = createGame({
        map: WORLD_MAP,
        seed: 3,
        players: [
          { id: 'p1', name: 'A', kind: 'bot' },
          { id: 'p2', name: 'B', kind: 'bot' },
        ],
      });
      expect(continentProgress(state, WORLD_MAP, 'p1')).toHaveLength(6);
    });
  });

  describe('standings', () => {
    it('ordena por territorios y desempata por ejércitos', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p2', 9],
        B1: ['p2', 9],
        B2: ['p2', 9],
        B3: ['p2', 9],
      });
      const board = standings(state);
      expect(board[0].playerId).toBe('p2');
      expect(board[0].territories).toBe(4);
      expect(board[1].armies).toBe(2);
    });
  });

  describe('rankedAttacks', () => {
    it('solo propone ataques legales', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 5],
        A2: ['p1', 1],
        A3: ['p1', 3],
        B1: ['p2', 2],
        B2: ['p2', 2],
        B3: ['p2', 2],
      });
      for (const option of rankedAttacks(state, TINY_MAP, 'p1')) {
        expect(state.territories[option.from].ownerId).toBe('p1');
        expect(state.territories[option.to].ownerId).not.toBe('p1');
        expect(state.territories[option.from].armies).toBeGreaterThanOrEqual(2);
        expect(TINY_MAP.territories.find((t) => t.id === option.from)!.adjacent).toContain(option.to);
      }
    });

    it('nunca ataca desde un territorio con un solo ejército', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p2', 1],
        B2: ['p2', 1],
        B3: ['p2', 1],
      });
      expect(rankedAttacks(state, TINY_MAP, 'p1')).toEqual([]);
    });

    it('ordena de mejor a peor puntuación', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 12],
        A2: ['p1', 4],
        A3: ['p1', 2],
        B1: ['p2', 1],
        B2: ['p2', 8],
        B3: ['p2', 3],
      });
      const options = rankedAttacks(state, TINY_MAP, 'p1');
      for (let i = 1; i < options.length; i++) {
        expect(options[i - 1].score).toBeGreaterThanOrEqual(options[i].score);
      }
    });

    it('prefiere el objetivo más débil en igualdad de condiciones', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 10],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p2', 1],
        B2: ['p2', 9],
        B3: ['p2', 9],
      });
      expect(rankedAttacks(state, TINY_MAP, 'p1')[0].to).toBe('B1');
    });

    it('usa el máximo de dados permitido', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 10],
        B1: ['p2', 1],
      });
      const best = rankedAttacks(state, TINY_MAP, 'p1')[0];
      expect(best.dice).toBe(3);
    });

    it('el sesgo de la IA sube la prioridad del objetivo marcado', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 6],
        A2: ['p1', 6],
        A3: ['p1', 6],
        B1: ['p2', 3],
        B2: ['p2', 3],
        B3: ['p2', 3],
      });
      const neutral = rankedAttacks(state, TINY_MAP, 'p1');
      const biased = rankedAttacks(state, TINY_MAP, 'p1', 'oportunista', { targets: ['B3'] });
      const neutralScore = neutral.find((o) => o.to === 'B3')!.score;
      const biasedScore = biased.find((o) => o.to === 'B3')!.score;
      expect(biasedScore).toBeGreaterThan(neutralScore);
    });
  });

  describe('reinforcementPlan', () => {
    it('reparte exactamente la reserva disponible', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 2],
        A2: ['p1', 2],
        A3: ['p1', 2],
        B1: ['p2', 5],
        B2: ['p2', 5],
        B3: ['p2', 5],
      });
      for (const reserve of [1, 3, 7, 12, 30]) {
        const plan = reinforcementPlan(state, TINY_MAP, 'p1', reserve);
        expect(plan.reduce((sum, item) => sum + item.armies, 0)).toBe(reserve);
      }
    });

    it('solo refuerza territorios propios', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 2],
        A2: ['p1', 2],
        A3: ['p1', 2],
        B1: ['p2', 5],
        B2: ['p2', 5],
        B3: ['p2', 5],
      });
      for (const item of reinforcementPlan(state, TINY_MAP, 'p1', 10)) {
        expect(state.territories[item.territoryId].ownerId).toBe('p1');
      }
    });

    it('nunca asigna cantidades no positivas', () => {
      const state = setBoard(makeGame(), { A1: ['p1', 2], B1: ['p2', 5] });
      for (const item of reinforcementPlan(state, TINY_MAP, 'p1', 5)) {
        expect(item.armies).toBeGreaterThan(0);
      }
    });

    it('prioriza la frontera más presionada', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 9],
        A3: ['p1', 9],
        B1: ['p2', 20],
        B2: ['p2', 1],
        B3: ['p2', 1],
      });
      expect(reinforcementPlan(state, TINY_MAP, 'p1', 6, 'agresivo')[0].territoryId).toBe('A1');
    });

    it('devuelve lista vacía sin reserva', () => {
      const state = makeGame();
      expect(reinforcementPlan(state, TINY_MAP, 'p1', 0)).toEqual([]);
    });

    it('el perfil cauto reparte en más frentes que el agresivo', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 2],
        A2: ['p1', 2],
        A3: ['p1', 2],
        B1: ['p2', 5],
        B2: ['p2', 5],
        B3: ['p2', 5],
      });
      const cauto = reinforcementPlan(state, TINY_MAP, 'p1', 12, 'cauto');
      const agresivo = reinforcementPlan(state, TINY_MAP, 'p1', 12, 'agresivo');
      expect(cauto.length).toBeGreaterThan(agresivo.length);
    });

    it('aunque no tenga fronteras coloca los refuerzos en algún sitio', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 1],
        B2: ['p1', 1],
        B3: ['p1', 1],
      });
      const plan = reinforcementPlan(state, TINY_MAP, 'p1', 5);
      expect(plan.reduce((sum, item) => sum + item.armies, 0)).toBe(5);
    });
  });

  describe('fortifyPlan', () => {
    it('mueve de la retaguardia al frente', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 9],
        B2: ['p1', 1],
        B3: ['p2', 20],
      });
      const plan = fortifyPlan(state, TINY_MAP, 'p1');
      expect(plan).not.toBeNull();
      expect(state.territories[plan!.from].ownerId).toBe('p1');
      expect(state.territories[plan!.to].ownerId).toBe('p1');
      expect(plan!.armies).toBeLessThan(state.territories[plan!.from].armies);
    });

    it('no propone nada si no hay fronteras', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 5],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p1', 5],
        B2: ['p1', 5],
        B3: ['p1', 5],
      });
      expect(fortifyPlan(state, TINY_MAP, 'p1')).toBeNull();
    });

    it('nunca deja el origen a cero', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 1],
        A2: ['p1', 1],
        A3: ['p1', 1],
        B1: ['p1', 4],
        B2: ['p1', 1],
        B3: ['p2', 15],
      });
      const plan = fortifyPlan(state, TINY_MAP, 'p1');
      if (plan) {
        expect(state.territories[plan.from].armies - plan.armies).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('occupyAmount', () => {
    it('se lleva todo si la retaguardia queda a salvo', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 6],
        A2: ['p1', 5],
        A3: ['p1', 5],
        B1: ['p1', 0],
        B2: ['p1', 5],
        B3: ['p1', 5],
      });
      expect(occupyAmount(state, TINY_MAP, 'A1', 'B1', 'p1', 1)).toBe(5);
    });

    it('deja guarnición si el origen sigue en frontera', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 9],
        A2: ['p2', 5],
        B1: ['p1', 0],
      });
      const amount = occupyAmount(state, TINY_MAP, 'A1', 'B1', 'p1', 1);
      expect(amount).toBeLessThan(8);
      expect(amount).toBeGreaterThanOrEqual(1);
    });

    it('respeta siempre el mínimo obligatorio', () => {
      const state = setBoard(makeGame(), {
        A1: ['p1', 5],
        A2: ['p2', 9],
        B1: ['p1', 0],
      });
      expect(occupyAmount(state, TINY_MAP, 'A1', 'B1', 'p1', 3)).toBeGreaterThanOrEqual(3);
    });

    it('nunca supera lo disponible', () => {
      const state = setBoard(makeGame(), { A1: ['p1', 4], B1: ['p1', 0] });
      expect(occupyAmount(state, TINY_MAP, 'A1', 'B1', 'p1', 1)).toBeLessThanOrEqual(3);
    });
  });

  describe('attacksThisTurn', () => {
    it('cuenta solo los ataques del turno en curso', () => {
      let state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p1', 12],
          A2: ['p1', 2],
          A3: ['p1', 2],
          B1: ['p2', 6],
          B2: ['p2', 6],
          B3: ['p2', 6],
        }),
        'p1',
        'attack',
      );
      expect(attacksThisTurn(state, 'p1')).toBe(0);
      state = applyAction(
        state,
        { type: 'attack', playerId: 'p1', from: 'A1', to: 'B1', dice: 3 },
        TINY_MAP,
      );
      expect(attacksThisTurn(state, 'p1')).toBe(1);
    });
  });

  describe('decideAction', () => {
    it('devuelve null si no es el turno del bot', () => {
      const state = forceTurn(makeGame(), 'p1', 'attack');
      expect(decideAction(state, TINY_MAP, 'p2')).toBeNull();
    });

    it('devuelve null para un jugador desconocido', () => {
      expect(decideAction(makeGame(), TINY_MAP, 'nadie')).toBeNull();
    });

    it('en refuerzos coloca ejércitos', () => {
      const state = forceTurn(makeGame(), 'p2', 'reinforce', 5);
      const action = decideAction(state, TINY_MAP, 'p2');
      expect(action?.type).toBe('deploy');
    });

    it('canjea cuando está obligado', () => {
      let state = forceTurn(makeGame(), 'p2', 'reinforce', 3);
      state = JSON.parse(JSON.stringify(state));
      playerById(state, 'p2')!.cards = [
        { id: 'c1', symbol: 'infantry', territoryId: null },
        { id: 'c2', symbol: 'cavalry', territoryId: null },
        { id: 'c3', symbol: 'artillery', territoryId: null },
        { id: 'c4', symbol: 'infantry', territoryId: null },
        { id: 'c5', symbol: 'infantry', territoryId: null },
      ];
      expect(decideAction(state, TINY_MAP, 'p2')?.type).toBe('trade');
    });

    it('ocupa cuando hay conquista pendiente', () => {
      let state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p2', 12],
          A2: ['p2', 2],
          A3: ['p2', 2],
          B1: ['p1', 1],
          B2: ['p1', 6],
          B3: ['p1', 6],
        }),
        'p2',
        'attack',
      );
      for (let i = 0; i < 40 && !state.pendingOccupation; i++) {
        state = applyAction(
          state,
          { type: 'attack', playerId: 'p2', from: 'A1', to: 'B1', dice: 3 },
          TINY_MAP,
        );
      }
      expect(decideAction(state, TINY_MAP, 'p2')?.type).toBe('occupy');
    });

    it('termina la fase de ataque cuando no hay nada rentable', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p2', 1],
          A2: ['p2', 1],
          A3: ['p2', 1],
          B1: ['p1', 20],
          B2: ['p1', 20],
          B3: ['p1', 20],
        }),
        'p2',
        'attack',
      );
      expect(decideAction(state, TINY_MAP, 'p2')?.type).toBe('end-phase');
    });

    it('en el reparto manual reclama territorios libres', () => {
      const state = makeGame({ config: { autoClaim: false, startingArmies: 4 } });
      const player = currentPlayer(state)!;
      const action = decideAction(state, TINY_MAP, player.id);
      expect(action?.type).toBe('claim');
      if (action?.type === 'claim') {
        expect(state.territories[action.territoryId].ownerId).toBeNull();
      }
    });

    it('todas sus decisiones son legales en una partida completa', () => {
      const { state, finished } = selfPlay(TINY_MAP, 2, 7);
      expect(finished).toBe(true);
      expect(state.winnerId).not.toBeNull();
    });
  });

  describe('partidas de bots de principio a fin', () => {
    it('dos bots terminan la partida en el mapa de laboratorio', () => {
      const { state, finished } = selfPlay(TINY_MAP, 2, 11);
      expect(finished).toBe(true);
      expect(territoriesOf(state, state.winnerId!)).toHaveLength(TINY_MAP.territories.length);
    });

    it('tres bots también terminan', () => {
      const { finished } = selfPlay(TINY_MAP, 3, 23);
      expect(finished).toBe(true);
    });

    it('seis bots terminan una partida completa en el mapa del mundo', () => {
      const { state, finished, actions } = selfPlay(WORLD_MAP, 6, 4242, 40000);
      expect(finished).toBe(true);
      expect(actions).toBeLessThan(40000);
      expect(state.players.filter((p) => !p.eliminated)).toHaveLength(1);
    });

    it('cuatro bots terminan una partida completa en España', () => {
      const { finished } = selfPlay(SPAIN_MAP, 4, 555, 60000);
      expect(finished).toBe(true);
    });

    it('cinco bots terminan una partida en el mapa por comunidades', () => {
      const { finished, state } = selfPlay(SPAIN_REGIONS_MAP, 5, 909, 30000);
      expect(finished).toBe(true);
      expect(state.winnerId).not.toBeNull();
    });

    it('las partidas tienen ataques y conquistas de verdad, no solo refuerzos', () => {
      const { state } = selfPlay(WORLD_MAP, 4, 1234, 30000);
      const conquests = state.events.filter((event) => event.type === 'conquer').length;
      expect(state.round).toBeGreaterThan(2);
      expect(conquests + state.events.filter((e) => e.type === 'attack').length).toBeGreaterThan(0);
    });

    it('el tablero se mantiene coherente durante toda la partida', () => {
      const { state } = selfPlay(WORLD_MAP, 3, 808, 30000);
      for (const territory of Object.values(state.territories)) {
        expect(territory.armies).toBeGreaterThanOrEqual(1);
        expect(territory.ownerId).not.toBeNull();
      }
    });

    it('la partida es reproducible con la misma semilla', () => {
      const first = selfPlay(TINY_MAP, 2, 31337);
      const second = selfPlay(TINY_MAP, 2, 31337);
      expect(first.actions).toBe(second.actions);
      expect(first.state.winnerId).toBe(second.state.winnerId);
    });
  });

  describe('voz de la IA', () => {
    it('el comentario del bot menciona el tablero', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p2', 8],
          A2: ['p2', 3],
          A3: ['p1', 1],
          B1: ['p1', 2],
          B2: ['p1', 2],
          B3: ['p1', 2],
        }),
        'p2',
        'attack',
      );
      const message = botCommentary(state, TINY_MAP, 'p2');
      expect(message.length).toBeGreaterThan(20);
      expect(message).toMatch(/Territorio|%|frontera|continente|tirada/i);
    });

    it('el comentario es determinista para el mismo estado', () => {
      const state = forceTurn(makeGame(), 'p2', 'attack');
      expect(botCommentary(state, TINY_MAP, 'p2')).toBe(botCommentary(state, TINY_MAP, 'p2'));
    });

    it('devuelve cadena vacía para un jugador inexistente', () => {
      expect(botCommentary(makeGame(), TINY_MAP, 'nadie')).toBe('');
    });

    it('el consejo al humano cambia según la fase', () => {
      const base = setBoard(makeGame(), {
        A1: ['p1', 5],
        A2: ['p1', 3],
        A3: ['p1', 2],
        B1: ['p2', 2],
        B2: ['p2', 4],
        B3: ['p2', 3],
      });
      const reinforce = advisorTip(forceTurn(base, 'p1', 'reinforce', 6), TINY_MAP, 'p1');
      const attack = advisorTip(forceTurn(base, 'p1', 'attack'), TINY_MAP, 'p1');
      const fortify = advisorTip(forceTurn(base, 'p1', 'fortify'), TINY_MAP, 'p1');
      expect(reinforce).not.toBe(attack);
      expect(attack).not.toBe(fortify);
      for (const tip of [reinforce, attack, fortify]) {
        expect(tip.length).toBeGreaterThan(15);
      }
    });

    it('el consejo avisa de la obligación de canjear con cinco cartas', () => {
      let state = forceTurn(makeGame(), 'p1', 'reinforce', 5);
      state = JSON.parse(JSON.stringify(state));
      playerById(state, 'p1')!.cards = Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        symbol: 'infantry' as const,
        territoryId: null,
      }));
      expect(advisorTip(state, TINY_MAP, 'p1')).toContain('obligado a canjear');
    });

    it('el consejo señala el continente que está a un territorio', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p1', 5],
          A2: ['p1', 5],
          A3: ['p2', 1],
          B1: ['p2', 2],
          B2: ['p2', 2],
          B3: ['p2', 2],
        }),
        'p1',
        'attack',
      );
      expect(advisorTip(state, TINY_MAP, 'p1')).toContain('Territorio A3');
    });
  });
});
