/**
 * Comprueba las reglas de seguridad de la base de datos.
 *
 * No sustituye a desplegarlas ni al emulador: verifica que el JSON del documento
 * y el del fichero no se hayan separado, y que sigan en pie los invariantes que
 * de verdad protegen una partida. Si alguien afloja una regla sin querer, esto
 * salta.
 *
 *   npm run check:rules
 *
 * ### Por qué se comprueba a sí mismo
 *
 * Un guardián que no puede fallar no guarda nada. Una errata en la ruta de una
 * propiedad —`riskRoms`, `.wirte`— convierte una comprobación en un `undefined`
 * que pasa de largo, y desde fuera se ve exactamente igual que "todo en orden".
 * Por eso antes de mirar las reglas de verdad, `selfTest` estropea a propósito
 * una copia de cada cosa que se vigila y exige que salte la alarma. Si alguna no
 * salta, el fichero se para y lo dice.
 */
import { readFileSync } from 'node:fs';

/** Nodos de la base que usan otras secciones y no se pueden quedar sin reglas. */
const REQUIRED_NODES = ['rooms', 'throwdown-timer'];

/**
 * Todas las comprobaciones, como función pura, para poder probarlas.
 *
 * @param {any} rules contenido de database.rules.json
 * @param {string} doc contenido de docs/risk.md
 * @returns {{problems: string[], warnings: string[]}}
 */
