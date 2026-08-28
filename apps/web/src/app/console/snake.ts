/**
 * Motor del Snake de la terminal.
 *
 * No sabe nada del DOM ni del reloj: recibe un estado y unos dados, y devuelve
 * el estado siguiente. Quien lo use pone el temporizador y lo pinta.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface SnakeState {
  width: number;
  height: number;
  /** La cabeza va primero. */
  snake: Point[];
  dir: Dir;
  food: Point;
  score: number;
  over: boolean;
}

/** De dónde tira cada dirección. */
const PASO: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPUESTA: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const HEAD_CHAR = '@';
export const BODY_CHAR = 'o';
export const FOOD_CHAR = '*';
export const EMPTY_CHAR = ' ';

/** Las paredes. Que se vean es media partida: contra lo que no ves, chocas. */
const WALL_H = '─';
const WALL_V = '│';
const CORNERS = ['┌', '┐', '└', '┘'];

/** Puntos por bocado. */
const PREMIO = 10;

export function newGame(width: number, height: number, rng: () => number): SnakeState {
  const y = Math.floor(height / 2);
  const x = Math.floor(width / 3);
  const snake: Point[] = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ].filter((p) => p.x >= 0);

  return {
    width,
    height,
    snake,
    dir: 'right',
    food: freeSpot(snake, width, height, rng),
    score: 0,
    over: false,
  };
}

/**
 * Girar. Darse la vuelta del todo mataría al instante, así que con cuerpo se
 * ignora; con un solo trozo no hay contra qué chocar y se permite.
 */
export function turn(state: SnakeState, dir: Dir): SnakeState {
  if (state.over) return state;
  if (state.snake.length > 1 && dir === OPUESTA[state.dir]) return state;
  return { ...state, dir };
}

export function step(state: SnakeState, rng: () => number): SnakeState {
  if (state.over) return state;

  const paso = PASO[state.dir];
  const cabeza: Point = { x: state.snake[0].x + paso.x, y: state.snake[0].y + paso.y };

  const fuera =
    cabeza.x < 0 || cabeza.y < 0 || cabeza.x >= state.width || cabeza.y >= state.height;
  if (fuera) return { ...state, over: true };

  const come = cabeza.x === state.food.x && cabeza.y === state.food.y;
  // La cola se libera en el mismo turno, salvo que la serpiente crezca.
  const cuerpo = come ? state.snake : state.snake.slice(0, -1);
  if (cuerpo.some((p) => p.x === cabeza.x && p.y === cabeza.y)) {
    return { ...state, over: true };
  }

  const snake = [cabeza, ...cuerpo];
  if (!come) return { ...state, snake };

  return {
    ...state,
    snake,
    score: state.score + PREMIO,
    food: freeSpot(snake, state.width, state.height, rng),
  };
}

export function render(state: SnakeState): string[] {
  const filas: string[][] = Array.from({ length: state.height }, () =>
    Array.from({ length: state.width }, () => EMPTY_CHAR),
  );

  filas[state.food.y][state.food.x] = FOOD_CHAR;
  state.snake.forEach((p, i) => {
    filas[p.y][p.x] = i === 0 ? HEAD_CHAR : BODY_CHAR;
  });

  return filas.map((fila) => fila.join(''));
}

/**
 * El tablero con sus cuatro paredes dibujadas. El juego se sigue calculando
 * sobre la rejilla de dentro: el marco es solo lo que se ve.
 */
export function renderFramed(state: SnakeState): string[] {
  const [ul, ur, dl, dr] = CORNERS;
  const horizontal = WALL_H.repeat(state.width);
  return [
    ul + horizontal + ur,
    ...render(state).map((fila) => WALL_V + fila + WALL_V),
    dl + horizontal + dr,
  ];
}

/**
 * Un hueco libre para la comida. Si los dados apuntan a la serpiente se
 * recorre el tablero desde ahí hasta encontrar sitio, así que siempre acierta
 * mientras quede una casilla.
 */
function freeSpot(snake: Point[], width: number, height: number, rng: () => number): Point {
  const casillas = width * height;
  const ocupada = (x: number, y: number) => snake.some((p) => p.x === x && p.y === y);
  const inicio = Math.min(casillas - 1, Math.floor(rng() * casillas));

  for (let i = 0; i < casillas; i++) {
    const pos = (inicio + i) % casillas;
    const x = pos % width;
    const y = Math.floor(pos / width);
    if (!ocupada(x, y)) return { x, y };
  }
  // Tablero lleno: has ganado y no hay dónde poner nada.
  return { x: snake[0].x, y: snake[0].y };
}
