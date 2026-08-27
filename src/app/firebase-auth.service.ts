import { Injectable } from '@angular/core';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase.config';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  private settledSubject = new ReplaySubject<User | null>(1);

  /**
   * El usuario UNA VEZ Firebase ha terminado de restaurar la sesión guardada.
   *
   * `user$` arranca valiendo null y sigue valiendo null durante el instante en
   * que Firebase lee la sesión del navegador, así que quien se suscriba nada
   * más cargar la página recibe un null que NO significa "no hay sesión", sino
   * "todavía no lo sé". Para encender un botón da igual (aparece un pestañeo
   * más tarde), pero para EXPULSAR a alguien es fatal: echaría a la calle a un
   * usuario con sesión válida que solo estaba recargando.
   *
   * Este observable no emite nada hasta que Firebase responde. Úsalo siempre
   * que la decisión sea irreversible para el usuario (redirigir, denegar).
   */
  public settledUser$ = this.settledSubject.asObservable();

  constructor() {
    // Escuchar cambios de autenticación
    onAuthStateChanged(auth, (user) => {
      this.userSubject.next(user);
      this.settledSubject.next(user);
    });
  }

  // Login con email y password
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuario no encontrado';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Intenta más tarde';
          break;
        default:
          errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Logout
  async signOut(): Promise<void> {
    await signOut(auth);
  }

  // Verificar si está autenticado
  get currentUser(): User | null {
    return auth.currentUser;
  }

  // Observable del estado de autenticación
  get isAuthenticated$(): Observable<boolean> {
    return this.userSubject.asObservable().pipe(
      map((user: User | null) => !!user)
    );
  }
}
