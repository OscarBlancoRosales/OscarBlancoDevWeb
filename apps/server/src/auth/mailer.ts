import { createTransport } from 'nodemailer';

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Un correo que no se puede enviar no puede tumbar el registro.
 *
 * Si el relay está caído, la cuenta ya está creada y el token ya está guardado:
 * lo que falla es el aviso, no el alta. Se anota y se sigue; el usuario puede
 * pedir que se lo reenvíen. Propagar el fallo dejaría cuentas creadas cuya
 * petición devolvió un 500, que es lo peor de los dos mundos.
 */
export function createSmtpMailer(url: string, from: string): Mailer {
  const transport = createTransport(url);
  return {
    async send(mail) {
      await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}

/**
 * En desarrollo no hay relay: el correo se escribe en el log.
 *
 * Así el enlace de verificación se puede copiar del terminal sin montar nada, y
 * sin que el código de registro tenga una rama especial para desarrollo.
 */
export function createConsoleMailer(log: (message: string) => void): Mailer {
  return {
    send(mail) {
      log(`[correo] Para: ${mail.to}\n[correo] Asunto: ${mail.subject}\n${mail.text}`);
      return Promise.resolve();
    },
  };
}
