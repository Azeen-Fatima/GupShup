import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  BlockedItem,
  DeclinedItem,
  SearchUserResult,
  User,
} from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  /**
   * Get logged-in user profile
   */
  getMe(): Observable<User> {
    return this.http
      .get<ApiResponse<{ user: User }>>(`${this.baseUrl}/me`)
      .pipe(map((res) => res.data!.user));
  }

  /**
   * Update profile fields (name, bio, statusMessage, themePreference)
   */
  updateMe(data: {
    name?: string;
    bio?: string | null;
    statusMessage?: string | null;
    themePreference?: 'system' | 'light' | 'dark' | 'auto';
  }): Observable<User> {
    return this.http
      .patch<ApiResponse<{ user: User }>>(`${this.baseUrl}/me`, data)
      .pipe(map((res) => res.data!.user));
  }

  /**
   * Upload user avatar photo
   */
  uploadAvatar(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<{ user: User }>>(`${this.baseUrl}/me/avatar`, formData)
      .pipe(map((res) => res.data!.user));
  }

  /**
   * Remove user avatar
   */
  removeAvatar(): Observable<User> {
    return this.http
      .delete<ApiResponse<{ user: User }>>(`${this.baseUrl}/me/avatar`)
      .pipe(map((res) => res.data!.user));
  }

  /**
   * Search users by name or username
   */
  searchUsers(query: string): Observable<SearchUserResult[]> {
    return this.http
      .get<ApiResponse<{ users: SearchUserResult[] }>>(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
      )
      .pipe(map((res) => res.data?.users || []));
  }

  /**
   * List requests declined by the current user
   */
  getDeclinedUsers(): Observable<DeclinedItem[]> {
    return this.http
      .get<ApiResponse<{ declined: DeclinedItem[] }>>(`${this.baseUrl}/me/declined`)
      .pipe(map((res) => res.data?.declined || []));
  }

  /**
   * List users blocked by the current user
   */
  getBlockedUsers(): Observable<BlockedItem[]> {
    return this.http
      .get<ApiResponse<{ blocked: BlockedItem[] }>>(`${this.baseUrl}/me/blocked`)
      .pipe(map((res) => res.data?.blocked || []));
  }
}
