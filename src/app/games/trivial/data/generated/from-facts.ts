import { Difficulty, Question } from '../types';
import {
  freeItems,
  makeBank,
  markStem,
  pickDistractors,
  shuffleIn,
  stemOf,
  takenStems,
  withStem,
} from '../expand';
import {
  CCAA_CAPITALS,
  CAPITALS,
  CURRENCIES,
  ELEMENTS,
  LANG_DESIGNERS,
  LANG_YEARS,
  PROVINCES,
} from './facts';

type Bank = ReturnType<typeof makeBank>;

const EASY_COUNTRIES = new Set([
  'Alemania',
  'Argentina',
  'Brasil',
  'Canadá',
  'España',
  'Estados Unidos',
  'Francia',
  'Grecia',
  'Italia',
  'Japón',
  'México',
  'Portugal',
  'Reino Unido',
]);

function countryDiff(name: string): Difficulty {
  if (EASY_COUNTRIES.has(name)) return 1;
  return name.length > 12 ? 3 : 2;
}

function elementDiff(n: number): Difficulty {
  if (n <= 20) return 1;
  if (n <= 86) return 2;
  return 3;
}

const EUROPE = [
  'Alemania',
  'Austria',
  'Bélgica',
  'Bulgaria',
  'Croacia',
  'Reino de Dinamarca',
  'Eslovaquia',
  'Eslovenia',
  'España',
  'Estonia',
  'Finlandia',
  'Francia',
  'Grecia',
  'Hungría',
  'Irlanda',
  'Islandia',
  'Italia',
  'Letonia',
  'Lituania',
  'Noruega',
  'Polonia',
  'Portugal',
  'Reino Unido',
  'República Checa',
  'Rumania',
  'Suecia',
  'Suiza',
  'Ucrania',
];

const AFRICA = [
  'Angola',
  'Argelia',
  'Camerún',
  'Egipto',
  'Etiopía',
  'Ghana',
  'Kenia',
  'Marruecos',
  'Mozambique',
  'Nigeria',
  'Senegal',
  'Tanzania',
  'Túnez',
];

const ASIA = [
  'Arabia Saudí',
  'República Popular China',
  'Corea del Sur',
  'Filipinas',
  'India',
  'Indonesia',
  'Irak',
  'Irán',
  'Israel',
  'Japón',
  'Malasia',
  'Tailandia',
  'Turquía',
  'Vietnam',
];

const SOUTH_AMERICA = [
  'Argentina',
  'Bolivia',
  'Brasil',
  'Chile',
  'Colombia',
  'Ecuador',
  'Paraguay',
  'Perú',
  'Uruguay',
  'Venezuela',
];

const NOBLE = ['Helio', 'Neón', 'Argón', 'Kriptón', 'Xenón', 'Radón'];
const ALKALI = ['Litio', 'Sodio', 'Potasio', 'Rubidio', 'Cesio'];
const HALOGEN = ['Flúor', 'Cloro', 'Bromo', 'Yodo'];

