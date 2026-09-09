import { makeBank, withStem } from './expand';
import { Question } from './types';

/** Tanda por sección del pack cultura: los seis tipos, hechos nuevos. */
const q = makeBank('general', 'secmix');

function mix(category: string, type: string, question: Question): Question {
  return withStem(question, `secmix:general:${category}:${type}`);
}

export const GENERAL_SECTION_MIX: Question[] = [
  mix('geografia', 'choice', q.c('geografia', 2, '¿Qué meridiano se usa como origen de longitudes (el de Greenwich)?', ['0°', '180°', '23°26′', '45°'], '0°')),
  mix('geografia', 'truefalse', q.tf('geografia', 2, 'El Trópico de Cáncer está en el hemisferio norte.', true)),
  mix('geografia', 'numeric', q.n('geografia', 2, '¿Cuántos husos horarios teóricos de una hora hay en 360° si se divide en franjas de 15°?', 24)),
  mix('geografia', 'odd', q.odd('geografia', 2, '¿Cuál NO es un desierto de los grandes?', ['Sahara', 'Gobi', 'Atacama', 'Danubio'], 'Danubio')),
  mix('geografia', 'order', q.ord('geografia', 2, 'Ordena estas placas de norte a sur en América: Groenlandia, México, Ecuador, Tierra del Fuego.', ['Groenlandia', 'México', 'Ecuador', 'Tierra del Fuego'], ['Groenlandia', 'México', 'Ecuador', 'Tierra del Fuego'])),
  mix('geografia', 'open', q.op('geografia', 2, '¿Cómo se llama la línea imaginaria a 0° de latitud?', 'Ecuador', ['linea del ecuador', 'el ecuador'])),

  mix('historia', 'choice', q.c('historia', 2, '¿Qué tratado de 1713 cerró buena parte de la Guerra de Sucesión Española?', ['Utrecht', 'Versalles', 'Tordesillas', 'Westfalia'], 'Utrecht')),
  mix('historia', 'truefalse', q.tf('historia', 2, 'La Peste Negra del siglo XIV llegó a Europa antes de 1400.', true)),
  mix('historia', 'numeric', q.n('historia', 2, '¿En qué año se firmó el Tratado de Tordesillas?', 1494)),
  mix('historia', 'odd', q.odd('historia', 2, '¿Cuál NO es una revolución atlántica de finales del XVIII?', ['Independencia de EE. UU.', 'Revolución Francesa', 'Haití', 'Revolución de Octubre de 1917'], 'Revolución de Octubre de 1917')),
  mix('historia', 'order', q.ord('historia', 2, 'Ordena estos hitos de la Unificación alemana de más antiguo a más reciente.', ['Guerra austro-prusiana', 'Guerra franco-prusiana', 'Proclamación del Imperio en Versalles'], ['Guerra austro-prusiana', 'Guerra franco-prusiana', 'Proclamación del Imperio en Versalles'])),
  mix('historia', 'open', q.op('historia', 2, '¿Qué emperatriz bizantina, esposa de Justiniano I, aparece en los mosaicos de Rávena?', 'Teodora', ['la emperatriz Teodora', 'Theodora'])),

  mix('ciencia', 'choice', q.c('ciencia', 2, '¿Qué partícula del núcleo tiene carga positiva?', ['Protón', 'Neutrón', 'Electrón', 'Fotón'], 'Protón')),
  mix('ciencia', 'truefalse', q.tf('ciencia', 1, 'La luz visible es una región del espectro electromagnético.', true)),
  mix('ciencia', 'numeric', q.n('ciencia', 2, '¿Cuántos grados tiene, de libro, un círculo completo?', 360)),
  mix('ciencia', 'odd', q.odd('ciencia', 2, '¿Cuál NO es una ley de Newton del movimiento?', ['Inercia', 'F = m·a', 'Acción y reacción', 'Ley de Ohm'], 'Ley de Ohm')),
  mix('ciencia', 'order', q.ord('ciencia', 2, 'Ordena el método científico escolar.', ['Observar', 'Hipótesis', 'Experimentar', 'Conclusión'], ['Observar', 'Hipótesis', 'Experimentar', 'Conclusión'])),
  mix('ciencia', 'open', q.op('ciencia', 1, '¿Cómo se llama la fuerza que nos pega al suelo en la Tierra?', 'gravedad', ['la gravedad', 'atraccion gravitatoria'])),

  mix('arte', 'choice', q.c('arte', 2, 'El «sfumato» leonardesco consiste sobre todo en…', ['Difuminar contornos y transiciones de color', 'Picar el mármol en seco', 'Dorar con pan de oro', 'Grabar al aguafuerte'], 'Difuminar contornos y transiciones de color')),
  mix('arte', 'truefalse', q.tf('arte', 2, 'El Guernica de Picasso se pintó en blanco, negro y grises, no a todo color.', true)),
  mix('arte', 'numeric', q.n('arte', 2, '¿Cuántas cuerdas tiene, de libro, un violín?', 4)),
  mix('arte', 'odd', q.odd('arte', 2, '¿Cuál NO es un movimiento de vanguardia del siglo XX?', ['Cubismo', 'Futurismo', 'Dadaísmo', 'Románico'], 'Románico')),
  mix('arte', 'order', q.ord('arte', 2, 'Ordena estos estilos pictóricos de más antiguo a más reciente.', ['Renacimiento', 'Barroco', 'Impresionismo', 'Cubismo'], ['Renacimiento', 'Barroco', 'Impresionismo', 'Cubismo'])),
  mix('arte', 'open', q.op('arte', 2, '¿Qué técnica mural se pinta sobre el enlucido aún húmedo?', 'fresco', ['al fresco', 'pintura al fresco'])),

  mix('cine', 'choice', q.c('cine', 2, 'El «MacGuffin» hitchcockiano es…', ['Un objeto o secreto que mueve la trama aunque importe poco en sí', 'Un tipo de travelling', 'Un filtro de color', 'El último rollo'], 'Un objeto o secreto que mueve la trama aunque importe poco en sí')),
  mix('cine', 'truefalse', q.tf('cine', 2, 'El cine sonoro comercial se impuso después del cine mudo, no al revés.', true)),
  mix('cine', 'numeric', q.n('cine', 2, '¿Cuántos fotogramas por segundo usa el cine clásico de 24 fps?', 24)),
  mix('cine', 'odd', q.odd('cine', 2, '¿Cuál NO es un premio de la Academia de Hollywood?', ['Óscar a mejor película', 'Óscar a mejor director', 'Óscar a mejor actor', 'Palma de Oro de Cannes'], 'Palma de Oro de Cannes')),
  mix('cine', 'order', q.ord('cine', 2, 'Ordena estas fases de un rodaje de más temprana a más tardía.', ['Guion', 'Preproducción', 'Rodaje', 'Montaje'], ['Guion', 'Preproducción', 'Rodaje', 'Montaje'])),
  mix('cine', 'open', q.op('cine', 2, '¿Cómo se llama el primer plano muy cerrado de un rostro?', 'primerísimo primer plano', ['close-up extremo', 'extreme close-up', 'PPP'])),

  mix('musica', 'choice', q.c('musica', 2, 'Un «ostinato» es…', ['Un motivo rítmico o melódico que se insiste', 'Un silencio de negra', 'Un tipo de clave de fa', 'Una cadencia plagal solamente'], 'Un motivo rítmico o melódico que se insiste')),
  mix('musica', 'truefalse', q.tf('musica', 2, 'El contrapunto trabaja varias líneas melódicas a la vez.', true)),
  mix('musica', 'numeric', q.n('musica', 1, '¿Cuántas corcheas caben, de libro, en un compás de 4/4?', 8)),
  mix('musica', 'odd', q.odd('musica', 2, '¿Cuál NO es una voz de un cuarteto vocal clásico SATB?', ['Soprano', 'Alto', 'Tenor', 'Theremin'], 'Theremin')),
  mix('musica', 'order', q.ord('musica', 2, 'Ordena estas voces de más grave a más aguda.', ['Bajo', 'Tenor', 'Alto', 'Soprano'], ['Bajo', 'Tenor', 'Alto', 'Soprano'])),
  mix('musica', 'open', q.op('musica', 2, '¿Cómo se llama la clave que sitúa el sol en la segunda línea?', 'clave de sol', ['clave sol', 'g clef'])),

  mix('deporte', 'choice', q.c('deporte', 2, 'El VAR en fútbol sirve sobre todo para…', ['Revisar jugadas dudosas con vídeo', 'Medir el fuera de juego a ojo', 'Cambiar el balón', 'Pitar el descanso'], 'Revisar jugadas dudosas con vídeo')),
  mix('deporte', 'truefalse', q.tf('deporte', 2, 'Una piscina olímpica de natación mide 50 metros de largo, no 25.', true)),
  mix('deporte', 'numeric', q.n('deporte', 1, '¿Cuántos jugadores hay por equipo en un 5 de baloncesto en pista?', 5)),
  mix('deporte', 'odd', q.odd('deporte', 2, '¿Cuál NO es un deporte olímpico de combate habitual?', ['Judo', 'Boxeo', 'Esgrima', 'Curling'], 'Curling')),
  mix('deporte', 'order', q.ord('deporte', 2, 'Ordena las unidades de un partido de tenis de menor a mayor.', ['Punto', 'Juego', 'Set', 'Partido'], ['Punto', 'Juego', 'Set', 'Partido'])),
  mix('deporte', 'open', q.op('deporte', 2, '¿Qué sigla nombra el alerón trasero móvil de la Fórmula 1?', 'DRS', ['drag reduction system', 'sistema de reduccion de drag'])),

  mix('television', 'choice', q.c('television', 2, 'Un «cold open» en una sitcom estadounidense es…', ['La escena previa a los créditos', 'El último gag', 'Un anuncio', 'La sintonía'], 'La escena previa a los créditos')),
  mix('television', 'truefalse', q.tf('television', 2, 'Un episodio piloto se graba a menudo para vender la serie, no necesariamente para emitirse igual.', true)),
  mix('television', 'numeric', q.n('television', 2, '¿Cuántos capítulos tiene, de libro, una temporada clásica de 22–24 en sitcom US si redondeamos a la cifra habitual de «media temporada» de 13? Usa 13.', 13)),
  mix('television', 'odd', q.odd('television', 2, '¿Cuál NO es un formato típico de TV?', ['Sitcom', 'Late night', 'Reality', 'Ópera de cámara del XVIII'], 'Ópera de cámara del XVIII')),
  mix('television', 'order', q.ord('television', 2, 'Ordena la vida comercial de una serie de más temprana a más tardía.', ['Piloto', 'Temporada 1', 'Renovación', 'Final de serie'], ['Piloto', 'Temporada 1', 'Renovación', 'Final de serie'])),
  mix('television', 'open', q.op('television', 2, '¿Cómo se llama el episodio de prueba con el que se vende una serie?', 'piloto', ['el piloto', 'pilot'])),

  mix('gastronomia', 'choice', q.c('gastronomia', 2, 'El «mise en place» en cocina es…', ['Tener ingredientes y utensilios listos antes de fuego', 'Un tipo de horno', 'Un corte de carne', 'Una salsa madre'], 'Tener ingredientes y utensilios listos antes de fuego')),
  mix('gastronomia', 'truefalse', q.tf('gastronomia', 2, 'El sofrito mediterráneo parte a menudo de cebolla y tomate (u hortalizas similares) en aceite.', true)),
  mix('gastronomia', 'numeric', q.n('gastronomia', 2, '¿A cuántos grados Celsius se solidifica el agua pura a 1 atm (de libro)?', 0)),
  mix('gastronomia', 'odd', q.odd('gastronomia', 2, '¿Cuál NO es una salsa madre clásica francesa?', ['Bechamel', 'Española', 'Velouté', 'Kétchup'], 'Kétchup')),
  mix('gastronomia', 'order', q.ord('gastronomia', 2, 'Ordena el servicio de un menú clásico de más temprano a más tardío.', ['Aperitivo', 'Entrante', 'Principal', 'Postre'], ['Aperitivo', 'Entrante', 'Principal', 'Postre'])),
  mix('gastronomia', 'open', q.op('gastronomia', 2, '¿Cómo se llama el azúcar cocido a punto de caramelo oscuro?', 'caramelo', ['el caramelo'])),

  mix('naturaleza', 'choice', q.c('naturaleza', 2, 'La simbiosis en sentido amplio es…', ['Una relación estrecha y duradera entre especies distintas', 'Solo depredación', 'Solo competencia', 'Un tipo de roca'], 'Una relación estrecha y duradera entre especies distintas')),
  mix('naturaleza', 'truefalse', q.tf('naturaleza', 2, 'Los anfibios suelen necesitar agua o humedad para parte de su ciclo.', true)),
  mix('naturaleza', 'numeric', q.n('naturaleza', 2, '¿Cuántas cámaras tiene el corazón de un pez óseo típico (de libro escolar)?', 2)),
  mix('naturaleza', 'odd', q.odd('naturaleza', 2, '¿Cuál NO es un bioma terrestre clásico?', ['Tundra', 'Taiga', 'Sabana', 'Dorsal oceánica'], 'Dorsal oceánica')),
  mix('naturaleza', 'order', q.ord('naturaleza', 2, 'Ordena la metamorfosis completa de un insecto.', ['Huevo', 'Larva', 'Pupa', 'Adulto'], ['Huevo', 'Larva', 'Pupa', 'Adulto'])),
  mix('naturaleza', 'open', q.op('naturaleza', 2, '¿Cómo se llama el tejido vegetal que transporta el agua desde la raíz?', 'xilema', ['el xilema', 'xylem'])),

  mix('espana', 'choice', q.c('espana', 2, 'El Tribunal Constitucional español tiene su sede en…', ['Madrid', 'Barcelona', 'Sevilla', 'Valencia'], 'Madrid')),
  mix('espana', 'truefalse', q.tf('espana', 2, 'Ceuta y Melilla son ciudades autónomas, no comunidades autónomas al uso de las 17.', true)),
  mix('espana', 'numeric', q.n('espana', 1, '¿Cuántas provincias tiene Andalucía?', 8)),
  mix('espana', 'odd', q.odd('espana', 2, '¿Cuál NO es una lengua cooficial en alguna comunidad autónoma?', ['Catalán', 'Gallego', 'Euskera', 'Suajili'], 'Suajili')),
  mix('espana', 'order', q.ord('espana', 2, 'Ordena estos estatutos de autonomía de más antiguo a más reciente en su primera aprobación democrática: País Vasco, Cataluña, Andalucía.', ['País Vasco (1979)', 'Cataluña (1979)', 'Andalucía (1981)'], ['País Vasco (1979)', 'Cataluña (1979)', 'Andalucía (1981)'])),
  mix('espana', 'open', q.op('espana', 2, '¿Cómo se llama la norma fundamental española de 1978?', 'Constitución', ['constitucion de 1978', 'constitucion española', 'la constitucion'])),
];
