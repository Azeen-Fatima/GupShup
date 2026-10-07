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

export interface MessageDeliveredPayload {
  messageId?: string;
  clientId?: string;
  conversationId: string;
  deliveredAt: string;
}

export interface MessageReadPayload {
  conversationId: string;
  seenBy?: string;
  seenAt: string;
  readAt?: string;
}

export interface NewMessagePayload {
  conversationId: string;
  message: Message;
}

export interface UserUpdatedPayload {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
  statusMessage?: string | null;
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
  readonly messageDelivered$ = new Subject<MessageDeliveredPayload>();
  readonly messageRead$ = new Subject<MessageReadPayload>();
  readonly presenceUpdate$ = new Subject<PresenceUpdatePayload>();
  readonly typingUpdate$ = new Subject<TypingUpdatePayload>();
  readonly conversationUpdated$ = new Subject<{ conversationId: string; [key: string]: any }>();
  readonly userUpdated$ = new Subject<UserUpdatedPayload>();
  readonly requestNew$ = new Subject<{ conversationId: string; [key: string]: any }>();
  readonly requestAccepted$ = new Subject<{ conversationId: string; [key: string]: any }>();
  readonly requestDeclined$ = new Subject<{ conversationId: string; [key: string]: any }>();
  readonly reconnected$ = new Subject<void>();

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
   * Connect to Socket.io server with fallback transports and clean reconnection
   */
  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
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

    this.socket.io.on('reconnect', () => {
      // Refetch chat list on reconnect
      this.conversationsService.loadConversations().subscribe();
      if (this.socket?.connected) {
        this.socket.emit('presence:heartbeat');
      }
      this.reconnected$.next();
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.clearHeartbeat();
    });

    this.socket.on('message:new', (data: NewMessagePayload) => {
      const activeId = this.conversationsService.activeConversationId();
      const isCurrentActive = activeId === data.conversationId && !document.hidden;

      this.conversationsService.handleNewMessage(data.conversationId, data.message, isCurrentActive);
      this.messageNew$.next(data);

      const myId = this.authService.currentUser()?.id;
      if (myId && data.message.senderId !== myId) {
        if (isCurrentActive) {
          this.markRead(data.conversationId);
        } else {
          this.markDelivered(data.message.id, data.conversationId, data.message.clientId || undefined);
        }
      }
    });

    this.socket.on('message:delivered', (data: MessageDeliveredPayload) => {
      this.conversationsService.handleMessageDelivered(data);
      this.messageDelivered$.next(data);
    });

    this.socket.on('message:read', (data: MessageReadPayload) => {
      this.conversationsService.handleMessagesSeen(data.conversationId, data.seenAt || data.readAt!);
      this.messageRead$.next(data);
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

    this.socket.on('request:new', (data: any) => {
      this.requestNew$.next(data);
      this.conversationsService.loadConversations().subscribe();
    });

    this.socket.on('request:accepted', (data: any) => {
      this.requestAccepted$.next(data);
      this.conversationsService.loadConversations().subscribe();
    });

    this.socket.on('request:declined', (data: any) => {
      this.requestDeclined$.next(data);
      this.conversationsService.loadConversations().subscribe();
    });

    this.socket.on('user:updated', (data: UserUpdatedPayload) => {
      this.conversationsService.updateUserProfile(data);
      this.userUpdated$.next(data);
    });
  }

  /**
   * Send delivered acknowledgement
   */
  markDelivered(messageId?: string, conversationId?: string, clientId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message:delivered', { messageId, conversationId, clientId });
    }
  }

  /**
   * Send read acknowledgement
   */
  markRead(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message:read', { conversationId });
    }
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
  startTyping(conversationId: string, recipientId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing:start', { conversationId, recipientId });
    }
  }

  /**
   * Emit typing stopped in a conversation
   */
  stopTyping(conversationId: string, recipientId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing:stop', { conversationId, recipientId });
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
