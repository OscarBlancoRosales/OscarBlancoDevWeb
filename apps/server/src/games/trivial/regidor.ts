import {
  MECHA_MAXIMA,
  MECHA_MINIMA,
  SEGUNDOS_PARA_PASAR,
  SEGUNDOS_POR_PRUEBA,
} from '@devweb/shared/games/trivial/reglas';
import { pasaSola } from '@devweb/shared/games/trivial/index';
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

  /**
   * La mecha de la bomba, que es un reloj aparte.
   *
   * No puede compartir temporizador con el de las rondas porque no vive en la
   * misma escala: las rondas se abren y se cierran debajo de ella mientras la
   * mecha sigue corriendo. Esa es justamente la prueba.
   */
  private mecha: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly ahora: () => number = Date.now,
    private readonly alAzar: () => number = Math.random,
  ) {}

  trasJugada(actor: RoomActor, _antes: unknown, ahora: unknown): void {
    const state = ahora as TrivialState | null;
    if (!state) return;

    // La mecha se mira siempre, porque corre por debajo de las rondas: se
    // enciende al entrar en la sección y no se apaga al cerrar una pregunta.
    this.mirarLaMecha(actor, state);

    // Las pruebas de ritmo avanzan solas. Se contesta, se ve quién ha
    // acertado y sigue: parar el programa ahí a esperar un clic apaga justo lo
    // que las hace rápidas.
    if (pasaSola(state)) {
      this.pasarDeRonda(actor, state);
      return;
    }

    if (state.fase !== 'ronda') {
      this.pararElReloj();
      return;
    }

    this.abrirLaCuentaAtras(actor, state);
  }

  /**
   * Enciende la mecha al entrar en la bomba, y la apaga al salir.
   *
   * Cuánto dura se decide aquí, al azar y sin decírselo a nadie. Va en la
   * jugada, así que el registro de la partida se vuelve a reproducir tal cual
   * pasó aunque el número saliera de un dado.
   */
  private mirarLaMecha(actor: RoomActor, state: TrivialState): void {
    // En marcha, o con la ronda recién resuelta: la mecha sigue ardiendo entre
    // una pregunta y la siguiente. En la presentación no, que ahí todavía está
    // entrando gente y la bomba se comería a quien llegara tarde.
    const jugando = state.fase === 'ronda' || state.fase === 'resultado';
    const enLaBomba = jugando && rondaEn(state, state.actual)?.pregunta.tipo === 'bomba';

    if (!enLaBomba) {
      this.apagarLaMecha();
      return;
    }

    // Ya hay una corriendo: no se toca. Encenderla otra vez la alargaría, y
    // una mecha que se reinicia con cada pregunta no se acaba nunca.
    if (this.mecha) return;

    const dura = MECHA_MINIMA + this.alAzar() * (MECHA_MAXIMA - MECHA_MINIMA);
    const milisegundos = Math.round(dura * 1000);
    const locutor = state.orden[0] ?? 'sala';
    actor.aplicarDelSistema(locutor, { tipo: 'mecha', hasta: this.ahora() + milisegundos });

    this.mecha = setTimeout(() => {
      this.mecha = null;
      actor.aplicarDelSistema(locutor, { tipo: 'estalla' });
    }, milisegundos);
    this.mecha.unref();
  }

  private apagarLaMecha(): void {
    if (!this.mecha) return;
    clearTimeout(this.mecha);
    this.mecha = null;
  }

  parar(): void {
    this.pararElReloj();
    this.apagarLaMecha();
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
   * Deja ver el resultado y pasa a la ronda siguiente.
   *
   * Lo pide el mismo `tiempo` que cierra las rondas vencidas: el juego ya sabe
   * que una ronda de ritmo resuelta lo que quiere es avanzar, así que desde
   * aquí solo hay que decirle cuándo.
   */
  private pasarDeRonda(actor: RoomActor, state: TrivialState): void {
    if (this.esperando === 'pase') return;

    // La cuenta atrás de la ronda que se acaba de resolver sigue corriendo:
    // quien contesta pronto se la deja viva. Sin pararla, la ronda tardaría en
    // pasar lo que quedara de ella.
    this.pararElReloj();

    const tipo = rondaEn(state, state.actual)?.pregunta.tipo;
    if (!tipo) return;

    const locutor = state.orden[0] ?? 'sala';
    this.esperando = 'pase';
    this.reloj = setTimeout(() => {
      this.reloj = null;
      this.esperando = null;
      actor.aplicarDelSistema(locutor, { tipo: 'tiempo' });
    }, SEGUNDOS_PARA_PASAR[tipo] * 1000);
    this.reloj.unref();
  }

  private pararElReloj(): void {
    this.esperando = null;
    if (!this.reloj) return;
    clearTimeout(this.reloj);
    this.reloj = null;
  }
}
