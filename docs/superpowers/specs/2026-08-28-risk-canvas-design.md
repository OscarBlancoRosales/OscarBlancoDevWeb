# RISK: el mapa es la pantalla

Fecha: 2026-08-28

Sustituye a `2026-08-26-risk-pantalla-tactil-design.md` en todo lo que se
refiere a la disposición de la pantalla. Lo que aquel diseño acertó —el mapa a
pantalla completa, colocar tropas tocando, mantener pulsado para encadenar— se
conserva tal cual. Lo que cambia es dónde vive todo lo demás.

## Por qué

La pantalla actual resolvió el mapa y falló en el resto. Los paneles se abren
desde una barra de botones anclada abajo, y esa barra tiene dos problemas que no
son de gusto:

Cruza la pantalla de lado a lado, así que siempre está quitando sitio al mapa,
juegue quien juegue y toque lo que toque. Y convierte cada consulta en dos
gestos: abrir el panel y buscar dentro. En un juego de mesa, mirar cuántas
tropas tiene un rival no debería costar dos toques.

La respuesta fácil es dejar plegar los paneles. Pero si hace falta ofrecer
plegar es porque la interfaz estorba, y lo que hay que arreglar es que estorbe.

## La regla

**Ninguna acción tiene sitio propio. Cada acción vive pegada a lo que modifica.**

| Lo que cambia | Dónde vive el control |
|---|---|
| La fase del turno | En el indicador de fase |
| Las tropas de un territorio | Junto a ese territorio |
| Una conversación | En el avatar de esa persona |

De esta regla se deduce todo el diseño, y sobre todo se deduce lo que **no**
existe: no hay barra, no hay pestañas, no hay botonera, y no hay nada que
plegar porque no hay nada ocupando sitio de más.

El centro de la pantalla es el mapa y no lo cruza nada. Los elementos fijos
viven en las esquinas, que son los píxeles que menos valen: nadie mira una
esquina para decidir un ataque.

## Qué se construye

### 1. El tablero deja de tironear

Hoy el tablero llama a ocho funciones por territorio y por ciclo de detección de
cambios: `classesFor()` —que además construye un objeto nuevo cada vez, de modo
que `ngClass` vuelve a comparar siempre—, `ownerColorOf()`, `armiesOf()`,
`unitsOf()` (dos veces por tropa), `terrainGlyphOf()`, `terrainTintOf()`, y
`isSelectable()`/`isTarget()`, que recorren un array con `includes()` y hacen el
render cuadrático.

Y desplazar el mapa escribe `panX`/`panY` en cada `pointermove`, lo que dispara
todo eso entero en cada píxel que se mueve el dedo.

Tres cambios:

- **Una `TerritoryView[]` precalculada.** Se recalcula cuando cambia el estado,
  la selección o el resaltado; nunca desde la plantilla. La plantilla se ata a
  propiedades planas.
- **`Set` en lugar de `includes()`** para lo seleccionable y los objetivos.
- **Pan y zoom fuera de la detección de cambios.** Los gestos del mapa se
  enganchan con `addEventListener` en vez de en la plantilla, y escriben el
  atributo `transform` directamente sobre el grupo del SVG. Angular no se entera
  de que el mapa se está moviendo, porque no tiene por qué enterarse: no ha
  cambiado ningún dato. La escritura va en el momento, sin
  `requestAnimationFrame`: es un solo atributo, y el navegador ya entrega los
  `pointermove` a ritmo de fotograma.

### 2. Pulsar deja de mover el mapa

El toque ya tiene su margen de 8 píxeles, pero el arrastre no: empieza en el
`pointerdown`. El mapa se mueve bajo el dedo mientras intentas tocar. El
desplazamiento pasa a exigir el mismo umbral, así que pulsar es pulsar y
arrastrar es arrastrar.

### 3. Las cuatro esquinas

**Arriba a la izquierda — el bloque de fase.** `RONDA 3 · REFUERZOS · quedan 3`.
Tres líneas de texto sobre una veladura, sin marco. Es también el control que
termina la fase: cuando se puede terminar, el propio bloque se vuelve pulsable y
añade `✓ Terminar →`. Junto al ✓, un `↺` pequeño para deshacer todo lo colocado
en la fase — es una acción rara y no merece más sitio que ése.

**Arriba a la derecha — la lista de jugadores.** Avatar, nombre, territorios y
tropas, con la barra de fuerza. Es el marcador y es la lista de conversaciones,
porque son la misma cosa (ver punto 5).

**Abajo a la izquierda — el rastro.** Los últimos sucesos y los mensajes
recientes se posan y se apagan solos. Sin marco y sin fondo: es un rastro, no un
panel.

