# RISK — cómo está hecho y cómo se pone en marcha

La sección **Juegos** (`/juegos`) arranca con un RISK completo: reglas clásicas, tres mapas,
bots con IA que hablan por el chat, partidas grabadas y reanudables. La web se sirve desde
GitHub Pages y el árbitro es el backend propio (`apps/server`).

---

## 1. Puesta en marcha rápida

```bash
npm install
npm run dev -w @devweb/server   # la API en http://localhost:3000
ng serve                        # http://localhost:4200/juegos
npm test                        # 1.400+ tests
```

Para jugar **no hace falta ni la API**: en `/juegos/risk` hay un botón
**«🤖 Jugar aquí contra la IA»** que crea una partida local, guardada en el navegador y sin
red. Sirve para probar mapas, jugar contra los bots y enseñar el producto aunque el
servidor esté caído.

Para jugar **con otras personas** hace falta iniciar sesión —igual que en el Scrum Poker—
y que la API esté en pie. Quien llega por un enlace de invitación no necesita cuenta.

---

## 2. Arquitectura: el servidor es el árbitro

```
        ┌──────────────┐         jugada          ┌───────────────────────────┐
        │  Cliente A   │ ──────────────────────► │  apps/server              │
        └──────┬───────┘                         │    motor puro (el mismo)  │
               │      vista propia               │    log de acciones        │
               ▼◄─────────────────────────────── │    foto cada 40 jugadas   │
   pinta lo que le mandan                        │    SQLite                 │
        ┌──────────────┐         jugada          └───────────────────────────┘
        │  Cliente B   │ ──────────────────────►
        └──────────────┘      otra vista propia
```

- El motor (`packages/shared/src/engine/engine.ts`) es una función pura: mismo estado +
  misma acción → mismo resultado. Lo comparten el navegador y el servidor, así que las
  reglas están escritas una sola vez.
- El cliente **no aplica** las jugadas de la partida en red: las manda, el servidor las
  juzga con ese motor y devuelve el estado ya calculado. Por eso el log del cliente va
  vacío y el estado llega entero en cada mensaje: no hay nada que reconstruir.
- El servidor guarda **la jugada, no el estado**: un log de solo-añadir y una foto cada
  cuarenta acciones. El log **es** la grabación de la partida, y por eso una sala se puede
  tirar de memoria cuando nadie la usa y recuperarla intacta cuando alguien vuelve.
- **A cada asiento se le manda solo lo suyo.** `view()` quita del estado las cartas de los
  rivales y el mazo antes de enviarlo. No es que el cliente las oculte: es que no viajan.
  Con las reglas en Firebase estaban a la vista de cualquiera que abriese la consola.

Las salas cuyo identificador empieza por `LOCAL-` siguen viviendo enteras en el navegador
(`local-room-store.ts`), y ahí sí se reproduce el log en el cliente, porque no hay
servidor que arbitre. Mismo formato de datos, cero red.

### Qué impide el servidor que antes no impedía nadie

| Antes (Firebase) | Ahora |
|---|---|
| Cualquiera con el enlace veía las cartas de todos | Las cartas ajenas no salen del servidor |
| Una jugada firmada con el nombre de otro se aplicaba | Se rechaza: el remite lo pone la conexión, no el mensaje |
| Un mensaje podía firmarse con el nombre y el papel que quisieras | El nombre y el tipo los pone el servidor a partir del asiento |
| Quien conociera el identificador podía escribir en la sala | Hace falta el pase del asiento, que solo se entrega al sentarse |

### El anfitrión

Un cliente hace de **anfitrión**: mueve los bots. Se elige de forma determinista —el
propietario si está conectado; si no, el humano conectado más antiguo—, así que nunca hay
dos clientes moviendo el mismo bot, y si el anfitrión se va otro toma el relevo. Si no
queda nadie, los bots se paran: la partida espera.

Que los bots los mueva un cliente y no el servidor es la única pieza que se ha dejado como
estaba. Tiene consecuencias visibles y conviene decirlas:

- El servidor acepta una jugada firmada con el `playerId` de **un bot de la sala** venga
  del asiento que venga. Con el de otra persona, nunca.
- La mano de un bot va **a la vista** en la vista de todos, porque alguien tiene que
  jugarla. Sigue siendo menos de lo que se veía antes, que era todo.

Moverlos en el servidor sería mejor —y quitaría las dos excepciones—, pero es trabajo
nuevo, no una migración: el cerebro de los bots habla con el modelo de lenguaje desde el
navegador, con la clave del usuario.

### La alineación se congela al empezar

