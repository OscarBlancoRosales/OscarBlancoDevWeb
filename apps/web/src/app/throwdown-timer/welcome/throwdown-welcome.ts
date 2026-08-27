import { Component, output, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FirebaseAuthService } from '../../firebase-auth.service';

@Component({
  selector: 'app-throwdown-welcome',
  imports: [FormsModule],
  templateUrl: './throwdown-welcome.html',
  styleUrl: './throwdown-welcome.css',
})
export class ThrowdownWelcome implements OnInit, OnDestroy {
  readonly enter = output<void>();

  isAuthenticated = false;
  email    = '';
  password = '';
  isLoading = false;
  errorMsg  = '';

  private authSub: Subscription | null = null;

  constructor(
    private authService: FirebaseAuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.user$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  async onLogin(): Promise<void> {
    if (!this.email || !this.password || this.isLoading) { return; }
    this.isLoading = true;
    this.errorMsg  = '';
    this.cdr.detectChanges();
    const result = await this.authService.signIn(this.email, this.password);
    this.isLoading = false;
    if (!result.success) {
      this.errorMsg = result.error ?? 'Error al iniciar sesión';
    }
    this.cdr.detectChanges();
  }

  onEnter(): void {
    this.enter.emit();
  }
}
