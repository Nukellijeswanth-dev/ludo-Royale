import { PlayerColor } from '../types/gameTypes';

export interface TokenVisualSkin {
  gradient: string;
  bezel: string;
  glow: string;
  centerEmoji?: string;
  centerRing: string;
  centerDot: string;
}

export interface BoardVisualTheme {
  id: string;
  name: string;
  frameClass: string;
  gridClass: string;
  walkwayCommonClass: string;
  starSafeClass: string;
  finishAreaTint: string;
}

/**
 * Returns tactile gradient and bezel rendering properties for each token skin and player color.
 */
export function getTokenSkinStyle(skinId: string, color: PlayerColor): TokenVisualSkin {
  switch (skinId) {
    case 'golden':
      return {
        gradient: 'radial-gradient(circle at 35% 30%, #fffbeb 0%, #fef08a 25%, #eab308 55%, #a16207 85%, #451a03 100%)',
        bezel: 'border-yellow-200 shadow-[0_2px_12px_rgba(234,179,8,0.7)]',
        glow: 'shadow-[0_0_20px_rgba(250,204,21,0.9)]',
        centerEmoji: '👑',
        centerRing: 'border-yellow-100 bg-amber-950/50',
        centerDot: 'bg-yellow-200 shadow-[0_0_6px_rgba(255,255,255,1)]',
      };

    case 'neon': {
      const neonGradients: Record<PlayerColor, string> = {
        RED: 'radial-gradient(circle at 35% 30%, #fb7185 0%, #f43f5e 40%, #be123c 75%, #4c0519 100%)',
        GREEN: 'radial-gradient(circle at 35% 30%, #6ee7b7 0%, #10b981 40%, #047857 75%, #022c22 100%)',
        YELLOW: 'radial-gradient(circle at 35% 30%, #fde047 0%, #facc15 40%, #b45309 75%, #451a03 100%)',
        BLUE: 'radial-gradient(circle at 35% 30%, #38bdf8 0%, #0ea5e9 40%, #0369a1 75%, #082f49 100%)',
      };
      return {
        gradient: neonGradients[color],
        bezel: 'border-cyan-300 shadow-[0_2px_14px_rgba(6,182,212,0.85)]',
        glow: 'shadow-[0_0_22px_rgba(6,182,212,0.95)]',
        centerEmoji: '⚡',
        centerRing: 'border-cyan-200 bg-slate-950/60',
        centerDot: 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,1)]',
      };
    }

    case 'gemstone': {
      const gemGradients: Record<PlayerColor, string> = {
        RED: 'radial-gradient(circle at 30% 25%, #fda4af 0%, #e11d48 50%, #9f1239 80%, #4c0519 100%)',
        GREEN: 'radial-gradient(circle at 30% 25%, #a7f3d0 0%, #059669 50%, #047857 80%, #064e3b 100%)',
        YELLOW: 'radial-gradient(circle at 30% 25%, #fef08a 0%, #d97706 50%, #b45309 80%, #451a03 100%)',
        BLUE: 'radial-gradient(circle at 30% 25%, #bae6fd 0%, #2563eb 50%, #1d4ed8 80%, #172554 100%)',
      };
      return {
        gradient: gemGradients[color],
        bezel: 'border-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.7)]',
        glow: 'shadow-[0_0_20px_rgba(255,255,255,0.9)]',
        centerEmoji: '💎',
        centerRing: 'border-white/70 bg-black/40',
        centerDot: 'bg-white shadow-[0_0_6px_rgba(255,255,255,1)]',
      };
    }

    case 'obsidian': {
      const obsidianGradients: Record<PlayerColor, string> = {
        RED: 'radial-gradient(circle at 35% 30%, #64748b 0%, #334155 35%, #1e1b4b 70%, #020617 100%)',
        GREEN: 'radial-gradient(circle at 35% 30%, #64748b 0%, #334155 35%, #064e3b 70%, #020617 100%)',
        YELLOW: 'radial-gradient(circle at 35% 30%, #64748b 0%, #334155 35%, #713f12 70%, #020617 100%)',
        BLUE: 'radial-gradient(circle at 35% 30%, #64748b 0%, #334155 35%, #1e3a8a 70%, #020617 100%)',
      };
      return {
        gradient: obsidianGradients[color],
        bezel: 'border-purple-400 shadow-[0_2px_14px_rgba(192,132,252,0.65)]',
        glow: 'shadow-[0_0_20px_rgba(168,85,247,0.85)]',
        centerEmoji: '🔮',
        centerRing: 'border-purple-300/60 bg-black/60',
        centerDot: 'bg-purple-300 shadow-[0_0_6px_rgba(216,180,254,1)]',
      };
    }

    case 'pearl': {
      const pearlGradients: Record<PlayerColor, string> = {
        RED: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #ffe4e6 45%, #f43f5e 80%, #881337 100%)',
        GREEN: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #d1fae5 45%, #10b981 80%, #064e3b 100%)',
        YELLOW: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #fef9c3 45%, #eab308 80%, #713f12 100%)',
        BLUE: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #e0f2fe 45%, #0ea5e9 80%, #0c4a6e 100%)',
      };
      return {
        gradient: pearlGradients[color],
        bezel: 'border-slate-100 shadow-[0_2px_14px_rgba(241,245,249,0.7)]',
        glow: 'shadow-[0_0_20px_rgba(248,250,252,0.95)]',
        centerEmoji: '✨',
        centerRing: 'border-amber-200/80 bg-white/40',
        centerDot: 'bg-amber-100 shadow-[0_0_6px_rgba(255,255,255,1)]',
      };
    }

    // Default 'classic' skin
    default: {
      const classicGradients: Record<PlayerColor, string> = {
        RED: 'radial-gradient(circle at 35% 32%, #ff6b6b 0%, #dc2626 55%, #770b0b 100%)',
        GREEN: 'radial-gradient(circle at 35% 32%, #6ee7b7 0%, #16a34a 55%, #0d4a22 100%)',
        YELLOW: 'radial-gradient(circle at 35% 32%, #fde047 0%, #eab308 55%, #713f12 100%)',
        BLUE: 'radial-gradient(circle at 35% 32%, #7dd3fc 0%, #2563eb 55%, #172554 100%)',
      };
      const classicBezels: Record<PlayerColor, string> = {
        RED: 'border-amber-300/80 shadow-[0_2px_8px_rgba(224,36,36,0.5)]',
        GREEN: 'border-amber-300/80 shadow-[0_2px_8px_rgba(22,163,74,0.5)]',
        YELLOW: 'border-amber-300/90 shadow-[0_2px_8px_rgba(234,179,8,0.5)]',
        BLUE: 'border-amber-300/80 shadow-[0_2px_8px_rgba(37,99,235,0.5)]',
      };
      return {
        gradient: classicGradients[color],
        bezel: classicBezels[color],
        glow: 'shadow-[0_0_15px_rgba(251,191,36,0.8)]',
        centerRing: 'border-amber-200/50 bg-black/30',
        centerDot: 'bg-amber-100 shadow-[0_0_4px_rgba(255,255,255,0.9)]',
      };
    }
  }
}

