import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameMap, GameState, TerritoryId } from '../../engine/types';
import { RenderedMap, RenderedTerritory, renderMap } from '../../engine/board-render';
import { conquestOdds } from '../../engine/combat';
import {
  ApproachKind,
  approachOf,
  battleRulesFor,
  TerrainMeta,
  TERRAINS,
  TERRAIN_META,
} from '../../engine/terrain';
import { UNIT_KINDS, UNIT_META, UnitMeta } from '../../engine/units';

export interface TerritoryTooltip {
  name: string;
  armies: number;
  owner: string;
  color: string;
  odds: number | null;
  /** Solo en modo avanzado. */
  terrain: TerrainMeta | null;
  /** Cómo llegaría el ataque que se está apuntando, si se está apuntando uno. */
  approach: ApproachKind | null;
  /** Desglose del combate apuntado, ya en palabras. */
  matchup: string[];
}

/**
 * Tablero: dibuja el mapa en SVG y recoge los clics.
 *
 * No sabe nada de reglas. Recibe el estado y un par de conjuntos (qué está
 * seleccionado y qué se puede pulsar) y se limita a pintarlo bonito.
 */
@Component({
  selector: 'app-risk-board',
  imports: [CommonModule],
  templateUrl: './risk-board.html',
  styleUrl: './risk-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskBoard implements OnDestroy {
  @Input({ required: true }) set map(value: GameMap) {
    this._map = value;
    this.rendered = renderMap(value);
    this.resetView();
  }
  get map(): GameMap {
    return this._map!;
  }

  @Input() set state(value: GameState | null) {
    this._state = value;
    this.indexUnits();
    this.updateTooltip();
  }
  get state(): GameState | null {
    return this._state;
  }
  private _state: GameState | null = null;
  @Input() selected: TerritoryId | null = null;
  @Input() selectable: readonly TerritoryId[] = [];
  @Input() targets: readonly TerritoryId[] = [];
  @Input() myPlayerId = '';
  /** Territorio resaltado por el chat o por la IA. */
  @Input() spotlight: TerritoryId | null = null;
  @Input() showNames = true;
  /**
   * Repetir mientras se mantiene pulsado.
   *
   * Lo enciende la sala sólo en la fase de refuerzos: es el gesto de los
   * selectores de cantidad de toda la vida, y evita dar treinta toques para
   * colocar treinta tropas. El tablero no sabe qué fase es; recibe el
   * interruptor y ya está.
   */
  @Input() repeatOnHold = false;
  /** Modo avanzado: pinta la orografía y la explica en el cartel flotante. */
  @Input() set showTerrain(value: boolean) {
    this._showTerrain = value;
    this.updateTooltip();
  }
  get showTerrain(): boolean {
    return this._showTerrain;
  }
  private _showTerrain = false;

  /**
   * Tropas de cada territorio, indexadas al cambiar el estado.
   *
   * NO se calcula desde la plantilla: devolver un array nuevo en cada ciclo de
   * detección de cambios deja la vista permanentemente sucia. Se recalcula solo
   * cuando el estado cambia, y si un territorio no cambia se reutiliza el mismo
   * array, así que `*ngFor` no rehace nada.
   */
  unitsByTerritory: Record<TerritoryId, UnitMeta[]> = {};
  private unitSignatures: Record<TerritoryId, string> = {};

  /** Terrenos que se marcan en el tablero (la llanura es el caso normal). */
  readonly markedTerrains = TERRAINS.map((terrain) => TERRAIN_META[terrain]).filter(
    (meta) => meta.id !== 'llanura',
  );

  /**
   * En modo zoneless nada repinta solo al vencer un temporizador, y aquí todo
   * lo que pasa mientras el dedo está quieto viene de un temporizador.
   */
  constructor(private cdr: ChangeDetectorRef) {}

  @Output() territoryClick = new EventEmitter<TerritoryId>();
  @Output() territoryHover = new EventEmitter<TerritoryId | null>();

  @ViewChild('svg') svgRef?: ElementRef<SVGSVGElement>;

  private _map: GameMap | null = null;
  rendered: RenderedMap | null = null;

  hovered: TerritoryId | null = null;
  /**
   * El cartel flotante se calcula al cambiar el hover, NO en cada ciclo de
   * detección de cambios: si el template llamara a una función que devuelve un
   * objeto nuevo cada vez, la vista quedaría permanentemente sucia y Angular
   * entraría en un bucle de refresco infinito (y con ella el navegador).
   */
  tooltip: TerritoryTooltip | null = null;

  // Vista (zoom y desplazamiento)
  zoom = 1;
  panX = 0;
  panY = 0;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private pinchDistance = 0;

  get transform(): string {
    return `translate(${this.panX} ${this.panY}) scale(${this.zoom})`;
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // ===== ESTADO DE CADA TERRITORIO =====

  ownerColorOf(id: TerritoryId): string {
    const ownerId = this.state?.territories[id]?.ownerId;
    if (!ownerId) return '#2a2f35';
    return this.state?.players.find((p) => p.id === ownerId)?.color ?? '#2a2f35';
  }

  armiesOf(id: TerritoryId): number {
    return this.state?.territories[id]?.armies ?? 0;
  }

  isMine(id: TerritoryId): boolean {
    return !!this.myPlayerId && this.state?.territories[id]?.ownerId === this.myPlayerId;
  }

  isSelectable(id: TerritoryId): boolean {
    return this.selectable.includes(id);
  }

  isTarget(id: TerritoryId): boolean {
    return this.targets.includes(id);
  }

  classesFor(territory: RenderedTerritory): Record<string, boolean> {
    return {
      mine: this.isMine(territory.id),
      selected: this.selected === territory.id,
      selectable: this.isSelectable(territory.id),
      target: this.isTarget(territory.id),
      spotlight: this.spotlight === territory.id,
      hovered: this.hovered === territory.id,
      dimmed:
        (this.selectable.length > 0 || this.targets.length > 0) &&
        !this.isSelectable(territory.id) &&
        !this.isTarget(territory.id) &&
        this.selected !== territory.id,
    };
  }

  /** Recalcula el cartel flotante. Se llama en los pocos sitios que lo cambian. */
  private updateTooltip(): void {
    if (!this.hovered || !this.rendered) {
      this.tooltip = null;
      return;
    }
    const territory = this.rendered.byId[this.hovered];
    if (!territory) {
      this.tooltip = null;
      return;
    }
    const ownerId = this.state?.territories[this.hovered]?.ownerId;
    const owner = this.state?.players.find((p) => p.id === ownerId);
    const aiming = this.isAiming(this.hovered);
    this.tooltip = {
      name: territory.name,
      armies: this.armiesOf(this.hovered),
      owner: owner?.name ?? 'Sin dueño',
      color: owner?.color ?? '#888',
      odds: this.hoveredOdds(),
      terrain: this.showTerrain ? TERRAIN_META[territory.terrain] : null,
      approach:
        this.showTerrain && aiming && this._map
          ? approachOf(this._map, this.selected!, this.hovered, this.originState())
          : null,
      matchup: aiming ? this.matchupLines() : [],
    };
  }

  private originState() {
    return this.selected ? this.state?.territories[this.selected] : undefined;
  }

  /**
   * Traduce a palabras el combate concreto que se está apuntando.
   *
   * Es lo que hace legible la matriz: con terreno de origen, terreno de destino
   * y tropas de los dos lados sumando a la vez, un número suelto no dice de
   * dónde sale la ventaja.
   */
  private matchupLines(): string[] {
    if (!this._map || !this.selected || !this.hovered) return [];
    const rules = battleRulesFor(
      this._map,
      this.state?.config,
      this.selected,
      this.hovered,
      this.originState(),
      this.state?.territories[this.hovered],
    );
    const lines: string[] = [];
    const mine = describeBonus(rules.attackBonus);
    const theirs = describeBonus(rules.defenceBonus);
    if (rules.attack < 3) lines.push(`Solo ${rules.attack} dados`);
    if (mine) lines.push(`A tu favor: ${mine}`);
    if (theirs) lines.push(`A su favor: ${theirs}`);
    return lines;
  }

  /** ¿El cursor está sobre un objetivo del territorio ya seleccionado? */
  private isAiming(id: TerritoryId): boolean {
    return !!this.selected && this.isTarget(id);
  }

  /**
   * Probabilidad de conquista del ataque que se está apuntando.
   *
   * Usa las mismas reglas que aplicará el motor (terreno incluido): el número
   * que se enseña tiene que ser el de verdad.
   */
  hoveredOdds(): number | null {
    if (!this.selected || !this.hovered) return null;
    if (!this.isTarget(this.hovered)) return null;
    const from = this.state?.territories[this.selected];
    const to = this.state?.territories[this.hovered];
    if (!from || !to || !this._map) return null;
    const rules = battleRulesFor(
      this._map,
      this.state?.config,
      this.selected,
      this.hovered,
      from,
      to,
    );
    return conquestOdds(from.armies, to.armies, rules);
  }

  /** Recalcula el índice de tropas, conservando los arrays que no cambian. */
  private indexUnits(): void {
    const state = this._state;
    if (!state?.config.advancedUnits) {
      this.unitsByTerritory = {};
      this.unitSignatures = {};
      return;
    }
    const next: Record<TerritoryId, UnitMeta[]> = {};
    for (const [id, territory] of Object.entries(state.territories)) {
      const counts = UNIT_KINDS.map((kind) => territory.units?.[kind] ?? 0);
      if (counts.every((count) => count === 0)) {
        delete this.unitSignatures[id];
        continue;
      }
      const signature = counts.join(',');
      if (this.unitSignatures[id] === signature && this.unitsByTerritory[id]) {
        next[id] = this.unitsByTerritory[id];
        continue;
      }
      const metas: UnitMeta[] = [];
      UNIT_KINDS.forEach((kind, index) => {
        for (let i = 0; i < counts[index]; i++) metas.push(UNIT_META[kind]);
      });
      next[id] = metas;
      this.unitSignatures[id] = signature;
    }
    this.unitsByTerritory = next;
  }

  /** Tropas dibujadas en un territorio (array estable entre ciclos). */
  unitsOf(id: TerritoryId): UnitMeta[] {
    return this.unitsByTerritory[id] ?? EMPTY_UNITS;
  }

  trackUnit(index: number, meta: UnitMeta): string {
    return `${index}:${meta.id}`;
  }

  /** Coloca los glifos de tropa en fila centrada sobre la ficha. */
  unitOffsetX(index: number, total: number): number {
    const step = 9;
    return (index - (total - 1) / 2) * step;
  }

  /** Glifo del terreno de un territorio (nada si es llanura o está apagado). */
  terrainGlyphOf(territory: RenderedTerritory): string | null {
    if (!this.showTerrain) return null;
    if (territory.terrain === 'llanura') return null;
    return TERRAIN_META[territory.terrain].glyph;
  }

  terrainTintOf(territory: RenderedTerritory): string {
    return TERRAIN_META[territory.terrain].tint;
  }

  // ===== INTERACCIÓN =====

  /**
   * Cuánto puede moverse un dedo y seguir contando como toque, en píxeles.
   *
   * Sin este umbral, arrastrar el mapa en el móvil termina en un clic sobre el
   * territorio donde levantas el dedo: mueves el mapa y colocas una tropa sin
   * querer. Ocho píxeles es lo que tiembla una mano, no lo que se mueve un
   * gesto.
   */
  readonly TAP_MAX_MOVE = 8;

  /** Cuánto se espera antes de empezar a repetir. */
  readonly HOLD_FIRST_MS = 400;
  /** Lo más rápido que llega a repetir. */
  readonly HOLD_MIN_MS = 60;
  /** Cuánto se recorta el intervalo en cada vuelta. */
  readonly HOLD_STEP_MS = 15;
  /** Cuánto hay que mantener el dedo para que salga la ficha informativa. */
  readonly HOLD_INFO_MS = 500;

  /** Toque en curso: dónde empezó y si ya se ha ido de paseo. */
  private pendingTap: { id: TerritoryId; x: number; y: number; moved: boolean } | null = null;
  private repeatTimer: ReturnType<typeof setTimeout> | null = null;
  private infoTimer: ReturnType<typeof setTimeout> | null = null;

  /** Coloca en cadena, cada vez más rápido, mientras no se suelte. */
  private startRepeat(id: TerritoryId): void {
    this.stopRepeat();
    let delay = 150;
    const tick = () => {
      // Si el dedo se ha ido de paseo esto era un arrastre, no una cadena.
      if (!this.pendingTap || this.pendingTap.moved) return this.stopRepeat();
      this.territoryClick.emit(id);
      this.cdr.markForCheck();
      delay = Math.max(this.HOLD_MIN_MS, delay - this.HOLD_STEP_MS);
      this.repeatTimer = setTimeout(tick, delay);
    };
    this.repeatTimer = setTimeout(tick, this.HOLD_FIRST_MS);
  }

  private stopRepeat(): void {
    if (this.repeatTimer) clearTimeout(this.repeatTimer);
    this.repeatTimer = null;
  }

  /**
   * Ficha informativa al mantener pulsado, cuando no toca colocar.
   *
   * En el móvil no hay ratón, así que el cartel que sale al pasar por encima no
   * aparece nunca. Ésta es su puerta de entrada con el dedo.
   */
  private startInfo(id: TerritoryId): void {
    this.stopInfo();
    this.infoTimer = setTimeout(() => {
      if (!this.pendingTap || this.pendingTap.moved) return;
      this.onTerritoryEnter(id);
      this.cdr.markForCheck();
    }, this.HOLD_INFO_MS);
  }

  private stopInfo(): void {
    if (this.infoTimer) clearTimeout(this.infoTimer);
    this.infoTimer = null;
  }

  ngOnDestroy(): void {
    this.stopRepeat();
    this.stopInfo();
  }

  onTerritoryPointerDown(id: TerritoryId, event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.pendingTap = { id, x: event.clientX, y: event.clientY, moved: false };
    if (this.repeatOnHold) this.startRepeat(id);
    else this.startInfo(id);
  }

  onTerritoryPointerUp(id: TerritoryId, event: PointerEvent): void {
    this.stopRepeat();
    this.stopInfo();
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (!tap || tap.id !== id || tap.moved) return;
    event.stopPropagation();
    this.territoryClick.emit(id);
  }

  /** Marca el toque como arrastre en cuanto se aleja del punto de partida. */
  private trackTapMovement(event: PointerEvent): void {
    const tap = this.pendingTap;
    if (!tap) return;
    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    if (Math.hypot(dx, dy) > this.TAP_MAX_MOVE) {
      tap.moved = true;
      this.stopRepeat();
      this.stopInfo();
    }
  }

  /**
   * El clic del navegador ya no coloca nada: manda `onTerritoryPointerUp`.
   *
   * Se mantiene el manejador sólo para frenar la propagación, porque el `click`
   * llega después del `pointerup` y sin pararlo el SVG lo recogería como si
   * fuera un gesto sobre el fondo.
   */
  onTerritoryClick(_id: TerritoryId, event: Event): void {
    event.stopPropagation();
  }

  onTerritoryEnter(id: TerritoryId): void {
    if (this.hovered === id) return;
    this.hovered = id;
    this.updateTooltip();
    this.territoryHover.emit(id);
  }

  onTerritoryLeave(): void {
    if (this.hovered === null) return;
    this.hovered = null;
    this.updateTooltip();
    this.territoryHover.emit(null);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.applyZoom(factor, event.offsetX, event.offsetY);
  }

  private applyZoom(factor: number, originX: number, originY: number): void {
    const next = Math.min(4, Math.max(0.6, this.zoom * factor));
    const applied = next / this.zoom;
    this.panX = originX - (originX - this.panX) * applied;
    this.panY = originY - (originY - this.panY) * applied;
    this.zoom = next;
  }

  zoomIn(): void {
    const el = this.svgRef?.nativeElement;
    this.applyZoom(1.2, (el?.clientWidth ?? 600) / 2, (el?.clientHeight ?? 400) / 2);
  }

  zoomOut(): void {
    const el = this.svgRef?.nativeElement;
    this.applyZoom(1 / 1.2, (el?.clientWidth ?? 600) / 2, (el?.clientHeight ?? 400) / 2);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
  }

  onPointerMove(event: PointerEvent): void {
    // Antes del `if`: el toque hay que seguirlo aunque no se esté arrastrando
    // el mapa, porque el dedo se mueve igual.
    this.trackTapMovement(event);
    if (!this.dragging) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  onPointerUp(): void {
    this.stopRepeat();
    this.stopInfo();
    this.dragging = false;
    this.pendingTap = null;
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.pinchDistance = touchDistance(event);
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || this.pinchDistance === 0) return;
    event.preventDefault();
    const distance = touchDistance(event);
    const factor = distance / this.pinchDistance;
    this.pinchDistance = distance;
    const rect = (event.target as Element)?.getBoundingClientRect?.();
    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - (rect?.left ?? 0);
    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - (rect?.top ?? 0);
    this.applyZoom(factor, centerX, centerY);
  }

  onTouchEnd(): void {
    this.pinchDistance = 0;
  }

  trackTerritory = (_: number, territory: RenderedTerritory) => territory.id;
  trackRoute = (_: number, route: { from: string; to: string }) => `${route.from}|${route.to}`;
}

function touchDistance(event: TouchEvent): number {
  const [a, b] = [event.touches[0], event.touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** Array compartido para los territorios sin tropas: identidad estable. */
const EMPTY_UNITS: UnitMeta[] = [];

/**
 * Pone en palabras un vector de bonificación por rango.
 *
 * `[1]` es el mejor dado, `[0, 1]` el segundo. Un valor negativo resta.
 */
function describeBonus(bonus: number[] | undefined): string {
  const values = bonus ?? [];
  const names = ['al mejor dado', 'al segundo dado', 'al tercer dado'];
  const parts: string[] = [];
  values.forEach((value, index) => {
    if (value === 0) return;
    const sign = value > 0 ? `+${value}` : `${value}`;
    parts.push(`${sign} ${names[index] ?? `al dado ${index + 1}`}`);
  });
  return parts.join(', ');
}
