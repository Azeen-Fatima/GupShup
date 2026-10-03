import { Injectable, signal, computed } from '@angular/core';
import {
  MOCK_CURRENT_USER,
  MOCK_CHATS,
  MOCK_MESSAGES,
  MOCK_DECLINED_REQUESTS,
  MOCK_BLOCKED_USERS,
  MOCK_DISCOVERABLE_USERS,
  MOCK_TAKEN_USERNAMES,
  ChatItem,
  ChatMessage,
  CurrentUser,
  DeclinedRequest,
  BlockedUser,
  DiscoverableUser,
  MessageAttachment,
} from '../mock/mock-data';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  // Current user state
  readonly currentUser = signal<CurrentUser>({ ...MOCK_CURRENT_USER });

  // Chats list state
  readonly chats = signal<ChatItem[]>([...MOCK_CHATS]);

  // Messages dictionary state
  readonly messagesMap = signal<Record<string, ChatMessage[]>>({
    ...MOCK_MESSAGES,
  });

  // Declined requests state
  readonly declinedRequests = signal<DeclinedRequest[]>([...MOCK_DECLINED_REQUESTS]);

  // Blocked users state
  readonly blockedUsers = signal<BlockedUser[]>([...MOCK_BLOCKED_USERS]);

  // Discoverable users for Find People sheet
  readonly discoverableUsers = signal<DiscoverableUser[]>([...MOCK_DISCOVERABLE_USERS]);

  // Computed counts
  readonly declinedCount = computed(() => this.declinedRequests().length);
  readonly blockedCount = computed(() => this.blockedUsers().length);

  updateCurrentUser(updated: Partial<CurrentUser>): void {
    this.currentUser.update((user) => ({ ...user, ...updated }));
  }

  isUsernameTaken(username: string): boolean {
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    const myClean = this.currentUser().username.replace(/^@/, '').toLowerCase();
    if (clean === myClean) {
      return false; // Own username is valid
    }
    return MOCK_TAKEN_USERNAMES.includes(clean);
  }

  getChatById(id: string): ChatItem | undefined {
    const existing = this.chats().find((c) => c.id === id);
    if (existing) {
      return existing;
    }

    // Check if it's a draft chat for a discoverable user
    if (id.startsWith('new-')) {
      const discId = id.replace('new-', '');
      const disc = this.discoverableUsers().find((u) => u.id === discId);
      if (disc) {
        return {
          id,
          name: disc.name,
          username: disc.username,
          initials: disc.initials,
          isOnline: true,
          lastMessage: '',
          time: '',
          unreadCount: 0,
          isPendingRequest: true,
          status: undefined, // no ticks
        };
      }
    }

    return undefined;
  }

  getMessages(chatId: string): ChatMessage[] {
    return this.messagesMap()[chatId] || [];
  }

  sendMessage(chatId: string, text: string, attachment?: MessageAttachment): void {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    // Check if sending first message to a discoverable user
    if (chatId.startsWith('new-')) {
      const discId = chatId.replace('new-', '');
      const discUser = this.discoverableUsers().find((u) => u.id === discId);

      if (discUser) {
        // Remove from discoverable users list
        this.discoverableUsers.update((list) => list.filter((u) => u.id !== discId));

        // Add to top of chats list as pending request with no ticks
        const newChat: ChatItem = {
          id: chatId,
          name: discUser.name,
          username: discUser.username,
          initials: discUser.initials,
          isOnline: true,
          lastMessage: attachment ? (attachment.type === 'image' ? '📷 Photo' : '📄 File') : trimmed,
          time: timeString,
          unreadCount: 0,
          isPendingRequest: true,
          status: undefined, // no ticks
        };

        this.chats.update((list) => [newChat, ...list]);
      }
    }

    const chat = this.getChatById(chatId);
    // If chat is a pending request, no ticks; otherwise 1 tick (sent)
    const status: 'sent' | undefined = chat?.isPendingRequest ? undefined : 'sent';

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      chatId,
      text: trimmed,
      sender: 'me',
      timestamp: now.toISOString(),
      timeString,
      status: chat?.isPendingRequest ? 'pending' : status,
      attachment,
    };

    // Update messages map
    this.messagesMap.update((map) => {
      const currentList = map[chatId] || [];
      return {
        ...map,
        [chatId]: [...currentList, newMsg],
      };
    });

    const previewText = attachment
      ? (attachment.type === 'image' ? '📷 Photo' : '📄 ' + attachment.name)
      : trimmed;

    // Update chat row's lastMessage and time
    this.chats.update((list) =>
      list.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            lastMessage: previewText,
            time: timeString,
            status,
          };
        }
        return c;
      })
    );
  }

  deleteChat(chatId: string): void {
    this.chats.update((list) => list.filter((c) => c.id !== chatId));
    this.messagesMap.update((map) => {
      const copy = { ...map };
      delete copy[chatId];
      return copy;
    });
  }

  clearChat(chatId: string): void {
    this.messagesMap.update((map) => ({
      ...map,
      [chatId]: [],
    }));
    this.chats.update((list) =>
      list.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            lastMessage: 'No messages',
            time: '',
            status: undefined, // No ticks
          };
        }
        return c;
      })
    );
  }

  acceptIncomingRequest(chatId: string): void {
    this.chats.update((list) =>
      list.map((c) => (c.id === chatId ? { ...c, isIncomingRequest: false } : c))
    );
  }

  declineIncomingRequest(chatId: string): void {
    const chat = this.getChatById(chatId);
    if (!chat) return;

    // Remove incoming request, mark as declined
    this.chats.update((list) =>
      list.map((c) =>
        c.id === chatId ? { ...c, isIncomingRequest: false, isDeclined: true } : c
      )
    );

    // Add to declined requests in Settings
    const exists = this.declinedRequests().some((r) => r.name === chat.name);
    if (!exists) {
      this.declinedRequests.update((list) => [
        ...list,
        {
          id: 'dec-' + Date.now(),
          name: chat.name,
          username: chat.username || '@' + chat.name.toLowerCase().replace(/\s+/g, ''),
          initials: chat.initials,
        },
      ]);
    }
  }

  blockUser(chatId: string): void {
    const chat = this.getChatById(chatId);
    if (!chat) return;

    this.chats.update((list) =>
      list.map((c) => (c.id === chatId ? { ...c, isBlocked: true, isIncomingRequest: false } : c))
    );

    // Add to blocked list if not already there
    const exists = this.blockedUsers().some((u) => u.name === chat.name);
    if (!exists) {
      this.blockedUsers.update((list) => [
        ...list,
        {
          id: 'blk-' + Date.now(),
          name: chat.name,
          username: chat.username || '@' + chat.name.toLowerCase().replace(/\s+/g, ''),
          initials: chat.initials,
        },
      ]);
    }
  }

  unblockUser(userName: string): void {
    this.blockedUsers.update((list) => list.filter((u) => u.name !== userName));
    this.chats.update((list) =>
      list.map((c) => (c.name === userName ? { ...c, isBlocked: false } : c))
    );
  }

  acceptDeclinedRequest(requestId: string): void {
    const req = this.declinedRequests().find((r) => r.id === requestId);
    if (!req) return;

    this.declinedRequests.update((list) => list.filter((r) => r.id !== requestId));
    // Also remove declined state from chat row if it was in the list
    this.chats.update((list) =>
      list.map((c) => (c.name === req.name ? { ...c, isDeclined: false } : c))
    );
  }

  startOrOpenChat(user: DiscoverableUser): string {
    const existing = this.chats().find(
      (c) => c.name === user.name || (user.username && c.username === user.username)
    );
    if (existing) {
      return existing.id;
    }

    return 'new-' + user.id;
  }
}
