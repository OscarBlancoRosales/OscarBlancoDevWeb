import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { ScrumPoker } from './scrum-poker';
import { ScrumRoomService } from '../api/scrum-room.service';

/**
 * Una sala de mentira.
 *
 * Sin esto, `ngOnInit` abriría un WebSocket contra el servidor de verdad cada
 * vez que alguien lanza la suite. Aquí solo anotamos las llamadas.
 */
function salaFalsa() {
  const datos = new BehaviorSubject<unknown>(null);
  return {
    roomData$: datos.asObservable(),
    emitir: (data: unknown) => datos.next(data),
    unirse: vi.fn(() => Promise.resolve({ seatId: 'asiento-1', seatToken: 'pase-nuevo' })),
    reconectar: vi.fn(),
    desconectar: vi.fn(),
    votar: vi.fn(),
    retirarVoto: vi.fn(),
    revelar: vi.fn(),
    nuevaRonda: vi.fn(),
  };
}

type SalaFalsa = ReturnType<typeof salaFalsa>;

async function montar(params: Record<string, string> = {}) {
  TestBed.resetTestingModule();
  const sala = salaFalsa();
  await TestBed.configureTestingModule({
    imports: [ScrumPoker],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      { provide: ScrumRoomService, useValue: sala },
    ],
  }).compileComponents();

  // El espía se pone ANTES de crear el componente: `ngOnInit` puede redirigir,
  // y el router de pruebas no tiene rutas. Sin espía, esa navegación reventaba
  // en segundo plano y ensuciaba la suite con errores sueltos.
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<ScrumPoker> = TestBed.createComponent(ScrumPoker);
  await fixture.whenStable();
  return { fixture, component: fixture.componentInstance, navigate, sala };
}

/** Deja en el navegador los datos de quien ya pasó por el nombre. */
function conSesionDeJugador(): void {
  localStorage.setItem('current_room_id', 'ROOM-ABC123');
  localStorage.setItem('player_name', 'Óscar');
  localStorage.setItem('seat_id', 'asiento-1');
  localStorage.setItem('seat_token', 'pase-secreto');
}

describe('ScrumPoker', () => {
  let component: ScrumPoker;
  let navigate: ReturnType<typeof vi.spyOn>;
  let sala: SalaFalsa;

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('entrando a la sala', () => {
    it('sin nombre elegido te manda a identificarte', async () => {
      // Esto es lo que hacían TODOS los tests de este fichero sin saberlo: el
      // componente se iba a /auth en el primer suspiro y nunca llegaba a
      // montar la sala.
      ({ component, navigate } = await montar());
      expect(navigate).toHaveBeenCalledWith(['/auth']);
      expect(component.roomId).toBe('');
    });

    it('con una invitación te manda antes a poner nombre', async () => {
      conSesionDeJugador();
      ({ navigate } = await montar({ room: 'ROOM-INVITADO' }));
      expect(navigate).toHaveBeenCalledWith(['/name-screen'], {
        queryParams: { room: 'ROOM-INVITADO' },
      });
    });

    it('la invitación borra los datos del jugador anterior', async () => {
      // Si no, entrarías en la sala nueva con el nombre del que usó el
      // navegador antes que tú.
      conSesionDeJugador();
      await montar({ room: 'ROOM-INVITADO' });
      expect(localStorage.getItem('player_name')).toBeNull();
      expect(localStorage.getItem('seat_id')).toBeNull();
      expect(localStorage.getItem('is_room_creator')).toBeNull();
      expect(localStorage.getItem('current_room_id')).toBe('ROOM-INVITADO');
    });

    it('con el pase guardado vuelve a su sitio, no pide asiento nuevo', async () => {
      conSesionDeJugador();
      ({ component, navigate, sala } = await montar());
      await Promise.resolve();

      expect(navigate).not.toHaveBeenCalled();
      expect(component.roomId).toBe('ROOM-ABC123');
      expect(component.currentPlayerName).toBe('Óscar');
      // Recargar la página no debe costarte la silla.
      expect(sala.reconectar).toHaveBeenCalledWith('ROOM-ABC123', 'asiento-1', 'pase-secreto');
      expect(sala.unirse).not.toHaveBeenCalled();
    });

    it('sin pase pide asiento y lo guarda', async () => {
      localStorage.setItem('current_room_id', 'ROOM-ABC123');
      localStorage.setItem('player_name', 'Óscar');
      ({ sala } = await montar());
      await Promise.resolve();

      expect(sala.unirse).toHaveBeenCalledWith('ROOM-ABC123', 'Óscar');
      expect(localStorage.getItem('seat_id')).toBe('asiento-1');
      // Sin guardar el pase, la siguiente recarga pediría otro asiento y la
      // mesa se llenaría de fantasmas con el mismo nombre.
      expect(localStorage.getItem('seat_token')).toBe('pase-nuevo');
    });

    it('si la sala ya no existe, lo dice en vez de quedarse en blanco', async () => {
      localStorage.setItem('current_room_id', 'ROOM-BORRADA');
      localStorage.setItem('player_name', 'Óscar');
      const sala = salaFalsa();
      sala.unirse = vi.fn(() => Promise.reject(new Error('no existe')));

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ScrumPoker],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
          },
          { provide: ScrumRoomService, useValue: sala },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(ScrumPoker);
      fixture.componentInstance.ngOnInit();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.componentInstance.errorDeSala).not.toBe('');
    });
  });

  describe('votación', () => {
    beforeEach(async () => {
      conSesionDeJugador();
      ({ component } = await montar());
    });

    it('se crea', () => {
      expect(component).toBeTruthy();
    });

    it('empieza sin votos ni jugadores', () => {
      expect(component.players).toEqual([]);
      expect(component.hasVoted).toBe(false);
      expect(component.showVotes).toBe(false);
    });

    it('acumula votos numéricos', () => {
      component.addVote(3);
      component.addVote(5);
      expect(component.voteBreakdown.numbers).toBe(8);
      expect(component.hasVoted).toBe(true);
    });

    it('los votos especiales sustituyen al número', () => {
      component.addVote(5);
      component.replaceVote('coffee');
      expect(component.voteBreakdown.numbers).toBe(0);
      expect(component.voteBreakdown.coffee).toBe(1);
      expect(component.myVoteDisplay).toBe('☕');
    });

    it('limpiar el voto lo deja a cero', () => {
      component.addVote(8);
      component.clearMyVote();
      expect(component.hasVoted).toBe(false);
      expect(component.voteBreakdown).toEqual({ numbers: 0, coffee: 0, joint: 0 });
    });
  });
});
