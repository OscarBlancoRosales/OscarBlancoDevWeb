import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { NameScreen } from './name-screen';
import { AuthApiService } from '../api/auth-api.service';
import { ScrumRoomService } from '../api/scrum-room.service';

/** Una sesión de mentira, pero con la forma de la de verdad. */
function sesion(user: { id: string; email: string } | null) {
  return { settledUser$: of(user), user$: of(user), usuario: user };
}

const OSCAR = { id: 'uid-oscar', email: 'oscar@ejemplo.com' };

/** El servicio de salas, apuntando a quién le piden crear qué. */
function salas() {
  const creadas: { nombreSala: string; nombreJugador: string }[] = [];
  return {
    creadas,
    crear: vi.fn((nombreSala: string, nombreJugador: string) => {
      creadas.push({ nombreSala, nombreJugador });
      return Promise.resolve({
        roomId: 'sala-del-servidor',
        seatId: 'asiento-1',
        seatToken: 'pase-nuevo',
      });
    }),
  };
}

async function montar(
  auth: unknown,
  params: Record<string, string> = {},
  rooms: unknown = salas(),
): Promise<{ fixture: ComponentFixture<NameScreen>; component: NameScreen; rooms: unknown }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [NameScreen],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      { provide: AuthApiService, useValue: auth },
      { provide: ScrumRoomService, useValue: rooms },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(NameScreen);
  return { fixture, component: fixture.componentInstance, rooms };
}

describe('NameScreen (crear sala de Scrum Poker)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('se crea', async () => {
    const { component } = await montar(sesion(OSCAR));
    expect(component).toBeTruthy();
  });

  describe('quién puede crear sala', () => {
    it('con sesión, sí: el servidor da la sala y el enlace la lleva dentro', async () => {
      const { component } = await montar(sesion(OSCAR));
      component.ngOnInit();
      expect(component.isAdmin).toBe(true);

      // La sala no existe hasta que se envía el nombre: el identificador lo
      // reparte el servidor, no se inventa aquí.
      expect(component.roomId).toBe('');

      component.nameForm.setValue({ playerName: 'Óscar' });
      await component.joinRoom();

      expect(component.roomId).toBe('sala-del-servidor');
      expect(component.inviteCode).toContain('sala-del-servidor');
      expect(localStorage.getItem('seat_id')).toBe('asiento-1');
      expect(localStorage.getItem('seat_token')).toBe('pase-nuevo');
      expect(localStorage.getItem('is_room_creator')).toBe('true');
    });

    it('sin sesión, no: te manda al login y no crea nada', async () => {
      const rooms = salas();
      const { component } = await montar(sesion(null), {}, rooms);
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.ngOnInit();

      expect(navigate).toHaveBeenCalledWith(['/auth'], { queryParams: { next: '/name-screen' } });
      expect(component.roomId).toBe('');
      expect(rooms.crear).not.toHaveBeenCalled();
      expect(localStorage.getItem('is_room_creator')).toBeNull();
    });

    it('una bandera en el navegador NO abre la puerta', async () => {
      // Era el fallo: el candado miraba `localStorage.auth_token`, un texto que
      // cualquiera escribe desde la consola del navegador. Y ahora hay una
      // segunda barrera: crear sala es una llamada que el servidor rechaza sin
      // token válido, así que la bandera no engaña ni a la pantalla ni a la API.
      localStorage.setItem('auth_token', 'me-lo-he-inventado');
      const { component } = await montar(sesion(null));
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.ngOnInit();

      expect(component.isAdmin).toBe(false);
      expect(navigate).toHaveBeenCalled();
    });

    it('no decide nada mientras aún se restaura la sesión', async () => {
      // Durante ese instante no se sabe si hay sesión. Actuar sobre ese null
      // echaría a la calle a quien solo estaba recargando la página.
      const tarde = new Subject<unknown>();
      const { component } = await montar({ settledUser$: tarde.asObservable(), usuario: null });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.ngOnInit();
      expect(navigate).not.toHaveBeenCalled();

      tarde.next(OSCAR);
      expect(component.isAdmin).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('la sala no cambia de número si la sesión reemite', async () => {
      // Sin cuidado, la sala cambiaría bajo los pies de quien ya repartió el
      // enlace.
      const flujo = new Subject<unknown>();
      const rooms = salas();
      const { component } = await montar(
        { settledUser$: flujo.asObservable(), usuario: OSCAR },
        {},
        rooms,
      );
      component.ngOnInit();
      flujo.next(OSCAR);

      component.nameForm.setValue({ playerName: 'Óscar' });
      await component.joinRoom();
      const primera = component.roomId;

      flujo.next(OSCAR);

      expect(component.roomId).toBe(primera);
      expect(rooms.crear).toHaveBeenCalledTimes(1);
    });

    it('si el servidor rechaza la creación, se cuenta y no se navega', async () => {
      const rooms = {
        crear: vi.fn(() => Promise.reject(new Error('no'))),
      };
      const { component } = await montar(sesion(OSCAR), {}, rooms);
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.ngOnInit();

      component.nameForm.setValue({ playerName: 'Óscar' });
      await component.joinRoom();

      expect(component.error).not.toBe('');
      expect(component.showSuccess).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('invitados', () => {
    it('entran con el enlace sin necesitar cuenta', async () => {
      const { component } = await montar(sesion(null), { room: 'sala-de-otro' });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.ngOnInit();

      expect(navigate).not.toHaveBeenCalled();
      expect(component.isInvited).toBe(true);
      expect(component.roomId).toBe('sala-de-otro');
    });

    it('no crean sala: se sientan en la que ya existe', async () => {
      const rooms = salas();
      const { component } = await montar(sesion(null), { room: 'sala-de-otro' }, rooms);
      component.ngOnInit();

      component.nameForm.setValue({ playerName: 'Ana' });
      await component.joinRoom();

      expect(rooms.crear).not.toHaveBeenCalled();
      expect(localStorage.getItem('current_room_id')).toBe('sala-de-otro');
      expect(localStorage.getItem('seat_id')).toBeNull();
    });

    it('pero no se les marca como creadores de la sala', async () => {
      localStorage.setItem('is_room_creator', 'true');
      const { component } = await montar(sesion(null), { room: 'sala-de-otro' });

      component.ngOnInit();

      expect(component.isAdmin).toBe(false);
      expect(localStorage.getItem('is_room_creator')).toBeNull();
    });
  });

  it('exige un nombre de al menos dos letras', async () => {
    const { component } = await montar(sesion(OSCAR));
    component.ngOnInit();
    component.nameForm.setValue({ playerName: 'a' });
    expect(component.nameForm.invalid).toBe(true);
    component.nameForm.setValue({ playerName: 'Ana' });
    expect(component.nameForm.valid).toBe(true);
  });
});
