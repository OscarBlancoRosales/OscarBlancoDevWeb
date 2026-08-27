/**
 * Escribe el manifiesto de la entrega del servidor.
 *
 * La VPS no necesita el monorepo: necesita las dependencias de producción del
 * servidor y nada más. Copiar el package.json de la raíz llevaría allí Angular,
 * Firebase y las herramientas de mapas, que en un servidor solo son peso y
 * superficie de ataque.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const server = JSON.parse(readFileSync('apps/server/package.json', 'utf8'));

mkdirSync('release', { recursive: true });
writeFileSync(
  'release/package.json',
  JSON.stringify(
    {
      name: 'devweb-api',
      version: '0.0.0',
      private: true,
      type: 'module',
      dependencies: server.dependencies,
    },
    null,
    2,
  ) + '\n',
);

console.log(`Manifiesto con ${Object.keys(server.dependencies).length} dependencias.`);
