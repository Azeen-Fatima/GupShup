import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Message } from '../models/api.models';

export interface GetMessagesResult {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UploadAttachmentResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root',
})
export class MessagesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/conversations`;

  /**
   * Fetch paginated messages for a conversation
   */
  getMessages(
    conversationId: string,
    cursor?: string,
    limit = 30
  ): Observable<GetMessagesResult> {
    let url = `${this.baseUrl}/${conversationId}/messages?limit=${limit}`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    return this.http
      .get<ApiResponse<GetMessagesResult>>(url)
      .pipe(map((res) => res.data!));
  }

  /**
   * Send a message in a conversation
   */
  sendMessage(
    conversationId: string,
    data: {
      body?: string;
      type?: 'text' | 'image' | 'file';
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: string;
      attachmentMime?: string;
    }
  ): Observable<Message> {
    return this.http
      .post<ApiResponse<{ message: Message }>>(
        `${this.baseUrl}/${conversationId}/messages`,
        data
      )
      .pipe(map((res) => res.data!.message));
  }

  /**
   * Mark messages as seen in conversation
   */
  markSeen(conversationId: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<{ success: boolean }>>(
        `${this.baseUrl}/${conversationId}/seen`,
        {}
      )
      .pipe(map((res) => res.success));
  }

  /**
   * Upload image or file attachment
   */
  uploadAttachment(file: File): Observable<UploadAttachmentResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<UploadAttachmentResult>>(
        `${environment.apiUrl}/uploads/image`,
        formData
      )
      .pipe(map((res) => res.data!));
  }
}
