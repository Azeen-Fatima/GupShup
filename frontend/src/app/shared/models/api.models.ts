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
  createdAt?: string;
  updatedAt?: string;
}

export type ConversationState =
  | 'normal'
  | 'pending_sent'
  | 'pending_received'
  | 'declined'
  | 'blocked_by_me'
  | 'isSelf';

export interface ConversationItem {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  state: ConversationState;
  isSelf: boolean;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
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
    seenAt: string | null;
    attachmentUrl: string | null;
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
  type: 'text' | 'image' | 'file';
  body: string | null;
  attachmentUrl: string | null;
  attachmentName?: string | null;
  attachmentSize?: string | null;
  attachmentMime?: string | null;
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
  currentUserId?: string
) {
  const isMe = conv.isSelf;
  const name = isMe ? `${conv.otherUser.name} (Notes to Self)` : conv.otherUser.name;
  const initials = getInitials(conv.otherUser.name);
  const time = conv.lastMessage
    ? formatTime(conv.lastMessage.createdAt)
    : formatTime(conv.createdAt);

  let status: 'sent' | 'seen' | 'pending' | undefined;
  if (conv.lastMessage && conv.lastMessage.senderId === currentUserId) {
    status = conv.lastMessage.seenAt ? 'seen' : 'sent';
  }

  const isPendingRequest = conv.state === 'pending_sent';
  const isIncomingRequest = conv.state === 'pending_received';
  const isDeclined = conv.state === 'declined';
  const isBlocked = conv.state === 'blocked_by_me' || conv.isBlockedByMe;

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
    isPendingRequest,
    isIncomingRequest,
    isSelfNotes: isMe,
    photoUrl: conv.otherUser.avatarUrl,
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

  return {
    id: msg.id,
    chatId: msg.conversationId,
    text: msg.body || '',
    sender: (isMe ? 'me' : 'them') as 'me' | 'them',
    timestamp: msg.createdAt,
    timeString,
    status: (isMe ? (msg.seenAt ? 'seen' : 'sent') : undefined) as 'sent' | 'seen' | undefined,
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
