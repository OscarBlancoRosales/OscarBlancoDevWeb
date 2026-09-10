import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Desktop } from './desktop';
import { DESKTOP_ITEMS, DesktopItem, GROUPS, itemsOf } from './desktop-items';
import { ShellModeService } from './shell-mode.service';

/**
 * El escritorio es la puerta de entrada: si esto se rompe, la web no se abre.
 */
describe('el escritorio', () => {
  let fixture: ComponentFixture<Desktop>;
  let desktop: Desktop;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Desktop],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Desktop);
    desktop = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /** El icono de un item por su id, tal y como lo pulsaría alguien. */
  function item(id: string): DesktopItem {
    const encontrado = DESKTOP_ITEMS.find((i) => i.id === id);
    if (!encontrado) throw new Error(`no hay ningún icono con el id «${id}»`);
    return encontrado;
  }

  /** El DOM del escritorio, con tipo: `nativeElement` es `any` a secas. */
  function dom(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('se pintan todos los iconos', () => {
    expect(dom().querySelectorAll('.icon').length).toBe(DESKTOP_ITEMS.length);
  });

  /** El botón de un icono, buscado por lo que se lee debajo. */
  function iconoDe(id: string): HTMLButtonElement {
    const etiqueta = desktop.label(item(id));
    const boton = Array.from(dom().querySelectorAll<HTMLButtonElement>('.icon')).find(
      (b) => b.querySelector('.icon-label')?.textContent.trim() === etiqueta,
    );
    if (!boton) throw new Error(`no se ve ningún icono que ponga «${etiqueta}»`);
    return boton;
  }

  it('un clic abre el icono: aquí no hay nada que seleccionar antes', async () => {
    // El doble clic es de los escritorios de verdad. En una web se siente roto:
    // pulsas y no pasa nada.
    iconoDe('uuid').click();
    // El contenido de la ventana se carga a demanda, así que abrir no es
    // inmediato: se espera a que aparezca en vez de suponer un tiempo.
    await vi.waitFor(() => {
      expect(desktop.state.windows.map((w) => w.id)).toEqual(['uuid']);
    });
  });

  it('y quien lo pulse dos veces por costumbre no acaba con dos ventanas', async () => {
    iconoDe('uuid').click();
    iconoDe('uuid').click();
    await vi.waitFor(() => {
      expect(desktop.state.windows.length).toBe(1);
    });
  });

  it('la barra de tareas está siempre, para poder volver de cualquier sitio', () => {
    expect(dom().querySelector('app-taskbar')).toBeTruthy();
  });

  it('abrir un icono monta su ventana', async () => {
    await desktop.launch(item('uuid'));
    expect(desktop.state.windows.map((w) => w.id)).toEqual(['uuid']);
  });

  it('y la ventana trae dentro la herramienta de verdad', async () => {
    await desktop.launch(item('uuid'));
    fixture.detectChanges();
    expect(dom().querySelector('app-desktop-window')).toBeTruthy();
  });

  it('abrir lo mismo dos veces no monta dos ventanas', async () => {
    await desktop.launch(item('uuid'));
    await desktop.launch(item('uuid'));
    expect(desktop.state.windows.length).toBe(1);
  });

  it('cerrar la quita de la pantalla y de la barra', async () => {
    await desktop.launch(item('uuid'));
    desktop.closeWindow('uuid');
    expect(desktop.state.windows).toEqual([]);
  });

  /**
   * Dentro del escritorio las herramientas no pintan su propio marco, o se
   * verían dos barras de título, una dentro de otra.
   */
  it('mientras se está en el escritorio, las herramientas van embebidas', () => {
    expect(TestBed.inject(ShellModeService).embedded()).toBe(true);
  });

  it('y al salir dejan de estarlo, para que su página suelta tenga marco', () => {
    fixture.destroy();
    expect(TestBed.inject(ShellModeService).embedded()).toBe(false);
  });

  describe('los iconos que hablan de mí', () => {
    it('«sobre mí» abre la terminal con el comando ya escrito', async () => {
      await desktop.launch(item('sobre-mi'));
      expect(desktop.inputsFor('sobre-mi')).toEqual({ initialCommand: 'whoami' });
    });

    it('y la terminal a secas se abre vacía', async () => {
      await desktop.launch(item('terminal'));
      expect(desktop.inputsFor('terminal')).toEqual({});
    });
  });

  /**
   * En una pantalla de móvil una ventana suelta no se puede ni agarrar: lo que
   * se abre ocupa todo y se vuelve por la barra de abajo.
   */
  describe('en el móvil', () => {
    it('lo que se abre sale a pantalla completa', async () => {
      desktop.mobile = true;
      await desktop.launch(item('uuid'));
      expect(desktop.state.windows[0].maximized).toBe(true);
    });
  });

  /**
   * La explicación de qué es esto va pintada en el fondo. Antes era un aviso
   * con su aspa, y quien la cerraba se quedaba sin saber nunca más de quién
   * era la web ni cómo moverse por ella.
   */
  describe('la firma del escritorio', () => {
    it('está siempre, como parte del fondo', () => {
      expect(dom().querySelector('.signature')).toBeTruthy();
    });

    it('no se puede cerrar: no hay nada que pulsar dentro', () => {
      const firma = dom().querySelector('.signature');
      expect(firma?.querySelector('button')).toBeNull();
    });

    it('sigue ahí después de abrir y cerrar cosas', async () => {
      await desktop.launch(item('uuid'));
      desktop.closeWindow('uuid');
      fixture.detectChanges();
      expect(dom().querySelector('.signature')).toBeTruthy();
    });

    it('cuenta quién soy y cómo moverse', () => {
      const texto = dom().querySelector('.signature')?.textContent ?? '';
      expect(texto).toContain('Oscar Blanco Rosales');
      expect(texto.length).toBeGreaterThan(80);
    });
  });

  /**
   * Dieciséis iconos en fila son una lista; por zonas se lee de un vistazo.
   */
  describe('las zonas del escritorio', () => {
    it('se pinta una banda por zona', () => {
      expect(dom().querySelectorAll('.zone').length).toBe(GROUPS.length);
    });

    it('cada banda lleva su nombre', () => {
      const titulos = Array.from(dom().querySelectorAll('.zone-title')).map(
        (t) => t.textContent.trim(),
      );
      expect(titulos).toEqual(GROUPS.map((g) => desktop.i18n.t(g.labelKey)));
    });

    it('entre todas las zonas están todos los iconos, sin repetir ninguno', () => {
      const repartidos = GROUPS.flatMap((g) => itemsOf(g.id)).map((i) => i.id);
      expect(repartidos.sort()).toEqual(DESKTOP_ITEMS.map((i) => i.id).sort());
    });

    it('ninguna zona se queda vacía', () => {
      for (const g of GROUPS) {
        expect(itemsOf(g.id).length, g.id).toBeGreaterThan(0);
      }
    });
  });

  /**
   * Quien recibe una invitación de Scrum Poker, o el enlace de una mesa,
   * aterrizaba antes en una pantalla suelta: votaba y se iba sin saber que
   * había algo más detrás. Ahora esas direcciones abren el escritorio con la
   * sección en una ventana a pantalla completa.
   */
  describe('cuando la dirección pide una sección', () => {
    let harness: RouterTestingHarness;

    afterEach(() => {
      harness.fixture.destroy();
    });

    /**
     * Monta el escritorio como lo monta el router de verdad, con esa
     * dirección: creándolo a mano, el escritorio no tendría su propia rama
     * del árbol de rutas y no vería nunca la sección.
     */
    async function entrarPor(url: string): Promise<Desktop> {
      fixture.destroy();
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      }).compileComponents();
      harness = await RouterTestingHarness.create();
      return harness.navigateByUrl(url, Desktop);
    }

    it('la sección se abre en su ventana', async () => {
      const desk = await entrarPor('/qr-generator');
      expect(desk.routeWin).toBe('qr');
      expect(desk.state.windows.map((w) => w.id)).toContain('qr');
    });

    it('y a pantalla completa, que es a lo que viene quien abre el enlace', async () => {
      const desk = await entrarPor('/qr-generator');
      expect(desk.state.windows.find((v) => v.id === 'qr')?.maximized).toBe(true);
    });

    it('con la barra de tareas detrás, para poder seguir a otra cosa', async () => {
      await entrarPor('/qr-generator');
      expect(harness.routeNativeElement?.querySelector('app-taskbar')).toBeTruthy();
    });

    /** El paso por la pantalla de nombre no puede sacarte del escritorio. */
    it('dos direcciones de la misma sección comparten ventana', async () => {
      const desk = await entrarPor('/scrum-poker');
      const antes = desk.state.windows.length;
      await harness.navigateByUrl('/name-screen');
      expect(desk.routeWin).toBe('poker');
      expect(desk.state.windows.length).toBe(antes);
    });

    it('cambiar de sección cierra la anterior', async () => {
      const desk = await entrarPor('/qr-generator');
      await harness.navigateByUrl('/uuid-generator');
      expect(desk.routeWin).toBe('uuid');
      expect(desk.state.windows.map((w) => w.id)).not.toContain('qr');
    });

    it('cerrar su ventana devuelve al escritorio', async () => {
      const desk = await entrarPor('/qr-generator');
      desk.closeWindow('qr');
      expect(desk.routeWin).toBeNull();
      expect(desk.state.windows).toEqual([]);
    });

    it('el escritorio a secas no abre ninguna ventana', async () => {
      const desk = await entrarPor('/');
      expect(desk.routeWin).toBeNull();
      expect(desk.state.windows).toEqual([]);
    });

    /**
     * Crear una sala pide sesión, y la pantalla de acceso echaba fuera del
     * escritorio justo en mitad del camino que acabábamos de arreglar.
     */
    it('las pantallas de cuenta también se quedan dentro', async () => {
      const desk = await entrarPor('/auth');
      expect(desk.routeWin).toBe('cuenta');
      expect(harness.routeNativeElement?.querySelector('app-taskbar')).toBeTruthy();
    });

    it('y los enlaces del correo, igual', async () => {
      const desk = await entrarPor('/auth/verificar');
      expect(desk.routeWin).toBe('cuenta');
    });

    /** No hay icono de «Cuenta», así que el título sale de la ruta. */
    it('una sección sin icono coge su título de la ruta, traducido', async () => {
      const desk = await entrarPor('/auth');
      const ventana = desk.state.windows.find((w) => w.id === 'cuenta');
      expect(ventana?.title).toBe(desk.i18n.t('desk.account'));
    });

    /** Pulsar su icono no puede montar otra cosa dentro de esa ventana. */
    it('el icono de una sección ya abierta solo la trae al frente', async () => {
      const desk = await entrarPor('/qr-generator');
      await desk.launch(item('qr'));
      expect(desk.state.windows.filter((w) => w.id === 'qr').length).toBe(1);
      expect(desk.loaded['qr']).toBeUndefined();
    });
  });

  /**
   * El nombre de la ventana se guardaba ya traducido, así que al cambiar de
   * idioma la barra de tareas se quedaba con «Códigos QR» en mitad de una web
   * en inglés.
   */
  describe('el nombre de las ventanas', () => {
    it('cambia de idioma con el resto', async () => {
      desktop.i18n.setLang('es');
      await desktop.launch(item('qr'));
      expect(desktop.state.windows[0].title).toBe('Códigos QR');

      desktop.i18n.setLang('en');
      expect(desktop.state.windows[0].title).toBe('QR codes');
    });

    it('y el de todas las abiertas a la vez', async () => {
      desktop.i18n.setLang('es');
      await desktop.launch(item('qr'));
      await desktop.launch(item('uuid'));

      desktop.i18n.setLang('en');
      const titulos = desktop.state.windows.map((w) => w.title);
      expect(titulos).toEqual(['QR codes', 'UUID']);
    });
  });

  describe('la barra de tareas', () => {
    it('tocar la ventana de delante la aparta', async () => {
      await desktop.launch(item('uuid'));
      desktop.toggleFromTaskbar('uuid');
      expect(desktop.state.windows[0].minimized).toBe(true);
    });

    it('y tocarla otra vez la devuelve', async () => {
      await desktop.launch(item('uuid'));
      desktop.toggleFromTaskbar('uuid');
      desktop.toggleFromTaskbar('uuid');
      expect(desktop.state.windows[0].minimized).toBe(false);
    });

    it('tocar una que estaba detrás la trae al frente sin minimizarla', async () => {
      await desktop.launch(item('uuid'));
      await desktop.launch(item('color'));
      desktop.toggleFromTaskbar('uuid');
      expect(desktop.active?.id).toBe('uuid');
      expect(desktop.state.windows.find((w) => w.id === 'uuid')?.minimized).toBe(false);
    });
  });
});
