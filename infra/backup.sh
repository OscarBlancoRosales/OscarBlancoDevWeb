#!/usr/bin/env bash
#
# Copia de seguridad de la base.
#
# `sqlite3 .backup` es consistente en caliente: no hace falta parar el servicio
# ni arriesgarse a copiar un fichero a medio escribir. Copiar el .db con `cp`
# mientras el WAL está vivo produce una copia que parece buena y no lo es.
#
# Y una copia que vive en el mismo disco que el original no es una copia: es un
# historial. Si el disco se va, se van las dos. Por eso, si hay un destino
# remoto configurado, la copia sale de la máquina.

set -euo pipefail

DB=${DEVWEB_DB:-/var/lib/devweb/devweb.db}
DEST=${DEVWEB_BACKUP_DIR:-/var/lib/devweb/backups}
RETENTION_DAYS=${DEVWEB_BACKUP_RETENTION:-7}

# Destino remoto de rclone, por ejemplo "copias:devweb". Vacío = solo copia
# local, y se avisa. Ver infra/README.md para configurarlo.
REMOTE=${DEVWEB_BACKUP_REMOTE:-}
RCLONE_CONF=${DEVWEB_RCLONE_CONF:-/etc/devweb/rclone.conf}
REMOTE_RETENTION_DAYS=${DEVWEB_BACKUP_REMOTE_RETENTION:-30}

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

# ===== FUERA DE LA MÁQUINA =====

if [[ -z "$REMOTE" ]]; then
  echo "AVISO: DEVWEB_BACKUP_REMOTE está vacío. Las copias NO salen de esta" >&2
  echo "       máquina, así que un fallo del disco se lleva la base y las" >&2
  echo "       copias a la vez. Ver infra/README.md." >&2
  exit 0
fi

if ! command -v rclone >/dev/null; then
  echo "ERROR: hay un destino remoto configurado pero rclone no está instalado." >&2
  exit 1
fi

nombre="devweb-$stamp.db.gz"
rclone_opts=(--config "$RCLONE_CONF" --retries 3 --low-level-retries 5)

echo "Subiendo a $REMOTE"
rclone copyto "${rclone_opts[@]}" "$out.gz" "$REMOTE/$nombre"

# Que `rclone copy` no haya fallado no es lo mismo que que el fichero esté allí.
# Lo caro de una copia de seguridad es descubrir que no existe el día que hace
# falta, así que se pregunta por ella.
if ! rclone lsf "${rclone_opts[@]}" "$REMOTE/$nombre" >/dev/null 2>&1; then
  echo "ERROR: la copia no aparece en $REMOTE después de subirla." >&2
  exit 1
fi
echo "Copia remota confirmada: $REMOTE/$nombre"

# La purga remota se limita a nuestros ficheros. Si el destino resultara ser un
# cubo compartido, un borrado por antigüedad a secas se llevaría por delante lo
# de los demás.
rclone delete "${rclone_opts[@]}" \
  --min-age "${REMOTE_RETENTION_DAYS}d" \
  --include 'devweb-*.db.gz' \
  "$REMOTE" || echo "AVISO: no se pudo purgar lo antiguo en $REMOTE." >&2
