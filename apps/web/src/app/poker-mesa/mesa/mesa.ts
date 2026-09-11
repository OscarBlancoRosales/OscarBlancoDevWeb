import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TerminalLayout } from '../../shared/terminal-layout/terminal-layout';
import { MesaService } from '../mesa.service';
import {
  avatarPorId,
  fotoDelAvatar,
  fotoDelDealer,
  gestoDelDealer,
  sitiosEnLaMesa,
} from '@devweb/shared/games/poker-reparto';
import {
  DESVIO_GRAVE,
  DESVIO_LEVE,
  bandosDe,
  desvioDe,
  estadisticaDe,
  numericos,
} from '@devweb/shared/games/scrum-mesa';
import type { Signal } from '@angular/core';
import type { Estadistica } from '@devweb/shared/games/scrum-mesa';
import type { ScrumView } from '@devweb/shared/games/scrum';

/** Un sitio de la mesa, ya con todo lo que hay que pintar encima. */
export interface EnLaMesa {
  readonly seatId: string;
  readonly nombre: string;
  readonly foto: string;
  readonly eresTu: boolean;
  readonly haVotado: boolean;
  /** Lo que se ve en su carta: el número, un icono, o nada si sigue tapada. */
  readonly carta: string;
  readonly tapada: boolean;
  /** Cuánto se ha salido del corro, para pintarlo cuando se destapa. */
  readonly desvio: number;
  readonly bocadillo: string;
  /** Si tiene a alguien detrás. Un sitio vacío se pinta apagado. */
  readonly conectado: boolean;
  /** Quien abrió la sala lleva el botón de la banca, como en una mesa de verdad. */
  readonly esAnfitrion: boolean;
  /** Lo que pone debajo del nombre: pensando, listo, o lo que haya pedido. */
  readonly estado: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Las fichas con las que se vota, que se van sumando.
 *
 * No es una baraja de Fibonacci cerrada: aquí se compone el número exacto
 * apilando fichas -un siete es cinco y dos- porque así se vota de verdad en
 * esta casa, y porque una escala fija obliga a redondear a lo que haya. Los
 * valores son los mismos que en la versión clásica.
 */
const FICHAS = [1, 2, 3, 5, 10, 20];

/**
 * La mesa de planning poker.
 *
 * Es el mismo juego que la versión clásica -mismas acciones, mismo servidor,
 * los mismos desvíos- pintado como una mesa de verdad: cada uno en su sitio
 * con su carta boca abajo, el crupier a un lado soltando lo que le parece, y
 * un chat que sale en bocadillos encima de la cabeza de quien habla.
 */
@Component({
  selector: 'app-mesa-poker',
  imports: [FormsModule, TerminalLayout],
  templateUrl: './mesa.html',
  styleUrl: './mesa.css',
})
export class MesaPoker implements OnInit, OnDestroy {
  readonly vista: Signal<ScrumView | null>;
  readonly error: Signal<string | null>;
  readonly fichas = FICHAS;

  readonly roomId = signal('');
  readonly enlaceCopiado = signal(false);
  /** Se mueve solo para que los bocadillos se caigan cuando toca. */
  readonly ahora = signal(Date.now());

  asuntoNuevo = '';
  /**
   * Lo que se está escribiendo, en señales.
   *
   * La aplicación va sin zone.js: al vaciar un campo suelto después de enviar,
   * el `[(ngModel)]` no se entera y el texto se queda escrito en el hueco.
   */
  readonly mensaje = signal('');
  readonly numeroSuelto = signal<number | null>(null);

  private reloj?: ReturnType<typeof setInterval>;

  constructor(
    private readonly sala: MesaService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
  ) {
    this.vista = sala.vista;
    this.error = sala.error;
  }

