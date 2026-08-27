# Fase 0: reglas del proyecto y monorepo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el repositorio como un monorepo con reglas comprobables por máquina y el motor de RISK extraído a un paquete compartido, sin cambiar ni una coma del comportamiento de la web.

**Architecture:** npm workspaces sobre el `npm@11.6.2` que ya está declarado. El Angular actual se mueve entero de la raíz a `apps/web`. El motor de RISK —7.868 líneas de TypeScript sin una sola dependencia de Angular, RxJS o Firebase— se mueve a `packages/shared/src/engine` y se consume como código fuente vía `paths` de TypeScript, sin paso de compilación intermedio. Las reglas del proyecto se escriben primero y las hace cumplir ESLint y el compilador, no la buena voluntad.

**Tech Stack:** Node 22, npm workspaces, TypeScript 5.9, Angular 21 (`@angular/build`), Vitest vía `@angular/build:unit-test`, ESLint 10 flat config con `typescript-eslint`.

**Spec:** `docs/superpowers/specs/2026-08-27-backend-propio-design.md`

## Global Constraints

- **Cero cambios de comportamiento.** Esta fase mueve y configura. No corrige bugs, no renombra símbolos del dominio, no cambia lógica de juego.
- **Línea base inviolable:** `36 ficheros de test, 1089 tests, 0 fallos`. Cualquier tarea que la baje se revierte, no se ajusta el test.
- **La caché de Angular miente.** Un fallo de compilación inexplicable —por ejemplo `TS2339` sobre una propiedad que existe— casi siempre es `.angular/cache` rancia. Antes de investigar nada, `rm -rf .angular/cache out-tsc` y repetir.
- **`verbatimModuleSyntax` NO se activa en `apps/web`.** La web usa inyección por constructor en 19 ficheros y `inject()` en cero. El flag convertiría los imports de DI en `import type` y rompería Angular en runtime con los tests en verde.
- **`noUncheckedIndexedAccess` NO se activa en esta fase.** Son 282 errores, 200 dentro del motor. Tiene su propio plan.
- **Sin dependencias nuevas de runtime.** En esta fase solo entran devDependencies de lint.
- **Mensajes de commit** en español, en el estilo del repositorio: una frase que dice qué problema resuelve, no qué ficheros toca.
- **El despliegue a GitHub Pages debe seguir funcionando igual**, con el mismo dominio `oscarblancorosales.com` y el mismo `404.html` para el routing de la SPA.

---

## Estructura final

```
DevWeb/
├─ apps/
│  └─ web/                      Angular, movido íntegro desde la raíz
│     ├─ src/                   (con app/games/risk/engine YA NO aquí)
│     ├─ public/
│     ├─ angular.json
│     ├─ netlify.toml
│     ├─ tsconfig.json  tsconfig.app.json  tsconfig.spec.json
│     └─ package.json           dependencias de la web y scripts de ng
├─ packages/
│  └─ shared/
│     ├─ src/engine/            el motor de RISK, movido tal cual
│     ├─ package.json
│     └─ tsconfig.json          + verbatimModuleSyntax
├─ tools/                       se queda en la raíz, con rutas actualizadas
├─ docs/estandares.md           NUEVO: las reglas
├─ eslint.config.js             NUEVO: las reglas, ejecutables
├─ database.rules.json          se queda (muere en la fase 5)
└─ package.json                 raíz: workspaces y scripts de orquestación
```

**Responsabilidad de cada fichero nuevo:**

- `docs/estandares.md` — las reglas en prosa, con el porqué de cada una y las dos deudas asumidas. Es lo que se lee antes de escribir código.
- `eslint.config.js` — las mismas reglas, ejecutables. Único punto de configuración de lint para todo el monorepo.
- `package.json` (raíz) — declara los workspaces y orquesta. No tiene dependencias de aplicación.
- `apps/web/package.json` — todo lo que hoy está en el `package.json` de la raíz salvo los workspaces.
- `packages/shared/package.json` — nombre `@devweb/shared`, sin dependencias. La ausencia de dependencias es la garantía de que sirve a los dos lados.
- `packages/shared/tsconfig.json` — el rigor máximo que el código actual aguanta.

