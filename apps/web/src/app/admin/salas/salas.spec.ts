import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Salas } from './salas';
import { AdminApiService } from '../../api/admin-api.service';
import { I18nService } from '../../services/i18n.service';
import type { AdminRoom } from '@devweb/shared/contracts/admin';

const AHORA = Date.now();

function sala(cambios: Partial<AdminRoom> = {}): AdminRoom {
  return {
    id: 'sala-1',
    game: 'scrum',
    name: 'La mesa de Ana',
    status: 'playing',
    duenyo: { id: 'u1', email: 'ana@example.com', displayName: 'Ana' },
    asientos: [
      { id: 'a1', displayName: 'Ana', isBot: false, connected: true },
      { id: 'a2', displayName: 'Bot', isBot: true, connected: false },
    ],
    createdAt: AHORA,
    updatedAt: AHORA,
    ...cambios,
  };
}

async function montar(admin: Partial<AdminApiService>): Promise<ComponentFixture<Salas>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Salas],
    providers: [{ provide: AdminApiService, useValue: admin }],
  }).compileComponents();
  TestBed.inject(I18nService).setLang('es');
  const fixture = TestBed.createComponent(Salas);
  fixture.detectChanges();
  await fixture.componentInstance.refrescar();
  fixture.detectChanges();
  return fixture;
}

const texto = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent;

describe('el gestor de salas', () => {
  it('enseña las mesas con su dueño', async () => {
    const fixture = await montar({ salas: () => Promise.resolve([sala()]) });

    expect(texto(fixture)).toContain('La mesa de Ana');
    expect(texto(fixture)).toContain('ana@example.com');
    fixture.destroy();
  });

  /** Los bots ocupan asiento pero no son gente: la cuenta los separa. */
  it('cuenta las personas aparte de los asientos', async () => {
    const fixture = await montar({ salas: () => Promise.resolve([sala()]) });

    expect(fixture.componentInstance.personas(sala())).toBe(1);
    expect(fixture.componentInstance.conectadosEn(sala())).toBe(1);
    fixture.destroy();
  });

  /**
   * Cerrar una mesa ajena no se deshace: el primer clic solo avisa.
   */
  it('cerrar pide un segundo clic', async () => {
    const cerrarSala = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({ salas: () => Promise.resolve([sala()]), cerrarSala });
    const componente = fixture.componentInstance;

    await componente.cerrar(sala());
    expect(cerrarSala).not.toHaveBeenCalled();

    await componente.cerrar(sala());
    expect(cerrarSala).toHaveBeenCalledWith('sala-1');
    fixture.destroy();
  });

  it('echar a alguien va por su asiento', async () => {
    const echarAsiento = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({ salas: () => Promise.resolve([sala()]), echarAsiento });

    await fixture.componentInstance.echar(sala(), sala().asientos[0]);

    expect(echarAsiento).toHaveBeenCalledWith('sala-1', 'a1');
    fixture.destroy();
  });

  /** El botón de bloque se lleva partidas de otra gente: el primer clic avisa. */
  it('el borrado en bloque pide un segundo clic', async () => {
    const cerrarSalas = vi.fn().mockResolvedValue(0);
    const fixture = await montar({ salas: () => Promise.resolve([sala()]), cerrarSalas });
    const componente = fixture.componentInstance;

    await componente.cerrarEnBloque();
    expect(cerrarSalas).not.toHaveBeenCalled();

    await componente.cerrarEnBloque();
    expect(cerrarSalas).toHaveBeenCalled();
    fixture.destroy();
  });

  /** El número va en el botón, que es lo que hay que leer antes de pulsarlo. */
  it('el botón dice cuántas caen, y luego pregunta', async () => {
    const fixture = await montar({
      salas: () => Promise.resolve([sala(), sala({ id: 'sala-2' })]),
      cerrarSalas: () => Promise.resolve(0),
    });
    const componente = fixture.componentInstance;

    expect(componente.aviso).toContain('2');

    await componente.cerrarEnBloque();
    expect(componente.aviso).toContain('¿Seguro?');
    fixture.destroy();
  });

  /**
   * Entre los dos clics puede abrirse una mesa. Confirmar un número y
   * llevarse otro es exactamente lo que no puede pasar.
   */
  it('si cambia la cuenta entre los dos clics, vuelve a preguntar', async () => {
    const cerrarSalas = vi.fn().mockResolvedValue(0);
    const fixture = await montar({
      salas: () => Promise.resolve([sala(), sala({ id: 'sala-2', status: 'finished' })]),
      cerrarSalas,
    });
    const componente = fixture.componentInstance;

    await componente.cerrarEnBloque();
    componente.estado.set('finished');

    await componente.cerrarEnBloque();
    expect(cerrarSalas).not.toHaveBeenCalled();

    await componente.cerrarEnBloque();
    expect(cerrarSalas).toHaveBeenCalledWith({ estado: 'finished' });
    fixture.destroy();
  });

  /** Lo que dice el botón y lo que manda el filtro tienen que ser lo mismo. */
  it('la cuenta sigue al filtro, no a la búsqueda', async () => {
    const cerrarSalas = vi.fn().mockResolvedValue(0);
    const fixture = await montar({
      salas: () => Promise.resolve([sala(), sala({ id: 'sala-2', status: 'finished' })]),
      cerrarSalas,
    });
    const componente = fixture.componentInstance;

    componente.estado.set('finished');
    componente.busqueda.set('no existe esto');

    expect(componente.filtradas()).toHaveLength(0);
    expect(componente.enElFiltro()).toBe(1);

    await componente.cerrarEnBloque();
    await componente.cerrarEnBloque();
    expect(cerrarSalas).toHaveBeenCalledWith({ estado: 'finished' });
    fixture.destroy();
  });

  it('sin salas lo dice en vez de enseñar una tabla vacía', async () => {
    const fixture = await montar({ salas: () => Promise.resolve([]) });

    expect(texto(fixture)).toContain('No hay ninguna sala');
    fixture.destroy();
  });
});
