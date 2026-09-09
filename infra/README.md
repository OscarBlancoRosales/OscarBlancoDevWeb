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

> **Volver a aprovisionar una máquina que ya está en producción es seguro**, pero
> conviene saber por qué: el `api.conf` del repositorio es de solo puerto 80 —en
> la primera pasada el certificado aún no existe—, y certbot añade el bloque TLS
> a ese mismo fichero. El script mira si ya hay un `listen 443` y, si lo hay, no
> lo toca. Sin esa comprobación, reaprovisionar dejaba el sitio sin HTTPS.
>
> Si alguna vez pasa, se recupera con:
>
> ```bash
> sudo certbot --nginx -d api.oscarblancorosales.com --agree-tos >      -m oscar.blanco.r@gmail.com --redirect --non-interactive
> ```

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

### Que salgan de la máquina

Una copia en el mismo disco que el original no es una copia, es un historial: si
el disco se va, se van las dos. Con `DEVWEB_BACKUP_REMOTE` configurado, cada
copia se sube a un destino de `rclone` y se comprueba que ha llegado.

**El remoto tiene que ir cifrado.** Esa base lleva correos y hashes de
contraseñas de gente real, y eso no se sube en claro a casa de un tercero. En
`rclone` se hace encadenando un remoto `crypt` sobre el de almacenamiento: el
`crypt` cifra el contenido y el nombre del fichero antes de que salgan de aquí,
así que el proveedor guarda ruido.

```bash
sudo rclone config --config /etc/devweb/rclone.conf
```

Dos remotos, en este orden:

1. **El almacenamiento.** Elige uno con **credenciales estáticas** —S3, Backblaze
   B2, el Object Storage de OVH— y no uno de OAuth como Google Drive: los de
   OAuth necesitan reescribir el fichero de configuración para refrescar el
   token, y aquí `/etc` está montado en solo lectura para el servicio. Llámalo
   por ejemplo `almacen`.
2. **El cifrado.** Tipo `crypt`, con `remote` apuntando a `almacen:tu-cubo/devweb`
   y una contraseña larga. Llámalo por ejemplo `copias`.

Luego los permisos y el destino:

```bash
sudo chown root:devweb /etc/devweb/rclone.conf
sudo chmod 640 /etc/devweb/rclone.conf
sudoedit /etc/devweb/backup.env          # DEVWEB_BACKUP_REMOTE=copias:
sudo -u devweb devweb-backup             # y lo pruebas ahora mismo
```

> **Guarda la contraseña del `crypt` fuera de esta máquina**, en tu gestor de
> contraseñas. Está dentro de `/etc/devweb/rclone.conf`, y ese fichero se pierde
> con la máquina — que es justo el día que vas a necesitar las copias. Sin esa
> contraseña, lo que hay en el cubo es ruido para siempre.

### Probar que una copia sirve

Esto no se hace "algún día": se hace una vez ahora y se apunta la fecha. Se
prueba **contra un fichero aparte**, sin tocar la base en marcha:

```bash
# La última copia local, o `rclone copy copias:EL_FICHERO .` si la traes de fuera
ultima=$(ls -1t /var/lib/devweb/backups/devweb-*.db.gz | head -1)
gunzip -c "$ultima" > /tmp/prueba.db

sqlite3 /tmp/prueba.db 'PRAGMA integrity_check;'          # espera: ok
sqlite3 /tmp/prueba.db 'SELECT COUNT(*) FROM users;'      # espera: tus cuentas
sqlite3 /tmp/prueba.db 'SELECT COUNT(*) FROM rooms;'
rm -f /tmp/prueba.db
```

Si `integrity_check` dice `ok` y las cuentas están, la copia vale. Restaurarla de
verdad es lo que ya está descrito arriba.

## El panel de administración

Cockpit, para mirar la máquina sin pelearse con `ssh`: servicios, registro,
disco y una terminal. Lee systemd y journald, no reimplementa nada, y se
autentica con los usuarios del sistema — dentro tienes tus permisos, no los de
root.

**No está publicado en internet, y eso es lo que lo hace aceptable.** Escucha
solo en `127.0.0.1:9090`; el 9090 no está abierto en el cortafuegos. Se entra
por túnel, desde tu máquina:

```bash
ssh -L 9090:localhost:9090 ubuntu@IP
```

Y abres `http://localhost:9090`. Se comprueba con:

```bash
ss -ltnp | grep 9090      # debe decir 127.0.0.1:9090, nunca 0.0.0.0:9090
```

Un panel de administración publicado es un segundo juego de credenciales que
rotar y un segundo servidor web que parchear, a cambio de ahorrarse un túnel.
Por lo mismo aquí no hay Portainer: necesita montar el socket de Docker, y quien
controla ese socket es root en la máquina sin pasar por `sudo`.

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
MAIL_FROM=Óscar Blanco Rosales <no-reply@oscarblancorosales.com>
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
