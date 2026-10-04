import { Injectable, inject, signal, effect, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ConversationsService } from './conversations.service';
import { Message } from '../models/api.models';

export interface PresenceUpdatePayload {
  userId: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface TypingUpdatePayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessageSeenPayload {
  conversationId: string;
  seenBy: string;
  seenAt: string;
}

export interface NewMessagePayload {
  conversationId: string;
  message: Message;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly conversationsService = inject(ConversationsService);

  private socket: Socket | null = null;
  private heartbeatInterval: any = null;

  readonly isConnected = signal<boolean>(false);

  // Observable event streams
  readonly messageNew$ = new Subject<NewMessagePayload>();
  readonly messageSeen$ = new Subject<MessageSeenPayload>();
  readonly presenceUpdate$ = new Subject<PresenceUpdatePayload>();
  readonly typingUpdate$ = new Subject<TypingUpdatePayload>();
  readonly conversationUpdated$ = new Subject<{ conversationId: string; [key: string]: any }>();

  constructor() {
    // Automatically manage connection lifecycle based on authentication signal
    effect(() => {
      const token = this.authService.accessToken();
      if (token && !this.isConnected()) {
        this.connect(token);
      } else if (!token && this.isConnected()) {
        this.disconnect();
      }
    });
  }

  /**
   * Connect to Socket.io server
   */
  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);

      // Start presence heartbeat (every 25s)
      this.clearHeartbeat();
      this.heartbeatInterval = setInterval(() => {
        if (this.socket?.connected) {
          this.socket.emit('presence:heartbeat');
        }
      }, 25000);
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.clearHeartbeat();
    });

    this.socket.on('message:new', (data: NewMessagePayload) => {
      const activeId = this.conversationsService.activeConversationId();
      const isCurrentActive = activeId === data.conversationId;

      this.conversationsService.handleNewMessage(data.conversationId, data.message, isCurrentActive);
      this.messageNew$.next(data);
    });

    this.socket.on('message:seen', (data: MessageSeenPayload) => {
      this.conversationsService.handleMessagesSeen(data.conversationId, data.seenAt);
      this.messageSeen$.next(data);
    });

    this.socket.on('presence:update', (data: PresenceUpdatePayload) => {
      this.conversationsService.updatePresence(data.userId, data.isOnline, data.lastSeen);
      this.presenceUpdate$.next(data);
    });

    this.socket.on('typing:update', (data: TypingUpdatePayload) => {
      this.typingUpdate$.next(data);
    });

    this.socket.on('conversation:updated', (data: any) => {
      this.conversationUpdated$.next(data);
      this.conversationsService.loadConversations().subscribe();
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.clearHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected.set(false);
  }

  /**
   * Emit typing started in a conversation
   */
  startTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing:start', { conversationId });
    }
  }

  /**
   * Emit typing stopped in a conversation
   */
  stopTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing:stop', { conversationId });
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
