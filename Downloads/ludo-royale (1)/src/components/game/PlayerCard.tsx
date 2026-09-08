import React from 'react';
import { Player } from '../../types/gameTypes';
import { COLOR_THEMES } from '../../game/board';
import { Bot, Trophy, Sparkles } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  isCurrentTurn: boolean;
  compact?: boolean;
}

const PlayerCardComponent: React.FC<PlayerCardProps> = ({
  player,
  isCurrentTurn,
  compact = false,
}) => {
  const theme = COLOR_THEMES[player.color];
  const finishedCount = player.tokensFinished;

  // Color specific sleek styles
  const colorThemes = {
    RED: {
      activeBg: 'bg-red-600/15 border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.35)]',
      inactiveBg: 'bg-red-950/20 border-red-500/20',
      badgeBg: 'bg-red-500 text-white',
      avatarGrad: 'from-red-400 to-red-600',
      activeText: 'text-red-200',
      subText: 'text-red-400',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
    },
    GREEN: {
      activeBg: 'bg-emerald-600/15 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]',
      inactiveBg: 'bg-emerald-950/20 border-emerald-500/20',
      badgeBg: 'bg-emerald-500 text-white',
      avatarGrad: 'from-emerald-400 to-emerald-600',
      activeText: 'text-emerald-200',
      subText: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    },
    YELLOW: {
      activeBg: 'bg-amber-600/15 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.35)]',
      inactiveBg: 'bg-amber-950/20 border-amber-500/20',
      badgeBg: 'bg-amber-500 text-slate-950',
      avatarGrad: 'from-yellow-400 to-amber-600',
      activeText: 'text-yellow-200',
      subText: 'text-yellow-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    },
    BLUE: {
      activeBg: 'bg-blue-600/15 border-blue-500/70 shadow-[0_0_20px_rgba(59,130,246,0.35)]',
      inactiveBg: 'bg-blue-950/20 border-blue-500/20',
      badgeBg: 'bg-blue-500 text-white',
      avatarGrad: 'from-blue-400 to-blue-600',
      activeText: 'text-blue-200',
      subText: 'text-blue-400',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
    },
  }[player.color];

  if (compact) {
    return (
      <div
        className={`relative flex items-center gap-2 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl transition-all duration-150 border select-none min-w-0 ${
          isCurrentTurn
            ? `${colorThemes.activeBg} ring-1.5 ring-amber-400/80 scale-[1.01]`
            : `${colorThemes.inactiveBg} opacity-65`
        }`}
      >
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${colorThemes.avatarGrad} flex items-center justify-center text-sm sm:text-base shadow-inner border border-white/20 flex-shrink-0`}
        >
          {player.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={`text-[11px] sm:text-xs font-black uppercase truncate ${
                isCurrentTurn ? 'text-white' : 'text-slate-300'
              }`}
            >
              {player.name}
            </span>
            {player.isAI && <Bot className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {[0, 1, 2, 3].map((slot) => (
              <div
                key={slot}
                className={`w-1.5 h-1.5 rounded-full ${
                  slot < finishedCount
                    ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.9)]'
                    : 'bg-white/20'
                }`}
              />
            ))}
            <span className="text-[9px] font-bold text-slate-400 ml-0.5">
              {finishedCount}/4
            </span>
          </div>
        </div>
        {isCurrentTurn && (
          <span
            className={`text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow ${colorThemes.badgeBg} uppercase tracking-wider animate-pulse flex-shrink-0`}
          >
            TURN
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative p-3 sm:p-3.5 rounded-2xl transition-all duration-150 border flex flex-col justify-between select-none ${
        isCurrentTurn
          ? `${colorThemes.activeBg} z-10 scale-[1.02] ring-1.5 ring-amber-400/80`
          : `${colorThemes.inactiveBg} opacity-60`
      }`}
    >
      {/* Sleek Floating Active Turn Badge */}
      {isCurrentTurn && (
        <div
          className={`absolute -top-2.5 -right-2 px-2 py-0.5 rounded-md ${colorThemes.badgeBg} text-[9px] font-black uppercase tracking-wider shadow-lg animate-pulse z-10`}
        >
          TURN
        </div>
      )}

      {/* Header with Sleek Avatar Box & Name */}
      <div className="flex items-center gap-2.5">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br ${colorThemes.avatarGrad} rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-inner border border-white/20 flex-shrink-0`}
        >
          {player.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4
              className={`font-black text-xs sm:text-sm uppercase tracking-tight truncate ${
                isCurrentTurn ? colorThemes.activeText : 'text-slate-200'
              }`}
            >
              {player.name}
            </h4>
            {player.isAI && (
              <span className="flex items-center text-[8px] font-bold px-1 py-0.2 rounded bg-white/10 text-slate-300">
                AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[0, 1, 2, 3].map((slot) => (
              <div
                key={slot}
                className={`w-2 h-2 rounded-full ${
                  slot < finishedCount
                    ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.9)]'
                    : 'bg-white/20'
                }`}
              />
            ))}
            <span className="text-[10px] font-bold text-slate-400 ml-1">
              {finishedCount}/4 Home
            </span>
          </div>
        </div>
      </div>

      {/* Stats Mini Badges */}
      <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-white/10 text-center">
        <div className="bg-black/30 px-1.5 py-0.5 rounded-lg border border-white/5">
          <div className="text-[9px] text-slate-400 font-semibold uppercase">Captures</div>
          <div className="text-xs font-black text-rose-400">{player.captures}</div>
        </div>

        <div className="bg-black/30 px-1.5 py-0.5 rounded-lg border border-white/5">
          <div className="text-[9px] text-slate-400 font-semibold uppercase">Score</div>
          <div className="text-xs font-black text-amber-300">{player.score}</div>
        </div>
      </div>
    </div>
  );
};

export const PlayerCard = React.memo(PlayerCardComponent);
