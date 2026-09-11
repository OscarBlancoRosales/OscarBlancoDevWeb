# El agente

Lo único de toda la casa que corre en **tu** ordenador.

Lee las sesiones que Claude Code deja en `~/.claude/projects` y se las sirve a la
pantalla de administración de la web, para poder releerlas con la estética de la
terminal en vez de con la del visor de turno.

```bash
npm run start -w @devweb/agente
```

Luego, en la web: entra como administrador, abre **Administración** y ve a la
pestaña **Sesiones**. Si el agente no está en marcha, la pantalla lo dice y
recuerda el comando; no se queda en blanco.

## Por qué esto no abre ninguna puerta

- **Escucha en `127.0.0.1`, no en `0.0.0.0`.** No está en la red de casa: para
  llegar aquí hay que estar ya dentro de este ordenador.
- **Solo lee.** No hay un solo `POST`. Escribir —pedirle cosas a Claude desde la
  web— es el paso siguiente y trae sus propias preguntas, empezando por que
  quien pueda escribir por aquí manda sobre tu sesión.
- **Lista blanca de quién puede pedirlo.** Cualquier página que abras en el
  navegador puede llamar a este puerto; la lista de orígenes es explícita y
  corta, y lo que hay detrás es el historial de todo lo que trabajas.
- **Vive mientras tú lo tengas abierto.** Cerrar la ventana es cerrar la puerta.

Nada de esto sale hacia la VPS: el navegador habla directamente con tu máquina.

## Qué se lee, y qué no

De cada sesión salen las tandas de quien habla —tú y Claude— con sus cuatro
clases de parte: lo que se dice, lo que Claude se dice a sí mismo (plegado en
pantalla), las herramientas que usa y lo que devuelven.

Lo demás del fichero se ignora: modos, estado del coste, latidos del puente y
los otros diez tipos de línea que Claude Code guarda para sus cosas. El formato
es suyo y puede crecer sin avisarnos, así que la regla es que **lo que no se
entienda no rompe nada**: se salta esa línea y se sigue.

Los textos muy largos se recortan a cuatro mil caracteres. Hay entradas de
herramienta de megas, y traerlas enteras cuesta memoria en las dos puntas.

## Cuidado con lo que hay ahí dentro

Una transcripción tiene todo lo que se habló: rutas de tu disco, fragmentos de
código, salidas de comandos. Si alguna vez se pegó un secreto en una sesión,
está en ese fichero. Por eso esto no se publica en ninguna parte y la pantalla
vive detrás del panel de administración.
