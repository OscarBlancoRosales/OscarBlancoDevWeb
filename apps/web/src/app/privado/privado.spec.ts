import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Privado } from './privado';
import { AuthApiService } from '../api/auth-api.service';
import { PrivadoApiService } from '../api/privado-api.service';
import { I18nService } from '../services/i18n.service';
import type { PublicUser } from '@devweb/shared/contracts/auth';
import type { DocumentoPrivado } from '@devweb/shared/contracts/privado';

const JEFE: PublicUser = {
  id: 'u-jefe',
  email: 'jefe@ejemplo.com',
  displayName: 'Jefe',
  status: 'active',
  role: 'admin',
};

const DOCS: DocumentoPrivado[] = [
  { ruta: 'documentos/00-indice.html', titulo: 'Índice', grupo: 'documentos' },
  { ruta: 'documentos/02-til.html', titulo: 'TIL para todos', grupo: 'documentos' },
  { ruta: 'maquetas/perfil-stock.html', titulo: 'Gestión de stock', grupo: 'maquetas' },
];

function apiDePrueba(): Partial<PrivadoApiService> {
  return {
    lista: vi.fn().mockResolvedValue(DOCS),
    documento: vi
      .fn()
      .mockImplementation((ruta: string) =>
        Promise.resolve(`<style>h1{color:teal}</style><h1>${ruta}</h1><script>window.x=1</script>`),
      ),
    invitar: vi
      .fn()
      .mockResolvedValue({ id: 'i1', codigo: 'abc123def456', caduca: Date.now() + 3_600_000 }),
    invitaciones: vi.fn().mockResolvedValue([]),
    revocar: vi.fn().mockResolvedValue(undefined),
    canjear: vi.fn().mockResolvedValue({ pase: 'pase-firmado', caduca: Date.now() + 3_600_000 }),
  };
}

async function montar(
  usuario: PublicUser | null,
  api: Partial<PrivadoApiService>,
  codigo: string | null = null,
): Promise<ComponentFixture<Privado>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Privado],
    providers: [
      provideRouter([]),
      { provide: PrivadoApiService, useValue: api },
      { provide: AuthApiService, useValue: { restaurar: vi.fn().mockResolvedValue(undefined), usuario } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(codigo ? { codigo } : {}) } },
      },
    ],
  }).compileComponents();
  TestBed.inject(I18nService).setLang('es');
  const fixture = TestBed.createComponent(Privado);
  await fixture.componentInstance.arrancar();
  fixture.detectChanges();
  return fixture;
}

const raiz = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;

describe('lo privado', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('sin sesión de administrador ni pase, solo pide el código y no lista nada', async () => {
    const api = apiDePrueba();
    const f = await montar(null, api);
    expect(raiz(f).querySelector('#privado-codigo')).toBeInstanceOf(HTMLInputElement);
    expect(api.lista).not.toHaveBeenCalled();
    expect(raiz(f).querySelector('iframe')).toBeNull();
    f.destroy();
  });

  it('el administrador ve la lista por grupos y el primer documento en un visor aislado', async () => {
    const api = apiDePrueba();
    const f = await montar(JEFE, api);
    expect(api.lista).toHaveBeenCalledWith(null);
    const botones = [...raiz(f).querySelectorAll('.privado-doc')].map((b) => b.textContent.trim());
    expect(botones).toEqual(['Índice', 'TIL para todos', 'Gestión de stock']);
    const visor = raiz(f).querySelector('iframe');
    expect(visor).toBeInstanceOf(HTMLIFrameElement);
    expect(visor?.getAttribute('sandbox')).toBe('allow-scripts allow-popups');
    const doc = visor?.getAttribute('srcdoc') ?? '';
    expect(doc).toContain('<h1>documentos/00-indice.html</h1>');
    // El diseño de cada documento va dentro: si se pierde, solo queda texto sobre blanco.
    expect(doc).toContain('<style>h1{color:teal}</style>');
    expect(doc).toContain('<script>window.x=1</script>');
    f.destroy();
  });

  it('el administrador crea una invitación y ve el código y hasta cuándo vale', async () => {
    const api = apiDePrueba();
    const f = await montar(JEFE, api);
    await f.componentInstance.invitar();
    f.detectChanges();
    expect(raiz(f).querySelector('.privado-codigo-hecho')?.textContent).toBe('abc123def456');
    expect(f.componentInstance.enlace()).toContain('/privado?codigo=abc123def456');
    f.destroy();
  });

  it('el enlace de la familia dura 7 días, se ve con sus entradas y se quita', async () => {
    const api = apiDePrueba();
    const vivo = {
      id: 'g1',
      tipo: 'grupo' as const,
      nota: 'Familia',
      creada: Date.now(),
      caduca: Date.now() + 7 * 86_400_000,
      canjes: 3,
      revocada: false,
    };
    api.invitaciones = vi.fn().mockResolvedValue([vivo]);
    const f = await montar(JEFE, api);
    await f.componentInstance.invitar({ dias: 7, nota: 'Familia' });
    f.detectChanges();
    expect(api.invitar).toHaveBeenCalledWith({ dias: 7, nota: 'Familia' });
    const fila = raiz(f).querySelector('.privado-enlaces li');
    expect(fila).toBeInstanceOf(HTMLLIElement);
    expect(fila?.textContent).toContain('Familia');
    expect(fila?.textContent).toContain('3 entradas');

    api.invitaciones = vi.fn().mockResolvedValue([{ ...vivo, revocada: true }]);
    await f.componentInstance.revocar('g1');
    f.detectChanges();
    expect(api.revocar).toHaveBeenCalledWith('g1');
    expect(raiz(f).querySelector('.privado-enlaces')).toBeNull();
    f.destroy();
  });

  it('con un código en el enlace, lo canjea una vez y entra con el pase', async () => {
    const api = apiDePrueba();
    const f = await montar(null, api, 'abc123def456');
    expect(api.canjear).toHaveBeenCalledWith('abc123def456');
    expect(api.lista).toHaveBeenCalledWith('pase-firmado');
    expect(api.documento).toHaveBeenCalledWith('documentos/00-indice.html', 'pase-firmado');
    expect(raiz(f).querySelector('iframe')).toBeInstanceOf(HTMLIFrameElement);
    f.destroy();

    // Recargar no vuelve a gastar el código: el pase sigue en la pestaña.
    const otra = apiDePrueba();
    const g = await montar(null, otra);
    expect(otra.canjear).not.toHaveBeenCalled();
    expect(otra.lista).toHaveBeenCalledWith('pase-firmado');
    g.destroy();
  });

  it('un enlace entre documentos abre el otro, y uno que no está en la lista no abre nada', async () => {
    const api = apiDePrueba();
    const f = await montar(JEFE, api);
    const visor = raiz(f).querySelector('iframe');
    const desde = visor?.contentWindow ?? null;
    const enviar = (destino: string): void => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { privadoAbrir: destino }, source: desde }),
      );
    };
    enviar('02-til.html');
    await vi.waitFor(() => {
      expect(api.documento).toHaveBeenCalledWith('documentos/02-til.html', null);
    });
    enviar('../../etc/passwd.html');
    await new Promise((r) => setTimeout(r, 20));
    expect(api.documento).toHaveBeenCalledTimes(2);
    f.destroy();
  });
});
