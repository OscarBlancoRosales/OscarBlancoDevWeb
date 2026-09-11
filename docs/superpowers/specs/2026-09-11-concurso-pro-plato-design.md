# El Concurso PRO: un plató, no una pantalla de preguntas

Fecha: 2026-09-11

## Por qué

El concurso ya es un concurso por dentro. Tiene seis pruebas distintas, una
escaleta que las ordena como un programa de televisión, once personajes con
cara propia, un presentador con seis gestos y un guion escrito detrás.

Por fuera es una pregunta, cuatro botones y una lista de nombres en columna.

Nada de lo que hace especial al juego se ve. Las secciones se suceden sin que
nadie las anuncie, así que veinte rondas se sienten como veinte preguntas
seguidas y no como un programa con partes. Los concursantes no están en ningún
sitio: el marcador es una lista, no una fila de gente mirándote. Y el
presentador —que es la mitad del juego— lleva semanas mudo en producción.

Lo que se construye es **el plató**: la parte que hace que esto parezca el
Buzz! de la PS2 y no un formulario que da puntos.

## El presentador lleva mudo desde el día 10, y no es culpa de la IA

Conviene decirlo antes que nada, porque cambia qué hay que arreglar. De los
logs del VPS:

```
Sep 10 16:23:35  el modelo contestó algo que no se puede enseñar (495 letras)
Sep 10 16:23:39  el modelo contestó algo que no se puede enseñar (484 letras)
Sep 10 16:23:43  el modelo contestó algo que no se puede enseñar (409 letras)
Sep 10 16:23:44  el modelo contestó algo que no se puede enseñar (448 letras)
…diez de diez, ninguna por debajo de 375
```

El modelo contesta. La cadena de reserva funciona. Lo que falla es que
**tiramos a la basura todo lo que dice**, porque el presupuesto y la vara de
medir se contradicen:

| Dónde | Qué dice | Equivale a |
|---|---|---|
| `florear()` | `maxTokens: 120` | ~480 letras en español |
| `aceptable()` | `LARGO_MAXIMO = 320` | se rechaza a partir de 320 |
| `limite()` | «una o dos frases cortas» | ninguna cifra |

Le damos cuerda para escribir exactamente lo que vamos a rechazar, y la única
instrucción de longitud que recibe no lleva números. El resultado es un
presentador que habla y al que nadie oye.

Hay dos fallos más, menores, detrás de ese:

- **Un solo plazo global de 12 s, sin plazo por modelo.** El primer modelo
  lento se come el presupuesto entero y los cuatro de reserva no llegan a
  estrenarse. Es el mismo fallo que tenía el crupier del póker y que se
  arregló el 10 de septiembre; al presentador no se le aplicó.
- **`AI_MODEL` en el VPS apunta a `deepseek/deepseek-chat-v3-0324:free`**, que
  dejó de ser gratuito. La cadena lo salva, pero quema una llamada muerta por
  frase. Esto es configuración del servidor, no código: se anota, no se toca
  aquí.

## Qué se construye

1. Un **plató a pantalla completa**, fuera del marco terminal, con atriles.
2. **Rótulos de sección** que anuncian cada prueba.
3. Un **cronómetro que corre en el servidor** y cierra la ronda solo.
4. Una **final a doble o nada** con apuesta secreta.
5. Un **podio** con ceremonia y confeti.
6. Un **presentador que habla de verdad**, con un encargo y una medida por
   cada momento del programa.
7. Un **modo con las preguntas inventadas por la IA**, en crescendo de
   dificultad, con botón para impugnar la que salga mal.
8. **Sonido**, callado hasta que lo pidas.

## Qué NO se construye

- No se toca el motor de reglas ni el banco de preguntas. Están bien.
- No se toca ningún otro juego ni el resto del sitio.
- No hay voz hablada. Se descartó a propósito: la voz del sistema en español
  suena a GPS y no está en todos los navegadores.
- No hay duelo final entre los dos primeros. Se eligió la apuesta para que
  nadie se quede mirando los últimos cinco minutos.
