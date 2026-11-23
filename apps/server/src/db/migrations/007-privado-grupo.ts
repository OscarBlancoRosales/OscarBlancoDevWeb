/**
 * Migración 007: invitaciones de grupo a lo privado, y revocarlas.
 *
 * Una de grupo se canjea muchas veces mientras no caduque; `canjes` cuenta las
 * entradas. `revocada_en` mata la invitación y, con ella, los pases que salieron
 * de ella: el guardia la consulta en cada petición.
 */
export const sql = `
ALTER TABLE invitaciones_privado ADD COLUMN tipo TEXT NOT NULL DEFAULT 'una'
  CHECK (tipo IN ('una', 'grupo'));
ALTER TABLE invitaciones_privado ADD COLUMN nota TEXT NOT NULL DEFAULT '';
ALTER TABLE invitaciones_privado ADD COLUMN canjes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invitaciones_privado ADD COLUMN revocada_en INTEGER;
`;
