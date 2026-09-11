import { Component, OnDestroy, OnInit, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrivialRoomService } from '../trivial-room.service';
import { Plato } from '../plato/plato';
import { Atriles } from '../plato/atriles/atriles';
import { PresentadorEnPlato } from '../plato/presentador/presentador';
import { PanelPregunta } from '../plato/panel-pregunta/panel-pregunta';
import { Cronometro } from '../plato/cronometro/cronometro';
import { Rotulo, SECCIONES } from '../plato/rotulo/rotulo';
import { DURACION, golpeEntre } from '../plato/escena';
import {
  CADA_APUESTA,
  REVELACION,
  cuandoEmpieza,
  seApagan,
  seExplica,
  turnoDeCantar,
} from '../plato/revelacion';
import { LO_QUE_SACUDE } from '../plato/escenario3d/escenario';
import type { Golpe } from '../plato/escena';
import type { Paso } from '../plato/revelacion';
import type { Cuadro } from '../plato/escenario3d/escenario';
import { MandoDeApuesta } from '../plato/apuesta/apuesta';
import { Podio } from '../plato/podio/podio';
import { Sonido } from '../plato/sonido';
import type { Efecto } from '../plato/sonido';
import { SEGUNDOS_PARA_APOSTAR, SEGUNDOS_POR_PRUEBA } from '@devweb/shared/games/trivial/reglas';
import { fotoDelPersonaje } from '@devweb/shared/games/trivial/reparto';
import { paseDe } from '../../pase-guardado';
import type { Signal } from '@angular/core';
import type { PuestoEnAtril } from '../plato/atriles/atriles';
import type { Seccion } from '../plato/rotulo/rotulo';
import type { TrivialView } from '@devweb/shared/games/trivial/tipos';

/**
 * El director del plató.
 *
 * Ya no pinta: mira la vista que manda el servidor y decide qué pieza está en
 * pantalla. Lo que antes eran doscientas líneas de plantilla y quinientas de
 * CSS haciendo de todo son ahora siete piezas que se prueban de una en una.
 *
 * Sigue sin saber ninguna respuesta hasta que la ronda se cierra, porque hasta
 * entonces no se la mandan.
 */
@Component({
  selector: 'app-trivial-room',
  imports: [
    Plato,
    Atriles,
    PresentadorEnPlato,
    PanelPregunta,
    Cronometro,
    Rotulo,
    MandoDeApuesta,
    Podio,
  ],
  templateUrl: './trivial-room.html',
  styleUrl: './trivial-room.css',
})
export class TrivialRoom implements OnInit, OnDestroy {
  readonly vista: Signal<TrivialView | null>;
  readonly error: Signal<string | null>;

  readonly roomId = signal('');
  readonly enlaceCopiado = signal(false);

  /** La sección que está anunciándose. `null` cuando el rótulo ya se fue. */
  readonly anunciando = signal<Seccion | null>(null);

  /** El golpe que se está contando ahora mismo, para que la cámara reaccione. */
  readonly contando = signal<Golpe | null>(null);

  /**
   * En qué punto va el destape de la respuesta.
   *
   * Fuera de una ronda cerrada da igual. Dentro es lo que hace que la
   * respuesta se cuente: un compás de silencio, se enciende la buena, se
   * apagan las demás y reacciona el marcador, y solo entonces se explica.
   */
  readonly destapa = signal<Paso>('listo');

  /** Cuántas apuestas se han cantado ya en la final. */
  readonly cantadas = signal(0);

  /** Si el plató está temblando ahora mismo. */
  readonly sacudiendo = signal(false);

  /** La vista anterior: el director decide comparando dos. */
  private anterior: TrivialView | null = null;
  /** Lo último que dijo el presentador, para no repetir efecto de sonido. */
  private ultimoMomento = '';
  private seFue: ReturnType<typeof setTimeout> | null = null;

  /**
   * Todo lo que hay pendiente de sonar.
   *
   * Se apuntan para poder cancelarlos al salir: un destape a medias con el
   * componente ya destruido escribe en señales que ya no mira nadie, y en un
   * concurso al que se entra y se sale se acumulan de veinte en veinte.
   */
  private readonly relojes: ReturnType<typeof setTimeout>[] = [];

  readonly callado: Signal<boolean>;