- No se cambia `AI_MODEL` en el VPS. Es del dueño del servidor.
- No hay ranking entre partidas, ni perfiles, ni logros.

---

## 1. El plató

### Por qué sale del marco terminal

El resto del sitio es una terminal: cabecera verde, prompt `>`, fondo negro.
Un plató es lo contrario —focos, color, profundidad— y meterlo dentro de un
marco le quita justo el sitio y el aire que necesita para impresionar. El
concurso, y solo el concurso, se sale.

### La forma

```
┌────────────────────────────────────────────┐
│  ✦ focos ✦          RONDA 7/20    ⏱ 08     │
│        ┌──────────────┐                    │
│        │  PRESENTADOR │  «Vamos con la     │
│        │    (gesto)   │   bomba, y que     │
│        └──────────────┘   no os pille…»    │
│                                            │
│   ¿Qué devuelve typeof null en JavaScript? │
│   ┌────────┐┌────────┐┌────────┐┌────────┐ │
│   │A "null"││B object││C undef ││D Error │ │
│   └────────┘└────────┘└────────┘└────────┘ │
│  ╭───╮  ╭───╮  ╭───╮  ╭───╮  ╭───╮         │
│  │:D │  │:o │  │ - │  │:| │  │>:(│  atriles│
│  │340│  │520│  │180│  │410│  │ 90│         │
│  ╰───╯  ╰───╯  ╰───╯  ╰───╯  ╰───╯         │
└────────────────────────────────────────────┘
```

### Los atriles

Es el cambio que más se nota. El marcador deja de ser una lista y pasa a ser
**la gente**: cada concursante en su puesto, con su cara, su nombre y sus
puntos, reaccionando en vivo.

| Estado | Qué se ve |
|---|---|
| Ha contestado | El atril se enciende. No qué ha contestado: solo que ya está |
| Acierta | Verde, sube, y los puntos cuentan hacia arriba |
| Falla | Se apaga y baja |
| Tiene la bomba | Tiembla, con la mecha encima |
| Va primero | Corona |
| Eres tú | Marcado siempre, que con cinco atriles hace falta |

La cara del personaje ya existe (`assets/trivial/cast`, once personajes). Lo
que se añade es el puesto y la reacción.

### Cómo se parte

`trivial-room` son hoy 253 líneas de TypeScript, 188 de plantilla y 495 de
CSS, y hace de todo. Un plató entero ahí dentro no cabe sin volverlo
ilegible. Se parte en piezas con una sola misión cada una, bajo
`apps/web/src/app/games/trivial/plato/`:

| Pieza | Qué hace | Qué le entra |
|---|---|---|
| `plato/` | El escenario: fondo, focos, suelo, silencio | La vista entera |
| `presentador/` | La figura, el gesto y el bocadillo | `dice`, `momento` |
| `atriles/` | La fila de puestos y sus reacciones | puestos, turno, resultados |
| `panel-pregunta/` | Enunciado, código y opciones A–D | la ronda abierta |
| `rotulo/` | La cortinilla de sección a toda pantalla | sección entrante |
| `cronometro/` | La barra de cuenta atrás | `cierraEn` |
| `apuesta/` | El mando de la apuesta final | puntos y apuesta |
| `podio/` | La ceremonia y el confeti | clasificación final |

`trivial-room` se queda de **director**: mira la vista y decide qué está en
pantalla. Ninguna pieza sabe de WebSocket; todas reciben datos y emiten
eventos. Eso es lo que las hace probables por separado.

---

## 2. Los rótulos: que las pruebas se noten

Las seis pruebas ya se juegan. Lo que no hay es quien las anuncie.

Al entrar una sección nueva, el plató se detiene y entra un rótulo a toda
pantalla con el nombre de la prueba, cómo se juega y qué se gana o se pierde,
mientras el presentador la presenta. Dura lo que dura la frase; luego se va y
empieza la primera pregunta.

