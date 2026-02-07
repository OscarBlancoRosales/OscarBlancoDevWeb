import { Injectable } from '@angular/core';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase.config';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor() {
    // Escuchar cambios de autenticación
    onAuthStateChanged(auth, (user) => {
      this.userSubject.next(user);
    });
  }

  // Login con email y password
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
