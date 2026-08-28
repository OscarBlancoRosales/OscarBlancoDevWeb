import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommandPalette } from '../shared/command-palette/command-palette';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
// AfterViewInit va aparte: solo hace falta para dejar el cursor puesto.
import { I18nService } from '../services/i18n.service';
import { SECRET_THEME, Theme, ThemeService } from '../services/theme.service';
import {
  CommandDef,
  COMMANDS,
  completions,
  findCommand,
  navCommands,
  suggest,
  visibleCommands,
} from './commands';
import { banner, cowsay, fakeTop, fortune, hackLog, TRAIN } from './eggs';
import { MatrixRain } from './matrix-rain';
import { Dir, newGame, renderFramed, SnakeState, step, turn } from './snake';
import {
  duck,
  jump,
  newRun,
  renderRun,
  RunnerState,
  tick as runTick,
} from './runner';

/** Cada línea de la terminal sabe qué es, y de ahí sale su color. */
export type LineKind =
  | 'cmd'
  | 'text'
  | 'ok'
  | 'warn'
  | 'error'
  | 'muted'
  | 'title'
  | 'link'
  | 'art'
  | 'theme'
  | 'kv';

/**
 * Una línea de salida.
 *
 * Guarda la CLAVE de traducción, no el texto: si guardara el texto ya
 * traducido, cambiar de idioma dejaría congelado en pantalla todo lo anterior.
 * Lo que no se traduce nunca -nombres propios, URLs, arte ASCII- va en `raw`.
 */
export interface OutLine {
  kind: LineKind;
  key?: string;
  params?: Record<string, string>;
  raw?: string;
  labelKey?: string;
  label?: string;
  href?: string;
  /** Retraso de aparición, en ms. Solo lo usa el arranque. */
  delay?: number;
}


/** Lo que tarda en «viajar»: suficiente para ver el rastro, no para aburrir. */
const NAV_DELAY_MS = 320;
const HISTORY_KEY = 'console_history';
const SNAKE_BEST_KEY = 'console_snake_best';
const RUN_BEST_KEY = 'console_run_best';
const HISTORY_MAX = 60;

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

const EXTERNAL_LINKS: Record<string, string> = {
  github: 'https://github.com/oscarblanco-dev',
  linkedin: 'https://www.linkedin.com/in/oscar-blanco-a5108b349/',
  email: 'mailto:oscar.blanco.r@gmail.com',
  web: 'https://www.oscarblancorosales.com',
};

/** Las tres iniciales en bloques: la firma de la casa. */
export const LOGO: string[] = [
  ' ██████╗ ██████╗ ██████╗ ',
  '██╔═══██╗██╔══██╗██╔══██╗',
  '██║   ██║██████╔╝██████╔╝',
  '██║   ██║██╔══██╗██╔══██╗',
  '╚██████╔╝██████╔╝██║  ██║',
  ' ╚═════╝ ╚═════╝ ╚═╝  ╚═╝',
];

@Component({
  selector: 'app-console',
  imports: [CommonModule, CommandPalette],
  templateUrl: './console.html',
  styleUrl: './console.css',
})
export class Console implements OnInit, AfterViewInit, OnDestroy {
  /** Todo lo que se ve en el cuerpo de la terminal. */
  output: OutLine[] = [];
  currentCommand = '';
  history: string[] = [];

  menuOpen = false;
  paletteOpen = false;
  paletteQuery = '';
  navigating = false;

  /** Controles de la ventana: plegada y apagada. */
  folded = false;
  poweredOff = false;
  glitchOn = false;
  matrixOn = false;

  /** La partida en curso, o null si no se está jugando. */
  game: SnakeState | null = null;
  gameBest = 0;

  /** La carrera en curso, o null si no se está corriendo. */
  run: RunnerState | null = null;
  runBest = 0;

  /** El reloj de la barra de estado se repinta solo; por eso es una señal. */
  clock = signal('');

  readonly menuItems = navCommands();
  readonly logo = LOGO;
  readonly startedAt = Date.now();

  @ViewChild('cmdInput') private cmdInput?: ElementRef<HTMLInputElement>;
  @ViewChild(CommandPalette) private palette?: CommandPalette;
  @ViewChild('body') private body?: ElementRef<HTMLElement>;
  @ViewChild('rain') private rain?: ElementRef<HTMLCanvasElement>;

