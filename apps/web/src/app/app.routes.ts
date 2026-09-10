import { Routes } from '@angular/router';
import { Console } from './console/console';
import { Auth } from './auth/auth';
import { Registro } from './auth/registro/registro';
import { Verificar } from './auth/verificar/verificar';
import { Olvide } from './auth/olvide/olvide';
import { NuevaContrasena } from './auth/nueva-contrasena/nueva-contrasena';
import { Admin } from './admin/admin';
import { NameScreen } from './name-screen/name-screen';
import { ScrumPoker } from './scrum-poker/scrum-poker';
import { DniGenerator } from './dni-generator/dni-generator';
import { QrGenerator } from './qr-generator/qr-generator';
import { Decoder } from './decoder/decoder';
import { Formatter } from './formatter/formatter';
import { ColorPicker } from './color-picker/color-picker';
import { RegexTester } from './regex-tester/regex-tester';
import { LoremGenerator } from './lorem-generator/lorem-generator';
import { TimestampConverter } from './timestamp-converter/timestamp-converter';
import { UuidGenerator } from './uuid-generator/uuid-generator';
import { IconGenerator } from './icon-generator/icon-generator';
import { ThrowdownTimer } from './throwdown-timer/throwdown-timer';

/**
 * Las secciones cuelgan del escritorio, no van sueltas.
 *
 * La dirección no cambia -`/scrum-poker` sigue siendo `/scrum-poker`-, pero
 * quien la abre cae en el escritorio con esa sección en una ventana a
 * pantalla completa, con su barra de tareas y el resto de la casa a la vista.
 * Antes, quien recibía una invitación de Scrum Poker aterrizaba en una
 * pantalla suelta, votaba y se iba sin enterarse de que había algo más.
 *
 * `data.win` dice en qué ventana se hospeda cada una. Que dos rutas compartan
 * ventana es lo que hace que el paso por la pantalla de nombre no parpadee:
 * es la misma ventana cambiando de contenido.
 */
