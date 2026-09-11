import { Injectable } from '@angular/core';
import type { ListaDeSesiones, Sesion } from '@devweb/shared/contracts/sesiones';

/** Lo que se dicen la web y la sesión, más lo que Claude está esperando. */
export interface Conversacion {
  mensajes: { de: 'yo' | 'claude'; texto: string; cuando: number }[];
  permisos: { id: string; herramienta: string; descripcion: string; detalle: string }[];
}

/**
 * Dónde se guarda la llave de este dispositivo.
 *
 * Es un secreto de ESTE navegador y solo abre `127.0.0.1`: con él no se llega
 * a la VPS ni a nada publicado. Se guarda para no tener que emparejar cada vez,
 * que era justo lo que se pedía.
 */
const LLAVE = 'devweb_canal_token';

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
  /** Si el agente está escuchando, y si además trae canal para escribir. */
  async estado(): Promise<{ vivo: boolean; canal: boolean }> {
    try {
      const respuesta = await fetch(`${AGENTE}/salud`, { signal: AbortSignal.timeout(2500) });
      if (!respuesta.ok) return { vivo: false, canal: false };
      const salud = (await respuesta.json()) as { canal?: boolean };
      return { vivo: true, canal: salud.canal === true };
    } catch {
      return { vivo: false, canal: false };
    }
  }

  async disponible(): Promise<boolean> {
    return (await this.estado()).vivo;
  }

  async sesiones(): Promise<ListaDeSesiones['sesiones']> {
    const respuesta = await fetch(`${AGENTE}/sesiones`, { signal: AbortSignal.timeout(30_000) });
    if (!respuesta.ok) throw new Error('El agente no ha podido leer las sesiones.');
    return ((await respuesta.json()) as ListaDeSesiones).sesiones;
  }

  /** La llave de este dispositivo, si ya se emparejó alguna vez. */
  get token(): string {
    try {
      return localStorage.getItem(LLAVE) ?? '';
    } catch {
      return '';
    }
  }

  private set token(valor: string) {
    try {
      if (valor) localStorage.setItem(LLAVE, valor);
      else localStorage.removeItem(LLAVE);
    } catch {
      // Sin almacenamiento habrá que emparejar cada vez. Molesta, no rompe.
    }
  }

  get emparejado(): boolean {
    return this.token !== '';
  }

  /** Pide un código. Sale por el terminal del canal, no por aquí. */
  async pedirCodigo(nombre: string): Promise<void> {
    await this.mandar('/emparejar/empezar', { nombre });
  }

  /** Cambia el código por la llave de este dispositivo. */
  async emparejar(codigo: string): Promise<void> {
    const { token } = await this.mandar<{ token: string }>('/emparejar', { codigo });
    this.token = token;
  }

  olvidarEsteDispositivo(): void {
    this.token = '';
  }

  async escribir(texto: string): Promise<void> {
    await this.mandar('/mensaje', { texto });
  }

  async conversacion(): Promise<Conversacion> {
    const respuesta = await fetch(`${AGENTE}/conversacion`, {
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) throw new Error('Este aparato ya no está emparejado.');
    return (await respuesta.json()) as Conversacion;
  }

  async decidir(id: string, veredicto: 'allow' | 'deny'): Promise<void> {
    await this.mandar(`/permisos/${encodeURIComponent(id)}`, { veredicto });
  }

  private async mandar<T = unknown>(ruta: string, cuerpo: unknown): Promise<T> {
    const respuesta = await fetch(`${AGENTE}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    });
    if (!respuesta.ok) {
      const fallo = (await respuesta.json().catch(() => ({}))) as { message?: string };
      throw new Error(fallo.message ?? 'El agente no ha podido con eso.');
    }
    return (await respuesta.json()) as T;
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
