import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styles: []
})
/* eslint-disable-next-line @typescript-eslint/no-extraneous-class --
   la raíz no tiene estado: su trabajo entero es montar el router-outlet. */
export class App {}
