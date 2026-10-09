import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

interface UnlockTokenInfo {
  token: string;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatLockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/chat-lock`;

  // Status signals
  readonly hasPin = signal<boolean>(false);
  readonly lockedPeerIds = signal<string[]>([]);

  // In-memory unlock tokens keyed by peerUserId or conversationId
  private readonly tokens = new Map<string, UnlockTokenInfo>();

  constructor() {
    // Auto-relock when app tab is hidden/backgrounded
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.clearAllTokens();
        }
      });
    }
  }

  loadStatus(): Observable<{ hasPin: boolean; lockedPeerIds: string[] }> {
    return this.http
      .get<ApiResponse<{ hasPin: boolean; lockedPeerIds: string[] }>>(`${this.baseUrl}/status`)
      .pipe(
        map((res) => res.data || { hasPin: false, lockedPeerIds: [] }),
        tap((data) => {
          this.hasPin.set(data.hasPin);
          this.lockedPeerIds.set(data.lockedPeerIds);
        })
      );
  }

  setPin(pin: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/pin`, { pin })
      .pipe(
        map((res) => Boolean(res.success)),
        tap(() => this.hasPin.set(true))
      );
  }

  verifyPin(
    pin: string,
    peerUserId?: string,
    conversationId?: string
  ): Observable<{ success: boolean; unlockToken?: string }> {
    return this.http
      .post<ApiResponse<{ success: boolean; unlockToken?: string }>>(`${this.baseUrl}/verify`, {
        pin,
        peerUserId,
        conversationId,
      })
      .pipe(
        map((res) => res.data || { success: false }),
        tap((data) => {
          if (data.unlockToken) {
            const expiresAt = Date.now() + 5 * 60 * 1000;
            if (peerUserId) {
              this.tokens.set(peerUserId, { token: data.unlockToken, expiresAt });
            }
            if (conversationId) {
              this.tokens.set(conversationId, { token: data.unlockToken, expiresAt });
            }
          }
        })
      );
  }

  toggleLock(peerUserId: string, locked?: boolean): Observable<boolean> {
    return this.http
      .post<ApiResponse<{ locked: boolean }>>(`${this.baseUrl}/toggle`, {
        peerUserId,
        locked,
      })
      .pipe(
        map((res) => res.data?.locked ?? false),
        tap((isLocked) => {
          this.lockedPeerIds.update((ids) => {
            if (isLocked) {
              return Array.from(new Set([...ids, peerUserId]));
            } else {
              return ids.filter((id) => id !== peerUserId);
            }
          });
          if (!isLocked) {
            this.tokens.delete(peerUserId);
          }
        })
      );
  }

  resetPin(data: { newPin: string; password?: string; idToken?: string }): Observable<boolean> {
    return this.http
      .post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/reset`, data)
      .pipe(
        map((res) => Boolean(res.success)),
        tap(() => this.hasPin.set(true))
      );
  }

  getUnlockToken(key?: string): string | null {
    if (!key) return null;
    const item = this.tokens.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.tokens.delete(key);
      return null;
    }
    return item.token;
  }

  isUnlocked(key?: string): boolean {
    return Boolean(this.getUnlockToken(key));
  }

  setUnlockToken(key: string, token: string): void {
    this.tokens.set(key, { token, expiresAt: Date.now() + 5 * 60 * 1000 });
  }

  clearToken(key: string): void {
    this.tokens.delete(key);
  }

  clearAllTokens(): void {
    this.tokens.clear();
  }
}
