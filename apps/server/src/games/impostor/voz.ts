import { randomInt } from 'node:crypto';
import { frasePara, momentoDe } from '@devweb/shared/games/impostor/guion';
import { nombreDelTema } from '@devweb/shared/games/impostor/temas';
import { rngFor } from '@devweb/shared/engine/rng';
import { sortear } from './sorteo';
import type { Azar } from './sorteo';
import type { Momento } from '@devweb/shared/games/impostor/guion';
import type { ImpostorState } from '@devweb/shared/games/impostor/tipos';
import type { SeatId } from '@devweb/shared/games/module';
import type { Narrador, RoomActor } from '../../rooms/actor';

/**
 * La voz de la sala del Impostor, y la mano que reparte.
 *
 * Hace dos cosas y las dos por el mismo motivo: son las dos que no pueden vivir
 * dentro del módulo del juego. Repartir necesita azar que nadie pueda repetir,
 * y hablar necesita que la frase sea la misma para toda la mesa.
 *
 * Repartir aquí es lo que mantiene el juego en pie. Si la palabra y el impostor
 * salieran de la configuración de la sala —que se puede pedir por HTTP— la
 * primera partida duraría lo que tarda alguien en abrir las herramientas de
 * desarrollo.
 */
export class VozDeLaSala implements Narrador {
  /** El temporizador del debate. Uno por sala, que es lo que es esta clase. */
  private reloj: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly nombres: () => Readonly<Record<SeatId, string>>,
    private readonly azar: Azar = randomInt,
    private readonly ahora: () => number = Date.now,
  ) {}

  trasJugada(actor: RoomActor, antes: unknown, ahora: unknown): void {
    const previo = antes as ImpostorState | null;
    const actual = ahora as ImpostorState | null;
    if (!actual) return;

    // La mesa ha dicho que está lista y espera palabra. Es lo único que la
    // partida no puede resolver sola.
    if (actual.fase === 'repartiendo') {
      this.repartir(actor, actual);
      return;
    }

    if (actual.fase === 'debate') this.abrirDebate(actor, actual);
    else this.pararElReloj();

    const momento = momentoDe(previo, actual);
    if (momento) this.decir(actor, actual, momento);
  }

  /**
   * Pone en marcha el reloj del debate.
   *
   * La hora la pone el servidor porque es la única que comparten los ocho
   * navegadores de la mesa: cada uno tiene la suya y ninguna coincide. Lo que
   * viaja es el instante en que se acaba, y cada pantalla cuenta hacia atrás.
   *
   * Sin segundos configurados no hay reloj: el debate dura lo que el anfitrión
   * quiera, que en una mesa de amigos suele ser mejor.
   */
  private abrirDebate(actor: RoomActor, state: ImpostorState): void {
    if (state.debateHasta !== 0 || state.segundosDebate <= 0 || this.reloj) return;

    const milisegundos = state.segundosDebate * 1000;
    const locutor = state.orden[0] ?? 'sala';
    actor.aplicarDelSistema(locutor, { tipo: 'debate', hasta: this.ahora() + milisegundos });

    this.reloj = setTimeout(() => {
      this.reloj = null;
      actor.aplicarDelSistema(locutor, { tipo: 'aVotar' });
    }, milisegundos);
    this.reloj.unref();
  }

  private pararElReloj(): void {
    if (!this.reloj) return;
    clearTimeout(this.reloj);
    this.reloj = null;
  }

  /**
   * Sortea la ronda y la mete en la partida.
   *
   * Si la mesa se ha quedado corta no se reparte nada: la sala se queda
   * esperando, que es mejor que empezar una ronda de dos en la que el impostor
   * es medio juego.
   */
  private repartir(actor: RoomActor, state: ImpostorState): void {
    const reparto = sortear({
      jugadores: actor.asientos.map((asiento) => asiento.id),
      temaId: state.temaId,
      impostoresPedidos: state.impostoresPedidos,
      azar: this.azar,
    });
    if (!reparto) return;

    actor.aplicarDelSistema(reparto.orden[0] ?? 'sala', reparto);

    // Se lee el estado de después y no se reconstruye: la frase habla del
    // tema y de la palabra que acaban de repartirse.
    const repartido = actor.estado as ImpostorState | null;
    if (repartido) this.decir(actor, repartido, 'reparto');
  }

  private decir(actor: RoomActor, state: ImpostorState, momento: Momento): void {
    const nombres = this.nombres();
    const frase = frasePara(
      momento,
      {
        quien: state.expulsado ? (nombres[state.expulsado] ?? 'alguien') : 'alguien',
        tema: nombreDelTema(state.temaId),
        palabra: state.palabra,
      },
      rngFor(state.semilla, state.jugadas, `voz:${momento}`),
    );

    actor.aplicarDelSistema(state.orden[0] ?? 'sala', { tipo: 'narra', momento, frase });
  }
}

/** Los nombres de la mesa, para que la sala llame a la gente por su nombre. */
export function nombresDe(
  asientos: readonly { readonly seatId: string; readonly displayName: string }[],
): Record<SeatId, string> {
  return Object.fromEntries(asientos.map((asiento) => [asiento.seatId, asiento.displayName]));
}