  ngOnInit(): void {
    const sala = this.ruta.snapshot.queryParamMap.get('sala') ?? '';
    const pase = sala ? paseDe(sala) : null;

    if (!pase) {
      void this.router.navigate(['/scrum-poker'], {
        ...(sala && { queryParams: { sala } }),
      });
      return;
    }

    this.roomId.set(sala);
    this.sala.reconectar(pase.roomId, pase.seatId, pase.seatToken);

    // Un segundo basta: los bocadillos duran siete y no hace falta más fino.
    this.reloj = setInterval(() => {
      this.ahora.set(Date.now());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.sala.desconectar();
  }

  // --- La mesa ------------------------------------------------------------

  /** Quién está sentado, dónde, y qué se le ve. */
  get sentados(): EnLaMesa[] {
    const vista = this.vista();
    const mesa = this.sala.mesa();
    if (!vista) return [];

    const enOrden = desdeTuSitio(mesa, this.sala.miAsiento);
    const sitios = sitiosEnLaMesa(enOrden.length);
    const stats = this.estadistica;
    const dichos = this.sala.bocadillos(this.ahora());

    return enOrden.map((asiento, i) => {
      const voto = puedeFaltar(vista.votos, asiento.id);
      const suyo = voto?.tipo === 'numero' ? voto.valor : null;
      const haVotado = vista.hanVotado.includes(asiento.id);

      return {
        seatId: asiento.id,
        nombre: asiento.displayName,
        foto: fotoDelAvatar(this.sala.avatarDe(asiento.id)),
        eresTu: asiento.id === this.sala.miAsiento,
        haVotado,
        carta: cartaDe(voto),
        tapada: !vista.revelado && asiento.id !== this.sala.miAsiento,
        desvio: vista.revelado && suyo !== null ? desvioDe(suyo, stats) : 0,
        bocadillo: puedeFaltar(dichos, asiento.id)?.texto ?? '',
        conectado: asiento.connected,
        esAnfitrion: asiento.isOwner,
        estado: estadoDe(voto, haVotado, vista.revelado, asiento.connected),
        x: sitios[i]?.x ?? 50,
        y: sitios[i]?.y ?? 50,
      };
    });
  }

  // --- Quién lleva la ronda ----------------------------------------------

  /** El nombre de quien abrió la sala. La banca es suya. */
  get anfitrion(): string {
    return this.sala.mesa().find((uno) => uno.isOwner)?.displayName ?? '';
  }

  /**
   * Si puedes destapar y repartir de nuevo.
   *
   * La ronda la lleva el anfitrión, como en una mesa de verdad la lleva la
   * banca. Pero si el anfitrión se ha ido, la mesa no se queda encallada
   * esperándole: entonces puede repartir cualquiera.
   */
  get puedesLlevarLaRonda(): boolean {
    const banca = this.sala.mesa().find((uno) => uno.isOwner);
    if (!banca) return true;
    return banca.id === this.sala.miAsiento || !banca.connected;
  }

  /** A quién se está esperando, para quien no lleva la ronda. */
  get quienLleva(): string {
    const quien = this.anfitrion;
    return quien ? `La lleva ${quien}` : 'La lleva la banca';
  }

  /** Cómo va la ronda, para cuando el crupier no tiene nada que decir. */
  get estadoDeLaRonda(): string {
    const vista = this.vista();
    if (!vista) return '';
    if (vista.revelado) return 'Cartas sobre la mesa.';
    if (this.sala.mesa().length === 0) return 'La mesa está vacía.';
    if (this.todosHanVotado) return 'Todos han puesto. Cuando queráis.';
    return this.hanPuesto.length === 0 ? 'Nadie ha puesto todavía.' : `Faltan ${this.faltan}.`;
  }

  /** Las cuentas de la ronda, que es lo que se enseña al destapar. */
  get estadistica(): Estadistica {
    const vista = this.vista();
    return estadisticaDe(vista ? numericos(vista.votos) : []);
  }

  /**
   * Cuántos han votado cada número, de más votado a menos.
   *
   * Es lo que de verdad enseña si la mesa está de acuerdo: una media de ocho
   * puede ser todos en ocho o la mitad en tres y la mitad en trece, y esas dos
   * reuniones no se parecen en nada.
   */
  get reparto(): { valor: string; cuantos: number; porciento: number }[] {
    const vista = this.vista();
    if (!vista?.revelado) return [];

    const cuenta = new Map<string, number>();
    for (const voto of Object.values(vista.votos)) {
      const clave = voto.tipo === 'numero' ? String(voto.valor) : voto.tipo === 'cafe' ? '☕' : '🚬';
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }

    // Sobre el total de votos y no sobre el más votado: con cuatro votos
    // distintos, medir contra el máximo pinta las cuatro barras llenas y
    // parece que todo el mundo está de acuerdo en todo.
    const votos = Math.max(1, Object.keys(vista.votos).length);
    return [...cuenta.entries()]
      .map(([valor, cuantos]) => ({
        valor,
        cuantos,
        porciento: Math.round((cuantos / votos) * 100),
      }))
      .sort((uno, otro) => otro.cuantos - uno.cuantos || Number(uno.valor) - Number(otro.valor));
  }

  /** Si la mesa se ha partido en dos, para poder avisarlo. */
  get bandos(): { bajos: number[]; altos: number[] } | null {
    const vista = this.vista();
    if (!vista?.revelado) return null;
    const partida = bandosDe(numericos(vista.votos));
    if (!partida) return null;
    return {
      bajos: partida.bajos.map((uno) => uno.valor),
      altos: partida.altos.map((uno) => uno.valor),
    };
  }

  /** Cuántos faltan por votar, que es lo que se lee de un vistazo. */
  get faltan(): number {
    const vista = this.vista();
    if (!vista) return 0;
    return this.sala.mesa().filter((uno) => !vista.hanVotado.includes(uno.id)).length;
  }

  /** Una ficha por voto puesto, para que el bote crezca según entra la gente. */
  get hanPuesto(): readonly unknown[] {
    return this.vista()?.hanVotado ?? [];
  }

  get todosHanVotado(): boolean {
    return this.faltan === 0 && this.sala.mesa().length > 0;
  }

  // --- El crupier ---------------------------------------------------------

  get diceElDealer(): string {
    return this.vista()?.dice ?? '';
  }

  get caraDelDealer(): string {
    return fotoDelDealer(gestoDelDealer(this.vista()?.momento ?? ''));
  }

  // --- Lo que puedes hacer -----------------------------------------------

  get tuVoto(): number | null {
    const voto = this.vista()?.votos[this.sala.miAsiento];
    return voto?.tipo === 'numero' ? voto.valor : null;
  }

  get pediste(): 'cafe' | 'porro' | null {
    const voto = this.vista()?.votos[this.sala.miAsiento];
    return voto?.tipo === 'cafe' || voto?.tipo === 'porro' ? voto.tipo : null;
  }

  /**
   * Echa una ficha más al montón.
   *
   * El total sale de lo que ya hay en la mesa y no de una cuenta aparte: si se
   * llevara por un lado, recargar la página o entrar desde otro sitio dejaría
   * el montón de la pantalla y el voto del servidor diciendo cosas distintas.
   */
  echarFicha(valor: number): void {
    this.sala.votar({ tipo: 'numero', valor: (this.tuVoto ?? 0) + valor });
  }

  /** El número exacto, para quien lo tiene claro y no quiere ir sumando. */
  votarSuelto(): void {
    const escrito = this.numeroSuelto();
    if (escrito === null) return;
    this.sala.votar({ tipo: 'numero', valor: Math.max(0, Math.round(escrito)) });
    this.numeroSuelto.set(null);
  }

  /** Lo que llevas apostado ahora mismo, para enseñarlo grande. */
  get apostado(): number {
    return this.tuVoto ?? 0;
  }

  pedirCafe(): void {
    this.sala.votar({ tipo: 'cafe' });
  }

  pedirPorro(): void {
    this.sala.votar({ tipo: 'porro' });
  }

  retirar(): void {
    this.sala.retirarVoto();
  }

  revelar(): void {
    this.sala.revelar();
  }

  otraRonda(): void {
    this.sala.nuevaRonda(this.asuntoNuevo.trim() || undefined);
    this.asuntoNuevo = '';
  }

  /**
   * Cambia lo que se está estimando sin tocar los votos.
   *
   * Se manda como ronda nueva porque es lo único que el juego sabe hacer con
   * el asunto; si ya hay votos echados, se avisa antes de borrarlos.
   */
  ponerAsunto(evento: Event): void {
    const escrito = (evento.target as HTMLInputElement).value.trim();
    const vista = this.vista();
    if (!vista || escrito === vista.asunto) return;

    const hayVotos = vista.hanVotado.length > 0;
    if (hayVotos && !confirm('Cambiar el asunto empieza una ronda nueva. ¿Seguimos?')) {
      (evento.target as HTMLInputElement).value = vista.asunto;
      return;
    }
    this.sala.nuevaRonda(escrito);
  }

  hablar(): void {
    this.sala.decir(this.mensaje());
    this.mensaje.set('');
  }

  /**
   * Lo que se ha dicho en la mesa.
   *
   * Va entero y no recortado a los últimos seis: el chat vive en su columna con
   * su propio scroll, así que no le quita sitio a nada. Antes se cortaba porque
   * colgaba al pie de la página y crecía empujando la mesa hacia arriba.
   */
  get conversacion(): { clave: string; nombre: string; texto: string; eresTu: boolean }[] {
    return this.sala
      .chat()
      .filter((entrada) => entrada.kind === 'player')
      .map((entrada) => ({
        clave: String(entrada.seq),
        nombre: entrada.author,
        texto: entrada.text,
        eresTu: entrada.authorId === this.sala.miAsiento,
      }));
  }

  esGrave(desvio: number): boolean {
    return desvio >= DESVIO_GRAVE;
  }

  esLeve(desvio: number): boolean {
    return desvio >= DESVIO_LEVE && desvio < DESVIO_GRAVE;
  }

  nombreDelAvatar(seatId: string): string {
    return avatarPorId(this.sala.avatarDe(seatId))?.nombre ?? '';
  }

  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/scrum-poker/mesa?sala=${this.roomId()}`,
      );
      this.enlaceCopiado.set(true);
    } catch {
      // Sin permiso de portapapeles, el enlace sigue en la barra de direcciones.
    }
  }

  volver(): void {
    void this.router.navigate(['/scrum-poker']);
  }
}

/**
 * La mesa empezando por ti.
 *
 * Los sitios se reparten desde abajo en el centro, que es tu silla: en una mesa
 * de verdad uno no se ve a sí mismo enfrente. Se gira la lista para que te
 * toque el primero y se conserva el orden de los demás, que es el de llegada.
 */
export function desdeTuSitio<T extends { readonly id: string }>(
  mesa: readonly T[],
  miAsiento: string,
): readonly T[] {
  const donde = mesa.findIndex((uno) => uno.id === miAsiento);
  if (donde <= 0) return mesa;
  return [...mesa.slice(donde), ...mesa.slice(0, donde)];
}

/** Lo que pone debajo del nombre de cada uno. */
export function estadoDe(
  voto: ScrumView['votos'][string] | undefined,
  haVotado: boolean,
  revelado: boolean,
  conectado: boolean,
): string {
  if (!conectado) return 'Se ha ido';
  if (revelado) return haVotado ? '' : 'No votó';
  if (!haVotado) return 'Pensando…';
  if (voto?.tipo === 'cafe') return 'Pide café';
  if (voto?.tipo === 'porro') return 'Se planta';
  return 'Ha puesto';
}

/** Lo que se ve en la carta de alguien cuando se destapa. */
function cartaDe(voto: ScrumView['votos'][string] | undefined): string {
  if (!voto) return '';
  if (voto.tipo === 'numero') return String(voto.valor);
  return voto.tipo === 'cafe' ? '☕' : '🚬';
}

/** El pase guardado de esa mesa. Vive aquí para no arrastrar el de los juegos. */
function paseDe(roomId: string): { roomId: string; seatId: string; seatToken: string } | null {
  try {
    const guardado = localStorage.getItem(`mesa:pase:${roomId}`);
    if (!guardado) return null;
    const pase = JSON.parse(guardado) as Partial<{
      roomId: string;
      seatId: string;
      seatToken: string;
    }>;
    return pase.roomId && pase.seatId && pase.seatToken
      ? { roomId: pase.roomId, seatId: pase.seatId, seatToken: pase.seatToken }
      : null;
  } catch {
    return null;
  }
}

/** Guarda el pase para poder volver tras recargar. */
export function guardarPaseDeMesa(pase: {
  roomId: string;
  seatId: string;
  seatToken: string;
}): void {
  try {
    localStorage.setItem(`mesa:pase:${pase.roomId}`, JSON.stringify(pase));
  } catch {
    // Sin almacenamiento se puede jugar; lo que no se puede es recargar.
  }
}

/**
 * Un acceso a una tabla que dice la verdad: lo que no está, no está.
 *
 * TypeScript tipa `tabla[clave]` como si siempre hubiera algo, y en la web
 * `noUncheckedIndexedAccess` sigue apagado por la deuda del motor de RISK (ver
 * docs/estandares.md). Sin esto, el `?.` que de verdad hace falta —un asiento
 * que aún no ha votado no tiene voto— parece que sobra, y el lint pide
 * quitarlo. Quitarlo es lo que rompe la mesa en cuanto alguien no ha votado.
 */
function puedeFaltar<T>(tabla: Readonly<Record<string, T>>, clave: string): T | undefined {
  return tabla[clave];
}
