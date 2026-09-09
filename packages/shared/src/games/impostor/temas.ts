/**
 * Los temas del Impostor y sus palabras.
 *
 * Cada entrada son dos palabras que se parecen: `a` es la que recibe la
 * tripulación y `b` la que recibe el infiltrado en el modo que le da palabra.
 * Que se parezcan es justo lo que hace jugable ese modo —«tenis» y «pádel»
 * aguantan las mismas pistas durante una ronda entera— y en los demás modos `b`
 * sirve de señuelo en la lista que se le ofrece al impostor pillado.
 *
 * `pistas` son las palabras que diría alguien que sí sabe la palabra. Las usan
 * los bots, y por eso son deliberadamente flojas: una pista buenísima delata la
 * palabra a la mesa entera, que es exactamente el error que comete la gente.
 *
 * El banco vive aquí, a la vista, y no pasa nada: lo que hay que esconder no es
 * la lista, es cuál de las ciento veinte salió. Eso lo sortea el servidor y no
 * sale de él.
 */

export interface Termino {
  /** La palabra de la tripulación. */
  readonly a: string;
  /** La parecida: la del infiltrado, y señuelo en la última palabra. */
  readonly b: string;
  /** Lo que diría quien la sabe. Tres, para que los bots no se repitan. */
  readonly pistas: readonly [string, string, string];
}

export interface Tema {
  readonly id: string;
  readonly nombre: string;
  /** Una línea para el selector de la sala. */
  readonly pinta: string;
  readonly terminos: readonly Termino[];
}

