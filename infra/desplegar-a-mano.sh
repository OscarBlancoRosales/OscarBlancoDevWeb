#!/usr/bin/env bash
#
# Despliegue manual de la API, para cuando GitHub Actions no está en juego.
#
#   bash infra/desplegar-a-mano.sh
#
# Se ejecuta desde una terminal de verdad, no desde un agente: la clave tiene
# passphrase y ssh necesita un sitio donde pedírtela.
#
# `IdentitiesOnly=yes` no es un adorno. Sin él, ssh ofrece todas las claves de
# ~/.ssh una detrás de otra y cada una cuenta como un intento fallido; con el
# fail2ban de la máquina, dos conexiones distraídas te dejan fuera una hora.
set -euo pipefail

CLAVE="${CLAVE:-$HOME/.ssh/id_ed25519}"
DESTINO="${DESTINO:-ubuntu@57.129.143.230}"
SALUD="${SALUD:-https://api.oscarblancorosales.com/health}"

# La ruta del paquete en el servidor es fija: es la única que autoriza la regla
# de sudo, así que no se parametriza.
REMOTO=/tmp/devweb-api.tar.gz

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

ssh_opts=(-i "$CLAVE" -o IdentitiesOnly=yes)

echo "==> Empaquetando la API"
npm run build -w @devweb/server
rm -rf release
mkdir -p release
cp apps/server/dist/server.mjs release/server.mjs
node tools/pack-server-manifest.mjs
npm install --prefix release --package-lock-only --omit=dev --no-audit --no-fund
tar -czf devweb-api.tar.gz -C release .

echo "==> Subiendo $(du -h devweb-api.tar.gz | cut -f1) a $DESTINO"
scp "${ssh_opts[@]}" devweb-api.tar.gz "$DESTINO:$REMOTO"

# El paquete se borra pase lo que pase, pero el fallo del despliegue tiene que
# llegar hasta aquí: encadenar con `;` haría que un despliegue roto se diera por
# bueno porque el `rm` sí funcionó.
echo "==> Desplegando"
ssh "${ssh_opts[@]}" "$DESTINO" \
  "sudo /usr/local/bin/devweb-deploy $REMOTO; salida=\$?; rm -f $REMOTO; exit \$salida"

# El despliegue ya espera al health por dentro y vuelve atrás si falla. Esto lo
# comprueba desde fuera, que es desde donde lo ven los usuarios.
echo "==> Comprobando que responde desde internet"
curl -fsS --retry 5 --retry-delay 3 "$SALUD"
echo
echo "Listo."
