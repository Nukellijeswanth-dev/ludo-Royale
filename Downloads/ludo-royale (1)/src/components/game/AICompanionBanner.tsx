import React from 'react';
import { AICommentary } from '../../types/gameTypes';
import { Bot, MessageSquare } from 'lucide-react';

interface AICompanionBannerProps {
  commentary: AICommentary | null;
  className?: string;
}

export const AICompanionBanner: React.FC<AICompanionBannerProps> = ({
  commentary,
  className = '',
}) => {
  if (!commentary) return null;

  return (
    <div
      className={`w-full max-w-sm sm:max-w-md mx-auto p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md relative shadow-xl ${className}`}
    >
      <div className="absolute -top-3 left-6 px-2.5 py-0.5 bg-blue-500 rounded text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
        AI Companion
      </div>
      <p className="text-xs sm:text-sm italic text-blue-100/80 mt-1">
        "{commentary.text}"
      </p>
      <div className="mt-2.5 w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="w-1/3 h-full bg-blue-400 animate-pulse" />
      </div>
    </div>
  );
};
