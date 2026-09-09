import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../api/auth-api.service';
import { PanelCuenta } from '../panel-cuenta/panel-cuenta';
import { MINIMO_CONTRASENA } from '../registro/registro';
import { I18nService } from '../../services/i18n.service';

/**
 * Que las dos veces sea la misma.
 *
 * Va en el grupo y no en el campo porque compara dos controles: un validador de
 * campo solo ve el suyo, y aquí lo que importa es la relación entre ambos.
 */
export function coinciden(grupo: AbstractControl): ValidationErrors | null {
  const password = grupo.get('password')?.value as string | undefined;
  const repetida = grupo.get('repetida')?.value as string | undefined;
  if (!repetida) return null;
  return password === repetida ? null : { noCoinciden: true };
}

/**
 * El estado va en señales, y no es un capricho de estilo.
 *
 * La aplicación corre sin zone.js: nadie vigila lo que pasa después de un
 * `await`, así que asignar a un campo normal cambia el valor y deja la pantalla
 * como estaba. Con señales, escribir el valor ES avisar de que hay que
 * repintar, y no hay forma de olvidarse.
 */
@Component({
  selector: 'app-nueva-contrasena',
  imports: [ReactiveFormsModule, RouterLink, PanelCuenta],
  templateUrl: './nueva-contrasena.html',
  styleUrl: '../auth.css',
})
export class NuevaContrasena implements OnInit {
  readonly minimo = MINIMO_CONTRASENA;

  formulario: FormGroup;
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly hecho = signal(false);

  private readonly tokenSignal = signal('');

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthApiService,
    public i18n: I18nService,
  ) {
    this.formulario = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(MINIMO_CONTRASENA)]],
        repetida: ['', Validators.required],
      },
      { validators: coinciden },
    );
  }

  ngOnInit(): void {
    this.tokenSignal.set(this.route.snapshot.queryParamMap.get('token') ?? '');
    if (!this.hayToken()) {
      this.error.set('Al enlace le falta el código. Cópialo entero desde el correo.');
    }
  }

  hayToken(): boolean {
    return this.tokenSignal() !== '';
  }

  get password(): AbstractControl | null {
    return this.formulario.get('password');
  }

  get repetida(): AbstractControl | null {
    return this.formulario.get('repetida');
  }

  async cambiar(): Promise<void> {
    if (this.formulario.invalid || this.enviando() || !this.hayToken()) return;

    this.enviando.set(true);
    this.error.set('');

    try {
      const { password } = this.formulario.value as { password: string };
      await this.auth.cambiarContrasena(this.tokenSignal(), password);
      this.hecho.set(true);
      // Cambiar la contraseña cierra las sesiones abiertas en el servidor, así
      // que lo siguiente es entrar con la nueva. Se lleva sola para no dejar a
      // nadie mirando una pantalla que ya no sirve.
      await this.router.navigate(['/auth']);
    } catch (fallo) {
      this.error.set(AuthApiService.mensajeDe(fallo));
    } finally {
      this.enviando.set(false);
    }
  }
}
