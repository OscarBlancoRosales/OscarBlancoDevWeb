import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TerminalLayout } from '../../../shared/terminal-layout/terminal-layout';
import { ImpostorRoomService } from '../impostor-room.service';
import { caraPorId, fotoDeLaCara } from '@devweb/shared/games/impostor/caras';
import { sitiosEnElOvalo } from '@devweb/shared/games/impostor/sitios';
import { paseDe } from '../../pase-guardado';
import type { Signal } from '@angular/core';
import type { ChatEntry } from '@devweb/shared/contracts/rooms';
import type { ImpostorView, Modo, Pista } from '@devweb/shared/games/impostor/tipos';

/** Un sitio de la mesa, con todo lo que hay que pintar de él. */
export interface Puesto {
  readonly seatId: string;
  readonly nombre: string;
  readonly foto: string;
  readonly mote: string;
  readonly eresTu: boolean;
  readonly esBot: boolean;
  readonly juega: boolean;
  readonly listo: boolean;
  readonly leToca: boolean;
  readonly haVotado: boolean;
  readonly pistas: readonly string[];
  /** Votos que ha recibido. Solo cuando la votación se cierra. */
  readonly votos: number;
  readonly expulsado: boolean;
  /** Si era impostor. Solo al acabar la ronda. */
  readonly eraImpostor: boolean;
  readonly puntos: number;
  /** Sitio en el óvalo, en por cientos del tapete. */
  readonly x: number;
  readonly y: number;
}

/** Una línea de la charla: pista dicha o mensaje de mesa. */
export interface LineaDeCharla {
  readonly clave: string;
  readonly autor: string;
  readonly texto: string;
  readonly foto: string | null;
  readonly mia: boolean;
  readonly deLaSala: boolean;
  readonly esPista: boolean;
}

/** Cómo se llama cada modo en pantalla. */
const MODOS: Readonly<Record<Modo, string>> = {
  clasico: 'Clásico',
  revancha: 'La última palabra',
  infiltrado: 'Infiltrado',
};

/**
 * La mesa del Impostor.
 *
 * Pinta lo que manda el servidor y nada más. La palabra que se ve aquí es la
 * que el servidor decidió mandar a este asiento: si eres el impostor no llega,
 * y no hay ningún sitio de esta pantalla donde estuviera escondida.
 */
@Component({
  selector: 'app-impostor-room',
  imports: [CommonModule, FormsModule, TerminalLayout],
  templateUrl: './impostor-room.html',
  styleUrl: './impostor-room.css',
})
export class ImpostorRoom implements OnInit, OnDestroy {
  readonly vista: Signal<ImpostorView | null>;
  readonly error: Signal<string | null>;
  readonly chat: Signal<readonly ChatEntry[]>;
  readonly conectado: Signal<boolean>;

  readonly roomId = signal('');
  /**
   * El reloj de esta pantalla, que solo sirve para pintar la cuenta atrás.
   *
   * El instante en que se acaba el debate lo pone el servidor; aquí solo se
   * mira cuánto falta. Si el reloj de este ordenador va cinco minutos adelantado
   * la cuenta saldrá rara, pero la votación se abre cuando el servidor dice.
   */
  private readonly ahora = signal(Date.now());
  private tictac: ReturnType<typeof setInterval> | null = null;
  readonly enlaceCopiado = signal(false);
  /** Si la palabra se enseña o se tapa. Tapada por si alguien mira de reojo. */
  readonly palabraALaVista = signal(true);

  /**
   * Lo que se escribe: la pista de tu turno y lo que dices en el chat.
   *
   * Señales y no campos sueltos porque la aplicación va sin zone.js: al vaciar
   * un campo suelto después de enviar, el `[(ngModel)]` no se entera y el texto
   * se queda escrito en el hueco. Con la señal, borrarlo se ve.
   */
  readonly pista = signal('');
  readonly mensaje = signal('');

  readonly mesa: Signal<Puesto[]>;