```
     ╔══════════════════════════════╗
     ║          LA  BOMBA           ║
     ║   Contesta y pásala.         ║
     ║   Que no te pille.           ║
     ║   Aciertas +60 · Estalla −120║
     ╚══════════════════════════════╝
```

El momento ya existe en el motor (`seccionTest`, `seccionBomba`…) y ya llega
en la vista. Lo único que falta es enseñarlo.

---

## 3. El cronómetro

### Dónde corre

En el servidor. Un reloj de navegador es un reloj que se puede parar desde las
herramientas de desarrollo, y este es un concurso para programadores.

Se sigue el patrón que ya usa el debate del Impostor, que resuelve esto bien:
lo que viaja es **el instante en que se acaba**, no los segundos que quedan.
Cada pantalla cuenta hacia atrás contra ese instante, así que las cinco
enseñan lo mismo aunque sus relojes no coincidan.

- `TrivialState.cierraEn: number` — hora de cierre, o `0` si esta ronda no
  lleva reloj. Entra como dato de la acción `{ tipo: 'reloj', hasta: number }`,
  nunca leyendo `Date.now()` dentro del reducer: si no, la partida no se podría
  reconstruir desde su log.
- El `RegidorDeSala` pone el `setTimeout` y, al vencer, aplica `{ tipo: 'tiempo' }`.
- `{ tipo: 'tiempo' }` sobre una ronda ya cerrada **no es un error, es nada**.
  Que el reloj llegue tarde a una ronda que acaba de cerrarse es lo normal, no
  la excepción.

El regidor y el presentador son dos cosas distintas —uno lleva el reloj, otro
habla— y por eso son dos clases. La sala tiene un solo hueco de narrador, así
que se compone: un narrador mínimo que reparte `trasJugada` y `parar` entre
los dos.

### Cuánto dura cada prueba

| Prueba | Segundos | Por qué |
|---|---|---|
| Test | 25 | Cuatro opciones y a pensar |
| Encuentra el fallo | 40 | Hay que leer código |
| A ojo | 30 | Hay que estimar y escribir |
| El primero que pulse | 15 | La prisa es la prueba |
| Ráfaga | 10 | Verdadero o falso, del estómago |
| La apuesta | 45 | Se está apostando el programa entero |
| La pregunta final | 30 | Con todo en juego, se piensa |

Quien no contesta a tiempo se queda sin puntos de esa ronda. No se le castiga:
ya pierde bastante.

---

## 4. La final: a doble o nada

### Cómo va

Acabadas las pruebas, el programa no se acaba: entra **la última pregunta**.

1. El presentador anuncia la final y pide las apuestas.
2. Cada uno apuesta, **en secreto**, entre 0 y todo lo que lleva. Se ve quién
   ha apostado ya, nunca cuánto —igual que hoy se ve quién ha contestado y no
   qué—.
3. Cerradas las apuestas, se cantan todas a la vez. Ese es el momento.
4. Una pregunta. Aciertas y te llevas lo apostado; fallas y lo pierdes.

No se puede apostar más de lo que se tiene, así que nadie acaba en negativo, y
quien no apuesta se planta con lo suyo —que es una jugada legítima cuando vas
primero—. Quien no llega a apostar a tiempo se planta: apuesta cero.

### Qué cambia en el motor

```ts
// tipos.ts
type Fase = 'presentacion' | 'ronda' | 'resultado' | 'apuestas' | 'fin';
type TipoPrueba = … | 'final';

interface TrivialState {
  …
  /** Lo que se juega cada uno. Secreto hasta que la fase se cierra. */
  readonly apuestas: Readonly<Record<SeatId, number>>;
  readonly cierraEn: number;
}
```

Acción nueva: `{ tipo: 'apostar', cuanto: number }`, validada contra los puntos
que tiene quien apuesta. La vista manda `hanApostado` mientras está abierta y
`apuestas` completas cuando se cierra.

Puntuación en `reglas.ts`: `acierta ? +apuesta : −apuesta`, sin bonus por
rapidez. En una apuesta, correr no es la gracia.

