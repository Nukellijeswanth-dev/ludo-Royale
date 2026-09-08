import { Room, RoomPlayer, RoomSettings, ClientMessage, ServerMessage, MatchedPlayerInfo } from '../types/roomTypes';
import { PlayerColor, GameEventNotification } from '../types/gameTypes';
import { authService } from './authService';
import { presenceService } from './presenceService';
import { playerProfileService } from './playerProfileService';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface MatchmakingState {
  status: 'IDLE' | 'SEARCHING' | 'MATCHED';
  playersCount: number;
  targetCount: number;
  elapsedSeconds: number;
  estimatedWaitSeconds: number;
  countdown?: number;
  matchedPlayers?: MatchedPlayerInfo[];
}

export interface ReactionPayload {
  playerId: string;
  playerName: string;
  color: PlayerColor;
  emoji: string;
  id: string;
  timestamp: number;
}

export interface ChatPayload {
  messageId: string;
  id: string;
  playerId?: string;
  playerName?: string;
  color?: PlayerColor;
  playerColor?: PlayerColor;
  message: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

type RoomListener = (room: Room | null) => void;
type StatusListener = (status: ConnectionStatus) => void;
type ErrorListener = (error: string | null) => void;
type GameEventListener = (event: GameEventNotification) => void;
type ReactionListener = (reaction: ReactionPayload) => void;
type ChatListener = (chat: ChatPayload) => void;
type ChatHistoryListener = (history: ChatPayload[]) => void;

const ACTIVE_ROOM_KEY = 'ludo_royale_active_room_code';

class RoomService {
  private ws: WebSocket | null = null;
  private currentRoom: Room | null = null;
  private connectionStatus: ConnectionStatus = 'DISCONNECTED';
  private currentError: string | null = null;
  private myPlayerId: string = authService.getPlayerId();
  private chatHistory: ChatPayload[] = [];

  private roomListeners: Set<RoomListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private gameEventListeners: Set<GameEventListener> = new Set();
  private reactionListeners: Set<ReactionListener> = new Set();
  private chatListeners: Set<ChatListener> = new Set();
  private chatHistoryListeners: Set<ChatHistoryListener> = new Set();
  private matchmakingListeners: Set<(state: MatchmakingState) => void> = new Set();
  private friendRequestListeners: Set<(request: any) => void> = new Set();
  private friendUpdateListeners: Set<(update: any) => void> = new Set();
  private friendPresenceListeners: Set<(playerId: string, isOnline: boolean) => void> = new Set();
  private gameInviteListeners: Set<(invitation: any) => void> = new Set();
  private gameInviteResponseListeners: Set<(resp: any) => void> = new Set();
  private inviteAcceptedListeners: Set<(roomCode: string, room: Room) => void> = new Set();

  private matchmakingState: MatchmakingState = {
    status: 'IDLE',
    playersCount: 0,
    targetCount: 4,
    elapsedSeconds: 0,
    estimatedWaitSeconds: 10,
  };
  private matchmakingElapsedTimer: NodeJS.Timeout | null = null;

  private pingInterval: NodeJS.Timeout | null = null;
  private pingStartTime = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 6;
  private isExplicitLeave = false;

