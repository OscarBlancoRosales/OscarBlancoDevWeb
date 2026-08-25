# RISK — cómo está hecho y cómo se pone en marcha

La sección **Juegos** (`/juegos`) arranca con un RISK completo: reglas clásicas, tres mapas,
bots con IA que hablan por el chat, partidas grabadas y reanudables, y todo funcionando en
GitHub Pages, sin servidor propio.

---

## 1. Puesta en marcha rápida

```bash
npm install
ng serve            # http://localhost:4200/juegos
npm test            # 600+ tests
```

Para jugar **no hace falta configurar nada**: en `/juegos/risk` hay un botón
**«🤖 Jugar aquí contra la IA»** que crea una partida local (se guarda en el navegador,
no usa red). Sirve para probar mapas, jugar contra los bots y demostrar el producto
aunque Firebase no esté abierto.

Para jugar **con otras personas** hacen falta dos cosas: iniciar sesión (igual que en el
Scrum Poker) y que la base de datos permita escribir en `riskRooms` (ver punto 3).

---

## 2. Arquitectura: multijugador sin backend

No hay servidor de juego. El modelo es **lockstep determinista**:

```
        ┌──────────────┐        escribe acción        ┌──────────────────────┐
        │  Cliente A   │ ───────────────────────────► │  Firebase RTDB       │
        └──────┬───────┘                              │  riskRooms/{sala}    │
               │  lee el log completo                 │    meta   (reglas)   │
               ▼                                      │    seats  (asientos) │
   motor puro: (estado, acción) → estado              │    log    (acciones) │
               ▲                                      │    chat              │
        ┌──────┴───────┐                              │    snapshot          │
        │  Cliente B   │ ◄─────────────────────────── └──────────────────────┘
        └──────────────┘        mismo log
```

- El motor (`engine/engine.ts`) es una función pura: mismo estado + misma acción → mismo
  resultado. Los dados salen de un RNG sembrado con `(semilla de partida, nº de acción)`,
  así que **todos los clientes sacan exactamente los mismos dados** sin hablar entre ellos.
- Cada cliente escribe sus acciones en `log`. Todos leen el log entero y lo reproducen.
- Las acciones ilegales (una jugada repetida, alguien que llega tarde) se descartan con el
  mismo criterio en todos los clientes, así que nadie se descuadra.
- Cada 40 acciones el anfitrión guarda un `snapshot` para no tener que reproducirlo todo.

**Consecuencias que salen gratis:**

| Requisito | Cómo se cumple |
|---|---|
| Partidas grabables | El log **es** la grabación, jugada a jugada |
| Reanudar más tarde | Se vuelve a reproducir el log (o el último snapshot) |
| Respetar a cada jugador | Cada asiento guarda un `seatToken` (uid o token del navegador) y se recupera al volver |
| Coste | Una acción son unos bytes; una partida completa cabe de sobra en la capa gratuita |

### El anfitrión

Un cliente hace de **anfitrión**: mueve los bots y guarda los puntos de control. Se elige
de forma determinista (el propietario si está conectado; si no, el humano conectado más
antiguo), así que nunca hay dos clientes moviendo el mismo bot. Si el anfitrión se va, otro
toma el relevo automáticamente.

### La alineación se congela al empezar

Al pulsar «Empezar la partida» se guarda en `meta.roster` la lista de jugadores tal cual
está en ese momento. A partir de ahí el estado inicial ya no depende de los asientos: se
puede renombrar gente, cambiar colores o desconectarse sin que el tablero cambie.

---

## 3. Reglas de seguridad de Firebase