Al pulsar «Empezar la partida» la sala pasa a `playing`, y **ese es el momento en que el
servidor reparte el mapa**, con los asientos que haya sentados entonces. Antes de eso no
hay partida: la sala de espera enseña una vista previa que calcula el propio navegador.
Después, renombrarse, cambiar de color o desconectarse no toca el tablero.

---

## 3. Quién puede hacer qué

No hay reglas de base de datos que mantener: las decisiones están en el servidor, en
`apps/server/src/rooms/`, y cada una tiene su test.

- **Crear una sala exige sesión.** Sin dueño no hay quien la borre ni quien reparta los
  asientos.
- **Sentarse no exige cuenta.** Quien llega por el enlace de invitación se sienta como
  invitado; es toda la gracia del enlace.
- **El pase del asiento es la credencial.** Se entrega una vez, al sentarse, y viaja en la
  cabecera `X-Seat-Token` o en la URL del WebSocket. Nunca se le manda a los demás: los
  asientos que ve el resto llevan el identificador, no el pase.
- **Solo quien creó la sala** reparte bots, cambia el mapa o las reglas, y pasa la partida
  a jugando. Y solo él habla con la voz de la sala en el chat.
- **Cada cual toca su asiento.** Renombrarse y cambiar de color, sí; levantar a otro de su
  silla, no.
- **El log es de solo-añadir.** Una jugada apuntada no se reescribe: el log es la partida.
- **Las salas caducan.** El servidor borra las que llevan más de un mes sin tocarse, con
  su propia fecha y sin depender de que nadie abra el navegador.

El modelo de acceso a una sala sigue siendo el de un enlace secreto: **el identificador es
la invitación**. La diferencia es que ahora el identificador solo sirve para *pedir* un
asiento, y lo que autoriza a jugar es el pase que se entrega al sentarse.

---

## 4. La IA

Hay **dos cerebros**, y el segundo es opcional:

### 4.1 Cerebro heurístico local (siempre activo, gratis, sin red)

`engine/ai/bot-brain.ts` juega partidas completas: reparte refuerzos según la presión de
cada frontera, calcula la probabilidad exacta de conquista de cada ataque posible (cadena
de Markov, `engine/combat.ts`), canjea cartas, reagrupa y sabe cuándo parar. Cinco
personalidades:

| Perfil | Cómo juega |
|---|---|
| Agresivo | Ataca a la mínima |
| Cauto | Se atrinchera; solo ataca con la tirada de su parte |
| Oportunista | Busca fronteras flojas y se ceba con el que va perdiendo |
| Expansivo | Obsesionado con cerrar continentes |
| Vengativo | Va a por quien le atacó |

También escribe: cada turno publica en el chat qué va a hacer y por qué, con datos reales
del tablero («me falta Gran Bretaña para cerrar Europa», «la mejor tirada está al 36 %»).

### 4.2 Modelo de lenguaje (opcional)

En la pestaña **IA** de la mesa se puede conectar un modelo con capa gratuita:

| Proveedor | Dónde sacar la clave | Modelos sugeridos |
|---|---|---|
| OpenRouter | https://openrouter.ai/keys | DeepSeek V3 `:free`, Llama 3.3 70B `:free`, Gemma 3 27B `:free` |
| Groq | https://console.groq.com/keys | Llama 3.3 70B, Llama 3.1 8B |
| Google AI Studio | https://aistudio.google.com/app/apikey | Gemini 2.0 Flash |
| Compatible OpenAI | — | Ollama o LM Studio en local (`http://localhost:11434/v1`) |

**La clave se guarda solo en el `localStorage` de ese navegador.** No viaja al servidor
ni se comparte con el resto de la sala.

Qué hace el modelo y qué no:

- **Sí**: escribe el mensaje del turno y marca intención estratégica (a qué territorios
  apuntar, cuánto arriesgar).
- **No**: ejecutar jugadas directamente. Lo que propone se valida contra el mapa y el
  estado; lo que no es legal se descarta.

Las jugadas las decide siempre el cerebro local, *inclinado* por lo que pide el modelo. Si
el modelo falla, tarda o contesta cualquier cosa, la partida sigue igual con el cerebro
local. **Nunca se bloquea la mesa esperando a una API.**

### Qué modelos usar, y por qué esos

Elegidos midiendo contra la API de verdad con el prompt del juego, no por el
nombre. Latencia y calidad de una misma tanda:

