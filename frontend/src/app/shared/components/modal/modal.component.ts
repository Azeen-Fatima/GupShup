import {
  Component,
  input,
  output,
  HostListener,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="onBackdropClick($event)" role="presentation">
        <div
          #cardRef
          class="modal-card"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="title() ? 'modal-title' : null"
          tabindex="-1"
        >
          @if (title()) {
            <h3 id="modal-title" class="modal-title">{{ title() }}</h3>
          }
          <div class="modal-content">
            <ng-content></ng-content>
          </div>
          <div class="modal-actions">
            <app-button variant="ghost" (clicked)="cancel.emit()">
              {{ cancelText() }}
            </app-button>
            <app-button
              [variant]="isDanger() ? 'danger' : 'primary'"
              (clicked)="confirm.emit()"
            >
              {{ confirmText() }}
            </app-button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    .modal-backdrop {
      position: absolute;
      inset: 0;
      background-color: var(--scrim);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      z-index: 100;
      padding: 20px 16px;
      animation: fadeIn 0.2s ease;
    }

    .modal-card {
      margin: auto;
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 22px 24px;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--ink);
      outline: none;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 17px;
      font-weight: 800;
      margin-bottom: 10px;
      color: var(--ink);
    }

    .modal-content {
      font-size: 13.5px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `],
})
export class ModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly confirmText = input<string>('Confirm');
  readonly cancelText = input<string>('Cancel');
  readonly isDanger = input<boolean>(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  @ViewChild('cardRef') cardRef!: ElementRef<HTMLDivElement>;

  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.previousActiveElement = document.activeElement as HTMLElement | null;
        setTimeout(() => {
          this.focusFirstElement();
        }, 50);
      } else {
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          this.previousActiveElement.focus();
        }
      }
    });
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.cancel.emit();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() || event.key !== 'Tab') return;

    const card = this.cardRef?.nativeElement;
    if (!card) return;

    const focusables = card.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }

  private focusFirstElement(): void {
    const card = this.cardRef?.nativeElement;
    if (card) {
      const firstBtn = card.querySelector<HTMLElement>('button:not([disabled]), input');
      if (firstBtn) {
        firstBtn.focus();
      } else {
        card.focus();
      }
    }
  }
}
