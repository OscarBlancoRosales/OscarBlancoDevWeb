import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { SeatId } from '../module';

export const LADO = 10;
export const TAMANOS_FLOTA = [5, 4, 3, 3, 2] as const;

const SIN_EXTRAS = { additionalProperties: false } as const;
const Coordenada = Type.Integer({ minimum: 0, maximum: LADO - 1 });

/**
 * Un barco: dónde empieza, cuánto mide y hacia dónde crece.
 *
 * La proa y la orientación bastan porque no hay barcos en diagonal ni en forma
 * de L. Guardar sus casillas una a una sería el mismo dato escrito de una
 * manera en la que puede quedar mal.
 */
export const BarcoSchema = Type.Object(
  {
    fila: Coordenada,
    columna: Coordenada,
    tamano: Type.Integer({ minimum: 2, maximum: 5 }),
    orientacion: Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')]),
  },
  SIN_EXTRAS,
);

export type Barco = Static<typeof BarcoSchema>;
export type Orientacion = Barco['orientacion'];

export type Casilla = 'agua' | 'tocado' | 'hundido';
export type Fase = 'colocacion' | 'combate' | 'fin';
export type Nivel = 'novato' | 'marino' | 'almirante';

/**
 * Un bando: su flota y lo que le han disparado.
 *
 * `recibidos` es una rejilla de cien casillas —`null` es «aquí no ha caído
 * nada»— y no una lista de disparos, porque las dos preguntas que se hacen todo
 * el rato son «¿han disparado ya aquí?» y «¿qué pinto en esta celda?». Sobre una
 * lista, las dos son un recorrido; sobre la rejilla, un índice.
 */
export interface Bando {
  readonly barcos: readonly Barco[];
  readonly recibidos: readonly (Casilla | null)[];
}

/**
 * La partida entera.
 *
 * No lleva la lista de asientos: los bandos nacen cuando alguien despliega. El
 * actor construye el estado la primera vez que se abre la sala, y ahí todavía
 * puede faltar el segundo jugador; atar el estado a los asientos de ese momento
 * dejaría al que llega después sin tablero.
 */
export interface FlotaState {
  readonly fase: Fase;
  readonly bandos: Readonly<Record<SeatId, Bando>>;
  /** Quién desplegó primero. Fija el rival de cada uno y quién abre fuego. */
  readonly orden: readonly SeatId[];
  readonly turno: SeatId | null;
  readonly ganador: SeatId | null;
  /** Cuántas jugadas van. Es de donde el bot saca su azar. */
  readonly jugadas: number;
  readonly semilla: number;
  readonly nivelBot: Nivel;
}

export interface Punteria {
  readonly disparos: number;
  readonly aciertos: number;
  readonly porcentaje: number;
}

/**
 * Lo que se puede hacer en una partida.
 *
 * La flota se despliega entera de una vez y no barco a barco: una flota a
 * medias no es un estado que el juego necesite representar, y validarla de
 * golpe permite responder «esto no vale» una vez en lugar de cinco.
 */
export const FlotaAction = Type.Union([
  Type.Object(
    {
      tipo: Type.Literal('desplegar'),
      barcos: Type.Array(BarcoSchema, {
        minItems: TAMANOS_FLOTA.length,
        maxItems: TAMANOS_FLOTA.length,
      }),
    },
    SIN_EXTRAS,
  ),
  Type.Object(
    { tipo: Type.Literal('disparar'), fila: Coordenada, columna: Coordenada },
    SIN_EXTRAS,
  ),
  Type.Object({ tipo: Type.Literal('rendirse') }, SIN_EXTRAS),
]);

export type FlotaAction = Static<typeof FlotaAction>;

/**
 * Lo que sale hacia un asiento.
 *
 * Aquí está el juego entero: del rival solo viaja la rejilla de lo que ya le
 * has disparado. Sus barcos a flote no están ocultos en el cliente, es que no
 * se envían. Y `flotaRival` deja de ser `null` únicamente cuando la partida ha
 * terminado y ya no hay nada que descubrir.
 */
export interface FlotaView {
  readonly fase: Fase;
  readonly turno: SeatId | null;
  readonly ganador: SeatId | null;
  /** Quién ha desplegado ya. */
  readonly desplegados: readonly SeatId[];
  readonly tuyo: Bando | null;
  readonly rivalId: SeatId | null;
  /** Tus disparos sobre el rival: su rejilla, nunca su flota. */
  readonly disparosSobreRival: readonly (Casilla | null)[];
  readonly flotaRival: readonly Barco[] | null;
  readonly punteriaTuya: Punteria | null;
  readonly punteriaRival: Punteria | null;
}