| Modelo | Latencia | JSON válido | Español |
|---|---|---|---|
| **Nemotron 3 Ultra 550B** | 378 ms | sí | El mejor: prosa natural y con criterio |
| **Nemotron 3 Super 120B** | 362 ms | sí | Muy bueno, algo más plano |
| **Nemotron 3 Nano Omni 30B** | 363 ms | sí | El ligero que sí cumple |
| Dots3-Note Preview | 746 ms | sí | Correcto, se le cuela alguna palabra en inglés |
| MiniMax M2.7 | 1457 ms | sí | **Se le colaron caracteres chinos**: descartado |
| North Mini Code | 421 ms | no | Es un modelo de código, no sirve |
| GLM 5.2 / Gemma 4 / Laguna XS | — | — | Devolvieron 429: se saturan a menudo |
| LFM2.5-2.6B | — | — | 503, no disponible |

De ahí salen tres decisiones:

**El razonamiento se excluye.** Los Nemotron, MiniMax y GLM piensan en voz alta
antes de contestar, y ese monólogo se comía los 320 tokens de presupuesto: la
respuesta llegaba cortada sin el JSON y la partida caía al cerebro local **sin
decir por qué**. Mandando `reasoning: { exclude: true }` contestan en menos de
400 ms con el JSON limpio. Era un fallo real, no una optimización.

**Hay cadena de reserva.** Los gratuitos se saturan: en la misma tanda en que los
Nemotron respondían, cuatro de la lista devolvían 429 o 503. Si el modelo
elegido está saturado se baja al siguiente, y solo si fallan todos entra el
cerebro local.

**Los mejores para cada cosa:** Nemotron 3 Ultra para el plan de turno y la
crónica (es donde se nota la prosa), Super como primera reserva, Nano Omni como
segunda.

### Solo modelos gratuitos

El identificador del modelo se escribe a mano, así que sin una barrera un dedo
torcido factura. `freeOnly` viene encendido de fábrica y la petición **ni se
envía** si el modelo no es gratuito: vale si está en la lista del proveedor, si
lleva el sufijo `:free` que OpenRouter le pone a los suyos, o si corre en tu
propia máquina (Ollama, LM Studio), donde no hay factura que valga. Quien quiera
pagar puede, pero tiene que apagarlo a propósito.

### La clave de la casa

Se puede desplegar con una clave propia para que la IA funcione sin que cada
jugador ponga la suya: se pone en `public/ai-key.json` (hay plantilla en
`ai-key.example.json`).

**Léelo antes de usarlo.** Esto es una web estática: cualquier clave que viaje
con ella **es pública** y se lee abriendo las herramientas del navegador. Este
mecanismo no la esconde; lo único que hace es mantenerla **fuera del
repositorio**, que es lo que de verdad importa, porque el historial de git es
para siempre y se puede buscar. Por eso el fichero está en `.gitignore`.

De ahí que convenga que sea una clave de **capa gratuita y con límite de gasto**:
lo peor que puede pasar entonces es que alguien agote el cupo de peticiones, no
que llegue una factura. La clave del jugador siempre gana sobre la de la casa.

Si algún día hace falta de verdad que la clave no sea pública, el camino es un
proxy mínimo (un Worker de Cloudflare, gratis) que la guarde del lado del
servidor y limite por IP.

### Narrar la crónica en voz alta

En los escenarios se puede encender un narrador que lee la crónica. La voz la
genera un modelo, no el sintetizador del navegador.

El endpoint de voz de OpenRouter (`/api/v1/audio/speech`) no aparece en el
catálogo de `/models`, así que hubo que encontrarlo probando. De los que
responden:

- `flux-tts:free` funciona y devuelve WAV, pero **todas sus voces terminan en
  `-en`**: son inglesas, y leerían "Cáceres" o "Guadiana" con acento inglés.
- `kokoro-82m` **sí tiene voces en español** (`em_alex`, `em_santa`, `ef_dora`),
  devuelve WAV de 24 kHz y no consume saldo: tras generar varias pruebas, el
  gasto de la cuenta seguía en cero.

Por eso el narrador usa Kokoro. Y **solo narra la última crónica**: si se
encolaran, la voz acabaría minutos por detrás del tablero contando una batalla
que ya terminó.

### 4.3 El estratega

Además de los bots, hay un consejero para el jugador humano: en cada fase de tu turno te
deja un mensaje en el chat con qué harías tú («yo pondría el grueso en Afganistán: frontera
amenazada y está solo»). También se puede pedir a mano. Sus consejos son **privados**: no
salen del navegador ni los ve el resto de la mesa.

---

## 5. Los mapas

