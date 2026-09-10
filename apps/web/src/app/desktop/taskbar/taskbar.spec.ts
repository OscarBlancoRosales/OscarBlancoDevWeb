import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { Taskbar } from './taskbar';
import type { PublicUser } from '@devweb/shared/contracts/auth';

/**
 * La barra de tareas es lo único que está siempre a la vista, así que es
 * donde tiene que poder hacerse todo sin saber ningún comando: buscar,
 * cambiar de idioma y volver a lo que tienes abierto.
 */
describe('la barra de tareas', () => {
  let fixture: ComponentFixture<Taskbar>;
  let bar: Taskbar;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [Taskbar] }).compileComponents();
    fixture = TestBed.createComponent(Taskbar);
    bar = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function dom(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Repinta: sin zone.js hay que avisar de que el estado ha cambiado. */
  function pintar(): void {
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
  }

  describe('el menú de inicio', () => {
    it('empieza cerrado', () => {
      expect(dom().querySelector('.menu')).toBeNull();
    });

    it('el botón de inicio lo abre y lo vuelve a cerrar', () => {
      bar.toggleMenu();
      pintar();
      expect(dom().querySelector('.menu')).toBeTruthy();

      bar.toggleMenu();
      pintar();
      expect(dom().querySelector('.menu')).toBeNull();
    });

    it('abrir algo cierra el menú, para no dejarlo tapando la ventana', () => {
      bar.openMenu();
      bar.open(bar.results[0]);
      expect(bar.menuOpen).toBe(false);
    });

    it('lo que elijas se le cuenta al escritorio', () => {
      let abierto = '';
      bar.launch.subscribe((item) => (abierto = item.id));
      bar.open(bar.results[0]);
      expect(abierto).toBe(bar.results[0].id);
    });
  });

  describe('el buscador', () => {
    /** Escribe en el buscador como lo haría alguien. */
    function buscar(texto: string): void {
      bar.openMenu();
      bar.query = texto;
      pintar();
    }

    it('sin escribir nada se ofrece todo', () => {
      bar.openMenu();
      expect(bar.results.length).toBeGreaterThan(5);
    });

    it('escribir filtra la lista', () => {
      bar.openMenu();
      const todos = bar.results.length;
      buscar('qr');
      expect(bar.results.length).toBeLessThan(todos);
      expect(bar.results.some((i) => i.id === 'qr')).toBe(true);
    });

    it('lo que no existe no devuelve nada y se dice', () => {
      buscar('zzzznoexiste');
      expect(bar.results).toEqual([]);
      expect(dom().querySelector('.menu-empty')).toBeTruthy();
    });

    /** Buscar y pulsar Enter: el gesto de siempre, sin tocar el ratón. */
    it('Enter abre lo primero de la lista', () => {
      let abierto = '';
      bar.launch.subscribe((item) => (abierto = item.id));
      buscar('qr');
      const primero = bar.results[0].id;
      bar.onSearchKey(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(abierto).toBe(primero);
    });

    it('Escape cierra el menú sin abrir nada', () => {
      let abierto = false;
      bar.launch.subscribe(() => (abierto = true));
      buscar('qr');
      bar.onSearchKey(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(bar.menuOpen).toBe(false);
      expect(abierto).toBe(false);
    });

    it('cerrar el menú deja el buscador limpio para la próxima', () => {
      buscar('qr');
      bar.closeMenu();
      expect(bar.query).toBe('');
    });
  });

  describe('el idioma', () => {
    it('se puede cambiar desde la barra, sin buscar la bandera', () => {
      const i18n = TestBed.inject(I18nService);
      bar.setLang('en');
      expect(i18n.lang).toBe('en');
      bar.setLang('es');
      expect(i18n.lang).toBe('es');
    });

    it('hay un botón por idioma y se ve cuál está puesto', () => {
      bar.setLang('es');
      pintar();
      const botones = Array.from(dom().querySelectorAll('.lang-btn'));
      expect(botones.length).toBe(2);
      expect(botones.filter((b) => b.classList.contains('on')).length).toBe(1);
    });
  });

  describe('el reloj', () => {
    it('marca la hora en horas y minutos', () => {
      expect(bar.clock()).toMatch(/^\d{2}:\d{2}$/);
    });

    it('y la fecha debajo', () => {
      expect(bar.today()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });

  describe('las ventanas abiertas', () => {
    it('cada una tiene su botón', () => {
      fixture.componentRef.setInput('windows', [
        { id: 'qr', title: 'qr', x: 0, y: 0, width: 400, height: 300, minimized: false, maximized: false, z: 1 },
        { id: 'uuid', title: 'uuid', x: 0, y: 0, width: 400, height: 300, minimized: true, maximized: false, z: 2 },
      ]);
      pintar();
      expect(dom().querySelectorAll('.task').length).toBe(2);
    });

    it('tocar su botón se lo dice al escritorio', () => {
      let tocada = '';
      bar.toggled.subscribe((id) => (tocada = id));
      bar.toggled.emit('qr');
      expect(tocada).toBe('qr');
    });
  });
});

/**
 * En un escritorio, la sesión vive al pie del menú de inicio. Aquí igual: no
 * hay icono en el fondo porque quien pasa por la web no tiene por qué ver una
 * puerta que no le sirve, y quien la busca sabe dónde mirar.
 */
describe('la cuenta, al pie del menú de inicio', () => {
  let fixture: ComponentFixture<Taskbar>;
  let bar: Taskbar;

  const JEFE: PublicUser = {
    id: 'u1',
    email: 'jefe@ejemplo.com',
    displayName: 'Óscar',
    status: 'active',
    role: 'admin',
  };

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [Taskbar] }).compileComponents();
    fixture = TestBed.createComponent(Taskbar);
    bar = fixture.componentInstance;
    TestBed.inject(I18nService).setLang('es');
    fixture.detectChanges();
  });

  const pie = (): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('.menu-cuenta');

  it('sin sesión invita a entrar', () => {
    bar.openMenu();
    fixture.detectChanges();

    expect(pie()?.textContent).toContain('Entrar en tu cuenta');
  });

  it('y al pulsarlo pide abrir el acceso, cerrando el menú', () => {
    let pedido = 0;
    bar.entrar.subscribe(() => (pedido += 1));
    bar.openMenu();
    fixture.detectChanges();
    pie()?.click();

    expect(pedido).toBe(1);
    expect(bar.menuOpen).toBe(false);
  });

  it('con sesión enseña de quién es y ofrece salir', () => {
    bar.usuario = JEFE;
    bar.openMenu();
    fixture.detectChanges();

    expect(pie()?.textContent).toContain('Óscar');
    expect(pie()?.textContent).toContain('Cerrar sesión');
  });

  it('y ahí se sale', () => {
    let salidas = 0;
    bar.salir.subscribe(() => (salidas += 1));
    bar.usuario = JEFE;
    bar.openMenu();
    fixture.detectChanges();
    pie()?.click();

    expect(salidas).toBe(1);
  });

  /** El buscador ofrece lo que se puede abrir, y eso depende de quién mira. */
  it('el panel solo se encuentra buscándolo si mandas', () => {
    bar.query = 'admin';
    expect(bar.results.map((i) => i.id)).not.toContain('admin');

    bar.usuario = JEFE;
    expect(bar.results.map((i) => i.id)).toContain('admin');
  });
});
