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
 * Un secreto en `localStorage` lo lee cualquier script que se cuele en la
 * página, y esta llave abre el canal de tu máquina. Merece decir por qué se
 * guarda aquí de todos modos:
 *
 * - Solo sirve desde ESTE navegador contra `127.0.0.1`. Robada y llevada a
 *   otro sitio no abre nada: al otro lado no hay ningún agente escuchando.
 * - Quien pudiera robarla ya está ejecutando código en esta página, que está
 *   emparejada: podría usar el canal directamente sin molestarse en copiarla.
 *   Guardarla en otro sitio no cambiaría ese escenario.
 * - La alternativa —no guardarla— obliga a emparejar en cada visita, que es
 *   exactamente lo que se pidió evitar.
 *
 * Lo que sí queda pendiente por esto: poder ver los aparatos emparejados y
 * echarlos desde la consola. El agente ya lo sirve en `/dispositivos`.
 */
const LLAVE = 'devweb_canal_token';

/** Donde escucha el agente en tu máquina. No sale de aquí. */
const AGENTE = 'http://127.0.0.1:4319';

/**
 * Dónde buscar el agente, si no es en este mismo ordenador.
 *
 * Por defecto `127.0.0.1`, que es lo que hace que esto sea seguro sin más
 * discusión: no hay nada expuesto. Desde el móvil, en cambio, `127.0.0.1` es
 * el propio móvil, así que hay que decirle por dónde llegar al PC — por una
 * red privada tipo Tailscale, con su nombre en HTTPS.
 *
 * Se guarda por navegador porque es una decisión de este aparato: el del
 * escritorio sigue hablando con su propia máquina.
 */
const DONDE = 'devweb_agente_url';

function baseGuardada(): string {
  try {
    return localStorage.getItem(DONDE) ?? '';
  } catch {
    return '';
  }
}

/**
 * Los puertos donde puede haber un canal.
 *
 * Hay uno por sesión de Claude Code abierta, así que con dos repositorios en
 * marcha hay dos: cada uno coge el primer hueco libre y aquí se recorren todos
 * para saber a cuáles se puede escribir.
 */
const PUERTOS = [4319, 4320, 4321, 4322, 4323];

export interface CanalVivo {
  puerto: number;
  proyecto: string;
}

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

  /**
   * Qué sesiones están escuchando ahora mismo, y de qué repositorio son.
   *
   * Se prueban todos los puertos a la vez: son cinco peticiones a tu propia
   * máquina, y las que no contestan fallan en milisegundos.
   */
  async canales(): Promise<CanalVivo[]> {
    // Con una dirección puesta a mano hay un solo sitio al que preguntar.
    const guardada = baseGuardada();
    const sitios = guardada
      ? [{ url: guardada, puerto: 0 }]
      : PUERTOS.map((puerto) => ({ url: `http://127.0.0.1:${puerto}`, puerto }));

    const encontrados = await Promise.all(
      sitios.map(async ({ url, puerto }) => {
        try {
          const respuesta = await fetch(`${url}/salud`, {
            signal: AbortSignal.timeout(4000),
          });
          if (!respuesta.ok) return null;
          const salud = (await respuesta.json()) as { canal?: boolean; proyecto?: string };
          if (salud.canal !== true) return null;
          return { puerto, proyecto: salud.proyecto ?? `puerto ${puerto}` };
        } catch {
          return null;
        }
      }),
    );
    return encontrados.filter((canal): canal is CanalVivo => canal !== null);
  }

  /** A cuál de las sesiones se le está hablando. */
  private elegido = baseGuardada() || AGENTE;

  hablarCon(puerto: number): void {
    const guardada = baseGuardada();
    // Con una dirección puesta a mano se respeta tal cual: al otro lado hay un
    // solo canal publicado, no cinco puertos que recorrer.
    this.elegido = guardada || `http://127.0.0.1:${puerto}`;
  }

  /** Dónde está el agente para ESTE aparato. Vacío significa «aquí mismo». */
  get donde(): string {
    return baseGuardada();
  }

  set donde(url: string) {
    const limpia = url.trim().replace(/\/$/, '');
    try {
      if (limpia) localStorage.setItem(DONDE, limpia);
      else localStorage.removeItem(DONDE);
    } catch {
      // Sin almacenamiento se queda con el de siempre.
    }
    this.elegido = limpia || AGENTE;
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
    const respuesta = await fetch(`${this.elegido}/conversacion`, {
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
    const respuesta = await fetch(`${this.elegido}${ruta}`, {
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

  /** `desde` negativo trae el final, que es por donde se abre una sesión. */
  async sesion(id: string, desde = -1, cuantas = 60): Promise<Sesion> {
    const respuesta = await fetch(
      `${AGENTE}/sesiones/${encodeURIComponent(id)}?desde=${desde}&cuantas=${cuantas}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!respuesta.ok) throw new Error('Esa sesión no se ha podido abrir.');
    return (await respuesta.json()) as Sesion;
  }
}
