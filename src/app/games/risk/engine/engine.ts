import {
  BotProfile,
  Card,
  GameAction,
  GameConfig,
  GameEvent,
  GameMap,
  GameState,
  PlayerId,
  PlayerKind,
  PlayerState,
  RULES_V1,
  RuleError,
  TerritoryId,
  UnitKind,
} from './types';
import { createRng, rngFor, shuffle } from './rng';
import { DEFAULT_MAX_TRADE_VALUE, buildDeck, isValidSet, takeCards, tradeValue } from './cards';
import { maxAttackDice, resolveCombat } from './combat';
import { battleRulesFor } from './terrain';
import { assignMissions, isMissionComplete, missionProgress } from './missions';
import {
  addUnit,
  applyCasualties,
  clearUnits,
  fortifyAllowance,
  hasUnit,
  infantryOf,
  trimUnits,
  UNIT_META,
} from './units';
import {
  adjacencyOf,
  areConnected,
  canAttack,
  reinforcementsFor,
  startingArmiesFor,
  territoriesOf,
} from './rules';

/** Número máximo de eventos que se conservan (el log completo va aparte). */
const MAX_EVENTS = 80;

export const DEFAULT_CONFIG: GameConfig = {
  rulesVersion: RULES_V1,
  startingArmies: null,
  autoClaim: true,
  tradeProgression: 'classic',
  maxTradeValue: DEFAULT_MAX_TRADE_VALUE,
  maxAttackDice: 3,
  maxDefendDice: 2,
  advancedTerrain: false,
  advancedUnits: false,
  victory: 'conquest',
};

/** Paleta de los jugadores: alto contraste sobre el fondo oscuro. */
export const PLAYER_COLORS = [
  '#00e676',
  '#ff5252',
  '#40c4ff',
  '#ffd740',
  '#e040fb',
  '#ff9100',
];

export interface PlayerSeed {
  id: PlayerId;
  name: string;
  kind: PlayerKind;
  botProfile?: BotProfile;
  seatToken?: string;
  color?: string;
}

export interface CreateGameOptions {
  map: GameMap;
  players: PlayerSeed[];
  seed: number;
  config?: Partial<GameConfig>;
}

/**
 * Copia profunda del estado. `structuredClone` es bastante más rápido que el
 * viaje por JSON y el estado solo contiene datos planos, así que es seguro.
 */
function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function pushEvent(state: GameState, event: Omit<GameEvent, 'at'>): void {
  state.events.push({ ...event, at: state.actionCount });
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }
}

/** Crea la partida inicial. Determinista: misma semilla, misma partida. */
export function createGame(options: CreateGameOptions): GameState {
  const { map, seed } = options;
  const config: GameConfig = { ...DEFAULT_CONFIG, ...(options.config ?? {}) };

  if (options.players.length < 2) {
    throw new RuleError('too-few-players', 'Hacen falta al menos 2 jugadores');
  }
  if (options.players.length > map.maxPlayers) {
    throw new RuleError(
      'too-many-players',
      `El mapa ${map.name} admite como máximo ${map.maxPlayers} jugadores`,
    );
  }

  const rng = createRng(seed);
  const startingArmies = config.startingArmies ?? startingArmiesFor(options.players.length);

  const players: PlayerState[] = options.players.map((seedPlayer, index) => ({
    id: seedPlayer.id,
    name: seedPlayer.name,
    color: seedPlayer.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length],
    kind: seedPlayer.kind,
    botProfile: seedPlayer.botProfile,
    seatToken: seedPlayer.seatToken,
    cards: [],
    eliminated: false,
    reserve: 0,
    conqueredThisTurn: false,
  }));

  const territories: GameState['territories'] = {};
  for (const territory of map.territories) {
    territories[territory.id] = { ownerId: null, armies: 0 };
  }

  // En un escenario histórico cada jugador lleva una facción concreta, y las
  // facciones se reparten alternando bandos: con dos jugadores sale uno contra
  // uno, con cuatro dos contra dos. El orden de la mesa ya viene barajado, así
  // que no hace falta más azar.
  if (map.scenario) {
    const byside = map.scenario.sides.map((side) =>
      map.scenario!.factions.filter((faction) => faction.side === side.id),
    );
    players.forEach((player, index) => {
      const group = byside[index % byside.length];
      const faction = group[Math.floor(index / byside.length) % group.length];
      player.factionId = faction.id;
      player.side = faction.side;
      player.color = faction.color;
    });
  }

  const state: GameState = {
    mapId: map.id,
    seed,
    players,
    turnOrder: shuffle(
      players.map((p) => p.id),
      createRng(seed ^ 0x5f3a),
    ),
    currentPlayerIndex: 0,
    phase: config.autoClaim ? 'reinforce' : 'setup-claim',
    territories,
    deck: buildDeck(map, rng),
    discard: [],
    tradeCount: 0,
    actionCount: 0,
    round: 1,
    pendingOccupation: null,
    fortifiedThisTurn: false,
    winnerId: null,
    lastCombat: null,
    events: [],
    config,
  };

  pushEvent(state, {
    type: 'game-start',
    playerId: null,
    text: `Comienza la partida en ${map.name} con ${players.length} jugadores.`,
  });

  if (map.scenario) {
    deployScenario(state, map, startingArmies, rng);
    beginTurn(state, map, /* first */ true);
  } else if (config.autoClaim) {
    autoDistribute(state, map, startingArmies, rng);
    beginTurn(state, map, /* first */ true);
  } else {
    for (const player of state.players) player.reserve = startingArmies;
  }

  // Los objetivos se reparten al final, con un RNG propio sembrado aparte: si
  // consumieran tiradas del mismo flujo, encender los objetivos cambiaría el
  // reparto del tablero y dos mesas con la misma semilla dejarían de empezar
  // igual.
  if (config.victory === 'objectives') {
    state.missions = assignMissions(state, map, rngFor(seed, 0, 'missions'));
    for (const player of state.players) {
      pushEvent(state, {
        type: 'game-start',
        playerId: player.id,
        text: `Objetivo de ${player.name}: ${state.missions[player.id].text}.`,
      });
    }
  }

  return state;
}

