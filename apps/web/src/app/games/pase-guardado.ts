/**
 * El pase de un asiento en una sala, sea del juego que sea.
 *
 * Vive aquí y no dentro de un juego porque no es de ninguno: es lo que el
 * servidor devuelve al sentarte, y todas las salas lo guardan igual.
 */
export interface PaseDeSala {
  readonly roomId: string;
  readonly seatId: string;
  readonly seatToken: string;
}

const CLAVE = 'sala:pase';

/**
 * Guarda el pase en el navegador.
 *
 * Sin esto, recargar la página en mitad de una partida sería empezar de cero:
 * el pase es lo único que demuestra que ese asiento es tuyo, y el servidor no
 * lo vuelve a dar. Se guarda uno por sala porque una misma persona puede tener
 * dos partidas abiertas a la vez.
 */
export function guardarPase(pase: PaseDeSala): void {
  try {
    localStorage.setItem(`${CLAVE}:${pase.roomId}`, JSON.stringify(pase));
  } catch {
    // Navegar en privado o con el almacenamiento lleno no puede impedir jugar:
    // solo impide volver tras recargar.
  }
}

export function paseDe(roomId: string): PaseDeSala | null {
  try {
    const guardado = localStorage.getItem(`${CLAVE}:${roomId}`);
    if (!guardado) return null;
    const pase = JSON.parse(guardado) as Partial<PaseDeSala>;
    return pase.roomId && pase.seatId && pase.seatToken ? (pase as PaseDeSala) : null;
  } catch {
    return null;
  }
}

export function olvidarPase(roomId: string): void {
  try {
    localStorage.removeItem(`${CLAVE}:${roomId}`);
  } catch {
    // Si no se puede borrar, el pase caduca solo cuando la sala se borra.
  }
}
