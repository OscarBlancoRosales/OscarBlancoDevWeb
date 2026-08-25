/**
 * Comprueba las reglas de seguridad de la base de datos.
 *
 * No sustituye a desplegarlas ni al emulador: verifica que el JSON del
 * documento y el del fichero no se hayan separado, y que sigan en pie los
 * invariantes que de verdad protegen una partida. Si alguien afloja una regla
 * sin querer, esto salta.
 *
 *   npm run check:rules
 */
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const doc = readFileSync('docs/risk.md', 'utf8');

const problems = [];
const risk = rules.rules?.riskRooms?.$roomId;

function require(condition, message) {
  if (!condition) problems.push(message);
}

// 1. El documento y el fichero tienen que decir lo mismo.
const start = doc.indexOf('```json', doc.indexOf('## 3. Reglas de seguridad'));
const end = doc.indexOf('```', start + 7);
require(start !== -1 && end !== -1, 'No encuentro el bloque JSON en docs/risk.md');
if (start !== -1 && end !== -1) {
  const inDoc = JSON.parse(doc.slice(start + 7, end));
  require(
    JSON.stringify(inDoc) === JSON.stringify(rules),
    'Las reglas del documento y las del fichero se han separado',
  );
}

// 2. El log es la grabación de la partida: solo se puede AÑADIR.
require(
  risk?.log?.$entry?.['.write']?.includes('!data.exists()'),
  'El log tiene que ser de solo-añadir: nadie puede reescribir una jugada ya hecha',
);
require(
  risk?.chat?.$message?.['.write']?.includes('!data.exists()'),
  'El chat tiene que ser de solo-añadir',
);

// 3. La identidad de la sala no puede cambiar a mitad de partida: cambiar la
//    semilla o el mapa desincronizaría a todos los clientes a la vez.
for (const field of ['seed', 'mapId', 'createdAt']) {
  require(
    risk?.meta?.[field]?.['.validate']?.includes('data.val() === newData.val()'),
    `meta/${field} tiene que ser inmutable una vez creada la sala`,
  );
}

// 4. Borrar una sala no puede estar al alcance de cualquiera.
const roomWrite = risk?.['.write'] ?? '';
require(roomWrite !== 'true', 'Cualquiera podría borrar cualquier sala');
require(
  roomWrite.includes('auth != null') && roomWrite.includes('updatedAt'),
  'Borrar una sala debe exigir sesión, o que la sala esté caducada',
);

// 5. Topes de tamaño, para que un bucle no llene la base gratuita.
require(
  risk?.chat?.$message?.['.validate']?.includes('length <= 600'),
  'El chat necesita un tope de longitud',
);

if (problems.length > 0) {
  console.error('Reglas de seguridad: PROBLEMAS');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Reglas de seguridad: todo en orden (5 comprobaciones).');
