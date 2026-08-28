# Hundir la flota: el segundo juego del servidor árbitro

Fecha: 2026-08-28

## Por qué

La tarjeta lleva meses diciendo «en obras». El backend propio ya arbitra Scrum
Poker y RISK, y este juego es el que mejor justifica que exista: en Hundir la
flota, *toda* la partida consiste en no saber dónde están los barcos del otro.

Con Firebase eso era imposible de garantizar. El tablero del rival tenía que
estar en algún sitio, y cualquier sitio que el cliente pudiera leer era un sitio
donde el juego estaba resuelto antes de empezar. Con `view()` en el servidor, los
barcos que siguen a flote sencillamente no se envían.

## Qué se construye

Un `GameModule` nuevo —`flota`— con sus reglas, su vista por asiento y su bot,
la pieza de infraestructura que le falta al servidor para mover asientos que no
son personas, y la pantalla en Angular.

## Qué NO se construye

- No se toca el motor de RISK, ni el módulo de Scrum, ni la autenticación.
- No hay ranking, ni perfil, ni historial de partidas entre sesiones.
- No hay flotas configurables ni tableros de otro tamaño. 10×10 y la flota
  clásica; si algún día hace falta otra cosa, entrará por `config`.
- No hay chat. El narrador de RISK es suyo y aquí no pinta nada.

---

## 1. Las reglas

**Tablero** de 10×10. Las columnas se nombran de la A a la J y las filas del 1
al 10 en la pantalla, pero por dentro todo son índices `0..9`: la letra es
presentación, y mezclarla con la lógica es cómo se acaba con un error de una
casilla que solo aparece en la columna J.

**Flota**, cinco barcos por bando: 5, 4, 3, 3 y 2 casillas. Horizontales o
verticales, nunca en diagonal.

**Se pueden tocar entre sí.** Solo está prohibido solapar. Es la regla del juego
de mesa de toda la vida, y la alternativa —un hueco obligatorio alrededor de cada
barco— reduce tanto las colocaciones posibles que convierte al bot en adivino.

**Fases**: `colocacion` → `combate` → `fin`.

En `colocacion` cada asiento envía su flota entera en una sola acción. No se
colocan los barcos de uno en uno: una flota a medias no es un estado que el juego
necesite representar, y validarla de golpe permite responder «esto no vale» una
vez en lugar de cinco. Cuando los dos bandos han desplegado, la partida pasa a
`combate` sola.

En `combate` se dispara por turnos. **Acertar da otro disparo**; fallar cede el
turno. Disparar dos veces a la misma casilla es una jugada ilegal, no un turno
perdido: el tablero de disparos está a la vista de quien dispara, así que
repetirse solo puede ser un fallo del cliente.

La partida termina cuando toda una flota está hundida, o cuando alguien se rinde.

## 2. Lo que ve cada uno

Aquí está el juego entero, así que se escribe con precisión.

De **tu** lado: tus barcos, dónde están, cuáles siguen enteros y dónde te han
disparado.

Del lado del **rival**: solo las casillas donde tú has disparado, y qué pasó en
cada una. Nada más. Ni el número de barcos que le quedan en pie, ni los tamaños,
ni una silueta: si no lo has disparado, no existe para ti.

Cada casilla disparada es `agua`, `tocado` o `hundido`. Las tres se distinguen a
propósito: cuando cae la última casilla de un barco, **todas** sus casillas pasan
de `tocado` a `hundido`. Eso es lo que la pantalla pinta de otro color, y con eso
el tamaño del barco se lee solo mirando el tablero.

Lo que no se manda nunca es el nombre. Un «has hundido el destructor» es el
servidor contando algo que la rejilla ya dice, y contradiciéndola el día que dos
barcos tocados se confunden a la vista.

Al terminar, y solo entonces, la vista abre las dos flotas completas y añade la
puntería de cada bando: disparos, aciertos y porcentaje.

## 3. Los bots

Hoy el servidor no sabe mover a nadie que no esté al otro lado de un WebSocket.
`createSeat` escribe `isBot: false` sin preguntar, y no hay quien juegue por un
asiento vacío. Esto hace falta para la flota, y hace falta igual para los bots de
RISK y para el presentador del Trivial que viene después, así que se construye
genérico o no se construye.

Dos piezas, ninguna dentro del actor:

