#!/usr/bin/env bash
#
# Prepara una VPS con Ubuntu 26.04 para servir la API de DevWeb.
#
# Es idempotente: se puede ejecutar las veces que haga falta y el resultado es
# el mismo. Esa es la única forma de que dentro de un año se sepa qué hay puesto
# en la máquina, porque lo que hay puesto es lo que dice este fichero.
#
#   sudo bash infra/provision.sh
#
# Lo que NO hace: pedir el certificado (hace falta que el DNS ya apunte aquí) ni
# escribir los secretos. Los dos pasos se explican al final.

set -euo pipefail

APP_USER=devweb
APP_DIR=/opt/devweb
DATA_DIR=/var/lib/devweb
ENV_FILE=/etc/devweb/api.env
DOMAIN=api.oscarblancorosales.com
REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [[ $EUID -ne 0 ]]; then
  echo "Ejecútalo con sudo." >&2
  exit 1
fi

paso() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

paso "Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates gnupg git \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban unattended-upgrades sqlite3

paso "Actualizaciones de seguridad automáticas"
# Sin esto, la máquina envejece sola y nadie se entera hasta que es tarde.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades

paso "Node 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node -v

paso "Usuario de servicio $APP_USER"
# Sin shell y sin home propio: esta cuenta existe para correr un proceso, no
# para que nadie entre con ella.
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$APP_DIR" "$APP_DIR/releases" "$DATA_DIR"
install -d -o root -g "$APP_USER" -m 750 /etc/devweb

paso "Cortafuegos"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

paso "Endurecer SSH"
# Solo clave. Una contraseña en el puerto 22 de una IP pública dura lo que tarde
# el primer barrido en encontrarla.
sshd_config=/etc/ssh/sshd_config.d/99-devweb.conf
cat > "$sshd_config" <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
MaxAuthTries 3
EOF
if ! sshd -t; then
  echo "La configuración de SSH no valida; se deja como estaba." >&2
  rm -f "$sshd_config"
  exit 1
fi
systemctl reload ssh || systemctl reload sshd

paso "fail2ban"
cat > /etc/fail2ban/jail.d/devweb.local <<'EOF'
[sshd]
enabled = true
maxretry = 4
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban

paso "nginx"
install -d -m 755 /var/www/certbot
install -m 644 "$REPO_DIR/infra/nginx/api.conf" /etc/nginx/sites-available/devweb-api.conf
ln -sf /etc/nginx/sites-available/devweb-api.conf /etc/nginx/sites-enabled/devweb-api.conf
rm -f /etc/nginx/sites-enabled/default

paso "Servicio"
install -m 644 "$REPO_DIR/infra/systemd/devweb-api.service" /etc/systemd/system/devweb-api.service
install -m 755 "$REPO_DIR/infra/backup.sh" /usr/local/bin/devweb-backup
install -m 755 "$REPO_DIR/infra/deploy.sh" /usr/local/bin/devweb-deploy
install -m 644 "$REPO_DIR/infra/systemd/devweb-backup.service" /etc/systemd/system/devweb-backup.service
install -m 644 "$REPO_DIR/infra/systemd/devweb-backup.timer" /etc/systemd/system/devweb-backup.timer
systemctl daemon-reload
systemctl enable devweb-api.service
systemctl enable --now devweb-backup.timer

if [[ ! -f "$ENV_FILE" ]]; then
  paso "Plantilla de configuración"
  install -m 640 -o root -g "$APP_USER" "$REPO_DIR/infra/api.env.example" "$ENV_FILE"
  # Un secreto generado aquí no ha pasado por ningún portapapeles ni por ningún
  # chat, que es donde se pierden los secretos.
  secret=$(openssl rand -hex 32)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$secret|" "$ENV_FILE"
fi

cat <<EOF

Listo. Quedan dos cosas que esta máquina no puede decidir sola:

  1. Que $DOMAIN apunte por DNS a esta IP. Cuando lo haga:

       sudo certbot --nginx -d $DOMAIN --agree-tos -m oscar.blanco.r@gmail.com --redirect

  2. Revisar $ENV_FILE (el secreto de firma ya está generado) y
     rellenar SMTP_URL para el correo de verificación.

Después, el primer despliegue:

       sudo systemctl start devweb-api
       curl -s https://$DOMAIN/health

EOF
