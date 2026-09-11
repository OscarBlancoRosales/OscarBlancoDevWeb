# El Impostor — cómo está hecho

Todos reciben la misma palabra. Todos menos uno. Se dice una pista por turno, se discute, y
al final se vota. Vive en `/juegos/impostor`, se sirve desde GitHub Pages y el árbitro es el
backend propio (`apps/server`).

---

## 1. Puesta en marcha

```bash
npm install
npm run dev -w @devweb/server   # la API en http://localhost:3000
npm start                       # la web en http://localhost:4200/juegos/impostor
npm test
```

Abrir una mesa pide cuenta —una sala sin dueño es una sala que nadie puede cerrar—. Entrar
por un enlace de invitación, no: se pone nombre, se elige cara y a jugar.

---

## 2. Cómo se juega una ronda

| Fase | Qué pasa |
|---|---|
| `sala` | La gente se sienta y dice que está lista. Con menos de tres no se reparte. |
| `repartiendo` | El servidor sortea palabra, impostores y orden de mesa. Dura un suspiro. |
| `pistas` | Una palabra cada uno, por turnos. El chat se apaga: si no te toca, esperas. |
| `debate` | El rato de hablar. Con reloj del servidor, o hasta que el anfitrión corte. |
| `votacion` | Todos votan a la vez. Nadie ve el recuento hasta que vota el último. |
| `ultima-palabra` | Solo en el modo revancha: al impostor pillado le queda un disparo. |
| `fin` | Se destapa todo, se reparte el punto y el anfitrión puede repartir otra. |

El **debate** no es relleno. Sin él la mesa vota cuatro palabras sueltas y el juego se queda
en un sorteo: es en la conversación donde se pilla a alguien, no en las pistas.

### Los tres modos

- **Clásico.** Al impostor no le dan palabra. Si le pillan, gana la mesa; si echan a un
  inocente, gana él. El empate también lo gana él: «no lo tenemos claro» es una respuesta,
  y la aprovecha.
- **La última palabra.** Igual, pero pillarle no basta: se le ofrecen seis palabras del tema
  —la buena, su parecida y cuatro más— y si acierta, gana él. Cambia cómo juega la mesa
  entera, porque las pistas buenas dejan de salir gratis.
- **Infiltrado.** Le dan **la palabra parecida** y no le dicen que es el impostor. Nadie
  miente a propósito y aun así uno de la mesa está hablando de otra cosa.

### Reglas de la casa

Vueltas de pistas (una o dos), segundos de debate (45, 90, 180 o sin reloj), impostores
(uno, o dos a partir de seis en la mesa) y bots para rellenar.

Con dos impostores basta con cazar a uno. Es una regla de la casa, escrita para que se pueda
discutir: obligar a cazar a los dos pediría varias votaciones seguidas, y eso son veinte
minutos más en un juego que dura diez.

---

## 3. Dónde vive cada cosa

```
packages/shared/src/games/impostor/
  tipos.ts    estado, acciones (TypeBox) y la vista que sale hacia cada asiento
  temas/      trece mazos de ≥100 palabras, cada una con su parecida y sus pistas
  caras.ts    el elenco de memes y el reparto de caras sin repetir
  reglas.ts   recuento, desenlaces y marcador. Funciones puras y sueltas
  guion.ts    lo que dice la sala en cada momento
  bot.ts      qué hace un asiento sin nadie detrás
  index.ts    el GameModule: createState, validate, apply, view, botAction

apps/server/src/games/impostor/
  sorteo.ts   el sorteo de la ronda, con el azar por parámetro
  voz.ts      la voz de la sala: reparte, habla y lleva el reloj del debate

apps/web/src/app/games/impostor/
  impostor-room.service.ts       la sala contra el backend propio
  impostor-lobby/                abrir mesa: se marcan mazos, no un tema suelto
  impostor-room/                 la mesa de interrogatorio: óvalo, evidencias, un solo chat
```

El juego encaja en la infraestructura de salas que ya existía: se escribió su `GameModule`
y se metió en `apps/server/src/rooms/registry.ts`. No hubo que tocar el WebSocket, ni la
persistencia, ni las rutas.

