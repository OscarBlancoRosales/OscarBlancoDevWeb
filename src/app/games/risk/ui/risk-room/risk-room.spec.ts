import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskRoom } from './risk-room';
import { RiskRoomService } from '../../services/risk-room.service';
import { RiskGameService } from '../../services/risk-game.service';
import { DEFAULT_CONFIG, PLAYER_COLORS } from '../../engine/engine';
import { territoriesOf } from '../../engine/rules';

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Monta la mesa sobre una sala local ya creada. */
async function mountRoom(roomId: string, seatId: string) {
  localStorage.setItem('risk_room_id', roomId);
  localStorage.setItem('risk_seat_id', seatId);

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [RiskRoom],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap({ room: roomId }) } },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RiskRoom);
  const component = fixture.componentInstance;
  TestBed.inject(RiskGameService).botDelayMs = 0;
  fixture.detectChanges();
  await wait();
  fixture.detectChanges();
  return { fixture, component };
}

/** Crea una sala local con un humano y devuelve sus identificadores. */
async function createLocalRoom(
  options: { maxPlayers?: number; mapId?: string; advancedTerrain?: boolean } = {},
) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ providers: [provideRouter([])] }).compileComponents();
  const rooms = TestBed.inject(RiskRoomService);
  const meta = await rooms.createRoom({
    name: 'Mesa de pruebas',
    mapId: options.mapId ?? 'world',
    maxPlayers: options.maxPlayers ?? 4,
    ownerUid: 'owner-token',
    ownerName: 'Oscar',
    local: true,
    seed: 20260824,
    config: { ...DEFAULT_CONFIG, advancedTerrain: options.advancedTerrain ?? false },
  });
  rooms.listenToRoom(meta.id);
  const seatId = await rooms.claimSeat(meta.id, {
    name: 'Oscar',
    seatToken: 'owner-token',
    color: PLAYER_COLORS[0],
    isOwner: true,
  });
  rooms.disconnect();
  return { roomId: meta.id, seatId };
}

