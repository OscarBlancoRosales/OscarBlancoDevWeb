import { describe, expect, it } from 'vitest';
import {
  activeWindow,
  close,
  DesktopState,
  focus,
  minimize,
  move,
  newDesktop,
  open,
  refit,
  resize,
  restore,
  toggleMaximize,
} from './window-manager';

/**
 * El gestor de ventanas no toca el DOM: recibe un estado y devuelve el
 * siguiente. Así se puede abrir, mover, minimizar y cerrar media docena de
 * ventanas dentro de un test, que es donde se ven las reglas de verdad.
 */

/** Un escritorio de tamaño conocido, para que las cuentas no dependan de nada. */
function escritorio(parcial: Partial<DesktopState> = {}): DesktopState {
  return { ...newDesktop(1200, 800), ...parcial };
}

describe('abrir ventanas', () => {
  it('al abrir aparece la ventana', () => {
    const d = open(escritorio(), 'qr', 'qr');
    expect(d.windows.length).toBe(1);
    expect(d.windows[0].id).toBe('qr');
  });

  it('la recién abierta es la que manda', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    expect(activeWindow(d)?.id).toBe('color');
  });

  /** Abrir dos veces lo mismo confunde: no hay dos ventanas del mismo QR. */
  it('abrir lo mismo dos veces no duplica, lo trae al frente', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    d = open(d, 'qr', 'qr');
    expect(d.windows.length).toBe(2);
    expect(activeWindow(d)?.id).toBe('qr');
  });

  it('y si estaba minimizada, la devuelve a la vista', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = minimize(d, 'qr');
    d = open(d, 'qr', 'qr');
    expect(d.windows[0].minimized).toBe(false);
    expect(activeWindow(d)?.id).toBe('qr');
  });

  /** Si todas nacieran en el mismo sitio, parecería que solo hay una. */
  it('las nuevas salen en cascada, no una encima de otra', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    expect(d.windows[1].x).not.toBe(d.windows[0].x);
    expect(d.windows[1].y).not.toBe(d.windows[0].y);
  });

  it('la cascada no se sale del escritorio por muchas que abras', () => {
    let d = escritorio();
    for (let i = 0; i < 12; i++) {
      const id = `v${i}`;
      d = open(d, id, id);
    }
    for (const w of d.windows) {
      expect(w.x, w.id).toBeGreaterThanOrEqual(0);
      expect(w.y, w.id).toBeGreaterThanOrEqual(0);
      expect(w.x + w.width, w.id).toBeLessThanOrEqual(1200);
    }
  });

  it('se puede pedir un tamaño concreto al abrir', () => {
    const d = open(escritorio(), 'juegos', 'juegos', { width: 900, height: 600 });
    expect(d.windows[0].width).toBe(900);
    expect(d.windows[0].height).toBe(600);
  });
});

describe('el foco', () => {
  it('enfocar la sube por encima de las demás', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    d = focus(d, 'qr');
    const z = (id: string) => d.windows.find((w) => w.id === id)?.z ?? -1;
    expect(z('qr')).toBeGreaterThan(z('color'));
  });

  it('enfocar algo que no existe no rompe nada', () => {
    const d = open(escritorio(), 'qr', 'qr');
    expect(focus(d, 'fantasma')).toEqual(d);
  });

  it('sin ventanas no hay ninguna activa', () => {
    expect(activeWindow(escritorio())).toBeNull();
  });

  it('una ventana minimizada no puede ser la activa', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = minimize(d, 'qr');
    expect(activeWindow(d)).toBeNull();
  });
});

describe('minimizar y restaurar', () => {
  it('minimizar la quita de la vista pero no la cierra', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = minimize(d, 'qr');
    expect(d.windows.length).toBe(1);
    expect(d.windows[0].minimized).toBe(true);
  });

  it('al minimizar la de delante, manda la de detrás', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    d = minimize(d, 'color');
    expect(activeWindow(d)?.id).toBe('qr');
  });

  it('restaurar la devuelve al frente', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    d = minimize(d, 'qr');
    d = restore(d, 'qr');
    expect(activeWindow(d)?.id).toBe('qr');
  });

  it('tocar la barra de tareas de la ventana activa la minimiza', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = restore(d, 'qr');
    expect(d.windows[0].minimized).toBe(false);
  });
});

describe('maximizar', () => {
  it('maximizada ocupa todo el escritorio', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = toggleMaximize(d, 'qr');
    const w = d.windows[0];
    expect(w.maximized).toBe(true);
    expect(w.width).toBe(1200);
    expect(w.height).toBe(800);
    expect(w.x).toBe(0);
    expect(w.y).toBe(0);
  });

  /** Sin recordar el tamaño anterior, restaurar deja la ventana a lo bruto. */
  it('al restaurar vuelve al tamaño y sitio que tenía', () => {
    let d = open(escritorio(), 'qr', 'qr', { width: 500, height: 400 });
    d = move(d, 'qr', 100, 90);
    const antes = { ...d.windows[0] };
    d = toggleMaximize(d, 'qr');
    d = toggleMaximize(d, 'qr');
    const w = d.windows[0];
    expect([w.x, w.y, w.width, w.height]).toEqual([antes.x, antes.y, antes.width, antes.height]);
  });
});

