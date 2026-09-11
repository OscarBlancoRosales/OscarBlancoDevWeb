import * as THREE from 'three';
import { ACERCAMIENTO, CAMARA_EN_REPOSO, RESOLUCION_MAXIMA, sitioDe } from './escenario';
import type { Cuadro, EnElEscenario } from './escenario';

/** Lo que tarda la cámara en llegar a donde va. Cuanto más bajo, más perezosa. */
const PEREZA = 0.055;

/** Cuánto sube un atril al acertar, y cuánto se hunde al fallar. */
const SALTO = 0.35;
const HUNDIDO = -0.22;

/**
 * El plató, montado.
 *
 * Un suelo que refleja, una pared curva al fondo con su franja de LEDs, cuatro
 * focos que barren y un atril por concursante con su cara como cartela.
 *
 * Todo lo que se mueve se mueve **hacia** un objetivo, nunca de golpe: la
 * cámara, la altura de cada atril, el color de las luces. Por eso no hay
 * animaciones declaradas en ningún sitio y sin embargo todo va suave — basta
 * con cambiar el objetivo y el bucle se encarga.
 */
export class Diorama {
  private readonly escena = new THREE.Scene();
  private readonly camara: THREE.PerspectiveCamera;
  private readonly pintor: THREE.WebGLRenderer;

  private readonly focos: THREE.SpotLight[] = [];
  private readonly pared: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly atriles = new Map<string, Atril>();
  private readonly cargador = new THREE.TextureLoader();

  /**
   * Lo que hay reservado en la tarjeta gráfica.
   *
   * Se lleva la cuenta a mano en vez de recorrer la escena al soltar: recorrer
   * obliga a tratar cada cosa como `any` -los tipos de Three no concretan al
   * atravesar- y así, además, suelto exactamente lo que he pedido yo.
   */
  private readonly reservado: { dispose(): void }[] = [];

  /** A dónde quiere ir la cámara. El bucle la acerca poco a poco. */
  private acercamiento = 1;
  private bucle = 0;
  private arrancoEn = 0;
  private tono = new THREE.Color('rgb(250, 204, 21)');

  constructor(private readonly lienzo: HTMLCanvasElement) {
    this.pintor = new THREE.WebGLRenderer({
      canvas: lienzo,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.pintor.setPixelRatio(Math.min(window.devicePixelRatio, RESOLUCION_MAXIMA));

    this.camara = new THREE.PerspectiveCamera(46, 1, 0.1, 60);
    this.camara.position.set(CAMARA_EN_REPOSO.x, CAMARA_EN_REPOSO.y, CAMARA_EN_REPOSO.z);
    this.camara.lookAt(0, 1.1, 0);

    this.escena.fog = new THREE.FogExp2(0x0a0620, 0.045);
    this.pared = this.montarEscenario();
    this.montarFocos();
    this.redimensionar();
  }

  /** Arranca el bucle. Nada se mueve hasta que se llama a esto. */
  arrancar(): void {
    if (this.bucle) return;
    this.arrancoEn = performance.now();
    const paso = (): void => {
      this.bucle = requestAnimationFrame(paso);
      this.avanzar();
    };
    this.bucle = requestAnimationFrame(paso);
  }

  parar(): void {
    cancelAnimationFrame(this.bucle);
    this.bucle = 0;
  }

  /**
   * Suelta todo lo que la tarjeta gráfica tiene reservado.
   *
   * Sin esto, entrar y salir de veinte partidas deja veinte platós en memoria:
   * el recolector de basura de JavaScript no sabe nada de la GPU.
   */
  soltar(): void {
    this.parar();
    for (const cosa of this.reservado) cosa.dispose();
    this.reservado.length = 0;
    this.pintor.dispose();
  }

  /** Apunta lo que hay que soltar después, y lo devuelve tal cual. */
  private anotar<T extends { dispose(): void }>(cosa: T): T {
    this.reservado.push(cosa);
    return cosa;
  }

  redimensionar(): void {
    const ancho = this.lienzo.clientWidth || 1;
    const alto = this.lienzo.clientHeight || 1;
    this.pintor.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  /** Lo que hay que enseñar. Se puede llamar tan a menudo como se quiera. */
  mostrar(cuadro: Cuadro): void {
    this.tono = new THREE.Color(`rgb(${cuadro.tono.replaceAll(' ', ', ')})`);
    this.acercamiento = cuadro.golpe ? ACERCAMIENTO[cuadro.golpe] : 1;
    this.repartirAtriles(cuadro.puestos);
  }

  // --- El decorado -------------------------------------------------------

  private montarEscenario(): THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> {
    // El suelo. Oscuro y algo brillante: refleja las luces sin ser un espejo,
    // que un espejo perfecto delata que no hay nada más en la sala.
    const suelo = new THREE.Mesh(
      this.anotar(new THREE.PlaneGeometry(40, 40)),
      this.anotar(
        new THREE.MeshStandardMaterial({ color: 0x120a26, roughness: 0.35, metalness: 0.7 }),
      ),
    );
    suelo.rotation.x = -Math.PI / 2;
    this.escena.add(suelo);

    // La pared curva del fondo, que es lo que convierte un vacío negro en un
    // sitio. Va por dentro, así que se le da la vuelta a las caras.
    const pared = new THREE.Mesh(
      this.anotar(new THREE.CylinderGeometry(13, 13, 9, 48, 1, true, -0.95, 1.9)),
      this.anotar(
        new THREE.MeshStandardMaterial({ color: 0x1b1040, roughness: 0.9, side: THREE.BackSide }),
      ),
    );
    pared.position.set(0, 4.5, -2);
    this.escena.add(pared);

    // Una franja de luz a media altura, del color de la prueba.
    const franja = new THREE.Mesh(
      this.anotar(new THREE.CylinderGeometry(12.6, 12.6, 0.28, 48, 1, true, -0.95, 1.9)),
      this.anotar(new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.BackSide })),
    );
    franja.position.set(0, 3.1, -2);
    this.escena.add(franja);

    this.escena.add(new THREE.AmbientLight(0x5b3fa8, 0.55));
    return franja;
  }

  private montarFocos(): void {
    for (let i = 0; i < 4; i += 1) {
      const foco = new THREE.SpotLight(0xffffff, 90, 26, 0.22, 0.7, 1.4);
      foco.position.set(-4.5 + i * 3, 7.5, 2.2);
      foco.target.position.set(-3 + i * 2, 0, -1);
      this.escena.add(foco, foco.target);
      this.focos.push(foco);
    }
  }

  // --- Los concursantes --------------------------------------------------

  private repartirAtriles(puestos: readonly EnElEscenario[]): void {
    const vistos = new Set<string>();

    for (const [i, puesto] of puestos.entries()) {
      vistos.add(puesto.seatId);
      const atril = this.atriles.get(puesto.seatId) ?? this.montarAtril(puesto);
      atril.grupo.position.x = sitioDe(i, puestos.length);
      atril.estado = puesto;
    }

    // Quien se va de la mesa, se va del escenario.
    for (const [id, atril] of this.atriles) {
      if (vistos.has(id)) continue;
      this.escena.remove(atril.grupo);
      this.atriles.delete(id);
    }
  }

  private montarAtril(puesto: EnElEscenario): Atril {
    const grupo = new THREE.Group();

    const cajon = new THREE.Mesh(
      this.anotar(new THREE.BoxGeometry(1.25, 1.05, 0.72)),
      this.anotar(
        new THREE.MeshStandardMaterial({ color: 0x241452, roughness: 0.45, metalness: 0.35 }),
      ),
    );
    cajon.position.y = 0.52;
    grupo.add(cajon);

    // El frontal iluminado del atril: es lo que se tiñe al contestar.
    const frontal = new THREE.Mesh(
      this.anotar(new THREE.PlaneGeometry(1.1, 0.32)),
      this.anotar(new THREE.MeshBasicMaterial({ color: 0x3b2a6b })),
    );
    frontal.position.set(0, 0.5, 0.37);
    grupo.add(frontal);

    // Y la cartela con la cara, que es el truco del diorama: una foto de pie
    // sobre el atril, siempre mirando a cámara.
    const cartela = new THREE.Mesh(
      this.anotar(new THREE.PlaneGeometry(1.05, 1.05)),
      this.anotar(new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })),
    );
    cartela.position.y = 1.62;
    grupo.add(cartela);

