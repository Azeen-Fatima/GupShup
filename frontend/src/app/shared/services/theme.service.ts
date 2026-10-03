import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppTheme = 'default' | 'white' | 'black';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'gupshup_theme';

  readonly currentTheme = signal<AppTheme>('default');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
      if (savedTheme && (savedTheme === 'default' || savedTheme === 'white' || savedTheme === 'black')) {
        this.currentTheme.set(savedTheme);
      }
    }

    // Effect to apply theme class / attribute to document.documentElement
    effect(() => {
      const theme = this.currentTheme();
      if (isPlatformBrowser(this.platformId)) {
        if (theme === 'default') {
          document.documentElement.removeAttribute('data-theme');
        } else {
          document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem(this.STORAGE_KEY, theme);
      }
    });
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
  }
}
