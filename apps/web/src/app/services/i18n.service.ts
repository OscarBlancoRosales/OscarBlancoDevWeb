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
  'cmd.registro': { es: 'Crear una cuenta', en: 'Create an account' },
  'cmd.terminal': { es: 'La terminal a pantalla completa', en: 'The full-screen terminal' },
  'cmd.home': { es: 'Volver al escritorio', en: 'Back to the desktop' },
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

  // === ESCRITORIO ===
  'desk.terminal': { es: 'Terminal', en: 'Terminal' },
  'desk.games': { es: 'Juegos', en: 'Games' },
  'desk.poker': { es: 'Scrum Poker', en: 'Scrum Poker' },
  'desk.qr': { es: 'Códigos QR', en: 'QR codes' },
  'desk.dni': { es: 'DNI y NIE', en: 'Spanish IDs' },
  'desk.color': { es: 'Color', en: 'Colour' },
  'desk.regex': { es: 'Regex', en: 'Regex' },
  'desk.base64': { es: 'Base64', en: 'Base64' },
  'desk.format': { es: 'Formatear', en: 'Format' },
  'desk.lorem': { es: 'Lorem', en: 'Lorem' },
  'desk.timestamp': { es: 'Fechas', en: 'Dates' },
  'desk.uuid': { es: 'UUID', en: 'UUID' },
  'desk.icons': { es: 'Iconos de app', en: 'App icons' },
  'desk.about': { es: 'Sobre mí', en: 'About me' },
  'desk.projects': { es: 'Proyectos', en: 'Projects' },
  'desk.contact': { es: 'Contacto', en: 'Contact' },
  'desk.start': { es: 'Inicio', en: 'Start' },
  'desk.menuSub': { es: 'Full Stack Developer', en: 'Full Stack Developer' },
  'desk.nextTheme': { es: 'Cambiar el color de todo', en: 'Change the colours' },
  'desk.dismiss': { es: 'Quitar este aviso', en: 'Dismiss' },
  'desk.search': { es: 'Buscar', en: 'Search' },
  'desk.searchPlaceholder': { es: 'Escribe para buscar herramientas...', en: 'Type here to search tools...' },
  'desk.noResults': { es: 'Nada que se parezca a eso.', en: 'Nothing looks like that.' },
  'desk.language': { es: 'Idioma', en: 'Language' },
  'desk.groupHome': { es: 'Quién soy', en: 'Who I am' },
  'desk.groupTools': { es: 'Herramientas', en: 'Tools' },
  'desk.groupPlay': { es: 'Para jugar', en: 'To play' },
  'desk.groupSystem': { es: 'Sistema', en: 'System' },
  'desk.admin': { es: 'Administración', en: 'Administration' },
  'desk.signIn': { es: 'Entrar en tu cuenta', en: 'Log in to your account' },
  'desk.signOut': { es: 'Cerrar sesión', en: 'Log out' },
  'desk.account': { es: 'Cuenta', en: 'Account' },

  // === SCRUM POKER ===
  'poker.invite': { es: 'Invitar', en: 'Invite' },
  'poker.leave': { es: 'Salir', en: 'Leave' },
  'poker.players': { es: 'Jugadores', en: 'Players' },
  'poker.voted': { es: 'Votó', en: 'Voted' },
  'poker.waiting': { es: 'Esperando...', en: 'Waiting...' },
  'poker.lowest': { es: 'Voto más bajo', en: 'Lowest vote' },
  'poker.highest': { es: 'Voto más alto', en: 'Highest vote' },
  'poker.outlier': { es: 'Se sale del grupo', en: 'Off the group' },
  'poker.deviation': { es: 'Se desvía', en: 'Drifting' },
  'poker.average': { es: 'Media', en: 'Average' },
  'poker.range': { es: 'Rango', en: 'Range' },
  'poker.votes': { es: 'Votos', en: 'Votes' },
  'poker.polarized': { es: 'Dos visiones distintas', en: 'Two different views' },
  'poker.low': { es: 'Bajos', en: 'Low' },
  'poker.high': { es: 'Altos', en: 'High' },
  'poker.reveal': { es: 'Revelar', en: 'Reveal' },
  'poker.newRound': { es: 'Nueva ronda', en: 'New round' },
  'poker.onlyHost': {
    es: 'Solo quien creó la sala puede revelar los votos',
    en: 'Only whoever created the room can reveal the votes',
  },
  'poker.customVote': { es: 'Otro número', en: 'Another number' },
  'poker.clearVote': { es: 'Quitar mi voto', en: 'Clear my vote' },
  'poker.coffee': { es: 'Necesito un café', en: 'I need a coffee' },
  'poker.joint': { es: 'Esto no hay quien lo estime', en: 'No way to estimate this' },
  'poker.cantJoin': {
    es: 'No se ha podido entrar en la sala. Puede que ya no exista.',
    en: 'Could not join the room. It may no longer exist.',
  },

  // El estado del consenso, según lo repartidos que estén los votos
  'poker.stWaiting': { es: 'Esperando', en: 'Waiting' },
  'poker.msgWaiting': { es: 'Faltan votos', en: 'Votes missing' },
  'poker.stPerfect': { es: 'Consenso total', en: 'Full consensus' },
  'poker.msgPerfect': { es: 'Todos de acuerdo', en: 'Everyone agrees' },
  'poker.stConsensus': { es: 'Consenso', en: 'Consensus' },
  'poker.msgConsensus': { es: 'Buen acuerdo', en: 'Good agreement' },
  'poker.stSpread': { es: 'Dispersión', en: 'Spread' },
  'poker.msgSpread': { es: 'Hay diferencias', en: 'There are differences' },
  'poker.stDisagree': { es: 'Desacuerdo', en: 'Disagreement' },
  'poker.msgDisagree': { es: 'Hay que hablarlo', en: 'Worth talking it through' },

  // === CUENTA ===
  'cuenta.panel': { es: 'Cuenta', en: 'Account' },
  'cuenta.login': { es: 'Entrar', en: 'Log in' },
  'cuenta.loginSub': {
    es: 'Para tus salas de Scrum Poker y tus partidas',
    en: 'For your Scrum Poker rooms and your games',
  },
  'cuenta.email': { es: 'Correo', en: 'Email' },
  'cuenta.emailPh': { es: 'tu@correo.com', en: 'you@email.com' },
  'cuenta.emailRequired': { es: 'Hace falta un correo.', en: 'An email is needed.' },
  'cuenta.emailBad': {
    es: 'Ese correo no tiene buena pinta.',
    en: 'That email does not look right.',
  },
  'cuenta.password': { es: 'Contraseña', en: 'Password' },
  'cuenta.passwordPh': { es: 'Tu contraseña', en: 'Your password' },
  'cuenta.passwordRequired': { es: 'Hace falta una contraseña.', en: 'A password is needed.' },
  'cuenta.entering': { es: 'Entrando…', en: 'Logging in…' },
  'cuenta.noAccount': { es: '¿No tienes cuenta?', en: 'No account yet?' },
  'cuenta.createOne': { es: 'Créate una', en: 'Create one' },
  'cuenta.forgot': { es: 'He olvidado la contraseña', en: 'I forgot my password' },

  'cuenta.register': { es: 'Crear cuenta', en: 'Create account' },
  'cuenta.registerSub': {
    es: 'Para montar salas propias en Scrum Poker y RISK',
    en: 'To run your own rooms in Scrum Poker and RISK',
  },
  'cuenta.yourName': { es: 'Cómo te llamas', en: 'What you go by' },
  'cuenta.yourNamePh': { es: 'El nombre que verán los demás', en: 'The name others will see' },
  'cuenta.nameRequired': { es: 'Pon un nombre.', en: 'Put a name in.' },
  'cuenta.nameTooLong': { es: 'Como mucho 40 caracteres.', en: 'At most 40 characters.' },
  'cuenta.minChars': { es: 'Mínimo {n} caracteres', en: 'At least {n} characters' },
  'cuenta.minCharsDot': { es: 'Mínimo {n} caracteres.', en: 'At least {n} characters.' },
  'cuenta.creating': { es: 'Creando…', en: 'Creating…' },
  'cuenta.haveAccount': { es: '¿Ya tienes cuenta?', en: 'Already have an account?' },
  'cuenta.enterShort': { es: 'Entra', en: 'Log in' },
  'cuenta.registerDone': {
    es: 'Si ese correo no estaba dado de alta ya, te hemos enviado un enlace para activar la cuenta. Caduca en 24 horas.',
    en: 'If that email was not already registered, we have sent it a link to activate the account. It expires in 24 hours.',
  },
  'cuenta.whenActive': { es: 'Cuando la actives,', en: 'Once you activate it,' },
  'cuenta.enterHere': { es: 'entra por aquí', en: 'log in here' },
  // Quien se registra y no recibe el correo se queda fuera: no puede entrar, y
  // no se le ocurre que «he olvidado la contraseña» sirva también para activar
  // la cuenta. Hay que decírselo justo donde se queda esperando.
  'cuenta.notArriving': { es: '¿No te llega?', en: "Didn't it arrive?" },
  'cuenta.sameLinkActivates': {
    es: '— el mismo sirve para activar la cuenta.',
    en: '— the same link activates the account.',
  },

  'cuenta.forgotTitle': { es: 'Contraseña olvidada', en: 'Forgotten password' },
  'cuenta.forgotSub': {
    es: 'Te mandamos un enlace para ponerla de nuevo, y sirve también para activar una cuenta sin verificar',
    en: 'We will send you a link to set it again; it also activates an unverified account',
  },
  'cuenta.forgotDone': {
    es: 'Si ese correo tiene cuenta, le hemos mandado un enlace para cambiar la contraseña. Caduca en una hora.',
    en: 'If that email has an account, we have sent it a link to change the password. It expires in an hour.',
  },
  'cuenta.backToLogin': { es: 'Volver a entrar', en: 'Back to logging in' },
  'cuenta.sending': { es: 'Enviando…', en: 'Sending…' },
  'cuenta.sendLink': { es: 'Mandar el enlace', en: 'Send the link' },
  'cuenta.rememberNow': { es: 'Ya me acuerdo, entrar', en: 'I remember now, log in' },

  'cuenta.verifyTitle': { es: 'Verificar la cuenta', en: 'Verify the account' },
  'cuenta.checking': { es: 'Comprobando el enlace…', en: 'Checking the link…' },
  'cuenta.activated': { es: 'Cuenta activada. Ya puedes entrar.', en: 'Account activated. You can log in now.' },
  'cuenta.goLogin': { es: 'Ir a iniciar sesión', en: 'Go and log in' },
  'cuenta.expired': {
    es: 'Si el enlace ha caducado o ya lo habías usado,',
    en: 'If the link has expired or you had already used it,',
  },
  'cuenta.signupAgain': { es: 'vuelve a darte de alta', en: 'sign up again' },
  'cuenta.andWeSendNew': { es: 'y te mandamos uno nuevo.', en: 'and we will send you a new one.' },

  'cuenta.newPassTitle': { es: 'Contraseña nueva', en: 'New password' },
  'cuenta.newPassSub': {
    es: 'La anterior deja de valer en cuanto guardes esta',
    en: 'The old one stops working the moment you save this one',
  },
  'cuenta.repeat': { es: 'Repítela', en: 'Repeat it' },
  'cuenta.repeatPh': { es: 'La misma otra vez', en: 'The same one again' },
  'cuenta.noMatch': { es: 'Las dos no son iguales.', en: 'The two are not the same.' },
  'cuenta.saving': { es: 'Guardando…', en: 'Saving…' },
  'cuenta.saveAndEnter': { es: 'Guardar y entrar', en: 'Save and log in' },
  'cuenta.askAnotherLink': { es: 'Pide otro enlace', en: 'Ask for another link' },
  'cuenta.inviteOnly': {
    es: 'De momento solo se entra con invitación. Si tienes una, ábrela desde su enlace.',
    en: 'For now you can only sign up with an invitation. If you have one, open it from its link.',
  },

  // === PANEL DE ADMINISTRACIÓN ===
  'admin.title': { es: 'Administración', en: 'Administration' },
  'admin.loading': { es: 'Cargando…', en: 'Loading…' },
  'admin.nothingHere': { es: 'Aquí no hay nada.', en: 'There is nothing here.' },
  'admin.backHome': { es: 'Volver a la terminal', en: 'Back to the terminal' },
  'admin.invitations': { es: 'Invitaciones', en: 'Invitations' },
  'admin.invitationsSub': {
    es: 'Cada enlace sirve para un alta y una sola, la use quien la use.',
    en: 'Each link is good for one sign-up and one only, whoever uses it.',
  },
  'admin.notePh': { es: 'Para acordarte de a quién iba', en: 'To remember who it was for' },
  'admin.createInvite': { es: 'Crear invitación', en: 'Create invitation' },
  'admin.creating': { es: 'Creando…', en: 'Creating…' },
  'admin.linkOnce': {
    es: 'Cópialo ahora: se guarda cifrado y no se puede volver a enseñar.',
    en: 'Copy it now: it is stored hashed and cannot be shown again.',
  },
  'admin.note': { es: 'Nota', en: 'Note' },
  'admin.created': { es: 'Creada', en: 'Created' },
  'admin.expires': { es: 'Caduca', en: 'Expires' },
  'admin.state': { es: 'Estado', en: 'State' },
  'admin.revoke': { es: 'Revocar', en: 'Revoke' },
  'admin.used': { es: 'Usada', en: 'Used' },
  'admin.expired': { es: 'Caducada', en: 'Expired' },
  'admin.pending': { es: 'Sin usar', en: 'Unused' },
  'admin.noInvitations': { es: 'Ninguna todavía.', en: 'None yet.' },
  'admin.users': { es: 'Usuarios', en: 'Users' },
  'admin.name': { es: 'Nombre', en: 'Name' },
  'admin.role': { es: 'Rol', en: 'Role' },
  'admin.roleAdmin': { es: 'admin', en: 'admin' },
  'admin.status.pending': { es: 'Sin verificar', en: 'Unverified' },
  'admin.status.active': { es: 'Activo', en: 'Active' },
  'admin.status.blocked': { es: 'Bloqueado', en: 'Blocked' },
  'admin.block': { es: 'Bloquear', en: 'Block' },
  'admin.unblock': { es: 'Desbloquear', en: 'Unblock' },
  'admin.delete': { es: 'Borrar', en: 'Delete' },
  'admin.sure': { es: '¿Seguro?', en: 'Sure?' },
  'admin.deleteWarning': {
    es: 'Borrar se lleva la cuenta y todas sus salas. No hay vuelta atrás.',
    en: 'Deleting takes the account and every room of theirs. There is no going back.',
  },
  'admin.noUsers': { es: 'Nadie todavía.', en: 'Nobody yet.' },
  'admin.tab.gente': { es: 'Gente', en: 'People' },
  'admin.tab.sesiones': { es: 'Sesiones', en: 'Sessions' },
  'admin.tab.consola': { es: 'Consola', en: 'Console' },

  // === HABLAR CON LA SESIÓN ===
  'admin.emailPh': { es: 'Correo (opcional)', en: 'Email (optional)' },
  'admin.sentTo': { es: 'Y se ha mandado a {correo}.', en: 'And it was sent to {correo}.' },
  'admin.tab.salas': { es: 'Salas', en: 'Rooms' },
  'admin.kpiBlocked': { es: 'Bloqueados', en: 'Blocked' },
  'admin.kpiPending': { es: 'Invitaciones vivas', en: 'Live invitations' },

  'salas.cargando': { es: 'Mirando qué mesas hay abiertas…', en: 'Looking for open tables…' },
  'salas.kpiTotal': { es: 'Salas', en: 'Rooms' },
  'salas.kpiAbiertas': { es: 'Sin terminar', en: 'Unfinished' },
  'salas.kpiJugando': { es: 'En partida', en: 'In play' },
  'salas.kpiConectados': { es: 'Conectados', en: 'Connected' },
  'salas.buscar': { es: 'Buscar sala o dueño', en: 'Search room or owner' },
  'salas.todosJuegos': { es: 'Todos los juegos', en: 'All games' },
  'salas.todosEstados': { es: 'Todos los estados', en: 'All states' },
  'salas.refrescar': { es: 'Actualizar', en: 'Refresh' },
  'salas.sala': { es: 'Sala', en: 'Room' },
  'salas.juego': { es: 'Juego', en: 'Game' },
  'salas.duenyo': { es: 'Dueño', en: 'Owner' },
  'salas.gente': { es: 'Asientos', en: 'Seats' },
  'salas.actividad': { es: 'Última actividad', en: 'Last activity' },
  'salas.enLinea': { es: 'en línea', en: 'online' },
  'salas.cerrar': { es: 'Cerrar', en: 'Close' },
  'salas.echar': { es: 'Echar', en: 'Kick' },
  'salas.bot': { es: 'Bot', en: 'Bot' },
  'salas.sinAsientos': { es: 'No queda nadie sentado.', en: 'Nobody is seated.' },
  'salas.ninguna': { es: 'No hay ninguna sala.', en: 'There are no rooms.' },
  'salas.bloqueTitulo': { es: 'Cerrar en bloque', en: 'Close in bulk' },
  'salas.bloqueAviso': {
    es: 'Se llevará por delante {cuantas} salas, las que encajen con los filtros de arriba. Escribe BORRAR para confirmar.',
    en: 'This will take down {cuantas} rooms, the ones matching the filters above. Type BORRAR to confirm.',
  },
  'salas.bloqueAvisoUna': {
    es: 'Se llevará por delante una sala, la que encaja con los filtros de arriba. Escribe BORRAR para confirmar.',
    en: 'This will take down one room, the one matching the filters above. Type BORRAR to confirm.',
  },
  'salas.inactivas': { es: 'Días sin tocar', en: 'Days untouched' },
  'salas.cerrarTodas': { es: 'Cerrar las que encajen', en: 'Close matching rooms' },
  'salas.estado.lobby': { es: 'Esperando', en: 'Lobby' },
  'salas.estado.playing': { es: 'Jugando', en: 'Playing' },
  'salas.estado.paused': { es: 'En pausa', en: 'Paused' },
  'salas.estado.finished': { es: 'Terminada', en: 'Finished' },
  'salas.juego.scrum': { es: 'Scrum Poker', en: 'Scrum Poker' },
  'salas.juego.risk': { es: 'RISK', en: 'RISK' },
  'salas.juego.flota': { es: 'Hundir la flota', en: 'Battleship' },
  'salas.juego.trivial': { es: 'Trivial', en: 'Trivia' },
  'salas.juego.impostor': { es: 'El impostor', en: 'The impostor' },

  'con.buscando': { es: 'Buscando el canal…', en: 'Looking for the channel…' },
  'con.sinCanalTitulo': { es: 'No hay ninguna sesión escuchando', en: 'No session is listening' },
  'con.sinCanalTexto': {
    es: 'El canal lo levanta Claude Code en tu ordenador. Arráncalo así y vuelve:',
    en: 'The channel is started by Claude Code on your computer. Start it like this and come back:',
  },
  'con.reintentar': { es: 'Volver a mirar', en: 'Look again' },
  'con.dondeEtiqueta': {
    es: '¿Estás en otro aparato? Di por dónde se llega al ordenador:',
    en: 'On another device? Say how to reach the computer:',
  },
  'con.dondePh': { es: 'https://mi-pc.tu-red.ts.net', en: 'https://my-pc.your-net.ts.net' },
  'con.dondeAyuda': {
    es: 'Vacío significa este mismo ordenador. Desde el móvil hace falta una red privada: 127.0.0.1 allí es el propio móvil.',
    en: 'Empty means this computer. From a phone you need a private network: 127.0.0.1 there is the phone itself.',
  },
  'con.guardar': { es: 'Guardar', en: 'Save' },
  'con.emparejarTitulo': { es: 'Este aparato no está emparejado', en: 'This device is not paired' },
  'con.emparejarTexto': {
    es: 'Pide un código y léelo en el terminal donde corre Claude Code. Hay que hacerlo una vez: después este aparato entra siempre.',
    en: 'Ask for a code and read it in the terminal running Claude Code. Once is enough: this device is then remembered.',
  },
  'con.nombrePh': { es: '¿Qué aparato es? (el móvil, el portátil…)', en: 'Which device is this?' },
  'con.pedirCodigo': { es: 'Pedir código', en: 'Ask for a code' },
  'con.miraElTerminal': {
    es: 'Mira el terminal donde corre Claude Code y escribe aquí las seis cifras.',
    en: 'Look at the terminal running Claude Code and type the six digits here.',
  },
  'con.confirmar': { es: 'Emparejar', en: 'Pair' },
  'con.desemparejar': { es: 'Olvidar este aparato', en: 'Forget this device' },
  'con.tu': { es: 'Tú', en: 'You' },
  'con.vacio': {
    es: 'Escríbele algo: llega a la sesión que tengas abierta.',
    en: 'Write something: it lands in your open session.',
  },
  'con.escribePh': {
    es: 'Lo que quieras pedirle…  (Enter manda)',
    en: 'What do you want to ask?  (Enter sends)',
  },
  'con.enviar': { es: 'Mandar', en: 'Send' },
  'con.enviando': { es: 'Mandando…', en: 'Sending…' },
  'con.permitir': { es: 'Permitir', en: 'Allow' },
  'con.denegar': { es: 'Denegar', en: 'Deny' },

  // === LAS SESIONES DE CLAUDE CODE ===
  'ses.buscando': { es: 'Buscando el agente…', en: 'Looking for the agent…' },
  'ses.apagadoTitulo': { es: 'El agente no está abierto', en: 'The agent is not running' },
  'ses.apagadoTexto': {
    es: 'Tus sesiones viven en tu ordenador y no salen de ahí. Para leerlas, abre el agente en una terminal:',
    en: 'Your sessions live on your computer and never leave it. To read them, start the agent in a terminal:',
  },
  'ses.reintentar': { es: 'Volver a mirar', en: 'Look again' },
  'ses.buscar': { es: 'Buscar por título, rama o proyecto…', en: 'Search by title, branch or project…' },
  'ses.recargar': { es: 'Recargar', en: 'Reload' },
  'ses.sesion': { es: 'Sesión', en: 'Session' },
  'ses.rama': { es: 'Rama', en: 'Branch' },
  'ses.tandas': { es: 'tandas', en: 'turns' },
  'ses.cuando': { es: 'Última', en: 'Last' },
  'ses.abrir': { es: 'Abrir', en: 'Open' },
  'ses.ninguna': { es: 'Ninguna sesión por aquí.', en: 'No sessions here.' },
  'ses.volver': { es: '← Volver', en: '← Back' },
  'ses.verPensamientos': { es: 'Ver lo que piensa', en: 'Show its thinking' },
  'ses.tu': { es: 'Tú', en: 'You' },
  'ses.subagente': { es: 'subagente', en: 'subagent' },
  'ses.verMas': { es: 'Leer más', en: 'Read more' },
  'ses.leyendo': { es: 'Leyendo…', en: 'Reading…' },

  // === ENTRAR EN UNA SALA ===
  'join.title': { es: 'Entrar en la sala', en: 'Join the room' },
  'join.sub': {
    es: 'Escribe tu nombre para sentarte a la mesa',
    en: 'Type your name to take a seat at the table',
  },
  'join.createTitle': { es: 'Crear una sala', en: 'Create a room' },
  'join.createSub': {
    es: 'Escribe tu nombre y te abro una mesa nueva',
    en: 'Type your name and I will open a new table for you',
  },
  'join.yourName': { es: 'Tu nombre', en: 'Your name' },
  'join.namePlaceholder': { es: 'Juan, María, Óscar...', en: 'John, Mary, Oscar...' },
  'join.nameRequired': {
    es: 'Hace falta un nombre de dos letras por lo menos',
    en: 'A name of at least two letters is needed',
  },
  'join.joining': { es: 'Entrando...', en: 'Joining...' },
  'join.join': { es: 'Unirse a la sala', en: 'Join the room' },
  'join.create': { es: 'Crear la sala', en: 'Create the room' },
  'join.room': { es: 'Sala', en: 'Room' },
  'join.link': { es: 'Enlace de invitación', en: 'Invite link' },
  'join.copy': { es: 'Copiar el enlace', en: 'Copy the link' },
  'join.copied': { es: 'Copiado', en: 'Copied' },
  'join.saved': {
    es: 'Nombre guardado. Entrando en la sala...',
    en: 'Name saved. Going into the room...',
  },
  'desk.showDesktop': { es: 'Mostrar el escritorio', en: 'Show the desktop' },
  'desk.welcomeTitle': { es: 'Oscar Blanco Rosales', en: 'Oscar Blanco Rosales' },
  'desk.welcomeSub': { es: 'Full Stack Developer · C# · Angular · Flutter', en: 'Full Stack Developer · C# · Angular · Flutter' },
  'desk.welcomeText': {
    es: 'Esto es mi portfolio, montado como un escritorio. Abre un icono para probar una herramienta, o entra en la Terminal y escribe «help»: todo se puede hacer también con comandos.',
    en: 'This is my portfolio, built as a desktop. Open an icon to try a tool, or go into the Terminal and type «help»: everything can be done with commands too.',
  },
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
  'icon.tooSmall': { es: 'La imagen mide menos de 1024 px: los iconos grandes van a salir borrosos.', en: 'The image is under 1024 px: the large icons will come out blurry.' },
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
    this.currentLang = this.chooseLang();
  }

  /**
   * Lo que elegiste tú manda. Si no has elegido nada, el idioma del navegador:
   * antes se abría siempre en castellano y quien llegaba con el navegador en
   * inglés tenía que buscar la bandera para entender la web.
   */
  private chooseLang(): Lang {
    try {
      const guardado = localStorage.getItem('app_lang');
      if (guardado === 'es' || guardado === 'en') return guardado;
    } catch {
      // Sin almacenamiento se decide igual, mirando el navegador.
    }
    return this.fromBrowser();
  }

  /** El sitio es de un español: lo que no sea inglés, castellano. */
  private fromBrowser(): Lang {
    try {
      // Con tipo propio: hay navegadores viejos que no traen `languages`.
      const nav: { languages?: readonly string[]; language?: string } = navigator;
      const idiomas = nav.languages?.length ? nav.languages : [nav.language ?? ''];
      for (const idioma of idiomas) {
        const base = idioma.toLowerCase().split('-')[0];
        if (base === 'es') return 'es';
        if (base === 'en') return 'en';
      }
    } catch {
      // Un navegador que no dice su idioma no es motivo para romper nada.
    }
    return 'es';
  }

  get lang(): Lang {
    return this.currentLang;
  }

  setLang(lang: Lang): void {
    this.currentLang = lang;
    try {
      localStorage.setItem('app_lang', lang);
    } catch {
      // Navegar en privado no debería costarte el idioma de esta visita.
    }
    this.langChange$.next(lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    if (!(key in TRANSLATIONS)) return key;
    const entry = TRANSLATIONS[key];
    let text = entry[this.currentLang] || entry.es;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }
}
