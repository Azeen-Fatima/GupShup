import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, ConversationItem, Message } from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class ConversationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/conversations`;

  // Reactive state of all conversations
  readonly conversations = signal<ConversationItem[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly activeConversationId = signal<string | null>(null);

  /**
   * Fetch user's conversation list
   */
  loadConversations(): Observable<ConversationItem[]> {
    this.isLoading.set(true);
    return this.http
      .get<ApiResponse<{ conversations: ConversationItem[] }>>(this.baseUrl)
      .pipe(
        map((res) => res.data?.conversations || []),
        tap({
          next: (items) => {
            this.conversations.set(items);
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
          },
        })
      );
  }

  /**
   * Get single conversation details
   */
  getConversationById(id: string): Observable<any> {
    return this.http
      .get<ApiResponse<{ conversation: any }>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data!.conversation));
  }

  /**
   * Create or start a conversation
   */
  createConversation(
    recipientId: string,
    message: string,
    attachment?: any
  ): Observable<{ conversationId: string; message: Message }> {
    const payload: any = { recipientId };
    if (attachment) {
      payload.initialMessage = {
        type: attachment.type || 'text',
        body: message,
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentSize: attachment.size,
        attachmentMime: attachment.mime,
      };
    } else {
      payload.message = message;
    }

    return this.http
      .post<ApiResponse<{ conversationId: string; message: Message }>>(this.baseUrl, payload)
      .pipe(
        map((res) => res.data!),
        tap(() => {
          this.loadConversations().subscribe();
        })
      );
  }

  /**
   * Accept pending request
   */
  acceptConversation(id: string): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/${id}/accept`, {})
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.conversations.update((list) =>
            list.map((c) =>
              c.id === id ? { ...c, status: 'accepted', state: 'normal' } : c
            )
          );
        })
      );
  }

  /**
   * Decline pending request
   */
  declineConversation(id: string): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/${id}/decline`, {})
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.conversations.update((list) =>
            list.map((c) =>
              c.id === id ? { ...c, status: 'declined', state: 'declined' } : c
            )
          );
        })
      );
  }

  /**
   * Block other user in conversation
   */
  blockUser(id: string): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/${id}/block`, {})
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.conversations.update((list) =>
            list.map((c) =>
              c.id === id ? { ...c, isBlockedByMe: true, state: 'blocked_by_me' } : c
            )
          );
        })
      );
  }

  /**
   * Unblock other user in conversation
   */
  unblockUser(id: string): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/${id}/unblock`, {})
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.conversations.update((list) =>
            list.map((c) =>
              c.id === id ? { ...c, isBlockedByMe: false, state: 'normal' } : c
            )
          );
        })
      );
  }

  /**
   * Clear chat history
   */
  clearHistory(id: string): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.baseUrl}/${id}/clear`, {})
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.conversations.update((list) =>
            list.map((c) => (c.id === id ? { ...c, lastMessage: null, unreadCount: 0 } : c))
          );
        })
      );
  }

  /**
   * Delete / hide conversation
   */
  deleteConversation(id: string): Observable<any> {
    return this.http
      .delete<ApiResponse<any>>(`${this.baseUrl}/${id}`)
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.conversations.update((list) => list.filter((c) => c.id !== id));
        })
      );
  }

  /**
   * Real-time update: User presence
   */
  updatePresence(userId: string, isOnline: boolean, lastSeen?: string): void {
    this.conversations.update((list) =>
      list.map((c) => {
        if (!c.isSelf && c.otherUser.id === userId) {
          return {
            ...c,
            otherUser: {
              ...c.otherUser,
              isOnline,
              ...(lastSeen ? { lastSeen } : {}),
            },
          };
        }
        return c;
      })
    );
  }

  /**
   * Real-time update: Incoming / sent message
   */
  handleNewMessage(conversationId: string, message: Message, isCurrentActive: boolean): void {
    const list = this.conversations();
    const existingIndex = list.findIndex((c) => c.id === conversationId);

    if (existingIndex !== -1) {
      const existing = list[existingIndex];
      const updated: ConversationItem = {
        ...existing,
        lastMessage: {
          id: message.id,
          body: message.body,
          type: message.type,
          senderId: message.senderId,
          createdAt: message.createdAt,
          seenAt: message.seenAt || null,
          attachmentUrl: message.attachmentUrl,
        },
        lastMessageAt: message.createdAt,
        unreadCount: isCurrentActive ? 0 : existing.unreadCount + 1,
      };

      // Move to top of chat list
      const updatedList = [
        updated,
        ...list.filter((_, idx) => idx !== existingIndex),
      ];
      this.conversations.set(updatedList);
    } else {
      // New conversation initiated by other user: reload list
      this.loadConversations().subscribe();
    }
  }

  /**
   * Real-time update: Messages marked seen
   */
  handleMessagesSeen(conversationId: string, seenAt: string): void {
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id === conversationId && c.lastMessage) {
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage,
              seenAt,
            },
          };
        }
        return c;
      })
    );
  }

  /**
   * Real-time update: User profile updated (name, avatar, bio, statusMessage)
   */
  updateUserProfile(data: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio?: string | null;
    statusMessage?: string | null;
  }): void {
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.otherUser?.id === data.id) {
          return {
            ...c,
            otherUser: {
              ...c.otherUser,
              name: data.name,
              avatarUrl: data.avatarUrl,
              bio: data.bio !== undefined ? data.bio : c.otherUser.bio,
              statusMessage:
                data.statusMessage !== undefined ? data.statusMessage : c.otherUser.statusMessage,
            },
          };
        }
        return c;
      })
    );
  }
}