El juego escribe en el nodo `riskRooms`. Hay que abrirlo en la consola de Firebase
(*Realtime Database → Reglas*). Estas reglas dejan jugar sin cuenta pero **solo dentro de
`riskRooms`**, y siguen protegiendo el resto de la base:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    },
    "riskRooms": {
      ".read": true,
      "$roomId": {
        ".write": true,
        ".validate": "newData.hasChildren(['meta']) || !newData.exists()",
        "meta": {
          ".validate": "newData.hasChildren(['id', 'mapId', 'seed'])"
        },
        "log": {
          "$entry": {
            ".validate": "newData.hasChildren(['action'])"
          }
        },
        "chat": {
          "$message": {
            ".validate": "newData.child('text').isString() && newData.child('text').val().length <= 600"
          }
        }
      }
    }
  }
}
```

Si prefieres que **solo usuarios registrados** puedan crear salas y que los invitados solo
puedan sentarse y jugar, cambia la escritura de `meta` a `"auth != null"`:

```json
"meta": { ".write": "auth != null" }
```

> Mientras las reglas no estén abiertas, la sección sigue funcionando en **modo local**
> (partidas contra la IA guardadas en el navegador). El lobby lo indica y no se queda
> colgado esperando a la base de datos.

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

**La clave se guarda solo en el `localStorage` de ese navegador.** No viaja a Firebase ni
se comparte con el resto de la sala.

Qué hace el modelo y qué no:

- **Sí**: escribe el mensaje del turno y marca intención estratégica (a qué territorios
  apuntar, cuánto arriesgar).
- **No**: ejecutar jugadas directamente. Lo que propone se valida contra el mapa y el
  estado; lo que no es legal se descarta.

Las jugadas las decide siempre el cerebro local, *inclinado* por lo que pide el modelo. Si
el modelo falla, tarda o contesta cualquier cosa, la partida sigue igual con el cerebro
local. **Nunca se bloquea la mesa esperando a una API.**

### 4.3 El estratega

Además de los bots, hay un consejero para el jugador humano: en cada fase de tu turno te
deja un mensaje en el chat con qué harías tú («yo pondría el grueso en Afganistán: frontera
amenazada y está solo»). También se puede pedir a mano. Sus consejos son **privados**: no se
escriben en Firebase ni los ve el resto de la mesa.

---

## 5. Los mapas

| Mapa | Territorios | Regiones | Dibujo | Ritmo |
|---|---|---|---|---|
| Todo el mundo | 42 | 6 continentes | retículo hexagonal | La partida larga de siempre |
| España por provincias | 52 | 18 comunidades | **cartografía real** | Muy territorial, la más larga |
| España por comunidades | 19 | 5 macrozonas | **cartografía real** | Partida rápida |

### De cartografía real a tablero

Los mapas de España no se dibujan a mano: se generan de límites administrativos
reales con `npm run build:maps` (ver `tools/build-spain-map.ts`). El proceso es
una herramienta de desarrollo; en tiempo de ejecución el juego solo carga datos
ya masticados (un `path` SVG y un punto de etiqueta por territorio).

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
cartografía son todas reales, y de hecho corrigen dos que el dibujo hexagonal
anterior se había inventado (A Coruña con Asturias, Girona con Tarragona).

El mapa por comunidades no es un dibujo aparte: se obtiene **fundiendo** las
provincias de cada comunidad sobre la misma topología (los arcos interiores del
grupo aparecen dos veces y se descartan), así que las costas coinciden
exactamente entre los dos mapas. Un test lo comprueba: el punto de etiqueta de
cada una de las 52 provincias tiene que caer dentro de la silueta de su
comunidad.

### Añadir un mapa

Un mapa es un archivo en `engine/maps/` registrado en `map-registry.ts`. Los
tests de integridad se aplican solos a todos los mapas del registro. Hay dos
formas de dar el dibujo:

- **`shape`**: un `path` SVG en coordenadas de tablero, más `labelAnchor` y
  `board` con el tamaño del lienzo. Es lo que usan los mapas de España.
- **`hexes`**: celdas de un retículo hexagonal escritas como arte ASCII, de las
  que se derivan contorno y etiqueta. Es lo que usa todavía el mapa del mundo.

En ambos casos, las adyacencias que no son fronteras de tierra se declaran en
`seaRoutes` y se dibujan como líneas de puntos.

## 6. Tests

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
  fronteras por contacto y polo de inaccesibilidad (82 tests sobre figuras
  controladas, sin depender de datos reales).
- **Mapas**: integridad de los tres mapas (contigüidad, simetría, conexidad,
  continentes, fronteras falsas, paths válidos) y coherencia entre el mapa
  provincial y el de comunidades.
- **IA**: legalidad de todas sus decisiones y **partidas completas de bots de principio a
  fin** en los tres mapas (garantiza que la IA no se atasca nunca).
- **Sincronización**: reconstrucción del estado desde el log, snapshots, elección de
  anfitrión, descarte determinista de acciones ilegales.
- **Interfaz**: tablero, portada, lobby y mesa, incluyendo una partida jugada de verdad
  contra bots desde el componente.
