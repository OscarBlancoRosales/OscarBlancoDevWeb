/**
 * A quién le hablas cuando escribes en el canal de todos.
 *
 * El canal privado lleva el destinatario en el mensaje, pero el general no
 * lleva ninguno: es lo que lo hace general. Sin esto, escribir «Forja, no me
 * ataques» delante de todo el mundo no le llega a Forja, y el comandante se
 * queda callado justo cuando le acabas de hablar.
 *
 * Nombrar a alguien para hablarle es lo que hace cualquiera en una mesa, así
 * que se resuelve por el nombre y no por una arroba: nadie escribe arrobas
 * jugando.
 */

/** Sin tildes y en minúsculas, que es como se escribe de verdad jugando. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * El asiento nombrado en un texto, si hay alguno.
 *
 * De más largo a más corto, para que un «Almirante Marea» no lo conteste un
 * «Marea» que también estuviera sentado. Los nombres de menos de tres letras
 * se dejan fuera: aparecerían dentro de cualquier palabra.
 */
export function mentionedSeat<T extends { name: string }>(
  seats: readonly T[],
  text: string,
): T | undefined {
  const limpio = normalizeText(text);
  if (!limpio) return undefined;

  return [...seats]
    .filter((seat) => seat.name.trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length)
    .find((seat) => contienePalabra(limpio, normalizeText(seat.name.trim())));
}

/**
 * El nombre tiene que aparecer entero, no dentro de otra palabra.
 *
 * Sin esto, un bot llamado «Ana» contestaría a «mañana ataco», que es
 * exactamente la clase de respuesta que hace que el chat parezca roto.
 */
function contienePalabra(texto: string, nombre: string): boolean {
  let desde = 0;
  for (;;) {
    const i = texto.indexOf(nombre, desde);
    if (i < 0) return false;
    const antes = i === 0 ? '' : texto[i - 1];
    const despues = texto[i + nombre.length] ?? '';
    if (!esLetra(antes) && !esLetra(despues)) return true;
    desde = i + 1;
  }
}

function esLetra(caracter: string): boolean {
  return caracter !== '' && /[\p{L}\p{N}]/u.test(caracter);
}