  constructor(
    private readonly sala: ImpostorRoomService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {
    this.vista = sala.vista;
    this.error = sala.error;
    this.chat = sala.chat;
    this.conectado = sala.conectado;
    this.mesa = computed(() => this.puestos());
  }

  ngOnInit(): void {
    const sala = this.ruta.snapshot.queryParamMap.get('sala') ?? '';
    const pase = sala ? paseDe(sala) : null;

    if (!pase) {
      void this.router.navigate(['/juegos/impostor'], {
        ...(sala && { queryParams: { sala } }),
      });
      return;
    }

    this.roomId.set(sala);
    this.sala.reconectar(pase);
    this.tictac = setInterval(() => {
      this.ahora.set(Date.now());
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.tictac !== null) clearInterval(this.tictac);
    this.sala.desconectar();
  }

  // --- Las jugadas ---------------------------------------------------------

  listo(): void {
    this.sala.listo();
  }

  decirPista(): void {
    this.sala.pista(this.pista());
    this.pista.set('');
  }

  votar(seatId: string): void {
    if (!this.puedesVotar || seatId === this.sala.miAsiento) return;
    this.sala.votar(seatId);
  }

  adivinar(opcion: number): void {
    this.sala.adivinar(opcion);
  }

  alVoto(): void {
    this.sala.alVoto();
  }

  otraRonda(): void {
    this.sala.otraRonda();
  }

  enviarMensaje(): void {
    this.sala.decir(this.mensaje());
    this.mensaje.set('');
  }

  /**
   * Un solo hueco: en tu turno de pistas manda la pista; el resto del tiempo,
   * el chat. Si se pueden las dos a la vez, el turno deja de significar nada.
   */
  enviar(): void {
    if (this.puedesHablar) this.decirPista();
    else this.enviarMensaje();
  }

  campoEscrito(): string {
    return this.puedesHablar ? this.pista() : this.mensaje();
  }

  escribir(texto: string): void {
    if (this.puedesHablar) this.pista.set(texto);
    else this.mensaje.set(texto);
  }

  // --- Cómo va la cosa -----------------------------------------------------

  get miAsiento(): string {
    return this.sala.miAsiento;
  }

  get modo(): string {
    const vista = this.vista();
    return vista ? MODOS[vista.modo] : '';
  }

  get esperando(): boolean {
    const fase = this.vista()?.fase;
    return fase === 'sala' || fase === 'repartiendo';
  }

  get yaEstoyListo(): boolean {
    return this.vista()?.listos.includes(this.sala.miAsiento) ?? false;
  }

  get faltanJugadores(): number {
    return Math.max(0, 3 - this.sala.mesa().length);
  }

  get puedesHablar(): boolean {
    const vista = this.vista();
    return vista?.fase === 'pistas' && vista.tuTurno && this.conectado();
  }

  /**
   * En pistas, si no te toca, el hueco se apaga. El resto del tiempo es chat.
   *
   * Señal y no getter: sin zone.js un getter en `[disabled]` a veces se queda
   * en el valor del primer pintado, y el turno del otro se veía como el tuyo.
   */
  readonly inputBloqueado = computed(() => {
    const vista = this.vista();
    if (!this.conectado()) return true;
    return vista?.fase === 'pistas' && !(vista.tuTurno && this.conectado());
  });

  get placeholder(): string {
    if (this.puedesHablar) return 'Tu pista (una palabra)…';
    if (this.vista()?.fase === 'pistas' && this.quienHabla) {
      return `Habla ${this.quienHabla.nombre}…`;
    }
    return 'Di algo…';
  }

  nombreDe(seatId: string): string {
    return this.sala.nombreDe(seatId);
  }

  /**
   * Pistas y chat en el mismo hilo: primero lo dicho en el turno, luego la
   * discusión. Así el historial es uno y no hay que mirar dos sitios.
   */
  charlaDeLaMesa(): readonly LineaDeCharla[] {
    const vista = this.vista();
    const pistas: LineaDeCharla[] = (vista?.pistas ?? []).map((pista, i) => ({
      clave: `pista-${i}-${pista.seatId}`,
      autor: this.sala.nombreDe(pista.seatId),
      texto: pista.texto,
      foto: fotoDeLaCara(this.sala.caraDe(pista.seatId)),
      mia: pista.seatId === this.sala.miAsiento,
      deLaSala: false,
      esPista: true,
    }));
    const mensajes: LineaDeCharla[] = this.chat().map((entrada) => ({
      clave: `chat-${entrada.seq}`,
      autor: this.autorDe(entrada),
      texto: entrada.text,
      foto: this.fotoDelAutor(entrada),
      mia: this.esMio(entrada),
      deLaSala: entrada.kind === 'system',
      esPista: false,
    }));
    return [...pistas, ...mensajes];
  }

  /** Lo que le queda al debate, en segundos. Cero cuando no hay reloj. */
  get quedanSegundos(): number {
    const hasta = this.vista()?.debateHasta ?? 0;
    if (hasta === 0) return 0;
    return Math.max(0, Math.ceil((hasta - this.ahora()) / 1000));
  }

  /** La cuenta atrás como la lee una persona: 1:05. */
  get cuentaAtras(): string {
    const quedan = this.quedanSegundos;
    const minutos = Math.floor(quedan / 60);
    return `${minutos}:${String(quedan % 60).padStart(2, '0')}`;
  }

  /** Si el debate va con reloj o dura lo que el anfitrión quiera. */
  get debateConReloj(): boolean {
    return (this.vista()?.debateHasta ?? 0) > 0;
  }

  get puedesVotar(): boolean {
    const vista = this.vista();
    return vista?.fase === 'votacion' && vista.tuVoto === null && this.conectado();
  }

  /** Quién tiene la palabra ahora mismo, para decirlo con nombre y cara. */
  get quienHabla(): Puesto | null {
    const turno = this.vista()?.turno;
    return turno ? (this.mesa().find((puesto) => puesto.seatId === turno) ?? null) : null;
  }

  /**
   * Tu palabra, o el aviso de que no la tienes.
   *
   * `null` aquí no es un fallo: es el juego. El servidor no manda palabra a
   * quien no le toca saberla.
   */
  get tuPalabra(): string | null {
    return this.vista()?.tuPalabra ?? null;
  }

  get eresImpostor(): boolean {
    return this.vista()?.eresImpostor ?? false;
  }

  get anfitrion(): boolean {
    return this.sala.mesa().find((asiento) => asiento.isOwner)?.id === this.sala.miAsiento;
  }

  /** Cómo acabó la ronda, contado en una línea. */
  get desenlace(): string {
    const vista = this.vista();
    if (vista?.fase !== 'fin') return '';
    if (vista.desenlace === 'tripulacion') return 'Gana la tripulación';
    if (vista.desenlace === 'impostores') {
      return (vista.impostores?.length ?? 0) > 1 ? 'Ganan los impostores' : 'Gana el impostor';
    }
    return 'Ronda cortada';
  }

  get ganasteTu(): boolean {
    const vista = this.vista();
    if (vista?.fase !== 'fin' || !vista.impostores) return false;
    const eras = vista.impostores.includes(this.sala.miAsiento);
    return vista.desenlace === (eras ? 'impostores' : 'tripulacion');
  }

  /** Lo que está diciendo la sala. Viene del servidor, igual para todos. */
  get dice(): string {
    return this.vista()?.dice ?? '';
  }

  /** Para que el aviso se reinicie —y se note— cada vez que cambia. */
  get turnoDePalabra(): string {
    const vista = this.vista();
    return `${vista?.momento ?? ''}:${vista?.dice.length ?? 0}`;
  }

  autorDe(entrada: ChatEntry): string {
    return entrada.kind === 'system' ? 'Sala' : entrada.author;
  }

  fotoDelAutor(entrada: ChatEntry): string | null {
    if (entrada.kind === 'system') return null;
    return fotoDeLaCara(this.sala.caraDe(entrada.authorId));
  }

  esMio(entrada: ChatEntry): boolean {
    return entrada.authorId === this.sala.miAsiento;
  }

  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/juegos/impostor?sala=${this.roomId()}`,
      );
      this.enlaceCopiado.set(true);
    } catch {
      // Sin permiso de portapapeles el enlace sigue en la barra de direcciones.
    }
  }

  volver(): void {
    void this.router.navigate(['/juegos/impostor']);
  }

  /**
   * La mesa entera, ya masticada para la plantilla.
   *
   * Se arma de una vez y no campo a campo desde el HTML: cada puesto necesita
   * cruzar los asientos con el orden, las pistas y los votos, y hacer eso
   * dentro de un `*ngFor` lo repite en cada repintado.
   */
  private puestos(): Puesto[] {
    const vista = this.vista();
    const asientos = this.sala.mesa();
    if (!vista) return [];

    const votos = vista.votos ?? {};
    const recibidos: Record<string, number> = {};
    for (const votado of Object.values(votos)) {
      recibidos[votado] = (recibidos[votado] ?? 0) + 1;
    }

    const puestos = asientos.map((asiento): Puesto => {
      const cara = this.sala.caraDe(asiento.id);
      return {
        seatId: asiento.id,
        nombre: asiento.displayName,
        foto: fotoDeLaCara(cara),
        mote: caraPorId(cara)?.nombre ?? '',
        eresTu: asiento.id === this.sala.miAsiento,
        esBot: asiento.isBot,
        juega: vista.orden.includes(asiento.id),
        listo: vista.listos.includes(asiento.id),
        leToca: vista.turno === asiento.id,
        haVotado: vista.hanVotado.includes(asiento.id),
        pistas: pistasDe(vista.pistas, asiento.id),
        votos: recibidos[asiento.id] ?? 0,
        expulsado: vista.expulsado === asiento.id,
        eraImpostor: vista.impostores?.includes(asiento.id) ?? false,
        puntos: vista.marcador[asiento.id] ?? 0,
        x: 50,
        y: 50,
      };
    });

    // En orden de mesa mientras se juega: es el orden en que se habla.
    const ordenados =
      vista.orden.length === 0
        ? puestos
        : puestos.slice().sort((uno, otro) => sitio(vista.orden, uno) - sitio(vista.orden, otro));

    // Tú abajo del todo, que es donde se sienta uno en una mesa de verdad.
    const yo = ordenados.findIndex((puesto) => puesto.eresTu);
    const rotados = yo > 0 ? [...ordenados.slice(yo), ...ordenados.slice(0, yo)] : ordenados;
    const huecos = sitiosEnElOvalo(rotados.length);
    return rotados.map((puesto, i) => ({
      ...puesto,
      x: huecos[i]?.x ?? 50,
      y: huecos[i]?.y ?? 50,
    }));
  }
}

function pistasDe(pistas: readonly Pista[], seatId: string): string[] {
  return pistas.filter((pista) => pista.seatId === seatId).map((pista) => pista.texto);
}

/** Dónde se sienta: los que no juegan esta ronda, al final. */
function sitio(orden: readonly string[], puesto: Puesto): number {
  const donde = orden.indexOf(puesto.seatId);
  return donde === -1 ? orden.length : donde;
}
