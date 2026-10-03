import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  template: `
    @if (isReconnecting()) {
      <div class="connection-banner" role="status" aria-live="polite">
        <app-svg-icon name="wifi-off" [size]="14"></app-svg-icon>
        <span>Reconnecting…</span>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      flex-shrink: 0;
      z-index: 50;
    }

    .connection-banner {
      width: 100%;
      background-color: var(--amber);
      color: var(--on-amber); /* #2E2A26 */
      font-size: 11.5px;
      font-weight: 800;
      padding: 5px 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      animation: bannerSlideDown 0.2s ease;
      z-index: 50;
      user-select: none;
    }

    @keyframes bannerSlideDown {
      from {
        transform: translateY(-100%);
      }
      to {
        transform: translateY(0);
      }
    }
  `],
})
export class ConnectionBannerComponent {
  readonly isReconnecting = input<boolean>(false);
}