/**
 * Coloca el tablero tal y como lo declara el escenario.
 *
 * Las provincias de una facción que nadie lleva se reparten entre quienes sí
 * juegan de ese mismo bando: en una partida de dos, quien lleve la República
 * hereda también las columnas confederadas. Así el escenario empieza siempre
 * completo, jueguen dos o cuatro.
 */
/**
 * Reparto de un escenario histórico: al azar y lo más parejo posible.
 *
 * Antes el reparto era el histórico, provincia por provincia. Como juego no se
 * sostenía: los sublevados empezaban con 30 provincias y tres regiones enteras,
 * lo que en RISK son 15 refuerzos por turno contra 7 desde la primera ronda.
 * Medido en autopartidas, ganaban 91 de cada 100 con dos jugadores y 100 de
 * cada 100 con cuatro, en nueve rondas. Eso no es una partida, es un trámite.
 *
 * Ahora el tablero se sortea. Las facciones, los bandos y la crónica siguen
 * ahí -- que es lo que da el ambiente -- pero quién arranca con qué lo decide
 * la baraja, y los dos frentes salen del mismo tamaño.
 */
function deployScenario(
  state: GameState,
  map: GameMap,
  startingArmies: number,
  rng: ReturnType<typeof createRng>,
): void {
  const scenario = map.scenario!;

  const bySide = new Map<string, PlayerId[]>();
  for (const playerId of state.turnOrder) {
    const player = playerById(state, playerId);
    if (!player?.side) continue;
    bySide.set(player.side, [...(bySide.get(player.side) ?? []), playerId]);
  }
  const sides = [...bySide.keys()];
  if (sides.length === 0) {
    autoDistribute(state, map, startingArmies, rng);
    return;
  }

  const shuffled = shuffle(
    map.territories.map((t) => t.id),
    rng,
  );

  // Primero se reparte entre BANDOS, no entre jugadores. Si fuera por jugadores
  // y un bando llevara dos y el otro uno, el de dos se quedaría con el doble de
  // tablero: el frente tiene que medir lo mismo pase lo que pase con las sillas.
  const sideOffset = rng.int(0, sides.length - 1);
  const perSide = new Map<string, TerritoryId[]>();
  shuffled.forEach((territoryId, index) => {
    const side = sides[(index + sideOffset) % sides.length];
    perSide.set(side, [...(perSide.get(side) ?? []), territoryId]);
  });

  // Y dentro de cada bando, en rueda entre los suyos.
  for (const side of sides) {
    const members = bySide.get(side) ?? [];
    const list = perSide.get(side) ?? [];
    if (members.length === 0) continue;
    const offset = rng.int(0, members.length - 1);
    list.forEach((territoryId, index) => {
      state.territories[territoryId] = {
        ownerId: members[(index + offset) % members.length],
        armies: 1,
      };
    });
  }

  spreadArmies(state, state.turnOrder, startingArmies, rng);

  pushEvent(state, {
    type: 'game-start',
    playerId: null,
    text: scenario.intro,
  });
}

/**
 * Reparte el montón de ejércitos de cada jugador sobre sus territorios.
 *
 * Dos decisiones viven aquí, y las dos son de equilibrio:
 *
 * 1. Compensación: menos tierras, más tropas. 42 territorios entre 4 no salen
 *    exactos, y el que tiene una provincia menos perdía dos veces -- menos
 *    tablero Y menos refuerzos cada turno. Cada territorio de menos vale ahora
 *    un ejército de más, que es lo que cuesta ocupar uno.
 *
 * 2. El montón se echa AL AZAR, ejército por ejército. Antes iba en rueda, una
 *    tropa a cada territorio por vuelta, y salía un 3 clavado en el 81% del
 *    mapa con un máximo de 4. Un tablero plano no tiene ni plaza fuerte que
 *    rodear ni hueco por donde entrar, que es de donde sale la estrategia.
 *
 * Sigue siendo determinista: las tiradas salen del generador sembrado, así que
 * dos mesas con la misma semilla reparten idéntico. Devuelve a cuántos hubo que
 * compensar, sólo para poder contarlo en pantalla.
 */
