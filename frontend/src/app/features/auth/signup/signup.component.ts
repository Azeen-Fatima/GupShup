import {
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
  AfterViewInit,
  inject,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { AuthService } from '../../../shared/services/auth.service';
import { UsersService } from '../../../shared/services/users.service';
import { ToastService } from '../../../shared/services/toast.service';
import { GoogleAuthService } from '../../../shared/services/google-auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent, SvgIconComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card-body">
        <div class="halo-icon" aria-hidden="true">
          <app-svg-icon name="chat" [size]="34"></app-svg-icon>
        </div>

        <h1 class="auth-title">{{ stepTitles[currentStep() - 1] }}</h1>
        <p class="auth-sub">{{ stepSubtitles[currentStep() - 1] }}</p>

        <!-- Step Indicator Dots -->
        <div class="step-dots" role="tablist" aria-label="Signup steps">
          <span
            class="dot"
            [class.active]="currentStep() >= 1"
            [class.current]="currentStep() === 1"
            aria-label="Step 1: Email"
          ></span>
          <span
            class="dot"
            [class.active]="currentStep() >= 2"
            [class.current]="currentStep() === 2"
            aria-label="Step 2: Verification code"
          ></span>
          <span
            class="dot"
            [class.active]="currentStep() >= 3"
            [class.current]="currentStep() === 3"
            aria-label="Step 3: Profile details"
          ></span>
        </div>

        <!-- Multi-step Form -->
        <form [formGroup]="signupForm" (ngSubmit)="onStepSubmit()">
          <!-- STEP 1: Email -->
          @if (currentStep() === 1) {
            <div class="step-pane">
              <div class="field-group">
                <label for="emailInput" class="field-label">Email address</label>
                <input
                  id="emailInput"
                  type="email"
                  formControlName="email"
                  placeholder="you@email.com"
                  class="auth-input"
                  [class.invalid]="isInvalid('email')"
                  autocomplete="email"
                />
                @if (isInvalid('email')) {
                  <span class="error-msg">Please enter a valid email address</span>
                }
              </div>

              <app-button
                type="submit"
                variant="primary"
                [fullWidth]="true"
                [loading]="isLoading()"
                [disabled]="isLoading()"
              >
                Continue
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
                <div #googleBtnRef class="google-gsi-overlay" aria-hidden="true"></div>
              </div>
            </div>
          }

          <!-- STEP 2: 6-digit OTP -->
          @if (currentStep() === 2) {
            <div class="step-pane">
              <div class="field-group">
                <label class="field-label text-center">Enter the 6-digit code</label>
                <p class="field-hint-center">Hint: Demo code is <strong>123456</strong></p>
                <div class="otp-row" role="group" aria-label="6-digit verification code">
                  @for (i of [0, 1, 2, 3, 4, 5]; track i) {
                    <input
                      #otpInput
                      type="text"
                      inputmode="numeric"
                      maxlength="1"
                      [value]="otpDigits()[i] || ''"
                      (input)="onOtpInput($event, i)"
                      (keydown)="onOtpKeydown($event, i)"
                      (paste)="onOtpPaste($event)"
                      class="otp-box"
                      [attr.aria-label]="'Digit ' + (i + 1)"
                    />
                  }
                </div>
                @if (otpError()) {
                  <span class="error-msg text-center">{{ otpError() }}</span>
                }

                <div class="countdown-row text-center">
                  @if (resendCountdown() > 0) {
                    <span class="countdown-text">Resend code in {{ resendCountdown() }}s</span>
                  } @else {
                    <button
                      type="button"
                      class="link-btn"
                      (click)="resendCode()"
                      [disabled]="isLoading()"
                    >
                      Resend code
                    </button>
                  }
                </div>
              </div>

              <div class="btn-stack">
                <app-button
                  type="button"
                  variant="primary"
                  [fullWidth]="true"
                  [loading]="isLoading()"
                  [disabled]="isLoading()"
                  (clicked)="verifyOtp()"
                >
                  Verify &amp; continue
                </app-button>
                <app-button
                  type="button"
                  variant="ghost"
                  [fullWidth]="true"
                  (clicked)="goToStep(1)"
                >
                  Back
                </app-button>
              </div>
            </div>
          }

          <!-- STEP 3: Profile Setup -->
          @if (currentStep() === 3) {
            <div class="step-pane">
              <!-- Optional Photo Picker -->
              <div class="avatar-picker-wrap">
                <input
                  #fileInput
                  type="file"
                  accept="image/*"
                  (change)="onFileSelected($event)"
                  style="display: none"
                />
                <button
                  type="button"
                  class="avatar-picker"
                  (click)="fileInput.click()"
                  [attr.aria-label]="photoPreview() ? 'Change profile picture' : 'Upload profile picture'"
                >
                  @if (photoPreview()) {
                    <img [src]="photoPreview()!" alt="Profile preview" class="preview-img" />
                  } @else {
                    <app-svg-icon name="plus" [size]="22"></app-svg-icon>
                  }
                </button>
                <span class="picker-label">Optional profile photo</span>
              </div>

              <div class="field-group">
                <label for="nameInput" class="field-label">Full Name</label>
                <input
                  id="nameInput"
                  type="text"
                  formControlName="name"
                  placeholder="e.g. Azeen Fatima"
                  class="auth-input"
                  [class.invalid]="isInvalid('name')"
                  autocomplete="name"
                />
                @if (isInvalid('name')) {
                  <span class="error-msg">Name is required (at least 2 characters)</span>
                }
              </div>

              <div class="field-group">
                <label for="usernameInput" class="field-label">Username</label>
                <input
                  id="usernameInput"
                  type="text"
                  formControlName="username"
                  placeholder="@azeen"
                  class="auth-input"
                  [class.invalid]="usernameLocalError() || isInvalid('username') || usernameStatus() === 'taken'"
                  autocomplete="username"
                  (input)="onUsernameChange()"
                />
                @if (usernameLocalError()) {
                  <span class="error-msg">{{ usernameLocalError() }}</span>
                } @else if (usernameStatus() === 'checking') {
                  <span class="status-msg info">Checking availability…</span>
                } @else if (usernameStatus() === 'taken') {
                  <span class="error-msg">Username already taken</span>
                } @else if (usernameStatus() === 'available') {
                  <span class="status-msg success">✓ Username is available</span>
                } @else if (isInvalid('username')) {
                  <span class="error-msg">Username is required (3-20 characters, letters, numbers, underscore)</span>
                }
              </div>

              @if (!isGoogleSignup()) {
                <div class="field-group">
                  <label for="passwordInput" class="field-label">Password</label>
                  <input
                    id="passwordInput"
                    type="password"
                    formControlName="password"
                    placeholder="At least 8 characters"
                    class="auth-input"
                    [class.invalid]="isInvalid('password')"
                    autocomplete="new-password"
                  />
                  @if (isInvalid('password')) {
                    <span class="error-msg">Password must be at least 8 characters</span>
                  }
                </div>
              }

              <app-button
                type="submit"
                variant="primary"
                [fullWidth]="true"
                [loading]="isLoading()"
                [disabled]="isLoading()"
              >
                Create account
              </app-button>
            </div>
          }
        </form>

        <p class="auth-foot">
          Already have an account?
          <a routerLink="/login" class="brand-link">Log in</a>
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

    .step-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 22px;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: var(--border);
      transition: all 0.3s ease;

      &.active {
        background-color: var(--amber);
      }

      &.current {
        width: 22px;
        border-radius: 5px;
      }
    }

    .step-pane {
      display: flex;
      flex-direction: column;
      animation: fadeIn 0.25s ease;
    }

    .field-group {
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 6px;
      display: block;
    }

    .field-hint-center {
      font-size: 11.5px;
      color: var(--muted);
      text-align: center;
      margin-bottom: 8px;
    }

    .text-center {
      text-align: center;
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

    .status-msg {
      font-size: 11.5px;
      margin-top: 4px;
      font-weight: 700;

      &.success {
        color: var(--teal);
      }
      &.info {
        color: var(--muted);
      }
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
      padding: 11px 16px;
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
      border-radius: 999px;
      overflow: hidden;
    }

    .google-gsi-overlay {
      position: absolute;
      inset: 0;
      opacity: 0.0001;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      pointer-events: auto;

      ::ng-deep iframe {
        width: 100% !important;
        height: 100% !important;
        transform: scale(1.6);
        cursor: pointer !important;
      }
    }

    /* 6-digit OTP row */
    .otp-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin: 4px 0 8px;
    }

    .otp-box {
      width: 100%;
      aspect-ratio: 1 / 1.15;
      padding: 0;
      text-align: center;
      font-size: 20px;
      font-weight: 800;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      color: var(--ink);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &:focus {
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.16);
      }
    }

    .countdown-row {
      margin: 6px 0 12px;
    }

    .countdown-text {
      font-size: 12px;
      color: var(--muted);
    }

    .link-btn {
      color: var(--amber-text);
      font-weight: 800;
      font-size: 12px;
      text-decoration: none;
      display: inline;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    .btn-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }

    /* Avatar picker in Step 3 */
    .avatar-picker-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 16px;
    }

    .avatar-picker {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background-color: var(--input);
      border: 2px dashed var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      cursor: pointer;
      overflow: hidden;
      transition: border-color 0.2s ease, color 0.2s ease;

      &:hover {
        border-color: var(--amber);
        color: var(--amber-text);
      }

      .preview-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .picker-label {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 6px;
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
export class SignupComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly googleAuthService = inject(GoogleAuthService);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('googleBtnRef') googleBtnRef?: ElementRef<HTMLDivElement>;

  readonly currentStep = signal<number>(1);
  readonly isGoogleSignup = signal<boolean>(false);
  readonly googleToken = signal<string | null>(null);
  readonly otpDigits = signal<string[]>(['', '', '', '', '', '']);
  readonly otpError = signal<string>('');
  readonly photoPreview = signal<string | null>(null);
  readonly avatarFile = signal<File | null>(null);
  readonly signupToken = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly resendCountdown = signal<number>(30);
  readonly usernameStatus = signal<'idle' | 'checking' | 'available' | 'taken'>('idle');
  readonly usernameLocalError = signal<string>('');

  private countdownTimer: any = null;
  private readonly usernameSubject$ = new Subject<string>();
  private usernameSub?: Subscription;

  readonly stepTitles = ['Join Gupshup', 'Check your email', 'Set up your profile'];
  readonly stepSubtitles = [
    'A cosy little place to chat',
    'We sent a 6-digit code to your email',
    'Almost there 🌷',
  ];

  readonly signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20), Validators.pattern(/^[a-z0-9_]+$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.usernameSub = this.usernameSubject$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((clean) => {
          this.usernameStatus.set('checking');
          return this.authService.checkUsernameAvailability(clean).pipe(
            catchError(() => of({ available: false, username: clean }))
          );
        })
      )
      .subscribe((res) => {
        const raw = this.signupForm.get('username')?.value || '';
        const currentClean = raw.replace(/^@/, '').toLowerCase();
        if (currentClean === res.username) {
          this.usernameStatus.set(res.available ? 'available' : 'taken');
        }
      });

    const navState = history.state;
    if (navState?.fromGoogle && navState?.googleToken) {
      this.setupGoogleProfileStep({
        googleToken: navState.googleToken,
        email: navState.email,
        name: navState.name,
        avatarUrl: navState.avatarUrl,
      });
    }
  }

  ngAfterViewInit(): void {
    this.googleAuthService
      .initialize((credential) => {
        this.handleGoogleCredential(credential);
      })
      .then((success) => {
        if (success && this.googleBtnRef?.nativeElement) {
          this.googleAuthService.renderButton(this.googleBtnRef.nativeElement);
        }
      });
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.usernameSub) this.usernameSub.unsubscribe();
  }

  isInvalid(controlName: string): boolean {
    const ctrl = this.signupForm.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  startCountdown(seconds = 30): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.resendCountdown.set(seconds);
    this.countdownTimer = setInterval(() => {
      if (this.resendCountdown() > 0) {
        this.resendCountdown.update((c) => c - 1);
      } else {
        clearInterval(this.countdownTimer);
      }
    }, 1000);
  }

  nextStep(): void {
    if (this.isLoading()) return;

    if (this.currentStep() === 1) {
      const emailCtrl = this.signupForm.get('email');
      if (emailCtrl?.invalid) {
        emailCtrl.markAsTouched();
        return;
      }

      const email = emailCtrl!.value.trim();
      this.isLoading.set(true);

      this.authService.requestSignupOtp(email).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.currentStep.set(2);
          this.startCountdown(res?.cooldownSeconds || 30);
          this.toast.info('Verification code sent to your email');
          setTimeout(() => this.focusOtpBox(0), 50);
        },
        error: (err) => {
          this.isLoading.set(false);
          const retryAfter = err?.error?.retryAfterSeconds || err?.error?.error?.retryAfterSeconds;
          if (retryAfter) {
            this.startCountdown(retryAfter);
          }
          this.toast.error(err?.error?.error?.message || err?.error?.message || 'Failed to send verification code. Try again.');
        },
      });
    }
  }

  goToStep(step: number): void {
    this.currentStep.set(step);
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    const digits = [...this.otpDigits()];
    digits[index] = val;
    this.otpDigits.set(digits);
    this.otpError.set('');

    if (val && index < 5) {
      this.focusOtpBox(index + 1);
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const digits = [...this.otpDigits()];
      if (!digits[index] && index > 0) {
        this.focusOtpBox(index - 1);
      } else {
        digits[index] = '';
        this.otpDigits.set(digits);
      }
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasteData = event.clipboardData?.getData('text') || '';
    const cleanNumbers = pasteData.replace(/\D/g, '').slice(0, 6);
    if (!cleanNumbers) return;

    const digits = [...this.otpDigits()];
    for (let i = 0; i < 6; i++) {
      digits[i] = cleanNumbers[i] || '';
    }
    this.otpDigits.set(digits);
    const nextIdx = Math.min(cleanNumbers.length, 5);
    this.focusOtpBox(nextIdx);
  }

  private focusOtpBox(index: number): void {
    const inputsArray = this.otpInputs?.toArray();
    if (inputsArray && inputsArray[index]) {
      inputsArray[index].nativeElement.focus();
    }
  }

  verifyOtp(): void {
    if (this.isLoading()) return;

    const code = this.otpDigits().join('');
    if (code.length < 6) {
      this.otpError.set('Please enter all 6 digits');
      return;
    }

    const email = this.signupForm.get('email')!.value.trim();
    this.isLoading.set(true);

    this.authService.verifySignupOtp(email, code).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.signupToken.set(res.signupToken);
        this.otpError.set('');
        this.currentStep.set(3);
        // A2: Start empty
        this.signupForm.get('username')?.setValue('', { emitEvent: false });
        this.usernameStatus.set('idle');
        this.usernameLocalError.set('');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.otpError.set(err?.error?.error?.message || err?.error?.message || 'Invalid or expired verification code');
      },
    });
  }

  resendCode(): void {
    if (this.isLoading() || this.resendCountdown() > 0) return;

    const email = this.signupForm.get('email')!.value.trim();
    this.otpDigits.set(['', '', '', '', '', '']);
    this.otpError.set('');
    this.isLoading.set(true);

    this.authService.requestSignupOtp(email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.startCountdown(res?.cooldownSeconds || 30);
        this.toast.info('New verification code sent');
      },
      error: (err) => {
        this.isLoading.set(false);
        const retryAfter = err?.error?.retryAfterSeconds || err?.error?.error?.retryAfterSeconds;
        if (retryAfter) {
          this.startCountdown(retryAfter);
        }
        this.toast.error(err?.error?.error?.message || err?.error?.message || 'Failed to resend code');
      },
    });
  }

  onUsernameChange(): void {
    // A1: On every keystroke, reset the old availability status immediately
    this.usernameStatus.set('idle');
    this.usernameLocalError.set('');

    const ctrl = this.signupForm.get('username');
    const raw = ctrl?.value || '';
    const clean = raw.replace(/^@/, '').toLowerCase();

    if (raw !== clean) {
      ctrl?.setValue(clean, { emitEvent: false });
    }

    if (!clean) {
      return;
    }

    // A1: Validate locally first: only a-z, 0-9, underscore
    if (!/^[a-z0-9_]+$/.test(clean)) {
      this.usernameLocalError.set('Only letters, numbers and underscore allowed');
      return;
    }

    // A1: 3-20 chars
    if (clean.length < 3 || clean.length > 20) {
      this.usernameLocalError.set('Username must be between 3 and 20 characters');
      return;
    }

    // Valid locally! Call debounced API
    this.usernameSubject$.next(clean);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.avatarFile.set(file);
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  continueWithGoogle(): void {
    if (this.isLoading()) return;
    if (this.googleAuthService.isLoaded()) {
      this.googleAuthService.prompt();
    } else {
      this.googleAuthService.loadScript().then((loaded) => {
        if (loaded) {
          this.googleAuthService.initialize((credential) => this.handleGoogleCredential(credential));
          this.googleAuthService.prompt();
        } else {
          this.toast.error('Google sign-in could not be loaded. Please check your connection or ad-blocker.');
        }
      });
    }
  }

  private handleGoogleCredential(credential: string): void {
    this.isLoading.set(true);

    this.authService.googleAuth(credential).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.needsProfile) {
          this.toast.success('Welcome back!');
          this.router.navigate(['/chats']);
        } else {
          this.setupGoogleProfileStep({
            googleToken: res.googleToken,
            email: res.email,
            name: res.name,
            avatarUrl: res.avatarUrl,
          });
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error(
          err?.error?.error?.message || err?.error?.message || 'Google sign-in failed. Please try again.'
        );
      },
    });
  }

  private setupGoogleProfileStep(data: {
    googleToken: string;
    email?: string;
    name?: string;
    avatarUrl?: string | null;
  }): void {
    this.isGoogleSignup.set(true);
    this.googleToken.set(data.googleToken);
    this.currentStep.set(3);

    if (data.name) {
      this.signupForm.get('name')?.setValue(data.name);
    }
    if (data.email) {
      this.signupForm.get('email')?.setValue(data.email);
    }
    if (data.avatarUrl) {
      this.photoPreview.set(data.avatarUrl);
    }

    const passCtrl = this.signupForm.get('password');
    passCtrl?.clearValidators();
    passCtrl?.updateValueAndValidity();

    this.signupForm.get('username')?.setValue('', { emitEvent: false });
    this.usernameStatus.set('idle');
    this.usernameLocalError.set('');
  }

  onStepSubmit(): void {
    if (this.currentStep() === 1) {
      this.nextStep();
    } else if (this.currentStep() === 3) {
      if (this.isLoading()) return;

      const nameCtrl = this.signupForm.get('name');
      const userCtrl = this.signupForm.get('username');
      const passCtrl = this.signupForm.get('password');

      // Re-validate locally
      this.onUsernameChange();

      // A3: If invalid, mark all fields touched, show errors and focus first invalid field
      if (
        this.signupForm.invalid ||
        this.usernameLocalError() ||
        this.usernameStatus() === 'taken' ||
        this.usernameStatus() === 'checking'
      ) {
        this.signupForm.markAllAsTouched();

        if (nameCtrl?.invalid) {
          document.getElementById('nameInput')?.focus();
        } else if (userCtrl?.invalid || this.usernameLocalError() || this.usernameStatus() === 'taken') {
          document.getElementById('usernameInput')?.focus();
        } else if (passCtrl?.invalid) {
          document.getElementById('passwordInput')?.focus();
        }
        return;
      }

      const rawUsername = userCtrl!.value.trim();
      const cleanUsername = rawUsername.replace(/^@/, '').toLowerCase();

      if (this.isGoogleSignup()) {
        const gToken = this.googleToken();
        if (!gToken) {
          this.toast.error('Google session expired. Please sign in again.');
          this.currentStep.set(1);
          return;
        }

        this.isLoading.set(true);
        this.authService
          .completeGoogleProfile({
            googleToken: gToken,
            name: nameCtrl!.value.trim(),
            username: cleanUsername,
            avatarUrl: this.photoPreview(),
          })
          .subscribe({
            next: () => {
              const avatar = this.avatarFile();
              if (avatar) {
                this.usersService.uploadAvatar(avatar).subscribe({
                  next: () => {
                    this.isLoading.set(false);
                    this.toast.success('Account created successfully!');
                    this.router.navigate(['/chats']);
                  },
                  error: () => {
                    this.isLoading.set(false);
                    this.toast.success('Account created!');
                    this.router.navigate(['/chats']);
                  },
                });
              } else {
                this.isLoading.set(false);
                this.toast.success('Account created successfully!');
                this.router.navigate(['/chats']);
              }
            },
            error: (err) => {
              this.isLoading.set(false);
              const status = err.status;
              const msg = err?.error?.error?.message || err?.error?.message || '';
              const code = err?.error?.error?.code || '';

              if (status === 409) {
                if (code === 'USERNAME_ALREADY_EXISTS' || code === 'USERNAME_TAKEN' || msg.toLowerCase().includes('username')) {
                  this.usernameStatus.set('taken');
                  document.getElementById('usernameInput')?.focus();
                  this.toast.error('Username already taken. Please choose another.');
                } else {
                  this.toast.error('An account with this email already exists.');
                }
              } else if (status === 400) {
                this.toast.error(msg || 'Invalid registration details. Please check the fields.');
              } else if (status >= 500) {
                this.toast.error('Server error occurred. Please try again later.');
              } else {
                this.toast.error(msg || 'Failed to complete registration');
              }
            },
          });
        return;
      }

      const token = this.signupToken();

      if (!token) {
        this.toast.error('Session expired. Please verify your email again.');
        this.currentStep.set(1);
        return;
      }

      this.isLoading.set(true);

      this.authService
        .completeSignup({
          signupToken: token,
          name: nameCtrl!.value.trim(),
          username: cleanUsername,
          password: passCtrl!.value,
        })
        .subscribe({
          next: () => {
            const avatar = this.avatarFile();
            if (avatar) {
              this.usersService.uploadAvatar(avatar).subscribe({
                next: () => {
                  this.isLoading.set(false);
                  this.toast.success('Account created successfully!');
                  this.router.navigate(['/chats']);
                },
                error: () => {
                  this.isLoading.set(false);
                  this.toast.success('Account created!');
                  this.router.navigate(['/chats']);
                },
              });
            } else {
              this.isLoading.set(false);
              this.toast.success('Account created successfully!');
              this.router.navigate(['/chats']);
            }
          },
          error: (err) => {
            this.isLoading.set(false);
            const status = err.status;
            const msg = err?.error?.error?.message || err?.error?.message || '';
            const code = err?.error?.error?.code || '';

            if (status === 409) {
              if (code === 'USERNAME_TAKEN' || msg.toLowerCase().includes('username')) {
                this.usernameStatus.set('taken');
                document.getElementById('usernameInput')?.focus();
                this.toast.error('Username already taken. Please choose another.');
              } else {
                this.toast.error('An account with this email already exists.');
              }
            } else if (status === 400) {
              this.toast.error(msg || 'Invalid registration details. Please check the fields.');
            } else if (status >= 500) {
              this.toast.error('Server error occurred. Please try again later.');
            } else {
              this.toast.error(msg || 'Failed to complete registration');
            }
          },
        });
    }
  }
}
