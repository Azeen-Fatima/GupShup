import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChatService } from '../../../shared/services/chat.service';
import { ChatItem, DiscoverableUser } from '../../../shared/mock/mock-data';
import { ToastService } from '../../../shared/services/toast.service';
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
            [name]="currentUser().name"
            [initials]="currentUser().initials"
            [photoUrl]="currentUser().photoUrl"
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
        } @else if (filteredChats().length === 0) {
          @if (searchQuery().trim()) {
            <app-empty-state
              type="no-results"
              title="No chats found"
              [subtitle]="'No conversation matches \\'' + searchQuery() + '\\''"
            ></app-empty-state>
          } @else {
            <app-empty-state
              type="no-chats"
              title="No chats yet"
              subtitle="Click the arrow below to find people and start a cozy conversation!"
            ></app-empty-state>
          }
        } @else {
          @for (chat of filteredChats(); track chat.id) {
            <app-chat-row
              [chat]="chat"
              (rowClicked)="openChat(chat)"
              (actionTriggered)="onRowAction($event)"
            ></app-chat-row>
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
                  [name]="person.name"
                  [initials]="person.initials"
                  [size]="'md'"
                ></app-avatar>
                <div class="person-info">
                  <div class="person-name">{{ person.name }}</div>
                  <div class="person-user">{{ person.username }}</div>
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
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly currentUser = this.chatService.currentUser;
  readonly chats = this.chatService.chats;
  readonly discoverableUsers = this.chatService.discoverableUsers;

  readonly searchOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly sheetOpen = signal<boolean>(false);
  readonly sheetSearchQuery = signal<string>('');
  readonly isLoadingChats = signal<boolean>(true);
  readonly isLoadingSheet = signal<boolean>(false);

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

  readonly filteredPeople = computed(() => {
    const q = this.sheetSearchQuery().trim().toLowerCase();
    if (!q) return this.discoverableUsers();
    return this.discoverableUsers().filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    // Brief skeleton placeholder simulation on load
    setTimeout(() => {
      this.isLoadingChats.set(false);
    }, 400);
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (!this.searchOpen()) {
      this.searchQuery.set('');
    }
  }

  openSheet(): void {
    this.sheetOpen.set(true);
    this.isLoadingSheet.set(true);
    setTimeout(() => {
      this.isLoadingSheet.set(false);
    }, 300);
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  openChat(chat: ChatItem): void {
    this.router.navigate(['/chats', chat.id]);
  }

  messagePerson(person: DiscoverableUser): void {
    const chatId = this.chatService.startOrOpenChat(person);
    this.sheetOpen.set(false);
    this.router.navigate(['/chats', chatId]);
  }

  onRowAction(event: { action: 'delete' | 'block' | 'clear' | 'unblock'; chat: ChatItem }): void {
    const { action, chat } = event;

    if (action === 'delete') {
      this.modalState.set({
        isOpen: true,
        title: 'Delete chat?',
        message: `Are you sure you want to delete the chat with ${chat.name}? This will remove message history.`,
        confirmText: 'Delete',
        isDanger: true,
        onConfirm: () => {
          this.chatService.deleteChat(chat.id);
          this.toast.info(`Deleted chat with ${chat.name}`);
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
          this.chatService.blockUser(chat.id);
          this.toast.info(`Blocked ${chat.name}`);
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
          this.chatService.clearChat(chat.id);
          this.toast.info(`Cleared conversation with ${chat.name}`);
        },
      });
    } else if (action === 'unblock') {
      this.chatService.unblockUser(chat.name);
      this.toast.success(`Unblocked ${chat.name}`);
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