export function checkRules(rules, doc) {
  const problems = [];
  const warnings = [];
  const risk = rules?.rules?.riskRooms?.$roomId;
  const need = (condition, message) => {
    if (!condition) problems.push(message);
  };
  /**
   * ¿Contiene esa regla ese texto?
   *
   * Hace falta porque una regla puede ser `true` en vez de una cadena, y llamar
   * a `.includes` sobre un booleano revienta el comprobante en vez de avisar.
   * Lo descubrió el propio auto-test la primera vez que se ejecutó.
   */
  const has = (rule, needle) => typeof rule === 'string' && rule.includes(needle);

  // 1. El documento y el fichero tienen que decir lo mismo.
  if (typeof doc === 'string') {
    const start = doc.indexOf('```json', doc.indexOf('## 3. Reglas de seguridad'));
    const end = doc.indexOf('```', start + 7);
    need(start !== -1 && end !== -1, 'No encuentro el bloque JSON en docs/risk.md');
    if (start !== -1 && end !== -1) {
      let inDoc = null;
      try {
        inDoc = JSON.parse(doc.slice(start + 7, end));
      } catch {
        need(false, 'El bloque JSON del documento no es JSON válido');
      }
      if (inDoc) {
        need(
          JSON.stringify(inDoc) === JSON.stringify(rules),
          'Las reglas del documento y las del fichero se han separado',
        );
      }
    }
  }

  // 2. El log es la grabación de la partida: solo se puede AÑADIR.
  need(
    has(risk?.log?.$entry?.['.write'], '!data.exists()'),
    'El log tiene que ser de solo-añadir: nadie puede reescribir una jugada ya hecha',
  );
  need(
    has(risk?.chat?.$message?.['.write'], '!data.exists()'),
    'El chat tiene que ser de solo-añadir',
  );

  // 3. La identidad de la sala no puede cambiar a mitad de partida: cambiar la
  //    semilla o el mapa desincronizaría a todos los clientes a la vez.
  for (const field of ['seed', 'mapId', 'createdAt', 'ownerUid']) {
    need(
      has(risk?.meta?.[field]?.['.validate'], 'data.val() === newData.val()'),
      `meta/${field} tiene que ser inmutable una vez creada la sala`,
    );
  }

  // 4. Borrar una sala no puede estar al alcance de cualquiera.
  const roomWrite = risk?.['.write'] ?? '';
  need(roomWrite !== true && roomWrite !== 'true', 'Cualquiera podría borrar cualquier sala');
  need(
    has(roomWrite, 'auth != null') && has(roomWrite, 'updatedAt'),
    'Borrar una sala debe exigir sesión, o que la sala esté caducada',
  );

  // 5. Y la caducidad no se puede falsificar.
  //
  //    Es la escalada que se coló en la primera versión: si `updatedAt` se puede
  //    escribir libremente, cualquiera envejece una sala viva poniéndole un cero
  //    y acto seguido la borra por caducada. Tiene que avanzar y no irse al
  //    futuro.
  const updated = risk?.meta?.updatedAt?.['.validate'];
  need(
    has(updated, 'newData.val() >= data.val()'),
    'meta/updatedAt no puede retroceder: sería falsificar la caducidad y borrar salas vivas',
  );
  need(has(updated, 'now'), 'meta/updatedAt no puede irse al futuro');

  // 6. Topes de tamaño, para que un bucle no llene la base gratuita.
  need(
    has(risk?.chat?.$message?.['.validate'], 'length <= 600'),
    'El chat necesita un tope de longitud',
  );

  // 7. No se puede LISTAR el nodo de salas. Es el fallo de fondo: con lectura
  //    abierta en el padre, el identificador aleatorio de la sala no protege
  //    nada, porque basta con descargarlas todas.
  const listRead = rules?.rules?.riskRooms?.['.read'] ?? '';
  need(listRead !== true, 'Cualquiera podría listar y leer todas las salas');
  need(
    has(listRead, 'query.equalTo === auth.uid'),
    'Listar salas debe limitarse a la consulta por dueño autenticado',
  );
  need(
    rules?.rules?.riskRooms?.$roomId?.['.read'] === true,
    'Hay que poder leer una sala concreta: el enlace de invitación depende de ello',
  );

  // 8. La alineación se congela al empezar: si se pudiera reescribir, cambiaría
  //    el estado inicial del que cuelga todo el log.
  need(risk?.meta?.roster?.['.write'] === '!data.exists()', 'meta/roster solo se escribe una vez');
  need(
    has(risk?.meta?.['.write'], '!data.exists()'),
    'meta completa solo se puede escribir al crear la sala',
  );
  need(
    has(risk?.seats?.$seatId?.seatToken?.['.validate'], 'data.val() === newData.val()'),
    'El testigo de un asiento no puede cambiar una vez ocupado',
  );

  // 9. Crear una sala exige sesión, y no se escribe en salas que no existen.
  //
  //    Es lo que impide que cualquiera llene la base gratuita: sin lo primero se
  //    crean salas a mansalva, y sin lo segundo se fabrican salas fantasma
  //    metiendo asientos o jugadas en un id inventado (la validación del nodo
  //    padre NO se evalúa al escribir en un hijo).
  need(
    has(risk?.meta?.['.write'], 'auth != null'),
    'Crear una sala tiene que exigir sesión: si no, cualquiera llena la base',
  );
  //    Y ojo con el permiso del nodo de la sala: si concede escritura cuando la
  //    sala NO existe, se lo salta todo, porque en Firebase un permiso concedido
  //    arriba cascadea hacia abajo. Ese `!data.exists()` estuvo publicado y dejó
  //    crear salas sin sesión pese al `auth != null` de `meta`.
  need(
    !has(roomWrite, '!data.exists()'),
    'El permiso del nodo de la sala no puede conceder nada por no existir: ' +
      'cascadea y anula la exigencia de sesión al crear',
  );
  for (const [nombre, rule] of [
    ['seats', risk?.seats?.$seatId?.['.write']],
    ['log', risk?.log?.$entry?.['.write']],
    ['chat', risk?.chat?.$message?.['.write']],
    ['snapshot', risk?.snapshot?.['.write']],
  ]) {
    need(
      has(rule, "child('meta').exists()"),
      `${nombre} deja escribir en salas que no existen: se podrían fabricar salas fantasma`,
    );
  }

  // 10. No borrar las reglas de las otras secciones.
  //
  //    Subir este fichero SUSTITUYE el conjunto entero de la base. La primera
  //    versión se escribió mirando solo al RISK y se habría llevado por delante
  //    `throwdown-timer`, dejando esa página sin escribir su configuración.
  for (const node of REQUIRED_NODES) {
    need(
      rules?.rules?.[node] !== undefined,
      `Falta el nodo \`${node}\`: subir esto dejaría esa sección sin reglas`,
    );
  }

  // 11. Avisos: cosas abiertas que no son del RISK y que conviene no olvidar.
  if (rules?.rules?.rooms?.['.read'] === true || rules?.rules?.rooms?.['.write'] === true) {
    warnings.push(
      'El nodo `rooms` (Scrum Poker) concede lectura o escritura a nivel de nodo, no de ' +
        'sala: cualquiera podría listarlas todas. Debería concederse dentro de `$roomId`.',
    );
  }
  const timer = rules?.rules?.['throwdown-timer']?.configs;
  if (timer?.['.write'] === true) {
    warnings.push(
      'El nodo `throwdown-timer/configs` deja escribir a cualquiera, y no está partido por ' +
        'identificador: quien quiera puede sobrescribir la configuración de esa página. Viene ' +
        'de antes de este fichero y cambiarlo es una decisión sobre esa sección, no sobre el RISK.',
    );
  }

  return { problems, warnings };
}

