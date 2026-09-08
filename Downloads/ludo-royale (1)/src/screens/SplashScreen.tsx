import React, { useEffect } from 'react';
import { Crown, Sparkles, Play } from 'lucide-react';
import { Button } from '../components/common/Button';

interface SplashScreenProps {
  onEnter: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onEnter }) => {
  useEffect(() => {
    // Automatically transition after 2.4 seconds or allow immediate tap
    const timer = setTimeout(() => {
      onEnter();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onEnter]);

  return (
    <div
      onClick={onEnter}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white cursor-pointer select-none overflow-hidden p-6"
    >
      {/* Ambient background glow orbs */}
      <div className="absolute w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-96 h-96 rounded-full bg-rose-500/10 blur-3xl pointer-events-none -bottom-20 -right-20" />

      {/* Center Brand Hero */}
      <div className="relative flex flex-col items-center gap-4 text-center z-10 animate-in fade-in zoom-in-90 duration-700">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-1 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center border border-white/20">
            <Crown className="w-12 h-12 sm:w-14 sm:h-14 text-amber-400 drop-shadow-md animate-pulse" />
          </div>
          <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] tracking-widest uppercase shadow">
            EST. 2026
          </span>
        </div>

        <div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight font-display bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-sm">
            LUDO ROYALE
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-medium tracking-wide mt-1.5 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> The Premier Board Strategy Experience
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              onEnter();
            }}
            className="flex items-center gap-2 px-8"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>PLAY NOW</span>
          </Button>
          <span className="text-xs text-slate-500 font-medium">Click anywhere or waiting to start...</span>
        </div>
      </div>
    </div>
  );
};
