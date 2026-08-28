/**
 * Los paneles que se abren sobre el mapa, uno cada vez.
 *
 * Vivía en la barra de acción, que ya no existe. No hay ninguna barra que los
 * invoque: cada uno se abre desde donde tiene sentido —las cartas desde las
 * cartas, la partida y los ajustes desde el bloque de fase— y comparten hueco
 * para que nunca haya dos tapando el mapa a la vez.
 */
export type PanelId = 'chat' | 'cartas' | 'historia' | 'ia';
