import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    google?: any;
  }
}

@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService {
  private scriptLoaded = false;
  private loadPromise: Promise<boolean> | null = null;
  readonly isLoaded = signal<boolean>(false);

  /**
   * Load Google Identity Services script once
   */
  loadScript(): Promise<boolean> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (typeof window === 'undefined') {
      return Promise.resolve(false);
    }

    if (window.google?.accounts?.id) {
      this.scriptLoaded = true;
      this.isLoaded.set(true);
      return Promise.resolve(true);
    }

    this.loadPromise = new Promise<boolean>((resolve) => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          this.scriptLoaded = true;
          this.isLoaded.set(true);
          resolve(true);
        });
        existingScript.addEventListener('error', () => {
          this.isLoaded.set(false);
          resolve(false);
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.scriptLoaded = true;
        this.isLoaded.set(true);
        resolve(true);
      };
      script.onerror = () => {
        this.isLoaded.set(false);
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Initialize Google One Tap / Sign-In with callback
   */
  async initialize(callback: (credential: string) => void): Promise<boolean> {
    const loaded = await this.loadScript();
    if (!loaded || !window.google?.accounts?.id || !environment.googleClientId) {
      return false;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => {
          if (response?.credential) {
            callback(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      return true;
    } catch (err) {
      console.warn('Failed to initialize Google Identity Services:', err);
      return false;
    }
  }

  /**
   * Render official Google button inside target element
   */
  renderButton(element: HTMLElement, options: Record<string, any> = {}): void {
    if (!window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.renderButton(element, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: Math.max(element.offsetWidth || 0, 240),
        ...options,
      });
    } catch (err) {
      console.warn('Failed to render Google button:', err);
    }
  }

  /**
   * Display One Tap prompt
   */
  prompt(): void {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  }
}
