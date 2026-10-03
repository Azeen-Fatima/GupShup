import { Component, input, computed } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div
      class="avatar-circle"
      [class.size-sm]="size() === 'sm'"
      [class.size-md]="size() === 'md'"
      [class.size-lg]="size() === 'lg'"
      [class.size-xl]="size() === 'xl'"
      [class.online]="isOnline()"
      [attr.aria-label]="name() || 'User avatar'"
    >
      @if (photoUrl()) {
        <img [src]="photoUrl()!" [alt]="name() || 'Avatar'" class="avatar-img" />
      } @else {
        <span class="initials">{{ displayInitials() }}</span>
      }
      @if (isOnline()) {
        <span class="status-dot" aria-label="Online"></span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .avatar-circle {
      position: relative;
      border-radius: 50%;
      background-color: var(--avatar-bg);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      user-select: none;
      transition: background-color 0.2s ease;
      overflow: visible;
    }

    .size-sm {
      width: 36px;
      height: 36px;
      font-size: 13px;
    }

    .size-md {
      width: 40px;
      height: 40px;
      font-size: 14px;
    }

    .size-lg {
      width: 48px;
      height: 48px;
      font-size: 16px;
    }

    .size-xl {
      width: 76px;
      height: 76px;
      font-size: 26px;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .initials {
      font-family: inherit;
      color: var(--ink);
      line-height: 1;
    }

    .status-dot {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background-color: var(--teal);
      border: 2px solid var(--card);
    }

    .size-xl .status-dot {
      width: 16px;
      height: 16px;
      border-width: 3px;
    }
  `],
})
export class AvatarComponent {
  readonly name = input<string>('');
  readonly initials = input<string>('');
  readonly size = input<AvatarSize>('md');
  readonly isOnline = input<boolean>(false);
  readonly photoUrl = input<string | null>(null);

  protected readonly displayInitials = computed(() => {
    if (this.initials()) {
      return this.initials();
    }
    const n = this.name().trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  });
}
