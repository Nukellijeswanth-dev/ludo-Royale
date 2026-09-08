import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import {
  FriendshipRecord,
  FriendshipStatus,
  FriendUserInfo,
  GameInvitation,
  FriendSearchPlayer,
} from '../types/friendTypes';
import { playerDb, PlayerProfile } from './playerDatabase';
import { Room, RoomPlayer } from '../types/roomTypes';
import { PlayerColor } from '../types/gameTypes';

export class FriendsDatabase {
  private dataDir: string;
  private friendsFile: string;
  private friendships: Map<string, FriendshipRecord> = new Map();
  private invitations: Map<string, GameInvitation> = new Map();
  // Map of playerId -> Set of active WebSockets for real-time presence
  private activeSockets: Map<string, Set<WebSocket>> = new Map();
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.friendsFile = path.join(dataDir, 'friends.json');
    this.init();

    // Clean up expired invitations periodically
    setInterval(() => {
      this.cleanupExpiredInvitations();
    }, 10000);
  }

  private init(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.friendsFile)) {
        const raw = fs.readFileSync(this.friendsFile, 'utf-8');
        const list: FriendshipRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.friendships.set(item.friendshipId, item);
        }
      }
    } catch (err) {
      console.warn('[FriendsDatabase] Failed to load friends file, starting fresh:', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveToDisk();
    }, 500);
  }

  private saveToDisk(): void {
    try {
      const arr = Array.from(this.friendships.values());
      fs.writeFileSync(this.friendsFile, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FriendsDatabase] Save failed:', err);
    }
  }

  // ==================== PRESENCE TRACKING ====================

  public registerSocket(playerId: string, ws: WebSocket): void {
    if (!playerId || !ws) return;
    let set = this.activeSockets.get(playerId);
    if (!set) {
      set = new Set();
      this.activeSockets.set(playerId, set);
    }
    const wasOffline = set.size === 0;
    set.add(ws);

    if (wasOffline) {
      this.broadcastPresenceToFriends(playerId, true);
    }
  }

  public unregisterSocket(playerId: string, ws: WebSocket): void {
    if (!playerId) return;
    const set = this.activeSockets.get(playerId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        this.activeSockets.delete(playerId);
        this.broadcastPresenceToFriends(playerId, false);
      }
    }
  }

  public isPlayerOnline(playerId: string): boolean {
    const set = this.activeSockets.get(playerId);
    return Boolean(set && set.size > 0);
  }

  public getPlayerSockets(playerId: string): WebSocket[] {
    const set = this.activeSockets.get(playerId);
    if (!set) return [];
    return Array.from(set).filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  public sendToPlayer(playerId: string, message: any): void {
    const sockets = this.getPlayerSockets(playerId);
    const payload = JSON.stringify(message);
    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch (err) {
        console.warn(`[FriendsDatabase] Failed to send to player ${playerId}:`, err);
      }
    }
  }

  private broadcastPresenceToFriends(playerId: string, isOnline: boolean): void {
    const friends = this.getAcceptedFriendIds(playerId);
    for (const friendId of friends) {
      this.sendToPlayer(friendId, {
        type: 'FRIEND_PRESENCE_UPDATE',
        playerId,
        isOnline,
      });
    }
  }

  private getAcceptedFriendIds(playerId: string): string[] {
    const result: string[] = [];
    for (const f of this.friendships.values()) {
      if (f.status === 'ACCEPTED') {
        if (f.requesterId === playerId) {
          result.push(f.receiverId);
        } else if (f.receiverId === playerId) {
          result.push(f.requesterId);
        }
      }
    }
    return result;
  }

  // ==================== RELATIONSHIP QUERIES ====================

  public getRelationship(userA: string, userB: string): FriendshipRecord | null {
    for (const f of this.friendships.values()) {
      if (
        (f.requesterId === userA && f.receiverId === userB) ||
        (f.requesterId === userB && f.receiverId === userA)
      ) {
        return f;
      }
    }
    return null;
  }

  public isBlocked(userA: string, userB: string): boolean {
    const rel = this.getRelationship(userA, userB);
    return Boolean(rel && rel.status === 'BLOCKED');
  }

  // ==================== SEARCH PLAYERS ====================

  public searchPlayers(currentUserId: string, query: string): FriendSearchPlayer[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const allProfiles = playerDb.getAllProfiles ? playerDb.getAllProfiles() : [];
    const results: FriendSearchPlayer[] = [];

    for (const p of allProfiles) {
      if (p.playerId === currentUserId) continue;

      const rel = this.getRelationship(currentUserId, p.playerId);
      if (rel && rel.status === 'BLOCKED') continue;

      const matchId = p.playerId.toLowerCase() === q;
      const matchName = (p.displayName || p.name || '').toLowerCase().includes(q);

      if (matchId || matchName) {
        let relationshipStatus: FriendSearchPlayer['relationshipStatus'] = 'NONE';
        if (rel) {
          if (rel.status === 'ACCEPTED') relationshipStatus = 'FRIENDS';
          else if (rel.status === 'PENDING') {
            relationshipStatus = rel.requesterId === currentUserId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
          }
        }

        results.push({
          playerId: p.playerId,
          displayName: p.displayName || p.name || 'Player',
          avatar: p.avatar || '👑',
          level: p.level || 1,
          rating: p.rating || 1500,
          isOnline: this.isPlayerOnline(p.playerId),
          relationshipStatus,
          friendshipId: rel?.friendshipId,
        });
      }

      if (results.length >= 20) break;
    }

    return results;
  }

  // ==================== FRIEND REQUESTS ====================

  public sendFriendRequest(
    requesterId: string,
    receiverId: string
  ): { success: boolean; message: string; record?: FriendshipRecord } {
    if (!requesterId || !receiverId) {
      return { success: false, message: 'Invalid player IDs' };
    }

    if (requesterId === receiverId) {
      return { success: false, message: 'You cannot send a friend request to yourself.' };
    }

    const receiverProfile = playerDb.getProfile(receiverId);
    if (!receiverProfile) {
      return { success: false, message: 'Player not found.' };
    }

    const existing = this.getRelationship(requesterId, receiverId);
    if (existing) {
      if (existing.status === 'BLOCKED') {
        return { success: false, message: 'Unable to send friend request to this player.' };
      }
      if (existing.status === 'ACCEPTED') {
        return { success: false, message: 'You are already friends with this player.' };
      }
      if (existing.status === 'PENDING') {
        if (existing.requesterId === requesterId) {
          return { success: false, message: 'Friend request already sent and pending.' };
        } else {
          // Mutual request! Auto-accept
          existing.status = 'ACCEPTED';
          existing.updatedAt = new Date().toISOString();
          this.scheduleSave();
          this.notifyFriendUpdate(existing, 'ACCEPTED');
          return { success: true, message: 'Friend request accepted!', record: existing };
        }
      }
      if (existing.status === 'DECLINED') {
        // Re-open request
        existing.requesterId = requesterId;
        existing.receiverId = receiverId;
        existing.status = 'PENDING';
        existing.updatedAt = new Date().toISOString();
        this.scheduleSave();
        this.notifyFriendRequest(existing);
        return { success: true, message: 'Friend request sent!', record: existing };
      }
    }

    const now = new Date().toISOString();
    const newRecord: FriendshipRecord = {
      friendshipId: `fr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      requesterId,
      receiverId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    this.friendships.set(newRecord.friendshipId, newRecord);
    this.scheduleSave();

    this.notifyFriendRequest(newRecord);

    return { success: true, message: 'Friend request sent successfully!', record: newRecord };
  }

  public respondFriendRequest(
    userId: string,
    friendshipId: string,
    action: 'ACCEPT' | 'DECLINE'
  ): { success: boolean; message: string; record?: FriendshipRecord } {
    const record = this.friendships.get(friendshipId);
    if (!record) {
      return { success: false, message: 'Friend request not found.' };
    }

    if (record.receiverId !== userId && record.requesterId !== userId) {
      return { success: false, message: 'Unauthorized.' };
    }

    if (record.status !== 'PENDING') {
      return { success: false, message: `Request is already ${record.status.toLowerCase()}.` };
    }

    record.status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
    record.updatedAt = new Date().toISOString();
    this.scheduleSave();

    this.notifyFriendUpdate(record, action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED');

    return {
      success: true,
      message: action === 'ACCEPT' ? 'Friend request accepted!' : 'Friend request declined.',
      record,
    };
  }

  public removeFriend(
    userId: string,
    friendshipId: string
  ): { success: boolean; message: string } {
    const record = this.friendships.get(friendshipId);
    if (!record) {
      return { success: false, message: 'Friendship not found.' };
    }

    if (record.requesterId !== userId && record.receiverId !== userId) {
      return { success: false, message: 'Unauthorized.' };
    }

    this.friendships.delete(friendshipId);
    this.scheduleSave();

    this.notifyFriendUpdate(record, 'REMOVED');

    return { success: true, message: 'Friend removed successfully.' };
  }

  public blockPlayer(
    userId: string,
    targetPlayerId: string
  ): { success: boolean; message: string; record?: FriendshipRecord } {
    if (userId === targetPlayerId) {
      return { success: false, message: 'Cannot block yourself.' };
    }

    const existing = this.getRelationship(userId, targetPlayerId);
    const now = new Date().toISOString();

    if (existing) {
      existing.status = 'BLOCKED';
      existing.blockedBy = userId;
      existing.updatedAt = now;
      this.scheduleSave();
      this.notifyFriendUpdate(existing, 'BLOCKED');
      return { success: true, message: 'Player blocked.', record: existing };
    }

    const newRecord: FriendshipRecord = {
      friendshipId: `blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      requesterId: userId,
      receiverId: targetPlayerId,
      status: 'BLOCKED',
      blockedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    this.friendships.set(newRecord.friendshipId, newRecord);
    this.scheduleSave();
    this.notifyFriendUpdate(newRecord, 'BLOCKED');

    return { success: true, message: 'Player blocked.', record: newRecord };
  }

  public unblockPlayer(
    userId: string,
    targetPlayerId: string
  ): { success: boolean; message: string } {
    const existing = this.getRelationship(userId, targetPlayerId);
    if (!existing || existing.status !== 'BLOCKED' || existing.blockedBy !== userId) {
      return { success: false, message: 'Player is not blocked by you.' };
    }

    this.friendships.delete(existing.friendshipId);
    this.scheduleSave();

    return { success: true, message: 'Player unblocked.' };
  }

  // ==================== LISTS ====================

  public getFriendsData(userId: string): {
    friends: FriendUserInfo[];
    incomingRequests: FriendUserInfo[];
    outgoingRequests: FriendUserInfo[];
    blocked: FriendUserInfo[];
  } {
    const friends: FriendUserInfo[] = [];
    const incomingRequests: FriendUserInfo[] = [];
    const outgoingRequests: FriendUserInfo[] = [];
    const blocked: FriendUserInfo[] = [];

    for (const f of this.friendships.values()) {
      if (f.requesterId !== userId && f.receiverId !== userId) continue;

      const isRequester = f.requesterId === userId;
      const targetId = isRequester ? f.receiverId : f.requesterId;
      const profile = playerDb.getProfile(targetId);

      const info: FriendUserInfo = {
        friendshipId: f.friendshipId,
        playerId: targetId,
        displayName: profile?.displayName || profile?.name || 'Player',
        avatar: profile?.avatar || '👑',
        level: profile?.level || 1,
        rating: profile?.rating || 1500,
        xp: profile?.xp || 0,
        isOnline: this.isPlayerOnline(targetId),
        status: f.status,
        isRequester,
        createdAt: f.createdAt,
      };

      if (f.status === 'ACCEPTED') {
        friends.push(info);
      } else if (f.status === 'PENDING') {
        if (isRequester) {
          outgoingRequests.push(info);
        } else {
          incomingRequests.push(info);
        }
      } else if (f.status === 'BLOCKED' && f.blockedBy === userId) {
        blocked.push(info);
      }
    }

    // Sort friends: online first, then alphabetical
    friends.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return { friends, incomingRequests, outgoingRequests, blocked };
  }

  // ==================== WEBSOCKET NOTIFICATIONS ====================

  private notifyFriendRequest(record: FriendshipRecord): void {
    const sender = playerDb.getProfile(record.requesterId);
    const requestPayload = {
      friendshipId: record.friendshipId,
      requesterId: record.requesterId,
      displayName: sender?.displayName || sender?.name || 'Player',
      avatar: sender?.avatar || '👑',
      level: sender?.level || 1,
      rating: sender?.rating || 1500,
      createdAt: record.createdAt,
    };

    this.sendToPlayer(record.receiverId, {
      type: 'FRIEND_REQUEST_RECEIVED',
      request: requestPayload,
    });
  }

  private notifyFriendUpdate(
    record: FriendshipRecord,
    action: 'ACCEPTED' | 'DECLINED' | 'REMOVED' | 'BLOCKED'
  ): void {
    const msg = {
      type: 'FRIEND_REQUEST_UPDATED',
      friendship: record,
      action,
    };
    this.sendToPlayer(record.requesterId, msg);
    this.sendToPlayer(record.receiverId, msg);
  }

  // ==================== PRIVATE GAME INVITATIONS ====================

  public createGameInvitation(params: {
    senderId: string;
    receiverId: string;
    roomCode: string;
    roomsMap: Map<string, Room>;
  }): { success: boolean; message: string; invitation?: GameInvitation } {
    const { senderId, receiverId, roomCode, roomsMap } = params;

    if (senderId === receiverId) {
      return { success: false, message: 'Cannot invite yourself.' };
    }

    if (this.isBlocked(senderId, receiverId)) {
      return { success: false, message: 'Cannot invite this player.' };
    }

    const room = roomsMap.get(roomCode);
    if (!room) {
      return { success: false, message: 'Room not found.' };
    }

    const hostPlayer = room.players.find((p) => p.id === senderId);
    if (!hostPlayer || !hostPlayer.isHost) {
      return { success: false, message: 'Only the room host can send game invitations.' };
    }

    if (room.state === 'PLAYING' || room.state === 'FINISHED') {
      return { success: false, message: 'Cannot send invite: match has already started.' };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, message: 'Room is already full.' };
    }

    if (!this.isPlayerOnline(receiverId)) {
      return { success: false, message: 'Player is currently offline.' };
    }

    // Check if player is already in this room
    if (room.players.some((p) => p.id === receiverId)) {
      return { success: false, message: 'Player is already in this room.' };
    }

    const senderProfile = playerDb.getProfile(senderId);
    const now = Date.now();
    const invitation: GameInvitation = {
      invitationId: `inv_${now}_${Math.random().toString(36).substring(2, 7)}`,
      senderId,
      receiverId,
      senderName: senderProfile?.displayName || hostPlayer.name || 'Host',
      senderAvatar: senderProfile?.avatar || hostPlayer.avatar || '👑',
      roomId: room.code,
      roomCode: room.code,
      status: 'PENDING',
      createdAt: now,
      expiresAt: now + 60000, // 60 seconds TTL
    };

    this.invitations.set(invitation.invitationId, invitation);

    // Send instant WebSocket event to receiver
    this.sendToPlayer(receiverId, {
      type: 'GAME_INVITE_RECEIVED',
      invitation,
    });

    return {
      success: true,
      message: `Invitation sent to ${invitation.senderName}!`,
      invitation,
    };
  }

  public respondGameInvitation(params: {
    invitationId: string;
    receiverId: string;
    action: 'ACCEPT' | 'DECLINE';
    roomsMap: Map<string, Room>;
    wss: any;
    clientMeta: Map<WebSocket, { roomCode?: string; playerId?: string }>;
    broadcastRoom: (room: Room, wss: any) => void;
    createRoomPlayer: (params: any) => RoomPlayer;
    calculateRoomState: (room: Room) => any;
  }): { success: boolean; message: string; room?: Room; roomCode?: string } {
    const {
      invitationId,
      receiverId,
      action,
      roomsMap,
      wss,
      clientMeta,
      broadcastRoom,
      createRoomPlayer,
      calculateRoomState,
    } = params;

    const invite = this.invitations.get(invitationId);
    if (!invite) {
      return { success: false, message: 'Game invitation expired or not found.' };
    }

    if (invite.receiverId !== receiverId) {
      return { success: false, message: 'Unauthorized invitation response.' };
    }

    if (Date.now() > invite.expiresAt || invite.status === 'EXPIRED') {
      invite.status = 'EXPIRED';
      return { success: false, message: 'Game invitation expired.' };
    }

    if (invite.status !== 'PENDING') {
      return { success: false, message: `Invitation was already ${invite.status.toLowerCase()}.` };
    }

    if (action === 'DECLINE') {
      invite.status = 'DECLINED';
      this.sendToPlayer(invite.senderId, {
        type: 'GAME_INVITE_RESPONSE',
        invitationId,
        status: 'DECLINED',
        message: 'Your game invitation was declined.',
      });
      return { success: true, message: 'Invitation declined.' };
    }

    // ACTION: ACCEPT
    // 1. Verify room still exists
    const room = roomsMap.get(invite.roomCode);
    if (!room) {
      invite.status = 'EXPIRED';
      return { success: false, message: 'The room no longer exists.' };
    }

    // 2. Verify sender still owns the room
    const host = room.players.find((p) => p.id === invite.senderId && p.isHost);
    if (!host) {
      invite.status = 'EXPIRED';
      return { success: false, message: 'The host is no longer in this room.' };
    }

    // 3. Verify room is not full
    if (room.players.length >= room.maxPlayers) {
      invite.status = 'EXPIRED';
      return { success: false, message: 'Room is full.' };
    }

    // 4. Verify game has not started
    if (room.state === 'PLAYING' || room.state === 'FINISHED') {
      invite.status = 'EXPIRED';
      return { success: false, message: 'This game has already started.' };
    }

    // 5. Add receiver to the room
    invite.status = 'ACCEPTED';
    const receiverProfile = playerDb.getProfile(receiverId);

    // If player already in room, just return
    let existingPlayer = room.players.find((p) => p.id === receiverId);
    if (!existingPlayer) {
      const takenColors = new Set(room.players.map((p) => p.color));
      const ALL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
      const availableColor = ALL_COLORS.find((c) => !takenColors.has(c)) || 'BLUE';

      const newPlayer = createRoomPlayer({
        id: receiverId,
        name: receiverProfile?.displayName || 'Player',
        avatar: receiverProfile?.avatar || '👑',
        color: availableColor,
        isHost: false,
        isReady: false,
        level: receiverProfile?.level || 1,
        xp: receiverProfile?.xp || 0,
      });

      room.players.push(newPlayer);
      room.state = calculateRoomState(room);
    }

    // Update receiver's WebSocket meta if connected
    const receiverSockets = this.getPlayerSockets(receiverId);
    for (const ws of receiverSockets) {
      clientMeta.set(ws, { roomCode: room.code, playerId: receiverId });
    }

    broadcastRoom(room, wss);

    // Notify receiver with direct room state
    this.sendToPlayer(receiverId, {
      type: 'INVITATION_ACCEPTED_JOIN',
      roomCode: room.code,
      room,
    });

    // Notify sender
    this.sendToPlayer(invite.senderId, {
      type: 'GAME_INVITE_RESPONSE',
      invitationId,
      status: 'ACCEPTED',
      message: `${receiverProfile?.displayName || 'Player'} accepted your game invitation!`,
    });

    return {
      success: true,
      message: 'Joined room successfully!',
      room,
      roomCode: room.code,
    };
  }

  public getActiveInvitations(receiverId: string): GameInvitation[] {
    const now = Date.now();
    const list: GameInvitation[] = [];
    for (const inv of this.invitations.values()) {
      if (inv.receiverId === receiverId && inv.status === 'PENDING') {
        if (now <= inv.expiresAt) {
          list.push(inv);
        } else {
          inv.status = 'EXPIRED';
        }
      }
    }
    return list;
  }

  private cleanupExpiredInvitations(): void {
    const now = Date.now();
    for (const [id, inv] of this.invitations.entries()) {
      if (now > inv.expiresAt + 300000) {
        // Remove invitations older than 5 minutes
        this.invitations.delete(id);
      } else if (now > inv.expiresAt && inv.status === 'PENDING') {
        inv.status = 'EXPIRED';
      }
    }
  }
}

export const friendsDb = new FriendsDatabase();
