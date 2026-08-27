import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

const SECRET = 'x'.repeat(32);

describe('loadConfig', () => {
  it('no arranca sin secreto de firma', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('no acepta un secreto corto, que es peor que ninguno porque parece uno', () => {
    expect(() => loadConfig({ JWT_SECRET: 'corto' })).toThrow(ConfigError);
  });

  it('dice qué variable falla, no solo que algo falla', () => {
    try {
      loadConfig({ JWT_SECRET: SECRET, PORT: '99999' });
      expect.unreachable('debería haber fallado');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).problems.join()).toContain('PORT');
    }
  });

  it('convierte los números que llegan como texto', () => {
    const config = loadConfig({ JWT_SECRET: SECRET, PORT: '8080' });
    expect(config.PORT).toBe(8080);
  });

  it('parte los orígenes permitidos y descarta los vacíos', () => {
    const config = loadConfig({
      JWT_SECRET: SECRET,
      CORS_ORIGINS: 'https://a.com, https://b.com , ',
    });
    expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('escucha solo en local por defecto, para que nginx sea la única puerta', () => {
    expect(loadConfig({ JWT_SECRET: SECRET }).HOST).toBe('127.0.0.1');
  });
});
