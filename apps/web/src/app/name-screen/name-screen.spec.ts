import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { NameScreen } from './name-screen';
import { FirebaseAuthService } from '../firebase-auth.service';

/** Una sesión de Firebase de mentira, pero con la forma de la de verdad. */
function sesion(user: { uid: string; email: string } | null) {
  return { settledUser$: of(user), user$: of(user), currentUser: user };
}

const OSCAR = { uid: 'uid-oscar', email: 'oscar@ejemplo.com' };

async function montar(
  auth: unknown,
  params: Record<string, string> = {},
): Promise<{ fixture: ComponentFixture<NameScreen>; component: NameScreen }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [NameScreen],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      { provide: FirebaseAuthService, useValue: auth },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(NameScreen);
  return { fixture, component: fixture.componentInstance };
}

describe('NameScreen (crear sala de Scrum Poker)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('se crea', async () => {
    const { component } = await montar(sesion(OSCAR));
    expect(component).toBeTruthy();
  });

  describe('quién puede crear sala', () => {
    it('con sesión de Firebase, sí: genera sala e invitación', async () => {
      const { component } = await montar(sesion(OSCAR));
      component.ngOnInit();
      expect(component.isAdmin).toBe(true);
      expect(component.roomId.startsWith('ROOM-')).toBe(true);
      expect(component.inviteCode).toContain(component.roomId);
    });

    it('sin sesión, no: te manda al login y no crea nada', async () => {
      const { component } = await montar(sesion(null));
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.ngOnInit();
      expect(navigate).toHaveBeenCalledWith(['/auth'], { queryParams: { next: '/name-screen' } });
      expect(component.roomId).toBe('');
      expect(localStorage.getItem('is_room_creator')).toBeNull();
    });

    it('una bandera en el navegador NO abre la puerta', async () => {
      // Era el fallo: el candado miraba `localStorage.auth_token`, un texto
      // que cualquiera escribe desde la consola del navegador. Con la sesión
      // de verdad ausente, esa bandera ya no vale nada.
      localStorage.setItem('auth_token', 'me-lo-he-inventado');
      const { component } = await montar(sesion(null));
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.ngOnInit();
      expect(component.isAdmin).toBe(false);
      expect(navigate).toHaveBeenCalled();
    });

    it('no decide nada mientras Firebase aún restaura la sesión', async () => {
      // `user$` vale null durante ese instante. Si actuáramos sobre ese null,
      // echaríamos a la calle a quien solo estaba recargando la página.
      const tarde = new Subject<unknown>();
      const { component } = await montar({ settledUser$: tarde.asObservable(), currentUser: null });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.ngOnInit();
      expect(navigate).not.toHaveBeenCalled();

      tarde.next(OSCAR);
      expect(component.isAdmin).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      expect(component.roomId.startsWith('ROOM-')).toBe(true);
    });

    it('la sala no cambia de número si la sesión reemite', async () => {
      // Firebase reemite al refrescar el testigo. Sin cuidado, la sala cambiaba
      // bajo los pies de quien ya había repartido el enlace.
      const flujo = new Subject<unknown>();
      const { component } = await montar({ settledUser$: flujo.asObservable(), currentUser: OSCAR });
      component.ngOnInit();
      flujo.next(OSCAR);
      const primera = component.roomId;
      flujo.next(OSCAR);
      expect(component.roomId).toBe(primera);
      expect(component.inviteCode).toContain(primera);
    });
  });

  describe('invitados', () => {
    it('entran con el enlace sin necesitar cuenta', async () => {
      const { component } = await montar(sesion(null), { room: 'ROOM-ABC123' });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.ngOnInit();
      expect(navigate).not.toHaveBeenCalled();
      expect(component.isInvited).toBe(true);
      expect(component.roomId).toBe('ROOM-ABC123');
    });

    it('pero no se les marca como creadores de la sala', async () => {
      localStorage.setItem('is_room_creator', 'true');
      const { component } = await montar(sesion(null), { room: 'ROOM-ABC123' });
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
