/**
 * Migración 003: un mensaje puede ir dirigido a un asiento concreto.
 *
 * `to_seat` vacío es el canal de todos, que es como estaba todo hasta ahora.
 * Con él, el servidor puede no enviarle un privado a quien no es ninguno de
 * los dos extremos, que es la única forma de que un privado lo sea de verdad:
 * mientras el mensaje viajaba a todo el mundo y sólo se escondía al pintarlo,
 * cualquiera con la consola abierta lo leía.
 */
export const sql = `
ALTER TABLE room_chat ADD COLUMN to_seat TEXT;
`;
