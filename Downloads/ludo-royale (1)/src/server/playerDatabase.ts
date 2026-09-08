import fs from 'fs';
import path from 'path';
import {
  BUILTIN_AVATARS,
  TOKEN_SKINS_CATALOG,
  BOARD_THEMES_CATALOG,
  CustomizationItem,
  UserGameSettings,
} from '../types/customizationTypes';

export interface PlayerProfile {
  playerId: string;
  id: string; // compatibility
  displayName: string;
  username: string; // compatibility
  name: string; // compatibility
  email?: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  gamesPlayed: number;
  totalGames: number; // compatibility
  gamesWon: number;
  wins: number; // compatibility
  gamesLost: number;
  losses: number; // compatibility
  totalCaptures: number;
  captures: number; // compatibility
  winRate: number; // e.g. 42.9
  winPercentage?: number; // compatibility
  tokensFinished?: number;
  highestScore?: number;
  currentWinStreak?: number;
  winStreak?: number;
  bestWinStreak?: number;
  bestStreak?: number;
  totalPlayTime?: number;
  rating?: number;
  rank?: string;
  unlockedAvatars: string[];
  selectedAvatar: string;
  unlockedTokenSkins: string[];
  selectedTokenSkin: string;
  unlockedThemes: string[];
  selectedTheme: string;
  gameSettings?: UserGameSettings;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
}

export interface LeaderboardEntry {
  id: string;
  playerId: string;
  rank: number;
  name: string;
  displayName: string;
  avatar: string;
  level: number;
  value: number;
  displayValue: string;
  wins: number;
  xp: number;
  coins: number;
  captures: number;
  winRate: number;
  rating: number;
}

export interface MatchPlayerResult {
  playerId: string;
  rank: number; // 1, 2, 3, 4
  captures: number;
}

export interface RewardResult {
  rewarded: boolean;
  xpEarned: number;
  coinsEarned: number;
  ratingDelta: number;
  newRating: number;
  rank: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  profile: PlayerProfile;
}

// Level thresholds progression matching prompt:
// Level 1: 0 XP
// Level 2: 100 XP (+100)
// Level 3: 250 XP (+150)
// Level 4: 450 XP (+200)
// Level 5: 700 XP (+250)
// Level 6: 1000 XP (+300)
// Level n: +50*n
export function calculateLevelFromXp(xp: number): {
  level: number;
  currentLevelBaseXp: number;
  nextLevelXp: number;
  xpInLevel: number;
  xpNeededForLevel: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  let currentBase = 0;

  for (let lvl = 1; lvl <= 100; lvl++) {
    const step = 50 * (lvl + 1);
    const next = currentBase + step;
    if (safeXp < next) {
      const xpInLevel = safeXp - currentBase;
      const xpNeededForLevel = step;
      const progressPercent = Math.min(100, Math.round((xpInLevel / xpNeededForLevel) * 100));
      return {
        level: lvl,
        currentLevelBaseXp: currentBase,
        nextLevelXp: next,
        xpInLevel,
        xpNeededForLevel,
        progressPercent,
      };
    }
    currentBase = next;
    level = lvl + 1;
  }

  return {
    level: 100,
    currentLevelBaseXp: currentBase,
    nextLevelXp: currentBase + 5000,
    xpInLevel: 0,
    xpNeededForLevel: 5000,
    progressPercent: 100,
  };
}

