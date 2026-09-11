/**
 * Encuadra los retratos de la mesa de poker.
 *
 * El problema que resuelve: las leyendas se dibujaron una a una y salieron con
 * ocho proporciones distintas -de 384x256 a 384x576- y con la cara a distinto
 * tamaño en cada una. En un hueco cuadrado eso se traduce en que a unos se les
 * corta el pelo y otros salen flotando con medio cuerpo. No es culpa del dibujo:
 * es que nadie los encuadró.
 *
 * Lo que hace: busca la banda de la cabeza -las filas de arriba donde la figura
 * todavía es estrecha, antes de que se abran los hombros-, y reescala y centra
 * cada retrato para que esa banda ocupe siempre la misma fracción de un lienzo
 * cuadrado. El resultado es que todas las caras salen del mismo tamaño y a la
 * misma altura, que es lo único que hace falta para que una fila de avatares se
 * vea ordenada.
 *
 * Se puede volver a pasar sobre la carpeta sin miedo: cada retrato encuadrado se
 * queda marcado por dentro y la segunda pasada lo salta. La marca hace falta
 * porque tres de ellos llevan el encuadre escrito a mano en fracciones del
 * dibujo original, y volver a aplicárselas al resultado los acercaría otra vez.
 *
 *   node tools/encuadrar-avatares.mjs apps/web/public/assets/poker/legends
 *   node tools/encuadrar-avatares.mjs <carpeta> --contacto hoja.png
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * El trabajo de verdad lo hace Pillow.
 *
 * Va en Python y no en JavaScript porque manipular píxeles con canal alfa en
 * Node pide una dependencia nativa -sharp- que este repositorio no tiene, y
 * meterla para pasar dieciséis PNG una vez sería pagar un peaje permanente por
 * un viaje de ida.
 */
