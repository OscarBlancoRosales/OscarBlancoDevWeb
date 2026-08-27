/**
 * Tipos del dominio de RISK.
 *
 * El motor es 100% puro y determinista: (estado, acción) -> estado.
 * Eso permite tres cosas clave del producto:
 *  - Multijugador sin backend (lockstep: todos los clientes reproducen el mismo log).
 *  - Partidas grabables y reanudables (el log de acciones ES la grabación).
 *  - Tests exhaustivos sin mocks.
 */

import type { Mission } from './missions';

export type TerritoryId = string;
export type ContinentId = string;
export type PlayerId = string;

/** Fases del turno clásico de RISK. */
export type Phase =
  | 'setup-claim' // reparto inicial: cada jugador reclama territorios vacíos
  | 'setup-deploy' // reparto inicial: reparto del resto de ejércitos
  | 'reinforce' // recibir y colocar refuerzos
  | 'attack' // atacar territorios adyacentes
  | 'fortify' // un único movimiento de reagrupación
  | 'game-over';

/** Símbolo de una carta de RISK. */
export type CardSymbol = 'infantry' | 'cavalry' | 'artillery' | 'wildcard';

export interface Card {
  id: string;
  /** Los comodines no tienen territorio asociado. */
  territoryId: TerritoryId | null;
  symbol: CardSymbol;
}

/**
 * Orografía de un territorio. Solo cuenta en modo avanzado; en el clásico todos
 * los territorios pelean igual. Ver `terrain.ts` para el efecto de cada uno.
 */
export type Terrain = 'llanura' | 'bosque' | 'montaña' | 'desierto' | 'costa';

export interface Territory {
  id: TerritoryId;
  name: string;
  continentId: ContinentId;
  /** Adyacencias canónicas (siempre simétricas, validado en tests). */
  adjacent: TerritoryId[];
  /** Silueta del territorio: un `path` SVG ya en coordenadas de tablero. */
  shape: string;
  /** Punto interior donde va la etiqueta, calculado a partir de la silueta. */
  labelAnchor: [number, number];
  /** Orografía. Si no se declara es llanura, que es el combate de siempre. */
  terrain?: Terrain;
}

export interface Continent {
  id: ContinentId;
  name: string;
  bonus: number;
  color: string;
  territoryIds: TerritoryId[];
}

/**
 * Un bando: los jugadores que van juntos y ganan juntos.
 *
 * Es lo que convierte una partida de todos contra todos en una guerra de dos
 * frentes. Dos facciones del mismo bando no pueden atacarse.
 */
export interface SideDef {
  id: string;
  name: string;
  color: string;
}

/** Una facción concreta dentro de un bando: quién es y a quién representa. */
export interface FactionDef {
  id: string;
  name: string;
  /** Bando al que pertenece. */
  side: string;
  color: string;
  /** Quiénes eran, en una línea. */
  blurb: string;
}

/**
 * Escenario histórico: quién controla qué al empezar, y con quién juega cada
 * cual.
 *
 * Un mapa con escenario no reparte el tablero al azar: arranca en una posición
 * concreta, que es lo que hace que la partida cuente una historia y no una
 * conquista abstracta.
 */
export interface Scenario {
  sides: SideDef[];
  factions: FactionDef[];
  /** Quién controla cada territorio al empezar y con cuántos ejércitos. */
  deployment: Record<TerritoryId, { faction: string; armies: number }>;
  /** Texto de cabecera que se enseña en la sala. */
  intro: string;
}

export interface GameMap {
  id: string;
  name: string;
  description: string;
  /** Tamaño del lienzo sobre el que están dibujadas las siluetas. */
  board: { width: number; height: number };
  /**
   * Adyacencias que sobre el dibujo no llegan a tocarse: se pintan como línea
   * de puntos. Casi todas son saltos por mar.
   */
  seaRoutes?: [TerritoryId, TerritoryId][];
  /**
   * De las anteriores, las que en realidad son frontera de tierra.
   *
   * El tablero del RISK une China con los Urales o América Central con EE. UU.
   * Oriental, pero los trozos de mundo que forman esos territorios no llegan a
   * tocarse, así que se dibujan sueltas. Por reglas NO son un desembarco: la
   * orografía no puede depender de un accidente del dibujo.
   */
  landBridges?: [TerritoryId, TerritoryId][];
  territories: Territory[];
  continents: Continent[];
  /** Número máximo de jugadores soportado por el mapa. */
  maxPlayers: number;
  /** Si lo trae, el mapa es un escenario histórico y no se reparte al azar. */
  scenario?: Scenario;
}

