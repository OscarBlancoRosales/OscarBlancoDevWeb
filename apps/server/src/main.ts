import { buildApp } from './app';
import { ConfigError, loadConfig } from './config';
import { openDatabase } from './db/index';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.DATABASE_PATH);
  const app = await buildApp({ config, db });

  // systemd manda SIGTERM al reiniciar. Cerrar a mano da tiempo a terminar las
  // peticiones en vuelo y a que SQLite cierre el WAL en condiciones.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void app.close().then(() => {
        db.close();
        process.exit(0);
      });
    });
  }

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(78); // EX_CONFIG
  }
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
