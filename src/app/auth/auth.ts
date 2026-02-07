import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FirebaseAuthService } from '../firebase-auth.service';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';

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

  constructor(
    private fb: FormBuilder,
    private router: Router,
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
        
        // Redirigir a name-screen para crear sala y poner nombre
        this.router.navigate(['/name-screen']);
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
