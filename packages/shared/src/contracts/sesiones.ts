import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

/**
 * Las sesiones de Claude Code, tal y como las enseña el escritorio.
 *
 * Claude Code deja cada sesión en un JSONL dentro de `~/.claude/projects`. Esto
 * es la forma limpia de eso: lo justo para listarlas y releerlas, sin arrastrar
 * los quince tipos de línea que el fichero guarda para sus cosas.
 *
 * Vive en `shared` porque lo hablan dos lados —el agente que lee el disco y la
 * web que lo pinta— y un contrato escrito dos veces se rompe solo.
 */

/** Quién habla en una tanda. */
export const Autor = Type.Union([Type.Literal('yo'), Type.Literal('claude')]);

/**
 * Las partes de una tanda, cada una con su pinta.
 *
 * `pensamiento` se separa del texto a propósito: es lo que Claude se dice a sí
 * mismo, y en pantalla va plegado. `herramienta` y `resultado` son lo que de
 * verdad ocupa una sesión de trabajo.
 */
export const Parte = Type.Union([
  Type.Object({ clase: Type.Literal('texto'), texto: Type.String() }),
  Type.Object({ clase: Type.Literal('pensamiento'), texto: Type.String() }),
  Type.Object({
    clase: Type.Literal('herramienta'),
    nombre: Type.String(),
    /** Lo que se le pidió, ya en texto. Recortado: hay entradas de megas. */
    entrada: Type.String(),
  }),
  Type.Object({
    clase: Type.Literal('resultado'),
    texto: Type.String(),
    error: Type.Boolean(),
  }),
]);

export const Tanda = Type.Object({
  id: Type.String(),
  autor: Autor,
  cuando: Type.Integer(),
  partes: Type.Array(Parte),
  /**
   * Si viene de un subagente.
   *
   * Se marca en vez de esconderse: al releer una sesión importa saber que esa
   * tanda la hizo otro, porque explica que el hilo principal diera un salto.
   */
  deSubagente: Type.Boolean(),
});

/** Una sesión en la lista: lo justo para elegirla sin abrirla. */
export const ResumenDeSesion = Type.Object({
  id: Type.String(),
  proyecto: Type.String(),
  /** El que le puso Claude, si llegó a ponerle uno. */
  titulo: Type.String(),
  rama: Type.String(),
  empezo: Type.Integer(),
  termino: Type.Integer(),
  tandas: Type.Integer(),
  /** Lo que ocupa en disco. Hay sesiones de cuarenta megas. */
  bytes: Type.Integer(),
});

export const ListaDeSesiones = Type.Object({
  sesiones: Type.Array(ResumenDeSesion),
});

export const Sesion = Type.Object({
  resumen: ResumenDeSesion,
  tandas: Type.Array(Tanda),
  /** Cuántas tandas hay en total, si esta página no las trae todas. */
  total: Type.Integer(),
  /**
   * Por dónde empieza este tramo dentro de la sesión entera.
   *
   * Una sesión se abre por el final, como un chat, así que la primera página no
   * es la cero: sin saber dónde cae, la pantalla no puede pedir lo de antes.
   */
  desde: Type.Integer(),
});

export type Autor = Static<typeof Autor>;
export type Parte = Static<typeof Parte>;
export type Tanda = Static<typeof Tanda>;
export type ResumenDeSesion = Static<typeof ResumenDeSesion>;
export type ListaDeSesiones = Static<typeof ListaDeSesiones>;
export type Sesion = Static<typeof Sesion>;
