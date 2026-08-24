import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameMap, GameState, TerritoryId } from '../../engine/types';
import { RenderedMap, RenderedTerritory, renderMap } from '../../engine/board-render';
import { conquestOdds } from '../../engine/combat';

export interface TerritoryTooltip {
  name: string;
  armies: number;
  owner: string;
  color: string;
  odds: number | null;
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
export class RiskBoard {
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
    this.tooltip = {
      name: territory.name,
      armies: this.armiesOf(this.hovered),
      owner: owner?.name ?? 'Sin dueño',
      color: owner?.color ?? '#888',
      odds: this.hoveredOdds(),
    };
  }

  /** Probabilidad de conquista del ataque que se está apuntando. */
  hoveredOdds(): number | null {
    if (!this.selected || !this.hovered) return null;
    if (!this.isTarget(this.hovered)) return null;
    const from = this.state?.territories[this.selected];
    const to = this.state?.territories[this.hovered];
    if (!from || !to) return null;
    return conquestOdds(from.armies, to.armies);
  }

  // ===== INTERACCIÓN =====

  onTerritoryClick(id: TerritoryId, event: Event): void {
    event.stopPropagation();
    this.territoryClick.emit(id);
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
    if (!this.dragging) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  onPointerUp(): void {
    this.dragging = false;
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