const GUION = String.raw`
import sys, os, glob
from PIL import Image
from PIL.PngImagePlugin import PngInfo

# La marca que se deja dentro del PNG para no volver a encuadrarlo.
MARCA = 'devweb-encuadrado'

CARPETA = sys.argv[1]
CONTACTO = sys.argv[2] if len(sys.argv) > 2 else None

LADO = 512
# Cuánto del alto ocupa la cabeza. Medido a ojo sobre los que ya estaban bien
# encuadrados: por debajo de 0.5 la cara se pierde en un avatar de 64 px, y por
# encima de 0.7 el pelo toca el borde del círculo.
CABEZA = 0.60
# Dónde empieza la cabeza. Un respiro arriba para que el pelo no roce el marco.
ARRIBA = 0.07
# Por debajo de esto un píxel es fondo, no dibujo.
OPACO = 24

# Una cabeza que sale midiendo menos de esto o más de esto no es una cabeza: es
# que el detector se ha comido otra cosa. Sirve de alarma, no de ajuste.
CABEZA_MINIMA = 0.18
CABEZA_MAXIMA = 0.62

# Los tres retratos que el detector no puede resolver solo, y por qué.
#
# El detector busca dónde se ensancha la figura, que es donde están los hombros.
# Falla en dos situaciones, y las tres excepciones son una de las dos:
#
#   - Hay algo tan ancho como la cabeza a su misma altura. A Turing le dibujaron
#     un fondo magenta que ocupa el lienzo entero, así que la figura es ancha
#     desde la primera fila; a Hamilton la acompaña una pila de listados tan alta
#     como ella.
#   - No hay hombros que encontrar. El dibujo de Guido es un primer plano
#     recortado por el pecho, así que la figura nunca se ensancha.
#
# En los tres casos la cabeza va escrita a mano, en fracciones del lienzo y
# medidas mirando el dibujo.
A_MANO = {
    'turing.png':   {'arriba': 0.06, 'alto': 0.43, 'centro': 0.54},
    'hamilton.png': {'arriba': 0.16, 'alto': 0.33, 'centro': 0.43},
    'guido.png':    {'arriba': 0.05, 'alto': 0.64, 'centro': 0.51},
}


def recuadro(im):
    """El rectángulo que ocupa el dibujo, sin el aire de alrededor."""
    caja = im.split()[3].point(lambda a: 255 if a > OPACO else 0).getbbox()
    return caja or (0, 0, im.width, im.height)


def anchos(im, caja):
    """Cuánto mide la figura en cada fila, de arriba abajo."""
    alfa = im.split()[3]
    izq, arr, der, aba = caja
    medidas = []
    for y in range(arr, aba):
        fila = alfa.crop((izq, y, der, y + 1)).point(lambda a: 255 if a > OPACO else 0)
        trozo = fila.getbbox()
        medidas.append((trozo[2] - trozo[0]) if trozo else 0)
    return medidas


def banda_de_la_cabeza(medidas):
    """
    Hasta dónde llega la cabeza.

    Se mira el ancho fila a fila: la cabeza es estrecha y constante, y al llegar
    a los hombros el dibujo se ensancha de golpe. Se corta en la primera fila que
    pasa de las tres cuartas partes del ancho máximo, que es donde empiezan los
    hombros en todos estos retratos.
    """
    if not medidas:
        return 0
    tope = max(medidas) * 0.75
    # Se salta el arranque: las primeras filas son cuatro pelos y no cuentan.
    arranque = max(1, len(medidas) // 12)
    for y in range(arranque, len(medidas)):
        if medidas[y] > tope:
            return y
    return len(medidas)


def centro_de_la_cabeza(im, caja, alto_cabeza):
    """El centro horizontal de la cabeza, no el del dibujo entero."""
    izq, arr, der, _ = caja
    cabeza = im.crop((izq, arr, der, arr + max(1, alto_cabeza)))
    trozo = cabeza.split()[3].point(lambda a: 255 if a > OPACO else 0).getbbox()
    if not trozo:
        return (izq + der) / 2
    return izq + (trozo[0] + trozo[2]) / 2


def cabeza_de(im, nombre):
    """Dónde está la cabeza: en píxeles, (arriba, alto, centro_x)."""
    escrita = A_MANO.get(nombre)
    if escrita:
        return (
            escrita['arriba'] * im.height,
            escrita['alto'] * im.height,
            escrita['centro'] * im.width,
        )

    caja = recuadro(im)
    alto = banda_de_la_cabeza(anchos(im, caja))
    if alto <= 0:
        return None

    proporcion = alto / im.height
    if not (CABEZA_MINIMA <= proporcion <= CABEZA_MAXIMA):
        print(f'  !! {nombre}: la cabeza sale al {proporcion:.0%} del alto. Encuádralo a mano.')
        return None

    return (caja[1], alto, centro_de_la_cabeza(im, caja, alto))


def encuadrar(ruta):
    original = Image.open(ruta)
    if original.info.get(MARCA):
        return 'ya'
    im = original.convert('RGBA')
    cabeza = cabeza_de(im, os.path.basename(ruta))
    if cabeza is None:
        return None
    arriba, alto_cabeza, centro = cabeza

    escala = (LADO * CABEZA) / alto_cabeza
    nuevo = (max(1, round(im.width * escala)), max(1, round(im.height * escala)))
    # Ampliar de 384 a más de 512 no inventa detalle, pero deja la cara al
    # tamaño de las demás, que es de lo que se trata. Lanczos para que el trazo
    # no se emborrone.
    escalado = im.resize(nuevo, Image.LANCZOS)

    lienzo = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    lienzo.alpha_composite(
        escalado,
        (round(LADO / 2 - centro * escala), round(LADO * ARRIBA - arriba * escala)),
    )
    return lienzo


ficheros = sorted(glob.glob(os.path.join(CARPETA, '*.png')))
hechos = []
for ruta in ficheros:
    salida = encuadrar(ruta)
    nombre = os.path.basename(ruta)

    if salida == 'ya':
        hechos.append((nombre, Image.open(ruta).convert('RGBA')))
        print(f'  {nombre:18} ya estaba encuadrado')
        continue
    if salida is None:
        print('  sin encuadrar:', nombre)
        continue

    sello = PngInfo()
    sello.add_text(MARCA, '1')
    salida.save(ruta, optimize=True, pnginfo=sello)
    hechos.append((nombre, salida))
    print(f'  {nombre:18} -> {LADO}x{LADO}')

if CONTACTO and hechos:
    columnas = 6
    filas = (len(hechos) + columnas - 1) // columnas
    miniatura = 160
    hoja = Image.new('RGBA', (columnas * miniatura, filas * miniatura), (22, 26, 24, 255))
    for i, (_, im) in enumerate(hechos):
        hoja.alpha_composite(
            im.resize((miniatura, miniatura), Image.LANCZOS),
            ((i % columnas) * miniatura, (i // columnas) * miniatura),
        )
    hoja.convert('RGB').save(CONTACTO)
    print('hoja de contacto:', CONTACTO)
`;

const [carpeta, ...resto] = process.argv.slice(2);
if (!carpeta) {
  console.error('Falta la carpeta. Ejemplo: node tools/encuadrar-avatares.mjs ruta/a/legends');
  process.exit(1);
}

const contacto = resto.includes('--contacto') ? resto[resto.indexOf('--contacto') + 1] : '';
const argumentos = ['-c', GUION, carpeta];
if (contacto) argumentos.push(contacto);

console.log('Encuadrando', carpeta);
const salida = spawnSync('python', argumentos, {
  cwd: path.resolve(AQUI, '..'),
  stdio: 'inherit',
  // Sin esto, los avisos con tilde salen rotos en la consola de Windows.
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
process.exit(salida.status ?? 1);