export const TEMAS: readonly Tema[] = [
  {
    id: 'animales',
    nombre: 'Animales',
    pinta: 'Del gato de tu vecina al calamar gigante',
    terminos: [
      { a: 'Perro', b: 'Lobo', pistas: ['correa', 'fiel', 'ladra'] },
      { a: 'Gato', b: 'Tigre', pistas: ['tejado', 'ronronea', 'independiente'] },
      { a: 'Caballo', b: 'Burro', pistas: ['establo', 'galope', 'herradura'] },
      { a: 'Delfín', b: 'Tiburón', pistas: ['listo', 'salta', 'acuario'] },
      { a: 'Pingüino', b: 'Foca', pistas: ['frac', 'torpe', 'hielo'] },
      { a: 'Águila', b: 'Halcón', pistas: ['altura', 'vista', 'escudo'] },
      { a: 'Abeja', b: 'Avispa', pistas: ['miel', 'colmena', 'flores'] },
      { a: 'Elefante', b: 'Rinoceronte', pistas: ['memoria', 'trompa', 'enorme'] },
      { a: 'Serpiente', b: 'Lagarto', pistas: ['arrastra', 'muda', 'veneno'] },
      { a: 'Búho', b: 'Lechuza', pistas: ['noche', 'sabio', 'cuello'] },
      { a: 'Pulpo', b: 'Calamar', pistas: ['tinta', 'ocho', 'gallego'] },
      { a: 'Camello', b: 'Llama', pistas: ['desierto', 'joroba', 'aguanta'] },
    ],
  },
  {
    id: 'comida',
    nombre: 'Comida y bebida',
    pinta: 'Discutir de tortilla sin decir «tortilla»',
    terminos: [
      { a: 'Pizza', b: 'Empanada', pistas: ['reparto', 'horno', 'porción'] },
      { a: 'Tortilla', b: 'Revuelto', pistas: ['huevo', 'debate', 'sartén'] },
      { a: 'Paella', b: 'Fideuá', pistas: ['domingo', 'socarrat', 'leña'] },
      { a: 'Café', b: 'Té', pistas: ['mañana', 'taza', 'amargo'] },
      { a: 'Cerveza', b: 'Sidra', pistas: ['terraza', 'espuma', 'fría'] },
      { a: 'Chocolate', b: 'Turrón', pistas: ['tableta', 'dulce', 'derrite'] },
      { a: 'Sushi', b: 'Ceviche', pistas: ['crudo', 'palillos', 'arroz'] },
      { a: 'Hamburguesa', b: 'Bocadillo', pistas: ['pan', 'manos', 'servilleta'] },
      { a: 'Helado', b: 'Granizado', pistas: ['verano', 'cucurucho', 'frío'] },
      { a: 'Jamón', b: 'Chorizo', pistas: ['navidad', 'loncha', 'caro'] },
      { a: 'Sopa', b: 'Caldo', pistas: ['cuchara', 'invierno', 'abuela'] },
      { a: 'Churros', b: 'Porras', pistas: ['domingo', 'aceite', 'mojar'] },
    ],
  },
  {
    id: 'cine',
    nombre: 'Cine y series',
    pinta: 'Spoilers no; pistas malas, todas las que quieras',
    terminos: [
      { a: 'Titanic', b: 'Poseidón', pistas: ['barco', 'tabla', 'frío'] },
      { a: 'Matrix', b: 'Origen', pistas: ['pastilla', 'gafas', 'despertar'] },
      { a: 'Star Wars', b: 'Star Trek', pistas: ['espada', 'padre', 'galaxia'] },
      { a: 'Terror', b: 'Suspense', pistas: ['cojín', 'noche', 'grito'] },
      { a: 'Documental', b: 'Reportaje', pistas: ['siesta', 'narrador', 'real'] },
      { a: 'Palomitas', b: 'Nachos', pistas: ['ruido', 'cubo', 'sal'] },
      { a: 'Tráiler', b: 'Cartel', pistas: ['antes', 'engaña', 'minuto'] },
      { a: 'Secuela', b: 'Precuela', pistas: ['peor', 'otra vez', 'dinero'] },
      { a: 'Doblaje', b: 'Subtítulos', pistas: ['discusión', 'voz', 'España'] },
      { a: 'Maratón', b: 'Estreno', pistas: ['sofá', 'noche', 'siguiente'] },
      { a: 'Villano', b: 'Antihéroe', pistas: ['plan', 'capa', 'monólogo'] },
      { a: 'Zombi', b: 'Vampiro', pistas: ['lento', 'grupo', 'apocalipsis'] },
    ],
  },
  {
    id: 'oficina',
    nombre: 'Oficina',
    pinta: 'Lo que pasa entre las nueve y las seis',
    terminos: [
      { a: 'Reunión', b: 'Llamada', pistas: ['correo', 'calendario', 'larga'] },
      { a: 'Máquina de café', b: 'Fuente de agua', pistas: ['pasillo', 'excusa', 'monedas'] },
      { a: 'Jefe', b: 'Cliente', pistas: ['prisa', 'cambia', 'despacho'] },
      { a: 'Vacaciones', b: 'Puente', pistas: ['agosto', 'cola', 'planilla'] },
      { a: 'Impresora', b: 'Escáner', pistas: ['atasco', 'nunca', 'papel'] },
      { a: 'Nómina', b: 'Factura', pistas: ['fin de mes', 'menos', 'PDF'] },
      { a: 'Retrospectiva', b: 'Daily', pistas: ['pizarra', 'nadie', 'quince'] },
      { a: 'Teletrabajo', b: 'Presencial', pistas: ['pijama', 'cámara', 'discusión'] },
      { a: 'Ascenso', b: 'Aumento', pistas: ['año', 'promesa', 'firma'] },
      { a: 'Fichar', b: 'Turno', pistas: ['reloj', 'entrada', 'ley'] },
      { a: 'Becario', b: 'Junior', pistas: ['barato', 'preguntas', 'café'] },
      { a: 'Excel', b: 'Base de datos', pistas: ['celdas', 'macro', 'todo'] },
    ],
  },
  {
    id: 'informatica',
    nombre: 'Informática',
    pinta: 'Para la mesa que se sabe la broma',
    terminos: [
      { a: 'Bug', b: 'Funcionalidad', pistas: ['depende', 'ticket', 'viernes'] },
      { a: 'Despliegue', b: 'Marcha atrás', pistas: ['viernes', 'botón', 'rezar'] },
      { a: 'Git', b: 'Subversion', pistas: ['rama', 'conflicto', 'historia'] },
      { a: 'Contraseña', b: 'Huella', pistas: ['olvidada', 'post-it', 'asteriscos'] },
      { a: 'Copia de seguridad', b: 'Foto del disco', pistas: ['nunca', 'ayer', 'llorar'] },
      { a: 'Servidor', b: 'Nube', pistas: ['caído', 'ruido', 'factura'] },
      { a: 'Wifi', b: 'Cable', pistas: ['barras', 'router', 'vecino'] },
      { a: 'Actualización', b: 'Parche', pistas: ['reinicia', 'ahora no', 'porcentaje'] },
      { a: 'Teclado', b: 'Ratón', pistas: ['migas', 'clic', 'mecánico'] },
      { a: 'Correo', b: 'Mensaje', pistas: ['bandeja', 'copia', 'adjunto'] },
      { a: 'Antivirus', b: 'Cortafuegos', pistas: ['aviso', 'lento', 'caducado'] },
      { a: 'Pantalla azul', b: 'Cuelgue', pistas: ['reinicio', 'cara', 'perdido'] },
    ],
  },
  {
    id: 'deportes',
    nombre: 'Deportes',
    pinta: 'Del fútbol de siempre al pádel del cuñado',
    terminos: [
      { a: 'Fútbol', b: 'Fútbol sala', pistas: ['domingo', 'árbitro', 'once'] },
      { a: 'Baloncesto', b: 'Balonmano', pistas: ['canasta', 'altos', 'bote'] },
      { a: 'Tenis', b: 'Pádel', pistas: ['raqueta', 'red', 'ceros'] },
      { a: 'Natación', b: 'Waterpolo', pistas: ['gorro', 'calle', 'cloro'] },
      { a: 'Ciclismo', b: 'Motociclismo', pistas: ['puerto', 'julio', 'maillot'] },
      { a: 'Maratón', b: 'Media maratón', pistas: ['dorsal', 'rodilla', 'muro'] },
      { a: 'Ajedrez', b: 'Damas', pistas: ['reloj', 'callado', 'apertura'] },
      { a: 'Boxeo', b: 'Judo', pistas: ['asalto', 'guantes', 'esquina'] },
      { a: 'Esquí', b: 'Snowboard', pistas: ['cola', 'caro', 'yeso'] },
      { a: 'Golf', b: 'Minigolf', pistas: ['césped', 'carrito', 'silencio'] },
      { a: 'Gimnasio', b: 'Crossfit', pistas: ['enero', 'cuota', 'espejo'] },
      { a: 'Petanca', b: 'Bolos', pistas: ['parque', 'jubilados', 'medir'] },
    ],
  },
  {
    id: 'lugares',
    nombre: 'Lugares',
    pinta: 'Sitios a los que se va y de los que se vuelve',
    terminos: [
      { a: 'Playa', b: 'Piscina', pistas: ['toalla', 'arena', 'agosto'] },
      { a: 'Aeropuerto', b: 'Estación', pistas: ['maleta', 'esperar', 'pantalla'] },
      { a: 'Hospital', b: 'Ambulatorio', pistas: ['cola', 'bata', 'olor'] },
      { a: 'Biblioteca', b: 'Librería', pistas: ['silencio', 'carné', 'estanterías'] },
      { a: 'Supermercado', b: 'Mercado', pistas: ['carro', 'lista', 'cola'] },
      { a: 'Montaña', b: 'Sierra', pistas: ['bota', 'niebla', 'cuesta'] },
      { a: 'Museo', b: 'Galería', pistas: ['no tocar', 'audioguía', 'entrada'] },
      { a: 'Camping', b: 'Hostal', pistas: ['tienda', 'barato', 'mosquitos'] },
      { a: 'Peluquería', b: 'Barbería', pistas: ['espejo', 'charla', 'poco'] },
      { a: 'Gasolinera', b: 'Área de servicio', pistas: ['noche', 'café', 'carretera'] },
      { a: 'Ascensor', b: 'Escalera', pistas: ['vecino', 'silencio', 'espejo'] },
      { a: 'Ferretería', b: 'Bazar', pistas: ['tornillo', 'de todo', 'señor'] },
    ],
  },
  {
    id: 'casa',
    nombre: 'Cosas de casa',
    pinta: 'Objetos que todo el mundo tiene y nadie mira',
    terminos: [
      { a: 'Nevera', b: 'Congelador', pistas: ['imanes', 'abrir', 'zumbido'] },
      { a: 'Sofá', b: 'Sillón', pistas: ['siesta', 'mando', 'migas'] },
      { a: 'Lavadora', b: 'Lavavajillas', pistas: ['calcetín', 'centrifugado', 'vecina'] },
      { a: 'Escoba', b: 'Fregona', pistas: ['esquina', 'polvo', 'domingo'] },
      { a: 'Cajón', b: 'Armario', pistas: ['todo', 'cables', 'no cierra'] },
      { a: 'Espejo', b: 'Ventana', pistas: ['baño', 'mañana', 'vaho'] },
      { a: 'Persiana', b: 'Cortina', pistas: ['ruido', 'cuerda', 'atascada'] },
      { a: 'Microondas', b: 'Horno', pistas: ['pitido', 'minuto', 'girar'] },
      { a: 'Manta', b: 'Edredón', pistas: ['invierno', 'sofá', 'pelusa'] },
      { a: 'Enchufe', b: 'Regleta', pistas: ['detrás', 'pocos', 'pisar'] },
      { a: 'Felpudo', b: 'Alfombra', pistas: ['entrada', 'llave', 'pisar'] },
      { a: 'Fiambrera', b: 'Termo', pistas: ['tapa', 'nunca', 'trabajo'] },
    ],
  },
  {
    id: 'musica',
    nombre: 'Música',
    pinta: 'Sin tararear, que eso es hacer trampa',
    terminos: [
      { a: 'Guitarra', b: 'Bajo', pistas: ['cuerdas', 'hoguera', 'seis'] },
      { a: 'Batería', b: 'Percusión', pistas: ['vecinos', 'baquetas', 'ruido'] },
      { a: 'Piano', b: 'Órgano', pistas: ['teclas', 'clases', 'blanco'] },
      { a: 'Concierto', b: 'Festival', pistas: ['entradas', 'pie', 'barra'] },
      { a: 'Karaoke', b: 'Coro', pistas: ['valor', 'micro', 'letra'] },
      { a: 'Auriculares', b: 'Altavoz', pistas: ['metro', 'cable', 'volumen'] },
      { a: 'Vinilo', b: 'Casete', pistas: ['nostalgia', 'girar', 'caro'] },
      { a: 'Villancico', b: 'Himno', pistas: ['diciembre', 'todos', 'pesado'] },
      { a: 'Flamenco', b: 'Copla', pistas: ['palmas', 'quejío', 'sur'] },
      { a: 'Reguetón', b: 'Trap', pistas: ['verano', 'discusión', 'repetido'] },
      { a: 'Ópera', b: 'Zarzuela', pistas: ['larga', 'palco', 'idioma'] },
      { a: 'Ensayo', b: 'Prueba de sonido', pistas: ['local', 'nadie', 'otra vez'] },
    ],
  },
  {
    id: 'espana',
    nombre: 'Cosas de España',
    pinta: 'Lo que se explica fatal a un extranjero',
    terminos: [
      { a: 'Siesta', b: 'Sobremesa', pistas: ['sofá', 'después', 'defender'] },
      { a: 'Lotería', b: 'Quiniela', pistas: ['navidad', 'décimo', 'niños'] },
      { a: 'Botellón', b: 'Verbena', pistas: ['plaza', 'noche', 'bolsa'] },
      { a: 'Feria', b: 'Romería', pistas: ['caseta', 'polvo', 'traje'] },
      { a: 'Sanfermines', b: 'Fallas', pistas: ['julio', 'correr', 'blanco'] },
      { a: 'Menú del día', b: 'Tapa', pistas: ['primero', 'once euros', 'pan'] },
      { a: 'Chiringuito', b: 'Terraza', pistas: ['arena', 'sardinas', 'agosto'] },
      { a: 'Cuñado', b: 'Vecino', pistas: ['sabe', 'comida', 'opina'] },
      { a: 'DNI', b: 'Pasaporte', pistas: ['cartera', 'foto', 'caducado'] },
      { a: 'Cercanías', b: 'Metro', pistas: ['retraso', 'andén', 'megafonía'] },
      { a: 'Puente', b: 'Festivo', pistas: ['diciembre', 'atasco', 'calendario'] },
      { a: 'Rebajas', b: 'Viernes negro', pistas: ['enero', 'cola', 'igual'] },
    ],
  },
];

