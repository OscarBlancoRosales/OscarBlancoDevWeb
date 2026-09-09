import { Component, Input } from '@angular/core';
import { TerminalLayout } from '../../shared/terminal-layout/terminal-layout';
import { I18nService } from '../../services/i18n.service';

/**
 * El marco común de las pantallas de cuenta.
 *
 * Entrar, registrarse, verificar el correo, pedir contraseña nueva y cambiarla
 * son la misma tarjeta con distinto formulario dentro. Tenerlo en un solo sitio
 * evita que las cinco se separen con el tiempo y que cambiar un margen haya que
 * hacerlo cinco veces.
 */
@Component({
  selector: 'app-panel-cuenta',
  imports: [TerminalLayout],
  templateUrl: './panel-cuenta.html',
  styleUrl: '../auth.css',
})
export class PanelCuenta {
  constructor(public i18n: I18nService) {}

  @Input({ required: true }) titulo = '';
  @Input() subtitulo = '';

  /** Lo que ha ido mal, si algo ha ido mal. */
  @Input() error = '';

  /** Lo que ha ido bien, cuando hay algo que contar. */
  @Input() aviso = '';
}