| Mapa | Territorios | Regiones | Dibujo | Ritmo |
|---|---|---|---|---|
| Todo el mundo | 42 | 6 continentes | **cartografía real** | La partida larga de siempre |
| España por provincias | 52 | 18 comunidades | **cartografía real** | Muy territorial, la más larga |
| España por comunidades | 19 | 5 macrozonas | **cartografía real** | Partida rápida |
| España 1936 | 52 | 9 frentes | **escenario histórico** | Dos bandos, posición inicial real |

### De cartografía real a tablero

Ningún mapa se dibuja a mano: los tres se generan de cartografía real con
`npm run build:maps` (`tools/build-spain-map.ts` para los de España, límites
administrativos del IGN; `tools/build-world-map.ts` para el mundo, Natural
Earth). El proceso es una herramienta de desarrollo; en tiempo de ejecución el
juego solo carga datos ya masticados (un `path` SVG y un punto de etiqueta por
territorio, 145 kB entre los tres y en un *chunk* aparte).

```
GeoJSON de provincias
   │
   ├─ tirar islotes ........... A Coruña trae 1069 anillos; casi todos son rocas
   │                            de un par de metros que en un tablero no se ven
   ├─ Canarias al recuadro .... si se dibujan donde están, la península se queda
   │                            en un tercio de la pantalla
   ├─ proyectar y encajar ..... equirrectangular con paralelo 40°, a un lienzo
   │                            de 1000 unidades de ancho
   ├─ topología compartida .... las fronteras se extraen UNA vez como "arcos"
   │                            (30 231 vértices de origen → 4183)
   ├─ simplificar ............. cada arco una sola vez, así que las provincias
   │                            vecinas siguen encajando sin rendijas
   ├─ fronteras por contacto .. dos provincias son vecinas si sus siluetas se
   │                            tocan (umbral 0,75 ud. ≈ 750 m)
   └─ punto de etiqueta ....... polo de inaccesibilidad, no centroide
```

Tres decisiones que merecen explicación:

**Por qué topología compartida y no simplificar provincia a provincia.** Si cada
provincia se simplifica por su cuenta, la frontera común entre dos vecinas se
simplifica dos veces y de formas distintas, y aparecen rendijas y solapes. Al
extraer las fronteras como arcos y simplificar cada arco una única vez, las dos
provincias que lo comparten siguen encajando por construcción.

**Por qué las fronteras se miden por contacto y no por aristas compartidas.** La
cartografía real está llena de uniones en T: Ávila y Valladolid se tocan de
verdad, pero una tiene un vértice en mitad de la arista de la otra, así que no
comparten ninguna arista. Medido sobre los datos: las fronteras reales están a
distancia 0 y las provincias que solo se acercan están a más de 20 unidades. El
umbral no es delicado.

**Por qué polo de inaccesibilidad y no centroide.** El centroide vale para formas
convexas, pero en una silueta real se sale fuera con facilidad (Galicia con las
rías, la bahía de Cádiz) y la etiqueta acaba flotando en el mar.

El resultado se contrasta contra las fronteras conocidas: las 109 que salen de la
cartografía son todas reales, y de hecho corrigen dos que el esquema anterior se
había inventado (A Coruña con Asturias, Girona con Tarragona).

### El mundo: territorios que no son países

El mapa del mundo pasa por el mismo molino, pero con un paso más al principio:
los territorios del RISK no son países. «EE. UU. Occidental» son diecisiete
estados, «Siam» son cinco países y «Ucrania» se come media Rusia. La tabla que
une el atlas con el tablero está en `tools/world-territories.ts`, y los trozos se
**funden** sobre la topología compartida igual que las provincias en sus
comunidades: sin operaciones booleanas de polígonos, descartando los arcos
interiores del grupo.

Dos diferencias más con España:

**Las adyacencias no salen de la geografía.** Son las canónicas del tablero de
siempre, escritas a mano en `world.adjacency.ts`: el RISK une Alaska con
Kamchatka y separa cosas que en el atlas se tocan. Aquí manda el juego. Lo que sí
se calcula por contacto es **cuáles de esas conexiones hay que dibujar como línea
de puntos**, que son exactamente las que sobre el mapa no llegan a tocarse.

**Qué se deja fuera y por qué.** Kaliningrado (un exclave a 800 km de su
territorio, sería una mancha suelta) y Hawái (no está en el tablero clásico). En
cambio Crimea **sí** se dibuja: en este tablero Ucrania y la Rusia europea son el
mismo territorio, así que incluirla es solo cerrar la costa del mar Negro —
dejarla fuera abría un boquete.

