import { Component, ElementRef, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChatService } from '../../../shared/services/chat.service';
import { AppTheme, ThemeService } from '../../../shared/services/theme.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AvatarComponent,
    ButtonComponent,
    SvgIconComponent,
    ModalComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="settings-screen">
      <!-- Topbar -->
      <header class="settings-header">
        <a routerLink="/chats" class="back-btn" aria-label="Back to chats">
          <app-svg-icon name="back" [size]="20"></app-svg-icon>
        </a>
        <h1 class="header-title">Settings</h1>
      </header>

      <!-- Scrollable Settings Body -->
      <div class="settings-body">
        <!-- Profile Header & Photo Management -->
        <div class="profile-section">
          <input
            #avatarUpload
            type="file"
            accept="image/*"
            style="display: none"
            (change)="onAvatarSelected($event)"
          />
          <app-avatar
            [name]="currentUser().name"
            [initials]="currentUser().initials"
            [photoUrl]="photoPreview() || currentUser().photoUrl"
            [size]="'xl'"
          ></app-avatar>

          <div class="photo-actions">
            <button
              type="button"
              class="photo-action-btn"
              (click)="avatarUpload.click()"
              aria-label="Change profile picture"
            >
              Change profile picture
            </button>
            @if (photoPreview() || currentUser().photoUrl) {
              <button
                type="button"
                class="photo-action-btn danger"
                (click)="removePhoto()"
                aria-label="Remove profile picture"
              >
                Remove photo
              </button>
            }
          </div>
        </div>

        <!-- Profile Reactive Form -->
        <form [formGroup]="profileForm" (ngSubmit)="onSaveClicked()">
          <div class="field-item">
            <label for="profName" class="field-label">Name</label>
            <input
              id="profName"
              type="text"
              formControlName="name"
              class="form-input"
              [class.invalid]="isInvalid('name')"
            />
            @if (isInvalid('name')) {
              <span class="field-error">Name is required (at least 2 characters)</span>
            }
          </div>

          <div class="field-item">
            <label for="profUsername" class="field-label">Username</label>
            <input
              id="profUsername"
              type="text"
              formControlName="username"
              class="form-input"
              [class.invalid]="isInvalid('username') || isUsernameTaken()"
              (input)="checkUsername()"
            />
            @if (isUsernameTaken()) {
              <span class="field-error">Username already taken</span>
            } @else if (isInvalid('username')) {
              <span class="field-error">Username is required (min 3 alphanumeric characters)</span>
            }
          </div>

          <div class="field-item">
            <label for="profEmail" class="field-label">Email</label>
            <input
              id="profEmail"
              type="email"
              formControlName="email"
              class="form-input"
              [class.invalid]="isInvalid('email')"
            />
            <p class="field-hint">Changing email will ask for a new verification code</p>
            @if (isInvalid('email')) {
              <span class="field-error">Please enter a valid email</span>
            }
          </div>

          <!-- Save / Discard Actions -->
          <div class="form-actions-row">
            <app-button
              type="button"
              variant="ghost"
              [disabled]="isSaveDisabled()"
              (clicked)="discardChanges()"
            >
              Discard
            </app-button>
            <app-button
              type="submit"
              variant="primary"
              [disabled]="isSaveDisabled()"
              [loading]="isSaving()"
            >
              Save changes
            </app-button>
          </div>

          <div style="margin-top: 14px;">
            <app-button
              type="button"
              variant="ghost"
              [fullWidth]="true"
              (clicked)="openPasswordModal()"
            >
              Change password
            </app-button>
          </div>
        </form>

        <!-- Requests You Declined Accordion (Instant apply) -->
        <div class="section-title">Requests you declined</div>
        <p class="section-hint">Stays here even if you delete the chat — they can still message you again</p>

        <div
          class="accordion-toggle"
          (click)="declinedOpen.set(!declinedOpen())"
          role="button"
          tabindex="0"
          [attr.aria-expanded]="declinedOpen()"
          (keydown.enter)="declinedOpen.set(!declinedOpen())"
        >
          <span class="accordion-label">
            Declined requests ({{ declinedCount() }})
          </span>
          <span class="chev-icon" [class.open]="declinedOpen()">
            <app-svg-icon name="chev" [size]="18"></app-svg-icon>
          </span>
        </div>

        <div class="accordion-content" [class.open]="declinedOpen()">
          @if (declinedRequests().length === 0) {
            <app-empty-state
              type="all-clear"
              title="All clear ✨"
              subtitle="You have no declined chat requests."
            ></app-empty-state>
          } @else {
            @for (req of declinedRequests(); track req.id) {
              <div class="sub-row">
                <app-avatar
                  [name]="req.name"
                  [initials]="req.initials"
                  [size]="'sm'"
                ></app-avatar>
                <div class="sub-row-name">{{ req.name }}</div>
                <button
                  type="button"
                  class="teal-pill-btn"
                  (click)="acceptRequest(req.id, req.name)"
                  [attr.aria-label]="'Accept ' + req.name"
                >
                  Accept
                </button>
              </div>
            }
          }
        </div>

        <!-- Appearance (Theme Switcher applies instantly) -->
        <div class="section-title">Appearance</div>
        <div class="theme-row" role="radiogroup" aria-label="Select appearance theme">
          <button
            type="button"
            class="theme-chip"
            [class.active]="currentTheme() === 'default'"
            (click)="selectTheme('default')"
            role="radio"
            [attr.aria-checked]="currentTheme() === 'default'"
          >
            Default
          </button>
          <button
            type="button"
            class="theme-chip"
            [class.active]="currentTheme() === 'white'"
            (click)="selectTheme('white')"
            role="radio"
            [attr.aria-checked]="currentTheme() === 'white'"
          >
            White
          </button>
          <button
            type="button"
            class="theme-chip"
            [class.active]="currentTheme() === 'black'"
            (click)="selectTheme('black')"
            role="radio"
            [attr.aria-checked]="currentTheme() === 'black'"
          >
            Black
          </button>
        </div>

        <!-- Privacy (Blocked Users applies instantly) -->
        <div class="section-title">Privacy</div>
        <p class="section-hint">Stays here even if you delete the chat</p>

        <div
          class="accordion-toggle"
          (click)="blockedOpen.set(!blockedOpen())"
          role="button"
          tabindex="0"
          [attr.aria-expanded]="blockedOpen()"
          (keydown.enter)="blockedOpen.set(!blockedOpen())"
        >
          <span class="accordion-label">
            Blocked users ({{ blockedCount() }})
          </span>
          <span class="chev-icon" [class.open]="blockedOpen()">
            <app-svg-icon name="chev" [size]="18"></app-svg-icon>
          </span>
        </div>

        <div class="accordion-content" [class.open]="blockedOpen()">
          @if (blockedUsers().length === 0) {
            <app-empty-state
              type="all-clear"
              title="All clear ✨"
              subtitle="You haven't blocked any users."
            ></app-empty-state>
          } @else {
            @for (user of blockedUsers(); track user.id) {
              <div class="sub-row">
                <app-avatar
                  [name]="user.name"
                  [initials]="user.initials"
                  [size]="'sm'"
                ></app-avatar>
                <div class="sub-row-name">{{ user.name }}</div>
                <button
                  type="button"
                  class="teal-pill-btn"
                  (click)="unblockUser(user.name)"
                  [attr.aria-label]="'Unblock ' + user.name"
                >
                  Unblock
                </button>
              </div>
            }
          }
        </div>

        <!-- Logout Button -->
        <div class="logout-wrap">
          <app-button
            type="button"
            variant="danger"
            [fullWidth]="true"
            (clicked)="openLogoutModal()"
          >
            Log out
          </app-button>
        </div>
      </div>

      <!-- Email Verification Modal (When email is modified) -->
      <app-modal
        [isOpen]="emailModalOpen()"
        title="Verify New Email"
        confirmText="Verify and save"
        (confirm)="submitEmailVerification()"
        (cancel)="emailModalOpen.set(false)"
      >
        <p style="font-size: 13px; color: var(--muted); margin-bottom: 12px;">
          We sent a 6-digit verification code to
          <strong>{{ profileForm.get('email')?.value }}</strong>.
        </p>
        <div class="otp-modal-row" role="group" aria-label="Verification code">
          @for (i of [0, 1, 2, 3, 4, 5]; track i) {
            <input
              #emailOtpInput
              type="text"
              inputmode="numeric"
              maxlength="1"
              [value]="emailOtpDigits()[i] || ''"
              (input)="onEmailOtpInput($event, i)"
              (keydown)="onEmailOtpKeydown($event, i)"
              class="otp-box-sm"
              [attr.aria-label]="'Digit ' + (i + 1)"
            />
          }
        </div>
        @if (emailOtpError()) {
          <p class="field-error" style="text-align: center; margin-top: 6px;">{{ emailOtpError() }}</p>
        }
        <p style="text-align: center; margin-top: 10px; font-size: 12px;">
          Didn't get it?
          <button type="button" class="link-btn" (click)="resendEmailCode()">
            Resend code
          </button>
        </p>
      </app-modal>

      <!-- Password Change Dialog -->
      <app-modal
        [isOpen]="passwordModalOpen()"
        title="Change Password"
        confirmText="Update password"
        (confirm)="submitPasswordChange()"
        (cancel)="closePasswordModal()"
      >
        <form [formGroup]="passwordForm" (ngSubmit)="submitPasswordChange()">
          <div class="field-item">
            <label for="currPass" class="field-label">Current password</label>
            <input
              id="currPass"
              type="password"
              formControlName="currentPassword"
              class="form-input"
              placeholder="••••••••"
            />
          </div>
          <div class="field-item">
            <label for="newPass" class="field-label">New password (min 8)</label>
            <input
              id="newPass"
              type="password"
              formControlName="newPassword"
              class="form-input"
              placeholder="••••••••"
            />
            @if (passwordForm.get('newPassword')?.touched && passwordForm.get('newPassword')?.invalid) {
              <span class="field-error">Password must be at least 8 characters</span>
            }
          </div>
          <div class="field-item">
            <label for="confPass" class="field-label">Confirm new password</label>
            <input
              id="confPass"
              type="password"
              formControlName="confirmPassword"
              class="form-input"
              placeholder="••••••••"
            />
            @if (passwordForm.hasError('mismatch') && passwordForm.get('confirmPassword')?.touched) {
              <span class="field-error">Passwords do not match</span>
            }
          </div>
        </form>
      </app-modal>

      <!-- Logout Confirmation Dialog -->
      <app-modal
        [isOpen]="logoutModalOpen()"
        title="Log out?"
        confirmText="Log out"
        [isDanger]="true"
        (confirm)="confirmLogout()"
        (cancel)="logoutModalOpen.set(false)"
      >
        <p>Are you sure you want to log out of Gupshup?</p>
      </app-modal>
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

    .settings-screen {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      width: 100%;
      background-color: var(--card);
      overflow: hidden;
      position: relative;
    }

    .settings-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
      background-color: var(--card);
      flex-shrink: 0;
    }

    .back-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease, background-color 0.15s ease;
      outline: none;

      &:hover {
        color: var(--ink);
        background-color: var(--input);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    .header-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--ink);
    }

    .settings-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 18px 22px 36px;
    }

    /* Profile Header */
    .profile-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-bottom: 22px;
    }

    .photo-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .photo-action-btn {
      font-size: 12px;
      font-weight: 800;
      color: var(--amber-text);
      background: none;
      border: none;
      cursor: pointer;
      padding: 3px 6px;
      border-radius: 6px;

      &:hover {
        text-decoration: underline;
      }

      &.danger {
        color: var(--danger);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
      }
    }

    .field-item {
      margin-bottom: 13px;
      display: flex;
      flex-direction: column;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 5px;
    }

    .form-input {
      width: 100%;
      padding: 11px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      font-size: 13.5px;
      color: var(--ink);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &:focus {
        outline: none !important;
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.16);
      }

      &.invalid {
        border-color: var(--danger);
      }
    }

    .field-hint {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 4px;
    }

    .field-error {
      font-size: 11.5px;
      color: var(--danger);
      margin-top: 4px;
      font-weight: 600;
    }

    .form-actions-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 10px;
    }

    /* Section Headers */
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: var(--muted);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin: 26px 0 2px;
    }

    .section-hint {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    /* Accordions */
    .accordion-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 4px;
      border-bottom: 1px solid var(--border);
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      color: var(--ink);
      outline: none;

      &:hover {
        color: var(--amber-text);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    .chev-icon {
      color: var(--muted);
      display: flex;
      align-items: center;
      transition: transform 0.25s ease;

      &.open {
        transform: rotate(180deg);
      }
    }

    .accordion-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1);

      &.open {
        max-height: 260px;
        overflow-y: auto;
      }
    }

    .sub-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 4px;
      border-bottom: 1px dashed var(--border);
      animation: fadeIn 0.2s ease;
    }

    .sub-row-name {
      flex: 1;
      font-size: 13px;
      font-weight: 700;
      color: var(--ink);
    }

    .teal-pill-btn {
      border: 1.5px solid var(--teal);
      color: var(--teal);
      background: transparent;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 800;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: rgba(79, 169, 160, 0.12);
      }

      &:focus-visible {
        outline: 2px solid var(--teal);
        outline-offset: 2px;
      }
    }

    /* Appearance Chips */
    .theme-row {
      display: flex;
      gap: 8px;
      padding: 10px 0;
    }

    .theme-chip {
      flex: 1;
      padding: 10px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      color: var(--muted);
      background: transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;

      &:hover {
        border-color: var(--amber);
      }

      &.active {
        border-color: var(--amber);
        color: var(--amber-text);
        background-color: var(--input);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    .logout-wrap {
      margin-top: 32px;
    }

    /* OTP inside verification modal */
    .otp-modal-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      margin: 10px 0;
    }

    .otp-box-sm {
      width: 100%;
      aspect-ratio: 1 / 1.15;
      padding: 0;
      text-align: center;
      font-size: 18px;
      font-weight: 800;
      border-radius: 10px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      color: var(--ink);
      outline: none;

      &:focus {
        outline: none !important;
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.16);
      }
    }

    .link-btn {
      color: var(--amber-text);
      font-weight: 800;
      background: none;
      border: none;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `],
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);

  @ViewChildren('emailOtpInput') emailOtpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly currentUser = this.chatService.currentUser;
  readonly declinedRequests = this.chatService.declinedRequests;
  readonly blockedUsers = this.chatService.blockedUsers;
  readonly declinedCount = this.chatService.declinedCount;
  readonly blockedCount = this.chatService.blockedCount;
  readonly currentTheme = this.themeService.currentTheme;

  readonly photoPreview = signal<string | null>(null);
  readonly declinedOpen = signal<boolean>(false);
  readonly blockedOpen = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isUsernameTaken = signal<boolean>(false);

  // Modals
  readonly emailModalOpen = signal<boolean>(false);
  readonly passwordModalOpen = signal<boolean>(false);
  readonly logoutModalOpen = signal<boolean>(false);

  // Email verification OTP
  readonly emailOtpDigits = signal<string[]>(['', '', '', '', '', '']);
  readonly emailOtpError = signal<string>('');

  readonly profileForm: FormGroup = this.fb.group({
    name: [this.currentUser().name, [Validators.required, Validators.minLength(2)]],
    username: [this.currentUser().username, [Validators.required, Validators.minLength(3), Validators.pattern(/^@?[a-zA-Z0-9_.]+$/)]],
    email: [this.currentUser().email, [Validators.required, Validators.email]],
  });

  readonly passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => {
        const p1 = group.get('newPassword')?.value;
        const p2 = group.get('confirmPassword')?.value;
        return p1 === p2 ? null : { mismatch: true };
      },
    }
  );

  isInvalid(controlName: string): boolean {
    const ctrl = this.profileForm.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  isSaveDisabled(): boolean {
    const isDirty = this.profileForm.dirty || this.photoPreview() !== null;
    return !isDirty || this.profileForm.invalid || this.isUsernameTaken() || this.isSaving();
  }

  checkUsername(): void {
    const val = this.profileForm.get('username')?.value || '';
    this.isUsernameTaken.set(this.chatService.isUsernameTaken(val));
  }

  onAvatarSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview.set(reader.result as string);
        this.profileForm.markAsDirty();
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.photoPreview.set('');
    this.chatService.updateCurrentUser({ photoUrl: null });
    this.profileForm.markAsDirty();
    this.toast.info('Profile picture removed');
  }

  discardChanges(): void {
    const u = this.currentUser();
    this.profileForm.reset({
      name: u.name,
      username: u.username,
      email: u.email,
    });
    this.photoPreview.set(null);
    this.isUsernameTaken.set(false);
    this.profileForm.markAsPristine();
  }

  onSaveClicked(): void {
    if (this.isSaveDisabled()) return;

    const emailChanged = this.profileForm.get('email')?.dirty &&
      this.profileForm.get('email')?.value !== this.currentUser().email;

    if (emailChanged) {
      this.emailOtpDigits.set(['', '', '', '', '', '']);
      this.emailOtpError.set('');
      this.emailModalOpen.set(true);
      setTimeout(() => this.focusEmailOtp(0), 50);
      return;
    }

    this.applyProfileSave();
  }

  private applyProfileSave(): void {
    this.isSaving.set(true);
    setTimeout(() => {
      this.isSaving.set(false);
      const val = this.profileForm.value;
      const updateData: any = {
        name: val.name,
        username: val.username,
        email: val.email,
      };
      if (this.photoPreview()) {
        updateData.photoUrl = this.photoPreview();
      }

      this.chatService.updateCurrentUser(updateData);
      this.profileForm.markAsPristine();
      this.photoPreview.set(null);
      this.toast.success('Changes saved');
    }, 500);
  }

  // Email verification OTP handlers
  onEmailOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    const digits = [...this.emailOtpDigits()];
    digits[index] = val;
    this.emailOtpDigits.set(digits);
    this.emailOtpError.set('');

    if (val && index < 5) {
      this.focusEmailOtp(index + 1);
    }
  }

  onEmailOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const digits = [...this.emailOtpDigits()];
      if (!digits[index] && index > 0) {
        this.focusEmailOtp(index - 1);
      } else {
        digits[index] = '';
        this.emailOtpDigits.set(digits);
      }
    }
  }

  private focusEmailOtp(index: number): void {
    const arr = this.emailOtpInputs?.toArray();
    if (arr && arr[index]) {
      arr[index].nativeElement.focus();
    }
  }

  resendEmailCode(): void {
    this.emailOtpDigits.set(['', '', '', '', '', '']);
    this.emailOtpError.set('');
    this.toast.info('New verification code sent');
  }

  submitEmailVerification(): void {
    const code = this.emailOtpDigits().join('');
    if (code.length < 6) {
      this.emailOtpError.set('Please enter all 6 digits');
      return;
    }

    this.emailModalOpen.set(false);
    this.applyProfileSave();
  }

  selectTheme(theme: AppTheme): void {
    this.themeService.setTheme(theme);
    this.toast.info(`Theme set to ${theme}`);
  }

  acceptRequest(id: string, name: string): void {
    this.chatService.acceptDeclinedRequest(id);
    this.toast.success(`Accepted request from ${name}`);
  }

  unblockUser(name: string): void {
    this.chatService.unblockUser(name);
    this.toast.success(`Unblocked ${name}`);
  }

  openPasswordModal(): void {
    this.passwordForm.reset();
    this.passwordModalOpen.set(true);
  }

  closePasswordModal(): void {
    this.passwordModalOpen.set(false);
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordModalOpen.set(false);
    this.toast.success('Password changed successfully');
  }

  openLogoutModal(): void {
    this.logoutModalOpen.set(true);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.toast.info('Logged out');
    this.router.navigate(['/login']);
  }
}