export function expandWikidataGeneral(existing: Question[] = []): Question[] {
  const q = makeBank('general', 'wd');
  const taken = takenStems(existing);
  const out: Question[] = [];

  const capitals = freeItems(CAPITALS, 'capital', taken);
  const capitalMap = new Map(capitals);
  const currencies = freeItems(CURRENCIES, 'currency', taken);
  const elements = freeItems(ELEMENTS, 'element', taken);
  const ccaa = freeItems(CCAA_CAPITALS, 'ccaa', taken);
  const provinces = freeItems(PROVINCES, 'province', taken);

  out.push(...regionOdd(q, taken, capitalMap, 'Europa', EUROPE, AFRICA.concat(ASIA)));
  out.push(...regionOdd(q, taken, capitalMap, 'África', AFRICA, EUROPE.concat(ASIA)));
  out.push(...regionOdd(q, taken, capitalMap, 'Asia', ASIA, EUROPE.concat(AFRICA)));
  out.push(
    ...regionOdd(q, taken, capitalMap, 'América del Sur', SOUTH_AMERICA, EUROPE.concat(ASIA)),
  );

  out.push(...familyOdd(q, taken, 'ciencia', 'un gas noble', NOBLE, ALKALI));
  out.push(...familyOdd(q, taken, 'ciencia', 'un metal alcalino', ALKALI, HALOGEN));
  out.push(...familyOdd(q, taken, 'ciencia', 'un halógeno', HALOGEN, NOBLE));
  out.push(...generalSetPieces(q, taken));

  const byCcaa = new Map<string, string[]>();
  for (const [prov, community] of provinces) {
    const list = byCcaa.get(community) ?? [];
    list.push(prov);
    byCcaa.set(community, list);
  }
  for (const [community, list] of byCcaa) {
    if (list.length < 3) continue;
    const outsider =
      provinces.find(([, other]) => other !== community && !list.slice(0, 3).includes(other[0]))?.[0] ??
      null;
    if (!outsider) continue;
    const trio = list.slice(0, 3);
    const options = shuffleIn([...trio, outsider], community) as [string, string, string, string];
    const prompt = `¿Cuál NO es una provincia de ${community}?`;
    trio.forEach((prov) => markStem('province', prov, taken));
    markStem('province', outsider, taken);
    out.push(withStem(q.odd('espana', 2, prompt, options, outsider), `odd-prov:${community}`));
  }

  const leftoverCapitals = freeItems(capitals, 'capital', taken);
  leftoverCapitals.forEach(([country, capital], index) => {
    const diff = countryDiff(country);
    const slot = index % 3;
    if (slot === 0) {
      const stem = markStem('capital', country, taken);
      out.push(withStem(q.op('geografia', diff, `Nombra la capital de ${country}.`, capital), stem));
      return;
    }
    if (slot === 1) {
      const truth = index % 6 !== 4;
      const shown =
        truth ? capital : (pickDistractors(leftoverCapitals.map((row) => row[1]), capital, country)?.[0] ?? capital);
      const stem = markStem('capital', country, taken);
      out.push(
        withStem(
          q.tf('geografia', diff, `La capital de ${country} es ${shown}.`, truth && shown === capital),
          stem,
        ),
      );
      return;
    }
    const lures = pickDistractors(leftoverCapitals.map((row) => row[1]), capital, country);
    if (!lures) return;
    const prompt = `¿Cuál es la capital de ${country}?`;
    const options = shuffleIn([capital, ...lures], prompt) as [string, string, string, string];
    const stem = markStem('capital', country, taken);
    out.push(withStem(q.c('geografia', diff, prompt, options, capital), stem));
  });

  const leftoverMoney = freeItems(currencies, 'currency', taken);
  leftoverMoney.forEach(([country, currency], index) => {
    const stem = markStem('currency', country, taken);
    const diff = countryDiff(country);
    if (index % 2 === 0) {
      out.push(withStem(q.op('geografia', diff, `Nombra la moneda de ${country}.`, currency), stem));
      return;
    }
    const truth = index % 4 !== 3;
    const shown =
      truth ? currency : (pickDistractors(leftoverMoney.map((row) => row[1]), currency, country)?.[0] ?? currency);
    out.push(
      withStem(
        q.tf('geografia', diff, `La moneda de ${country} es ${shown}.`, truth && shown === currency),
        stem,
      ),
    );
  });

  const leftoverEl = freeItems(elements, 'element', taken);
  const orderChunks = chunk(leftoverEl, 4).slice(0, 8);
  for (const group of orderChunks) {
    if (group.length < 4) continue;
    const ordered = [...group].sort((a, b) => a[2] - b[2]);
    const names = ordered.map((row) => row[0]);
    const shuffled = shuffleIn(names, names.join('|'));
    const prompt = `Ordena de menor a mayor número atómico: ${shuffled.join(', ')}.`;
    group.forEach((row) => markStem('element', row[0], taken));
    out.push(
      withStem(q.ord('ciencia', 2, prompt, shuffled, names), `order-el:${names.map((n) => n).join('|')}`),
    );
  }

  const leftoverEl2 = freeItems(elements, 'element', taken);
  leftoverEl2.forEach(([name, symbol, number], index) => {
    const stem = markStem('element', name, taken);
    const diff = elementDiff(number);
    const slot = index % 3;
    if (slot === 0) {
      out.push(withStem(q.n('ciencia', diff, `¿Cuál es el número atómico del ${name.toLowerCase()}?`, number), stem));
      return;
    }
    if (slot === 1) {
      out.push(withStem(q.op('ciencia', diff, `¿Cuál es el símbolo químico del ${name.toLowerCase()}?`, symbol), stem));
      return;
    }
    const truth = index % 6 !== 5;
    const shown = truth ? symbol : (pickDistractors(leftoverEl2.map((row) => row[1]), symbol, name)?.[0] ?? symbol);
    out.push(
      withStem(
        q.tf('ciencia', diff, `El símbolo químico del ${name.toLowerCase()} es ${shown}.`, truth && shown === symbol),
        stem,
      ),
    );
  });

  freeItems(ccaa, 'ccaa', taken).forEach(([community, capital], index) => {
    const stem = markStem('capital', community, taken);
    if (index % 2 === 0) {
      out.push(withStem(q.op('espana', 1, `Nombra la capital de ${community}.`, capital), stem));
      return;
    }
    out.push(withStem(q.tf('espana', 1, `La capital de ${community} es ${capital}.`, true), stem));
  });

  freeItems(provinces, 'province', taken).forEach(([prov, community], index) => {
    const stem = markStem('province', prov, taken);
    if (index % 2 === 0) {
      out.push(
        withStem(q.op('espana', 2, `¿A qué comunidad autónoma pertenece ${prov}?`, community), stem),
      );
      return;
    }
    out.push(withStem(q.tf('espana', 2, `${prov} pertenece a ${community}.`, true), stem));
  });

  return out;
}

