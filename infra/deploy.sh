#!/usr/bin/env bash
#
# Instala una entrega ya subida y la pone en marcha. Se ejecuta EN la VPS.
#
# Cada entrega vive en su propia carpeta y `current` es un enlace simbólico.
# Volver atrás es mover el enlace, no repetir un despliegue con los dedos
# cruzados.
#
#   sudo bash deploy.sh /tmp/devweb-api.tar.gz

set -euo pipefail

TARBALL=${1:?Falta el tarball de la entrega}
APP_DIR=/opt/devweb
APP_USER=devweb
KEEP=5

[[ $EUID -eq 0 ]] || { echo "Ejecútalo con sudo." >&2; exit 1; }
[[ -f "$TARBALL" ]] || { echo "No existe $TARBALL" >&2; exit 1; }

release="$APP_DIR/releases/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$release"
tar -xzf "$TARBALL" -C "$release"

# Solo lo de producción: las dependencias de desarrollo no pintan nada en un
# servidor y son superficie de ataque gratis.
( cd "$release" && npm ci --omit=dev --ignore-scripts=false --no-audit --no-fund )
chown -R "$APP_USER:$APP_USER" "$release"

# `readlink` a secas, sin -f: devuelve el destino SOLO si `current` ya es un
# enlace, y vacío si no existe. Con -f devolvía la ruta que tendría, así que en
# el primer despliegue `previous` acababa valiendo `/opt/devweb/current`... y la
# vuelta atrás creaba un enlace apuntándose a sí mismo.
previous=$(readlink "$APP_DIR/current" 2>/dev/null || true)
ln -sfn "$release" "$APP_DIR/current"

systemctl restart devweb-api

# Un despliegue no ha terminado cuando el servicio arranca, sino cuando
# responde. Si no responde, se vuelve solo a la entrega anterior.
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:3000/health >/dev/null 2>&1; then
    echo "Entrega $release en marcha."
    ls -1dt "$APP_DIR"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
    exit 0
  fi
  sleep 1
done

echo "La entrega no responde al health. Volviendo a la anterior." >&2
if [[ -n "$previous" && -d "$previous" && "$previous" != "$APP_DIR/current" ]]; then
  ln -sfn "$previous" "$APP_DIR/current"
  systemctl restart devweb-api
  echo "Restaurada la entrega anterior: $previous" >&2
else
  # No hay a dónde volver: es el primer despliegue, o el anterior ya no está.
  # Se para el servicio en vez de dejarlo reiniciándose en bucle para siempre.
  systemctl stop devweb-api
  echo "No hay entrega anterior a la que volver. Servicio parado." >&2
  echo "Mira qué pasó con:  journalctl -u devweb-api -n 50 --no-pager" >&2
fi
exit 1