---

## 4. Lo único que de verdad importa: el secreto

Un juego de deducción en el que se pueda averiguar quién miente mirando el navegador no es
un juego. Aquí hay dos secretos, y los dos se guardan igual: **no se envían**.

**La palabra** sale solo hacia quien tiene derecho a saberla. `view` decide, asiento por
asiento, qué se manda: el impostor del clásico recibe `tuPalabra: null` porque el servidor no
se la manda, no porque la pantalla se la esconda. Abrir las herramientas de desarrollo enseña
exactamente lo mismo.

**Quién es el impostor** no sale hacia nadie hasta que la ronda acaba. Ni siquiera hacia el
propio impostor en el modo infiltrado, que es toda la gracia de ese modo.

Y hay una tercera pieza, menos evidente: **el sorteo no puede ser reproducible**. El módulo
del juego es puro, así que cualquier cosa que decidiera se podría volver a calcular desde el
navegador con los mismos datos de entrada. Si la palabra saliera de la configuración de la
sala —que se puede pedir por HTTP— la primera partida duraría lo que tarda alguien en abrir
la consola.

Por eso el sorteo vive en `apps/server/src/games/impostor/sorteo.ts` y entra en la partida
como una **acción del servidor** (`reparte`), de las que un cliente no puede mandar. Esa
acción se queda en el registro de eventos, que no se manda a nadie: al navegador solo llega
lo que `view` deja pasar. La semilla del azar de la ronda viaja por ahí también, y por eso no
se puede calcular a quién va a votar cada bot antes de que vote.

---

## 5. El reloj del debate

La hora la pone el servidor porque es la única que comparten los ocho navegadores de la mesa.
Lo que viaja es el instante en que se acaba (`debateHasta`), y cada pantalla cuenta hacia
atrás con el suyo. Quien decide que se ha acabado es el servidor: un temporizador en
`VozDeLaSala` mete la acción `aVotar` cuando toca.

Ese temporizador puede saltar cuando el anfitrión ya ha cortado el debate a mano. Cuando eso
pasa, `apply` devuelve **el mismo objeto de estado**, y la sala sabe que no hay nada que
escribir: una acción del servidor que no cambia nada no deja rastro en el registro.

---

## 6. Los bots

Son malos a propósito, y conviene decir por qué. Un bot tiene delante el estado entero: sabe
la palabra y sabe quién es el impostor. Usar eso para votar sería un bot que gana siempre y
una partida que no se juega.

Así que solo miran lo que también ve una persona —el tema y las pistas dichas— y lo demás lo
decide el azar de la ronda. Un bot con palabra dice una de las suyas sin repetir lo ya dicho;
uno sin palabra se inventa una de otra palabra del mismo tema, que es exactamente lo que hace
una persona cuando le toca hablar sin saber de qué va la mesa. Y el disparo final lo tira al
azar entre las que le ofrecen, porque acertar mirando el estado sería ganar haciendo trampa.

---

## 7. Qué está probado

- **El motor** (`packages/shared/src/games/impostor/impostor.spec.ts`): las tres fases, los
  tres modos, el empate, la revancha ganada y perdida, quien se va a mitad de ronda y los
  bots. Sin servidor y sin red.
- **Las reglas y el banco**: que ninguna pista diga su palabra, que no se repita ninguna
  palabra dentro de un tema, y que dos jugadores no acaben con la misma cara.
- **El sorteo** (`apps/server/src/games/impostor/sorteo.spec.ts`): con el azar por parámetro,
  así que se comprueba sin depender de la suerte.
- **La sala entera** (`apps/server/src/rooms/impostor-ws.spec.ts`): una ronda completa contra
  dos bots por WebSocket, el debate con reloj cerrándose solo, y —lo importante— que la
  palabra y los impostores no viajan mientras se juega.
- **Las pantallas**: que la palabra que se pinta es la que manda el servidor, que al impostor
  no se le pinta ninguna, y que el disparo final solo se le ofrece a quien le toca.