export type PlayerKind = 'human' | 'bot';

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: string;
  kind: PlayerKind;
  /** Perfil de personalidad de la IA (solo bots). */
  botProfile?: BotProfile;
  /** uid de Firebase (admins) o token local (invitados) para reservar el asiento. */
  seatToken?: string;
  cards: Card[];
  eliminated: boolean;
  /** Quién lo sacó de la partida. Lo necesita la victoria por objetivos. */
  eliminatedBy?: PlayerId;
  /** Facción que lleva, en un escenario histórico. */
  factionId?: string;
  /** Bando al que pertenece. Los del mismo bando no pueden atacarse. */
  side?: string;
  /** Ejércitos pendientes de colocar en la fase actual. */
  reserve: number;
  /** Ha conquistado al menos un territorio este turno (da derecho a carta). */
  conqueredThisTurn: boolean;
}

export type BotProfile = 'agresivo' | 'cauto' | 'oportunista' | 'expansivo' | 'vengativo';

/**
 * Tipos de tropa del modo avanzado. Ver `units.ts` para qué hace cada una.
 */
export type UnitKind = 'caballeria' | 'blindado' | 'naval' | 'aereo';

/** Cuántas fichas de cada especialidad hay en un territorio. */
export type UnitCounts = Partial<Record<UnitKind, number>>;

export interface TerritoryState {
  ownerId: PlayerId | null;
  /**
   * Fichas totales del territorio, especialistas incluidos.
   *
   * `units` es un DESGLOSE de este número, no un ejército aparte: la infantería
   * es `armies` menos la suma de `units`. Así todas las reglas que cuentan
   * ejércitos (refuerzos, eliminación, victoria, cartas) siguen valiendo tal
   * cual, y el estado no engorda en las partidas clásicas, donde `units` ni
   * existe.
   */
  armies: number;
  units?: UnitCounts;
}

export interface CombatResult {
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
}

export interface GameState {
  mapId: string;
  /** Semilla del RNG: junto al índice de acción da tiradas reproducibles. */
  seed: number;
  players: PlayerState[];
  /** Orden de turno por id de jugador. */
  turnOrder: PlayerId[];
  currentPlayerIndex: number;
  phase: Phase;
  territories: Record<TerritoryId, TerritoryState>;
  /** Mazo de cartas restante (barajado de forma determinista). */
  deck: Card[];
  /** Descarte de canjes. */
  discard: Card[];
  /** Número de canjes ya realizados (escala el valor del siguiente). */
  tradeCount: number;
  /** Contador de acciones aplicadas: alimenta el RNG. */
  actionCount: number;
  /** Turno completo (una vuelta a todos los jugadores). */
  round: number;
  /** Territorio desde el que se conquistó, para el movimiento obligatorio posterior. */
  pendingOccupation: { from: TerritoryId; to: TerritoryId; minArmies: number } | null;
  /**
   * Refuerzos colocados en este turno, en orden.
   *
   * Solo existe durante la fase de refuerzos del turno en curso, para poder
   * deshacer: colocar es fácil de hacer mal y hasta ahora no había vuelta atrás.
   */
  placedThisTurn?: { territoryId: TerritoryId; armies: number }[];
  /** El jugador ya ha fortificado este turno. */
  fortifiedThisTurn: boolean;
  /**
   * Reagrupaciones hechas este turno. Normalmente 0 o 1; la caballería permite
   * una segunda. Se mantiene `fortifiedThisTurn` para no romper las partidas ya
   * grabadas ni los sitios que solo preguntan "¿ya ha fortificado?".
   */
  fortifyCount?: number;
  winnerId: PlayerId | null;
  /**
   * Objetivo de cada jugador, si la mesa juega por objetivos.
   *
   * Se reparten al crear la partida con el RNG sembrado, así que salen iguales
   * en todos los clientes. Son públicos a propósito: ver `missions.ts`.
   */
  missions?: Record<PlayerId, Mission>;
  /** Últimos combates para animaciones e historial. */
  lastCombat: (CombatResult & { from: TerritoryId; to: TerritoryId; attackerId: PlayerId }) | null;
  /** Registro legible de lo que ha pasado (para el chat y el panel de eventos). */
  events: GameEvent[];
  config: GameConfig;
}

/**
 * Versión de las reglas con la que se jugó una partida.
 *
 * Es lo que permite ampliar el juego sin romper nada: los dados salen de un RNG
 * sembrado con (semilla, nº de acción, canal), así que cualquier cambio en
 * CUÁNTAS tiradas se consumen o en cómo se nombran los canales haría que las
 * partidas ya grabadas dejaran de reproducirse igual, y que dos clientes con
 * versiones distintas se desincronizaran en pleno lockstep.
 *
 * Regla: la v1 (RISK clásico) queda congelada. Todo lo que venga después
 * —terreno, tipos de tropa, objetivos— entra como versión nueva, y el motor
 * escoge el comportamiento según este número.
 */
export const RULES_V1 = 1;

/** Versión de reglas de una partida; las salas antiguas no la traen y son v1. */
export function rulesVersionOf(config: { rulesVersion?: number } | null | undefined): number {
  return config?.rulesVersion ?? RULES_V1;
}

