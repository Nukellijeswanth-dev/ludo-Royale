import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

const QUICK_CHATS = [
  'Nice move!',
  'Good game!',
  "Let's go!",
  'Haha!',
  'Wow!',
  'Almost there!',
  'That was lucky!',
  'GG!',
];

interface QuickChatProps {
  onSendChat: (text: string) => void;
  disabled?: boolean;
  direction?: 'up' | 'down';
}

export const QuickChat: React.FC<QuickChatProps> = ({ onSendChat, disabled, direction = 'down' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (text: string) => {
    onSendChat(text);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        aria-label="Toggle Quick Chat"
      >
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            direction === 'down' ? 'top-12 right-0' : 'bottom-12 right-0'
          } w-48 sm:w-56 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-300">Quick Chat</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {QUICK_CHATS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleSelect(phrase)}
                className="text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
