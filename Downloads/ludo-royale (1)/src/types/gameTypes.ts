export type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';

export type GameMode = 'LOCAL' | 'AI' | 'ONLINE_COMING_SOON';

export type AIDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type GameStatus =
  | 'IDLE'
  | 'ROLLING'
  | 'WAITING_MOVE'
  | 'MOVING'
  | 'GAME_OVER'
  | 'PAUSED';

export type BoardTheme = 'CLASSIC' | 'NEON' | 'SPACE' | 'FOREST' | 'ROYAL';

export interface Token {
  id: number; // 0 to 15
  playerIndex: number; // 0 to 3
  color: PlayerColor;
  tokenIndex: number; // 0 to 3 within player's tokens
  position: number; // -1 = In Yard, 0..50 = Common track relative to player, 51..55 = Home stretch, 56 = Center Finish
  globalTrackIndex: number; // 0..51 when on common track, -1 when yard, 100+ when home stretch
  isYard: boolean;
  isHome: boolean;
  stepCount: number;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  avatar: string;
  isAI: boolean;
  aiDifficulty: AIDifficulty;
  tokens: Token[];
  score: number;
  captures: number;
  tokensFinished: number;
  winStreak: number;
  isActive: boolean; // Participates in current game (e.g. for 2, 3, or 4 player mode)
  rankPosition?: number; // 1st, 2nd, 3rd, 4th when finished
  tokenSkin?: string;
}

export interface MoveStep {
  tokenIndex: number;
  color: PlayerColor;
  fromPosition: number;
  toPosition: number;
  row: number;
  col: number;
}

export interface VisualStep {
  tokenId: number;
  row: number;
  col: number;
  stepIndex: number;
  totalSteps: number;
  isHop?: boolean;
}

export interface CaptureAnimation {
  victimTokenId: number;
  victimColor: PlayerColor;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  timestamp: number;
}

export interface CaptureEvent {
  attackerColor: PlayerColor;
  attackerName: string;
  victimColor: PlayerColor;
  victimName: string;
  timestamp: number;
}

export interface GameState {
  matchId: string;
  matchStartTime: number;
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  diceRolling: boolean;
  validMoves: number[]; // Token IDs that can be moved
  winner: Player | null;
  gameStatus: GameStatus;
  turnNumber: number;
  consecutiveSixes: number;
  lastActionText: string;
  captureEvent: CaptureEvent | null;
  mode: GameMode;
  extraTurnGranted: boolean;
  animatingTokenId: number | null;
  movingTokenStep: VisualStep | null;
  activeCaptureAnim: CaptureAnimation | null;
}

export interface Reaction {
  id: string;
  playerId: string;
  playerName: string;
  color: PlayerColor;
  emoji: string;
  timestamp: number;
}

export interface QuickChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  color: PlayerColor;
  text: string;
  timestamp: number;
}

export interface AICommentary {
  id: string;
  text: string;
  type: 'ROLL_SIX' | 'CAPTURE' | 'DECISION' | 'WIN' | 'START' | 'HOME_STRETCH' | 'INFO';
  timestamp: number;
}

export type GameEventType =
  | 'ROLL_SIX'
  | 'EXTRA_TURN'
  | 'CAPTURE'
  | 'SAFE_CELL'
  | 'TOKEN_HOME'
  | 'VICTORY';

export interface GameEventNotification {
  id: string;
  type: GameEventType;
  title: string;
  subtitle?: string;
  color: PlayerColor;
  icon: string;
  timestamp: number;
}