/**
 * Returns aesthetic styling classes for the Ludo board frame and cells based on selected theme.
 */
export function getBoardThemeStyle(themeId: string): BoardVisualTheme {
  switch (themeId) {
    case 'midnight':
      return {
        id: 'midnight',
        name: 'Midnight Neon',
        frameClass:
          'bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950 border-2 border-cyan-400/50 shadow-[0_0_35px_rgba(6,182,212,0.3)]',
        gridClass: 'bg-[#080718] border-cyan-500/40',
        walkwayCommonClass: 'bg-purple-950/30 border-cyan-500/30 text-cyan-300',
        starSafeClass: 'bg-cyan-500/20 border-cyan-400/50 shadow-[inset_0_0_14px_rgba(6,182,212,0.35)]',
        finishAreaTint: 'bg-purple-950/80',
      };

    case 'marble':
      return {
        id: 'marble',
        name: 'Royal Marble',
        frameClass:
          'bg-gradient-to-b from-stone-800 via-stone-900 to-black border-2 border-amber-500/50 shadow-[0_12px_40px_rgba(0,0,0,0.85)]',
        gridClass: 'bg-stone-900 border-stone-600/60',
        walkwayCommonClass: 'bg-stone-800/60 border-stone-600/40 text-stone-200',
        starSafeClass: 'bg-amber-500/25 border-amber-400/60 shadow-[inset_0_0_12px_rgba(251,191,36,0.3)]',
        finishAreaTint: 'bg-stone-950/80',
      };

    case 'cyberpunk':
      return {
        id: 'cyberpunk',
        name: 'Cyberpunk Matrix',
        frameClass:
          'bg-gradient-to-b from-emerald-950 via-slate-950 to-black border-2 border-emerald-400/60 shadow-[0_0_35px_rgba(16,185,129,0.3)]',
        gridClass: 'bg-[#03150d] border-emerald-500/40',
        walkwayCommonClass: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300',
        starSafeClass: 'bg-emerald-500/25 border-emerald-400/60 shadow-[inset_0_0_14px_rgba(16,185,129,0.4)]',
        finishAreaTint: 'bg-emerald-950/90',
      };

    case 'desert':
      return {
        id: 'desert',
        name: 'Sunset Desert',
        frameClass:
          'bg-gradient-to-b from-amber-950 via-orange-950 to-black border-2 border-amber-500/50 shadow-[0_12px_40px_rgba(180,83,9,0.4)]',
        gridClass: 'bg-[#1a0f07] border-amber-700/50',
        walkwayCommonClass: 'bg-amber-950/40 border-amber-700/40 text-amber-200',
        starSafeClass: 'bg-amber-500/25 border-amber-400/60 shadow-[inset_0_0_14px_rgba(245,158,11,0.35)]',
        finishAreaTint: 'bg-amber-950/80',
      };

    // Default 'classic'
    default:
      return {
        id: 'classic',
        name: 'Classic Royale',
        frameClass:
          'bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-400/30 shadow-[0_12px_40px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.15)]',
        gridClass: 'bg-slate-950 border-slate-700/60',
        walkwayCommonClass: 'bg-slate-800/40 border-slate-700/40',
        starSafeClass: 'bg-amber-500/20 border-amber-400/40 shadow-[inset_0_0_12px_rgba(251,191,36,0.2)]',
        finishAreaTint: 'bg-slate-950/80',
      };
  }
}
