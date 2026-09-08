import { PlayerColor } from './gameTypes';
import { UserGameSettings } from './customizationTypes';

export interface UserProfile {
  id: string; // Unique player ID
  playerId?: string; // Standard alias for id
  username: string; // Player chosen handle
  displayName?: string; // Standard alias for username
  name: string; // Backward compatibility alias for username
  avatar: string; // Selected avatar icon/emoji
  level: number; // Current player level (1, 2, 3...)
  xp: number; // Total XP points accumulated
  coins: number; // Persistent coin balance
  totalGames: number; // Total matches completed
  gamesPlayed: number; // Backward compatibility alias
  wins: number; // Total victories
  gamesWon: number; // Backward compatibility alias
  losses: number; // Total defeats
  gamesLost: number; // Backward compatibility alias
  captures: number; // Total opponent tokens knocked out
  totalCaptures?: number; // Standard alias for captures
  winRate?: number; // Win rate percentage (e.g. 42.9)
  tokensFinished: number; // Total tokens successfully guided home
  highestScore: number; // Best score in a single match
  currentWinStreak: number; // Consecutive current victories
  winStreak: number; // Backward compatibility alias
  bestWinStreak: number; // All-time highest win streak
  bestStreak: number; // Backward compatibility alias
  totalPlayTime: number; // Total play duration in seconds
  rating: number; // Elo skill rating
  rank: string; // Tier title (e.g. "Royale Champion")
  unlockedAvatars?: string[];
  selectedAvatar?: string;
  unlockedTokenSkins?: string[];
  selectedTokenSkin?: string;
  unlockedThemes?: string[];
  selectedTheme?: string;
  gameSettings?: UserGameSettings;
  achievements: Achievement[]; // List of achievements with progress
  email?: string;
  winPercentage?: number;
  processedMatchIds: string[]; // Idempotency tracker for rewarded games
  createdAt: string; // ISO date
  updatedAt?: string; // ISO date
  lastPlayedAt?: string; // ISO date
  lastActiveAt?: string; // ISO date
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  unlocked: boolean;
  rewardCoins: number;
  rewardXp: number;
  unlockedAt?: string;
}

export interface GameHistoryRecord {
  id: string;
  winner: string;
  winnerColor: PlayerColor;
  mode: string;
  playersCount: number;
  players: {
    name: string;
    color: PlayerColor;
    captures: number;
    tokensFinished: number;
    isWinner: boolean;
    isAI: boolean;
  }[];
  durationSeconds: number;
  date: string;
}

export interface LeaderboardEntry {
  id: string;
  playerId?: string;
  rank: number;
  name: string;
  displayName?: string;
  avatar: string;
  level: number;
  rating: number;
  wins: number;
  winRate: number; // percentage
  captures: number;
  coins?: number;
  xp: number;
  value?: number;
  displayValue?: string;
}

export type BoardTheme = 'ROYALE' | 'CLASSIC' | 'MODERN' | 'NEON';

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled?: boolean;
  vibrationEnabled?: boolean;
  animationsEnabled?: boolean;
  notificationsEnabled?: boolean;
  aiCompanionEnabled?: boolean;
  animationSpeed?: 'NORMAL' | 'FAST';
  boardTheme?: BoardTheme | string;
}