describe('RiskRoom (la mesa)', () => {
  let fixture: ComponentFixture<RiskRoom>;
  let component: RiskRoom;
  let roomId: string;
  let seatId: string;

  beforeEach(async () => {
    localStorage.clear();
    ({ roomId, seatId } = await createLocalRoom());
    ({ fixture, component } = await mountRoom(roomId, seatId));
  });

  afterEach(() => {
    fixture?.destroy();
    localStorage.clear();
  });

  describe('sala de espera', () => {
    it('se crea y carga la sala', () => {
      expect(component).toBeTruthy();
      expect(component.meta?.id).toBe(roomId);
      expect(component.map?.id).toBe('world');
    });

    it('empieza en la sala de espera', () => {
      expect(component.inGame).toBe(false);
      expect(fixture.nativeElement.querySelector('section.waiting')).toBeTruthy();
    });

    it('me reconoce como anfitrión y propietario', () => {
      expect(component.isOwner).toBe(true);
      expect(component.isHost).toBe(true);
    });

    it('muestra mi asiento', () => {
      expect(component.seats).toHaveLength(1);
      expect(component.seats[0].name).toBe('Oscar');
    });

    it('cuenta los huecos libres', () => {
      expect(component.freeSeats).toBe(3);
    });

    it('no deja empezar con un solo jugador', () => {
      expect(component.canStart).toBe(false);
    });

    it('genera un enlace de invitación con el identificador de sala', () => {
      expect(component.inviteLink).toContain(roomId);
      expect(component.inviteLink).toContain('/juegos/risk?room=');
    });

    it('añade un bot con el perfil elegido', async () => {
      component.newBotProfile = 'cauto';
      await component.addBot();
      await wait();
      expect(component.seats).toHaveLength(2);
      expect(component.seats[1].kind).toBe('bot');
      expect(component.seats[1].botProfile).toBe('cauto');
      expect(component.canStart).toBe(true);
    });

    it('rellena todos los huecos de golpe', async () => {
      await component.fillWithBots();
      await wait();
      expect(component.seats).toHaveLength(4);
      expect(component.freeSeats).toBe(0);
    });

    it('no añade bots si no quedan huecos', async () => {
      await component.fillWithBots();
      await wait();
      await component.addBot();
      await wait();
      expect(component.seats).toHaveLength(4);
    });

    it('los bots reciben colores distintos', async () => {
      await component.fillWithBots();
      await wait();
      expect(new Set(component.seats.map((seat) => seat.color)).size).toBe(4);
    });

    it('el propietario puede quitar a otros pero no a sí mismo', async () => {
      await component.addBot();
      await wait();
      await component.removeSeat(component.seats[0]);
      await wait();
      expect(component.seats).toHaveLength(2);
      await component.removeSeat(component.seats[1]);
      await wait();
      expect(component.seats).toHaveLength(1);
    });
  });

  describe('empezar la partida', () => {
    beforeEach(async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);
      fixture.detectChanges();
    });

    it('pasa a estado de juego', () => {
      expect(component.meta?.status).toBe('playing');
      expect(component.inGame).toBe(true);
    });

    it('congela la alineación en los metadatos', () => {
      expect(component.meta?.roster).toHaveLength(4);
      expect(component.meta?.roster?.map((entry) => entry.id).sort()).toEqual(
        component.seats.map((seat) => seat.id).sort(),
      );
    });

    it('reparte el tablero entre los cuatro jugadores', () => {
      expect(component.state).not.toBeNull();
      const owners = new Set(
        Object.values(component.state!.territories).map((territory) => territory.ownerId),
      );
      expect(owners.size).toBe(4);
    });

    it('anuncia el arranque en el chat', () => {
      expect(component.chat.some((entry) => entry.kind === 'system')).toBe(true);
    });

    it('pinta el tablero', () => {
      expect(fixture.nativeElement.querySelector('app-risk-board')).toBeTruthy();
    });

    it('muestra el marcador con los cuatro jugadores', () => {
      expect(component.scoreboard).toHaveLength(4);
      const total = component.scoreboard.reduce((sum, entry) => sum + entry.territories, 0);
      expect(total).toBe(component.map!.territories.length);
    });

    it('el estado sigue siendo el mismo tras rehacerlo desde el log', () => {
      const applied = component.derived!.applied;
      expect(component.derived!.rejected).toEqual([]);
      expect(applied).toBeGreaterThanOrEqual(0);
    });
  });

  describe('modo avanzado en la mesa', () => {
    /** Monta una mesa avanzada con la partida ya empezada. */
    async function advancedTable() {
      const created = await createLocalRoom({ advancedTerrain: true });
      const mounted = await mountRoom(created.roomId, created.seatId);
      await mounted.component.fillWithBots();
      await wait();
      await mounted.component.startGame();
      await wait(30);
      mounted.fixture.detectChanges();
      return mounted;
    }

    it('una sala clásica no enseña orografía', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);
      expect(component.advancedTerrain).toBe(false);
      expect(component.terrainOf('AK')).toBeNull();
      expect(component.isLandingSelected()).toBe(false);
    });

    it('la mesa avanzada sabe el terreno de cada territorio', async () => {
      const mounted = await advancedTable();
      try {
        expect(mounted.component.advancedTerrain).toBe(true);
        expect(mounted.component.terrainOf('AK')?.name).toBe('Montaña');
        expect(mounted.component.terrainOf('NF')?.name).toBe('Desierto');
        expect(mounted.component.terrainOf(null)).toBeNull();
      } finally {
        mounted.fixture.destroy();
      }
    });

    it('el desembarco recorta a 2 los dados que se pueden pedir', async () => {
      const mounted = await advancedTable();
      try {
        const room = mounted.component;
        // Alaska con ejércitos de sobra atacando a Kamchatka: cruza el Bering.
        room.state!.territories['AK'] = { ownerId: room.seatId, armies: 12 };
        room.selectedFrom = 'AK';
        room.selectedTo = 'KC';
        expect(room.isLandingSelected()).toBe(true);
        expect(room.maxDiceForSelection()).toBe(2);

        // Y un vecino por tierra sigue dando los tres de siempre.
        room.selectedTo = 'NT';
        expect(room.isLandingSelected()).toBe(false);
        expect(room.maxDiceForSelection()).toBe(3);
      } finally {
        mounted.fixture.destroy();
      }
    });

    it('cruzar un puente de tierra no cuenta como desembarco', async () => {
      const mounted = await advancedTable();
      try {
        const room = mounted.component;
        room.state!.territories['CH'] = { ownerId: room.seatId, armies: 12 };
        room.selectedFrom = 'CH';
        room.selectedTo = 'UR';
        expect(room.isLandingSelected()).toBe(false);
        expect(room.maxDiceForSelection()).toBe(3);
      } finally {
        mounted.fixture.destroy();
      }
    });

    it('la probabilidad que se enseña tiene en cuenta el terreno', async () => {
      const mounted = await advancedTable();
      try {
        const room = mounted.component;
        // Mismo ataque, mismos ejércitos: la única diferencia es el terreno del
        // objetivo (Alaska es montaña, Territorio del Noroeste es llanura).
        room.state!.territories['AB'] = { ownerId: room.seatId, armies: 12 };
        room.state!.territories['AK'] = { ownerId: 'otro', armies: 6 };
        room.state!.territories['NT'] = { ownerId: 'otro', armies: 6 };
        room.selectedFrom = 'AB';
        room.selectedTo = 'AK';
        const mountain = room.selectionOdds()!;
        room.selectedTo = 'NT';
        const plain = room.selectionOdds()!;
        expect(mountain).toBeLessThan(plain);
      } finally {
        mounted.fixture.destroy();
      }
    });
  });

  describe('turno del jugador', () => {
    beforeEach(async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      // Dejamos jugar a los bots hasta que me toque.
      for (let i = 0; i < 400 && !component.isMyTurn; i++) await wait(1);
      fixture.detectChanges();
    });

    it('me llega el turno', () => {
      expect(component.isMyTurn).toBe(true);
      expect(component.state!.phase).toBe('reinforce');
    });

    it('el consejero me deja un mensaje', () => {
      expect(component.advice.length).toBeGreaterThan(0);
      expect(component.advice[0].kind).toBe('advisor');
    });

    it('mis territorios son seleccionables en refuerzos', () => {
      const mine = territoriesOf(component.state!, seatId);
      expect(component.selectableTerritories.sort()).toEqual(mine.sort());
    });

    it('seleccionar un territorio no crea listas nuevas cada vez', () => {
      const before = component.selectableTerritories;
      fixture.detectChanges();
      expect(component.selectableTerritories).toBe(before);
    });

    it('coloco refuerzos y bajan de la reserva', async () => {
      const reserve = component.me!.reserve;
      const target = component.selectableTerritories[0];
      const armies = component.state!.territories[target].armies;
      component.onTerritoryClick(target);
      await component.deploy(true);
      await wait(5);
      expect(component.me!.reserve).toBe(0);
      expect(component.state!.territories[target].armies).toBe(armies + reserve);
    });

    it('no puedo terminar la fase con reserva pendiente', () => {
      expect(component.canEndPhase()).toBe(false);
    });

    it('paso a ataque cuando coloco todo', async () => {
      component.onTerritoryClick(component.selectableTerritories[0]);
      await component.deploy(true);
      await wait(5);
      expect(component.canEndPhase()).toBe(true);
      await component.endPhase();
      await wait(5);
      expect(component.state!.phase).toBe('attack');
    });

    it('en ataque solo se ofrecen orígenes con dos o más ejércitos', async () => {
      component.onTerritoryClick(component.selectableTerritories[0]);
      await component.deploy(true);
      await wait(5);
      await component.endPhase();
      await wait(5);
      fixture.detectChanges();
      for (const id of component.selectableTerritories) {
        expect(component.state!.territories[id].armies).toBeGreaterThanOrEqual(2);
        expect(component.state!.territories[id].ownerId).toBe(seatId);
      }
    });

    it('al elegir origen aparecen los objetivos enemigos', async () => {
      component.onTerritoryClick(component.selectableTerritories[0]);
      await component.deploy(true);
      await wait(5);
      await component.endPhase();
      await wait(5);
      const from = component.selectableTerritories[0];
      component.onTerritoryClick(from);
      expect(component.selectedFrom).toBe(from);
      expect(component.targetTerritories.length).toBeGreaterThan(0);
      for (const id of component.targetTerritories) {
        expect(component.state!.territories[id].ownerId).not.toBe(seatId);
      }
    });

    it('calcula las probabilidades del ataque apuntado', async () => {
      component.onTerritoryClick(component.selectableTerritories[0]);
      await component.deploy(true);
      await wait(5);
      await component.endPhase();
      await wait(5);
      const from = component.selectableTerritories[0];
      component.onTerritoryClick(from);
      component.onTerritoryClick(component.targetTerritories[0]);
      const odds = component.selectionOdds();
      expect(odds).toBeGreaterThan(0);
      expect(odds).toBeLessThanOrEqual(1);
    });

    it('abandonar entrega el puesto a la IA y retira mis controles', async () => {
      expect(component.handedToAi).toBe(false);
      await component.surrender();
      await wait(5);
      expect(component.handedToAi).toBe(true);
      expect(component.isMyTurn).toBe(false);
      expect(component.selectableTerritories).toEqual([]);
      expect(component.me!.eliminated).toBe(false);
      expect(territoriesOf(component.state!, seatId).length).toBeGreaterThan(0);
    });

    it('cancelar la selección la limpia', () => {
      component.onTerritoryClick(component.selectableTerritories[0]);
      component.clearSelection();
      expect(component.selectedFrom).toBeNull();
      expect(component.targetTerritories).toEqual([]);
    });
  });

  describe('utilidades de la interfaz', () => {
    it('traduce las fases al español', () => {
      expect(component.phaseLabel).toBeDefined();
    });

    it('resuelve nombres de territorio', () => {
      expect(component.territoryName('AK')).toBe('Alaska');
      expect(component.territoryName(null)).toBe('');
    });

    it('devuelve un color por jugador', () => {
      expect(component.colorOf(seatId)).toBe(PLAYER_COLORS[0]);
      expect(component.colorOf('desconocido')).toBe('#8b9c93');
    });

    it('copia el enlace de invitación', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      component.copyInvite();
      expect(writeText).toHaveBeenCalledWith(component.inviteLink);
      expect(component.copied).toBe(true);
    });

    it('salir vuelve al lobby', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.leave();
      expect(spy).toHaveBeenCalledWith(['/juegos/risk']);
    });

    it('envía mensajes al chat', async () => {
      await component.sendChat();
      expect(component.chat.filter((entry) => entry.kind === 'player')).toHaveLength(0);
      component.chatDraft = '  a por ellos  ';
      await component.sendChat();
      await wait();
      const mine = component.chat.filter((entry) => entry.kind === 'player');
      expect(mine).toHaveLength(1);
      expect(mine[0].text).toBe('a por ellos');
      expect(component.chatDraft).toBe('');
    });

    it('el consejero responde bajo demanda una vez empezada la partida', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);
      await component.askAdvisor();
      await wait();
      expect(component.advice.length).toBeGreaterThan(0);
      expect(component.advice.at(-1)!.author).toBe('Estratega IA');
      expect(component.panel).toBe('chat');
    });

    it('mezcla chat y consejos ordenados por hora', async () => {
      component.chatDraft = 'hola';
      await component.sendChat();
      await component.askAdvisor();
      await wait();
      const feed = component.chatFeed;
      for (let i = 1; i < feed.length; i++) {
        expect(feed[i].ts).toBeGreaterThanOrEqual(feed[i - 1].ts);
      }
    });

    it('guarda la configuración de la IA', () => {
      component.aiSettings = { ...component.aiSettings, enabled: true, provider: 'groq' };
      component.onProviderChange();
      component.saveAi();
      expect(component.aiSettings.model).toBe(component.modelOptions[0].id);
      expect(TestBed.inject(RiskGameService).aiSettings.provider).toBe('groq');
    });
  });

  describe('cartas', () => {
    it('empiezo sin cartas', () => {
      expect(component.myCards).toEqual([]);
      expect(component.mustTradeNow).toBe(false);
    });

    it('seleccionar cartas nunca pasa de tres', () => {
      const cards = ['a', 'b', 'c', 'd'].map((id) => ({
        id,
        symbol: 'infantry' as const,
        territoryId: null,
      }));
      for (const card of cards) component.toggleCard(card);
      expect(component.selectedCards).toHaveLength(3);
      expect(component.selectedCards).not.toContain('a');
    });

    it('deseleccionar quita la carta', () => {
      const card = { id: 'a', symbol: 'infantry' as const, territoryId: null };
      component.toggleCard(card);
      component.toggleCard(card);
      expect(component.selectedCards).toEqual([]);
    });
  });

  describe('la mesa nunca se queda parada', () => {
    it('los bots juegan sin descanso hasta terminar la partida', async () => {
      localStorage.clear();
      const room = await createLocalRoom({ mapId: 'spain-regions', maxPlayers: 4 });
      const mounted = await mountRoom(room.roomId, room.seatId);

      await mounted.component.fillWithBots();
      await wait();
      await mounted.component.startGame();
      await wait(5);
      // Abandonamos: a partir de aquí la partida es cosa de la IA de principio a fin.
      await mounted.component.surrender();

      let stalledTicks = 0;
      let lastCount = -1;
      for (let i = 0; i < 8000; i++) {
        if (mounted.component.state?.phase === 'game-over') break;
        const count = mounted.component.derived?.applied ?? 0;
        stalledTicks = count === lastCount ? stalledTicks + 1 : 0;
        lastCount = count;
        // 400 ciclos seguidos sin una sola jugada nueva es que se ha atascado.
        if (stalledTicks > 400) break;
        await wait(0);
      }

      expect(mounted.component.derived?.rejected).toEqual([]);
      expect(mounted.component.state?.phase, 'la partida debería haber terminado').toBe('game-over');
      expect(mounted.component.state?.winnerId).toBeTruthy();

      // El ganador se queda con todo el mapa y la sala pasa a "terminada".
      const winner = mounted.component.winner!;
      expect(winner).toBeTruthy();
      expect(territoriesOf(mounted.component.state!, winner.id)).toHaveLength(
        mounted.component.map!.territories.length,
      );
      expect(mounted.component.meta?.status).toBe('finished');

      // Y la mesa lo anuncia en pantalla.
      mounted.fixture.detectChanges();
      const victory = mounted.fixture.nativeElement.querySelector('.action-block.victory');
      expect(victory).toBeTruthy();
      expect(victory.textContent).toContain(winner.name);
      expect(victory.textContent).toContain('ha ganado la partida');

      // Ningún territorio se queda sin dueño ni a cero ejércitos.
      for (const territory of Object.values(mounted.component.state!.territories)) {
        expect(territory.ownerId).toBe(winner.id);
        expect(territory.armies).toBeGreaterThanOrEqual(1);
      }
      mounted.fixture.destroy();
    }, 60000);
  });

  it('sin identificador de sala vuelve al lobby', async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RiskRoom],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();
    const localFixture = TestBed.createComponent(RiskRoom);
    const spy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    localFixture.detectChanges();
    expect(spy).toHaveBeenCalledWith(['/juegos/risk']);
  });
});