  /** Posición en el historial: -1 es «la línea que estoy escribiendo». */
  private historyIndex = -1;
  private draft = '';
  private langSub?: Subscription;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private gameTimer: ReturnType<typeof setInterval> | undefined;
  private runTimer: ReturnType<typeof setTimeout> | undefined;
  private trainTimer: ReturnType<typeof setInterval> | undefined;
  private matrix: MatrixRain | undefined;
  private konamiAt = 0;
  private destroyed = false;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    public i18n: I18nService,
    public themes: ThemeService,
  ) {
    this.history = this.readStored(HISTORY_KEY, [] as string[]);
    this.gameBest = Number(this.readStored(SNAKE_BEST_KEY, 0)) || 0;
    this.runBest = Number(this.readStored(RUN_BEST_KEY, 0)) || 0;
  }

  ngOnInit(): void {
    this.printBoot();
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    // Cambiar de bandera reescribe la pantalla entera, porque las líneas
    // guardan la clave y no el texto.
    this.langSub = this.i18n.langChange$.subscribe(() => this.refresh());
  }

  /**
   * Una terminal está lista para escribir en cuanto se abre. En móvil no: ahí
   * enfocar solo sirve para que salte el teclado y te tape media pantalla.
   */
  ngAfterViewInit(): void {
    if (!this.isTouch()) this.focusInput();
  }

  private isTouch(): boolean {
    try {
      return window.matchMedia?.('(pointer: coarse)').matches ?? false;
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.langSub?.unsubscribe();
    this.stopAllTimers();
  }

  // ===== TRADUCCIÓN AL PINTAR =====

  lineText(line: OutLine): string {
    if (line.key) return this.i18n.t(line.key, line.params);
    return line.raw ?? '';
  }

  lineLabel(line: OutLine): string {
    if (line.labelKey) return this.i18n.t(line.labelKey);
    return line.label ?? '';
  }

  // ===== ARRANQUE =====

  /**
   * El arranque no bloquea: deja las líneas puestas y el CSS las va revelando,
   * así se puede escribir desde el primer instante.
   */
  private printBoot(): void {
    const lines: OutLine[] = [
      { kind: 'kv', label: 'user', raw: 'Oscar Blanco Rosales' },
      { kind: 'kv', label: 'stack', raw: 'C# · Angular · Flutter · Firebase' },
      { kind: 'kv', label: 'host', raw: 'oscarblancorosales.com' },
      {
        kind: 'ok',
        key: 'console.bootWelcome',
        params: { sections: String(navCommands().length) },
      },
      { kind: 'muted', key: 'console.bootTip' },
    ];
    lines.forEach((line, i) => this.output.push({ ...line, delay: 120 + i * 70 }));
  }

  private tickClock(): void {
    if (this.destroyed) return;
    const now = new Date();
    const dosDigitos = (n: number) => String(n).padStart(2, '0');
    this.clock.set(
      `${dosDigitos(now.getHours())}:${dosDigitos(now.getMinutes())}:${dosDigitos(now.getSeconds())}`,
    );
  }

  // ===== ENTRADA =====

  onCommandInput(event: KeyboardEvent): void {
    if (this.poweredOff) {
      event.preventDefault();
      this.powerOn();
      return;
    }
    if (this.matrixOn) {
      event.preventDefault();
      this.stopMatrix();
      return;
    }
    if (this.game) return this.gameKey(event);
    if (this.run) return this.runKey(event);
    this.trackKonami(event);

    if (event.ctrlKey || event.metaKey) {
      const tecla = event.key.toLowerCase();
      if (tecla === 'l') {
        event.preventDefault();
        this.output = [];
        return;
      }
      if (tecla === 'c') {
        event.preventDefault();
        this.setCommand('');
        this.historyIndex = -1;
        return;
      }
      if (tecla === 'k') {
        event.preventDefault();
        this.openPalette();
        return;
      }
      return;
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.executeCommand();
        return;
      case 'Tab':
        event.preventDefault();
        this.completeCommand();
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.walkHistory(1);
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.walkHistory(-1);
        return;
      case 'Escape':
        this.setCommand('');
        this.historyIndex = -1;
        return;
      default:
        this.historyIndex = -1;
    }
  }

  /** Lo que escribe la persona: la caja manda y el modelo la sigue. */
  onInput(event: Event): void {
    this.currentCommand = (event.target as HTMLInputElement).value;
  }

  /**
   * Escribir por código. El texto vive en dos sitios -la propiedad y la caja
   * real- y hay que tocar los dos: si solo se limpia la propiedad, lo
   * siguiente que teclees se pega a lo anterior.
   */
  private setCommand(valor: string): void {
    this.currentCommand = valor;
    const caja = this.cmdInput?.nativeElement;
    if (caja) {
      caja.value = valor;
      caja.setSelectionRange(valor.length, valor.length);
    }
  }

  /** Lo que falta para completar el comando, en gris detrás del cursor. */
  get ghost(): string {
    const escrito = this.currentCommand;
    if (!escrito.trim() || escrito.includes(' ')) return '';
    const candidatos = completions(escrito);
    return candidatos.length ? candidatos[0].slice(escrito.length) : '';
  }

  /** Chips táctiles: lo que se puede tocar en el móvil en vez de tabular. */
  get suggestions(): string[] {
    const escrito = this.currentCommand.trim();
    if (!escrito) return ['help', 'juegos', 'projects', 'whoami', 'contact'];
    return completions(escrito).slice(0, 6);
  }

  /** Al tocar un chip: lo completa y deja el cursor listo para seguir. */
  applySuggestion(nombre: string): void {
    this.setCommand(nombre);
    this.focusInput();
  }

  private completeCommand(): void {
    const escrito = this.currentCommand.trim();
    const candidatos = completions(escrito);
    if (candidatos.length === 0) return;

    const comun = commonPrefix(candidatos);
    if (comun.length > escrito.length) {
      this.setCommand(comun);
      return;
    }
    // Ya no hay nada común que añadir: como en bash, se enseñan las opciones.
    if (candidatos.length > 1) {
      this.say('muted', 'console.candidates');
      this.lit('text', '  ' + candidatos.join('   '));
      this.refresh();
      this.scrollToBottom();
    }
  }

  private walkHistory(paso: number): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1 && paso > 0) this.draft = this.currentCommand;

    const siguiente = this.historyIndex + paso;
    if (siguiente < 0) {
      this.historyIndex = -1;
      this.setCommand(this.draft);
      return;
    }
    if (siguiente >= this.history.length) return;

    this.historyIndex = siguiente;
    this.setCommand(this.history[this.history.length - 1 - siguiente]);
  }

  // ===== EJECUCIÓN =====

  executeCommand(): void {
    const raw = this.currentCommand.trim();
    this.setCommand('');
    this.historyIndex = -1;
    this.draft = '';
    if (!raw) return;

    this.lit('cmd', raw);
    this.remember(raw);

    const [nombre, ...args] = raw.split(/\s+/);
    const cmd = findCommand(nombre);
    if (!cmd) {
      const parecido = suggest(nombre);
      if (parecido) {
        this.say('warn', 'console.didYouMean', { cmd: nombre, guess: parecido });
      } else {
        this.say('error', 'console.unknownCmd', { cmd: nombre });
      }
    } else {
      this.dispatch(cmd, args);
    }

    this.refresh();
    this.scrollToBottom();
  }

  /** Reparte el comando a quien toque. */
  private dispatch(cmd: CommandDef, args: string[]): void {
    switch (cmd.id) {
      case 'help':
        return this.doHelp(args[0]);
      case 'clear':
        this.output = [];
        return;
      case 'ls':
        return this.doList();
      case 'cd':
        return this.doCd(args[0]);
      case 'open':
        return this.doOpen(args[0]);
      case 'theme':
        return this.doTheme(args[0]);
      case 'lang':
        return this.doLang(args[0]);
      case 'history':
        return this.doHistory();
      case 'date':
        return this.doDate();
      case 'echo':
        this.lit('text', args.join(' '));
        return;
      case 'whoami':
        return this.doWhoami();
      case 'stack':
        return this.doStack();
      case 'projects':
        return this.doProjects();
      case 'contact':
      case 'social':
        return this.doContact();
      case 'neofetch':
        return this.doNeofetch();

      // --- premios de la casa ---
      case 'easteregg':
        return this.doEasterEggs();
      case 'snake':
        return this.startGame();
      case 'runner':
        return this.startRun();
      case 'matrix':
        return this.doMatrix();
      case 'hack':
        return this.doHack();
      case 'glitch':
        return this.doGlitch();
      case 'sl':
        return this.doTrain();
      case 'cowsay':
        return this.art(cowsay(args.join(' ')));
      case 'fortune':
        this.lit('text', fortune(Math.floor(Math.random() * 1000)));
        return;
      case 'banner':
        return this.art(banner(args.join(' ') || 'OBR'));
      case 'top':
        return this.art(fakeTop(() => Math.random()));
      case 'sudo':
        this.say('warn', 'console.sudo');
        return;
      case 'coffee':
        this.say('text', 'console.coffee');
        return;
      case 'vim':
        this.say('text', 'console.vim');
        return;
      case 'exit':
        this.say('warn', 'console.exit');
        return;
      case '42':
        this.say('ok', 'console.answer');
        return;

      default:
        if (cmd.route) return this.go(cmd.route);
        this.say('error', 'console.unknownCmd', { cmd: cmd.id });
    }
  }

  /** Viajar con un rastro visible: se ve a dónde vas antes de irte. */
  private go(route: string): void {
    this.navigating = true;
    this.say('muted', 'console.opening', { route });
    setTimeout(() => {
      this.navigating = false;
      this.router.navigate([route]);
      this.refresh();
    }, NAV_DELAY_MS);
  }

  private doHelp(target?: string): void {
    if (target) return this.doHelpFor(target);

    const grupos: Array<[string, CommandDef['group']]> = [
      ['console.groupNav', 'nav'],
      ['console.groupInfo', 'info'],
      ['console.groupSystem', 'system'],
    ];
    for (const [tituloKey, grupo] of grupos) {
      this.say('title', tituloKey);
      for (const cmd of visibleCommands().filter((c) => c.group === grupo)) {
        this.output.push({
          kind: 'kv',
          key: cmd.descKey,
          label: cmd.id + (cmd.args ? ' ' + cmd.args : ''),
        });
      }
    }
    this.say('muted', 'console.helpFooter');
  }

  private doHelpFor(target: string): void {
    const cmd = findCommand(target);
    if (!cmd || cmd.group === 'secret') {
      this.say('error', 'console.helpNoSuch', { cmd: target });
      return;
    }
    this.lit('title', cmd.id);
    this.output.push({ kind: 'text', key: cmd.descKey });
    if (cmd.args) {
      this.say('muted', 'console.helpUsageLine', { usage: `${cmd.id} ${cmd.args}` });
    }
    // `help theme` sin la lista de temas no ayuda a nadie.
    if (cmd.id === 'theme') this.listThemes();
    if (cmd.aliases.length) {
      this.say('muted', 'console.helpAliasesLine', { aliases: cmd.aliases.join(', ') });
    }
    if (cmd.route) this.lit('muted', `  → ${cmd.route}`);
  }

  private doList(): void {
    this.say('title', 'console.sectionsTitle');
    for (const cmd of navCommands()) {
      this.output.push({ kind: 'kv', key: cmd.descKey, label: cmd.id + '/' });
    }
  }

  private doCd(target?: string): void {
    if (!target) {
      this.say('error', 'console.needsArg', { cmd: 'cd', usage: 'cd <seccion>' });
      return;
    }
    if (target === '..' || target === '~' || target === '/') return this.go('/');

    const cmd = findCommand(target);
    if (cmd?.route) return this.go(cmd.route);

    const parecido = suggest(target);
    if (parecido) {
      this.say('warn', 'console.didYouMean', { cmd: target, guess: parecido });
    } else {
      this.say('error', 'console.unknownCmd', { cmd: target });
    }
  }

  private doOpen(target?: string): void {
    if (!target) {
      this.say('error', 'console.needsArg', { cmd: 'open', usage: 'open <enlace>' });
      return;
    }
    const url = EXTERNAL_LINKS[target.toLowerCase()];
    if (!url) {
      this.say('error', 'console.openUnknown', { target });
      return;
    }
    this.say('ok', 'console.opened', { target });
    this.output.push({ kind: 'link', raw: url, href: url });
    try {
      window.open(url, '_blank', 'noopener');
    } catch {
      // Si el navegador lo bloquea, el enlace de arriba sigue estando ahí.
    }
  }

  private doTheme(target?: string): void {
    if (!target) return this.listThemes();

    if (!this.themes.set(target.toLowerCase() as Theme)) {
      this.say('error', 'console.themeUnknown', { theme: target });
      this.listThemes();
      return;
    }
    this.say('ok', 'console.themeSet', { theme: this.theme });
  }

  /** El tema lo lleva el sitio entero; la consola solo lo consulta. */
  get theme(): Theme {
    return this.themes.current;
  }

  /**
   * Los temas, uno por línea y con su muestra de color: una lista metida en
   * una frase no se lee, y saber cuáles hay es la mitad de la gracia.
   */
  private listThemes(): void {
    this.say('title', 'console.themesTitle');
    for (const tema of this.themes.listed()) {
      this.output.push({
        kind: 'theme',
        raw: tema,
        label: tema,
        key: tema === this.theme ? 'console.themeInUse' : `console.themeDesc.${tema}`,
      });
    }
    this.say('muted', 'console.themeHowTo');
  }

  /** Todos los premios de la casa, de golpe. */
  private doEasterEggs(): void {
    this.say('title', 'console.eggsTitle');
    for (const cmd of COMMANDS.filter((c) => c.group === 'secret')) {
      this.output.push({
        kind: 'kv',
        key: cmd.descKey,
        label: cmd.id + (cmd.args ? ' ' + cmd.args : ''),
      });
    }
    this.say('muted', 'console.eggsFooter');
  }

  private doLang(target?: string): void {
    if (!target) {
      this.say('text', 'console.langSet', { lang: this.i18n.lang });
      return;
    }
    const lang = target.toLowerCase();
    if (lang !== 'es' && lang !== 'en') {
      this.say('error', 'console.langUnknown', { lang: target });
      return;
    }
    this.i18n.setLang(lang);
    this.say('ok', 'console.langSet', { lang });
  }

  private doHistory(): void {
    if (this.history.length === 0) {
      this.say('muted', 'console.historyEmpty');
      return;
    }
    this.history.forEach((cmd, i) => {
      this.output.push({ kind: 'kv', raw: cmd, label: String(i + 1).padStart(3, ' ') });
    });
  }

  private doDate(): void {
    const ahora = new Date();
    this.lit('text', ahora.toLocaleString(this.i18n.lang === 'en' ? 'en-GB' : 'es-ES'));
    this.say('muted', 'console.uptimeLine', { secs: String(this.uptime()) });
  }

  private doWhoami(): void {
    this.lit('title', 'Oscar Blanco Rosales');
    this.output.push({ kind: 'kv', labelKey: 'console.role', raw: 'Full Stack Developer' });
    this.output.push({ kind: 'kv', labelKey: 'console.experience', key: 'console.expYears' });
    this.output.push({
      kind: 'kv',
      labelKey: 'console.specialization',
      raw: 'C#, Flutter, Angular',
    });
    this.output.push({ kind: 'kv', labelKey: 'console.location', key: 'console.spain' });
    this.say('text', 'console.aboutPassion');
  }

  private doStack(): void {
    this.say('title', 'console.stackTitle');
    this.output.push({ kind: 'kv', label: 'Frontend', raw: 'Angular, TypeScript, Flutter' });
    this.output.push({ kind: 'kv', label: 'Backend', raw: 'C#, .NET' });
    this.output.push({
      kind: 'kv',
      labelKey: 'console.databases',
      raw: 'SQL Server, PostgreSQL, MongoDB, MySQL',
    });
    this.output.push({ kind: 'kv', label: 'Cloud', raw: 'Firebase, Azure' });
    this.output.push({ kind: 'kv', label: 'DevOps', raw: 'Docker, Kubernetes, CI/CD' });
  }

  private doProjects(): void {
    this.say('title', 'console.projectsTitle');
    for (const key of [
      'console.projectGames',
      'console.projectPoker',
      'console.projectDni',
      'console.projectPortfolio',
      'console.projectMultiple',
    ]) {
      this.say('text', key);
    }
  }

  private doContact(): void {
    this.say('title', 'console.contactTitle');
    for (const [nombre, url] of Object.entries(EXTERNAL_LINKS)) {
      this.output.push({
        kind: 'link',
        raw: url.replace('mailto:', ''),
        label: nombre,
        href: url,
      });
    }
  }

  private doNeofetch(): void {
    this.lit('title', 'Oscar Blanco Rosales');
    this.output.push({ kind: 'kv', label: 'OS', raw: 'OBR Terminal v2' });
    this.output.push({ kind: 'kv', label: 'Kernel', raw: 'Angular 21 · zoneless' });
    this.output.push({ kind: 'kv', label: 'Commands', raw: String(COMMANDS.length) });
    this.output.push({ kind: 'kv', label: 'Sections', raw: String(navCommands().length) });
    this.output.push({ kind: 'kv', label: 'Theme', raw: this.theme });
    this.output.push({ kind: 'kv', label: 'Locale', raw: this.i18n.lang });
    this.output.push({ kind: 'kv', label: 'Uptime', raw: `${this.uptime()}s` });
    if (this.gameBest) {
      this.output.push({ kind: 'kv', label: 'Snake', raw: String(this.gameBest) });
    }
  }

  // ===== PREMIOS DE LA CASA =====

  /** Arte ASCII: no se traduce nunca, se pinta tal cual. */
  private art(lineas: string[]): void {
    for (const l of lineas) this.lit('art', l);
  }

  private doMatrix(): void {
    this.say('ok', 'console.matrixOn');
    this.matrixOn = true;
    this.refresh();
    const canvas = this.rain?.nativeElement;
    if (canvas) {
      this.matrix = new MatrixRain(canvas);
      this.matrix.start();
    }
  }

  /** Cualquier tecla o toque corta la lluvia. */
  stopMatrix(): void {
    if (!this.matrixOn) return;
    this.matrix?.stop();
    this.matrix = undefined;
    this.matrixOn = false;
    this.refresh();
    this.focusInput();
  }

  private doGlitch(): void {
    this.glitchOn = true;
    this.say('warn', 'console.glitch');
    setTimeout(() => {
      this.glitchOn = false;
      this.refresh();
    }, 2200);
  }

  /** El acceso al mainframe, línea a línea para que dé tiempo a leerlo. */
  private doHack(): void {
    const pasos = hackLog();
    pasos.forEach((paso, i) => {
      setTimeout(() => {
        if (this.destroyed) return;
        this.lit(i === pasos.length - 1 ? 'ok' : 'muted', paso);
        this.refresh();
        this.scrollToBottom();
      }, i * 420);
    });
  }

  /** El tren cruza la pantalla de derecha a izquierda y se lleva sus líneas. */
  private doTrain(): void {
    const desde = this.output.length;
    let offset = 60;

    const pintar = () => {
      this.output.length = desde;
      for (const vagon of TRAIN) {
        this.lit('art', ' '.repeat(Math.max(0, offset)) + vagon.slice(Math.max(0, -offset)));
      }
      this.refresh();
    };

    pintar();
    this.trainTimer = setInterval(() => {
      offset -= 4;
      if (offset < -TRAIN[0].length) {
        this.clearTimer('trainTimer');
        this.output.length = desde;
        this.say('muted', 'console.trainGone');
        this.refresh();
        return;
      }
      pintar();
    }, 90);
  }

  // ===== SNAKE =====

  /**
   * `anunciar` es falso al reintentar: el cartel de instrucciones ya está
   * arriba y repetirlo en cada muerte llena la terminal de lo mismo.
   */
  private startGame(anunciar = true): void {
    this.clearTimer('gameTimer');
    this.game = newGame(28, 14, Math.random);
    if (anunciar) this.say('ok', 'console.snakeStart');
    this.refresh();
    this.focusInput();
    this.gameTimer = setInterval(() => this.tickGame(), 130);
  }

  private tickGame(): void {
    if (!this.game || this.destroyed) return;
    this.game = step(this.game, Math.random);
    if (this.game.over) this.endGame();
    this.refresh();
  }

  /**
   * Apunta la marca. Se llama tanto al morir como al salir con Esc: irse por
   * tu propio pie no puede costarte el récord que acabas de hacer.
   */
  private endGame(): void {
    this.clearTimer('gameTimer');
    const puntos = this.game?.score ?? 0;
    if (puntos > this.gameBest) {
      this.gameBest = puntos;
      this.store(SNAKE_BEST_KEY, puntos);
    }
  }

  /** Filas del tablero con sus paredes, listas para pintar. */
  get gameRows(): string[] {
    return this.game ? renderFramed(this.game) : [];
  }

  /** Mientras se juega, el teclado es del juego y no de la terminal. */
  private gameKey(event: KeyboardEvent): void {
    const teclas: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const dir = teclas[event.key] ?? teclas[event.key.toLowerCase()];
    if (dir) {
      event.preventDefault();
      this.game = turn(this.game!, dir);
      this.refresh();
      return;
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'q') {
      event.preventDefault();
      this.quitGame();
      return;
    }
    if (event.key === 'Enter' && this.game?.over) {
      event.preventDefault();
      this.startGame();
    }
  }

  /** Los botones de dirección del móvil. */
  steer(dir: Dir): void {
    if (!this.game) return;
    this.game = turn(this.game, dir);
    this.focusInput();
  }

  quitGame(): void {
    this.endGame();
    const puntos = this.game?.score ?? 0;
    this.game = null;
    this.say('muted', 'console.snakeEnd', {
      score: String(puntos),
      best: String(this.gameBest),
    });
    this.setCommand('');
    this.refresh();
    this.focusInput();
  }

  restartGame(): void {
    this.endGame();
    this.startGame(false);
  }

  // ===== RUNNER =====

  private startRun(anunciar = true): void {
    this.stopRunTimer();
    this.run = newRun(46, 9);
    if (anunciar) this.say('ok', 'console.runStart');
    this.refresh();
    this.focusInput();
    this.scheduleRun();
  }

  /**
   * El paso se reprograma cada vez en lugar de usar un intervalo fijo: así la
   * carrera se acelera con la distancia, que es lo que la hace difícil.
   */
  private scheduleRun(): void {
    const ritmo = Math.max(55, 110 - Math.floor((this.run?.distance ?? 0) / 12));
    this.runTimer = setTimeout(() => this.tickRun(), ritmo);
  }

  private tickRun(): void {
    if (!this.run || this.destroyed) return;
    this.run = runTick(this.run, Math.random);
    if (this.run.over) {
      this.endRun();
    } else {
      this.scheduleRun();
    }
    this.refresh();
  }

  /** Apunta la marca, se acabe como se acabe la carrera. */
  private endRun(): void {
    this.stopRunTimer();
    const metros = this.run?.distance ?? 0;
    if (metros > this.runBest) {
      this.runBest = metros;
      this.store(RUN_BEST_KEY, metros);
    }
  }

  /** Filas de la carrera, listas para pintar. */
  get runRows(): string[] {
    return this.run ? renderRun(this.run) : [];
  }

  /** Los corazones de la barra superior. */
  get runHearts(): string {
    if (!this.run) return '';
    return '♥'.repeat(Math.max(0, this.run.lives)).padEnd(3, '·');
  }

  private runKey(event: KeyboardEvent): void {
    const tecla = event.key.toLowerCase();
    if (event.key === ' ' || event.key === 'ArrowUp' || tecla === 'w') {
      event.preventDefault();
      this.run = jump(this.run!);
      this.refresh();
      return;
    }
    if (event.key === 'ArrowDown' || tecla === 's') {
      event.preventDefault();
      this.run = duck(this.run!, true);
      this.refresh();
      return;
    }
    if (event.key === 'Escape' || tecla === 'q') {
      event.preventDefault();
      this.quitRun();
      return;
    }
    if (event.key === 'Enter' && this.run?.over) {
      event.preventDefault();
      this.restartRun();
    }
  }

  /** Al soltar la tecla de agacharse, el corredor se levanta. */
  onRunKeyUp(event: KeyboardEvent): void {
    if (!this.run) return;
    const tecla = event.key.toLowerCase();
    if (event.key === 'ArrowDown' || tecla === 's') {
      this.run = duck(this.run, false);
      this.refresh();
    }
  }

  /** Los botones del móvil. Agacharse dura un momento y se suelta solo. */
  runJump(): void {
    if (!this.run) return;
    this.run = jump(this.run);
    this.focusInput();
  }

  runDuck(): void {
    if (!this.run) return;
    this.run = duck(this.run, true);
    this.focusInput();
    setTimeout(() => {
      if (this.run) {
        this.run = duck(this.run, false);
        this.refresh();
      }
    }, 550);
  }

  quitRun(): void {
    this.endRun();
    const metros = this.run?.distance ?? 0;
    this.run = null;
    this.say('muted', 'console.runEnd', {
      score: String(metros),
      best: String(this.runBest),
    });
    this.setCommand('');
    this.refresh();
    this.focusInput();
  }

  restartRun(): void {
    this.endRun();
    this.startRun(false);
  }

  private stopRunTimer(): void {
    if (this.runTimer) clearTimeout(this.runTimer);
    this.runTimer = undefined;
  }

  // ===== KONAMI =====

  private trackKonami(event: KeyboardEvent): void {
    const esperada = KONAMI[this.konamiAt];
    const pulsada = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (pulsada === esperada) {
      this.konamiAt++;
    } else {
      this.konamiAt = pulsada === KONAMI[0] ? 1 : 0;
    }

    if (this.konamiAt === KONAMI.length) {
      this.konamiAt = 0;
      this.themes.set(SECRET_THEME);
      this.say('ok', 'console.konami');
      this.say('muted', 'console.konamiHint');
      this.refresh();
    }
  }

  // ===== CONTROLES DE VENTANA =====

  /** Pliega la salida y deja solo el prompt: un `clear` que se puede deshacer. */
  toggleFold(): void {
    this.folded = !this.folded;
    this.refresh();
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    document.documentElement.requestFullscreen?.().catch(() => {
      // Algunos navegadores lo bloquean sin gesto directo. No pasa nada.
    });
  }

  /** Apagar el monitor. No cierra nada: se enciende con cualquier tecla. */
  powerOff(): void {
    this.poweredOff = true;
    this.stopAllTimers();
    this.refresh();
  }

  powerOn(): void {
    this.poweredOff = false;
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.refresh();
    this.focusInput();
  }

  // ===== PALETA DE COMANDOS =====

  openPalette(): void {
    this.paletteOpen = true;
    this.refresh();
    this.palette?.focus();
  }

  closePalette(): void {
    this.paletteOpen = false;
    this.refresh();
    this.focusInput();
  }

  /** En la portada, elegir en la paleta es ejecutar el comando de verdad. */
  runFromPalette(id: string): void {
    this.closePalette();
    this.setCommand(id);
    this.executeCommand();
  }

  // ===== MENÚ Y VARIOS =====

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenuIfOpen(): void {
    if (this.menuOpen) this.menuOpen = false;
  }

  focusInput(): void {
    this.cmdInput?.nativeElement.focus();
  }

  /** Tocar el cuerpo de la terminal devuelve el foco al input, como en una real. */
  onBodyClick(): void {
    if (this.matrixOn) return this.stopMatrix();
    this.closeMenuIfOpen();
    if (!window.getSelection()?.toString()) this.focusInput();
  }

  navigate(path: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = false;
    this.router.navigate([path]);
  }

  describe(cmd: CommandDef): string {
    return this.i18n.t(cmd.descKey);
  }

  // ===== FONTANERÍA =====

  /** Una línea traducible: guarda la clave, no el texto. */
  private say(
    kind: LineKind,
    key: string,
    params?: Record<string, string>,
    extra: Partial<OutLine> = {},
  ): void {
    this.output.push({ kind, key, ...(params !== undefined && { params }), ...extra });
  }

  /** Una línea literal: nombres propios, URLs, arte ASCII. */
  private lit(kind: LineKind, raw: string, extra: Partial<OutLine> = {}): void {
    this.output.push({ kind, raw, ...extra });
  }

  private refresh(): void {
    if (!this.destroyed) this.cdr.detectChanges();
  }

  private uptime(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  /**
   * Una terminal siempre enseña lo último. Sin esto, en móvil la respuesta
   * aparece por debajo del borde y parece que no ha pasado nada.
   */
  private scrollToBottom(): void {
    const caja = this.body?.nativeElement;
    if (caja) caja.scrollTop = caja.scrollHeight;
  }

  private clearTimer(cual: 'gameTimer' | 'trainTimer' | 'clockTimer'): void {
    const timer = this[cual];
    if (timer) clearInterval(timer);
    this[cual] = undefined;
  }

  private stopAllTimers(): void {
    this.clearTimer('clockTimer');
    this.clearTimer('gameTimer');
    this.clearTimer('trainTimer');
    this.stopRunTimer();
    this.matrix?.stop();
  }

  private remember(raw: string): void {
    if (this.history[this.history.length - 1] === raw) return;
    this.history.push(raw);
    if (this.history.length > HISTORY_MAX) this.history.shift();
    this.store(HISTORY_KEY, this.history);
  }

  private store(clave: string, valor: unknown): void {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      // Sin almacenamiento todo vive solo en esta pestaña. Aceptable.
    }
  }

  private readStored<T>(clave: string, porDefecto: T): T {
    try {
      const crudo = localStorage.getItem(clave);
      return crudo ? (JSON.parse(crudo) as T) : porDefecto;
    } catch {
      return porDefecto;
    }
  }

}

/** El trozo con el que empiezan todos: lo que el tabulador puede añadir. */
function commonPrefix(palabras: string[]): string {
  if (palabras.length === 0) return '';
  let prefijo = palabras[0];
  for (const palabra of palabras.slice(1)) {
    let i = 0;
    while (i < prefijo.length && i < palabra.length && prefijo[i] === palabra[i]) i++;
    prefijo = prefijo.slice(0, i);
  }
  return prefijo;
}