    this.cargador.load(puesto.foto, (textura) => {
      this.anotar(textura);
      textura.colorSpace = THREE.SRGBColorSpace;
      cartela.material.map = textura;
      cartela.material.needsUpdate = true;
    });

    this.escena.add(grupo);
    const atril: Atril = { grupo, frontal, cartela, estado: puesto, altura: 0 };
    this.atriles.set(puesto.seatId, atril);
    return atril;
  }

  // --- El bucle ----------------------------------------------------------

  private avanzar(): void {
    const t = (performance.now() - this.arrancoEn) / 1000;

    // La cámara respira: deriva lenta en reposo, y se acerca en los golpes.
    const objetivo = new THREE.Vector3(
      CAMARA_EN_REPOSO.x + Math.sin(t * 0.18) * 0.55,
      CAMARA_EN_REPOSO.y + Math.sin(t * 0.13) * 0.18,
      CAMARA_EN_REPOSO.z * this.acercamiento,
    );
    this.camara.position.lerp(objetivo, PEREZA);
    this.camara.lookAt(0, 1.2, 0);

    // Los focos barren, y se tiñen del color de la prueba.
    for (const [i, foco] of this.focos.entries()) {
      const vaiven = Math.sin(t * 0.42 + i * 1.7);
      foco.target.position.x = -3 + i * 2 + vaiven * 2.4;
      foco.target.updateMatrixWorld();
      foco.color.lerp(i % 2 === 0 ? this.tono : new THREE.Color(0xffffff), 0.02);
    }
    this.pared.material.color.lerp(this.tono, 0.03);

    for (const atril of this.atriles.values()) this.moverAtril(atril, t);

    this.pintor.render(this.escena, this.camara);
  }

  /**
   * Cómo reacciona un atril a lo que le pasa a su dueño.
   *
   * Sube al acertar, se hunde al fallar y tiembla con la bomba. La altura se
   * persigue en vez de asignarse, así que el rebote sale solo.
   */
  private moverAtril(atril: Atril, t: number): void {
    const { estado } = atril;
    const quiere = estado.acierta ? SALTO : estado.falla ? HUNDIDO : 0;
    atril.altura += (quiere - atril.altura) * 0.12;

    const tembleque = estado.tiembla ? Math.sin(t * 34) * 0.035 : 0;
    atril.grupo.position.y = atril.altura;
    atril.grupo.position.z = tembleque;

    const frontal = atril.frontal;
    const color = estado.acierta
      ? new THREE.Color(0x22c55e)
      : estado.falla
        ? new THREE.Color(0x7f1d1d)
        : estado.atento
          ? this.tono
          : new THREE.Color(0x3b2a6b);
    frontal.material.color.lerp(color, 0.14);

    // La cartela siempre de cara: es una foto, y de perfil no es nada.
    atril.cartela.quaternion.copy(this.camara.quaternion);
  }
}

/** Un atril montado, con lo que hace falta para moverlo. */
interface Atril {
  readonly grupo: THREE.Group;
  readonly frontal: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly cartela: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  estado: EnElEscenario;
  altura: number;
}
