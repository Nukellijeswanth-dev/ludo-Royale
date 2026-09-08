import {
  Player,
  PlayerColor,
  Token,
  VisualStep,
  CaptureAnimation,
  CaptureEvent,
  GameEventNotification,
} from './gameTypes';
import { GameInvitation } from './friendTypes';

export type RoomState = 'WAITING' | 'READY' | 'STARTING' | 'PLAYING' | 'FINISHED' | 'CLOSED';

export interface RoomSettings {
  maxPlayers: number;
  autoMove: boolean;
  quickDice: boolean;
}

export interface RoomPlayer {
  id: string;
  playerId: string;
  name: string;
  displayName: string;
  avatar: string;
  color: PlayerColor;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: number;
  lastSeenAt: number;
  level?: number;
  xp?: number;
  coins?: number;
  tokenSkin?: string;
  reconnectGraceSeconds?: number;
}

export interface SynchronizedGameState {
  matchId: string;
  matchStartTime: number;
  status: 'IDLE' | 'ROLLING' | 'WAITING_MOVE' | 'MOVING' | 'GAME_OVER';
  currentPlayerId: string;
  currentPlayerIndex: number;
  currentPlayerColor: PlayerColor;
  turnNumber: number;
  actionNonce?: string;
  lastProcessedActionId?: string;
  diceValue: number | null;
  diceRolling: boolean;
  diceRolled: boolean;
  players: Player[];
  tokens: Token[];
  validMoves: number[]; // token IDs that can legally move
  winner: Player | null;
  winningOrder: string[];
  lastActionText: string;
  consecutiveSixes: number;
  extraTurnGranted: boolean;
  animatingTokenId: number | null;
  movingTokenStep: VisualStep | null;
  activeCaptureAnim: CaptureAnimation | null;
  captureEvent: CaptureEvent | null;
  updatedAt: number;
}

export interface Room {
  id: string;
  roomId: string;
  code: string;
  roomCode: string;
  hostId: string;
  state: RoomState;
  status: RoomState;
  maxPlayers: number;
  minPlayers: number;
  players: RoomPlayer[];
  createdAt: number;
  updatedAt: number;
  lastActivityAt?: number;
  startedAt?: number;
  countdown?: number;
  isMatchmaking?: boolean;
  joinLock?: boolean;
  isActionProcessing?: boolean;
  actionNonce?: string;
  settings?: RoomSettings;
  gameState?: SynchronizedGameState;
  chatHistory?: ChatMessage[];
}

export interface ChatMessage {
  messageId: string;
  id: string; // for compatibility
  playerId?: string;
  playerName?: string;
  playerColor?: PlayerColor;
  color?: PlayerColor; // for compatibility
  message: string;
  text: string; // for compatibility
  timestamp: number;
  isSystem?: boolean;
}

export interface MatchedPlayerInfo {
  playerId: string;
  displayName: string;
  name?: string;
  avatar: string;
  level: number;
  rating: number;
  color?: PlayerColor;
}

