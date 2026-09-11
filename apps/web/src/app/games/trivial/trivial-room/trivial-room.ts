import { Component, OnDestroy, OnInit, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrivialRoomService } from '../trivial-room.service';
import { Plato } from '../plato/plato';
import { Atriles } from '../plato/atriles/atriles';
import { PresentadorEnPlato } from '../plato/presentador/presentador';
import { PanelPregunta } from '../plato/panel-pregunta/panel-pregunta';
import { Cronometro } from '../plato/cronometro/cronometro';
import { Rotulo, SECCIONES } from '../plato/rotulo/rotulo';
import { MandoDeApuesta } from '../plato/apuesta/apuesta';
import { Podio } from '../plato/podio/podio';
import { Sonido } from '../plato/sonido';
import { SEGUNDOS_PARA_APOSTAR, SEGUNDOS_POR_PRUEBA } from '@devweb/shared/games/trivial/reglas';
import { fotoDelPersonaje } from '@devweb/shared/games/trivial/reparto';
import { paseDe } from '../../pase-guardado';
import type { Signal } from '@angular/core';
import type { PuestoEnAtril } from '../plato/atriles/atriles';
import type { Seccion } from '../plato/rotulo/rotulo';
import type { TipoPrueba, TrivialView } from '@devweb/shared/games/trivial/tipos';

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

  /** El tipo de la ronda anterior, para saber cuándo cambia la sección. */
  private veniaDe: TipoPrueba | null = null;
  /** Lo último que dijo el presentador, para no repetir efecto de sonido. */
  private ultimoMomento = '';
  private seFue?: ReturnType<typeof setTimeout>;

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
      this.miraSiCambiaLaSeccion(v);
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
    this.sala.desconectar();
  }

  // --- Lo que decide qué está en pantalla ---------------------------------

  private miraSiCambiaLaSeccion(v: TrivialView): void {
    if (v.fase === 'presentacion' || v.fase === 'fin' || !v.tipo) return;
    if (v.tipo === this.veniaDe) return;

    this.veniaDe = v.tipo;
    this.anunciando.set(SECCIONES[v.tipo]);
    this.sonido.suena('rotulo');

    if (this.seFue) clearTimeout(this.seFue);
    this.seFue = setTimeout(() => {
      this.anunciando.set(null);
    }, 3_200);
  }

  private miraSiSuena(v: TrivialView): void {
    if (v.momento === this.ultimoMomento) return;
    this.ultimoMomento = v.momento;

    if (v.momento === 'podio') this.sonido.suena('fanfarria');
    else if (v.momento === 'explota' || v.momento === 'nadieAcierta') this.sonido.suena('falla');
    else if (v.momento === 'aciertaAlguien' || v.momento === 'remonta') this.sonido.suena('acierta');
  }

  saltarRotulo(): void {
    if (this.seFue) clearTimeout(this.seFue);
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

    const ganados = new Map((v.resultados ?? []).map((uno) => [uno.seatId, uno.ganados]));
    const tabla = this.clasificacion;
    // Nadie lidera mientras estén todos a cero: una corona en la ronda uno no
    // dice nada y además se la queda quien salga primero en la lista.
    const lider = (tabla.at(0)?.puntos ?? 0) > 0 ? tabla.at(0)?.seatId : undefined;

    return tabla.map((puesto) => ({
      ...puesto,
      haContestado: v.hanRespondido.includes(puesto.seatId),
      gano: ganados.get(puesto.seatId) ?? null,
      tieneLaBomba: v.turno === puesto.seatId,
      lidera: puesto.seatId === lider,
      haApostado: v.hanApostado.includes(puesto.seatId),
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

    return quienes
      .map((seatId) => ({
        seatId,
        nombre: this.sala.nombreDe(seatId),
        foto: fotoDelPersonaje(this.sala.personajeDe(seatId)),
        puntos: v.puntos[seatId] ?? 0,
        eresTu: seatId === this.sala.miAsiento,
        haContestado: false,
        gano: null,
        tieneLaBomba: false,
        lidera: false,
        haApostado: false,
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
