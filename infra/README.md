# La VPS

Ubuntu 26.04. Un proceso, un fichero de base de datos y un proxy inverso. Sin
Docker: lo que hay puesto en la máquina es exactamente lo que dice
`provision.sh`, y se puede leer de una sentada.

## Puesta en marcha, la primera vez

```bash
# 1. En tu máquina: sube el repositorio a la VPS (o clónalo allí).
scp -r . usuario@IP:~/devweb

# 2. En la VPS: prepara el sistema. Es idempotente; repetirlo no rompe nada.
ssh usuario@IP
sudo bash ~/devweb/infra/provision.sh
```

Eso deja instalado y encendido: Node 22, nginx, ufw (solo 22, 80 y 443),
fail2ban, actualizaciones de seguridad automáticas, el usuario de servicio
`devweb` sin shell, el servicio `devweb-api`, la copia diaria y una plantilla de
configuración en `/etc/devweb/api.env` con el secreto de firma ya generado.

Quedan dos cosas que la máquina no puede decidir sola:

```bash
# 3. Con el DNS de api.oscarblancorosales.com apuntando ya a esta IP:
sudo certbot --nginx -d api.oscarblancorosales.com --agree-tos \
     -m oscar.blanco.r@gmail.com --redirect

# 4. Rellenar SMTP_URL en /etc/devweb/api.env (relay externo; ver más abajo).
sudo nano /etc/devweb/api.env
sudo systemctl restart devweb-api
```

## Despliegues

Los hace `.github/workflows/deploy-api.yml` en cada push a `main` que toque el
servidor, el paquete compartido o la infraestructura. Necesita tres secretos en
el repositorio: `VPS_HOST`, `VPS_USER` y `VPS_SSH_KEY`.

Cada entrega va a su propia carpeta bajo `/opt/devweb/releases/` y `current` es
un enlace simbólico. El script espera a que `/health` responda; si no responde en
30 segundos, **vuelve solo a la entrega anterior**. Un despliegue no ha terminado
cuando el servicio arranca, sino cuando contesta.

Volver atrás a mano:

```bash
ls -1dt /opt/devweb/releases/*/     # la anterior es la segunda de la lista
sudo ln -sfn /opt/devweb/releases/LA_QUE_SEA /opt/devweb/current
sudo systemctl restart devweb-api
```

## Copias de seguridad

Diarias, por `devweb-backup.timer`, con siete días de retención en
`/var/lib/devweb/backups/`. Usan `sqlite3 .backup`, que es consistente en
caliente: copiar el `.db` con `cp` mientras el WAL está vivo produce una copia
que parece buena y no lo es.

```bash
sudo -u devweb devweb-backup            # una copia ahora
systemctl list-timers devweb-backup     # cuándo toca la próxima
```

Restaurar:

```bash
sudo systemctl stop devweb-api
sudo -u devweb bash -c 'gunzip -c /var/lib/devweb/backups/devweb-XXXX.db.gz > /var/lib/devweb/devweb.db'
sudo systemctl start devweb-api
```

**El timer no prueba que la copia sirva.** Restaurar una en local de vez en
cuando es la única forma de saber que las copias valen para algo.

## El correo

`SMTP_URL` apunta a un relay externo (Resend, Brevo, Mailgun; los tres tienen
plan gratuito suficiente para verificar cuentas). Formato:

```
SMTP_URL=smtps://usuario:contraseña@smtp.proveedor.com:465
```

No se monta un Postfix propio a propósito: una IP de VPS recién creada no tiene
reputación, y el correo de verificación acabaría en spam justo cuando alguien
intenta darse de alta. Además sería un servicio más que parchear.

## Diagnóstico

```bash
systemctl status devweb-api
journalctl -u devweb-api -f              # el log, en vivo
journalctl -u devweb-api --since '1 hour ago' | grep -i error
curl -s https://api.oscarblancorosales.com/health

nginx -t && systemctl reload nginx       # tras tocar la configuración
ufw status verbose
fail2ban-client status sshd
```

Si `/health` devuelve `503` con `"database": false`, el proceso está vivo y
SQLite no: casi siempre es el disco lleno (`df -h`) o los permisos de
`/var/lib/devweb`.
