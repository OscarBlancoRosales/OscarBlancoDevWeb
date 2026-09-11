import { Injectable } from '@angular/core';
import type { ListaDeSesiones, Sesion } from '@devweb/shared/contracts/sesiones';

/** Donde escucha el agente en tu máquina. No sale de aquí. */
const AGENTE = 'http://127.0.0.1:4319';

/**
 * Habla con el agente que corre en tu ordenador.
 *
 * No pasa por la API de la VPS a propósito: tus sesiones de Claude Code no
 * salen de tu máquina. El navegador las pide directamente a `127.0.0.1`, así
 * que si el agente no está arrancado no hay nada que leer — y eso es la
 * función, no un defecto: la puerta existe mientras tú la abres.
 *
 * Por lo mismo no hay `credentials`: no hay sesión que robar aquí.
 */
@Injectable({ providedIn: 'root' })
export class AgenteApiService {
  /** Si el agente está escuchando. Sin él, la pantalla explica cómo abrirlo. */
  async disponible(): Promise<boolean> {
    try {
      const respuesta = await fetch(`${AGENTE}/salud`, { signal: AbortSignal.timeout(2500) });
      return respuesta.ok;
    } catch {
      return false;
    }
  }

  async sesiones(): Promise<ListaDeSesiones['sesiones']> {
    const respuesta = await fetch(`${AGENTE}/sesiones`, { signal: AbortSignal.timeout(30_000) });
    if (!respuesta.ok) throw new Error('El agente no ha podido leer las sesiones.');
    return ((await respuesta.json()) as ListaDeSesiones).sesiones;
  }

  async sesion(id: string, desde = 0, cuantas = 60): Promise<Sesion> {
    const respuesta = await fetch(
      `${AGENTE}/sesiones/${encodeURIComponent(id)}?desde=${desde}&cuantas=${cuantas}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!respuesta.ok) throw new Error('Esa sesión no se ha podido abrir.');
    return (await respuesta.json()) as Sesion;
  }
}