La pregunta sale de un grupo nuevo, `FINAL`, en `pruebas.ts`: gordas, de las
que se recuerdan, y nunca de las que se contestan de un vistazo —una final que
se resuelve en dos segundos no es una final—. La escaleta de `banco.ts` se
cierra con `{ tipo: 'final', cuantas: 1 }`, con lo que el programa pasa de 20
rondas a 21.

---

## 5. El podio

Con el marcador final, ceremonia:

```
        ✦ ✧ ✦ confeti ✧ ✦ ✧
                 ╭────╮
                 │NOVA│
          ╭────╮ │ 520│ ╭────╮
          │SAGE│ │  1 │ │ATLA│
          │ 480│ │    │ │ 340│
          ╰────╯ ╰────╯ ╰────╯
```

Los tres primeros suben por orden —tercero, segundo, primero—, cae el confeti,
el presentador se despide y debajo queda el marcador completo, que también
tiene que ver quien quedó quinto.

El confeti se dibuja en un `canvas`, se para solo a los pocos segundos y
respeta `prefers-reduced-motion`: quien pidió que no se mueva nada, no ve
confeti.

---

## 6. El presentador: un encargo y una medida por momento

Esta es la parte que arregla el fallo de producción y, de paso, la que hace que
el presentador deje de sonar siempre igual.

### La idea

Hoy hay una tarea distinta por momento —eso ya está bien hecho— pero **una
sola longitud para todos**, y encima puesta con palabras («una o dos frases
cortas») en vez de con un número. Presentar el programa, cantar una sección,
comentar una explosión y despedirse no duran lo mismo ni de lejos.

Cada momento pasa a declarar **su encargo y su medida**, y esa cifra gobierna
las tres cosas que hoy se contradicen:

```ts
interface Encargo {
  /** Qué se le pide, con los datos de la partida dentro. */
  readonly tarea: (ctx: ContextoDelPresentador) => string;
  /**
   * Letras como mucho. Es LA cifra: entra en el prompt, decide el presupuesto
   * de tokens y decide el recorte. Tres sitios, un número.
   */
  readonly largo: number;
}
```

- **En el prompt:** «Como mucho, 140 letras. Una frase.» Con número, no con
  adjetivos.
- **En el presupuesto:** `maxTokens = ceil(largo / 3)`. En español un token da
  unas cuatro letras, así que dividir entre tres deja holgura para acabar la
  frase sin dar cuerda para un discurso.
- **En la comprobación:** se recorta a la última frase completa que quepa. Solo
  si no cabe **ni la primera frase** se cae al guion escrito.

Que el mismo número mande en los tres sitios es lo que hace imposible volver a
caer en lo de ahora: pedir 480 letras y aceptar 320.

### Las medidas

| Momento | Letras | Qué se le pide |
|---|---|---|
| `bienvenida` | 420 | Abre el programa y presenta a la mesa, uno a uno, con pulla |
| `seccion*` | 240 | Anuncia la prueba y canta sus normas |
| `presentaRonda` | 120 | Un pinchazo y a la pregunta |
| `aciertaAlguien` | 140 | Canta el acierto y lo que se lleva |
| `nadieAcierta` | 140 | Se ríe de la mesa entera |
| `remonta` | 160 | Canta el adelantamiento |
| `lider` | 300 | **Repaso del marcador**, con las cifras dadas |
| `seHunde` | 160 | **Chiste sobre el que va perdiendo**, con salida digna |
| `pegados` | 140 | Mete emoción: esto está abierto |
| `rachaBuena` | 140 | Alucina con la racha y pide que alguien la pare |
| `pasaLaBomba` | 90 | Prisa pura. La bomba sigue viva |
| `explota` | 120 | Desgracia divertida, bien fuerte |
| `ultimaRonda` | 160 | Sube el clímax |
| `empate` | 120 | Guasa |
| `seccionFinal` | 280 | Anuncia la final y explica el doble o nada |
| `presentaApuestas` | 260 | Pide las apuestas y pincha a los cobardes |
| `apuestasCerradas` | 200 | Canta quién se ha jugado cuánto |
| `resultadoFinal` | 300 | El vuelco, o la falta de vuelco |
| `podio` | 380 | Cierra: ganador, segundo, último, y despedida |