---

### Task 1: Las reglas, escritas y ejecutables

Va primero a propósito: el resto de la fase 0 se hace ya bajo estas reglas.

**Files:**
- Create: `docs/estandares.md`
- Create: `eslint.config.js`
- Modify: `package.json` (scripts `lint`, `lint:fix`, `typecheck`; devDependencies)

**Interfaces:**
- Produces: los scripts `npm run lint`, `npm run lint:fix` y `npm run typecheck`, que las tareas 2, 4, 5 y 6 usan como verificación.

- [ ] **Step 1: Instalar las herramientas de lint**

```bash
npm install -D eslint@^10.9.1 @eslint/js@^10.0.1 typescript-eslint@^8.68.0 angular-eslint@^21.4.0 eslint-config-prettier@^10.1.8
```

**La versión de `angular-eslint` no es negociable: tiene que ser 21.x.** La última publicada es la 22, y su `peerDependencies` exige `@angular/cli >= 22.0.0 < 23.0.0`; este proyecto está en `@angular/core@21.1.2`. Instalar la 22 rompe la instalación.

- [ ] **Step 2: Escribir `eslint.config.js`**

Configuración plana, en la raíz. `strictTypeChecked` para TypeScript, la capa de Angular solo para lo que es Angular, y Prettier al final para que no discutan por el formato.

```js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.angular/**', '**/out-tsc/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    languageOptions: { parser: angular.templateParser },
  },
  prettier,
);
```

- [ ] **Step 3: Añadir los scripts al `package.json` de la raíz**

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"typecheck": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit"
```

- [ ] **Step 4: Ejecutar el lint y anotar la línea base**

Run: `npm run lint 2>&1 | tail -5`
Expected: termina con una cuenta de problemas. **No se arreglan aquí.** Anota el número exacto: es la deuda de partida que se documenta en el paso 5.

- [ ] **Step 5: Escribir `docs/estandares.md`**

Contenido obligatorio, cada sección con su porqué:

1. **Tipado** — la tabla de flags de la spec §1, con los números medidos (7 / 16 / 189 / 282) y en qué paquete se activa cada uno.
2. **Las dos deudas asumidas**, con su motivo escrito: `verbatimModuleSyntax` bloqueado en `apps/web` hasta migrar a `inject()`; `noUncheckedIndexedAccess` pendiente de plan propio.
3. **Contrato único** — los esquemas se declaran una vez con TypeBox; ninguna `interface` a mano duplica un esquema.
4. **Capas** — `route → service → repository`, qué puede saber cada una y qué no.
5. **Errores** — un `AppError` con código de dominio y un único `errorHandler`.
6. **Legibilidad** — el comentario dice *por qué*, nunca *qué*. Cita `settledUser$` de `firebase-auth.service.ts` como el ejemplo de comentario que sí merece existir. Un fichero de más de ~300 líneas es una pregunta obligatoria, no un error automático.
7. **Tests** — Vitest, TDD, sin red ni reloj real; el tiempo entra por parámetro, como ya hace `cleanOldRooms(ownerUid, now = Date.now())`.
8. **La deuda de lint de partida** — el número del paso 4 y el compromiso de que no suba.

- [ ] **Step 6: Verificar que los tests siguen verdes**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: `Test Files 36 passed (36)` y `Tests 1089 passed (1089)`

- [ ] **Step 7: Commit**

```bash
git add docs/estandares.md eslint.config.js package.json package-lock.json
git commit -m "Las reglas del proyecto dejan de ser una intención y pasan a ser ejecutables"
```

---

### Task 2: Los flags estrictos que el código ya aguanta

23 errores medidos. Se arreglan a mano, uno a uno, sin tocar lógica.

**Files:**
- Modify: `tsconfig.json` (bloque `compilerOptions`)
- Modify: los ficheros que señale el compilador (23 errores repartidos)

**Interfaces:**
- Consumes: `npm run typecheck` de la tarea 1.
- Produces: un árbol que compila limpio con `exactOptionalPropertyTypes`, `noUnusedLocals` y `noUnusedParameters`, condición de entrada de la tarea 4.

- [ ] **Step 1: Ver el fallo antes de arreglarlo**

Run:
```bash
npx tsc -p tsconfig.app.json --noEmit --exactOptionalPropertyTypes --noUnusedLocals --noUnusedParameters 2>&1 | grep -c "error TS"
```
Expected: `23`

El desglose esperado es `11×TS6133` (declarado y sin usar), `5×TS2322`, `3×TS2379`, `3×TS2375` (los tres últimos, opcionales que reciben `undefined` explícito) y `1×TS2412`.

- [ ] **Step 2: Activar los flags**

En `tsconfig.json`, dentro de `compilerOptions`, junto a `"strict": true`:

```json
"exactOptionalPropertyTypes": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
```

- [ ] **Step 3: Arreglar los TS6133 (símbolos sin usar)**

Borrar el import o la variable. Si un parámetro de función no se usa pero forma parte de una firma que hay que respetar, prefijarlo con `_`. **No** se silencia con `eslint-disable`.

- [ ] **Step 4: Arreglar los TS2322 / TS2379 / TS2375 / TS2412**

Todos son la misma familia: una propiedad declarada `campo?: T` recibe `undefined` de forma explícita. La corrección correcta es **no escribir la propiedad** cuando no hay valor, no cambiar el tipo a `T | undefined`. En este repositorio ya existe el ayudante para eso: `stripUndefined` en `src/app/games/risk/services/risk-room.service.ts:630`. Reutilizarlo donde encaje; donde no, construir el objeto sin la clave.

- [ ] **Step 5: Verificar que compila limpio**

Run: `npm run typecheck`
Expected: sin salida y código de salida 0

- [ ] **Step 6: Verificar que no se ha roto nada**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: `Tests 1089 passed (1089)`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "El compilador deja de tragarse los opcionales a medias y los símbolos muertos"
```

