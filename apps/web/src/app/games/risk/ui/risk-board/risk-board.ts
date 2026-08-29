import {
  AfterViewChecked,
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
import { GameMap, GameState, TerritoryId } from '@devweb/shared/engine/types';
import { RenderedMap, RenderedTerritory, renderMap } from '@devweb/shared/engine/board-render';
import { conquestOdds } from '@devweb/shared/engine/combat';
import {
  ApproachKind,
  approachOf,
  battleRulesFor,
  TerrainMeta,
  TERRAINS,
  TERRAIN_META,
} from '@devweb/shared/engine/terrain';
import { UNIT_KINDS, UNIT_META, UnitMeta } from '@devweb/shared/engine/units';

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

/** Una ficha de tropa especializada, ya colocada en su sitio. */
export interface TerritoryUnitView {
  x: number;
  glyph: string;
  color: string;
}

/** Un territorio con todo lo que necesita la plantilla, ya calculado. */
export interface TerritoryView {
  id: TerritoryId;
  path: string;
  continentColor: string;
  nameLines: readonly string[];
  badgeTransform: string;
  fill: string;
  armies: number;
  classes: Record<string, boolean>;
  mine: boolean;
  spotlit: boolean;
  terrainGlyph: string | null;
  terrainTint: string;
  units: TerritoryUnitView[];
}

/** De qué depende lo que se ve. Si nada de esto cambia, no hay que repintar. */
interface ViewInputs {
  rendered: RenderedMap | null;
  state: GameState | null;
  selected: TerritoryId | null;
  selectable: readonly TerritoryId[];
  targets: readonly TerritoryId[];
  spotlight: TerritoryId | null;
  hovered: TerritoryId | null;
  myPlayerId: string;
  showTerrain: boolean;
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
export class RiskBoard implements AfterViewChecked, OnDestroy {
  /**
   * El cartel del ratón se coloca después de pintarlo.
   *
   * Hasta que Angular no lo ha dibujado no se puede medir, y sin medirlo no se
   * sabe si cabe encima del país o hay que ponerlo debajo. Al arrastrar el mapa
   * lo recoloca `paintView`, que es quien sabe que la vista se ha movido.
   */
  ngAfterViewChecked(): void {
    this.placeOverTerritory(this.tooltipRef?.nativeElement, this.hovered);
  }

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

  /**
   * Un trozo de pantalla que lo anclado no debe tapar.
   *
   * Lo pone la sala con su bloque de fase. El tablero no sabe qué es ni por qué
   * importa: sólo que ahí no se pinta encima.
   */
  @Input() avoid: HTMLElement | null = null;
  @Input() selected: TerritoryId | null = null;
  @Input() selectable: readonly TerritoryId[] = [];
  @Input() targets: readonly TerritoryId[] = [];
  @Input() myPlayerId = '';
  /** Territorio resaltado por el chat o por la IA. */
  @Input() spotlight: TerritoryId | null = null;
  @Input() showNames = true;
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

  /**
   * El SVG, y con él los gestos.
   *
   * Se engancha desde el propio `@ViewChild` y no desde `ngAfterViewInit`,
   * porque el mapa vive dentro de un `*ngIf` y puede aparecer más tarde. Con el
   * enganche en un momento fijo, si el SVG no estaba dibujado todavía los
   * oyentes no se ponían NUNCA, y el síntoma era desconcertante: el botón de
   * acercar funcionaba —pasa por Angular— pero la rueda no, y arrastrar sobre
   * un territorio colocaba tropas en cadena en vez de mover el mapa.
   */
  @ViewChild('svg') set svgElement(ref: ElementRef<SVGSVGElement> | undefined) {
    if (this.svgRef?.nativeElement === ref?.nativeElement) return;
    this.detachGestures();
    this.svgRef = ref;
    this.attachGestures();
    // Con el SVG ya medido se puede saber cuánto hay que acercar para llenar la
    // pantalla. Antes de que exista, `resetView` no tiene nada que medir.
    if (ref) this.resetView();
  }
  svgRef: ElementRef<SVGSVGElement> | undefined;

  /** El grupo que se mueve. Se le escribe el `transform` a mano. */
  @ViewChild('viewport') set viewportElement(ref: ElementRef<SVGGElement> | undefined) {
    this.viewportRef = ref;
    this.paintView();
  }
  viewportRef: ElementRef<SVGGElement> | undefined;
  /** Cartel del territorio bajo el ratón. Se cuelga de su país, no de una esquina. */
  @ViewChild('tooltipCard') tooltipRef: ElementRef<HTMLElement> | undefined;
  /** Hueco flotante donde la sala cuelga sus controles de contexto. */
  @ViewChild('anchorSlot') anchorSlotRef?: ElementRef<HTMLElement>;

  /**
   * Territorio al que se pega lo que la sala proyecte dentro del tablero.
   *
   * Existe porque el control de un ataque tiene que estar donde está mirando el
   * jugador, no en una barra al otro extremo de la pantalla. Y tiene que
   * colocarlo el tablero, no la sala: el mapa se mueve sin pasar por la
   * detección de cambios, así que sólo el tablero sabe cuándo hay que
   * recolocarlo.
   */
  @Input() set anchorAt(value: TerritoryId | null) {
    this._anchorAt = value;
    this.positionAnchor();
  }
  get anchorAt(): TerritoryId | null {
    return this._anchorAt;
  }
  private _anchorAt: TerritoryId | null = null;

  /**
   * Coloca el hueco flotante sobre su territorio.
   *
   * Usa `getScreenCTM()`, que da la transformación completa hasta la pantalla
   * incluyendo `viewBox`, desplazamiento y zoom. Donde no hay maquetación —los
   * tests— devuelve null y el hueco se queda escondido: mejor eso que
   * inventarse una posición.
   */
  /** Cuánto se separa de la ficha de ejércitos, para no taparle el número. */
  private readonly ANCHOR_GAP = 26;
  /** Margen mínimo con el borde de la pantalla. */
  private readonly ANCHOR_MARGIN = 8;

  private positionAnchor(): void {
    this.placeOverTerritory(this.anchorSlotRef?.nativeElement, this._anchorAt);
    // El cartel del ratón también se pega a su país: vivía en la esquina de
    // arriba a la izquierda, que ahora es del bloque de fase, y se solapaban.
    this.placeOverTerritory(this.tooltipRef?.nativeElement, this.hovered);
  }

  /**
   * Cuelga un elemento del territorio que le toque.
   *
   * Encima si cabe y debajo si no, y siempre dentro de la pantalla. Sin lo
   * primero, apuntar a un país de la fila de arriba manda la tarjeta fuera de
   * la vista; sin lo segundo, un país del borde la saca por el lado.
   */
  private placeOverTerritory(el: HTMLElement | undefined, id: TerritoryId | null): void {
    if (!el) return;
    const point = this.screenPointOf(id);
    if (!point) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';

    const box = this.svgRef?.nativeElement.getBoundingClientRect();
    const card = el.getBoundingClientRect();
    const margin = this.ANCHOR_MARGIN;

    let top = point.y - card.height - this.ANCHOR_GAP;
    if (top < margin) top = point.y + this.ANCHOR_GAP;

    let left = point.x - card.width / 2;
    if (box) {
      left = Math.min(Math.max(margin, left), Math.max(margin, box.width - card.width - margin));
      top = Math.min(top, Math.max(margin, box.height - card.height - margin));
      top = this.pushBelowObstacle(left, top, card, box);
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  /**
   * Baja la tarjeta si fuera a taparle la cara al bloque de fase.
   *
   * En una pantalla ancha nunca se tocan; en un móvil de 390 px el bloque llega
   * hasta la mitad de la altura, y una tarjeta anclada a un territorio de
   * arriba aterrizaba encima de la ronda, la fase y el turno a la vez. Sólo
   * baja si de verdad se solapan: empujarla siempre la alejaría del territorio
   * sin motivo.
   */
  private pushBelowObstacle(left: number, top: number, card: DOMRect, box: DOMRect): number {
    const estorbo = this.avoid?.getBoundingClientRect();
    if (!estorbo) return top;

    const izquierda = box.left + left;
    const arriba = box.top + top;
    const seTocan =
      izquierda < estorbo.right &&
      estorbo.left < izquierda + card.width &&
      arriba < estorbo.bottom &&
      estorbo.top < arriba + card.height;
    if (!seTocan) return top;

    const debajo = estorbo.bottom - box.top + this.ANCHOR_MARGIN;
    return Math.min(debajo, Math.max(this.ANCHOR_MARGIN, box.height - card.height));
  }

  private screenPointOf(id: TerritoryId | null): { x: number; y: number } | null {
    if (!id) return null;
    const territory = this.rendered?.byId[id];
    const viewport = this.viewportRef?.nativeElement;
    const svg = this.svgRef?.nativeElement;
    if (!territory || !viewport || !svg) return null;
    const ctm = viewport.getScreenCTM?.();
    const box = svg.getBoundingClientRect?.();
    if (!ctm || !box) return null;
    const x = ctm.a * territory.label.x + ctm.c * territory.label.y + ctm.e;
    const y = ctm.b * territory.label.x + ctm.d * territory.label.y + ctm.f;
    return { x: x - box.left, y: y - box.top };
  }

  /**
   * Los gestos del mapa se enganchan a mano, NO en la plantilla.
   *
   * Un `(pointermove)` en la plantilla ensucia la vista en cada píxel que se
   * mueve el dedo, y eso repinta el mapa entero: con el mapa del mundo son
   * cuarenta y dos territorios recalculando color, tropas, clases y terreno
   * cientos de veces por gesto. Ése era el tirón.
   *
   * Enganchados a mano, Angular no se entera de que el mapa se mueve, que es lo
   * correcto: desplazar la vista no cambia ningún dato del juego. El
   * `transform` se escribe directamente sobre el SVG.
   *
   * Los toques sobre un territorio SÍ siguen en la plantilla: ésos cambian la
   * partida y tienen que repintar.
   */
  private attachGestures(): void {
    const svg = this.svgRef?.nativeElement;
    if (!svg) return;
    svg.addEventListener('pointerdown', this.onPointerDown);
    svg.addEventListener('pointermove', this.onPointerMove);
    svg.addEventListener('pointerup', this.onPointerUp);
    // Un dedo que el sistema se lleva —una llamada, un gesto del sistema— no
    // manda . Sin esto, el mapa se queda creyendo que sigue apoyado.
    svg.addEventListener('pointercancel', this.onPointerUp);
    svg.addEventListener('pointerleave', this.onPointerLeave);
    // `passive: false` porque estos tres llaman a `preventDefault()`.
    svg.addEventListener('wheel', this.onWheel, { passive: false });
    svg.addEventListener('touchstart', this.onTouchStart, { passive: false });
    svg.addEventListener('touchmove', this.onTouchMove, { passive: false });
    svg.addEventListener('touchend', this.onTouchEnd);
    this.paintView();
  }

  private detachGestures(): void {
    const svg = this.svgRef?.nativeElement;
    if (!svg) return;
    svg.removeEventListener('pointerdown', this.onPointerDown);
    svg.removeEventListener('pointermove', this.onPointerMove);
    svg.removeEventListener('pointerup', this.onPointerUp);
    svg.removeEventListener('pointercancel', this.onPointerUp);
    svg.removeEventListener('pointerleave', this.onPointerLeave);
    svg.removeEventListener('wheel', this.onWheel);
    svg.removeEventListener('touchstart', this.onTouchStart);
    svg.removeEventListener('touchmove', this.onTouchMove);
    svg.removeEventListener('touchend', this.onTouchEnd);
  }

  /**
   * Lleva la vista al SVG sin pasar por Angular.
   *
   * Es una sola escritura de atributo, así que se hace en el momento: meterla
   * en un `requestAnimationFrame` añadiría maquinaria para ahorrar algo que no
   * cuesta nada, y el navegador ya entrega los `pointermove` a ritmo de
   * fotograma.
   */
  private paintView(): void {
    this.viewportRef?.nativeElement.setAttribute('transform', this.transform);
    // Lo que cuelga de un territorio se mueve con él. Si no, al arrastrar el
    // mapa el control se quedaría flotando sobre otro país.
    this.positionAnchor();
  }

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
  /** Dedo abajo sobre el mapa; todavía no se sabe si es toque o arrastre. */
  private panArmed = false;
  /** Ya ha superado el margen: esto es un arrastre. */
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private pinchDistance = 0;

  get transform(): string {
    return `translate(${this.panX} ${this.panY}) scale(${this.zoom})`;
  }

  /**
   * Cuánto se deja acercar la vista de entrada para llenar la pantalla.
   *
   * Con `xMidYMid meet` el mapa se encoge hasta caber entero, y en un móvil
   * vertical eso deja el tablero en una franja pequeña en medio de una pantalla
   * negra: las fichas salen diminutas y no se lee ni un número. Entrar llenando
   * es lo que hace cualquier mapa en un móvil. El tope existe para que en un
   * teléfono muy alargado no se entre mirando tres países.
   */
  readonly MAX_ZOOM_INICIAL = 2.2;

  resetView(): void {
    this.zoom = this.zoomParaLlenar();
    this.panX = 0;
    this.panY = 0;
    this.centrarVista();
    this.paintView();
  }

  /**
   * Lo que hay que acercar para que el mapa cubra la pantalla en vez de caber
   * dentro. Uno si ya la llena, que es el caso de una pantalla ancha.
   */
  private zoomParaLlenar(): number {
    const caja = this.svgRef?.nativeElement.getBoundingClientRect();
    const viewBox = this.rendered?.viewBox?.split(/[\s,]+/).map(Number);
    if (!caja || !viewBox || viewBox.length !== 4 || !caja.width || !caja.height) return 1;
    const [, , ancho, alto] = viewBox as [number, number, number, number];
    if (!ancho || !alto) return 1;
    const cabe = Math.min(caja.width / ancho, caja.height / alto);
    const cubre = Math.max(caja.width / ancho, caja.height / alto);
    if (!cabe) return 1;
    return Math.min(this.MAX_ZOOM_INICIAL, Math.max(1, cubre / cabe));
  }

  /** Deja el centro del mapa en el centro de la pantalla tras acercar. */
  private centrarVista(): void {
    const viewBox = this.rendered?.viewBox?.split(/[\s,]+/).map(Number);
    if (!viewBox || viewBox.length !== 4) return;
    const [x, y, ancho, alto] = viewBox as [number, number, number, number];
    const centroX = x + ancho / 2;
    const centroY = y + alto / 2;
    this.panX = centroX - centroX * this.zoom;
    this.panY = centroY - centroY * this.zoom;
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

  /**
   * Conjuntos en lugar de `includes()`.
   *
   * Preguntar por los cuarenta y dos territorios recorriendo un array los
   * cuarenta y dos convierte el pintado en cuadrático. El conjunto se rehace
   * sólo cuando la sala manda una lista distinta, no en cada consulta.
   */
  private selectableSet = new Set<TerritoryId>();
  private selectableFrom: readonly TerritoryId[] | null = null;
  private targetsSet = new Set<TerritoryId>();
  private targetsFrom: readonly TerritoryId[] | null = null;

  isSelectable(id: TerritoryId): boolean {
    if (this.selectableFrom !== this.selectable) {
      this.selectableFrom = this.selectable;
      this.selectableSet = new Set(this.selectable);
    }
    return this.selectableSet.has(id);
  }

  isTarget(id: TerritoryId): boolean {
    if (this.targetsFrom !== this.targets) {
      this.targetsFrom = this.targets;
      this.targetsSet = new Set(this.targets);
    }
    return this.targetsSet.has(id);
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

  private viewsCache: TerritoryView[] = [];
  private viewsFrom: ViewInputs | null = null;

  /**
   * Todo lo que hay que saber para pintar un territorio, ya calculado.
   *
   * La plantilla NO puede llamar a funciones por territorio: son ocho llamadas
   * por cada uno y por cada ciclo de detección de cambios, y una de ellas
   * construye un objeto nuevo que obliga a `ngClass` a comparar siempre. Con el
   * mapa del mundo, pasar el ratón por encima costaba cientos de llamadas.
   *
   * Se recalcula sólo cuando cambia algo que se ve, y se compara por identidad
   * para que funcione tanto si la sala pasa las entradas por `setInput` como si
   * se asignan a pelo. Mientras nada cambie devuelve el mismo array, así que
   * `*ngFor` tampoco rehace nada.
   */
  get views(): TerritoryView[] {
    const now: ViewInputs = {
      rendered: this.rendered,
      state: this._state,
      selected: this.selected,
      selectable: this.selectable,
      targets: this.targets,
      spotlight: this.spotlight,
      hovered: this.hovered,
      myPlayerId: this.myPlayerId,
      showTerrain: this._showTerrain,
    };
    const before = this.viewsFrom;
    if (before && (Object.keys(now) as (keyof ViewInputs)[]).every((k) => before[k] === now[k])) {
      return this.viewsCache;
    }
    this.viewsFrom = now;
    this.viewsCache = this.buildViews();
    return this.viewsCache;
  }

  private buildViews(): TerritoryView[] {
    const rendered = this.rendered;
    if (!rendered) return [];
    return rendered.territories.map((territory) => {
      const units = this.unitsOf(territory.id);
      return {
        id: territory.id,
        path: territory.path,
        continentColor: territory.continentColor,
        nameLines: territory.nameLines,
        badgeTransform: `translate(${territory.label.x} ${territory.label.y})`,
        fill: this.ownerColorOf(territory.id),
        armies: this.armiesOf(territory.id),
        classes: this.classesFor(territory),
        mine: this.isMine(territory.id),
        spotlit: this.spotlight === territory.id,
        terrainGlyph: this.terrainGlyphOf(territory),
        terrainTint: this.terrainTintOf(territory),
        units: units.map((meta, index) => ({
          x: this.unitOffsetX(index, units.length),
          glyph: meta.glyph,
          color: meta.color,
        })),
      };
    });
  }

  trackView = (_: number, view: TerritoryView) => view.id;
  trackUnitView = (index: number, unit: TerritoryUnitView) => `${index}:${unit.glyph}`;

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

  /** Cuánto hay que mantener el dedo para que salga la ficha informativa. */
  readonly HOLD_INFO_MS = 500;

  /** Toque en curso: dónde empezó y si ya se ha ido de paseo. */
  private pendingTap: { id: TerritoryId; x: number; y: number; moved: boolean } | null = null;
  /**
   * Qué hizo el último gesto de puntero: si emitió, o si fue un arrastre.
   *
   * Lo usa el respaldo del clic para no duplicar ni colar un arrastre.
   */
  private lastGesture: 'emitted' | 'dragged' | 'none' = 'none';
  private infoTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.stopInfo();
    this.detachGestures();
  }

  onTerritoryPointerDown(id: TerritoryId, event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.pendingTap = { id, x: event.clientX, y: event.clientY, moved: false };
    this.startInfo(id);
  }

  onTerritoryPointerUp(id: TerritoryId, event: PointerEvent): void {
    this.stopInfo();
    // El `stopPropagation()` de abajo impide que el mapa se entere de que se ha
    // levantado el dedo, así que hay que desarmarlo aquí. Si no, el mapa cree
    // que sigue habiendo un dedo apoyado y el siguiente movimiento del ratón lo
    // arrastra sin que nadie haya pulsado.
    this.panArmed = false;
    this.dragging = false;
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (!tap || tap.id !== id || tap.moved) {
      this.lastGesture = tap?.moved ? 'dragged' : 'none';
      return;
    }
    this.lastGesture = 'emitted';
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
      this.stopInfo();
    }
  }

  /**
   * El clic del navegador, como RESPALDO del gesto de puntero.
   *
   * Manda `onTerritoryPointerUp`, que es quien sabe distinguir un toque de un
   * arrastre y quien permite colocar en cadena. Pero probando en el navegador
   * de verdad hubo casos en que ese `pointerup` no llegaba al grupo del SVG y
   * el mapa se quedaba mudo, así que el clic de toda la vida cierra el hueco.
   *
   * No puede duplicar: si el gesto ya emitió, éste calla. Y si el gesto fue un
   * arrastre, calla también, que es justo lo que había que evitar en el móvil.
   */
  onTerritoryClick(id: TerritoryId, event: Event): void {
    event.stopPropagation();
    const gesture = this.lastGesture;
    this.lastGesture = 'none';
    if (gesture !== 'none') return;
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

  onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoomAround(factor, event.clientX, event.clientY);
  };

  /**
   * Pasa un punto de la pantalla al sistema de coordenadas del mapa.
   *
   * Hace falta porque `panX`/`panY` viven en unidades del `viewBox` y lo que
   * llega de un dedo o de la rueda son píxeles de pantalla. Con
   * `preserveAspectRatio` el mapa se escala y se centra, así que entre los dos
   * sistemas hay un factor Y unas bandas: mezclarlos hacía que al acercar el
   * mapa se fuera hacia arriba o hacia abajo en vez de quedarse donde estabas
   * mirando. Medido: 81 píxeles de desvío vertical en un móvil.
   */
  private toMapSpace(clientX: number, clientY: number): { x: number; y: number } | null {
    const ctm = this.svgRef?.nativeElement.getScreenCTM?.();
    if (!ctm) return null;
    const inversa = ctm.inverse();
    return {
      x: inversa.a * clientX + inversa.c * clientY + inversa.e,
      y: inversa.b * clientX + inversa.d * clientY + inversa.f,
    };
  }

  /** Acerca o aleja dejando quieto el punto de pantalla que se le indique. */
  private zoomAround(factor: number, clientX: number, clientY: number): void {
    const punto = this.toMapSpace(clientX, clientY);
    if (!punto) {
      // Sin maquetación no hay forma de saber dónde está ese punto; se acerca
      // sobre el centro del mapa, que es lo menos sorprendente.
      this.applyZoom(factor, this.panX, this.panY);
      return;
    }
    this.applyZoom(factor, punto.x, punto.y);
  }

  /** El origen va en coordenadas del mapa, no de la pantalla. */
  private applyZoom(factor: number, originX: number, originY: number): void {
    const next = Math.min(4, Math.max(0.6, this.zoom * factor));
    const applied = next / this.zoom;
    this.panX = originX - (originX - this.panX) * applied;
    this.panY = originY - (originY - this.panY) * applied;
    this.zoom = next;
    this.paintView();
  }

  /** Los botones acercan sobre el centro de lo que se está viendo. */
  zoomIn(): void {
    this.zoomOnCentre(1.2);
  }

  zoomOut(): void {
    this.zoomOnCentre(1 / 1.2);
  }

  private zoomOnCentre(factor: number): void {
    const caja = this.svgRef?.nativeElement.getBoundingClientRect();
    if (!caja) return this.applyZoom(factor, this.panX, this.panY);
    this.zoomAround(factor, caja.left + caja.width / 2, caja.top + caja.height / 2);
  }

  /**
   * Dedos apoyados ahora mismo.
   *
   * Un ratón manda un puntero y nunca dos; un móvil manda uno por dedo. Sin
   * llevar la cuenta, el segundo dedo de un pellizco reiniciaba el punto de
   * arrastre y el mapa daba un salto lateral en mitad del zoom.
   */
  private activePointers = new Set<number>();

  onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.activePointers.add(event.pointerId);

    // Con dos dedos manda el pellizco: desplazar y acercar a la vez no es un
    // gesto, es una pelea.
    if (this.activePointers.size > 1) {
      this.panArmed = false;
      this.dragging = false;
      this.pendingTap = null;
      this.stopInfo();
      return;
    }

    // Armado, todavía no arrastrando: hasta que el dedo no se aleja de verdad
    // esto puede acabar siendo un toque.
    this.panArmed = true;
    this.dragging = false;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
  };

  onPointerMove = (event: PointerEvent): void => {
    if (this.activePointers.size > 1) return;
    // Antes del `if`: el toque hay que seguirlo aunque no se esté arrastrando
    // el mapa, porque el dedo se mueve igual.
    this.trackTapMovement(event);
    if (!this.panArmed) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    if (!this.dragging) {
      // El mismo margen que el toque. Sin él, el mapa se movía bajo el dedo
      // mientras intentabas pulsar un territorio: pulsar y desplazar eran el
      // mismo gesto y ninguno de los dos salía bien.
      if (Math.hypot(dx, dy) <= this.TAP_MAX_MOVE) return;
      this.dragging = true;

      // La captura se pide AQUÍ y no al apoyar el dedo, y la diferencia no es
      // de estilo: capturando desde el `pointerdown`, tanto el `pointerup` como
      // el `click` se reasignan al SVG y no llegan nunca al territorio, así que
      // tocar un país dejaba de hacer absolutamente nada con el ratón. Cuando
      // ya se está arrastrando no hay toque que estropear, y sí hace falta para
      // que el gesto sobreviva al borde de la pantalla.
      try {
        this.svgRef?.nativeElement.setPointerCapture(event.pointerId);
      } catch {
        // Un navegador que no lo permita no es motivo para no arrastrar.
      }
    }
    this.panX = this.panStartX + dx;
    this.panY = this.panStartY + dy;
    this.paintView();
  };

  onPointerUp = (event?: PointerEvent): void => {
    if (event) this.activePointers.delete(event.pointerId);
    else this.activePointers.clear();
    this.stopInfo();
    this.panArmed = false;
    this.dragging = false;
    this.pendingTap = null;
  };

  /**
   * El puntero se sale del mapa.
   *
   * Sólo apaga el cartel flotante: NO corta el gesto. Al capturar el puntero
   * para que un arrastre sobreviva al borde de la pantalla, el navegador lanza
   * un `pointerleave` sobre el SVG en cuanto reasigna el destino del evento; si
   * aquí se diera el gesto por terminado, arrastrar dejaría de mover el mapa y
   * un toque corto no llegaría a colocar nada. El gesto lo cierra `pointerup`,
   * que con la captura llega siempre.
   *
   * Aquí sí hace falta avisar a Angular: apagar el cartel es un cambio que se
   * ve.
   */
  onPointerLeave = (): void => {
    if (this.hovered === null) return;
    this.onTerritoryLeave();
    this.cdr.markForCheck();
  };

  onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 2) {
      this.pinchDistance = touchDistance(event);
    }
  };

  onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 2 || this.pinchDistance === 0) return;
    event.preventDefault();
    const distance = touchDistance(event);
    const factor = distance / this.pinchDistance;
    this.pinchDistance = distance;
    // El punto entre los dos dedos, en coordenadas de pantalla: `zoomAround`
    // ya se encarga de pasarlo al sistema del mapa. Antes se restaba a mano la
    // caja de `event.target` —el país donde empezó el pellizco— y el mapa se
    // iba de lado al acercar.
    this.zoomAround(
      factor,
      (event.touches[0].clientX + event.touches[1].clientX) / 2,
      (event.touches[0].clientY + event.touches[1].clientY) / 2,
    );
  };

  onTouchEnd = (): void => {
    this.pinchDistance = 0;
  };

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
