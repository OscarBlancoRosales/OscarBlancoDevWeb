import { describe, expect, it } from 'vitest';
import {
  DESKTOP_ITEMS,
  DesktopItem,
  gruposPara,
  itemRoute,
  itemsOf,
  searchItems,
  startMenuItems,
} from './desktop-items';
import { findCommand, navCommands } from '../console/commands';

/**
 * Los iconos del escritorio son ahora la puerta de entrada de la web: quien
 * llega sin saber comandos solo ve esto. Si una sección no tiene icono, para
 * esa persona no existe, que es exactamente el problema que veníamos a
 * resolver.
 */
describe('los iconos del escritorio', () => {
  it('toda sección del menú tiene su icono', () => {
    const conIcono = new Set(DESKTOP_ITEMS.filter((i) => i.command).map((i) => i.command));
    const huerfanas = navCommands()
      .map((c) => c.id)
      .filter((id) => !conIcono.has(id));
    expect(huerfanas, 'secciones sin icono en el escritorio').toEqual([]);
  });

  it('ningún icono apunta a un comando que no existe', () => {
    const rotos = DESKTOP_ITEMS.filter((i) => i.command && !findCommand(i.command)).map((i) => i.id);
    expect(rotos).toEqual([]);
  });

  /**
   * La terminal a secas se abre vacía, y está bien. La gracia son los otros:
   * los que la abren con el comando ya escrito.
   */
  it('hay iconos que abren la terminal con la respuesta ya puesta', () => {
    const conComando = DESKTOP_ITEMS.filter((i) => i.kind === 'terminal' && i.run);
    expect(conComando.length).toBeGreaterThanOrEqual(2);
  });

  it('y ese algo es un comando de verdad', () => {
    for (const item of DESKTOP_ITEMS) {
      if (!item.run) continue;
      const primero = item.run.split(' ')[0];
      expect(findCommand(primero), item.run).toBeDefined();
    }
  });

  it('no hay dos iconos con el mismo id', () => {
    const ids = DESKTOP_ITEMS.map((i) => i.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('todos tienen dibujo y nombre', () => {
    for (const item of DESKTOP_ITEMS) {
      expect(item.glyph, item.id).toBeTruthy();
      expect(item.labelKey, item.id).toBeTruthy();
    }
  });

  it('el primero es la terminal: es la seña de identidad de la casa', () => {
    expect(DESKTOP_ITEMS[0].kind).toBe('terminal');
  });
});

describe('a dónde lleva cada icono', () => {
  /** El icono con ese id, o revienta el test diciendo cuál falta. */
  function icono(id: string): DesktopItem {
    const encontrado = DESKTOP_ITEMS.find((i) => i.id === id);
    if (!encontrado) throw new Error(`falta el icono «${id}»`);
    return encontrado;
  }

  it('los de sección llevan a la ruta de su comando', () => {
    expect(itemRoute(icono('qr'))).toBe('/qr-generator');
  });

  it('el icono de la terminal lleva a la terminal', () => {
    expect(itemRoute(icono('terminal'))).toBe('/terminal');
  });

  it('los que solo lanzan un comando se atienden en la terminal', () => {
    expect(itemRoute(icono('sobre-mi'))).toBe('/terminal');
  });
});

describe('el menú de inicio', () => {
  it('ofrece todo lo que hay en el escritorio', () => {
    // Con la sesión de quien administra, que es quien ve el catálogo entero.
    expect(startMenuItems(true).length).toBeGreaterThanOrEqual(DESKTOP_ITEMS.length);
  });

  it('incluye el cronómetro escondido, que por comando sí se llega', () => {
    expect(startMenuItems().some((i) => i.command === 'throwdown')).toBe(false);
  });
});

describe('el buscador de la barra', () => {
  /** Traducción de mentira: devuelve la clave, que basta para buscar por id. */
  const tal = (clave: string) => clave;

  it('sin escribir nada, lo ofrece todo', () => {
    expect(searchItems('', tal).length).toBe(startMenuItems().length);
  });

  it('encuentra por el nombre del comando', () => {
    expect(searchItems('uuid', tal).some((i) => i.id === 'uuid')).toBe(true);
  });

  /** Da igual cómo lo llames tú: «fechas», «timestamp» o «epoch». */
  it('y también por los alias del comando', () => {
    expect(searchItems('epoch', tal).some((i) => i.id === 'timestamp')).toBe(true);
  });

  it('da igual mayúsculas y espacios de más', () => {
    expect(searchItems('  QR  ', tal).some((i) => i.id === 'qr')).toBe(true);
  });

  it('lo que no está, no aparece', () => {
    expect(searchItems('zzzzzzzz', tal)).toEqual([]);
  });

  it('no ofrece lo que está escondido del menú', () => {
    expect(searchItems('throwdown', tal)).toEqual([]);
  });
});

/**
 * El panel de administración no se anuncia.
 *
 * Para quien no manda, el servidor contesta 404 a todo `/admin`: enseñar el
 * icono sería poner el cartel que ese 404 evita. Y esto solo decide si se
 * pinta un botón —el rol se comprueba en cada petición contra la base—, así
 * que fabricarse un `role: admin` en el navegador no abre ninguna puerta.
 */
describe('lo que solo ve quien administra', () => {
  const soloAdmin = DESKTOP_ITEMS.filter((i) => i.soloAdmin);

  it('hay algo marcado como suyo, y el panel está', () => {
    expect(soloAdmin.map((i) => i.id)).toContain('admin');
  });

  it('sin sesión de administrador, sus iconos no se pintan', () => {
    for (const item of soloAdmin) {
      expect(itemsOf(item.group, false).map((i) => i.id), item.id).not.toContain(item.id);
    }
  });

  it('con ella, sí', () => {
    for (const item of soloAdmin) {
      expect(itemsOf(item.group, true).map((i) => i.id), item.id).toContain(item.id);
    }
  });

  /** Una zona vacía con su título sería el mismo cartel, más discreto. */
  it('la zona que los aloja tampoco aparece si se queda vacía', () => {
    const suyas = new Set(soloAdmin.map((i) => i.group));
    for (const grupo of suyas) {
      expect(gruposPara(false).map((g) => g.id), grupo).not.toContain(grupo);
      expect(gruposPara(true).map((g) => g.id), grupo).toContain(grupo);
    }
  });

  it('ni salen en el menú de inicio ni se encuentran buscándolos', () => {
    const t = (clave: string) => clave;
    for (const item of soloAdmin) {
      expect(startMenuItems(false).map((i) => i.id), item.id).not.toContain(item.id);
      expect(searchItems(item.id, t, false).map((i) => i.id), item.id).not.toContain(item.id);

      expect(startMenuItems(true).map((i) => i.id), item.id).toContain(item.id);
      expect(searchItems(item.id, t, true).map((i) => i.id), item.id).toContain(item.id);
    }
  });

  it('y el panel abre donde tiene que abrir', () => {
    const panel = DESKTOP_ITEMS.find((i) => i.id === 'admin');
    expect(panel && itemRoute(panel)).toBe('/admin');
  });
});
