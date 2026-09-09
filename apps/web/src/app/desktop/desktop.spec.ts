import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Desktop } from './desktop';
import { DESKTOP_ITEMS } from './desktop-items';
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
  function item(id: string) {
    return DESKTOP_ITEMS.find((i) => i.id === id)!;
  }

  it('se pintan todos los iconos', () => {
    const iconos = fixture.nativeElement.querySelectorAll('.icon');
    expect(iconos.length).toBe(DESKTOP_ITEMS.length);
  });

  it('la barra de tareas está siempre, para poder volver de cualquier sitio', () => {
    expect(fixture.nativeElement.querySelector('app-taskbar')).toBeTruthy();
  });

  it('abrir un icono monta su ventana', async () => {
    await desktop.launch(item('uuid'));
    expect(desktop.state.windows.map((w) => w.id)).toEqual(['uuid']);
  });

  it('y la ventana trae dentro la herramienta de verdad', async () => {
    await desktop.launch(item('uuid'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-desktop-window')).toBeTruthy();
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

  describe('el cartel de bienvenida', () => {
    it('sale la primera vez, que es cuando hace falta', () => {
      expect(desktop.showWelcome).toBe(true);
      expect(fixture.nativeElement.querySelector('.welcome')).toBeTruthy();
    });

    it('se puede quitar y no vuelve a aparecer', () => {
      desktop.dismissWelcome();
      // El primero se destruye antes de abrir el segundo: dos escritorios
      // vivos a la vez chocan con la detección automática (NG0100).
      fixture.destroy();
      const otra = TestBed.createComponent(Desktop);
      otra.detectChanges();
      expect(otra.componentInstance.showWelcome).toBe(false);
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
