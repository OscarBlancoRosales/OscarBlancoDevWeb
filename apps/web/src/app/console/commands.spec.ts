import { describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import {
  COMMANDS,
  completions,
  findCommand,
  navCommands,
  suggest,
  visibleCommands,
} from './commands';

/**
 * El registro de comandos es la única fuente de verdad de la consola: de aquí
 * salen el menú, la ayuda y el autocompletado. Si una sección no está aquí, no
 * existe para quien llega, que es exactamente como los juegos se quedaron
 * fuera del menú aunque la ruta funcionara.
 */
describe('registro de comandos', () => {
  /**
   * Rutas que a propósito no tienen comando, con el motivo. Cualquier ruta
   * nueva fuera de esta lista tiene que traer su comando o el test cae.
   */
  const SIN_COMANDO = new Set([
    '', // la propia consola: ya estás en ella
    '**', // comodín de redirección
    'name-screen', // pantalla intermedia del flujo de Scrum Poker
    'scrum-poker', // se entra por /auth, que sí tiene comando
    'juegos/risk', // el lobby se abre desde /juegos
    'juegos/risk/mesa', // necesita una sala ya creada
    'juegos/flota', // el lobby se abre desde /juegos
    'juegos/flota/mesa', // necesita una sala ya creada
  ]);

  it('toda ruta navegable tiene un comando que lleva a ella', () => {
    const destinos = new Set(COMMANDS.map((c) => c.route).filter(Boolean));
    const huerfanas = routes
      .map((r) => r.path ?? '')
      .filter((path) => !SIN_COMANDO.has(path))
      .filter((path) => !destinos.has('/' + path));
    expect(huerfanas, 'rutas sin comando en la consola').toEqual([]);
  });

  it('ningún alias está pillado por dos comandos', () => {
    const vistos = new Map<string, string>();
    const choques: string[] = [];
    for (const cmd of COMMANDS) {
      for (const nombre of [cmd.id, ...cmd.aliases]) {
        const duenyo = vistos.get(nombre);
        if (duenyo) choques.push(`${nombre}: ${duenyo} vs ${cmd.id}`);
        vistos.set(nombre, cmd.id);
      }
    }
    expect(choques).toEqual([]);
  });

  it('cada comando trae descripción para la ayuda', () => {
    const mudos = COMMANDS.filter((c) => !c.descKey).map((c) => c.id);
    expect(mudos).toEqual([]);
  });
});

describe('lo que no se anuncia', () => {
  it('el cronometro de Tomelloso no sale en el menu', () => {
    expect(navCommands().map((c) => c.id)).not.toContain('throwdown');
  });

  it('ni en la ayuda', () => {
    expect(visibleCommands().map((c) => c.id)).not.toContain('throwdown');
  });

  it('pero escribiendolo se llega igual', () => {
    expect(findCommand('throwdown')?.route).toBe('/tomelloso-throwdown-timer');
    expect(findCommand('wod')?.route).toBe('/tomelloso-throwdown-timer');
  });
});

describe('resolver lo que se escribe', () => {
  it('encuentra el comando por su nombre', () => {
    expect(findCommand('juegos')?.route).toBe('/juegos');
  });

  it('y también por sus alias en inglés', () => {
    expect(findCommand('games')?.id).toBe('juegos');
  });

  it('da igual cómo lo escribas de mayúsculas o con espacios', () => {
    expect(findCommand('  JUEGOS ')?.id).toBe('juegos');
  });

  it('lo que no existe, no existe', () => {
    expect(findCommand('cualquiercosa')).toBeUndefined();
  });
});

describe('cuando te equivocas al teclear', () => {
  it('propone el comando parecido', () => {
    expect(suggest('jeugos')).toBe('juegos');
  });

  it('perdona una letra de más', () => {
    expect(suggest('clearr')).toBe('clear');
  });

  it('no se inventa nada si no se parece a nada', () => {
    expect(suggest('zzzzzzzz')).toBeUndefined();
  });
});

describe('autocompletado', () => {
  it('completa por prefijo', () => {
    expect(completions('jue')).toContain('juegos');
  });

  it('devuelve los candidatos ordenados y sin repetir', () => {
    const lista = completions('c');
    expect(lista).toEqual([...new Set(lista)].sort());
  });

  it('con el prefijo vacío no propone nada', () => {
    expect(completions('')).toEqual([]);
  });

  it('los comandos secretos no se soplan al autocompletar', () => {
    const secreto = COMMANDS.find((c) => c.group === 'secret');
    expect(secreto, 'debe haber algún comando secreto').toBeDefined();
    expect(completions(secreto!.id)).toEqual([]);
  });
});

describe('el menú se genera del registro', () => {
  it('lleva las secciones navegables', () => {
    const etiquetas = navCommands().map((c) => c.id);
    for (const seccion of ['juegos', 'poker', 'dni', 'qr']) {
      expect(etiquetas, seccion).toContain(seccion);
    }
  });

  it('y no cuela comandos que no van a ningún sitio', () => {
    expect(navCommands().every((c) => !!c.route)).toBe(true);
  });
});