/**
 * Estropea a propósito lo que se vigila y exige que salte la alarma.
 *
 * Cada caso rompe UNA cosa sobre una copia de las reglas buenas y comprueba que
 * el mensaje esperado aparece. Si una comprobación se convierte en `undefined`
 * por una errata, aquí se nota.
 */
function selfTest(good, doc) {
  const clone = () => JSON.parse(JSON.stringify(good));
  const casos = [
    [
      'log reescribible',
      (r) => (r.rules.riskRooms.$roomId.log.$entry['.write'] = true),
      'solo-añadir',
    ],
    [
      'semilla mutable',
      (r) => delete r.rules.riskRooms.$roomId.meta.seed['.validate'],
      'meta/seed',
    ],
    [
      'borrado libre',
      (r) => (r.rules.riskRooms.$roomId['.write'] = true),
      'borrar cualquier sala',
    ],
    [
      'caducidad falsificable',
      (r) => (r.rules.riskRooms.$roomId.meta.updatedAt['.validate'] = 'newData.isNumber()'),
      'no puede retroceder',
    ],
    [
      'salas enumerables',
      (r) => (r.rules.riskRooms['.read'] = true),
      'listar y leer todas',
    ],
    [
      'alineación reescribible',
      (r) => (r.rules.riskRooms.$roomId.meta.roster['.write'] = true),
      'roster',
    ],
    [
      'asiento suplantable',
      (r) => delete r.rules.riskRooms.$roomId.seats.$seatId.seatToken,
      'testigo de un asiento',
    ],
    [
      'permiso en cascada al crear',
      (r) =>
        (r.rules.riskRooms.$roomId['.write'] =
          "!data.exists() || auth != null || data.child('meta/updatedAt').val() < now"),
      'cascadea',
    ],
    [
      'creación sin sesión',
      (r) => (r.rules.riskRooms.$roomId.meta['.write'] = '!data.exists()'),
      'exigir sesión',
    ],
    [
      'salas fantasma por el log',
      (r) => (r.rules.riskRooms.$roomId.log.$entry['.write'] = '!data.exists() && newData.exists()'),
      'salas fantasma',
    ],
    [
      'otra sección borrada',
      (r) => delete r.rules['throwdown-timer'],
      'throwdown-timer',
    ],
    ['chat sin tope', (r) => (r.rules.riskRooms.$roomId.chat.$message['.validate'] = 'true'), 'tope'],
  ];

  const rotos = [];
  for (const [nombre, romper, esperado] of casos) {
    const copia = clone();
    romper(copia);
    const { problems } = checkRules(copia, doc);
    if (!problems.some((p) => p.includes(esperado))) {
      rotos.push(`"${nombre}" no dispara ninguna alarma (se esperaba algo con "${esperado}")`);
    }
  }

  // Y al revés: las reglas buenas no pueden dar falsos positivos.
  const { problems } = checkRules(good, doc);
  if (problems.length > 0) rotos.push(`las reglas buenas dan problemas: ${problems.join('; ')}`);

  return rotos;
}

const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const doc = readFileSync('docs/risk.md', 'utf8');

const rotos = selfTest(rules, doc);
if (rotos.length > 0) {
  console.error('El comprobante está roto: no detecta lo que dice detectar.');
  for (const roto of rotos) console.error(`  - ${roto}`);
  process.exit(1);
}

const { problems, warnings } = checkRules(rules, doc);
if (problems.length > 0) {
  console.error('Reglas de seguridad: PROBLEMAS');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Reglas de seguridad: en orden (11 grupos, y el comprobante se prueba a sí mismo).');
for (const warning of warnings) console.warn(`AVISO: ${warning}`);
