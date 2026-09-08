import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { ChatPayload } from '../../services/roomService';
import { PlayerColor } from '../../types/gameTypes';

const QUICK_PRESETS = [
  'Good luck! 🍀',
  'Nice move! 🎯',
  'Almost there! 🏃',
  'GG! 👑',
  "Let's go! 🚀",
  'Oops! 😅',
];

const COLOR_STYLES: Record<PlayerColor, { text: string; bg: string; border: string }> = {
  RED: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  GREEN: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  YELLOW: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  BLUE: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
};

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatPayload[];
  onSendMessage: (message: string) => void;
  myPlayerId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  myPlayerId,
}) => {
  const [inputText, setInputText] = useState('');
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSendTimeRef = useRef<number>(0);

  // Auto-scroll when messages update or panel opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Focus input on open for desktop
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (text.length > 200) {
      setRateLimitWarning('Message exceeds 200 characters');
      setTimeout(() => setRateLimitWarning(null), 3000);
      return;
    }

    const now = Date.now();
    if (now - lastSendTimeRef.current < 250) {
      setRateLimitWarning('Slow down! Wait a moment.');
      setTimeout(() => setRateLimitWarning(null), 2000);
      return;
    }

    lastSendTimeRef.current = now;
    onSendMessage(text);
    setInputText('');
    setRateLimitWarning(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <aside
      id="in-game-chat-panel"
      aria-label="In-Game Chat"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 md:w-96 bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col transition-transform duration-200 ease-out"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Live Chat
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                Online
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Chat with players in this match</p>
          </div>
        </div>

        <button
          type="button"
          id="btn-close-chat"
          onClick={onClose}
          aria-label="Close Chat"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Messages Carousel */}
      <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-900/30 flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Quick Messages
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSend(preset)}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-amber-300 border border-slate-700/60 whitespace-nowrap transition-colors cursor-pointer active:scale-95"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-amber-400" />
            <p className="text-xs font-semibold text-slate-400">No messages yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Be the first to say hello or congratulate an opponent!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.playerId === myPlayerId;
            const isSystem = !!msg.isSystem;
            const colorKey = (msg.playerColor || msg.color || 'RED') as PlayerColor;
            const colorCfg = COLOR_STYLES[colorKey] || COLOR_STYLES.RED;
            const textContent = msg.message || msg.text || '';

            if (isSystem) {
              return (
                <div
                  key={msg.messageId || msg.id}
                  className="flex justify-center my-1.5 animate-in fade-in duration-200"
                >
                  <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5 shadow-sm text-center">
                    <span>📢</span>
                    <span className="font-medium text-slate-300">{textContent}</span>
                    <span className="text-[9px] text-slate-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.messageId || msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span
                    className={`text-[11px] font-bold ${
                      isMine ? 'text-amber-400' : colorCfg.text
                    }`}
                  >
                    {isMine ? 'You' : msg.playerName || 'Player'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                    isMine
                      ? 'bg-amber-500/20 text-amber-100 border border-amber-500/40 rounded-tr-xs'
                      : `${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border} rounded-tl-xs`
                  }`}
                >
                  {textContent}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Rate limit warning toast */}
      {rateLimitWarning && (
        <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
          <span>{rateLimitWarning}</span>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/80 flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="input-chat-message"
              type="text"
              value={inputText}
              maxLength={200}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type message... (max 200)"
              className="w-full pl-3 pr-14 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/50"
            />
            <span
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono ${
                inputText.length > 180 ? 'text-rose-400 font-bold' : 'text-slate-500'
              }`}
            >
              {inputText.length}/200
            </span>
          </div>

          <button
            type="submit"
            id="btn-send-chat"
            disabled={!inputText.trim()}
            aria-label="Send Message"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-slate-950 font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
};
