import { describe, expect, it } from 'vitest';
import {
  duck,
  jump,
  newRun,
  renderRun,
  RunnerState,
  spawn,
  tick,
  ObstacleKind,
} from './runner';

/**
 * El corredor, como el motor de la serpiente, no toca el DOM ni el reloj: se
 * le da un estado y unos dados, y devuelve el siguiente. Así se puede jugar
 * una partida entera dentro de un test.
 */

/** Dados amañados: nunca sale nada, para colocar los obstáculos a mano. */
const sinSorpresas = () => 1;

/** Una carrera colocada a mano, sin obstáculos por defecto. */
function carrera(parcial: Partial<RunnerState> = {}): RunnerState {
  return { ...newRun(40, 10), obstacles: [], ...parcial };
}

/** Deja al corredor justo encima del obstáculo indicado y avanza un paso. */
function chocarContra(kind: ObstacleKind, estado: Partial<RunnerState> = {}): RunnerState {
  const juego = carrera({
    // El obstáculo entra en la columna del corredor en el siguiente paso.
    obstacles: [{ x: newRun(40, 10).runnerX + 1, kind }],
    ...estado,
  });
  return tick(juego, sinSorpresas);
}

describe('empezar a correr', () => {
  it('el corredor sale en el suelo y de pie', () => {
    const juego = newRun(40, 10);
    expect(juego.y).toBe(0);
    expect(juego.ducking).toBe(false);
    expect(juego.over).toBe(false);
  });

  it('con tres vidas y sin distancia recorrida', () => {
    const juego = newRun(40, 10);
    expect(juego.lives).toBe(3);
    expect(juego.distance).toBe(0);
  });
});

describe('saltar', () => {
  it('el salto levanta del suelo', () => {
    expect(tick(jump(carrera()), sinSorpresas).y).toBeGreaterThan(0);
  });

  it('no se puede saltar dos veces en el aire', () => {
    const enElAire = carrera({ y: 2, vy: 1 });
    expect(jump(enElAire).vy).toBe(enElAire.vy);
  });

  it('lo que sube, baja', () => {
    let juego = jump(carrera());
    for (let i = 0; i < 12; i++) juego = tick(juego, sinSorpresas);
    expect(juego.y).toBe(0);
  });

  it('el salto llega lo bastante alto para salvar un 404', () => {
    let juego = jump(carrera());
    let maximo = 0;
    for (let i = 0; i < 12; i++) {
      juego = tick(juego, sinSorpresas);
      maximo = Math.max(maximo, juego.y);
    }
    // Un 404 ocupa dos filas: hay que subir al menos dos.
    expect(maximo).toBeGreaterThanOrEqual(2);
  });
});

describe('agacharse', () => {
  it('agachado se ocupa menos alto', () => {
    expect(duck(carrera(), true).ducking).toBe(true);
  });

  it('y se puede volver a levantar', () => {
    expect(duck(duck(carrera(), true), false).ducking).toBe(false);
  });

  it('en el aire no vale agacharse', () => {
    expect(duck(carrera({ y: 2 }), true).ducking).toBe(false);
  });
});