function spreadArmies(
  state: GameState,
  order: PlayerId[],
  startingArmies: number,
  rng: ReturnType<typeof createRng>,
): number {
  const counts = new Map(order.map((id) => [id, territoriesOf(state, id).length]));
  const most = Math.max(0, ...counts.values());

  for (const playerId of order) {
    const owned = territoriesOf(state, playerId);
    const compensation = most - (counts.get(playerId) ?? most);
    let remaining = startingArmies + compensation - owned.length;
    while (remaining > 0 && owned.length > 0) {
      state.territories[owned[rng.int(0, owned.length - 1)]].armies++;
      remaining--;
    }
  }

  return order.filter((id) => (counts.get(id) ?? 0) < most).length;
}

function autoDistribute(
  state: GameState,
  map: GameMap,
  startingArmies: number,
  rng: ReturnType<typeof createRng>,
): void {
  const order = state.turnOrder;
  const shuffled = shuffle(
    map.territories.map((t) => t.id),
    rng,
  );

  // Los territorios se reparten en rueda sobre la baraja, así que a cada uno le
  // tocan los mismos (o uno menos) y siempre distintos. El desplazamiento
  // inicial decide QUIÉN se lleva el de más cuando no hay reparto exacto: sin
  // él siempre serían los primeros del orden de turno.
  const offset = rng.int(0, order.length - 1);
  shuffled.forEach((territoryId, index) => {
    const ownerId = order[(index + offset) % order.length];
    state.territories[territoryId] = { ownerId, armies: 1 };
  });

  const compensated = spreadArmies(state, order, startingArmies, rng);
  pushEvent(state, {
    type: 'deploy',
    playerId: null,
    text:
      `Territorios repartidos al azar: ${startingArmies} ejércitos por jugador` +
      (compensated > 0
        ? `, y un ejército de más por cada territorio de menos (${compensated} ${
            compensated === 1 ? 'jugador compensado' : 'jugadores compensados'
          }).`
        : '.'),
  });
}

/** Prepara el turno del jugador actual. */
function beginTurn(state: GameState, map: GameMap, first = false): void {
  const player = currentPlayer(state);
  if (!player) return;

  player.conqueredThisTurn = false;
  state.fortifiedThisTurn = false;
  state.fortifyCount = 0;
  state.placedThisTurn = [];
  state.pendingOccupation = null;
  state.phase = 'reinforce';
  player.reserve = reinforcementsFor(state, map, player.id);

  pushEvent(state, {
    type: 'turn',
    playerId: player.id,
    text: `${first ? 'Primer turno' : 'Turno'} de ${player.name}: ${player.reserve} refuerzos.`,
    data: { reinforcements: player.reserve, round: state.round },
  });
}

export function currentPlayer(state: GameState): PlayerState | undefined {
  const id = state.turnOrder[state.currentPlayerIndex];
  return state.players.find((p) => p.id === id);
}

export function playerById(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

/** Avanza al siguiente jugador vivo (y cierra la ronda cuando toca). */
function advanceTurn(state: GameState, map: GameMap): void {
  const total = state.turnOrder.length;
  for (let step = 1; step <= total; step++) {
    const nextIndex = (state.currentPlayerIndex + step) % total;
    const candidate = state.players.find((p) => p.id === state.turnOrder[nextIndex]);
    if (candidate && !candidate.eliminated) {
      if (nextIndex <= state.currentPlayerIndex) state.round++;
      state.currentPlayerIndex = nextIndex;
      beginTurn(state, map);
      return;
    }
  }
  // Si no queda nadie más, la partida ya está decidida.
  checkVictory(state, map);
}

function checkVictory(state: GameState, map: GameMap): boolean {
  const alive = state.players.filter((p) => !p.eliminated);
  const totalTerritories = map.territories.length;

  // Por objetivos gana quien cumple el suyo, sin tener que barrer el mapa. Se
  // comprueba antes que la conquista total porque es la condición más fácil de
  // alcanzar, y el orden de la lista es el de la mesa, que es estable.
  if (state.config.victory === 'objectives' && state.missions) {
    for (const player of alive) {
      if (!isMissionComplete(state, map, player.id)) continue;
      state.winnerId = player.id;
      state.phase = 'game-over';
      pushEvent(state, {
        type: 'win',
        playerId: player.id,
        text: `¡${player.name} cumple su objetivo y gana la partida! (${
          missionProgress(state, map, player.id).text
        })`,
      });
      return true;
    }
  }

  // En un escenario por bandos gana el bando entero cuando el otro se queda sin
  // nada. No hace falta que un solo jugador lo tenga todo: la guerra la ganan
  // los dos juntos o no la gana ninguno.
  if (map.scenario && alive.some((player) => player.side)) {
    const sides = new Set(alive.map((player) => player.side).filter(Boolean));
    if (sides.size === 1) {
      const [side] = [...sides];
      const winners = alive.filter((player) => player.side === side);
      const name = map.scenario.sides.find((s) => s.id === side)?.name ?? side;
      state.winnerId = winners[0]?.id ?? null;
      state.phase = 'game-over';
      pushEvent(state, {
        type: 'win',
        playerId: state.winnerId,
        text: `La guerra termina: ${name} controla España.`,
      });
      return true;
    }
  }

  for (const player of alive) {
    if (territoriesOf(state, player.id).length === totalTerritories) {
      state.winnerId = player.id;
      state.phase = 'game-over';
      pushEvent(state, {
        type: 'win',
        playerId: player.id,
        text: `¡${player.name} conquista el mundo entero y gana la partida!`,
      });
      return true;
    }
  }
  if (alive.length === 1) {
    state.winnerId = alive[0].id;
    state.phase = 'game-over';
    pushEvent(state, {
      type: 'win',
      playerId: alive[0].id,
      text: `¡${alive[0].name} es el último en pie y gana la partida!`,
    });
    return true;
  }
  return false;
}

function requireTurn(state: GameState, playerId: PlayerId): PlayerState {
  const player = playerById(state, playerId);
  if (!player) throw new RuleError('unknown-player', 'Jugador desconocido');
  if (player.eliminated) throw new RuleError('eliminated', `${player.name} ya está eliminado`);
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) {
    throw new RuleError('not-your-turn', 'No es tu turno');
  }
  return player;
}

