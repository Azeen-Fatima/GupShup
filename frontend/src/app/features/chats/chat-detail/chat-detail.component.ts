import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
  effect,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatService } from '../../../shared/services/chat.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ChatMessage, MessageAttachment } from '../../../shared/mock/mock-data';
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
        <a routerLink="/chats" class="back-btn" title="Back to chats" aria-label="Back to chats">
          <app-svg-icon name="back" [size]="20"></app-svg-icon>
        </a>

        @if (chat()) {
          <app-avatar
            [name]="chat()!.name"
            [initials]="chat()!.initials"
            [size]="'md'"
            [isOnline]="chat()!.isOnline"
          ></app-avatar>

          <div class="chat-meta">
            <h2 class="chat-name">{{ chat()!.name }}</h2>
            <div class="chat-status" [class.online]="chat()!.isOnline && !isTyping()">
              {{ getStatusText() }}
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
              </div>
            }
          </div>
        } @else {
          <div class="chat-meta">
            <h2 class="chat-name">Conversation</h2>
          </div>
        }
      </header>

      <!-- Message History Area -->
      <div #messageContainer class="chat-body" (scroll)="onScroll($event)" role="log" aria-live="polite">
        @if (messages().length === 0) {
          <div class="chat-messages-content empty">
            <app-empty-state
              type="no-messages"
              title="Say hi 👋"
              [subtitle]="chat() ? 'Start a cozy conversation with ' + chat()!.name : 'Send a first message to connect.'"
            ></app-empty-state>
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

      <!-- Sender side: Pending Request Notification Note -->
      @if (chat()?.isPendingRequest && !chat()?.isBlocked) {
        <div class="pending-notice-bar" role="status">
          <app-svg-icon name="chat" [size]="14"></app-svg-icon>
          <span>Waiting for {{ chat()!.name }} to accept your request</span>
        </div>
      }

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

      <!-- Blocked User Replacement Banner -->
      @if (chat()?.isBlocked) {
        <div class="blocked-composer-strip">
          <span>You blocked this user</span>
          <button type="button" class="teal-unblock-btn" (click)="unblockCurrentChat()">
            Unblock
          </button>
        </div>
      } @else {
        <!-- Message Input Composer (Fixed at the bottom of the card) -->
        <form
          class="chat-composer"
          [class.disabled]="chat()?.isIncomingRequest"
          (ngSubmit)="sendCurrentMessage()"
          autocomplete="off"
        >
          <!-- Emoji / Keyboard Toggle Button -->
          <button
            type="button"
            class="composer-icon-btn"
            [disabled]="chat()?.isIncomingRequest"
            [title]="emojiPickerOpen() ? 'Close emoji picker' : 'Add emoji'"
            [attr.aria-label]="emojiPickerOpen() ? 'Close emoji picker' : 'Add emoji'"
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
            [disabled]="chat()?.isIncomingRequest"
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
            [disabled]="chat()?.isIncomingRequest || false"
            [placeholder]="chat()?.isIncomingRequest ? 'Accept invitation to reply…' : 'Type a message…'"
            class="composer-input"
            aria-label="Type a message"
            (click)="onInputClick()"
            (focus)="onInputFocus()"
            (input)="onInputChange()"
            (keyup)="updateCursorPos()"
            (select)="updateCursorPos()"
          />

          <button
            type="submit"
            class="send-btn"
            (mousedown)="$event.preventDefault()"
            [disabled]="(!inputText().trim() && !pendingAttachment()) || chat()?.isIncomingRequest"
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

    .chat-meta {
      display: flex;
      flex-direction: column;
      flex: 1;
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

    .chat-status {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 1px;

      &.online {
        color: var(--teal);
        font-weight: 700;
      }
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
  `],
})
export class ChatDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly toast = inject(ToastService);

  @ViewChild('messageContainer') messageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('textInput') textInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('docInput') docInputRef!: ElementRef<HTMLInputElement>;

  readonly chatId = signal<string>('c1');
  readonly inputText = signal<string>('');
  readonly isTyping = signal<boolean>(false);
  readonly showScrollBottomBtn = signal<boolean>(false);

  readonly headerMenuOpen = signal<boolean>(false);
  readonly attachMenuOpen = signal<boolean>(false);
  readonly emojiPickerOpen = signal<boolean>(false);
  readonly pendingAttachment = signal<MessageAttachment | null>(null);

  private lastSelectionStart = 0;
  private lastSelectionEnd = 0;

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

  readonly chat = computed(() => this.chatService.getChatById(this.chatId()));

  readonly messages = computed(() => {
    return this.chatService.getMessages(this.chatId());
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.chatId.set(id);
        this.isTyping.set(id === 'c1');
        this.pendingAttachment.set(null);
        this.emojiPickerOpen.set(false);
        this.scrollToBottom();
      }
    });

    effect(() => {
      this.messages();
      this.scrollToBottom();
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
    if (this.isTyping()) {
      return 'typing…';
    }
    return this.chat()?.isOnline ? 'Online' : 'Offline';
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
    this.attachMenuOpen.update((o) => !o);
  }

  toggleEmojiPicker(): void {
    this.updateCursorPos();
    const willOpen = !this.emojiPickerOpen();
    this.emojiPickerOpen.set(willOpen);
    this.attachMenuOpen.set(false);
    if (!willOpen) {
      setTimeout(() => this.textInputRef?.nativeElement?.focus(), 50);
    }
    this.scrollToBottom();
  }

  onInputClick(): void {
    this.updateCursorPos();
    if (this.emojiPickerOpen()) {
      this.emojiPickerOpen.set(false);
      this.scrollToBottom();
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

    this.scrollToBottom();
  }

  triggerFileInput(type: 'image' | 'file'): void {
    this.attachMenuOpen.set(false);
    if (type === 'image') {
      this.imageInputRef?.nativeElement?.click();
    } else {
      this.docInputRef?.nativeElement?.click();
    }
  }

  onFileChosen(event: Event, type: 'image' | 'file'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    this.pendingAttachment.set({
      type,
      url,
      name: file.name,
      size: sizeStr,
    });
    input.value = '';
  }

  clearAttachment(): void {
    this.pendingAttachment.set(null);
  }

  sendCurrentMessage(): void {
    const text = this.inputText().trim();
    const att = this.pendingAttachment();
    if (!text && !att) return;

    this.chatService.sendMessage(this.chatId(), text, att || undefined);
    this.inputText.set('');
    this.pendingAttachment.set(null);
    this.lastSelectionStart = 0;
    this.lastSelectionEnd = 0;
    this.scrollToBottom();
  }

  // Request actions (Incoming)
  acceptIncoming(): void {
    this.chatService.acceptIncomingRequest(this.chatId());
    this.toast.success(`Chat request accepted`);
  }

  declineIncoming(): void {
    this.chatService.declineIncomingRequest(this.chatId());
    this.toast.info(`Declined chat request`);
    this.router.navigate(['/chats']);
  }

  blockIncoming(): void {
    this.chatService.blockUser(this.chatId());
    this.toast.info(`User blocked`);
  }

  unblockCurrentChat(): void {
    const c = this.chat();
    if (c) {
      this.chatService.unblockUser(c.name);
      this.toast.success(`Unblocked ${c.name}`);
    }
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
        this.chatService.clearChat(this.chatId());
        this.toast.info('Conversation cleared');
      },
    });
  }

  promptDeleteChat(): void {
    this.headerMenuOpen.set(false);
    const name = this.chat()?.name || 'this chat';
    this.modalState.set({
      isOpen: true,
      title: 'Delete chat?',
      message: `Delete chat with ${name}? This action cannot be undone.`,
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: () => {
        this.chatService.deleteChat(this.chatId());
        this.toast.info(`Deleted chat with ${name}`);
        this.router.navigate(['/chats']);
      },
    });
  }

  promptBlockChat(): void {
    this.headerMenuOpen.set(false);
    const name = this.chat()?.name || 'this user';
    this.modalState.set({
      isOpen: true,
      title: 'Block user?',
      message: `Block ${name}? They will not be able to message you directly.`,
      confirmText: 'Block',
      isDanger: true,
      onConfirm: () => {
        this.chatService.blockUser(this.chatId());
        this.toast.info(`Blocked ${name}`);
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
}