export function expandWikidataDev(existing: Question[] = []): Question[] {
  const q = makeBank('dev', 'wd');
  const taken = takenStems(existing);
  const out: Question[] = [];

  const yearMap = new Map(LANG_YEARS);
  const langs = freeItems(LANG_DESIGNERS, 'lang', taken);

  out.push(...devSetPieces(q, taken));
  out.push(
    ...oddList(
      q,
      taken,
      'lenguajes',
      'un lenguaje de programación',
      ['Python', 'Java', 'C', 'Ruby'],
      'HTML',
      'lang',
    ),
  );
  out.push(
    ...oddList(q, taken, 'lenguajes', 'un lenguaje compilado clásico', ['C++', 'Go', 'Rust', 'Swift'], 'PHP', 'lang'),
  );

  const orderPool = freeItems(langs, 'lang', taken).filter(([name]) => yearMap.has(name));
  for (const group of chunk(orderPool, 4).slice(0, 4)) {
    if (group.length < 4) continue;
    const ordered = [...group].sort((a, b) => (yearMap.get(a[0]) ?? 0) - (yearMap.get(b[0]) ?? 0));
    const names = ordered.map((row) => row[0]);
    const shuffled = shuffleIn(names, names.join('|'));
    const prompt = `Ordena estos lenguajes de más antiguo a más reciente: ${shuffled.join(', ')}.`;
    group.forEach((row) => markStem('lang', row[0], taken));
    out.push(withStem(q.ord('historia', 2, prompt, shuffled, names), `order-lang:${names.join('|')}`));
  }

  const yearOnly = freeItems(
    LANG_YEARS.filter(([name]) => !langs.some((row) => row[0] === name)),
    'lang',
    taken,
  );

  freeItems(langs, 'lang', taken).forEach(([lang, designer], index) => {
    const stem = markStem('lang', lang, taken);
    const year = yearMap.get(lang);
    const slot = year ? index % 4 : index % 3;
    if (slot === 0 && year) {
      out.push(
        withStem(q.n('historia', 2, `¿En qué año apareció (aprox.) el lenguaje ${lang}?`, year, undefined, 2), stem),
      );
      return;
    }
    if (slot === 1) {
      out.push(withStem(q.op('lenguajes', 2, `Nombra a quien diseñó el lenguaje ${lang}.`, designer), stem));
      return;
    }
    if (slot === 2) {
      const truth = index % 6 !== 5;
      const shown =
        truth ? designer : (pickDistractors(langs.map((row) => row[1]), designer, lang)?.[0] ?? designer);
      out.push(
        withStem(
          q.tf('lenguajes', 2, `${shown} diseñó el lenguaje ${lang}.`, truth && shown === designer),
          stem,
        ),
      );
      return;
    }
    const lures = pickDistractors(langs.map((row) => row[1]), designer, lang);
    if (!lures) return;
    const prompt = `¿Quién diseñó originalmente el lenguaje ${lang}?`;
    const options = shuffleIn([designer, ...lures], prompt) as [string, string, string, string];
    out.push(withStem(q.c('lenguajes', 2, prompt, options, designer), stem));
  });

  yearOnly.forEach(([lang, year]) => {
    const stem = markStem('lang', lang, taken);
    out.push(
      withStem(q.n('historia', 2, `¿En qué año apareció (aprox.) el lenguaje ${lang}?`, year, undefined, 2), stem),
    );
  });

  return out;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function regionOdd(
  q: Bank,
  taken: Set<string>,
  capitals: Map<string, string>,
  region: string,
  inside: string[],
  outside: string[],
): Question[] {
  const ins = inside.filter((name) => capitals.has(name) && !taken.has(stemOf('capital', name))).slice(0, 3);
  const outName = outside.find((name) => capitals.has(name) && !taken.has(stemOf('capital', name)));
  if (ins.length < 3 || !outName) return [];
  [...ins, outName].forEach((name) => markStem('capital', name, taken));
  const options = shuffleIn([...ins, outName], region) as [string, string, string, string];
  return [
    withStem(
      q.odd('geografia', 2, `¿Cuál de estos países NO está en ${region}?`, options, outName),
      `odd-region:${region}`,
    ),
  ];
}

function familyOdd(
  q: Bank,
  taken: Set<string>,
  category: string,
  label: string,
  inside: string[],
  outside: string[],
): Question[] {
  const ins = inside.filter((name) => !taken.has(stemOf('element', name))).slice(0, 3);
  const outName = outside.find((name) => !taken.has(stemOf('element', name)));
  if (ins.length < 3 || !outName) return [];
  [...ins, outName].forEach((name) => markStem('element', name, taken));
  const options = shuffleIn([...ins, outName], label) as [string, string, string, string];
  return [
    withStem(q.odd(category, 2, `¿Cuál NO es ${label}?`, options, outName), `odd-el:${label}`),
  ];
}

function oddList(
  q: Bank,
  taken: Set<string>,
  category: string,
  label: string,
  inside: string[],
  outsider: string,
  kind: string,
): Question[] {
  if (inside.some((name) => taken.has(stemOf(kind, name))) || taken.has(stemOf(kind, outsider))) {
    return [];
  }
  inside.forEach((name) => markStem(kind, name, taken));
  markStem(kind, outsider, taken);
  const options = shuffleIn([...inside.slice(0, 3), outsider], label) as [string, string, string, string];
  return [withStem(q.odd(category, 2, `¿Cuál NO es ${label}?`, options, outsider), `odd-${kind}:${label}`)];
}

function generalSetPieces(q: Bank, taken: Set<string>): Question[] {
  const out: Question[] = [];
  const orders: Array<[string, string, string[], string[]]> = [
    ['order:planets', 'ciencia', ['Mercurio', 'Venus', 'Tierra', 'Marte'], ['Mercurio', 'Venus', 'Tierra', 'Marte']],
    ['order:ages', 'historia', ['Prehistoria', 'Edad Antigua', 'Edad Media', 'Edad Moderna'], ['Prehistoria', 'Edad Antigua', 'Edad Media', 'Edad Moderna']],
    ['order:seasons', 'naturaleza', ['primavera', 'verano', 'otoño', 'invierno'], ['primavera', 'verano', 'otoño', 'invierno']],
    ['order:rainbow', 'ciencia', ['rojo', 'naranja', 'amarillo', 'verde'], ['rojo', 'naranja', 'amarillo', 'verde']],
    ['order:star-wars', 'cine', ['Una nueva esperanza', 'El Imperio contraataca', 'El retorno del Jedi'], ['Una nueva esperanza', 'El Imperio contraataca', 'El retorno del Jedi']],
    ['order:lotr', 'cine', ['La Comunidad del Anillo', 'Las dos torres', 'El retorno del rey'], ['La Comunidad del Anillo', 'Las dos torres', 'El retorno del rey']],
    ['order:hp', 'cine', ['La piedra filosofal', 'La cámara secreta', 'El prisionero de Azkaban'], ['La piedra filosofal', 'La cámara secreta', 'El prisionero de Azkaban']],
    ['order:food-chain', 'naturaleza', ['productor', 'herbívoro', 'carnívoro'], ['productor', 'herbívoro', 'carnívoro']],
    ['order:es-kings', 'espana', ['Carlos I', 'Felipe II', 'Felipe III', 'Felipe IV'], ['Carlos I', 'Felipe II', 'Felipe III', 'Felipe IV']],
    ['order:euro', 'historia', ['CECA', 'CEE', 'Unión Europea'], ['CECA', 'CEE', 'Unión Europea']],
    ['order:ww', 'historia', ['1914', '1918', '1939', '1945'], ['1914', '1918', '1939', '1945']],
    ['order:menu', 'gastronomia', ['aperitivo', 'primero', 'segundo', 'postre'], ['aperitivo', 'primero', 'segundo', 'postre']],
  ];
  for (const [stem, category, answer, options] of orders) {
    if (taken.has(stem)) continue;
    taken.add(stem);
    const shuffled = shuffleIn(options, stem);
    out.push(
      withStem(q.ord(category, 2, `Ordena en el sentido correcto: ${shuffled.join(', ')}.`, shuffled, answer), stem),
    );
  }

  const odds: Array<[string, string, [string, string, string, string], string]> = [
    ['odd:oceans', 'geografia', ['Atlántico', 'Pacífico', 'Índico', 'Danubio'], 'Danubio'],
    ['odd:solids', 'ciencia', ['sólido', 'líquido', 'gas', 'eco'], 'eco'],
    ['odd:ccaa-not', 'espana', ['Andalucía', 'Galicia', 'Cataluña', 'Lisboa'], 'Lisboa'],
    ['odd:instruments', 'musica', ['violín', 'viola', 'violonchelo', 'batería electrónica'], 'batería electrónica'],
    ['odd:sports-ball', 'deporte', ['fútbol', 'baloncesto', 'balonmano', 'ajedrez'], 'ajedrez'],
    ['odd:tv-sitcom', 'television', ['Friends', 'The Office', 'Seinfeld', 'CSI'], 'CSI'],
    ['odd:paint', 'arte', ['óleo', 'acuarela', 'temple', 'MIDI'], 'MIDI'],
    ['odd:taste', 'gastronomia', ['dulce', 'salado', 'ácido', 'wifi'], 'wifi'],
    ['odd:mammals', 'naturaleza', ['ballena', 'delfín', 'murciélago', 'tiburón'], 'tiburón'],
    ['odd:directors', 'cine', ['Hitchcock', 'Kubrick', 'Nolan', 'Messi'], 'Messi'],
    ['odd:rivers', 'geografia', ['Nilo', 'Amazonas', 'Yangtsé', 'Everest'], 'Everest'],
    ['odd:composers', 'musica', ['Bach', 'Mozart', 'Beethoven', 'Picasso'], 'Picasso'],
  ];
  for (const [stem, category, options, answer] of odds) {
    if (taken.has(stem)) continue;
    taken.add(stem);
    const shuffled = shuffleIn(options, stem) as [string, string, string, string];
    const trio = options.filter((item) => item !== answer);
    out.push(
      withStem(
        q.odd(category, 2, `¿Cuál NO encaja en este grupo (${trio.join(', ')})?`, shuffled, answer),
        stem,
      ),
    );
  }
  return out;
}

function devSetPieces(q: Bank, taken: Set<string>): Question[] {
  const out: Question[] = [];
  const orders: Array<[string, string, string[], string[]]> = [
    [
      'order:osi',
      'sistemas',
      ['Física', 'Enlace de datos', 'Red', 'Transporte'],
      ['Física', 'Enlace de datos', 'Red', 'Transporte'],
    ],
    [
      'order:git-flow',
      'git',
      ['clone', 'add', 'commit', 'push'],
      ['clone', 'add', 'commit', 'push'],
    ],
    [
      'order:http-codes',
      'web',
      ['200 OK', '301 Redirect', '404 Not Found', '500 Server Error'],
      ['200 OK', '301 Redirect', '404 Not Found', '500 Server Error'],
    ],
    [
      'order:cpu',
      'hardware',
      ['fetch', 'decode', 'execute', 'writeback'],
      ['fetch', 'decode', 'execute', 'writeback'],
    ],
    [
      'order:semver',
      'cultura',
      ['MAJOR', 'MINOR', 'PATCH'],
      ['MAJOR', 'MINOR', 'PATCH'],
    ],
    [
      'order:memory',
      'hardware',
      ['registros', 'caché L1', 'RAM', 'disco'],
      ['registros', 'caché L1', 'RAM', 'disco'],
    ],
    [
      'order:tcp',
      'sistemas',
      ['SYN', 'SYN-ACK', 'ACK'],
      ['SYN', 'SYN-ACK', 'ACK'],
    ],
    [
      'order:docker',
      'sistemas',
      ['build', 'tag', 'push', 'run'],
      ['build', 'tag', 'push', 'run'],
    ],
    [
      'order:compile',
      'lenguajes',
      ['léxico', 'sintáctico', 'semántico', 'generación de código'],
      ['léxico', 'sintáctico', 'semántico', 'generación de código'],
    ],
    [
      'order:sql',
      'datos',
      ['FROM', 'WHERE', 'GROUP BY', 'ORDER BY'],
      ['FROM', 'WHERE', 'GROUP BY', 'ORDER BY'],
    ],
    [
      'order:owasp',
      'seguridad',
      ['identificar', 'explotar', 'mitigar', 'verificar'],
      ['identificar', 'explotar', 'mitigar', 'verificar'],
    ],
    [
      'order:train',
      'ia',
      ['datos', 'entrenamiento', 'evaluación', 'despliegue'],
      ['datos', 'entrenamiento', 'evaluación', 'despliegue'],
    ],
  ];

  for (const [stem, category, answer, options] of orders) {
    if (taken.has(stem)) continue;
    taken.add(stem);
    const shuffled = shuffleIn(options, stem);
    out.push(
      withStem(
        q.ord(category, 2, `Ordena el flujo o la jerarquía: ${shuffled.join(', ')}.`, shuffled, answer),
        stem,
      ),
    );
  }

  const odds: Array<[string, string, [string, string, string, string], string]> = [
    ['odd:http-methods', 'web', ['GET', 'POST', 'PUT', 'SELECT'], 'SELECT'],
    ['odd:js-types', 'lenguajes', ['string', 'number', 'boolean', 'varchar'], 'varchar'],
    ['odd:git-cmds', 'git', ['commit', 'merge', 'rebase', 'chmod'], 'chmod'],
    ['odd:linux-cmds', 'sistemas', ['ls', 'grep', 'chmod', 'npm'], 'npm'],
    ['odd:sql-kw', 'datos', ['SELECT', 'JOIN', 'INDEX', 'flexbox'], 'flexbox'],
    ['odd:hash', 'seguridad', ['SHA-256', 'bcrypt', 'Argon2', 'JSON'], 'JSON'],
    ['odd:agile', 'cultura', ['sprint', 'daily', 'retro', 'malloc'], 'malloc'],
    ['odd:html', 'web', ['div', 'span', 'section', 'inode'], 'inode'],
    ['odd:signals', 'sistemas', ['SIGTERM', 'SIGKILL', 'SIGINT', 'HTTP/2'], 'HTTP/2'],
    ['odd:ml', 'ia', ['transformer', 'embedding', 'fine-tuning', 'RAID 0'], 'RAID 0'],
    ['odd:hw', 'hardware', ['CPU', 'GPU', 'SSD', 'JWT'], 'JWT'],
    ['odd:algo', 'algoritmos', ['quicksort', 'heapsort', 'mergesort', 'OAuth'], 'OAuth'],
  ];

  for (const [stem, category, options, answer] of odds) {
    if (taken.has(stem)) continue;
    taken.add(stem);
    const shuffled = shuffleIn(options, stem) as [string, string, string, string];
    out.push(
      withStem(q.odd(category, 2, `¿Cuál NO encaja en este grupo (${options.filter((o) => o !== answer).join(', ')})?`, shuffled, answer), stem),
    );
  }

  return out;
}
