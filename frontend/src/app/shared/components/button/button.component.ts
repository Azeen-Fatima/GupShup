import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'msg' | 'icon';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  host: {
    '[class.full-width]': 'fullWidth()',
  },
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="'btn btn-' + variant()"
      [class.full-width]="fullWidth()"
      [class.loading]="loading()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-busy]="loading()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <app-svg-icon name="spinner" [size]="16" class="btn-spinner"></app-svg-icon>
      }
      <span class="btn-content" [class.invisible]="loading() && iconOnly()">
        <ng-content></ng-content>
      </span>
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    :host(.full-width),
    .full-width {
      display: block;
      width: 100%;
    }

    .btn {
      font-family: inherit;
      border-radius: 999px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      outline: none;
      user-select: none;
      text-decoration: none;
      line-height: 1.2;

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }
    }

    .btn-spinner {
      display: inline-flex;
    }

    .btn-content {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      &.invisible {
        visibility: hidden;
      }
    }

    /* Primary: Amber with charcoal dark text */
    .btn-primary {
      background-color: var(--amber);
      color: var(--on-amber); /* #2E2A26 - always dark charcoal, never white */
      border: none;
      padding: 12px 20px;
      font-size: 14.5px;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 18px rgba(232, 162, 61, 0.35);
      }
      &:active:not(:disabled) {
        transform: scale(0.98);
      }
    }

    /* Ghost: border with ink text */
    .btn-ghost {
      background: transparent;
      border: 1.5px solid var(--border);
      color: var(--ink);
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;

      &:hover:not(:disabled) {
        background-color: var(--hover);
        border-color: var(--border);
      }
      &:active:not(:disabled) {
        transform: scale(0.99);
      }
    }

    /* Danger */
    .btn-danger {
      background: transparent;
      border: 1.5px solid var(--border);
      color: var(--danger);
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;

      &:hover:not(:disabled) {
        background-color: rgba(200, 80, 60, 0.08);
        border-color: var(--danger);
      }
    }

    /* Msg pill button (used in Find People sheet) */
    .btn-msg {
      background-color: var(--msgbtn-bg);
      color: var(--amber-text);
      border: none;
      padding: 7px 16px;
      font-size: 12px;
      font-weight: 800;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
      }
    }

    /* Icon button */
    .btn-icon {
      width: 36px;
      height: 36px;
      padding: 0;
      border-radius: 50%;
      background-color: var(--input);
      color: var(--muted);
      border: none;

      &:hover:not(:disabled) {
        color: var(--ink);
        background-color: var(--border);
      }
    }
  `],
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);
  readonly iconOnly = input<boolean>(false);
  readonly ariaLabel = input<string>('');

  readonly clicked = output<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}
