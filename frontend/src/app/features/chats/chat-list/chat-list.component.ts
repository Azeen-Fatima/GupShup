import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConversationsService } from '../../../shared/services/conversations.service';
import { UsersService } from '../../../shared/services/users.service';
import { AuthService } from '../../../shared/services/auth.service';
import { SocketService } from '../../../shared/services/socket.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  formatConversationToChatItem,
  getInitials,
  SearchUserResult,
} from '../../../shared/models/api.models';
import { ChatItem } from '../../../shared/mock/mock-data';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SvgIconComponent } from '../../../shared/components/svg-icon/svg-icon.component';
import { ChatRowComponent } from '../../../shared/components/chat-row/chat-row.component';
import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AvatarComponent,
    ButtonComponent,
    SvgIconComponent,
    ChatRowComponent,
    BottomSheetComponent,
    ModalComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="chats-screen">
      <!-- Topbar Header (Fixed at top) -->
      <header class="topbar">
        <a
          routerLink="/settings"
          class="avatar-link"
          title="Open settings"
          aria-label="Open settings"
          role="button"
        >
          <app-avatar
            [avatarUrl]="currentUser().photoUrl"
            [name]="currentUser().name"
            [initials]="currentUser().initials"
            [size]="'sm'"
          ></app-avatar>
        </a>

        <div class="brand-wrap">
          <app-svg-icon name="chat" [size]="20" class="brand-icon"></app-svg-icon>
          <span class="brand-wordmark">Gupshup</span>
        </div>

        <button
          type="button"
          class="icon-btn"
          (click)="toggleSearch()"
          [attr.aria-expanded]="searchOpen()"
          title="Search chats"
          aria-label="Search chats"
        >
          <app-svg-icon name="search" [size]="18"></app-svg-icon>
        </button>
      </header>

      <!-- Expandable Search Bar -->
      <div class="search-bar-wrap" [class.open]="searchOpen()">
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search your chats…"
          class="search-input"
          aria-label="Search chats input"
        />
      </div>

      <!-- Scrollable Chat List (Internal scroll only) -->
      <div class="chat-list-container" role="feed" aria-label="Chats feed">
        <!-- Skeleton Loading Placeholders -->
        @if (isLoadingChats()) {
          @for (s of [1, 2, 3, 4, 5, 6]; track s) {
            <div class="skeleton-row" aria-hidden="true">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-info">
                <div class="skeleton-line-top"></div>
                <div class="skeleton-line-bot"></div>
              </div>
            </div>
          }
        } @else if (searchQuery().trim()) {
          @if (filteredChats().length === 0) {
            <app-empty-state
              type="no-results"
              title="No chats found"
              [subtitle]="'No conversation matches \\'' + searchQuery() + '\\''"
            ></app-empty-state>
          } @else {
            @for (chat of filteredChats(); track chat.id) {
              <app-chat-row
                [chat]="chat"
                (rowClicked)="openChat(chat)"
                (actionTriggered)="onRowAction($event)"
              ></app-chat-row>
            }
          }
        } @else {
          <!-- Chat Requests Section (if any pending received requests) -->
          @if (incomingRequests().length > 0) {
            <div class="requests-section" role="region" aria-label="Chat requests">
              <div class="requests-header">
                <span class="requests-title">Requests</span>
                <span class="requests-badge">{{ incomingRequests().length }}</span>
              </div>
              <div class="requests-list">
                @for (chat of incomingRequests(); track chat.id) {
                  <app-chat-row
                    [chat]="chat"
                    (rowClicked)="openChat(chat)"
                    (actionTriggered)="onRowAction($event)"
                  ></app-chat-row>
                }
              </div>
            </div>
          }

          <!-- Regular Chats -->
          @if (regularChats().length === 0 && incomingRequests().length === 0) {
            <app-empty-state
              type="no-chats"
              title="No chats yet"
              subtitle="Click the arrow below to find people and start a cozy conversation!"
            ></app-empty-state>
          } @else {
            @for (chat of regularChats(); track chat.id) {
              <app-chat-row
                [chat]="chat"
                (rowClicked)="openChat(chat)"
                (actionTriggered)="onRowAction($event)"
              ></app-chat-row>
            }
          }
        }
      </div>

      <!-- Floating Arrow Button:
           Fades out when sheet opens; fades back in when sheet closes.
           Does NOT flip direction anymore. Tooltip/aria-label: "Find people". -->
      <button
        type="button"
        class="fab-arrow"
        [class.hidden]="sheetOpen()"
        (click)="openSheet()"
        title="Find people"
        aria-label="Find people"
      >
        <app-svg-icon name="up" [size]="22"></app-svg-icon>
      </button>

      <!-- Find People Bottom Sheet -->
      <app-bottom-sheet
        [isOpen]="sheetOpen()"
        title="Find people"
        (close)="closeSheet()"
      >
        <div class="sheet-search-wrap">
          <input
            type="text"
            [(ngModel)]="sheetSearchQuery"
            (ngModelChange)="onSheetSearchChange($event)"
            placeholder="Search by name or @username"
            class="sheet-search-input"
            aria-label="Search people"
          />
        </div>

        <div class="sheet-people-list">
          @if (isLoadingSheet()) {
            @for (s of [1, 2, 3, 4]; track s) {
              <div class="skeleton-row" aria-hidden="true">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                  <div class="skeleton-line-top" style="width: 45%;"></div>
                  <div class="skeleton-line-bot" style="width: 30%;"></div>
                </div>
              </div>
            }
          } @else if (filteredPeople().length === 0) {
            <app-empty-state
              type="no-results"
              title="No people found"
              [subtitle]="'No user matches \\'' + sheetSearchQuery() + '\\''"
            ></app-empty-state>
          } @else {
            @for (person of filteredPeople(); track person.id) {
              <div class="person-row">
                <app-avatar
                  [avatarUrl]="person.avatarUrl"
                  [name]="person.name"
                  [size]="'md'"
                ></app-avatar>
                <div class="person-info">
                  <div class="person-name">{{ person.name }}</div>
                  <div class="person-user">&#64;{{ person.username }}</div>
                </div>
                <app-button
                  variant="msg"
                  (clicked)="messagePerson(person)"
                  [ariaLabel]="'Message ' + person.name"
                >
                  Message
                </app-button>
              </div>
            }
          }
        </div>
      </app-bottom-sheet>

      <!-- Action Confirmation Modal -->
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

    .chats-screen {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
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
    }

    .avatar-link {
      display: flex;
      border-radius: 50%;
      outline: none;
      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--amber-text);
      user-select: none;
    }

    .brand-icon {
      color: var(--amber-text);
    }

    .brand-wordmark {
      font-weight: 800;
      font-size: 19px;
      letter-spacing: -0.01em;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: var(--input);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease;

      &:hover {
        color: var(--ink);
        background-color: var(--border);
      }
    }

    /* Expandable Search Input */
    .search-bar-wrap {
      max-height: 0;
      overflow: hidden;
      padding: 0 18px;
      transition: max-height 0.25s ease, padding 0.25s ease;
      background-color: var(--card);
      flex-shrink: 0;

      &.open {
        max-height: 64px;
        padding: 10px 18px;
        border-bottom: 1px solid var(--border);
      }
    }

    .search-input {
      width: 100%;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      outline: none;
      font-size: 13px;
      color: var(--ink);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &:focus {
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.16);
      }
    }

    /* Scrollable chat list: strictly internal scroll, padding-bottom to clear FAB */
    .chat-list-container {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 8px 10px 84px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Requests section at top of chat list */
    .requests-section {
      margin-bottom: 6px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }

    .requests-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 6px;
    }

    .requests-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }

    .requests-badge {
      background-color: var(--amber);
      color: var(--on-amber);
      font-size: 11px;
      font-weight: 800;
      padding: 1px 7px;
      border-radius: 999px;
      line-height: 1.4;
    }

    .requests-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Floating Arrow Button:
       Pinned at bottom center of the card.
       Fades out when sheet opens, fades in when sheet closes. */
    .fab-arrow {
      position: absolute;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: var(--amber);
      color: var(--on-amber); /* #2E2A26 - always dark charcoal */
      box-shadow: 0 8px 22px rgba(232, 162, 61, 0.38);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 40;
      cursor: pointer;
      opacity: 1;
      transition: opacity 0.3s ease, transform 0.3s ease, box-shadow 0.2s ease;

      &:hover {
        box-shadow: 0 10px 26px rgba(232, 162, 61, 0.5);
      }

      &.hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateX(-50%) scale(0.85);
      }
    }

    /* Skeleton Loading Row */
    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 10px;
    }

    .skeleton-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: var(--input);
      animation: pulse 1.2s infinite ease-in-out;
      flex-shrink: 0;
    }

    .skeleton-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .skeleton-line-top {
      height: 14px;
      width: 60%;
      border-radius: 6px;
      background-color: var(--input);
      animation: pulse 1.2s infinite ease-in-out;
    }

    .skeleton-line-bot {
      height: 11px;
      width: 85%;
      border-radius: 6px;
      background-color: var(--input);
      animation: pulse 1.2s infinite ease-in-out;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 0.9; }
    }

    /* Sheet Content */
    .sheet-search-wrap {
      padding: 12px 18px 8px;
      flex-shrink: 0;
    }

    .sheet-search-input {
      width: 100%;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      outline: none;
      font-size: 13px;
      color: var(--ink);

      &:focus {
        border-color: var(--amber);
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.16);
      }
    }

    .sheet-people-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 6px 14px 24px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .person-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 10px;
      border-radius: 14px;
      background-color: transparent;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--hover);
      }
    }

    .person-info {
      flex: 1;
      min-width: 0;
    }

    .person-name {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }

    .person-user {
      font-size: 12px;
      color: var(--muted);
      margin-top: 1px;
    }
  `],
})
export class ChatListComponent implements OnInit {
  private readonly conversationsService = inject(ConversationsService);
  private readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly socketService = inject(SocketService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly searchOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly sheetOpen = signal<boolean>(false);
  readonly sheetSearchQuery = signal<string>('');
  readonly isLoadingChats = signal<boolean>(true);
  readonly isLoadingSheet = signal<boolean>(false);
  readonly sheetUsers = signal<SearchUserResult[]>([]);
  private sheetSearchTimer: any = null;

  // Current logged in user computed from authService
  readonly currentUser = computed(() => {
    const u = this.authService.currentUser();
    return {
      name: u?.name || 'User',
      username: u?.username ? `@${u.username}` : '',
      initials: getInitials(u?.name || 'User'),
      photoUrl: u?.avatarUrl || null,
    };
  });

  // Chats list mapped to ChatItem
  readonly chats = computed(() => {
    const list = this.conversationsService.conversations();
    const myUser = this.authService.currentUser();
    const myId = myUser?.id;
    const myAvatar = myUser?.avatarUrl;
    return list.map((c) => formatConversationToChatItem(c, myId, myAvatar));
  });

  // Incoming requests (pending_received)
  readonly incomingRequests = computed(() => {
    return this.chats().filter((c) => c.isIncomingRequest);
  });

  // Regular chats (not incoming requests)
  readonly regularChats = computed(() => {
    return this.chats().filter((c) => !c.isIncomingRequest);
  });

  // Filtered chats by search query
  readonly filteredChats = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.chats();
    return this.chats().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        (c.username && c.username.toLowerCase().includes(q))
    );
  });

  // Search users in sheet (excludes existing conversation partners)
  readonly filteredPeople = computed(() => {
    const list = this.sheetUsers();
    const existingPartnerIds = new Set(
      this.conversationsService.conversations().map((c) => c.otherUser.id)
    );
    return list.filter((u) => !existingPartnerIds.has(u.id));
  });

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

  ngOnInit(): void {
    if (!this.authService.currentUser()) {
      this.authService.fetchProfile().subscribe({
        next: () => this.loadChats(),
        error: () => this.loadChats(),
      });
    } else {
      this.loadChats();
    }
  }

  loadChats(): void {
    this.conversationsService.loadConversations().subscribe({
      next: () => this.isLoadingChats.set(false),
      error: () => this.isLoadingChats.set(false),
    });
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (!this.searchOpen()) {
      this.searchQuery.set('');
    }
  }

  openSheet(): void {
    this.sheetOpen.set(true);
    this.searchPeople('');
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  onSheetSearchChange(query: string): void {
    if (this.sheetSearchTimer) clearTimeout(this.sheetSearchTimer);
    this.sheetSearchTimer = setTimeout(() => {
      this.searchPeople(query);
    }, 300);
  }

  searchPeople(query: string): void {
    this.isLoadingSheet.set(true);
    const q = query.trim() || 'a';
    this.usersService.searchUsers(q).subscribe({
      next: (users) => {
        this.sheetUsers.set(users);
        this.isLoadingSheet.set(false);
      },
      error: () => {
        this.sheetUsers.set([]);
        this.isLoadingSheet.set(false);
      },
    });
  }

  openChat(chat: ChatItem): void {
    this.router.navigate(['/chats', chat.id]);
  }

  messagePerson(person: SearchUserResult): void {
    this.sheetUsers.update((list) => list.filter((u) => u.id !== person.id));
    this.sheetOpen.set(false);
    this.usersService.setDraftUser(person);
    if (person.conversationId) {
      this.router.navigate(['/chats', person.conversationId]);
    } else {
      this.router.navigate(['/chats', `new-${person.id}`]);
    }
  }

  onRowAction(event: { action: 'delete' | 'block' | 'clear' | 'unblock'; chat: ChatItem }): void {
    const { action, chat } = event;

    if (action === 'delete') {
      this.modalState.set({
        isOpen: true,
        title: 'Delete chat?',
        message: `Are you sure you want to delete the chat with ${chat.name}? This will hide it from your chat list until a new message arrives.`,
        confirmText: 'Delete',
        isDanger: true,
        onConfirm: () => {
          this.conversationsService.deleteConversation(chat.id).subscribe({
            next: () => this.toast.info(`Deleted chat with ${chat.name}`),
            error: (err) => this.toast.error(err?.error?.error?.message || 'Failed to delete chat'),
          });
        },
      });
    } else if (action === 'block') {
      this.modalState.set({
        isOpen: true,
        title: 'Block user?',
        message: `Are you sure you want to block ${chat.name}? They will no longer be able to message you directly.`,
        confirmText: 'Block',
        isDanger: true,
        onConfirm: () => {
          this.conversationsService.blockUser(chat.id).subscribe({
            next: () => this.toast.info(`Blocked ${chat.name}`),
            error: (err) => this.toast.error(err?.error?.error?.message || 'Failed to block user'),
          });
        },
      });
    } else if (action === 'clear') {
      this.modalState.set({
        isOpen: true,
        title: 'Clear chat?',
        message: `Clear all messages in the conversation with ${chat.name}?`,
        confirmText: 'Clear',
        isDanger: false,
        onConfirm: () => {
          this.conversationsService.clearHistory(chat.id).subscribe({
            next: () => this.toast.info(`Cleared conversation with ${chat.name}`),
            error: (err) => this.toast.error(err?.error?.error?.message || 'Failed to clear chat'),
          });
        },
      });
    } else if (action === 'unblock') {
      this.conversationsService.unblockUser(chat.id).subscribe({
        next: () => this.toast.success(`Unblocked ${chat.name}`),
        error: (err) => this.toast.error(err?.error?.error?.message || 'Failed to unblock user'),
      });
    }
  }

  executeModalAction(): void {
    const state = this.modalState();
    if (state.onConfirm) {
      state.onConfirm();
    }
    this.closeModal();
  }

  closeModal(): void {
    this.modalState.update((s) => ({ ...s, isOpen: false, onConfirm: null }));
  }
}
