# DevWeb — Portfolio & Developer Toolkit

**Live:** [oscarblancorosales.github.io/OscarBlancoDevWeb](https://oscarblancorosales.github.io/OscarBlancoDevWeb/)

---

## Español

Portfolio interactivo de desarrollador construido con Angular, con una interfaz estilo terminal retro y una coleccion de herramientas web utiles.

### Funcionalidades

#### Consola Terminal
- Terminal interactiva con animaciones de escritura
- Comandos: `help`, `about`, `projects`, `contact`, `clear`
- Informacion personal mostrada en formato estilo ipconfig

#### Herramientas de Desarrollo
- **DNI Generator** — Genera DNIs espanoles validos para pruebas
- **QR Generator** — Crea codigos QR desde texto, URLs o cualquier contenido
- **UUID Generator** — Genera identificadores UUID v4 con opciones de formato
- **Encoder / Decoder** — Base64, URL Encode, HTML Entities, Hex, Binary, Unicode, JWT
- **Code Formatter** — Formatea y minifica JSON, XML, CSS, SQL
- **Regex Tester** — Prueba expresiones regulares en tiempo real con resaltado de coincidencias
- **Color Picker** — Convierte entre HEX, RGB y HSL con generacion de paletas
- **Lorem Ipsum Generator** — Genera texto placeholder (parrafos, frases, palabras)
- **Timestamp Converter** — Convierte entre Unix, millis, .NET Ticks, ISO 8601 y mas
- **App Icon Generator** — Genera iconos para iOS y Android desde una sola imagen

#### Juegos — RISK
- RISK completo con reglas clasicas: refuerzos, canje de cartas, ataques con dados, reagrupacion y bonificacion por continente
- Tres mapas de cartografía real: Todo el mundo (42 territorios), España por provincias (52) y España por comunidades (19)
- Modo avanzado opcional con orografía: llanura, bosque, montaña, desierto y costa cambian cómo se pelea cada territorio, y desembarcar cuesta caro
- Modo avanzado opcional con tropas: caballería, blindados, flota y aviación se preparan ascendiendo fichas que ya están en el tablero
- Salas con invitacion por enlace, igual que el Scrum Poker, y bots de IA para rellenar huecos
- Partidas grabadas jugada a jugada: se pueden pausar y retomar respetando el asiento de cada persona
- Bots con personalidad que comentan su estrategia en el chat en cada turno, y un estratega que te aconseja a ti
- IA opcional con modelos gratuitos (OpenRouter, Groq, Google AI Studio u Ollama local); sin clave, la IA local juega igual
- Modo local sin cuenta ni red: partida contra la IA guardada en el navegador
- Documentacion completa en [docs/risk.md](docs/risk.md)

#### Scrum Poker
- Planning poker en tiempo real con Firebase Realtime Database
- Crea salas, invita jugadores por enlace, vota y revela resultados
- Autenticacion Firebase para la creacion de salas

#### Internacionalizacion (i18n)
- Soporte completo en espanol e ingles en todas las paginas
- Banderas de idioma en la barra de titulo
- Preferencia de idioma guardada en localStorage

### Stack Tecnologico

- **Framework:** Angular 21
- **Estilos:** CSS personalizado con tema terminal/retro
- **Backend:** Firebase (Realtime Database + Authentication)
- **Despliegue:** GitHub Pages via GitHub Actions
- **Librerias:** qrcode, jszip

### Inicio Rapido

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
ng serve
# Abrir http://localhost:4200

# Build de produccion
ng build --configuration production
```

### Despliegue

El proyecto se despliega automaticamente en GitHub Pages con cada push a `main` mediante GitHub Actions.

El workflow (`.github/workflows/deploy.yml`) se encarga de:
1. Instalar dependencias
2. Compilar con el base-href correcto
3. Generar 404.html para el routing SPA
4. Desplegar en GitHub Pages

---

## English

Interactive developer portfolio built with Angular, featuring a retro terminal-style UI and a collection of useful web tools.

### Features

#### Terminal Console
- Retro-style interactive terminal with typewriter animations
- Commands: `help`, `about`, `projects`, `contact`, `clear`
- Personal info displayed in ipconfig-style format

#### Developer Tools
- **DNI Generator** — Generate valid Spanish DNI numbers for testing
- **QR Generator** — Create QR codes from text, URLs or any content
- **UUID Generator** — Generate UUID v4 identifiers with formatting options
- **Encoder / Decoder** — Base64, URL Encode, HTML Entities, Hex, Binary, Unicode, JWT
- **Code Formatter** — Format and minify JSON, XML, CSS, SQL
- **Regex Tester** — Test regular expressions in real time with match highlighting
- **Color Picker** — Convert between HEX, RGB, HSL with palette generation
- **Lorem Ipsum Generator** — Generate placeholder text (paragraphs, sentences, words)
- **Timestamp Converter** — Convert between Unix, millis, .NET Ticks, ISO 8601 and more
- **App Icon Generator** — Generate iOS and Android app icons from a single image

#### Games — RISK
- Full RISK with classic rules: reinforcements, card trading, dice battles, fortifying and continent bonuses
- Three maps drawn from real cartography: World (42 territories), Spain by province (52) and Spain by region (19)
- Optional advanced mode with terrain: plains, forest, mountain, desert and coast change how each territory is fought over, and amphibious attacks are expensive
- Optional advanced mode with troops: cavalry, armour, navy and air are built by promoting pieces already on the board
- Invite-link rooms, just like Scrum Poker, plus AI bots to fill empty seats
- Games are recorded action by action: pause and resume later, everyone keeps their seat
- Bots with personality that comment their strategy in chat every turn, plus an advisor for you
- Optional LLM support with free tiers (OpenRouter, Groq, Google AI Studio or local Ollama); without a key the local AI plays just as well
- Offline mode with no account and no network: play the AI with the game stored in your browser
- Full write-up in [docs/risk.md](docs/risk.md)

#### Scrum Poker
- Real-time planning poker with Firebase Realtime Database
- Create rooms, invite players via link, vote and reveal results
- Firebase Authentication for room creation

#### Internationalization (i18n)
- Full Spanish / English support across all pages
- Language toggle flags in the titlebar
- Language preference persisted in localStorage

### Tech Stack

- **Framework:** Angular 21
- **Styling:** Custom CSS with terminal/retro theme
- **Backend:** Firebase (Realtime Database + Authentication)
- **Deployment:** GitHub Pages via GitHub Actions
- **Libraries:** qrcode, jszip

### Getting Started

```bash
# Install dependencies
npm install

# Development server
ng serve
# Open http://localhost:4200

# Production build
ng build --configuration production
```

### Deployment

The project deploys automatically to GitHub Pages on every push to `main` via GitHub Actions.

The workflow (`.github/workflows/deploy.yml`) handles:
1. Install dependencies
2. Build with correct base-href
3. Generate 404.html for SPA routing
4. Deploy to GitHub Pages

---

## Autor / Author

**Oscar Blanco Rosales** — Full Stack Developer

- [LinkedIn](https://www.linkedin.com/in/oscar-blanco-a5108b349/)
- [GitHub](https://github.com/OscarBlancoRosales)
- [Email](mailto:oscar.blanco.r@gmail.com)
