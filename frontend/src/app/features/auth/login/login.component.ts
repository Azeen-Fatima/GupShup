import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { AuthService } from '../../../shared/services/auth.service';
import { GoogleAuthService } from '../../../shared/services/google-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent, SvgIconComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card-body">
        <div class="halo-icon" aria-hidden="true">
          <app-svg-icon name="chat" [size]="34"></app-svg-icon>
        </div>

        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-sub">Log in to keep the gupshup going</p>

        @if (loginError()) {
          <div class="login-alert" role="alert">
            <app-svg-icon name="alert-circle" [size]="16" class="alert-icon"></app-svg-icon>
            <span>{{ loginError() }}</span>
          </div>
        }

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="field-group">
            <label for="loginIdentifier" class="field-label">Email or username</label>
            <input
              id="loginIdentifier"
              type="text"
              formControlName="identifier"
              placeholder="you@email.com or @azeen"
              class="auth-input"
              [class.invalid]="isInvalid('identifier')"
              autocomplete="username"
              (input)="clearError()"
            />
            @if (isInvalid('identifier')) {
              <span class="error-msg">Please enter your email or username</span>
            }
          </div>

          <div class="field-group">
            <div class="field-label-row">
              <label for="loginPassword" class="field-label">Password</label>
              <a routerLink="/forgot-password" class="forgot-link">Forgot password?</a>
            </div>
            <input
              id="loginPassword"
              type="password"
              formControlName="password"
              placeholder="••••••••"
              class="auth-input"
              [class.invalid]="isInvalid('password')"
              autocomplete="current-password"
              (input)="clearError()"
            />
            @if (isInvalid('password')) {
              <span class="error-msg">Password is required (min 6 characters)</span>
            }
          </div>

          <app-button
            type="submit"
            variant="primary"
            [fullWidth]="true"
            [loading]="isLoading()"
            [disabled]="isLoading()"
          >
            Log in
          </app-button>

          <div class="auth-divider">
            <span>or</span>
          </div>

          <div class="google-btn-wrapper">
            <button
              type="button"
              class="google-btn"
              (click)="continueWithGoogle()"
              aria-label="Continue with Google"
              [disabled]="isLoading()"
            >
              <app-svg-icon name="google" [size]="18"></app-svg-icon>
              <span>Continue with Google</span>
            </button>
            <div #googleBtnRef class="google-gsi-overlay"></div>
          </div>
        </form>

        <p class="auth-foot">
          New here?
          <a routerLink="/signup" class="brand-link">Create an account</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    .auth-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 28px 26px;
    }

    .auth-card-body {
      margin-block: auto;
      width: 100%;
    }

    .halo-icon {
      width: 76px;
      height: 76px;
      margin: 0 auto 12px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, var(--msgbtn-bg), rgba(232, 162, 61, 0.22));
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--amber-text);
      animation: bob 3s ease-in-out infinite;
    }

    @keyframes bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }

    .auth-title {
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      color: var(--amber-text);
      margin-bottom: 4px;
    }

    .auth-sub {
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 20px;
    }

    .login-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: rgba(200, 80, 60, 0.1);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 12.5px;
      font-weight: 700;
      margin-bottom: 16px;
      animation: fadeIn 0.2s ease;
    }

    .field-group {
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
    }

    .field-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      display: block;
    }

    .forgot-link {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--amber-text);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .auth-input {
      width: 100%;
      padding: 11px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      font-size: 13.5px;
      color: var(--ink);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &::placeholder {
        color: var(--muted);
        opacity: 0.65;
      }

      &:focus {
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.16);
      }

      &.invalid {
        border-color: var(--danger);
      }
    }

    .error-msg {
      font-size: 11.5px;
      color: var(--danger);
      margin-top: 4px;
      font-weight: 600;
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      color: var(--muted);
      font-size: 11.5px;

      &::before, &::after {
        content: '';
        flex: 1;
        height: 1px;
        background-color: var(--border);
      }
    }

    .google-btn {
      width: 100%;
      height: 44px;
      padding: 0 16px;
      border: 1.5px solid var(--border);
      border-radius: 999px;
      background: transparent;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: background-color 0.2s ease, border-color 0.2s ease;

      &:hover:not(:disabled) {
        background-color: var(--hover);
        border-color: var(--border);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .google-btn-wrapper {
      position: relative;
      width: 100%;
      height: 44px;
      border-radius: 999px;
      overflow: hidden;
    }

    .google-gsi-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 44px;
      min-height: 44px;
      opacity: 0.001;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      pointer-events: auto;
      cursor: pointer;

      ::ng-deep iframe {
        width: 100% !important;
        height: 44px !important;
        min-height: 44px !important;
        cursor: pointer !important;
      }
    }

    .auth-foot {
      text-align: center;
      font-size: 12.5px;
      color: var(--muted);
      margin-top: 22px;
    }

    .brand-link {
      color: var(--amber-text);
      font-weight: 800;
      margin-left: 4px;

      &:hover {
        text-decoration: underline;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly googleAuthService = inject(GoogleAuthService);

  @ViewChild('googleBtnRef') set googleBtnRef(ref: ElementRef<HTMLDivElement> | undefined) {
    this._googleBtnRef = ref;
    if (ref?.nativeElement) {
      this.renderGoogleButton(ref.nativeElement);
    }
  }
  private _googleBtnRef?: ElementRef<HTMLDivElement>;

  readonly isLoading = signal<boolean>(false);
  readonly loginError = signal<string>('');

  private googleSub?: Subscription;

  readonly loginForm: FormGroup = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.googleSub = this.googleAuthService.credential$.subscribe((credential) => {
      this.handleGoogleCredential(credential);
    });
  }

  ngAfterViewInit(): void {
    if (this._googleBtnRef?.nativeElement) {
      this.renderGoogleButton(this._googleBtnRef.nativeElement);
    }
  }

  private renderGoogleButton(el: HTMLElement): void {
    this.googleAuthService.initialize().then((success) => {
      if (success && el) {
        const explicitWidth = el.parentElement?.clientWidth || 368;
        this.googleAuthService.renderButton(el, explicitWidth);
      } else if (this.googleAuthService.scriptError()) {
        this.loginError.set(this.googleAuthService.scriptError()!);
      }
    });
  }

  ngOnDestroy(): void {
    this.googleSub?.unsubscribe();
  }

  isInvalid(controlName: string): boolean {
    const ctrl = this.loginForm.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  clearError(): void {
    if (this.loginError()) {
      this.loginError.set('');
    }
  }

  onSubmit(): void {
    if (this.isLoading()) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.value;
    this.isLoading.set(true);
    this.loginError.set('');

    this.authService.login(identifier, password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/chats']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loginError.set(
          err?.error?.error?.message || 'Invalid email/username or password. Please try again.'
        );
      },
    });
  }

  continueWithGoogle(): void {
    if (this.isLoading()) return;
    this.clearError();

    if (this.googleAuthService.scriptError()) {
      this.loginError.set(this.googleAuthService.scriptError()!);
      return;
    }
    if (this.googleAuthService.originError()) {
      this.loginError.set(this.googleAuthService.originError()!);
      return;
    }

    this.googleAuthService.initialize().then((loaded) => {
      if (!loaded) {
        const err =
          this.googleAuthService.scriptError() ||
          'Google sign-in could not be loaded. Please check your connection or ad-blocker.';
        this.loginError.set(err);
        return;
      }
      this.googleAuthService.prompt((notification) => {
        if (notification?.isNotDisplayed?.()) {
          const reason = notification.getNotDisplayedReason?.();
          if (reason === 'origin_not_allowed' || reason === 'unregistered_origin') {
            this.loginError.set(
              'This domain is not authorized for Google Sign-In (origin_not_allowed). Please check Google Cloud Console credentials.'
            );
          } else if (this.googleAuthService.originError()) {
            this.loginError.set(this.googleAuthService.originError()!);
          }
        }
      });
    });
  }

  private handleGoogleCredential(credential: string): void {
    this.isLoading.set(true);
    this.clearError();

    this.authService.googleAuth(credential).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.needsProfile) {
          this.router.navigate(['/signup'], {
            state: {
              fromGoogle: true,
              googleToken: res.googleToken,
              email: res.email,
              name: res.name,
              avatarUrl: res.avatarUrl,
            },
          });
        } else {
          this.router.navigate(['/chats']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loginError.set(
          err?.error?.error?.message || err?.error?.message || 'Google sign-in failed. Please try again.'
        );
      },
    });
  }
}
