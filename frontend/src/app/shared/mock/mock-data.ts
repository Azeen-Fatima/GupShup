// TEMPORARY - delete when the real backend is connected

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  email: string;
  initials: string;
  photoUrl: string | null;
}

export interface MessageAttachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: string;
  caption?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
  timeString: string;
  status?: 'sent' | 'seen' | 'pending';
  attachment?: MessageAttachment;
  isFirstUnread?: boolean;
}

export interface ChatItem {
  id: string;
  name: string;
  username?: string;
  initials: string;
  isOnline: boolean;
  lastMessage: string;
  time: string;
  unreadCount: number;
  status?: 'sent' | 'seen' | 'pending';
  isDeclined?: boolean;
  isBlocked?: boolean;
  isPendingRequest?: boolean;   // Sender side (waiting for recipient to accept)
  isIncomingRequest?: boolean;  // Receiver side (X wants to message you)
  isSelfNotes?: boolean;
  photoUrl?: string | null;
}

export interface DeclinedRequest {
  id: string;
  name: string;
  username: string;
  initials: string;
}

export interface BlockedUser {
  id: string;
  name: string;
  username: string;
  initials: string;
}

export interface DiscoverableUser {
  id: string;
  name: string;
  username: string;
  initials: string;
}

export const MOCK_TAKEN_USERNAMES: string[] = [
  'admin',
  'gupshup',
  'root',
  'support',
  'sara',
  'ahmed',
  'hira',
  'bilal',
  'zainab',
  'hamza',
];

export const MOCK_CURRENT_USER: CurrentUser = {
  id: 'user-me',
  name: 'Azeen Fatima',
  username: '@azeen',
  email: 'azeenfatima614@gmail.com',
  initials: 'AF',
  photoUrl: null,
};

