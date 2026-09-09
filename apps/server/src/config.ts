import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Static } from '@sinclair/typebox';

/**
 * El entorno es una frontera, así que se valida como cualquier otra.
 *
 * Un servidor que arranca con `JWT_SECRET` vacío no falla al arrancar: falla
 * tres semanas después, cuando alguien firma un token con la cadena vacía. Es
 * más barato no arrancar.
 */
const ConfigSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('production'), Type.Literal('test')], {
    default: 'development',
  }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  HOST: Type.String({ minLength: 1, default: '127.0.0.1' }),

  DATABASE_PATH: Type.String({ minLength: 1, default: './data/devweb.db' }),

  /** Orígenes permitidos, separados por comas. Sin comodines: se escriben. */
  CORS_ORIGINS: Type.String({ minLength: 1, default: 'http://localhost:4200' }),

  /** Mínimo 32 caracteres: por debajo, firmar es teatro. */
  JWT_SECRET: Type.String({ minLength: 32 }),
  ACCESS_TOKEN_TTL_SECONDS: Type.Integer({ minimum: 60, maximum: 3600, default: 600 }),
  REFRESH_TOKEN_TTL_DAYS: Type.Integer({ minimum: 1, maximum: 365, default: 30 }),

  /** Dominio de la cookie de refresco. Vacío = solo el host que responde. */
  COOKIE_DOMAIN: Type.String({ default: '' }),

  PUBLIC_WEB_URL: Type.String({ minLength: 1, default: 'http://localhost:4200' }),

  SMTP_URL: Type.String({ default: '' }),
  MAIL_FROM: Type.String({ default: 'no-reply@localhost' }),

  /**
   * La clave con la que habla el presentador del concurso.
   *
   * Vacía es un modo de funcionamiento, no un fallo: sin clave el presentador
   * dice el guion escrito, que está pensado para valer por sí solo. Lo que no
   * puede pasar es que el servidor no arranque por esto.
   */
  AI_KEY: Type.String({ default: '' }),
  AI_PROVIDER: Type.String({ default: 'openrouter' }),
  AI_MODEL: Type.String({ default: '' }),
  /**
   * Si solo se llama a modelos gratuitos. Encendido por defecto.
   *
   * Con esto encendido, un `AI_MODEL` de pago se descarta **en silencio** y el
   * juego se queda con el guion escrito sin decir por qué: es el fallo más
   * difícil de diagnosticar que tiene esto. Ponerlo a `false` es aceptar que
   * cada partida factura.
   */
  AI_FREE_ONLY: Type.Boolean({ default: true }),
});

export type Config = Static<typeof ConfigSchema> & { readonly corsOrigins: readonly string[] };

export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Configuración inválida:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

/**
 * Los números llegan como texto desde el entorno; se convierten antes de validar
 * para que el mensaje de error hable del valor, no del tipo.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw: unknown = Value.Default(ConfigSchema, Value.Convert(ConfigSchema, { ...env }));
  const problems = [...Value.Errors(ConfigSchema, raw)].map(
    (error) => `${error.path.slice(1) || '(raíz)'}: ${error.message}`,
  );
  if (problems.length > 0) throw new ConfigError(problems);

  const config = Value.Clean(ConfigSchema, raw) as Static<typeof ConfigSchema>;
  const corsOrigins = config.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return { ...config, corsOrigins };
}
