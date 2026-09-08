import { UserProfile, Achievement, GameHistoryRecord, LeaderboardEntry, GameSettings } from '../types/playerTypes';
import { INITIAL_ACHIEVEMENTS } from '../game/achievements';
import { calculateLevel, getRankTier } from '../game/scoring';
import { playerProfileService } from '../services/playerProfileService';

const DB_PROFILE_KEY = 'ludo_royale_profile';
const DB_GAMES_KEY = 'ludo_royale_games';
const DB_ACHIEVEMENTS_KEY = 'ludo_royale_achievements';
const DB_LEADERBOARD_KEY = 'ludo_royale_leaderboard';
const DB_SETTINGS_KEY = 'ludo_royale_settings';

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  aiCompanionEnabled: true,
  animationSpeed: 'NORMAL',
  boardTheme: 'ROYALE',
};

const DEFAULT_PROFILE: UserProfile = {
  id: 'usr_jeswanth_1',
  username: 'Jeswanth',
  name: 'Jeswanth',
  avatar: '👑',
  level: 5,
  xp: 2600,
  coins: 850,
  rating: 1842,
  rank: 'Royale Champion',
  totalGames: 32,
  gamesPlayed: 32,
  wins: 19,
  gamesWon: 19,
  losses: 13,
  gamesLost: 13,
  captures: 48,
  tokensFinished: 28,
  highestScore: 1450,
  currentWinStreak: 3,
  winStreak: 3,
  bestWinStreak: 6,
  bestStreak: 6,
  totalPlayTime: 3840,
  achievements: INITIAL_ACHIEVEMENTS,
  processedMatchIds: [],
  createdAt: '2026-01-15T00:00:00.000Z',
};

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'lead_1',
    rank: 1,
    name: 'Jeswanth',
    avatar: '👑',
    level: 5,
    rating: 1842,
    wins: 19,
    winRate: 59,
    captures: 48,
    xp: 2600,
  },
  {
    id: 'lead_2',
    rank: 2,
    name: 'Aria_Valkyrie',
    avatar: '⚡',
    level: 7,
    rating: 1810,
    wins: 38,
    winRate: 54,
    captures: 72,
    xp: 4900,
  },
  {
    id: 'lead_3',
    rank: 3,
    name: 'Phoenix_King',
    avatar: '🔥',
    level: 6,
    rating: 1775,
    wins: 29,
    winRate: 52,
    captures: 55,
    xp: 3800,
  },
  {
    id: 'lead_4',
    rank: 4,
    name: 'Cyber_Knight',
    avatar: '🛡️',
    level: 5,
    rating: 1690,
    wins: 22,
    winRate: 48,
    captures: 41,
    xp: 2750,
  },
  {
    id: 'lead_5',
    rank: 5,
    name: 'Luna_Mystic',
    avatar: '🌙',
    level: 4,
    rating: 1640,
    wins: 18,
    winRate: 46,
    captures: 35,
    xp: 1950,
  },
  {
    id: 'lead_6',
    rank: 6,
    name: 'Shadow_Strike',
    avatar: '🥷',
    level: 4,
    rating: 1580,
    wins: 15,
    winRate: 45,
    captures: 29,
    xp: 1800,
  },
  {
    id: 'lead_7',
    rank: 7,
    name: 'Dragon_Claw',
    avatar: '🐉',
    level: 3,
    rating: 1510,
    wins: 12,
    winRate: 42,
    captures: 24,
    xp: 1200,
  },
];

/**
 * Modular Database interface abstraction.
 * Currently persists to browser LocalStorage with relational model schemas;
 * can seamlessly map to SQLite / PostgreSQL REST endpoints in the future.
 */
class LocalDatabase {
  public getProfile(): UserProfile {
    return playerProfileService.getProfile();
  }

  public saveProfile(profile: UserProfile): void {
    playerProfileService.saveProfile(profile);
    this.syncLeaderboard(profile);
  }