export const MOCK_CHATS: ChatItem[] = [
  {
    id: 'notes-self',
    name: 'You',
    initials: 'You',
    isOnline: false,
    lastMessage: 'Notes to self ✨',
    time: 'now',
    unreadCount: 0,
    isSelfNotes: true,
  },
  {
    id: 'c1',
    name: 'Ahmed Khan',
    username: '@ahmedk',
    initials: 'AK',
    isOnline: true,
    lastMessage: 'Alhamdulillah, sab acha!',
    time: '9:16 PM',
    unreadCount: 0,
    status: 'seen',
  },
  {
    id: 'c2',
    name: 'Sara Malik',
    username: '@saram',
    initials: 'SM',
    isOnline: false,
    lastMessage: 'Heyy! I saw your profile…',
    time: 'Mon',
    unreadCount: 2,
  },
  {
    id: 'c-incoming',
    name: 'Danyal Vohra',
    username: '@danyalv',
    initials: 'DV',
    isOnline: true,
    lastMessage: 'Salam Azeen, would love to collaborate on the UI system!',
    time: '10:15 AM',
    unreadCount: 1,
    isIncomingRequest: true, // Receiver side request: bar with Accept / Decline / Block
  },
  {
    id: 'c5',
    name: 'Kashif Mehmood',
    username: '@kashifm',
    initials: 'KM',
    isOnline: true,
    lastMessage: 'Salam! Can you review the draft proposal?',
    time: 'Yesterday',
    unreadCount: 0,
    isPendingRequest: true, // Sender side: "Waiting for Kashif to accept your request"
    status: 'pending',
  },
  {
    id: 'c-image',
    name: 'Zainab Tariq',
    username: '@zainabt',
    initials: 'ZT',
    isOnline: true,
    lastMessage: '📷 Photo: Gupshup moodboard draft',
    time: 'Yesterday',
    unreadCount: 0,
    status: 'seen',
  },
  {
    id: 'c-file',
    name: 'Hamza Sheikh',
    username: '@hamzas',
    initials: 'HS',
    isOnline: false,
    lastMessage: '📄 project-spec-v2.pdf (2.4 MB)',
    time: 'Oct 1',
    unreadCount: 0,
    status: 'seen',
  },
  {
    id: 'c-dates',
    name: 'Maryam Noor',
    username: '@maryamn',
    initials: 'MN',
    isOnline: true,
    lastMessage: 'Looking forward to our sync tomorrow!',
    time: 'Sep 24',
    unreadCount: 0,
    status: 'seen',
  },
  {
    id: 'c3',
    name: 'Hira Zafar',
    username: '@hiraz',
    initials: 'HZ',
    isOnline: false,
    lastMessage: 'ok sure, no worries',
    time: 'Sat',
    unreadCount: 0,
    isDeclined: true,
  },
  {
    id: 'c4',
    name: 'Bilal Asif',
    username: '@bilalasif',
    initials: 'BA',
    isOnline: false,
    lastMessage: 'hey are you free to—',
    time: 'Jul 2',
    unreadCount: 0,
    isBlocked: true,
  },
  {
    id: 'c-empty',
    name: 'Ayesha Siddiqui',
    username: '@ayeshas',
    initials: 'AS',
    isOnline: true,
    lastMessage: 'No messages',
    time: '',
    unreadCount: 0,
  },
  {
    id: 'c-omar',
    name: 'Omar Farooq',
    username: '@omarf',
    initials: 'OF',
    isOnline: false,
    lastMessage: 'The new color palette looks warm and friendly.',
    time: 'Sep 18',
    unreadCount: 0,
    status: 'seen',
  },
  {
    id: 'c-mustafa',
    name: 'Mustafa Kamal',
    username: '@mustafak',
    initials: 'MK',
    isOnline: false,
    lastMessage: 'Checked out the mobile preview, very smooth.',
    time: 'Sep 12',
    unreadCount: 0,
    status: 'sent',
  },
  {
    id: 'c-fatima',
    name: 'Fatima Zahra',
    username: '@fatimaz',
    initials: 'FZ',
    isOnline: true,
    lastMessage: 'Coffee break in 15 mins? ☕',
    time: 'Sep 05',
    unreadCount: 0,
    status: 'seen',
  },
];

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  'notes-self': [
    {
      id: 'm-self-1',
      chatId: 'notes-self',
      text: 'Remember to finalize the Gupshup theme palette 🎨',
      sender: 'me',
      timestamp: '2026-10-03T09:00:00Z',
      timeString: '8:45 AM',
      status: 'seen',
    },
    {
      id: 'm-self-2',
      chatId: 'notes-self',
      text: 'Notes to self ✨',
      sender: 'me',
      timestamp: '2026-10-03T09:10:00Z',
      timeString: 'now',
      status: 'seen',
    },
  ],
  'c1': [
    {
      id: 'm1',
      chatId: 'c1',
      text: 'Assalam o Alaikum! Kaise ho? 😊',
      sender: 'me',
      timestamp: '2026-10-03T09:14:00Z',
      timeString: '9:14 PM',
      status: 'seen',
    },
    {
      id: 'm2',
      chatId: 'c1',
      text: 'Walaikum Assalam! Main theek hoon 🌼',
      sender: 'them',
      timestamp: '2026-10-03T09:15:00Z',
      timeString: '9:15 PM',
    },
    {
      id: 'm3',
      chatId: 'c1',
      text: 'Alhamdulillah, sab acha! Project pe kaam ho raha he 💻',
      sender: 'me',
      timestamp: '2026-10-03T09:16:00Z',
      timeString: '9:16 PM',
      status: 'seen',
    },
    {
      id: 'm4',
      chatId: 'c1',
      text: 'Abhi abhi bheja tha ye 👇',
      sender: 'me',
      timestamp: '2026-10-03T09:17:00Z',
      timeString: '9:17 PM',
      status: 'sent',
    },
  ],
  'c2': [
    {
      id: 'm-s1',
      chatId: 'c2',
      text: 'Hello Azeen! Loved your designs on Gupshup.',
      sender: 'them',
      timestamp: '2026-10-02T10:00:00Z',
      timeString: '10:00 AM',
      isFirstUnread: true,
    },
    {
      id: 'm-s2',
      chatId: 'c2',
      text: 'Heyy! I saw your profile…',
      sender: 'them',
      timestamp: '2026-10-02T10:01:00Z',
      timeString: '10:01 AM',
    },
  ],
  'c-incoming': [
    {
      id: 'm-inc-1',
      chatId: 'c-incoming',
      text: 'Salam Azeen, would love to collaborate on the UI system!',
      sender: 'them',
      timestamp: '2026-10-03T10:15:00Z',
      timeString: '10:15 AM',
      isFirstUnread: true,
    },
  ],
  'c5': [
    {
      id: 'm-k1',
      chatId: 'c5',
      text: 'Salam! Can you review the draft proposal?',
      sender: 'me',
      timestamp: '2026-10-02T16:00:00Z',
      timeString: 'Yesterday',
      status: 'pending', // Pending request: no ticks at all
    },
  ],
  'c-image': [
    {
      id: 'm-img-1',
      chatId: 'c-image',
      text: 'Here is the draft moodboard we discussed! 🎨',
      sender: 'them',
      timestamp: '2026-10-02T14:20:00Z',
      timeString: 'Yesterday',
    },
    {
      id: 'm-img-2',
      chatId: 'c-image',
      text: 'Gupshup moodboard draft',
      sender: 'them',
      timestamp: '2026-10-02T14:21:00Z',
      timeString: 'Yesterday',
      attachment: {
        type: 'image',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="%23F3E3C3"/><rect x="20" y="20" width="360" height="160" rx="12" fill="%23E8A23D" opacity="0.65"/><circle cx="120" cy="100" r="40" fill="%234FA9A0" opacity="0.8"/><text x="200" y="105" font-family="sans-serif" font-weight="bold" font-size="20" fill="%232E2A26">Gupshup Moodboard</text><text x="20" y="215" font-family="sans-serif" font-size="14" fill="%232E2A26">Cozy warm colors &amp; soft corners</text></svg>',
        name: 'moodboard.svg',
        caption: 'Gupshup moodboard draft',
      },
    },
    {
      id: 'm-img-3',
      chatId: 'c-image',
      text: 'Looks super cozy! I love the amber and teal combination.',
      sender: 'me',
      timestamp: '2026-10-02T14:25:00Z',
      timeString: 'Yesterday',
      status: 'seen',
    },
  ],
  'c-file': [
    {
      id: 'm-file-1',
      chatId: 'c-file',
      text: 'Hey Azeen, please find the specification document attached.',
      sender: 'them',
      timestamp: '2026-10-01T11:00:00Z',
      timeString: 'Oct 1',
    },
    {
      id: 'm-file-2',
      chatId: 'c-file',
      text: '',
      sender: 'them',
      timestamp: '2026-10-01T11:02:00Z',
      timeString: 'Oct 1',
      attachment: {
        type: 'file',
        url: '#',
        name: 'project-spec-v2.pdf',
        size: '2.4 MB',
      },
    },
  ],
  'c-dates': [
    {
      id: 'm-d1',
      chatId: 'c-dates',
      text: 'Let us plan the design review timeline.',
      sender: 'them',
      timestamp: '2026-09-24T09:00:00Z',
      timeString: '9:00 AM',
    },
    {
      id: 'm-d2',
      chatId: 'c-dates',
      text: 'Agreed, I will prepare the components checklist.',
      sender: 'me',
      timestamp: '2026-09-24T09:10:00Z',
      timeString: '9:10 AM',
      status: 'seen',
    },
    {
      id: 'm-d3',
      chatId: 'c-dates',
      text: 'Did you get a chance to test dark mode?',
      sender: 'them',
      timestamp: '2026-10-02T18:00:00Z',
      timeString: '6:00 PM',
    },
    {
      id: 'm-d4',
      chatId: 'c-dates',
      text: 'Looking forward to our sync tomorrow!',
      sender: 'them',
      timestamp: '2026-10-03T08:00:00Z',
      timeString: '8:00 AM',
    },
  ],
  'c3': [
    {
      id: 'm-h1',
      chatId: 'c3',
      text: 'ok sure, no worries',
      sender: 'them',
      timestamp: '2026-09-30T10:00:00Z',
      timeString: 'Sat',
    },
  ],
  'c4': [
    {
      id: 'm-b1',
      chatId: 'c4',
      text: 'hey are you free to—',
      sender: 'them',
      timestamp: '2026-07-02T10:00:00Z',
      timeString: 'Jul 2',
    },
  ],
  'c-empty': [],
  'c-omar': [
    {
      id: 'm-o1',
      chatId: 'c-omar',
      text: 'The new color palette looks warm and friendly.',
      sender: 'them',
      timestamp: '2026-09-18T10:00:00Z',
      timeString: '10:00 AM',
    },
  ],
  'c-mustafa': [
    {
      id: 'm-m1',
      chatId: 'c-mustafa',
      text: 'Checked out the mobile preview, very smooth.',
      sender: 'them',
      timestamp: '2026-09-12T15:00:00Z',
      timeString: '3:00 PM',
    },
  ],
  'c-fatima': [
    {
      id: 'm-f1',
      chatId: 'c-fatima',
      text: 'Coffee break in 15 mins? ☕',
      sender: 'them',
      timestamp: '2026-09-05T11:00:00Z',
      timeString: '11:00 AM',
    },
  ],
};

