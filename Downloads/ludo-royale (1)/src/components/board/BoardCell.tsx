import React from 'react';

export type CellType =
  | 'COMMON'
  | 'SAFE_STAR'
  | 'START_RED'
  | 'START_GREEN'
  | 'START_YELLOW'
  | 'START_BLUE'
  | 'HOME_RED'
  | 'HOME_GREEN'
  | 'HOME_YELLOW'
  | 'HOME_BLUE';

interface BoardCellProps {
  row: number;
  col: number;
  cellType: CellType;
  showDebug?: boolean;
}

const BoardCellComponent: React.FC<BoardCellProps> = ({ row, col, cellType, showDebug = false }) => {
  let bgClass = 'bg-slate-800/40 border-slate-700/40';
  let badge: React.ReactNode = null;

  switch (cellType) {
    case 'SAFE_STAR':
      bgClass = 'bg-amber-500/20 border-amber-400/40 shadow-[inset_0_0_12px_rgba(251,191,36,0.2)]';
      badge = (
        <div className="flex items-center justify-center w-full h-full">
          <span className="text-[11px] sm:text-xs text-amber-300 safe-star-glow select-none drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">
            ⭐
          </span>
        </div>
      );
      break;

    case 'START_RED':
      bgClass = 'bg-red-500/30 border-red-400/50 shadow-[inset_0_0_10px_rgba(239,68,68,0.25)]';
      badge = (
        <div className="flex items-center justify-center">
          <span className="text-[10px] sm:text-xs font-black text-red-300 tracking-tighter">▶</span>
        </div>
      );
      break;

    case 'START_GREEN':
      bgClass = 'bg-emerald-500/30 border-emerald-400/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.25)]';
      badge = (
        <div className="flex items-center justify-center">
          <span className="text-[10px] sm:text-xs font-black text-emerald-300 tracking-tighter">▼</span>
        </div>
      );
      break;

    case 'START_YELLOW':
      bgClass = 'bg-yellow-500/30 border-yellow-400/50 shadow-[inset_0_0_10px_rgba(234,179,8,0.25)]';
      badge = (
        <div className="flex items-center justify-center">
          <span className="text-[10px] sm:text-xs font-black text-yellow-300 tracking-tighter">◀</span>
        </div>
      );
      break;

    case 'START_BLUE':
      bgClass = 'bg-blue-500/30 border-blue-400/50 shadow-[inset_0_0_10px_rgba(59,130,246,0.25)]';
      badge = (
        <div className="flex items-center justify-center">
          <span className="text-[10px] sm:text-xs font-black text-blue-300 tracking-tighter">▲</span>
        </div>
      );
      break;

    case 'HOME_RED':
      bgClass = 'bg-red-500/35 border-red-500/40 shadow-inner';
      badge = <span className="text-[9px] text-red-300/60 font-mono">▶</span>;
      break;

    case 'HOME_GREEN':
      bgClass = 'bg-emerald-500/35 border-emerald-500/40 shadow-inner';
      badge = <span className="text-[9px] text-emerald-300/60 font-mono">▼</span>;
      break;

    case 'HOME_YELLOW':
      bgClass = 'bg-yellow-500/35 border-yellow-500/40 shadow-inner';
      badge = <span className="text-[9px] text-yellow-300/60 font-mono">◀</span>;
      break;

    case 'HOME_BLUE':
      bgClass = 'bg-blue-500/35 border-blue-500/40 shadow-inner';
      badge = <span className="text-[9px] text-blue-300/60 font-mono">▲</span>;
      break;

    default:
      bgClass = 'bg-slate-800/35 border-slate-700/40 hover:bg-slate-700/40';
      break;
  }

  return (
    <div
      style={{ gridRow: row + 1, gridColumn: col + 1 }}
      className={`relative w-full h-full border border-slate-700/50 flex items-center justify-center transition-colors select-none ${bgClass}`}
    >
      {badge}
      {showDebug && (
        <span className="absolute top-0.5 left-0.5 text-[7px] text-white/50 font-mono pointer-events-none leading-none select-none">
          {row},{col}
        </span>
      )}
    </div>
  );
};

export const BoardCell = React.memo(BoardCellComponent);

