import { UserProfile, Achievement, GameHistoryRecord } from '../types/playerTypes';
import { INITIAL_ACHIEVEMENTS } from '../game/achievements';
import { calculateRewards, calculateLevel, getRankTier, GameEndRewards, LevelProgress } from '../game/scoring';
import {
  BUILTIN_AVATARS,
  TOKEN_SKINS_CATALOG,
  BOARD_THEMES_CATALOG,
  UserGameSettings,
} from '../types/customizationTypes';

const DB_PROFILE_KEY = 'ludo_royale_profile';
const DB_ACHIEVEMENTS_KEY = 'ludo_royale_achievements';
const DB_GAMES_KEY = 'ludo_royale_games';

export const DEFAULT_AVATARS: string[] = [
  ...BUILTIN_AVATARS,
];

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
  sanitized: string;
}

export interface MatchCompletionParams {
  matchId: string;
  playerWon: boolean;
  captures: number;
  tokensFinished: number;
  matchScore: number;
  matchDurationSeconds: number;
  rank?: number; // 1 = Winner, 2, 3, 4
}

export interface MatchCompletionResult {
  profile: UserProfile;
  rewards: GameEndRewards;
  isDuplicate: boolean;
  newAchievementsUnlocked: Achievement[];
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
}

/**
 * Storage Driver Interface.
 * Allows decoupling the storage implementation so it can seamlessly transition
 * between LocalStorage, IndexedDB, Firebase Firestore, Supabase, or REST APIs.
 */
export interface ProfileStorageDriver {
  loadProfile(): UserProfile | null;
  saveProfile(profile: UserProfile): void;
  loadAchievements(): Achievement[];
  saveAchievements(achievements: Achievement[]): void;
  loadGameHistory(): GameHistoryRecord[];
  saveGameRecord(record: GameHistoryRecord): void;
}

/**
 * LocalStorage implementation of ProfileStorageDriver.
 */
class LocalStorageProfileDriver implements ProfileStorageDriver {
  loadProfile(): UserProfile | null {
    try {
      const data = localStorage.getItem(DB_PROFILE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load profile from localStorage:', e);
    }
    return null;
  }

  saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(DB_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile to localStorage:', e);
    }
  }

