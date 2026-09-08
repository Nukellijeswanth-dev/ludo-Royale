import React from 'react';
import { Player, PlayerColor } from '../../types/gameTypes';
import { Avatar } from '../common/Avatar';
import { Swords, Trophy } from 'lucide-react';

interface MobilePlayerBarProps {
  players: Player[];
  currentPlayerIndex: number;
}

const colorStyles: Record<
  PlayerColor,
  { border: string; bg: string; activeRing: string; dot: string; text: string }
> = {
  RED: {
    border: 'border-red-500/50',
    bg: 'bg-red-950/40',
    activeRing: 'ring-2 ring-red-400 bg-red-950/80 shadow-[0_0_12px_rgba(239,68,68,0.7)]',
    dot: 'bg-red-400',
    text: 'text-red-300',
  },
  GREEN: {
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-950/40',
    activeRing: 'ring-2 ring-emerald-400 bg-emerald-950/80 shadow-[0_0_12px_rgba(16,185,129,0.7)]',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  YELLOW: {
    border: 'border-amber-400/50',
    bg: 'bg-amber-950/40',
    activeRing: 'ring-2 ring-amber-300 bg-amber-950/80 shadow-[0_0_12px_rgba(245,158,11,0.7)]',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
  },
  BLUE: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-950/40',
    activeRing: 'ring-2 ring-blue-400 bg-blue-950/80 shadow-[0_0_12px_rgba(59,130,246,0.7)]',
    dot: 'bg-blue-400',
    text: 'text-sky-300',
  },
};

export const MobilePlayerBar: React.FC<MobilePlayerBarProps> = ({
  players,
  currentPlayerIndex,
}) => {
  return (
    <div className="lg:hidden w-full max-w-[480px] grid grid-cols-4 gap-1 sm:gap-1.5 px-2 py-1 select-none flex-shrink-0">
      {players.map((player, idx) => {
        const isCurrent = idx === currentPlayerIndex;
        const style = colorStyles[player.color];

        return (
          <div
            key={player.id}
            className={`flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-xl border transition-all duration-200 ${
              isCurrent
                ? `${style.activeRing} scale-[1.02] border-transparent`
                : `${style.bg} ${style.border} opacity-85`
            }`}
          >
            {/* Top: Avatar & Active indicator */}
            <div className="relative flex items-center justify-center">
              <Avatar avatar={player.avatar} color={player.color} size="sm" />
              {isCurrent && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-300 border border-black" />
                </span>
              )}
            </div>

            {/* Middle: Player Name */}
            <span
              className={`mt-0.5 text-[10px] sm:text-xs font-bold truncate max-w-[70px] ${
                isCurrent ? 'text-white font-extrabold' : 'text-slate-300'
              }`}
            >
              {player.name}
            </span>

            {/* Bottom: Finished Tokens Pips & Captures */}
            <div className="flex items-center gap-0.5 mt-0.5">
              {[0, 1, 2, 3].map((pipIndex) => {
                const isFinished = pipIndex < player.tokensFinished;
                return (
                  <span
                    key={pipIndex}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      isFinished
                        ? `${style.dot} shadow-[0_0_4px_currentColor]`
                        : 'bg-slate-700/60'
                    }`}
                  />
                );
              })}
              {player.captures > 0 && (
                <span className="ml-1 text-[8px] font-bold text-rose-400 flex items-center">
                  ⚔️{player.captures}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