/**
 * Aplica una acción y devuelve un estado NUEVO.
 * Lanza RuleError si la acción es ilegal: el motor nunca acepta jugadas inválidas,
 * ni siquiera viniendo de la IA.
 */
export function applyAction(state: GameState, action: GameAction, map: GameMap): GameState {
  if (state.phase === 'game-over') {
    throw new RuleError('game-over', 'La partida ya ha terminado');
  }
  const next = clone(state);
  next.actionCount = state.actionCount + 1;
  next.lastCombat = null;

  switch (action.type) {
    case 'claim':
      applyClaim(next, action.playerId, action.territoryId, map);
      break;
    case 'deploy':
      applyDeploy(next, action.playerId, action.territoryId, action.armies, map);
      break;
    case 'trade':
      applyTrade(next, action.playerId, action.cardIds);
      break;
    case 'attack':
      applyAttack(next, action.playerId, action.from, action.to, action.dice, map);
      break;
    case 'occupy':
      applyOccupy(next, action.playerId, action.armies);
      break;
    case 'fortify':
      applyFortify(next, action.playerId, action.from, action.to, action.armies, map);
      break;
    case 'end-phase':
      applyEndPhase(next, action.playerId, map);
      break;
    case 'surrender':
      applySurrender(next, action.playerId, map);
      break;
    case 'upgrade':
      applyUpgrade(next, action.playerId, action.territoryId, action.unit, map);
      break;
    case 'undo-deploy':
      applyUndoDeploy(next, action.playerId, action.all ?? false, map);
      break;
    default: {
      const exhaustive: never = action;
      throw new RuleError('unknown-action', `Acción desconocida: ${JSON.stringify(exhaustive)}`);
    }
  }

  return next;
}

// ===== FASE DE REPARTO MANUAL =====

function applyClaim(
  state: GameState,
  playerId: PlayerId,
  territoryId: TerritoryId,
  map: GameMap,
): void {
  const player = requireTurn(state, playerId);
  if (state.phase !== 'setup-claim' && state.phase !== 'setup-deploy') {
    throw new RuleError('wrong-phase', 'Ya no estamos en el reparto inicial');
  }
  const territory = state.territories[territoryId];
  if (!territory) throw new RuleError('unknown-territory', 'Territorio desconocido');

  const unclaimed = Object.values(state.territories).some((t) => t.ownerId === null);

  if (state.phase === 'setup-claim') {
    if (territory.ownerId !== null) {
      throw new RuleError('already-claimed', 'Ese territorio ya tiene dueño');
    }
    territory.ownerId = playerId;
    territory.armies = 1;
  } else {
    if (territory.ownerId !== playerId) {
      throw new RuleError('not-your-territory', 'Solo puedes reforzar territorios propios');
    }
    territory.armies++;
  }
  player.reserve--;

  pushEvent(state, {
    type: 'claim',
    playerId,
    text: `${player.name} ocupa ${map.territories.find((t) => t.id === territoryId)?.name}.`,
    data: { territoryId },
  });

  const stillUnclaimed = Object.values(state.territories).some((t) => t.ownerId === null);
  if (unclaimed && !stillUnclaimed) state.phase = 'setup-deploy';

  const everyoneDone = state.players.every((p) => p.reserve === 0);
  if (everyoneDone) {
    state.currentPlayerIndex = 0;
    beginTurn(state, map, true);
    return;
  }
  // Turno rotatorio durante el reparto.
  rotateSetupTurn(state);
}

function rotateSetupTurn(state: GameState): void {
  const total = state.turnOrder.length;
  for (let step = 1; step <= total; step++) {
    const nextIndex = (state.currentPlayerIndex + step) % total;
    const candidate = state.players.find((p) => p.id === state.turnOrder[nextIndex]);
    if (candidate && candidate.reserve > 0) {
      state.currentPlayerIndex = nextIndex;
      return;
    }
  }
}

// ===== REFUERZOS =====

