import React from 'react';
import { Token as TokenType, PlayerColor } from '../../types/gameTypes';
import { COLOR_THEMES } from '../../game/board';

interface TokenProps {
  token: TokenType;
  isValidMove: boolean;
  onSelect: (tokenId: number) => void;
  stackCount?: number;
  stackIndex?: number;
}

export const Token: React.FC<TokenProps> = ({
  token,
  isValidMove,
  onSelect,
  stackCount = 1,
  stackIndex = 0,
}) => {
  const color = token.color;
  const theme = COLOR_THEMES[color];

  // Token styling with rich 3D sphere gradient effect
  const gradientStyles: Record<PlayerColor, string> = {
    RED: 'radial-gradient(circle at 35% 35%, #ff7b72, #da3633 60%, #8e1519)',
    GREEN: 'radial-gradient(circle at 35% 35%, #7ee787, #238636 60%, #0e4429)',
    YELLOW: 'radial-gradient(circle at 35% 35%, #fbe864, #d29922 60%, #845306)',
    BLUE: 'radial-gradient(circle at 35% 35%, #79c0ff, #1f6feb 60%, #0d3882)',
  };

  // Stack offset if multiple tokens share the exact same cell
  const offsetTransform =
    stackCount > 1
      ? `translate(${(stackIndex - (stackCount - 1) / 2) * 6}px, ${(stackIndex - (stackCount - 1) / 2) * -6}px)`
      : '';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (isValidMove) {
          onSelect(token.id);
        }
      }}
      disabled={!isValidMove}
      aria-label={`${color} token ${token.tokenIndex + 1}${isValidMove ? ' - movable' : ''}`}
      style={{
        background: gradientStyles[color],
        transform: offsetTransform,
      }}
      className={`relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white/80 transition-all duration-200 select-none ${
        isValidMove
          ? 'cursor-pointer ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-900 animate-bounce scale-110 z-30 shadow-amber-400/50 hover:scale-125'
          : 'z-10 cursor-default opacity-95'
      }`}
    >
      {/* Inner metallic ring */}
      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-white/40 flex items-center justify-center bg-black/20 shadow-inner">
        <div className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-sm" />
      </div>

      {/* Pulsing beacon if valid move */}
      {isValidMove && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-300 border border-slate-900"></span>
        </span>
      )}
    </button>
  );
};
