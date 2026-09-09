# Trivial de dev: un concurso, no un cuestionario

Fecha: 2026-08-28

## Por qué

La tarjeta de `/juegos` promete «preguntas que duelen en la retro». Un
cuestionario de opción múltiple cumpliría la promesa y sería aburrido a la
segunda partida.

Lo que se construye es un **concurso**: varias clases de prueba, una puntuación
que premia saberlo y saberlo rápido, y un presentador que lo cuenta con guasa.
El presentador es la mitad del juego. Sin él, esto son preguntas con botones.

Y hay una razón para que lo arbitre el servidor: en un concurso, la respuesta
correcta no puede estar en el navegador de quien contesta. Con las preguntas en
el bundle, ganar es abrir las herramientas de desarrollo —que es justo el
público de este juego—.

## Qué se construye

Un `GameModule` nuevo —`trivial`—, un banco de preguntas que **vive en el
servidor y no viaja hasta que la ronda se cierra**, y una pantalla con su
presentador.

## Qué NO se construye

- No se toca la flota, ni RISK, ni el Scrum Poker.
- No hay ranking entre partidas, ni perfiles, ni logros.
- No hay editor de preguntas. El banco se amplía escribiendo TypeScript.
- El presentador no arbitra. No suma puntos, no decide respuestas y no puede
  cambiar el resultado de nada.

---

## 1. Las pruebas

Tres clases, y ninguna se elige por variedad decorativa: cada una premia algo
distinto.

**Test.** Cuatro opciones, una correcta. Puede llevar un bloque de código, y ahí
la pregunta es la de siempre: «¿qué imprime esto?». Premia saberlo.

**Estimación.** Un número: en qué año pasó algo, cuántas líneas tiene una cosa,
cuánto tarda otra. Gana quien más se acerca. Premia tener el orden de magnitud
en la cabeza, que es un saber distinto del de acertar una opción.

**Pillar el fallo.** Un trozo de código con un error y cuatro líneas candidatas:
se señala **la línea**. Premia leer código, que es lo que de verdad se hace todo
el día.

Las tres tienen la misma forma por dentro —enunciado, opciones, una respuesta
correcta— así que el motor no crece con cada una. Lo que cambia es cómo se
puntúa y cómo se pinta.

## 2. La puntuación

Acertar da **100 puntos**. Y ser de los primeros en acertar da hasta **50 más**:
50 al primero, 35 al segundo, 20 al tercero, 5 al cuarto y nada al resto.

El bonus va por **orden de llegada** y no por cronómetro, y es una decisión, no
una simplificación. El motor es puro —mismo estado y misma jugada, mismo
resultado— y por eso no puede mirar el reloj; si el tiempo lo midiera el
cliente, la jugada llevaría dentro un «he tardado 0 ms» que nadie puede
desmentir. El orden lo decide el servidor al aplicar cada respuesta, y contra
eso no hay nada que enviar.

La cuenta atrás sigue existiendo en la pantalla: aprieta igual, pero no puntúa.

En las estimaciones no hay acierto binario: se cobra en proporción a lo cerca
que se queda uno, hasta cero. Bordar la cifra exacta suma 20 de propina.

Y cada pregunta declara su **margen**: el error a partir del cual ya no puntúa.
Sin él, la proporción se mide contra la propia respuesta y la prueba deja de
discriminar —en «¿de qué año es git?», cualquiera que dijera un año del siglo
XXI se llevaría un noventa y nueve por ciento—. Veinte de error es fallar en un
año y es bordarlo en «cuántas líneas tiene»; eso solo lo sabe la pregunta.

No se resta por fallar. Restar hace que la gente deje de contestar, y un
concurso en el que nadie arriesga no tiene gracia.

## 3. El secreto

Es lo mismo que ya hace el Scrum Poker con los votos, y por el mismo motivo.

Mientras la ronda está abierta, lo que sale hacia cada asiento es **el enunciado
y las opciones**. No la respuesta correcta. No lo que han contestado los demás.
Solo quién ha contestado ya, para que se vea que la mesa avanza.

