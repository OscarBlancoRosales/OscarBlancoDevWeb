import { Routes } from '@angular/router';
import { Console } from './console/console';
import { Auth } from './auth/auth';
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

export const routes: Routes = [
  { path: '', component: Console },
  { path: 'auth', component: Auth },
  { path: 'name-screen', component: NameScreen },
  { path: 'scrum-poker', component: ScrumPoker },
  { path: 'dni-generator', component: DniGenerator },
  { path: 'qr-generator', component: QrGenerator },
  { path: 'decoder', component: Decoder },
  { path: 'formatter', component: Formatter },
  { path: 'color-picker', component: ColorPicker },
  { path: 'regex-tester', component: RegexTester },
  { path: 'lorem-generator', component: LoremGenerator },
  { path: 'timestamp', component: TimestampConverter },
  { path: 'uuid-generator', component: UuidGenerator },
  { path: 'icon-generator', component: IconGenerator },
  { path: 'tomelloso-throwdown-timer', component: ThrowdownTimer },
  // La seccion de juegos se carga aparte: lleva los mapas, el motor y la IA,
  // y no tiene por que pesar en la carga inicial del portfolio.
  {
    path: 'juegos',
    loadComponent: () => import('./games/games').then((m) => m.Games),
  },
  {
    path: 'juegos/risk',
    loadComponent: () => import('./games/risk/ui/risk-lobby/risk-lobby').then((m) => m.RiskLobby),
  },
  {
    path: 'juegos/risk/mesa',
    loadComponent: () => import('./games/risk/ui/risk-room/risk-room').then((m) => m.RiskRoom),
  },
  { path: '**', redirectTo: '' }
];
