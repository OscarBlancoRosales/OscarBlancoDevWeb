import { Component, output, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthApiService } from '../../api/auth-api.service';

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
    private authService: AuthApiService,
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
    try {
      await this.authService.entrar(this.email, this.password);
    } catch (fallo) {
      this.errorMsg = AuthApiService.mensajeDe(fallo);
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  onEnter(): void {
    this.enter.emit();
  }
}