**Abajo a la derecha — las cartas.** Un abanico pequeño con la cuenta. Se abre al
tocarlo, sobre el mapa, y se cierra tocando fuera.

Objetivos, continentes, historial completo y ajustes de IA no tienen sitio
permanente: se piden desde el engranaje del bloque de fase y se abren sobre el
mapa. Una consulta de diez segundos no merece píxeles fijos.

### 4. Los controles nacen junto al territorio

Al tocar un territorio propio en refuerzos aparece un paso `− n +` anclado a él,
que muere al terminar. Ahí está el deshacer: es el `−`. No hace falta un botón
de deshacer en ninguna esquina.

Al apuntar un ataque, la tarjeta de combate —dados, terreno, probabilidad— se
ancla entre el territorio de origen y el de destino, que es exactamente donde
está mirando el jugador.

Lo que se repite treinta veces por turno está donde ya está el dedo. Lo que se
toca una vez por turno puede estar en una esquina.

### 5. El chat es la ficha del jugador

Un chat sin marco no se sostiene: una conversación necesita un contorno. Pero el
contorno no hay que inventarlo, porque ya existe: es la ficha de la persona con
la que hablas.

Tocar un avatar despliega debajo el hilo con ese jugador, anclado a él. El aviso
de mensaje sin leer va sobre su cara. Arriba de la lista, una entrada `🌐 Todos`
es el canal general. Se cierra tocando el avatar otra vez.

Esto sí es desplegable, y sí tiene sentido que lo sea: una conversación se abre,
se usa y se cierra. No es una ventana que haya que administrar.

`ChatEntry` gana un destinatario (`to`: id de jugador o `null` para el canal
general). Los mensajes privados sólo se muestran a sus dos extremos.

**Los bots contestan.** La capa de IA ya existe —`bot-brain.ts`,
`ai-orchestrator.ts` y `chatWithFallback()` en `packages/shared/src/engine/ai/`,
con `freeOnly` obligando a modelos gratuitos— y hoy hace que los bots comenten
sus planes. Contestar a un mensaje directo es una petición más por ese mismo
camino, con la personalidad del bot y el estado real de la partida como
contexto, y con el mismo tope por ronda que ya limita el gasto.

Todo el chat pasa por una interfaz de transporte. Hoy detrás está Firebase; la
fase 4 del backend propio pondrá el WebSocket sin que la pantalla se entere.

### 6. Avatares

Cada jugador elige el suyo al entrar en la sala; los bots traen el suyo por
perfil. Emoji de un juego cerrado, dibujado dentro de un anillo del color del
jugador. Sin imágenes, sin subidas y sin almacenamiento: funciona en cualquier
navegador y viaja en el asiento cuando el backend tome el relevo.

## Qué NO se construye

- No se toca el motor ni una regla del juego.
- No hay ventanas movibles, redimensionables ni apilables. Se descartó a
  propósito: obligan a administrar la interfaz en vez de jugar, y en un móvil
  tendrían que convertirse en otra cosa, con lo que serían dos interfaces.
- No se parte `risk-room` entero. Sale el chat, que hace falta igualmente; el
  resto de ese componente de 1016 líneas es un trabajo aparte con su propio
  riesgo.
- No se cambia de dónde vienen los datos. Eso es la fase 4 del backend propio.

## Lo que esto cuesta

No se podrá mover nada de sitio. Si una esquina tapa un territorio, se mueve el
mapa. Es la renuncia que hacen todos los juegos y a cambio no hay ninguna
interfaz que administrar.

## Cómo se comprueba

El rendimiento se mide, no se afirma. Antes y después, con el mapa más grande
que hay:

- Número de llamadas a las funciones del tablero durante un arrastre de 200
  eventos de puntero.
- Ciclos de detección de cambios durante ese mismo arrastre.

El objetivo del arrastre es **cero** ciclos de detección de cambios, porque
mover el mapa no cambia ningún dato.

El resto se comprueba con tests de componente sobre el DOM: que pulsar no
desplaza, que el bloque de fase termina la fase sólo cuando se puede, que un
mensaje privado no aparece en el canal general, y que el hilo de un bot se abre
desde su avatar.

## Entregas

| # | Qué | Terminada cuando |
|---|-----|------------------|
| 1 | Rendimiento del tablero y umbral de arrastre | El arrastre no provoca ciclos de detección de cambios y pulsar no mueve el mapa |
| 2 | Las cuatro esquinas y los controles contextuales | Desaparecen la barra de acción y los paneles con pestañas, y no se pierde ninguna función |
| 3 | Chat por avatar, canales y respuestas de los bots | Se puede hablar en general o con un bot concreto, y contesta |
