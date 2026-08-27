# Estándares de DevWeb

Esto es lo que se lee antes de escribir código en este repositorio.

Cada regla de aquí la comprueba una herramienta. Lo que no puede comprobar una
herramienta no es una regla, es una intención, y las intenciones no sobreviven a
un viernes por la tarde.

---

## 1. Tipado

El nivel de rigor se decidió midiendo sobre el código real, no por gusto. Estos
son los números que salieron y dónde se activa cada flag:

| Flag | Errores al medirlo | Dónde se activa |
|---|---|---|
| `strict` | 0 | Todo el monorepo (ya estaba) |
| `exactOptionalPropertyTypes` | 7 | Todo el monorepo |
| `noUnusedLocals` + `noUnusedParameters` | 16 | Todo el monorepo |
| `verbatimModuleSyntax` | 189 (135 en el motor) | `packages/shared`, `apps/server` |
| `noUncheckedIndexedAccess` | 282 (200 en el motor) | Solo `apps/server` |

En las fronteras del sistema —HTTP, WebSocket, base de datos, variables de
entorno— lo que entra es `unknown`. Sale tipado solo después de pasar por un
esquema. `any` está prohibido y lo impide ESLint.

### Las dos deudas asumidas

No son olvidos. Son decisiones, y se escriben para que se puedan discutir.

**`verbatimModuleSyntax` no se activa en `apps/web`.** La web usa inyección por
constructor en 19 ficheros y `inject()` en ninguno. Con el flag puesto, TypeScript
exige que `import { ChangeDetectorRef }` pase a ser `import type`, porque solo lo
ve como anotación de tipo. Angular, en cambio, necesita ese símbolo como **valor**
para construir la fábrica de inyección del componente. El resultado sería una web
rota en runtime con toda la suite de tests en verde, que es la peor forma posible
de romper algo.

Migrar la web a `inject()` desbloquea el flag. Hasta entonces, se queda fuera.

**`noUncheckedIndexedAccess` solo se activa en `apps/server`.** En el código
existente son 282 errores, 200 de ellos dentro del motor de RISK: accesos a
arrays en la lógica de combate, de cartas y de misiones. Arreglarlos tiene riesgo
real de cambiar comportamiento y merece su propio plan, sus propias revisiones y
su propia tanda de tests. En el servidor sí está activo desde la primera línea,
porque ahí el código nace con él y no cuesta nada.

---

## 2. Un contrato, no dos

Los esquemas se declaran una vez con TypeBox. De esa declaración salen las tres
cosas: la validación en runtime, los tipos de TypeScript y la descripción del
endpoint.

No existe ninguna `interface` escrita a mano que duplique un esquema. Las copias
no se desincronizan el día que se escriben; se desincronizan el día que alguien
toca una de las dos con prisa.

---

## 3. Capas

`route → service → repository`. Sin saltos y sin excepciones.

- La **ruta** declara su esquema y sus permisos, y llama a un servicio. No tiene
  lógica.
- El **servicio** tiene las reglas. No sabe qué es una petición HTTP ni escribe
  SQL.
- El **repositorio** es una interfaz con su implementación. No sabe nada del
  dominio más allá de sus tablas.

Esto es lo que permite probar un servicio sin levantar una base de datos, y
cambiar el almacenamiento sin tocar ni una regla de negocio.

---

## 4. Errores

Un único `AppError` con código de dominio, y un único `errorHandler` que lo
traduce a HTTP en un solo sitio.

Nada de `try/catch` que capturan para volver a lanzar, ni de mensajes de usuario
construidos dentro de un servicio. El `switch` de mensajes que hay hoy en
`firebase-auth.service.ts` es justo lo que no se hace: mezcla la regla, el
transporte y el idioma en la misma función.

---

## 5. Legibilidad

El código se explica por sus nombres. Un comentario justifica **por qué**, nunca
narra **qué**.

El comentario de `settledUser$` en `firebase-auth.service.ts` es el ejemplo de
comentario que sí merece existir: explica por qué hacen falta dos observables
donde parecía bastar uno, y qué se rompe si usas el equivocado. Eso no lo puede
contar el código.

Un fichero que pasa de unas 300 líneas es una pregunta obligatoria —¿esto hace
más de una cosa?—, no un error automático.

---

## 6. Tests

Vitest. Primero la prueba que falla.

Los unitarios no tocan red, ni reloj real, ni base de datos. El tiempo y el azar
entran por parámetro, como ya hace `cleanOldRooms(ownerUid, now = Date.now())`:
un valor por defecto cómodo para producción y un punto de entrada para el test.

---

## 7. El lint: el código nuevo cumple, el heredado no empeora

`npm run lint` es el gate, y es el mismo en local y en CI.

**Errores (bloquean):** todo el conjunto `strictTypeChecked` sobre código nuevo.
Cero tolerancia.

**Avisos (no bloquean, pero no pueden crecer):** las mismas reglas sobre el código
que ya existía —`apps/web`, `tools` y el motor en `packages/shared`—. Son 1274 al
escribir esto, y `--max-warnings 1274` impide que suban.

El motivo de no ponerlos como error es práctico: son más de mil, la mayoría
aserciones `!` e interpolaciones sin tipo. Un repositorio en rojo permanente
enseña a ignorar el lint, y entonces deja de servir para lo único que sirve, que
es avisar de lo nuevo.

**Cuando se arregla deuda, se baja el número.** El trinquete solo aprieta.

Hay 45 avisos que `eslint --fix` arreglaría solo. No se han aplicado a propósito:
algunos de esos arreglos —`||` a `??`, por ejemplo— cambian comportamiento en los
casos límite, y esta fase se comprometió a no cambiar ninguno. Es una tarea
propia, con sus tests delante.

---

## 8. Fronteras entre paquetes

`packages/shared` no puede importar Angular, RxJS, Firebase ni módulos de Node.

No es purismo: es la condición que lo hace consumible a la vez por el navegador y
por el servidor. Una condición que solo vive en un documento se rompe sola, así
que la impone una regla de ESLint que falla el build.
