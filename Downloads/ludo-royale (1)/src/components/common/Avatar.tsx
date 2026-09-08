import React from 'react';
import { PlayerColor } from '../../types/gameTypes';
import { COLOR_THEMES } from '../../game/board';

interface AvatarProps {
  avatar: string;
  color?: PlayerColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isActive?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  avatar,
  color,
  size = 'md',
  isActive = false,
  className = '',
  onClick,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-11 h-11 text-lg',
    lg: 'w-14 h-14 text-2xl',
    xl: 'w-20 h-20 text-4xl',
  }[size];

  const colorBorder = color ? COLOR_THEMES[color].border : 'border-slate-700';
  const activeRing = isActive && color ? `ring-4 ${COLOR_THEMES[color].ring} shadow-lg scale-105` : '';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 ${colorBorder} ${sizeClasses} ${activeRing} transition-all duration-200 select-none shadow-md ${
        onClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''
      } ${className}`}
    >
      <span className="leading-none drop-shadow-md">{avatar}</span>
      {isActive && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-slate-900"></span>
        </span>
      )}
    </div>
  );
};
