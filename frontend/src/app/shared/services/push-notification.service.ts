import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush, { optional: true });
  private readonly baseUrl = `${environment.apiUrl}/push`;

  readonly isSupported = signal<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
  );
  readonly pushEnabled = signal<boolean>(false);
  readonly permission = signal<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  constructor() {
    this.checkCurrentSubscription();
  }

  async checkCurrentSubscription(): Promise<void> {
    if (!this.swPush?.isEnabled) {
      this.pushEnabled.set(false);
      return;
    }

    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      this.pushEnabled.set(!!sub);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        this.permission.set(Notification.permission);
      }
    } catch {
      this.pushEnabled.set(false);
    }
  }

  async getPublicKey(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ publicKey: string | null }>>(`${this.baseUrl}/public-key`)
      );
      return res.data?.publicKey || null;
    } catch {
      return null;
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.swPush?.isEnabled) {
      return false;
    }

    try {
      const publicKey = await this.getPublicKey();
      if (!publicKey) {
        return false;
      }

      const sub = await this.swPush.requestSubscription({
        serverPublicKey: publicKey,
      });

      const subJson = sub.toJSON();
      const keys = subJson.keys as Record<string, string> | undefined;
      const p256dh = keys?.['p256dh'];
      const auth = keys?.['auth'];
      if (!sub.endpoint || !p256dh || !auth) {
        return false;
      }

      await firstValueFrom(
        this.http.post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/subscribe`, {
          endpoint: sub.endpoint,
          keys: {
            p256dh,
            auth,
          },
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        })
      );

      this.pushEnabled.set(true);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        this.permission.set(Notification.permission);
      }
      return true;
    } catch (err) {
      console.warn('Failed to subscribe to Web Push', err);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        this.permission.set(Notification.permission);
      }
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.swPush?.isEnabled) {
      return false;
    }

    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      if (sub?.endpoint) {
        await firstValueFrom(
          this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/unsubscribe`, {
            body: { endpoint: sub.endpoint },
          })
        ).catch(() => {});
      }

      await this.swPush.unsubscribe();
      this.pushEnabled.set(false);
      return true;
    } catch (err) {
      console.warn('Failed to unsubscribe from Web Push', err);
      return false;
    }
  }

  async toggle(): Promise<boolean> {
    if (this.pushEnabled()) {
      return await this.unsubscribe();
    } else {
      return await this.subscribe();
    }
  }
}
