import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Quién puede hablarle a tu sesión.
 *
 * Emparejar es la única frontera entre «mi web» y «cualquiera que consiga mi
 * cookie»: el código sale por TU terminal, así que hay que estar delante del
 * ordenador una vez. Después ese dispositivo entra siempre —que es de lo que
 * iba todo esto— y se le puede echar cuando haga falta.
 *
 * El token se guarda hasheado, como una contraseña. Si alguien se lleva el
 * fichero no se lleva las llaves: se lleva la lista de cerraduras.
 */

/** Cinco minutos de pie en el terminal son de sobra para teclear seis cifras. */
const VIDA_DEL_CODIGO_MS = 5 * 60 * 1000;

export interface Dispositivo {
  readonly id: string;
  readonly nombre: string;
  readonly desde: number;
  readonly hash: string;
}

interface Fichero {
  dispositivos: Dispositivo[];
}

const hashear = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Comparación en tiempo constante: el tiempo de respuesta no cuenta nada. */
function iguales(a: string, b: string): boolean {
  const uno = Buffer.from(a);
  const otro = Buffer.from(b);
  return uno.length === otro.length && timingSafeEqual(uno, otro);
}

export class Acceso {
  private lista: Dispositivo[] = [];
  private pendiente: { codigo: string; nombre: string; caduca: number } | null = null;

  constructor(
    private readonly fichero: string,
    private readonly ahora: () => number = Date.now,
  ) {}

  async cargar(): Promise<void> {
    try {
      const crudo = await readFile(this.fichero, 'utf8');
      const leido = JSON.parse(crudo) as Partial<Fichero>;
      this.lista = Array.isArray(leido.dispositivos) ? leido.dispositivos : [];
    } catch {
      // No haberlo es lo normal la primera vez; ilegible se trata igual, porque
      // la alternativa sería no arrancar por un fichero que podemos rehacer.
      this.lista = [];
    }
  }

  private async guardar(): Promise<void> {
    await mkdir(dirname(this.fichero), { recursive: true });
    await writeFile(this.fichero, JSON.stringify({ dispositivos: this.lista }, null, 2), 'utf8');
  }

  dispositivos(): readonly Dispositivo[] {
    return this.lista;
  }

  /**
   * Empieza un emparejamiento y devuelve el código que hay que teclear.
   *
   * Seis dígitos y no letras: se leen de un terminal y se escriben en un móvil
   * sin confundir ninguno con otro.
   */
  empezarEmparejamiento(nombre: string): string {
    const codigo = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
    this.pendiente = {
      codigo,
      nombre: nombre.trim().slice(0, 40) || 'un dispositivo',
      caduca: this.ahora() + VIDA_DEL_CODIGO_MS,
    };
    return codigo;
  }

  /** Cambia el código por el token del dispositivo. Un código, una vez. */
  async emparejar(codigo: string): Promise<string | null> {
    const pendiente = this.pendiente;
    if (!pendiente) return null;
    if (this.ahora() > pendiente.caduca) {
      this.pendiente = null;
      return null;
    }
    if (!iguales(codigo, pendiente.codigo)) return null;

    this.pendiente = null;
    const token = randomBytes(32).toString('base64url');
    this.lista = [
      ...this.lista,
      {
        id: randomBytes(8).toString('hex'),
        nombre: pendiente.nombre,
        desde: this.ahora(),
        hash: hashear(token),
      },
    ];
    await this.guardar();
    return token;
  }

  /** Si este token es de alguno de los dispositivos que dejaste entrar. */
  reconoce(token: string): boolean {
    if (!token) return false;
    const hash = hashear(token);
    return this.lista.some((dispositivo) => iguales(dispositivo.hash, hash));
  }

  async olvidar(id: string): Promise<void> {
    this.lista = this.lista.filter((dispositivo) => dispositivo.id !== id);
    await this.guardar();
  }
}
