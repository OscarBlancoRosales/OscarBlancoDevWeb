/**
 * Los tipos del banco. Viven aparte para que cada mazo pueda importarlos
 * sin cerrar un ciclo con el registro.
 */

export interface Termino {
  /** La palabra de la tripulación. */
  readonly a: string;
  /** La parecida: la del infiltrado, y señuelo en la última palabra. */
  readonly b: string;
  /** Lo que diría quien la sabe. Tres, para que los bots no se repitan. */
  readonly pistas: readonly [string, string, string];
}

export interface Tema {
  readonly id: string;
  readonly nombre: string;
  /** Una línea para el selector de la sala. */
  readonly pinta: string;
  readonly terminos: readonly Termino[];
}
