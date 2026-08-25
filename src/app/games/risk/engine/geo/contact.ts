/**
 * Cuándo se considera que dos siluetas están pegadas.
 *
 * Es un único criterio compartido por las herramientas que generan los mapas y
 * por los tests que los validan. Si cada uno usara el suyo, podrían discrepar
 * justo en los casos límite (el estrecho de Bab el-Mandeb entre África Oriental
 * y Oriente Medio, por ejemplo) y quedaría una conexión sin dibujar de ninguna
 * de las dos formas.
 *
 * Lo que importa de verdad es lo que ve el jugador: si dos territorios están a
 * dos milésimas del ancho del tablero, se leen como pegados. Todo lo que quede
 * más lejos tiene que llevar su línea de puntos.
 */

/** Fracción del ancho del tablero por debajo de la cual dos siluetas "se tocan". */
export const CONTACT_FRACTION = 0.002;

export function contactThresholdFor(boardWidth: number): number {
  return boardWidth * CONTACT_FRACTION;
}
