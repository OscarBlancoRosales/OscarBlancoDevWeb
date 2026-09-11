import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Consola } from './consola';
import { AgenteApiService } from '../../api/agente-api.service';
import { I18nService } from '../../services/i18n.service';

const VACIA = { mensajes: [], permisos: [] };

/** Un canal escuchando, que es el caso normal: una sesión abierta. */
const UNO = [{ puerto: 4319, proyecto: 'DevWeb' }];

async function montar(agente: Partial<AgenteApiService>): Promise<ComponentFixture<Consola>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [Consola],
    providers: [
      { provide: AgenteApiService, useValue: { hablarCon: vi.fn(), ...agente } },
    ],
  }).compileComponents();
  TestBed.inject(I18nService).setLang('es');
  const fixture = TestBed.createComponent(Consola);
  fixture.detectChanges();
  await fixture.componentInstance.arrancar();
  fixture.detectChanges();
  return fixture;
}

const texto = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent;

describe('la consola contra tu sesión', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin canal, dice cómo levantarlo', async () => {
    const fixture = await montar({ canales: () => Promise.resolve([]) });

    expect(texto(fixture)).toContain('No hay ninguna sesión escuchando');
    fixture.destroy();
  });

  /**
   * El emparejamiento es la frontera entera: sin él no se escribe. Y el código
   * sale por el terminal, no por la red, así que hay que estar delante del
   * ordenador una vez.
   */
  it('con canal pero sin emparejar, pide emparejar', async () => {
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: false,
    });

    expect(texto(fixture)).toContain('no está emparejado');
    fixture.destroy();
  });

  it('pedir el código no lo enseña en pantalla: lo manda al terminal', async () => {
    const pedirCodigo = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: false,
      pedirCodigo,
    });

    await fixture.componentInstance.pedirCodigo();
    fixture.detectChanges();

    expect(pedirCodigo).toHaveBeenCalled();
    expect(texto(fixture)).toContain('Mira el terminal');
  });

  it('con el código bueno, este aparato queda dentro', async () => {
    const emparejar = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: false,
      emparejar,
      conversacion: () => Promise.resolve(VACIA),
    });
    const consola = fixture.componentInstance;

    consola.codigo = '123456';
    await consola.emparejar();
    fixture.detectChanges();

    expect(emparejar).toHaveBeenCalledWith('123456');
    expect(consola.emparejado()).toBe(true);
    fixture.destroy();
  });

  it('emparejado, lo que escribes se manda y se limpia el cuadro', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: true,
      escribir,
      conversacion: () => Promise.resolve(VACIA),
    });
    const consola = fixture.componentInstance;

    consola.texto = 'arregla el icono';
    await consola.enviar();

    expect(escribir).toHaveBeenCalledWith('arregla el icono');
    expect(consola.texto).toBe('');
    fixture.destroy();
  });

  it('un mensaje en blanco no se manda', async () => {
    const escribir = vi.fn();
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: true,
      escribir,
      conversacion: () => Promise.resolve(VACIA),
    });

    fixture.componentInstance.texto = '   ';
    await fixture.componentInstance.enviar();

    expect(escribir).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('se ve lo que Claude ha contestado', async () => {
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: true,
      conversacion: () =>
        Promise.resolve({
          mensajes: [
            { de: 'yo' as const, texto: 'arregla el icono', cuando: Date.now() },
            { de: 'claude' as const, texto: 'Hecho, con su prueba.', cuando: Date.now() },
          ],
          permisos: [],
        }),
    });

    expect(texto(fixture)).toContain('arregla el icono');
    expect(texto(fixture)).toContain('Hecho, con su prueba.');
    fixture.destroy();
  });

  describe('los permisos que Claude pide', () => {
    const conPermiso = {
      mensajes: [],
      permisos: [
        { id: 'abcde', herramienta: 'Bash', descripcion: 'Ejecutar las pruebas', detalle: 'npm test' },
      ],
    };

    it('se ven, con lo que quiere hacer', async () => {
      const fixture = await montar({
        canales: () => Promise.resolve(UNO),
        emparejado: true,
        conversacion: () => Promise.resolve(conPermiso),
      });

      expect(texto(fixture)).toContain('Bash');
      expect(texto(fixture)).toContain('npm test');
      expect(texto(fixture)).toContain('Permitir');
      fixture.destroy();
    });

    it('y se contestan desde aquí', async () => {
      const decidir = vi.fn().mockResolvedValue(undefined);
      const fixture = await montar({
        canales: () => Promise.resolve(UNO),
        emparejado: true,
        conversacion: () => Promise.resolve(conPermiso),
        decidir,
      });

      await fixture.componentInstance.decidir('abcde', 'allow');

      expect(decidir).toHaveBeenCalledWith('abcde', 'allow');
      fixture.destroy();
    });
  });

  /**
   * Un canal por repositorio abierto. El emparejamiento vale para todos,
   * porque la lista de aparatos es una sola y vive en tu carpeta de usuario:
   * emparejas una vez y hablas con la sesión que quieras.
   */
  describe('con varios repositorios abiertos', () => {
    const DOS = [
      { puerto: 4319, proyecto: 'DevWeb' },
      { puerto: 4320, proyecto: 'OneToolOne' },
    ];

    it('se pueden elegir, y con uno solo no hay nada que elegir', async () => {
      const conDos = await montar({
        canales: () => Promise.resolve(DOS),
        emparejado: true,
        conversacion: () => Promise.resolve(VACIA),
      });

      expect(texto(conDos)).toContain('DevWeb');
      expect(texto(conDos)).toContain('OneToolOne');
      conDos.destroy();

      const conUno = await montar({
        canales: () => Promise.resolve(UNO),
        emparejado: true,
        conversacion: () => Promise.resolve(VACIA),
      });

      expect(
        (conUno.nativeElement as HTMLElement).querySelectorAll('.con-canal'),
      ).toHaveLength(0);
      conUno.destroy();
    });

    it('al empezar se habla con la primera que esté escuchando', async () => {
      const hablarCon = vi.fn();
      const fixture = await montar({
        canales: () => Promise.resolve(DOS),
        emparejado: true,
        conversacion: () => Promise.resolve(VACIA),
        hablarCon,
      });

      expect(hablarCon).toHaveBeenCalledWith(4319);
      expect(fixture.componentInstance.canal()?.proyecto).toBe('DevWeb');
      fixture.destroy();
    });

    it('y cambiar de una a otra no mezcla las conversaciones', async () => {
      const hablarCon = vi.fn();
      const fixture = await montar({
        canales: () => Promise.resolve(DOS),
        emparejado: true,
        conversacion: () =>
          Promise.resolve({
            mensajes: [{ de: 'yo' as const, texto: 'lo de DevWeb', cuando: Date.now() }],
            permisos: [],
          }),
        hablarCon,
      });
      fixture.detectChanges();
      expect(texto(fixture)).toContain('lo de DevWeb');

      await fixture.componentInstance.cambiarDeCanal(DOS[1]);

      expect(hablarCon).toHaveBeenLastCalledWith(4320);
      expect(fixture.componentInstance.canal()?.proyecto).toBe('OneToolOne');
      fixture.destroy();
    });
  });

  /**
   * Si el canal deja de reconocer a este aparato, insistir cada dos segundos
   * no arregla nada: se dice y se para.
   */
  it('si el canal nos olvida, se deja de insistir', async () => {
    const conversacion = vi.fn().mockRejectedValue(new Error('Este aparato ya no está emparejado.'));
    const fixture = await montar({
      canales: () => Promise.resolve(UNO),
      emparejado: true,
      conversacion,
    });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('ya no está emparejado');
    expect(fixture.componentInstance.emparejado()).toBe(false);
    fixture.destroy();
  });
});
