import React, { useState } from 'react';
import { PlayerColor, AIDifficulty, GameMode } from '../types/gameTypes';
import { PlayerSetupConfig } from '../game/gameEngine';
import { COLOR_THEMES } from '../game/board';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { ArrowLeft, Play, Bot, User, Sparkles } from 'lucide-react';
import { playerProfileService, DEFAULT_AVATARS } from '../services/playerProfileService';

const AVATAR_OPTIONS = DEFAULT_AVATARS;

interface PlayerSetupProps {
  initialMode: 'LOCAL' | 'AI';
  onStartGame: (configs: PlayerSetupConfig[], mode: GameMode) => void;
  onBack: () => void;
}

export const PlayerSetup: React.FC<PlayerSetupProps> = ({
  initialMode,
  onStartGame,
  onBack,
}) => {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [activeTab, setActiveTab] = useState<'LOCAL' | 'AI'>(initialMode);

  const currentProfile = playerProfileService.getProfile();

  // Player configurations for up to 4 players
  const [players, setPlayers] = useState<PlayerSetupConfig[]>([
    {
      name: currentProfile.username || currentProfile.name || 'Jeswanth',
      color: 'RED',
      avatar: currentProfile.avatar || '👑',
      isAI: false,
      aiDifficulty: 'MEDIUM',
    },
    {
      name: initialMode === 'AI' ? 'Royale Bot 1' : 'Player 2',
      color: 'GREEN',
      avatar: '⚡',
      isAI: initialMode === 'AI',
      aiDifficulty: 'MEDIUM',
    },
    {
      name: initialMode === 'AI' ? 'Royale Bot 2' : 'Player 3',
      color: 'YELLOW',
      avatar: '🔥',
      isAI: initialMode === 'AI',
      aiDifficulty: 'HARD',
    },
    {
      name: initialMode === 'AI' ? 'Royale Bot 3' : 'Player 4',
      color: 'BLUE',
      avatar: '🛡️',
      isAI: initialMode === 'AI',
      aiDifficulty: 'EASY',
    },
  ]);

  // Avatar picker modal state
  const [selectingAvatarForIndex, setSelectingAvatarForIndex] = useState<number | null>(null);

  const handleUpdatePlayer = (index: number, partial: Partial<PlayerSetupConfig>) => {
    setPlayers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...partial };
      return updated;
    });
  };

  const handleColorSelect = (index: number, newColor: PlayerColor) => {
    setPlayers((prev) => {
      const oldColor = prev[index].color;
      if (oldColor === newColor) return prev;

      return prev.map((p, idx) => {
        if (idx === index) {
          return { ...p, color: newColor };
        }
        if (p.color === newColor) {
          return { ...p, color: oldColor };
        }
        return p;
      });
    });
  };

  const handleModeSwitch = (mode: 'LOCAL' | 'AI') => {
    setActiveTab(mode);
    setPlayers((prev) =>
      prev.map((p, idx) => ({
        ...p,
        isAI: mode === 'AI' ? idx > 0 : false,
        name: mode === 'AI' && idx > 0 ? `Royale Bot ${idx}` : p.name.startsWith('Royale Bot') ? `Player ${idx + 1}` : p.name,
      }))
    );
  };

  const handleStart = () => {
    const selectedConfigs = players.slice(0, playerCount);
    onStartGame(selectedConfigs, activeTab);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto">
      {/* Top Header */}
      <header className="w-full max-w-2xl flex items-center justify-between gap-4 py-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-bold font-display text-amber-300">
          Match Setup
        </h1>

        <div className="w-16" />
      </header>

      {/* Main Settings Card */}
      <main className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6">
        {/* Mode Selector Toggle */}
        <div className="flex items-center justify-center p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleModeSwitch('LOCAL')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'LOCAL'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Local Multiplayer</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('AI')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'AI'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Human vs AI</span>
          </button>
        </div>

        {/* Player Count Selector */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Number of Players
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([2, 3, 4] as const).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayerCount(count)}
                className={`py-2.5 rounded-xl font-bold text-sm sm:text-base border transition-all cursor-pointer ${
                  playerCount === count
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400 text-slate-950 shadow-lg scale-[1.02]'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>

        {/* Player Configuration Cards */}
        <div className="flex flex-col gap-3.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Configure Players
          </label>

          {players.slice(0, playerCount).map((p, idx) => {
            const theme = COLOR_THEMES[p.color];

            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 shadow-inner"
              >
                {/* Avatar trigger */}
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => setSelectingAvatarForIndex(idx)}
                    title="Change Avatar"
                    className="cursor-pointer group relative"
                  >
                    <Avatar
                      avatar={p.avatar}
                      color={p.color}
                      size="md"
                      className="group-hover:ring-2 group-hover:ring-amber-400"
                    />
                    <span className="absolute -bottom-1 -right-1 text-[9px] bg-slate-800 px-1 rounded border border-slate-700 text-slate-300">
                      Edit
                    </span>
                  </div>

                  {/* Name Input */}
                  <div className="flex-1 min-w-[130px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Player {idx + 1}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: theme.hex }}
                      />
                    </div>
                    <input
                      type="text"
                      value={p.name}
                      maxLength={16}
                      onChange={(e) => handleUpdatePlayer(idx, { name: e.target.value })}
                      placeholder={`Player ${idx + 1}`}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Color Selector */}
                <div className="flex items-center gap-1.5 sm:ml-auto">
                  {(['RED', 'GREEN', 'YELLOW', 'BLUE'] as PlayerColor[]).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => handleColorSelect(idx, clr)}
                      aria-label={`Color ${clr}`}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer border-2 ${
                        p.color === clr
                          ? 'border-white scale-110 ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ background: COLOR_THEMES[clr].hex }}
                    />
                  ))}
                </div>

                {/* AI / Human toggle & difficulty (for players 2, 3, 4) */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleUpdatePlayer(idx, { isAI: !p.isAI })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border ${
                      p.isAI
                        ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {p.isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    <span>{p.isAI ? 'AI' : 'Human'}</span>
                  </button>

                  {p.isAI && (
                    <select
                      value={p.aiDifficulty}
                      onChange={(e) =>
                        handleUpdatePlayer(idx, {
                          aiDifficulty: e.target.value as AIDifficulty,
                        })
                      }
                      className="bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          variant="primary"
          onClick={handleStart}
          className="w-full py-4 text-base sm:text-lg flex items-center justify-center gap-2 mt-2"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>START BATTLE</span>
        </Button>
      </main>

      {/* Avatar Picker Modal */}
      {selectingAvatarForIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-amber-300 mb-4 text-center font-display">
              Choose Avatar
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => {
                    handleUpdatePlayer(selectingAvatarForIndex, { avatar: av });
                    setSelectingAvatarForIndex(null);
                  }}
                  className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow"
                >
                  {av}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectingAvatarForIndex(null)}
              className="w-full mt-5 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-xs text-slate-500 py-3">
        Fair-play engine • Authenticated dice randomization
      </footer>
    </div>
  );
};
