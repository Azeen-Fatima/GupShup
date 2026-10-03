import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="emoji-picker-panel" role="region" aria-label="Emoji picker">
      <!-- Category Tabs Header -->
      <div class="category-tabs" role="tablist" aria-label="Emoji categories">
        @for (cat of categories; track cat.id) {
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeCategory() === cat.id"
            (mousedown)="$event.preventDefault()"
            (click)="selectCategory(cat.id)"
            role="tab"
            [attr.aria-selected]="activeCategory() === cat.id"
            [attr.aria-label]="cat.name"
            [title]="cat.name"
          >
            <span class="tab-icon">{{ cat.icon }}</span>
          </button>
        }
      </div>

      <!-- Emoji Grid Area -->
      <div class="emoji-scroll-body">
        <div class="category-title">{{ currentCategoryObj().name }}</div>
        <div class="emoji-grid" role="grid">
          @for (emoji of currentCategoryObj().emojis; track emoji) {
            <button
              type="button"
              class="emoji-cell"
              (mousedown)="$event.preventDefault()"
              (click)="onEmojiClick(emoji)"
              [attr.aria-label]="emoji"
            >
              {{ emoji }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      flex-shrink: 0;
    }

    .emoji-picker-panel {
      height: 260px;
      max-height: 45vh;
      background-color: var(--card);
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .category-tabs {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      background-color: var(--input);
      flex-shrink: 0;
    }

    .tab-btn {
      padding: 6px 10px;
      border-radius: 999px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease, transform 0.1s ease;
      font-size: 15px;

      &:hover {
        background-color: var(--hover);
        transform: scale(1.1);
      }

      &.active {
        background-color: var(--card);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
      }
    }

    .tab-icon {
      line-height: 1;
    }

    .emoji-scroll-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 10px 14px 16px;
    }

    .category-title {
      font-size: 11px;
      font-weight: 800;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
    }

    .emoji-cell {
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border-radius: 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: transform 0.1s ease, background-color 0.15s ease;
      line-height: 1;

      &:hover {
        background-color: var(--hover);
        transform: scale(1.2);
      }

      &:active {
        transform: scale(0.95);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `],
})
export class EmojiPickerComponent {
  readonly emojiSelected = output<string>();

  readonly categories: EmojiCategory[] = [
    {
      id: 'smileys',
      name: 'Smileys',
      icon: '😊',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
        '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
        '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
        '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
        '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
        '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯',
        '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🥺',
      ],
    },
    {
      id: 'gestures',
      name: 'Gestures',
      icon: '👋',
      emojis: [
        '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳',
        '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
        '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
        '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
        '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
      ],
    },
    {
      id: 'hearts',
      name: 'Hearts',
      icon: '❤️',
      emojis: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
        '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
        '💘', '💝', '💟', '💌', '🫀', '💋', '💯', '✨',
        '💫', '🌟', '⭐', '⚡', '💥', '🔥', '🎉', '🎊',
      ],
    },
    {
      id: 'animals',
      name: 'Animals',
      icon: '🐶',
      emojis: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
        '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
        '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🐺', '🐴',
        '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐬',
      ],
    },
    {
      id: 'food',
      name: 'Food',
      icon: '🍕',
      emojis: [
        '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
        '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
        '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥗',
        '🍿', '🍣', '🥟', '🍦', '🍩', '🍪', '🎂', '☕',
      ],
    },
    {
      id: 'objects',
      name: 'Objects',
      icon: '💡',
      emojis: [
        '⚽', '🏀', '🏈', '🎾', '🎮', '🎲', '🎨', '🎬',
        '🎤', '🎧', '🎸', '🎹', '📱', '💻', '⌨️', '📷',
        '💡', '📖', '📚', '📝', '✉️', '🎁', '🎈', '🏆',
        '🥇', '🚗', '🚲', '✈️', '🚀', '⏰', '🔑', '💎',
      ],
    },
  ];

  readonly activeCategory = signal<string>('smileys');

  selectCategory(id: string): void {
    this.activeCategory.set(id);
  }

  currentCategoryObj(): EmojiCategory {
    return this.categories.find((c) => c.id === this.activeCategory()) || this.categories[0];
  }

  onEmojiClick(emoji: string): void {
    this.emojiSelected.emit(emoji);
  }
}
