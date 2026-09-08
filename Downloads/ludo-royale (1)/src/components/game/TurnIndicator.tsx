import React from 'react';
import { Player, GameStatus } from '../../types/gameTypes';
import { COLOR_THEMES } from '../../game/board';
import { Dices, Sparkles } from 'lucide-react';

interface TurnIndicatorProps {
  currentPlayer?: Player;
  status: GameStatus;
  lastActionText: string;
  diceValue: number | null;
  extraTurnGranted: boolean;
}

const TurnIndicatorComponent: React.FC<TurnIndicatorProps> = ({
  currentPlayer,
  status,
  lastActionText,
  diceValue,
  extraTurnGranted,
}) => {
  if (!currentPlayer) return null;
  const theme = COLOR_THEMES[currentPlayer.color];

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-3 shadow-xl backdrop-blur-md">
      {/* Current player tag */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
          style={{ background: theme.hex }}
        />
        <div className="truncate">
          <div className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
            <span>{currentPlayer.name}</span>
            {!currentPlayer.isAI ? (
              <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-amber-300 bg-amber-500/25 px-2 py-0.5 rounded-full border border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-pulse uppercase tracking-wider">
                👑 YOUR TURN
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium italic">
                AI Turn
              </span>
            )}
            {extraTurnGranted && (
              <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-400/40 animate-pulse">
                <Sparkles className="w-2.5 h-2.5" /> BONUS ROLL
              </span>
            )}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">{lastActionText}</div>
        </div>
      </div>

      {/* Dice roll badge if available */}
      {diceValue !== null && (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-white/10 border border-white/15 flex-shrink-0">
          <Dices className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-sm font-black text-amber-300">
            {diceValue}
          </span>
        </div>
      )}
    </div>
  );
};

export const TurnIndicator = React.memo(TurnIndicatorComponent);

