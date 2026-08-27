/**
 * Registro de comandos de la consola.
 *
 * Es la única fuente de verdad: de aquí salen el menú desplegable, la ayuda y
 * el autocompletado. Añadir una sección al sitio es añadir una entrada aquí.
 */

export type CommandGroup = 'nav' | 'info' | 'system' | 'secret';

export interface CommandDef {
  /** Nombre canónico, el que se muestra en la ayuda y en el menú. */
  id: string;
  /** Otras formas de escribirlo: castellano, inglés y erratas frecuentes. */
  aliases: string[];
  group: CommandGroup;
  /** Clave de i18n con la descripción de una línea. */
  descKey: string;
  /** Ruta del router a la que lleva, si es de navegación. */
  route?: string;
  /** Firma de argumentos para la ayuda, p. ej. '<seccion>'. */
  args?: string;
  /** Fuera del menú y de la ayuda, pero se puede escribir. */
  hidden?: boolean;
}

export const COMMANDS: CommandDef[] = [
  // === NAVEGACIÓN ===
  {
    id: 'juegos',
    aliases: ['games', 'risk', 'play', 'jugar'],
    group: 'nav',
    descKey: 'cmd.juegos',
    route: '/juegos',
  },
  {
    id: 'poker',
    aliases: ['scrum-poker', 'scrum', 'planning', 'estimacion'],
    group: 'nav',
    descKey: 'cmd.poker',
    route: '/auth',
  },
  {
    id: 'dni',
    aliases: ['dni-generator', 'nif', 'nie'],
    group: 'nav',
    descKey: 'cmd.dni',
    route: '/dni-generator',
  },
  {
    id: 'qr',
    aliases: ['qr-generator', 'codigo-qr', 'qrcode'],
    group: 'nav',
    descKey: 'cmd.qr',
    route: '/qr-generator',
  },
  {
    id: 'base64',
    aliases: ['decoder', 'encoder', 'encoder-decoder', 'codificar'],
    group: 'nav',
    descKey: 'cmd.decoder',
    route: '/decoder',
  },
  {
    id: 'format',
    aliases: ['formatter', 'code-formatter', 'prettify', 'formatear'],
    group: 'nav',
    descKey: 'cmd.formatter',
    route: '/formatter',
  },
  {
    id: 'color',
    aliases: ['colors', 'colores', 'color-picker', 'paleta'],
    group: 'nav',
    descKey: 'cmd.color',
    route: '/color-picker',
  },
  {
    id: 'regex',
    aliases: ['regexp', 'regex-tester', 'regexes'],
    group: 'nav',
    descKey: 'cmd.regex',
    route: '/regex-tester',
  },
  {
    id: 'lorem',
    aliases: ['ipsum', 'lorem-generator', 'texto'],
    group: 'nav',
    descKey: 'cmd.lorem',
    route: '/lorem-generator',
  },
  {
    id: 'timestamp',
    aliases: ['epoch', 'unix', 'timestamp-converter', 'fecha'],
    group: 'nav',
    descKey: 'cmd.timestamp',
    route: '/timestamp',
  },
  {
    id: 'uuid',
    aliases: ['guid', 'uuid-generator'],
    group: 'nav',
    descKey: 'cmd.uuid',
    route: '/uuid-generator',
  },
  {
    id: 'iconos',
    aliases: ['icons', 'icon', 'icon-generator', 'appicon'],
    group: 'nav',
    descKey: 'cmd.iconos',
    route: '/icon-generator',
  },
  {
    id: 'throwdown',
    aliases: ['timer', 'tomelloso', 'cronometro', 'wod'],
    group: 'nav',
    descKey: 'cmd.throwdown',
    route: '/tomelloso-throwdown-timer',
    // Sigue estando y sigue funcionando, pero no se anuncia: es de andar por
    // casa y no pinta nada en el menu de un portfolio.
    hidden: true,
  },
  {
    id: 'login',
    aliases: ['auth', 'sesion', 'signin'],
    group: 'nav',
    descKey: 'cmd.login',
    route: '/auth',
    hidden: true,
  },
  {
    id: 'home',
    aliases: ['inicio', 'portada', '~'],
    group: 'nav',
    descKey: 'cmd.home',
    route: '/',
    hidden: true,
  },

  // === INFORMACIÓN ===
  { id: 'whoami', aliases: ['about', 'sobre-mi', 'quien'], group: 'info', descKey: 'cmd.whoami' },
  { id: 'stack', aliases: ['skills', 'tech', 'tecnologias'], group: 'info', descKey: 'cmd.stack' },
  {
    id: 'projects',
    aliases: ['proyectos', 'portfolio', 'work'],
    group: 'info',
    descKey: 'cmd.projects',
  },
  { id: 'contact', aliases: ['contacto', 'email', 'mail'], group: 'info', descKey: 'cmd.contact' },
  { id: 'social', aliases: ['links', 'redes'], group: 'info', descKey: 'cmd.social' },
  { id: 'neofetch', aliases: ['fetch', 'ficha'], group: 'info', descKey: 'cmd.neofetch' },

  // === SISTEMA ===
  { id: 'help', aliases: ['ayuda', '?', 'h'], group: 'system', descKey: 'cmd.help', args: '[cmd]' },
  { id: 'ls', aliases: ['dir', 'secciones', 'list'], group: 'system', descKey: 'cmd.ls' },
  { id: 'cd', aliases: ['goto', 'ir'], group: 'system', descKey: 'cmd.cd', args: '<seccion>' },
  { id: 'open', aliases: ['abrir', 'start'], group: 'system', descKey: 'cmd.open', args: '<enlace>' },
  {
    id: 'theme',
    aliases: ['tema', 'colorscheme'],
    group: 'system',
    descKey: 'cmd.theme',
    args: '[nombre]',
  },
  { id: 'lang', aliases: ['idioma', 'language'], group: 'system', descKey: 'cmd.lang', args: '[es|en]' },
  { id: 'history', aliases: ['historial'], group: 'system', descKey: 'cmd.history' },
  { id: 'date', aliases: ['hora', 'time', 'reloj'], group: 'system', descKey: 'cmd.date' },
  { id: 'echo', aliases: ['say'], group: 'system', descKey: 'cmd.echo', args: '<texto>' },
  { id: 'clear', aliases: ['cls', 'limpiar'], group: 'system', descKey: 'cmd.clear' },

  // === SECRETOS ===
  // No salen en la ayuda ni en el autocompletado, pero «easteregg» los destapa
  // todos de golpe para quien no quiera seguir adivinando.
  {
    id: 'easteregg',
    aliases: ['eastereggs', 'secretos', 'secrets', 'huevos'],
    group: 'secret',
    descKey: 'cmd.easteregg',
  },
  { id: 'snake', aliases: ['serpiente', 'juego'], group: 'secret', descKey: 'cmd.snake' },
  {
    id: 'runner',
    aliases: ['dino', 'correr', 'bugrunner'],
    group: 'secret',
    descKey: 'cmd.runner',
  },
  { id: 'matrix', aliases: [], group: 'secret', descKey: 'cmd.matrix' },
  { id: 'hack', aliases: ['hackerman'], group: 'secret', descKey: 'cmd.hack' },
  { id: 'glitch', aliases: [], group: 'secret', descKey: 'cmd.glitch' },
  { id: 'sl', aliases: ['tren'], group: 'secret', descKey: 'cmd.sl' },
  { id: 'cowsay', aliases: ['vaca'], group: 'secret', descKey: 'cmd.cowsay', args: '<texto>' },
  { id: 'fortune', aliases: ['suerte'], group: 'secret', descKey: 'cmd.fortune' },
  { id: 'banner', aliases: ['gigante'], group: 'secret', descKey: 'cmd.banner', args: '<texto>' },
  { id: 'top', aliases: ['htop', 'procesos'], group: 'secret', descKey: 'cmd.top' },
  { id: 'sudo', aliases: [], group: 'secret', descKey: 'cmd.sudo' },
  { id: 'coffee', aliases: ['cafe'], group: 'secret', descKey: 'cmd.coffee' },
  { id: 'vim', aliases: ['nano', 'emacs'], group: 'secret', descKey: 'cmd.vim' },
  { id: 'exit', aliases: ['quit', 'logout'], group: 'secret', descKey: 'cmd.exit' },
  { id: '42', aliases: [], group: 'secret', descKey: 'cmd.42' },
];

