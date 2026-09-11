import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Sesiones } from './sesiones';
import { AgenteApiService } from '../../api/agente-api.service';
import { I18nService } from '../../services/i18n.service';
import type { ResumenDeSesion, Sesion as SesionAbierta } from '@devweb/shared/contracts/sesiones';

const RESUMEN: ResumenDeSesion = {
  id: 's1',
  proyecto: 'C--git',
  titulo: 'Arreglar el escritorio',
  rama: 'main',
  empezo: Date.parse('2026-09-10T10:00:00.000Z'),
  termino: Date.parse('2026-09-10T11:00:00.000Z'),
  tandas: 2,
  bytes: 4096,
};

/** Abierta por el final: las dos últimas de tres, empezando en la 1. */
const ABIERTA: SesionAbierta = {
  resumen: RESUMEN,
  total: 3,
  desde: 1,
  tandas: [
    {
      id: 't1',
      autor: 'yo',
      cuando: RESUMEN.empezo,
      deSubagente: false,
      partes: [{ clase: 'texto', texto: 'arregla el icono' }],
    },
    {
      id: 't2',
      autor: 'claude',
      cuando: RESUMEN.empezo,
      deSubagente: false,
      partes: [
        { clase: 'pensamiento', texto: 'sale de DESKTOP_ITEMS' },
        { clase: 'texto', texto: 'Voy a mirarlo.' },
        { clase: 'herramienta', nombre: 'Read', entrada: '{"file_path":"items.ts"}' },
      ],
    },
  ],
};

async function montar(agente: Partial<AgenteApiService>): Promise<ComponentFixture<Sesiones>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Sesiones],
    providers: [{ provide: AgenteApiService, useValue: agente }],
  }).compileComponents();
  TestBed.inject(I18nService).setLang('es');
  const fixture = TestBed.createComponent(Sesiones);
  // El primer pintado dispara `ngOnInit`, que arranca la búsqueda del agente;
  // se espera a que termine antes de mirar la pantalla.
  fixture.detectChanges();
  await fixture.componentInstance.arrancar();
  fixture.detectChanges();
  return fixture;
}

const texto = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent;

describe('el visor de sesiones', () => {
  /**
   * Que el agente esté apagado es el estado normal: corre en tu máquina y solo
   * mientras tú lo abres. Una pantalla en blanco parecería una avería.
   */
  it('sin agente, explica cómo abrirlo en vez de quedarse en blanco', async () => {
    const fixture = await montar({ disponible: () => Promise.resolve(false) });

    expect(texto(fixture)).toContain('El agente no está abierto');
    expect(texto(fixture)).toContain('npm run start -w @devweb/agente');
    fixture.destroy();
  });

  it('con agente, lista lo que hay', async () => {
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN]),
    });

    expect(texto(fixture)).toContain('Arreglar el escritorio');
    expect(texto(fixture)).toContain('main');
    fixture.destroy();
  });

  it('y se puede buscar entre ellas', async () => {
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN, { ...RESUMEN, id: 's2', titulo: 'Otra cosa' }]),
    });
    const panel = fixture.componentInstance;

    panel.busqueda.set('escritorio');

    expect(panel.listadas.map((s) => s.id)).toEqual(['s1']);
    fixture.destroy();
  });

  it('abrir una enseña la conversación', async () => {
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN]),
      sesion: () => Promise.resolve(ABIERTA),
    });

    await fixture.componentInstance.abrir(RESUMEN);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('arregla el icono');
    expect(texto(fixture)).toContain('Voy a mirarlo.');
    expect(texto(fixture)).toContain('Read');
    fixture.destroy();
  });

  /** Lo que Claude se dice a sí mismo ocupa más que lo que dice: va plegado. */
  it('lo que piensa no se enseña salvo que lo pidas', async () => {
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN]),
      sesion: () => Promise.resolve(ABIERTA),
    });
    const panel = fixture.componentInstance;

    await panel.abrir(RESUMEN);
    fixture.detectChanges();
    expect(texto(fixture)).not.toContain('sale de DESKTOP_ITEMS');

    panel.verPensamientos.set(true);
    fixture.detectChanges();
    expect(texto(fixture)).toContain('sale de DESKTOP_ITEMS');
    fixture.destroy();
  });

  /**
   * Una sesión se lee como un chat: se abre por lo último y lo de antes se
   * pide después. Pedir la tanda cero obligaba a paginar hacia adelante hasta
   * el final para ver lo que acababa de pasar.
   */
  it('se abre por el final, no por el principio', async () => {
    const sesion = vi.fn().mockResolvedValue(ABIERTA);
    const largo = { ...RESUMEN, tandas: 500 };
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([largo]),
      sesion,
    });

    await fixture.componentInstance.abrir(largo);

    expect(sesion).toHaveBeenCalledWith('s1', 440, 60);
    fixture.destroy();
  });

  /**
   * El agente lo actualiza el dueño de la máquina con un `pull`; la web se
   * despliega sola. Pedirle al agente que entienda algo nuevo para poder abrir
   * una sesión rompía el visor entero hasta que se actualizara.
   */
  it('el corte lo calcula la pantalla, sin pedirle nada nuevo al agente', async () => {
    const sesion = vi.fn().mockResolvedValue({ ...ABIERTA, desde: undefined });
    const corta = { ...RESUMEN, tandas: 2 };
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([corta]),
      sesion,
    });

    await fixture.componentInstance.abrir(corta);

    expect(sesion).toHaveBeenCalledWith('s1', 0, 60);
    expect(fixture.componentInstance.quedanPorLeer).toBe(0);
    fixture.destroy();
  });

  /** Hay sesiones de cinco mil tandas: se leen por tramos y se van pegando. */
  it('lo de antes se pide hacia atrás y se pega por arriba', async () => {
    const anterior = {
      ...ABIERTA,
      desde: 0,
      tandas: [
        {
          id: 't0',
          autor: 'claude' as const,
          cuando: RESUMEN.empezo,
          deSubagente: false,
          partes: [{ clase: 'texto' as const, texto: 'lo de antes' }],
        },
      ],
    };
    const sesion = vi.fn().mockResolvedValueOnce(ABIERTA).mockResolvedValueOnce(anterior);
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN]),
      sesion,
    });
    const panel = fixture.componentInstance;

    // Una tanda más de las que caben en una página: queda justo una detrás.
    await panel.abrir({ ...RESUMEN, tandas: 61 });
    expect(panel.quedanPorLeer).toBe(1);

    await panel.masTandas();
    fixture.detectChanges();

    expect(sesion).toHaveBeenLastCalledWith('s1', 0, 1);
    expect(panel.abierta()?.tandas.map((t) => t.id)).toEqual(['t0', 't1', 't2']);
    expect(panel.quedanPorLeer).toBe(0);
    expect(texto(fixture)).toContain('lo de antes');
    expect(texto(fixture)).toContain('arregla el icono');
    fixture.destroy();
  });

  it('si el agente se cae a mitad, se dice', async () => {
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN]),
      sesion: () => Promise.reject(new Error('Esa sesión no se ha podido abrir.')),
    });

    await fixture.componentInstance.abrir(RESUMEN);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('no se ha podido abrir');
    fixture.destroy();
  });
});
