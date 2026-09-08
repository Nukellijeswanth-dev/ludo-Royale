import React, { useState, useEffect, useRef } from 'react';
import { PlayerColor } from '../../types/gameTypes';
import { COLOR_THEMES } from '../../game/board';
import { Sparkles, Dices } from 'lucide-react';

interface DiceProps {
  value: number | null;
  rolling: boolean;
  canRoll: boolean;
  currentColor?: PlayerColor;
  playerName?: string;
  onRoll: () => void;
  disabled?: boolean;
  compact?: boolean;
  needsTokenSelection?: boolean;
}

export const Dice: React.FC<DiceProps> = ({
  value,
  rolling,
  canRoll,
  currentColor = 'RED',
  playerName,
  onRoll,
  disabled = false,
  compact = false,
  needsTokenSelection = false,
}) => {
  const theme = COLOR_THEMES[currentColor] || COLOR_THEMES.RED;
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const [isLanded, setIsLanded] = useState(false);
  const lastRollTimeRef = useRef<number>(0);

  // Dynamic tumbling pip animation when rolling
  useEffect(() => {
    if (rolling) {
      setIsLanded(false);
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 45);
      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
      if (value !== null) {
        setIsLanded(true);
        const timer = setTimeout(() => setIsLanded(false), 300);
        return () => clearTimeout(timer);
      }
    }
  }, [rolling, value]);

  // Handle safe click with debouncing
  const handleRollClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastRollTimeRef.current < 400) return;
    if (disabled || !canRoll || rolling) return;

    lastRollTimeRef.current = now;
    onRoll();
  };

  // Color specific glowing rings and styling
  const colorGlows: Record<PlayerColor, { ring: string; shadow: string; banner: string }> = {
    RED: {
      ring: 'ring-red-400 ring-offset-slate-950 shadow-[0_0_25px_rgba(239,68,68,0.7)]',
      shadow: '0 0 25px rgba(239,68,68,0.5)',
      banner: 'from-red-500 to-rose-600',
    },
    GREEN: {
      ring: 'ring-emerald-400 ring-offset-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.7)]',
      shadow: '0 0 25px rgba(16,185,129,0.5)',
      banner: 'from-emerald-500 to-green-600',
    },
    YELLOW: {
      ring: 'ring-amber-400 ring-offset-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.7)]',
      shadow: '0 0 25px rgba(245,158,11,0.5)',
      banner: 'from-amber-400 to-yellow-500',
    },
    BLUE: {
      ring: 'ring-blue-400 ring-offset-slate-950 shadow-[0_0_25px_rgba(59,130,246,0.7)]',
      shadow: '0 0 25px rgba(59,130,246,0.5)',
      banner: 'from-blue-500 to-indigo-600',
    },
  };

  const activeGlow = colorGlows[currentColor] || colorGlows.RED;

  // Render dots on dice face (1..6)
  const renderDots = (num: number | null) => {
    if (!num) {
      return (
        <div className="flex flex-col items-center justify-center p-1 pointer-events-none">
          <Dices className="w-8 h-8 text-slate-700/80" />
          {canRoll && (
            <span className="text-[9px] font-black text-amber-300 uppercase tracking-wider mt-0.5 animate-pulse">
              ROLL
            </span>
          )}
        </div>
      );
    }

    const dotPositions: Record<number, number[]> = {
      1: [4], // Center
      2: [0, 8], // Top-Left, Bottom-Right
      3: [0, 4, 8], // Diagonal
      4: [0, 2, 6, 8], // 4 Corners
      5: [0, 2, 4, 6, 8], // 4 Corners + Center
      6: [0, 2, 3, 5, 6, 8], // 2 Columns of 3
    };

    const activeDots = dotPositions[num] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-11 h-11 sm:w-13 sm:h-13 p-1 pointer-events-none">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
          const isFilled = activeDots.includes(index);
          const isCenterPip = num === 1 && index === 4;

          return (
            <div key={index} className="flex items-center justify-center">
              {isFilled && (
                <div
                  className={`rounded-full transition-all duration-75 ${
                    isCenterPip
                      ? 'w-4 h-4 sm:w-4.5 sm:h-4.5 bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.8)] border border-red-400/40'
                      : 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-slate-950 shadow-inner'
                  }`}
                  style={{
                    boxShadow: isCenterPip ? undefined : 'inset 0 1.5px 3px rgba(0,0,0,0.85)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const isRollButtonDisabled = disabled || !canRoll || rolling;

  return (
    <div className="flex items-center justify-center gap-3 select-none">
      {/* 3D Sleek Dice Cube Display */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={handleRollClick}
          disabled={isRollButtonDisabled}
          aria-label={`Dice showing ${displayValue || 'ready to roll'}`}
          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 sm:border-3 border-white/80 shadow-2xl flex items-center justify-center cursor-pointer select-none transition-transform ${
            rolling
              ? 'dice-tumbling cursor-wait'
              : isLanded
              ? 'dice-landed'
              : canRoll
              ? `ring-4 ${activeGlow.ring} hover:scale-105 active:scale-95 animate-pulse`
              : 'opacity-85 cursor-default'
          }`}
          style={{
            boxShadow:
              displayValue === 6 && !rolling
                ? '0 0 30px rgba(251,191,36,0.8), inset 0 2px 4px rgba(255,255,255,1)'
                : canRoll && !rolling
                ? activeGlow.shadow
                : '0 10px 25px -4px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.9)',
          }}
        >
          {renderDots(displayValue)}

          {/* Shimmer glossy light reflection */}
          <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-transparent via-white/35 to-transparent pointer-events-none" />
        </button>

        {/* Rolled Value Corner Badge (only shown when rolled & settled) */}
        {value !== null && !rolling && (
          <div
            className={`absolute -bottom-1.5 -right-1.5 font-black text-sm sm:text-base w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-xl pointer-events-none z-10 ${
              value === 6
                ? 'bg-amber-400 text-slate-950 animate-bounce ring-2 ring-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                : 'bg-slate-900 text-amber-400 border-slate-700'
            }`}
          >
            {value}
          </div>
        )}

        {/* Extra Roll Notification Banner when 6 is rolled */}
        {value === 6 && !rolling && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[9px] sm:text-[10px] tracking-wider uppercase shadow-lg pointer-events-none whitespace-nowrap animate-pulse z-20">
            ★ SIX! EXTRA TURN ★
          </div>
        )}
      </div>

      {/* Sleek Action Roll Button */}
      <button
        type="button"
        onClick={handleRollClick}
        disabled={isRollButtonDisabled}
        className={`h-12 sm:h-14 px-5 sm:px-7 rounded-2xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-150 shadow-xl border-t border-white/30 flex items-center justify-center gap-2 select-none min-w-[140px] sm:min-w-[170px] ${
          canRoll && !rolling
            ? `bg-gradient-to-r ${activeGlow.banner} text-slate-950 hover:brightness-110 active:scale-95 cursor-pointer shadow-lg animate-pulse`
            : rolling
            ? 'bg-amber-500/30 text-amber-200 border-amber-400/30 cursor-wait'
            : needsTokenSelection
            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse'
            : 'bg-white/10 text-slate-400 border-white/5 cursor-not-allowed opacity-60'
        }`}
      >
        <Dices className={`w-4 h-4 ${rolling ? 'animate-spin' : ''}`} />
        <span className="truncate">
          {rolling
            ? 'ROLLING...'
            : canRoll
            ? 'ROLL DICE'
            : needsTokenSelection
            ? 'SELECT TOKEN'
            : `${playerName || 'WAITING'}`}
        </span>
      </button>
    </div>
  );
};
