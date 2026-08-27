#!/usr/bin/env bash
#
# Copia de seguridad de la base.
#
# `sqlite3 .backup` es consistente en caliente: no hace falta parar el servicio
# ni arriesgarse a copiar un fichero a medio escribir. Copiar el .db con `cp`
# mientras el WAL está vivo produce una copia que parece buena y no lo es.

set -euo pipefail

DB=${DEVWEB_DB:-/var/lib/devweb/devweb.db}
DEST=${DEVWEB_BACKUP_DIR:-/var/lib/devweb/backups}
RETENTION_DAYS=${DEVWEB_BACKUP_RETENTION:-7}

[[ -f "$DB" ]] || { echo "No hay base en $DB; nada que copiar."; exit 0; }

mkdir -p "$DEST"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$DEST/devweb-$stamp.db"

sqlite3 "$DB" ".backup '$out'"
gzip -9 "$out"

# Una copia que no se puede restaurar no es una copia. Se comprueba la que
# acabamos de hacer, no la de hace un mes.
if ! gzip -t "$out.gz"; then
  echo "La copia $out.gz está corrupta." >&2
  exit 1
fi

find "$DEST" -name 'devweb-*.db.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Copia hecha: $out.gz ($(du -h "$out.gz" | cut -f1))"