describe('mover y redimensionar', () => {
  it('moverla la lleva donde le digas', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = move(d, 'qr', 300, 200);
    expect([d.windows[0].x, d.windows[0].y]).toEqual([300, 200]);
  });

  /** Una ventana arrastrada fuera de la pantalla no se puede recuperar. */
  it('no se puede tirar fuera del escritorio', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = move(d, 'qr', -500, -500);
    expect(d.windows[0].x).toBeGreaterThanOrEqual(0);
    expect(d.windows[0].y).toBeGreaterThanOrEqual(0);

    d = move(d, 'qr', 99999, 99999);
    expect(d.windows[0].x).toBeLessThan(1200);
    expect(d.windows[0].y).toBeLessThan(800);
  });

  it('redimensionar cambia el tamaño', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = resize(d, 'qr', 700, 500);
    expect([d.windows[0].width, d.windows[0].height]).toEqual([700, 500]);
  });

  it('pero no se puede encoger hasta hacerla inservible', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = resize(d, 'qr', 10, 10);
    expect(d.windows[0].width).toBeGreaterThanOrEqual(240);
    expect(d.windows[0].height).toBeGreaterThanOrEqual(160);
  });

  it('ni crecer más que el escritorio', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = resize(d, 'qr', 5000, 5000);
    expect(d.windows[0].width).toBeLessThanOrEqual(1200);
    expect(d.windows[0].height).toBeLessThanOrEqual(800);
  });
});

describe('cerrar', () => {
  it('cerrar la quita', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = close(d, 'qr');
    expect(d.windows).toEqual([]);
  });

  it('al cerrar la de delante, manda la siguiente', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = open(d, 'color', 'color');
    d = close(d, 'color');
    expect(activeWindow(d)?.id).toBe('qr');
  });

  it('cerrar algo que no está no rompe nada', () => {
    const d = open(escritorio(), 'qr', 'qr');
    expect(close(d, 'fantasma').windows.length).toBe(1);
  });
});

describe('cuando cambia el tamaño de la pantalla', () => {
  /** Al girar el móvil o encoger la ventana, lo abierto no puede perderse. */
  it('las ventanas se recolocan dentro del escritorio nuevo', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = move(d, 'qr', 900, 600);
    d = refit(d, 600, 400);
    expect(d.windows[0].x + d.windows[0].width).toBeLessThanOrEqual(600);
    expect(d.windows[0].y + d.windows[0].height).toBeLessThanOrEqual(400);
  });

  it('y el escritorio se queda con el tamaño nuevo', () => {
    const d = refit(open(escritorio(), 'qr', 'qr'), 600, 400);
    expect(d.area).toEqual({ width: 600, height: 400 });
  });

  /**
   * Una maximizada tiene que seguir tocando los cuatro bordes. Sin esto, una
   * sección abierta desde un enlace se quedaba con el tamaño de la primera
   * medida -la de antes de que el escritorio estuviera pintado- y dejaba una
   * franja de fondo a la derecha.
   */
  it('las maximizadas vuelven a ocupar el hueco entero', () => {
    let d = open(escritorio(), 'poker', 'poker');
    d = toggleMaximize(d, 'poker');
    d = refit(d, 1600, 900);
    const w = d.windows[0];
    expect([w.x, w.y, w.width, w.height]).toEqual([0, 0, 1600, 900]);
  });

  it('y también si el escritorio encoge', () => {
    let d = open(escritorio(), 'poker', 'poker');
    d = toggleMaximize(d, 'poker');
    d = refit(d, 500, 300);
    expect([d.windows[0].width, d.windows[0].height]).toEqual([500, 300]);
  });

  /** Encoger y volver a estirar no puede perder el tamaño de antes. */
  it('lo que no está maximizado no crece solo', () => {
    let d = open(escritorio(), 'qr', 'qr', { width: 400, height: 300 });
    d = refit(d, 1600, 900);
    expect([d.windows[0].width, d.windows[0].height]).toEqual([400, 300]);
  });

  it('una minimizada también se recoloca, para que vuelva bien', () => {
    let d = open(escritorio(), 'qr', 'qr');
    d = move(d, 'qr', 900, 600);
    d = minimize(d, 'qr');
    d = refit(d, 600, 400);
    expect(d.windows[0].x + d.windows[0].width).toBeLessThanOrEqual(600);
  });
});
