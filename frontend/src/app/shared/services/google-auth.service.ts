import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
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
  private isInitialized = false;
  private consoleIntercepted = false;

  readonly isLoaded = signal<boolean>(false);
  readonly scriptError = signal<string | null>(null);
  readonly originError = signal<string | null>(null);

  /**
   * Single RxJS Subject to route credential tokens to whichever screen is listening
   */
  readonly credential$ = new Subject<string>();

  constructor() {
    this.interceptGsiLogger();
  }

  private interceptGsiLogger(): void {
    if (this.consoleIntercepted || typeof window === 'undefined') return;
    this.consoleIntercepted = true;

    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    const checkMessage = (args: any[]) => {
      const msg = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
      if (
        msg.includes('origin is not allowed') ||
        msg.includes('origin_not_allowed') ||
        msg.includes('unregistered_origin')
      ) {
        this.originError.set(
          'This domain is not authorized for Google Sign-In (origin_not_allowed). Please check Google Cloud Console credentials.'
        );
      }
    };

    console.warn = (...args: any[]) => {
      checkMessage(args);
      originalWarn(...args);
    };

    console.error = (...args: any[]) => {
      checkMessage(args);
      originalError(...args);
    };
  }

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
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existingScript) {
        if (window.google?.accounts?.id) {
          this.scriptLoaded = true;
          this.isLoaded.set(true);
          resolve(true);
          return;
        }
        existingScript.addEventListener('load', () => {
          this.scriptLoaded = true;
          this.isLoaded.set(true);
          this.scriptError.set(null);
          resolve(true);
        });
        existingScript.addEventListener('error', () => {
          this.isLoaded.set(false);
          this.scriptError.set('Google sign-in script could not be loaded. Please check your connection or ad-blocker.');
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
        this.scriptError.set(null);
        resolve(true);
      };
      script.onerror = () => {
        this.isLoaded.set(false);
        this.scriptError.set('Google sign-in script could not be loaded. Please check your connection or ad-blocker.');
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Initialize Google Identity Services exactly once
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    const loaded = await this.loadScript();
    if (!loaded || !window.google?.accounts?.id || !environment.googleClientId) {
      if (!loaded && !this.scriptError()) {
        this.scriptError.set('Google sign-in script could not be loaded. Please check your connection or ad-blocker.');
      }
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => {
          if (response?.credential) {
            this.credential$.next(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      this.isInitialized = true;
      return true;
    } catch (err: any) {
      console.warn('Failed to initialize Google Identity Services:', err);
      this.scriptError.set('Failed to initialize Google sign-in: ' + (err?.message || err));
      return false;
    }
  }

  /**
   * Render official Google button inside target element with explicit clamped width
   */
  renderButton(element: HTMLElement, explicitWidth?: number, options: Record<string, any> = {}): void {
    if (!window.google?.accounts?.id) return;

    // Clear element to render once cleanly
    element.innerHTML = '';

    const parentWidth = explicitWidth || element.offsetWidth || element.parentElement?.offsetWidth || 368;
    const clampedWidth = Math.min(400, Math.max(200, Math.round(parentWidth)));

    try {
      window.google.accounts.id.renderButton(element, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: clampedWidth,
        ...options,
      });
    } catch (err) {
      console.warn('Failed to render Google button:', err);
    }
  }

  /**
   * Display One Tap prompt with notification handling
   */
  prompt(notificationCallback?: (notification: any) => void): void {
    if (!window.google?.accounts?.id) {
      this.initialize().then((ok) => {
        if (ok) {
          this.prompt(notificationCallback);
        }
      });
      return;
    }

    try {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification?.isNotDisplayed?.()) {
          const reason = notification.getNotDisplayedReason?.();
          if (reason === 'origin_not_allowed' || reason === 'unregistered_origin') {
            this.originError.set(
              'This domain is not authorized for Google Sign-In (origin_not_allowed). Please check Google Cloud Console credentials.'
            );
          }
        }
        if (notificationCallback) {
          notificationCallback(notification);
        }
      });
    } catch (err) {
      console.warn('Google prompt error:', err);
    }
  }
}
