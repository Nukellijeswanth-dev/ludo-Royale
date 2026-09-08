import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Users, Clock, X, Shield, Sparkles, Trophy, CheckCircle2, Zap } from 'lucide-react';
import { MatchmakingState, roomService } from '../../services/roomService';
import { Avatar } from '../common/Avatar';
import { PlayerColor } from '../../types/gameTypes';

interface MatchmakingOverlayProps {
  state: MatchmakingState;
  onCancel: () => void;
}

const COLOR_BADGES: Record<PlayerColor, { name: string; bg: string; border: string; text: string; dot: string; emoji: string }> = {
  RED: {
    name: 'Red',
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/50',
    text: 'text-rose-400',
    dot: 'bg-rose-500',
    emoji: '🔴',
  },
  GREEN: {
    name: 'Green',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    emoji: '🟢',
  },
  YELLOW: {
    name: 'Yellow',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    emoji: '🟡',
  },
  BLUE: {
    name: 'Blue',
    bg: 'bg-sky-500/20',
    border: 'border-sky-500/50',
    text: 'text-sky-400',
    dot: 'bg-sky-500',
    emoji: '🔵',
  },
};

export const MatchmakingOverlay: React.FC<MatchmakingOverlayProps> = ({ state, onCancel }) => {
  const [localCountdown, setLocalCountdown] = useState<number>(state.countdown || 3);

  // Sync and tick local countdown if matched
  useEffect(() => {
    if (state.status === 'MATCHED') {
      setLocalCountdown(state.countdown || 3);
      const timer = setInterval(() => {
        setLocalCountdown((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.status, state.countdown]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isMatched = state.status === 'MATCHED';
  const playersCount = state.playersCount || (state.matchedPlayers ? state.matchedPlayers.length : 1);
  const targetCount = state.targetCount || 4;
  const matchedList = state.matchedPlayers || [];

  return (
    <div
      id="matchmaking-overlay"
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
      >
        {/* Subtle background ambient glow */}
        <div
          className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
            isMatched ? 'bg-emerald-500/15' : 'bg-sky-500/15'
          }`}
        />
        <div
          className={`absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
            isMatched ? 'bg-amber-500/15' : 'bg-indigo-500/15'
          }`}
        />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-widest text-sky-400 font-mono">
              ONLINE MULTIPLAYER
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-bold text-slate-300">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>100% REAL PLAYERS</span>
          </div>
        </div>

        {/* Center Section: Searching vs Matched */}
        <AnimatePresence mode="wait">
          {!isMatched ? (
            <motion.div
              key="searching-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full flex flex-col items-center relative z-10"
            >
              {/* Radar Pulsing Rings Animation */}
              <div className="relative w-32 h-32 my-3 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-sky-500/20 animate-ping opacity-60 pointer-events-none" />
                <div className="absolute -inset-4 rounded-full border border-sky-500/10 animate-pulse pointer-events-none" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-sky-600/30 via-sky-500/20 to-indigo-600/30 border border-sky-400/40 flex items-center justify-center shadow-xl shadow-sky-500/15 relative">
                  <Search className="w-10 h-10 text-sky-300 animate-bounce" />
                </div>
              </div>

              {/* Title & Status */}
              <h2 className="text-2xl font-black font-display text-white tracking-wide mt-1">
                QUICK MATCH
              </h2>
              <div className="text-sm font-semibold text-sky-400 flex items-center gap-1.5 mt-1">
                <span>Finding Players</span>
                <span className="inline-flex tracking-widest animate-pulse">...</span>
              </div>

              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Searching real online challengers across the global queue.
              </p>

              {/* Players Found Card */}
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 my-5 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    Players Found
                  </span>
                  <span className="font-mono font-black text-white text-base">
                    <span className="text-sky-400">{playersCount}</span> / {targetCount}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (playersCount / targetCount) * 100)}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                {/* Real Players in Queue List */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {Array.from({ length: targetCount }).map((_, idx) => {
                    const player = matchedList[idx];
                    if (player) {
                      return (
                        <div
                          key={player.playerId || idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 text-left"
                        >
                          <Avatar avatar={player.avatar || '👑'} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">
                              {player.displayName || player.name || 'Player'}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span className="text-sky-400 font-bold">Lv.{player.level || 1}</span>
                              <span>•</span>
                              <span>⭐ {player.rating || 1000}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`empty_${idx}`}
                        className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-left animate-pulse"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-600 text-xs">
                          ?
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-slate-500">Searching...</div>
                          <div className="text-[9px] text-slate-600">Waiting for slot</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Timer Info */}
                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Estimated Wait:</span>
                  </div>
                  <span className="font-mono font-bold text-slate-200">
                    {formatTimer(state.estimatedWaitSeconds || 8)}
                  </span>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                id="cancel-matchmaking-button"
                type="button"
                onClick={onCancel}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-98 border border-slate-700/80 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>CANCEL MATCHMAKING</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="matched-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center relative z-10"
            >
              {/* Match Found Banner */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-2xl shadow-emerald-500/30 mb-3 animate-bounce">
                <Sparkles className="w-10 h-10 fill-current" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-wide">
                MATCH FOUND! 🎉
              </h2>

              <div className="mt-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest">
                {playersCount} PLAYERS ASSEMBLED
              </div>

              {/* Matched Players Roster */}
              <div className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 my-5 flex flex-col gap-2.5">
                <div className="text-[11px] uppercase font-bold text-slate-400 text-left flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Opponents Ready
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchedList.map((p, idx) => {
                    const colorKey = p.color || (['RED', 'GREEN', 'YELLOW', 'BLUE'][idx] as PlayerColor);
                    const badge = COLOR_BADGES[colorKey] || COLOR_BADGES.RED;
                    return (
                      <div
                        key={p.playerId || idx}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${badge.bg} ${badge.border} text-left`}
                      >
                        <div className="relative">
                          <Avatar avatar={p.avatar || '👑'} size="sm" />
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ${badge.dot} border border-slate-900 flex items-center justify-center text-[8px]`}
                          >
                            ✓
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                            <span>{p.displayName || p.name}</span>
                            {idx === 0 && <span className="text-[10px] text-amber-300">👑</span>}
                          </div>
                          <div className="text-[10px] text-slate-300 flex items-center gap-1.5">
                            <span className={`font-bold ${badge.text}`}>{badge.name}</span>
                            <span>•</span>
                            <span className="text-slate-400 font-mono">⭐ {p.rating || 1000}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3-2-1 Countdown Indicator */}
              <div className="flex flex-col items-center justify-center my-2">
                <motion.div
                  key={localCountdown}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-display font-black text-3xl flex items-center justify-center shadow-lg shadow-amber-500/20"
                >
                  {localCountdown}
                </motion.div>
                <div className="text-xs font-black tracking-widest uppercase text-amber-300 mt-2 animate-pulse">
                  GET READY! STARTING GAME...
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
