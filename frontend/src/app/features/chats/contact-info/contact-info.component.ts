import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConversationsService } from '../../../shared/services/conversations.service';
import { ChatLockService } from '../../../shared/services/chat-lock.service';
import { SocketService } from '../../../shared/services/socket.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { getInitials } from '../../../shared/models/api.models';

@Component({
  selector: 'app-contact-info',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SvgIconComponent,
    AvatarComponent,
    BottomSheetComponent,
    ModalComponent,
    ButtonComponent,
  ],
  template: `
    <div class="contact-info-page">
      <!-- Top Navigation Bar -->
      <header class="topbar">
        <button
          type="button"
          class="back-btn"
          (click)="goBack()"
          aria-label="Back to chat"
        >
          <app-svg-icon name="back" [size]="20"></app-svg-icon>
        </button>
        <h1 class="topbar-title">Contact info</h1>
        <div class="topbar-spacer"></div>
      </header>

      <!-- Main Content Scroll Area -->
      <main class="content-scroll">
        @if (isLoading()) {
          <div class="loading-state">
            <app-svg-icon name="spinner" [size]="32"></app-svg-icon>
          </div>
        } @else if (conversation()) {
          <!-- Profile Header Card -->
          <section class="profile-card">
            <div
              class="avatar-wrapper"
              (click)="openAvatarZoom()"
              role="button"
              tabindex="0"
              aria-label="View profile picture"
              (keydown.enter)="openAvatarZoom()"
            >
              <div class="avatar-120">
                <app-avatar
                  [avatarUrl]="otherUser()?.avatarUrl"
                  [name]="otherUser()?.name || 'Contact'"
                  [initials]="initials()"
                  [size]="'lg'"
                ></app-avatar>
              </div>
              <div class="avatar-zoom-badge" title="Tap to zoom">
                <app-svg-icon name="search" [size]="14"></app-svg-icon>
              </div>
            </div>

            <h2 class="display-name">{{ otherUser()?.name }}</h2>
            @if (otherUser()?.username) {
              <p class="username">&#64;{{ otherUser()?.username }}</p>
            }

            <div class="presence-badge" [class.online]="isOnline()">
              <span class="presence-dot"></span>
              <span class="presence-text">
                {{ isOnline() ? 'Online' : (lastSeenText() || 'Offline') }}
              </span>
            </div>

            @if (otherUser()?.statusMessage) {
              <div class="status-msg">
                <p>{{ otherUser()?.statusMessage }}</p>
              </div>
            }

            @if (otherUser()?.bio) {
              <div class="bio-text">
                <p>{{ otherUser()?.bio }}</p>
              </div>
            }
          </section>

          <!-- Privacy & Settings Card -->
          <section class="section-card">
            <h3 class="section-title">Privacy & Security</h3>

            <!-- Disappearing Messages Row -->
            <div
              class="action-row"
              role="button"
              tabindex="0"
              (click)="openDisappearingSheet()"
              (keydown.enter)="openDisappearingSheet()"
            >
              <div class="action-icon">
                <app-svg-icon name="clock" [size]="20"></app-svg-icon>
              </div>
              <div class="action-info">
                <span class="action-label">Disappearing messages</span>
                <span class="action-val">{{ disappearingLabel() }}</span>
              </div>
              <app-svg-icon name="chev" [size]="16" class="action-chev"></app-svg-icon>
            </div>

            <div class="row-divider"></div>

            <!-- Chat Lock Row -->
            <div class="action-row" (click)="onToggleLockClick()">
              <div class="action-icon" [class.locked]="isLocked()">
                <app-svg-icon [name]="isLocked() ? 'lock' : 'unlock'" [size]="20"></app-svg-icon>
              </div>
              <div class="action-info">
                <span class="action-label">Lock chat</span>
                <span class="action-val">
                  {{ isLocked() ? 'PIN required to view messages' : 'Unlocked' }}
                </span>
              </div>
              <label class="switch-toggle" (click)="$event.stopPropagation()">
                <input
                  type="checkbox"
                  [checked]="isLocked()"
                  (change)="onToggleLockClick()"
                  aria-label="Toggle chat lock"
                />
                <span class="slider"></span>
              </label>
            </div>
          </section>

          <!-- Management Actions Card -->
          <section class="section-card">
            <h3 class="section-title">Actions</h3>

            <!-- Clear Chat Row -->
            <div
              class="action-row"
              role="button"
              tabindex="0"
              (click)="promptClearChat()"
              (keydown.enter)="promptClearChat()"
            >
              <div class="action-icon">
                <app-svg-icon name="chat" [size]="20"></app-svg-icon>
              </div>
              <div class="action-info">
                <span class="action-label">Clear chat</span>
                <span class="action-val">Delete all messages for you</span>
              </div>
              <app-svg-icon name="chev" [size]="16" class="action-chev"></app-svg-icon>
            </div>

            <div class="row-divider"></div>

            <!-- Block Row (Red) -->
            <div
              class="action-row danger"
              role="button"
              tabindex="0"
              (click)="promptBlockUser()"
              (keydown.enter)="promptBlockUser()"
            >
              <div class="action-icon danger-icon">
                <app-svg-icon name="ban" [size]="20"></app-svg-icon>
              </div>
              <div class="action-info">
                <span class="action-label danger-text">Block {{ otherUser()?.name }}</span>
                <span class="action-val">Prevent incoming messages</span>
              </div>
              <app-svg-icon name="chev" [size]="16" class="action-chev danger-text"></app-svg-icon>
            </div>

            <div class="row-divider"></div>

            <!-- Delete Chat Row (Red) -->
            <div
              class="action-row danger"
              role="button"
              tabindex="0"
              (click)="promptDeleteChat()"
              (keydown.enter)="promptDeleteChat()"
            >
              <div class="action-icon danger-icon">
                <app-svg-icon name="trash" [size]="20"></app-svg-icon>
              </div>
              <div class="action-info">
                <span class="action-label danger-text">Delete chat</span>
                <span class="action-val">Clear messages and hide from chat list</span>
              </div>
              <app-svg-icon name="chev" [size]="16" class="action-chev danger-text"></app-svg-icon>
            </div>
          </section>
        }
      </main>

      <!-- Avatar Zoom Modal -->
      @if (zoomOpen()) {
        <div class="zoom-backdrop" (click)="closeAvatarZoom()" role="presentation">
          <div class="zoom-container" (click)="$event.stopPropagation()">
            <button
              type="button"
              class="zoom-close-btn"
              (click)="closeAvatarZoom()"
              aria-label="Close photo view"
            >
              <app-svg-icon name="close" [size]="22"></app-svg-icon>
            </button>
            <div class="zoomed-avatar-wrap">
              @if (otherUser()?.avatarUrl) {
                <img
                  [src]="otherUser()?.avatarUrl"
                  [alt]="otherUser()?.name"
                  class="zoomed-avatar-img"
                />
              } @else {
                <div class="zoomed-initials">
                  {{ initials() }}
                </div>
              }
            </div>
            <p class="zoom-name">{{ otherUser()?.name }}</p>
          </div>
        </div>
      }

      <!-- Disappearing Messages Bottom Sheet -->
      <app-bottom-sheet
        [isOpen]="disappearingSheetOpen()"
        title="Disappearing messages"
        (close)="closeDisappearingSheet()"
      >
        <div class="sheet-options">
          <p class="sheet-desc">
            When turned on, new messages sent in this chat will disappear after the selected time.
          </p>

          <button
            type="button"
            class="option-item"
            [class.selected]="disappearingMode() === 'off'"
            (click)="selectDisappearingMode('off')"
          >
            <span class="option-text">Off</span>
            @if (disappearingMode() === 'off') {
              <app-svg-icon name="check" [size]="18" class="option-check"></app-svg-icon>
            }
          </button>

          <button
            type="button"
            class="option-item"
            [class.selected]="disappearingMode() === '24h'"
            (click)="selectDisappearingMode('24h')"
          >
            <span class="option-text">24 hours</span>
            @if (disappearingMode() === '24h') {
              <app-svg-icon name="check" [size]="18" class="option-check"></app-svg-icon>
            }
          </button>

          <button
            type="button"
            class="option-item"
            [class.selected]="disappearingMode() === '7d'"
            (click)="selectDisappearingMode('7d')"
          >
            <span class="option-text">7 days</span>
            @if (disappearingMode() === '7d') {
              <app-svg-icon name="check" [size]="18" class="option-check"></app-svg-icon>
            }
          </button>
        </div>
      </app-bottom-sheet>

      <!-- PIN Dialog for Chat Lock (Set PIN or Verify PIN) -->
      @if (pinModalOpen()) {
        <div class="pin-modal-backdrop" (click)="closePinModal()" role="presentation">
          <div class="pin-modal-card" (click)="$event.stopPropagation()">
            <div class="pin-icon-wrap">
              <app-svg-icon name="lock" [size]="28"></app-svg-icon>
            </div>
            <h3 class="pin-title">
              {{ pinMode() === 'set' ? 'Set 4-Digit Chat Lock PIN' : 'Enter 4-Digit PIN' }}
            </h3>
            <p class="pin-desc">
              {{ pinMode() === 'set'
                ? 'Create a 4-digit PIN to secure locked chats on this account.'
                : 'Enter your 4-digit PIN to unlock or lock this chat.' }}
            </p>

            <div class="pin-input-wrap">
              <input
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="4"
                [(ngModel)]="pinInput"
                placeholder="••••"
                class="pin-field"
                autofocus
              />
            </div>

            @if (pinMode() === 'set') {
              <div class="pin-input-wrap">
                <input
                  type="password"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="4"
                  [(ngModel)]="confirmPinInput"
                  placeholder="Confirm PIN"
                  class="pin-field"
                />
              </div>
            }

            @if (pinError()) {
              <p class="pin-error">{{ pinError() }}</p>
            }

            <div class="pin-actions">
              <app-button variant="ghost" (clicked)="closePinModal()">Cancel</app-button>
              <app-button variant="primary" (clicked)="submitPin()">
                {{ pinMode() === 'set' ? 'Save PIN' : 'Verify' }}
              </app-button>
            </div>
          </div>
        </div>
      }

      <!-- Confirmation Modal (Clear, Block, Delete) -->
      <app-modal
        [isOpen]="confirmationModal().isOpen"
        [title]="confirmationModal().title"
        [confirmText]="confirmationModal().confirmText"
        [isDanger]="confirmationModal().isDanger"
        (confirm)="executeConfirmedAction()"
        (cancel)="closeConfirmationModal()"
      >
        <p>{{ confirmationModal().message }}</p>
      </app-modal>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      width: 100%;
      background-color: var(--card);
      overflow: hidden;
    }

    .contact-info-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      position: relative;
      background-color: var(--card);
      overflow: hidden;
    }

    .topbar {
      padding: 12px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      background-color: var(--card);
      gap: 12px;
    }

    .back-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: var(--input);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--border);
      }
    }

    .topbar-title {
      font-size: 17px;
      font-weight: 800;
      color: var(--ink);
      margin: 0;
      text-align: center;
      flex: 1;
    }

    .topbar-spacer {
      width: 36px;
    }

    .content-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 20px 16px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--amber);
    }

    /* Profile Header Card */
    .profile-card {
      width: 100%;
      max-width: 520px;
      background-color: var(--input);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar-wrapper {
      position: relative;
      cursor: pointer;
      margin-bottom: 14px;
      border-radius: 50%;
      outline: none;

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 3px;
      }
    }

    .avatar-120 {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);

      ::ng-deep app-avatar .avatar {
        width: 110px !important;
        height: 110px !important;
        font-size: 38px !important;
      }
    }

    .avatar-zoom-badge {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: var(--card);
      border: 1px solid var(--border);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }

    .display-name {
      font-size: 20px;
      font-weight: 800;
      color: var(--ink);
      margin: 0 0 2px;
      line-height: 1.25;
    }

    .username {
      font-size: 14px;
      color: var(--muted);
      margin: 0 0 10px;
      font-weight: 600;
    }

    .presence-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      padding: 4px 10px;
      border-radius: 999px;
      background-color: var(--card);
      border: 1px solid var(--border);

      &.online {
        color: #10b981;
      }
    }

    .presence-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #9ca3af;

      .online & {
        background-color: #10b981;
      }
    }

    .status-msg {
      margin-top: 14px;
      padding: 10px 14px;
      background-color: var(--card);
      border-radius: 12px;
      border: 1px solid var(--border);
      font-size: 13.5px;
      color: var(--ink);
      max-width: 100%;
      p { margin: 0; }
    }

    .bio-text {
      margin-top: 8px;
      font-size: 13px;
      color: var(--muted);
      max-width: 100%;
      p { margin: 0; }
    }

    /* Section Cards */
    .section-card {
      width: 100%;
      max-width: 520px;
      background-color: var(--input);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
    }

    .section-title {
      font-size: 11.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin: 0 0 10px;
    }

    .action-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 4px;
      cursor: pointer;
      border-radius: 10px;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }

      &.danger {
        color: var(--danger);
      }
    }

    .action-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background-color: var(--card);
      border: 1px solid var(--border);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.locked {
        color: var(--amber);
        border-color: var(--amber);
      }

      &.danger-icon {
        color: var(--danger);
      }
    }

    .action-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .action-label {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--ink);
    }

    .action-val {
      font-size: 12.5px;
      color: var(--muted);
    }

    .action-chev {
      color: var(--muted);
      flex-shrink: 0;
    }

    .danger-text {
      color: var(--danger) !important;
    }

    .row-divider {
      height: 1px;
      background-color: var(--border);
      margin: 4px 0;
    }

    /* Switch toggle */
    .switch-toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 26px;
      flex-shrink: 0;

      input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: #cbd5e1;
        transition: 0.25s ease;
        border-radius: 34px;

        &:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.25s ease;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      }

      input:checked + .slider {
        background-color: var(--amber);
      }

      input:checked + .slider:before {
        transform: translateX(18px);
      }
    }

    /* Zoom Backdrop Modal */
    .zoom-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }

    .zoom-container {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 90vw;
      max-height: 90vh;
    }

    .zoom-close-btn {
      position: absolute;
      top: -46px;
      right: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      &:hover {
        background-color: rgba(255, 255, 255, 0.35);
      }
    }

    .zoomed-avatar-wrap {
      width: 280px;
      height: 280px;
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      background-color: var(--card);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .zoomed-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .zoomed-initials {
      font-size: 80px;
      font-weight: 800;
      color: var(--amber-text);
    }

    .zoom-name {
      color: white;
      font-size: 18px;
      font-weight: 700;
      margin-top: 14px;
    }

    /* Disappearing Sheet Options */
    .sheet-options {
      padding: 8px 4px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sheet-desc {
      font-size: 13.5px;
      color: var(--muted);
      margin: 0 0 12px;
      line-height: 1.45;
    }

    .option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 16px;
      border-radius: 12px;
      background-color: var(--input);
      border: 1px solid var(--border);
      color: var(--ink);
      font-size: 14.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;

      &:hover {
        background-color: var(--border);
      }

      &.selected {
        border-color: var(--amber);
        background-color: rgba(245, 158, 11, 0.08);
        color: var(--amber-text);
        font-weight: 700;
      }
    }

    .option-check {
      color: var(--amber);
    }

    /* PIN Modal */
    .pin-modal-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      z-index: 210;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.15s ease;
    }

    .pin-modal-card {
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
    }

    .pin-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background-color: rgba(245, 158, 11, 0.12);
      color: var(--amber);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }

    .pin-title {
      font-size: 17px;
      font-weight: 800;
      color: var(--ink);
      margin: 0 0 6px;
    }

    .pin-desc {
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 16px;
      line-height: 1.4;
    }

    .pin-input-wrap {
      width: 100%;
      margin-bottom: 10px;
    }

    .pin-field {
      width: 100%;
      padding: 12px;
      text-align: center;
      font-size: 24px;
      letter-spacing: 0.3em;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      color: var(--ink);
      font-family: monospace;
      outline: none;

      &:focus {
        border-color: var(--amber);
      }
    }

    .pin-error {
      color: var(--danger);
      font-size: 12.5px;
      margin: 4px 0 12px;
      font-weight: 600;
    }

    .pin-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      width: 100%;
      margin-top: 10px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `],
})
export class ContactInfoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly conversationsService = inject(ConversationsService);
  private readonly chatLockService = inject(ChatLockService);
  private readonly socketService = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly conversationId = signal<string>('');
  readonly conversation = signal<any>(null);
  readonly isLoading = signal<boolean>(true);

  readonly zoomOpen = signal<boolean>(false);
  readonly disappearingSheetOpen = signal<boolean>(false);
  readonly disappearingMode = signal<'off' | '24h' | '7d'>('off');

  readonly isLocked = signal<boolean>(false);
  readonly pinModalOpen = signal<boolean>(false);
  readonly pinMode = signal<'set' | 'verify'>('verify');
  pinInput = '';
  confirmPinInput = '';
  readonly pinError = signal<string>('');

  readonly confirmationModal = signal<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger: boolean;
    action: 'clear' | 'block' | 'delete' | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDanger: false,
    action: null,
  });

  private sub = new Subscription();

  readonly otherUser = computed(() => this.conversation()?.otherUser);
  readonly initials = computed(() => getInitials(this.otherUser()?.name || 'Contact'));
  readonly isOnline = computed(() => Boolean(this.otherUser()?.isOnline));
  readonly lastSeenText = computed(() => {
    const ls = this.otherUser()?.lastSeen;
    if (!ls) return null;
    const date = new Date(ls);
    return `Last seen ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  });

  readonly disappearingLabel = computed(() => {
    const mode = this.disappearingMode();
    if (mode === '24h') return '24 hours';
    if (mode === '7d') return '7 days';
    return 'Off';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/chats']);
      return;
    }
    this.conversationId.set(id);
    this.loadData(id);

    // Subscribe to presence updates
    this.sub.add(
      this.socketService.presenceUpdate$.subscribe((data) => {
        const u = this.otherUser();
        if (u && u.id === data.userId) {
          this.conversation.update((c) => ({
            ...c,
            otherUser: {
              ...c.otherUser,
              isOnline: data.isOnline,
              lastSeen: data.lastSeen,
            },
          }));
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  loadData(id: string): void {
    this.isLoading.set(true);
    this.conversationsService.getConversationById(id).subscribe({
      next: (conv) => {
        if (!conv || conv.isSelf || conv.status !== 'accepted') {
          this.router.navigate(['/chats', id]);
          return;
        }
        this.conversation.set(conv);
        this.disappearingMode.set(conv.disappearingMode || 'off');
        this.isLocked.set(Boolean(conv.isLocked));
        this.isLoading.set(false);

        // Also refresh chat lock status
        this.chatLockService.loadStatus().subscribe({
          next: (st) => {
            if (conv.otherUser?.id) {
              this.isLocked.set(st.lockedPeerIds.includes(conv.otherUser.id));
            }
          },
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.router.navigate(['/chats']);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/chats', this.conversationId()]);
  }

  openAvatarZoom(): void {
    this.zoomOpen.set(true);
  }

  closeAvatarZoom(): void {
    this.zoomOpen.set(false);
  }

  openDisappearingSheet(): void {
    this.disappearingSheetOpen.set(true);
  }

  closeDisappearingSheet(): void {
    this.disappearingSheetOpen.set(false);
  }

  selectDisappearingMode(mode: 'off' | '24h' | '7d'): void {
    const id = this.conversationId();
    this.conversationsService.setDisappearingMode(id, mode).subscribe({
      next: () => {
        this.disappearingMode.set(mode);
        this.closeDisappearingSheet();
        this.toast.success(
          mode === 'off'
            ? 'Disappearing messages turned off'
            : `Disappearing messages set to ${mode === '24h' ? '24 hours' : '7 days'}`
        );
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to update disappearing messages');
      },
    });
  }

  onToggleLockClick(): void {
    this.pinError.set('');
    this.pinInput = '';
    this.confirmPinInput = '';

    if (!this.chatLockService.hasPin()) {
      this.pinMode.set('set');
      this.pinModalOpen.set(true);
    } else {
      this.pinMode.set('verify');
      this.pinModalOpen.set(true);
    }
  }

  closePinModal(): void {
    this.pinModalOpen.set(false);
    this.pinInput = '';
    this.confirmPinInput = '';
    this.pinError.set('');
  }

  submitPin(): void {
    const pin = this.pinInput.trim();
    if (!/^\d{4}$/.test(pin)) {
      this.pinError.set('PIN must be exactly 4 digits');
      return;
    }

    const peerUserId = this.otherUser()?.id;
    if (!peerUserId) return;

    if (this.pinMode() === 'set') {
      if (this.pinInput !== this.confirmPinInput) {
        this.pinError.set('PIN confirmation does not match');
        return;
      }

      this.chatLockService.setPin(pin).subscribe({
        next: () => {
          this.toast.success('Chat lock PIN set');
          // Now toggle the lock for this contact
          this.toggleContactLock(peerUserId);
          this.closePinModal();
        },
        error: (err) => {
          this.pinError.set(err?.error?.error?.message || 'Failed to set PIN');
        },
      });
    } else {
      // Verify PIN
      this.chatLockService.verifyPin(pin, peerUserId, this.conversationId()).subscribe({
        next: () => {
          this.toggleContactLock(peerUserId);
          this.closePinModal();
        },
        error: (err) => {
          if (err?.status === 429) {
            this.pinError.set('Too many incorrect attempts. Locked for 5 minutes.');
          } else {
            this.pinError.set(err?.error?.error?.message || 'Incorrect PIN');
          }
        },
      });
    }
  }

  private toggleContactLock(peerUserId: string): void {
    const targetState = !this.isLocked();
    this.chatLockService.toggleLock(peerUserId, targetState).subscribe({
      next: (locked) => {
        this.isLocked.set(locked);
        this.toast.success(locked ? 'Chat locked' : 'Chat unlocked');
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to update chat lock');
      },
    });
  }

  promptClearChat(): void {
    this.confirmationModal.set({
      isOpen: true,
      title: 'Clear chat?',
      message: 'Are you sure you want to clear all messages in this conversation? This cannot be undone.',
      confirmText: 'Clear',
      isDanger: false,
      action: 'clear',
    });
  }

  promptBlockUser(): void {
    const name = this.otherUser()?.name || 'this contact';
    this.confirmationModal.set({
      isOpen: true,
      title: `Block ${name}?`,
      message: `${name} will no longer be able to message you.`,
      confirmText: 'Block',
      isDanger: true,
      action: 'block',
    });
  }

  promptDeleteChat(): void {
    const name = this.otherUser()?.name || 'this contact';
    this.confirmationModal.set({
      isOpen: true,
      title: 'Delete chat?',
      message: `Delete chat with ${name}? This will clear your messages and hide the chat from your chat list until a new message arrives.`,
      confirmText: 'Delete',
      isDanger: true,
      action: 'delete',
    });
  }

  closeConfirmationModal(): void {
    this.confirmationModal.update((s) => ({ ...s, isOpen: false, action: null }));
  }

  executeConfirmedAction(): void {
    const action = this.confirmationModal().action;
    const id = this.conversationId();
    this.closeConfirmationModal();

    if (action === 'clear') {
      this.conversationsService.clearHistory(id).subscribe({
        next: () => {
          this.toast.success('Chat history cleared');
        },
        error: (err) => {
          this.toast.error(err?.error?.error?.message || 'Failed to clear chat');
        },
      });
    } else if (action === 'block') {
      this.conversationsService.blockUser(id).subscribe({
        next: () => {
          this.toast.info(`Blocked ${this.otherUser()?.name}`);
          this.router.navigate(['/chats']);
        },
        error: (err) => {
          this.toast.error(err?.error?.error?.message || 'Failed to block user');
        },
      });
    } else if (action === 'delete') {
      this.conversationsService.deleteConversation(id).subscribe({
        next: () => {
          this.toast.info(`Deleted chat with ${this.otherUser()?.name}`);
          this.router.navigate(['/chats']);
        },
        error: (err) => {
          this.toast.error(err?.error?.error?.message || 'Failed to delete chat');
        },
      });
    }
  }
}
