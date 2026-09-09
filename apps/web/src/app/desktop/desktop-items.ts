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

export interface DesktopItem {
  id: string;
  /** Clave de i18n con el nombre que se lee debajo del icono. */
  labelKey: string;
  /** El dibujo, en caracteres: pega con la estética y se tiñe con el tema. */
  glyph: string;
  kind: ItemKind;
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
    command: 'terminal',
    width: 820,
    height: 560,
  },
  { id: 'sobre-mi', labelKey: 'desk.about', glyph: '☻', kind: 'terminal', run: 'whoami', width: 720, height: 420 },
  { id: 'proyectos', labelKey: 'desk.projects', glyph: '★', kind: 'terminal', run: 'projects', width: 720, height: 420 },
  { id: 'contacto', labelKey: 'desk.contact', glyph: '✉', kind: 'terminal', run: 'contact', width: 700, height: 380 },

  // --- Secciones ---
  { id: 'juegos', labelKey: 'desk.games', glyph: '◈', kind: 'section', command: 'juegos', width: 980, height: 640 },
  { id: 'poker', labelKey: 'desk.poker', glyph: '♠', kind: 'section', command: 'poker', width: 900, height: 620 },
  { id: 'qr', labelKey: 'desk.qr', glyph: '▚', kind: 'section', command: 'qr' },
  { id: 'dni', labelKey: 'desk.dni', glyph: '▤', kind: 'section', command: 'dni' },
  { id: 'color', labelKey: 'desk.color', glyph: '◐', kind: 'section', command: 'color' },
  { id: 'regex', labelKey: 'desk.regex', glyph: '.*', kind: 'section', command: 'regex', width: 880 },
  { id: 'base64', labelKey: 'desk.base64', glyph: '⇄', kind: 'section', command: 'base64', width: 880 },
  { id: 'format', labelKey: 'desk.format', glyph: '{}', kind: 'section', command: 'format', width: 880 },
  { id: 'lorem', labelKey: 'desk.lorem', glyph: '¶', kind: 'section', command: 'lorem' },
  { id: 'timestamp', labelKey: 'desk.timestamp', glyph: '◷', kind: 'section', command: 'timestamp' },
  { id: 'uuid', labelKey: 'desk.uuid', glyph: '#', kind: 'section', command: 'uuid' },
  { id: 'iconos', labelKey: 'desk.icons', glyph: '▣', kind: 'section', command: 'iconos' },
];

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