function applyDeploy(
  state: GameState,
  playerId: PlayerId,
  territoryId: TerritoryId,
  armies: number,
  map: GameMap,
): void {
  const player = requireTurn(state, playerId);
  if (state.phase !== 'reinforce') {
    throw new RuleError('wrong-phase', 'Solo puedes colocar ejércitos en la fase de refuerzos');
  }
  if (!Number.isInteger(armies) || armies <= 0) {
    throw new RuleError('bad-amount', 'La cantidad debe ser un entero positivo');
  }
  if (armies > player.reserve) {
    throw new RuleError('not-enough-reserve', `Solo te quedan ${player.reserve} ejércitos`);
  }
  const territory = state.territories[territoryId];
  if (!territory) throw new RuleError('unknown-territory', 'Territorio desconocido');
  if (territory.ownerId !== playerId) {
    throw new RuleError('not-your-territory', 'Ese territorio no es tuyo');
  }

  territory.armies += armies;
  player.reserve -= armies;
  state.placedThisTurn = [...(state.placedThisTurn ?? []), { territoryId, armies }];

  pushEvent(state, {
    type: 'reinforce',
    playerId,
    text: `${player.name} coloca ${armies} en ${map.territories.find((t) => t.id === territoryId)?.name}.`,
    data: { territoryId, armies },
  });
}

// ===== CANJE DE CARTAS =====

function applyTrade(state: GameState, playerId: PlayerId, cardIds: [string, string, string]): void {
  const player = requireTurn(state, playerId);
  if (state.phase !== 'reinforce') {
    throw new RuleError('wrong-phase', 'Las cartas se canjean en la fase de refuerzos');
  }
  const unique = new Set(cardIds);
  if (unique.size !== 3) throw new RuleError('duplicate-cards', 'No puedes repetir carta');

  const trio = takeCards(player.cards, cardIds);
  if (!isValidSet(trio)) {
    throw new RuleError('invalid-set', 'Ese trío no es canjeable');
  }

  const value = tradeValue(
    state.tradeCount,
    state.config.tradeProgression,
    state.config.maxTradeValue ?? DEFAULT_MAX_TRADE_VALUE,
  );
  player.cards = player.cards.filter((card) => !cardIds.includes(card.id));
  state.discard.push(...trio);
  state.tradeCount++;
  player.reserve += value;

  // Bonificación clásica: +2 en un territorio propio que aparezca en las cartas.
  let bonusTerritory: TerritoryId | null = null;
  for (const card of trio) {
    if (card.territoryId && state.territories[card.territoryId]?.ownerId === playerId) {
      bonusTerritory = card.territoryId;
      break;
    }
  }
  if (bonusTerritory) state.territories[bonusTerritory].armies += 2;

  pushEvent(state, {
    type: 'trade',
    playerId,
    text: `${player.name} canjea un trío por ${value} ejércitos${
      bonusTerritory ? ' (+2 de bonificación territorial)' : ''
    }.`,
    data: { value, bonusTerritory },
  });
}

// ===== ATAQUE =====

function applyAttack(
  state: GameState,
  playerId: PlayerId,
  from: TerritoryId,
  to: TerritoryId,
  dice: number,
  map: GameMap,
): void {
  const player = requireTurn(state, playerId);
  if (state.phase !== 'attack') {
    throw new RuleError('wrong-phase', 'No estás en la fase de ataque');
  }
  if (state.pendingOccupation) {
    throw new RuleError('pending-occupation', 'Primero decide cuántos ejércitos ocupan la conquista');
  }
  if (!canAttack(state, map, from, to, playerId)) {
    throw new RuleError('illegal-attack', 'Ese ataque no es legal');
  }
  const origin = state.territories[from];
  const target = state.territories[to];
  // Las mismas reglas que ve el jugador en pantalla y que usa la IA: los topes
  // de la mesa ya combinados con el terreno de `to` y con la forma de llegar.
  const rules = battleRulesFor(map, state.config, from, to, origin, target);
  const allowed = maxAttackDice(origin.armies, rules.attack);
  if (!Number.isInteger(dice) || dice < 1 || dice > allowed) {
    throw new RuleError('bad-dice', `Puedes lanzar entre 1 y ${allowed} dados`);
  }

  const rng = rngFor(state.seed, state.actionCount, `${from}->${to}`);
  const result = resolveCombat(origin.armies, target.armies, dice, rng, rules);

  // Las bajas se las come primero la infantería: los especialistas caen cuando
  // ya no queda nadie más (ver CASUALTY_ORDER en units.ts).
  applyCasualties(origin, result.attackerLosses);
  applyCasualties(target, result.defenderLosses);

  const fromName = map.territories.find((t) => t.id === from)?.name ?? from;
  const toName = map.territories.find((t) => t.id === to)?.name ?? to;
  const defenderId = target.ownerId;

  state.lastCombat = { ...result, from, to, attackerId: playerId };

  pushEvent(state, {
    type: 'attack',
    playerId,
    text: `${player.name} ataca ${toName} desde ${fromName} · 🎲 ${result.attackerDice.join('-')} vs ${result.defenderDice.join('-')} · −${result.defenderLosses} defensor / −${result.attackerLosses} atacante.`,
    data: { from, to, ...result },
  });

  if (result.conquered) {
    target.ownerId = playerId;
    target.armies = 0;
    // El territorio cae entero: sus especialistas se pierden con él.
    clearUnits(target);
    player.conqueredThisTurn = true;
    state.pendingOccupation = { from, to, minArmies: Math.min(dice, origin.armies - 1) };

    pushEvent(state, {
      type: 'conquer',
      playerId,
      text: `¡${player.name} conquista ${toName}!`,
      data: { from, to },
    });

    if (defenderId) handlePossibleElimination(state, defenderId, playerId, map);
    if (checkVictory(state, map)) {
      // La partida acaba con la conquista: nadie llegará a decidir la ocupación,
      // así que la resolvemos con el mínimo para no dejar el territorio vacío.
      resolvePendingOccupation(state);
    }
  }
}

