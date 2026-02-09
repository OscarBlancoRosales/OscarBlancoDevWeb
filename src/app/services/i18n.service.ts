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
  'common.copy': { es: '📋 Copiar', en: '📋 Copy' },
  'common.copied': { es: '✓ Copiado', en: '✓ Copied' },
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
  'console.title': { es: 'Oscar Blanco — Terminal', en: 'Oscar Blanco — Terminal' },
  'console.configDev': { es: 'Configuración de Desarrollador', en: 'Developer Configuration' },
  'console.name': { es: 'Nombre', en: 'Name' },
  'console.surname': { es: 'Apellidos', en: 'Surname' },
  'console.role': { es: 'Rol', en: 'Role' },
  'console.experience': { es: 'Experiencia', en: 'Experience' },
  'console.specialization': { es: 'Especialización', en: 'Specialization' },
  'console.configTech': { es: 'Configuración Técnica', en: 'Technical Configuration' },
  'console.databases': { es: 'Bases de Datos', en: 'Databases' },
  'console.configContact': { es: 'Configuración de Contacto', en: 'Contact Configuration' },
  'console.location': { es: 'Ubicación', en: 'Location' },
  'console.spain': { es: 'España', en: 'Spain' },
  'console.interactiveOn': { es: '✓ Terminal interactiva activada. Escribe "help" para ver comandos.', en: '✓ Interactive terminal activated. Type "help" to see commands.' },
  'console.typeCommand': { es: 'Escribe un comando...', en: 'Type a command...' },
  'console.helpTitle': { es: 'Comandos disponibles:', en: 'Available commands:' },
  'console.helpHelp': { es: '  help     - Muestra esta ayuda', en: '  help     - Show this help' },
  'console.helpClear': { es: '  clear    - Limpia la terminal', en: '  clear    - Clear the terminal' },
  'console.helpAbout': { es: '  about    - Información sobre mí', en: '  about    - About me' },
  'console.helpProjects': { es: '  projects - Mis proyectos destacados', en: '  projects - My featured projects' },
  'console.helpContact': { es: '  contact  - Información de contacto', en: '  contact  - Contact information' },
  'console.clearMsg': { es: 'Terminal limpiada. Escribe "help" para ver comandos disponibles.', en: 'Terminal cleared. Type "help" to see available commands.' },
  'console.aboutExp': { es: 'Full Stack Developer con 2+ años de experiencia', en: 'Full Stack Developer with 2+ years of experience' },
  'console.aboutSpec': { es: 'Especializado en C#, Flutter y Angular', en: 'Specialized in C#, Flutter and Angular' },
  'console.aboutPassion': { es: 'Apasionado por crear soluciones innovadoras', en: 'Passionate about creating innovative solutions' },
  'console.projectsTitle': { es: '🚀 Proyectos destacados:', en: '🚀 Featured projects:' },
  'console.projectPoker': { es: '  • Scrum Poker App - Aplicación de planning poker', en: '  • Scrum Poker App - Planning poker application' },
  'console.projectDni': { es: '  • DNI Generator - Generador de DNIs español', en: '  • DNI Generator - Spanish ID generator' },
  'console.projectPortfolio': { es: '  • Portfolio Web - Este portfolio interactivo', en: '  • Portfolio Web - This interactive portfolio' },
  'console.projectMultiple': { es: '  • Múltiples proyectos en C# y Flutter', en: '  • Multiple projects in C# and Flutter' },
  'console.unknownCmd': { es: "Comando no reconocido: '{cmd}'. Escribe 'help' para ver comandos disponibles.", en: "Unknown command: '{cmd}'. Type 'help' to see available commands." },
  'console.sessionCleared': { es: 'Sesión limpiada. Ahora deberás hacer login para acceder a Scrum Poker.', en: 'Session cleared. You will need to login to access Scrum Poker.' },
  'console.expYears': { es: '2+ años', en: '2+ years' },

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
  'decoder.encode': { es: 'Codificar', en: 'Encode' },
  'decoder.decode': { es: 'Decodificar', en: 'Decode' },
  'decoder.inputPlaceholder': { es: 'Introduce el texto...', en: 'Enter text...' },
  'decoder.outputPlaceholder': { es: 'Resultado...', en: 'Result...' },

  // === FORMATTER ===
  'formatter.title': { es: '> Code Formatter', en: '> Code Formatter' },
  'formatter.subtitle': { es: 'Formatea y minifica código en varios lenguajes', en: 'Format and minify code in various languages' },
  'formatter.format': { es: 'Formatear', en: 'Format' },
  'formatter.minify': { es: 'Minificar', en: 'Minify' },
  'formatter.inputPlaceholder': { es: 'Pega tu código aquí...', en: 'Paste your code here...' },
  'formatter.outputPlaceholder': { es: 'Resultado formateado...', en: 'Formatted result...' },

  // === COLOR PICKER ===
  'color.title': { es: '> Color Picker', en: '> Color Picker' },
  'color.subtitle': { es: 'Conversor de colores HEX / RGB / HSL con paleta', en: 'HEX / RGB / HSL color converter with palette' },
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
  'lorem.startWith': { es: 'Empezar con "Lorem ipsum..."', en: 'Start with "Lorem ipsum..."' },

  // === TIMESTAMP ===
  'ts.title': { es: '> Timestamp Converter', en: '> Timestamp Converter' },
  'ts.subtitle': { es: 'Convierte entre Unix, millis, .NET Ticks, ISO 8601 y más', en: 'Convert between Unix, millis, .NET Ticks, ISO 8601 and more' },
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
  'uuid.copyAll': { es: '📋 Copiar todo', en: '📋 Copy all' },
  'uuid.copiedAll': { es: '✓ Copiado todo', en: '✓ Copied all' },

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