---

### Task 3: La raíz pasa a ser un monorepo y el Angular se muda a apps/web

La tarea más aburrida y la que más se nota si sale mal. Se mueve **todo** lo de la web; en la raíz solo queda la orquestación.

**Files:**
- Move: `src/` → `apps/web/src/`
- Move: `public/` → `apps/web/public/`
- Modify: `apps/web/angular.json` (solo la ruta del `$schema`)
- Move: `angular.json`, `netlify.toml`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json` → `apps/web/`
- Create: `apps/web/package.json`
- Modify: `package.json` (raíz: pasa a ser solo workspaces y scripts)
- Modify: `.github/workflows/deploy.yml`
- Modify: `eslint.config.js` (`tsconfigRootDir` sigue siendo la raíz; verificar que `projectService` encuentra los tsconfig movidos)

**Interfaces:**
- Consumes: los scripts de la tarea 1.
- Produces: la ruta de artefacto `apps/web/dist/DevWeb/browser`, que usa el workflow de despliegue; y los workspaces `apps/*` + `packages/*`, de los que depende la tarea 4.

- [ ] **Step 1: Ver el estado que hay que conservar**

Run: `npx ng build --configuration production 2>&1 | tail -5 && ls dist/DevWeb/browser/index.html`
Expected: build correcto y el `index.html` existe. Ese es el resultado que hay que reproducir después de la mudanza.

- [ ] **Step 2: Mover los ficheros con git, para conservar el historial**

```bash
mkdir -p apps/web
git mv src apps/web/src
git mv public apps/web/public
git mv angular.json apps/web/angular.json
git mv netlify.toml apps/web/netlify.toml
git mv tsconfig.json apps/web/tsconfig.json
git mv tsconfig.app.json apps/web/tsconfig.app.json
git mv tsconfig.spec.json apps/web/tsconfig.spec.json
```

`database.rules.json`, `firebase.json`, `.firebaserc`, `CNAME`, `tools/`, `docs/` y `.github/` **se quedan en la raíz**.

- [ ] **Step 3: Crear `apps/web/package.json`**

Recibe todo lo que hoy tiene el `package.json` de la raíz salvo `workspaces`, `prettier` y los scripts de herramientas. El campo `name` cambia a `@devweb/web`.

```json
{
  "name": "@devweb/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test --watch=false"
  },
  "dependencies": {
    "@angular/common": "^21.1.0",
    "@angular/compiler": "^21.1.0",
    "@angular/core": "^21.1.0",
    "@angular/forms": "^21.1.0",
    "@angular/platform-browser": "^21.1.0",
    "@angular/router": "^21.1.0",
    "firebase": "^12.8.0",
    "jszip": "^3.10.1",
    "pica": "^9.0.1",
    "qrcode": "^1.5.4",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "^21.1.2",
    "@angular/cli": "^21.1.2",
    "@angular/compiler-cli": "^21.1.0",
    "@types/jszip": "^3.4.0",
    "@types/pica": "^9.0.5",
    "@types/qrcode": "^1.5.6",
    "jsdom": "^27.1.0",
    "typescript": "~5.9.2",
    "vitest": "^4.0.8"
  }
}
```

Son exactamente las de hoy. **No se actualiza ninguna versión en esta tarea**: una subida de versión mezclada con una mudanza de ficheros convierte cualquier fallo en un misterio.

`firebase` sigue aquí y seguirá hasta la fase 5. No se toca.

- [ ] **Step 4: Reescribir el `package.json` de la raíz**

```json
{
  "name": "devweb",
  "version": "0.0.0",
  "private": true,
  "packageManager": "npm@11.6.2",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "start": "npm run start -w @devweb/web",
    "build": "npm run build -w @devweb/web",
    "test": "npm run test -w @devweb/web",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc -p apps/web/tsconfig.app.json --noEmit && tsc -p apps/web/tsconfig.spec.json --noEmit",
    "build:maps": "node --experimental-strip-types tools/run.mjs tools/build-spain-map.ts && node --experimental-strip-types tools/run.mjs tools/build-world-map.ts",
    "check:rules": "node tools/check-rules.mjs",
    "deploy:rules": "firebase deploy --only database"
  },
  "prettier": {
    "printWidth": 100,
    "singleQuote": true,
    "overrides": [{ "files": "*.html", "options": { "parser": "angular" } }]
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "angular-eslint": "^21.4.0",
    "eslint": "^10.9.1",
    "eslint-config-prettier": "^10.1.8",
    "typescript-eslint": "^8.68.0"
  }
}
```

El bloque `prettier` se queda en la raíz —es una regla del monorepo entero, no de la web— y es literalmente el mismo de hoy. En `devDependencies` solo van las herramientas de lint que instaló la tarea 1.

Nota: `angular.json` referencia `./node_modules/@angular/cli/lib/config/schema.json` para el `$schema`. Con workspaces, npm iza las dependencias a la raíz, así que desde `apps/web` esa ruta relativa deja de resolver. Es solo la ayuda del editor, no afecta al build; cambiarla a `../../node_modules/@angular/cli/lib/config/schema.json`.

- [ ] **Step 5: Comprobar los assets de `angular.json`**

`angular.json` ahora vive en `apps/web` con `"root": ""`, así que sus rutas relativas siguen resolviendo dentro de `apps/web`. Verificar que estas cuatro entradas siguen apuntando a algo que existe:

- `{"glob": "**/*", "input": "public"}` → `apps/web/public` ✓ (movido en el paso 2)
- `{"glob": "_redirects", "input": "src"}` → `apps/web/src/_redirects` ✓
- `{"glob": "netlify.toml", "input": "."}` → `apps/web/netlify.toml` ✓ (movido en el paso 2)
- `{"glob": ".nojekyll", "input": "src"}` → `apps/web/src/.nojekyll` ✓

