import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskRoom } from './risk-room';
import { RiskRoomService } from '../../services/risk-room.service';
import { RiskGameService } from '../../services/risk-game.service';
import { DEFAULT_CONFIG, PLAYER_COLORS } from '@devweb/shared/engine/engine';
import { territoriesOf } from '@devweb/shared/engine/rules';
import { CANAL_GENERAL } from '../risk-roster/risk-roster';

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
  options: {
    maxPlayers?: number;
    mapId?: string;
    advancedTerrain?: boolean;
    advancedUnits?: boolean;
    victory?: 'conquest' | 'objectives';
  } = {},
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
    config: {
      ...DEFAULT_CONFIG,
      advancedTerrain: options.advancedTerrain ?? false,
      advancedUnits: options.advancedUnits ?? false,
      victory: options.victory ?? 'conquest',
    },
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

    /**
     * La cara no es un adorno: durante la partida es tu ficha en el marcador y
     * la puerta de tu conversación. Por eso se elige antes de empezar.
     */
    describe('elegir cara', () => {
      it('empieza con una repartida, y elegir la cambia', async () => {
        const primera = component.myAvatar;
        expect(primera.length).toBeGreaterThan(0);

        const otra = component.avatarChoices.find((emoji) => emoji !== primera)!;
        await component.chooseAvatar(otra);
        await wait();
        expect(component.myAvatar).toBe(otra);
      });

      it('no deja coger la que ya lleva otro', async () => {
        await component.addBot();
        await wait();
        const bot = component.seats.find((seat) => seat.kind === 'bot')!;
        await TestBed.inject(RiskRoomService).updateSeat(roomId, bot.id, { avatar: '🐉' });
        await wait();

        expect(component.avatarTaken('🐉')).toBe(true);
        await component.chooseAvatar('🐉');
        await wait();
        expect(component.myAvatar).not.toBe('🐉');
      });

      it('y el reparto nunca repite cara, mezcle elegidas y repartidas', async () => {
        await component.fillWithBots();
        await wait();
        await component.chooseAvatar(component.avatarChoices[3]);
        await wait();
        await component.startGame();
        await wait(30);

        const caras = component.rosterRows
          .filter((row) => row.id !== 'advisor')
          .map((row) => row.avatar);
        expect(new Set(caras).size).toBe(caras.length);
      });
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

  describe('empezar la partida cuando algo falla', () => {
    it('la alineación que se manda no lleva ningún undefined', async () => {
      // Firebase lanza excepción con cualquier undefined, y un asiento humano no
      // tiene `botProfile`. Era lo que hacía que empezar online no hiciera nada.
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);

      const meta = TestBed.inject(RiskRoomService).listLocalRooms()[0].meta;
      expect(JSON.stringify(meta.roster)).not.toContain('undefined');
      const humano = (meta.roster ?? []).find((entry) => entry.kind === 'human');
      expect(humano, 'debería haber un asiento humano').toBeDefined();
      expect(JSON.stringify(humano)).not.toContain('undefined');
    });

    it('si la base rechaza, lo dice en pantalla en vez de no hacer nada', async () => {
      const rooms = TestBed.inject(RiskRoomService);
      vi.spyOn(rooms, 'updateMeta').mockRejectedValue(new Error('Permission denied'));
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait();

      expect(component.errorMessage).toContain('No se ha podido empezar');
      expect(component.errorMessage).toContain('Permission denied');
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

  describe('tropas especializadas en la mesa', () => {
    async function unitTable() {
      const created = await createLocalRoom({ advancedTerrain: true, advancedUnits: true });
      const mounted = await mountRoom(created.roomId, created.seatId);
      await mounted.component.fillWithBots();
      await wait();
      await mounted.component.startGame();
      await wait(30);
      mounted.fixture.detectChanges();
      return mounted;
    }

    it('una sala clásica no ofrece tropas', () => {
      expect(component.advancedUnits).toBe(false);
      expect(component.canUpgrade('blindado')).toBe(false);
      expect(component.isAirSelected()).toBe(false);
      expect(component.isArmouredSelected()).toBe(false);
    });

    it('el catálogo de tropas llega a la barra de refuerzos', async () => {
      const mounted = await unitTable();
      try {
        expect(mounted.component.advancedUnits).toBe(true);
        expect(mounted.component.troops.map((t) => t.id)).toEqual([
          'caballeria',
          'blindado',
          'naval',
          'aereo',
        ]);
      } finally {
        mounted.fixture.destroy();
      }
    });

    it('solo se puede ascender con reserva, infantería y territorio propio', async () => {
      const mounted = await unitTable();
      try {
        const room = mounted.component;
        const mine = Object.keys(room.state!.territories).find(
          (id) => room.state!.territories[id].ownerId === room.seatId,
        )!;
        room.state!.phase = 'reinforce';
        room.state!.territories[mine] = { ownerId: room.seatId, armies: 6 };
        room.selectedFrom = mine;

        room.me!.reserve = 10;
        expect(room.canUpgrade('blindado')).toBe(true);

        room.me!.reserve = 1;
        expect(room.canUpgrade('blindado')).toBe(false);

        room.me!.reserve = 10;
        room.state!.territories[mine].units = { blindado: 1 };
        // La misma tropa no se repite en el mismo sitio: no se acumula.
        expect(room.canUpgrade('blindado')).toBe(false);
        expect(room.canUpgrade('naval')).toBe(true);

        // Sin infantería libre tampoco.
        room.state!.territories[mine] = { ownerId: room.seatId, armies: 2, units: { naval: 2 } };
        expect(room.canUpgrade('blindado')).toBe(false);
      } finally {
        mounted.fixture.destroy();
      }
    });

    it('avisa del ataque aéreo y de los blindados', async () => {
      const mounted = await unitTable();
      try {
        const room = mounted.component;
        room.state!.territories['AB'] = { ownerId: room.seatId, armies: 10, units: { aereo: 1 } };
        room.state!.territories['AK'] = { ownerId: 'otro', armies: 3 };
        room.state!.territories['QC'] = { ownerId: 'otro', armies: 3 };
        room.selectedFrom = 'AB';

        // Alberta toca Alaska: eso es tierra.
        room.selectedTo = 'AK';
        expect(room.isAirSelected()).toBe(false);

        // Quebec no toca Alberta, pero está a dos pasos (por Ontario).
        room.selectedTo = 'QC';
        expect(room.isAirSelected()).toBe(true);

        // Alaska es montaña: ahí los blindados no maniobran y no suman.
        room.state!.territories['AB'].units = { blindado: 1 };
        room.selectedTo = 'AK';
        expect(room.isArmouredSelected()).toBe(false);

        // Contra el Territorio del Noroeste, que es llanura, sí.
        room.state!.territories['NT'] = { ownerId: 'otro', armies: 3 };
        room.selectedTo = 'NT';
        expect(room.isArmouredSelected()).toBe(true);
      } finally {
        mounted.fixture.destroy();
      }
    });

    it('los blindados suben el porcentaje que se enseña', async () => {
      const mounted = await unitTable();
      try {
        const room = mounted.component;
        room.state!.territories['AB'] = { ownerId: room.seatId, armies: 12 };
        room.state!.territories['NT'] = { ownerId: 'otro', armies: 6 };
        room.selectedFrom = 'AB';
        room.selectedTo = 'NT';
        const plain = room.selectionOdds()!;

        room.state!.territories['AB'].units = { blindado: 1 };
        expect(room.selectionOdds()!).toBeGreaterThan(plain);
      } finally {
        mounted.fixture.destroy();
      }
    });
  });

  describe('victoria por objetivos en la mesa', () => {
    it('una mesa clásica no enseña objetivos', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);
      expect(component.byObjectives).toBe(false);
      expect(component.missions).toEqual([]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.missions-panel')).toBeNull();
    });

    it('con objetivos se enseñan los de todos, con su progreso', async () => {
      const created = await createLocalRoom({ victory: 'objectives' });
      const mounted = await mountRoom(created.roomId, created.seatId);
      try {
        await mounted.component.fillWithBots();
        await wait();
        await mounted.component.startGame();
        await wait(30);
        mounted.fixture.detectChanges();

        expect(mounted.component.byObjectives).toBe(true);
        expect(mounted.component.missions).toHaveLength(4);
        for (const entry of mounted.component.missions) {
          expect(entry.text.length).toBeGreaterThan(5);
          expect(entry.name.length).toBeGreaterThan(0);
        }
        // Los objetivos viven ahora en el panel «Partida», que empieza cerrado:
        // el mapa manda, y lo demás se abre cuando hace falta. Se abre pulsando
        // el botón, no tocando el campo: en zoneless, cambiarlo a mano después
        // del primer pintado da NG0100, y además nadie juega así.
        mounted.fixture.nativeElement.querySelector('.hud-history').click();
        mounted.fixture.detectChanges();
        const panel = mounted.fixture.nativeElement.querySelector('.missions-panel');
        expect(panel).not.toBeNull();
        expect(panel.querySelectorAll('.mission-row').length).toBe(4);
        // El mío queda marcado.
        expect(panel.querySelectorAll('.mission-row.me').length).toBe(1);
      } finally {
        mounted.fixture.destroy();
      }
    });
  });

  describe('pantalla nueva', () => {
    beforeEach(async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      fixture.detectChanges();
    });

    it('el mapa está siempre, y las esquinas encima', () => {
      expect(fixture.nativeElement.querySelector('app-risk-board')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-risk-hud')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-risk-roster')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-risk-cards')).toBeTruthy();
    });

    /**
     * La barra de abajo cruzaba la pantalla de lado a lado, así que le quitaba
     * sitio al mapa siempre. Cada acción se ha ido a vivir pegada a lo que
     * modifica, y por eso no hace falta ninguna barra.
     */
    it('no queda ninguna barra que cruce la pantalla', () => {
      expect(fixture.nativeElement.querySelector('app-risk-action-bar')).toBeNull();
      expect(fixture.nativeElement.querySelector('.action-bar')).toBeNull();
      expect(fixture.nativeElement.querySelector('.bar')).toBeNull();
    });

    it('ya no quedan columnas: el mapa no comparte sitio con nadie', () => {
      expect(fixture.nativeElement.querySelector('.players-column')).toBeNull();
      expect(fixture.nativeElement.querySelector('.side-column')).toBeNull();
      expect(fixture.nativeElement.querySelector('.board-column')).toBeNull();
    });

    it('empieza sin ningún panel abierto: el mapa se ve entero', () => {
      expect(component.openPanel).toBeNull();
      expect(fixture.nativeElement.querySelector('.panel-shell')).toBeNull();
    });

    it('abre un panel y cierra el anterior', () => {
      // Dos a la vez taparían el mapa, que es lo que se quería evitar.
      fixture.nativeElement.querySelector('.hud-history').click();
      fixture.detectChanges();
      expect(component.openPanel).toBe('historia');
      fixture.nativeElement.querySelector('.hud-settings').click();
      fixture.detectChanges();
      expect(component.openPanel).toBe('ia');
      expect(fixture.nativeElement.querySelectorAll('.panel-shell').length).toBe(1);
    });

    /**
     * Las cartas comparten el mismo hueco que los paneles aunque vivan en su
     * esquina: dos cosas abiertas a la vez taparían el mapa, que es justo lo
     * que se quería evitar.
     */
    it('abrir las cartas cierra el panel que hubiera', () => {
      fixture.nativeElement.querySelector('.hud-history').click();
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.cards-fan').click();
      fixture.detectChanges();
      expect(component.openPanel).toBe('cartas');
      expect(fixture.nativeElement.querySelector('.panel-shell')).toBeNull();
      expect(fixture.nativeElement.querySelector('.cards-sheet')).toBeTruthy();
    });

    it('volver a pulsar el mismo lo cierra', () => {
      const boton = fixture.nativeElement.querySelector('.hud-history');
      boton.click();
      fixture.detectChanges();
      boton.click();
      fixture.detectChanges();
      expect(component.openPanel).toBeNull();
    });

    it('las fichas llevan una por jugador, con su cara', () => {
      const fichas = component.rosterRows.filter((row) => row.id !== 'advisor');
      const nombres = fichas.map((r) => r.name).sort();
      const esperados = component.state!.players.map((p) => p.name).sort();
      expect(nombres).toEqual(esperados);
      // Dos jugadores no pueden compartir cara en la misma mesa.
      expect(new Set(fichas.map((r) => r.avatar)).size).toBe(fichas.length);
    });

    it('la repetición al mantener pulsado sólo se ofrece en refuerzos y en tu turno', () => {
      expect(component.repeatOnHold).toBe(
        component.isMyTurn && component.state!.phase === 'reinforce',
      );
    });

    /**
     * Las cartas ya no son un panel: son su esquina, y se abren tocándolas.
     * Sigue habiendo que comprobar que la puerta existe, porque quedarse sin
     * poder canjear un trío bloquea la partida entera.
     */
    it('las cartas se abren tocando las cartas', () => {
      fixture.nativeElement.querySelector('.cards-fan').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cards-sheet')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.cards-trade')).toBeTruthy();
    });

    /** El chat dejó de ser un panel: es la ficha de cada jugador. */
    it('se habla desde la ficha de cada jugador, no desde ningún panel', () => {
      const fichas = fixture.nativeElement.querySelectorAll('app-risk-roster button.roster-row');
      expect(fichas.length).toBeGreaterThan(0);
      fichas[0].click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-risk-roster .thread')).toBeTruthy();
    });

    it('la partida y los ajustes tienen todos su sitio', () => {
      // Al quitar la columna lateral, nada puede quedarse sin puerta. Se abren
      // pulsando, no asignando el campo: en zoneless, cambiarlo a mano después
      // del primer pintado da NG0100, y además nadie juega así.
      const puertas: Array<[string, string]> = [
        ['.hud-history', 'Partida'],
        ['.hud-settings', 'Ajustes de IA'],
      ];
      for (const [selector, titulo] of puertas) {
        fixture.nativeElement.querySelector(selector).click();
        fixture.detectChanges();
        const abierto = fixture.nativeElement.querySelector('.panel-shell');
        expect(abierto, selector).toBeTruthy();
        expect(abierto.querySelector('.panel-title').textContent.trim()).toBe(titulo);
        // Cerrar antes de la siguiente, para probar una puerta cada vez.
        fixture.nativeElement.querySelector('.panel-close').click();
        fixture.detectChanges();
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

    describe('colocar a toques', () => {
      it('varios toques mandan UNA sola acción', async () => {
        // Un toque por acción serían tantas escrituras en Firebase como toques,
        // y otras tantas líneas de registro: online iría a trompicones y el
        // historial quedaría ilegible.
        const game = TestBed.inject(RiskGameService);
        const enviadas: Array<Record<string, unknown>> = [];
        const espia = vi
          .spyOn(game, 'play')
          .mockImplementation(async (a) => void enviadas.push(a as never));
        try {
          const target = component.selectableTerritories[0];
          const toques = component.me!.reserve;
          expect(toques, 'sin reserva no hay nada que probar').toBeGreaterThan(1);
          for (let i = 0; i < toques; i++) component.onTerritoryClick(target);
          expect(enviadas, 'ha mandado antes de agrupar').toEqual([]);
          await component.flushDeploy();
          expect(enviadas).toHaveLength(1);
          expect(enviadas[0]).toMatchObject({
            type: 'deploy',
            territoryId: target,
            armies: toques,
          });
        } finally {
          espia.mockRestore();
        }
      });

      it('el contador baja en el toque, no al mandar', () => {
        // La pantalla tiene que responder al dedo aunque la escritura tarde.
        const antes = component.reserveLeft;
        component.onTerritoryClick(component.selectableTerritories[0]);
        expect(component.reserveLeft).toBe(antes - 1);
      });

      it('no se coloca más de lo que queda en reserva', () => {
        const target = component.selectableTerritories[0];
        const reserva = component.reserveLeft;
        for (let i = 0; i < reserva + 5; i++) component.onTerritoryClick(target);
        expect(component.reserveLeft).toBe(0);
      });

      it('cambiar de territorio vuelca lo anterior', async () => {
        const game = TestBed.inject(RiskGameService);
        const enviadas: Array<Record<string, unknown>> = [];
        const espia = vi
          .spyOn(game, 'play')
          .mockImplementation(async (a) => void enviadas.push(a as never));
        try {
          const [uno, dos] = component.selectableTerritories;
          component.onTerritoryClick(uno);
          component.onTerritoryClick(dos);
          await wait();
          expect(enviadas).toHaveLength(1);
          expect(enviadas[0]).toMatchObject({ territoryId: uno, armies: 1 });
        } finally {
          espia.mockRestore();
        }
      });

      it('el volcado sale solo al dejar de tocar', async () => {
        const target = component.selectableTerritories[0];
        const antes = component.state!.territories[target].armies;
        component.onTerritoryClick(target);
        component.onTerritoryClick(target);
        await wait(component.DEPLOY_FLUSH_MS + 30);
        expect(component.state!.territories[target].armies).toBe(antes + 2);
      });
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

    it('envía mensajes al canal de todos', async () => {
      component.onThreadChange(CANAL_GENERAL);
      await component.sendToThread('   ');
      expect(component.chat.filter((entry) => entry.kind === 'player')).toHaveLength(0);

      await component.sendToThread('  a por ellos  ');
      await wait();
      const mine = component.chat.filter((entry) => entry.kind === 'player');
      expect(mine).toHaveLength(1);
      expect(mine[0].text).toBe('a por ellos');
      // Sin destinatario: eso es lo que lo hace general.
      expect(mine[0].to).toBeUndefined();
    });

    /**
     * Un privado no es un susurro cifrado: el mensaje viaja entero por la base
     * de datos. Lo que se comprueba aquí es que es una conversación aparte y
     * que no se cuela en el canal de todos.
     */
    it('un privado va marcado y no aparece en el canal general', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);

      const otro = component.state!.players.find((p) => p.id !== component.seatId)!;
      component.onThreadChange(otro.id);
      await component.sendToThread('pacto?');
      await wait();

      const mine = component.chat.filter((entry) => entry.kind === 'player');
      expect(mine).toHaveLength(1);
      expect(mine[0].to).toBe(otro.id);

      expect(component.threadLines.map((l) => l.text)).toContain('pacto?');
      component.onThreadChange(CANAL_GENERAL);
      expect(component.threadLines.map((l) => l.text)).not.toContain('pacto?');
    });

    /**
     * Un rival que no contesta cuando le hablas está roto. Aquí no hay clave de
     * IA, así que contesta el cerebro local: eso es exactamente lo que hay que
     * comprobar, porque es el caso de la mayoría de las partidas.
     */
    it('el bot al que escribes contesta, y sólo a ti', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);

      const bot = component.seats.find((seat) => seat.kind === 'bot')!;
      component.onThreadChange(bot.id);
      await component.sendToThread('¿pacto?');
      await wait(60);

      const suyos = component.chat.filter((entry) => entry.authorId === bot.id && entry.to);
      expect(suyos, 'el bot debería haber contestado').toHaveLength(1);
      expect(suyos[0].to).toBe(component.seatId);
      expect(suyos[0].text.length).toBeGreaterThan(0);

      // Y su respuesta está en su hilo, no en el de todos.
      expect(component.threadLines.map((l) => l.text)).toContain(suyos[0].text);
      component.onThreadChange(CANAL_GENERAL);
      expect(component.threadLines.map((l) => l.text)).not.toContain(suyos[0].text);
    });

    it('no contesta dos veces al mismo mensaje', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);

      const bot = component.seats.find((seat) => seat.kind === 'bot')!;
      component.onThreadChange(bot.id);
      await component.sendToThread('¿pacto?');
      await wait(60);
      await component.sendToThread('¿entonces?');
      await wait(60);

      const suyos = component.chat.filter((entry) => entry.authorId === bot.id && entry.to);
      expect(suyos).toHaveLength(2);
    });

    /**
     * El aviso de «escribiendo…» existe para el hueco entre tu mensaje y la
     * respuesta, que sólo se nota cuando contesta un modelo de lenguaje por la
     * red: el cerebro local contesta en el mismo suspiro.
     *
     * Así que se prueba la regla, no la carrera: se suelta el servicio para
     * que nadie conteste y se comprueba que el aviso aparece y desaparece.
     */
    it('mientras no ha contestado, la ficha avisa de que está escribiendo', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);

      const bot = component.seats.find((seat) => seat.kind === 'bot')!;
      component.onThreadChange(bot.id);
      expect(component.threadWaiting).toBe(false);

      TestBed.inject(RiskGameService).detach();
      await component.sendToThread('¿pacto?');
      await wait(60);
      expect(component.threadWaiting, 'nadie ha contestado todavía').toBe(true);
    });

    it('y en el canal de todos no se espera a nadie', async () => {
      await component.fillWithBots();
      await wait();
      await component.startGame();
      await wait(30);

      component.onThreadChange(CANAL_GENERAL);
      await component.sendToThread('hola a todos');
      await wait(60);
      expect(component.threadWaiting).toBe(false);
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
      expect(component.openThread).toBe('advisor');
    });

    it('mezcla chat y consejos ordenados por hora', async () => {
      component.onThreadChange(CANAL_GENERAL);
      await component.sendToThread('hola');
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
      const victory = mounted.fixture.nativeElement.querySelector('.victory-overlay');
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
