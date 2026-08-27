import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth, DEFAULT_AFTER_LOGIN, safeNext } from './auth';
import { FirebaseAuthService } from '../firebase-auth.service';

async function montar(params: Record<string, string> = {}, signIn = async () => ({ success: true })) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Auth],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      { provide: FirebaseAuthService, useValue: { signIn } },
    ],
  }).compileComponents();
  const fixture: ComponentFixture<Auth> = TestBed.createComponent(Auth);
  return { fixture, component: fixture.componentInstance };
}

describe('Auth (iniciar sesión)', () => {
  beforeEach(() => localStorage.clear());

  it('se crea', async () => {
    const { component } = await montar();
    expect(component).toBeTruthy();
  });

  describe('a dónde te lleva después', () => {
    it('sin destino, a crear sala de Scrum Poker como siempre', async () => {
      const { component } = await montar();
      component.ngOnInit();
      const router = TestBed.inject(Router);
      const ir = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      component.loginForm.setValue({ email: 'oscar@ejemplo.com', password: 'secreta' });
      await component.login();
      expect(ir).toHaveBeenCalledWith(DEFAULT_AFTER_LOGIN);
    });

    it('con destino, te devuelve donde estabas', async () => {
      // Era el fallo: pulsabas "inicia sesión para crear sala" en el RISK y
      // aparecías en Scrum Poker. El login ignoraba el destino.
      const { component } = await montar({ next: '/juegos/risk' });
      component.ngOnInit();
      const router = TestBed.inject(Router);
      const ir = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      component.loginForm.setValue({ email: 'oscar@ejemplo.com', password: 'secreta' });
      await component.login();
      expect(ir).toHaveBeenCalledWith('/juegos/risk');
    });

    it('si el login falla no te mueve de sitio', async () => {
      const { component } = await montar({ next: '/juegos/risk' }, async () => ({
        success: false,
        error: 'Contraseña incorrecta',
      }));
      component.ngOnInit();
      const router = TestBed.inject(Router);
      const ir = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      component.loginForm.setValue({ email: 'oscar@ejemplo.com', password: 'mala' });
      await component.login();
      expect(ir).not.toHaveBeenCalled();
      expect(component.errorMessage).toContain('incorrecta');
    });
  });

  describe('el destino no puede sacarte de la web', () => {
    it('acepta rutas de casa', () => {
      expect(safeNext('/juegos/risk')).toBe('/juegos/risk');
      expect(safeNext('/scrum-poker?room=ROOM-1')).toBe('/scrum-poker?room=ROOM-1');
    });

    it('rechaza otro dominio escrito entero', () => {
      expect(safeNext('https://malo.example')).toBe(DEFAULT_AFTER_LOGIN);
      expect(safeNext('javascript:alert(1)')).toBe(DEFAULT_AFTER_LOGIN);
    });

    it('rechaza la URL sin protocolo, que parece ruta y no lo es', () => {
      // `//malo.example` lo resuelve el navegador contra OTRO dominio.
      expect(safeNext('//malo.example')).toBe(DEFAULT_AFTER_LOGIN);
    });

    it('rechaza la misma jugada con la barra al revés', () => {
      expect(safeNext('/\\malo.example')).toBe(DEFAULT_AFTER_LOGIN);
    });

    it('aguanta que no venga nada', () => {
      expect(safeNext(null)).toBe(DEFAULT_AFTER_LOGIN);
      expect(safeNext(undefined)).toBe(DEFAULT_AFTER_LOGIN);
      expect(safeNext('')).toBe(DEFAULT_AFTER_LOGIN);
    });

    it('y el componente lo filtra de verdad, no solo la función', async () => {
      const { component } = await montar({ next: '//malo.example' });
      component.ngOnInit();
      expect(component.destination).toBe(DEFAULT_AFTER_LOGIN);
    });
  });
});