describe('los obstáculos', () => {
  it('vienen hacia ti', () => {
    const juego = carrera({ obstacles: [{ x: 30, kind: 'bug' }] });
    expect(tick(juego, sinSorpresas).obstacles[0].x).toBeLessThan(30);
  });

  it('los que ya pasaron del todo se tiran a la basura', () => {
    // Ojo: en x=-1 un bug de dos caracteres aun asoma por la columna 0.
    let juego = carrera({ obstacles: [{ x: 0, kind: 'bug' }] });
    juego = tick(juego, sinSorpresas);
    expect(juego.obstacles.length, 'todavia asoma').toBe(1);
    juego = tick(juego, sinSorpresas);
    expect(juego.obstacles.length, 'ya no se ve').toBe(0);
  });

  it('un bug por el suelo te quita una vida', () => {
    expect(chocarContra('bug').lives).toBe(2);
  });

  it('pero saltando lo esquivas', () => {
    expect(chocarContra('bug', { y: 3 }).lives).toBe(3);
  });

  it('un virus vuela a la altura de la cabeza', () => {
    expect(chocarContra('virus').lives).toBe(2);
  });

  it('del virus se libra quien se agacha, no quien salta', () => {
    expect(chocarContra('virus', { ducking: true }).lives).toBe(3);
    expect(chocarContra('virus', { y: 1 }).lives).toBe(2);
  });

  it('un 404 es demasiado alto para un salto flojo', () => {
    expect(chocarContra('error404', { y: 1 }).lives).toBe(2);
    expect(chocarContra('error404', { y: 3 }).lives).toBe(3);
  });

  it('y agacharse delante de un 404 no salva a nadie', () => {
    expect(chocarContra('error404', { ducking: true }).lives).toBe(2);
  });
});

describe('el café', () => {
  it('recogerlo da escudo en vez de quitar vida', () => {
    const despues = chocarContra('coffee');
    expect(despues.lives).toBe(3);
    expect(despues.shield).toBeGreaterThan(0);
  });

  it('el escudo aguanta un golpe sin costarte una vida', () => {
    expect(chocarContra('bug', { shield: 50 }).lives).toBe(3);
  });

  it('pero se va gastando solo', () => {
    expect(tick(carrera({ shield: 10 }), sinSorpresas).shield).toBeLessThan(10);
  });

  it('y el café no se acumula hasta el infinito', () => {
    const lleno = chocarContra('coffee', { shield: 999 });
    expect(lleno.shield).toBeLessThanOrEqual(999);
  });
});

describe('perder', () => {
  it('sin vidas se acaba la carrera', () => {
    expect(chocarContra('bug', { lives: 1 }).over).toBe(true);
  });

  it('una vez perdida, la carrera no sigue', () => {
    const muerto = carrera({ over: true, distance: 100 });
    expect(tick(muerto, sinSorpresas)).toEqual(muerto);
  });

  it('el mismo obstáculo no te mata dos veces seguidas', () => {
    // Tras el golpe hay un respiro de invulnerabilidad.
    let juego = chocarContra('bug');
    const vidasTrasElGolpe = juego.lives;
    juego = tick(juego, sinSorpresas);
    expect(juego.lives).toBe(vidasTrasElGolpe);
  });
});

describe('la carrera avanza', () => {
  it('la distancia sube con cada paso', () => {
    expect(tick(carrera(), sinSorpresas).distance).toBeGreaterThan(0);
  });

  it('con los dados a favor aparecen obstáculos', () => {
    const juego = spawn(carrera(), () => 0);
    expect(juego.obstacles.length).toBeGreaterThan(0);
  });

  it('nunca se amontonan dos encima', () => {
    let juego = carrera();
    for (let i = 0; i < 40; i++) juego = spawn(juego, () => 0);
    const xs = juego.obstacles.map((o) => o.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThan(4);
    }
  });
});

describe('dibujar la carrera', () => {
  it('salen tantas filas como alto', () => {
    expect(renderRun(carrera()).length).toBe(10);
  });

  it('y todas miden lo mismo', () => {
    expect(new Set(renderRun(carrera()).map((f) => f.length)).size).toBe(1);
  });

  it('hay suelo debajo del todo', () => {
    const filas = renderRun(carrera());
    expect(filas[filas.length - 1].trim().length).toBeGreaterThan(0);
  });

  it('se ve al corredor', () => {
    expect(renderRun(carrera()).join('').replace(/[═\s]/g, '').length).toBeGreaterThan(0);
  });

  it('y se ven los obstáculos que hay en pista', () => {
    const vacio = renderRun(carrera()).join('');
    const conBug = renderRun(carrera({ obstacles: [{ x: 20, kind: 'bug' }] })).join('');
    expect(conBug).not.toBe(vacio);
  });
});
