import React from 'react';
import { Player, Token as TokenType, PlayerColor } from '../../types/gameTypes';

interface FinishAreaProps {
  players: Player[];
  allTokens: TokenType[];
  gridAreaClass: string;
}

export const FinishArea: React.FC<FinishAreaProps> = ({
  allTokens,
  gridAreaClass,
}) => {
  const finishedTokens = allTokens.filter((t) => t.isHome || t.position >= 56);

  const getFinishedCount = (color: PlayerColor) =>
    finishedTokens.filter((t) => t.color === color).length;

  return (
    <div
      className={`${gridAreaClass} relative rounded-xl overflow-hidden bg-slate-950 shadow-[inset_0_0_30px_rgba(0,0,0,0.9)] flex items-center justify-center select-none border-2 border-amber-400/40`}
    >
      {/* 4 Colored Triangles Meeting in Center */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        {/* Red Triangle (Left) */}
        <polygon points="0,0 50,50 0,100" fill="#dc2626" opacity="0.75" />
        {/* Green Triangle (Top) */}
        <polygon points="0,0 50,50 100,0" fill="#16a34a" opacity="0.75" />
        {/* Yellow Triangle (Right) */}
        <polygon points="100,0 50,50 100,100" fill="#ca8a04" opacity="0.75" />
        {/* Blue Triangle (Bottom) */}
        <polygon points="0,100 50,50 100,100" fill="#2563eb" opacity="0.75" />

        {/* Crisp Golden Diagonal Dividing Lines */}
        <line x1="0" y1="0" x2="100" y2="100" stroke="#fef08a" strokeWidth="1.2" opacity="0.4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#fef08a" strokeWidth="1.2" opacity="0.4" />
      </svg>

      {/* Central Royal Emblem Medallion */}
      <div className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-2 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.6)] flex items-center justify-center pointer-events-none">
        <span className="text-base sm:text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none">
          👑
        </span>
      </div>

      {/* Quadrant Finish Indicators - positioned discreetly at the outer edges */}
      {/* Red (Left) */}
      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <span className="text-[7px] sm:text-[8px] font-black text-red-200 bg-red-950/80 border border-red-500/40 px-0.5 py-0.2 rounded shadow-sm">
          {getFinishedCount('RED')}/4
        </span>
      </div>

      {/* Green (Top) */}
      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <span className="text-[7px] sm:text-[8px] font-black text-emerald-200 bg-emerald-950/80 border border-emerald-500/40 px-0.5 py-0.2 rounded shadow-sm">
          {getFinishedCount('GREEN')}/4
        </span>
      </div>

      {/* Yellow (Right) */}
      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <span className="text-[7px] sm:text-[8px] font-black text-amber-200 bg-amber-950/80 border border-amber-500/40 px-0.5 py-0.2 rounded shadow-sm">
          {getFinishedCount('YELLOW')}/4
        </span>
      </div>

      {/* Blue (Bottom) */}
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <span className="text-[7px] sm:text-[8px] font-black text-sky-200 bg-blue-950/80 border border-blue-500/40 px-0.5 py-0.2 rounded shadow-sm">
          {getFinishedCount('BLUE')}/4
        </span>
      </div>
    </div>
  );
};