/** El identificador que significa «que salga de cualquier tema». */
export const TEMA_MEZCLA = 'mezcla';

export function temaPorId(id: string | null | undefined): Tema | null {
  if (!id) return null;
  return TEMAS.find((tema) => tema.id === id) ?? null;
}

/**
 * Cómo se llama el tema en pantalla.
 *
 * La mesa entera ve el tema desde el principio, impostor incluido: sin él, el
 * impostor no puede ni intentar colar una pista, y el juego se convierte en
 * mirar quién no dice nada.
 */
export function nombreDelTema(id: string): string {
  if (id === TEMA_MEZCLA) return 'Mezcla';
  return temaPorId(id)?.nombre ?? 'Mezcla';
}

/** Todas las palabras de un tema, o del banco entero si es la mezcla. */
export function terminosDe(temaId: string): readonly Termino[] {
  if (temaId === TEMA_MEZCLA) return TEMAS.flatMap((tema) => tema.terminos);
  return temaPorId(temaId)?.terminos ?? [];
}

/**
 * El término al que pertenece una palabra, buscando por los dos lados.
 *
 * Hace falta para el infiltrado: su palabra es la `b`, y sus pistas —las que
 * daría alguien que se cree que juega con esa— son las de su pareja.
 */
export function terminoDeLaPalabra(temaId: string, palabra: string): Termino | null {
  return terminosDe(temaId).find((uno) => uno.a === palabra || uno.b === palabra) ?? null;
}
