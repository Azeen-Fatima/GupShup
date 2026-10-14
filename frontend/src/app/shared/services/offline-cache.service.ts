import { Injectable } from '@angular/core';
import { ConversationItem, Message } from '../models/api.models';

export interface CachedChatList {
  userId: string;
  conversations: ConversationItem[];
  updatedAt: string;
}

export interface CachedConversation {
  key: string; // `${userId}:${conversationId}`
  userId: string;
  conversationId: string;
  conversation: ConversationItem;
  updatedAt: string;
}

export interface CachedMessages {
  key: string; // `${userId}:${conversationId}`
  userId: string;
  conversationId: string;
  messages: Message[];
  updatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineCacheService {
  private readonly dbName = 'gupshup_offline_db';
  private readonly dbVersion = 2;

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store 1: Offline message send queue
        if (!db.objectStoreNames.contains('offline_queue')) {
          const store = db.createObjectStore('offline_queue', { keyPath: 'clientId' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
        }

        // Store 2: Chat list cache (keyed by userId)
        if (!db.objectStoreNames.contains('chat_list_cache')) {
          db.createObjectStore('chat_list_cache', { keyPath: 'userId' });
        }

        // Store 3: Individual conversation metadata cache (keyed by composite key `${userId}:${conversationId}`)
        if (!db.objectStoreNames.contains('conversation_cache')) {
          const convStore = db.createObjectStore('conversation_cache', { keyPath: 'key' });
          convStore.createIndex('userId', 'userId', { unique: false });
          convStore.createIndex('conversationId', 'conversationId', { unique: false });
        }

        // Store 4: Conversation messages cache (last 50 messages, keyed by `${userId}:${conversationId}`)
        if (!db.objectStoreNames.contains('messages_cache')) {
          const msgStore = db.createObjectStore('messages_cache', { keyPath: 'key' });
          msgStore.createIndex('userId', 'userId', { unique: false });
          msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- CHAT LIST CACHE ---

  async saveChatList(userId: string, conversations: ConversationItem[]): Promise<void> {
    if (!userId) return;
    try {
      const db = await this.openDb();
      const sanitized = conversations.map((conv) => ({
        ...conv,
        otherUser: {
          ...conv.otherUser,
          isOnline: false,
          lastSeen: null,
        },
      }));

      return new Promise((resolve, reject) => {
        const tx = db.transaction('chat_list_cache', 'readwrite');
        const store = tx.objectStore('chat_list_cache');
        const req = store.put({
          userId,
          conversations: sanitized,
          updatedAt: new Date().toISOString(),
        } as CachedChatList);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to save chat list cache', err);
    }
  }

  async getChatList(userId: string): Promise<ConversationItem[] | null> {
    if (!userId) return null;
    try {
      const db = await this.openDb();
      return new Promise((resolve) => {
        const tx = db.transaction('chat_list_cache', 'readonly');
        const store = tx.objectStore('chat_list_cache');
        const req = store.get(userId);

        req.onsuccess = () => {
          const item = req.result as CachedChatList | undefined;
          if (!item?.conversations) {
            resolve(null);
            return;
          }

          const now = Date.now();
          // Never show stale presence offline, filter out expired disappearing messages
          const cleaned = item.conversations.map((c) => ({
            ...c,
            otherUser: {
              ...c.otherUser,
              isOnline: false,
              lastSeen: null,
            },
          }));
          resolve(cleaned);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- CONVERSATION INFO CACHE ---

  async saveConversation(userId: string, conv: ConversationItem): Promise<void> {
    if (!userId || !conv?.id) return;
    try {
      const db = await this.openDb();
      const key = `${userId}:${conv.id}`;
      const sanitized: ConversationItem = {
        ...conv,
        otherUser: {
          ...conv.otherUser,
          isOnline: false,
          lastSeen: null,
        },
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction('conversation_cache', 'readwrite');
        const store = tx.objectStore('conversation_cache');
        const req = store.put({
          key,
          userId,
          conversationId: conv.id,
          conversation: sanitized,
          updatedAt: new Date().toISOString(),
        } as CachedConversation);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to save conversation cache', err);
    }
  }

  async getConversation(userId: string, conversationId: string): Promise<ConversationItem | null> {
    if (!userId || !conversationId) return null;
    try {
      const db = await this.openDb();
      const key = `${userId}:${conversationId}`;
      return new Promise((resolve) => {
        const tx = db.transaction('conversation_cache', 'readonly');
        const store = tx.objectStore('conversation_cache');
        const req = store.get(key);

        req.onsuccess = () => {
          const item = req.result as CachedConversation | undefined;
          if (!item?.conversation) {
            resolve(null);
            return;
          }
          // Reset presence to avoid stale online info
          const conv = {
            ...item.conversation,
            otherUser: {
              ...item.conversation.otherUser,
              isOnline: false,
              lastSeen: null,
            },
          };
          resolve(conv);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- MESSAGES CACHE (last 50, NEVER cache locked chats) ---

  async saveMessages(userId: string, conversationId: string, messages: Message[], isLocked = false): Promise<void> {
    if (!userId || !conversationId) return;

    // PRIVACY RULE: Never cache the messages of LOCKED chats
    if (isLocked) {
      await this.deleteMessagesCache(userId, conversationId);
      return;
    }

    try {
      const db = await this.openDb();
      const key = `${userId}:${conversationId}`;
      const now = Date.now();

      // Remove expired disappearing messages and take at most the last 50 messages
      const activeMessages = messages
        .filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now)
        .slice(-50);

      return new Promise((resolve, reject) => {
        const tx = db.transaction('messages_cache', 'readwrite');
        const store = tx.objectStore('messages_cache');
        const req = store.put({
          key,
          userId,
          conversationId,
          messages: activeMessages,
          updatedAt: new Date().toISOString(),
        } as CachedMessages);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to save messages cache', err);
    }
  }

  async getMessages(userId: string, conversationId: string, isLocked = false): Promise<Message[]> {
    if (!userId || !conversationId || isLocked) return [];
    try {
      const db = await this.openDb();
      const key = `${userId}:${conversationId}`;
      return new Promise((resolve) => {
        const tx = db.transaction('messages_cache', 'readonly');
        const store = tx.objectStore('messages_cache');
        const req = store.get(key);

        req.onsuccess = () => {
          const item = req.result as CachedMessages | undefined;
          if (!item?.messages) {
            resolve([]);
            return;
          }
          const now = Date.now();
          // Filter out expired disappearing messages locally
          const valid = item.messages.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now);
          resolve(valid);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async addMessage(userId: string, conversationId: string, message: Message, isLocked = false): Promise<void> {
    if (!userId || !conversationId || isLocked) return;
    try {
      const existing = await this.getMessages(userId, conversationId, isLocked);
      const exists = existing.some((m) => m.id === message.id || (message.clientId && m.clientId === message.clientId));
      if (!exists) {
        const updated = [...existing, message];
        await this.saveMessages(userId, conversationId, updated, isLocked);
      }
    } catch {}
  }

  // --- PURGE / DELETE ---

  async deleteMessagesCache(userId: string, conversationId: string): Promise<void> {
    try {
      const db = await this.openDb();
      const key = `${userId}:${conversationId}`;
      return new Promise((resolve) => {
        const tx = db.transaction('messages_cache', 'readwrite');
        const store = tx.objectStore('messages_cache');
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  }

  async purgeConversation(userId: string, conversationId: string): Promise<void> {
    if (!userId || !conversationId) return;
    try {
      const db = await this.openDb();
      const key = `${userId}:${conversationId}`;
      await new Promise<void>((resolve) => {
        const tx = db.transaction(['conversation_cache', 'messages_cache'], 'readwrite');
        tx.objectStore('conversation_cache').delete(key);
        tx.objectStore('messages_cache').delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });

      // Also remove from chat list cache
      const list = await this.getChatList(userId);
      if (list) {
        const filtered = list.filter((c) => c.id !== conversationId);
        await this.saveChatList(userId, filtered);
      }
    } catch {}
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve) => {
        const stores = ['chat_list_cache', 'conversation_cache', 'messages_cache', 'offline_queue'];
        const tx = db.transaction(stores, 'readwrite');
        for (const s of stores) {
          tx.objectStore(s).clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('Failed to clear offline cache', err);
    }
  }
}
