import { Component, inject, signal } from '@angular/core';
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
export class App {
  private readonly themeService = inject(ThemeService);

  // Controlled by a signal (can be toggled for demo or network offline)
  readonly isReconnecting = signal<boolean>(false);
}
