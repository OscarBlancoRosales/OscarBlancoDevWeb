import { arrancarCanal } from './canal';

/**
 * El punto de entrada del canal. Lo lanza Claude Code, no tú.
 *
 * Se registra en `.mcp.json` y se arranca con:
 *   claude --dangerously-load-development-channels server:devweb
 */
await arrancarCanal();
