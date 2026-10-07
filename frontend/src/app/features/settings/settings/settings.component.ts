import { Component, ElementRef, OnInit, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { UsersService } from '../../../shared/services/users.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ConversationsService } from '../../../shared/services/conversations.service';
import { AppTheme, ThemeService } from '../../../shared/services/theme.service';
import { ToastService } from '../../../shared/services/toast.service';
import { BlockedItem, DeclinedItem, getInitials } from '../../../shared/models/api.models';
import { processAvatarImage } from '../../../shared/utils/image-processor';
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
            [name]="currentUserDisplay().name"
            [initials]="currentUserDisplay().initials"
            [photoUrl]="photoPreview() || currentUserDisplay().photoUrl"
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
            @if (photoPreview() || currentUserDisplay().photoUrl) {
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
              readonly
            />
            <p class="field-hint">Usernames cannot be changed</p>
          </div>

          <div class="field-item">
            <label for="profEmail" class="field-label">Email</label>
            @if (isGoogleUser()) {
              <input
                id="profEmail"
                type="email"
                [value]="currentUser()?.email || ''"
                class="form-input"
                readonly
              />
              <p class="field-hint">Linked with your Google account</p>
            } @else {
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

          @if (hasPassword()) {
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
          }
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
            @for (req of declinedRequests(); track req.conversationId) {
              <div class="sub-row">
                <app-avatar
                  [name]="req.user.name"
                  [initials]="getInitials(req.user.name)"
                  [photoUrl]="req.user.avatarUrl"
                  [size]="'sm'"
                ></app-avatar>
                <div class="sub-row-name">{{ req.user.name }}</div>
                <button
                  type="button"
                  class="teal-pill-btn"
                  (click)="acceptRequest(req.conversationId, req.user.name)"
                  [attr.aria-label]="'Accept ' + req.user.name"
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
            @for (item of blockedUsers(); track item.id) {
              <div class="sub-row">
                <app-avatar
                  [name]="item.user.name"
                  [initials]="getInitials(item.user.name)"
                  [photoUrl]="item.user.avatarUrl"
                  [size]="'sm'"
                ></app-avatar>
                <div class="sub-row-name">{{ item.user.name }}</div>
                <button
                  type="button"
                  class="teal-pill-btn"
                  (click)="unblockUser(item)"
                  [attr.aria-label]="'Unblock ' + item.user.name"
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
          <strong>{{ pendingNewEmail() }}</strong>.
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
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly conversationsService = inject(ConversationsService);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);

  readonly getInitials = getInitials;

  @ViewChildren('emailOtpInput') emailOtpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly currentUser = this.authService.currentUser;
  readonly hasPassword = computed(() => this.currentUser()?.hasPassword ?? true);
  readonly isGoogleUser = computed(() => this.currentUser()?.authProvider === 'google' || !this.hasPassword());
  readonly currentUserDisplay = computed(() => {
    const u = this.currentUser();
    return {
      name: u?.name || '',
      username: u?.username || '',
      email: u?.email || '',
      photoUrl: u?.avatarUrl || null,
      initials: getInitials(u?.name || ''),
    };
  });

  readonly declinedRequests = signal<DeclinedItem[]>([]);
  readonly blockedUsers = signal<BlockedItem[]>([]);
  readonly declinedCount = computed(() => this.declinedRequests().length);
  readonly blockedCount = computed(() => this.blockedUsers().length);
  readonly currentTheme = this.themeService.currentTheme;

  readonly selectedAvatarFile = signal<File | null>(null);
  readonly photoPreview = signal<string | null>(null);
  readonly declinedOpen = signal<boolean>(false);
  readonly blockedOpen = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  // Modals
  readonly emailModalOpen = signal<boolean>(false);
  readonly passwordModalOpen = signal<boolean>(false);
  readonly logoutModalOpen = signal<boolean>(false);

  // Email verification OTP
  readonly pendingNewEmail = signal<string>('');
  readonly emailOtpDigits = signal<string[]>(['', '', '', '', '', '']);
  readonly emailOtpError = signal<string>('');

  readonly profileForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    username: [{ value: '', disabled: true }],
    email: ['', [Validators.required, Validators.email]],
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

  ngOnInit(): void {
    // Refresh user profile
    this.usersService.getMe().subscribe({
      next: (user) => {
        this.authService.currentUser.set(user);
        this.profileForm.patchValue({
          name: user.name,
          username: user.username,
          email: user.email,
        });
      },
      error: () => {
        const cached = this.currentUser();
        if (cached) {
          this.profileForm.patchValue({
            name: cached.name,
            username: cached.username,
            email: cached.email,
          });
        }
      },
    });

    // Load declined users
    this.loadDeclinedRequests();

    // Load blocked users
    this.loadBlockedUsers();
  }

  loadDeclinedRequests(): void {
    this.usersService.getDeclinedUsers().subscribe({
      next: (items) => this.declinedRequests.set(items),
      error: () => {},
    });
  }

  loadBlockedUsers(): void {
    this.usersService.getBlockedUsers().subscribe({
      next: (items) => this.blockedUsers.set(items),
      error: () => {},
    });
  }

  isInvalid(controlName: string): boolean {
    const ctrl = this.profileForm.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  isSaveDisabled(): boolean {
    const isDirty = this.profileForm.dirty || this.selectedAvatarFile() !== null;
    return !isDirty || this.profileForm.invalid || this.isSaving();
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const processedFile = await processAvatarImage(file);
      this.selectedAvatarFile.set(processedFile);
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview.set(reader.result as string);
        this.profileForm.markAsDirty();
      };
      reader.readAsDataURL(processedFile);
    } catch (err: any) {
      this.toast.error(err?.message || 'Invalid avatar image');
      input.value = '';
    }
  }

  removePhoto(): void {
    this.selectedAvatarFile.set(null);
    this.photoPreview.set(null);
    this.usersService.removeAvatar().subscribe({
      next: (updatedUser) => {
        this.authService.currentUser.set(updatedUser);
        this.toast.info('Profile picture removed');
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Failed to remove photo');
      },
    });
  }

  discardChanges(): void {
    const u = this.currentUser();
    if (u) {
      this.profileForm.reset({
        name: u.name,
        username: u.username,
        email: u.email,
      });
    }
    this.photoPreview.set(null);
    this.selectedAvatarFile.set(null);
    this.profileForm.markAsPristine();
  }

  onSaveClicked(): void {
    if (this.isSaveDisabled()) return;

    if (this.isGoogleUser()) {
      this.applyProfileSave();
      return;
    }

    const currentEmail = this.currentUser()?.email;
    const newEmail = this.profileForm.get('email')?.value?.trim();

    if (newEmail && newEmail !== currentEmail) {
      this.pendingNewEmail.set(newEmail);
      this.emailOtpDigits.set(['', '', '', '', '', '']);
      this.emailOtpError.set('');

      this.authService.requestChangeEmailOtp(newEmail).subscribe({
        next: () => {
          this.emailModalOpen.set(true);
          setTimeout(() => this.focusEmailOtp(0), 50);
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Failed to send verification code');
        },
      });
      return;
    }

    this.applyProfileSave();
  }

  private applyProfileSave(): void {
    this.isSaving.set(true);
    const val = this.profileForm.value;
    const avatarFile = this.selectedAvatarFile();

    if (avatarFile) {
      // C5: Consistent save. If avatar fails, show "Photo could not be saved" and do NOT save other changes or show success toast
      this.usersService.uploadAvatar(avatarFile).subscribe({
        next: () => {
          this.usersService.updateMe({ name: val.name }).subscribe({
            next: (updatedUser) => {
              this.handleSaveSuccess(updatedUser);
            },
            error: (err) => {
              this.isSaving.set(false);
              this.toast.error(err.error?.message || 'Failed to save changes');
            },
          });
        },
        error: () => {
          this.isSaving.set(false);
          this.toast.error('Photo could not be saved');
        },
      });
    } else {
      this.usersService.updateMe({ name: val.name }).subscribe({
        next: (updatedUser) => {
          this.handleSaveSuccess(updatedUser);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err.error?.message || 'Failed to save changes');
        },
      });
    }
  }

  private handleSaveSuccess(finalUser: any): void {
    this.authService.currentUser.set(finalUser);
    this.profileForm.patchValue({
      name: finalUser.name,
      username: finalUser.username,
      email: finalUser.email,
    });
    this.profileForm.markAsPristine();
    this.selectedAvatarFile.set(null);
    this.photoPreview.set(null);
    this.isSaving.set(false);
    this.toast.success('Changes saved');
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
    const email = this.pendingNewEmail();
    if (!email) return;

    this.emailOtpDigits.set(['', '', '', '', '', '']);
    this.emailOtpError.set('');
    this.authService.requestChangeEmailOtp(email).subscribe({
      next: () => {
        this.toast.info('New verification code sent');
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Failed to resend code');
      },
    });
  }

  submitEmailVerification(): void {
    const code = this.emailOtpDigits().join('');
    if (code.length < 6) {
      this.emailOtpError.set('Please enter all 6 digits');
      return;
    }

    this.authService.confirmChangeEmail(this.pendingNewEmail(), code).subscribe({
      next: (res) => {
        this.emailModalOpen.set(false);
        this.toast.success('Email updated successfully');
        this.applyProfileSave();
      },
      error: (err) => {
        this.emailOtpError.set(err.error?.message || 'Invalid verification code');
      },
    });
  }

  selectTheme(theme: AppTheme): void {
    this.themeService.setTheme(theme);
    const mappedTheme = theme === 'default' ? 'system' : theme === 'white' ? 'light' : 'dark';
    this.usersService.updateMe({ themePreference: mappedTheme }).subscribe({
      error: () => {},
    });
    this.toast.info(`Theme set to ${theme}`);
  }

  acceptRequest(conversationId: string, name: string): void {
    this.conversationsService.acceptConversation(conversationId).subscribe({
      next: () => {
        this.declinedRequests.update((list) => list.filter((r) => r.conversationId !== conversationId));
        this.toast.success(`Accepted request from ${name}`);
      },
      error: (err) => {
        this.toast.error(err.error?.message || `Failed to accept request from ${name}`);
      },
    });
  }

  unblockUser(item: BlockedItem): void {
    this.conversationsService.unblockUser(item.id).subscribe({
      next: () => {
        this.blockedUsers.update((list) => list.filter((b) => b.id !== item.id));
        this.toast.success(`Unblocked ${item.user.name}`);
      },
      error: (err) => {
        this.toast.error(err.error?.message || `Failed to unblock ${item.user.name}`);
      },
    });
  }

  openPasswordModal(): void {
    if (!this.hasPassword()) return;
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

    const { currentPassword, newPassword } = this.passwordForm.value;
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordModalOpen.set(false);
        this.toast.success('Password changed successfully');
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Failed to change password');
      },
    });
  }

  openLogoutModal(): void {
    this.logoutModalOpen.set(true);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.authService.logout().subscribe({
      next: () => {
        this.toast.info('Logged out');
      },
      error: () => {
        this.toast.info('Logged out');
      },
    });
  }
}
