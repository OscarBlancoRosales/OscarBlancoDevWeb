/**
 * Lo que se dicen tu web y tu sesión de Claude Code.
 *
 * Aquí no hay ni MCP ni HTTP a propósito: solo las reglas. Quien empuja los
 * mensajes hacia la sesión y quien manda los veredictos entran por el
 * constructor, así que esto se puede leer entero y probar sin levantar nada.
 */

/** Una conversación larga no puede crecer sin fin en la memoria del agente. */
const RECUERDO = 200;

export interface Mensaje {
  readonly de: 'yo' | 'claude';
  readonly texto: string;
  readonly cuando: number;
}

/**
 * Un permiso que Claude pide para usar una herramienta.
 *
 * El `id` lo emite Claude Code: cinco letras pensadas para teclearse en un
 * móvil sin confundir una ele con un uno. Solo se aceptan veredictos que lo
 * lleven, y solo mientras siga abierto.
 */
export interface Permiso {
  readonly id: string;
  readonly herramienta: string;
  readonly descripcion: string;
  readonly detalle: string;
  readonly cuando: number;
}

export type Veredicto = 'allow' | 'deny';

export class Buzon {
  private mensajes: Mensaje[] = [];
  private abiertos = new Map<string, Permiso>();

  constructor(
    private readonly empujar: (texto: string) => void,
    private readonly contestar: (id: string, veredicto: Veredicto) => void = () => undefined,
    private readonly ahora: () => number = Date.now,
  ) {}

  /** Lo que le dices a Claude desde la web. */
  escribir(texto: string): void {
    const limpio = texto.trim();
    if (!limpio) return;
    this.apuntar({ de: 'yo', texto: limpio, cuando: this.ahora() });
    this.empujar(limpio);
  }

  /** Lo que Claude contesta por el canal. */
  responder(texto: string): void {
    const limpio = texto.trim();
    if (!limpio) return;
    this.apuntar({ de: 'claude', texto: limpio, cuando: this.ahora() });
  }

  private apuntar(mensaje: Mensaje): void {
    this.mensajes = [...this.mensajes, mensaje].slice(-RECUERDO);
  }

  conversacion(): readonly Mensaje[] {
    return this.mensajes;
  }

  pedirPermiso(peticion: Omit<Permiso, 'cuando'>): void {
    this.abiertos.set(peticion.id, { ...peticion, cuando: this.ahora() });
  }

  pendientes(): readonly Permiso[] {
    return [...this.abiertos.values()];
  }

  /**
   * Contesta a un permiso. Devuelve si valía.
   *
   * Un «sí» que no lleve un identificador abierto no autoriza nada: es la
   * misma regla que aplica Claude Code al otro lado, y aquí evita que una
   * pestaña vieja conteste a algo que ya pasó.
   */
  decidir(id: string, veredicto: Veredicto): boolean {
    if (!this.abiertos.has(id)) return false;
    this.abiertos.delete(id);
    this.contestar(id, veredicto);
    return true;
  }

  /** Lo contestaron en el ordenador: aquí ya no hay nada que decidir. */
  retirar(id: string): void {
    this.abiertos.delete(id);
  }
}
