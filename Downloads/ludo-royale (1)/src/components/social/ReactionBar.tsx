import React, { useState } from 'react';

const REACTIONS = ['😂', '😡', '😱', '🔥', '👏', '😎', '❤️', '🎉'];

interface ReactionBarProps {
  onReact?: (emoji: string) => void;
  onSendReaction?: (emoji: string) => void;
  disabled?: boolean;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
  onReact,
  onSendReaction,
  disabled,
}) => {
  const [cooldown, setCooldown] = useState(false);

  const handleTrigger = (emoji: string) => {
    if (disabled || cooldown) return;
    if (onSendReaction) onSendReaction(emoji);
    else if (onReact) onReact(emoji);

    setCooldown(true);
    setTimeout(() => setCooldown(false), 400);
  };

  return (
    <div
      id="reaction-toolbar"
      className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-xl overflow-x-auto no-scrollbar"
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled || cooldown}
          onClick={() => handleTrigger(emoji)}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl rounded-xl bg-white/5 hover:bg-white/10 hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed border border-white/5"
          aria-label={`Send reaction ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