/** Cierra una ocupación pendiente moviendo el mínimo obligatorio. */
function resolvePendingOccupation(state: GameState): void {
  const pending = state.pendingOccupation;
  if (!pending) return;
  const origin = state.territories[pending.from];
  const target = state.territories[pending.to];
  const move = Math.max(1, Math.min(pending.minArmies, Math.max(origin.armies - 1, 1)));
  origin.armies = Math.max(1, origin.armies - move);
  target.armies += move;
  state.pendingOccupation = null;
}

function handlePossibleElimination(
  state: GameState,
  defenderId: PlayerId,
  attackerId: PlayerId,
  map: GameMap,
): void {
  if (territoriesOf(state, defenderId).length > 0) return;
  const defender = playerById(state, defenderId);
  if (defender) defender.eliminatedBy = attackerId;
  const attacker = playerById(state, attackerId);
  if (!defender || defender.eliminated || !attacker) return;

  defender.eliminated = true;
  const inherited: Card[] = defender.cards;
  defender.cards = [];
  attacker.cards.push(...inherited);

  pushEvent(state, {
    type: 'eliminate',
    playerId: defenderId,
    text: `${defender.name} queda eliminado. ${attacker.name} se queda con sus ${inherited.length} cartas.`,
    data: { attackerId, cards: inherited.length },
  });
}

function applyOccupy(state: GameState, playerId: PlayerId, armies: number): void {
  const player = requireTurn(state, playerId);
  const pending = state.pendingOccupation;
  if (!pending) throw new RuleError('no-occupation', 'No hay ninguna conquista pendiente');

  const origin = state.territories[pending.from];
  const target = state.territories[pending.to];
  const max = origin.armies - 1;
  const min = Math.min(pending.minArmies, max);
  if (!Number.isInteger(armies) || armies < min || armies > max) {
    throw new RuleError('bad-amount', `Debes mover entre ${min} y ${max} ejércitos`);
  }

  // Los especialistas no viajan: se construyen donde hacen falta y se quedan.
  origin.armies -= armies;
  trimUnits(origin);
  target.armies += armies;
  state.pendingOccupation = null;

  pushEvent(state, {
    type: 'occupy',
    playerId,
    text: `${player.name} traslada ${armies} ejércitos a la nueva conquista.`,
    data: { ...pending, armies },
  });
}

// ===== REAGRUPACIÓN =====

function applyFortify(
  state: GameState,
  playerId: PlayerId,
  from: TerritoryId,
  to: TerritoryId,
  armies: number,
  map: GameMap,
): void {
  const player = requireTurn(state, playerId);
  if (state.phase !== 'fortify') {
    throw new RuleError('wrong-phase', 'No estás en la fase de reagrupación');
  }
  if (fortifiesDone(state) >= fortifyLimit(state, playerId)) {
    throw new RuleError('already-fortified', 'Ya has agotado las reagrupaciones del turno');
  }
  const origin = state.territories[from];
  const target = state.territories[to];
  if (!origin || !target) throw new RuleError('unknown-territory', 'Territorio desconocido');
  if (origin.ownerId !== playerId || target.ownerId !== playerId) {
    throw new RuleError('not-your-territory', 'Ambos territorios deben ser tuyos');
  }
  if (!areConnected(state, map, from, to, playerId)) {
    throw new RuleError('not-connected', 'No hay un camino propio entre esos territorios');
  }
  const max = origin.armies - 1;
  if (!Number.isInteger(armies) || armies < 1 || armies > max) {
    throw new RuleError('bad-amount', `Puedes mover entre 1 y ${max} ejércitos`);
  }

  origin.armies -= armies;
  trimUnits(origin);
  target.armies += armies;
  state.fortifyCount = fortifiesDone(state) + 1;
  state.fortifiedThisTurn = true;

  pushEvent(state, {
    type: 'fortify',
    playerId,
    text: `${player.name} reagrupa ${armies} ejércitos de ${
      map.territories.find((t) => t.id === from)?.name
    } a ${map.territories.find((t) => t.id === to)?.name}.`,
    data: { from, to, armies },
  });

  // Con caballería queda otra reagrupación, así que el turno no se cierra
  // todavía; sin ella se cierra en cuanto se mueve, como en el RISK de siempre.
  if (fortifiesDone(state) >= fortifyLimit(state, playerId)) endTurn(state, map);
}

