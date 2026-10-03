import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  template: `
    @if (activeToast(); as toast) {
      <div
        class="toast-pill"
        [class]="'type-' + toast.type"
        role="alert"
        aria-live="polite"
      >
        @if (toast.type === 'success') {
          <app-svg-icon name="check-circle" [size]="16" class="toast-icon"></app-svg-icon>
        } @else if (toast.type === 'error') {
          <app-svg-icon name="alert-circle" [size]="16" class="toast-icon"></app-svg-icon>
        } @else {
          <app-svg-icon name="chat" [size]="16" class="toast-icon"></app-svg-icon>
        }
        <span class="toast-text">{{ toast.message }}</span>
      </div>
    }
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 120;
    }

    .toast-pill {
      position: absolute;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 120;
      max-width: 90%;
      padding: 10px 18px;
      border-radius: 999px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      animation: toastSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      white-space: nowrap;
    }

    .type-success {
      background-color: var(--card);
      color: var(--teal);
      border: 1.5px solid var(--teal);
    }

    .type-error {
      background-color: var(--card);
      color: var(--danger);
      border: 1.5px solid var(--danger);
    }

    .type-info {
      background-color: var(--card);
      color: var(--ink);
      border: 1.5px solid var(--border);
    }

    .toast-icon {
      flex-shrink: 0;
    }

    .toast-text {
      line-height: 1.2;
    }

    @keyframes toastSlideUp {
      from {
        opacity: 0;
        transform: translate(-50%, 12px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }
    }
  `],
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);
  readonly activeToast = this.toastService.activeToast;
}
