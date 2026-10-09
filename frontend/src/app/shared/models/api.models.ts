export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  meta: {
    nextCursor?: string | null;
    hasMore: boolean;
    [key: string]: any;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
  statusMessage?: string | null;
  themePreference?: 'system' | 'light' | 'dark' | 'auto';
  hasPassword?: boolean;
  authProvider?: 'local' | 'google';
  createdAt?: string;
  updatedAt?: string;
}

export type ConversationState =
  | 'normal'
  | 'pending_sent'
  | 'pending_received'
  | 'declined'
  | 'blocked_by_me'
  | 'blocked_by_them'
  | 'isSelf';

export interface ConversationItem {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  state: ConversationState;
  isSelf: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
  isLocked?: boolean;
  disappearingMode?: 'off' | '24h' | '7d';
  declineCount?: number;
  declinedAt?: string | null;
  canSendExtraMessage?: boolean;
  createdAt: string;
  lastMessageAt: string;
  otherUser: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
    statusMessage?: string | null;
    bio?: string | null;
    isOnline: boolean;
    lastSeen?: string | null;
  };
  lastMessage: {
    id: string;
    body: string | null;
    type: string;
    senderId: string;
    createdAt: string;
    deliveredAt?: string | null;
    seenAt: string | null;
    attachmentUrl: string | null;
    clientId?: string | null;
    isMasked?: boolean;
  } | null;
  unreadCount: number;
}

export interface MessageAttachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
  size?: string;
  mime?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'system';
  body: string | null;
  attachmentUrl: string | null;
  attachmentName?: string | null;
  attachmentSize?: string | null;
  attachmentMime?: string | null;
  clientId?: string | null;
  expiresAt?: string | null;
  isMasked?: boolean;
  createdAt: string;
  deliveredAt?: string | null;
  seenAt?: string | null;
}

export type RelationshipStatus =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted'
  | 'declined'
  | 'blocked_by_me'
  | 'blocked_by_them';

export interface SearchUserResult {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  statusMessage: string | null;
  bio: string | null;
  relationshipStatus: RelationshipStatus;
  conversationId?: string;
}

export interface DeclinedItem {
  conversationId: string;
  user: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
    statusMessage?: string | null;
  };
  declinedAt: string;
  declineCount?: number;
}

export interface BlockedItem {
  id: string;
  user: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
    statusMessage?: string | null;
  };
  createdAt: string;
}

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatConversationToChatItem(
  conv: ConversationItem,
  currentUserId?: string,
  currentUserAvatarUrl?: string | null
) {
  const isMe = conv.isSelf;
  const name = isMe ? `${conv.otherUser.name} (Notes to Self)` : conv.otherUser.name;
  const initials = getInitials(conv.otherUser.name);
  const time = conv.lastMessage
    ? formatTime(conv.lastMessage.createdAt)
    : formatTime(conv.createdAt);

  let status: 'sent' | 'delivered' | 'seen' | 'pending' | undefined;
  if (conv.lastMessage && conv.lastMessage.senderId === currentUserId) {
    status = conv.lastMessage.seenAt ? 'seen' : (conv.lastMessage.deliveredAt ? 'delivered' : 'sent');
  }

  const isPendingRequest = conv.state === 'pending_sent';
  const isIncomingRequest = conv.state === 'pending_received';
  const isDeclined = conv.state === 'declined' || conv.status === 'declined';
  const isBlocked = conv.state === 'blocked_by_me' || conv.isBlockedByMe;
  const isBlockedByThem = conv.state === 'blocked_by_them' || conv.isBlockedByThem;

  return {
    id: conv.id,
    name,
    username: conv.otherUser.username ? `@${conv.otherUser.username}` : undefined,
    initials,
    isOnline: isMe ? true : conv.otherUser.isOnline,
    lastMessage: conv.lastMessage?.body || (conv.lastMessage?.attachmentUrl ? '📷 Photo' : ''),
    time,
    unreadCount: conv.unreadCount,
    status,
    isDeclined,
    isBlocked,
    isBlockedByThem,
    isPendingRequest,
    isIncomingRequest,
    isSelfNotes: isMe,
    photoUrl: (isMe && currentUserAvatarUrl) ? currentUserAvatarUrl : (conv.otherUser.avatarUrl || null),
    isLocked: conv.isLocked ?? false,
    disappearingMode: conv.disappearingMode || 'off',
    declineCount: conv.declineCount ?? 0,
    declinedAt: conv.declinedAt || null,
    canSendExtraMessage: conv.canSendExtraMessage ?? false,
    rawState: conv.state,
    rawStatus: conv.status,
    otherUserId: conv.otherUser.id,
    lastSeen: conv.otherUser.lastSeen || null,
  };
}

export function formatMessageToChatMessage(
  msg: Message,
  currentUserId?: string
) {
  const isMe = msg.senderId === currentUserId;
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  let status: 'sent' | 'delivered' | 'seen' | 'pending' | undefined;
  if (isMe) {
    status = msg.seenAt ? 'seen' : (msg.deliveredAt ? 'delivered' : 'sent');
  }

  return {
    id: msg.id,
    clientId: msg.clientId || undefined,
    chatId: msg.conversationId,
    text: msg.body || '',
    sender: (isMe ? 'me' : 'them') as 'me' | 'them',
    timestamp: msg.createdAt,
    timeString,
    status,
    type: msg.type || 'text',
    expiresAt: msg.expiresAt || null,
    isMasked: msg.isMasked || false,
    attachment: msg.attachmentUrl
      ? {
          type: (msg.type as any) || 'image',
          url: msg.attachmentUrl,
          name: msg.attachmentName || 'Attachment',
          size: msg.attachmentSize || undefined,
        }
      : undefined,
  };
}
