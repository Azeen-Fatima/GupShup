import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private timer: any = null;
  private currentId = 0;

  readonly activeToast = signal<ToastMessage | null>(null);

  show(message: string, type: ToastType = 'success', durationMs = 2500): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    const toast: ToastMessage = {
      id: ++this.currentId,
      message,
      type,
    };

    this.activeToast.set(toast);

    this.timer = setTimeout(() => {
      if (this.activeToast()?.id === toast.id) {
        this.activeToast.set(null);
      }
    }, durationMs);
  }

  success(message: string, durationMs = 2500): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 2500): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 2500): void {
    this.show(message, 'info', durationMs);
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.activeToast.set(null);
  }
}
