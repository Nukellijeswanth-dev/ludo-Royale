import { WebSocket } from 'ws';
import { Room, RoomPlayer, MatchedPlayerInfo } from '../types/roomTypes';
import { PlayerColor } from '../types/gameTypes';
import { playerDb } from './playerDatabase';

const ALL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export interface MatchmakingQueueEntry {
  playerId: string;
  displayName: string;
  avatar: string;
  level: number;
  rating: number;
  xp: number;
  coins: number;
  joinedAt: number;
  status: 'SEARCHING' | 'MATCHED';
  ws: WebSocket;
  matchedRoomCode?: string;
}

export interface MatchmakingContext {
  rooms: Map<string, Room>;
  clientMeta: Map<WebSocket, { roomCode?: string; playerId?: string }>;
  createRoomPlayer: (params: {
    id: string;
    name: string;
    avatar: string;
    color: PlayerColor;
    isHost: boolean;
    isReady?: boolean;
    level?: number;
    xp?: number;
    coins?: number;
  }) => RoomPlayer;
  createRoomObject: (code: string, hostPlayer: RoomPlayer) => Room;
  generateRoomCode: () => string;
  broadcastRoom: (room: Room) => void;
  startRoomCountdown: (room: Room) => void;
  addSocketToRoom?: (code: string, ws: WebSocket) => void;
}

export class MatchmakingService {
  private queue: Map<string, MatchmakingQueueEntry> = new Map();
  private isMatchingInProgress = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private context: MatchmakingContext | null = null;

  constructor() {
    this.startLoop();
  }

  public setContext(context: MatchmakingContext) {
    this.context = context;
  }

  private startLoop() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Enters or updates a player in the matchmaking queue.
   * Prevents duplicate entries using playerId as unique key.
   */
  public enterQueue(params: {
    playerId: string;
    displayName: string;
    avatar: string;
    level?: number;
    rating?: number;
    xp?: number;
    coins?: number;
    ws: WebSocket;
  }): void {
    const { playerId, ws } = params;
    if (!playerId || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Fetch authoritative profile
    const profile = playerDb.getOrCreateProfile({
      playerId,
      displayName: params.displayName,
      avatar: params.avatar,
    });

    const now = Date.now();
    const existing = this.queue.get(playerId);

    if (existing) {
      // Player already in queue: update socket connection and attributes without resetting queue position
      existing.ws = ws;
      existing.displayName = profile.displayName;
      existing.avatar = profile.avatar;
      existing.level = profile.level;
      existing.rating = profile.rating || 1000;
      existing.xp = profile.xp;
      existing.coins = profile.coins;
      existing.status = 'SEARCHING';
    } else {
      // New queue entry
      const entry: MatchmakingQueueEntry = {
        playerId,
        displayName: profile.displayName,
        avatar: profile.avatar,
        level: profile.level,
        rating: profile.rating || 1000,
        xp: profile.xp,
        coins: profile.coins,
        joinedAt: now,
        status: 'SEARCHING',
        ws,
      };
      this.queue.set(playerId, entry);
    }

    // Trigger immediate evaluation & broadcast update to searchers
    this.tick();
  }

  /**
   * Cancels matchmaking for a player.
   */
  public cancelQueue(playerId: string): void {
    const entry = this.queue.get(playerId);
    if (entry) {
      if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
        try {
          entry.ws.send(JSON.stringify({ type: 'MATCHMAKING_CANCELLED', message: 'Matchmaking cancelled' }));
        } catch {
          // Socket write error ignored
        }
      }
      this.queue.delete(playerId);
      this.broadcastQueueUpdate();
    }
  }

  /**
   * Cleanly handles socket disconnection during matchmaking.
   */
  public handleDisconnect(ws: WebSocket): void {
    for (const [playerId, entry] of this.queue.entries()) {
      if (entry.ws === ws) {
        this.queue.delete(playerId);
      }
    }
  }

  /**
   * Main periodic evaluation loop.
   */
  private tick(): void {
    if (!this.context || this.isMatchingInProgress) return;

    // Step 1: Purge stale or disconnected sockets
    for (const [playerId, entry] of this.queue.entries()) {
      if (entry.ws.readyState !== WebSocket.OPEN) {
        this.queue.delete(playerId);
      }
    }

    if (this.queue.size === 0) return;

    // Step 2: Check matching conditions
    this.evaluateMatches();

    // Step 3: Broadcast status to remaining searching players
    this.broadcastQueueUpdate();
  }

  /**
   * Atomic match formation.
   */
  private evaluateMatches(): void {
    if (!this.context || this.isMatchingInProgress) return;

    const searchingEntries = Array.from(this.queue.values()).filter(
      (e) => e.status === 'SEARCHING' && e.ws.readyState === WebSocket.OPEN
    );

    if (searchingEntries.length < 2) return;

    const now = Date.now();
    const oldestEntry = searchingEntries[0];
    const waitTimeMs = now - oldestEntry.joinedAt;

    let matchedGroup: MatchmakingQueueEntry[] | null = null;

    // Condition 1: 4 players available -> Instant 4-player match
    if (searchingEntries.length >= 4) {
      matchedGroup = searchingEntries.slice(0, 4);
    }
    // Condition 2: After 10s wait timeout, allow 2 or 3 player match
    else if (waitTimeMs >= 10000 && searchingEntries.length >= 2) {
      // Match up to 4 available players (2 or 3)
      matchedGroup = searchingEntries.slice(0, Math.min(4, searchingEntries.length));
    }

    if (!matchedGroup || matchedGroup.length < 2) return;

    // Verify all candidate sockets are still open
    const stillConnected = matchedGroup.filter(
      (p) => p.ws && p.ws.readyState === WebSocket.OPEN
    );
    if (stillConnected.length < 2) {
      // Re-queue connected players
      for (const p of stillConnected) {
        p.status = 'SEARCHING';
        this.queue.set(p.playerId, p);
      }
      return;
    }

    // Atomic claim of matched players to prevent race conditions
    this.isMatchingInProgress = true;
    try {
      // Remove matched players from queue
      for (const player of stillConnected) {
        this.queue.delete(player.playerId);
        player.status = 'MATCHED';
      }

      this.createMatchmakingRoom(stillConnected);
    } finally {
      this.isMatchingInProgress = false;
    }
  }

