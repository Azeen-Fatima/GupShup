import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgIconComponent, IconName } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  template: `
    <div class="empty-state-wrap">
      <div class="empty-halo" aria-hidden="true">
        @switch (type()) {
          @case ('no-chats') {
            <app-svg-icon name="chat" [size]="34"></app-svg-icon>
          }
          @case ('no-results') {
            <app-svg-icon name="search" [size]="32"></app-svg-icon>
          }
          @case ('no-messages') {
            <app-svg-icon name="smile" [size]="34"></app-svg-icon>
          }
          @case ('all-clear') {
            <app-svg-icon name="check-circle" [size]="32"></app-svg-icon>
          }
          @case ('404') {
            <app-svg-icon name="alert-circle" [size]="36"></app-svg-icon>
          }
          @default {
            <app-svg-icon name="chat" [size]="32"></app-svg-icon>
          }
        }
      </div>
      <h3 class="empty-title">{{ title() }}</h3>
      @if (subtitle()) {
        <p class="empty-sub">{{ subtitle() }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      margin-block: auto;
    }

    .empty-state-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 36px 20px;
      color: var(--muted);
      margin-block: auto;
      width: 100%;
    }

    .empty-halo {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background-color: var(--input);
      color: var(--amber-text);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      transition: background-color 0.2s ease;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--ink);
      margin-bottom: 6px;
    }

    .empty-sub {
      font-size: 13px;
      max-width: 270px;
      line-height: 1.45;
      color: var(--muted);
    }
  `],
})
export class EmptyStateComponent {
  readonly type = input<'no-chats' | 'no-results' | 'no-messages' | 'all-clear' | '404' | 'default'>('default');
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