/** Índice nombre → comando, construido una sola vez. */
const BY_NAME = new Map<string, CommandDef>();
for (const cmd of COMMANDS) {
  for (const nombre of [cmd.id, ...cmd.aliases]) {
    BY_NAME.set(nombre, cmd);
  }
}

export function findCommand(input: string): CommandDef | undefined {
  return BY_NAME.get(input.trim().toLowerCase());
}

/** Los que salen en el menú desplegable: navegación visible. */
export function navCommands(): CommandDef[] {
  return COMMANDS.filter((c) => c.group === 'nav' && !!c.route && !c.hidden);
}

/** Los que salen en la ayuda, agrupados en el orden en que se declaran. */
export function visibleCommands(): CommandDef[] {
  return COMMANDS.filter((c) => c.group !== 'secret' && !c.hidden);
}

/**
 * Nombres que empiezan por el prefijo, para el Tab y el texto fantasma.
 * Los secretos no se soplan: quien los encuentra, se los gana.
 */
export function completions(prefix: string): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const nombres = new Set<string>();
  for (const cmd of COMMANDS) {
    if (cmd.group === 'secret') continue;
    for (const nombre of [cmd.id, ...cmd.aliases]) {
      if (nombre.startsWith(p)) nombres.add(nombre);
    }
  }
  return [...nombres].sort();
}

/** Distancia de edición, recortada en cuanto se pasa del límite. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let mejor = i;
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + coste);
      mejor = Math.min(mejor, row[j]);
    }
    if (mejor > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * El «¿quisiste decir...?». Solo para lo que de verdad se parece: una errata
 * en palabras cortas, dos en las largas.
 */
export function suggest(input: string): string | undefined {
  const texto = input.trim().toLowerCase();
  if (!texto) return undefined;
  const limite = texto.length <= 4 ? 1 : 2;
  let mejor: string | undefined;
  let mejorDistancia = limite + 1;
  for (const cmd of COMMANDS) {
    if (cmd.group === 'secret') continue;
    for (const nombre of [cmd.id, ...cmd.aliases]) {
      const d = editDistance(texto, nombre, limite);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = cmd.id;
      }
    }
  }
  return mejorDistancia <= limite ? mejor : undefined;
}