  loadAchievements(): Achievement[] {
    try {
      const data = localStorage.getItem(DB_ACHIEVEMENTS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load achievements from localStorage:', e);
    }
    return INITIAL_ACHIEVEMENTS;
  }

  saveAchievements(achievements: Achievement[]): void {
    try {
      localStorage.setItem(DB_ACHIEVEMENTS_KEY, JSON.stringify(achievements));
    } catch (e) {
      console.error('Failed to save achievements to localStorage:', e);
    }
  }

  loadGameHistory(): GameHistoryRecord[] {
    try {
      const data = localStorage.getItem(DB_GAMES_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load game history from localStorage:', e);
    }
    return [];
  }

  saveGameRecord(record: GameHistoryRecord): void {
    try {
      const list = this.loadGameHistory();
      list.unshift(record);
      if (list.length > 30) list.pop();
      localStorage.setItem(DB_GAMES_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save game record to localStorage:', e);
    }
  }
}

/**
 * Validates usernames against injection, unsafe characters, and length constraints.
 */
export function validateUsername(input: string): UsernameValidationResult {
  if (typeof input !== 'string') {
    return { isValid: false, error: 'Username must be text', sanitized: '' };
  }

  // Check for HTML tags or script injection attempts
  const hasHtmlTag = /<[a-z\d!/][\s\S]*>/i.test(input) || /javascript:/i.test(input) || /&[#\w]+;/i.test(input);
  if (hasHtmlTag) {
    return { isValid: false, error: 'HTML tags and script injections are forbidden', sanitized: '' };
  }

  // Disallow common dangerous characters: < > " ' / \ ` ; { } [ ]
  const hasUnsafeChars = /[<>"'/\\`;{}[\]]/.test(input);
  if (hasUnsafeChars) {
    return { isValid: false, error: 'Username contains forbidden characters', sanitized: '' };
  }

  // Disallow multiple consecutive spaces
  if (/ {2,}/.test(input)) {
    return { isValid: false, error: 'Multiple consecutive spaces are not permitted', sanitized: '' };
  }

  // Allowed character set: alphanumeric, underscores, hyphens, and single spaces
  const allowedPattern = /^[a-zA-Z0-9_\- ]+$/;
  if (!allowedPattern.test(input)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, spaces, underscores, and hyphens',
      sanitized: '',
    };
  }

  const trimmed = input.trim();
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long', sanitized: trimmed };
  }

  if (trimmed.length > 16) {
    return { isValid: false, error: 'Username cannot exceed 16 characters', sanitized: trimmed.slice(0, 16) };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Player Profile & Progression Service
 */
export class PlayerProfileService {
  private driver: ProfileStorageDriver;
  private currentProfile: UserProfile | null = null;
  private listeners: Set<(profile: UserProfile) => void> = new Set();

  constructor(driver?: ProfileStorageDriver) {
    this.driver = driver || new LocalStorageProfileDriver();
    this.init();
  }

  private generateUniquePlayerId(): string {
    const timestamp = Date.now().toString(36);
    const randomHex = Math.random().toString(36).substring(2, 8);
    return `usr_${timestamp}_${randomHex}`;
  }

  private createDefaultProfile(): UserProfile {
    const id = this.generateUniquePlayerId();
    const achievements = this.driver.loadAchievements();

    return {
      id,
      username: 'Jeswanth',
      name: 'Jeswanth',
      avatar: '👑',
      level: 1,
      xp: 0,
      coins: 1000, // Starting default (Req 14)
      totalGames: 0,
      gamesPlayed: 0,
      wins: 0,
      gamesWon: 0,
      losses: 0,
      gamesLost: 0,
      captures: 0,
      winPercentage: 0,
      tokensFinished: 0,
      highestScore: 0,
      currentWinStreak: 0,
      winStreak: 0,
      bestWinStreak: 0,
      bestStreak: 0,
      totalPlayTime: 0,
      rating: 1200, // Starting default (Req 14)
      rank: 'Warrior',
      unlockedAvatars: [...BUILTIN_AVATARS],
      selectedAvatar: '👑',
      unlockedTokenSkins: ['classic'],
      selectedTokenSkin: 'classic',
      unlockedThemes: ['classic'],
      selectedTheme: 'classic',
      gameSettings: {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        animationsEnabled: true,
        notificationsEnabled: true,
      },
      achievements,
      processedMatchIds: [],
      createdAt: new Date().toISOString(),
      lastPlayedAt: undefined,
    };
  }

  private init(): void {
    const loaded = this.driver.loadProfile();
    if (loaded) {
      this.currentProfile = this.normalizeProfile(loaded);
      this.driver.saveProfile(this.currentProfile);
    } else {
      this.currentProfile = this.createDefaultProfile();
      this.driver.saveProfile(this.currentProfile);
    }
    // Asynchronously synchronize with persistent server database
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.syncWithServer().catch(() => {});
      }, 50);
    }
  }

  /**
   * Synchronizes client profile with server-authoritative persistence.
   */
  public async syncWithServer(): Promise<UserProfile> {
    const profile = this.getProfile();
    try {
      const res = await fetch(`/api/profiles/${profile.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const merged = this.normalizeProfile({
            ...profile,
            ...data.profile,
            // Keep local achievements & local arrays intact if server returns core stats
            achievements: profile.achievements,
          });
          this.currentProfile = merged;
          this.driver.saveProfile(merged);
          this.notify();
          return merged;
        }
      } else if (res.status === 404) {
        // Register profile on server
        const regRes = await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: profile.id,
            displayName: profile.username,
            avatar: profile.avatar,
          }),
        });
        if (regRes.ok) {
          const regData = await regRes.json();
          if (regData.profile) {
            const merged = this.normalizeProfile({ ...profile, ...regData.profile });
            this.currentProfile = merged;
            this.driver.saveProfile(merged);
            this.notify();
            return merged;
          }
        }
      }
    } catch (e) {
      // Offline fallback: keep local profile
      console.warn('[ProfileService] Server sync offline or unavailable:', e);
    }
    return profile;
  }

  /**
   * Sets profile from verified server auth session
   */
  public setAuthenticatedProfile(serverProfile: any): UserProfile {
    const current = this.getProfile();
    const merged = this.normalizeProfile({
      ...current,
      ...serverProfile,
      id: serverProfile.playerId || serverProfile.id || current.id,
      playerId: serverProfile.playerId || serverProfile.id || current.id,
      username: serverProfile.displayName || serverProfile.username || current.username,
      displayName: serverProfile.displayName || serverProfile.username || current.displayName,
      avatar: serverProfile.avatar || current.avatar,
      level: serverProfile.level ?? current.level,
      xp: serverProfile.xp ?? current.xp,
      coins: serverProfile.coins ?? current.coins,
      rating: serverProfile.rating ?? current.rating,
      gamesPlayed: serverProfile.gamesPlayed ?? current.gamesPlayed,
      totalGames: serverProfile.gamesPlayed ?? current.totalGames,
      gamesWon: serverProfile.gamesWon ?? current.gamesWon,
      wins: serverProfile.gamesWon ?? current.wins,
      gamesLost: serverProfile.gamesLost ?? current.gamesLost,
      losses: serverProfile.gamesLost ?? current.losses,
      email: serverProfile.email || current.email,
      lastActiveAt: serverProfile.lastActiveAt || new Date().toISOString(),
      achievements: current.achievements,
    });
    this.currentProfile = merged;
    this.driver.saveProfile(merged);
    this.notify();
    return merged;
  }

  /**
   * Fetches real persistent leaderboard rankings from the server.
   */
  public async fetchLeaderboard(
    category: 'wins' | 'xp' | 'coins' | 'captures' | 'rating' = 'wins',
    limit = 50
  ): Promise<{
    entries: any[];
    myRank: any;
    totalPlayers?: number;
    category: string;
  }> {
    const profile = this.getProfile();
    try {
      const res = await fetch(`/api/leaderboard?category=${category}&limit=${limit}&playerId=${profile.id}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[ProfileService] Failed to fetch server leaderboard, using local fallback:', e);
    }

    // Fallback: return default simulated leaderboard
    const fallbackList = [
      { id: 'usr_bot_1', rank: 1, name: 'DragonMaster', avatar: '🐉', level: 12, rating: 2200, wins: 88, captures: 142, coins: 4800, xp: 6200, winRate: 74 },
      { id: 'usr_bot_2', rank: 2, name: 'StarGazer', avatar: '⭐', level: 9, rating: 1980, wins: 64, captures: 98, coins: 3100, xp: 4300, winRate: 68 },
      { id: profile.id, rank: 3, name: profile.username, avatar: profile.avatar, level: profile.level, rating: profile.rating, wins: profile.wins, captures: profile.captures, coins: profile.coins, xp: profile.xp, winRate: profile.totalGames > 0 ? Math.round((profile.wins / profile.totalGames) * 100) : 0 },
      { id: 'usr_bot_3', rank: 4, name: 'ShadowNinja', avatar: '🥷', level: 8, rating: 1840, wins: 52, captures: 86, coins: 2400, xp: 3600, winRate: 60 },
      { id: 'usr_bot_4', rank: 5, name: 'DiceWizard', avatar: '🧙‍♂️', level: 6, rating: 1650, wins: 38, captures: 61, coins: 1850, xp: 2700, winRate: 55 },
    ];
    return {
      entries: fallbackList,
      myRank: 3,
      totalPlayers: fallbackList.length,
    };
  }

  /**
   * Applies server-calculated match rewards broadcasted via WebSocket.
   */
  public applyServerRewards(data: { matchId: string; rewards?: any; profile?: Partial<UserProfile> }): void {
    if (!data) return;
    const profile = this.getProfile();
    if (data.profile) {
      const merged = this.normalizeProfile({
        ...profile,
        ...data.profile,
        achievements: profile.achievements,
      });
      if (!merged.processedMatchIds.includes(data.matchId)) {
        merged.processedMatchIds.push(data.matchId);
      }
      this.currentProfile = merged;
      this.driver.saveProfile(merged);
      this.notify();
    }
  }

  /**
   * Guarantees all required fields and backward compatibility aliases are present.
   */
  private normalizeProfile(raw: Partial<UserProfile>): UserProfile {
    const username = raw.username || raw.name || 'RoyalePlayer';
    const totalGames = raw.totalGames ?? raw.gamesPlayed ?? 0;
    const wins = raw.wins ?? raw.gamesWon ?? 0;
    const losses = raw.losses ?? raw.gamesLost ?? 0;
    const winStreak = raw.currentWinStreak ?? raw.winStreak ?? 0;
    const bestStreak = raw.bestWinStreak ?? raw.bestStreak ?? 0;
    const xp = Math.max(0, raw.xp ?? 0);
    const levelInfo = calculateLevel(xp);

    let achievements = raw.achievements;
    if (!achievements || achievements.length === 0) {
      achievements = this.driver.loadAchievements();
    }

    const unlockedAvatars =
      Array.isArray(raw.unlockedAvatars) && raw.unlockedAvatars.length > 0
        ? raw.unlockedAvatars
        : [...BUILTIN_AVATARS];
    const selectedAvatar = raw.selectedAvatar || raw.avatar || '👑';
    const unlockedTokenSkins =
      Array.isArray(raw.unlockedTokenSkins) && raw.unlockedTokenSkins.length > 0
        ? raw.unlockedTokenSkins
        : ['classic'];
    const selectedTokenSkin = raw.selectedTokenSkin || 'classic';
    const unlockedThemes =
      Array.isArray(raw.unlockedThemes) && raw.unlockedThemes.length > 0
        ? raw.unlockedThemes
        : ['classic'];
    const selectedTheme = raw.selectedTheme || 'classic';
    const gameSettings: UserGameSettings = raw.gameSettings || {
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      animationsEnabled: true,
      notificationsEnabled: true,
    };

    return {
      id: raw.id || this.generateUniquePlayerId(),
      username,
      name: username,
      avatar: selectedAvatar,
      level: levelInfo.level,
      xp,
      coins: Math.max(0, raw.coins ?? 250),
      totalGames,
      gamesPlayed: totalGames,
      wins,
      gamesWon: wins,
      losses,
      gamesLost: losses,
      captures: Math.max(0, raw.captures ?? 0),
      tokensFinished: Math.max(0, raw.tokensFinished ?? 0),
      highestScore: Math.max(0, raw.highestScore ?? 0),
      currentWinStreak: winStreak,
      winStreak,
      bestWinStreak: Math.max(bestStreak, winStreak),
      bestStreak: Math.max(bestStreak, winStreak),
      totalPlayTime: Math.max(0, raw.totalPlayTime ?? 0),
      rating: typeof raw.rating === 'number' ? raw.rating : 1000,
      rank: raw.rank || getRankTier(typeof raw.rating === 'number' ? raw.rating : 1000),
      unlockedAvatars,
      selectedAvatar,
      unlockedTokenSkins,
      selectedTokenSkin,
      unlockedThemes,
      selectedTheme,
      gameSettings,
      achievements,
      processedMatchIds: Array.isArray(raw.processedMatchIds) ? raw.processedMatchIds : [],
      createdAt: raw.createdAt || new Date().toISOString(),
      lastPlayedAt: raw.lastPlayedAt,
    };
  }

  public getProfile(): UserProfile {
    if (!this.currentProfile) {
      this.init();
    }
    return { ...this.currentProfile! };
  }

  public getLevelInfo(): LevelProgress {
    const profile = this.getProfile();
    return calculateLevel(profile.xp);
  }

  public updateUsername(newUsername: string): { success: boolean; error?: string; profile?: UserProfile } {
    const validation = validateUsername(newUsername);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const profile = this.getProfile();
    profile.username = validation.sanitized;
    profile.name = validation.sanitized;

    this.saveProfile(profile);

    // Persist to server backend
    fetch(`/api/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: validation.sanitized }),
    }).catch((err) => console.warn('[ProfileService] Failed to patch username to server:', err));

    return { success: true, profile };
  }

  public updateAvatar(avatar: string): UserProfile {
    const profile = this.getProfile();
    profile.avatar = avatar;
    profile.selectedAvatar = avatar;
    this.saveProfile(profile);

    // Persist to server backend
    fetch(`/api/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar }),
    }).catch((err) => console.warn('[ProfileService] Failed to patch avatar to server:', err));

    return profile;
  }

