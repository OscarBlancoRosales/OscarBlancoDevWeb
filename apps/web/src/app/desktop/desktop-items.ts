import { findCommand, navCommands } from '../console/commands';

/**
 * Los iconos del escritorio.
 *
 * Hay dos clases: los que abren una sección en su ventana, y los que abren la
 * terminal con un comando ya escrito. Estos últimos son los que cuentan de
 * quién es la web -«sobre mí», «proyectos»- sin obligar a nadie a saber que
 * existe una terminal debajo.
 */

export type ItemKind = 'section' | 'terminal';

/**
 * En qué zona del escritorio vive cada icono. Dieciséis iconos en fila son
 * una lista; repartidos por temas se leen de un vistazo: quién soy, con qué
 * trabajar y con qué jugar.
 */
export type ItemGroup = 'casa' | 'herramientas' | 'juegos';

/** Las zonas, en el orden en que se pintan de izquierda a derecha. */
export const GROUPS: { id: ItemGroup; labelKey: string }[] = [
  { id: 'casa', labelKey: 'desk.groupHome' },
  { id: 'herramientas', labelKey: 'desk.groupTools' },
  { id: 'juegos', labelKey: 'desk.groupPlay' },
];

export interface DesktopItem {
  id: string;
  /** Clave de i18n con el nombre que se lee debajo del icono. */
  labelKey: string;
  /** El dibujo, en caracteres: pega con la estética y se tiñe con el tema. */
  glyph: string;
  kind: ItemKind;
  /** La zona del escritorio en la que se coloca. */
  group: ItemGroup;
  /** Para los de sección: el comando del registro del que sale la ruta. */
  command?: string;
  /** Para los de terminal: lo que se escribe solo al abrirla. */
  run?: string;
  /** Tamaño con el que se abre la ventana, si el de por defecto no le sirve. */
  width?: number;
  height?: number;
}

export const DESKTOP_ITEMS: DesktopItem[] = [
  // --- La casa ---
  {
    id: 'terminal',
    labelKey: 'desk.terminal',
    glyph: '❯_',
    kind: 'terminal',
    group: 'casa',
    command: 'terminal',
    width: 820,
    height: 560,
  },
  { id: 'sobre-mi', group: 'casa', labelKey: 'desk.about', glyph: '☻', kind: 'terminal', run: 'whoami', width: 720, height: 420 },
  { id: 'proyectos', group: 'casa', labelKey: 'desk.projects', glyph: '★', kind: 'terminal', run: 'projects', width: 720, height: 420 },
  { id: 'contacto', group: 'casa', labelKey: 'desk.contact', glyph: '✉', kind: 'terminal', run: 'contact', width: 700, height: 380 },

  // --- Secciones ---
  { id: 'juegos', group: 'juegos', labelKey: 'desk.games', glyph: '◈', kind: 'section', command: 'juegos', width: 980, height: 640 },
  { id: 'poker', group: 'juegos', labelKey: 'desk.poker', glyph: '♠', kind: 'section', command: 'poker', width: 900, height: 620 },
  { id: 'qr', group: 'herramientas', labelKey: 'desk.qr', glyph: '▚', kind: 'section', command: 'qr' },
  { id: 'dni', group: 'herramientas', labelKey: 'desk.dni', glyph: '▤', kind: 'section', command: 'dni' },
  { id: 'color', group: 'herramientas', labelKey: 'desk.color', glyph: '◐', kind: 'section', command: 'color' },
  { id: 'regex', group: 'herramientas', labelKey: 'desk.regex', glyph: '.*', kind: 'section', command: 'regex', width: 880 },
  { id: 'base64', group: 'herramientas', labelKey: 'desk.base64', glyph: '⇄', kind: 'section', command: 'base64', width: 880 },
  { id: 'format', group: 'herramientas', labelKey: 'desk.format', glyph: '{}', kind: 'section', command: 'format', width: 880 },
  { id: 'lorem', group: 'herramientas', labelKey: 'desk.lorem', glyph: '¶', kind: 'section', command: 'lorem' },
  { id: 'timestamp', group: 'herramientas', labelKey: 'desk.timestamp', glyph: '◷', kind: 'section', command: 'timestamp' },
  { id: 'uuid', group: 'herramientas', labelKey: 'desk.uuid', glyph: '#', kind: 'section', command: 'uuid' },
  { id: 'iconos', group: 'herramientas', labelKey: 'desk.icons', glyph: '▣', kind: 'section', command: 'iconos' },
];

/**
 * Los iconos de una zona, en el orden del catálogo. El escritorio los pinta
 * en bandas para que no haya que leerse dieciséis nombres seguidos.
 */
export function itemsOf(group: ItemGroup): DesktopItem[] {
  return DESKTOP_ITEMS.filter((i) => i.group === group);
}

/**
 * A dónde lleva un icono cuando se abre fuera del escritorio. Los que solo
 * lanzan un comando no tienen sitio propio: se atienden en la terminal.
 */
export function itemRoute(item: DesktopItem): string {
  return findCommand(item.command ?? '')?.route ?? '/terminal';
}

/**
 * Lo que se ofrece en el menú de inicio. Sale del escritorio, así que una
 * sección nueva aparece en los dos sitios a la vez. Lo que está escondido del
 * menú de comandos sigue escondido aquí: se llega escribiéndolo.
 */
export function startMenuItems(): DesktopItem[] {
  const anunciadas = new Set(navCommands().map((c) => c.id));
  return DESKTOP_ITEMS.filter((i) => i.kind === 'terminal' || anunciadas.has(i.command ?? ''));
}

/**
 * Busca entre lo que hay en el escritorio, como el buscador de la barra de
 * inicio de cualquier sistema: vale el nombre que se lee, el del comando o
 * cualquiera de sus alias, para que dé igual si buscas «fechas», «timestamp»
 * o «epoch».
 */
export function searchItems(query: string, t: (clave: string) => string): DesktopItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return startMenuItems();

  return startMenuItems().filter((item) => {
    const cmd = item.command ? findCommand(item.command) : undefined;
    const candidatos = [
      item.id,
      t(item.labelKey).toLowerCase(),
      ...(cmd ? [cmd.id, ...cmd.aliases, t(cmd.descKey).toLowerCase()] : []),
      ...(item.run ? [item.run] : []),
    ];
    return candidatos.some((texto) => texto.includes(q));
  });
}