export const MOCK_DECLINED_REQUESTS: DeclinedRequest[] = [
  {
    id: 'dec-1',
    name: 'Hira Zafar',
    username: '@hiraz',
    initials: 'HZ',
  },
];

export const MOCK_BLOCKED_USERS: BlockedUser[] = [
  {
    id: 'blk-1',
    name: 'Bilal Asif',
    username: '@bilalasif',
    initials: 'BA',
  },
];

export const MOCK_DISCOVERABLE_USERS: DiscoverableUser[] = [
  {
    id: 'disc-1',
    name: 'Noor Riaz',
    username: '@noorr',
    initials: 'NR',
  },
  {
    id: 'disc-2',
    name: 'Usman M.',
    username: '@usman.m',
    initials: 'UM',
  },
  {
    id: 'disc-3',
    name: 'Zoya Fawad',
    username: '@zoyaf',
    initials: 'ZF',
  },
  {
    id: 'disc-4',
    name: 'Farhan Ali',
    username: '@farhan.a',
    initials: 'FA',
  },
  {
    id: 'disc-5',
    name: 'Sana Tariq',
    username: '@sanat',
    initials: 'ST',
  },
  {
    id: 'disc-6',
    name: 'Bilal Khan',
    username: '@bilalk',
    initials: 'BK',
  },
];
