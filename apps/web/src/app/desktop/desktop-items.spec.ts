import { describe, expect, it } from 'vitest';
import { DESKTOP_ITEMS, itemRoute, startMenuItems } from './desktop-items';
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
    for (const item of DESKTOP_ITEMS.filter((i) => i.kind === 'terminal' && i.run)) {
      const primero = item.run!.split(' ')[0];
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
  it('los de sección llevan a la ruta de su comando', () => {
    const qr = DESKTOP_ITEMS.find((i) => i.command === 'qr')!;
    expect(itemRoute(qr)).toBe('/qr-generator');
  });

  it('el icono de la terminal lleva a la terminal', () => {
    const term = DESKTOP_ITEMS.find((i) => i.id === 'terminal')!;
    expect(itemRoute(term)).toBe('/terminal');
  });

  it('los que solo lanzan un comando se atienden en la terminal', () => {
    const sobreMi = DESKTOP_ITEMS.find((i) => i.id === 'sobre-mi')!;
    expect(itemRoute(sobreMi)).toBe('/terminal');
  });
});

describe('el menú de inicio', () => {
  it('ofrece todo lo que hay en el escritorio', () => {
    expect(startMenuItems().length).toBeGreaterThanOrEqual(DESKTOP_ITEMS.length);
  });

  it('incluye el cronómetro escondido, que por comando sí se llega', () => {
    expect(startMenuItems().some((i) => i.command === 'throwdown')).toBe(false);
  });
});
