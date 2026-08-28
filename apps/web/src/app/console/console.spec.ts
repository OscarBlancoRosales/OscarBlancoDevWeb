import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Console } from './console';
import { navCommands } from './commands';

/**
 * La portada es la puerta de entrada al sitio: si una sección no está aquí, no
 * existe para quien llega. Estos tests son la red contra eso, porque la sección
 * de juegos se quedó fuera del menú aunque la ruta funcionara.
 */
describe('Console (la portada)', () => {
  let fixture: ComponentFixture<Console>;
  let component: Console;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Console],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Console);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Textos de los enlaces del menú desplegable. */
  function menuLabels(): string[] {
    // El menú se abre ANTES del primer pintado. Abrirlo después choca con la
    // detección automática de Angular en modo zoneless (NG0100).
    component.menuOpen = true;
    fixture.detectChanges();
    return Array.from(
      fixture.nativeElement.querySelectorAll('.menu-dropdown .menu-item') as NodeListOf<HTMLElement>,
    ).map((item) => item.textContent?.trim() ?? '');
  }

  it('el menú ofrece la sección de juegos', () => {
    expect(menuLabels().some((label) => label.includes('juegos'))).toBe(true);
  });

  it('y sigue ofreciendo el resto de secciones', () => {
    const labels = menuLabels().join(' ');
    for (const section of ['scrum-poker', 'dni-generator', 'qr-generator']) {
      expect(labels).toContain(section);
    }
  });

  it('el menú se pinta del registro, no de una lista a mano', () => {
    const labels = menuLabels().join(' ');
    for (const cmd of navCommands()) {
      expect(labels, cmd.id).toContain(cmd.id);
    }
  });

  describe('comandos de la terminal', () => {
    /**
     * Desde dónde empieza la salida del último comando: la terminal no se vacía
     * entre comandos, así que se marca por dónde iba.
     */
    let desde = 0;

    /** Ejecuta un comando y devuelve el espía de navegación ya resuelto. */
    function run(command: string) {
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      desde = component.output.length;
      component.currentCommand = command;
      component.executeCommand();
      vi.advanceTimersByTime(2000);
      return navigate;
    }

    /** Todo lo que se lee en pantalla tras el último comando, etiquetas incluidas. */
    function salida(): string {
      return component.output
        .slice(desde)
        .map((line) => `${component.lineLabel(line)} ${component.lineText(line)}`)
        .join('\n');
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('«juegos» lleva a la mesa de juegos', () => {
      expect(run('juegos')).toHaveBeenCalledWith(['/juegos']);
    });

    it('también valen «games» y «risk»', () => {
      expect(run('games')).toHaveBeenCalledWith(['/juegos']);
      expect(run('risk')).toHaveBeenCalledWith(['/juegos']);
    });

    it('cualquier sección del menú viaja escribiendo su nombre', () => {
      for (const cmd of navCommands()) {
        expect(run(cmd.id), cmd.id).toHaveBeenCalledWith([cmd.route]);
      }
    });

    it('y también por cualquiera de sus alias', () => {
      for (const cmd of navCommands()) {
        for (const alias of cmd.aliases) {
          expect(run(alias), alias).toHaveBeenCalledWith([cmd.route]);
        }
      }
    });

    it('«cd» lleva a la sección que le pidas', () => {
      expect(run('cd juegos')).toHaveBeenCalledWith(['/juegos']);
    });

    it('no responde a cualquier cosa', () => {
      const navigate = run('cualquiercosa');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('con una errata te propone lo que querías decir', () => {
      const navigate = run('jeugos');
      expect(navigate).not.toHaveBeenCalled();
      expect(salida()).toContain('juegos');
    });

    it('la ayuda menciona los juegos', () => {
      run('help');
      expect(salida().toLowerCase()).toContain('juegos');
    });

    it('la ayuda de un comando concreto explica solo ese', () => {
      run('help qr');
      expect(salida()).toContain('qr');
      expect(salida()).not.toContain('neofetch');
    });

    it('los proyectos mencionan los juegos', () => {
      run('projects');
      expect(salida()).toContain('RISK');
    });

    it('«ls» lista las secciones navegables', () => {
      run('ls');
      const texto = salida();
      for (const cmd of navCommands()) {
        expect(texto, cmd.id).toContain(cmd.id);
      }
    });

    it('«clear» deja la terminal vacía', () => {
      component.currentCommand = 'whoami';
      component.executeCommand();
      expect(component.output.length).toBeGreaterThan(0);
      component.currentCommand = 'clear';
      component.executeCommand();
      expect(component.output).toEqual([]);
    });

    it('se arranca con el verde de la casa', () => {
      expect(component.theme).toBe('dev');
    });

    it('«theme» cambia la piel y se acuerda al volver', () => {
      run('theme matrix');
      expect(component.theme).toBe('matrix');
      const alVolver = TestBed.createComponent(Console).componentInstance;
      expect(alVolver.theme).toBe('matrix');
    });

    it('un tema que no existe no rompe nada', () => {
      run('theme inventado');
      expect(component.theme).toBe('dev');
      expect(salida().toLowerCase()).toContain('inventado');
    });

    it('«lang en» cambia el idioma de la web', () => {
      run('lang en');
      expect(component.i18n.lang).toBe('en');
    });

    it('«echo» repite lo que le des', () => {
      run('echo hola mundo');
      expect(salida()).toContain('hola mundo');
    });

    it('«easteregg» destapa todos los comandos ocultos', () => {
      run('easteregg');
      const texto = salida();
      for (const secreto of ['snake', 'matrix', 'sudo', 'cowsay', 'sl', 'top']) {
        expect(texto, secreto).toContain(secreto);
      }
    });

    it('pero «easteregg» no sale en la ayuda normal', () => {
      run('help');
      expect(salida()).not.toContain('easteregg');
    });

    it('«theme» a secas te dice cuáles hay', () => {
      run('theme');
      const texto = salida();
      for (const tema of ['dev', 'ai', 'amber', 'ice', 'matrix']) {
        expect(texto, tema).toContain(tema);
      }
    });

    it('y «help theme» también los lista', () => {
      run('help theme');
      const texto = salida();
      for (const tema of ['dev', 'ai', 'amber']) {
        expect(texto, tema).toContain(tema);
      }
    });

    it('el tema cálido ya no se llama como una IA de nadie', () => {
      run('theme claude');
      expect(component.theme).toBe('dev');
      run('theme ai');
      expect(component.theme).toBe('ai');
    });

    it('el tema secreto no se anuncia en la lista', () => {
      run('theme');
      expect(salida()).not.toContain('vaporwave');
    });

    it('los secretos existen aunque no salgan en la ayuda', () => {
      run('sudo');
      expect(salida().length).toBeGreaterThan(0);
      run('help');
      expect(salida()).not.toContain('sudo');
    });
  });

  /**
   * Cambiar de bandera tiene que reescribir TAMBIÉN lo que ya está en pantalla.
   * Guardar el texto ya traducido dejaba la salida antigua congelada en el
   * idioma anterior, que es justo lo que se veía en la web.
   */
  describe('cambiar de idioma', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    /** Todo lo que se lee en pantalla ahora mismo. */
    function pantalla(): string {
      return component.output
        .map((line) => `${component.lineLabel(line)} ${component.lineText(line)}`)
        .join('\n');
    }

    it('reescribe lo que ya se había ejecutado', () => {
      component.currentCommand = 'whoami';
      component.executeCommand();
      const enEspanol = pantalla();
      component.i18n.setLang('en');
      expect(pantalla()).not.toBe(enEspanol);
    });

    it('y también el mensaje de bienvenida', () => {
      const bienvenida = () => component.lineText(component.output[3]);
      const enEspanol = bienvenida();
      component.i18n.setLang('en');
      expect(bienvenida()).not.toBe(enEspanol);
    });

    it('los nombres propios no se traducen', () => {
      component.i18n.setLang('en');
      expect(pantalla()).toContain('Oscar Blanco Rosales');
    });

    it('los errores también hablan tu idioma', () => {
      component.currentCommand = 'zzzzzzz';
      component.executeCommand();
      const enEspanol = pantalla();
      component.i18n.setLang('en');
      expect(pantalla()).not.toBe(enEspanol);
    });
  });

  /**
   * El logo y el tablero se pintan dentro de <pre> con un @for encima, que es
   * la parte más frágil de la plantilla: si se rompe, no salta ningún tipo,
   * simplemente aparece vacío.
   */
  describe('lo que se pinta', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    function texto(selector: string): string {
      return fixture.nativeElement.querySelector(selector)?.textContent ?? '';
    }

    it('el logo de iniciales aparece dibujado', () => {
      expect(texto('.logo')).toContain('█');
      expect(texto('.logo').split('\n').filter(Boolean).length).toBe(6);
    });

    it('la cabecera lleva el nombre completo, no un nombre interno', () => {
      const cabecera = texto('.header');
      expect(cabecera).toContain('Oscar Blanco Rosales');
      expect(cabecera).not.toContain('DevWeb');
    });

    it('el logo son las tres iniciales', () => {
      const filas = texto('.logo').split('\n').filter(Boolean);
      expect(filas.length).toBe(6);
      // Tres letras de bloque no caben en el ancho de dos.
      expect(filas[0].length).toBeGreaterThan(20);
    });

    it('al abrirse ya se puede escribir, sin tener que hacer clic', () => {
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.cmd-input'));
    });

    it('la barra de título es la de la casa, no la de Windows', () => {
      const barra = texto('.titlebar');
      expect(barra).toContain('OBR');
      expect(barra.toLowerCase()).not.toContain('powershell');
    });

    it('en ninguna parte de la pantalla asoma un nombre interno', () => {
      const todo = fixture.nativeElement.textContent as string;
      expect(todo).not.toContain('DevWeb');
      expect(todo.toLowerCase()).not.toContain('devweb');
    });

    it('la ventana trae sus tres controles', () => {
      expect(fixture.nativeElement.querySelectorAll('.win-btn').length).toBe(3);
    });

    it('el botón de apagar apaga el monitor, no cierra nada', () => {
      component.powerOff();
      expect(fixture.nativeElement.querySelector('.power-off')).toBeTruthy();
      component.powerOn();
      expect(fixture.nativeElement.querySelector('.power-off')).toBeFalsy();
    });

    it('plegar esconde la salida pero deja el prompt', () => {
      component.toggleFold();
      expect(fixture.nativeElement.querySelector('.stream')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('.cmd-input')).toBeTruthy();
    });
  });

  describe('el juego', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      fixture.detectChanges();
      component.currentCommand = 'snake';
      component.executeCommand();
      fixture.detectChanges();
    });

    afterEach(() => {
      component.quitGame();
    });

    it('«snake» monta el tablero en pantalla, con sus paredes', () => {
      const tablero = fixture.nativeElement.querySelector('.game-board');
      expect(tablero).toBeTruthy();
      // 14 filas de juego más la pared de arriba y la de abajo.
      const filas = tablero.textContent.split('\n').filter(Boolean);
      expect(filas.length).toBe(16);
      expect(filas[0]).toContain('─');
    });

    it('mientras se juega, el teclado mueve la serpiente y no escribe', () => {
      const antes = component.game!.dir;
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
      expect(component.game!.dir).not.toBe(antes);
      expect(component.currentCommand).toBe('');
    });

    it('los botones del móvil también giran', () => {
      component.steer('up');
      expect(component.game!.dir).toBe('up');
    });

    it('y girar tampoco mueve la pantalla', () => {
      const caja = fixture.nativeElement.querySelector('.cmd-input') as HTMLInputElement;
      const focos: unknown[] = [];
      caja.focus = ((opciones?: unknown) => focos.push(opciones)) as HTMLElement['focus'];
      component.steer('down');
      for (const opciones of focos) {
        expect(opciones).toEqual({ preventScroll: true });
      }
    });

    it('la serpiente se mueve sola con el tiempo', () => {
      const cabeza = { ...component.game!.snake[0] };
      vi.advanceTimersByTime(400);
      expect(component.game!.snake[0]).not.toEqual(cabeza);
    });

    it('Escape sale del juego y devuelve la terminal', () => {
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(component.game).toBeNull();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.game-board')).toBeFalsy();
    });

    it('el récord se guarda al morir', () => {
      component.game = { ...component.game!, score: 250 };
      component.game = { ...component.game!, over: true };
      component.quitGame();
      expect(component.gameBest).toBe(250);
    });

    /**
     * Salir con Esc no puede costarte la marca: se juega hasta que te cansas,
     * no hasta que te matan.
     */
    it('y también al salir por tu propio pie', () => {
      component.game = { ...component.game!, score: 90 };
      component.quitGame();
      expect(component.gameBest).toBe(90);
    });

    it('el récord sobrevive a recargar la página', () => {
      component.game = { ...component.game!, score: 90 };
      component.quitGame();
      const otra = TestBed.createComponent(Console).componentInstance;
      expect(otra.gameBest).toBe(90);
    });

    it('una marca peor no pisa la buena', () => {
      component.game = { ...component.game!, score: 200 };
      component.quitGame();
      component.currentCommand = 'snake';
      component.executeCommand();
      component.game = { ...component.game!, score: 10 };
      component.quitGame();
      expect(component.gameBest).toBe(200);
    });

    it('volver a jugar no repite el cartel de bienvenida', () => {
      const cuantasVeces = () =>
        component.output.filter((l) => l.key === 'console.snakeStart').length;
      expect(cuantasVeces()).toBe(1);
      component.restartGame();
      component.restartGame();
      expect(cuantasVeces()).toBe(1);
    });
  });

  describe('el corredor', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      fixture.detectChanges();
      component.currentCommand = 'runner';
      component.executeCommand();
      fixture.detectChanges();
    });

    afterEach(() => {
      if (component.run) component.quitRun();
    });

    it('«runner» monta la pista en pantalla', () => {
      const pista = fixture.nativeElement.querySelector('.runner-board');
      expect(pista).toBeTruthy();
      expect(pista.textContent).toContain('═');
    });

    it('«dino» también vale', () => {
      component.quitRun();
      component.currentCommand = 'dino';
      component.executeCommand();
      expect(component.run).not.toBeNull();
    });

    it('el espacio salta y no escribe un espacio en la terminal', () => {
      component.onCommandInput(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
      vi.advanceTimersByTime(200);
      expect(component.run!.y).toBeGreaterThan(0);
      expect(component.currentCommand).toBe('');
    });

    it('la flecha abajo agacha, y al soltarla se levanta', () => {
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
      expect(component.run!.ducking).toBe(true);
      component.onRunKeyUp(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
      expect(component.run!.ducking).toBe(false);
    });

    it('la carrera avanza sola', () => {
      const antes = component.run!.distance;
      vi.advanceTimersByTime(600);
      expect(component.run!.distance).toBeGreaterThan(antes);
    });

    it('y va más rápido según avanzas', () => {
      const primerTramo = () => {
        const antes = component.run!.distance;
        vi.advanceTimersByTime(1000);
        return component.run!.distance - antes;
      };
      const alPrincipio = primerTramo();
      component.run = { ...component.run!, distance: 900 };
      const masTarde = primerTramo();
      expect(masTarde).toBeGreaterThan(alPrincipio);
    });

    it('los corazones enseñan las vidas que quedan', () => {
      expect(component.runHearts).toContain('♥');
      component.run = { ...component.run!, lives: 1 };
      expect(component.runHearts.split('♥').length - 1).toBe(1);
    });

    it('Escape sale y devuelve la terminal', () => {
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(component.run).toBeNull();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.runner-board')).toBeFalsy();
    });

    it('el récord de metros se guarda al salir', () => {
      component.run = { ...component.run!, distance: 420 };
      component.quitRun();
      expect(component.runBest).toBe(420);
      const otra = TestBed.createComponent(Console).componentInstance;
      expect(otra.runBest).toBe(420);
    });

    it('los botones del móvil saltan y agachan', () => {
      component.runJump();
      vi.advanceTimersByTime(200);
      expect(component.run!.y).toBeGreaterThan(0);
    });

    /**
     * Mientras se juega, la línea de entrada está escondida arriba del todo.
     * Si un botón del pad le devuelve el foco, el navegador desplaza la
     * pantalla hasta ella y el tablero desaparece de la vista: pulsas para
     * saltar y lo que consigues es perder el juego de vista.
     */
    it('los botones del pad no desplazan la pantalla', () => {
      const caja = fixture.nativeElement.querySelector('.cmd-input') as HTMLInputElement;
      const focos: unknown[] = [];
      caja.focus = ((opciones?: unknown) => focos.push(opciones)) as HTMLElement['focus'];

      component.runJump();
      component.runDuck();

      for (const opciones of focos) {
        expect(opciones, 'enfocar sin preventScroll arrastra la pantalla').toEqual({
          preventScroll: true,
        });
      }
    });

    it('mientras corres no estorban los chips ni el prompt', () => {
      expect(fixture.nativeElement.querySelector('.chips')).toBeFalsy();
    });
  });

  describe('el teclado', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    /** Simula una tecla en el input de la terminal. */
    function tecla(key: string, extra: Partial<KeyboardEventInit> = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, ...extra });
      component.onCommandInput(event);
      return event;
    }

    it('el tabulador completa el comando a medias', () => {
      component.currentCommand = 'jue';
      tecla('Tab');
      expect(component.currentCommand).toBe('juegos');
    });

    it('el tabulador no se traga la tecla si no hay nada que completar', () => {
      component.currentCommand = 'zzzz';
      expect(tecla('Tab').defaultPrevented).toBe(true);
      expect(component.currentCommand).toBe('zzzz');
    });

    it('con varios candidatos completa lo que tienen en común', () => {
      component.currentCommand = 'col';
      tecla('Tab');
      expect(component.currentCommand).toBe('color');
    });

    it('y cuando ya no hay nada común, enseña los candidatos', () => {
      const desde = component.output.length;
      component.currentCommand = 'color';
      tecla('Tab');
      expect(
        component.output
          .slice(desde)
          .map((l) => component.lineText(l))
          .join(' '),
      ).toContain('color-picker');
    });

    it('la flecha arriba recupera el comando anterior', () => {
      component.currentCommand = 'whoami';
      component.executeCommand();
      tecla('ArrowUp');
      expect(component.currentCommand).toBe('whoami');
    });

    it('y la flecha abajo vuelve a dejar la línea limpia', () => {
      component.currentCommand = 'whoami';
      component.executeCommand();
      tecla('ArrowUp');
      tecla('ArrowDown');
      expect(component.currentCommand).toBe('');
    });

    it('el historial sobrevive a recargar la página', () => {
      component.currentCommand = 'whoami';
      component.executeCommand();
      const otra = TestBed.createComponent(Console).componentInstance;
      expect(otra.history).toContain('whoami');
    });

    it('Ctrl+L limpia la pantalla', () => {
      component.currentCommand = 'whoami';
      component.executeCommand();
      tecla('l', { ctrlKey: true });
      expect(component.output).toEqual([]);
    });

    it('Ctrl+C cancela lo que estabas escribiendo', () => {
      component.currentCommand = 'a medio escribir';
      tecla('c', { ctrlKey: true });
      expect(component.currentCommand).toBe('');
    });

    it('Ctrl+K abre la paleta de comandos', () => {
      tecla('k', { ctrlKey: true });
      expect(component.paletteOpen).toBe(true);
    });
  });

  /**
   * El texto vive en dos sitios: la propiedad y la caja de texto real. Si solo
   * se limpia la propiedad, lo siguiente que escribes se pega a lo anterior y
   * acabas ejecutando «helpjuegos».
   */
  describe('la caja de texto de verdad', () => {
    let input: HTMLInputElement;

    beforeEach(() => {
      fixture.detectChanges();
      input = fixture.nativeElement.querySelector('.cmd-input');
    });

    /** Escribe como escribiría una persona: en el DOM, no en la propiedad. */
    function teclear(texto: string): void {
      input.value = texto;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    // Nada de detectChanges tras la accion: lo que se comprueba es justo que el
    // componente escribe en la caja sin esperar a un ciclo de deteccion.
    it('al ejecutar, la caja se queda vacía', () => {
      teclear('whoami');
      component.executeCommand();
      expect(input.value).toBe('');
    });

    it('Ctrl+C también vacía la caja', () => {
      teclear('a medias');
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      expect(input.value).toBe('');
    });

    it('el tabulador escribe la parte completada en la caja', () => {
      teclear('jue');
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
      expect(input.value).toBe('juegos');
    });

    it('la flecha arriba trae el comando anterior a la caja', () => {
      teclear('whoami');
      component.executeCommand();
      component.onCommandInput(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(input.value).toBe('whoami');
    });

    it('tocar una sugerencia la escribe en la caja', () => {
      component.applySuggestion('juegos');
      expect(input.value).toBe('juegos');
    });
  });

  describe('las pistas mientras escribes', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('el texto fantasma completa lo que falta', () => {
      component.currentCommand = 'jue';
      expect(component.ghost).toBe('gos');
    });

    it('sin nada escrito no hay fantasma', () => {
      component.currentCommand = '';
      expect(component.ghost).toBe('');
    });

    it('las sugerencias táctiles ofrecen los candidatos', () => {
      component.currentCommand = 'q';
      expect(component.suggestions).toContain('qr');
    });

    it('con la línea vacía se ofrecen atajos para empezar', () => {
      component.currentCommand = '';
      expect(component.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('la paleta de comandos', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('se abre y se lleva el foco, para poder escribir directamente', () => {
      component.openPalette();
      const caja = fixture.nativeElement.querySelector('.palette-input');
      expect(caja, 'la paleta debe estar pintada').toBeTruthy();
      expect(document.activeElement).toBe(caja);
    });

    it('al cerrarse devuelve el foco a la terminal', () => {
      component.openPalette();
      component.closePalette();
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.cmd-input'));
    });

    /**
     * En la portada no basta con navegar: el comando se ejecuta de verdad, y
     * por eso queda escrito en el historial como si lo hubieras tecleado.
     */
    it('al elegir una entrada se ejecuta y se cierra', () => {
      vi.useFakeTimers();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.paletteOpen = true;
      component.runFromPalette('juegos');
      vi.advanceTimersByTime(2000);
      expect(navigate).toHaveBeenCalledWith(['/juegos']);
      expect(component.paletteOpen).toBe(false);
      expect(component.history).toContain('juegos');
    });
  });
});