El mapa por comunidades no es un dibujo aparte: se obtiene **fundiendo** las
provincias de cada comunidad sobre la misma topología (los arcos interiores del
grupo aparecen dos veces y se descartan), así que las costas coinciden
exactamente entre los dos mapas. Un test lo comprueba: el punto de etiqueta de
cada una de las 52 provincias tiene que caer dentro de la silueta de su
comunidad.

### Añadir un mapa

Un mapa es un archivo en `engine/maps/` registrado en `map-registry.ts`. Los
tests de integridad se aplican solos a todos los mapas del registro.

Cada territorio da su dibujo en **`shape`** (un `path` SVG en coordenadas de
tablero) y **`labelAnchor`** (dónde va el nombre), y el mapa declara en `board`
el tamaño del lienzo. No hay otro formato: el renderizador
(`engine/board-render.ts`) solo sabe de paths, y de ahí salen también el aura de
los continentes y el resaltado de selección.

Las adyacencias que no son fronteras de tierra se declaran en `seaRoutes` y se
dibujan como líneas de puntos.

## 6. Modo avanzado: la orografía

Un interruptor en la sala. Apagado, la partida es el RISK clásico y el mapa no
cambia ni un dado. Encendido, **el terreno decide cómo se pelea cada
territorio**.

Y no es un impuesto que pague solo el atacante: **cada terreno tiene dos
mitades**, lo que da al que defiende en él y lo que da al que ataca desde él.

| Terreno | Defendiendo aquí | Atacando desde aquí |
|---|---|---|
| Llanura `≡` | Nada | Nada |
| Bosque `♣` | +1 al **segundo** dado (emboscada en los flancos) | +1 al **mejor** dado (sales sin que te vean) |
| Montaña `▲` | +1 al **mejor** dado (domina la altura) | +1 al **segundo** (bajas con impulso, pero en columna) |
| Desierto `∴` | −1 al **segundo** dado (flanco al descubierto) | −1 al **segundo** (la aproximación se ve venir) |
| Costa `≈` | Contra un desembarco, +1 al mejor dado | Nada por tierra |

**Lo que decide un combate es la pareja.** Salir de un bosque contra una montaña
cancela la altura del defensor —los dos empujan el mejor dado, uno por lado— y el
resultado es exactamente el combate clásico. Asaltar una montaña desde el llano
es lo más caro que hay. El mismo objetivo se paga distinto según de dónde salgas,
y el mismo origen rinde distinto según a dónde ataques.

Quien cruza el mar o llega volando no hereda nada del suelo del que salió: deja
el terreno atrás.

Y una regla que no depende del terreno: **atacar cruzando el mar es un
desembarco**, y desembarcando solo se tiran 2 dados.

Qué se paga por atacar 10 contra 5, medido contra una simulación independiente
de 300 000 batallas por caso:

```
desierto          0,958   ← el sitio más barato de conquistar
llanura           0,872
bosque            0,719
montaña           0,699
desembarco        0,635
desembarco en costa 0,394 ← una playa defendida es lo más caro del juego
```

Tres decisiones de diseño que conviene entender:

**El saldo se acota a un paso de dado en cada dirección.** Es la lección más cara
de este diseño, y se ha aprendido dos veces. Primero: sumar la bonificación a
*todos* los dados del defensor dejaba la montaña en 0,08 a 8 contra 8 (un muro) y
el desierto en 0,90 (regalado); moviendo un solo dado la escala se quedaba entre
0,20 y 0,66. Después, al añadir la mitad del atacante y las tropas de los dos
lados y dejar que todo se acumulara, volvió a irse de 0,080 a 0,900.

El primer arreglo —quedarse solo con el dado decisivo— acotaba bien pero aplastaba
la matriz: atacar un bosque desde un bosque salía igual que atacar un desierto
desde un bosque. Así que se acota por separado: **como mucho un paso a favor del
atacante y como mucho uno a favor del defensor.** Un combate puede estar
desequilibrado en los dos dados a la vez, uno para cada lado —que es justo lo que
pasa en un bosque contra otro bosque—, pero nadie acumula dos pasos a su favor.

La matriz completa, a 8 contra 8 (el clásico es 0,446):

```
desde \ hacia   llanura  bosque  montaña  desierto  costa
llanura           0,446   0,235    0,199     0,655   0,446
bosque            0,763   0,550    0,446     0,763   0,763
montaña           0,655   0,446    0,360     0,655   0,655
desierto          0,235   0,235    0,199     0,446   0,235
costa             0,446   0,235    0,199     0,655   0,446
```