  private httpPollInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Automatically try to resume active room from sessionStorage or URL if available
    let roomToResume: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom && urlRoom.length === 6) {
        roomToResume = urlRoom.toUpperCase();
      } else {
        roomToResume = this.getSavedRoomCode();
      }
    } catch {
      roomToResume = this.getSavedRoomCode();
    }

    if (roomToResume) {
      setTimeout(() => {
        this.attemptAutoReconnect(roomToResume!);
      }, 300);
    }
  }

  public getInviteUrl(code?: string): string {
    const roomCode = code || this.currentRoom?.code;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return roomCode ? `${origin}${pathname}?room=${roomCode}` : `${origin}${pathname}`;
  }

  public async shareRoom(): Promise<{ success: boolean; method: 'share' | 'copy' }> {
    if (!this.currentRoom) return { success: false, method: 'copy' };
    const roomCode = this.currentRoom.code;
    const inviteUrl = this.getInviteUrl(roomCode);
    const shareData = {
      title: 'Ludo Royale',
      text: `Join my Ludo Royale game! Room: ${roomCode}`,
      url: inviteUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return { success: true, method: 'share' };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, method: 'share' };
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(roomCode);
        return { success: true, method: 'copy' };
      } catch {
        // clipboard unavailable
      }
    }
    return { success: false, method: 'copy' };
  }

  public async copyInviteLink(code?: string): Promise<boolean> {
    const inviteUrl = this.getInviteUrl(code);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        return true;
      } catch {
        // fallback
      }
    }
    return false;
  }

  public getRoom(): Room | null {
    return this.currentRoom;
  }

  public getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getError(): string | null {
    return this.currentError;
  }

  public getMyPlayerId(): string {
    return this.myPlayerId;
  }

  public getPlayerInfo(): { id: string; name: string; avatar: string; level: number; xp: number; coins: number; rating: number } {
    const auth = authService.getAuthPlayer();
    const profile = playerProfileService.getProfile();
    return {
      id: auth.playerId,
      name: auth.username,
      avatar: auth.avatar,
      level: profile.level || auth.level,
      xp: profile.xp || auth.xp,
      coins: profile.coins || 0,
      rating: profile.rating || 1000,
    };
  }

  public getMatchmakingState(): MatchmakingState {
    return { ...this.matchmakingState };
  }

  public subscribeMatchmaking(listener: (state: MatchmakingState) => void): () => void {
    this.matchmakingListeners.add(listener);
    listener(this.getMatchmakingState());
    return () => this.matchmakingListeners.delete(listener);
  }

  private notifyMatchmaking(): void {
    const copy = this.getMatchmakingState();
    this.matchmakingListeners.forEach((l) => l(copy));
  }

  public async enterMatchmaking(): Promise<void> {
    this.isExplicitLeave = false;
    this.setError(null);
    const playerInfo = this.getPlayerInfo();

    // Start local timer for smooth 1s updates
    if (this.matchmakingElapsedTimer) clearInterval(this.matchmakingElapsedTimer);
    let currentElapsed = 0;
    this.matchmakingElapsedTimer = setInterval(() => {
      if (this.matchmakingState.status === 'SEARCHING') {
        currentElapsed += 1;
        this.matchmakingState.elapsedSeconds = currentElapsed;
        this.matchmakingState.estimatedWaitSeconds = Math.max(1, 10 - currentElapsed);
        this.notifyMatchmaking();
      } else {
        if (this.matchmakingElapsedTimer) {
          clearInterval(this.matchmakingElapsedTimer);
          this.matchmakingElapsedTimer = null;
        }
      }
    }, 1000);

    this.matchmakingState = {
      status: 'SEARCHING',
      playersCount: 1,
      targetCount: 4,
      elapsedSeconds: 0,
      estimatedWaitSeconds: 10,
      matchedPlayers: [
        {
          playerId: playerInfo.id,
          displayName: playerInfo.name,
          name: playerInfo.name,
          avatar: playerInfo.avatar,
          level: playerInfo.level,
          rating: playerInfo.rating,
        },
      ],
    };
    this.notifyMatchmaking();

    try {
      await this.connect();
      this.send({
        type: 'ENTER_MATCHMAKING',
        playerId: playerInfo.id,
        playerName: playerInfo.name,
        playerAvatar: playerInfo.avatar,
        level: playerInfo.level,
        rating: playerInfo.rating,
        xp: playerInfo.xp,
        coins: playerInfo.coins,
      });
    } catch (err: any) {
      console.error('[RoomService] Enter matchmaking error:', err);
      this.matchmakingState.status = 'IDLE';
      if (this.matchmakingElapsedTimer) {
        clearInterval(this.matchmakingElapsedTimer);
        this.matchmakingElapsedTimer = null;
      }
      this.notifyMatchmaking();
      this.setError('Failed to connect to matchmaking server.');
    }
  }

  public cancelMatchmaking(): void {
    if (this.matchmakingElapsedTimer) {
      clearInterval(this.matchmakingElapsedTimer);
      this.matchmakingElapsedTimer = null;
    }
    const playerInfo = this.getPlayerInfo();
    this.send({
      type: 'CANCEL_MATCHMAKING',
      playerId: playerInfo.id,
    });
    // REST fallback for high reliability
    fetch('/api/matchmaking/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: playerInfo.id }),
    }).catch(() => {});

    this.matchmakingState = {
      status: 'IDLE',
      playersCount: 0,
      targetCount: 4,
      elapsedSeconds: 0,
      estimatedWaitSeconds: 10,
    };
    this.notifyMatchmaking();
  }

  public setCustomPlayerName(name: string): void {
    authService.setCustomUsername(name);
  }

  public getSavedRoomCode(): string | null {
    try {
      return sessionStorage.getItem(ACTIVE_ROOM_KEY);
    } catch {
      return null;
    }
  }

  private saveRoomCode(code: string | null): void {
    try {
      if (code) {
        sessionStorage.setItem(ACTIVE_ROOM_KEY, code);
      } else {
        sessionStorage.removeItem(ACTIVE_ROOM_KEY);
      }
    } catch {
      // ignore
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    const presenceStatusMap: Record<ConnectionStatus, 'ONLINE' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE'> = {
      CONNECTED: 'ONLINE',
      CONNECTING: 'CONNECTING',
      RECONNECTING: 'RECONNECTING',
      DISCONNECTED: 'OFFLINE',
    };
    presenceService.updateStatus(presenceStatusMap[status]);
    this.statusListeners.forEach((fn) => fn(status));
  }

  private mapFriendlyError(rawMsg: string): string {
    const lower = rawMsg.toLowerCase();
    if (lower.includes('not found') || lower.includes('does not exist')) {
      return 'ROOM NOT FOUND — Check the 6-character code and try again.';
    }
    if (lower.includes('full')) {
      return 'ROOM FULL — This room has reached the maximum of 4 players.';
    }
    if (lower.includes('already started')) {
      return 'ROOM ALREADY STARTED — This game is already in progress.';
    }
    if (lower.includes('closed')) {
      return 'ROOM CLOSED — This room has been closed or expired.';
    }
    if (lower.includes('all players must be ready')) {
      return 'PLAYERS NOT READY — All players must be marked Ready before starting.';
    }
    if (lower.includes('at least 2 players')) {
      return 'MINIMUM PLAYERS REQUIRED — At least 2 players are required to start the match.';
    }
    if (lower.includes('only the room host')) {
      return 'HOST PERMISSION REQUIRED — Only the room host can start the game.';
    }
    if (lower.includes('invalid') || lower.includes('6-character')) {
      return 'INVALID CODE — Room code must be 6 letters and numbers.';
    }
    return rawMsg;
  }

  private setError(err: string | null): void {
    this.currentError = err ? this.mapFriendlyError(err) : null;
    this.errorListeners.forEach((fn) => fn(this.currentError));
  }

  private setRoom(room: Room | null): void {
    this.currentRoom = room;
    if (room) {
      this.saveRoomCode(room.code);
      if (room.chatHistory && room.chatHistory.length > 0) {
        const existingIds = new Set(this.chatHistory.map((m) => m.messageId || m.id));
        let updated = false;
        for (const item of room.chatHistory) {
          const id = item.messageId || item.id;
          if (!existingIds.has(id)) {
            this.chatHistory.push({
              messageId: id,
              id,
              playerId: item.playerId,
              playerName: item.playerName,
              color: item.playerColor || item.color,
              playerColor: item.playerColor || item.color,
              message: item.message || item.text,
              text: item.text || item.message,
              timestamp: item.timestamp,
              isSystem: item.isSystem,
            });
            existingIds.add(id);
            updated = true;
          }
        }
        if (this.chatHistory.length > 50) {
          this.chatHistory = this.chatHistory.slice(-50);
        }
        if (updated) {
          this.chatHistoryListeners.forEach((fn) => fn(this.getChatHistory()));
        }
      }
    }
    this.roomListeners.forEach((fn) => fn(room));
  }

  public subscribe(listener: RoomListener): () => void {
    this.roomListeners.add(listener);
    listener(this.currentRoom);
    return () => {
      this.roomListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.connectionStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    listener(this.currentError);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authService.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${protocol}//${window.location.host}/ws${tokenParam}`;
  }

  private connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(check);
            resolve();
          } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            clearInterval(check);
            reject(new Error('Connection failed'));
          }
        }, 50);
      });
    }

    this.setStatus('CONNECTING');
    this.setError(null);

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.getWebSocketUrl());

        ws.onopen = () => {
          this.ws = ws;
          this.stopHttpPolling();
          this.reconnectAttempts = 0;
          this.setStatus('CONNECTED');
          this.setError(null);
          this.startHeartbeat();
          this.ensureIdentified();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          this.stopHeartbeat();
          this.ws = null;

          if (this.isExplicitLeave) {
            this.stopHttpPolling();
            this.setStatus('DISCONNECTED');
            return;
          }

          // Handle unexpected drop
          const activeCode = this.currentRoom?.code || this.getSavedRoomCode();
          if (activeCode) {
            // Activate immediate HTTP polling as fallback so state sync never halts
            this.startHttpPolling(activeCode);

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.setStatus('RECONNECTING');
              const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 6000);
              this.reconnectAttempts++;
              if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
              this.reconnectTimeout = setTimeout(() => {
                this.attemptAutoReconnect(activeCode);
              }, delay);
            }
          } else {
            this.setStatus('DISCONNECTED');
          }
        };

        ws.onerror = (err) => {
          console.warn('RoomService WebSocket error:', err);
          const activeCode = this.currentRoom?.code || this.getSavedRoomCode();
          if (activeCode) {
            this.startHttpPolling(activeCode);
          }
          reject(err);
        };
      } catch (err) {
        this.setStatus('DISCONNECTED');
        reject(err);
      }
    });
  }

  private startHttpPolling(roomCode: string): void {
    if (this.httpPollInterval) return;
    const poll = async () => {
      try {
        const playerInfo = this.getPlayerInfo();
        const res = await fetch(`/api/rooms/${roomCode}/state?playerId=${encodeURIComponent(playerInfo.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            this.setRoom(data.room);
            this.setStatus('CONNECTED');
          }
        } else if (res.status === 404) {
          this.stopHttpPolling();
          this.setRoom(null);
          this.saveRoomCode(null);
        }
      } catch {
        // Network blip
      }
    };
    poll();
    this.httpPollInterval = setInterval(poll, 1200);
  }

  private stopHttpPolling(): void {
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.pingStartTime = Date.now();
      this.send({ type: 'PING' });
    }, 12000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(msg: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const token = authService.getToken();
      if (token && typeof msg === 'object' && !msg.token) {
        msg.token = token;
      }
      this.ws.send(JSON.stringify(msg));
    }
  }

  private formatErrorMessage(errStr: string): string {
    const lower = errStr.toLowerCase();
    if (lower.includes('not found')) {
      return 'Room not found. Please verify the 6-character room code.';
    }
    if (lower.includes('full')) {
      return 'Room is full. Maximum 4 players allowed.';
    }
    if (lower.includes('already started') || lower.includes('playing')) {
      return 'Game already started. You cannot join an active match.';
    }
    if (lower.includes('already joined') || lower.includes('already in this room')) {
      return 'Already joined: You are already in this room.';
    }
    if (lower.includes('invalid room code') || lower.includes('6-character')) {
      return 'Invalid room code. Please enter a valid 6-character code.';
    }
    if (lower.includes('network') || lower.includes('failed to fetch')) {
      return 'Network error: Unable to connect to server. Please try again.';
    }
    return errStr;
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'AUTHENTICATED' as any: {
        const anyMsg = msg as any;
        if (anyMsg.profile) {
          playerProfileService.setAuthenticatedProfile(anyMsg.profile);
        }
        break;
      }

      case 'ROOM_STATE':
      case 'GAME_STARTING':
      case 'GAME_STARTED': {
        this.setError(null);
        this.setRoom(msg.room);
        break;
      }

      case 'ROOM_CLOSED': {
        this.stopHttpPolling();
        this.setRoom(null);
        this.setError(msg.message || 'The room was closed by the host.');
        this.setStatus('CONNECTED');
        break;
      }

      case 'ROOM_LEFT': {
        this.stopHttpPolling();
        this.setRoom(null);
        if (msg.message && msg.message !== 'You left the room.') {
          this.setError(msg.message);
        }
        this.setStatus('CONNECTED');
        break;
      }

      case 'ERROR': {
        this.setError(this.formatErrorMessage(msg.message));
        break;
      }

      case 'ACTION_REJECTED': {
        this.setError(this.formatErrorMessage(msg.reason || `Action ${msg.action} rejected.`));
        break;
      }

      case 'PONG': {
        if (this.pingStartTime > 0) {
          presenceService.recordPing(Date.now() - this.pingStartTime);
        }
        break;
      }

      case 'GAME_EVENT': {
        this.gameEventListeners.forEach((l) => l(msg.event));
        break;
      }

      case 'REACTION': {
        const payload: ReactionPayload = {
          playerId: msg.playerId,
          playerName: msg.playerName,
          color: msg.color,
          emoji: msg.emoji,
          id: msg.id,
          timestamp: msg.timestamp,
        };
        this.reactionListeners.forEach((l) => l(payload));
        break;
      }

      case 'CHAT_MESSAGE': {
        const payload: ChatPayload = {
          messageId: msg.messageId || msg.id,
          id: msg.id || msg.messageId,
          playerId: msg.playerId,
          playerName: msg.playerName,
          color: msg.playerColor || msg.color,
          playerColor: msg.playerColor || msg.color,
          message: msg.message || msg.text,
          text: msg.text || msg.message,
          timestamp: msg.timestamp,
          isSystem: msg.isSystem,
        };
        if (!this.chatHistory.some((m) => (m.messageId || m.id) === (payload.messageId || payload.id))) {
          this.chatHistory.push(payload);
          if (this.chatHistory.length > 50) {
            this.chatHistory.shift();
          }
        }
        this.chatListeners.forEach((l) => l(payload));
        this.chatHistoryListeners.forEach((l) => l(this.getChatHistory()));
        break;
      }

      case 'CHAT_HISTORY': {
        this.chatHistory = (msg.messages || []).map((m) => ({
          messageId: m.messageId || m.id,
          id: m.id || m.messageId,
          playerId: m.playerId,
          playerName: m.playerName,
          color: m.playerColor || m.color,
          playerColor: m.playerColor || m.color,
          message: m.message || m.text,
          text: m.text || m.message,
          timestamp: m.timestamp,
          isSystem: m.isSystem,
        }));
        this.chatHistoryListeners.forEach((l) => l(this.getChatHistory()));
        break;
      }

      case 'MATCH_REWARDS': {
        playerProfileService.applyServerRewards({
          matchId: msg.matchId,
          rewards: msg.rewards,
          profile: msg.profile,
        });
        break;
      }

      case 'MATCHMAKING_QUEUE_UPDATE': {
        this.matchmakingState = {
          status: msg.status,
          playersCount: msg.playersCount,
          targetCount: msg.targetCount,
          elapsedSeconds: msg.elapsedSeconds ?? this.matchmakingState.elapsedSeconds,
          estimatedWaitSeconds: msg.estimatedWaitSeconds ?? this.matchmakingState.estimatedWaitSeconds,
          matchedPlayers: msg.matchedPlayers,
        };
        this.notifyMatchmaking();
        break;
      }

      case 'MATCHMAKING_MATCHED': {
        if (this.matchmakingElapsedTimer) {
          clearInterval(this.matchmakingElapsedTimer);
          this.matchmakingElapsedTimer = null;
        }
        this.matchmakingState = {
          status: 'MATCHED',
          playersCount: msg.matchedPlayers.length,
          targetCount: msg.matchedPlayers.length,
          elapsedSeconds: this.matchmakingState.elapsedSeconds,
          estimatedWaitSeconds: 0,
          countdown: msg.countdown || 3,
          matchedPlayers: msg.matchedPlayers,
        };
        this.notifyMatchmaking();
        this.setRoom(msg.room);
        break;
      }

      case 'MATCHMAKING_CANCELLED': {
        if (this.matchmakingElapsedTimer) {
          clearInterval(this.matchmakingElapsedTimer);
          this.matchmakingElapsedTimer = null;
        }
        this.matchmakingState = {
          status: 'IDLE',
          playersCount: 0,
          targetCount: 4,
          elapsedSeconds: 0,
          estimatedWaitSeconds: 10,
        };
        this.notifyMatchmaking();
        break;
      }

      case 'FRIEND_REQUEST_RECEIVED': {
        this.friendRequestListeners.forEach((l) => l(msg.request));
        break;
      }

      case 'FRIEND_REQUEST_UPDATED': {
        this.friendUpdateListeners.forEach((l) => l(msg));
        break;
      }

      case 'FRIEND_PRESENCE_UPDATE': {
        this.friendPresenceListeners.forEach((l) => l(msg.playerId, msg.isOnline));
        break;
      }

      case 'GAME_INVITE_RECEIVED': {
        this.gameInviteListeners.forEach((l) => l(msg.invitation));
        break;
      }

      case 'GAME_INVITE_RESPONSE': {
        this.gameInviteResponseListeners.forEach((l) => l(msg));
        break;
      }

      case 'INVITATION_ACCEPTED_JOIN': {
        this.setError(null);
        this.saveRoomCode(msg.roomCode);
        this.setRoom(msg.room);
        this.setStatus('CONNECTED');
        this.inviteAcceptedListeners.forEach((l) => l(msg.roomCode, msg.room));
        break;
      }
    }
  }

  private async attemptAutoReconnect(roomCode: string): Promise<void> {
    const playerInfo = this.getPlayerInfo();
    try {
      await this.connect();
      this.send({
        type: 'RECONNECT',
        roomCode,
        playerId: playerInfo.id,
        playerName: playerInfo.name,
        playerAvatar: playerInfo.avatar,
        level: playerInfo.level,
        xp: playerInfo.xp,
      });
    } catch {
      // If WebSocket fails, start HTTP polling as fallback
      this.startHttpPolling(roomCode);
    }
  }

  public async createRoom(): Promise<void> {
    this.isExplicitLeave = false;
    this.setError(null);
    const playerInfo = this.getPlayerInfo();

    try {
      const wsPromise = this.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WS timeout')), 2000)
      );
      await Promise.race([wsPromise, timeoutPromise]);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'CREATE_ROOM',
          playerId: playerInfo.id,
          playerName: playerInfo.name,
          playerAvatar: playerInfo.avatar,
          level: playerInfo.level,
          xp: playerInfo.xp,
        });
        return;
      }
    } catch {
      // WS unavailable, use REST API
    }

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerInfo.id,
          playerName: playerInfo.name,
          playerAvatar: playerInfo.avatar,
          level: playerInfo.level,
          xp: playerInfo.xp,
        }),
      });
      const data = await res.json();
      if (data.error) {
        this.setError(data.error);
      } else if (data.room) {
        this.setRoom(data.room);
        this.setStatus('CONNECTED');
        this.startHttpPolling(data.room.code);
      }
    } catch (err: any) {
      this.setError(err.message || 'Failed to create room.');
    }
  }

  public async joinRoom(roomCode: string): Promise<void> {
    const code = roomCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      this.setError('Room code must be 6 characters.');
      return;
    }

    this.isExplicitLeave = false;
    this.setError(null);
    const playerInfo = this.getPlayerInfo();

    try {
      const wsPromise = this.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WS timeout')), 2000)
      );
      await Promise.race([wsPromise, timeoutPromise]);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'JOIN_ROOM',
          roomCode: code,
          playerId: playerInfo.id,
          playerName: playerInfo.name,
          playerAvatar: playerInfo.avatar,
          level: playerInfo.level,
          xp: playerInfo.xp,
        });
        return;
      }
    } catch {
      // WS unavailable, use REST API
    }

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          playerId: playerInfo.id,
          playerName: playerInfo.name,
          playerAvatar: playerInfo.avatar,
          level: playerInfo.level,
          xp: playerInfo.xp,
        }),
      });
      const data = await res.json();
      if (data.error) {
        this.setError(data.error);
      } else if (data.room) {
        this.setRoom(data.room);
        this.setStatus('CONNECTED');
        this.startHttpPolling(data.room.code);
      }
    } catch (err: any) {
      this.setError(err.message || 'Failed to join room.');
    }
  }

  public toggleReady(isReady: boolean): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'TOGGLE_READY',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
        isReady,
      });
    } else {
      fetch('/api/rooms/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoom.code,
          playerId: playerInfo.id,
          isReady,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) this.setRoom(data.room);
        })
        .catch(() => {});
    }
  }

  public startGame(): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'START_GAME',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
      });
    } else {
      fetch('/api/rooms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoom.code,
          playerId: playerInfo.id,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) this.setRoom(data.room);
          if (data.error) this.setError(this.formatErrorMessage(data.error));
        })
        .catch(() => {});
    }
  }

  public updateRoomSettings(settings: Partial<RoomSettings>): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'UPDATE_ROOM_SETTINGS',
        roomCode: this.currentRoom.code,
        hostPlayerId: playerInfo.id,
        settings,
      });
    } else {
      fetch(`/api/rooms/${this.currentRoom.code}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostPlayerId: playerInfo.id,
          settings,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) this.setRoom(data.room);
          if (data.error) this.setError(this.formatErrorMessage(data.error));
        })
        .catch(() => {});
    }
  }

  public kickPlayer(targetPlayerId: string): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'KICK_PLAYER',
        roomCode: this.currentRoom.code,
        hostPlayerId: playerInfo.id,
        targetPlayerId,
      });
    } else {
      fetch('/api/rooms/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoom.code,
          hostPlayerId: playerInfo.id,
          targetPlayerId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) this.setRoom(data.room);
          if (data.error) this.setError(this.formatErrorMessage(data.error));
        })
        .catch(() => {});
    }
  }

  public closeRoom(): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'CLOSE_ROOM',
        roomCode: this.currentRoom.code,
        hostPlayerId: playerInfo.id,
      });
    } else {
      fetch('/api/rooms/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoom.code,
          hostPlayerId: playerInfo.id,
        }),
      }).catch(() => {});
    }
    this.stopHttpPolling();
    this.setRoom(null);
    this.saveRoomCode(null);
    this.setStatus('CONNECTED');
    this.setError(null);
  }

  public leaveRoom(): void {
    this.isExplicitLeave = true;
    this.stopHttpPolling();
    if (this.currentRoom) {
      const playerInfo = this.getPlayerInfo();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'LEAVE_ROOM',
          roomCode: this.currentRoom.code,
          playerId: playerInfo.id,
        });
      } else {
        fetch('/api/rooms/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: this.currentRoom.code,
            playerId: playerInfo.id,
          }),
        }).catch(() => {});
      }
    }
    this.setRoom(null);
    this.saveRoomCode(null);
    this.setStatus('CONNECTED');
    this.setError(null);
  }

  public rollDice(): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    const actionNonce = this.currentRoom.gameState?.actionNonce || this.currentRoom.actionNonce;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'ROLL_DICE',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
        actionNonce,
      });
    } else {
      fetch(`/api/rooms/${this.currentRoom.code}/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerInfo.id, actionNonce }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) this.setRoom(data.room);
          if (data.error) this.setError(this.formatErrorMessage(data.error));
        })
        .catch(() => {});
    }
  }

  public moveToken(tokenId: number): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    const actionNonce = this.currentRoom.gameState?.actionNonce || this.currentRoom.actionNonce;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'MOVE_TOKEN',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
        tokenId,
        actionNonce,
      });
    } else {
      fetch(`/api/rooms/${this.currentRoom.code}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerInfo.id, tokenId, actionNonce }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) this.setRoom(data.room);
          if (data.error) this.setError(this.formatErrorMessage(data.error));
        })
        .catch(() => {});
    }
  }

  public sendReaction(emoji: string): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'SEND_REACTION',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
        emoji,
      });
    } else {
      fetch(`/api/rooms/${this.currentRoom.code}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerInfo.id, emoji }),
      }).catch(() => {});
    }
  }

  public sendChatMessage(message: string): void {
    const clean = (message || '').trim();
    if (!clean || !this.currentRoom) return;
    if (clean.length > 200) {
      this.setError('Message exceeds 200 character limit.');
      return;
    }
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'SEND_CHAT_MESSAGE',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
        message: clean,
      });
    } else {
      fetch(`/api/rooms/${this.currentRoom.code}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerInfo.id, message: clean }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.error) this.setError(data.error);
          }
        })
        .catch(() => {});
    }
  }

  public sendQuickChat(text: string): void {
    this.sendChatMessage(text);
  }

  public getChatHistory(): ChatPayload[] {
    return [...this.chatHistory];
  }

  public subscribeChatHistory(listener: ChatHistoryListener): () => void {
    this.chatHistoryListeners.add(listener);
    listener(this.getChatHistory());
    return () => {
      this.chatHistoryListeners.delete(listener);
    };
  }

  public requestChatHistory(): void {
    if (!this.currentRoom) return;
    const playerInfo = this.getPlayerInfo();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'GET_CHAT_HISTORY',
        roomCode: this.currentRoom.code,
        playerId: playerInfo.id,
      });
    } else {
      fetch(`/api/rooms/${this.currentRoom.code}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            this.chatHistory = data.messages.map((m: any) => ({
              messageId: m.messageId || m.id,
              id: m.id || m.messageId,
              playerId: m.playerId,
              playerName: m.playerName,
              color: m.playerColor || m.color,
              playerColor: m.playerColor || m.color,
              message: m.message || m.text,
              text: m.text || m.message,
              timestamp: m.timestamp,
              isSystem: m.isSystem,
            }));
            this.chatHistoryListeners.forEach((l) => l(this.getChatHistory()));
          }
        })
        .catch(() => {});
    }
  }

  public subscribeGameEvent(listener: GameEventListener): () => void {
    this.gameEventListeners.add(listener);
    return () => {
      this.gameEventListeners.delete(listener);
    };
  }

  public subscribeReaction(listener: ReactionListener): () => void {
    this.reactionListeners.add(listener);
    return () => {
      this.reactionListeners.delete(listener);
    };
  }

  public subscribeChat(listener: ChatListener): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  public onFriendRequest(fn: (request: any) => void): () => void {
    this.friendRequestListeners.add(fn);
    return () => {
      this.friendRequestListeners.delete(fn);
    };
  }

  public onFriendUpdate(fn: (update: any) => void): () => void {
    this.friendUpdateListeners.add(fn);
    return () => {
      this.friendUpdateListeners.delete(fn);
    };
  }

  public onFriendPresence(fn: (playerId: string, isOnline: boolean) => void): () => void {
    this.friendPresenceListeners.add(fn);
    return () => {
      this.friendPresenceListeners.delete(fn);
    };
  }

  public onGameInvite(fn: (invitation: any) => void): () => void {
    this.gameInviteListeners.add(fn);
    return () => {
      this.gameInviteListeners.delete(fn);
    };
  }

  public onGameInviteResponse(fn: (resp: any) => void): () => void {
    this.gameInviteResponseListeners.add(fn);
    return () => {
      this.gameInviteResponseListeners.delete(fn);
    };
  }

  public onInviteAcceptedJoin(fn: (roomCode: string, room: Room) => void): () => void {
    this.inviteAcceptedListeners.add(fn);
    return () => {
      this.inviteAcceptedListeners.delete(fn);
    };
  }

  public sendClientMessage(msg: ClientMessage): void {
    this.send(msg);
  }

  public ensureIdentified(): void {
    const token = authService.getToken();
    if (token) {
      this.send({
        type: 'AUTHENTICATE',
        token,
      });
    }
    const p = this.getPlayerInfo();
    this.send({
      type: 'IDENTIFY',
      playerId: p.id,
      displayName: p.name,
      avatar: p.avatar,
    });
  }

  public joinRoomByInvite(roomCode: string, room: Room): void {
    this.setError(null);
    this.saveRoomCode(roomCode);
    this.setRoom(room);
    this.setStatus('CONNECTED');
  }
}

export const roomService = new RoomService();
