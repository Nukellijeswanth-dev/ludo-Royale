export interface GameEndRewards {
  xpEarned: number;
  coinsEarned: number;
  ratingChange: number;
  breakdown: {
    placement: { rank: number; xp: number; coins: number };
    captures: { count: number; xp: number; coins: number };
    tokensFinished: { count: number; xp: number; coins: number };
    streakBonus: { streak: number; xp: number; coins: number };
  };
}

export const SCORING_CONFIG = {
  COMPLETION_XP: 50,
  COMPLETION_COINS: 20,

  WIN_XP: 100,
  WIN_COINS: 50,
  SECOND_XP: 70,
  SECOND_COINS: 35,
  THIRD_XP: 50,
  THIRD_COINS: 25,
  FOURTH_XP: 30,
  FOURTH_COINS: 15,

  CAPTURE_XP: 10,
  CAPTURE_COINS: 5,

  TOKEN_HOME_XP: 25,
  TOKEN_HOME_COINS: 10,

  WIN_RATING_CHANGE: 25,
  LOSS_RATING_CHANGE: -10,
};

/**
 * Calculates XP, coins, and rating adjustment for a player at the end of a match.
 */
export function calculateRewards(
  rank: number, // 1, 2, 3, or 4
  captures: number,
  tokensFinished = 0,
  winStreak = 0
): GameEndRewards {
  let placementXp = SCORING_CONFIG.FOURTH_XP;
  let placementCoins = SCORING_CONFIG.FOURTH_COINS;

  if (rank === 1) {
    placementXp = SCORING_CONFIG.WIN_XP;
    placementCoins = SCORING_CONFIG.WIN_COINS;
  } else if (rank === 2) {
    placementXp = SCORING_CONFIG.SECOND_XP;
    placementCoins = SCORING_CONFIG.SECOND_COINS;
  } else if (rank === 3) {
    placementXp = SCORING_CONFIG.THIRD_XP;
    placementCoins = SCORING_CONFIG.THIRD_COINS;
  }

  const completionXp = SCORING_CONFIG.COMPLETION_XP;
  const completionCoins = SCORING_CONFIG.COMPLETION_COINS;

  const captureXp = captures * SCORING_CONFIG.CAPTURE_XP;
  const captureCoins = captures * SCORING_CONFIG.CAPTURE_COINS;

  const finishedXp = tokensFinished * SCORING_CONFIG.TOKEN_HOME_XP;
  const finishedCoins = tokensFinished * SCORING_CONFIG.TOKEN_HOME_COINS;

  const streakMultiplier = Math.min(winStreak, 5);
  const streakXp = rank === 1 ? streakMultiplier * 10 : 0;
  const streakCoins = rank === 1 ? streakMultiplier * 5 : 0;

  const totalXp = completionXp + placementXp + captureXp + finishedXp + streakXp;
  const totalCoins = completionCoins + placementCoins + captureCoins + finishedCoins + streakCoins;
  const ratingChange = rank === 1 ? SCORING_CONFIG.WIN_RATING_CHANGE : SCORING_CONFIG.LOSS_RATING_CHANGE;

  return {
    xpEarned: totalXp,
    coinsEarned: totalCoins,
    ratingChange,
    breakdown: {
      placement: { rank, xp: completionXp + placementXp, coins: completionCoins + placementCoins },
      captures: { count: captures, xp: captureXp, coins: captureCoins },
      tokensFinished: { count: tokensFinished, xp: finishedXp, coins: finishedCoins },
      streakBonus: { streak: winStreak, xp: streakXp, coins: streakCoins },
    },
  };
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  xpRequiredForNext: number;
  nextLevelXp: number; // backward compatibility alias
  progressPercent: number;
  totalXp: number;
  totalXpForNextLevel: number;
}

/**
 * Calculates level from total XP according to the prompt's progression:
 * Level 1: 0 XP
 * Level 2: 100 XP (+100)
 * Level 3: 250 XP (+150)
 * Level 4: 450 XP (+200)
 * Level 5: 700 XP (+250)
 * Level 6: 1000 XP (+300)
 * Level n: +50*(n)
 */
export function calculateLevel(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  let currentBase = 0;

  for (let lvl = 1; lvl <= 100; lvl++) {
    const step = 50 * (lvl + 1);
    const next = currentBase + step;
    if (safeXp < next) {
      const currentLevelXp = safeXp - currentBase;
      const progressPercent = Math.min(100, Math.round((currentLevelXp / step) * 100));
      return {
        level: lvl,
        currentLevelXp,
        xpRequiredForNext: step,
        nextLevelXp: next,
        progressPercent,
        totalXp: safeXp,
        totalXpForNextLevel: next,
      };
    }
    currentBase = next;
    level = lvl + 1;
  }

  return {
    level: 100,
    currentLevelXp: 0,
    xpRequiredForNext: 5000,
    nextLevelXp: currentBase + 5000,
    progressPercent: 100,
    totalXp: safeXp,
    totalXpForNextLevel: currentBase + 5000,
  };
}

export function getRankTier(rating: number): string {
  if (rating >= 2400) return 'Ludo Emperor';
  if (rating >= 2000) return 'Grandmaster';
  if (rating >= 1800) return 'Royale Champion';
  if (rating >= 1500) return 'Knight Master';
  if (rating >= 1200) return 'Warrior';
  return 'Apprentice';
}
