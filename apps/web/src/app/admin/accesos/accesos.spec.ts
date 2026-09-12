import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Accesos } from './accesos';
import { AdminApiService } from '../../api/admin-api.service';
import { I18nService } from '../../services/i18n.service';
import type { Acceso } from '@devweb/shared/contracts/admin';

const AHORA = Date.now();
const DIA = 24 * 60 * 60 * 1000;

function acceso(cambios: Partial<Acceso> = {}): Acceso {
  return {
    id: 'fam-1',
    usuario: { id: 'u1', email: 'ana@example.com', displayName: 'Ana' },
    ip: '81.44.12.9',
    aparato: 'Chrome en Windows',
    agente: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140',
    empezo: AHORA - DIA,
    ultimo: AHORA - 1000,
    expiraEn: AHORA + DIA,
    refrescos: 12,
    revocada: false,
    fueraDelTodo: false,
    ...cambios,
  };
}

async function montar(admin: Partial<AdminApiService>): Promise<ComponentFixture<Accesos>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Accesos],
    providers: [{ provide: AdminApiService, useValue: admin }],
  }).compileComponents();
  TestBed.inject(I18nService).setLang('es');
  const fixture = TestBed.createComponent(Accesos);
  fixture.detectChanges();
  await fixture.componentInstance.refrescar();
  fixture.detectChanges();
  return fixture;
}

const texto = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent;

describe('el panel de accesos', () => {
  it('enseña quién está dentro, con su aparato y desde dónde', async () => {
    const fixture = await montar({ accesos: () => Promise.resolve([acceso()]) });

    expect(texto(fixture)).toContain('ana@example.com');
    expect(texto(fixture)).toContain('Chrome en Windows');
    expect(texto(fixture)).toContain('81.44.12.9');
    fixture.destroy();
  });

  /** Una sesión revocada, caducada o echada no está dentro, aunque exista. */
  it('distingue estar dentro de estar en la lista', async () => {
    const fixture = await montar({
      accesos: () =>
        Promise.resolve([
          acceso(),
          acceso({ id: 'fam-2', revocada: true }),
          acceso({ id: 'fam-3', expiraEn: AHORA - 1 }),
          acceso({ id: 'fam-4', fueraDelTodo: true }),
        ]),
    });
    const panel = fixture.componentInstance;

    expect(panel.accesos()).toHaveLength(4);
    expect(panel.dentro()).toBe(1);
    expect(panel.filtrados()).toHaveLength(1);

    panel.soloVivos.set(false);
    expect(panel.filtrados()).toHaveLength(4);
    fixture.destroy();
  });

  it('cerrar va contra ese aparato y no contra la persona', async () => {
    const cerrarAcceso = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({ accesos: () => Promise.resolve([acceso()]), cerrarAcceso });

    await fixture.componentInstance.cerrar(acceso());

    expect(cerrarAcceso).toHaveBeenCalledWith('fam-1');
    fixture.destroy();
  });

  /**
   * Echa de golpe todos los aparatos de esa persona, el móvil incluido, y no
   * se deshace: tiene que volver a entrar.
   */
  it('forzar relogin pide un segundo clic y va contra la cuenta', async () => {
    const forzarRelogin = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({ accesos: () => Promise.resolve([acceso()]), forzarRelogin });
    const panel = fixture.componentInstance;

    await panel.forzarRelogin(acceso());
    expect(forzarRelogin).not.toHaveBeenCalled();

    await panel.forzarRelogin(acceso());
    expect(forzarRelogin).toHaveBeenCalledWith('u1');
    fixture.destroy();
  });

  it('cuenta las personas, no los aparatos', async () => {
    const fixture = await montar({
      accesos: () =>
        Promise.resolve([
          acceso(),
          acceso({ id: 'fam-2', aparato: 'Safari en iPhone' }),
          acceso({
            id: 'fam-3',
            usuario: { id: 'u2', email: 'luis@example.com', displayName: 'Luis' },
          }),
        ]),
    });
    const panel = fixture.componentInstance;

    expect(panel.dentro()).toBe(3);
    expect(panel.personas()).toBe(2);
    fixture.destroy();
  });
});