export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerId: string; playerName: string; playerAvatar: string; level?: number; xp?: number; coins?: number; tokenSkin?: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerId: string; playerName: string; playerAvatar: string; level?: number; xp?: number; coins?: number; tokenSkin?: string }
  | { type: 'ENTER_MATCHMAKING'; playerId: string; playerName: string; playerAvatar: string; level?: number; rating?: number; xp?: number; coins?: number; tokenSkin?: string }
  | { type: 'CANCEL_MATCHMAKING'; playerId: string }
  | { type: 'LEAVE_ROOM'; roomCode: string; playerId: string }
  | { type: 'KICK_PLAYER'; roomCode: string; hostPlayerId: string; targetPlayerId: string }
  | { type: 'CLOSE_ROOM'; roomCode: string; hostPlayerId: string }
  | { type: 'TOGGLE_READY'; roomCode: string; playerId: string; isReady: boolean }
  | { type: 'START_GAME'; roomCode: string; playerId: string }
  | { type: 'UPDATE_ROOM_SETTINGS'; roomCode: string; hostPlayerId: string; settings: Partial<RoomSettings> }
  | { type: 'ROLL_DICE'; roomCode: string; playerId: string; actionId?: string; actionNonce?: string }
  | { type: 'MOVE_TOKEN'; roomCode: string; playerId: string; tokenId: number; actionId?: string; actionNonce?: string }
  | { type: 'SEND_REACTION'; roomCode: string; playerId: string; emoji: string }
  | { type: 'SEND_CHAT'; roomCode: string; playerId: string; text?: string; message?: string }
  | { type: 'SEND_CHAT_MESSAGE'; roomCode: string; playerId: string; message: string }
  | { type: 'GET_CHAT_HISTORY'; roomCode: string; playerId?: string }
  | { type: 'RECONNECT'; roomCode: string; playerId: string; playerName: string; playerAvatar: string; level?: number; xp?: number; coins?: number; tokenSkin?: string }
  | { type: 'IDENTIFY'; playerId: string; displayName?: string; avatar?: string }
  | { type: 'SEND_FRIEND_REQUEST'; requesterId: string; receiverId: string }
  | { type: 'RESPOND_FRIEND_REQUEST'; userId: string; friendshipId: string; action: 'ACCEPT' | 'DECLINE' }
  | { type: 'REMOVE_FRIEND'; userId: string; friendshipId: string }
  | { type: 'BLOCK_PLAYER'; userId: string; targetPlayerId: string }
  | { type: 'UNBLOCK_PLAYER'; userId: string; targetPlayerId: string }
  | { type: 'SEND_GAME_INVITE'; senderId: string; receiverId: string; roomCode: string }
  | { type: 'RESPOND_GAME_INVITE'; invitationId: string; receiverId: string; action: 'ACCEPT' | 'DECLINE' }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'ROOM_STATE'; room: Room; myPlayerId: string }
  | { type: 'MATCHMAKING_QUEUE_UPDATE'; status: 'SEARCHING' | 'MATCHED' | 'IDLE'; playersCount: number; targetCount: number; elapsedSeconds?: number; estimatedWaitSeconds?: number; matchedPlayers?: MatchedPlayerInfo[] }
  | { type: 'MATCHMAKING_MATCHED'; roomCode: string; room: Room; countdown: number; matchedPlayers: MatchedPlayerInfo[] }
  | { type: 'MATCHMAKING_CANCELLED'; message?: string }
  | { type: 'ROOM_LEFT'; message?: string }
  | { type: 'ROOM_CLOSED'; message?: string }
  | { type: 'GAME_STARTING'; room: Room; countdown: number }
  | { type: 'GAME_STARTED'; room: Room }
  | { type: 'REACTION'; playerId: string; playerName: string; color: PlayerColor; emoji: string; id: string; timestamp: number }
  | { type: 'CHAT_MESSAGE'; messageId: string; id: string; playerId?: string; playerName?: string; color?: PlayerColor; playerColor?: PlayerColor; message: string; text: string; timestamp: number; isSystem?: boolean }
  | { type: 'CHAT_HISTORY'; roomCode: string; messages: ChatMessage[] }
  | { type: 'MATCH_REWARDS'; matchId: string; rewards: Record<string, any>; profile?: any }
  | { type: 'GAME_EVENT'; event: GameEventNotification }
  | { type: 'FRIEND_REQUEST_RECEIVED'; request: any }
  | { type: 'FRIEND_REQUEST_UPDATED'; friendship: any; action: 'ACCEPTED' | 'DECLINED' | 'REMOVED' | 'BLOCKED' }
  | { type: 'FRIEND_PRESENCE_UPDATE'; playerId: string; isOnline: boolean }
  | { type: 'GAME_INVITE_RECEIVED'; invitation: GameInvitation }
  | { type: 'GAME_INVITE_RESPONSE'; invitationId: string; status: string; message?: string }
  | { type: 'INVITATION_ACCEPTED_JOIN'; roomCode: string; room: Room }
  | { type: 'ERROR'; message: string; code?: string }
  | { type: 'ACTION_REJECTED'; action: string; reason: string; code?: string }
  | { type: 'PONG' };

