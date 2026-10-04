import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, User } from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // In-memory access token (never stored in localStorage)
  readonly accessToken = signal<string | null>(null);

  // Current logged in user profile
  readonly currentUser = signal<User | null>(null);

  // Authentication status
  readonly isAuthenticated = computed(() => !!this.accessToken());

  // Initialization status for initial silent refresh check
  readonly isInitialized = signal<boolean>(false);

  private readonly baseUrl = `${environment.apiUrl}/auth`;

  /**
   * Request signup verification code
   */
  requestSignupOtp(email: string): Observable<{ message: string; cooldownSeconds?: number }> {
    return this.http
      .post<ApiResponse<{ message: string; cooldownSeconds?: number }>>(`${this.baseUrl}/signup/code`, { email })
      .pipe(map((res) => res.data || { message: 'Code sent', cooldownSeconds: 30 }));
  }

  /**
   * Verify signup code and receive signupToken
   */
  verifySignupOtp(email: string, code: string): Observable<{ signupToken: string }> {
    return this.http
      .post<ApiResponse<{ signupToken: string }>>(`${this.baseUrl}/signup/verify`, { email, code })
      .pipe(map((res) => res.data!));
  }

  /**
   * Check if username is available
   */
  checkUsernameAvailability(username: string): Observable<{ available: boolean; username: string }> {
    return this.http
      .get<ApiResponse<{ available: boolean; username: string }>>(
        `${this.baseUrl}/signup/username?username=${encodeURIComponent(username)}`
      )
      .pipe(map((res) => res.data!));
  }

  /**
   * Complete signup registration
   */
  completeSignup(data: {
    signupToken: string;
    name: string;
    username: string;
    password: string;
  }): Observable<{ user: User; accessToken: string }> {
    return this.http
      .post<ApiResponse<{ user: User; accessToken: string }>>(`${this.baseUrl}/signup`, data)
      .pipe(
        map((res) => res.data!),
        tap((res) => {
          this.accessToken.set(res.accessToken);
          this.currentUser.set(res.user);
        })
      );
  }

  /**
   * Log in with email/username and password
   */
  login(identifier: string, password: string): Observable<{ user: User; accessToken: string }> {
    return this.http
      .post<ApiResponse<{ user: User; accessToken: string }>>(`${this.baseUrl}/login`, {
        identifier,
        password,
      })
      .pipe(
        map((res) => res.data!),
        tap((res) => {
          this.accessToken.set(res.accessToken);
          this.currentUser.set(res.user);
        })
      );
  }

  /**
   * Refresh session using httpOnly cookie
   */
  refreshSession(): Observable<string | null> {
    return this.http
      .post<ApiResponse<{ accessToken: string }>>(`${this.baseUrl}/refresh`, {})
      .pipe(
        map((res) => res.data?.accessToken || null),
        tap((token) => {
          if (token) {
            this.accessToken.set(token);
            this.fetchProfile().subscribe({
              error: () => {},
            });
          }
        }),
        catchError(() => {
          this.accessToken.set(null);
          this.currentUser.set(null);
          return of(null);
        })
      );
  }

  /**
   * Fetch current profile from /users/me
   */
  fetchProfile(): Observable<User> {
    return this.http
      .get<ApiResponse<{ user: User }>>(`${environment.apiUrl}/users/me`)
      .pipe(
        map((res) => res.data!.user),
        tap((user) => this.currentUser.set(user))
      );
  }

  /**
   * Log out and clear state
   */
  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/logout`, {}).pipe(
      catchError(() => of(null)),
      tap(() => {
        this.accessToken.set(null);
        this.currentUser.set(null);
        this.router.navigate(['/login']);
      })
    );
  }

  /**
   * Request password reset code
   */
  requestForgotPasswordOtp(email: string): Observable<{ message: string; cooldownSeconds?: number }> {
    return this.http
      .post<ApiResponse<{ message: string; cooldownSeconds?: number }>>(`${this.baseUrl}/forgot-password/code`, { email })
      .pipe(map((res) => res.data || { message: 'Verification code sent', cooldownSeconds: 30 }));
  }

  /**
   * Verify password reset code and receive resetToken
   */
  verifyForgotPasswordOtp(email: string, code: string): Observable<{ resetToken: string }> {
    return this.http
      .post<ApiResponse<{ resetToken: string }>>(`${this.baseUrl}/forgot-password/verify`, {
        email,
        code,
      })
      .pipe(map((res) => res.data!));
  }

  /**
   * Reset password with resetToken
   */
  resetPassword(resetToken: string, newPassword: string): Observable<{ message: string }> {
    return this.http
      .post<ApiResponse<{ message: string }>>(`${this.baseUrl}/forgot-password/reset`, {
        resetToken,
        newPassword,
      })
      .pipe(map((res) => res.data || { message: 'Password reset successfully' }));
  }

  /**
   * Change password for logged in user
   */
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http
      .post<ApiResponse<{ message: string }>>(`${this.baseUrl}/change-password`, {
        currentPassword,
        newPassword,
      })
      .pipe(map((res) => res.data || { message: 'Password changed successfully' }));
  }

  /**
   * Request change email code
   */
  requestChangeEmailOtp(newEmail: string): Observable<{ message: string; cooldownSeconds?: number }> {
    return this.http
      .post<ApiResponse<{ message: string; cooldownSeconds?: number }>>(`${this.baseUrl}/change-email/code`, { newEmail })
      .pipe(map((res) => res.data || { message: 'Verification code sent', cooldownSeconds: 30 }));
  }

  /**
   * Confirm change email code
   */
  confirmChangeEmail(newEmail: string, code: string): Observable<{ user: User }> {
    return this.http
      .post<ApiResponse<{ user: User }>>(`${this.baseUrl}/change-email/confirm`, {
        newEmail,
        code,
      })
      .pipe(
        map((res) => res.data!),
        tap((res) => {
          this.currentUser.update((u) => (u ? { ...u, email: res.user.email } : u));
        })
      );
  }

  /**
   * Google OAuth
   */
  googleAuth(idToken: string): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/google`, { idToken }).pipe(
      map((res) => res.data!),
      tap((res) => {
        if (!res.needsProfile && res.accessToken) {
          this.accessToken.set(res.accessToken);
          this.currentUser.set(res.user);
        }
      })
    );
  }

  /**
   * Complete Google Profile
   */
  completeGoogleProfile(data: {
    googleToken: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
    password?: string;
  }): Observable<{ user: User; accessToken: string }> {
    return this.http
      .post<ApiResponse<{ user: User; accessToken: string }>>(`${this.baseUrl}/google/complete`, data)
      .pipe(
        map((res) => res.data!),
        tap((res) => {
          this.accessToken.set(res.accessToken);
          this.currentUser.set(res.user);
        })
      );
  }
}
