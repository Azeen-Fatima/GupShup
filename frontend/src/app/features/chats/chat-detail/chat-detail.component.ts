import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
  effect,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConversationsService } from '../../../shared/services/conversations.service';
import { MessagesService } from '../../../shared/services/messages.service';
import { UsersService } from '../../../shared/services/users.service';
import { SocketService } from '../../../shared/services/socket.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ChatLockService } from '../../../shared/services/chat-lock.service';
import {
  formatConversationToChatItem,
  formatMessageToChatMessage,
  getInitials,
} from '../../../shared/models/api.models';
import { ChatItem, ChatMessage, MessageAttachment } from '../../../shared/mock/mock-data';
import { processChatImage } from '../../../shared/utils/image-processor';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { BubbleComponent } from '../../../shared/components/bubble/bubble.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-chat-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AvatarComponent,
    SvgIconComponent,
    BubbleComponent,
    ModalComponent,
    EmojiPickerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="chat-detail-screen">
      <!-- Chat Header -->
      <header class="chat-header">
        <a routerLink="/chats" class="back-btn" (click)="onBackClick()" title="Back to chats" aria-label="Back to chats">
          <app-svg-icon name="back" [size]="20"></app-svg-icon>
        </a>

        @if (chat()) {
          <div
            class="header-user-info"
            [class.clickable]="isAcceptedChat()"
            (click)="onHeaderUserClick()"
            [attr.role]="isAcceptedChat() ? 'button' : null"
            [attr.tabindex]="isAcceptedChat() ? 0 : null"
            [title]="isAcceptedChat() ? 'View contact info' : ''"
          >
            <app-avatar
              [avatarUrl]="chat()!.photoUrl"
              [name]="chat()!.name"
              [initials]="chat()!.initials"
              [size]="'md'"
              [showOnlineDot]="((chat()!.rawStatus === 'accepted' || chat()!.isSelfNotes) && chat()!.isOnline) ? true : false"
            ></app-avatar>

            <div class="chat-meta">
              <div class="chat-name-row">
                <h2 class="chat-name">{{ chat()!.name }}</h2>
                @if (chat()!.isLocked) {
                  <span class="header-lock-icon" title="Chat locked">
                    <app-svg-icon name="lock" [size]="14"></app-svg-icon>
                  </span>
                }
              </div>
              <div class="chat-status" [class.online]="(chat()!.rawStatus === 'accepted' || chat()!.isSelfNotes) && (chat()!.isOnline || isTyping())">
                {{ getStatusText() }}
              </div>
            </div>
          </div>

          <!-- Header Kebab Menu Button -->
          <div class="header-menu-wrap" (click)="$event.stopPropagation()">
            <button
              type="button"
              class="header-icon-btn"
              (click)="toggleHeaderMenu($event)"
              [attr.aria-expanded]="headerMenuOpen()"
              title="More chat options"
              aria-label="More chat options"
            >
              <app-svg-icon name="more" [size]="18"></app-svg-icon>
            </button>

            @if (headerMenuOpen()) {
              <div class="ctx-menu-header" role="menu">
                @if (chat()!.isSelfNotes) {
                  <!-- Notes to Self: only Clear chat -->
                  <button type="button" class="menu-item" (click)="promptClearChat()" role="menuitem">
                    Clear chat
                  </button>
                } @else if (chat()!.rawStatus === 'accepted') {
                  <!-- Accepted chats: strictly View profile and Clear chat -->
                  <button type="button" class="menu-item" (click)="viewProfile()" role="menuitem">
                    View profile
                  </button>
                  <button type="button" class="menu-item" (click)="promptClearChat()" role="menuitem">
                    Clear chat
                  </button>
                } @else if (chat()!.isIncomingRequest) {
                  <!-- Received pending: only Block/Unblock -->
                  @if (chat()!.isBlocked) {
                    <button type="button" class="menu-item" (click)="unblockCurrentChat()" role="menuitem">
                      Unblock
                    </button>
                  } @else {
                    <button type="button" class="menu-item danger" (click)="promptBlockChat()" role="menuitem">
                      Block user
                    </button>
                  }
                } @else {
                  <!-- Sender pending, declined, blocked -->
                  @if (chat()!.isBlocked) {
                    <button type="button" class="menu-item" (click)="unblockCurrentChat()" role="menuitem">
                      Unblock
                    </button>
                  } @else {
                    <button type="button" class="menu-item danger" (click)="promptBlockChat()" role="menuitem">
                      Block user
                    </button>
                  }
                  <button type="button" class="menu-item" (click)="promptClearChat()" role="menuitem">
                    Clear chat
                  </button>
                  <button type="button" class="menu-item danger" (click)="promptDeleteChat()" role="menuitem">
                    Delete chat
                  </button>
                }
              </div>
            }
          </div>
        } @else {
          <div class="header-skel-avatar" aria-hidden="true"></div>
          <div class="chat-meta header-skel-meta" aria-hidden="true">
            <div class="header-skel-line" style="width: 110px;"></div>
            <div class="header-skel-line" style="width: 65px; height: 10px;"></div>
          </div>
        }
      </header>

      <!-- Message History Area -->
      <div #messageContainer class="chat-body" (scroll)="onScroll($event)" role="log" aria-live="polite">
        @if (isChatLockedAndProtected()) {
          <div class="chat-locked-panel" role="region" aria-label="Chat locked">
            <div class="lock-shield-circle">
              <app-svg-icon name="lock" [size]="32"></app-svg-icon>
            </div>
            <h3 class="lock-panel-title">Chat Locked</h3>
            <p class="lock-panel-desc">Enter your 4-digit PIN to read messages with {{ chat()?.name }}.</p>

            <div class="pin-entry-container">
              <input
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="4"
                [(ngModel)]="unlockPinInput"
                placeholder="••••"
                class="detail-pin-field"
                (keydown.enter)="submitDetailUnlock()"
              />
            </div>

            @if (unlockPinError()) {
              <p class="detail-pin-error">{{ unlockPinError() }}</p>
            }

            <div class="lock-panel-actions">
              <button type="button" class="detail-cancel-btn" (click)="cancelUnlock()">
                Cancel
              </button>
              <button type="button" class="detail-unlock-btn" (click)="submitDetailUnlock()">
                Unlock
              </button>
            </div>

            <button type="button" class="forgot-pin-btn" (click)="openForgotPinModal()">
              Forgot PIN?
            </button>
          </div>
        } @else if (loadError() === 'error') {
          <div class="chat-error-banner" role="alert">
            <app-svg-icon name="wifi-off" [size]="28"></app-svg-icon>
            <p class="error-msg">Something went wrong. Tap to retry.</p>
            <button type="button" class="retry-load-btn" (click)="retryLoadConversation()">
              Retry
            </button>
          </div>
        } @else if (messages().length === 0) {
          <div class="chat-messages-content empty">
            <app-empty-state
              type="no-messages"
              title="Start the conversation"
            >
              @if (isChatPendingOrLimited()) {
                <p class="empty-sub">Say hello to {{ otherPartyName() }} to send a chat request.</p>
                <p class="empty-sub-muted">You can send 1 message until they accept.</p>
              } @else {
                <p class="empty-sub">Say hello to {{ otherPartyName() }}</p>
              }
            </app-empty-state>

            <!-- Typing indicator in empty chat -->
            @if (isTyping()) {
              <div class="typing-indicator" [attr.aria-label]="chat()?.name + ' is typing'" role="status" style="margin: 12px auto 0;">
                <span></span>
                <span></span>
                <span></span>
              </div>
            }
          </div>
        } @else {
          <div class="chat-messages-content">
            @for (msg of messages(); track msg.id; let idx = $index) {
              <!-- Date separator if first message or date changed -->
              @if (isNewDay(idx)) {
                <div class="date-chip" role="separator">{{ getMessageDay(msg.timestamp) }}</div>
              }

              <app-bubble
                [message]="msg"
                [isPending]="chat()?.isPendingRequest || false"
                (retry)="retrySendMessage($event)"
              ></app-bubble>
            }

            <!-- Typing indicator -->
            @if (isTyping()) {
              <div class="typing-indicator" [attr.aria-label]="chat()!.name + ' is typing'" role="status">
                <span></span>
                <span></span>
                <span></span>
              </div>
            }
          </div>
        }

        <!-- Scroll to bottom button when user scrolled up -->
        @if (showScrollBottomBtn()) {
          <button
            type="button"
            class="scroll-bottom-fab"
            (click)="scrollToBottomSmooth()"
            title="Scroll to bottom"
            aria-label="Scroll to newest messages"
          >
            <app-svg-icon name="down" [size]="18"></app-svg-icon>
          </button>
        }
      </div>

      <!-- Receiver side: Request Action Bar (Accept, Decline, Block) -->
      @if (chat()?.isIncomingRequest && !chat()?.isBlocked) {
        <div class="incoming-request-bar" role="region" aria-label="Chat invitation">
          <div class="request-text">
            <strong>{{ chat()!.name }}</strong> wants to message you
          </div>
          <div class="request-actions">
            <button type="button" class="req-btn accept" (click)="acceptIncoming()">
              Accept
            </button>
            <button type="button" class="req-btn ghost" (click)="declineIncoming()">
              Decline
            </button>
            <button type="button" class="req-btn danger" (click)="blockIncoming()">
              Block
            </button>
          </div>
        </div>
      }

      <!-- Sender side: Notice Bar (Pending, 1st decline extra message, 2nd decline locked) -->
      @if (senderComposerNote(); as note) {
        <div class="pending-notice-bar" role="status">
          <app-svg-icon name="chat" [size]="14"></app-svg-icon>
          <span>{{ note }}</span>
        </div>
      }

      <!-- Attachment Preview Strip (shown above composer when file/image selected) -->
      @if (pendingAttachment(); as att) {
        <div class="attachment-preview-strip">
          @if (att.type === 'image') {
            <img [src]="att.url" alt="Preview" class="preview-thumb" />
          } @else {
            <div class="preview-file-icon">
              <app-svg-icon name="file" [size]="18"></app-svg-icon>
            </div>
          }
          <div class="preview-meta">
            <span class="preview-name">{{ att.name }}</span>
            @if (att.size) {
              <span class="preview-size">{{ att.size }}</span>
            }
          </div>
          <button
            type="button"
            class="remove-att-btn"
            (click)="clearAttachment()"
            title="Remove attachment"
            aria-label="Remove attachment"
          >
            <app-svg-icon name="close" [size]="14"></app-svg-icon>
          </button>
        </div>
      }

      <!-- Attach Popup Menu -->
      @if (attachMenuOpen()) {
        <div class="attach-menu-popup" (click)="$event.stopPropagation()">
          <button type="button" class="attach-item" (click)="triggerFileInput('image')">
            <app-svg-icon name="image" [size]="18"></app-svg-icon>
            <span>Photo</span>
          </button>
          <button type="button" class="attach-item" (click)="triggerFileInput('file')">
            <app-svg-icon name="file" [size]="18"></app-svg-icon>
            <span>Document</span>
          </button>
        </div>
      }

      <!-- Hidden file inputs for Attach -->
      <input
        #imageInput
        type="file"
        accept="image/*"
        style="display: none;"
        (change)="onFileChosen($event, 'image')"
      />
      <input
        #docInput
        type="file"
        accept="*/*"
        style="display: none;"
        (change)="onFileChosen($event, 'file')"
      />

      <!-- Locked Chat (hide composer) -->
      @if (isChatLockedAndProtected()) {
        <!-- Hidden when chat is locked -->
      } @else if (chat()?.isBlocked) {
        <div class="blocked-composer-strip">
          <span>You blocked this user</span>
          <button type="button" class="teal-unblock-btn" (click)="unblockCurrentChat()">
            Unblock
          </button>
        </div>
      } @else if (chat()?.isBlockedByThem) {
        <!-- Blocked after accepted by other user: NEVER show the word blocked -->
        <div class="blocked-composer-strip neutral">
          <span>You can't message this person right now.</span>
        </div>
      } @else {
        <!-- Message Input Composer (Fixed at the bottom of the card) -->
        <form
          class="chat-composer"
          [class.disabled]="isTypingDisabled()"
          (ngSubmit)="sendCurrentMessage()"
          autocomplete="off"
        >
          <!-- Emoji / Keyboard Toggle Button -->
          <button
            type="button"
            class="composer-icon-btn"
            [disabled]="isTypingDisabled()"
            [title]="emojiPickerOpen() ? 'Close emoji picker' : 'Add emoji'"
            [attr.aria-label]="emojiPickerOpen() ? 'Close emoji picker' : 'Add emoji'"
            (pointerdown)="$event.preventDefault()"
            (mousedown)="$event.preventDefault()"
            (click)="toggleEmojiPicker()"
          >
            @if (emojiPickerOpen()) {
              <app-svg-icon name="keyboard" [size]="20"></app-svg-icon>
            } @else {
              <app-svg-icon name="smile" [size]="20"></app-svg-icon>
            }
          </button>

          <!-- Attach Button -->
          <button
            type="button"
            class="composer-icon-btn"
            [disabled]="isAttachDisabled()"
            title="Attach file or photo"
            aria-label="Attach file or photo"
            (click)="toggleAttachMenu($event)"
          >
            <app-svg-icon name="clip" [size]="20"></app-svg-icon>
          </button>

          <input
            #textInput
            type="text"
            name="messageText"
            [(ngModel)]="inputText"
            [disabled]="isTypingDisabled()"
            [placeholder]="composerPlaceholder()"
            class="composer-input"
            aria-label="Type a message"
            [attr.inputmode]="emojiPickerOpen() ? 'none' : 'text'"
            (click)="onInputClick()"
            (focus)="onInputFocus()"
            (input)="onInputChange()"
            (keyup)="updateCursorPos()"
            (select)="updateCursorPos()"
          />

          <button
            type="submit"
            class="send-btn"
            (pointerdown)="$event.preventDefault()"
            (mousedown)="$event.preventDefault()"
            [disabled]="isSendDisabled()"
            title="Send message"
            aria-label="Send message"
          >
            <app-svg-icon name="send" [size]="18"></app-svg-icon>
          </button>
        </form>

        <!-- Standalone Curated Emoji Picker below composer -->
        @if (emojiPickerOpen()) {
          <app-emoji-picker (emojiSelected)="insertEmojiAtCursor($event)"></app-emoji-picker>
        }
      }

      <!-- Modals for Header Actions -->
      <app-modal
        [isOpen]="modalState().isOpen"
        [title]="modalState().title"
        [confirmText]="modalState().confirmText"
        [isDanger]="modalState().isDanger"
        (confirm)="executeModalAction()"
        (cancel)="closeModal()"
      >
        <p>{{ modalState().message }}</p>
      </app-modal>

      <!-- Forgot PIN Modal -->
      @if (forgotPinModalOpen()) {
        <div class="pin-modal-backdrop" (click)="closeForgotPinModal()" role="presentation">
          <div class="pin-modal-card" (click)="$event.stopPropagation()">
            <div class="pin-icon-wrap">
              <app-svg-icon name="shield" [size]="28"></app-svg-icon>
            </div>
            <h3 class="pin-title">Reset Chat Lock PIN</h3>
            @if (isGoogleUser()) {
              <p class="pin-desc">
                Enter a new 4-digit PIN for your locked chats.
              </p>
            } @else {
              <p class="pin-desc">
                Enter your account password and choose a new 4-digit PIN.
              </p>
              <div class="pin-input-wrap">
                <input
                  type="password"
                  [(ngModel)]="resetPasswordInput"
                  placeholder="Account password"
                  class="pin-field"
                />
              </div>
            }

            <div class="pin-input-wrap">
              <input
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="4"
                [(ngModel)]="resetNewPinInput"
                placeholder="New 4-digit PIN"
                class="pin-field"
              />
            </div>

            <div class="pin-input-wrap">
              <input
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="4"
                [(ngModel)]="resetConfirmPinInput"
                placeholder="Confirm new PIN"
                class="pin-field"
              />
            </div>

            @if (resetPinError()) {
              <p class="pin-error">{{ resetPinError() }}</p>
            }

            <div class="pin-actions">
              <button type="button" class="btn-ghost" (click)="closeForgotPinModal()">Cancel</button>
              <button type="button" class="btn-primary" (click)="submitResetPin()">Save & Unlock</button>
            </div>
          </div>
        </div>
      }
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

    .chat-detail-screen {
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

    .chat-header {
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

    .header-user-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;

      &.clickable {
        cursor: pointer;
        border-radius: 8px;
        padding: 4px 6px;
        margin: -4px -6px;
        transition: background-color 0.15s ease;

        &:hover {
          background-color: var(--hover);
        }
      }
    }

    .chat-meta {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .chat-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .chat-name {
      font-size: 15.5px;
      font-weight: 800;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-lock-icon {
      color: var(--amber);
      display: inline-flex;
      align-items: center;
    }

    .chat-status {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 1px;

      &.online {
        color: var(--teal);
        font-weight: 700;
      }
    }

    .header-skel-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background-color: var(--input);
      flex-shrink: 0;
      animation: pulse 1.5s infinite ease-in-out;
    }

    .header-skel-meta {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .header-skel-line {
      height: 14px;
      border-radius: 4px;
      background-color: var(--input);
      animation: pulse 1.5s infinite ease-in-out;
    }

    .header-menu-wrap {
      position: relative;
    }

    .header-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease;

      &:hover {
        color: var(--ink);
        background-color: var(--input);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
      }
    }

    .ctx-menu-header {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      background-color: var(--card);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 6px;
      min-width: 140px;
      z-index: 50;
      animation: popIn 0.15s ease;
    }

    .menu-item {
      display: block;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      padding: 9px 12px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 700;
      color: var(--ink);
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--hover);
      }

      &.danger {
        color: var(--danger);
      }
    }

    /* Message Body: Internal scroll only */
    .chat-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 18px 18px;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .chat-messages-content {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;

      &.empty {
        margin: auto 0;
      }
    }

    .empty-sub {
      font-size: 13.5px;
      color: var(--muted);
      margin: 0;
      line-height: 1.45;
      text-align: center;
    }

    .empty-sub-muted {
      font-size: 11.5px;
      color: var(--muted);
      opacity: 0.85;
      margin: 4px 0 0;
      line-height: 1.4;
      text-align: center;
    }

    .chat-error-banner {
      margin: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
      text-align: center;
      color: var(--muted);

      .error-msg {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--ink);
        margin: 0;
      }

      .retry-load-btn {
        background-color: var(--amber);
        color: var(--on-amber);
        border: none;
        border-radius: 999px;
        padding: 7px 22px;
        font-size: 12.5px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.15s ease;

        &:hover {
          transform: scale(1.04);
        }
      }
    }

    .date-chip {
      align-self: center;
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      background-color: var(--input);
      padding: 4px 14px;
      border-radius: 999px;
      margin: 8px 0 10px;
      user-select: none;
    }

    /* Scroll to bottom FAB */
    .scroll-bottom-fab {
      position: absolute;
      right: 18px;
      bottom: 14px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: var(--card);
      border: 1px solid var(--border);
      color: var(--muted);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 25;
      transition: transform 0.15s ease, color 0.15s ease;

      &:hover {
        color: var(--amber-text);
        transform: translateY(-2px);
      }
    }

    /* Typing indicator */
    .typing-indicator {
      display: inline-flex;
      gap: 4px;
      padding: 12px 16px;
      background-color: var(--bubble-rcv);
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      width: fit-content;
      margin-top: 4px;
      animation: fadeIn 0.2s ease;

      span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--muted);
        opacity: 0.5;
        animation: typingBlink 1.2s infinite ease-in-out;

        &:nth-child(2) {
          animation-delay: 0.15s;
        }
        &:nth-child(3) {
          animation-delay: 0.3s;
        }
      }
    }

    @keyframes typingBlink {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    /* Request bars */
    .pending-notice-bar {
      padding: 8px 14px;
      background-color: var(--input);
      color: var(--muted);
      font-size: 11.5px;
      font-weight: 700;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .incoming-request-bar {
      padding: 12px 16px;
      background-color: var(--input);
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .request-text {
      font-size: 13px;
      color: var(--ink);
      text-align: center;
    }

    .request-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .req-btn {
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.15s ease;

      &.accept {
        background-color: var(--teal);
        color: #FFFFFF;
        border: none;
      }

      &.ghost {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--ink);
      }

      &.danger {
        background: transparent;
        border: 1px solid var(--danger);
        color: var(--danger);
      }
    }

    /* Blocked User Strip */
    .blocked-composer-strip {
      padding: 14px;
      border-top: 1px solid var(--border);
      background-color: var(--input);
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;

      &.neutral {
        justify-content: center;
        text-align: center;
      }
    }

    .teal-unblock-btn {
      border: 1.5px solid var(--teal);
      color: var(--teal);
      background: transparent;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;

      &:hover {
        background-color: rgba(79, 169, 160, 0.1);
      }
    }

    /* Attachment Preview Strip */
    .attachment-preview-strip {
      padding: 8px 16px;
      background-color: var(--input);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      animation: fadeIn 0.2s ease;
    }

    .preview-thumb {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      object-fit: cover;
    }

    .preview-file-icon {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background-color: var(--card);
      color: var(--amber-text);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .preview-name {
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--ink);
    }

    .preview-size {
      font-size: 10.5px;
      color: var(--muted);
    }

    .remove-att-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: var(--card);
      border: 1px solid var(--border);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      &:hover {
        color: var(--danger);
      }
    }

    /* Attach Popup Menu */
    .attach-menu-popup {
      position: absolute;
      bottom: 64px;
      left: 48px;
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
      display: flex;
      flex-direction: column;
      z-index: 60;
      animation: popIn 0.15s ease;
    }

    .attach-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: none;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--ink);
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background-color: var(--hover);
      }
    }

    /* Composer: Fixed at bottom of card */
    .chat-composer {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: var(--card);
      flex-shrink: 0;

      &.disabled {
        opacity: 0.65;
      }
    }

    .composer-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease;

      &:hover:not(:disabled) {
        color: var(--ink);
        background-color: var(--input);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    .composer-input {
      flex: 1;
      min-width: 0;
      padding: 11px 16px;
      border-radius: 999px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      font-size: 13.5px;
      color: var(--ink);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &::placeholder {
        color: var(--muted);
        opacity: 0.7;
      }

      &:focus,
      &:focus-visible {
        outline: none !important;
        border-color: var(--amber) !important;
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.25) !important;
      }
    }

    .send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background-color: var(--amber);
      color: var(--on-amber); /* #2E2A26 - always dark charcoal */
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.15s ease, box-shadow 0.2s ease;

      &:hover:not(:disabled) {
        transform: scale(1.06);
        box-shadow: 0 4px 12px rgba(232, 162, 61, 0.35);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    @keyframes popIn {
      from {
        opacity: 0;
        transform: scale(0.92) translateY(-4px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .chat-locked-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: auto;
      max-width: 320px;
      width: 100%;
      padding: 32px 20px;
      text-align: center;
      background-color: var(--input);
      border: 1px solid var(--border);
      border-radius: 20px;
      animation: fadeIn 0.2s ease;
    }

    .lock-shield-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: rgba(232, 162, 61, 0.15);
      color: var(--amber-text);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .lock-panel-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--ink);
      margin: 0 0 6px;
    }

    .lock-panel-desc {
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 20px;
      line-height: 1.4;
    }

    .pin-entry-container {
      width: 100%;
      max-width: 180px;
      margin-bottom: 12px;
    }

    .detail-pin-field {
      width: 100%;
      text-align: center;
      letter-spacing: 0.35em;
      font-size: 24px;
      font-weight: 700;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--card);
      color: var(--ink);
      outline: none;

      &:focus {
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.2);
      }
    }

    .detail-pin-error {
      font-size: 12px;
      color: var(--danger);
      margin: 0 0 12px;
      font-weight: 600;
    }

    .lock-panel-actions {
      display: flex;
      gap: 8px;
      width: 100%;
      max-width: 220px;
      margin-bottom: 12px;
    }

    .detail-cancel-btn {
      flex: 1;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background-color: var(--input);
      color: var(--ink);
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--hover);
      }
    }

    .detail-unlock-btn {
      flex: 1;
      padding: 10px 14px;
      border-radius: 999px;
      border: none;
      background-color: var(--amber);
      color: var(--on-amber);
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(232, 162, 61, 0.3);
      }
    }

    .forgot-pin-btn {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      padding: 4px 8px;

      &:hover {
        color: var(--amber-text);
      }
    }

    /* Modal Backdrop and Card for Reset PIN */
    .pin-modal-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.2s ease;
    }

    .pin-modal-card {
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px 20px;
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
      animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .pin-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background-color: rgba(232, 162, 61, 0.15);
      color: var(--amber-text);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
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
      margin-bottom: 12px;
    }

    .pin-field {
      width: 100%;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      color: var(--ink);
      font-size: 14px;
      outline: none;
      box-sizing: border-box;

      &:focus {
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.2);
      }
    }

    .pin-error {
      font-size: 12px;
      color: var(--danger);
      margin: 0 0 12px;
      font-weight: 600;
    }

    .pin-actions {
      display: flex;
      gap: 10px;
      width: 100%;
      margin-top: 6px;

      button {
        flex: 1;
        padding: 10px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        transition: transform 0.15s ease, background-color 0.15s ease;
      }

      .btn-ghost {
        background-color: var(--input);
        color: var(--ink);
        &:hover { background-color: var(--hover); }
      }

      .btn-primary {
        background-color: var(--amber);
        color: var(--on-amber);
        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(232, 162, 61, 0.3);
        }
      }
    }
  `],
})
export class ChatDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly conversationsService = inject(ConversationsService);
  private readonly messagesService = inject(MessagesService);
  private readonly usersService = inject(UsersService);
  private readonly socketService = inject(SocketService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly chatLockService = inject(ChatLockService);

  @ViewChild('messageContainer') messageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('textInput') textInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('docInput') docInputRef!: ElementRef<HTMLInputElement>;

  readonly chatId = signal<string>('');
  readonly inputText = signal<string>('');
  readonly isTyping = signal<boolean>(false);
  readonly showScrollBottomBtn = signal<boolean>(false);
  readonly loadError = signal<'not_found' | 'error' | null>(null);

  readonly headerMenuOpen = signal<boolean>(false);
  readonly attachMenuOpen = signal<boolean>(false);
  readonly emojiPickerOpen = signal<boolean>(false);
  readonly pendingAttachment = signal<MessageAttachment | null>(null);
  readonly pendingAttachmentFile = signal<File | null>(null);

  readonly chat = signal<ChatItem | null>(null);
  readonly messages = signal<ChatMessage[]>([]);

  readonly unlockPinInput = signal<string>('');
  readonly unlockPinError = signal<string>('');
  readonly forgotPinModalOpen = signal<boolean>(false);
  resetPasswordInput = '';
  resetNewPinInput = '';
  resetConfirmPinInput = '';
  readonly resetPinError = signal<string>('');
  private expirationInterval: any = null;

  readonly isAcceptedChat = computed(() => {
    const c = this.chat();
    return !!c && c.rawStatus === 'accepted' && !c.isSelfNotes;
  });

  readonly isChatLockedAndProtected = computed(() => {
    const c = this.chat();
    if (!c || !c.isLocked) return false;
    return !this.chatLockService.isUnlocked(this.chatId());
  });

  readonly senderComposerNote = computed(() => {
    const c = this.chat();
    if (!c || c.isSelfNotes || c.isIncomingRequest || c.isBlocked || c.isBlockedByThem) {
      return null;
    }

    if (c.isDeclined) {
      if (c.canSendExtraMessage) {
        return 'Request was declined. You can now send 1 more message.';
      }
      return 'Request declined. You can message again if they accept.';
    }

    if (c.isPendingRequest) {
      if (this.messages().length >= 1) {
        return `Waiting for ${c.name} to accept your request. You can only send one message until they accept.`;
      }
    }

    return null;
  });

  readonly otherPartyName = computed(() => {
    const c = this.chat();
    if (!c) return 'there';
    if (c.isSelfNotes) return 'yourself';
    return c.name;
  });

  readonly isChatPendingOrLimited = computed(() => {
    const c = this.chat();
    if (!c) {
      return this.chatId().startsWith('new-');
    }
    if (c.isSelfNotes) return false;
    if (this.chatId().startsWith('new-')) return true;
    if (c.rawStatus === 'accepted' || c.rawState === 'normal') return false;
    if (c.isPendingRequest || c.rawStatus === 'pending' || c.rawState === 'pending_sent') return true;
    return false;
  });

  readonly isTypingDisabled = computed(() => {
    if (this.isChatLockedAndProtected()) return true;
    const c = this.chat();
    if (!c) {
      return !this.chatId().startsWith('new-');
    }
    if (c.isIncomingRequest || c.isBlocked || c.isBlockedByThem) return true;
    if (c.isDeclined) {
      return !c.canSendExtraMessage;
    }
    if (c.isPendingRequest) {
      return this.messages().length >= 1;
    }
    return false;
  });

  readonly isAttachDisabled = computed(() => {
    return this.isTypingDisabled();
  });

  readonly isSendDisabled = computed(() => {
    if (this.isTypingDisabled()) return true;
    return !this.inputText().trim() && !this.pendingAttachment();
  });

  readonly composerPlaceholder = computed(() => {
    const c = this.chat();
    if (!c) return 'Type a message…';
    if (c.isIncomingRequest) return 'Accept invitation to reply…';
    if (c.isBlockedByThem) return "You can't message this person right now.";
    if (c.isDeclined && !c.canSendExtraMessage) return 'Request declined. You can message again if they accept.';
    if (c.isPendingRequest && this.messages().length >= 1) return 'You can only send one message until they accept.';
    return 'Type a message…';
  });

  private lastSelectionStart = 0;
  private lastSelectionEnd = 0;
  private typingStopTimer: any = null;
  private subscriptions: Subscription[] = [];

  // Modal dialog state
  readonly modalState = signal<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger: boolean;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDanger: false,
    onConfirm: null,
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.chatId.set(id);
        this.conversationsService.activeConversationId.set(id);
        this.pendingAttachment.set(null);
        this.pendingAttachmentFile.set(null);
        this.emojiPickerOpen.set(false);
        this.isTyping.set(false);
        this.loadError.set(null);

        if (id.startsWith('new-')) {
          this.setupDraftChat(id.replace('new-', ''));
        } else {
          this.loadConversation(id);
        }
      }
    });

    this.setupSocketListeners();
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.expirationInterval = setInterval(() => {
      const now = Date.now();
      this.messages.update((list) => {
        const hasExpired = list.some((m) => m.expiresAt && new Date(m.expiresAt).getTime() <= now);
        if (!hasExpired) return list;
        return list.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now);
      });
    }, 5000);
  }

  private onVisibilityChange = () => {
    const id = this.chatId();
    if (document.hidden) {
      this.conversationsService.activeConversationId.set(null);
      if (this.chat()?.isLocked || (id && this.chatLockService.isUnlocked(id))) {
        this.chatLockService.relock(id).subscribe();
        this.messages.set([]);
      }
    } else {
      if (id) {
        this.conversationsService.activeConversationId.set(id);
        if (this.chat()?.isLocked && !this.chatLockService.isUnlocked(id)) {
          this.messages.set([]);
          return;
        }
        if (!id.startsWith('new-')) {
          this.messagesService.markSeen(id).subscribe();
          this.socketService.markRead(id);
        }
      }
    }
  };

  private setupDraftChat(targetUserId: string): void {
    this.messages.set([]);
    this.loadError.set(null);

    // 1. Immediately hydrate from cache if available (e.g. clicked from Find People)
    const cached = this.usersService.getDraftUser();
    if (cached && cached.id === targetUserId) {
      this.chat.set({
        id: `new-${targetUserId}`,
        otherUserId: targetUserId,
        name: cached.name,
        username: `@${cached.username}`,
        initials: getInitials(cached.name),
        isOnline: false,
        lastSeen: null,
        lastMessage: '',
        time: '',
        unreadCount: 0,
        isPendingRequest: true,
        photoUrl: cached.avatarUrl,
        rawStatus: 'pending',
        rawState: 'pending_sent',
      });
    }

    // 2. Fetch fresh user profile + presence from backend
    this.usersService.getUserById(targetUserId).subscribe({
      next: (user) => {
        this.chat.set({
          id: `new-${targetUserId}`,
          otherUserId: targetUserId,
          name: user.name,
          username: `@${user.username}`,
          initials: getInitials(user.name),
          isOnline: !!user.isOnline,
          lastSeen: user.lastSeen || null,
          lastMessage: '',
          time: '',
          unreadCount: 0,
          isPendingRequest: true,
          photoUrl: user.avatarUrl,
          rawStatus: 'pending',
          rawState: 'pending_sent',
        });
      },
      error: (err: HttpErrorResponse) => {
        if (err?.status === 404) {
          this.toast.error('User not found');
          this.router.navigate(['/chats']);
        }
      },
    });
  }

  loadConversation(id: string): void {
    this.loadError.set(null);
    const myId = this.authService.currentUser()?.id;
    const myAvatar = this.authService.currentUser()?.avatarUrl;

    // Load conversation metadata
    this.conversationsService.getConversationById(id).subscribe({
      next: (conv) => {
        const item = formatConversationToChatItem(conv, myId, myAvatar);
        this.chat.set(item);

        if (item.isLocked && !this.chatLockService.isUnlocked(id)) {
          this.messages.set([]);
          return;
        }

        this.fetchMessages(id);
      },
      error: (err: HttpErrorResponse) => {
        if (err?.status === 404) {
          this.loadError.set('not_found');
          this.toast.error('Conversation not found');
          this.router.navigate(['/chats']);
        } else {
          this.loadError.set('error');
        }
      },
    });
  }

  fetchMessages(id: string): void {
    const myId = this.authService.currentUser()?.id;
    this.messagesService.getMessages(id).subscribe({
      next: (res) => {
        const msgs = res.messages.map((m) => formatMessageToChatMessage(m, myId));
        this.messages.set(msgs);
        this.scrollToBottom();

        // Mark as read
        this.messagesService.markSeen(id).subscribe();
      },
      error: (err: HttpErrorResponse) => {
        if (err?.status === 403 && (err?.error?.error?.code === 'CHAT_LOCKED' || err?.error?.code === 'CHAT_LOCKED')) {
          this.chat.update((c) => (c ? { ...c, isLocked: true } : c));
          this.messages.set([]);
          return;
        }
        if (err?.status !== 404 && !this.chat()) {
          this.loadError.set('error');
        }
      },
    });
  }

  retryLoadConversation(): void {
    const id = this.chatId();
    if (id && !id.startsWith('new-')) {
      this.loadConversation(id);
    }
  }

  /**
   * Upsert message ensuring deduplication (E1, B3) by clientId and message id
   */
  private upsertMessage(msg: ChatMessage, tempIdToReplace?: string): void {
    this.messages.update((list) => {
      const matchClientId = tempIdToReplace || msg.clientId;

      // 1. If tempIdToReplace or msg.clientId is present, replace matching temp message
      if (matchClientId) {
        const tempIdx = list.findIndex(
          (m) => m.id === matchClientId || (m.clientId && m.clientId === matchClientId)
        );
        if (tempIdx !== -1) {
          const copy = [...list];
          copy[tempIdx] = { ...msg, clientId: matchClientId };
          return copy;
        }
      }

      // 2. If message id already exists, update in-place
      const existingIdx = list.findIndex((m) => m.id === msg.id);
      if (existingIdx !== -1) {
        const copy = [...list];
        copy[existingIdx] = { ...copy[existingIdx], ...msg };
        return copy;
      }

      // 3. Fallback matching for pending optimistic messages from 'me'
      if (msg.sender === 'me') {
        const pendingIdx = list.findIndex(
          (m) =>
            m.status === 'pending' &&
            m.sender === 'me' &&
            ((msg.clientId && m.clientId === msg.clientId) ||
              (m.text === msg.text && (!m.attachment || m.attachment.name === msg.attachment?.name)))
        );
        if (pendingIdx !== -1) {
          const copy = [...list];
          copy[pendingIdx] = msg;
          return copy;
        }
      }

      return [...list, msg];
    });
  }

  private setupSocketListeners(): void {
    // 1. Real-time incoming messages
    this.subscriptions.push(
      this.socketService.messageNew$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          const myId = this.authService.currentUser()?.id;
          const formatted = formatMessageToChatMessage(data.message, myId);
          this.upsertMessage(formatted, data.message.clientId || undefined);

          if (data.message.senderId === myId) {
            this.scrollToBottom();
          } else {
            if (!this.showScrollBottomBtn()) {
              this.scrollToBottomSmooth();
            }
            if (!document.hidden) {
              this.messagesService.markSeen(this.chatId()).subscribe();
              this.socketService.markRead(this.chatId());
            }
          }
        }
      })
    );

    // 2. Real-time delivered receipts
    this.subscriptions.push(
      this.socketService.messageDelivered$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          this.messages.update((list) =>
            list.map((m) => {
              if (m.sender === 'me' && (m.status === 'sent' || m.status === 'pending')) {
                if (
                  (data.messageId && m.id === data.messageId) ||
                  (data.clientId && m.clientId === data.clientId) ||
                  !data.messageId
                ) {
                  return { ...m, status: 'delivered' as const };
                }
              }
              return m;
            })
          );
        }
      })
    );

    // 3. Real-time seen receipts
    this.subscriptions.push(
      this.socketService.messageSeen$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          this.messages.update((list) =>
            list.map((m) =>
              m.sender === 'me' ? { ...m, status: 'seen' as const } : m
            )
          );
        }
      })
    );

    this.subscriptions.push(
      this.socketService.messageRead$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          this.messages.update((list) =>
            list.map((m) =>
              m.sender === 'me' ? { ...m, status: 'seen' as const } : m
            )
          );
        }
      })
    );

    // 4. Real-time typing indicators (only for accepted chats)
    this.subscriptions.push(
      this.socketService.typingUpdate$.subscribe((data) => {
        const myId = this.authService.currentUser()?.id;
        if (data.userId === myId) return;

        const currentChat = this.chat();
        if (currentChat && currentChat.rawStatus !== 'accepted' && !currentChat.isSelfNotes) {
          return;
        }

        const otherUserId =
          currentChat?.otherUserId ||
          (this.chatId().startsWith('new-') ? this.chatId().replace('new-', '') : null);

        if (
          data.conversationId === this.chatId() ||
          (otherUserId && (data.userId === otherUserId || data.conversationId === `new-${otherUserId}`))
        ) {
          this.isTyping.set(data.isTyping);
        }
      })
    );

    // 5. Real-time presence updates (only for accepted chats)
    this.subscriptions.push(
      this.socketService.presenceUpdate$.subscribe((data) => {
        const currentChat = this.chat();
        if (currentChat && !currentChat.isSelfNotes && currentChat.rawStatus === 'accepted') {
          const otherUserId =
            currentChat.otherUserId ||
            (this.chatId().startsWith('new-') ? this.chatId().replace('new-', '') : null);

          if (otherUserId && data.userId === otherUserId) {
            this.chat.update((c) =>
              c
                ? {
                    ...c,
                    isOnline: data.isOnline,
                    lastSeen: data.lastSeen !== undefined ? data.lastSeen : c.lastSeen,
                  }
                : null
            );
          }
        }
      })
    );

    // 6. Real-time user profile updates (D4)
    this.subscriptions.push(
      this.socketService.userUpdated$.subscribe((data) => {
        const currentChat = this.chat();
        if (currentChat && !currentChat.isSelfNotes) {
          if (
            currentChat.id === data.id ||
            currentChat.name === data.name ||
            this.chatId().includes(data.id)
          ) {
            this.chat.update((c) =>
              c ? { ...c, name: data.name, photoUrl: data.avatarUrl } : null
            );
          }
        }
      })
    );

    // 7. Real-time conversation and request state updates
    this.subscriptions.push(
      this.socketService.conversationUpdated$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          this.reloadConversationMetadata();
        }
      })
    );

    this.subscriptions.push(
      this.socketService.requestAccepted$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          this.reloadConversationMetadata();
        }
      })
    );

    this.subscriptions.push(
      this.socketService.requestDeclined$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          this.reloadConversationMetadata();
        }
      })
    );

    // 8. Real-time message expiration
    this.subscriptions.push(
      this.socketService.messageExpired$.subscribe((data) => {
        if (data.conversationId === this.chatId()) {
          const expiredSet = new Set(data.messageIds);
          this.messages.update((list) => list.filter((m) => !expiredSet.has(m.id)));
        }
      })
    );

    // 9. Reconnect catch-up sync
    this.subscriptions.push(
      this.socketService.reconnected$.subscribe(() => {
        const id = this.chatId();
        if (id && !id.startsWith('new-')) {
          this.loadConversation(id);
        }
      })
    );
  }

  private reloadConversationMetadata(): void {
    const id = this.chatId();
    if (!id || id.startsWith('new-')) return;
    const myId = this.authService.currentUser()?.id;
    const myAvatar = this.authService.currentUser()?.avatarUrl;
    this.conversationsService.getConversationById(id).subscribe({
      next: (conv) => {
        this.chat.set(formatConversationToChatItem(conv, myId, myAvatar));
      },
      error: () => {},
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.headerMenuOpen.set(false);
    this.attachMenuOpen.set(false);
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.headerMenuOpen.set(false);
    this.attachMenuOpen.set(false);
    this.emojiPickerOpen.set(false);
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.showScrollBottomBtn.set(fromBottom > 120);
  }

  scrollToBottomSmooth(): void {
    if (this.messageContainer?.nativeElement) {
      const el = this.messageContainer.nativeElement;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }

  getStatusText(): string {
    const c = this.chat();
    if (!c) return '';
    if (c.isSelfNotes) {
      return 'Message yourself';
    }
    // Only show presence / typing if conversation is accepted
    if (c.rawStatus !== 'accepted') {
      return '';
    }
    if (this.isTyping()) {
      return 'typing...';
    }
    if (c.isOnline) {
      return 'Online';
    }
    if (c.lastSeen) {
      return this.formatLastSeen(c.lastSeen);
    }
    return '';
  }

  private formatLastSeen(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Offline';

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) {
      return `Last seen at ${timeStr}`;
    }
    if (isYesterday) {
      return `Last seen yesterday at ${timeStr}`;
    }
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `Last seen ${dateStr} at ${timeStr}`;
  }

  isNewDay(idx: number): boolean {
    if (idx === 0) return true;
    const msgs = this.messages();
    const prevDay = this.getMessageDay(msgs[idx - 1].timestamp);
    const currDay = this.getMessageDay(msgs[idx].timestamp);
    return prevDay !== currDay;
  }

  getMessageDay(isoTimestamp: string): string {
    const d = new Date(isoTimestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  toggleHeaderMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.headerMenuOpen.update((o) => !o);
  }

  toggleAttachMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isChatPendingOrLimited()) {
      this.toast.info('Attachments are not allowed until your chat request is accepted.');
      return;
    }
    this.attachMenuOpen.update((o) => !o);
  }

  toggleEmojiPicker(): void {
    this.updateCursorPos();
    const willOpen = !this.emojiPickerOpen();
    this.emojiPickerOpen.set(willOpen);
    this.attachMenuOpen.set(false);
    if (willOpen) {
      this.textInputRef?.nativeElement?.blur();
    } else {
      setTimeout(() => {
        const inputEl = this.textInputRef?.nativeElement;
        if (inputEl) {
          inputEl.focus();
          inputEl.setSelectionRange?.(this.lastSelectionStart, this.lastSelectionEnd);
        }
      }, 50);
    }
    this.scrollToBottom();
  }

  onInputClick(): void {
    this.updateCursorPos();
    if (this.emojiPickerOpen()) {
      this.emojiPickerOpen.set(false);
      setTimeout(() => {
        const inputEl = this.textInputRef?.nativeElement;
        if (inputEl) {
          inputEl.focus();
          inputEl.setSelectionRange?.(this.lastSelectionStart, this.lastSelectionEnd);
        }
        this.scrollToBottom();
      }, 50);
    }
  }

  onInputFocus(): void {
    this.updateCursorPos();
    if (this.emojiPickerOpen()) {
      this.emojiPickerOpen.set(false);
      this.scrollToBottom();
    }
  }

  onInputChange(): void {
    this.updateCursorPos();
    const id = this.chatId();
    const recipientId =
      this.chat()?.otherUserId || (id.startsWith('new-') ? id.replace('new-', '') : undefined);

    this.socketService.startTyping(id, recipientId);
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = setTimeout(() => {
      this.socketService.stopTyping(id, recipientId);
    }, 3000);
  }

  updateCursorPos(): void {
    const inputEl = this.textInputRef?.nativeElement;
    if (inputEl) {
      this.lastSelectionStart = inputEl.selectionStart ?? this.inputText().length;
      this.lastSelectionEnd = inputEl.selectionEnd ?? this.inputText().length;
    }
  }

  insertEmojiAtCursor(emoji: string): void {
    const current = this.inputText();
    let start = this.lastSelectionStart;
    let end = this.lastSelectionEnd;

    if (start < 0 || start > current.length) {
      start = current.length;
    }
    if (end < start || end > current.length) {
      end = start;
    }

    const updated = current.substring(0, start) + emoji + current.substring(end);
    this.inputText.set(updated);

    const newPos = start + emoji.length;
    this.lastSelectionStart = newPos;
    this.lastSelectionEnd = newPos;

    const inputEl = this.textInputRef?.nativeElement;
    if (inputEl) {
      inputEl.setSelectionRange?.(newPos, newPos);
    }

    this.onInputChange();
    this.scrollToBottom();
  }

  triggerFileInput(type: 'image' | 'file'): void {
    this.attachMenuOpen.set(false);
    if (this.isChatPendingOrLimited()) {
      this.toast.info('Attachments are not allowed until your chat request is accepted.');
      return;
    }
    if (type === 'image') {
      this.imageInputRef?.nativeElement?.click();
    } else {
      this.docInputRef?.nativeElement?.click();
    }
  }

  async onFileChosen(event: Event, type: 'image' | 'file'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.isChatPendingOrLimited()) {
      this.toast.info('Attachments are not allowed until your chat request is accepted.');
      input.value = '';
      return;
    }

    try {
      let processedFile = file;
      if (type === 'image') {
        processedFile = await processChatImage(file);
      } else if (file.size > 5 * 1024 * 1024) {
        this.toast.error('File must be smaller than 5 MB');
        input.value = '';
        return;
      }

      this.pendingAttachmentFile.set(processedFile);
      const url = URL.createObjectURL(processedFile);
      const sizeStr = (processedFile.size / (1024 * 1024)).toFixed(1) + ' MB';

      this.pendingAttachment.set({
        type,
        url,
        name: processedFile.name,
        size: sizeStr,
      });
    } catch (err: any) {
      this.toast.error(err?.message || 'Invalid attachment');
    } finally {
      input.value = '';
    }
  }

  clearAttachment(): void {
    this.pendingAttachment.set(null);
    this.pendingAttachmentFile.set(null);
  }

  sendCurrentMessage(): void {
    const text = this.inputText().trim();
    const attFile = this.pendingAttachmentFile();
    const att = this.pendingAttachment();

    if (!text && !attFile && !att) return;

    const currentId = this.chatId();
    this.inputText.set('');
    this.pendingAttachment.set(null);
    this.pendingAttachmentFile.set(null);
    this.lastSelectionStart = 0;
    this.lastSelectionEnd = 0;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      clientId: tempId,
      chatId: currentId,
      text,
      sender: 'me',
      timestamp: new Date().toISOString(),
      timeString: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      status: 'pending',
      attachment: att || undefined,
    };

    // Add optimistic bubble with sending clock icon
    this.upsertMessage(optimisticMsg);
    this.scrollToBottom();

    if (!this.emojiPickerOpen()) {
      setTimeout(() => {
        this.textInputRef?.nativeElement?.focus();
      }, 10);
    }

    // Handle draft conversation (initiating to a new user)
    if (currentId.startsWith('new-')) {
      const recipientId = currentId.replace('new-', '');

      if (attFile) {
        this.messagesService.uploadAttachment(attFile).subscribe({
          next: (uploadRes) => {
            this.createAndSendConv(
              recipientId,
              text,
              tempId,
              {
                type: 'image',
                url: uploadRes.url,
                name: attFile.name,
              }
            );
          },
          error: (err) => {
            this.markMessageFailed(tempId);
            this.toast.error(err?.error?.error?.message || 'Attachment upload failed');
          },
        });
      } else {
        this.createAndSendConv(recipientId, text, tempId);
      }
      return;
    }

    // Normal message sending
    if (attFile) {
      this.messagesService.uploadAttachment(attFile).subscribe({
        next: (uploadRes) => {
          this.executeSendMessage(
            currentId,
            {
              body: text,
              type: 'image',
              attachmentUrl: uploadRes.url,
              attachmentName: attFile.name,
            },
            tempId
          );
        },
        error: (err) => {
          this.markMessageFailed(tempId);
          this.toast.error(err?.error?.error?.message || 'Attachment upload failed');
        },
      });
    } else {
      this.executeSendMessage(currentId, { body: text }, tempId);
    }
  }

  private createAndSendConv(recipientId: string, text: string, tempId: string, attachment?: any): void {
    this.conversationsService.createConversation(recipientId, text, attachment, tempId).subscribe({
      next: (res) => {
        const myId = this.authService.currentUser()?.id;
        const formatted = formatMessageToChatMessage(res.message, myId);
        this.upsertMessage(formatted, tempId);
        this.toast.success('Message sent!');
        this.router.navigate(['/chats', res.conversationId], { replaceUrl: true });
      },
      error: (err) => {
        this.markMessageFailed(tempId);
        this.handleMessageError(err);
      },
    });
  }

  private executeSendMessage(conversationId: string, payload: any, tempId?: string): void {
    const finalPayload = { ...payload, ...(tempId ? { clientId: tempId } : {}) };
    this.messagesService.sendMessage(conversationId, finalPayload).subscribe({
      next: (msg) => {
        const myId = this.authService.currentUser()?.id;
        const formatted = formatMessageToChatMessage(msg, myId);
        this.upsertMessage(formatted, tempId);
        this.scrollToBottom();
      },
      error: (err) => {
        if (tempId) {
          this.markMessageFailed(tempId);
        }
        this.handleMessageError(err);
      },
    });
  }

  private handleMessageError(err: any): void {
    const code = err?.error?.error?.code || err?.error?.code;
    const message = err?.error?.error?.message || err?.error?.message;

    if (code === 'REQUEST_PENDING_LIMIT') {
      this.toast.error('You can only send one message until they accept.');
    } else if (code === 'REQUEST_DECLINED') {
      this.toast.error('Request declined. You can message again if they accept.');
    } else if (code === 'ATTACHMENTS_NOT_ALLOWED') {
      this.toast.error('Attachments are not allowed for message requests.');
    } else if (code === 'USER_BLOCKED') {
      this.toast.error("You can't message this person right now.");
    } else {
      this.toast.error(message || 'Failed to send message');
    }
  }

  private markMessageFailed(tempId: string): void {
    this.messages.update((list) =>
      list.map((m) => (m.id === tempId ? { ...m, status: 'failed' as const } : m))
    );
  }

  retrySendMessage(msg: ChatMessage): void {
    const currentId = this.chatId();
    if (!currentId || currentId.startsWith('new-')) return;

    // Mark back to pending
    this.messages.update((list) =>
      list.map((m) => (m.id === msg.id ? { ...m, status: 'pending' as const } : m))
    );

    const payload: any = { body: msg.text };
    if (msg.attachment) {
      payload.type = msg.attachment.type;
      payload.attachmentUrl = msg.attachment.url;
      payload.attachmentName = msg.attachment.name;
    }

    this.executeSendMessage(currentId, payload, msg.clientId || msg.id);
  }

  // Request actions (Incoming)
  acceptIncoming(): void {
    this.conversationsService.acceptConversation(this.chatId()).subscribe({
      next: () => {
        this.chat.update((c) => (c ? { ...c, isIncomingRequest: false, isPendingRequest: false } : null));
        this.toast.success('Chat request accepted');
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to accept chat request');
      },
    });
  }

  declineIncoming(): void {
    this.conversationsService.declineConversation(this.chatId()).subscribe({
      next: () => {
        this.toast.info('Declined chat request');
        this.router.navigate(['/chats']);
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to decline chat request');
      },
    });
  }

  blockIncoming(): void {
    this.conversationsService.blockUser(this.chatId()).subscribe({
      next: () => {
        this.chat.update((c) => (c ? { ...c, isBlocked: true } : null));
        this.toast.info('User blocked');
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to block user');
      },
    });
  }

  unblockCurrentChat(): void {
    this.conversationsService.unblockUser(this.chatId()).subscribe({
      next: () => {
        this.chat.update((c) => (c ? { ...c, isBlocked: false } : null));
        this.toast.success('User unblocked');
      },
      error: (err) => {
        this.toast.error(err?.error?.error?.message || 'Failed to unblock user');
      },
    });
  }

  // Header Menu Prompts with Modal
  promptClearChat(): void {
    this.headerMenuOpen.set(false);
    const name = this.chat()?.name || 'this conversation';
    this.modalState.set({
      isOpen: true,
      title: 'Clear chat?',
      message: `Are you sure you want to clear all messages with ${name}?`,
      confirmText: 'Clear',
      isDanger: false,
      onConfirm: () => {
        this.conversationsService.clearHistory(this.chatId()).subscribe({
          next: () => {
            this.messages.set([]);
            this.toast.info('Conversation cleared');
          },
          error: (err) => {
            this.toast.error(err?.error?.error?.message || 'Failed to clear chat');
          },
        });
      },
    });
  }

  promptDeleteChat(): void {
    this.headerMenuOpen.set(false);
    const name = this.chat()?.name || 'this chat';
    this.modalState.set({
      isOpen: true,
      title: 'Delete chat?',
      message: `Delete chat with ${name}? This action will hide the conversation until a new message arrives.`,
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: () => {
        this.conversationsService.deleteConversation(this.chatId()).subscribe({
          next: () => {
            this.toast.info(`Deleted chat with ${name}`);
            this.router.navigate(['/chats']);
          },
          error: (err) => {
            this.toast.error(err?.error?.error?.message || 'Failed to delete chat');
          },
        });
      },
    });
  }

  promptBlockChat(): void {
    this.headerMenuOpen.set(false);
    const name = this.chat()?.name || 'this user';
    this.modalState.set({
      isOpen: true,
      title: 'Block user?',
      message: `Block ${name}? They will no longer be able to message you directly.`,
      confirmText: 'Block',
      isDanger: true,
      onConfirm: () => {
        this.conversationsService.blockUser(this.chatId()).subscribe({
          next: () => {
            this.chat.update((c) => (c ? { ...c, isBlocked: true } : null));
            this.toast.info(`Blocked ${name}`);
          },
          error: (err) => {
            this.toast.error(err?.error?.error?.message || 'Failed to block user');
          },
        });
      },
    });
  }

  executeModalAction(): void {
    const s = this.modalState();
    if (s.onConfirm) {
      s.onConfirm();
    }
    this.closeModal();
  }

  closeModal(): void {
    this.modalState.update((s) => ({ ...s, isOpen: false, onConfirm: null }));
  }

  private scrollToBottom(): void {
    const scroll = () => {
      if (this.messageContainer?.nativeElement) {
        const el = this.messageContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    };
    scroll();
    setTimeout(scroll, 50);
  }

  onHeaderUserClick(): void {
    if (this.isAcceptedChat()) {
      const id = this.chatId();
      if (this.chat()?.isLocked || (id && this.chatLockService.isUnlocked(id))) {
        this.chatLockService.relock(id).subscribe();
      }
      this.messages.set([]);
      this.router.navigate(['/chats', id, 'info']);
    }
  }

  viewProfile(): void {
    this.headerMenuOpen.set(false);
    if (this.isAcceptedChat()) {
      const id = this.chatId();
      if (this.chat()?.isLocked || (id && this.chatLockService.isUnlocked(id))) {
        this.chatLockService.relock(id).subscribe();
      }
      this.messages.set([]);
      this.router.navigate(['/chats', id, 'info']);
    }
  }

  onBackClick(): void {
    const id = this.chatId();
    if (this.chat()?.isLocked || (id && this.chatLockService.isUnlocked(id))) {
      this.chatLockService.relock(id).subscribe();
    }
    this.messages.set([]);
    this.chat.set(null);
  }

  cancelUnlock(): void {
    const id = this.chatId();
    if (this.chat()?.isLocked || (id && this.chatLockService.isUnlocked(id))) {
      this.chatLockService.relock(id).subscribe();
    }
    this.messages.set([]);
    this.chat.set(null);
    this.router.navigate(['/chats']);
  }

  submitDetailUnlock(): void {
    const pin = this.unlockPinInput().trim();
    if (!/^\d{4}$/.test(pin)) {
      this.unlockPinError.set('Please enter a 4-digit PIN');
      return;
    }
    this.unlockPinError.set('');
    this.chatLockService.verifyPin(pin, this.chat()?.otherUserId, this.chatId()).subscribe({
      next: () => {
        this.unlockPinInput.set('');
        this.unlockPinError.set('');
        this.fetchMessages(this.chatId());
      },
      error: (err) => {
        if (err?.status === 429) {
          this.unlockPinError.set('Too many incorrect attempts. Locked for 5 minutes.');
        } else {
          this.unlockPinError.set('Incorrect PIN. Please try again.');
        }
      },
    });
  }

  openForgotPinModal(): void {
    this.resetPasswordInput = '';
    this.resetNewPinInput = '';
    this.resetConfirmPinInput = '';
    this.resetPinError.set('');
    this.forgotPinModalOpen.set(true);
  }

  closeForgotPinModal(): void {
    this.forgotPinModalOpen.set(false);
    this.resetPasswordInput = '';
    this.resetNewPinInput = '';
    this.resetConfirmPinInput = '';
    this.resetPinError.set('');
  }

  isGoogleUser(): boolean {
    const user = this.authService.currentUser();
    return user?.authProvider === 'google' || user?.hasPassword === false;
  }

  submitResetPin(): void {
    const newPin = this.resetNewPinInput.trim();
    if (!/^\d{4}$/.test(newPin)) {
      this.resetPinError.set('New PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== this.resetConfirmPinInput.trim()) {
      this.resetPinError.set('PIN confirmation does not match');
      return;
    }

    const isGoogle = this.isGoogleUser();
    if (!isGoogle && !this.resetPasswordInput.trim()) {
      this.resetPinError.set('Please enter your account password');
      return;
    }

    const payload: { newPin: string; password?: string } = {
      newPin,
      ...(isGoogle ? {} : { password: this.resetPasswordInput }),
    };

    this.chatLockService.resetPin(payload).subscribe({
      next: () => {
        this.toast.success('PIN reset successfully');
        this.closeForgotPinModal();
        this.chatLockService.verifyPin(newPin, this.chat()?.otherUserId, this.chatId()).subscribe({
          next: () => {
            this.fetchMessages(this.chatId());
          },
        });
      },
      error: (err) => {
        this.resetPinError.set(err?.error?.error?.message || 'Failed to reset PIN');
      },
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.conversationsService.activeConversationId.set(null);
    const id = this.chatId();
    if (this.chat()?.isLocked || (id && this.chatLockService.isUnlocked(id))) {
      this.chatLockService.relock(id).subscribe();
    }
    this.messages.set([]);
    this.chat.set(null);
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }
    if (this.expirationInterval) {
      clearInterval(this.expirationInterval);
      this.expirationInterval = null;
    }
  }
}