  public updateProfileAfterGame(
    won: boolean,
    captures: number,
    tokensFinished: number,
    xpEarned: number,
    coinsEarned: number,
    ratingChange: number
  ): UserProfile {
    const profile = this.getProfile();
    profile.totalGames += 1;
    profile.gamesPlayed = profile.totalGames;
    if (won) {
      profile.wins += 1;
      profile.gamesWon = profile.wins;
      profile.currentWinStreak += 1;
      profile.winStreak = profile.currentWinStreak;
      if (profile.currentWinStreak > profile.bestWinStreak) {
        profile.bestWinStreak = profile.currentWinStreak;
        profile.bestStreak = profile.bestWinStreak;
      }
    } else {
      profile.losses += 1;
      profile.gamesLost = profile.losses;
      profile.currentWinStreak = 0;
      profile.winStreak = 0;
    }

    profile.captures += captures;
    profile.tokensFinished += tokensFinished;
    profile.xp += xpEarned;
    profile.coins += coinsEarned;
    profile.rating = Math.max(800, profile.rating + ratingChange);
    profile.rank = getRankTier(profile.rating);

    const levelInfo = calculateLevel(profile.xp);
    profile.level = levelInfo.level;

    this.saveProfile(profile);

    // Also update achievements
    this.checkAchievementsProgress(profile, won, captures, tokensFinished);
    this.syncLeaderboard(profile);

    return profile;
  }

  public getAchievements(): Achievement[] {
    try {
      const data = localStorage.getItem(DB_ACHIEVEMENTS_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    this.saveAchievements(INITIAL_ACHIEVEMENTS);
    return INITIAL_ACHIEVEMENTS;
  }

  public saveAchievements(achievements: Achievement[]): void {
    try {
      localStorage.setItem(DB_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
    } catch {
      // ignore
    }
  }

  private checkAchievementsProgress(
    profile: UserProfile,
    won: boolean,
    captures: number,
    tokensFinished: number
  ) {
    const achievements = this.getAchievements();
    let updated = false;

    achievements.forEach((ach) => {
      if (ach.unlocked) return;

      if (ach.id === 'first_victory' && profile.gamesWon >= 1) {
        ach.progress = 1;
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
        updated = true;
      } else if (ach.id === 'first_capture' && profile.captures >= 1) {
        ach.progress = 1;
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
        updated = true;
      } else if (ach.id === 'destroyer') {
        ach.progress = Math.min(ach.target, profile.captures);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
        }
        updated = true;
      } else if (ach.id === 'ludo_master') {
        ach.progress = Math.min(ach.target, profile.gamesWon);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
        }
        updated = true;
      } else if (ach.id === 'champion') {
        ach.progress = Math.min(ach.target, profile.level);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
        }
        updated = true;
      } else if (ach.id === 'speed_demon') {
        ach.progress = Math.min(ach.target, (ach.progress || 0) + tokensFinished);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
        }
        updated = true;
      }
    });

    if (updated) {
      this.saveAchievements(achievements);
    }
  }

  public recordSixRolled() {
    const achievements = this.getAchievements();
    const ach = achievements.find((a) => a.id === 'lucky_six');
    if (ach && !ach.unlocked) {
      ach.progress = Math.min(ach.target, (ach.progress || 0) + 1);
      if (ach.progress >= ach.target) {
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
      }
      this.saveAchievements(achievements);
    }
  }

  public getGameHistory(): GameHistoryRecord[] {
    try {
      const data = localStorage.getItem(DB_GAMES_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  public saveGameRecord(record: GameHistoryRecord): void {
    const list = this.getGameHistory();
    list.unshift(record);
    if (list.length > 20) list.pop();
    try {
      localStorage.setItem(DB_GAMES_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  public getLeaderboard(): LeaderboardEntry[] {
    try {
      const data = localStorage.getItem(DB_LEADERBOARD_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    this.saveLeaderboard(SEED_LEADERBOARD);
    return SEED_LEADERBOARD;
  }

  public saveLeaderboard(entries: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(DB_LEADERBOARD_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }

  public getSettings(): GameSettings {
    try {
      const data = localStorage.getItem(DB_SETTINGS_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    this.saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  public saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  private syncLeaderboard(profile: UserProfile): void {
    const board = this.getLeaderboard();
    const existing = board.find((e) => e.id === profile.id);
    const winRate = profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;

    if (existing) {
      existing.name = profile.name;
      existing.avatar = profile.avatar;
      existing.level = profile.level;
      existing.rating = profile.rating;
      existing.wins = profile.gamesWon;
      existing.winRate = winRate;
      existing.captures = profile.captures;
      existing.xp = profile.xp;
    } else {
      board.push({
        id: profile.id,
        rank: board.length + 1,
        name: profile.name,
        avatar: profile.avatar,
        level: profile.level,
        rating: profile.rating,
        wins: profile.gamesWon,
        winRate,
        captures: profile.captures,
        xp: profile.xp,
      });
    }

    // Sort by rating descending
    board.sort((a, b) => b.rating - a.rating);
    board.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    this.saveLeaderboard(board);
  }
}

export const db = new LocalDatabase();
