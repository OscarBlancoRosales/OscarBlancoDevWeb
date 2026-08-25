/**
 * Lanzador de las herramientas de mapas.
 *
 * Están escritas en TypeScript para poder reutilizar (y testear con vitest) los
 * mismos algoritmos de geometría que usa el juego. esbuild las empaqueta a un
 * archivo temporal y Node lo ejecuta.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = process.argv[2] ?? 'tools/build-spain-map.ts';
const dir = mkdtempSync(join(tmpdir(), 'risk-maps-'));
const bundle = join(dir, 'tool.mjs');

try {
  // Llamamos al binario de esbuild directamente: `npx` no se deja invocar en
  // Windows sin shell y no merece la pena abrir una.
  const esbuild = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'node_modules',
    'esbuild',
    'bin',
    'esbuild',
  );
  execFileSync(
    process.execPath,
    [esbuild, entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${bundle}`, '--log-level=warning'],
    { stdio: 'inherit' },
  );
  execFileSync(process.execPath, [bundle], { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
