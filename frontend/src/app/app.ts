import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/services/theme.service';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ConnectionBannerComponent } from './shared/components/connection-banner/connection-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, ConnectionBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);

  // Controlled by a signal (can be toggled for demo or network offline)
  readonly isReconnecting = signal<boolean>(false);

  private viewportHandler?: () => void;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const updateViewportHeight = () => {
        const vv = window.visualViewport;
        const height = vv ? vv.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${height}px`);
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      };

      this.viewportHandler = updateViewportHeight;
      updateViewportHeight();

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateViewportHeight);
        window.visualViewport.addEventListener('scroll', updateViewportHeight);
      } else {
        window.addEventListener('resize', updateViewportHeight);
      }
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.viewportHandler) {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this.viewportHandler);
        window.visualViewport.removeEventListener('scroll', this.viewportHandler);
      } else {
        window.removeEventListener('resize', this.viewportHandler);
      }
    }
  }
}
