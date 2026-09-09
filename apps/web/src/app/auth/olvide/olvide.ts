import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../../api/auth-api.service';
import { PanelCuenta } from '../panel-cuenta/panel-cuenta';

/**
 * El estado va en señales, y no es un capricho de estilo.
 *
 * La aplicación corre sin zone.js: nadie vigila lo que pasa después de un
 * `await`, así que asignar a un campo normal cambia el valor y deja la pantalla
 * como estaba. Con señales, escribir el valor ES avisar de que hay que
 * repintar, y no hay forma de olvidarse.
 */
@Component({
  selector: 'app-olvide',
  imports: [ReactiveFormsModule, RouterLink, PanelCuenta],
  templateUrl: './olvide.html',
  styleUrl: '../auth.css',
})
export class Olvide {
  formulario: FormGroup;
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly hecho = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthApiService,
  ) {
    this.formulario = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get email(): AbstractControl | null {
    return this.formulario.get('email');
  }

  async pedir(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.error.set('');

    try {
      const { email } = this.formulario.value as { email: string };
      await this.auth.pedirCambioDeContrasena(email);
      this.hecho.set(true);
    } catch (fallo) {
      this.error.set(AuthApiService.mensajeDe(fallo));
    } finally {
      this.enviando.set(false);
    }
  }
}
