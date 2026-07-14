export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  uniqueID: string;
  status: 'online' | 'offline';
  lastSeen: any; // Timestamp or Date
}

export interface FriendRequest {
  requestId: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: any; // Timestamp or Date
  // Helper field to store sender's profile for display
  senderProfile?: User;
}

export interface Chat {
  chatId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: any; // Timestamp or Date
  // Helper fields for UI
  otherUser?: User;
  unreadCount?: number;
}

export interface Message {
  messageId: string;
  senderId: string;
  text: string;
  timestamp: any; // Timestamp or Date
  status: 'sent' | 'delivered' | 'seen';
}