Los cinco últimos son momentos nuevos —`seccionFinal`, `presentaApuestas`,
`apuestasCerradas`, `resultadoFinal` y `podio`—, cada uno con sus frases
escritas de reserva en `guion.ts`.

### Lo que no cambia, y no puede cambiar

- **El guion escrito sigue debajo de todo.** La frase existe antes de llamar a
  nadie. Un modelo caído, lento o sin cuota no deja mudo al concurso.
- **El presentador no sabe la respuesta.** `ContextoDelPresentador` no lleva
  `correcta` y no la va a llevar. Es la misma razón por la que las preguntas
  viven en el servidor: que la respuesta no esté al alcance de quien contesta.
  Con las apuestas esto importa más que nunca, porque ahí el presentador habla
  **antes** de que se sepa la respuesta.
- **El presentador no arbitra.** No suma puntos, no decide respuestas, no
  cambia el resultado de nada. Solo habla.
- **Los datos se le dan hechos.** Marcador, nombres y cifras van dentro del
  encargo, con la prohibición explícita de inventar otros.

### El plazo

Como el crupier: plazo por modelo además del global, para que la cadena de
reserva llegue a usarse.

```ts
const PACIENCIA_MS = 25_000;        // lo que se espera en total
const PLAZO_POR_MODELO_MS = 8_000;  // tres caben dentro
```

---

## 7. El modo IA: un programa escrito en el momento

### La idea

En vez de repartir el banco, se le pide a la IA que **escriba el programa
entero**: 21 preguntas, una tanda por prueba, de temas repartidos y con la
dificultad subiendo de la primera a la última. Nosotros recogemos ese JSON y
lo pintamos en nuestro plató como cualquier otra pregunta.

### Por qué cabe sin tocar nada

Porque ya hay un sitio, y solo uno, por donde entran las preguntas a una sala:

```ts
function conLoQueElJuegoNecesite(game, config) {
  const semilla = randomInt(0, 2 ** 31);
  return { ...config, semilla, preguntas: repartir(semilla) };
}
```

Está en el servidor, las congela en la sala al crearla y no las deja acercarse
al bundle de la web. El modo IA es cambiar `repartir(semilla)` por
`inventar(...)` ahí dentro —y volver la función `async`, que es el único
cambio que se propaga—.

Que se generen **una vez, al crear la sala**, no es un detalle: es lo que
mantiene la partida reconstruible desde su log y lo que impide pedir otra tanda
a mitad de programa porque esta no gustó.

### Una llamada por prueba

Nada de pedir veintiuna preguntas de golpe. Una llamada por sección, en
paralelo, cada una con su encargo —igual que el presentador tiene un encargo
por momento—:

| Sección | Qué se le pide |
|---|---|
| Test | Cuatro opciones, una buena, de rarezas que se recuerdan |
| Encuentra el fallo | Código corto con **un** error real, y en qué línea está |
| A ojo | Un número comprobable, con su margen de error declarado |
| El primero que pulse | Cortas, de las que se saben o no se saben |
| Ráfaga | Verdadero o falso, sin medias tintas |
| La bomba | Cortísimas, que se contesten con la mecha corriendo |
| La final | Gorda, de las que se recuerdan al salir |

Los temas se reparten **a la fuerza** —redes, SQL, CSS, sistemas, control de
versiones, historia de la informática, seguridad, rendimiento—, porque a un
modelo al que le pides preguntas de programación te da diez de JavaScript.

### La dificultad, en crescendo

`Pregunta` gana un campo opcional:

```ts
/** Del 1 al 5. La 1 se contesta de memoria; la 5 la falla casi todo el mundo. */
readonly dificultad?: 1 | 2 | 3 | 4 | 5;
```