Confirmar los cuatro con `ls` antes de seguir. El único cambio que sí necesita `angular.json` es el `$schema` de su primera línea, que apunta a `./node_modules/...` y ahora tiene que apuntar a `../../node_modules/...`.

- [ ] **Step 6: Reinstalar para que npm cree los enlaces del workspace**

```bash
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 7: Verificar el build de producción desde la nueva ubicación**

```bash
npm run build
ls apps/web/dist/DevWeb/browser/index.html
```
Expected: build correcto y el fichero existe.

- [ ] **Step 8: Verificar los tests**

Run: `npm test 2>&1 | tail -5`
Expected: `Test Files 36 passed (36)` y `Tests 1089 passed (1089)`

- [ ] **Step 9: Actualizar el workflow de despliegue**

En `.github/workflows/deploy.yml`, tres cambios y ninguno más:

```yaml
      - name: Build
        run: npx ng build --configuration production --base-href /
        working-directory: apps/web

      - name: Copy index.html to 404.html for SPA routing
        run: cp apps/web/dist/DevWeb/browser/index.html apps/web/dist/DevWeb/browser/404.html

      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/web/dist/DevWeb/browser
```

`npm ci` sigue ejecutándose en la raíz: con workspaces, instala todo.

- [ ] **Step 10: Verificar que el `.gitignore` sigue tapando lo mismo**

Las entradas `/dist` y `/out-tsc` están ancladas a la raíz y ya no cubren `apps/web/dist`. Cambiarlas:

```
dist/
out-tsc/
```

Run: `npm run build && git status --short`
Expected: `git status` no lista nada dentro de `apps/web/dist`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "La raíz deja de ser la aplicación y pasa a ser el monorepo"
```

