# RISK: una sola pantalla, el mapa manda

Fecha: 2026-08-26

## Por qué

La mesa de hoy son tres columnas: jugadores a la izquierda, mapa en medio, y un
panel a la derecha con pestañas de chat, eventos, cartas e IA. Debajo del mapa,
una barra de acción. En pantallas de menos de 1024px todo eso se apila y la
página entera se convierte en un scroll: el mapa queda a 320px de alto, la barra
de acción a medio kilómetro del territorio que estás mirando, y el chat aún más
lejos. En un móvil no se juega, se sufre.

Además, colocar refuerzos exige tres gestos: seleccionar el territorio, mover un
deslizador y pulsar «Colocar». En un juego cuya acción natural es *señalar un
sitio del mapa*, eso sobra.

Y hay una pieza que sencillamente no existe: los bots publican su plan cada
turno, pero no puedes hablarles. Contestan al vacío.

## Qué se construye

Una sola pantalla, la misma en ordenador y en móvil, con el mapa ocupando el
fondo entero y todo lo demás flotando encima. Se toca el mapa para jugar. Se
puede escribir a un bot, contesta, y lo que le digas puede inclinar cómo juega
esa ronda.

## Qué NO se construye

- No se toca el motor. Sigue siendo puro y determinista.
- No se cambia el reparto, el combate ni el equilibrio: eso se acaba de tocar y
  está medido.
- No se hace un segundo diseño para móvil. Es uno solo.
- No se añade un modo espectador, ni sonido, ni animaciones de dados.

---

## 1. Arquitectura de la pantalla

`risk-room` ya es demasiado grande para lo que hace: 656 líneas de plantilla,
879 de componente y 1405 de estilos. Meterle la pantalla nueva encima lo
convierte en algo que no se puede leer ni probar. Se parte en piezas con una
responsabilidad cada una:

| Componente | Qué hace | De qué depende |
|---|---|---|
| `risk-room` | Director: estado, acciones, servicio. Sin maquetación. | Servicio de mesa |
| `risk-hud` | Barra superior: ronda, fase, turno, salir | Entradas planas |
| `risk-action-bar` | Barra inferior: controles de la fase y botones de panel | Entradas planas + salidas |
| `risk-panel` | Concha de panel flotante: título, cerrar, fondo | Sólo contenido proyectado |
| `risk-scoreboard` | Marcador compacto, siempre visible | Entradas planas |
| `risk-chat` | Conversación y caja de escritura | Entradas planas + salidas |
| `risk-cards` | Cartas y canje | Entradas planas + salidas |

Todos los nuevos son de presentación: reciben datos por `@Input` y avisan por
`@Output`. Ninguno habla con Firebase ni con la IA. Se pueden probar montándolos
solos, que es justo lo que hoy no se puede hacer con `risk-room`.

`risk-board` cambia por dentro (gestos), no por fuera: mantiene su interfaz.

### Colocación

- El mapa es el fondo, a pantalla completa, siempre.
- `risk-hud` arriba, `risk-action-bar` abajo, ambos flotando sobre el mapa.
- **El marcador no es un panel**: es un recuadro compacto y permanente arriba a
  la izquierda, con una línea por jugador (color, nombre, territorios). Se puede
  plegar a sólo colores si estorba. Está siempre porque saber quién va ganando es
  información de un vistazo, no algo que uno vaya a abrir y cerrar.
- **Paneles** (chat, cartas, historia): en ordenador (≥1100px) se acoplan como
  columna flotante a la derecha, con el mapa entero detrás. Por debajo de 1100px
  suben desde abajo como hoja, con fondo oscurecido, y se cierran deslizando o
  tocando fuera.
- Un solo panel abierto a la vez, en móvil y en ordenador: dos columnas
  flotantes taparían el mapa, que es lo que se quería evitar. El marcador no
  cuenta como panel y convive con el que esté abierto.

---

## 2. Cómo se toca el mapa

### Distinguir toque de arrastre

El mapa ya tiene desplazamiento y zoom con dedo. Sin separar los dos gestos, en
móvil mover el mapa colocaría tropas sin querer.

Un contacto es **toque** si al levantar se ha movido menos de 8px y ha durado
menos de 500ms. Si se pasa de distancia, es arrastre. Si se pasa de tiempo sin
moverse, es pulsación larga.

### Por fase

- **Refuerzos**: toque en territorio propio pone un ejército. Mantener pulsado
  repite: primera repetición a los 400ms, luego cada 150ms, acelerando hasta
  60ms. Se para al levantar o al quedarse sin reserva.
- **Ataque**: primer toque elige origen (propio, con 2+ ejércitos), segundo
  elige objetivo. Aparece una hoja pequeña anclada junto al objetivo con los
  dados y el porcentaje. Tocar fuera limpia la selección.
- **Reagrupar**: igual que ataque, con hoja de cuántos ejércitos mueves.
- **Pulsación larga** en cualquier fase: ficha informativa (dueño, ejércitos,
  terreno, tropas) sin seleccionar nada.

### Agrupar los toques

Cada toque NO manda una acción. Se acumulan en el componente y se vuelcan en una
sola acción `deploy` cuando pasan 350ms sin más toques, o cuando cambia el
territorio seleccionado, o cambia la fase, o el jugador toca cualquier otro
control.

Motivo: doce toques serían doce escrituras en Firebase y doce entradas de
registro. Online se vería a trompicones y el historial quedaría ilegible. Con el
volcado, doce toques son una acción de doce, que es exactamente lo que hoy manda
el deslizador.