Opcional a propósito: el banco escrito a mano no tiene que rellenarlo para que
esto funcione. En el modo IA se pide por posición, así que la ronda 1 entra
blanda y la 21 muerde. En el plató se ve, que si no, no sirve de nada: una
fila de chiles junto al rótulo de sección.

### El formato, y cómo se valida

Se le pide JSON con un esquema estricto, y se valida con TypeBox —que ya es lo
que este repositorio usa para todo lo que llega de fuera—. Dos decisiones que
cambian mucho cuántas sobreviven:

- **La respuesta va escrita, no numerada.** Los modelos cuentan fatal: te dicen
  «la 2» queriendo decir la tercera, o cuentan desde uno. Escribiendo cuál es
  aciertan. Nosotros la buscamos entre las opciones y sacamos el índice.
- **Barajamos las opciones nosotros.** Un modelo pone la buena la primera
  mucho más de lo que el azar permitiría. Contar sin leer no puede ser una
  estrategia ganadora.

### Cuando la IA falle, que falle hacia el banco

Lo que no valida, se sustituye por una del banco. Si se cae una sección
entera, esa sección sale del banco completa. Si se cae la llamada, el programa
entero sale del banco y se avisa en la sala.

**Nunca se abre una sala con menos de 21 rondas jugables.** Un programa a
medias es peor que un programa del banco.

Mientras se monta, la sala enseña una pantalla de «escribiendo el programa…»,
con un plazo global: pasado ese plazo, se juega con lo que haya y el resto del
banco.

### Que alguna estará mal, y qué se hace

La forma se puede garantizar. **La verdad no.** Un modelo gratuito va a colar
preguntas mal contestadas, y esto se asume: el modo va marcado como
experimental y el presentador avisa de que las preguntas las ha escrito una
máquina.

Para lo que escueza de verdad, hay botón:

```
┌──────────────────────────────────┐
│ ¿Qué puerto usa SMTP por defecto?│
│  [A 25] [B 465] [C 587] [D 110]  │
│                                  │
│          ⚑ esta está mal (2/4)   │
└──────────────────────────────────┘
```

- Acción nueva `{ tipo: 'impugnar' }`, mientras la ronda está abierta.
- Se anula **por unanimidad de las personas de la mesa**. No por mayoría: con
  mayoría, quien no se sabe la respuesta impugna para no perder puntos, y el
  botón pasa de arreglar preguntas malas a ser una jugada más. Teniendo que
  darle todos, nadie la anula por interés propio.
- Los bots no opinan. En una mesa de una persona contra bots, esa persona
  anula sola —y allá ella, que juega consigo misma—.
- Anulada: nadie gana ni pierde puntos y se pasa a la siguiente. El presentador
  lo canta y le echa la culpa a la máquina (momento nuevo `anulada`, 160
  letras).
- El botón **solo existe en el modo IA**. El banco está escrito a mano y
  revisado; abrir ahí la puerta a anular rondas es invitar a usarla.

### Dónde se elige

En el lóbby, al abrir la sala, junto a «contra quién»:

```
┌─ Nuevo concurso ────────────────────┐
│ Preguntas                           │
│  (●) Del banco                      │
│  ( ) Inventadas por la IA  ⚠ nuevo  │
└─────────────────────────────────────┘
```

Es una elección de quien abre la sala y queda congelada en ella: no se cambia
a mitad de programa. El mismo programa de 21 rondas y las mismas seis pruebas
en los dos modos —lo único que cambia es de dónde salen las preguntas—, que es
lo que permite compararlos.

### Sin clave de IA

El modo no aparece. No se ofrece un botón que va a fallar: en el lóbby se
explica en una línea que hace falta una clave configurada en el servidor.

---

## 8. El sonido

Efectos cortos generados en el navegador con la API de audio —nada de
descargar megas de MP3—: golpe de rótulo, pulsación, acierto, fallo, tic-tac
que acelera con la mecha y fanfarria de podio.

