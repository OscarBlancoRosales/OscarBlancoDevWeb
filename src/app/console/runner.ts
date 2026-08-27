/**
 * Motor del corredor: un developer esquivando lo que le tira el día.
 *
 * Como el de la serpiente, no toca el DOM ni el reloj: recibe un estado y unos
 * dados, y devuelve el siguiente. Quien lo use pone el temporizador y lo pinta.
 */

export type ObstacleKind = 'bug' | 'virus' | 'error404' | 'coffee';

export interface Obstacle {
  /** Columna de la rejilla; va bajando hasta salir por la izquierda. */
  x: number;
  kind: ObstacleKind;
}

export interface RunnerState {
  width: number;
  height: number;
  /** Columna fija donde corre: el mundo se mueve, él no. */
  runnerX: number;
  /** Filas por encima del suelo. 0 es correr. */
  y: number;
  vy: number;
  ducking: boolean;
  obstacles: Obstacle[];
  distance: number;
  lives: number;
  /** Pasos que le quedan al café. */
  shield: number;
  /** Respiro tras un golpe, para no morir tres veces contra el mismo bug. */
  invuln: number;
  over: boolean;
}

/** Impulso y gravedad, en filas por paso. */
const JUMP_V = 2;
const GRAVITY = 1;
const MAX_LIVES = 3;
const SHIELD_TICKS = 60;
const INVULN_TICKS = 8;
/** Hueco mínimo entre obstáculos: sin esto salen pegados y es injugable. */
const MIN_GAP = 9;

/**
 * Cada obstáculo, con su tamaño y a qué altura vive.
 *
 * `bottom` es la fila sobre el suelo donde apoya, y `rows` cuánto ocupa hacia
 * arriba. De ahí sale toda la mecánica: el bug se salta, el virus se esquiva
 * agachándose, y el 404 pide un salto de verdad.
 */
const SHAPES: Record<ObstacleKind, { art: string[]; bottom: number; rows: number }> = {
  bug: { art: ['{}'], bottom: 0, rows: 1 },
  error404: { art: ['404', '▀▀▀'], bottom: 0, rows: 2 },
  virus: { art: ['<X>'], bottom: 2, rows: 1 },
  coffee: { art: ['[c]'], bottom: 1, rows: 1 },
};

const RUNNER_W = 3;

export function newRun(width: number, height: number): RunnerState {
  return {
    width,
    height,
    runnerX: 4,
    y: 0,
    vy: 0,
    ducking: false,
    obstacles: [],
    distance: 0,
    lives: MAX_LIVES,
    shield: 0,
    invuln: 0,
    over: false,
  };
}

/** Saltar. En el aire no hay segundo salto que valga. */
export function jump(state: RunnerState): RunnerState {
  if (state.over || state.y > 0) return state;
  return { ...state, vy: JUMP_V, ducking: false };
}

/** Agacharse. Solo se puede con los pies en el suelo. */
export function duck(state: RunnerState, on: boolean): RunnerState {
  if (state.over) return state;
  if (on && state.y > 0) return state;
  return { ...state, ducking: on };
}

/** Suelta un obstáculo por la derecha, si hay sitio. */
export function spawn(state: RunnerState, rng: () => number): RunnerState {
  const ultimo = Math.max(...state.obstacles.map((o) => o.x), -Infinity);
  if (Number.isFinite(ultimo) && state.width - ultimo < MIN_GAP) return state;
  if (rng() > 0.25) return state;

  const suerte = rng();
  const kind: ObstacleKind =
    suerte < 0.12 ? 'coffee' : suerte < 0.4 ? 'virus' : suerte < 0.72 ? 'bug' : 'error404';
  return { ...state, obstacles: [...state.obstacles, { x: state.width - 1, kind }] };
}

export function tick(state: RunnerState, rng: () => number): RunnerState {
  if (state.over) return state;

  // Física del salto: sube, la gravedad tira, y al tocar suelo se para.
  let y = state.y + state.vy;
  let vy = state.vy - GRAVITY;
  if (y <= 0) {
    y = 0;
    vy = 0;
  }

  const movidos = state.obstacles
    .map((o) => ({ ...o, x: o.x - 1 }))
    .filter((o) => o.x + SHAPES[o.kind].art[0].length > 0);

  let siguiente: RunnerState = {
    ...state,
    y,
    vy,
    obstacles: movidos,
    distance: state.distance + 1,
    shield: Math.max(0, state.shield - 1),
    invuln: Math.max(0, state.invuln - 1),
  };

  siguiente = resolveHits(siguiente);
  return spawn(siguiente, rng);
}

/** Qué filas ocupa el corredor ahora mismo, contadas desde el suelo. */
function runnerRows(state: RunnerState): [number, number] {
  const alto = state.ducking ? 2 : 3;
  return [state.y, state.y + alto - 1];
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** Cobra los golpes y recoge los cafés de este paso. */
function resolveHits(state: RunnerState): RunnerState {
  const [pies, cabeza] = runnerRows(state);
  const columnas: [number, number] = [state.runnerX, state.runnerX + RUNNER_W - 1];

  let { lives, shield, invuln, obstacles } = state;
  let golpeado = false;

  for (const obs of obstacles) {
    const forma = SHAPES[obs.kind];
    const suyas: [number, number] = [forma.bottom, forma.bottom + forma.rows - 1];
    const anchoObs: [number, number] = [obs.x, obs.x + forma.art[0].length - 1];
    if (!overlaps(columnas, anchoObs) || !overlaps([pies, cabeza], suyas)) continue;

    if (obs.kind === 'coffee') {
      shield = Math.max(shield, SHIELD_TICKS);
      obstacles = obstacles.filter((o) => o !== obs);
      continue;
    }
    if (shield > 0 || invuln > 0) continue;
    golpeado = true;
  }

  if (golpeado) {
    lives -= 1;
    invuln = INVULN_TICKS;
  }

  return { ...state, lives, shield, invuln, obstacles, over: lives <= 0 };
}

/** El muñeco: corriendo, agachado o en el aire. */
function runnerArt(state: RunnerState): string[] {
  if (state.ducking) return ['\\o/', '/ \\'];
  if (state.y > 0) return [' o ', '\\|/', '/ \\'];
  // Las piernas alternan para que se note que corre.
  return [' o ', '/|\\', state.distance % 2 ? '/ \\' : '<| '];
}

export function renderRun(state: RunnerState): string[] {
  const filas: string[][] = Array.from({ length: state.height }, () =>
    Array.from({ length: state.width }, () => ' '),
  );
  const sueloFila = state.height - 1;
  /** Convierte «filas sobre el suelo» en fila de la rejilla. */
  const filaDe = (sobreElSuelo: number) => sueloFila - 1 - sobreElSuelo;

  const pintar = (art: string[], x: number, abajo: number) => {
    art.forEach((linea, i) => {
      const fila = filaDe(abajo + (art.length - 1 - i));
      if (fila < 0 || fila >= state.height) return;
      for (let c = 0; c < linea.length; c++) {
        const col = x + c;
        if (col < 0 || col >= state.width || linea[c] === ' ') continue;
        filas[fila][col] = linea[c];
      }
    });
  };

  for (const obs of state.obstacles) {
    const forma = SHAPES[obs.kind];
    pintar(forma.art, obs.x, forma.bottom);
  }
  pintar(runnerArt(state), state.runnerX, state.y);

  filas[sueloFila] = Array.from({ length: state.width }, () => '═');
  return filas.map((f) => f.join(''));
}
