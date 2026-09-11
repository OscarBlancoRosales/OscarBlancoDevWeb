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

const ABIERTA: SesionAbierta = {
  resumen: RESUMEN,
  total: 3,
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

    panel.busqueda = 'escritorio';

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

  /** Hay sesiones de cinco mil tandas: se leen por tramos y se van pegando. */
  it('trae más tandas sin perder las que ya estaban', async () => {
    const segunda = {
      ...ABIERTA,
      tandas: [
        {
          id: 't3',
          autor: 'claude' as const,
          cuando: RESUMEN.empezo,
          deSubagente: false,
          partes: [{ clase: 'texto' as const, texto: 'ya está' }],
        },
      ],
    };
    const sesion = vi.fn().mockResolvedValueOnce(ABIERTA).mockResolvedValueOnce(segunda);
    const fixture = await montar({
      disponible: () => Promise.resolve(true),
      sesiones: () => Promise.resolve([RESUMEN]),
      sesion,
    });
    const panel = fixture.componentInstance;

    await panel.abrir(RESUMEN);
    expect(panel.quedanPorLeer).toBe(1);

    await panel.masTandas();
    fixture.detectChanges();

    expect(panel.abierta()?.tandas).toHaveLength(3);
    expect(texto(fixture)).toContain('arregla el icono');
    expect(texto(fixture)).toContain('ya está');
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
