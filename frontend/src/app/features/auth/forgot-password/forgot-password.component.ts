import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  inject,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-forgot-password',
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
        <div class="step-dots" role="tablist" aria-label="Password reset steps">
          <span
            class="dot"
            [class.active]="currentStep() >= 1"
            [class.current]="currentStep() === 1"
            aria-label="Step 1: Enter email"
          ></span>
          <span
            class="dot"
            [class.active]="currentStep() >= 2"
            [class.current]="currentStep() === 2"
            aria-label="Step 2: Enter 6-digit code"
          ></span>
          <span
            class="dot"
            [class.active]="currentStep() >= 3"
            [class.current]="currentStep() === 3"
            aria-label="Step 3: Create new password"
          ></span>
        </div>

        <!-- Multi-step Form -->
        <form [formGroup]="forgotForm" (ngSubmit)="onFormSubmit()">
          <!-- STEP 1: Email -->
          @if (currentStep() === 1) {
            <div class="step-pane">
              <div class="field-group">
                <label for="fpEmail" class="field-label">Account email</label>
                <input
                  id="fpEmail"
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
              >
                Send verification code
              </app-button>
            </div>
          }

          <!-- STEP 2: 6-digit OTP with 30s countdown -->
          @if (currentStep() === 2) {
            <div class="step-pane">
              <div class="field-group">
                <label class="field-label text-center">Enter the 6-digit code sent to your email</label>
                <div class="otp-row" role="group" aria-label="6-digit reset code">
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
                    <button type="button" class="link-btn" (click)="resendCode()">
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
                  (clicked)="verifyCode()"
                >
                  Verify code
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

          <!-- STEP 3: New Password + Confirm -->
          @if (currentStep() === 3) {
            <div class="step-pane">
              <div class="field-group">
                <label for="fpNewPassword" class="field-label">New Password</label>
                <input
                  id="fpNewPassword"
                  type="password"
                  formControlName="newPassword"
                  placeholder="At least 8 characters"
                  class="auth-input"
                  [class.invalid]="isInvalid('newPassword')"
                  autocomplete="new-password"
                />
                @if (isInvalid('newPassword')) {
                  <span class="error-msg">Password must be at least 8 characters</span>
                }
              </div>

              <div class="field-group">
                <label for="fpConfirmPassword" class="field-label">Confirm New Password</label>
                <input
                  id="fpConfirmPassword"
                  type="password"
                  formControlName="confirmPassword"
                  placeholder="Repeat new password"
                  class="auth-input"
                  [class.invalid]="isInvalid('confirmPassword') || (forgotForm.hasError('mismatch') && forgotForm.get('confirmPassword')?.touched)"
                  autocomplete="new-password"
                />
                @if (forgotForm.hasError('mismatch') && forgotForm.get('confirmPassword')?.touched) {
                  <span class="error-msg">Passwords do not match</span>
                }
              </div>

              <app-button
                type="submit"
                variant="primary"
                [fullWidth]="true"
                [loading]="isLoading()"
              >
                Reset password
              </app-button>
            </div>
          }
        </form>

        <p class="auth-foot">
          Remember your password?
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

    /* 6-digit OTP row */
    .otp-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin: 8px 0 10px;
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
      cursor: pointer;
      text-decoration: none;
      display: inline;

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
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ForgotPasswordComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly currentStep = signal<number>(1);
  readonly otpDigits = signal<string[]>(['', '', '', '', '', '']);
  readonly otpError = signal<string>('');
  readonly resetToken = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly resendCountdown = signal<number>(30);

  private countdownTimer: any = null;

  readonly stepTitles = ['Forgot password', 'Verify code', 'Reset password'];
  readonly stepSubtitles = [
    'Enter your email to receive a reset code',
    'Enter the 6-digit code we sent you',
    'Choose a strong new password',
  ];

  readonly forgotForm: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => {
        const pass = group.get('newPassword')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return pass === confirm ? null : { mismatch: true };
      },
    }
  );

  ngOnDestroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }

  isInvalid(controlName: string): boolean {
    const ctrl = this.forgotForm.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  goToStep(step: number): void {
    this.currentStep.set(step);
  }

  startCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    this.resendCountdown.set(30);
    this.countdownTimer = setInterval(() => {
      if (this.resendCountdown() > 0) {
        this.resendCountdown.update((c) => c - 1);
      } else {
        clearInterval(this.countdownTimer);
      }
    }, 1000);
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

  resendCode(): void {
    const email = this.forgotForm.get('email')!.value.trim();
    this.otpDigits.set(['', '', '', '', '', '']);
    this.otpError.set('');

    this.authService.requestForgotPasswordOtp(email).subscribe({
      next: () => {
        this.startCountdown();
        this.toast.info('New verification code sent');
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to resend code');
      },
    });
  }

  verifyCode(): void {
    const code = this.otpDigits().join('');
    if (code.length < 6) {
      this.otpError.set('Please enter all 6 digits');
      return;
    }

    const email = this.forgotForm.get('email')!.value.trim();
    this.isLoading.set(true);

    this.authService.verifyForgotPasswordOtp(email, code).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.resetToken.set(res.resetToken);
        this.otpError.set('');
        this.currentStep.set(3);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.otpError.set(err?.error?.error?.message || 'Invalid or expired verification code');
      },
    });
  }

  onFormSubmit(): void {
    if (this.currentStep() === 1) {
      const emailCtrl = this.forgotForm.get('email');
      if (emailCtrl?.invalid) {
        emailCtrl.markAsTouched();
        return;
      }

      const email = emailCtrl!.value.trim();
      this.isLoading.set(true);

      this.authService.requestForgotPasswordOtp(email).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.currentStep.set(2);
          this.startCountdown();
          this.toast.info('Verification code sent to your email');
          setTimeout(() => this.focusOtpBox(0), 50);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.error(err?.error?.error?.message || 'Failed to send verification code');
        },
      });
    } else if (this.currentStep() === 3) {
      if (this.forgotForm.invalid) {
        this.forgotForm.markAllAsTouched();
        return;
      }

      const token = this.resetToken();
      if (!token) {
        this.toast.error('Session expired. Please request a new code.');
        this.currentStep.set(1);
        return;
      }

      const newPassword = this.forgotForm.get('newPassword')!.value;
      this.isLoading.set(true);

      this.authService.resetPassword(token, newPassword).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.toast.success('Password reset successfully! Please log in.');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.error(err?.error?.error?.message || 'Failed to reset password');
        },
      });
    }
  }
}