/**
 * Devuelve a la reserva lo colocado en este turno.
 *
 * Solo lo de ESTE turno y solo durante la fase de refuerzos: no es una máquina
 * del tiempo, es el botón de "me he equivocado" antes de dar por buenos los
 * refuerzos. En cuanto se pasa a atacar, lo colocado ya está colocado.
 */
function applyUndoDeploy(state: GameState, playerId: PlayerId, all: boolean, map: GameMap): void {
  const player = requireTurn(state, playerId);
  if (state.phase !== 'reinforce') {
    throw new RuleError('wrong-phase', 'Solo puedes deshacer durante los refuerzos');
  }
  const placed = state.placedThisTurn ?? [];
  if (placed.length === 0) {
    throw new RuleError('nothing-to-undo', 'No has colocado nada todavía');
  }

  const undone = all ? placed.slice() : [placed[placed.length - 1]];
  let total = 0;
  for (const entry of undone) {
    const territory = state.territories[entry.territoryId];
    if (!territory) continue;
    territory.armies -= entry.armies;
    trimUnits(territory);
    player.reserve += entry.armies;
    total += entry.armies;
  }
  state.placedThisTurn = all ? [] : placed.slice(0, -1);

  const where = all
    ? 'sus refuerzos'
    : `los ${undone[0].armies} de ${map.territories.find((t) => t.id === undone[0].territoryId)?.name}`;
  pushEvent(state, {
    type: 'reinforce',
    playerId,
    text: `${player.name} recupera ${where} (${total} a la reserva).`,
    data: { undone: undone.length, armies: total },
  });
}

// ===== TROPAS ESPECIALIZADAS =====

/** Reagrupaciones ya hechas este turno. */
function fortifiesDone(state: GameState): number {
  // Las partidas grabadas antes de que existiera el contador solo tienen el
  // booleano, así que se deduce de él.
  return state.fortifyCount ?? (state.fortifiedThisTurn ? 1 : 0);
}

/** Cuántas reagrupaciones puede hacer el jugador en este turno. */
function fortifyLimit(state: GameState, playerId: PlayerId): number {
  if (!state.config.advancedUnits) return 1;
  const hasCavalry = Object.values(state.territories).some(
    (territory) => territory.ownerId === playerId && hasUnit(territory, 'caballeria'),
  );
  return fortifyAllowance(hasCavalry);
}

/** ¿Puede ascender alguna ficha en algún sitio? (dirige el menú y la IA) */
function canUpgradeSomething(state: GameState, playerId: PlayerId): boolean {
  const player = playerById(state, playerId);
  if (!player) return false;
  const cheapest = Math.min(...Object.values(UNIT_META).map((meta) => meta.cost));
  if (player.reserve < cheapest) return false;
  return Object.values(state.territories).some(
    (territory) => territory.ownerId === playerId && infantryOf(territory) > 0,
  );
}

/**
 * Asciende una ficha de infantería a especialista.
 *
 * No añade ejércitos: cuesta reserva y cambia de tipo una ficha que ya estaba.
 * Por eso el reparto de refuerzos, los continentes y la eliminación siguen
 * contando exactamente igual.
 */
function applyUpgrade(
  state: GameState,
  playerId: PlayerId,
  territoryId: TerritoryId,
  unit: UnitKind,
  map: GameMap,
): void {
  const player = requireTurn(state, playerId);
  if (!state.config.advancedUnits) {
    throw new RuleError('no-advanced-units', 'Esta partida no usa tropas especializadas');
  }
  if (state.phase !== 'reinforce') {
    throw new RuleError('wrong-phase', 'Las tropas se preparan al recibir refuerzos');
  }
  const meta = UNIT_META[unit];
  if (!meta) throw new RuleError('unknown-unit', 'Esa tropa no existe');

  const territory = state.territories[territoryId];
  if (!territory) throw new RuleError('unknown-territory', 'Territorio desconocido');
  if (territory.ownerId !== playerId) {
    throw new RuleError('not-your-territory', 'Ese territorio no es tuyo');
  }
  if (infantryOf(territory) < 1) {
    throw new RuleError('no-infantry', 'No queda infantería que ascender ahí');
  }
  if (player.reserve < meta.cost) {
    throw new RuleError('not-enough-reserve', `${meta.name} cuesta ${meta.cost} de refuerzo`);
  }

  player.reserve -= meta.cost;
  addUnit(territory, unit);

  pushEvent(state, {
    type: 'deploy',
    playerId,
    text: `${player.name} prepara ${meta.name.toLowerCase()} en ${
      map.territories.find((t) => t.id === territoryId)?.name ?? territoryId
    }.`,
    data: { territoryId, unit },
  });
}

// ===== CAMBIO DE FASE =====

