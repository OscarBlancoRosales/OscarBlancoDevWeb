/**
 * Lanzador de las herramientas de mapas.
 *
 * Están escritas en TypeScript para poder reutilizar (y testear con vitest) los
 * mismos algoritmos de geometría que usa el juego. esbuild las empaqueta a un
 * archivo temporal y Node lo ejecuta.
 */
import { buildSync } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const entry = process.argv[2] ?? 'tools/build-spain-map.ts';
const dir = mkdtempSync(join(tmpdir(), 'risk-maps-'));
const bundle = join(dir, 'tool.mjs');

try {
  // Se usa la API de JavaScript de esbuild, no su binario.
  //
  // Antes esto invocaba `node node_modules/esbuild/bin/esbuild`, y funcionaba en
  // Windows por casualidad: allí ese fichero es un script de JavaScript. En
  // Linux, esbuild lo sustituye por el binario nativo al instalarse, así que
  // Node se encontraba un ELF y moría con «Invalid or unexpected token». En una
  // máquina de desarrollo con Windows no se veía; en el CI fallaba siempre.
  buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
    logLevel: 'warning',
  });

  execFileSync(process.execPath, [bundle], { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
