# DevWeb — Portfolio & Developer Toolkit

Interactive developer portfolio built with Angular, featuring a retro terminal-style UI and a collection of useful web tools.

**Live:** [oscarblancorosales.github.io/OscarBlancoDevWeb](https://oscarblancorosales.github.io/OscarBlancoDevWeb/)

## Features

### Terminal Console
- Retro-style interactive terminal with typewriter animations
- Commands: `help`, `about`, `projects`, `contact`, `clear`
- Personal info displayed in ipconfig-style format

### Developer Tools
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

### Scrum Poker
- Real-time planning poker with Firebase Realtime Database
- Create rooms, invite players via link, vote and reveal results
- Firebase Authentication for room creation

### Internationalization (i18n)
- Full Spanish / English support across all pages
- Language toggle flags in the titlebar
- Language preference persisted in localStorage

## Tech Stack

- **Framework:** Angular 21
- **Styling:** Custom CSS with terminal/retro theme
- **Backend:** Firebase (Realtime Database + Authentication)
- **Deployment:** GitHub Pages via GitHub Actions
- **Libraries:** qrcode, jszip

## Getting Started

```bash
# Install dependencies
npm install

# Development server
ng serve
# Open http://localhost:4200

# Production build
ng build --configuration production
```

## Deployment

The project deploys automatically to GitHub Pages on every push to `main` via GitHub Actions.

The workflow (`.github/workflows/deploy.yml`) handles:
1. Install dependencies
2. Build with correct base-href
3. Generate 404.html for SPA routing
4. Deploy to GitHub Pages

## Author

**Oscar Blanco Rosales** — Full Stack Developer

- [LinkedIn](https://www.linkedin.com/in/oscar-blanco-a5108b349/)
- [GitHub](https://github.com/OscarBlancoRosales)
- [Email](mailto:oscar.blanco.r@gmail.com)