**Qué dado se mueve importa.** La montaña toca el mejor dado y el bosque el
segundo. La consecuencia se nota jugando: contra un defensor de un solo ejército,
que tira un único dado, el bosque y el desierto no cambian nada. Un bosque vacío
no embosca a nadie; una montaña vacía sigue siendo una montaña.

**El terreno no puede depender de un accidente del dibujo.** Las conexiones que
se pintan de puntos son las que sobre el mapa no llegan a tocarse, y en el mundo
tres de ellas (China–Urales, Kamchatka–Mongolia, América Central–EE. UU.
Oriental) son fronteras de tierra del tablero clásico que nuestras siluetas no
alcanzan a juntar. Están declaradas como `landBridges` y se cruzan a pie: sería
absurdo que atacar de China a los Urales fuese un desembarco porque a Kazajistán
le tocó otro territorio.

### Un solo sitio por donde entra

Toda la orografía pasa por `battleRulesFor(map, config, from, to)`, que devuelve
los topes de dados y la bonificación de **ese** ataque. Ese mismo valor lo usan:

- el combate real (`applyAttack`),
- el porcentaje que ve el jugador antes de atacar,
- y la IA para decidir a quién ataca.

No es un detalle de estilo. Si el combate usara unas reglas y la pantalla otras,
el número mentiría; si la IA usara otras, atacaría montañas creyéndolas llanuras.

Sigue siendo puro y determinista: las reglas salen del mapa y de la configuración
**congelada al empezar la partida**, así que una grabación antigua se reproduce
con el modo con el que se jugó, no con el que esté marcado hoy en la sala.

### El coste medido en las partidas de bots

Encender la orografía hace las partidas más largas (ronda media de 43 a 55 en 180
partidas de bots) porque hay posiciones que cuesta romper. Ese efecto tenía un
riesgo real de atasco: en montaña un 8 contra 8 da 0,198, y el suelo del umbral
de ataque de la IA estaba en 0,20, así que los bots literalmente nunca atacaban
allí y se dedicaban a acumular. Se ve en `bot-brain.ts`, en el alivio anti-atasco.

## 7. Modo avanzado: las tropas

Otro interruptor, independiente del de la orografía. Se pueden encender los dos,
uno, o ninguno.

Con los refuerzos, en vez de colocar ejércitos nuevos, puedes **ascender una
ficha que ya esté en el tablero**:

| Tropa | Coste | Atacando | Defendiendo |
|---|---|---|---|
| Caballería `⇉` | 2 | Reagrupas dos veces por turno; en campo abierto contra campo abierto, +1 al segundo dado | — |
| Blindados `■` | 3 | +1 al mejor dado, **solo contra terreno abierto**: en montaña o bosque no maniobran | +1 al segundo dado, también solo en abierto |
| Flota `⚓` | 3 | Cruzar el mar desde ahí deja de ser un desembarco | +1 al mejor dado contra quien desembarque |
| Aviación `✈` | 4 | Alcanza a dos pasos; +1 al mejor dado **sobre terreno despejado** | Intercepta: +1 al segundo dado contra otro ataque aéreo |

**Tropa y terreno se combinan, no se suman por su cuenta.** Un blindado en una
llanura es otra cosa que el mismo blindado metido en un bosque, y eso vale igual
atacando que defendiendo. Es la misma idea que la pareja de terrenos, un piso más
arriba: lo que importa es *qué tropa, desde qué terreno, contra qué tropa en qué
terreno*.

Con la orografía apagada el mapa no cambia nada, tampoco para las tropas: todo
cuenta como llanura y un blindado maniobra en cualquier sitio.

Dos decisiones marcan todo el diseño:

**Un especialista no es una ficha extra, es una ficha ascendida.** `units` es un
desglose de `armies`, nunca un ejército aparte: la infantería es `armies` menos
la suma de `units`. Así ninguna regla que cuente ejércitos —refuerzos por
territorios, bonificación de continente, eliminación, victoria, cartas— tiene que
enterarse de que existen las tropas, y una partida clásica no lleva ni un byte de
más porque `units` ni aparece.

**Un especialista no se mueve.** Se prepara donde hace falta y se queda; si cae
el territorio, cae con él. La alternativa —arrastrarlos al reagrupar o al
ocupar— obligaría a decidir cuáles viajan en cada movimiento, y eso ni cabe en la
interfaz ni aporta nada. A cambio, construir en la retaguardia no sirve de nada,
que es exactamente la tensión que se busca.

De ahí salen dos reglas más, pequeñas pero necesarias:

- **Las bajas se las come primero la infantería.** Los especialistas caen cuando
  ya no queda nadie, y en un orden fijo y documentado (`CASUALTY_ORDER`). Si
  dependiera del azar o del orden de recorrido de un objeto, dos clientes
  reconstruirían estados distintos del mismo log.
- **Nunca puede haber más especialistas que fichas.** Cualquier cosa que baje el
  número de ejércitos (bajas, ocupación, reagrupación) recorta el desglose. Hay
  un test que comprueba el invariante en cada acción de una partida entera.

### Cómo se cruzan con la orografía

Cada palanca vive en su capa y se componen sin pisarse:

- La **flota** solo tiene sentido si existen los desembarcos, o sea con la
  orografía encendida: lo que hace es quitar la penalización.
- Los **blindados** empujan igual que la montaña frena: un dado, y solo el mejor.
  No vuelan, así que en un ataque aéreo no cuentan.
- La **aviación** funciona con la orografía apagada, porque el alcance es de la
  tropa y no del terreno. Un ataque aéreo se queda en 2 dados: alcanza lejos,
  pero no lleva masa detrás.

### El coste medido en las partidas de bots

180 partidas de bots por configuración, sobre los tres mapas y con 3, 4 y 5
jugadores:

```
                    sin terminar   ronda media   tropas en juego (máx)
clásico                    0/180          40,3                       0
orografía                  1/180          45,0                       0
tropas                     1/180          41,9                      61
orografía + tropas         3/180          45,6                      90
```

Las tropas no alargan las partidas de forma apreciable y los bots las usan de
verdad. La IA construye poco y con criterio: solo si le sobra reserva por encima
de lo que necesita para tapar agujeros, y solo donde la tropa hace algo (un
blindado en un frente sin fronteras de tierra vale cero, y lo sabe).

## 8. Modo histórico: España 1936

El primer escenario. La cartografía es exactamente la del mapa provincial —los
mismos contornos, las mismas fronteras—, pero cambian tres cosas:

- **No se reparte al azar.** El tablero arranca con el reparto real de provincias
  de julio del 36: el golpe triunfó en unas treinta y fracasó en veinte, con la
  República conservando la mitad oriental, la cornisa cantábrica, Madrid, La
  Mancha, Badajoz y Andalucía oriental. Madrid, Barcelona, Sevilla, Zaragoza,
  Burgos y Navarra empiezan mejor guarnecidas que una provincia cualquiera.
- **Se juega por bandos.** Dos facciones por lado, que no pueden atacarse entre
  sí y ganan juntas. Con dos jugadores es uno contra uno y cada uno lleva las dos
  facciones de su bando; con cuatro, dos contra dos. Los huecos los rellena la IA.
- **Los continentes son los frentes**, no las comunidades: Frente del Norte, de
  Aragón, del Centro, del Sur, Levante, Extremadura y La Mancha, Galicia, el
  Protectorado y Canarias.

### Las facciones

| Bando | Facción | Quiénes son |
|---|---|---|
| República | Ejército Popular | El Estado rehaciendo un ejército sobre la marcha, con la industria y la mayoría de la población detrás |
| República | Columnas confederadas | Las milicias de la CNT-FAI que salieron de Barcelona hacia Aragón |
| Sublevados | Ejército de África | Regulares y Legión: la tropa profesional, si consigue cruzar el Estrecho |
| Sublevados | Ejército del Norte | Mola, los requetés navarros y las guarniciones de Castilla y León |

El Ejército de África empieza en Ceuta, Melilla, Canarias y la cabeza de puente
andaluza, así que tiene exactamente el problema que tuvo: pasar el Estrecho.

### La crónica de guerra

Cada vez que se ataca una pareja de provincias nueva, la sala publica una línea
de crónica. Y no es decorado: **depende de quién ataca y de qué pareja**.

Los episodios reales llevan marcado qué bando los protagonizó. Si en la partida
ataca ese mismo bando, se cuenta como ocurrió; si ataca el otro, se cuenta como
lo que es, una historia que se tuerce, y dice qué se está evitando. Cruzar de
Ceuta a Cádiz saca el puente aéreo de los Junkers; subir de Cáceres a Badajoz
saca la marcha que unió las dos zonas sublevadas; entrar en Teruel desde Cuenca
saca los veinte grados bajo cero del 37. Si lo intenta el bando contrario, la
misma casilla cuenta lo que habría cambiado.

Cuando la pareja no tiene episodio propio, la crónica habla del terreno: monte
arriba, entre pinos, o a campo descubierto.

