/**
 * Comprueba que el relay de correo funciona, antes de fiarse de él.
 *
 * Configurar SMTP y no probarlo hasta que alguien se registre significa
 * enterarte del fallo por el peor camino: una persona esperando un correo que
 * nunca llega, y tú sin saberlo.
 *
 * En la VPS:
 *   sudo -u devweb node /opt/devweb/current/../probar-correo.mjs tu@correo.com
 *
 * O en cualquier sitio, dándole la URL a mano:
 *   SMTP_URL='smtps://usuario:clave@smtp.proveedor.com:465' \
 *   MAIL_FROM='DevWeb <no-reply@oscarblancorosales.com>' \
 *   node infra/probar-correo.mjs tu@correo.com
 */
import { readFileSync } from 'node:fs';
import { createTransport } from 'nodemailer';

const DESTINO = process.argv[2];
if (!DESTINO) {
  console.error('Uso: node probar-correo.mjs destino@ejemplo.com');
  process.exit(2);
}

/** Lee /etc/devweb/api.env si existe, para no repetir los valores a mano. */
function delEntorno(clave) {
  if (process.env[clave]) return process.env[clave];
  try {
    const fichero = readFileSync('/etc/devweb/api.env', 'utf8');
    const linea = fichero.split('\n').find((l) => l.startsWith(`${clave}=`));
    return linea ? linea.slice(clave.length + 1).trim() : '';
  } catch {
    return '';
  }
}

const url = delEntorno('SMTP_URL');
const remitente = delEntorno('MAIL_FROM') || 'DevWeb <no-reply@localhost>';

if (!url) {
  console.error('SMTP_URL está vacío: no hay nada que probar.');
  console.error('Rellénalo en /etc/devweb/api.env y vuelve a lanzarlo.');
  process.exit(1);
}

const transporte = createTransport(url);

try {
  // `verify` comprueba conexión y credenciales sin mandar nada. Si esto falla,
  // el problema es de configuración y no hace falta molestar a nadie con un
  // correo de prueba.
  await transporte.verify();
  console.log('Conexión y credenciales: correctas.');

  const info = await transporte.sendMail({
    from: remitente,
    to: DESTINO,
    subject: 'Prueba del correo de DevWeb',
    text:
      'Si lees esto, el relay funciona y los enlaces de verificación llegarán.\n\n' +
      'Mira también si ha caído en spam: eso se arregla con SPF y DKIM en el DNS,\n' +
      'y el proveedor te dice qué registros poner.',
  });

  console.log('Enviado. Identificador:', info.messageId);
  console.log('Revisa la bandeja de', DESTINO, '— y la carpeta de spam.');
} catch (error) {
  console.error('No se ha podido enviar:', error.message);
  process.exit(1);
}