---

### Task 4: El motor de RISK sale a packages/shared

7.868 líneas que ya son puras. Se mueven tal cual: ni una línea de lógica cambia.

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Move: `apps/web/src/app/games/risk/engine/` → `packages/shared/src/engine/`
- Modify: los 17 ficheros de `apps/web/src/app/games/` que importan el motor
- Modify: `apps/web/tsconfig.json` (bloque `paths`), `apps/web/tsconfig.app.json` (quitar `rootDir`, ampliar `include`), `apps/web/tsconfig.spec.json` (ampliar `include`)
- Modify: `tools/build-spain-map.ts`, `tools/build-world-map.ts` (imports y rutas de salida)

**Interfaces:**
- Consumes: los workspaces `packages/*` de la tarea 3.
- Produces: el alias `@devweb/shared/engine/*`, que resuelve a `packages/shared/src/engine/*`. Es el import que usarán la web, el servidor de la fase 2 en adelante y las herramientas de mapas. Los símbolos públicos no cambian de nombre: `applyAction`, `legalActionTypes`, `GameState`, `GameAction`, `GameMap`, `WORLD_MAP`, `TINY_MAP`, `makeGame`, `setBoard` siguen exportándose desde los mismos ficheros.

- [ ] **Step 1: Crear el paquete**

`packages/shared/package.json` — la ausencia de dependencias no es un descuido, es la garantía de que sirve a los dos lados:

```json
{
  "name": "@devweb/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./*": "./src/*.ts" }
}
```

`packages/shared/tsconfig.json` — aquí sí entra `verbatimModuleSyntax`, porque el motor tiene cero decoradores de Angular:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: Mover el motor**

```bash
mkdir -p packages/shared/src
git mv apps/web/src/app/games/risk/engine packages/shared/src/engine
```

Los imports **internos** del motor (`./types`, `../engine`, `../engine/maps/map-registry` desde `ai/` y `geo/`) siguen siendo válidos: la carpeta se mueve entera y las rutas relativas dentro de ella no cambian. No tocarlos.

- [ ] **Step 3: Ver el fallo**

Run: `npm test 2>&1 | grep -c "error\|ERROR"`
Expected: falla la compilación con errores de módulo no encontrado en los ficheros que importaban `../engine/...`. Ese es el fallo que las tareas siguientes arreglan.

- [ ] **Step 4: Declarar el alias en los tsconfig de la web**

En `apps/web/tsconfig.json`, dentro de `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@devweb/shared/*": ["../../packages/shared/src/*"] }
```

En `apps/web/tsconfig.app.json`: **borrar** la línea `"rootDir": "./src"` —impide incluir ficheros de fuera de `src`— y ampliar el `include`:

```json
"include": ["src/**/*.ts", "../../packages/shared/src/**/*.ts"],
"exclude": ["src/**/*.spec.ts", "../../packages/shared/src/**/*.spec.ts"]
```

En `apps/web/tsconfig.spec.json`, ampliar el `include`:

```json
"include": [
  "src/**/*.d.ts",
  "src/**/*.spec.ts",
  "../../packages/shared/src/**/*.spec.ts"
]
```

- [ ] **Step 5: Reescribir los imports de los 17 consumidores**

Los ficheros son, todos bajo `apps/web/src/app/games/`:

```
games.ts
games.spec.ts
risk/services/local-room-store.ts
risk/services/local-room-store.spec.ts
risk/services/narrator.ts
risk/services/narrator.spec.ts
risk/services/risk-game.service.ts
risk/services/risk-game.service.spec.ts
risk/services/risk-room.service.ts
risk/services/risk-sync.ts
risk/services/risk-sync.spec.ts
risk/ui/risk-board/risk-board.ts
risk/ui/risk-board/risk-board.spec.ts
risk/ui/risk-lobby/risk-lobby.ts
risk/ui/risk-lobby/risk-lobby.spec.ts
risk/ui/risk-room/risk-room.ts
risk/ui/risk-room/risk-room.spec.ts
```

La transformación es mecánica y de dos formas, según la profundidad del fichero:

```bash
grep -rl "from '\.\./\.\./engine/" apps/web/src/app/games \
  | xargs sed -i "s#from '\.\./\.\./engine/#from '@devweb/shared/engine/#g"
grep -rl "from '\.\./engine/" apps/web/src/app/games \
  | xargs sed -i "s#from '\.\./engine/#from '@devweb/shared/engine/#g"
```

Después, comprobar que no queda ninguno:

```bash
grep -rn "from '\.\.*/engine" apps/web/src/app/games
```
Expected: sin resultados.

- [ ] **Step 6: Verificar que la web compila y los tests pasan**

```bash
npm run build
npm test 2>&1 | tail -5
```
Expected: build correcto y `Tests 1089 passed (1089)`

- [ ] **Step 7: Activar `verbatimModuleSyntax` en el paquete compartido**

Son 135 errores TS1484, todos mecánicos. Los corrige el lint:

```bash
npx eslint packages/shared --fix
npx tsc -p packages/shared/tsconfig.json --noEmit
```
Expected: sin errores.

Si `eslint --fix` no los cubre todos, la corrección manual es siempre la misma: `import { X }` pasa a `import type { X }` cuando `X` solo se usa como tipo. **Aquí es seguro porque el motor no tiene ni un decorador de Angular.** No aplicar esta transformación a `apps/web`.

- [ ] **Step 8: Actualizar las herramientas de mapas**

En `tools/build-spain-map.ts` y `tools/build-world-map.ts`, cambiar los imports:

```bash
sed -i "s#'\.\./src/app/games/risk/engine/#'../packages/shared/src/engine/#g" tools/build-*.ts
```

Y las rutas de salida, que están escritas como constantes:

- `tools/build-spain-map.ts:54` → `join(ROOT, 'packages/shared/src/engine/maps/spain.shapes.ts')`
- `tools/build-spain-map.ts:55` → `join(ROOT, 'packages/shared/src/engine/maps/spain-regions.shapes.ts')`
- `tools/build-world-map.ts:45` → `join(ROOT, 'packages/shared/src/engine/maps/world.shapes.ts')`

- [ ] **Step 9: Verificar las herramientas con la prueba que no engaña**

Regenerar los mapas y exigir que el resultado sea **idéntico** al que ya está versionado. Si las herramientas siguen funcionando, no cambia ni un byte:

```bash
npm run build:maps
git status --short packages/shared/src/engine/maps/
```
Expected: sin salida. Cualquier fichero listado significa que una herramienta se ha roto o que ha cambiado su salida, y hay que averiguar por qué antes de seguir.

- [ ] **Step 10: Verificación final de la tarea**

