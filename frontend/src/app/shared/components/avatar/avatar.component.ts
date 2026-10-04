import { Component, input, computed, signal, effect } from '@angular/core';

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
      [class.online]="hasOnlineDot()"
      [attr.aria-label]="name() || 'User avatar'"
    >
      @if (resolvedAvatarUrl() && !imgFailed()) {
        <img
          [src]="resolvedAvatarUrl()!"
          [alt]="name() || 'Avatar'"
          class="avatar-img"
          (error)="onImgError()"
        />
      } @else {
        <span class="initials">{{ displayInitials() }}</span>
      }
      @if (hasOnlineDot()) {
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
  readonly avatarUrl = input<string | null | undefined>(null);
  readonly photoUrl = input<string | null | undefined>(null); // Compatibility alias
  readonly name = input<string>('');
  readonly initials = input<string>('');
  readonly size = input<AvatarSize>('md');
  readonly showOnlineDot = input<boolean>(false);
  readonly isOnline = input<boolean>(false); // Compatibility alias

  readonly imgFailed = signal<boolean>(false);

  constructor() {
    // Reset image error state whenever avatar URL changes
    effect(() => {
      this.avatarUrl();
      this.photoUrl();
      this.imgFailed.set(false);
    });
  }

  protected readonly hasOnlineDot = computed(() => {
    return this.showOnlineDot() || this.isOnline();
  });

  protected readonly resolvedAvatarUrl = computed(() => {
    const raw = this.avatarUrl() || this.photoUrl();
    if (!raw) return null;

    // Cloudinary transformation for avatars
    if (raw.includes('cloudinary.com') && raw.includes('/image/upload/')) {
      const transform =
        this.size() === 'xl'
          ? 'w_512,h_512,c_fill,g_face,q_auto,f_auto'
          : 'w_128,h_128,c_fill,g_face,q_auto,f_auto';

      if (raw.includes('/image/upload/w_')) {
        return raw.replace(/\/image\/upload\/w_[^/]+\//, `/image/upload/${transform}/`);
      }
      return raw.replace('/image/upload/', `/image/upload/${transform}/`);
    }

    return raw;
  });

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

  onImgError(): void {
    this.imgFailed.set(true);
  }
}
