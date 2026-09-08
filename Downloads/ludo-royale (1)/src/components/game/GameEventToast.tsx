import React, { useEffect, useState } from 'react';
import { GameEventNotification, PlayerColor } from '../../types/gameTypes';
import { gameEngine } from '../../game/gameEngine';

interface GameEventToastProps {
  event?: GameEventNotification | null;
}

export const GameEventToast: React.FC<GameEventToastProps> = ({ event: propEvent }) => {
  const [currentEvent, setCurrentEvent] = useState<GameEventNotification | null>(propEvent || null);

  useEffect(() => {
    if (propEvent !== undefined) {
      setCurrentEvent(propEvent);
      return;
    }

    const unsubscribe = gameEngine.subscribeEvents((event) => {
      setCurrentEvent(event);
      const timer = setTimeout(() => {
        setCurrentEvent((prev) => (prev?.id === event.id ? null : prev));
      }, 2000);
      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, [propEvent]);

  if (!currentEvent) return null;

  const colorThemes: Record<
    PlayerColor,
    { border: string; bg: string; text: string; glow: string }
  > = {
    RED: {
      border: 'border-red-500/80',
      bg: 'from-red-950/90 via-slate-950/95 to-slate-900/90',
      text: 'text-red-300',
      glow: 'shadow-[0_0_25px_rgba(239,68,68,0.7)]',
    },
    GREEN: {
      border: 'border-emerald-500/80',
      bg: 'from-emerald-950/90 via-slate-950/95 to-slate-900/90',
      text: 'text-emerald-300',
      glow: 'shadow-[0_0_25px_rgba(16,185,129,0.7)]',
    },
    YELLOW: {
      border: 'border-amber-400/80',
      bg: 'from-amber-950/90 via-slate-950/95 to-slate-900/90',
      text: 'text-amber-300',
      glow: 'shadow-[0_0_25px_rgba(245,158,11,0.7)]',
    },
    BLUE: {
      border: 'border-blue-500/80',
      bg: 'from-blue-950/90 via-slate-950/95 to-slate-900/90',
      text: 'text-sky-300',
      glow: 'shadow-[0_0_25px_rgba(59,130,246,0.7)]',
    },
  };

  const theme = colorThemes[currentEvent.color] || colorThemes.RED;

  return (
    <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 pointer-events-none w-auto max-w-[92vw] sm:max-w-md">
      <div
        className={`event-banner-enter flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r ${theme.bg} border-2 ${theme.border} ${theme.glow} backdrop-blur-xl select-none`}
      >
        <span className="text-2xl sm:text-3xl flex-shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {currentEvent.icon}
        </span>
        <div className="min-w-0">
          <div className={`font-black text-sm sm:text-base tracking-wider uppercase ${theme.text}`}>
            {currentEvent.title}
          </div>
          {currentEvent.subtitle && (
            <div className="text-[11px] sm:text-xs text-slate-200 font-medium truncate">
              {currentEvent.subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
