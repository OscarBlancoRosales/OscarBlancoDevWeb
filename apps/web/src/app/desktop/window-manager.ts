/**
 * El gestor de ventanas del escritorio.
 *
 * No sabe nada del DOM ni del ratón: recibe un estado y devuelve el siguiente.
 * Quien lo use se encarga de pintar y de escuchar los arrastres.
 */

export interface WindowState {
  /** El id de la sección. Solo puede haber una ventana por sección. */
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  /** Orden de apilado: cuanto más alto, más cerca de ti. */
  z: number;
  /**
   * Dónde estaba antes de maximizar, para poder devolverla. Admite undefined
   * explícito porque al restaurar se limpia.
   */
  previous?: { x: number; y: number; width: number; height: number } | undefined;
}

export interface DesktopState {
  windows: WindowState[];
  /** El hueco donde caben las ventanas, sin contar la barra de tareas. */
  area: { width: number; height: number };
  nextZ: number;
  /** Cuántas ventanas se han abierto ya, para ir escalonándolas. */
  opened: number;
}

export interface OpenOptions {
  width?: number;
  height?: number;
}

/** Por debajo de esto una ventana no se puede ni leer ni agarrar. */
export const MIN_W = 240;
export const MIN_H = 160;

const DEFAULT_W = 720;
const DEFAULT_H = 520;
/** Lo que se desplaza cada ventana nueva respecto a la anterior. */
const CASCADE = 28;
/** Cuántos escalones antes de volver a empezar la cascada. */
const CASCADE_STEPS = 6;

export function newDesktop(width: number, height: number): DesktopState {
  return { windows: [], area: { width, height }, nextZ: 1, opened: 0 };
}

/**
 * Abre una sección. Si ya estaba abierta no se duplica: se trae al frente y,
 * si estaba minimizada, se devuelve a la vista.
 */
export function open(
  state: DesktopState,
  id: string,
  title: string,
  opciones: OpenOptions = {},
): DesktopState {
  if (state.windows.some((w) => w.id === id)) {
    return focus(restore(state, id), id);
  }

  const width = clamp(opciones.width ?? DEFAULT_W, MIN_W, state.area.width);
  const height = clamp(opciones.height ?? DEFAULT_H, MIN_H, state.area.height);
  const paso = state.opened % CASCADE_STEPS;
  const ventana: WindowState = {
    id,
    title,
    ...place(state.area, width, height, paso),
    width,
    height,
    minimized: false,
    maximized: false,
    z: state.nextZ,
  };

  return {
    ...state,
    windows: [...state.windows, ventana],
    nextZ: state.nextZ + 1,
    opened: state.opened + 1,
  };
}

export function close(state: DesktopState, id: string): DesktopState {
  return { ...state, windows: state.windows.filter((w) => w.id !== id) };
}

export function focus(state: DesktopState, id: string): DesktopState {
  if (!state.windows.some((w) => w.id === id)) return state;
  return {
    ...state,
    windows: state.windows.map((w) => (w.id === id ? { ...w, z: state.nextZ } : w)),
    nextZ: state.nextZ + 1,
  };
}

export function minimize(state: DesktopState, id: string): DesktopState {
  return patch(state, id, () => ({ minimized: true }));
}

/** La saca del minimizado y la pone delante. */
export function restore(state: DesktopState, id: string): DesktopState {
  const estaba = state.windows.find((w) => w.id === id);
  if (!estaba) return state;
  if (!estaba.minimized) return state;
  return focus(patch(state, id, () => ({ minimized: false })), id);
}

export function toggleMaximize(state: DesktopState, id: string): DesktopState {
  return patch(state, id, (w) => {
    if (w.maximized) {
      const antes = w.previous;
      return {
        maximized: false,
        x: antes?.x ?? w.x,
        y: antes?.y ?? w.y,
        width: antes?.width ?? w.width,
        height: antes?.height ?? w.height,
        previous: undefined,
      };
    }
    return {
      maximized: true,
      previous: { x: w.x, y: w.y, width: w.width, height: w.height },
      x: 0,
      y: 0,
      width: state.area.width,
      height: state.area.height,
    };
  });
}

