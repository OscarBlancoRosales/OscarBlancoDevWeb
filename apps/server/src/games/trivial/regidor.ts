import {
  SEGUNDOS_PARA_PASAR_LA_BOMBA,
  SEGUNDOS_POR_PRUEBA,
} from '@devweb/shared/games/trivial/reglas';
import { laBombaPasaSola } from '@devweb/shared/games/trivial/index';
import { rondaEn } from '@devweb/shared/games/trivial/tipos';
import type { TrivialState } from '@devweb/shared/games/trivial/tipos';
import type { Narrador, RoomActor } from '../../rooms/actor';

/**
 * El reloj del concurso.
 *
 * La hora la pone el servidor porque es la única que comparten los cinco
 * navegadores de la mesa: cada uno tiene la suya y ninguna coincide. Y la pone
 * aquí, y no en el navegador, porque este es un concurso para programadores y
 * un cronómetro que corre en el cliente es un cronómetro que se para con las
 * herramientas de desarrollo abiertas.
 *
 * No habla. De hablar se encarga el presentador, y los dos entran en la sala
 * por el mismo hueco gracias al coro.
 */
export class RegidorDeSala implements Narrador {
  /** El temporizador de la ronda en marcha. Uno por sala, que es lo que es esto. */
  private reloj: ReturnType<typeof setTimeout> | null = null;

  /**
   * Qué está esperando ese temporizador.
   *
   * Hace falta distinguirlo porque los dos plazos conviven: quien contesta la
   * bomba en cinco segundos deja viva la cuenta atrás de doce, y si no se
   * supiera cuál es cuál, la bomba pasaría cuando terminara de correr la
   * cuenta de una ronda que ya está resuelta.
   */
  private esperando: 'cuenta-atras' | 'pase' | null = null;

  constructor(private readonly ahora: () => number = Date.now) {}

  trasJugada(actor: RoomActor, _antes: unknown, ahora: unknown): void {
    const state = ahora as TrivialState | null;
    if (!state) return;

    // La bomba es la única prueba que avanza sola. Quien la tiene contesta y
    // se ve enseguida a quién le cae encima: parar el programa ahí a esperar
    // un clic es apagar justo lo que la hace divertida.
    if (laBombaPasaSola(state)) {
      this.pasarLaBomba(actor, state);
      return;
    }

    if (state.fase !== 'ronda') {
      this.pararElReloj();
      return;
    }

    this.abrirLaCuentaAtras(actor, state);
  }

  parar(): void {
    this.pararElReloj();
  }

  /**
   * Arranca la cuenta atrás de esta ronda, si no la tiene ya.
   *
   * La guarda del `cierraEn` no es precaución de más: al narrador se le avisa
   * en **cada** jugada, respuestas incluidas, y sin ella cada persona que
   * contestara alargaría la ronda. Un cronómetro que se estira cuando lo usas
   * no es un cronómetro.
   */
  private abrirLaCuentaAtras(actor: RoomActor, state: TrivialState): void {
    const ronda = rondaEn(state, state.actual);
    if (!ronda || ronda.cerrada) return;
    if (state.cierraEn !== 0 || this.reloj) return;

    const segundos = SEGUNDOS_POR_PRUEBA[ronda.pregunta.tipo];
    if (!segundos) return;

    const milisegundos = segundos * 1000;
    const locutor = state.orden[0] ?? 'sala';
    actor.aplicarDelSistema(locutor, { tipo: 'reloj', hasta: this.ahora() + milisegundos });

    this.esperando = 'cuenta-atras';
    this.reloj = setTimeout(() => {
      this.reloj = null;
      this.esperando = null;
      actor.aplicarDelSistema(locutor, { tipo: 'tiempo' });
    }, milisegundos);
    this.reloj.unref();
  }

  /**
   * Deja ver el resultado y pasa la bomba al siguiente.
   *
   * Lo pide el mismo `tiempo` que cierra las rondas vencidas: el juego ya sabe
   * que una bomba resuelta lo que quiere es avanzar, así que desde aquí solo
   * hay que decirle cuándo.
   */
  private pasarLaBomba(actor: RoomActor, state: TrivialState): void {
    if (this.esperando === 'pase') return;

    // La cuenta atrás de la ronda que se acaba de resolver sigue corriendo:
    // quien contesta pronto se la deja viva. Sin pararla, la bomba tardaría en
    // pasar lo que quedara de ella.
    this.pararElReloj();

    const locutor = state.orden[0] ?? 'sala';
    this.esperando = 'pase';
    this.reloj = setTimeout(() => {
      this.reloj = null;
      this.esperando = null;
      actor.aplicarDelSistema(locutor, { tipo: 'tiempo' });
    }, SEGUNDOS_PARA_PASAR_LA_BOMBA * 1000);
    this.reloj.unref();
  }

  private pararElReloj(): void {
    this.esperando = null;
    if (!this.reloj) return;
    clearTimeout(this.reloj);
    this.reloj = null;
  }
}