  /**
   * Purchases a customization item (token skin, board theme, or avatar) with server-side validation.
   */
  public async purchaseItem(
    itemId: string,
    itemType: 'TOKEN_SKIN' | 'BOARD_THEME' | 'AVATAR'
  ): Promise<{ success: boolean; error?: string; message?: string; profile?: UserProfile }> {
    const profile = this.getProfile();

    try {
      const res = await fetch('/api/customization/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: profile.id,
          itemId,
          itemType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to complete purchase.' };
      }

      if (data.profile) {
        const merged = this.normalizeProfile({ ...profile, ...data.profile });
        this.currentProfile = merged;
        this.driver.saveProfile(merged);
        this.notify();
        return { success: true, message: data.message, profile: merged };
      }
    } catch (err) {
      console.warn('[ProfileService] Server purchase request offline, falling back locally:', err);
    }

    // Local fallback validation (offline mode)
    let catalogItem: { id: string; name: string; price: number } | undefined;
    if (itemType === 'TOKEN_SKIN') {
      catalogItem = TOKEN_SKINS_CATALOG.find((s) => s.id === itemId);
    } else if (itemType === 'BOARD_THEME') {
      catalogItem = BOARD_THEMES_CATALOG.find((t) => t.id === itemId);
    }

    if (!catalogItem) {
      return { success: false, error: 'Item not found in catalog.' };
    }

    const isOwned =
      itemType === 'TOKEN_SKIN'
        ? profile.unlockedTokenSkins.includes(itemId)
        : profile.unlockedThemes.includes(itemId);

    if (isOwned) {
      return { success: false, error: 'Item is already owned.' };
    }

    if (profile.coins < catalogItem.price) {
      return {
        success: false,
        error: `Insufficient coins. Required: 🪙 ${catalogItem.price}, Available: 🪙 ${profile.coins}`,
      };
    }

    profile.coins -= catalogItem.price;
    if (itemType === 'TOKEN_SKIN') {
      profile.unlockedTokenSkins.push(itemId);
      profile.selectedTokenSkin = itemId;
    } else if (itemType === 'BOARD_THEME') {
      profile.unlockedThemes.push(itemId);
      profile.selectedTheme = itemId;
    }

    this.saveProfile(profile);
    return { success: true, message: `Successfully unlocked ${catalogItem.name}!`, profile };
  }

