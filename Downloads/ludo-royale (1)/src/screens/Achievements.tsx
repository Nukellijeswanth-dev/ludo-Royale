import React from 'react';
import { playerProfileService } from '../services/playerProfileService';
import { Achievement } from '../types/playerTypes';
import { ProgressBar } from '../components/common/ProgressBar';
import { ArrowLeft, Award, Lock, CheckCircle2, Coins, Sparkles } from 'lucide-react';

interface AchievementsProps {
  onBack: () => void;
}

export const Achievements: React.FC<AchievementsProps> = ({ onBack }) => {
  const achievements: Achievement[] = playerProfileService.getAchievements();
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-y-auto">
      {/* Top Header */}
      <header className="w-full max-w-3xl flex items-center justify-between py-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl sm:text-2xl font-bold font-display text-amber-300">
            Royal Trophies
          </h1>
        </div>

        <div className="w-16" />
      </header>

      {/* Main Container */}
      <main className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-5">
        {/* Progress Banner */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-950 to-indigo-950/40 border border-amber-500/30">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Completion Rate
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
              {unlockedCount} / {achievements.length} Unlocked
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xl font-black">
            {Math.round((unlockedCount / (achievements.length || 1)) * 100)}%
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
          {achievements.map((ach) => {
            const isUnlocked = ach.unlocked;
            const progress = ach.progress || 0;
            const percent = Math.min(100, Math.round((progress / ach.target) * 100));

            return (
              <div
                key={ach.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 border-amber-500/40 shadow-md'
                    : 'bg-slate-950/70 border-slate-800/80 opacity-80'
                }`}
              >
                {/* Left: Icon & Details */}
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${
                      isUnlocked
                        ? 'bg-amber-500/20 border-amber-400/60 shadow-lg ring-1 ring-amber-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-500 grayscale'
                    }`}
                  >
                    {ach.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm sm:text-base font-bold truncate ${
                          isUnlocked ? 'text-amber-300' : 'text-slate-200'
                        }`}
                      >
                        {ach.title}
                      </h4>
                      {isUnlocked ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3" /> Unlocked
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {ach.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-2.5 max-w-xs">
                      <ProgressBar
                        current={progress}
                        total={ach.target}
                        color={isUnlocked ? 'from-emerald-400 to-teal-500' : 'from-amber-400 to-amber-500'}
                        showPercent={true}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Rewards badge */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 sm:gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">+{ach.rewardCoins}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300">+{ach.rewardXp} XP</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="text-xs text-slate-500 py-3">
        Royal Honors & Distinctions
      </footer>
    </div>
  );
};