El contador de reserva de la barra baja **en el momento del toque**, no al
volcar: la respuesta tiene que ser inmediata aunque la escritura tarde.

`↶ Deshacer` y `↺ Empezar de cero` siguen existiendo y funcionan igual (ya hay
acción `undo-deploy` en el motor). Antes de deshacer se vuelca lo pendiente,
para que el motor y la pantalla no discrepen.

---

## 3. Hablar con los bots

### Escribir

La caja de chat gana un destinatario: *Todos* o un bot concreto. Escribir
`@Nombre` al principio del mensaje selecciona ese destinatario. El destinatario
viaja en la entrada de chat como campo nuevo `to?: string` (identificador de
asiento).

### Contestar

Sólo el **anfitrión** responde, porque es el único cliente con la IA cableada y
el único que mueve a los bots. Al ver en el chat un mensaje dirigido a un bot:

1. Monta el contexto: resumen del tablero, quién pregunta, y las últimas seis
   líneas de la conversación con ese bot.
2. Pide a la IA la respuesta **y una intención**, en una sola llamada:
   `ninguna` | `tregua` | `objetivo-comun` | `paso`.
3. Publica la respuesta como entrada de chat del bot, con la intención en un
   campo `pact?: { kind, with }`.

### Los pactos no se guardan

No hay estado nuevo en ningún sitio: un pacto se **deduce del propio chat**. Un
bot B tiene tregua con el jugador P si la última entrada de chat de B con
`pact.kind === 'tregua'` y `pact.with === P` es de la ronda en curso.

Dos cosas salen gratis de hacerlo así: sobrevive a que cambie el anfitrión a
mitad de partida, y el tope de **un pacto por bot y ronda** se comprueba contando
el chat, sin nada que sincronizar.

### Qué cambia en el juego

`StrategyBias` gana un campo `avoid?: PlayerId[]`. Con una tregua activa, el
cerebro del bot descarta como objetivos los territorios de ese jugador durante
esa ronda. `objetivo-comun` añade a `targets` los territorios del jugador que va
primero en el marcador (más territorios; a igualdad, más ejércitos), siempre que
no sea el propio bot. `paso` y `ninguna` no cambian nada: son sólo conversación.

### Determinismo

No se toca. Los bots los sigue moviendo el anfitrión, y sus jugadas llegan a
todos por el registro de acciones. El pacto sólo inclina **qué** jugada elige el
anfitrión; la elegida queda registrada como siempre. Rehacer la partida desde el
registro reproduce lo mismo. El motor no se entera de que existen los pactos.

### Cuando la IA falla

Los modelos gratuitos cortan por exceso. Reglas:

- El bot sólo contesta cuando le hablan.
- Una respuesta en vuelo a la vez; los mensajes que lleguen mientras tanto se
  contestan después, en orden.
- Enfriamiento de 5s por bot.
- Si la llamada falla, el bot contesta con una frase de repertorio y **sin
  pacto**. Nunca bloquea el turno ni la partida.

---

## 4. Errores y casos límite

| Situación | Qué pasa |
|---|---|
| Toque en territorio ajeno en refuerzos | No hace nada; ficha informativa |
| Mantener pulsado sin reserva | Se para solo al llegar a cero |
| Volcado rechazado por el motor | Se revierte el contador y se avisa en la barra |
| Se pierde la conexión al volcar | Se reintenta; el contador local no se pierde |
| Panel abierto y llega tu turno | El panel se cierra solo y la barra pide atención |
| Mensaje a un bot eliminado | No contesta; aviso de sala |
| Dos treguas en la misma ronda | La segunda se ignora; el bot lo dice en el chat |
| Cambia el anfitrión con respuesta en vuelo | Se pierde esa respuesta; el jugador puede repetir |

---

## 5. Pruebas

**Tablero:** toque contra arrastre en el umbral de 8px; pulsación larga a los
500ms; cadencia del mantener pulsado; que doce toques produzcan una acción de
doce y no doce acciones; que el volcado ocurra también al cambiar de fase.

**Paneles:** uno solo abierto en móvil; acoplado en ordenador; que el panel se
cierre al llegar tu turno.

**Chat:** que `@Nombre` fije el destinatario; que sólo el anfitrión conteste;
que el enfriamiento y la respuesta única en vuelo se respeten.

**Pactos:** que el tope de uno por bot y ronda se cumpla; que `avoid` llegue de
verdad a la decisión del bot y le quite objetivos; que un fallo de IA deje
respuesta sin pacto.

**Regresión:** los 1026 tests actuales siguen verdes.

---

## 6. Orden de entrega

Tres entregas, cada una jugable:

1. **Pantalla y toques.** Componentes nuevos, mapa a pantalla completa, paneles,
   toque para colocar, agrupado de toques. Es la que arregla el móvil.
2. **Conversación.** Destinatario en el chat y respuesta de los bots, sin
   pactos.
3. **Pactos.** Intención, tope por ronda y sesgo `avoid`.

---

## 7. Riesgos aceptados

**La tregua es explotable.** Aunque esté limitada a una por bot y ronda, pedirla
a todos cada ronda te hace difícil de atacar. El tope lo suaviza; no lo elimina.
Se acepta a sabiendas: si en la práctica resulta abusivo, el siguiente paso es
que el bot pida algo a cambio.

**Charlar cuesta.** Cada mensaje a un bot es una llamada de IA. En una partida
habladora se verán bots que tardan o que contestan con frase de repertorio. Es
el precio de usar sólo modelos gratuitos, que es un requisito.
