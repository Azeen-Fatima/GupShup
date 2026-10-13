import { Injectable, inject } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { MessagesService } from './messages.service';
import { SocketService } from './socket.service';

export interface OfflineQueueItem {
  clientId: string;
  conversationId: string;
  body: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineQueueService {
  private readonly messagesService = inject(MessagesService);
  private readonly socketService = inject(SocketService);

  private readonly dbName = 'gupshup_offline_db';
  private readonly storeName = 'offline_queue';
  private readonly dbVersion = 1;

  private isProcessing = false;
  readonly messageSent$ = new Subject<{ item: OfflineQueueItem; message: any; permissions?: any }>();
  readonly messageFailed$ = new Subject<{ item: OfflineQueueItem; error: any }>();

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.processQueue();
      });
    }

    this.socketService.reconnected$.subscribe(() => {
      void this.processQueue();
    });
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'clientId' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async enqueue(item: OfflineQueueItem): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(item);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to enqueue message in IndexedDB', err);
    }
  }

  async dequeue(clientId: string): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(clientId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to dequeue message from IndexedDB', err);
    }
  }

  async getByConversation(conversationId: string): Promise<OfflineQueueItem[]> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const index = store.index('conversationId');
        const req = index.getAll(conversationId);

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async getAll(): Promise<OfflineQueueItem[]> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;
    try {
      const items = await this.getAll();
      for (const item of items) {
        try {
          const res = await firstValueFrom(
            this.messagesService.sendMessage(item.conversationId, {
              body: item.body,
              clientId: item.clientId,
            })
          );
          await this.dequeue(item.clientId);
          this.messageSent$.next({ item, message: res.message, permissions: res.permissions });
        } catch (err: any) {
          const status = err?.status;
          const code = err?.error?.error?.code || err?.error?.code;

          // 403 policy errors: remove from offline queue so it doesn't loop
          if (
            status === 403 ||
            ['REQUEST_PENDING_LIMIT', 'REQUEST_DECLINED', 'USER_BLOCKED', 'ATTACHMENTS_NOT_ALLOWED'].includes(code)
          ) {
            await this.dequeue(item.clientId);
            this.messageFailed$.next({ item, error: err });
          }
          // Network errors or 5xx: keep in queue for future retry
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
