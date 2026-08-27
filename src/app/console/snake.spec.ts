import { describe, expect, it } from 'vitest';
import { newGame, render, renderFramed, SnakeState, step, turn } from './snake';

/**
 * El motor del juego no toca el DOM ni el reloj: se le dan un tablero y unos
 * dados, y devuelve el estado siguiente. Así se puede jugar una partida entera
 * dentro de un test.
 */

/** Dados amañados: devuelven siempre lo mismo, para que no haya sorpresas. */
const dadosFijos = (valor: number) => () => valor;

/** Una partida colocada a mano, para no depender de dónde nace la serpiente. */
function partida(parcial: Partial<SnakeState> = {}): SnakeState {
  return {
    width: 10,
    height: 6,
    snake: [
      { x: 4, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ],
    dir: 'right',
    food: { x: 8, y: 1 },
    score: 0,
    over: false,
    ...parcial,
  };
}

describe('empezar una partida', () => {
  it('la serpiente y la comida nacen dentro del tablero', () => {
    const juego = newGame(12, 8, dadosFijos(0.5));
    for (const parte of juego.snake) {
      expect(parte.x).toBeGreaterThanOrEqual(0);
      expect(parte.x).toBeLessThan(12);
      expect(parte.y).toBeGreaterThanOrEqual(0);
      expect(parte.y).toBeLessThan(8);
    }
    expect(juego.food.x).toBeLessThan(12);
    expect(juego.food.y).toBeLessThan(8);
  });

  it('se empieza sin puntos y vivo', () => {
    const juego = newGame(12, 8, dadosFijos(0.5));
    expect(juego.score).toBe(0);
    expect(juego.over).toBe(false);
  });
});

describe('moverse', () => {
  it('la cabeza avanza en la dirección que lleva', () => {
    const despues = step(partida(), dadosFijos(0.5));
    expect(despues.snake[0]).toEqual({ x: 5, y: 3 });
  });

  it('la cola sigue a la cabeza y no crece sola', () => {
    const antes = partida();
    const despues = step(antes, dadosFijos(0.5));
    expect(despues.snake.length).toBe(antes.snake.length);
    expect(despues.snake).not.toContainEqual({ x: 2, y: 3 });
  });

  it('girar cambia el rumbo', () => {
    expect(turn(partida(), 'up').dir).toBe('up');
  });

  it('pero no puedes darte la vuelta sobre ti mismo', () => {
    expect(turn(partida({ dir: 'right' }), 'left').dir).toBe('right');
  });

  it('con un solo trozo sí puedes girar del todo', () => {
    const corta = partida({ snake: [{ x: 4, y: 3 }], dir: 'right' });
    expect(turn(corta, 'left').dir).toBe('left');
  });
});

describe('comer', () => {
  it('la serpiente crece y suma puntos', () => {
    const antes = partida({ food: { x: 5, y: 3 } });
    const despues = step(antes, dadosFijos(0.5));
    expect(despues.snake.length).toBe(antes.snake.length + 1);
    expect(despues.score).toBeGreaterThan(0);
  });

  it('y aparece comida nueva en otro sitio', () => {
    const antes = partida({ food: { x: 5, y: 3 } });
    const despues = step(antes, dadosFijos(0.5));
    expect(despues.food).not.toEqual({ x: 5, y: 3 });
  });

  it('la comida nunca cae encima de la serpiente', () => {
    // Un tablero diminuto casi lleno: los dados tienen poco donde elegir.
    let juego = partida({
      width: 3,
      height: 3,
      snake: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      food: { x: 2, y: 1 },
      dir: 'right',
    });
    juego = step(juego, dadosFijos(0));
    expect(juego.snake).not.toContainEqual(juego.food);
  });
});

describe('morir', () => {
  it('chocar contra la pared termina la partida', () => {
    const alBorde = partida({ snake: [{ x: 9, y: 3 }], dir: 'right' });
    expect(step(alBorde, dadosFijos(0.5)).over).toBe(true);
  });

  it('morderse a uno mismo también', () => {
    // La cabeza baja sobre su propio costado. Ojo: caer sobre la ÚLTIMA
    // casilla no vale, porque la cola se libera en ese mismo turno.
    const anillo = partida({
      snake: [
        { x: 4, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ],
      dir: 'down',
    });
    expect(step(anillo, dadosFijos(0.5)).over).toBe(true);
  });

  it('pero perseguir a la propia cola es legal', () => {
    // La cola se aparta justo a tiempo: esto NO mata.
    const pegada = partida({
      snake: [
        { x: 4, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ],
      dir: 'down',
    });
    expect(step(pegada, dadosFijos(0.5)).over).toBe(false);
  });

  it('una vez muerta, ya no se mueve más', () => {
    const muerta = partida({ over: true });
    expect(step(muerta, dadosFijos(0.5))).toEqual(muerta);
  });
});

/**
 * Sin paredes dibujadas te estrellas sin saber dónde estaba el borde. El marco
 * no es adorno: es la única pista de dónde acaba el mundo.
 */
describe('las paredes', () => {
  it('el tablero enmarcado añade una fila arriba y otra abajo', () => {
    expect(renderFramed(partida()).length).toBe(6 + 2);
  });

  it('y una columna a cada lado', () => {
    for (const fila of renderFramed(partida())) {
      expect(fila.length).toBe(10 + 2);
    }
  });

  it('las cuatro esquinas están cerradas', () => {
    const filas = renderFramed(partida());
    const arriba = filas[0];
    const abajo = filas[filas.length - 1];
    expect(arriba[0]).not.toBe(' ');
    expect(arriba[arriba.length - 1]).not.toBe(' ');
    expect(abajo[0]).not.toBe(' ');
    expect(abajo[abajo.length - 1]).not.toBe(' ');
  });

  it('los laterales tienen pared en todas las filas del juego', () => {
    const filas = renderFramed(partida());
    for (const fila of filas.slice(1, -1)) {
      expect(fila[0]).not.toBe(' ');
      expect(fila[fila.length - 1]).not.toBe(' ');
    }
  });

  it('dentro del marco está exactamente el mismo tablero', () => {
    const juego = partida();
    const dentro = renderFramed(juego)
      .slice(1, -1)
      .map((fila) => fila.slice(1, -1));
    expect(dentro).toEqual(render(juego));
  });

  it('la pared no se confunde con la serpiente ni con la comida', () => {
    const juego = partida();
    const marco = renderFramed(juego);
    const pared = marco[0][0];
    expect(render(juego).join('')).not.toContain(pared);
  });
});

describe('dibujar el tablero', () => {
  it('salen tantas filas como alto y tantas columnas como ancho', () => {
    const filas = render(partida());
    expect(filas.length).toBe(6);
    for (const fila of filas) {
      expect(fila.length).toBe(10);
    }
  });

  it('la cabeza, el cuerpo y la comida se distinguen', () => {
    const filas = render(partida());
    const todo = filas.join('');
    expect(new Set(todo.replace(/ /g, '')).size).toBeGreaterThanOrEqual(3);
  });
});
