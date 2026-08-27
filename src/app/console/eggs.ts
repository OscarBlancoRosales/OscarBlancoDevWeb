/**
 * Los premios de la casa: arte ASCII y tonterías con cariño.
 *
 * Todo son funciones puras. Lo que necesita azar recibe los dados de fuera,
 * para que se pueda probar sin cruzar los dedos.
 */

/** La vaca de toda la vida, diciendo lo que le mandes. */
export function cowsay(texto: string): string[] {
  const frase = texto.trim() || 'muuu';
  const ancho = frase.length;
  return [
    ' ' + '_'.repeat(ancho + 2),
    `< ${frase} >`,
    ' ' + '-'.repeat(ancho + 2),
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ];
}

/**
 * Fuente de bloques de 5 filas y 3 columnas. Lo justo para un banner que se
 * lea, sin cargar una tipografía entera.
 */
const GLYPHS: Record<string, string[]> = {
  A: ['███', '█ █', '███', '█ █', '█ █'],
  B: ['██ ', '█ █', '██ ', '█ █', '██ '],
  C: ['███', '█  ', '█  ', '█  ', '███'],
  D: ['██ ', '█ █', '█ █', '█ █', '██ '],
  E: ['███', '█  ', '██ ', '█  ', '███'],
  F: ['███', '█  ', '██ ', '█  ', '█  '],
  G: ['███', '█  ', '█ █', '█ █', '███'],
  H: ['█ █', '█ █', '███', '█ █', '█ █'],
  I: ['███', ' █ ', ' █ ', ' █ ', '███'],
  J: ['███', '  █', '  █', '█ █', '███'],
  K: ['█ █', '█ █', '██ ', '█ █', '█ █'],
  L: ['█  ', '█  ', '█  ', '█  ', '███'],
  M: ['█ █', '███', '███', '█ █', '█ █'],
  N: ['██ ', '█ █', '█ █', '█ █', '█ █'],
  O: ['███', '█ █', '█ █', '█ █', '███'],
  P: ['███', '█ █', '███', '█  ', '█  '],
  Q: ['███', '█ █', '█ █', '███', '  █'],
  R: ['███', '█ █', '██ ', '█ █', '█ █'],
  S: ['███', '█  ', '███', '  █', '███'],
  T: ['███', ' █ ', ' █ ', ' █ ', ' █ '],
  U: ['█ █', '█ █', '█ █', '█ █', '███'],
  V: ['█ █', '█ █', '█ █', '█ █', ' █ '],
  W: ['█ █', '█ █', '███', '███', '█ █'],
  X: ['█ █', '█ █', ' █ ', '█ █', '█ █'],
  Y: ['█ █', '█ █', ' █ ', ' █ ', ' █ '],
  Z: ['███', '  █', ' █ ', '█  ', '███'],
  '0': ['███', '█ █', '█ █', '█ █', '███'],
  '1': [' █ ', '██ ', ' █ ', ' █ ', '███'],
  '2': ['███', '  █', '███', '█  ', '███'],
  '3': ['███', '  █', '███', '  █', '███'],
  '4': ['█ █', '█ █', '███', '  █', '  █'],
  '5': ['███', '█  ', '███', '  █', '███'],
  '6': ['███', '█  ', '███', '█ █', '███'],
  '7': ['███', '  █', '  █', '  █', '  █'],
  '8': ['███', '█ █', '███', '█ █', '███'],
  '9': ['███', '█ █', '███', '  █', '███'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
  '!': [' █ ', ' █ ', ' █ ', '   ', ' █ '],
  '?': ['███', '  █', ' ██', '   ', ' █ '],
  '.': ['   ', '   ', '   ', '   ', ' █ '],
  '-': ['   ', '   ', '███', '   ', '   '],
};

/** Convierte texto en letras de bloque. Lo que no conoce, lo salta. */
export function banner(texto: string): string[] {
  const letras = texto
    .toUpperCase()
    .split('')
    .map((c) => GLYPHS[c])
    .filter(Boolean) as string[][];

  return Array.from({ length: 5 }, (_, fila) =>
    letras.map((glifo) => glifo[fila]).join(' '),
  );
}

const FORTUNES = [
  'Solo hay dos problemas difíciles: invalidar la caché y nombrar las cosas.',
  'Funciona en mi máquina. Pues enviamos tu máquina.',
  'El código que escribiste hace seis meses lo escribió otra persona.',
  'Semanas de programación pueden ahorrarte horas de planificación.',
  'Si depurar es quitar errores, programar es meterlos.',
  'No es un bug, es una feature sin documentar.',
  'El mejor código es el que no hay que escribir.',
  'Un comentario que miente es peor que ningún comentario.',
  'Optimizar antes de medir es adivinar con más pasos.',
  'Cualquiera puede escribir código que entienda una máquina.',
  'Ese TODO lleva ahí desde 2019 y va a seguir.',
  'La prisa de hoy es la deuda técnica de la semana que viene.',
];

/** La misma tirada, la misma frase: para poder probarlo. */
export function fortune(tirada: number): string {
  const i = Math.abs(Math.floor(tirada)) % FORTUNES.length;
  return FORTUNES[i];
}

const PROCESOS = [
  ['cafe.exe', 'Combustible principal'],
  ['bugs.dll', 'Se reproducen solos'],
  ['stackoverflow.sys', 'Servicio esencial'],
  ['sindrome_impostor', 'En segundo plano'],
  ['deadline.tmp', 'A punto de expirar'],
  ['reunion_que_podia_ser_email', 'Bloqueando'],
  ['refactor_pendiente', 'Suspendido desde 2019'],
  ['tests.exe', 'Verde, de momento'],
];

/** El `top` de mentira: procesos con los que cualquiera se identifica. */
export function fakeTop(rng: () => number): string[] {
  const filas = ['  PID  PROCESO                        CPU%   ESTADO'];
  PROCESOS.forEach(([nombre, estado], i) => {
    const cpu = (rng() * 90 + 5).toFixed(1);
    const pid = String(1000 + i * 137).padStart(5, ' ');
    filas.push(`${pid}  ${nombre.padEnd(30, ' ')}${(cpu + '%').padStart(6, ' ')}  ${estado}`);
  });
  return filas;
}

/** El acceso al mainframe, que acaba como tiene que acabar. */
export function hackLog(): string[] {
  return [
    '[ OK ] Estableciendo túnel cifrado con 192.168.0.42 ...',
    '[ OK ] Puerto 1337 abierto. Saltando el cortafuegos ...',
    '[ OK ] Descifrando RSA-4096 por fuerza bruta ... 100%',
    '[ OK ] Accediendo a los servidores centrales ...',
    '[ OK ] Descargando la base de datos completa ... 847 TB',
    '[ !! ] ACCESO TOTAL CONCEDIDO',
    'Es broma. Aquí solo hay HTML, CSS y buenas intenciones.',
  ];
}

/** El tren que sale cuando escribes mal `ls`. */
const TRAIN_RAW: string[] = [
  '      ====        ________                ___________ ',
  '  _D _|  |_______/        \\__I_I_____===__|_________| ',
  '   |(_)---  |   H\\________/ |   |        =|___ ___|   ',
  '   /     |  |   H  |  |     |   |         ||_| |_||   ',
  '  |      |  |   H  |__--------------------| [___] |   ',
  '  | ________|___H__/__|_____/[][]~\\_______|       |   ',
  '  |/ |   |-----------I_____I [][] []  D   |=======|__ ',
  "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
  ' |/-=|___|=O=====O=====O=====O   |_____/~\\___/       ',
  '  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/           ',
];

/** Todos los vagones al mismo ancho: si no, al desplazarlo se descuadra. */
export const TRAIN: string[] = (() => {
  const ancho = Math.max(...TRAIN_RAW.map((l) => l.length));
  return TRAIN_RAW.map((l) => l.padEnd(ancho, ' '));
})();

/** Katakana y dígitos: el alfabeto de la lluvia. */
export const MATRIX_ALPHABET =
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
