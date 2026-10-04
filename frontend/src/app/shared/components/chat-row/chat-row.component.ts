import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '../avatar/avatar.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';
import { ChatItem } from '../../mock/mock-data';

@Component({
  selector: 'app-chat-row',
  standalone: true,
  imports: [CommonModule, AvatarComponent, SvgIconComponent],
  template: `
    <div
      class="chat-row"
      [class.faded]="isFaded()"
      [class.unread]="chat().unreadCount > 0"
      (click)="onRowClick($event)"
      role="button"
      [attr.tabindex]="isFaded() ? -1 : 0"
      [attr.aria-label]="chat().name + (chat().unreadCount ? ', ' + chat().unreadCount + ' unread messages' : '')"
      (keydown.enter)="onRowClick($event)"
    >
      <!-- Content wrapper that gets faded if declined or blocked -->
      <div class="row-content">
        <app-avatar
          [avatarUrl]="chat().photoUrl"
          [name]="chat().name"
          [initials]="chat().initials"
          [size]="'lg'"
          [showOnlineDot]="chat().isOnline"
        ></app-avatar>

        <div class="info">
          <div class="top-line">
            <span class="name">{{ chat().name }}</span>
            @if (chat().isDeclined) {
              <span class="row-tag">Declined</span>
            } @else if (chat().isBlocked) {
              <span class="row-tag">Blocked</span>
            } @else {
              <span class="time">{{ chat().time }}</span>
            }
          </div>

          <div class="bot-line">
            <span class="last-msg">
              @if (chat().status === 'seen') {
                <span class="status-tick seen" aria-label="Seen">
                  <app-svg-icon name="check2" [size]="15"></app-svg-icon>
                </span>
              } @else if (chat().status === 'sent') {
                <span class="status-tick" aria-label="Sent">
                  <app-svg-icon name="check" [size]="15"></app-svg-icon>
                </span>
              }
              {{ chat().lastMessage }}
            </span>

            @if (isFaded()) {
              <span class="time">{{ chat().time }}</span>
            } @else if (chat().unreadCount > 0) {
              <span class="badge" [attr.aria-label]="chat().unreadCount + ' unread'">
                {{ chat().unreadCount }}
              </span>
            }
          </div>
        </div>
      </div>

      <!-- Action wrapper (kebab and context menu) - NEVER faded, always 100% opacity -->
      <div class="action-wrap" (click)="$event.stopPropagation()">
        @if (!chat().isSelfNotes) {
          <button
            type="button"
            class="kebab-btn"
            (click)="toggleMenu($event)"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-label]="'More options for ' + chat().name"
          >
            <app-svg-icon name="more" [size]="18"></app-svg-icon>
          </button>

          @if (menuOpen()) {
            <div class="ctx-menu" role="menu">
              @if (chat().isBlocked) {
                <button
                  type="button"
                  class="menu-item"
                  (click)="handleAction('unblock')"
                  role="menuitem"
                >
                  Unblock
                </button>
                <button
                  type="button"
                  class="menu-item danger"
                  (click)="handleAction('delete')"
                  role="menuitem"
                >
                  Delete chat
                </button>
              } @else if (chat().isDeclined) {
                <button
                  type="button"
                  class="menu-item danger"
                  (click)="handleAction('delete')"
                  role="menuitem"
                >
                  Delete chat
                </button>
              } @else {
                <button
                  type="button"
                  class="menu-item"
                  (click)="handleAction('delete')"
                  role="menuitem"
                >
                  Delete chat
                </button>
                <button
                  type="button"
                  class="menu-item danger"
                  (click)="handleAction('block')"
                  role="menuitem"
                >
                  Block
                </button>
                <button
                  type="button"
                  class="menu-item"
                  (click)="handleAction('clear')"
                  role="menuitem"
                >
                  Clear chat
                </button>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .chat-row {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-radius: 14px;
      position: relative;
      cursor: pointer;
      transition: background-color 0.15s ease;
      outline: none;

      &:hover {
        background-color: var(--hover);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: -2px;
      }
    }

    /* Content styling */
    .row-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
      transition: opacity 0.2s ease;
    }

    /* Faded rows rule: Only row-content is faded. Kebab and context menu stay at 100% opacity! */
    .chat-row.faded {
      cursor: default;
      &:hover {
        background-color: transparent;
      }
      .row-content {
        opacity: 0.55;
      }
    }

    .info {
      flex: 1;
      min-width: 0;
    }

    .top-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }

    .name {
      font-weight: 800;
      font-size: 14.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--ink);
    }

    .time {
      font-size: 11px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .bot-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 3px;
    }

    .last-msg {
      flex: 1;
      min-width: 0;
      font-size: 12.5px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .status-tick {
      display: inline-flex;
      align-items: center;
      color: var(--muted);
      flex-shrink: 0;

      &.seen {
        color: var(--teal);
      }
    }

    .chat-row.unread {
      .name {
        font-weight: 800;
      }
      .time {
        color: var(--amber-text);
        font-weight: 800;
      }
      .last-msg {
        color: var(--ink);
        font-weight: 600;
      }
    }

    .badge {
      min-width: 19px;
      height: 19px;
      padding: 0 6px;
      border-radius: 10px;
      background-color: var(--amber);
      color: var(--on-amber);
      font-size: 11px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .row-tag {
      font-size: 9.5px;
      font-weight: 800;
      color: var(--danger);
      background-color: var(--input);
      padding: 2px 8px;
      border-radius: 7px;
      flex-shrink: 0;
    }

    /* Action wrapper (isolated from faded opacity) */
    .action-wrap {
      position: relative;
      margin-left: 6px;
      opacity: 1 !important; /* Never faded */
      z-index: 5;
    }

    .kebab-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1 !important;
      transition: background-color 0.15s ease, color 0.15s ease;

      &:hover {
        background-color: var(--input);
        color: var(--ink);
      }
    }

    .ctx-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      background-color: var(--card);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 6px;
      min-width: 148px;
      z-index: 20;
      opacity: 1 !important; /* Never faded */
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
  `],
})
export class ChatRowComponent {
  private readonly elementRef = inject(ElementRef);

  readonly chat = input.required<ChatItem>();
  readonly rowClicked = output<ChatItem>();
  readonly actionTriggered = output<{ action: 'delete' | 'block' | 'clear' | 'unblock'; chat: ChatItem }>();

  readonly menuOpen = signal<boolean>(false);

  isFaded(): boolean {
    return !!(this.chat().isDeclined || this.chat().isBlocked);
  }

  onRowClick(event: Event): void {
    if (this.isFaded()) {
      return;
    }
    this.rowClicked.emit(this.chat());
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  handleAction(action: 'delete' | 'block' | 'clear' | 'unblock'): void {
    this.menuOpen.set(false);
    this.actionTriggered.emit({ action, chat: this.chat() });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.menuOpen.set(false);
    }
  }
}