Cuando la ronda se cierra —porque han contestado todos o porque se acabó el
tiempo—, sale todo: la correcta, lo que puso cada uno y los puntos.

El banco de preguntas vive en `apps/server` y **no se importa nunca desde
`apps/web`**. El servidor elige las preguntas al crear la sala y las guarda en el
estado de la partida; el navegador recibe lo que `view()` le deja ver. Una regla
de ESLint impide el import cruzado, porque una condición que solo vive en un
documento se rompe sola.

## 4. El presentador

Es un personaje, no una plantilla: chulesco, con prisa, y con la manía —fija y
no negociable— de que Óscar es el mejor programador de la historia, o el maestro
de cualquiera que aparezca en una pregunta.

Funciona en dos capas, y ese orden importa:

**El guion.** Frases escritas, deterministas, que salen del estado de la partida:
la presentación, el aviso de que quedan diez segundos, el resultado de la ronda,
la coña cuando alguien falla lo evidente y la despedida. Está en el paquete
compartido, es igual para todos los jugadores y no necesita red.

**El florero.** Si quien juega tiene configurada su IA —la misma clave de
OpenRouter que ya usa para los bots de RISK, guardada en su navegador—, el
presentador reescribe la frase del guion con su tono. Si no hay clave, si el
modelo tarda o si devuelve cualquier cosa rara, se queda la frase del guion y no
pasa nada.

Esta división es lo que evita el fallo clásico: que el juego dependa de un
modelo de lenguaje para funcionar. La IA aquí no puede romper una partida porque
no toca la partida; solo cambia cómo suena.

## 5. Cómo transcurre

Sala, invitación por enlace y entre dos y ocho jugadores. Se puede jugar en
solitario contra la máquina.

Cada partida son diez rondas. En cada una: el presentador la anuncia, se abre la
pregunta, se responde, y la ronda se cierra sola en cuanto han contestado todos
los que están en la mesa. Entonces se enseña el resultado con los puntos y
cualquiera pasa a la siguiente. Al final, la clasificación y la despedida.

Si alguien se queda sin contestar, quien abrió la sala puede pasar de todos
modos: la partida no se queda colgada esperando a quien cerró la pestaña.

Los bots contestan con `botAction`, que ya existe y que ya mueve el servidor:
aciertan según su nivel y tardan un rato variable, porque un rival que responde
correcto e instantáneo no es un rival, es un cronómetro.

---

## 6. Ficheros

```
packages/shared/src/games/trivial/
  tipos.ts        pregunta, ronda, estado, vista, esquema de la acción
  reglas.ts       abrir, responder, cerrar, puntuar
  guion.ts        las frases del presentador
  bot.ts          qué contesta un asiento sin nadie detrás
  index.ts        el GameModule
apps/server/src/games/trivial/banco.ts   las preguntas, con sus respuestas
apps/server/src/rooms/registry.ts        + el módulo
apps/web/src/app/games/trivial/          lobby, sala, presentador, marcador
```

## 7. Tests

- Puntuación: acierto, fallo, el bonus por rapidez, la estimación exacta y la
  lejana, y que fallar nunca resta.
- Rondas: no se responde dos veces, no se responde a una ronda cerrada, la ronda
  se cierra sola cuando han contestado todos.
- Vista: **que la respuesta correcta no salga mientras la ronda esté abierta**, y
  que las respuestas ajenas tampoco. Va con nombre propio, como en la flota.
- Banco: que ninguna pregunta tenga la respuesta correcta fuera de rango, ni
  opciones repetidas, ni menos de cuatro.
- Frontera: un test que falla si `apps/web` importa el banco.
- Guion: que haya frase para cada momento y que ninguna dependa de la red.

## 8. Riesgos

**El banco es contenido, y el contenido envejece.** Diez preguntas nuevas valen
más que cualquier refactor del motor. Se amplía escribiendo, y por eso el
formato es lo más tonto posible.

**El presentador puede cansar.** Las frases del guion se eligen al azar dentro
de su momento, y la IA —cuando está— no repite. Si aun así cansa, se apaga desde
la sala sin tocar el juego.
