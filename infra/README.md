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
servidor, el paquete compartido o la infraestructura. Necesita **cuatro**
secretos en el repositorio: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` y
`VPS_HOST_KEY`.

El cuarto es el que se olvida, y sin él el despliegue falla siempre en el paso
de subir: `known_hosts` queda vacío y `ssh` se niega a conectar con un servidor
que no reconoce. Es a propósito —aceptar la huella que conteste sería confiar en
quien conteste— pero hay que rellenarlo a mano. Se saca así, desde una máquina
de confianza:

```bash
ssh-keyscan -t ed25519 LA_IP
```

La línea entera que devuelve es el valor del secreto.

> Si el despliegue automático está caído, la API se queda con lo último que se
> subió a mano, y eso no se nota en ninguna pantalla: el sitio sigue en pie
> sirviendo un servidor viejo. Cuando el cliente y el servidor dejan de hablar
> el mismo idioma —un campo nuevo en un mensaje, por ejemplo— lo que se ve es
> una función que «no funciona», no un error. Merece la pena mirar
> `/health` y comparar `uptimeSeconds` con la fecha del último cambio del
> servidor antes de buscar el fallo en el código.

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

Sin esto **nadie puede activar su cuenta**: el registro contesta que todo ha ido
bien y el enlace de verificación acaba en el log del servidor. El servidor avisa
al arrancar en producción si `SMTP_URL` está vacío, precisamente porque es un
fallo que de otro modo se descubre semanas después y por la peor vía.

No se monta un Postfix propio a propósito: una IP de VPS recién creada no tiene
reputación, y el correo acabaría en spam justo cuando alguien intenta darse de
alta. Además sería un servicio más que parchear.

### Paso a paso, con Resend

Sirve igual Brevo o Mailgun; los tres tienen plan gratuito de sobra para esto.

1. Crea la cuenta en **resend.com** y verifica tu correo.
2. **Domains → Add Domain** → `oscarblancorosales.com`.
3. Te dará unos registros DNS (SPF, DKIM y DMARC). Añádelos donde gestionas el
   DNS, que es el mismo sitio donde creaste el registro `api`. **Este paso es el
   que decide si tus correos llegan a la bandeja o al spam**: sin SPF y DKIM,
   Gmail y Outlook desconfían de cualquiera.
4. Espera a que Resend marque el dominio como verificado (suele ser minutos).
5. **API Keys → Create API Key**, con permiso de envío.
6. En la VPS, edita la configuración:

```bash
sudo nano /etc/devweb/api.env
```

Pon estas dos líneas (la contraseña es la API key entera):

```
SMTP_URL=smtps://resend:re_TU_API_KEY@smtp.resend.com:465
MAIL_FROM=DevWeb <no-reply@oscarblancorosales.com>
```

7. **Pruébalo antes de fiarte**, que para eso está:

```bash
sudo -u devweb devweb-probar-correo tu@correo.com
```

Primero comprueba conexión y credenciales sin enviar nada; si eso pasa, manda un
correo de prueba. Mira también la carpeta de spam: si cae ahí, falta algún
registro DNS del paso 3.

8. Cuando llegue, reinicia el servicio:

```bash
sudo systemctl restart devweb-api
```

### Comprobación de extremo a extremo

Regístrate de verdad con un correo tuyo y mira que llega el enlace:

```bash
curl -s -X POST https://api.oscarblancorosales.com/auth/registro \
  -H 'Content-Type: application/json' \
  -d '{"email":"tu@correo.com","password":"una-contrasena-larga","displayName":"Óscar"}'
```

Debe contestar `{"ok":true}` **y** llegarte el correo. Si contesta bien pero no
llega nada, el problema está en el relay, no en el servidor: vuelve al paso 7.

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
