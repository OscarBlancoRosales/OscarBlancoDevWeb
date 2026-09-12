import { aciertaCon, respuestaDe } from './reglas';
import { rondaEn } from './tipos';
import type { Momento } from './guion';
import type { TrivialState } from './tipos';
import type { SeatId } from '../module';

/**
 * Qué toca decir, mirando cómo ha cambiado la partida.
 *
 * Es la diferencia entre un presentador y un rótulo: no basta con anunciar la
 * ronda, hay que ver quién ha remontado, quién se está hundiendo y a quién le
 * ha estallado la bomba. Todo eso está en la diferencia entre dos estados, y
 * por eso se calcula aquí, sin tocar red ni reloj: así se puede probar entero
 * y sale igual para toda la mesa.
 */

export interface Comentario {
  readonly momento: Momento;
  /** A quién va dirigido, si va dirigido a alguien. */
  readonly quien: SeatId | null;
  readonly puntos: number;
}

/** El nombre que se lee de cada asiento, para no soltar identificadores. */
export type Nombres = Readonly<Record<SeatId, string>>;

/**
 * El comentario que pega entre estos dos estados, o `null` si no toca hablar.
 *
 * El orden de las comprobaciones es el orden de importancia en un programa: lo
 * que acaba de pasar manda sobre lo que viene, y el final manda sobre todo.
 */
export function comentarioDe(antes: TrivialState, ahora: TrivialState): Comentario | null {
  // El final del programa manda sobre todo lo demás.
  if (ahora.fase === 'fin' && antes.fase !== 'fin') {
    const [quien, puntos] = lider(ahora);
    return { momento: 'podio', quien, puntos };
  }

  // Se abre la fase de apuestas de la final.
  if (ahora.fase === 'apuestas' && antes.fase !== 'apuestas') {
    return { momento: 'presentaApuestas', quien: null, puntos: 0 };
  }

  // Y se cierra: de apostar se pasa a contestar, y las apuestas ya se ven.
  if (antes.fase === 'apuestas' && ahora.fase === 'ronda') {
    return { momento: 'apuestasCerradas', quien: null, puntos: 0 };
  }

  if (antes.fase === 'presentacion' && ahora.fase === 'ronda') {
    return { momento: 'bienvenida', quien: null, puntos: 0 };
  }

  // Una ronda que se acaba de cerrar es lo más comentable que hay.
  if (ahora.fase === 'resultado' && antes.fase !== 'resultado') {
    return trasLaRonda(antes, ahora);
  }

  // Al entrar en una ronda nueva: cortinilla de sección, o presentar la ronda.
  if (ahora.fase === 'ronda' && ahora.actual !== antes.actual) {
    return alEntrarEnLaRonda(antes, ahora);
  }

  return null;
}

function trasLaRonda(antes: TrivialState, ahora: TrivialState): Comentario {
  const ronda = rondaEn(ahora, ahora.actual);
  const tipo = ronda?.pregunta.tipo;

  // Una ronda anulada no la ha fallado nadie: lo que hay que contar es que la
  // mesa ha tumbado una pregunta, no quién sumó más.
  if (ronda?.anulada) return { momento: 'anulada', quien: null, puntos: 0 };

  if (tipo === 'final') {
    const [quien, puntos] = lider(ahora);
    return { momento: 'resultadoFinal', quien, puntos };
  }

  if (tipo === 'bomba') {
    const quien = antes.turno;
    const suya = quien && ronda ? respuestaDe(ronda.respuestas, quien) : undefined;

    // Ronda cerrada y sin respuesta suya: se le acabó la mecha en la mano. Es
    // la única forma de que una bomba se cierre sin que nadie conteste.
    if (!suya) return { momento: 'explota', quien, puntos: ahora.puntos[quien ?? ''] ?? 0 };

    // Cuánta mecha queda no se dice: ni el presentador lo sabe, y contarlo
    // sería la única forma de que la mesa pudiera calcular a quién le toca.
    return ronda && aciertaCon(ronda.pregunta, suya.valor)
      ? { momento: 'pasaLaBomba', quien, puntos: 0 }
      : { momento: 'seLaQueda', quien, puntos: 0 };
  }

  // Una racha larga es lo que hay que subrayar en la ráfaga.
  if (tipo === 'rafaga') {
    const [quien, racha] = mejorRacha(ahora);
    if (racha >= 3) return { momento: 'rachaBuena', quien, puntos: racha };
  }

  const ganador = quienMasSumo(antes, ahora);
  if (!ganador) return { momento: 'nadieAcierta', quien: null, puntos: 0 };

  const [quien, ganados] = ganador;

  // Adelantar a alguien es la noticia; sumar sin más, no tanto.
  if (haRemontado(antes, ahora, quien)) {
    return { momento: 'remonta', quien, puntos: ahora.puntos[quien] ?? 0 };
  }

  return { momento: 'aciertaAlguien', quien, puntos: ganados };
}

