/**
 * La marca que permite echar a alguien en el acto.
 *
 * Revocar los refrescos no basta: el token de acceso sigue firmado y válido
 * hasta que caduca, así que quien ya lo tiene sigue dentro ese rato. Con esta
 * marca el guardia puede rechazar cualquier token emitido antes de ella, y
 * «forzar relogin» pasa a significar lo que dice.
 *
 * Cero es «ninguno»: una cuenta recién creada no invalida nada.
 */
export const sql = `
ALTER TABLE users ADD COLUMN sessions_invalid_before INTEGER NOT NULL DEFAULT 0;
`;