/** Mover, sin dejar que la ventana se escape de la pantalla. */
export function move(state: DesktopState, id: string, x: number, y: number): DesktopState {
  return patch(state, id, (w) => ({
    x: clamp(x, 0, Math.max(0, state.area.width - w.width)),
    y: clamp(y, 0, Math.max(0, state.area.height - w.height)),
  }));
}

/**
 * Redimensionar. Además recoloca la ventana si el cambio la dejaría fuera,
 * que es lo que pasa cuando encoge la pantalla o giras el móvil.
 */
export function resize(state: DesktopState, id: string, width: number, height: number): DesktopState {
  return patch(state, id, (w) => {
    const ancho = clamp(width, MIN_W, state.area.width);
    const alto = clamp(height, MIN_H, state.area.height);
    return {
      width: ancho,
      height: alto,
      x: clamp(w.x, 0, Math.max(0, state.area.width - ancho)),
      y: clamp(w.y, 0, Math.max(0, state.area.height - alto)),
    };
  });
}

/**
 * Recoloca todo dentro de un escritorio de otro tamaño.
 *
 * Las maximizadas vuelven a ocupar el hueco entero: si no, al cambiar el
 * tamaño de la ventana del navegador -o al montarse el escritorio, que mide
 * antes de que el DOM tenga su tamaño de verdad- se quedaban ocupando el
 * área vieja, y una sección abierta desde un enlace no llegaba a los bordes.
 */
export function refit(state: DesktopState, width: number, height: number): DesktopState {
  const area = { width, height };
  const windows = state.windows.map((w) => {
    if (w.maximized) return { ...w, x: 0, y: 0, width, height };
    const ancho = clamp(w.width, MIN_W, width);
    const alto = clamp(w.height, MIN_H, height);
    return {
      ...w,
      width: ancho,
      height: alto,
      x: clamp(w.x, 0, Math.max(0, width - ancho)),
      y: clamp(w.y, 0, Math.max(0, height - alto)),
    };
  });
  return { ...state, area, windows };
}

/** Le cambia el nombre a una ventana, por ejemplo al cambiar de idioma. */
export function rename(state: DesktopState, id: string, title: string): DesktopState {
  return patch(state, id, () => ({ title }));
}

/** La que está delante del todo. Las minimizadas no cuentan. */
export function activeWindow(state: DesktopState): WindowState | null {
  const visibles = state.windows.filter((w) => !w.minimized);
  if (visibles.length === 0) return null;
  return visibles.reduce((a, b) => (b.z > a.z ? b : a));
}

/** Sitio para una ventana nueva: centrada y desplazada según la cascada. */
function place(
  area: DesktopState['area'],
  width: number,
  height: number,
  paso: number,
): { x: number; y: number } {
  const libreX = Math.max(0, area.width - width);
  const libreY = Math.max(0, area.height - height);
  const base = { x: Math.round(libreX / 2), y: Math.round(libreY / 3) };
  // La cascada arranca arriba a la izquierda del centro para que quepan todas.
  const desplazado = {
    x: base.x - ((CASCADE_STEPS - 1) * CASCADE) / 2 + paso * CASCADE,
    y: base.y - ((CASCADE_STEPS - 1) * CASCADE) / 2 + paso * CASCADE,
  };
  return {
    x: Math.round(clamp(desplazado.x, 0, libreX)),
    y: Math.round(clamp(desplazado.y, 0, libreY)),
  };
}

function patch(
  state: DesktopState,
  id: string,
  cambio: (w: WindowState) => Partial<WindowState>,
): DesktopState {
  if (!state.windows.some((w) => w.id === id)) return state;
  return {
    ...state,
    windows: state.windows.map((w) => (w.id === id ? { ...w, ...cambio(w) } : w)),
  };
}

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
}