  constructor(
    private readonly sala: TrivialRoomService,
    private readonly sonido: Sonido,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {
    this.vista = sala.vista;
    this.error = sala.error;
    this.callado = sonido.callado;

    // Lo que hay que hacer -y no pintar- cuando cambia la vista: anunciar una
    // sección nueva y soltar el efecto que toque. Va en un efecto y no en un
    // `computed` porque escribe señales, y un `computed` tiene prohibido
    // hacerlo: lo suyo es calcular, no decidir.
    effect(() => {
      const v = this.vista();
      if (!v) return;
      this.dirige(v);
      this.miraSiSuena(v);
    });
  }

  ngOnInit(): void {
    const sala = this.ruta.snapshot.queryParamMap.get('sala') ?? '';
    const pase = sala ? paseDe(sala) : null;

    if (!pase) {
      void this.router.navigate(['/juegos/trivial'], {
        ...(sala && { queryParams: { sala } }),
      });
      return;
    }

    this.roomId.set(sala);
    this.sala.reconectar(pase);
  }

  ngOnDestroy(): void {
    if (this.seFue) clearTimeout(this.seFue);
    for (const reloj of this.relojes) clearTimeout(reloj);
    this.relojes.length = 0;
    this.sala.desconectar();
  }

  /** Hace algo dentro de un rato, y lo deja apuntado para poder cancelarlo. */
  private enUnRato(que: () => void, ms: number): void {
    this.relojes.push(setTimeout(que, ms));
  }

  // --- Lo que decide qué está en pantalla ---------------------------------

  /**
   * Monta el golpe de efecto que pida la vista que acaba de llegar.
   *
   * Quién decide el golpe es una función pura -`golpeEntre`- que compara dos
   * vistas; aquí solo se le pone el reloj encima. Así la coreografía se prueba
   * sin navegador y sale igual en las cinco pantallas de la mesa.
   */
  private dirige(v: TrivialView): void {
    const antes = this.anterior;
    this.anterior = v;

    // Las apuestas se cantan aunque no haya golpe: cerrarlas no cambia de fase
    // ni de prueba, así que `golpeEntre` no tiene nada que decir de eso.
    this.miraLasApuestas(antes, v);

    const cambio = golpeEntre(antes, v);
    if (!cambio) return;

    // La cámara del escenario reacciona a todos los golpes, aunque el rótulo
    // solo salga en algunos.
    this.contando.set(cambio.golpe);
    this.enUnRato(() => {
      if (this.contando() === cambio.golpe) this.contando.set(null);
    }, DURACION[cambio.golpe]);

    // Al cerrarse la ronda no se enseña la respuesta: se destapa. Cualquier
    // otro golpe deja el panel como debe estar para una ronda que empieza.
    if (cambio.golpe === 'resuelve') this.destapaLaRespuesta();
    else this.destapa.set('listo');

    // De momento solo la cortinilla para el juego. Los demás golpes los pintan
    // las piezas por su cuenta, con sus propias animaciones de entrada.
    if (cambio.golpe !== 'seccion' && cambio.golpe !== 'arranca') return;
    if (!cambio.seccion) return;

    this.anunciando.set(SECCIONES[cambio.seccion]);
    this.sonido.suena('rotulo');

    if (this.seFue) clearTimeout(this.seFue);
    this.seFue = setTimeout(() => {
      this.anunciando.set(null);
      this.seFue = null;
    }, DURACION[cambio.golpe]);
  }

  /**
   * Pone en marcha el destape de la respuesta.
   *
   * Los tiempos los pone `revelacion`; aquí solo se les cuelga el reloj. El
   * marcador y el botón de seguir miran esa misma señal, así que los tres van
   * acompasados sin tener que hablar entre ellos.
   */
  private destapaLaRespuesta(): void {
    this.destapa.set('silencio');
    for (const tramo of REVELACION) {
      if (tramo.enMs === 0) continue;
      this.enUnRato(() => {
        this.destapa.set(tramo.paso);
      }, tramo.enMs);
    }
  }

  /**
   * Canta las apuestas de la final, de una en una.
   *
   * Solo la primera vez que llegan: después el servidor las sigue mandando en
   * cada vista y volver a empezar la cuenta las dejaría parpadeando.
   */
  private miraLasApuestas(antes: TrivialView | null, v: TrivialView): void {
    if (!v.apuestas) {
      if (this.cantadas() !== 0) this.cantadas.set(0);
      return;
    }
    if (antes?.apuestas) return;

    this.cantadas.set(0);
    for (let cuantas = 1; cuantas <= this.clasificacion.length; cuantas += 1) {
      const hasta = cuantas;
      this.enUnRato(() => {
        this.cantadas.set(hasta);
        this.sonido.suena('pulsa');
      }, hasta * CADA_APUESTA);
    }
  }

  /** La sacudida de la explosión, que se apaga sola. */
  private sacudeElPlato(): void {
    this.sacudiendo.set(true);
    this.enUnRato(() => {
      this.sacudiendo.set(false);
    }, LO_QUE_SACUDE);
  }

  private miraSiSuena(v: TrivialView): void {
    if (v.momento === this.ultimoMomento) return;
    this.ultimoMomento = v.momento;

    if (v.momento === 'podio') this.sonido.suena('fanfarria');
    else if (v.momento === 'explota') {
      this.sonido.suena('falla');
      this.sacudeElPlato();
    } else if (v.momento === 'nadieAcierta') this.alEncenderse('falla');
    else if (v.momento === 'aciertaAlguien' || v.momento === 'remonta') {
      this.alEncenderse('acierta');
    }
  }

  /**
   * El sonido del resultado no suena al cerrarse la ronda: suena cuando se
   * enciende la respuesta.
   *
   * Sonar antes es cantar el resultado con la pantalla todavía sin cambiar, y
   * entonces el destape llega tarde a su propia fiesta.
   */
  private alEncenderse(efecto: Efecto): void {
    this.enUnRato(() => {
      this.sonido.suena(efecto);
    }, cuandoEmpieza('enciende'));
  }

  saltarRotulo(): void {
    if (this.seFue) clearTimeout(this.seFue);
    this.seFue = null;
    this.anunciando.set(null);
  }

  alternarSonido(): void {
    this.sonido.alternar();
  }

  // --- Lo que se manda al servidor ----------------------------------------

  empezar(): void {
    this.sala.empezar();
  }

  responder(opcion: number): void {
    this.sonido.suena('pulsa');
    this.sala.responder(opcion);
  }

  apostar(cuanto: number): void {
    this.sonido.suena('pulsa');
    this.sala.apostar(cuanto);
  }

  impugnar(): void {
    this.sala.impugnar();
  }

  siguiente(): void {
    this.sala.siguiente();
  }

  // --- Lo que se le da a cada pieza ---------------------------------------

  /** La fila de atriles, con la reacción de cada uno ya decidida. */
  get puestos(): PuestoEnAtril[] {
    const v = this.vista();
    if (!v) return [];

    // Los atriles no reaccionan hasta que se apagan las opciones malas: si el
    // marcador se mueve antes de que se vea la respuesta, ya sabes quién ha
    // acertado sin haberla leído, y el destape no cuenta nada.
    const yaReaccionan = seApagan(this.destapa());
    const ganados = new Map((v.resultados ?? []).map((uno) => [uno.seatId, uno.ganados]));
    const tabla = this.clasificacion;
    const cantadas = this.cantadas();
    // Nadie lidera mientras estén todos a cero: una corona en la ronda uno no
    // dice nada y además se la queda quien salga primero en la lista.
    const lider = (tabla.at(0)?.puntos ?? 0) > 0 ? tabla.at(0)?.seatId : undefined;

    return tabla.map((puesto, indice) => ({
      ...puesto,
      haContestado: v.hanRespondido.includes(puesto.seatId),
      gano: yaReaccionan ? (ganados.get(puesto.seatId) ?? null) : null,
      tieneLaBomba: v.turno === puesto.seatId,
      lidera: puesto.seatId === lider,
      haApostado: v.hanApostado.includes(puesto.seatId),
      apuesta:
        v.apuestas && cantadas > turnoDeCantar(indice, tabla.length)
          ? (v.apuestas[puesto.seatId] ?? 0)
          : null,
    }));
  }

  /**
   * La clasificación, de más a menos puntos.
   *
   * Quién está en la mesa sale de los asientos y no del marcador: el marcador
   * está vacío hasta que alguien puntúa, así que sacándolo de ahí el plató se
   * pasaba la primera ronda entera sin un solo concursante. Los atriles son el
   * reparto, no la tabla de puntos.
   */
  get clasificacion(): PuestoEnAtril[] {
    const v = this.vista();
    if (!v) return [];

    const sentados = this.sala.mesa.map((asiento) => asiento.id);
    const quienes = sentados.length > 0 ? sentados : Object.keys(v.puntos);

    // Mientras la respuesta no se destape, el marcador enseña lo de antes: los
    // puntos ya han llegado del servidor, pero enseñarlos es cantar quién ha
    // acertado medio segundo antes de que se vea por qué.
    const congelado = v.fase === 'ronda' && v.cerrada && !seApagan(this.destapa());
    const recien = congelado
      ? new Map((v.resultados ?? []).map((uno) => [uno.seatId, uno.ganados]))
      : null;

    return quienes
      .map((seatId) => ({
        seatId,
        nombre: this.sala.nombreDe(seatId),
        foto: fotoDelPersonaje(this.sala.personajeDe(seatId)),
        puntos: (v.puntos[seatId] ?? 0) - (recien?.get(seatId) ?? 0),
        eresTu: seatId === this.sala.miAsiento,
        haContestado: false,
        gano: null,
        tieneLaBomba: false,
        lidera: false,
        haApostado: false,
        apuesta: null,
      }))
      .sort((uno, otro) => otro.puntos - uno.puntos);
  }

  get loQueLlevas(): number {
    const v = this.vista();
    return v ? Math.max(0, v.puntos[this.sala.miAsiento] ?? 0) : 0;
  }

  /** Cuánto duraba entera la cuenta atrás, para pintar la barra. */
  get duracionMs(): number {
    const v = this.vista();
    if (!v) return 0;
    if (v.fase === 'apuestas') return SEGUNDOS_PARA_APOSTAR * 1000;
    return v.tipo ? SEGUNDOS_POR_PRUEBA[v.tipo] * 1000 : 0;
  }

  /**
   * Lo que ve el escenario 3D.
   *
   * Se le da masticado: quién está, cómo está cada uno y de qué color va la
   * prueba. El escenario no sabe nada del juego, solo pinta lo que le llega.
   */
  get cuadro(): Cuadro {
    const v = this.vista();
    const seccion = v?.tipo ? SECCIONES[v.tipo] : null;

    return {
      puestos: this.puestos.map((puesto) => ({
        seatId: puesto.seatId,
        foto: puesto.foto,
        atento: puesto.haContestado || puesto.haApostado,
        acierta: (puesto.gano ?? 0) > 0,
        falla: (puesto.gano ?? 0) < 0,
        tiembla: puesto.tieneLaBomba,
      })),
      tono: seccion?.color ?? '250 204 21',
      golpe: this.contando(),
      // La cámara se gira hacia quien tiene la bomba, y solo mientras la
      // tiene: con la ronda cerrada ya no hay a quién mirar.
      mirandoA: v?.tipo === 'bomba' && !v.cerrada ? v.turno : null,
      sacude: this.sacudiendo(),
    };
  }

  /** Si el destape ya ha llegado a explicar y ofrecer la siguiente ronda. */
  get yaSeExplica(): boolean {
    return seExplica(this.destapa());
  }

  get rotuloDeArriba(): string {
    const v = this.vista();
    if (!v) return 'EL CONCURSO';
    if (v.fase === 'presentacion') return 'EL CONCURSO';
    if (v.fase === 'fin') return 'SE ACABÓ';
    return `RONDA ${v.ronda} DE ${v.rondas}`;
  }

  get yaContestaste(): boolean {
    return this.vista()?.hanRespondido.includes(this.sala.miAsiento) ?? false;
  }

  /**
   * Si puedes contestar ahora mismo.
   *
   * En la bomba contesta uno; en el resto, todos. Sin esto, cuatro personas
   * verían los botones activos en una prueba en la que solo juega una.
   */
  get puedesContestar(): boolean {
    const v = this.vista();
    if (!v || v.cerrada || v.fase !== 'ronda') return false;
    return v.tuTurno && !this.yaContestaste;
  }

  get esperandoAlResto(): boolean {
    const v = this.vista();
    return v?.fase === 'ronda' && !v.cerrada && this.yaContestaste;
  }

  get quienTieneLaBomba(): string {
    const turno = this.vista()?.turno;
    return turno ? this.sala.nombreDe(turno) : '';
  }

  get personas(): number {
    return this.vista()?.hacenFalta ?? this.clasificacion.length;
  }

  get ganador(): PuestoEnAtril | null {
    return this.clasificacion.at(0) ?? null;
  }

  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/juegos/trivial?sala=${this.roomId()}`,
      );
      this.enlaceCopiado.set(true);
    } catch {
      // Sin permiso de portapapeles, el enlace sigue en la barra de direcciones.
    }
  }

  volver(): void {
    void this.router.navigate(['/juegos/trivial']);
  }
}
