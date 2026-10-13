import { Component, input, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  template: `
    @if (hasUpdate()) {
      <div class="connection-banner update-banner" role="status" aria-live="polite">
        <span>New version available</span>
        <button type="button" class="refresh-btn" (click)="reloadApp()">Refresh</button>
      </div>
    } @else if (isOffline()) {
      <div class="connection-banner offline-banner" role="status" aria-live="polite">
        <app-svg-icon name="wifi-off" [size]="14"></app-svg-icon>
        <span>You're offline</span>
      </div>
    } @else if (isReconnecting()) {
      <div class="connection-banner reconnecting-banner" role="status" aria-live="polite">
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
      gap: 8px;
      animation: bannerSlideDown 0.2s ease;
      z-index: 50;
      user-select: none;
    }

    .refresh-btn {
      background: rgba(46, 42, 38, 0.9);
      color: #FFFDF8;
      border: none;
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover {
        background: #000000;
      }
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
export class ConnectionBannerComponent implements OnInit, OnDestroy {
  readonly isReconnecting = input<boolean>(false);
  readonly isOffline = signal<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  readonly hasUpdate = signal<boolean>(false);

  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private updateSub?: Subscription;

  private readonly handleOnline = () => {
    this.isOffline.set(false);
  };

  private readonly handleOffline = () => {
    this.isOffline.set(true);
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    if (this.swUpdate?.isEnabled) {
      this.updateSub = this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          this.hasUpdate.set(true);
        });
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.updateSub?.unsubscribe();
  }

  reloadApp(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