```bash
rm -rf .angular/cache out-tsc
npm run build
npm test 2>&1 | tail -5
npm run typecheck
```
Expected: build correcto, `Tests 1089 passed (1089)`, typecheck limpio.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "El motor de RISK sale del navegador y pasa a ser código compartido"
```

---

### Task 5: La frontera de `shared`, comprobada por la máquina

Que `packages/shared` no dependa de Angular ni de Node es la condición que lo hace consumible por los dos lados. Una condición que solo vive en un documento se rompe sola.

**Files:**
- Modify: `eslint.config.js` (bloque nuevo para `packages/shared/**`)

**Interfaces:**
- Consumes: `packages/shared` de la tarea 4.
- Produces: un `npm run lint` que falla si alguien acopla el paquete compartido a una plataforma.

- [ ] **Step 1: Escribir el test antes que la regla**

Crear a propósito un fichero que viole la frontera:

```bash
cat > packages/shared/src/frontera.tmp.ts <<'EOF'
import { Injectable } from '@angular/core';
import { readFileSync } from 'node:fs';
export const roto = [Injectable, readFileSync];
EOF
```

- [ ] **Step 2: Comprobar que el lint NO lo detecta todavía**

Run: `npx eslint packages/shared/src/frontera.tmp.ts`
Expected: no se queja de los imports prohibidos. Ese es el agujero.

- [ ] **Step 3: Añadir la regla**

En `eslint.config.js`, un bloque nuevo antes de `prettier`:

```js
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@angular/*'], message: 'shared no puede depender del framework: lo consume también el servidor.' },
          { group: ['rxjs', 'rxjs/*'], message: 'shared es dominio puro; los observables viven en la web.' },
          { group: ['node:*'], message: 'shared no puede depender de Node: lo consume también el navegador.' },
          { group: ['firebase', 'firebase/*'], message: 'shared no habla con ningún backend.' },
        ],
      }],
    },
  },
```

- [ ] **Step 4: Comprobar que ahora sí salta**

Run: `npx eslint packages/shared/src/frontera.tmp.ts`
Expected: dos errores `no-restricted-imports`, uno por `@angular/core` y otro por `node:fs`, cada uno con su mensaje.

- [ ] **Step 5: Retirar el fichero de prueba y verificar el paquete real**

```bash
rm packages/shared/src/frontera.tmp.ts
npx eslint packages/shared
```
Expected: sin errores de `no-restricted-imports`. El motor ya cumple la frontera; la regla solo la sostiene a partir de ahora.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js
git commit -m "La frontera del paquete compartido deja de depender de que alguien se acuerde"
```

---

### Task 6: Integración continua

Sin esto, las cinco tareas anteriores duran hasta el primer despiste.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: los scripts `lint`, `typecheck` y `test` de las tareas 1 y 3.

- [ ] **Step 1: Escribir el workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Tests
        run: npm test
```

`node-version: 22` a propósito: el `deploy.yml` actual usa 20, pero el backend de la fase 1 en adelante necesita 22. Actualizar también `deploy.yml` a 22 en este mismo commit, para que CI y despliegue compilen con el mismo Node.

- [ ] **Step 2: Comprobar en local exactamente lo que hará CI**

```bash
rm -rf node_modules .angular/cache out-tsc
npm ci
npm run lint
npm run typecheck
npm test 2>&1 | tail -5
```
Expected: los tres pasan y `Tests 1089 passed (1089)`.

Si `npm run lint` falla por la deuda de partida anotada en la tarea 1, este es el momento de decidirlo con el dueño del repositorio: o se arregla, o el paso de lint arranca acotado a `packages/shared` y `apps/server`. No se silencian reglas para que pase.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "Las reglas se comprueban en cada pull request, no cuando alguien se acuerda"
```

---

## Cierre de la fase

La fase 0 está terminada cuando:

- `npm ci && npm run lint && npm run typecheck && npm test` pasa desde cero.
- `Tests 1089 passed (1089)` — el mismo número que antes de empezar.
- `npm run build` produce `apps/web/dist/DevWeb/browser/index.html`.
- `npm run build:maps` no cambia ningún fichero versionado.
- El despliegue a GitHub Pages publica la web igual que antes, en `oscarblancorosales.com`.
- `packages/shared` no importa Angular, RxJS, Firebase ni Node, y una regla de ESLint lo impide.

Con eso, la fase 1 —VPS, nginx, TLS y systemd— arranca sobre un repositorio que ya tiene sitio para `apps/server` y un paquete de dominio que el servidor puede importar el primer día.
