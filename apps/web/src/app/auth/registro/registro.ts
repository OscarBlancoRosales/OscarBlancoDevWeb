import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthApiService } from '../../api/auth-api.service';
import { PanelCuenta } from '../panel-cuenta/panel-cuenta';
import { I18nService } from '../../services/i18n.service';

/** Lo que exige el servidor. Repetirlo aquí es para avisar antes de enviar. */
export const MINIMO_CONTRASENA = 12;

/**
 * El estado va en señales, y no es un capricho de estilo.
 *
 * La aplicación corre sin zone.js: nadie vigila lo que pasa después de un
 * `await`, así que asignar a un campo normal cambia el valor y deja la pantalla
 * como estaba. Con señales, escribir el valor ES avisar de que hay que
 * repintar, y no hay forma de olvidarse.
 */
@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, PanelCuenta],
  templateUrl: './registro.html',
  styleUrl: '../auth.css',
})
export class Registro {
  readonly minimo = MINIMO_CONTRASENA;

  formulario: FormGroup;
  readonly enviando = signal(false);
  readonly error = signal('');

  /** Cuando el alta se ha mandado, el formulario sobra y estorba. */
  readonly hecho = signal(false);

  /**
   * El alta es solo por invitación, y la invitación viaja en el enlace.
   *
   * Quien llega a esta dirección a pelo no puede hacer nada aquí, así que se le
   * dice de entrada en vez de dejarle rellenar tres campos para que el servidor
   * le conteste que no. No se enseña el valor: es la llave.
   */
  readonly invitacion = signal('');

  constructor(
    private fb: FormBuilder,
    private auth: AuthApiService,
    private ruta: ActivatedRoute,
    public i18n: I18nService,
  ) {
    this.invitacion.set(this.ruta.snapshot.queryParamMap.get('invitacion') ?? '');
    this.formulario = this.fb.group({
      displayName: ['', [Validators.required, Validators.maxLength(40)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(MINIMO_CONTRASENA)]],
    });
  }

  get displayName(): AbstractControl | null {
    return this.formulario.get('displayName');
  }

  get email(): AbstractControl | null {
    return this.formulario.get('email');
  }

  get password(): AbstractControl | null {
    return this.formulario.get('password');
  }

  async registrar(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.error.set('');

    const { displayName, email, password } = this.formulario.value as {
      displayName: string;
      email: string;
      password: string;
    };

    try {
      await this.auth.registrar(email, password, displayName, this.invitacion());
      this.hecho.set(true);
    } catch (fallo) {
      this.error.set(AuthApiService.mensajeDe(fallo));
    } finally {
      this.enviando.set(false);
    }
  }
}
