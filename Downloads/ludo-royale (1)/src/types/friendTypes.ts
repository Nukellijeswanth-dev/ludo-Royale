export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED';

export interface FriendshipRecord {
  friendshipId: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  blockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FriendUserInfo {
  friendshipId: string;
  playerId: string;
  displayName: string;
  avatar: string;
  level: number;
  rating: number;
  xp: number;
  isOnline: boolean;
  inGame?: boolean;
  status: FriendshipStatus;
  isRequester: boolean;
  createdAt: string;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface GameInvitation {
  invitationId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  senderAvatar: string;
  roomId: string;
  roomCode: string;
  status: InvitationStatus;
  createdAt: number;
  expiresAt: number;
}

export interface FriendSearchPlayer {
  playerId: string;
  displayName: string;
  avatar: string;
  level: number;
  rating: number;
  isOnline: boolean;
  relationshipStatus: 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'BLOCKED';
  friendshipId?: string;
}