export class PlayerDatabase {
  private dataDir: string;
  private profilesFile: string;
  private rewardsFile: string;
  private profiles: Map<string, PlayerProfile> = new Map();
  private processedRewards: Set<string> = new Set();
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.profilesFile = path.join(dataDir, 'profiles.json');
    this.rewardsFile = path.join(dataDir, 'processed_rewards.json');
    this.init();
  }

  private init(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Load processed reward keys
      if (fs.existsSync(this.rewardsFile)) {
        const raw = fs.readFileSync(this.rewardsFile, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.processedRewards = new Set(list);
        }
      }

      // Load profiles
      if (fs.existsSync(this.profilesFile)) {
        const raw = fs.readFileSync(this.profilesFile, 'utf-8');
        const list: PlayerProfile[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const p of list) {
            this.normalizeProfileRecord(p);
            this.profiles.set(p.playerId, p);
          }
        }
      }

      // Seed initial players if profiles are empty
      if (this.profiles.size === 0) {
        this.seedInitialProfiles();
      }
    } catch (err) {
      console.error('Error initializing PlayerDatabase:', err);
      this.seedInitialProfiles();
    }
  }

  private seedInitialProfiles(): void {
    const seeds: Partial<PlayerProfile>[] = [
      {
        playerId: 'usr_jeswanth_1',
        displayName: 'Jeswanth',
        avatar: '👑',
        level: 5,
        xp: 820,
        coins: 2450,
        gamesPlayed: 42,
        gamesWon: 18,
        gamesLost: 24,
        totalCaptures: 67,
        winRate: 42.9,
        rating: 1842,
        rank: 'Royale Champion',
      },
      {
        playerId: 'usr_aria_2',
        displayName: 'Aria Valkyrie',
        avatar: '⚡',
        level: 8,
        xp: 1850,
        coins: 4200,
        gamesPlayed: 76,
        gamesWon: 41,
        gamesLost: 35,
        totalCaptures: 112,
        winRate: 53.9,
        rating: 1920,
        rank: 'Grandmaster',
      },
      {
        playerId: 'usr_phoenix_3',
        displayName: 'Phoenix King',
        avatar: '🔥',
        level: 7,
        xp: 1420,
        coins: 3100,
        gamesPlayed: 58,
        gamesWon: 30,
        gamesLost: 28,
        totalCaptures: 88,
        winRate: 51.7,
        rating: 1780,
        rank: 'Royale Champion',
      },
      {
        playerId: 'usr_cyber_4',
        displayName: 'Cyber Knight',
        avatar: '🤖',
        level: 6,
        xp: 1150,
        coins: 2600,
        gamesPlayed: 49,
        gamesWon: 24,
        gamesLost: 25,
        totalCaptures: 73,
        winRate: 49.0,
        rating: 1690,
        rank: 'Knight Master',
      },
      {
        playerId: 'usr_mystic_5',
        displayName: 'Luna Mystic',
        avatar: '🎮',
        level: 5,
        xp: 910,
        coins: 2150,
        gamesPlayed: 39,
        gamesWon: 19,
        gamesLost: 20,
        totalCaptures: 58,
        winRate: 48.7,
        rating: 1640,
        rank: 'Knight Master',
      },
      {
        playerId: 'usr_shadow_6',
        displayName: 'Shadow Strike',
        avatar: '🦁',
        level: 4,
        xp: 620,
        coins: 1650,
        gamesPlayed: 31,
        gamesWon: 14,
        gamesLost: 17,
        totalCaptures: 46,
        winRate: 45.2,
        rating: 1580,
        rank: 'Knight Master',
      },
      {
        playerId: 'usr_dragon_7',
        displayName: 'Dragon Claw',
        avatar: '🐯',
        level: 3,
        xp: 380,
        coins: 1100,
        gamesPlayed: 22,
        gamesWon: 9,
        gamesLost: 13,
        totalCaptures: 32,
        winRate: 40.9,
        rating: 1510,
        rank: 'Warrior',
      },
    ];

    const now = new Date().toISOString();
    for (const seed of seeds) {
      const p = this.createProfileRecord({
        playerId: seed.playerId!,
        displayName: seed.displayName || 'Player',
        avatar: seed.avatar || '👑',
        level: seed.level || 1,
        xp: seed.xp || 0,
        coins: seed.coins || 0,
        gamesPlayed: seed.gamesPlayed || 0,
        gamesWon: seed.gamesWon || 0,
        gamesLost: seed.gamesLost || 0,
        totalCaptures: seed.totalCaptures || 0,
        winRate: seed.winRate || 0,
        rating: seed.rating || 1500,
        rank: seed.rank || 'Warrior',
        createdAt: now,
        updatedAt: now,
      });
      this.profiles.set(p.playerId, p);
    }
    this.saveToDisk();
  }

  private createProfileRecord(params: {
    playerId: string;
    displayName: string;
    avatar: string;
    email?: string;
    level?: number;
    xp?: number;
    coins?: number;
    gamesPlayed?: number;
    gamesWon?: number;
    gamesLost?: number;
    totalCaptures?: number;
    winRate?: number;
    rating?: number;
    rank?: string;
    createdAt?: string;
    updatedAt?: string;
    lastActiveAt?: string;
  }): PlayerProfile {
    const now = new Date().toISOString();
    const cleanName = (params.displayName || 'Player').trim().substring(0, 20);
    const xp = Math.max(0, params.xp || 0);
    const lvl = params.level ?? calculateLevelFromXp(xp).level;
    const played = Math.max(0, params.gamesPlayed || 0);
    const won = Math.max(0, params.gamesWon || 0);
    const lost = Math.max(0, params.gamesLost || (played - won >= 0 ? played - won : 0));
    const winRate =
      played > 0 ? parseFloat(((won / played) * 100).toFixed(1)) : (params.winRate ?? 0);
    const captures = Math.max(0, params.totalCaptures || 0);

    return {
      playerId: params.playerId,
      id: params.playerId,
      displayName: cleanName,
      username: cleanName,
      name: cleanName,
      email: params.email,
      avatar: params.avatar || '👑',
      level: lvl,
      xp,
      coins: Math.max(0, params.coins ?? 1000),
      gamesPlayed: played,
      totalGames: played,
      gamesWon: won,
      wins: won,
      gamesLost: lost,
      losses: lost,
      totalCaptures: captures,
      captures,
      winRate,
      winPercentage: winRate,
      tokensFinished: 0,
      highestScore: 0,
      currentWinStreak: 0,
      winStreak: 0,
      bestWinStreak: 0,
      bestStreak: 0,
      totalPlayTime: 0,
      rating: typeof params.rating === 'number' ? params.rating : 1200,
      rank: params.rank || 'Warrior',
      unlockedAvatars: [...BUILTIN_AVATARS],
      selectedAvatar: params.avatar || '👑',
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
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      lastActiveAt: params.lastActiveAt || now,
    };
  }

  public normalizeProfileRecord(p: PlayerProfile): void {
    if (!Array.isArray(p.unlockedAvatars) || p.unlockedAvatars.length === 0) {
      p.unlockedAvatars = [...BUILTIN_AVATARS];
    }
    p.selectedAvatar = p.selectedAvatar || p.avatar || '👑';
    p.avatar = p.selectedAvatar;
    if (typeof p.rating !== 'number') {
      p.rating = 1200;
    }
    if (typeof p.winPercentage !== 'number') {
      p.winPercentage = p.winRate ?? 0;
    }
    if (!p.lastActiveAt) {
      p.lastActiveAt = p.updatedAt || p.createdAt || new Date().toISOString();
    }
    if (!Array.isArray(p.unlockedTokenSkins) || p.unlockedTokenSkins.length === 0) {
      p.unlockedTokenSkins = ['classic'];
    }
    p.selectedTokenSkin = p.selectedTokenSkin || 'classic';
    if (!Array.isArray(p.unlockedThemes) || p.unlockedThemes.length === 0) {
      p.unlockedThemes = ['classic'];
    }
    p.selectedTheme = p.selectedTheme || 'classic';
    if (!p.gameSettings) {
      p.gameSettings = {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        animationsEnabled: true,
        notificationsEnabled: true,
      };
    }
  }

  public getProfile(playerId: string): PlayerProfile | null {
    if (!playerId) return null;
    return this.profiles.get(playerId) || null;
  }

  public getAllProfiles(): PlayerProfile[] {
    return Array.from(this.profiles.values());
  }

  public getOrCreateProfile(params: {
    playerId: string;
    displayName?: string;
    avatar?: string;
    email?: string;
  }): PlayerProfile {
    const existing = this.profiles.get(params.playerId);
    if (existing) {
      let changed = false;
      if (params.email && !existing.email) {
        existing.email = params.email;
        changed = true;
      }
      existing.lastActiveAt = new Date().toISOString();
      if (changed) this.scheduleSave();
      return existing;
    }

    const newProfile = this.createProfileRecord({
      playerId: params.playerId,
      displayName: params.displayName || 'Player',
      avatar: params.avatar || '👑',
      email: params.email,
      level: 1,
      xp: 0,
      coins: 1000, // starting coins (Req 14)
      rating: 1200, // starting rating (Req 14)
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      totalCaptures: 0,
      winRate: 0,
    });

    this.profiles.set(newProfile.playerId, newProfile);
    this.scheduleSave();
    return newProfile;
  }

  public updateProfile(
    playerId: string,
    updates: {
      displayName?: string;
      avatar?: string;
      selectedTokenSkin?: string;
      selectedTheme?: string;
      gameSettings?: Partial<UserGameSettings>;
      lastActiveAt?: string;
    }
  ): PlayerProfile | null {
    const profile = this.profiles.get(playerId);
    if (!profile) return null;

    let changed = false;
    if (updates.displayName && typeof updates.displayName === 'string') {
      const clean = updates.displayName.trim().substring(0, 20);
      if (clean && clean !== profile.displayName) {
        profile.displayName = clean;
        profile.username = clean;
        profile.name = clean;
        changed = true;
      }
    }

    if (updates.avatar && typeof updates.avatar === 'string') {
      const clean = updates.avatar.trim();
      if (clean && clean !== profile.avatar) {
        profile.avatar = clean;
        profile.selectedAvatar = clean;
        changed = true;
      }
    }

    if (updates.selectedTokenSkin && typeof updates.selectedTokenSkin === 'string') {
      if (profile.unlockedTokenSkins?.includes(updates.selectedTokenSkin)) {
        profile.selectedTokenSkin = updates.selectedTokenSkin;
        changed = true;
      }
    }

    if (updates.selectedTheme && typeof updates.selectedTheme === 'string') {
      if (profile.unlockedThemes?.includes(updates.selectedTheme)) {
        profile.selectedTheme = updates.selectedTheme;
        changed = true;
      }
    }

    if (updates.gameSettings && typeof updates.gameSettings === 'object') {
      profile.gameSettings = {
        ...(profile.gameSettings || {
          soundEnabled: true,
          musicEnabled: true,
          vibrationEnabled: true,
          animationsEnabled: true,
          notificationsEnabled: true,
        }),
        ...updates.gameSettings,
      };
      changed = true;
    }

    if (updates.lastActiveAt) {
      profile.lastActiveAt = updates.lastActiveAt;
      changed = true;
    }

    if (changed) {
      profile.updatedAt = new Date().toISOString();
      this.scheduleSave();
    }

    return profile;
  }

  /**
   * Server-authoritative match reward processing with duplicate protection.
   * Reward Identifier: matchId + '_' + playerId
   */
  public processSingleMatchReward(params: {
    matchId: string;
    playerId: string;
    rank: number; // 1 = Winner, 2, 3, 4
    captures: number;
    totalPlayers?: number;
  }): RewardResult {
    const profile = this.getOrCreateProfile({ playerId: params.playerId });
    const rewardKey = `${params.matchId}_${params.playerId}`;

    // Duplicate Reward Protection
    if (this.processedRewards.has(rewardKey)) {
      return {
        rewarded: false,
        xpEarned: 0,
        coinsEarned: 0,
        ratingDelta: 0,
        newRating: typeof profile.rating === 'number' ? profile.rating : 1000,
        rank: params.rank,
        previousLevel: profile.level,
        newLevel: profile.level,
        leveledUp: false,
        profile,
      };
    }

    const rank = Math.min(4, Math.max(1, params.rank || 4));
    const captures = Math.max(0, Math.min(20, params.captures || 0));
    const totalParticipants = Math.max(2, Math.min(4, params.totalPlayers || 4));

    // Server-Authoritative Reward Calculation
    // XP: Game completed (+50), Placement (1st: +100, 2nd: +70, 3rd: +50, 4th: +30), Capture (+10 each)
    let placementXp = 30;
    if (rank === 1) placementXp = 100;
    else if (rank === 2) placementXp = 70;
    else if (rank === 3) placementXp = 50;

    const completionXp = 50;
    const captureXp = captures * 10;
    const totalXp = completionXp + placementXp + captureXp;

    // Coins: Game completed (+20), Placement (1st: +50, 2nd: +35, 3rd: +25, 4th: +15), Capture (+5 each)
    let placementCoins = 15;
    if (rank === 1) placementCoins = 50;
    else if (rank === 2) placementCoins = 35;
    else if (rank === 3) placementCoins = 25;

    const completionCoins = 20;
    const captureCoins = captures * 5;
    const totalCoins = completionCoins + placementCoins + captureCoins;

    // Server-Authoritative Matchmaking Rating (Separate from XP and Coins)
    // Section 9 Specifications:
    // 2-player game: Winner +20, Loser -15
    // 4-player game: Winner +25, 2nd +10, 3rd -5, 4th -15
    // 3-player game: Winner +20, 2nd +5, 3rd -10
    let ratingDelta = 0;
    if (totalParticipants === 2) {
      ratingDelta = rank === 1 ? 20 : -15;
    } else if (totalParticipants === 3) {
      if (rank === 1) ratingDelta = 20;
      else if (rank === 2) ratingDelta = 5;
      else ratingDelta = -10;
    } else {
      if (rank === 1) ratingDelta = 25;
      else if (rank === 2) ratingDelta = 10;
      else if (rank === 3) ratingDelta = -5;
      else ratingDelta = -15;
    }

    const currentRating = typeof profile.rating === 'number' ? profile.rating : 1000;
    profile.rating = Math.max(100, currentRating + ratingDelta);

    const previousLevel = profile.level;
    profile.xp += totalXp;
    profile.coins += totalCoins;
    profile.gamesPlayed += 1;
    profile.totalGames = profile.gamesPlayed;

    if (rank === 1) {
      profile.gamesWon += 1;
      profile.wins = profile.gamesWon;
      profile.currentWinStreak = (profile.currentWinStreak || 0) + 1;
      profile.winStreak = profile.currentWinStreak;
      if (profile.currentWinStreak > (profile.bestWinStreak || 0)) {
        profile.bestWinStreak = profile.currentWinStreak;
        profile.bestStreak = profile.currentWinStreak;
      }
    } else {
      profile.gamesLost += 1;
      profile.losses = profile.gamesLost;
      profile.currentWinStreak = 0;
      profile.winStreak = 0;
    }

    profile.totalCaptures += captures;
    profile.captures = profile.totalCaptures;
    profile.winRate = parseFloat(((profile.gamesWon / profile.gamesPlayed) * 100).toFixed(1));

    const levelInfo = calculateLevelFromXp(profile.xp);
    profile.level = levelInfo.level;
    profile.updatedAt = new Date().toISOString();

    const leveledUp = profile.level > previousLevel;

    // Record processed reward key
    this.processedRewards.add(rewardKey);
    this.scheduleSave();

    return {
      rewarded: true,
      xpEarned: totalXp,
      coinsEarned: totalCoins,
      ratingDelta,
      newRating: profile.rating,
      rank,
      previousLevel,
      newLevel: profile.level,
      leveledUp,
      profile,
    };
  }

  /**
   * Process all match participants at the end of an authoritative online game.
   */
  public processMatchRewards(
    matchId: string,
    results: MatchPlayerResult[]
  ): Record<string, RewardResult> {
    const outcome: Record<string, RewardResult> = {};
    for (const res of results) {
      outcome[res.playerId] = this.processSingleMatchReward({
        matchId,
        playerId: res.playerId,
        rank: res.rank,
        captures: res.captures,
        totalPlayers: results.length,
      });
    }
    return outcome;
  }

  /**
   * Leaderboard calculation based on category.
   * Efficiently queries top entries and computes current user's rank.
   */
  public getLeaderboard(
    category: 'wins' | 'xp' | 'coins' | 'captures' | 'rating' = 'wins',
    limit = 50,
    currentUserId?: string
  ): {
    category: 'wins' | 'xp' | 'coins' | 'captures' | 'rating';
    entries: LeaderboardEntry[];
    myRank?: {
      rank: number;
      value: number;
      displayValue: string;
      xp: number;
      wins: number;
      coins: number;
      captures: number;
      rating?: number;
    };
  } {
    const allProfiles = Array.from(this.profiles.values());

    // Sort by selected metric descending
    allProfiles.sort((a, b) => {
      if (category === 'wins') {
        const diff = b.gamesWon - a.gamesWon;
        return diff !== 0 ? diff : b.xp - a.xp;
      }
      if (category === 'xp') {
        const diff = b.xp - a.xp;
        return diff !== 0 ? diff : b.gamesWon - a.gamesWon;
      }
      if (category === 'coins') {
        const diff = b.coins - a.coins;
        return diff !== 0 ? diff : b.xp - a.xp;
      }
      if (category === 'captures') {
        const diff = b.totalCaptures - a.totalCaptures;
        return diff !== 0 ? diff : b.xp - a.xp;
      }
      if (category === 'rating') {
        const diff = (b.rating ?? 1200) - (a.rating ?? 1200);
        return diff !== 0 ? diff : b.gamesWon - a.gamesWon;
      }
      return 0;
    });

    const getVal = (p: PlayerProfile): { val: number; str: string } => {
      if (category === 'wins') return { val: p.gamesWon, str: `${p.gamesWon} Wins` };
      if (category === 'xp') return { val: p.xp, str: `${p.xp.toLocaleString()} XP` };
      if (category === 'coins') return { val: p.coins, str: `${p.coins.toLocaleString()} Coins` };
      if (category === 'rating') return { val: p.rating ?? 1200, str: `${p.rating ?? 1200} Rating` };
      return { val: p.totalCaptures, str: `${p.totalCaptures} Captures` };
    };

    const entries: LeaderboardEntry[] = allProfiles.slice(0, Math.min(100, Math.max(1, limit))).map((p, idx) => {
      const v = getVal(p);
      return {
        id: p.playerId,
        playerId: p.playerId,
        rank: idx + 1,
        name: p.displayName,
        displayName: p.displayName,
        avatar: p.avatar,
        level: p.level,
        value: v.val,
        displayValue: v.str,
        wins: p.gamesWon,
        xp: p.xp,
        coins: p.coins,
        captures: p.totalCaptures,
        winRate: p.winRate,
        rating: p.rating || 1500,
      };
    });

    let myRank: {
      rank: number;
      value: number;
      displayValue: string;
      xp: number;
      wins: number;
      coins: number;
      captures: number;
      rating?: number;
    } | undefined = undefined;

    if (currentUserId) {
      const userIndex = allProfiles.findIndex((p) => p.playerId === currentUserId);
      if (userIndex !== -1) {
        const userProfile = allProfiles[userIndex];
        const v = getVal(userProfile);
        myRank = {
          rank: userIndex + 1,
          value: v.val,
          displayValue: v.str,
          xp: userProfile.xp,
          wins: userProfile.gamesWon,
          coins: userProfile.coins,
          captures: userProfile.totalCaptures,
          rating: userProfile.rating ?? 1200,
        };
      }
    }

    return {
      category,
      entries,
      myRank,
    };
  }

  public purchaseCustomizationItem(
    playerId: string,
    itemId: string,
    itemType: 'TOKEN_SKIN' | 'BOARD_THEME' | 'AVATAR'
  ): {
    success: boolean;
    error?: string;
    message?: string;
    profile?: PlayerProfile;
    item?: CustomizationItem;
  } {
    const profile = this.profiles.get(playerId);
    if (!profile) {
      return { success: false, error: 'Player profile not found' };
    }
    this.normalizeProfileRecord(profile);

    let item: CustomizationItem | undefined;
    if (itemType === 'TOKEN_SKIN') {
      item = TOKEN_SKINS_CATALOG.find((s) => s.id === itemId);
    } else if (itemType === 'BOARD_THEME') {
      item = BOARD_THEMES_CATALOG.find((t) => t.id === itemId);
    } else {
      return { success: false, error: 'Invalid customization item type' };
    }

    if (!item) {
      return { success: false, error: 'Item not found in catalog' };
    }

    if (item.price < 0) {
      return { success: false, error: 'Invalid item price' };
    }

    // Check ownership
    const isOwned =
      itemType === 'TOKEN_SKIN'
        ? profile.unlockedTokenSkins.includes(item.id)
        : profile.unlockedThemes.includes(item.id);

    if (isOwned) {
      return { success: false, error: 'Item is already owned' };
    }

    // Verify balance
    if (profile.coins < item.price) {
      return {
        success: false,
        error: `Insufficient coins. Required: 🪙 ${item.price}, Available: 🪙 ${profile.coins}`,
      };
    }

    // Deduct coins atomically
    profile.coins = Math.max(0, profile.coins - item.price);

    // Add to unlocked items
    if (itemType === 'TOKEN_SKIN') {
      profile.unlockedTokenSkins.push(item.id);
      profile.selectedTokenSkin = item.id;
    } else if (itemType === 'BOARD_THEME') {
      profile.unlockedThemes.push(item.id);
      profile.selectedTheme = item.id;
    }

    profile.updatedAt = new Date().toISOString();
    this.scheduleSave();

    return {
      success: true,
      message: `Successfully purchased ${item.name}!`,
      profile,
      item,
    };
  }

  public selectCustomizationItem(
    playerId: string,
    itemType: 'AVATAR' | 'TOKEN_SKIN' | 'BOARD_THEME',
    itemId: string
  ): {
    success: boolean;
    error?: string;
    profile?: PlayerProfile;
  } {
    const profile = this.profiles.get(playerId);
    if (!profile) {
      return { success: false, error: 'Player profile not found' };
    }
    this.normalizeProfileRecord(profile);

    if (itemType === 'AVATAR') {
      // Must be a built-in avatar or in unlockedAvatars
      if (!BUILTIN_AVATARS.includes(itemId) && !profile.unlockedAvatars.includes(itemId)) {
        return { success: false, error: 'Avatar not unlocked' };
      }
      profile.selectedAvatar = itemId;
      profile.avatar = itemId;
    } else if (itemType === 'TOKEN_SKIN') {
      if (!profile.unlockedTokenSkins.includes(itemId)) {
        return { success: false, error: 'Token skin not unlocked' };
      }
      profile.selectedTokenSkin = itemId;
    } else if (itemType === 'BOARD_THEME') {
      if (!profile.unlockedThemes.includes(itemId)) {
        return { success: false, error: 'Board theme not unlocked' };
      }
      profile.selectedTheme = itemId;
    } else {
      return { success: false, error: 'Invalid customization type' };
    }

    profile.updatedAt = new Date().toISOString();
    this.scheduleSave();
    return { success: true, profile };
  }

  public updateGameSettings(
    playerId: string,
    settings: Partial<UserGameSettings>
  ): {
    success: boolean;
    error?: string;
    gameSettings?: UserGameSettings;
  } {
    const profile = this.profiles.get(playerId);
    if (!profile) {
      return { success: false, error: 'Player profile not found' };
    }
    this.normalizeProfileRecord(profile);

    profile.gameSettings = {
      ...profile.gameSettings!,
      ...settings,
    };
    profile.updatedAt = new Date().toISOString();
    this.scheduleSave();

    return { success: true, gameSettings: profile.gameSettings };
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) return;
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      this.saveToDisk();
    }, 200);
  }

  public saveToDisk(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Save profiles atomically
      const profilesArray = Array.from(this.profiles.values());
      const tempProfiles = `${this.profilesFile}.tmp`;
      fs.writeFileSync(tempProfiles, JSON.stringify(profilesArray, null, 2), 'utf-8');
      fs.renameSync(tempProfiles, this.profilesFile);

      // Save processed rewards atomically
      const rewardsArray = Array.from(this.processedRewards.values());
      const tempRewards = `${this.rewardsFile}.tmp`;
      fs.writeFileSync(tempRewards, JSON.stringify(rewardsArray, null, 2), 'utf-8');
      fs.renameSync(tempRewards, this.rewardsFile);
    } catch (err) {
      console.error('Failed to save player database to disk:', err);
    }
  }
}

export const playerDb = new PlayerDatabase();