Es una **función pura** de (estado, acción, semilla), así que todos los clientes
que reproduzcan el log leen la misma crónica, y la escribe solo el anfitrión para
que no salga repetida.

### Sobre la simplificación, dicho claro

Un territorio de RISK tiene un solo dueño y julio del 36 no era tan limpio: en
Oviedo y en Granada las capitales quedaron en manos sublevadas dentro de
provincias que no lo estaban, el Alcázar de Toledo aguantó dos meses en zona
republicana, Menorca siguió fiel a la República mientras Mallorca no, y media
provincia de Huesca la recuperaron las columnas salidas de Barcelona. Cada
provincia se asigna a quien controlaba la mayor parte de ella, y las excepciones
se cuentan en la crónica cuando la partida pasa por ahí.

Se habla de campañas, frentes y unidades: de lo militar. Los episodios de
represión contra la población civil, que los hubo por los dos lados y son lo más
serio de aquella guerra, no se convierten aquí en material de juego.

## 9. Reparto inicial y deshacer refuerzos

**El reparto es al azar y compensado.** Los territorios se barajan y se reparten
en rueda, así que a cada uno le tocan los mismos o uno menos. Cuando no salen
exactos —42 entre 4 son 11, 11, 10 y 10— pasan dos cosas:

- **Quién se lleva el de más se sortea.** Antes lo cogían siempre los primeros
  del orden de turno.
- **Menos tierras, más tropas.** Cada territorio de menos vale un ejército de
  más, que es lo que cuesta ocupar uno. Antes todos recibían lo mismo y quien
  tenía una provincia menos salía perdiendo dos veces: menos tablero **y** menos
  refuerzos cada turno.

**Se puede deshacer lo colocado**, con el botón de deshacer el último o el de
empezar de cero. Es una acción del motor, no un truco de la interfaz: el log
**es** la partida, así que deshacer queda registrado como todo lo demás y todos
los clientes llegan al mismo estado. Solo vale durante tus refuerzos: en cuanto
pasas a atacar, lo colocado está colocado.

## 10. Victoria por objetivos

Un desplegable en la sala: **conquista total** (lo clásico) o **por objetivos**.
Con objetivos, cada jugador recibe una meta al empezar y gana quien la cumpla,
sin tener que barrer el mapa. Hay tres clases:

- **Continentes**: tener enteros dos continentes que se toquen.
- **Territorios**: llegar a un número, a veces con guarnición mínima de dos.
- **Eliminar**: sacar a alguien concreto de la partida. Si se te adelantan, tu
  objetivo pasa solo al de reserva (número de territorios), que es la regla
  clásica.

**Los objetivos son públicos, y es a propósito.** Sin backend no hay forma de
guardar un secreto: todos los clientes reproducen el mismo log y calculan el
mismo estado, así que cualquiera podría leer el objetivo ajeno abriendo la
consola del navegador. Antes que fingir un secreto que no existe, se enseñan
todos en un panel. Además se juega mejor: saber a qué va cada uno permite cortar
al que está a punto de ganar.

El reparto usa un **RNG sembrado aparte** (`rngFor(seed, 0, 'missions')`). Si
comiera tiradas del mismo flujo que el reparto del tablero, encender los
objetivos cambiaría la posición inicial y dos mesas con la misma semilla dejarían
de empezar igual. Hay un test que lo comprueba.

## 11. Tests

```bash
npm test                                    # todo
npx ng test --watch=false --include "src/app/games/**/*.spec.ts"
```

Qué se cubre:

- **Motor** (~180 tests): cada regla y cada error posible; combate, cartas, canjes,
  eliminación, victoria, reparto manual, inmutabilidad, determinismo.
- **Combate**: distribuciones exactas de dados contrastadas contra una simulación
  independiente de 200 000 batallas.
- **Geometría**: simplificación, topología compartida, fusión de territorios,
  fronteras por contacto y polo de inaccesibilidad, sobre figuras controladas y
  sin depender de datos reales.
- **Mapas**: integridad de los tres mapas (contigüidad, simetría, conexidad,
  continentes, fronteras falsas, paths válidos) y coherencia entre el mapa
  provincial y el de comunidades.
- **IA**: legalidad de todas sus decisiones y **partidas completas de bots de principio a
  fin** en los tres mapas (garantiza que la IA no se atasca nunca).
- **Sincronización**: reconstrucción del estado desde el log, snapshots, elección de
  anfitrión, descarte determinista de acciones ilegales.
- **Interfaz**: tablero, portada, lobby y mesa, incluyendo una partida jugada de verdad
  contra bots desde el componente.