function applyEndPhase(state: GameState, playerId: PlayerId, map: GameMap): void {
  const player = requireTurn(state, playerId);

  if (state.phase === 'reinforce') {
    if (player.reserve > 0) {
      throw new RuleError('reserve-pending', `Aún te quedan ${player.reserve} ejércitos por colocar`);
    }
    // Al pasar a atacar, lo colocado queda colocado: ya no hay vuelta atrás.
    state.placedThisTurn = [];
    state.phase = 'attack';
    pushEvent(state, { type: 'phase', playerId, text: `${player.name} pasa al ataque.` });
    return;
  }

  if (state.phase === 'attack') {
    if (state.pendingOccupation) {
      throw new RuleError('pending-occupation', 'Tienes una conquista sin ocupar');
    }
    drawCardIfEarned(state, player);
    state.phase = 'fortify';
    pushEvent(state, { type: 'phase', playerId, text: `${player.name} pasa a reagrupar.` });
    return;
  }

  if (state.phase === 'fortify') {
    endTurn(state, map);
    return;
  }

  throw new RuleError('wrong-phase', 'No puedes terminar esta fase');
}

function drawCardIfEarned(state: GameState, player: PlayerState): void {
  if (!player.conqueredThisTurn) return;
  if (state.deck.length === 0) {
    // Se rebaraja el descarte cuando se agota el mazo.
    if (state.discard.length === 0) return;
    const rng = rngFor(state.seed, state.actionCount, 'reshuffle');
    state.deck = shuffle(state.discard, rng);
    state.discard = [];
  }
  const card = state.deck.shift();
  if (!card) return;
  player.cards.push(card);
  player.conqueredThisTurn = false;
  pushEvent(state, {
    type: 'card-drawn',
    playerId: player.id,
    text: `${player.name} roba una carta por haber conquistado (${player.cards.length} en mano).`,
  });
}

function endTurn(state: GameState, map: GameMap): void {
  if (state.phase === 'game-over') return;
  const player = currentPlayer(state);
  if (player) drawCardIfEarned(state, player);
  advanceTurn(state, map);
}

// ===== ABANDONO =====

/**
 * Abandonar no borra al jugador del tablero: su puesto lo toma la IA.
 * Así una partida guardada sigue siendo jugable aunque alguien no vuelva.
 */
function applySurrender(state: GameState, playerId: PlayerId, map: GameMap): void {
  const player = playerById(state, playerId);
  if (!player) throw new RuleError('unknown-player', 'Jugador desconocido');
  if (player.kind === 'bot') throw new RuleError('already-bot', 'Ese puesto ya lo lleva la IA');

  player.kind = 'bot';
  player.botProfile = player.botProfile ?? 'oportunista';

  pushEvent(state, {
    type: 'phase',
    playerId,
    text: `${player.name} abandona la partida. La IA toma el mando de sus ejércitos.`,
  });

  if (state.pendingOccupation && state.turnOrder[state.currentPlayerIndex] === playerId) {
    // Deja el tablero en un estado jugable para quien continúe.
    resolvePendingOccupation(state);
  }
  checkVictory(state, map);
}

// ===== UTILIDADES DE ALTO NIVEL =====

/** Reproduce una lista de acciones sobre un estado inicial (grabación / lockstep). */
export function replay(initial: GameState, actions: readonly GameAction[], map: GameMap): GameState {
  let state = initial;
  for (const action of actions) {
    state = applyAction(state, action, map);
  }
  return state;
}

/** Aplica la acción y devuelve null si es ilegal, en vez de lanzar. */
export function tryApplyAction(
  state: GameState,
  action: GameAction,
  map: GameMap,
): { ok: true; state: GameState } | { ok: false; error: RuleError } {
  try {
    return { ok: true, state: applyAction(state, action, map) };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, error };
    throw error;
  }
}

/** Acciones legales "de menú" para el jugador actual (dirige la interfaz y la IA). */
export function legalActionTypes(state: GameState, playerId: PlayerId): GameAction['type'][] {
  if (state.phase === 'game-over') return [];
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) return ['surrender'];
  const player = playerById(state, playerId);
  if (!player) return [];

  switch (state.phase) {
    case 'setup-claim':
    case 'setup-deploy':
      return ['claim'];
    case 'reinforce': {
      const types: GameAction['type'][] = ['deploy', 'surrender'];
      if ((state.placedThisTurn ?? []).length > 0) types.push('undo-deploy');
      if (player.cards.length >= 3) types.push('trade');
      if (state.config.advancedUnits && canUpgradeSomething(state, playerId)) types.push('upgrade');
      if (player.reserve === 0) types.push('end-phase');
      return types;
    }
    case 'attack':
      return state.pendingOccupation ? ['occupy'] : ['attack', 'end-phase', 'surrender'];
    case 'fortify':
      return fortifiesDone(state) >= fortifyLimit(state, playerId)
        ? ['end-phase', 'surrender']
        : ['fortify', 'end-phase', 'surrender'];
    default:
      return [];
  }
}

/** ¿El jugador está obligado a canjear? (5 o más cartas en mano) */
export function mustTrade(player: PlayerState): boolean {
  return player.cards.length >= 5;
}

/** Vecinos enemigos de un territorio, útil para la interfaz. */
export function enemyNeighbours(
  state: GameState,
  map: GameMap,
  territoryId: TerritoryId,
): TerritoryId[] {
  const owner = state.territories[territoryId]?.ownerId;
  return adjacencyOf(map, territoryId).filter((id) => state.territories[id]?.ownerId !== owner);
}
