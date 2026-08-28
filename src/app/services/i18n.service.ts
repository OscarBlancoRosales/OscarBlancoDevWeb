import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type Lang = 'es' | 'en';

const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // === SHARED / MENU ===
  'menu.terminal': { es: 'terminal', en: 'terminal' },
  'menu.scrumPoker': { es: 'scrum-poker', en: 'scrum-poker' },
  'menu.dniGenerator': { es: 'dni-generator', en: 'dni-generator' },
  'menu.qrGenerator': { es: 'qr-generator', en: 'qr-generator' },
  'menu.encoderDecoder': { es: 'encoder-decoder', en: 'encoder-decoder' },
  'menu.codeFormatter': { es: 'code-formatter', en: 'code-formatter' },
  'menu.colorPicker': { es: 'color-picker', en: 'color-picker' },
  'menu.regexTester': { es: 'regex-tester', en: 'regex-tester' },
  'menu.loremGenerator': { es: 'lorem-generator', en: 'lorem-generator' },
  'menu.timestampConverter': { es: 'timestamp-converter', en: 'timestamp-converter' },
  'menu.uuidGenerator': { es: 'uuid-generator', en: 'uuid-generator' },
  'menu.iconGenerator': { es: 'icon-generator', en: 'icon-generator' },

  // === COMMON ===
  'common.copy': { es: '⧉ Copiar', en: '⧉ Copy' },
  'common.copied': { es: '✓ copiado', en: '✓ copied' },
  'common.clear': { es: 'Limpiar', en: 'Clear' },
  'common.generate': { es: 'Generar', en: 'Generate' },
  'common.convert': { es: 'Convertir', en: 'Convert' },
  'common.now': { es: 'Ahora', en: 'Now' },
  'common.date': { es: 'Fecha', en: 'Date' },
  'common.time': { es: 'Hora', en: 'Time' },
  'common.type': { es: 'Tipo', en: 'Type' },
  'common.amount': { es: 'Cantidad', en: 'Amount' },
  'common.result': { es: 'Resultado', en: 'Result' },
  'common.error': { es: 'Error', en: 'Error' },
  'common.words': { es: 'palabras', en: 'words' },
  'common.characters': { es: 'caracteres', en: 'characters' },

  // === CONSOLE ===
  'console.title': { es: 'OBR Terminal', en: 'OBR Terminal' },
  'console.role': { es: 'Rol', en: 'Role' },
  'console.experience': { es: 'Experiencia', en: 'Experience' },
  'console.specialization': { es: 'Especialización', en: 'Specialization' },
  'console.databases': { es: 'Bases de Datos', en: 'Databases' },
  'console.location': { es: 'Ubicación', en: 'Location' },
  'console.spain': { es: 'España', en: 'Spain' },
  'console.aboutPassion': { es: 'Apasionado por crear soluciones innovadoras', en: 'Passionate about creating innovative solutions' },
  'console.projectsTitle': { es: '🚀 Proyectos destacados:', en: '🚀 Featured projects:' },
  'console.projectGames': {
    es: '  • Juegos - RISK completo con IA, mapas reales y modo histórico',
    en: '  • Games - Full RISK with AI, real maps and a historical scenario',
  },
  'console.projectPoker': { es: '  • Scrum Poker App - Aplicación de planning poker', en: '  • Scrum Poker App - Planning poker application' },
  'console.projectDni': { es: '  • DNI Generator - Generador de DNIs español', en: '  • DNI Generator - Spanish ID generator' },
  'console.projectPortfolio': { es: '  • Portfolio Web - Este portfolio interactivo', en: '  • Portfolio Web - This interactive portfolio' },
  'console.projectMultiple': { es: '  • Múltiples proyectos en C# y Flutter', en: '  • Multiple projects in C# and Flutter' },
  'console.unknownCmd': { es: "Comando no reconocido: '{cmd}'. Escribe 'help' para ver comandos disponibles.", en: "Unknown command: '{cmd}'. Type 'help' to see available commands." },
  'console.expYears': { es: '2+ años', en: '2+ years' },

  // === CONSOLA v2: descripciones de comandos ===
  'cmd.juegos': { es: 'Mesa de juegos: RISK con IA y mapas reales', en: 'Game table: RISK with AI and real maps' },
  'cmd.poker': { es: 'Planning poker para estimar en equipo', en: 'Planning poker for team estimation' },
  'cmd.dni': { es: 'Genera DNI y NIE españoles válidos', en: 'Generate valid Spanish DNI and NIE' },
  'cmd.qr': { es: 'Convierte cualquier texto en un código QR', en: 'Turn any text into a QR code' },
  'cmd.decoder': { es: 'Codifica y descodifica Base64, URL y más', en: 'Encode and decode Base64, URL and more' },
  'cmd.formatter': { es: 'Formatea JSON, XML, SQL y compañía', en: 'Format JSON, XML, SQL and friends' },
  'cmd.color': { es: 'Selector de color con HEX, RGB y HSL', en: 'Color picker with HEX, RGB and HSL' },
  'cmd.regex': { es: 'Prueba expresiones regulares en vivo', en: 'Test regular expressions live' },
  'cmd.lorem': { es: 'Texto de relleno a la medida', en: 'Placeholder text on demand' },
  'cmd.timestamp': { es: 'Traduce entre epoch y fecha humana', en: 'Translate between epoch and human dates' },
  'cmd.uuid': { es: 'Identificadores únicos v4 al vuelo', en: 'Unique v4 identifiers on the fly' },
  'cmd.iconos': { es: 'Iconos de app para iOS y Android', en: 'App icons for iOS and Android' },
  'cmd.throwdown': { es: 'Cronómetro de WODs del Tomelloso Throwdown', en: 'Tomelloso Throwdown WOD timer' },
  'cmd.login': { es: 'Identificarse en el sitio', en: 'Sign in to the site' },
  'cmd.home': { es: 'Volver a esta terminal', en: 'Back to this terminal' },
  'cmd.whoami': { es: 'Quién hay detrás de todo esto', en: 'Who is behind all this' },
  'cmd.stack': { es: 'Tecnologías con las que trabajo', en: 'Technologies I work with' },
  'cmd.projects': { es: 'Proyectos destacados', en: 'Featured projects' },
  'cmd.contact': { es: 'Cómo dar conmigo', en: 'How to reach me' },
  'cmd.social': { es: 'Enlaces a mis perfiles', en: 'Links to my profiles' },
  'cmd.neofetch': { es: 'La tarjeta de presentación del sistema', en: 'The system business card' },
  'cmd.help': { es: 'Esta ayuda, o la de un comando concreto', en: 'This help, or help for one command' },
  'cmd.ls': { es: 'Lista las secciones del sitio', en: 'List the sections of the site' },
  'cmd.cd': { es: 'Viaja a una sección', en: 'Travel to a section' },
  'cmd.open': { es: 'Abre un enlace externo', en: 'Open an external link' },
  'cmd.theme': { es: 'Cambia la piel de la terminal', en: 'Change the terminal skin' },
  'cmd.lang': { es: 'Cambia el idioma del sitio', en: 'Change the site language' },
  'cmd.history': { es: 'Comandos que ya has escrito', en: 'Commands you already typed' },
  'cmd.date': { es: 'Fecha y hora ahora mismo', en: 'Date and time right now' },
  'cmd.echo': { es: 'Repite lo que le digas', en: 'Repeat whatever you say' },
  'cmd.clear': { es: 'Deja la pantalla en blanco', en: 'Wipe the screen clean' },
  'cmd.matrix': { es: 'Sigue al conejo blanco', en: 'Follow the white rabbit' },
  'cmd.sudo': { es: 'Con grandes poderes...', en: 'With great power...' },
  'cmd.coffee': { es: 'Combustible', en: 'Fuel' },
  'cmd.vim': { es: 'Suerte saliendo', en: 'Good luck getting out' },
  'cmd.exit': { es: 'Intento de fuga', en: 'Escape attempt' },
  'cmd.42': { es: 'La respuesta', en: 'The answer' },

  // === CONSOLA v2: mensajes ===
  'console.bootWelcome': {
    es: 'Terminal lista. {sections} secciones esperando. Escribe help para verlas.',
    en: 'Terminal ready. {sections} sections waiting. Type help to see them.',
  },
  'console.bootTip': { es: 'Tab completa · flechas para el historial · Ctrl+K abre la paleta', en: 'Tab completes · arrows for history · Ctrl+K opens the palette' },
  'console.opening': { es: 'Abriendo {route} ...', en: 'Opening {route} ...' },
  'console.didYouMean': { es: "No existe '{cmd}'. ¿Quisiste decir '{guess}'?", en: "No such command '{cmd}'. Did you mean '{guess}'?" },
  'console.groupNav': { es: 'NAVEGACIÓN', en: 'NAVIGATION' },
  'console.groupInfo': { es: 'SOBRE MÍ', en: 'ABOUT ME' },
  'console.groupSystem': { es: 'SISTEMA', en: 'SYSTEM' },
  'console.helpFooter': { es: "Escribe el nombre de cualquier sección para viajar. 'help <comando>' para el detalle.", en: "Type any section name to travel there. 'help <command>' for details." },
  'console.helpNoSuch': { es: "No hay ayuda para '{cmd}': ese comando no existe.", en: "No help for '{cmd}': no such command." },
  'console.helpAliasesLine': { es: '  También vale: {aliases}', en: '  Also works as: {aliases}' },
  'console.helpUsageLine': { es: '  Uso: {usage}', en: '  Usage: {usage}' },
  'console.uptimeLine': { es: 'Sesión: {secs}s', en: 'Session: {secs}s' },
  'console.sectionsTitle': { es: 'Secciones disponibles', en: 'Available sections' },
  'console.themeSet': { es: 'Tema cambiado a {theme}.', en: 'Theme changed to {theme}.' },
  'console.themeUnknown': { es: "No existe el tema '{theme}'.", en: "No such theme '{theme}'." },
  'console.themesTitle': { es: 'Temas disponibles', en: 'Available themes' },
  'console.themeHowTo': { es: "Cámbialo con 'theme <nombre>'.", en: "Change it with 'theme <name>'." },
  'console.themeInUse': { es: '← el que llevas puesto', en: '← the one you are using' },
  'console.themeDesc.dev': { es: 'Verde sobre negro, el de la casa', en: 'Green on black, the house one' },
  'console.themeDesc.ai': { es: 'Cálido, coral sobre marrón oscuro', en: 'Warm, coral over dark brown' },
  'console.themeDesc.amber': { es: 'Ámbar de monitor antiguo', en: 'Old monitor amber' },
  'console.themeDesc.ice': { es: 'Azul frío de madrugada', en: 'Cold small-hours blue' },
  'console.themeDesc.matrix': { es: 'Verde fosforito, sigue al conejo', en: 'Phosphor green, follow the rabbit' },
  'console.themeDesc.vaporwave': { es: 'El que te ganaste', en: 'The one you earned' },
  'cmd.easteregg': { es: 'Destapa todos los comandos ocultos', en: 'Reveal every hidden command' },
  'console.eggsTitle': { es: 'Comandos ocultos', en: 'Hidden commands' },
  'console.eggsFooter': {
    es: 'Ninguno sale en «help». Ahora ya no tienes excusa.',
    en: 'None of these show up in «help». No more excuses.',
  },
  'console.langSet': { es: 'Idioma cambiado a {lang}.', en: 'Language changed to {lang}.' },
  'console.langUnknown': { es: "Idioma '{lang}' no soportado. Usa es o en.", en: "Language '{lang}' not supported. Use es or en." },
  'console.needsArg': { es: "'{cmd}' necesita un argumento. Uso: {usage}", en: "'{cmd}' needs an argument. Usage: {usage}" },
  'console.openUnknown': { es: "No conozco el enlace '{target}'. Prueba: github, linkedin, email, web.", en: "Unknown link '{target}'. Try: github, linkedin, email, web." },
  'console.opened': { es: 'Abriendo {target} en otra pestaña...', en: 'Opening {target} in a new tab...' },
  'console.historyEmpty': { es: 'Todavía no has escrito nada.', en: 'You have not typed anything yet.' },
  'console.candidates': { es: 'Candidatos:', en: 'Candidates:' },
  'console.stackTitle': { es: 'Stack', en: 'Stack' },
  'console.contactTitle': { es: 'Contacto', en: 'Contact' },
  'console.sudo': { es: 'Buen intento. Aquí no hay root que valga.', en: 'Nice try. No root around here.' },
  'console.coffee': { es: 'Sirviendo café... error 418: soy una tetera.', en: 'Brewing coffee... error 418: I am a teapot.' },
  'console.vim': { es: 'Para salir: :q! ... o cerrar la pestaña, como todo el mundo.', en: 'To exit: :q! ... or close the tab, like everyone else.' },
  'console.exit': { es: 'No puedes salir de la terminal. La terminal sale de ti.', en: 'You cannot exit the terminal. The terminal exits you.' },
  'console.answer': { es: 'La respuesta a la vida, el universo y todo lo demás.', en: 'The answer to life, the universe and everything.' },
  'console.matrixOn': { es: 'Sigue al conejo blanco...', en: 'Follow the white rabbit...' },
  'console.placeholder': { es: 'Escribe un comando o el nombre de una sección...', en: 'Type a command or a section name...' },
  'console.paletteTitle': { es: 'Paleta de comandos', en: 'Command palette' },
  'console.palettePlaceholder': { es: 'Buscar sección o comando...', en: 'Search section or command...' },
  'console.paletteEmpty': { es: 'Nada que se parezca a eso.', en: 'Nothing looks like that.' },
  'console.online': { es: 'online', en: 'online' },
  'console.backHome': { es: 'Volver a la terminal', en: 'Back to the terminal' },
  'console.uptime': { es: 'Sesión', en: 'Session' },

  // === CONSOLA v2: juego, premios y ventana ===
  'cmd.snake': { es: 'La serpiente de toda la vida', en: 'The good old snake' },
  'cmd.hack': { es: 'Acceso no autorizado (es broma)', en: 'Unauthorized access (just kidding)' },
  'cmd.glitch': { es: 'Interferencias', en: 'Interference' },
  'cmd.sl': { es: 'Por escribir mal ls', en: 'For mistyping ls' },
  'cmd.cowsay': { es: 'Una vaca dice lo que le mandes', en: 'A cow says whatever you want' },
  'cmd.fortune': { es: 'Sabiduría de galleta', en: 'Fortune cookie wisdom' },
  'cmd.banner': { es: 'Tu texto en letras gigantes', en: 'Your text in giant letters' },
  'cmd.top': { es: 'Qué se está cociendo aquí dentro', en: 'What is cooking in here' },

  'console.snakeStart': {
    es: 'SNAKE cargado. Flechas o WASD para moverte, Esc para salir.',
    en: 'SNAKE loaded. Arrows or WASD to move, Esc to quit.',
  },
  'console.snakeEnd': { es: 'Partida terminada. Puntos: {score} · Récord: {best}', en: 'Game over. Score: {score} · Best: {best}' },
  'console.snakeScore': { es: 'Puntos', en: 'Score' },
  'console.snakeBest': { es: 'Récord', en: 'Best' },
  'console.snakeOver': { es: 'GAME OVER', en: 'GAME OVER' },
  'console.snakeAgain': { es: 'Otra vez (Enter)', en: 'Again (Enter)' },
  'console.snakeQuit': { es: 'Salir', en: 'Quit' },

  'cmd.runner': { es: 'Corre esquivando bugs, virus y 404', en: 'Run dodging bugs, viruses and 404s' },
  'console.runStart': {
    es: 'BUG RUNNER cargado. Espacio o ↑ para saltar, ↓ para agacharte, Esc para salir.',
    en: 'BUG RUNNER loaded. Space or ↑ to jump, ↓ to duck, Esc to quit.',
  },
  'console.runEnd': { es: 'Carrera terminada. {score} m · Récord: {best} m', en: 'Run over. {score} m · Best: {best} m' },
  'console.runOver': { es: 'BUILD FAILED', en: 'BUILD FAILED' },
  'console.runJump': { es: '▲ Saltar', en: '▲ Jump' },
  'console.runDuck': { es: '▼ Agachar', en: '▼ Duck' },
  'console.runShield': { es: '☕ escudo', en: '☕ shield' },

  'console.matrixHint': { es: 'pulsa o toca para volver', en: 'press or tap to come back' },
  'console.glitch': { es: 'S3ñ4l p3rd1d4... rec4l1br4nd0...', en: 'S1gn4l l0st... rec4l1br4t1ng...' },
  'console.trainGone': { es: 'Ahí va. Eso pasa por escribir mal «ls».', en: 'There it goes. That is what you get for mistyping «ls».' },
  'console.konami': { es: '↑↑↓↓←→←→BA · Has desbloqueado el tema secreto.', en: '↑↑↓↓←→←→BA · You unlocked the secret theme.' },
  'console.konamiHint': { es: 'De regalo: prueba a escribir «snake».', en: 'A gift: try typing «snake».' },

  'console.winFold': { es: 'Plegar la salida', en: 'Fold the output' },
  'console.winFull': { es: 'Pantalla completa', en: 'Fullscreen' },
  'console.winOff': { es: 'Apagar el monitor', en: 'Turn the monitor off' },
  'console.poweredOff': { es: 'pulsa o toca para encender', en: 'press or tap to power on' },

  // === DNI GENERATOR ===
  'dni.title': { es: '> DNI Generator', en: '> DNI Generator' },
  'dni.subtitle': { es: 'Generador de DNIs españoles válidos para pruebas', en: 'Valid Spanish ID generator for testing' },
  'dni.generated': { es: 'DNI Generado:', en: 'Generated DNI:' },
  'dni.generating': { es: 'Generando...', en: 'Generating...' },
  'dni.generateNew': { es: 'Generar Nuevo', en: 'Generate New' },
  'dni.copiedMsg': { es: '✓ DNI copiado al portapapeles', en: '✓ DNI copied to clipboard' },
  'dni.info': { es: 'Info:', en: 'Info:' },
  'dni.infoText': { es: 'DNIs con formato español válido. Letra calculada automáticamente. Solo para pruebas/desarrollo.', en: 'Valid Spanish format DNIs. Letter calculated automatically. For testing/development only.' },

  // === QR GENERATOR ===
  'qr.title': { es: '> QR Generator', en: '> QR Generator' },
  'qr.subtitle': { es: 'Genera códigos QR desde texto o URLs', en: 'Generate QR codes from text or URLs' },
  'qr.placeholder': { es: 'Introduce texto o URL para generar QR...', en: 'Enter text or URL to generate QR...' },
  'qr.generate': { es: 'Generar QR', en: 'Generate QR' },
  'qr.download': { es: '⬇ Descargar', en: '⬇ Download' },

  // === DECODER ===
  'decoder.title': { es: '> Encoder / Decoder', en: '> Encoder / Decoder' },
  'decoder.subtitle': { es: 'Codifica y decodifica texto en múltiples formatos', en: 'Encode and decode text in multiple formats' },
  'decoder.mode': { es: 'Modo', en: 'Mode' },
  'decoder.swap': { es: 'Dar la vuelta', en: 'Swap' },
  'decoder.swapHint': { es: 'Manda el resultado a la entrada y cambia el sentido', en: 'Send the result to the input and flip the direction' },
  'decoder.encode': { es: 'Codificar', en: 'Encode' },
  'decoder.decode': { es: 'Decodificar', en: 'Decode' },
  'decoder.inputPlaceholder': { es: 'Introduce el texto...', en: 'Enter text...' },
  'decoder.outputPlaceholder': { es: 'Resultado...', en: 'Result...' },

  // === FORMATTER ===
  'formatter.title': { es: '> Code Formatter', en: '> Code Formatter' },
  'formatter.subtitle': { es: 'Formatea y minifica código en varios lenguajes', en: 'Format and minify code in various languages' },
  'formatter.savings': { es: 'De {from} a {to} caracteres · {pct}% menos', en: 'From {from} to {to} characters · {pct}% smaller' },
  'formatter.format': { es: 'Formatear', en: 'Format' },
  'formatter.minify': { es: 'Minificar', en: 'Minify' },
  'formatter.inputPlaceholder': { es: 'Pega tu código aquí...', en: 'Paste your code here...' },
  'formatter.outputPlaceholder': { es: 'Resultado formateado...', en: 'Formatted result...' },

  // === COLOR PICKER ===
  'color.title': { es: '> Color Picker', en: '> Color Picker' },
  'color.subtitle': { es: 'Conversor de colores HEX / RGB / HSL con paleta', en: 'HEX / RGB / HSL color converter with palette' },
  'color.shades': { es: 'Escala de luminosidad', en: 'Lightness scale' },
  'color.harmony': { es: 'Colores que combinan', en: 'Matching colors' },
  'color.base': { es: 'base', en: 'base' },
  'color.complement': { es: 'opuesto', en: 'opposite' },
  'color.random': { es: 'Aleatorio', en: 'Random' },
  'color.palette': { es: 'Paleta de luminosidad', en: 'Lightness palette' },

  // === REGEX TESTER ===
  'regex.title': { es: '> Regex Tester', en: '> Regex Tester' },
  'regex.subtitle': { es: 'Prueba expresiones regulares en tiempo real con resaltado de coincidencias', en: 'Test regular expressions in real time with match highlighting' },
  'regex.commonPatterns': { es: 'Patrones comunes:', en: 'Common patterns:' },
  'regex.expression': { es: 'Expresión Regular', en: 'Regular Expression' },
  'regex.placeholder': { es: 'Escribe tu regex...', en: 'Write your regex...' },
  'regex.testInput': { es: 'Texto de prueba', en: 'Test text' },
  'regex.testPlaceholder': { es: 'Introduce el texto donde buscar coincidencias...', en: 'Enter text to search for matches...' },
  'regex.matches': { es: 'Coincidencias', en: 'Matches' },
  'regex.match': { es: 'coincidencia', en: 'match' },
  'regex.matchPlural': { es: 'coincidencias', en: 'matches' },

  // === LOREM GENERATOR ===
  'lorem.title': { es: '> Lorem Ipsum Generator', en: '> Lorem Ipsum Generator' },
  'lorem.subtitle': { es: 'Genera texto placeholder para tus diseños y maquetas', en: 'Generate placeholder text for your designs and mockups' },
  'lorem.paragraphs': { es: 'Párrafos', en: 'Paragraphs' },
  'lorem.sentences': { es: 'Frases', en: 'Sentences' },
  'lorem.words': { es: 'Palabras', en: 'Words' },
  'lorem.asList': { es: 'Como lista', en: 'As a list' },
  'lorem.asHtml': { es: 'Con etiquetas HTML', en: 'With HTML tags' },
  'qr.presets': { es: 'plantillas', en: 'presets' },
  'qr.size': { es: 'tamaño', en: 'size' },
  'qr.correction': { es: 'corrección', en: 'correction' },
  'qr.transparent': { es: 'Fondo transparente', en: 'Transparent background' },
  'qr.copyImage': { es: '⧉ Copiar imagen', en: '⧉ Copy image' },
  'qr.empty': { es: 'Escribe algo arriba y el código aparece solo.', en: 'Type something above and the code shows up on its own.' },
  'qr.tooLong': { es: 'Demasiado texto para un QR: prueba a acortarlo.', en: 'Too much text for a QR: try making it shorter.' },
  'qr.copyFailed': { es: 'Este navegador no deja copiar imágenes. Descárgalo.', en: 'This browser will not copy images. Download it instead.' },
  'lorem.startWith': { es: 'Empezar con "Lorem ipsum..."', en: 'Start with "Lorem ipsum..."' },

  // === TIMESTAMP ===
  'ts.title': { es: '> Timestamp Converter', en: '> Timestamp Converter' },
  'ts.subtitle': { es: 'Convierte entre Unix, millis, .NET Ticks, ISO 8601 y más', en: 'Convert between Unix, millis, .NET Ticks, ISO 8601 and more' },
  'ts.rightNow': { es: 'ahora mismo', en: 'right now' },
  'ts.pickDateTime': { es: 'Seleccionar fecha y hora', en: 'Select date and time' },
  'ts.convertValue': { es: 'Convertir valor', en: 'Convert value' },
  'ts.invalidValue': { es: 'Valor inválido para el formato seleccionado', en: 'Invalid value for selected format' },
  'ts.convertError': { es: 'Error al convertir. Verifica el formato.', en: 'Conversion error. Check the format.' },
  'ts.seconds': { es: 'Unix (segundos)', en: 'Unix (seconds)' },
  'ts.day': { es: 'Día', en: 'Day' },
  'ts.relative': { es: 'Relativo', en: 'Relative' },
  'ts.agoSeconds': { es: 'hace unos segundos', en: 'a few seconds ago' },
  'ts.inSeconds': { es: 'en unos segundos', en: 'in a few seconds' },
  'ts.ago': { es: 'hace ', en: '' },
  'ts.in': { es: 'en ', en: 'in ' },
  'ts.minutes': { es: ' minutos', en: ' minutes ago' },
  'ts.hours': { es: ' horas', en: ' hours ago' },
  'ts.days': { es: ' días', en: ' days ago' },
  'ts.months': { es: ' meses', en: ' months ago' },
  'ts.years': { es: ' años', en: ' years ago' },
  'ts.inMinutes': { es: ' minutos', en: ' minutes' },
  'ts.inHours': { es: ' horas', en: ' hours' },
  'ts.inDays': { es: ' días', en: ' days' },
  'ts.inMonths': { es: ' meses', en: ' months' },
  'ts.inYears': { es: ' años', en: ' years' },

  // === UUID ===
  'uuid.title': { es: '> UUID Generator', en: '> UUID Generator' },
  'uuid.subtitle': { es: 'Genera identificadores únicos universales (UUID v4)', en: 'Generate universally unique identifiers (UUID v4)' },
  'uuid.uppercase': { es: 'MAYÚSCULAS', en: 'UPPERCASE' },
  'uuid.noDashes': { es: 'Sin guiones', en: 'No dashes' },
  'uuid.copyAll': { es: '⧉ Copiar todo', en: '⧉ Copy all' },
  'uuid.copiedAll': { es: '✓ Copiado todo', en: '✓ Copied all' },
  'uuid.braces': { es: 'Entre llaves', en: 'Braces' },
  'uuid.clickToCopy': { es: 'toca uno para copiarlo', en: 'tap one to copy it' },
  'uuid.aboutV4': {
    es: 'v4: azar puro. El de toda la vida, perfecto si el orden da igual.',
    en: 'v4: pure randomness. The classic one, fine when order does not matter.',
  },
  'uuid.aboutV7': {
    es: 'v7: lleva la hora delante, así que ordenarlos por texto es ordenarlos por fecha. Va mejor como clave primaria.',
    en: 'v7: time goes first, so sorting them as text sorts them by date. Better as a primary key.',
  },

  // === ICON GENERATOR ===
  'icon.title': { es: '> App Icon Generator', en: '> App Icon Generator' },
  'icon.subtitle': { es: 'Genera iconos para iOS (AppIcon.appiconset) y Android (mipmap) desde una imagen', en: 'Generate icons for iOS (AppIcon.appiconset) and Android (mipmap) from an image' },
  'icon.dragHere': { es: 'Arrastra una imagen aquí o', en: 'Drag an image here or' },
  'icon.selectFile': { es: 'Seleccionar archivo', en: 'Select file' },
  'icon.hint': { es: 'PNG recomendado, mínimo 1024x1024', en: 'PNG recommended, minimum 1024x1024' },
  'icon.changeImage': { es: 'Cambiar imagen', en: 'Change image' },
  'icon.generateAll': { es: 'Generar Todo (iOS + Android)', en: 'Generate All (iOS + Android)' },
  'icon.iosOnly': { es: 'Solo iOS', en: 'iOS Only' },
  'icon.androidOnly': { es: 'Solo Android', en: 'Android Only' },
  'icon.compressing': { es: 'Comprimiendo ZIP...', en: 'Compressing ZIP...' },
  'icon.downloadDone': { es: 'Descarga completada', en: 'Download complete' },
  'icon.doneMsg': { es: 'Iconos generados y descargados correctamente', en: 'Icons generated and downloaded successfully' },
  'icon.errorGenerate': { es: 'Error al generar: ', en: 'Generation error: ' },
  'icon.invalidImage': { es: 'Selecciona un archivo de imagen válido (PNG, JPG, SVG...)', en: 'Select a valid image file (PNG, JPG, SVG...)' },
  'icon.loadError': { es: 'No se pudo cargar la imagen', en: 'Could not load the image' },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private currentLang: Lang = 'es';
  langChange$ = new Subject<Lang>();

  constructor() {
    const saved = localStorage.getItem('app_lang') as Lang;
    if (saved === 'es' || saved === 'en') {
      this.currentLang = saved;
    }
  }

  get lang(): Lang {
    return this.currentLang;
  }

  setLang(lang: Lang): void {
    this.currentLang = lang;
    localStorage.setItem('app_lang', lang);
    this.langChange$.next(lang);
  }

  t(key: string, params?: Record<string, string>): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    let text = entry[this.currentLang] || entry['es'] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  }
}