**Arranca callado.** El botón de silencio está siempre visible y la elección se
recuerda. Una web que empieza a pitar sola es una pestaña que se cierra.

---

## 9. Cómo se prueba

El motor y el servidor se prueban como todo lo demás del repositorio, en
`vitest`:

- **Reglas de la final:** aciertas y doblas, fallas y lo pierdes, no puedes
  apostar más de lo que tienes, no se acaba en negativo.
- **Apuestas secretas:** la vista no enseña las cifras ajenas hasta que la fase
  se cierra. Esto se prueba explícitamente, como se probó que la respuesta
  correcta no viaja con la ronda abierta.
- **El reloj:** la ronda se cierra sola al vencer; el `tiempo` que llega tarde
  a una ronda cerrada no rompe nada.
- **Las medidas del presentador:** cada momento tiene encargo y medida, el
  recorte devuelve frases completas, y una respuesta larguísima acaba en algo
  enseñable en vez de en nada. Aquí va una prueba con las **cifras reales de
  los logs del día 10** —495, 484, 409 letras— para que este fallo concreto no
  pueda volver.
- **Los momentos nuevos:** se detectan cuando toca y no cuando no toca.
- **El modo IA:** lo que no valida se sustituye por el banco; una respuesta que
  no está entre las opciones tira la pregunta; las opciones acaban barajadas;
  una sección entera caída sale del banco completa; y **de una llamada que
  devuelve basura sale igualmente un programa de 21 rondas jugables**. Todo
  esto se prueba con dobles, sin tocar la red.
- **La impugnación:** con unanimidad se anula y nadie gana ni pierde puntos;
  faltando uno, no; los bots no cuentan para la unanimidad; y en el modo del
  banco la acción se rechaza.

Las piezas del plató se prueban con `TestBed`: que cada una pinte lo que le
entra, que el atril reaccione al estado que le dan, y que el director enseñe la
pieza que toca en cada fase.

Lo que no se prueba automáticamente es si está guapo. Eso se mira en local y
luego en producción.

---

## 10. Riesgos

| Riesgo | Qué se hace |
|---|---|
| El plató a pantalla completa se rompe en el móvil | Los atriles pasan a dos filas y el presentador encoge. Se comprueba a 400 px |
| El modelo sigue pasándose de largo | Ya no importa: se recorta en vez de tirar. El guion escrito sigue debajo |
| El reloj del servidor y el del navegador no coinciden | Viaja el instante de cierre, no los segundos. Es el patrón que ya funciona en el Impostor |
| Veinte rondas con rótulos se hacen largas | El rótulo dura lo que la frase y se puede saltar pulsando |
| El confeti marea | `prefers-reduced-motion`, y se para solo |
| `AI_MODEL` del VPS sigue retirado | Se anota para el dueño del servidor. La cadena lo salva igual |
| La IA escribe preguntas mal contestadas | Se asume y se avisa: modo experimental. Para lo que escueza, el botón de impugnar por unanimidad |
| Montar el programa con IA tarda demasiado | Una llamada por sección en paralelo, plazo global, y lo que no llegue sale del banco |
| La IA devuelve JSON roto o a medias | Validación estricta con TypeBox y sustitución por el banco pregunta a pregunta |

## 11. Por dónde se empieza

En este orden, porque cada paso se puede ver funcionando antes del siguiente:

1. **El presentador.** Es el fallo de producción y no depende de nada. Se
   arregla, se despliega y se oye hablar.
2. **El motor:** reloj, fase de apuestas y la final. Con sus pruebas.
3. **El plató:** escenario, atriles y panel de pregunta.
4. **Los rótulos** y el cronómetro en pantalla.
5. **La final** y el podio.
6. **El modo IA**: generación, validación, dificultad e impugnación. Va aquí y
   no antes porque se apoya en el presentador ya arreglado —misma cadena de
   modelos, mismos plazos— y porque hasta que el plató no está en pie no se
   puede ver si una pregunta inventada luce como una del banco.
7. **El sonido**, al final, que es la guinda.