function alEntrarEnLaRonda(antes: TrivialState, ahora: TrivialState): Comentario | null {
  const entra = rondaEn(ahora, ahora.actual)?.pregunta.tipo;
  const salia = rondaEn(antes, antes.actual)?.pregunta.tipo;

  // Cambio de sección: cortinilla. Es lo que le da forma de programa.
  if (entra && entra !== salia) {
    return { momento: seccionDe(entra), quien: null, puntos: 0 };
  }

  if (ahora.actual === ahora.rondas.length - 1) {
    return { momento: 'ultimaRonda', quien: null, puntos: 0 };
  }

  // A mitad de programa, un repaso al marcador: quién manda y quién no.
  if (ahora.actual === Math.floor(ahora.rondas.length / 2)) {
    return apretado(ahora)
      ? { momento: 'pegados', quien: null, puntos: 0 }
      : { momento: 'lider', ...conLider(ahora) };
  }

  const hundido = elQueSeHunde(ahora);
  if (hundido) return { momento: 'seHunde', quien: hundido, puntos: ahora.puntos[hundido] ?? 0 };

  return { momento: 'presentaRonda', quien: null, puntos: 0 };
}

/** La cortinilla que le toca a cada prueba. */
function seccionDe(tipo: string): Momento {
  switch (tipo) {
    case 'pulsa':
      return 'seccionPulsa';
    case 'rafaga':
      return 'seccionRafaga';
    case 'bomba':
      return 'seccionBomba';
    case 'estimacion':
      return 'seccionEstimacion';
    case 'final':
      return 'seccionFinal';
    case 'fallo':
      return 'seccionFallo';
    default:
      return 'seccionTest';
  }
}

/** Quién más sumó en la última ronda, si alguien sumó algo. */
function quienMasSumo(antes: TrivialState, ahora: TrivialState): [SeatId, number] | null {
  let mejor: [SeatId, number] | null = null;
  for (const seat of ahora.orden) {
    const ganados = (ahora.puntos[seat] ?? 0) - (antes.puntos[seat] ?? 0);
    if (ganados > 0 && (!mejor || ganados > mejor[1])) mejor = [seat, ganados];
  }
  return mejor;
}

/** Si en esa ronda se puso por delante de alguien a quien no adelantaba antes. */
function haRemontado(antes: TrivialState, ahora: TrivialState, seat: SeatId): boolean {
  return ahora.orden.some(
    (otro) =>
      otro !== seat &&
      (antes.puntos[otro] ?? 0) > (antes.puntos[seat] ?? 0) &&
      (ahora.puntos[seat] ?? 0) > (ahora.puntos[otro] ?? 0),
  );
}

/** El último de la tabla, si la distancia con el primero ya es sangrante. */
function elQueSeHunde(state: TrivialState): SeatId | null {
  if (state.orden.length < 2) return null;
  const [, mejor] = lider(state);
  const ultimo = [...state.orden]
    .sort((a, b) => (state.puntos[a] ?? 0) - (state.puntos[b] ?? 0))
    .at(0);
  if (!ultimo) return null;
  return mejor - (state.puntos[ultimo] ?? 0) >= 250 ? ultimo : null;
}

function apretado(state: TrivialState): boolean {
  const puntos = state.orden.map((seat) => state.puntos[seat] ?? 0);
  if (puntos.length < 2) return false;
  return Math.max(...puntos) - Math.min(...puntos) <= 60;
}

function conLider(state: TrivialState): { quien: SeatId | null; puntos: number } {
  const [quien, puntos] = lider(state);
  return { quien, puntos };
}

/** Quién va primero y con cuántos. */
export function lider(state: TrivialState): [SeatId | null, number] {
  let mejor: [SeatId | null, number] = [null, 0];
  for (const seat of state.orden) {
    const suyos = state.puntos[seat] ?? 0;
    if (!mejor[0] || suyos > mejor[1]) mejor = [seat, suyos];
  }
  return mejor;
}

function mejorRacha(state: TrivialState): [SeatId | null, number] {
  let mejor: [SeatId | null, number] = [null, 0];
  for (const seat of state.orden) {
    const suya = state.racha[seat] ?? 0;
    if (suya > mejor[1]) mejor = [seat, suya];
  }
  return mejor;
}
