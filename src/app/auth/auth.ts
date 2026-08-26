import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseAuthService } from '../firebase-auth.service';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';

/** A dónde se va tras iniciar sesión si nadie pide otra cosa. */
export const DEFAULT_AFTER_LOGIN = '/name-screen';

/** Prefijos que el navegador resuelve como OTRO dominio aunque empiecen por barra. */
const FUERA_DE_CASA = ['//', '/\\'];

/**
 * Filtra el `next` que llega por la URL: solo dejamos pasar rutas de esta web.
 *
 * Sin este filtro, cualquiera podría repartir un enlace a NUESTRO login con un
 * `next` que apunte a su dominio: la víctima ve la dirección de siempre, mete
 * sus credenciales de verdad, y acaba en una copia de la página sin haber
 * hecho nada raro. Se llama redirección abierta, y es el motor clásico del
 * phishing con dominio legítimo.
 *
 * Ojo con las dos formas que no parecen externas y lo son: `//otro.com` es una
 * URL sin protocolo (el navegador la resuelve contra otro dominio) y
 * `/\otro.com` es lo mismo escrito con la barra al revés, que varios
 * navegadores normalizan a lo anterior.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return DEFAULT_AFTER_LOGIN;
  if (FUERA_DE_CASA.some((prefijo) => raw.startsWith(prefijo))) return DEFAULT_AFTER_LOGIN;
  return raw;
}

@Component({
  selector: 'app-auth',
  imports: [CommonModule, ReactiveFormsModule, TerminalLayout],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  /**
   * Dónde vuelve el usuario después de identificarse. El lobby del RISK manda
   * aquí a quien quiere crear una sala online, y antes lo soltábamos en Scrum
   * Poker pasara lo que pasara: iniciabas sesión para una cosa y aparecías en
   * otra.
   */
  private nextUrl = DEFAULT_AFTER_LOGIN;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private firebaseAuth: FirebaseAuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Siempre mostrar el formulario de login.
    // El usuario debe autenticarse cada vez que entra desde el menú.
    this.nextUrl = safeNext(this.route.snapshot.queryParamMap.get('next'));
  }

  /** Para la plantilla: a dónde volveremos, por si queremos avisar. */
  get destination(): string {
    return this.nextUrl;
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    try {
      const result = await this.firebaseAuth.signIn(email, password);
      
      if (result.success) {
        // Guardar token de autenticación
        localStorage.setItem('auth_token', 'firebase_authenticated');
        localStorage.setItem('user_name', email);
        
        // Volver a donde el usuario quería ir (por defecto, crear sala de
        // Scrum Poker y poner nombre).
        this.router.navigateByUrl(this.nextUrl);
      } else {
        this.errorMessage = result.error || 'Error al iniciar sesión';
      }
    } catch (error) {
      this.errorMessage = 'Error al conectar con el servidor';
    } finally {
      this.isLoading = false;
    }
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    return token !== null && token.length > 0;
  }
}
