import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Admin } from './admin';
import { AdminApiService } from '../api/admin-api.service';
import { AuthApiService } from '../api/auth-api.service';
import { I18nService } from '../services/i18n.service';
import type { PublicUser } from '@devweb/shared/contracts/auth';

const JEFE: PublicUser = {
  id: 'u-jefe',
  email: 'jefe@ejemplo.com',
  displayName: 'Jefe',
  status: 'active',
  role: 'admin',
};

const ANA: PublicUser = {
  id: 'u-ana',
  email: 'ana@ejemplo.com',
  displayName: 'Ana',
  status: 'active',
  role: 'user',
};

function apiDePrueba(extra: Partial<AdminApiService> = {}): Partial<AdminApiService> {
  return {
    usuarios: vi.fn().mockResolvedValue([JEFE, ANA]),
    invitaciones: vi.fn().mockResolvedValue([]),
    ...extra,
  };
}

async function montar(
  usuario: PublicUser | null,
  admin: Partial<AdminApiService> = apiDePrueba(),
): Promise<ComponentFixture<Admin>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Admin],
    providers: [
      provideRouter([]),
      { provide: AdminApiService, useValue: admin },
      { provide: AuthApiService, useValue: { restaurar: vi.fn().mockResolvedValue(undefined), usuario } },
    ],
  }).compileComponents();
  TestBed.inject(I18nService).setLang('es');

  const fixture = TestBed.createComponent(Admin);
  await fixture.componentInstance.arrancar();
  fixture.detectChanges();
  return fixture;
}

const texto = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent;

describe('el panel de administración', () => {
  /**
   * Lo mismo que contesta el servidor. Un «no eres administrador» le confirma
   * a quien prueba direcciones que hay algo detrás que merece la pena atacar.
   */
  it('para quien no manda, no existe', async () => {
    const api = apiDePrueba();
    const fixture = await montar(ANA, api);

    expect(texto(fixture)).toContain('404');
    expect(api.usuarios).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('sin sesión, tampoco', async () => {
    const fixture = await montar(null);

    expect(texto(fixture)).toContain('404');
    fixture.destroy();
  });

  it('quien manda ve a la gente que hay dentro', async () => {
    const fixture = await montar(JEFE);

    expect(texto(fixture)).toContain('ana@ejemplo.com');
    fixture.destroy();
  });

  /** El rol lo fija la máquina: tocarlo desde aquí dejaría al panel mintiendo. */
  it('y no puede bloquear ni borrar a otro administrador', async () => {
    const fixture = await montar(JEFE);
    const filas = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    const delJefe = [...filas].find((fila) => fila.textContent.includes(JEFE.email));

    expect(delJefe?.querySelectorAll('button')).toHaveLength(0);
    fixture.destroy();
  });

  /**
   * Borrar se lleva la cuenta y sus salas. Un clic de más no puede bastar, y
   * `confirm()` no vale: bloquea la página entera.
   */
  it('borrar pide un segundo clic', async () => {
    const borrarUsuario = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar(JEFE, apiDePrueba({ borrarUsuario }));
    const panel = fixture.componentInstance;

    await panel.borrar(ANA);
    expect(borrarUsuario).not.toHaveBeenCalled();
    expect(panel.confirmando()).toBe(ANA.id);

    await panel.borrar(ANA);
    expect(borrarUsuario).toHaveBeenCalledWith(ANA.id);
    fixture.destroy();
  });

  it('el enlace de una invitación nueva se enseña entero', async () => {
    const enlace = 'https://oscarblancorosales.com/auth/registro?invitacion=la-llave';
    const crearInvitacion = vi.fn().mockResolvedValue({ id: 'i1', enlace, expiraEn: Date.now() });
    const fixture = await montar(JEFE, apiDePrueba({ crearInvitacion }));

    await fixture.componentInstance.crearInvitacion();
    fixture.detectChanges();

    expect(texto(fixture)).toContain(enlace);
    fixture.destroy();
  });

  it('y si algo falla se dice, en vez de dejar la pantalla como estaba', async () => {
    const usuarios = vi.fn().mockRejectedValue(new Error('sin red'));
    const fixture = await montar(JEFE, apiDePrueba({ usuarios }));

    expect(texto(fixture)).toContain('No se ha podido conectar');
    fixture.destroy();
  });
});