export interface GameConfig {
  /** Versión de las reglas. Ver RULES_V1. */
  rulesVersion?: number;
  /** Ejércitos iniciales por jugador (si null se calcula según el número de jugadores). */
  startingArmies: number | null;
  /** Reparto inicial de territorios: manual (reclamar) o automático. */
  autoClaim: boolean;
  /** Progresión del valor de los canjes. */
  tradeProgression: 'classic' | 'fixed';
  /**
   * Tope del valor de un canje.
   *
   * Sin tope, la progresión clásica (4, 6, 8… +5) se dispara en partidas largas:
   * medido en auto-juego, al canje 131 cada trío daba 645 ejércitos, así que un
   * jugador reducido a un solo territorio se rehacía de golpe y era imposible de
   * eliminar. La partida no terminaba nunca.
   */
  maxTradeValue?: number;
  /** Permitir dados de defensa 2 con 2+ ejércitos (regla estándar). */
  maxAttackDice: number;
  maxDefendDice: number;
  /**
   * Modo avanzado: la orografía del mapa modifica el combate.
   *
   * Se congela al empezar la partida, como el resto de la configuración: una
   * grabación antigua se reproduce con el valor con el que se jugó, no con el
   * que esté marcado hoy en la sala.
   */
  advancedTerrain?: boolean;
  /**
   * Modo avanzado: tropas especializadas (caballería, blindados, naval, aérea).
   *
   * Se congela al empezar, igual que el resto de la configuración.
   */
  advancedUnits?: boolean;
  /**
   * Cómo se gana.
   *
   * `conquest` es lo clásico: quedarse con el mapa entero. `objectives` reparte
   * una meta a cada jugador y la partida se decide cuando alguien la cumple,
   * que es lo que hace jugable un tablero de 40 territorios largos.
   */
  victory?: 'conquest' | 'objectives';
}

export interface GameEvent {
  /** Índice de acción que generó el evento. */
  at: number;
  type:
    | 'game-start'
    | 'claim'
    | 'deploy'
    | 'reinforce'
    | 'trade'
    | 'attack'
    | 'conquer'
    | 'occupy'
    | 'fortify'
    | 'card-drawn'
    | 'eliminate'
    | 'phase'
    | 'turn'
    | 'win';
  playerId: PlayerId | null;
  /** Texto ya formateado en español. */
  text: string;
  data?: Record<string, unknown>;
}

// ===== ACCIONES =====

export interface BaseAction {
  playerId: PlayerId;
}

export interface ClaimAction extends BaseAction {
  type: 'claim';
  territoryId: TerritoryId;
}

export interface DeployAction extends BaseAction {
  type: 'deploy';
  territoryId: TerritoryId;
  armies: number;
}

export interface TradeCardsAction extends BaseAction {
  type: 'trade';
  cardIds: [string, string, string];
}

export interface AttackAction extends BaseAction {
  type: 'attack';
  from: TerritoryId;
  to: TerritoryId;
  /** Número de dados del atacante (1..3). */
  dice: number;
}

export interface OccupyAction extends BaseAction {
  type: 'occupy';
  armies: number;
}

export interface FortifyAction extends BaseAction {
  type: 'fortify';
  from: TerritoryId;
  to: TerritoryId;
  armies: number;
}

export interface EndPhaseAction extends BaseAction {
  type: 'end-phase';
}

export interface SurrenderAction extends BaseAction {
  type: 'surrender';
}

/**
 * Convierte una ficha de infantería del territorio en un especialista.
 *
 * No añade fichas: cuesta reserva y cambia de tipo una que ya estaba. Por eso
 * ninguna regla que cuente ejércitos se entera.
 */
export interface UpgradeAction extends BaseAction {
  type: 'upgrade';
  territoryId: TerritoryId;
  unit: UnitKind;
}

/**
 * Devuelve a la reserva los refuerzos colocados en este turno.
 *
 * Es una acción de verdad, no un botón de la interfaz: el log ES la partida, así
 * que deshacer tiene que quedar registrado como todo lo demás para que todos los
 * clientes lleguen al mismo estado.
 */
export interface UndoDeployAction extends BaseAction {
  type: 'undo-deploy';
  /** Si es cierto, devuelve todo lo colocado; si no, solo lo último. */
  all?: boolean;
}

export type GameAction =
  | ClaimAction
  | DeployAction
  | TradeCardsAction
  | AttackAction
  | OccupyAction
  | FortifyAction
  | EndPhaseAction
  | SurrenderAction
  | UpgradeAction
  | UndoDeployAction;

/** Entrada del log persistido en Firebase. */
export interface LoggedAction {
  /** Índice global, garantiza el orden en lockstep. */
  index: number;
  action: GameAction;
  /** Marca temporal en ms (solo informativa, nunca alimenta el motor). */
  ts: number;
}

export class RuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RuleError';
  }
}
