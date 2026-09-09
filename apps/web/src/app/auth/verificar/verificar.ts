import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthApiService } from '../../api/auth-api.service';
import { PanelCuenta } from '../panel-cuenta/panel-cuenta';
import { I18nService } from '../../services/i18n.service';

type Estado = 'comprobando' | 'activada' | 'fallo';

/**
 * El destino del enlace del correo de alta.
 *
 * No pide nada: llega con el token en la dirección, lo canjea y cuenta cómo ha
 * ido. Un enlace de verificación que exige rellenar algo es un enlace que la
 * mitad de la gente abandona.
 *
 * El estado va en señales porque aquí no hay ningún evento del usuario que
 * dispare el repintado: la pantalla cambia sola cuando el servidor contesta, y
 * sin zone.js eso no lo ve nadie. Con un campo normal se quedaba para siempre
 * en «Comprobando el enlace…».
 */
@Component({
  selector: 'app-verificar',
  imports: [RouterLink, PanelCuenta],
  templateUrl: './verificar.html',
  styleUrl: '../auth.css',
})
export class Verificar implements OnInit {
  readonly estado = signal<Estado>('comprobando');
  readonly error = signal('');

  constructor(
    private route: ActivatedRoute,
    private auth: AuthApiService,
    public i18n: I18nService,
  ) {}

  ngOnInit(): void {
    // Angular no espera lo que devuelva `ngOnInit`, así que devolver una promesa
    // desde aquí es prometer algo que nadie va a recoger. El trabajo se lanza y
    // quien quiera esperarlo —los tests— llama a `comprobar` directamente.
    void this.comprobar();
  }

  async comprobar(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.estado.set('fallo');
      this.error.set('Al enlace le falta el código. Cópialo entero desde el correo.');
      return;
    }

    try {
      await this.auth.verificar(token);
      this.estado.set('activada');
    } catch (fallo) {
      this.estado.set('fallo');
      this.error.set(AuthApiService.mensajeDe(fallo));
    }
  }
}
