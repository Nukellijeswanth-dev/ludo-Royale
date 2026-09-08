import React, { useState } from 'react';
import { GameSettings, BoardTheme } from '../types/playerTypes';
import { db } from '../database/database';
import { audio } from '../audio/audioManager';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Bot,
  Zap,
  Palette,
  RotateCcw,
  BookOpen,
  Check,
} from 'lucide-react';

interface SettingsProps {
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [current, setCurrent] = useState<GameSettings>(settings);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleToggleSound = () => {
    const next = !current.soundEnabled;
    const updated = { ...current, soundEnabled: next };
    audio.setSoundEnabled(next);
    setCurrent(updated);
    db.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleToggleAICompanion = () => {
    const updated = { ...current, aiCompanionEnabled: !current.aiCompanionEnabled };
    setCurrent(updated);
    db.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSpeedChange = (speed: 'NORMAL' | 'FAST') => {
    const updated = { ...current, animationSpeed: speed };
    setCurrent(updated);
    db.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleThemeChange = (theme: BoardTheme) => {
    const updated = { ...current, boardTheme: theme };
    setCurrent(updated);
    db.saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleResetData = () => {
    localStorage.clear();
    setShowResetConfirm(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto">
      {/* Top Header */}
      <header className="w-full max-w-2xl flex items-center justify-between py-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-bold font-display text-amber-300">
          Preferences & Audio
        </h1>

        <div className="w-16" />
      </header>

      {/* Main Settings Card */}
      <main className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-5">
        {/* Sound Effects Option */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400">
              {current.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">Synthesized Game Audio</h4>
              <p className="text-xs text-slate-400">Web Audio API sound effects for rolls, steps & captures</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleSound}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              current.soundEnabled ? 'bg-amber-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                current.soundEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* AI Game Companion Option */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">AI Game Companion</h4>
              <p className="text-xs text-slate-400">Dynamic reactions & contextual tactical hints</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleAICompanion}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              current.aiCompanionEnabled ? 'bg-indigo-600' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                current.aiCompanionEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Animation Speed Option */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Animation Pace</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {(['NORMAL', 'FAST'] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => handleSpeedChange(spd)}
                className={`py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                  current.animationSpeed === spd
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {spd === 'NORMAL' ? 'Standard Flow' : 'Turbo Fast'}
              </button>
            ))}
          </div>
        </div>

        {/* Board Visual Theme */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Palette className="w-4 h-4 text-rose-400" />
            <span>Board Visual Archetype</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {(['ROYALE', 'CLASSIC', 'MODERN', 'NEON'] as BoardTheme[]).map((thm) => (
              <button
                key={thm}
                type="button"
                onClick={() => handleThemeChange(thm)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  current.boardTheme === thm
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400 text-slate-950 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {thm}
              </button>
            ))}
          </div>
        </div>

        {/* Rules & Help Button */}
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-bold">Official Ludo Rules</h4>
              <p className="text-xs text-slate-400">Traditional guidelines, safe zones & movement</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-400">View Rules →</span>
        </button>

        {/* Danger Zone: Reset All Data */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Profile & Statistics</span>
          </button>
        </div>
      </main>

      {/* Rules Modal */}
      <Modal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        title="Official Ludo Rules"
        maxWidth="md"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-300 max-h-96 overflow-y-auto pr-1">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong className="text-amber-300 block mb-1">1. Entering the Board</strong>
            A roll of 6 releases a token from the yard onto your starting cell. A roll of 6 also grants a bonus roll!
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong className="text-amber-300 block mb-1">2. Capturing Opponents</strong>
            Landing on an opponent's token sends it back to their yard, and grants you an immediate bonus turn!
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong className="text-amber-300 block mb-1">3. Safe Star Cells</strong>
            Cells marked with a ⭐ star and starting cells are Safe Zones. Tokens on safe cells cannot be captured.
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong className="text-amber-300 block mb-1">4. Winning Condition</strong>
            The first player to guide all 4 tokens into the central home triangle is crowned the Ludo Champion!
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset All Progress?"
        maxWidth="sm"
      >
        <div className="text-center pt-2">
          <p className="text-sm text-slate-300 mb-6">
            This will wipe your level, match history, win streaks, and achievements. This action cannot be undone.
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="md"
              variant="secondary"
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-3"
            >
              Cancel
            </Button>
            <Button
              size="md"
              variant="danger"
              onClick={handleResetData}
              className="flex-1 py-3"
            >
              Confirm Wipe
            </Button>
          </div>
        </div>
      </Modal>

      <footer className="text-xs text-slate-500 py-3">
        LUDO ROYALE • Version 2.4.0 Engine
      </footer>
    </div>
  );
};