  /**
   * Creates an online matchmaking room with matched players,
   * assigns unique colors, sets all players to ready, and triggers the 3-2-1 countdown.
   */
  private createMatchmakingRoom(matchedPlayers: MatchmakingQueueEntry[]): void {
    if (!this.context) return;
    const { rooms, clientMeta, createRoomPlayer, createRoomObject, generateRoomCode, broadcastRoom, startRoomCountdown, addSocketToRoom } =
      this.context;

    // Generate unique room code
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    // Assign colors: 1st host RED, 2nd GREEN (or YELLOW for 2-player opposite), 3rd YELLOW, 4th BLUE
    // In 2-player Ludo, RED & YELLOW (opposite corners) or RED & GREEN are standard. Let's use opposite corners (RED & YELLOW) if 2 players, or RED, GREEN, YELLOW, BLUE.
    const colors: PlayerColor[] =
      matchedPlayers.length === 2 ? ['RED', 'YELLOW'] : ['RED', 'GREEN', 'YELLOW', 'BLUE'];

    // Create Host Player
    const hostEntry = matchedPlayers[0];
    const hostPlayer = createRoomPlayer({
      id: hostEntry.playerId,
      name: hostEntry.displayName,
      avatar: hostEntry.avatar,
      color: colors[0],
      isHost: true,
      isReady: true,
      level: hostEntry.level,
      xp: hostEntry.xp,
      coins: hostEntry.coins,
    });

    // Create Room Object marked as matchmaking-created
    const room = createRoomObject(code, hostPlayer);
    room.isMatchmaking = true;
    room.maxPlayers = matchedPlayers.length; // Lock to matched count (2, 3, or 4)
    room.minPlayers = matchedPlayers.length;

    // Add remaining matched players
    for (let i = 1; i < matchedPlayers.length; i++) {
      const entry = matchedPlayers[i];
      const player = createRoomPlayer({
        id: entry.playerId,
        name: entry.displayName,
        avatar: entry.avatar,
        color: colors[i],
        isHost: false,
        isReady: true, // Auto-ready in matchmaking
        level: entry.level,
        xp: entry.xp,
        coins: entry.coins,
      });
      room.players.push(player);
    }

    // Register room in global rooms map
    rooms.set(code, room);

    // Prepare matched players preview
    const matchedPreview: MatchedPlayerInfo[] = room.players.map((p) => {
      const entry = matchedPlayers.find((e) => e.playerId === p.id);
      return {
        playerId: p.id,
        displayName: p.displayName || p.name,
        name: p.name,
        avatar: p.avatar,
        level: p.level || 1,
        rating: entry?.rating || 1000,
        color: p.color,
      };
    });

    // Associate clients with room and send MATCHMAKING_MATCHED
    for (const playerEntry of matchedPlayers) {
      if (playerEntry.ws && playerEntry.ws.readyState === WebSocket.OPEN) {
        clientMeta.set(playerEntry.ws, { roomCode: code, playerId: playerEntry.playerId });
        if (addSocketToRoom) {
          addSocketToRoom(code, playerEntry.ws);
        }
        try {
          playerEntry.ws.send(
            JSON.stringify({
              type: 'MATCHMAKING_MATCHED',
              roomCode: code,
              room,
              countdown: 3,
              matchedPlayers: matchedPreview,
            })
          );
        } catch {
          // Socket send error ignored
        }
      }
    }

    // Broadcast room state to all players
    broadcastRoom(room);

    // Start 3-2-1 countdown and automatic game launch
    startRoomCountdown(room);
  }

  /**
   * Broadcasts the current matchmaking search status to all queue members.
   */
  private broadcastQueueUpdate(): void {
    const searching = Array.from(this.queue.values()).filter((e) => e.status === 'SEARCHING');
    const totalSearching = searching.length;
    const now = Date.now();

    const matchedPreview: MatchedPlayerInfo[] = searching.map((e) => ({
      playerId: e.playerId,
      displayName: e.displayName,
      name: e.displayName,
      avatar: e.avatar,
      level: e.level,
      rating: e.rating,
    }));

    for (const entry of searching) {
      if (entry.ws.readyState === WebSocket.OPEN) {
        const elapsedSeconds = Math.floor((now - entry.joinedAt) / 1000);
        // If elapsed >= 10s, target is 2 (fallback); otherwise target is 4
        const targetCount = elapsedSeconds >= 10 ? Math.max(2, Math.min(4, totalSearching)) : 4;
        const estimatedWaitSeconds = Math.max(1, 10 - elapsedSeconds);

        try {
          entry.ws.send(
            JSON.stringify({
              type: 'MATCHMAKING_QUEUE_UPDATE',
              status: 'SEARCHING',
              playersCount: totalSearching,
              targetCount,
              elapsedSeconds,
              estimatedWaitSeconds,
              matchedPlayers: matchedPreview,
            })
          );
        } catch {
          // Socket send error
        }
      }
    }
  }
}

export const matchmakingService = new MatchmakingService();