**`botAction(state, seat, seats)` en `GameModule`**, opcional. Devuelve la jugada
que ese asiento haría ahora, o `null` si no le toca. Es una función pura como las
otras tres: el bot de la flota se prueba sin servidor, sin red y sin reloj.

**Un conductor en `apps/server/src/rooms/`**: después de aplicar una jugada,
pregunta al módulo si algún asiento bot tiene algo que hacer, y si lo tiene, lo
somete como una acción más —por el mismo camino, con la misma validación—. Se
repite mientras haya jugadas de bot, con un tope de encadenadas para que un
módulo con un fallo no gire para siempre. Un bot que hace pleno en la flota
encadena disparos, y eso es correcto; un bot que encadena mil es un error.

Las jugadas del bot pasan por `validate` como las de cualquiera. Un bot no es un
asiento de confianza: es un asiento sin nadie detrás.

**Sentar bots** se decide al crear la sala. Tres niveles, y la diferencia entre
ellos es solo cuánta memoria tienen:

- `novato`: dispara a lo que no ha disparado. Nada más.
- `marino`: cuando toca, rastrea las cuatro casillas contiguas hasta hundir.
- `almirante`: lo de `marino`, y mientras caza dispara solo a casillas de una
  paridad. El barco más pequeño ocupa dos casillas, así que ninguno puede
  esconderse entre ellas: es la mitad de disparos para el mismo barrido.

El azar del bot sale de la semilla de la sala y del número de jugada, como en
RISK. Mismo estado, misma jugada: una partida se reconstruye desde su log con los
bots incluidos, que es la condición para que el snapshot del actor siga valiendo.

## 4. La pantalla

`apps/web/src/app/games/flota/`, con la estética de terminal del resto del sitio.

- **Lobby**: crear sala, elegir rival —persona por enlace, o bot con su nivel— y
  entrar.
- **Colocación**: colocar los cinco barcos, rotarlos, y un botón de flota
  aleatoria que resuelve el 90% de las veces que alguien quiere jugar ya. La
  flota se envía cuando está completa.
- **Combate**: los dos tableros. El tuyo con tus barcos y los impactos recibidos;
  el suyo con tus disparos, en tres colores. De quién es el turno, y cuántos
  disparos llevas.
- **Fin**: las dos flotas descubiertas y la puntería de cada uno.

La tarjeta de `games.ts` pasa a `listo` con su ruta.

---

## 5. Ficheros

```
packages/shared/src/games/flota/
  tipos.ts        el tablero, la flota, el estado y la vista
  reglas.ts       colocar, disparar, hundir, terminar
  bot.ts          los tres niveles
  index.ts        el GameModule
packages/shared/src/games/module.ts     + botAction opcional
packages/shared/src/contracts/rooms.ts  + 'flota' en GameId
apps/server/src/rooms/registry.ts       + el módulo
apps/server/src/rooms/bots.ts           el conductor
apps/server/src/rooms/service.ts        sentar bots al crear la sala
apps/web/src/app/games/flota/           lobby, colocación, combate
```

Cuatro ficheros de reglas en vez de uno: `reglas.ts` sin el bot ni los tipos se
queda en algo que se lee de una sentada, y el bot se prueba contra las reglas sin
arrastrar el módulo entero.

## 6. Tests

Vitest, y primero el que falla. Lo que tiene que estar cubierto:

- Colocación: fuera del tablero, solapada, flota incompleta, barco torcido, y la
  válida que se toca por un costado.
- Disparo: fuera de turno, repetido, en fase de colocación, el que hunde y el
  que acaba la partida.
- Turnos: acertar repite, fallar cede.
- Vista: **que los barcos a flote del rival no aparezcan en lo que sale hacia el
  otro asiento**. Es el test que justifica todo lo demás, y va con nombre propio.
- Bot: determinista con la misma semilla; `marino` remata un barco tocado;
  `almirante` no dispara fuera de su paridad mientras caza.
- Conductor: encadena los disparos acertados de un bot y para; no supera el tope.

## 7. Riesgos

**El tope de jugadas encadenadas es una red, no una regla.** Si un módulo pide
jugadas sin parar, el conductor corta y la sala sigue viva con el turno donde
estaba. Es preferible a un proceso girando, y se ve en los logs.

**Un bot no hace de anfitrión.** Si la persona se va de una sala con bot, la
partida se queda esperando, igual que hoy en RISK. Descargar salas inactivas ya
lo resuelve el actor y no se cambia aquí.
