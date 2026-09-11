import { construirAgente } from './servidor';
import { RAIZ_POR_DEFECTO } from './almacen';

/**
 * Arranca el agente en tu máquina.
 *
 * `127.0.0.1` y no `0.0.0.0` a propósito: así no escucha en la red de casa.
 * Quien quiera llegar aquí tiene que estar ya dentro de este ordenador.
 */
const PUERTO = Number(process.env['PUERTO'] ?? 4319);

const app = await construirAgente();
try {
  await app.listen({ port: PUERTO, host: '127.0.0.1' });
} catch (fallo) {
  // El canal usa este mismo puerto y trae el visor dentro: si ya hay una
  // sesión de Claude Code con el canal abierto, esto sobra.
  if ((fallo as { code?: string }).code === 'EADDRINUSE') {
    console.log(`\n  El puerto ${PUERTO} ya está ocupado.`);
    console.log(`  Si tienes Claude Code con el canal abierto, no hace falta esto:`);
    console.log(`  el canal ya sirve las sesiones.\n`);
    process.exit(0);
  }
  throw fallo;
}

console.log(`\n  Agente de sesiones en marcha.`);
console.log(`  Escuchando  http://127.0.0.1:${PUERTO}  (solo este ordenador)`);
console.log(`  Leyendo     ${RAIZ_POR_DEFECTO}`);
console.log(`\n  Abre la web, entra como administrador y ve a Sesiones.`);
console.log(`  Ctrl+C para cerrar la puerta.\n`);
