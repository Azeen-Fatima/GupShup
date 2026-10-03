import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';
import { ChatMessage } from '../../mock/mock-data';

@Component({
  selector: 'app-bubble',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  template: `
    <!-- Unread Messages Divider -->
    @if (message().isFirstUnread) {
      <div class="unread-divider" role="separator" aria-label="Unread messages">
        <span class="divider-pill">Unread messages</span>
      </div>
    }

    <div
      class="bubble-row"
      [class.me]="message().sender === 'me'"
      [class.them]="message().sender === 'them'"
    >
      <div class="bubble" [class.has-image]="message().attachment?.type === 'image'">
        <!-- Image Attachment -->
        @if (message().attachment?.type === 'image') {
          <div class="bubble-image-wrap">
            <img
              [src]="message().attachment!.url"
              [alt]="message().attachment!.name"
              class="bubble-img"
            />
            @if (message().text) {
              <div class="bubble-caption">{{ message().text }}</div>
            }
          </div>
        }

        <!-- File Attachment -->
        @if (message().attachment?.type === 'file') {
          <div class="bubble-file-wrap">
            <div class="file-icon-box">
              <app-svg-icon name="file" [size]="20"></app-svg-icon>
            </div>
            <div class="file-details">
              <span class="file-name">{{ message().attachment!.name }}</span>
              @if (message().attachment!.size) {
                <span class="file-size">{{ message().attachment!.size }}</span>
              }
            </div>
            <div class="file-action-icon" aria-hidden="true">
              <app-svg-icon name="download" [size]="16"></app-svg-icon>
            </div>
          </div>
          @if (message().text) {
            <div class="bubble-caption" style="margin-top: 6px;">{{ message().text }}</div>
          }
        }

        <!-- Regular Text Message -->
        @if (!message().attachment) {
          {{ message().text }}
        }
      </div>

      <div class="meta-row">
        <span class="time">{{ message().timeString }}</span>
        @if (message().sender === 'me' && message().status && !isPending()) {
          @if (message().status === 'seen') {
            <span class="tick-icon seen" aria-label="Seen">
              <app-svg-icon name="check2" [size]="15"></app-svg-icon>
            </span>
          } @else if (message().status === 'sent') {
            <span class="tick-icon" aria-label="Sent">
              <app-svg-icon name="check" [size]="15"></app-svg-icon>
            </span>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .unread-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 14px 0 10px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1px;
        background-color: var(--amber);
        opacity: 0.35;
      }
    }

    .divider-pill {
      position: relative;
      background-color: var(--msgbtn-bg);
      color: var(--amber-text);
      font-size: 11px;
      font-weight: 800;
      padding: 3px 12px;
      border-radius: 999px;
      letter-spacing: 0.02em;
    }

    .bubble-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 2px;

      &.me {
        align-items: flex-end;
        .bubble {
          background-color: var(--amber);
          color: var(--on-amber); /* #2E2A26 - always dark charcoal, never white */
          border-bottom-right-radius: 4px;
        }
        .meta-row {
          justify-content: flex-end;
        }
      }

      &.them {
        align-items: flex-start;
        .bubble {
          background-color: var(--bubble-rcv);
          color: var(--bubble-rcv-text);
          border-bottom-left-radius: 4px;
        }
        .meta-row {
          justify-content: flex-start;
        }
      }
    }

    .bubble {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.45;
      word-break: break-word;
      transition: background-color 0.2s ease, color 0.2s ease;

      &.has-image {
        padding: 5px;
      }
    }

    /* Image Attachment */
    .bubble-image-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bubble-img {
      width: 100%;
      max-height: 220px;
      border-radius: 12px;
      object-fit: cover;
      display: block;
    }

    .bubble-caption {
      padding: 4px 6px;
      font-size: 13px;
      line-height: 1.4;
    }

    /* File Attachment */
    .bubble-file-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      min-width: 180px;
      max-width: 250px;
    }

    .file-icon-box {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background-color: var(--card);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--amber-text);
      flex-shrink: 0;
    }

    .file-details {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .file-name {
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      font-size: 10.5px;
      opacity: 0.75;
      margin-top: 1px;
    }

    .file-action-icon {
      color: inherit;
      opacity: 0.75;
      display: flex;
    }

    .meta-row {
      display: flex;
      gap: 4px;
      align-items: center;
      margin: 3px 4px 6px;
      font-size: 10.5px;
      color: var(--muted);
    }

    .time {
      font-family: inherit;
    }

    .tick-icon {
      display: inline-flex;
      align-items: center;
      color: var(--muted);

      &.seen {
        color: var(--teal);
      }
    }
  `],
})
export class BubbleComponent {
  readonly message = input.required<ChatMessage>();
  readonly isPending = input<boolean>(false);
}