  /**
   * Equips/selects a customization item.
   * Supports both (itemType, itemId) and (itemId, itemType) for convenience.
   */
  public async selectItem(
    arg1: 'AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME' | string,
    arg2: string | ('AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME')
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const validTypes = ['AVATAR', 'TOKEN_SKIN', 'BOARD_THEME'] as const;
    let itemType: 'AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME';
    let itemId: string;

    if (validTypes.includes(arg1 as any)) {
      itemType = arg1 as 'AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME';
      itemId = String(arg2);
    } else if (validTypes.includes(arg2 as any)) {
      itemType = arg2 as 'AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME';
      itemId = String(arg1);
    } else {
      itemType = 'TOKEN_SKIN';
      itemId = String(arg1);
    }

    const profile = this.getProfile();

    if (itemType === 'AVATAR') {
      if (!BUILTIN_AVATARS.includes(itemId) && !profile.unlockedAvatars.includes(itemId)) {
        return { success: false, error: 'Avatar is locked.' };
      }
      profile.selectedAvatar = itemId;
      profile.avatar = itemId;
    } else if (itemType === 'TOKEN_SKIN') {
      if (!profile.unlockedTokenSkins.includes(itemId)) {
        return { success: false, error: 'Token skin is locked. Unlock it from the Store.' };
      }
      profile.selectedTokenSkin = itemId;
    } else if (itemType === 'BOARD_THEME') {
      if (!profile.unlockedThemes.includes(itemId)) {
        return { success: false, error: 'Theme is locked. Unlock it from the Store.' };
      }
      profile.selectedTheme = itemId;
    }

    this.saveProfile(profile);

    // Synchronize selection to server
    fetch('/api/customization/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: profile.id,
        itemType,
        itemId,
      }),
    }).catch((err) => console.warn('[ProfileService] Failed to sync selection to server:', err));

    return { success: true, profile };
  }

  public getTokenSkins() {
    return TOKEN_SKINS_CATALOG;
  }

  public getBoardThemes() {
    return BOARD_THEMES_CATALOG;
  }

  /**
   * Returns current user game settings.
   */
  public getGameSettings(): UserGameSettings {
    const profile = this.getProfile();
    return profile.gameSettings || {
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      animationsEnabled: true,
      notificationsEnabled: true,
    };
  }

  /**
   * Updates game settings and syncs them.
   */
  public updateGameSettings(settings: Partial<UserGameSettings>): UserGameSettings {
    const profile = this.getProfile();
    profile.gameSettings = {
      ...this.getGameSettings(),
      ...settings,
    };
    this.saveProfile(profile);

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: profile.id,
        settings: profile.gameSettings,
      }),
    }).catch((err) => console.warn('[ProfileService] Failed to sync settings to server:', err));

    return profile.gameSettings;
  }

  public updateSettings(settings: Partial<UserGameSettings>): UserGameSettings {
    return this.updateGameSettings(settings);
  }

  public saveProfile(profile: UserProfile): void {
    const normalized = this.normalizeProfile(profile);
    this.currentProfile = normalized;
    this.driver.saveProfile(normalized);
    this.notify();
  }

  /**
   * Idempotent match completion recorder.
   * Ensures games, XP, coins, and stats are credited ONCE and ONLY ONCE per match ID.
   */
  public recordGameCompletion(params: MatchCompletionParams): MatchCompletionResult {
    const profile = this.getProfile();

    // Idempotency verification: Never reward the same match twice!
    if (profile.processedMatchIds.includes(params.matchId)) {
      const rewards = calculateRewards(
        params.rank ?? (params.playerWon ? 1 : 2),
        params.captures,
        params.tokensFinished,
        profile.currentWinStreak
      );
      return {
        profile,
        rewards,
        isDuplicate: true,
        newAchievementsUnlocked: [],
        leveledUp: false,
        previousLevel: profile.level,
        newLevel: profile.level,
      };
    }

    // Append match ID to prevent duplicate recording
    profile.processedMatchIds.push(params.matchId);
    if (profile.processedMatchIds.length > 100) {
      profile.processedMatchIds.shift();
    }

    const previousLevel = profile.level;
    const rank = params.rank ?? (params.playerWon ? 1 : 2);
    const rewards = calculateRewards(rank, params.captures, params.tokensFinished, profile.currentWinStreak);

    // Update match count
    profile.totalGames += 1;
    profile.gamesPlayed = profile.totalGames;

    if (params.playerWon) {
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

    // Gameplay statistics
    profile.captures += params.captures;
    profile.tokensFinished += params.tokensFinished;
    if (params.matchScore > profile.highestScore) {
      profile.highestScore = params.matchScore;
    }
    profile.totalPlayTime += Math.max(0, Math.round(params.matchDurationSeconds || 0));

    // Award XP and Coins from real game events
    profile.xp += rewards.xpEarned;
    profile.coins += rewards.coinsEarned;
    profile.rating = Math.max(800, profile.rating + rewards.ratingChange);
    profile.rank = getRankTier(profile.rating);

    // Compute updated level
    const levelInfo = calculateLevel(profile.xp);
    profile.level = levelInfo.level;
    const leveledUp = profile.level > previousLevel;

    profile.lastPlayedAt = new Date().toISOString();

    // Check achievement completions & award their defined rewards
    const newAchievementsUnlocked = this.evaluateAchievements(profile, params);

    // Commit changes to persistent driver
    this.saveProfile(profile);

    // Also notify server backend to guarantee authoritative state persistence
    fetch('/api/matches/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: params.matchId,
        playerId: profile.id,
        rank,
        captures: params.captures,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.profile) {
          this.applyServerRewards({ matchId: params.matchId, profile: data.profile });
        }
      })
      .catch((err) => console.warn('[ProfileService] Server match reward dispatch offline:', err));

    return {
      profile,
      rewards,
      isDuplicate: false,
      newAchievementsUnlocked,
      leveledUp,
      previousLevel,
      newLevel: profile.level,
    };
  }

  private evaluateAchievements(profile: UserProfile, params: MatchCompletionParams): Achievement[] {
    const achievements = this.driver.loadAchievements();
    const newlyUnlocked: Achievement[] = [];
    let updated = false;

    for (const ach of achievements) {
      if (ach.unlocked) continue;

      if (ach.id === 'first_victory' && profile.wins >= 1) {
        ach.progress = 1;
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
        newlyUnlocked.push(ach);
        profile.coins += ach.rewardCoins;
        profile.xp += ach.rewardXp;
        updated = true;
      } else if (ach.id === 'first_capture' && profile.captures >= 1) {
        ach.progress = 1;
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
        newlyUnlocked.push(ach);
        profile.coins += ach.rewardCoins;
        profile.xp += ach.rewardXp;
        updated = true;
      } else if (ach.id === 'destroyer') {
        ach.progress = Math.min(ach.target, profile.captures);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
          newlyUnlocked.push(ach);
          profile.coins += ach.rewardCoins;
          profile.xp += ach.rewardXp;
        }
        updated = true;
      } else if (ach.id === 'ludo_master') {
        ach.progress = Math.min(ach.target, profile.wins);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
          newlyUnlocked.push(ach);
          profile.coins += ach.rewardCoins;
          profile.xp += ach.rewardXp;
        }
        updated = true;
      } else if (ach.id === 'champion') {
        ach.progress = Math.min(ach.target, profile.level);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
          newlyUnlocked.push(ach);
          profile.coins += ach.rewardCoins;
          profile.xp += ach.rewardXp;
        }
        updated = true;
      } else if (ach.id === 'speed_demon') {
        ach.progress = Math.min(ach.target, profile.tokensFinished);
        if (ach.progress >= ach.target) {
          ach.unlocked = true;
          ach.unlockedAt = new Date().toISOString();
          newlyUnlocked.push(ach);
          profile.coins += ach.rewardCoins;
          profile.xp += ach.rewardXp;
        }
        updated = true;
      }
    }

    if (updated) {
      this.driver.saveAchievements(achievements);
      profile.achievements = achievements;
    }

    return newlyUnlocked;
  }

  public getAchievements(): Achievement[] {
    return this.driver.loadAchievements();
  }

  public getGameHistory(): GameHistoryRecord[] {
    return this.driver.loadGameHistory();
  }

  public saveGameRecord(record: GameHistoryRecord): void {
    this.driver.saveGameRecord(record);
  }

  public subscribe(listener: (profile: UserProfile) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (this.currentProfile) {
      const copy = { ...this.currentProfile };
      this.listeners.forEach((l) => l(copy));
    }
  }
}

// Singleton Service Export
export const playerProfileService = new PlayerProfileService();