const SECCIONES: Routes = [
  // El planning poker tiene dos versiones. `/scrum-poker` es ahora la puerta
  // donde se elige; la mesa clásica sigue donde estaba para no romper los
  // enlaces de invitación que ya andan por ahí.
  {
    path: 'scrum-poker',
    loadComponent: () => import('./poker-mesa/elegir/elegir').then((m) => m.ElegirPoker),
    data: { win: 'poker' },
  },
  {
    path: 'scrum-poker/entrar',
    loadComponent: () => import('./poker-mesa/entrar/entrar').then((m) => m.EntrarEnLaMesa),
    data: { win: 'poker' },
  },
  {
    path: 'scrum-poker/mesa',
    loadComponent: () => import('./poker-mesa/mesa/mesa').then((m) => m.MesaPoker),
    data: { win: 'poker' },
  },
  { path: 'scrum-poker/clasico', component: ScrumPoker, data: { win: 'poker' } },
  { path: 'name-screen', component: NameScreen, data: { win: 'poker' } },
  // Las de cuenta también: crear una sala pide sesión, y salir al identificarse
  // dejaba a medias justo el camino que acabábamos de arreglar. A las tres
  // últimas se llega desde el correo, y ahí ver la casa detrás ayuda todavía
  // más: quien verifica su cuenta no sabe aún qué hay al otro lado.
  //
  // Esas tres direcciones las escribe el servidor al mandar el correo: si
  // cambian aquí, hay que cambiarlas también en apps/server/src/auth/service.ts.
  { path: 'auth', component: Auth, data: { win: 'cuenta', titleKey: 'desk.account' } },
  { path: 'auth/registro', component: Registro, data: { win: 'cuenta', titleKey: 'desk.account' } },
  { path: 'auth/verificar', component: Verificar, data: { win: 'cuenta', titleKey: 'desk.account' } },
  { path: 'auth/olvide', component: Olvide, data: { win: 'cuenta', titleKey: 'desk.account' } },
  {
    path: 'auth/nueva-contrasena',
    component: NuevaContrasena,
    data: { win: 'cuenta', titleKey: 'desk.account' },
  },
  // El panel se defiende solo: sin rol de administrador enseña un 404 y el
  // servidor contesta lo mismo a cada una de sus rutas.
  { path: 'admin', component: Admin, data: { win: 'admin', title: 'admin' } },
  { path: 'dni-generator', component: DniGenerator, data: { win: 'dni' } },
  { path: 'qr-generator', component: QrGenerator, data: { win: 'qr' } },
  { path: 'decoder', component: Decoder, data: { win: 'base64' } },
  { path: 'formatter', component: Formatter, data: { win: 'format' } },
  { path: 'color-picker', component: ColorPicker, data: { win: 'color' } },
  { path: 'regex-tester', component: RegexTester, data: { win: 'regex' } },
  { path: 'lorem-generator', component: LoremGenerator, data: { win: 'lorem' } },
  { path: 'timestamp', component: TimestampConverter, data: { win: 'timestamp' } },
  { path: 'uuid-generator', component: UuidGenerator, data: { win: 'uuid' } },
  { path: 'icon-generator', component: IconGenerator, data: { win: 'iconos' } },
  {
    path: 'tomelloso-throwdown-timer',
    component: ThrowdownTimer,
    data: { win: 'timer', title: 'Tomelloso Throwdown' },
  },
  // La seccion de juegos se carga aparte: lleva los mapas, el motor y la IA,
  // y no tiene por que pesar en la carga inicial del portfolio.
  {
    path: 'juegos',
    data: { win: 'juegos' },
    loadComponent: () => import('./games/games').then((m) => m.Games),
  },
  {
    path: 'juegos/trivial',
    data: { win: 'juegos' },
    loadComponent: () =>
      import('./games/trivial/trivial-lobby/trivial-lobby').then((m) => m.TrivialLobby),
  },
  {
    path: 'juegos/trivial/mesa',
    data: { win: 'juegos' },
    loadComponent: () =>
      import('./games/trivial/trivial-room/trivial-room').then((m) => m.TrivialRoom),
  },
  {
    path: 'juegos/impostor',
    data: { win: 'juegos' },
    loadComponent: () =>
      import('./games/impostor/impostor-lobby/impostor-lobby').then((m) => m.ImpostorLobby),
  },
  {
    path: 'juegos/impostor/mesa',
    data: { win: 'juegos' },
    loadComponent: () =>
      import('./games/impostor/impostor-room/impostor-room').then((m) => m.ImpostorRoom),
  },
  {
    path: 'juegos/risk',
    data: { win: 'juegos' },
    loadComponent: () => import('./games/risk/ui/risk-lobby/risk-lobby').then((m) => m.RiskLobby),
  },
  {
    path: 'juegos/risk/mesa',
    data: { win: 'juegos' },
    loadComponent: () => import('./games/risk/ui/risk-room/risk-room').then((m) => m.RiskRoom),
  },
  {
    path: 'juegos/flota',
    data: { win: 'juegos' },
    loadComponent: () => import('./games/flota/flota-lobby/flota-lobby').then((m) => m.FlotaLobby),
  },
  {
    path: 'juegos/flota/mesa',
    data: { win: 'juegos' },
    loadComponent: () => import('./games/flota/flota-room/flota-room').then((m) => m.FlotaRoom),
  },
];

export const routes: Routes = [
  // El escritorio es la puerta de entrada y el marco de todo lo demás: quien
  // llega ve de un vistazo lo que hay. La terminal y las pantallas de cuenta
  // van aparte, porque piden la pantalla entera.
  {
    path: '',
    loadComponent: () => import('./desktop/desktop').then((m) => m.Desktop),
    children: [
      // El escritorio a secas, sin ninguna sección abierta.
      { path: '', pathMatch: 'full', children: [] },
      ...SECCIONES,
    ],
  },
  { path: 'terminal', component: Console },
  { path: '**', redirectTo: '' },
];
