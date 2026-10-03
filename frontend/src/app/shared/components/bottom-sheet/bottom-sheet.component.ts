import { Component, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  template: `
    <!-- Dimmed Backdrop -->
    <div
      class="sheet-scrim"
      [class.open]="isOpen()"
      (click)="close.emit()"
      aria-hidden="true"
    ></div>

    <!-- Sliding Sheet Panel -->
    <div
      class="sheet-panel"
      [class.open]="isOpen()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
    >
      <div class="drag-handle" aria-hidden="true"></div>

      <div class="sheet-header">
        <h3 class="sheet-title">{{ title() }}</h3>
        <button
          type="button"
          class="close-btn"
          (click)="close.emit()"
          title="Close"
          aria-label="Close"
        >
          <app-svg-icon name="chev" [size]="18"></app-svg-icon>
        </button>
      </div>

      <div class="sheet-body">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .sheet-scrim {
      position: absolute;
      inset: 0;
      background-color: var(--scrim);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease;
      z-index: 30;

      &.open {
        opacity: 1;
        pointer-events: auto;
      }
    }

    .sheet-panel {
      position: absolute;
      left: 0;
      right: 0;
      top: 50px;
      bottom: 0;
      background-color: var(--card);
      border-radius: 28px 28px 0 0;
      box-shadow: 0 -10px 34px rgba(0, 0, 0, 0.16);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 35;
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.32, 0.72, 0.35, 1), background-color 0.3s ease;
      pointer-events: none;

      &.open {
        transform: translateY(0);
        pointer-events: auto;
      }
    }

    .drag-handle {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background-color: var(--border);
      margin: 10px auto 4px;
      flex-shrink: 0;
    }

    .sheet-header {
      padding: 12px 20px 10px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .sheet-title {
      font-size: 17px;
      font-weight: 800;
      color: var(--amber-text);
    }

    .close-btn {
      background-color: var(--input);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
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

    .sheet-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `],
})
export class BottomSheetComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('Find people');
  readonly close = output<void>();

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close.emit();
    }
  }
}
