import React from 'react';
import { Player, Token as TokenType, PlayerColor } from '../../types/gameTypes';

interface HomeAreaProps {
  player?: Player;
  color: PlayerColor;
  tokens: TokenType[];
  gridAreaClass: string;
}

export const HomeArea: React.FC<HomeAreaProps> = ({
  player,
  color,
  tokens,
  gridAreaClass,
}) => {
  const yardTokens = tokens.filter((t) => t.position === -1);

  // Modern tactical base styling with beveled borders and subtle glow
  const sleekBaseStyles: Record<
    PlayerColor,
    { bg: string; border: string; slotBorder: string; glow: string; badgeBg: string }
  > = {
    RED: {
      bg: 'bg-red-950/40',
      border: 'border-red-500/70',
      slotBorder: 'border-red-400/50',
      glow: 'shadow-[inset_0_0_20px_rgba(239,68,68,0.25)]',
      badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
    },
    GREEN: {
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-500/70',
      slotBorder: 'border-emerald-400/50',
      glow: 'shadow-[inset_0_0_20px_rgba(16,185,129,0.25)]',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    YELLOW: {
      bg: 'bg-amber-950/40',
      border: 'border-amber-500/70',
      slotBorder: 'border-amber-400/50',
      glow: 'shadow-[inset_0_0_20px_rgba(245,158,11,0.25)]',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    BLUE: {
      bg: 'bg-blue-950/40',
      border: 'border-blue-500/70',
      slotBorder: 'border-blue-400/50',
      glow: 'shadow-[inset_0_0_20px_rgba(59,130,246,0.25)]',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    },
  };

  const style = sleekBaseStyles[color];

  // The 4 canonical socket coordinates in 1-indexed CSS 6x6 grid:
  // Slot 0: row 2, col 2 (0-indexed 1, 1)
  // Slot 1: row 2, col 5 (0-indexed 1, 4)
  // Slot 2: row 5, col 2 (0-indexed 4, 1)
  // Slot 3: row 5, col 5 (0-indexed 4, 4)
  const slotGridPositions = [
    { row: 2, col: 2 },
    { row: 2, col: 5 },
    { row: 5, col: 2 },
    { row: 5, col: 5 },
  ];

  return (
    <div
      className={`${gridAreaClass} relative w-full h-full rounded-xl ${style.bg} border-2 sm:border-3 ${style.border} ${style.glow} grid select-none overflow-hidden backdrop-blur-md`}
      style={{
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
      }}
    >
      {/* Sleek Player badge header spanning top row */}
      <div
        style={{ gridRow: '1', gridColumn: '1 / span 6' }}
        className="flex items-center justify-center z-10 px-1 pt-1 pointer-events-none"
      >
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${style.badgeBg} shadow-sm max-w-[90%]`}
        >
          <span className="text-xs">{player?.avatar || '🎲'}</span>
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">
            {player?.name || color}
          </span>
        </div>
      </div>

      {/* Central Base Watermark in middle rows 3..4, cols 3..4 */}
      <div
        style={{ gridRow: '3 / span 2', gridColumn: '3 / span 2' }}
        className="flex items-center justify-center pointer-events-none opacity-25 z-0"
      >
        <span className="text-xl sm:text-2xl font-black text-white/50 select-none">
          {color.slice(0, 1)}
        </span>
      </div>

      {/* 4 Canonical Recessed Yard Token Sockets */}
      {slotGridPositions.map((pos, slotIdx) => (
        <div
          key={slotIdx}
          style={{ gridRow: pos.row, gridColumn: pos.col }}
          className="flex items-center justify-center p-0.5 z-10"
        >
          <div
            className={`w-[85%] h-[85%] rounded-full bg-slate-900/90 border-2 ${style.slotBorder} shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] flex items-center justify-center`}
          >
            {/* Center socket pin */}
            <div className="w-1.5 h-1.5 rounded-full bg-slate-950/90 border border-white/20" />
          </div>
        </div>
      ))}

      {/* Yard counter footer spanning bottom row */}
      <div
        style={{ gridRow: '6', gridColumn: '1 / span 6' }}
        className="flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-slate-400 z-10 pb-1 tracking-wider pointer-events-none"
      >
        {yardTokens.length} / 4 IN BASE
      </div>
    </div>
  );
};

